/**
 * Algoritmos de Inteligencia Artificial para el juego de Triqui.
 *
 * Tres estrategias puras, deterministas con RNG inyectable:
 * - easy: Movimiento aleatorio entre celdas libres.
 * - medium: Gana de inmediato, bloquea dos en línea, prioriza centro > esquinas > lados.
 * - hard: Minimax perfecto sobre el tablero 3×3. Nunca pierde.
 *
 * Este archivo NO contiene Angular, DOM ni efectos secundarios.
 */

import { CellIndex, Difficulty, Mark, WINNING_LINES } from './triqui.model';

export type BoardState = readonly (Mark | null)[];

/** Devuelve los índices de todas las celdas vacías en el tablero. */
export function getAvailableCells(board: BoardState): CellIndex[] {
  const available: CellIndex[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      available.push(i as CellIndex);
    }
  }
  return available;
}

/** Comprueba si una marca ha completado alguna de las 8 líneas ganadoras. */
export function checkWinner(board: BoardState): Mark | null {
  for (const [a, b, c] of WINNING_LINES) {
    const mark = board[a];
    if (mark !== null && mark === board[b] && mark === board[c]) {
      return mark;
    }
  }
  return null;
}

/**
 * Busca si existe una celda que complete 3 en línea para la marca indicada.
 * Devuelve el índice de la celda vacía para completar la línea, o null.
 */
export function findWinningMove(board: BoardState, mark: Mark): CellIndex | null {
  for (const [a, b, c] of WINNING_LINES) {
    const cells = [a, b, c];
    const markCount = cells.filter((idx) => board[idx] === mark).length;
    const nullCount = cells.filter((idx) => board[idx] === null).length;

    if (markCount === 2 && nullCount === 1) {
      const emptyCell = cells.find((idx) => board[idx] === null)!;
      return emptyCell;
    }
  }
  return null;
}

// ─── Estrategia Fácil ─────────────────────────────────────────────────────────

function getEasyMove(available: CellIndex[], rng: () => number): CellIndex {
  const randomIndex = Math.floor(rng() * available.length);
  return available[randomIndex];
}

// ─── Parámetros de Calibración Estrategia Media ─────────────────────────────

/** Probabilidad de que la IA en nivel medio concrete una victoria inmediata (80%). */
export const MEDIUM_WIN_RATE = 0.80;

/**
 * Probabilidad de que la IA en nivel medio bloquee el dos en raya del paciente (65%).
 * El 35% restante comete un despiste humano, permitiendo al jugador completar su victoria.
 */
export const MEDIUM_BLOCK_RATE = 0.65;

/** Probabilidad de que la IA en nivel medio tome el centro si está libre (50%). */
export const MEDIUM_CENTER_RATE = 0.50;

// ─── Estrategia Media ─────────────────────────────────────────────────────────

function getMediumMove(board: BoardState, available: CellIndex[], rng: () => number): CellIndex {
  // 1. ¿Puede ganar la IA ('O') en este turno? (80% de acierto)
  const winMove = findWinningMove(board, 'O');
  if (winMove !== null && rng() < MEDIUM_WIN_RATE) {
    return winMove;
  }

  // 2. ¿Puede ganar el paciente ('X') en el siguiente turno? Bloquear con tasa humana (~55%)
  const blockMove = findWinningMove(board, 'X');
  if (blockMove !== null && rng() < MEDIUM_BLOCK_RATE) {
    return blockMove;
  }

  // 3. Preferencia del centro: 50% de las veces si está libre (permite al paciente tomar el centro)
  if (board[4] === null && rng() < MEDIUM_CENTER_RATE) {
    return 4;
  }

  // 4. Tomar esquinas disponibles
  const corners: CellIndex[] = [0, 2, 6, 8];
  const availableCorners = corners.filter((c) => board[c] === null);
  if (availableCorners.length > 0) {
    const idx = Math.floor(rng() * availableCorners.length);
    return availableCorners[idx];
  }

  // 5. Tomar centro si aún está libre y no habían esquinas
  if (board[4] === null) {
    return 4;
  }

  // 6. Tomar lados disponibles
  const sides: CellIndex[] = [1, 3, 5, 7];
  const availableSides = sides.filter((s) => board[s] === null);
  if (availableSides.length > 0) {
    const idx = Math.floor(rng() * availableSides.length);
    return availableSides[idx];
  }

  // Fallback a cualquier celda libre
  return getEasyMove(available, rng);
}

// ─── Estrategia Difícil (Minimax) ─────────────────────────────────────────────

function minimax(
  board: (Mark | null)[],
  depth: number,
  isMaximizing: boolean,
  alpha: number,
  beta: number,
): number {
  const winner = checkWinner(board);
  if (winner === 'O') return 10 - depth;
  if (winner === 'X') return depth - 10;

  const available = getAvailableCells(board);
  if (available.length === 0) return 0; // Empate

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const cell of available) {
      board[cell] = 'O';
      const evaluation = minimax(board, depth + 1, false, alpha, beta);
      board[cell] = null;
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const cell of available) {
      board[cell] = 'X';
      const evaluation = minimax(board, depth + 1, true, alpha, beta);
      board[cell] = null;
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getHardMove(board: BoardState, available: CellIndex[], rng: () => number): CellIndex {
  // Optimización de apertura: si el tablero está vacío (la IA empieza), jugar el centro
  if (available.length === 9) {
    return 4;
  }

  const mutableBoard = [...board];
  let bestScore = -Infinity;
  let bestMoves: CellIndex[] = [];

  for (const cell of available) {
    mutableBoard[cell] = 'O';
    const score = minimax(mutableBoard, 0, false, -Infinity, Infinity);
    mutableBoard[cell] = null;

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [cell];
    } else if (score === bestScore) {
      bestMoves.push(cell);
    }
  }

  // Si hay varias jugadas con puntuación óptima, elegir con RNG para variedad
  const chosenIndex = Math.floor(rng() * bestMoves.length);
  return bestMoves[chosenIndex];
}

// ─── Selector Principal ───────────────────────────────────────────────────────

/**
 * Calcula la siguiente jugada de la IA según el nivel de dificultad seleccionado.
 *
 * @param board Estado actual del tablero (9 celdas).
 * @param difficulty 'easy' | 'medium' | 'hard'.
 * @param rng Función generadora de números aleatorios inyectable (default: Math.random).
 * @returns El índice de la celda elegida (0 a 8).
 */
export function calculateAiMove(
  board: BoardState,
  difficulty: Difficulty,
  rng: () => number = Math.random,
): CellIndex {
  const available = getAvailableCells(board);
  if (available.length === 0) {
    throw new Error('TriquiAi: no hay celdas disponibles en el tablero.');
  }

  switch (difficulty) {
    case 'easy':
      return getEasyMove(available, rng);
    case 'medium':
      return getMediumMove(board, available, rng);
    case 'hard':
      return getHardMove(board, available, rng);
  }
}
