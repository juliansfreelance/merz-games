import { effect, inject, Injectable } from '@angular/core';
import { AppLogger } from '../logging/app-error';
import { assetUrl } from '../platform/asset-url';
import { KioskSettings } from '../settings/kiosk-settings';

export interface PlayOptions {
  /** Reproducir en bucle. Default: false. */
  loop?: boolean;
  /** Volumen de 0 a 1. Default: 1. */
  volume?: number;
}

/** Número máximo de voces SFX simultáneas. */
const SFX_POOL_SIZE = 6;

/**
 * Servicio de reproducción de audio/video local para el kiosco.
 *
 * Tres canales independientes:
 *
 * **BGM (música de fondo):** un único elemento en loop, de toda la aplicación.
 * Persiste entre rutas y no se reinicia al navegar. Se inicia con `unlockBgm()`
 * tras el primer gesto del usuario (requisito de autoplay del navegador).
 *
 * **SFX (efectos de sonido solapables):** pool de N elementos reutilizables.
 * `playSfx()` nunca corta una voz en curso; varias pueden sonar simultáneamente.
 *
 * **Media genérico:** `play()` / `stop()` para la Fase 8 (video de atracción).
 * Corta la reproducción anterior como el canal original.
 *
 * Corrección Fase 5: `stop()` del canal genérico ya NO hace `src = '' + load()`
 * sobre elementos que viven en `preloadCache`. El cache se mantiene íntegro.
 *
 * Restricciones:
 * - Solo URLs locales (assets del bundle o rutas del sistema de archivos).
 * - Sin fetch a internet.
 * - Limpieza en `DestroyRef` (servicio `providedIn: 'root'`, vive toda la app).
 * - `soundEnabled = false` silencia todos los canales.
 */
@Injectable({ providedIn: 'root' })
export class MediaPlayer {
  private readonly logger = inject(AppLogger);
  private readonly settings = inject(KioskSettings);

  // ── Canal media genérico ───────────────────────────────────────────────────
  private _mediaElement: HTMLAudioElement | HTMLVideoElement | null = null;
  private readonly _preloadCache = new Map<string, HTMLAudioElement | HTMLVideoElement>();

  // ── Canal BGM ─────────────────────────────────────────────────────────────
  private _bgmElement: HTMLAudioElement | null = null;
  private _bgmUrl: string | null = null;
  private _bgmVolume = 0.35;
  private _bgmUnlocked = false;

  // ── Canal SFX ─────────────────────────────────────────────────────────────
  private readonly _sfxPool: HTMLAudioElement[] = [];

  constructor() {
    effect(() => {
      const enabled = this.settings.soundEnabled();
      const bgmVol = this.settings.bgmVolume ? this.settings.bgmVolume() : this._bgmVolume;
      if (this._bgmElement) {
        this._bgmElement.volume = enabled ? bgmVol : 0;
      }
    });
  }

  // ─── Canal media genérico ─────────────────────────────────────────────────

  /**
   * Inicia la reproducción de un activo local (audio o video).
   * Corta la reproducción genérica anterior.
   * No afecta al BGM ni al pool de SFX.
   * Si es un video y soundEnabled = false, se reproduce con volumen 0 (no se cancela la imagen).
   */
  play(url: string, options: PlayOptions = {}): void {
    const isVideo = /\.(mp4|webm)$/i.test(url);
    if (!this.settings.soundEnabled() && !isVideo) {
      this.logger.info('MediaPlayer', 'play() ignorado: soundEnabled = false.');
      return;
    }

    this._stopMediaOnly();

    const { loop = false, volume = 1 } = options;
    const element = this._preloadCache.get(url) ?? this._createElement(url);
    element.loop = loop;
    const effectiveVol = this.settings.soundEnabled() ? Math.max(0, Math.min(1, volume)) : 0;
    element.volume = effectiveVol;
    this._mediaElement = element;

    void element.play()?.catch((err: unknown) => {
      this.logger.error('MediaPlayer', `Error al reproducir "${url}":`, err);
    });

    this.logger.info('MediaPlayer', `[media] Reproduciendo: ${url}`, { loop, volume: effectiveVol });
  }

