import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { PlatformService } from '../platform/platform.service';
import { AppLogger } from '../logging/app-error';
import { Difficulty, FirstPlayer } from '../games/triqui/triqui.model';
import { MemoryConfig, MemoryConfigOverride, MemoryDifficulty } from '../games/memory/memory.model';

/** Clave de localStorage para los ajustes del kiosco. */
const SETTINGS_STORAGE_KEY = 'merz-games.kiosk-settings';

/** Modo del protector de pantalla. */
export type ScreensaverMode = 'classic' | 'video';

/** Forma de los ajustes persistidos (todos los campos opcionales para compatibilidad). */
interface KioskSettingsData {
  screensaverMode: ScreensaverMode;
  /**
   * Habilita o deshabilita todo el audio de la aplicación.
   * Default: true. El interruptor vive en el panel de administración.
   */
  soundEnabled: boolean;
  /** Volumen de la música de fondo (0.0 a 1.0). */
  bgmVolume: number;
  /** Volumen de los efectos de sonido (0.0 a 1.0). */
  sfxVolume: number;
  /**
   * Override operativo del número de parejas para el motor de Memoria.
   * null = sin override; la cascada arranca en el nivel de experiencia/motor.
   * El panel para cambiar este valor es Fase 7.
   */
  memoryPairs: number | null;
  /**
   * Override operativo de la dificultad para el motor de Triqui.
   * null = sin override; la cascada arranca en el nivel de experiencia/motor.
   */
  triquiDifficulty: Difficulty | null;
  /**
   * Override operativo de quién empieza para el motor de Triqui.
   * null = sin override; la cascada arranca en el nivel de experiencia/motor.
   */
  triquiFirstPlayer: FirstPlayer | null;
  /** Overrides específicos por experiencia (clave = experienceId). */
  experienceOverrides?: Record<string, ExperienceSettingsOverride>;
}

export interface ExperienceSettingsOverride {
  memoryPairs?: number | null;
  memoryLives?: number | null;
  memoryDifficulty?: MemoryDifficulty | null;
  triquiDifficulty?: Difficulty | null;
  triquiFirstPlayer?: FirstPlayer | null;
}

const DEFAULT_SETTINGS: KioskSettingsData = {
  screensaverMode: 'classic',
  soundEnabled: true,
  bgmVolume: 0.4,
  sfxVolume: 0.8,
  memoryPairs: null,
  triquiDifficulty: null,
  triquiFirstPlayer: null,
  experienceOverrides: {},
};

