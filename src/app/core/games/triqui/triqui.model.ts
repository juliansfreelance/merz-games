/**
 * Modelos del motor de Triqui (Tres en Raya).
 *
 * Este archivo NO importa Angular, Router, catálogo ni @tauri-apps/api.
 * Es TypeScript puro y puede ejecutarse en Node sin DOM.
 */

/** Índices válidos para el tablero 3×3 (0 a 8). */
export type CellIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Marcas de juego: el paciente es siempre 'X' y la IA es siempre 'O'. */
export type Mark = 'X' | 'O';

/** Niveles de dificultad para la inteligencia artificial. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Modo de inicio de turno en la ronda. */
export type FirstPlayer = 'patient' | 'alternate' | 'random';

/** Índices de las tres celdas que forman una línea ganadora. */
export type TriquiWinningLine = readonly [CellIndex, CellIndex, CellIndex];

/**
 * Las 8 combinaciones ganadoras fijas del tablero 3×3:
 * - 3 horizontales
 * - 3 verticales
 * - 2 diagonales
 */
export const WINNING_LINES: readonly TriquiWinningLine[] = [
  // Filas
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // Columnas
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // Diagonales
  [0, 4, 8],
  [2, 4, 6],
];

/** Eventos emitidos por el motor de Triqui. */
export type TriquiEvent =
  | { readonly type: 'place'; readonly cell: CellIndex; readonly mark: Mark }
  | { readonly type: 'win';   readonly line: TriquiWinningLine }
  | { readonly type: 'lose';  readonly line: TriquiWinningLine }
  | { readonly type: 'draw' };

/** Opciones de inicialización del motor. */
export interface TriquiEngineOptions {
  /** Nivel de dificultad para la IA. */
  readonly difficulty: Difficulty;
  /** Estrategia para determinar qué jugador mueve primero en la ronda. */
  readonly firstPlayer: FirstPlayer;
  /**
   * Número de rondas jugadas en la sesión activa (usado por 'alternate').
   * Rondas pares (0, 2, 4…) inicia el paciente; impares (1, 3, 5…) la IA.
   */
  readonly sessionRound: number;
  /**
   * Generador de números aleatorios [0, 1).
   * Default: Math.random. Inyectable para tests deterministas.
   */
  readonly rng?: () => number;
}
