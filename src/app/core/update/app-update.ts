import { inject, Injectable } from '@angular/core';
import { PlatformService } from '../platform/platform.service';
import {
  APP_UPDATE_ANDROID_SIDELOAD_MESSAGE,
  APP_UPDATE_ERROR_MESSAGE,
} from './update.constants';

export interface AppUpdateCheck {
  readonly available: boolean;
  readonly version?: string;
  readonly skipped?: boolean;
  readonly errorMessage?: string;
}

export interface AppUpdateInstallResult {
  readonly ok: boolean;
  readonly installed: boolean;
  readonly errorMessage?: string;
}

/**
 * Canal de actualización del ejecutable (Tauri Updater).
 * En navegador no consulta GitHub. En desktop nativo usa el plugin firmado
 * (`plugins.updater` + GitHub Release `latest.json`).
 * En Android el canal binario no aplica: reinstalar APK.
 */

@Injectable({ providedIn: 'root' })
export class AppUpdate {
  private readonly platform = inject(PlatformService);

  async check(): Promise<AppUpdateCheck> {
    if (!this.platform.isNative) {
      return {
        available: false,
        skipped: true,
        errorMessage:
          'La actualización del ejecutable solo está disponible en la app nativa de escritorio.',
      };
    }

    if (!this.platform.supportsBinaryUpdater) {
      return {
        available: false,
        skipped: true,
        errorMessage: APP_UPDATE_ANDROID_SIDELOAD_MESSAGE,
      };
    }

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        return { available: false };
      }
      return { available: true, version: update.version };
    } catch {
      return {
        available: false,
        errorMessage: APP_UPDATE_ERROR_MESSAGE,
      };
    }
  }

  async downloadAndInstall(): Promise<AppUpdateInstallResult> {
    if (!this.platform.isNative) {
      return {
        ok: true,
        installed: false,
        errorMessage:
          'La actualización del ejecutable solo está disponible en la app nativa de escritorio.',
      };
    }

    if (!this.platform.supportsBinaryUpdater) {
      return {
        ok: true,
        installed: false,
        errorMessage: APP_UPDATE_ANDROID_SIDELOAD_MESSAGE,
      };
    }

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        return { ok: true, installed: false };
      }
      await update.downloadAndInstall();
      return { ok: true, installed: true };
    } catch {
      return {
        ok: false,
        installed: false,
        errorMessage: APP_UPDATE_ERROR_MESSAGE,
      };
    }
  }
}
