/**
 * Configuración del motor de Memoria:
 * - Constantes de diseño.
 * - Validación de pares.
 * - Cascada de resolución de pares (kiosco → experiencia → motor → default).
 * - Tabla de columnas de rejilla.
 *
 * Este archivo es TypeScript puro, sin imports de Angular ni del catálogo.
 * La Fase 6 (Triqui) seguirá exactamente este mismo patrón.
 */

import { ExperienceConfig } from '../../catalog/game-experience.model';
import { MemoryConfig, MemoryDifficulty } from './memory.model';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Número de parejas por defecto si ningún nivel de la cascada lo especifica. */
export const MEMORY_PAIRS_DEFAULT = 4;

/** Número mínimo de parejas permitido. */
export const MEMORY_PAIRS_MIN = 2;

/** Número máximo de parejas permitido. */
export const MEMORY_PAIRS_MAX = 6;

/** Mínimo de vidas permitido para cualquier partida de Memoria. */
export const MEMORY_LIVES_MIN = 3;

/** Nivel de dificultad por defecto. */
export const MEMORY_DIFFICULTY_DEFAULT: MemoryDifficulty = 'medium';

// ─── Tabla de rejilla ─────────────────────────────────────────────────────────

/**
 * Tabla explícita de columnas de rejilla por total de cartas.
 * Optimizada para el formato vertical (kiosco 9:16 / 1080×1920 portrait)
 * donde el espacio vertical es abundante y el horizontal es más estrecho:
 *
 *   4 cartas (2 parejas) → 2 cols × 2 filas
 *   6 cartas (3 parejas) → 2 cols × 3 filas
 *   8 cartas (4 parejas) → 2 cols × 4 filas (aprovecha vertical en vez de apretar 4 cols)
 *  10 cartas (5 parejas) → 2 cols × 5 filas (o 3x4)
 *  12 cartas (6 parejas) → 3 cols × 4 filas
 */
export const GRID_COLUMNS_BY_TOTAL = new Map<number, number>([
  [4,  2],
  [6,  2],
  [8,  2],
  [10, 2],
  [12, 3],
]);

/**
 * Alternativa para pantallas horizontales (landscape) si se requiere diferenciación.
 */
export const GRID_COLUMNS_LANDSCAPE_BY_TOTAL = new Map<number, number>([
  [4,  2],
  [6,  3],
  [8,  4],
  [10, 5],
  [12, 4],
]);

/**
 * Devuelve el número de columnas de la rejilla para el total de cartas dado.
 * Por defecto usa la disposición vertical idónea para quioscos (p. ej. 8 cartas → 2 columnas × 4 filas).
 *
 * @param totalCards Número total de cartas (pairs * 2).
 * @param isLandscape Opcional: si la orientación actual es horizontal.
 */
export function getGridColumns(totalCards: number, isLandscape = false): number {
  const table = isLandscape ? GRID_COLUMNS_LANDSCAPE_BY_TOTAL : GRID_COLUMNS_BY_TOTAL;
  const fromTable = table.get(totalCards);
  if (fromTable !== undefined) return fromTable;

  // Fallback: mínimo 2 columnas
  return isLandscape
    ? Math.max(2, Math.ceil(Math.sqrt(totalCards)))
    : Math.max(2, Math.floor(Math.sqrt(totalCards)));
}

// ─── Heurística de Dificultad y Vidas ──────────────────────────────────────────

/**
 * Calcula la cantidad de vidas recomendadas según la cantidad de parejas y la dificultad.
 *
 * Fórmulas:
 * - Difícil: Math.max(3, Math.ceil(pairs * 0.75))
 * - Medio:   Math.max(3, pairs)
 * - Fácil:   Math.max(3, Math.ceil(pairs * 1.5))
 *
 * Tabla de referencia:
 * | Parejas | Difícil | Medio | Fácil |
 * |--------:|--------:|------:|------:|
 * |       2 |       3 |     3 |     3 |
 * |       3 |       3 |     3 |     5 |
 * |       4 |       3 |     4 |     6 |
 * |       5 |       4 |     5 |     8 |
 * |       6 |       5 |     6 |     9 |
 */
