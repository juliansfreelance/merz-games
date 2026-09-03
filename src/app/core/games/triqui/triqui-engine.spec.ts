import { describe, it, expect } from 'vitest';
import { TriquiEngine } from './triqui-engine';
import { CellIndex, WINNING_LINES } from './triqui.model';

describe('TriquiEngine', () => {
  it('inicializa con tablero vacío y paciente como X por defecto', () => {
    const engine = new TriquiEngine({
      difficulty: 'medium',
      firstPlayer: 'patient',
      sessionRound: 0,
    });

    expect(engine.board).toEqual(Array(9).fill(null));
    expect(engine.currentMark).toBe('X');
    expect(engine.isOver).toBe(false);
    expect(engine.winner).toBeNull();
    expect(engine.winningLine).toBeNull();
    expect(engine.isDraw).toBe(false);
  });

  describe('Turno inicial (firstPlayer)', () => {
    it('firstPlayer = "patient" siempre arranca con X', () => {
      const engine = new TriquiEngine({
        difficulty: 'medium',
        firstPlayer: 'patient',
        sessionRound: 1,
      });
      expect(engine.currentMark).toBe('X');
    });

    it('firstPlayer = "alternate" alterna según sessionRound', () => {
      const r0 = new TriquiEngine({
        difficulty: 'medium',
        firstPlayer: 'alternate',
        sessionRound: 0,
      });
      expect(r0.currentMark).toBe('X');

      const r1 = new TriquiEngine({
        difficulty: 'medium',
        firstPlayer: 'alternate',
        sessionRound: 1,
      });
      expect(r1.currentMark).toBe('O');

      const r2 = new TriquiEngine({
        difficulty: 'medium',
        firstPlayer: 'alternate',
        sessionRound: 2,
      });
      expect(r2.currentMark).toBe('X');
    });

    it('firstPlayer = "random" decide con el RNG inyectado', () => {
      const e1 = new TriquiEngine({
        difficulty: 'medium',
        firstPlayer: 'random',
        sessionRound: 0,
        rng: () => 0.2, // < 0.5 -> X
      });
      expect(e1.currentMark).toBe('X');

      const e2 = new TriquiEngine({
        difficulty: 'medium',
        firstPlayer: 'random',
        sessionRound: 0,
        rng: () => 0.8, // >= 0.5 -> O
      });
      expect(e2.currentMark).toBe('O');
    });
  });

  describe('Acciones y validación de place()', () => {
    it('place() coloca X y emite evento place si es legal', () => {
      const engine = new TriquiEngine({
        difficulty: 'easy',
        firstPlayer: 'patient',
        sessionRound: 0,
      });

      const events = engine.place(4);
      expect(events).toEqual([{ type: 'place', cell: 4, mark: 'X' }]);
      expect(engine.board[4]).toBe('X');
      expect(engine.currentMark).toBe('O');
    });

    it('place() en celda ocupada devuelve array vacío []', () => {
      const engine = new TriquiEngine({
        difficulty: 'easy',
        firstPlayer: 'patient',
        sessionRound: 0,
      });

      engine.place(0);
      // Ahora es turno de O, si X intenta jugar en la misma o en otra celda:
      const invalid = engine.place(0);
      expect(invalid).toEqual([]);
    });

    it('place() cuando no es turno de X devuelve []', () => {
      const engine = new TriquiEngine({
        difficulty: 'easy',
        firstPlayer: 'patient',
        sessionRound: 0,
      });

      engine.place(4);
      expect(engine.currentMark).toBe('O');

      // Paciente intenta jugar de nuevo sin esperar a la IA
      const events = engine.place(1);
      expect(events).toEqual([]);
      expect(engine.board[1]).toBeNull();
    });
  });

  describe('Detección de las 8 líneas ganadoras para el paciente', () => {
    for (const [a, b, c] of WINNING_LINES) {
      it(`detecta victoria en línea [${a}, ${b}, ${c}]`, () => {
        const engine = new TriquiEngine({
          difficulty: 'easy',
          firstPlayer: 'patient',
          sessionRound: 0,
        });

        const otherCells = ([0, 1, 2, 3, 4, 5, 6, 7, 8] as CellIndex[]).filter(
          (idx) => idx !== a && idx !== b && idx !== c,
        );

        engine.place(a);
        (engine as any)._board[otherCells[0]] = 'O';
        (engine as any)._currentMark = 'X';

        engine.place(b);
        (engine as any)._board[otherCells[1]] = 'O';
        (engine as any)._currentMark = 'X';

        const winEvents = engine.place(c);
        expect(engine.isOver).toBe(true);
        expect(engine.winner).toBe('X');
        expect(engine.winningLine).toEqual([a, b, c]);
        expect(winEvents).toContainEqual({
          type: 'win',
          line: [a, b, c],
        });
      });
    }
  });

  describe('Detección de derrota cuando la IA completa una línea', () => {
    it('emite evento lose cuando O completa 3 en línea', () => {
      const engine = new TriquiEngine({
        difficulty: 'easy',
        firstPlayer: 'alternate',
        sessionRound: 1, // Arranca la IA ('O')
        rng: () => 0, // Determinista
      });

      // IA abre y coloca en la primera celda libre (0)
      engine.aiPlace();
      expect(engine.board[0]).toBe('O');

      // Paciente juega en 3
      engine.place(3);

      // IA juega en 1
      engine.aiPlace();
      expect(engine.board[1]).toBe('O');

      // Paciente juega en 4
      engine.place(4);

      // IA juega en 2 y completa la fila [0, 1, 2]
      const loseEvents = engine.aiPlace();
      expect(engine.isOver).toBe(true);
      expect(engine.winner).toBe('O');
      expect(engine.winningLine).toEqual([0, 1, 2]);
      expect(loseEvents).toContainEqual({
        type: 'lose',
        line: [0, 1, 2],
      });
    });
  });

  describe('Detección de empate (Draw)', () => {
    it('emite evento draw cuando el tablero se llena sin ganador', () => {
      const engine = new TriquiEngine({
        difficulty: 'easy',
        firstPlayer: 'patient',
        sessionRound: 0,
      });

      // Secuencia conocida de empate clásico:
      // X | O | X
      // X | O | O
      // O | X | X
      // Celdas:
      // 0:X, 1:O, 2:X
      // 3:X, 4:O, 5:O
      // 6:O, 7:X, 8:X

      // Forzar jugadas paso a paso
      engine.place(0); // X en 0
      (engine as any)._board[1] = 'O'; (engine as any)._currentMark = 'X'; // O en 1
      engine.place(2); // X en 2
      (engine as any)._board[4] = 'O'; (engine as any)._currentMark = 'X'; // O en 4
      engine.place(3); // X en 3
      (engine as any)._board[5] = 'O'; (engine as any)._currentMark = 'X'; // O en 5
      engine.place(7); // X en 7
      (engine as any)._board[6] = 'O'; (engine as any)._currentMark = 'X'; // O en 6

      // Último movimiento de X en 8
      const drawEvents = engine.place(8);
      expect(engine.isOver).toBe(true);
      expect(engine.isDraw).toBe(true);
      expect(engine.winner).toBeNull();
      expect(drawEvents).toContainEqual({ type: 'draw' });
    });
  });

  it('no permite movimientos una vez que isOver es true', () => {
    const engine = new TriquiEngine({
      difficulty: 'easy',
      firstPlayer: 'patient',
      sessionRound: 0,
    });

    engine.place(0);
    (engine as any)._board[3] = 'O';
    (engine as any)._currentMark = 'X';
    engine.place(1);
    (engine as any)._board[4] = 'O';
    (engine as any)._currentMark = 'X';
    engine.place(2); // Gana fila [0, 1, 2]

    expect(engine.isOver).toBe(true);

    // Intentar mover tras la victoria
    const postEvents = engine.place(8);
    expect(postEvents).toEqual([]);
    const postAiEvents = engine.aiPlace();
    expect(postAiEvents).toEqual([]);
  });
});
