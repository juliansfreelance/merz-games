/**
 * Configuración del motor de Triqui:
 * - Constantes de diseño.
 * - Validación de dificultad y turno inicial.
 * - Cascada de resolución (kiosco → experiencia → motor → default).
 *
 * Este archivo es TypeScript puro, sin imports de Angular ni del catálogo.
 */

import { ExperienceConfig } from '../../catalog/game-experience.model';
import { Difficulty, FirstPlayer, Mark, PlayerSymbolChoice } from './triqui.model';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Dificultad por defecto si ningún nivel de la cascada lo especifica. */
export const TRIQUI_DIFFICULTY_DEFAULT: Difficulty = 'medium';

/** Estrategia de primer jugador por defecto. */
export const TRIQUI_FIRST_PLAYER_DEFAULT: FirstPlayer = 'patient';

/** Ficha / Figura por defecto del jugador humano ('X', 'O' o 'random'). */
export const TRIQUI_PLAYER_SYMBOL_DEFAULT: PlayerSymbolChoice = 'random';

export const VALID_DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const VALID_FIRST_PLAYERS: readonly FirstPlayer[] = ['patient', 'alternate', 'random'];

export const VALID_PLAYER_SYMBOLS: readonly PlayerSymbolChoice[] = ['X', 'O', 'random'];

// ─── Tipos de Resolución ──────────────────────────────────────────────────────

export type TriquiConfigSource = 'kiosk' | 'experience' | 'game' | 'default';

export interface ResolvedDifficulty {
  readonly difficulty: Difficulty;
  readonly source: TriquiConfigSource;
}

export interface ResolvedFirstPlayer {
  readonly firstPlayer: FirstPlayer;
  readonly source: TriquiConfigSource;
}

export interface ResolvedPlayerSymbol {
  readonly playerSymbol: PlayerSymbolChoice;
  readonly source: TriquiConfigSource;
}

// ─── Validación ───────────────────────────────────────────────────────────────

/**
 * Valida un valor candidato para dificultad de la IA.
 * Si el valor no es 'easy', 'medium' o 'hard', emite warning y devuelve null.
 */
export function validateDifficulty(value: unknown): Difficulty | null {
  if (typeof value !== 'string') {
    console.warn(
      `TriquiConfig: valor de dificultad inválido (tipo "${typeof value}"): ${String(value)}. Se ignora.`,
    );
    return null;
  }
  if (!VALID_DIFFICULTIES.includes(value as Difficulty)) {
    console.warn(
      `TriquiConfig: valor de dificultad desconocido "${value}". Se descarta y continúa la cascada.`,
    );
    return null;
  }
  return value as Difficulty;
}

/**
 * Valida un valor candidato para el primer jugador.
 * Si el valor no es 'patient', 'alternate' o 'random', emite warning y devuelve null.
 */
export function validateFirstPlayer(value: unknown): FirstPlayer | null {
  if (typeof value !== 'string') {
    console.warn(
      `TriquiConfig: valor de primer jugador inválido (tipo "${typeof value}"): ${String(value)}. Se ignora.`,
    );
    return null;
  }
  if (!VALID_FIRST_PLAYERS.includes(value as FirstPlayer)) {
    console.warn(
      `TriquiConfig: valor de primer jugador desconocido "${value}". Se descarta y continúa la cascada.`,
    );
    return null;
  }
  return value as FirstPlayer;
}

/**
 * Valida un valor candidato para la ficha/figura del jugador ('X', 'O' o 'random').
 * Si el valor no es válido, emite warning y devuelve null.
 */
export function validatePlayerSymbol(value: unknown): PlayerSymbolChoice | null {
  if (typeof value !== 'string') {
    console.warn(
      `TriquiConfig: valor de figura inválido (tipo "${typeof value}"): ${String(value)}. Se ignora.`,
    );
    return null;
  }
  if (!VALID_PLAYER_SYMBOLS.includes(value as PlayerSymbolChoice)) {
    console.warn(
      `TriquiConfig: valor de figura desconocido "${value}". Se descarta y continúa la cascada.`,
    );
    return null;
  }
  return value as PlayerSymbolChoice;
}

// ─── Cascadas de Resolución ───────────────────────────────────────────────────

