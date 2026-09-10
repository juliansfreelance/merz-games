import { Injectable, signal, Signal } from '@angular/core';
import { APP_VERSION } from './app-version';

export type PlatformKind = 'browser' | 'tauri';

/** Resultado de un comando nativo de kiosco. */
export interface KioskCommandResult {
  readonly ok: boolean;
  readonly message?: string;
}

interface TauriGlobals {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
}

const BROWSER_ONLY_MESSAGE = 'Solo en la app de escritorio';

function detectNative(): boolean {
  if (typeof window === 'undefined') return false;
  const globals = window as Window & TauriGlobals;
  return !!globals.__TAURI_INTERNALS__ || !!globals.__TAURI__;
}

@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  private readonly _isNative = detectNative();
  private readonly _platformKind: PlatformKind = this._isNative ? 'tauri' : 'browser';
  private readonly _appVersion = signal<string>(APP_VERSION);
  private readonly _isKiosk = signal<boolean>(true);

  constructor() {
    if (!this._isNative && typeof document !== 'undefined') {
      this._isKiosk.set(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', () => {
        this._isKiosk.set(!!document.fullscreenElement);
      });
    }
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

  /** Indica si la aplicación está en modo kiosco (pantalla completa sin decoraciones). */
  get isKiosk(): Signal<boolean> {
    return this._isKiosk.asReadonly();
  }

  /**
   * Lee un valor del almacén persistente local.
   *
   * Implementación actual: `localStorage` del WebView.
   * En Tauri el WebView comparte el mismo `localStorage`.
   * Los packs OTA de imágenes/audio/video viven en AppLocalData (`content/`)
   * vía `ContentPack` + `plugin-fs`, no en este almacén de texto.
   */
  storageGet(key: string): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  /**
   * Escribe un valor en el almacén persistente local.
   *
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

  /**
   * Elimina una clave del almacén persistente local.
   */
  storageRemove(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {
      // Storage deshabilitado: continuar.
    }
  }

  /** Reinicia la aplicación. En navegador recarga la página. */
  async restart(): Promise<KioskCommandResult> {
    if (!this._isNative) {
      if (typeof window !== 'undefined') {
        window.location.reload();
        return { ok: true };
      }
      return { ok: false, message: 'No se puede reiniciar en este entorno.' };
    }
    return this.invokeKioskCommand('restart_app');
  }

  /** Cierra la aplicación. En navegador no aplica. */
  async exit(): Promise<KioskCommandResult> {
    if (!this._isNative) {
      return {
        ok: false,
        message: 'Cerrar la aplicación solo está disponible en la app de escritorio.',
      };
    }
    return this.invokeKioskCommand('exit_app');
  }

  /** Quita fullscreen y restaura decoraciones de ventana. En navegador sale de fullscreen. */
  async leaveKiosk(): Promise<KioskCommandResult> {
    if (!this._isNative) {
      if (typeof document !== 'undefined' && document.exitFullscreen) {
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          }
          this._isKiosk.set(false);
          return { ok: true };
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          return { ok: false, message: detail || 'No se pudo salir de pantalla completa.' };
        }
      }
      this._isKiosk.set(false);
      return { ok: true };
    }
    const result = await this.invokeKioskCommand('leave_kiosk');
    if (result.ok) {
      this._isKiosk.set(false);
    }
    return result;
  }

  /** Pone la ventana a pantalla completa y quita decoraciones. En navegador activa fullscreen. */
  async enterKiosk(): Promise<KioskCommandResult> {
    if (!this._isNative) {
      if (typeof document !== 'undefined' && document.documentElement?.requestFullscreen) {
        try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          }
          this._isKiosk.set(true);
          return { ok: true };
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          return { ok: false, message: detail || 'No se pudo activar pantalla completa.' };
        }
      }
      this._isKiosk.set(true);
      return { ok: true };
    }
    const result = await this.invokeKioskCommand('enter_kiosk');
    if (result.ok) {
      this._isKiosk.set(true);
    }
    return result;
  }

  /** Alterna entre el modo kiosco (pantalla completa) y modo ventana. */
  async toggleKiosk(): Promise<KioskCommandResult> {
    if (this._isKiosk()) {
      return this.leaveKiosk();
    } else {
      return this.enterKiosk();
    }
  }

  private async invokeKioskCommand(command: string): Promise<KioskCommandResult> {
    if (!this._isNative) {
      return { ok: false, message: BROWSER_ONLY_MESSAGE };
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke(command);
      return { ok: true };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, message: detail || 'No se pudo ejecutar el comando nativo.' };
    }
  }

  /**
   * En Tauri sustituye el fallback por `getVersion()`.
   * En navegador (ng serve / GitHub Pages) conserva `APP_VERSION` de package.json.
   * Invocado desde `provideAppInitializer`, no desde el constructor.
   */
  async loadNativeVersion(): Promise<void> {
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
