import { describe, it, expect } from 'vitest';
import { calculateAiMove, checkWinner, BoardState } from './triqui-ai';
import { Mark, CellIndex } from './triqui.model';

describe('TriquiAi - Estrategia Easy', () => {
  it('elige una celda vacía basada en el RNG inyectado', () => {
    // Tablero con celdas 0, 1 ocupadas
    const board: (Mark | null)[] = [
      'X', 'O', null,
      null, null, null,
      null, null, null,
    ];
    // Celdas libres: [2, 3, 4, 5, 6, 7, 8] (7 celdas)
    // Con rng devolviendo 0 -> índice 0 de libres -> celda 2
    const move = calculateAiMove(board, 'easy', () => 0);
    expect(move).toBe(2);

    // Con rng devolviendo 0.99 -> último índice (6) -> celda 8
    const moveLast = calculateAiMove(board, 'easy', () => 0.99);
    expect(moveLast).toBe(8);
  });
});

describe('TriquiAi - Estrategia Medium', () => {
  it('gana inmediatamente si tiene dos fichas O en línea (con rng favorable)', () => {
    const board: (Mark | null)[] = [
      'O', 'O', null,
      'X', 'X', null,
      null, null, null,
    ];
    const move = calculateAiMove(board, 'medium', () => 0);
    expect(move).toBe(2); // Completa la primera fila
  });

  it('bloquea al paciente X si tiene dos fichas en línea (con rng favorable <= 0.65)', () => {
    const board: (Mark | null)[] = [
      'X', 'X', null,
      'O', null, null,
      null, null, null,
    ];
    const move = calculateAiMove(board, 'medium', () => 0);
    expect(move).toBe(2); // Bloquea en la celda 2
  });

  it('comete un despiste humano y no bloquea cuando rng supera 0.65', () => {
    const board: (Mark | null)[] = [
      'X', 'X', null,
      'O', null, null,
      null, null, null,
    ];
    // Con rng = 0.9 (> 0.65), la IA se despista y no bloquea en 2
    const move = calculateAiMove(board, 'medium', () => 0.9);
    expect(move).not.toBe(2);
  });

  it('prioriza ganar sobre bloquear si ambos tienen dos en línea', () => {
    const board: (Mark | null)[] = [
      'O', 'O', null, // O gana en 2
      'X', 'X', null, // X ganaría en 5
      null, null, null,
    ];
    const move = calculateAiMove(board, 'medium', () => 0);
    expect(move).toBe(2);
  });

  it('elige el centro si está disponible y rng < 0.50', () => {
    const board: (Mark | null)[] = [
      'X', null, null,
      null, null, null,
      null, null, null,
    ];
    const move = calculateAiMove(board, 'medium', () => 0.2);
    expect(move).toBe(4);
  });

  it('permite que el jugador dispute el centro cuando rng >= 0.50', () => {
    const board: (Mark | null)[] = [
      'X', null, null,
      null, null, null,
      null, null, null,
    ];
    // Con rng = 0.8, no toma el centro forzado
    const move = calculateAiMove(board, 'medium', () => 0.8);
    expect(move).not.toBe(4);
  });

  it('elige una esquina si el centro está ocupado', () => {
    const board: (Mark | null)[] = [
      null, null, null,
      null, 'X', null,
      null, null, null,
    ];
    const move = calculateAiMove(board, 'medium', () => 0); // primer esquina [0,2,6,8] -> 0
    expect(move).toBe(0);
  });
});

describe('TriquiAi - Estrategia Hard (Minimax)', () => {
  it('gana inmediatamente cuando se presenta la oportunidad', () => {
    const board: (Mark | null)[] = [
      'O', 'O', null,
      'X', 'X', null,
      null, null, null,
    ];
    const move = calculateAiMove(board, 'hard');
    expect(move).toBe(2);
  });

  it('bloquea la victoria inmediata del paciente', () => {
    const board: (Mark | null)[] = [
      'X', null, 'X',
      'O', null, null,
      null, null, null,
    ];
    const move = calculateAiMove(board, 'hard');
    expect(move).toBe(1);
  });

  it('bloquea bifurcaciones comunes de esquina (corner trap)', () => {
    // El paciente pone esquinas opuestas 0 y 8, O puso centro 4
    const board: (Mark | null)[] = [
      'X', null, null,
      null, 'O', null,
      null, null, 'X',
    ];
    // Para defenderse, O debe jugar un lado (1, 3, 5 o 7), no una esquina
    const move = calculateAiMove(board, 'hard');
    expect([1, 3, 5, 7]).toContain(move);
  });

  it('en tablero vacío abre tomando el centro', () => {
    const emptyBoard: (Mark | null)[] = Array(9).fill(null);
    const move = calculateAiMove(emptyBoard, 'hard');
    expect(move).toBe(4);
  });

  it('simulación Hard vs Hard siempre termina en empate', () => {
    const board: (Mark | null)[] = Array(9).fill(null);
    let currentMark: Mark = 'X';

    // Función auxiliar para Minimax de X (inverso de O)
    const getBestMoveForX = (b: (Mark | null)[]): CellIndex => {
      // Si invertimos X y O en el tablero, podemos reusar calculateAiMove hard
      const inverted: (Mark | null)[] = b.map((m) =>
        m === 'X' ? 'O' : m === 'O' ? 'X' : null,
      );
      return calculateAiMove(inverted, 'hard');
    };

    let turns = 0;
    while (turns < 9) {
      if (currentMark === 'X') {
        const moveX = getBestMoveForX(board);
        board[moveX] = 'X';
      } else {
        const moveO = calculateAiMove(board, 'hard');
        board[moveO] = 'O';
      }

      const winner = checkWinner(board);
      if (winner) break;

      currentMark = currentMark === 'X' ? 'O' : 'X';
      turns++;
    }

    expect(checkWinner(board)).toBeNull(); // Ninguno gana: empate perfecto
  });
});
