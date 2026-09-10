import { Injectable, signal } from '@angular/core';
import { assetUrl } from '../platform/asset-url';

/** Tope de entradas no críticas en la caché (LRU). */
export const IMAGE_CACHE_LRU_LIMIT = 24;

/**
 * Logos / chrome institucional que no se liberan tras el splash.
 * Deben coincidir con los CORE del splash (subset crítico).
 */
export const IMAGE_CACHE_CRITICAL_URLS: readonly string[] = [
  '/content/images/merzGamesIcono.png',
  '/content/images/merzGamesLogotipo.png',
  '/content/images/MerzAestheticsLogo.svg',
  '/content/images/texture.jpg',
  '/content/images/experiences/result/win.png',
  '/content/images/experiences/result/die.png',
  '/content/images/experiences/result/lose.png',
  '/content/images/experiences/result/draw.png',
  '/content/images/experiences/result/warning.png',
];

/**
 * Servicio centralizado de caché de imágenes en memoria.
 *
 * Mantiene referencias vivas a objetos `HTMLImageElement` decodificados
 * para evitar parpadeos. Tras el splash se puede liberar lo no crítico;
 * las entradas no fijadas respetan un LRU pequeño.
 */
@Injectable({
  providedIn: 'root',
})
export class ImageCacheService {
  private readonly _cache = new Map<string, HTMLImageElement>();
  private readonly _inFlight = new Map<string, Promise<void>>();
  /** Orden de uso para LRU (solo URLs no críticas). */
  private readonly _lruOrder: string[] = [];
  private readonly _critical = new Set(IMAGE_CACHE_CRITICAL_URLS);

  readonly cachedCount = signal(0);

  async preload(url: string, timeoutMs = 12_000): Promise<void> {
    if (!url || typeof window === 'undefined') return;

    if (this._cache.has(url)) {
      this.touchLru(url);
      return;
    }

    const inFlight = this._inFlight.get(url);
    if (inFlight) {
      return inFlight;
    }

    const loadPromise = new Promise<void>((resolve) => {
      if (typeof Image === 'undefined') {
        resolve();
        return;
      }

      const img = new Image();
      let settled = false;

      const finish = (): void => {
        if (settled) return;
        settled = true;
        this._cache.set(url, img);
        this.touchLru(url);
        this.evictLruIfNeeded();
        this.cachedCount.set(this._cache.size);

        if (typeof img.decode === 'function' && img.naturalWidth > 0) {
          void img.decode().then(
            () => resolve(),
            () => resolve(),
          );
          return;
        }
        resolve();
      };

      img.onload = finish;
      img.onerror = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      img.src = assetUrl(url);

      if (img.complete) {
        finish();
      }
    });

    const timeoutPromise = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      void loadPromise.finally(() => {
        clearTimeout(timer);
        this._inFlight.delete(url);
        resolve();
      });
    });

    this._inFlight.set(url, timeoutPromise);
    return timeoutPromise;
  }

  async preloadMany(urls: string[], timeoutMs = 12_000): Promise<void> {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
    await Promise.allSettled(uniqueUrls.map((u) => this.preload(u, timeoutMs)));
  }

  has(url: string): boolean {
    return this._cache.has(url);
  }

  get(url: string): HTMLImageElement | undefined {
    const img = this._cache.get(url);
    if (img) this.touchLru(url);
    return img;
  }

  /** Libera una URL concreta de la caché. */
  release(url: string): void {
    if (!url) return;
    this._cache.delete(url);
    this._inFlight.delete(url);
    const idx = this._lruOrder.indexOf(url);
    if (idx >= 0) this._lruOrder.splice(idx, 1);
    this.cachedCount.set(this._cache.size);
  }

  /** Libera todo excepto las URLs indicadas (p. ej. críticas + marca activa). */
  releaseAllExcept(keep: readonly string[]): void {
    const keepSet = new Set(keep.filter(Boolean));
    for (const url of [...this._cache.keys()]) {
      if (!keepSet.has(url)) {
        this.release(url);
      }
    }
  }

  clear(): void {
    this._cache.clear();
    this._inFlight.clear();
    this._lruOrder.length = 0;
    this.cachedCount.set(0);
  }

  private touchLru(url: string): void {
    if (this._critical.has(url)) return;
    const idx = this._lruOrder.indexOf(url);
    if (idx >= 0) this._lruOrder.splice(idx, 1);
    this._lruOrder.push(url);
  }

  private evictLruIfNeeded(): void {
    while (this._lruOrder.length > IMAGE_CACHE_LRU_LIMIT) {
      const oldest = this._lruOrder.shift();
      if (!oldest) break;
      if (this._critical.has(oldest)) continue;
      this._cache.delete(oldest);
      this._inFlight.delete(oldest);
    }
    this.cachedCount.set(this._cache.size);
  }
}