/**
 * Servicio de ajustes locales del kiosco.
 *
 * Gestiona configuraciones que persisten entre reinicios (localStorage).
 * La UI del panel (Fase 7) llama a los setters; el protector en sí es Fase 8.
 *
 * Ajustes actuales:
 * - `screensaverMode`: `'classic' | 'video'` (default: `'classic'`).
 * - `soundEnabled`: boolean (default: `true`). Con `false`, silencia BGM y SFX.
 * - `memoryPairs`: número de parejas para Memoria | null (sin override).
 * - `triquiDifficulty`: dificultad para Triqui | null (sin override).
 * - `triquiFirstPlayer`: quién empieza en Triqui | null (sin override).
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
   */
  readonly soundEnabled = computed(() => this._data().soundEnabled);

  /** Volumen de música de fondo (0 a 1). */
  readonly bgmVolume = computed(() => this._data().bgmVolume ?? DEFAULT_SETTINGS.bgmVolume);

  /** Volumen de efectos de sonido (0 a 1). */
  readonly sfxVolume = computed(() => this._data().sfxVolume ?? DEFAULT_SETTINGS.sfxVolume);

  /**
   * Override operativo del número de parejas para el motor de Memoria.
   * null = sin override (la cascada parte del nivel de experiencia/motor).
   * El panel para cambiar este valor es Fase 7.
   */
  readonly memoryPairs = computed(() => this._data().memoryPairs);

  /**
   * Override operativo de dificultad para Triqui.
   * null = sin override (gobierna catálogo).
   */
  readonly triquiDifficulty = computed(() => this._data().triquiDifficulty);

  /**
   * Override operativo del primer jugador para Triqui.
   * null = sin override (gobierna catálogo).
   */
  readonly triquiFirstPlayer = computed(() => this._data().triquiFirstPlayer);

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

  setBgmVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._patch({ bgmVolume: clamped });
    this.logger.info('KioskSettings', `Volumen BGM cambiado a: ${clamped}`);
  }

  setSfxVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._patch({ sfxVolume: clamped });
    this.logger.info('KioskSettings', `Volumen SFX cambiado a: ${clamped}`);
  }

  /**
   * Establece el override operativo de parejas para Memoria.
   * Pasar `null` restaura el valor del catálogo (experiencia/motor).
   */
  setMemoryPairs(pairs: number | null): void {
    this._patch({ memoryPairs: pairs });
    this.logger.info('KioskSettings', `memoryPairs override: ${pairs ?? 'null (catálogo)'}`);
  }

  /**
   * Establece el override operativo de dificultad para Triqui.
   * Pasar `null` restaura el valor del catálogo.
   */
  setTriquiDifficulty(difficulty: Difficulty | null): void {
    this._patch({ triquiDifficulty: difficulty });
    this.logger.info(
      'KioskSettings',
      `triquiDifficulty override: ${difficulty ?? 'null (catálogo)'}`,
    );
  }

  /**
   * Establece el override operativo de primer jugador para Triqui.
   * Pasar `null` restaura el valor del catálogo.
   */
  setTriquiFirstPlayer(firstPlayer: FirstPlayer | null): void {
    this._patch({ triquiFirstPlayer: firstPlayer });
    this.logger.info(
      'KioskSettings',
      `triquiFirstPlayer override: ${firstPlayer ?? 'null (catálogo)'}`,
    );
  }

  /**
   * Obtiene la configuración completa de Memoria para una experiencia específica,
   * o null si no hay ningún override específico configurado para esa experiencia.
   */
  getExperienceMemoryConfig(experienceId: string): MemoryConfigOverride | null {
    const overrides = this._data().experienceOverrides;
    const exp = overrides?.[experienceId];
    if (!exp) return null;
    if (exp.memoryPairs === undefined && exp.memoryLives === undefined && exp.memoryDifficulty === undefined) {
      return null;
    }
    const result: MemoryConfigOverride = {
      ...(exp.memoryPairs !== undefined && exp.memoryPairs !== null ? { pairs: exp.memoryPairs } : {}),
      ...(exp.memoryLives !== undefined && exp.memoryLives !== null ? { lives: exp.memoryLives } : {}),
      ...(exp.memoryDifficulty !== undefined && exp.memoryDifficulty !== null ? { difficulty: exp.memoryDifficulty } : {}),
    };
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Establece u oculta la configuración completa de Memoria para una experiencia específica.
   * Pasar `null` borra todos los overrides de memoria de esa experiencia.
   */
  setExperienceMemoryConfig(experienceId: string, config: MemoryConfigOverride | null): void {
    const current = this._data();
    const prevOverrides = current.experienceOverrides ?? {};
    const expPrev = prevOverrides[experienceId] ?? {};
    const updatedOverrides = {
      ...prevOverrides,
      [experienceId]: {
        ...expPrev,
        memoryPairs: config?.pairs ?? null,
        memoryLives: config?.lives ?? null,
        memoryDifficulty: config?.difficulty ?? null,
      },
    };
    this._patch({ experienceOverrides: updatedOverrides });
    this.logger.info(
      'KioskSettings',
      `Exp "${experienceId}" memoryConfig override: pairs=${config?.pairs ?? 'default'}, lives=${config?.lives ?? 'default'}, diff=${config?.difficulty ?? 'default'}`,
    );
  }

  /**
   * Obtiene el número de parejas para una experiencia específica,
   * o el override global si no hay override por experiencia.
   */
  getExperienceMemoryPairs(experienceId: string): number | null {
    const overrides = this._data().experienceOverrides;
    if (overrides && overrides[experienceId]?.memoryPairs !== undefined) {
      return overrides[experienceId].memoryPairs!;
    }
    return this._data().memoryPairs;
  }

  /**
   * Establece el override de parejas para una experiencia específica.
   */
  setExperienceMemoryPairs(experienceId: string, pairs: number | null): void {
    const current = this._data();
    const prevOverrides = current.experienceOverrides ?? {};
    const expPrev = prevOverrides[experienceId] ?? {};
    const updatedOverrides = {
      ...prevOverrides,
      [experienceId]: {
        ...expPrev,
        memoryPairs: pairs,
      },
    };
    this._patch({ experienceOverrides: updatedOverrides });
    this.logger.info('KioskSettings', `Exp "${experienceId}" memoryPairs override: ${pairs ?? 'default'}`);
  }

  /**
   * Obtiene la dificultad de Triqui para una experiencia específica,
   * o el override global si no hay override por experiencia.
   */
  getExperienceTriquiDifficulty(experienceId: string): Difficulty | null {
    const overrides = this._data().experienceOverrides;
    if (overrides && overrides[experienceId]?.triquiDifficulty !== undefined) {
      return overrides[experienceId].triquiDifficulty!;
    }
    return this._data().triquiDifficulty;
  }

  /**
   * Establece la dificultad de Triqui para una experiencia específica.
   */
  setExperienceTriquiDifficulty(experienceId: string, diff: Difficulty | null): void {
    const current = this._data();
    const prevOverrides = current.experienceOverrides ?? {};
    const expPrev = prevOverrides[experienceId] ?? {};
    const updatedOverrides = {
      ...prevOverrides,
      [experienceId]: {
        ...expPrev,
        triquiDifficulty: diff,
      },
    };
    this._patch({ experienceOverrides: updatedOverrides });
    this.logger.info('KioskSettings', `Exp "${experienceId}" triquiDifficulty override: ${diff ?? 'default'}`);
  }

  /**
   * Obtiene la regla de quién empieza de Triqui para una experiencia específica,
   * o el override global si no hay override por experiencia.
   */
  getExperienceTriquiFirstPlayer(experienceId: string): FirstPlayer | null {
    const overrides = this._data().experienceOverrides;
    if (overrides && overrides[experienceId]?.triquiFirstPlayer !== undefined) {
      return overrides[experienceId].triquiFirstPlayer!;
    }
    return this._data().triquiFirstPlayer;
  }

  /**
   * Establece la regla de quién empieza de Triqui para una experiencia específica.
   */
  setExperienceTriquiFirstPlayer(experienceId: string, player: FirstPlayer | null): void {
    const current = this._data();
    const prevOverrides = current.experienceOverrides ?? {};
    const expPrev = prevOverrides[experienceId] ?? {};
    const updatedOverrides = {
      ...prevOverrides,
      [experienceId]: {
        ...expPrev,
        triquiFirstPlayer: player,
      },
    };
    this._patch({ experienceOverrides: updatedOverrides });
    this.logger.info('KioskSettings', `Exp "${experienceId}" triquiFirstPlayer override: ${player ?? 'default'}`);
  }

  /**
   * Restablece todos los ajustes operativos locales a sus valores por defecto (DEFAULT_SETTINGS).
   * Elimina todos los overrides de juegos y experiencias para que vuelvan a seguir el catálogo.
   */
  resetToDefault(): void {
    this._data.set({
      ...DEFAULT_SETTINGS,
      experienceOverrides: {},
    });
    try {
      this.platform.storageSet(SETTINGS_STORAGE_KEY, JSON.stringify(this._data()));
    } catch {
      this.logger.warn('KioskSettings', 'No se pudo persistir los ajustes tras restaurar.');
    }
    this.logger.info('KioskSettings', 'Ajustes de kiosco restaurados a los valores por defecto.');
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

      const bgmVolume: number =
        typeof parsed.bgmVolume === 'number' && !isNaN(parsed.bgmVolume)
          ? Math.max(0, Math.min(1, parsed.bgmVolume))
          : DEFAULT_SETTINGS.bgmVolume;

      const sfxVolume: number =
        typeof parsed.sfxVolume === 'number' && !isNaN(parsed.sfxVolume)
          ? Math.max(0, Math.min(1, parsed.sfxVolume))
          : DEFAULT_SETTINGS.sfxVolume;

      const memoryPairs: number | null =
        parsed.memoryPairs === null
          ? null
          : typeof parsed.memoryPairs === 'number' &&
            Number.isInteger(parsed.memoryPairs) &&
            parsed.memoryPairs >= 2 &&
            parsed.memoryPairs <= 6
          ? parsed.memoryPairs
          : DEFAULT_SETTINGS.memoryPairs;

      const triquiDifficulty: Difficulty | null =
        parsed.triquiDifficulty === 'easy' ||
        parsed.triquiDifficulty === 'medium' ||
        parsed.triquiDifficulty === 'hard'
          ? parsed.triquiDifficulty
          : null;

      const triquiFirstPlayer: FirstPlayer | null =
        parsed.triquiFirstPlayer === 'patient' ||
        parsed.triquiFirstPlayer === 'alternate' ||
        parsed.triquiFirstPlayer === 'random'
          ? parsed.triquiFirstPlayer
          : null;

      const experienceOverrides: Record<string, ExperienceSettingsOverride> =
        typeof parsed.experienceOverrides === 'object' && parsed.experienceOverrides !== null
          ? parsed.experienceOverrides
          : {};

      return {
        screensaverMode,
        soundEnabled,
        bgmVolume,
        sfxVolume,
        memoryPairs,
        triquiDifficulty,
        triquiFirstPlayer,
        experienceOverrides,
      };
    } catch {
      this.logger.warn('KioskSettings', 'Ajustes persistidos corruptos, usando defaults.');
      return { ...DEFAULT_SETTINGS };
    }
  }
}
