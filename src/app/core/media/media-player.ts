import { effect, inject, Injectable, Signal, signal } from '@angular/core';
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
 * Persiste entre rutas y no se reinicia al navegar. Web/Windows: `unlockBgm()`
 * tras el primer gesto. Android: puede arrancar al cargar el asset (sin gesto).
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
 * - Segundo plano / pérdida de foco: `setBackgroundSuspended(true)` pausa audio.
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
  /** True cuando el elemento BGM existe (para que el effect de volumen reaccione). */
  private readonly _bgmReady = signal(false);

  // Web Audio: en Android/WebView `HTMLMediaElement.volume` a menudo se ignora.
  private _bgmAudioCtx: AudioContext | null = null;
  private _bgmGain: GainNode | null = null;
  private _bgmSourceConnected = false;
  private _bgmWebAudioPending = false;
  /** Pausado por interruptor maestro (no por screensaver ni segundo plano). */
  private _bgmPausedByMute = false;

  // ── Canal SFX ─────────────────────────────────────────────────────────────
  private readonly _sfxPool: HTMLAudioElement[] = [];

  // ── Segundo plano / pérdida de foco ───────────────────────────────────────
  private _backgroundSuspended = false;
  private _bgmPausedByBackground = false;
  private _mediaPausedByBackground = false;
  /** Unlock pidió arrancar pero la app estaba en segundo plano. */
  private _pendingStartAfterForeground = false;
  private readonly _backgroundSuspendedSig = signal(false);

  constructor() {
    effect(() => {
      const enabled = this.settings.soundEnabled();
      const bgmVol = this.settings.bgmVolume();
      const ready = this._bgmReady();

      if (!enabled) {
        if (ready && this._bgmElement) {
          this._ensureBgmWebAudio();
          this._applyBgmOutputLevel(0);
          this._syncBgmMutePause(false);
        }
        return;
      }

      // Audio general ON
      if (ready && this._bgmElement) {
        this._ensureBgmWebAudio();
        this._applyBgmOutputLevel(bgmVol);
        this._syncBgmMutePause(true);
        return;
      }

      // Desbloqueado pero aún sin elemento (p. ej. mute al arrancar en Android).
      if (this._bgmUnlocked && this._bgmUrl && !this._backgroundSuspended) {
        this._startBgm();
      }
    });
  }

  /** True cuando la app/pestaña no está en primer plano (silencio forzado). */
  get isBackgroundSuspended(): Signal<boolean> {
    return this._backgroundSuspendedSig.asReadonly();
  }

  /**
   * Silencia o reanuda el audio según primer plano.
   * Web: pestaña oculta / otra ventana. Windows/Android nativo: sin foco o minimizada.
   */
  setBackgroundSuspended(suspended: boolean): void {
    if (this._backgroundSuspended === suspended) return;
    this._backgroundSuspended = suspended;
    this._backgroundSuspendedSig.set(suspended);

    if (suspended) {
      this._suspendForBackground();
    } else {
      this._resumeFromBackground();
    }
  }

  // ─── Canal media genérico ─────────────────────────────────────────────────

  /**
   * Inicia la reproducción de un activo local (audio o video).
   * Corta la reproducción genérica anterior.
   * No afecta al BGM ni al pool de SFX.
   * Si es un video y soundEnabled = false, se reproduce con volumen 0 (no se cancela la imagen).
   */
  play(url: string, options: PlayOptions = {}): void {
    if (this._backgroundSuspended) {
      this.logger.info('MediaPlayer', 'play() ignorado: app en segundo plano.');
      return;
    }
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
    let vol: number;
    if (typeof videoVolume === 'number') {
      vol = videoVolume;
    } else if (this.settings.videoVolume) {
      vol = this.settings.videoVolume();
    } else {
      vol = 0.5;
    }
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
   * En web/Windows la reproducción la inicia `unlockBgm()` tras el primer gesto.
   * En Android puede arrancar en cuanto hay asset (autoplay permitido en WebView).
   */
  setBgm(url: string, volume = 0.35): void {
    this._bgmUrl = url;
    this._bgmVolume = Math.max(0, Math.min(1, volume));

    if (this._bgmElement) {
      if (this._bgmElement.src !== assetUrl(url)) {
        this._bgmElement.src = assetUrl(url);
        this._bgmElement.load();
      }
      this._applyBgmOutputLevel(this._effectiveBgmVolume());
    }

    // Ya desbloqueado (p. ej. Android): arrancar / reanudar con la URL actual.
    if (this._bgmUnlocked) {
      this._startBgm();
    }
  }

  /**
   * Desbloquea y arranca el BGM.
   * Web/Windows: tras el primer gesto. Android: también al cargar el asset (sin gesto).
   * Idempotente: llamadas adicionales no reinician la música.
   */
  unlockBgm(): void {
    if (this._bgmUnlocked) return;
    this._bgmUnlocked = true;
    this._startBgm();
  }

  /**
   * Tras un gesto de usuario: asegura control de volumen vía Web Audio (Android).
   * Seguro llamar varias veces (p. ej. desde pointerup o al tocar ajustes).
   */
  ensureInteractiveAudio(): void {
    this._ensureBgmWebAudio();
    this._applyBgmOutputLevel(this._effectiveBgmVolume());
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
    if (this._backgroundSuspended) {
      this.logger.info('MediaPlayer', '[BGM] resumeBgm() ignorado: app en segundo plano.');
      return;
    }
    if (!this._bgmElement || !this._bgmUnlocked) return;
    if (!this.settings.soundEnabled() || this._bgmPausedByMute) {
      this.logger.info('MediaPlayer', '[BGM] resumeBgm() ignorado: soundEnabled = false.');
      return;
    }

    this._applyBgmOutputLevel(this._effectiveBgmVolume());
    void this._bgmAudioCtx?.resume();
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
    if (this._backgroundSuspended) return;
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

  private _effectiveBgmVolume(): number {
    if (!this.settings.soundEnabled()) return 0;
    return this.settings.bgmVolume();
  }

  private _applyBgmOutputLevel(level: number): void {
    if (!this._bgmElement) return;
    const vol = Math.max(0, Math.min(1, level));

    if (this._bgmGain) {
      // Con Web Audio el nivel lo marca el GainNode; el elemento va a tope.
      this._bgmElement.volume = 1;
      this._bgmElement.muted = false;
      this._bgmGain.gain.value = vol;
      return;
    }

    this._bgmElement.volume = vol;
    this._bgmElement.muted = vol <= 0;
  }

  /**
   * Enlaza el BGM a un GainNode. Solo si AudioContext puede quedar `running`
   * (tras gesto); si no, no conecta para no silenciar el elemento HTML.
   */
  private _ensureBgmWebAudio(): void {
    if (this._bgmSourceConnected || this._bgmWebAudioPending || !this._bgmElement) return;
    if (typeof window === 'undefined') return;

    const AudioCtxCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;

    this._bgmWebAudioPending = true;

    try {
      const ctx = new AudioCtxCtor();
      const connect = (): void => {
        if (this._bgmSourceConnected || !this._bgmElement || ctx.state !== 'running') {
          this._bgmWebAudioPending = false;
          if (ctx.state !== 'running') {
            void ctx.close().catch(() => undefined);
          }
          return;
        }
        try {
          const gain = ctx.createGain();
          const source = ctx.createMediaElementSource(this._bgmElement);
          source.connect(gain);
          gain.connect(ctx.destination);
          this._bgmAudioCtx = ctx;
          this._bgmGain = gain;
          this._bgmSourceConnected = true;
          this._bgmWebAudioPending = false;
          this._applyBgmOutputLevel(this._effectiveBgmVolume());
          this.logger.info('MediaPlayer', '[BGM] Control de volumen vía Web Audio (GainNode).');
        } catch (err: unknown) {
          this._bgmWebAudioPending = false;
          void ctx.close().catch(() => undefined);
          this.logger.warn('MediaPlayer', '[BGM] No se pudo crear GainNode:', err);
        }
      };

      if (ctx.state === 'running') {
        connect();
      } else {
        void ctx
          .resume()
          .then(connect)
          .catch(() => {
            this._bgmWebAudioPending = false;
            void ctx.close().catch(() => undefined);
          });
      }
    } catch (err: unknown) {
      this._bgmWebAudioPending = false;
      this.logger.warn('MediaPlayer', '[BGM] AudioContext no disponible:', err);
    }
  }

  /** Mute maestro: pausar (fiable en Android; `volume` del elemento a menudo se ignora). */
  private _syncBgmMutePause(enabled: boolean): void {
    if (!this._bgmElement) return;

    if (!enabled) {
      if (!this._bgmElement.paused) {
        this._bgmPausedByMute = true;
        this._bgmElement.pause();
        this.logger.info('MediaPlayer', '[BGM] Pausada por audio general desactivado.');
      }
      return;
    }

    if (this._bgmPausedByMute) {
      this._bgmPausedByMute = false;
      if (!this._backgroundSuspended && this._bgmUnlocked) {
        this.resumeBgm();
      }
    }
  }

  private _startBgm(): void {
    if (this._backgroundSuspended) {
      this._pendingStartAfterForeground = true;
      this.logger.info('MediaPlayer', '[BGM] Arranque diferido: app en segundo plano.');
      return;
    }
    this._pendingStartAfterForeground = false;
    if (!this._bgmUrl) return;
    if (!this.settings.soundEnabled() || this._bgmPausedByMute) {
      this.logger.info('MediaPlayer', '[BGM] soundEnabled = false, no se inicia.');
      return;
    }

    if (!this._bgmElement) {
      this._bgmElement = document.createElement('audio');
      this._bgmElement.loop = true;
      this._bgmElement.preload = 'auto';
      this._bgmElement.src = assetUrl(this._bgmUrl);
      this._bgmReady.set(true);
    }

    this._applyBgmOutputLevel(this._effectiveBgmVolume());

    const el = this._bgmElement;
    const tryPlay = (): void => {
      if (this._backgroundSuspended || !this._bgmUnlocked) return;
      if (!this.settings.soundEnabled() || this._bgmPausedByMute) return;
      void this._bgmAudioCtx?.resume();
      void el.play()?.catch((err: unknown) => {
        this.logger.warn('MediaPlayer', '[BGM] Autoplay bloqueado por el navegador:', err);
      });
    };

    // Esperar a que el asset esté listo (útil en Android / carga lenta).
    // HAVE_FUTURE_DATA = 3 (evitar depender de HTMLMediaElement en tests/jsdom).
    if (el.readyState >= 3) {
      tryPlay();
    } else {
      el.addEventListener('canplay', tryPlay, { once: true });
      el.load();
    }

    this.logger.info('MediaPlayer', `[BGM] Iniciada: ${this._bgmUrl}`);
  }

  private _suspendForBackground(): void {
    this._bgmPausedByBackground = false;
    this._mediaPausedByBackground = false;

    if (this._bgmElement && !this._bgmElement.paused) {
      this._bgmPausedByBackground = true;
      this._bgmElement.pause();
    }

    for (const sfx of this._sfxPool) {
      if (!sfx.paused) sfx.pause();
    }

    if (this._mediaElement && !this._mediaElement.paused) {
      this._mediaPausedByBackground = true;
      this._mediaElement.pause();
    }

    this.logger.info('MediaPlayer', 'Audio suspendido (segundo plano / sin foco).');
  }

  private _resumeFromBackground(): void {
    if (this._bgmPausedByBackground) {
      this._bgmPausedByBackground = false;
      this.resumeBgm();
    } else if (this._pendingStartAfterForeground) {
      this._startBgm();
    }

    if (this._mediaPausedByBackground && this._mediaElement) {
      this._mediaPausedByBackground = false;
      void this._mediaElement.play()?.catch((err: unknown) => {
        this.logger.warn('MediaPlayer', '[media] Error al reanudar tras segundo plano:', err);
      });
    }

    this.logger.info('MediaPlayer', 'Audio listo para primer plano.');
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
