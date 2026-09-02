import { effect, inject, Injectable, signal } from '@angular/core';
import { PlatformService } from '../platform/platform.service';
import { AppLogger } from '../logging/app-error';

/** Clave de localStorage para los ajustes del kiosco. */
const SETTINGS_STORAGE_KEY = 'merz-games.kiosk-settings';

/** Modo del protector de pantalla. */
export type ScreensaverMode = 'classic' | 'video';

/** Forma de los ajustes persistidos. */
interface KioskSettingsData {
  screensaverMode: ScreensaverMode;
}

const DEFAULT_SETTINGS: KioskSettingsData = {
  screensaverMode: 'classic',
};

/**
 * Servicio de ajustes locales del kiosco.
 *
 * Gestiona configuraciones que persisten entre reinicios (localStorage).
 * Sin UI de panel: solo la API que Fase 7 enlazará.
 *
 * Ajustes actuales:
 * - `screensaverMode`: `'classic' | 'video'` (default: `'classic'`).
 *
 * FUERA DE ALCANCE ahora: activar el protector, timeout de 3 min, logo flotante.
 */
@Injectable({ providedIn: 'root' })
export class KioskSettings {
  private readonly platform = inject(PlatformService);
  private readonly logger = inject(AppLogger);

  /** Modo del protector de pantalla actualmente configurado. */
  readonly screensaverMode = signal<ScreensaverMode>(
    this.loadScreensaverMode(),
  );

  constructor() {
    // Persistir cada vez que el modo cambie.
    effect(() => {
      const data: KioskSettingsData = {
        screensaverMode: this.screensaverMode(),
      };
      try {
        this.platform.storageSet(SETTINGS_STORAGE_KEY, JSON.stringify(data));
      } catch {
        this.logger.warn('KioskSettings', 'No se pudo persistir los ajustes.');
      }
    });
  }

  /**
   * Cambia el modo del protector de pantalla.
   * La UI del panel (Fase 7) llamará a este método.
   */
  setScreensaverMode(mode: ScreensaverMode): void {
    this.screensaverMode.set(mode);
    this.logger.info('KioskSettings', `Modo protector cambiado a: ${mode}`);
  }

  // ─── Interno ─────────────────────────────────────────────────────────────────

  private loadScreensaverMode(): ScreensaverMode {
    const raw = this.platform.storageGet(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS.screensaverMode;

    try {
      const parsed = JSON.parse(raw) as Partial<KioskSettingsData>;
      if (parsed.screensaverMode === 'classic' || parsed.screensaverMode === 'video') {
        return parsed.screensaverMode;
      }
    } catch {
      this.logger.warn('KioskSettings', 'Ajustes persistidos corruptos, usando defaults.');
    }

    return DEFAULT_SETTINGS.screensaverMode;
  }
}
