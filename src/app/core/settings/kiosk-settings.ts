import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { PlatformService } from '../platform/platform.service';
import { AppLogger } from '../logging/app-error';
import { CatalogService } from '../catalog/catalog';
import { Difficulty, FirstPlayer, Mark, PlayerSymbolChoice } from '../games/triqui/triqui.model';
import { MemoryConfig, MemoryConfigOverride, MemoryDifficulty } from '../games/memory/memory.model';

/** Clave de localStorage para los ajustes del kiosco. */
const SETTINGS_STORAGE_KEY = 'merz-games.kiosk-settings';

/** Modo del protector de pantalla. */
export type ScreensaverMode = 'classic' | 'video';

/** Orden de reproducción de los videos de atracción. */
export type ScreensaverVideoOrder = 'sequential' | 'random';

/** Valores y límites de inactividad para el protector (en milisegundos). */
export const SCREENSAVER_IDLE_DEFAULT_MS = 180_000; // 3 minutos
export const SCREENSAVER_IDLE_MIN_MS = 30_000;      // 30 segundos
export const SCREENSAVER_IDLE_MAX_MS = 900_000;     // 15 minutos
export const SCREENSAVER_IDLE_STEP_MS = 30_000;    // 30 segundos

/** Volumen por defecto para los clips de video. */
export const DEFAULT_VIDEO_VOLUME = 0.5;

/** Forma de los ajustes persistidos (todos los campos opcionales para compatibilidad). */
interface KioskSettingsData {
  screensaverMode: ScreensaverMode;
  /** Orden de los videos en modo protector de video ('sequential' | 'random'). */
  screensaverVideoOrder: ScreensaverVideoOrder;
  /** Tiempo de inactividad antes de activar el protector en ms (default 3 min: 180_000). */
  screensaverIdleMs: number;
  /** Volumen de los videos de atracción (0.0 a 1.0, default 0.5). */
  videoVolume: number;
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
  /**
   * Override operativo de la figura del jugador ('X', 'O' o 'random') para Triqui.
   * null = sin override; la cascada arranca en el nivel de experiencia/motor.
   */
  triquiPlayerSymbol: PlayerSymbolChoice | null;
  /** Overrides específicos por experiencia (clave = experienceId). */
  experienceOverrides?: Record<string, ExperienceSettingsOverride>;
}

export interface ExperienceSettingsOverride {
  memoryPairs?: number | null;
  memoryLives?: number | null;
  memoryDifficulty?: MemoryDifficulty | null;
  triquiDifficulty?: Difficulty | null;
  triquiFirstPlayer?: FirstPlayer | null;
  triquiPlayerSymbol?: PlayerSymbolChoice | null;
}

const DEFAULT_SETTINGS: KioskSettingsData = {
  screensaverMode: 'classic',
  screensaverVideoOrder: 'sequential',
  screensaverIdleMs: SCREENSAVER_IDLE_DEFAULT_MS,
  videoVolume: DEFAULT_VIDEO_VOLUME,
  soundEnabled: true,
  bgmVolume: 0.35,
  sfxVolume: 0.8,
  memoryPairs: null,
  triquiDifficulty: null,
  triquiFirstPlayer: null,
  triquiPlayerSymbol: null,
  experienceOverrides: {},
};

/**
 * Servicio de ajustes locales del kiosco.
 *
 * Gestiona configuraciones que persisten entre reinicios (localStorage).
 * La UI del panel (Fase 7 y 8) llama a los setters; el protector en sí es Fase 8.
 *
 * Ajustes actuales:
 * - `screensaverMode`: `'classic' | 'video'` (default: `'classic'`).
 * - `screensaverVideoOrder`: `'sequential' | 'random'` (default: `'sequential'`).
 * - `screensaverIdleMs`: tiempo de inactividad en ms (default: `180_000`, 3 min).
 * - `videoVolume`: volumen independiente de clips (0 a 1, default: `0.5`).
 * - `soundEnabled`: boolean (default: `true`). Con `false`, silencia BGM y SFX.
 * - `memoryPairs`: número de parejas para Memoria | null (sin override).
 * - `triquiDifficulty`: dificultad para Triqui | null (sin override).
 * - `triquiFirstPlayer`: quién empieza en Triqui | null (sin override).
 */