export function getRecommendedLives(pairs: number, difficulty: MemoryDifficulty): number {
  const safePairs = Math.max(MEMORY_PAIRS_MIN, Math.min(MEMORY_PAIRS_MAX, pairs));
  switch (difficulty) {
    case 'easy':
      return Math.max(MEMORY_LIVES_MIN, Math.ceil(safePairs * 1.5));
    case 'hard':
      return Math.max(MEMORY_LIVES_MIN, Math.ceil(safePairs * 0.75));
    case 'medium':
    case 'custom':
    default:
      return Math.max(MEMORY_LIVES_MIN, safePairs);
  }
}

// ─── Validación ───────────────────────────────────────────────────────────────

/**
 * Valida un valor candidato para el número de parejas.
 *
 * Acepta únicamente enteros dentro de [MEMORY_PAIRS_MIN, MEMORY_PAIRS_MAX].
 * Un valor no entero, fuera de rango, negativo, NaN o de tipo incorrecto se
 * descarta emitiendo un warning en consola.
 *
 * @returns El valor si es válido, `null` si debe descartarse.
 */
export function validatePairs(value: unknown): number | null {
  if (typeof value !== 'number') {
    console.warn(
      `MemoryConfig: valor de parejas inválido (tipo "${typeof value}"): ${String(value)}. Se ignora.`,
    );
    return null;
  }
  if (!Number.isInteger(value) || isNaN(value)) {
    console.warn(
      `MemoryConfig: valor de parejas no es entero: ${value}. Se ignora.`,
    );
    return null;
  }
  if (value < MEMORY_PAIRS_MIN || value > MEMORY_PAIRS_MAX) {
    console.warn(
      `MemoryConfig: valor de parejas ${value} fuera de rango [${MEMORY_PAIRS_MIN}, ${MEMORY_PAIRS_MAX}]. Se ignora.`,
    );
    return null;
  }
  return value;
}

/**
 * Valida un valor candidato para el número de vidas.
 * Debe ser un número entero >= MEMORY_LIVES_MIN (3).
 */
export function validateLives(value: unknown): number | null {
  if (typeof value !== 'number') {
    console.warn(`MemoryConfig: valor de vidas inválido (tipo "${typeof value}"): ${String(value)}. Se ignora.`);
    return null;
  }
  if (!Number.isInteger(value) || isNaN(value)) {
    console.warn(`MemoryConfig: valor de vidas no es entero: ${value}. Se ignora.`);
    return null;
  }
  if (value < MEMORY_LIVES_MIN) {
    console.warn(`MemoryConfig: valor de vidas ${value} menor que el mínimo permitido (${MEMORY_LIVES_MIN}). Se ignora.`);
    return null;
  }
  return value;
}

/**
 * Valida un valor candidato para la dificultad de Memoria.
 */
export function validateDifficulty(value: unknown): MemoryDifficulty | null {
  if (value === 'easy' || value === 'medium' || value === 'hard' || value === 'custom') {
    return value;
  }
  console.warn(`MemoryConfig: dificultad desconocida: "${String(value)}". Se ignora.`);
  return null;
}

// ─── Cascada de resolución ────────────────────────────────────────────────────

/** Origen del valor resuelto, para logging y debugging. */
export type MemoryConfigSource = 'kiosk' | 'experience' | 'game' | 'default';

/** Resultado completo de la resolución de configuración de Memoria. */
export interface ResolvedMemoryConfig extends MemoryConfig {
  readonly source: MemoryConfigSource;
}

/**
 * Resuelve la configuración completa de Memoria (parejas, vidas, dificultad)
 * según la cascada de precedencia:
 *
 * 1. KioskSettings override (ajuste explícito de panel/administrador)
 * 2. experience.config (por marca)
 * 3. game.config (configuración maestra del motor)
 * 4. Defaults internos (4 parejas, 4 vidas, medio)
 */
