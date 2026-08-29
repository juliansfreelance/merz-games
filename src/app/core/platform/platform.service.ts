import { Injectable, signal, Signal } from '@angular/core';

export type PlatformKind = 'browser' | 'tauri';

@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  private readonly _isNative =
    typeof window !== 'undefined' &&
    (!!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__);
  private readonly _platformKind: PlatformKind = this._isNative ? 'tauri' : 'browser';
  private readonly _appVersion = signal<string>('0.1.0');

  constructor() {
    this.initializeVersion();
  }

  get isNative(): boolean {
    return this._isNative;
  }

  get platformKind(): PlatformKind {
    return this._platformKind;
  }

  get appVersion(): Signal<string> {
    return this._appVersion.asReadonly();
  }

  /**
   * Lee un valor del almacén persistente local.
   *
   * Implementación actual: `localStorage` del WebView.
   * En Tauri el WebView comparte el mismo `localStorage`, por lo que no se
   * requiere ningún plugin adicional en Fases 3–5.
   *
   * PUNTO DE EXTENSIÓN (Fase 6): reemplazar el cuerpo de este método para
   * delegar al plugin `@tauri-apps/plugin-fs` y escribir en AppData cuando
   * se requiera acceso nativo al sistema de archivos.
   */
  storageGet(key: string): string | null {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Escribe un valor en el almacén persistente local.
   *
   * Misma nota de extensión que `storageGet`.
   * La escritura es atómica a nivel de `localStorage.setItem`:
   * si falla (cuota excedida, modo privado), se captura y se ignora
   * para no interrumpir el flujo de juego.
   */
  storageSet(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {
      // Cuota excedida o storage deshabilitado: continuar sin persistir.
    }
  }

  private async initializeVersion(): Promise<void> {
    if (this._isNative) {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const version = await getVersion();
        this._appVersion.set(version);
      } catch (error) {
        console.error('Error al obtener la versión nativa de Tauri:', error);
      }
    }
  }
}