/**
 * Resuelve la dificultad de Triqui según la cascada de precedencia:
 * 1. KioskSettings.triquiDifficulty (override de equipo en panel)
 * 2. experience.config.difficulty (ajuste por marca)
 * 3. game.config.difficulty (configuración maestra del motor)
 * 4. TRIQUI_DIFFICULTY_DEFAULT ('medium')
 */
export function resolveTriquiDifficulty(sources: {
  readonly kioskOverride: Difficulty | null;
  readonly experienceConfig?: ExperienceConfig;
  readonly gameConfig?: ExperienceConfig;
}): ResolvedDifficulty {
  const { kioskOverride, experienceConfig, gameConfig } = sources;

  if (kioskOverride !== null) {
    const valid = validateDifficulty(kioskOverride);
    if (valid !== null) return { difficulty: valid, source: 'kiosk' };
  }

  if (experienceConfig !== undefined && 'difficulty' in experienceConfig) {
    const valid = validateDifficulty(experienceConfig['difficulty']);
    if (valid !== null) return { difficulty: valid, source: 'experience' };
  }

  if (gameConfig !== undefined && 'difficulty' in gameConfig) {
    const valid = validateDifficulty(gameConfig['difficulty']);
    if (valid !== null) return { difficulty: valid, source: 'game' };
  }

  return { difficulty: TRIQUI_DIFFICULTY_DEFAULT, source: 'default' };
}

/**
 * Resuelve quién empieza la ronda de Triqui según la cascada:
 * 1. KioskSettings.triquiFirstPlayer (override de equipo en panel)
 * 2. experience.config.firstPlayer (ajuste por marca)
 * 3. game.config.firstPlayer (configuración maestra del motor)
 * 4. TRIQUI_FIRST_PLAYER_DEFAULT ('patient')
 */
export function resolveTriquiFirstPlayer(sources: {
  readonly kioskOverride: FirstPlayer | null;
  readonly experienceConfig?: ExperienceConfig;
  readonly gameConfig?: ExperienceConfig;
}): ResolvedFirstPlayer {
  const { kioskOverride, experienceConfig, gameConfig } = sources;

  if (kioskOverride !== null) {
    const valid = validateFirstPlayer(kioskOverride);
    if (valid !== null) return { firstPlayer: valid, source: 'kiosk' };
  }

  if (experienceConfig !== undefined && 'firstPlayer' in experienceConfig) {
    const valid = validateFirstPlayer(experienceConfig['firstPlayer']);
    if (valid !== null) return { firstPlayer: valid, source: 'experience' };
  }

  if (gameConfig !== undefined && 'firstPlayer' in gameConfig) {
    const valid = validateFirstPlayer(gameConfig['firstPlayer']);
    if (valid !== null) return { firstPlayer: valid, source: 'game' };
  }

  return { firstPlayer: TRIQUI_FIRST_PLAYER_DEFAULT, source: 'default' };
}

/**
 * Resuelve la figura / símbolo del jugador en Triqui ('X', 'O' o 'random') según la cascada:
 * 1. KioskSettings.triquiPlayerSymbol (override de equipo en panel)
 * 2. experience.config.playerSymbol (ajuste por marca)
 * 3. game.config.playerSymbol (configuración maestra del motor)
 * 4. TRIQUI_PLAYER_SYMBOL_DEFAULT ('random')
 */
export function resolveTriquiPlayerSymbol(sources: {
  readonly kioskOverride: PlayerSymbolChoice | null;
  readonly experienceConfig?: ExperienceConfig;
  readonly gameConfig?: ExperienceConfig;
}): ResolvedPlayerSymbol {
  const { kioskOverride, experienceConfig, gameConfig } = sources;

  if (kioskOverride !== null) {
    const valid = validatePlayerSymbol(kioskOverride);
    if (valid !== null) return { playerSymbol: valid, source: 'kiosk' };
  }

  if (experienceConfig !== undefined && 'playerSymbol' in experienceConfig) {
    const valid = validatePlayerSymbol(experienceConfig['playerSymbol']);
    if (valid !== null) return { playerSymbol: valid, source: 'experience' };
  }

  if (gameConfig !== undefined && 'playerSymbol' in gameConfig) {
    const valid = validatePlayerSymbol(gameConfig['playerSymbol']);
    if (valid !== null) return { playerSymbol: valid, source: 'game' };
  }

  return { playerSymbol: TRIQUI_PLAYER_SYMBOL_DEFAULT, source: 'default' };
}
