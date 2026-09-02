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

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Número de parejas por defecto si ningún nivel de la cascada lo especifica. */
export const MEMORY_PAIRS_DEFAULT = 4;

/** Número mínimo de parejas permitido. */
export const MEMORY_PAIRS_MIN = 2;

/** Número máximo de parejas permitido. */
export const MEMORY_PAIRS_MAX = 6;

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

// ─── Validación ───────────────────────────────────────────────────────────────

/**
 * Valida un valor candidato para el número de parejas.
 *
 * Acepta únicamente enteros dentro de [MEMORY_PAIRS_MIN, MEMORY_PAIRS_MAX].
 * Un valor no entero, fuera de rango, negativo, NaN o de tipo incorrecto se
 * descarta emitiendo un warning en consola. NUNCA se aplica un clamp silencioso
 * ni se lanza una excepción: el manifest es contenido editable y un JSON mal
 * editado no puede tumbar el kiosco.
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

// ─── Cascada de resolución ────────────────────────────────────────────────────

/** Origen del valor de pares resuelto, para logging y debugging. */
export type PairsSource = 'kiosk' | 'experience' | 'game' | 'default';

/** Resultado de la cascada: pares efectivos y de dónde salió. */
export interface ResolvedPairs {
  readonly pairs: number;
  readonly source: PairsSource;
}

/**
 * Resuelve el número de parejas según la cascada de precedencia:
 *
 * ```
 * 1. KioskSettings.memoryPairs     → override del equipo (null = sin override)
 * 2. experience.config.pairs       → ajuste fino por marca
 * 3. game.config.pairs             → CONFIGURACIÓN MAESTRA del motor
 * 4. MEMORY_PAIRS_DEFAULT = 4      → constante de código
 * ```
 *
 * NOTA DE DISEÑO: el nivel 1 (kiosco) gana incluso al ajuste por marca porque
 * representa la intención explícita de un administrador del equipo. Si un
 * administrador fija el valor en el panel, esa configuración pisa todo lo demás.
 * Con `null` la resolución arranca en el nivel 2 y el comportamiento es el habitual.
 *
 * Cada nivel pasa por `validatePairs()`; si falla, cae al siguiente sin romper.
 * Un valor inválido no detiene la cascada: se registra el warning y se continúa.
 *
 * @param sources.kioskOverride       KioskSettings.memoryPairs (null = no override)
 * @param sources.experienceConfig    experience.config de la experiencia activa
 * @param sources.gameConfig          games[].config del motor activo
 */
export function resolveMemoryPairs(sources: {
  readonly kioskOverride: number | null;
  readonly experienceConfig?: ExperienceConfig;
  readonly gameConfig?: ExperienceConfig;
}): ResolvedPairs {
  const { kioskOverride, experienceConfig, gameConfig } = sources;

  // Nivel 1: override del equipo (kiosco)
  if (kioskOverride !== null) {
    const v = validatePairs(kioskOverride);
    if (v !== null) return { pairs: v, source: 'kiosk' };
  }

  // Nivel 2: ajuste de la experiencia (por marca)
  if (experienceConfig !== undefined && 'pairs' in experienceConfig) {
    const v = validatePairs(experienceConfig['pairs']);
    if (v !== null) return { pairs: v, source: 'experience' };
  }

  // Nivel 3: configuración maestra del motor
  if (gameConfig !== undefined && 'pairs' in gameConfig) {
    const v = validatePairs(gameConfig['pairs']);
    if (v !== null) return { pairs: v, source: 'game' };
  }

  // Nivel 4: constante de código
  return { pairs: MEMORY_PAIRS_DEFAULT, source: 'default' };
}
