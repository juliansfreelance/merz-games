/**
 * TriquiEngine — Motor puro del juego de Triqui (Tres en Raya).
 *
 * Restricciones de diseño:
 * - Sin imports de Angular, Router, catálogo ni @tauri-apps/api.
 * - Sin efectos secundarios: síncrono, emite eventos y la UI reacciona.
 * - Paciente siempre es 'X', la IA siempre es 'O'.
 * - Determinista con RNG inyectable.
 * - No gestiona timers ni delays (el retardo de la IA pertenece a la presentación).
 */

import {
  CellIndex,
  Difficulty,
  FirstPlayer,
  Mark,
  TriquiEngineOptions,
  TriquiEvent,
  TriquiWinningLine,
  WINNING_LINES,
} from './triqui.model';
import { calculateAiMove } from './triqui-ai';

export class TriquiEngine {
  private readonly _board: (Mark | null)[] = Array(9).fill(null);
  private _currentMark: Mark;
  private _isOver = false;
  private _winner: Mark | null = null;
  private _winningLine: TriquiWinningLine | null = null;
  private _isDraw = false;

  private readonly _difficulty: Difficulty;
  private readonly _playerMark: Mark;
  private readonly _aiMark: Mark;
  private readonly _rng: () => number;

  constructor(options: TriquiEngineOptions) {
    const { difficulty, firstPlayer, playerSymbol = 'X', sessionRound, rng = Math.random } = options;
    const resolvedMark: Mark =
      playerSymbol === 'random' ? (rng() < 0.5 ? 'X' : 'O') : playerSymbol;
    this._difficulty = difficulty;
    this._playerMark = resolvedMark;
    this._aiMark = resolvedMark === 'X' ? 'O' : 'X';
    this._rng = rng;

    // Determinar qué jugador mueve primero
    this._currentMark = this._resolveFirstPlayer(firstPlayer, sessionRound, rng);
  }

  // ─── Getters de Estado Público ────────────────────────────────────────────────

  /** Estado actual de las 9 celdas del tablero. */
  get board(): readonly (Mark | null)[] {
    return this._board;
  }

  /** Marca a la que le corresponde mover en este momento. */
  get currentMark(): Mark {
    return this._currentMark;
  }

  /** Ficha elegida por el jugador humano. */
  get playerMark(): Mark {
    return this._playerMark;
  }

  /** Ficha asignada a la inteligencia artificial. */
  get aiMark(): Mark {
    return this._aiMark;
  }

  /** true si la ronda ya finalizó (por victoria, derrota o empate). */
  get isOver(): boolean {
    return this._isOver;
  }

  /** Marca ganadora ('X' o 'O'), o null si no hay ganador. */
  get winner(): Mark | null {
    return this._winner;
  }

  /** Índices de las 3 celdas que formaron la línea ganadora, o null. */
  get winningLine(): TriquiWinningLine | null {
    return this._winningLine;
  }

  /** true si la ronda terminó en empate sin ganador. */
  get isDraw(): boolean {
    return this._isDraw;
  }

  /** Dificultad configurada para esta partida. */
  get difficulty(): Difficulty {
    return this._difficulty;
  }

  // ─── Acciones de Juego ────────────────────────────────────────────────────────

  /**
   * Coloca la ficha del jugador en la celda indicada.
   *
   * @param cell Índice de la celda [0..8].
   * @returns Array de eventos ocurridos, o `[]` si el toque es inválido:
   *   - Celda ocupada.
   *   - No es el turno del jugador.
   *   - La ronda ya finalizó.
   */
  place(cell: CellIndex): readonly TriquiEvent[] {
    if (this._isOver) return [];
    if (this._currentMark !== this._playerMark) return [];
    if (this._board[cell] !== null) return [];

    const events: TriquiEvent[] = [];

    this._board[cell] = this._playerMark;
    events.push({ type: 'place', cell, mark: this._playerMark });

    // 1. ¿Victoria del jugador?
    const winLine = this._findWinningLine(this._playerMark);
    if (winLine !== null) {
      this._isOver = true;
      this._winner = this._playerMark;
      this._winningLine = winLine;
      events.push({ type: 'win', line: winLine });
      return events;
    }

    // 2. ¿Empate (tablero lleno)?
    if (this._isBoardFull()) {
      this._isOver = true;
      this._isDraw = true;
      events.push({ type: 'draw' });
      return events;
    }

    // 3. Pasar el turno a la IA
    this._currentMark = this._aiMark;
    return events;
  }

  /**
   * Ejecuta el movimiento de la IA.
   * La capa de presentación es responsable de esperar el retardo humano antes de llamar este método.
   *
   * @returns Array de eventos ocurridos, o `[]` si la ronda terminó o no es turno de la IA.
   */
  aiPlace(): readonly TriquiEvent[] {
    if (this._isOver) return [];
    if (this._currentMark !== this._aiMark) return [];

    const cell = calculateAiMove(this._board, this._difficulty, this._rng, this._aiMark);
    const events: TriquiEvent[] = [];

    this._board[cell] = this._aiMark;
    events.push({ type: 'place', cell, mark: this._aiMark });

    // 1. ¿Victoria de la IA?
    const winLine = this._findWinningLine(this._aiMark);
    if (winLine !== null) {
      this._isOver = true;
      this._winner = this._aiMark;
      this._winningLine = winLine;
      events.push({ type: 'lose', line: winLine });
      return events;
    }

    // 2. ¿Empate?
    if (this._isBoardFull()) {
      this._isOver = true;
      this._isDraw = true;
      events.push({ type: 'draw' });
      return events;
    }

    // 3. Devolver turno al jugador
    this._currentMark = this._playerMark;
    return events;
  }

  // ─── Métodos Internos ─────────────────────────────────────────────────────────

  private _resolveFirstPlayer(
    firstPlayer: FirstPlayer,
    sessionRound: number,
    rng: () => number,
  ): Mark {
    switch (firstPlayer) {
      case 'patient':
        return this._playerMark;
      case 'alternate':
        // Rondas pares (0, 2, 4...) empieza el jugador; impares (1, 3, 5...) la IA.
        return sessionRound % 2 === 0 ? this._playerMark : this._aiMark;
      case 'random':
        return rng() < 0.5 ? this._playerMark : this._aiMark;
    }
  }

  private _findWinningLine(mark: Mark): TriquiWinningLine | null {
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (
        this._board[a] === mark &&
        this._board[b] === mark &&
        this._board[c] === mark
      ) {
        return line;
      }
    }
    return null;
  }

  private _isBoardFull(): boolean {
    return this._board.every((cell) => cell !== null);
  }
}