@Injectable({ providedIn: 'root' })
export class KioskSettings {
  private readonly platform = inject(PlatformService);
  private readonly logger = inject(AppLogger);
  private readonly catalog = inject(CatalogService);

  private readonly _data = signal<KioskSettingsData>(this._loadSettings());

  /** Modo del protector de pantalla actualmente configurado. */
  readonly screensaverMode = computed(() => this._data().screensaverMode);

  /** Orden de los videos en modo protector de video ('sequential' | 'random'). */
  readonly screensaverVideoOrder = computed(
    () => this._data().screensaverVideoOrder ?? DEFAULT_SETTINGS.screensaverVideoOrder,
  );

  /** Tiempo de inactividad antes de mostrar el protector en ms (default 3 min: 180_000). */
  readonly screensaverIdleMs = computed(
    () => this._data().screensaverIdleMs ?? DEFAULT_SETTINGS.screensaverIdleMs,
  );

  /** Volumen de los clips de video del protector (0 a 1). */
  readonly videoVolume = computed(
    () => this._data().videoVolume ?? DEFAULT_SETTINGS.videoVolume,
  );

  // ─── Overrides volátiles por sesión (solo memoria, no se persisten) ─────────
  private readonly _sessionSoundEnabled = signal<boolean | null>(null);
  private readonly _sessionBgmVolume = signal<number | null>(null);
  private readonly _sessionSfxVolume = signal<number | null>(null);

  /** Valores configurados/persistidos en storage (panel de control / manifest). */
  readonly persistentSoundEnabled = computed(() => this._data().soundEnabled);
  readonly persistentBgmVolume = computed(() => this._data().bgmVolume ?? DEFAULT_SETTINGS.bgmVolume);
  readonly persistentSfxVolume = computed(() => this._data().sfxVolume ?? DEFAULT_SETTINGS.sfxVolume);

  /**
   * Audio habilitado/deshabilitado a nivel efectivo de sesión.
   * Si existe un ajuste temporal de sesión, lo prioriza; si no, toma el configurado.
   */
  readonly soundEnabled = computed(() => this._sessionSoundEnabled() ?? this.persistentSoundEnabled());

  /** Volumen de música de fondo efectivo de la sesión (0 a 1). */
  readonly bgmVolume = computed(() => this._sessionBgmVolume() ?? this.persistentBgmVolume());

  /** Volumen de efectos de sonido efectivo de la sesión (0 a 1). */
  readonly sfxVolume = computed(() => this._sessionSfxVolume() ?? this.persistentSfxVolume());

  /** Indica si la sesión actual tiene algún ajuste de audio temporal activo. */
  readonly hasSessionAudioOverrides = computed(
    () =>
      this._sessionSoundEnabled() !== null ||
      this._sessionBgmVolume() !== null ||
      this._sessionSfxVolume() !== null,
  );

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

  /**
   * Override operativo de la figura del jugador ('X' u 'O') para Triqui.
   * null = sin override (gobierna catálogo).
   */
  readonly triquiPlayerSymbol = computed(() => this._data().triquiPlayerSymbol);

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

  setScreensaverVideoOrder(order: ScreensaverVideoOrder): void {
    const valid = order === 'random' ? 'random' : 'sequential';
    this._patch({ screensaverVideoOrder: valid });
    this.logger.info('KioskSettings', `Orden videos protector cambiado a: ${valid}`);
  }

  setScreensaverIdleMs(idleMs: number): void {
    const sanitized =
      typeof idleMs === 'number' && !isNaN(idleMs)
        ? Math.max(
            SCREENSAVER_IDLE_MIN_MS,
            Math.min(SCREENSAVER_IDLE_MAX_MS, Math.round(idleMs)),
          )
        : SCREENSAVER_IDLE_DEFAULT_MS;
    this._patch({ screensaverIdleMs: sanitized });
    this.logger.info('KioskSettings', `Tiempo de inactividad cambiado a: ${sanitized} ms`);
  }

