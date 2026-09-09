import { Injectable, signal } from '@angular/core';

/**
 * Servicio centralizado de caché de imágenes en memoria.
 *
 * Mantiene referencias vivas a objetos `HTMLImageElement` decodificados
 * durante todo el ciclo de vida del kiosco para:
 * 1. Evitar que el recolector de basura (GC) elimine las texturas/bitmaps de la GPU.
 * 2. Garantizar que componentes como `ResultScreen`, `GameExitConfirmDialog`,
 *    `CatalogCard`, portadas de marcas y cartas de juego rendericen de forma
 *    instantánea (0 ms) sin parpadeos ni peticiones redundantes.
 */
@Injectable({
  providedIn: 'root',
})
export class ImageCacheService {
  /** Almacén en memoria de elementos HTMLImageElement cargados. */
  private readonly _cache = new Map<string, HTMLImageElement>();

  /** Registro de precargas en vuelo para coalescer solicitudes idénticas. */
  private readonly _inFlight = new Map<string, Promise<void>>();

  /** Contador reactivo de imágenes actualmente en caché. */
  readonly cachedCount = signal(0);

  /**
   * Precarga y decodifica una imagen en memoria.
   * Si ya está en caché o en vuelo, reutiliza la operación.
   */
  async preload(url: string, timeoutMs = 12_000): Promise<void> {
    if (!url || typeof window === 'undefined') return;

    if (this._cache.has(url)) {
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
        // Resiliente: no detiene el arranque de la app si un asset individual falla
        resolve();
      };

      img.src = url;

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

  /**
   * Precarga múltiples imágenes en paralelo de forma resiliente.
   */
  async preloadMany(urls: string[], timeoutMs = 12_000): Promise<void> {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
    await Promise.allSettled(uniqueUrls.map((u) => this.preload(u, timeoutMs)));
  }

  /** Comprueba si una imagen ya está registrada en la caché en memoria. */
  has(url: string): boolean {
    return this._cache.has(url);
  }

  /** Obtiene la instancia `HTMLImageElement` en memoria si existe. */
  get(url: string): HTMLImageElement | undefined {
    return this._cache.get(url);
  }

  /** Limpia la caché en memoria (útil en pruebas o reset manual). */
  clear(): void {
    this._cache.clear();
    this._inFlight.clear();
    this.cachedCount.set(0);
  }
}
