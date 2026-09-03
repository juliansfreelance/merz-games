import { Injectable, signal, Signal } from '@angular/core';

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
   * En Tauri el WebView comparte el mismo `localStorage`.
   * La escritura de assets de contenido en AppData queda para cuando
   * exista un pack publicado (`plugin-fs`).
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

  /** Reinicia la aplicación. En navegador no aplica. */
  async restart(): Promise<KioskCommandResult> {
    return this.invokeKioskCommand('restart_app');
  }

  /** Cierra la aplicación. En navegador no aplica. */
  async exit(): Promise<KioskCommandResult> {
    return this.invokeKioskCommand('exit_app');
  }

  /** Quita fullscreen y restaura decoraciones de ventana. En navegador no aplica. */
  async leaveKiosk(): Promise<KioskCommandResult> {
    return this.invokeKioskCommand('leave_kiosk');
  }

  /** Pone la ventana a pantalla completa y quita decoraciones (modo kiosco). En navegador no aplica. */
  async enterKiosk(): Promise<KioskCommandResult> {
    return this.invokeKioskCommand('enter_kiosk');
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