  setVideoVolume(volume: number): void {
    const clamped =
      typeof volume === 'number' && !isNaN(volume)
        ? Math.max(0, Math.min(1, volume))
        : DEFAULT_SETTINGS.videoVolume;
    this._patch({ videoVolume: clamped });
    this.logger.info('KioskSettings', `Volumen video cambiado a: ${clamped}`);
  }

  setSoundEnabled(enabled: boolean): void {
    this._sessionSoundEnabled.set(null);
    this._patch({ soundEnabled: enabled });
    this.logger.info('KioskSettings', `Sonido persistente ${enabled ? 'activado' : 'desactivado'}.`);
  }

  setBgmVolume(volume: number): void {
    this._sessionBgmVolume.set(null);
    const clamped = Math.max(0, Math.min(1, volume));
    this._patch({ bgmVolume: clamped });
    this.logger.info('KioskSettings', `Volumen BGM persistente cambiado a: ${clamped}`);
  }

  setSfxVolume(volume: number): void {
    this._sessionSfxVolume.set(null);
    const clamped = Math.max(0, Math.min(1, volume));
    this._patch({ sfxVolume: clamped });
    this.logger.info('KioskSettings', `Volumen SFX persistente cambiado a: ${clamped}`);
  }

  // ─── Control de Audio por Sesión (solo en memoria) ──────────────────────────

  /**
   * Modifica el estado de audio solo para la sesión activa (en memoria).
   * No se persiste en localStorage. Al recargar o reiniciar vuelve al valor del panel de control.
   */
  setSessionSoundEnabled(enabled: boolean): void {
    this._sessionSoundEnabled.set(enabled);
    this.logger.info('KioskSettings', `Sonido de sesión: ${enabled ? 'activado' : 'silenciado'}.`);
  }

