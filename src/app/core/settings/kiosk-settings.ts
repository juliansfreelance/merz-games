import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { PlatformService } from '../platform/platform.service';
import { AppLogger } from '../logging/app-error';

/** Clave de localStorage para los ajustes del kiosco. */
const SETTINGS_STORAGE_KEY = 'merz-games.kiosk-settings';

/** Modo del protector de pantalla. */
export type ScreensaverMode = 'classic' | 'video';

/** Forma de los ajustes persistidos (todos los campos opcionales para compatibilidad). */
interface KioskSettingsData {
  screensaverMode: ScreensaverMode;
  /**
   * Habilita o deshabilita todo el audio de la aplicación.
   * Default: true. La UI del interruptor es Fase 7.
   */
  soundEnabled: boolean;
  /**
   * Override operativo del número de parejas para el motor de Memoria.
   * null = sin override; la cascada arranca en el nivel de experiencia/motor.
   * El panel para cambiar este valor es Fase 7.
   */
  memoryPairs: number | null;
}

const DEFAULT_SETTINGS: KioskSettingsData = {
  screensaverMode: 'classic',
  soundEnabled: true,
  memoryPairs: null,
};

/**
 * Servicio de ajustes locales del kiosco.
 *
 * Gestiona configuraciones que persisten entre reinicios (localStorage).
 * Sin UI de panel: solo la API que Fase 7 enlazará.
 *
 * Ajustes actuales:
 * - `screensaverMode`: `'classic' | 'video'` (default: `'classic'`).
 * - `soundEnabled`: boolean (default: `true`). Con `false`, silencia BGM y SFX.
 * - `memoryPairs`: número de parejas para Memoria | null (sin override).
 *
 * FUERA DE ALCANCE ahora: UI del panel, activar el protector, timeout de 3 min.
 */
@Injectable({ providedIn: 'root' })
export class KioskSettings {
  private readonly platform = inject(PlatformService);
  private readonly logger = inject(AppLogger);

  private readonly _data = signal<KioskSettingsData>(this._loadSettings());

  /** Modo del protector de pantalla actualmente configurado. */
  readonly screensaverMode = computed(() => this._data().screensaverMode);

  /**
   * Audio habilitado/deshabilitado a nivel de kiosco.
   * Con false no suena ni BGM ni SFX.
   * La UI del interruptor es Fase 7; esta fase implementa solo la API.
   */
  readonly soundEnabled = computed(() => this._data().soundEnabled);

  /**
   * Override operativo del número de parejas para el motor de Memoria.
   * null = sin override (la cascada parte del nivel de experiencia/motor).
   * El panel para cambiar este valor es Fase 7.
   */
  readonly memoryPairs = computed(() => this._data().memoryPairs);

  constructor() {
    // Persistir cada vez que cualquier ajuste cambie (efecto secundario real).
    effect(() => {
      try {
        this.platform.storageSet(SETTINGS_STORAGE_KEY, JSON.stringify(this._data()));
      } catch {
        this.logger.warn('KioskSettings', 'No se pudo persistir los ajustes.');
      }
    });
  }

  // ─── Setters públicos (la UI los usará en Fase 7) ─────────────────────────

  setScreensaverMode(mode: ScreensaverMode): void {
    this._patch({ screensaverMode: mode });
    this.logger.info('KioskSettings', `Modo protector cambiado a: ${mode}`);
  }

  setSoundEnabled(enabled: boolean): void {
    this._patch({ soundEnabled: enabled });
    this.logger.info('KioskSettings', `Sonido ${enabled ? 'activado' : 'desactivado'}.`);
  }

  /**
   * Establece el override operativo de parejas para Memoria.
   * Pasar `null` restaura el valor del catálogo (experiencia/motor).
   */
  setMemoryPairs(pairs: number | null): void {
    this._patch({ memoryPairs: pairs });
    this.logger.info('KioskSettings', `memoryPairs override: ${pairs ?? 'null (catálogo)'}`);
  }

  // ─── Interno ─────────────────────────────────────────────────────────────────

  private _patch(partial: Partial<KioskSettingsData>): void {
    this._data.update((current) => ({ ...current, ...partial }));
  }

  private _loadSettings(): KioskSettingsData {
    const raw = this.platform.storageGet(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    try {
      const parsed = JSON.parse(raw) as Partial<KioskSettingsData>;

      const screensaverMode: ScreensaverMode =
        parsed.screensaverMode === 'classic' || parsed.screensaverMode === 'video'
          ? parsed.screensaverMode
          : DEFAULT_SETTINGS.screensaverMode;

      const soundEnabled: boolean =
        typeof parsed.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled;

      const memoryPairs: number | null =
        parsed.memoryPairs === null
          ? null
          : typeof parsed.memoryPairs === 'number' &&
            Number.isInteger(parsed.memoryPairs) &&
            parsed.memoryPairs >= 2 &&
            parsed.memoryPairs <= 6
          ? parsed.memoryPairs
          : DEFAULT_SETTINGS.memoryPairs;

      return { screensaverMode, soundEnabled, memoryPairs };
    } catch {
      this.logger.warn('KioskSettings', 'Ajustes persistidos corruptos, usando defaults.');
      return { ...DEFAULT_SETTINGS };
    }
  }
}