  /**
   * Detiene la reproducción del canal genérico.
   * FIX Fase 5: NO destruye (`src=''` + `load()`) elementos que pertenecen
   * al `preloadCache`; solo pausa y resetea el tiempo.
   */
  stop(): void {
    this._stopMediaOnly();
  }

  /**
   * Calcula el volumen efectivo de video respetando el interruptor maestro de audio.
   * Si soundEnabled() es false, retorna 0 (clip mudo pero visible).
   */
  effectiveVideoVolume(videoVolume?: number): number {
    if (!this.settings.soundEnabled()) {
      return 0;
    }
    const vol =
      typeof videoVolume === 'number'
        ? videoVolume
        : this.settings.videoVolume
        ? this.settings.videoVolume()
        : 0.5;
    return Math.max(0, Math.min(1, vol));
  }

  /** Precarga un activo local para minimizar la latencia al hacer `play()`. */
  preload(url: string): void {
    if (this._preloadCache.has(url)) return;
    const element = this._createElement(url);
    element.preload = 'auto';
    this._preloadCache.set(url, element);
    this.logger.info('MediaPlayer', `[media] Precargando: ${url}`);
  }

  /**
   * Precarga audio/video y espera a que el buffer esté listo (o falle / expire).
   * El splash usa esto para no marcar 100 % con SFX aún en vuelo.
   */
  preloadUntilReady(url: string, timeoutMs = 12_000): Promise<void> {
    this.preload(url);
    const element = this._preloadCache.get(url);
    if (!element) return Promise.resolve();

    const enough = typeof HTMLMediaElement !== 'undefined' ? HTMLMediaElement.HAVE_ENOUGH_DATA : 4;
    if (element.readyState >= enough) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        element.removeEventListener('canplaythrough', finish);
        element.removeEventListener('error', finish);
        resolve();
      };