  /**
   * Modifica el volumen de BGM solo para la sesión activa (en memoria).
   */
  setSessionBgmVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._sessionBgmVolume.set(clamped);
    this.logger.info('KioskSettings', `Volumen BGM de sesión: ${clamped}`);
  }

  /**
   * Modifica el volumen de SFX solo para la sesión activa (en memoria).
   */
  setSessionSfxVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._sessionSfxVolume.set(clamped);
    this.logger.info('KioskSettings', `Volumen SFX de sesión: ${clamped}`);
  }

  /**
   * Restablece todos los ajustes de audio de sesión a los valores configurados en el panel/catálogo.
   */
  clearSessionAudioOverrides(): void {
    this._sessionSoundEnabled.set(null);
    this._sessionBgmVolume.set(null);
    this._sessionSfxVolume.set(null);
    this.logger.info('KioskSettings', 'Ajustes de audio de sesión restablecidos a los valores del sistema.');
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
   * Obtiene la figura del jugador de Triqui ('X', 'O' o 'random') para una experiencia específica,
   * o el override global si no hay override por experiencia.
   */
  getExperienceTriquiPlayerSymbol(experienceId: string): PlayerSymbolChoice | null {
    const overrides = this._data().experienceOverrides;
    if (overrides && overrides[experienceId]?.triquiPlayerSymbol !== undefined) {
      return overrides[experienceId].triquiPlayerSymbol!;
    }
    return this._data().triquiPlayerSymbol;
  }

  /**
   * Establece la figura del jugador de Triqui ('X', 'O' o 'random') para una experiencia específica.
   */
  setExperienceTriquiPlayerSymbol(experienceId: string, symbol: PlayerSymbolChoice | null): void {
    const current = this._data();
    const prevOverrides = current.experienceOverrides ?? {};
    const expPrev = prevOverrides[experienceId] ?? {};
    const updatedOverrides = {
      ...prevOverrides,
      [experienceId]: {
        ...expPrev,
        triquiPlayerSymbol: symbol,
      },
    };
    this._patch({ experienceOverrides: updatedOverrides });
    this.logger.info('KioskSettings', `Exp "${experienceId}" triquiPlayerSymbol override: ${symbol ?? 'default'}`);
  }

  /**
   * Obtiene los valores por defecto iniciales de los ajustes basados en la sección app del manifest activo.
   */
  getManifestDefaultSettings(): KioskSettingsData {
    const manifest = typeof this.catalog?.rawManifest === 'function' ? this.catalog.rawManifest() : undefined;
    const appAudio = manifest?.app?.audio;
    const appProtector = manifest?.app?.protector;

    return {
      screensaverMode: appProtector?.mode ?? DEFAULT_SETTINGS.screensaverMode,
      screensaverVideoOrder: appProtector?.videoOrder ?? DEFAULT_SETTINGS.screensaverVideoOrder,
      screensaverIdleMs: appProtector?.idleMs ?? DEFAULT_SETTINGS.screensaverIdleMs,
      videoVolume: appAudio?.videoVolume ?? DEFAULT_SETTINGS.videoVolume,
      soundEnabled: appAudio?.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
      bgmVolume: appAudio?.bgmVolume ?? DEFAULT_SETTINGS.bgmVolume,
      sfxVolume: appAudio?.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume,
      memoryPairs: null,
      triquiDifficulty: null,
      triquiFirstPlayer: null,
      triquiPlayerSymbol: null,
      experienceOverrides: {},
    };
  }

  /** Restablece únicamente los ajustes de audio general a sus valores por defecto. */
  resetAudioToDefault(): void {
    const defaults = this.getManifestDefaultSettings();
    this._patch({
      soundEnabled: defaults.soundEnabled,
      bgmVolume: defaults.bgmVolume,
      sfxVolume: defaults.sfxVolume,
    });
    this.logger.info('KioskSettings', 'Ajustes de audio restaurados a los valores por defecto.');
  }

  /** Restablece únicamente los ajustes del protector de pantalla y video a sus valores por defecto. */
  resetScreensaverToDefault(): void {
    const defaults = this.getManifestDefaultSettings();
    this._patch({
      screensaverMode: defaults.screensaverMode,
      screensaverVideoOrder: defaults.screensaverVideoOrder,
      screensaverIdleMs: defaults.screensaverIdleMs,
      videoVolume: defaults.videoVolume,
    });
    this.logger.info('KioskSettings', 'Ajustes del protector restaurados a los valores por defecto.');
  }

  /** Restablece los ajustes generales (audio y protector) a sus valores por defecto. */
  resetGeneralToDefault(): void {
    const defaults = this.getManifestDefaultSettings();
    this._patch({
      soundEnabled: defaults.soundEnabled,
      bgmVolume: defaults.bgmVolume,
      sfxVolume: defaults.sfxVolume,
      screensaverMode: defaults.screensaverMode,
      screensaverVideoOrder: defaults.screensaverVideoOrder,
      screensaverIdleMs: defaults.screensaverIdleMs,
      videoVolume: defaults.videoVolume,
    });
    this.logger.info('KioskSettings', 'Ajustes generales restaurados a los valores por defecto.');
  }

  /**
   * Elimina los overrides de partida de todas las experiencias asociadas a un motor de juego.
   * Usado al pasar de modo individual a global (se pierde la config por marca).
   */
  clearExperienceOverridesForGame(gameId: string): void {
    const experienceIds = new Set(
      this.catalog
        .rawManifest()
        .experiences.filter((exp) => exp.gameId === gameId)
        .map((exp) => exp.id),
    );
    if (experienceIds.size === 0) return;

    const current = this._data();
    const prev = current.experienceOverrides ?? {};
    const updated: Record<string, ExperienceSettingsOverride> = {};
    for (const [id, override] of Object.entries(prev)) {
      if (!experienceIds.has(id)) {
        updated[id] = override;
      }
    }
    this._patch({ experienceOverrides: updated });
    this.logger.info(
      'KioskSettings',
      `Overrides de experiencias del juego "${gameId}" eliminados (${experienceIds.size}).`,
    );
  }

  /**
   * Restablece todos los ajustes operativos locales a sus valores por defecto definidos en el manifest.
   * Elimina todos los overrides de juegos y experiencias para que vuelvan a seguir el catálogo.
   */
  resetToDefault(): void {
    const defaults = this.getManifestDefaultSettings();
    this._data.set({
      ...defaults,
      experienceOverrides: {},
    });
    try {
      this.platform.storageSet(SETTINGS_STORAGE_KEY, JSON.stringify(this._data()));
    } catch {
      this.logger.warn('KioskSettings', 'No se pudo persistir los ajustes tras restaurar.');
    }
    this.logger.info('KioskSettings', 'Ajustes de kiosco restaurados a los valores por defecto del manifest.');
  }

  // ─── Interno ─────────────────────────────────────────────────────────────────

  private _patch(partial: Partial<KioskSettingsData>): void {
    this._data.update((current) => ({ ...current, ...partial }));
  }

  private _loadSettings(): KioskSettingsData {
    const defaults = this.getManifestDefaultSettings();
    const raw = this.platform.storageGet(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...defaults };

    try {
      const parsed = JSON.parse(raw) as Partial<KioskSettingsData>;

      const screensaverMode: ScreensaverMode =
        parsed.screensaverMode === 'classic' || parsed.screensaverMode === 'video'
          ? parsed.screensaverMode
          : defaults.screensaverMode;

      const soundEnabled: boolean =
        typeof parsed.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : defaults.soundEnabled;

      const bgmVolume: number =
        typeof parsed.bgmVolume === 'number' && !isNaN(parsed.bgmVolume)
          ? Math.max(0, Math.min(1, parsed.bgmVolume))
          : defaults.bgmVolume;

      const sfxVolume: number =
        typeof parsed.sfxVolume === 'number' && !isNaN(parsed.sfxVolume)
          ? Math.max(0, Math.min(1, parsed.sfxVolume))
          : defaults.sfxVolume;

      const memoryPairs: number | null =
        parsed.memoryPairs === null
          ? null
          : typeof parsed.memoryPairs === 'number' &&
            Number.isInteger(parsed.memoryPairs) &&
            parsed.memoryPairs >= 2 &&
            parsed.memoryPairs <= 6
          ? parsed.memoryPairs
          : defaults.memoryPairs;

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

      const screensaverVideoOrder: ScreensaverVideoOrder =
        parsed.screensaverVideoOrder === 'random' || parsed.screensaverVideoOrder === 'sequential'
          ? parsed.screensaverVideoOrder
          : defaults.screensaverVideoOrder;

      const screensaverIdleMs: number =
        typeof parsed.screensaverIdleMs === 'number' &&
        !isNaN(parsed.screensaverIdleMs) &&
        parsed.screensaverIdleMs >= SCREENSAVER_IDLE_MIN_MS &&
        parsed.screensaverIdleMs <= SCREENSAVER_IDLE_MAX_MS
          ? Math.round(parsed.screensaverIdleMs)
          : defaults.screensaverIdleMs;

      const videoVolume: number =
        typeof parsed.videoVolume === 'number' && !isNaN(parsed.videoVolume)
          ? Math.max(0, Math.min(1, parsed.videoVolume))
          : defaults.videoVolume;

      const triquiPlayerSymbol: PlayerSymbolChoice | null =
        parsed.triquiPlayerSymbol === 'X' ||
        parsed.triquiPlayerSymbol === 'O' ||
        parsed.triquiPlayerSymbol === 'random'
          ? parsed.triquiPlayerSymbol
          : null;

      const experienceOverrides: Record<string, ExperienceSettingsOverride> =
        typeof parsed.experienceOverrides === 'object' && parsed.experienceOverrides !== null
          ? parsed.experienceOverrides
          : {};

      return {
        screensaverMode,
        screensaverVideoOrder,
        screensaverIdleMs,
        videoVolume,
        soundEnabled,
        bgmVolume,
        sfxVolume,
        memoryPairs,
        triquiDifficulty,
        triquiFirstPlayer,
        triquiPlayerSymbol,
        experienceOverrides,
      };
    } catch {
      this.logger.warn('KioskSettings', 'Ajustes persistidos corruptos, usando defaults.');
      return { ...defaults };
    }
  }
}
