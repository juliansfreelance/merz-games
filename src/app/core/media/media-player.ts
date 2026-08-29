import { DestroyRef, inject, Injectable } from '@angular/core';
import { AppLogger } from '../logging/app-error';

export interface PlayOptions {
  /** Reproducir en bucle. Default: false. */
  loop?: boolean;
  /** Volumen de 0 a 1. Default: 1. */
  volume?: number;
}

/**
 * Servicio de reproducción de audio/video local para el kiosco.
 *
 * Responsabilidades:
 * - `play(url, options)` — reproducir un activo local (audio o video).
 * - `stop()` — detener la reproducción activa.
 * - `preload(url)` — preparar el activo para minimizar latencia.
 *
 * Restricciones:
 * - Solo URLs locales (assets del bundle o rutas del sistema de archivos del kiosco).
 * - Sin fetch a internet, sin YouTube, sin modo atracción.
 * - El elemento DOM se crea dinámicamente y se destruye con el servicio.
 * - Limpieza automática en `DestroyRef`.
 *
 * Fase 7 añadirá el loop de video de atracción; este servicio es el único
 * reproductor — no crear otros.
 */
@Injectable({ providedIn: 'root' })
export class MediaPlayer {
  private readonly logger = inject(AppLogger);
  private readonly destroyRef = inject(DestroyRef);

  private currentElement: HTMLAudioElement | HTMLVideoElement | null = null;
  private readonly preloadCache = new Map<string, HTMLAudioElement | HTMLVideoElement>();

  constructor() {
    this.destroyRef.onDestroy(() => this.cleanup());
  }

  /**
   * Inicia la reproducción de un activo local.
   * Si había algo reproduciéndose, lo detiene primero.
   *
   * @param url URL local del activo (audio o video).
   * @param options Opciones de bucle y volumen.
   */
  play(url: string, options: PlayOptions = {}): void {
    this.stop();

    const { loop = false, volume = 1 } = options;

    let element = this.preloadCache.get(url) ?? this.createElement(url);
    element.loop = loop;
    element.volume = Math.max(0, Math.min(1, volume));

    this.currentElement = element;

    element.play().catch((err: unknown) => {
      this.logger.error('MediaPlayer', `Error al reproducir "${url}":`, err);
    });

    this.logger.info('MediaPlayer', `Reproduciendo: ${url}`, { loop, volume });
  }

  /**
   * Detiene la reproducción activa y libera el elemento del DOM.
   */
  stop(): void {
    if (!this.currentElement) return;

    this.currentElement.pause();
    this.currentElement.currentTime = 0;
    this.currentElement.src = '';
    this.currentElement.load();
    this.logger.info('MediaPlayer', 'Reproducción detenida.');
    this.currentElement = null;
  }

  /**
   * Precarga un activo local para minimizar la latencia al hacer `play`.
   * No inicia la reproducción.
   */
  preload(url: string): void {
    if (this.preloadCache.has(url)) return;

    const element = this.createElement(url);
    element.preload = 'auto';
    this.preloadCache.set(url, element);
    this.logger.info('MediaPlayer', `Precargando: ${url}`);
  }

  // ─── Interno ─────────────────────────────────────────────────────────────────

  private createElement(url: string): HTMLAudioElement | HTMLVideoElement {
    const isVideo = /\.(mp4|webm|ogg)$/i.test(url);
    const el: HTMLAudioElement | HTMLVideoElement = isVideo
      ? document.createElement('video')
      : document.createElement('audio');
    el.src = url;
    return el;
  }

  private cleanup(): void {
    this.stop();
    this.preloadCache.forEach((el) => {
      el.src = '';
      el.load();
    });
    this.preloadCache.clear();
    this.logger.info('MediaPlayer', 'Limpieza completada (servicio destruido).');
  }
}