      const timer = setTimeout(finish, timeoutMs);
      element.addEventListener('canplaythrough', finish, { once: true });
      element.addEventListener('error', finish, { once: true });
    });
  }

  // ─── Canal BGM ────────────────────────────────────────────────────────────

  /**
   * Configura la URL y el volumen del BGM.
   * No inicia la reproducción; la inicia `unlockBgm()` tras el primer gesto.
   */
  setBgm(url: string, volume = 0.35): void {
    this._bgmUrl = url;
    this._bgmVolume = Math.max(0, Math.min(1, volume));

    if (this._bgmElement) {
      this._bgmElement.volume = this._bgmVolume;
      if (this._bgmElement.src !== assetUrl(url)) {
        this._bgmElement.src = assetUrl(url);
        this._bgmElement.load();
      }
    }
  }

  /**
   * Desbloquea y arranca el BGM tras el primer gesto del usuario.
   * Llamar desde el shell (app.ts) en el primer evento `pointerup`.
   * Idempotente: llamadas adicionales no reinician la música.
   */
  unlockBgm(): void {
    if (this._bgmUnlocked) return;
    this._bgmUnlocked = true;
    this._startBgm();
  }

  /**
   * Pausa temporalmente el BGM sin reiniciar currentTime.
   * Utilizado durante clips de video del protector para no solapar audio.
   */
  pauseBgm(): void {
    if (!this._bgmElement) return;
    this._bgmElement.pause();
    this.logger.info('MediaPlayer', '[BGM] Pausada temporalmente.');
  }

  /**
   * Reanuda el BGM si fue desbloqueado previamente y soundEnabled está activo.
   * Utilizado en tramos clásicos del protector o al salir del protector.
   */
  resumeBgm(): void {
    if (!this._bgmElement || !this._bgmUnlocked) return;
    if (!this.settings.soundEnabled()) {
      this.logger.info('MediaPlayer', '[BGM] resumeBgm() ignorado: soundEnabled = false.');
      return;
    }

    const currentVol = this.settings.bgmVolume ? this.settings.bgmVolume() : this._bgmVolume;
    this._bgmElement.volume = currentVol;
    void this._bgmElement.play()?.catch((err: unknown) => {
      this.logger.warn('MediaPlayer', '[BGM] Error al reanudar BGM:', err);
    });
    this.logger.info('MediaPlayer', '[BGM] Reanudada.');
  }

  stopBgm(): void {
    if (!this._bgmElement) return;
    this._bgmElement.pause();
    this._bgmElement.currentTime = 0;
    this.logger.info('MediaPlayer', '[BGM] Detenida.');
  }

  // ─── Canal SFX ────────────────────────────────────────────────────────────

  /**
   * Reproduce un efecto de sonido sin cortar otras voces activas.
   * Usa un pool de elementos reutilizables; si todas las voces están ocupadas,
   * reutiliza la más antigua.
   */
  playSfx(url: string, volume = 1): void {
    if (!this.settings.soundEnabled()) return;

    const element = this._acquireSfxVoice();
    element.src = assetUrl(url);
    const sfxScale = this.settings.sfxVolume ? this.settings.sfxVolume() : 1;
    element.volume = Math.max(0, Math.min(1, volume * sfxScale));
    element.currentTime = 0;
    void element.play()?.catch((err: unknown) => {
      this.logger.warn('MediaPlayer', `[SFX] Error al reproducir "${url}":`, err);
    });
  }

  /** Precarga un SFX en el cache de media genérico para reducir latencia. */
  preloadSfx(url: string): void {
    this.preload(url);
  }

  // ─── Interno ─────────────────────────────────────────────────────────────────

  private _startBgm(): void {
    if (!this._bgmUrl) return;
    if (!this.settings.soundEnabled()) {
      this.logger.info('MediaPlayer', '[BGM] soundEnabled = false, no se inicia.');
      return;
    }

    if (!this._bgmElement) {
      this._bgmElement = document.createElement('audio');
      this._bgmElement.loop = true;
      this._bgmElement.src = assetUrl(this._bgmUrl);
    }

    this._bgmElement.volume = this._bgmVolume;
    void this._bgmElement.play()?.catch((err: unknown) => {
      this.logger.warn('MediaPlayer', '[BGM] Autoplay bloqueado por el navegador:', err);
    });

    this.logger.info('MediaPlayer', `[BGM] Iniciada: ${this._bgmUrl}`);
  }

  /** Pausa y resetea el canal genérico SIN corromper el preloadCache. */
  private _stopMediaOnly(): void {
    if (!this._mediaElement) return;

    this._mediaElement.pause();
    this._mediaElement.currentTime = 0;

    // Solo destruir el elemento si NO pertenece al preloadCache.
    const isInCache = Array.from(this._preloadCache.values()).includes(this._mediaElement);
    if (!isInCache) {
      this._mediaElement.src = '';
      this._mediaElement.load();
    }

    this.logger.info('MediaPlayer', '[media] Reproducción detenida.');
    this._mediaElement = null;
  }

  private _acquireSfxVoice(): HTMLAudioElement {
    // Buscar una voz libre (sin src o pausada/terminada)
    for (const el of this._sfxPool) {
      if (el.paused || el.ended || !el.src) return el;
    }
    // Si el pool no está lleno, crear nueva voz
    if (this._sfxPool.length < SFX_POOL_SIZE) {
      const el = document.createElement('audio');
      this._sfxPool.push(el);
      return el;
    }
    // Pool lleno: reutilizar la primera (más antigua)
    const oldest = this._sfxPool.shift()!;
    oldest.pause();
    this._sfxPool.push(oldest);
    return oldest;
  }

  private _createElement(url: string): HTMLAudioElement | HTMLVideoElement {
    const isVideo = /\.(mp4|webm)$/i.test(url);
    const el: HTMLAudioElement | HTMLVideoElement = isVideo
      ? document.createElement('video')
      : document.createElement('audio');
    el.src = assetUrl(url);
    return el;
  }
}