export function resolveMemoryConfig(sources: {
  readonly kioskOverride?: Partial<MemoryConfig> | null;
  readonly experienceConfig?: ExperienceConfig;
  readonly gameConfig?: ExperienceConfig;
}): ResolvedMemoryConfig {
  const { kioskOverride, experienceConfig, gameConfig } = sources;

  let source: MemoryConfigSource = 'default';

  // 1. Parejas
  let rawPairs: number | null = null;
  if (kioskOverride?.pairs !== undefined && kioskOverride?.pairs !== null) {
    const v = validatePairs(kioskOverride.pairs);
    if (v !== null) {
      rawPairs = v;
      source = 'kiosk';
    }
  }
  if (rawPairs === null && experienceConfig !== undefined && 'pairs' in experienceConfig) {
    const v = validatePairs(experienceConfig['pairs']);
    if (v !== null) {
      rawPairs = v;
      if (source === 'default') source = 'experience';
    }
  }
  if (rawPairs === null && gameConfig !== undefined && 'pairs' in gameConfig) {
    const v = validatePairs(gameConfig['pairs']);
    if (v !== null) {
      rawPairs = v;
      if (source === 'default') source = 'game';
    }
  }
  const pairs = rawPairs ?? MEMORY_PAIRS_DEFAULT;

  // 2. Dificultad
  let rawDiff: MemoryDifficulty | null = null;
  if (kioskOverride?.difficulty !== undefined && kioskOverride?.difficulty !== null) {
    const d = validateDifficulty(kioskOverride.difficulty);
    if (d !== null) rawDiff = d;
  }
  if (rawDiff === null && experienceConfig !== undefined && 'difficulty' in experienceConfig) {
    const d = validateDifficulty(experienceConfig['difficulty']);
    if (d !== null) rawDiff = d;
  }
  if (rawDiff === null && gameConfig !== undefined && 'difficulty' in gameConfig) {
    const d = validateDifficulty(gameConfig['difficulty']);
    if (d !== null) rawDiff = d;
  }
  const difficulty = rawDiff ?? MEMORY_DIFFICULTY_DEFAULT;

  // 3. Vidas
  let rawLives: number | null = null;
  if (kioskOverride?.lives !== undefined && kioskOverride?.lives !== null) {
    const l = validateLives(kioskOverride.lives);
    if (l !== null) rawLives = l;
  }
  if (rawLives === null && experienceConfig !== undefined && 'lives' in experienceConfig) {
    const l = validateLives(experienceConfig['lives']);
    if (l !== null) rawLives = l;
  }
  if (rawLives === null && gameConfig !== undefined && 'lives' in gameConfig) {
    const l = validateLives(gameConfig['lives']);
    if (l !== null) rawLives = l;
  }
  const lives = rawLives ?? getRecommendedLives(pairs, difficulty);

  return {
    pairs: Math.max(MEMORY_PAIRS_MIN, Math.min(MEMORY_PAIRS_MAX, pairs)),
    lives: Math.max(MEMORY_LIVES_MIN, lives),
    difficulty,
    source,
  };
}

/** Origen del valor de pares resuelto (retrocompatibilidad). */
export type PairsSource = MemoryConfigSource;

/** Resultado de la cascada de pares (retrocompatibilidad). */
export interface ResolvedPairs {
  readonly pairs: number;
  readonly source: PairsSource;
}

/**
 * Resuelve el número de parejas según la cascada de precedencia (retrocompatibilidad).
 */
export function resolveMemoryPairs(sources: {
  readonly kioskOverride: number | null;
  readonly experienceConfig?: ExperienceConfig;
  readonly gameConfig?: ExperienceConfig;
}): ResolvedPairs {
  const resolved = resolveMemoryConfig({
    kioskOverride: sources.kioskOverride !== null ? { pairs: sources.kioskOverride } : null,
    experienceConfig: sources.experienceConfig,
    gameConfig: sources.gameConfig,
  });
  return { pairs: resolved.pairs, source: resolved.source };
}
