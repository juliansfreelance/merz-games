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
