/**
 * Specs de memory-config:
 * - Precedencia de la cascada (kiosco > experiencia > motor > default).
 * - Rechazo de valores inválidos sin romper la cascada.
 * - Tabla de columnas de rejilla.
 */

import {
  GRID_COLUMNS_BY_TOTAL,
  MEMORY_DIFFICULTY_DEFAULT,
  MEMORY_LIVES_MIN,
  MEMORY_PAIRS_DEFAULT,
  MEMORY_PAIRS_MAX,
  MEMORY_PAIRS_MIN,
  getGridColumns,
  getRecommendedLives,
  resolveMemoryConfig,
  resolveMemoryPairs,
  validateDifficulty,
  validateLives,
  validatePairs,
} from './memory-config';

describe('validatePairs', () => {
  it('acepta valores enteros en rango', () => {
    expect(validatePairs(2)).toBe(2);
    expect(validatePairs(4)).toBe(4);
    expect(validatePairs(6)).toBe(6);
  });

  it.each([
    [0, 'cero'],
    [1, 'debajo del mínimo'],
    [7, 'sobre el máximo'],
    [9, 'muy por encima'],
    [-1, 'negativo'],
  ])('descarta %i (%s)', (value) => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validatePairs(value)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('descarta valores no numéricos, no enteros, fuera de rango o NaN', () => {
    const invalids: unknown[] = [2.5, NaN, 'cuatro', null, undefined, true, 0, 1, 7, 9, -1];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const v of invalids) {
      expect(validatePairs(v)).toBeNull();
    }
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('resolveMemoryPairs — cascada', () => {
  it('nivel 1 (kiosco) gana cuando es válido', () => {
    const result = resolveMemoryPairs({
      kioskOverride: 3,
      experienceConfig: { pairs: 2 },
      gameConfig: { pairs: 5 },
    });
    expect(result.pairs).toBe(3);
    expect(result.source).toBe('kiosk');
  });

  it('nivel 2 (experiencia) gana cuando kiosco es null', () => {
    const result = resolveMemoryPairs({
      kioskOverride: null,
      experienceConfig: { pairs: 2 },
      gameConfig: { pairs: 5 },
    });
    expect(result.pairs).toBe(2);
    expect(result.source).toBe('experience');
  });

  it('nivel 3 (motor) gana cuando kiosco es null y experiencia no tiene config', () => {
    const result = resolveMemoryPairs({
      kioskOverride: null,
      gameConfig: { pairs: 5 },
    });
    expect(result.pairs).toBe(5);
    expect(result.source).toBe('game');
  });

  it('nivel 4 (default) cuando todos los anteriores están ausentes o son inválidos', () => {
    const result = resolveMemoryPairs({ kioskOverride: null });
    expect(result.pairs).toBe(MEMORY_PAIRS_DEFAULT);
    expect(result.source).toBe('default');
  });

  it('valor inválido en kiosco cae al siguiente nivel sin romper', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveMemoryPairs({
      kioskOverride: 9 as unknown as number,  // inválido
      experienceConfig: { pairs: 3 },
    });
    expect(result.pairs).toBe(3);
    expect(result.source).toBe('experience');
    warnSpy.mockRestore();
  });

  it('valor inválido en experiencia cae a motor', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveMemoryPairs({
      kioskOverride: null,
      experienceConfig: { pairs: 0 },  // inválido
      gameConfig: { pairs: 4 },
    });
    expect(result.pairs).toBe(4);
    expect(result.source).toBe('game');
    warnSpy.mockRestore();
  });

  it('string en experiencia cae a motor sin lanzar excepción', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveMemoryPairs({
      kioskOverride: null,
      experienceConfig: { pairs: 'cuatro' as unknown as number },
      gameConfig: { pairs: 6 },
    });
    expect(result.pairs).toBe(6);
    expect(result.source).toBe('game');
    warnSpy.mockRestore();
  });

  it('todos inválidos → default', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveMemoryPairs({
      kioskOverride: -5 as unknown as number,
      experienceConfig: { pairs: 'dos' as unknown as number },
      gameConfig: { pairs: 99 },
    });
    expect(result.pairs).toBe(MEMORY_PAIRS_DEFAULT);
    expect(result.source).toBe('default');
    warnSpy.mockRestore();
  });
});

describe('getGridColumns — tabla de rejilla', () => {
  it.each([
    [4,  2],
    [6,  2],
    [8,  2],
    [10, 2],
    [12, 3],
  ])('%i cartas en portrait → %i columnas', (cards, cols) => {
    expect(getGridColumns(cards)).toBe(cols);
    expect(getGridColumns(cards, false)).toBe(cols);
  });

  it.each([
    [4,  2],
    [6,  3],
    [8,  4],
    [10, 5],
    [12, 4],
  ])('%i cartas en landscape → %i columnas', (cards, cols) => {
    expect(getGridColumns(cards, true)).toBe(cols);
  });

  it('valor fuera de tabla devuelve un fallback razonable (>= 2)', () => {
    const result = getGridColumns(14);
    expect(result).toBeGreaterThanOrEqual(2);
    expect(typeof result).toBe('number');
  });

  it('GRID_COLUMNS_BY_TOTAL cubre todos los totales de 2–6 parejas', () => {
    for (let pairs = MEMORY_PAIRS_MIN; pairs <= MEMORY_PAIRS_MAX; pairs++) {
      const total = pairs * 2;
      expect(getGridColumns(total)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('validateLives', () => {
  it('acepta valores enteros >= 3', () => {
    expect(validateLives(3)).toBe(3);
    expect(validateLives(4)).toBe(4);
    expect(validateLives(10)).toBe(10);
  });

  it('descarta valores < 3, no enteros, negativos o inválidos', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateLives(2)).toBeNull();
    expect(validateLives(0)).toBeNull();
    expect(validateLives(-1)).toBeNull();
    expect(validateLives(3.5)).toBeNull();
    expect(validateLives('tres')).toBeNull();
    expect(validateLives(null)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('validateDifficulty', () => {
  it('acepta "easy", "medium", "hard", "custom"', () => {
    expect(validateDifficulty('easy')).toBe('easy');
    expect(validateDifficulty('medium')).toBe('medium');
    expect(validateDifficulty('hard')).toBe('hard');
    expect(validateDifficulty('custom')).toBe('custom');
  });

  it('descarta valores no reconocidos', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateDifficulty('expert')).toBeNull();
    expect(validateDifficulty('')).toBeNull();
    expect(validateDifficulty(123)).toBeNull();
    expect(validateDifficulty(null)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('getRecommendedLives — heurística de vidas', () => {
  it('fácil: Math.max(3, Math.ceil(pairs * 1.5))', () => {
    expect(getRecommendedLives(2, 'easy')).toBe(3); // ceil(3)=3
    expect(getRecommendedLives(3, 'easy')).toBe(5); // ceil(4.5)=5
    expect(getRecommendedLives(4, 'easy')).toBe(6); // ceil(6)=6
    expect(getRecommendedLives(5, 'easy')).toBe(8); // ceil(7.5)=8
    expect(getRecommendedLives(6, 'easy')).toBe(9); // ceil(9)=9
  });

  it('medio: Math.max(3, pairs)', () => {
    expect(getRecommendedLives(2, 'medium')).toBe(3); // max(3, 2)=3
    expect(getRecommendedLives(3, 'medium')).toBe(3); // max(3, 3)=3
    expect(getRecommendedLives(4, 'medium')).toBe(4);
    expect(getRecommendedLives(5, 'medium')).toBe(5);
    expect(getRecommendedLives(6, 'medium')).toBe(6);
  });

  it('difícil: Math.max(3, Math.ceil(pairs * 0.75))', () => {
    expect(getRecommendedLives(2, 'hard')).toBe(3); // max(3, 1.5)=3
    expect(getRecommendedLives(3, 'hard')).toBe(3); // max(3, 2.25)=3
    expect(getRecommendedLives(4, 'hard')).toBe(3); // max(3, 3)=3
    expect(getRecommendedLives(5, 'hard')).toBe(4); // max(3, 3.75)=4
    expect(getRecommendedLives(6, 'hard')).toBe(5); // max(3, 4.5)=5
  });

  it('custom usa la fórmula recomendada media por defecto (>=3)', () => {
    expect(getRecommendedLives(2, 'custom')).toBe(3);
    expect(getRecommendedLives(4, 'custom')).toBe(4);
  });
});

describe('resolveMemoryConfig — cascada completa', () => {
  it('override de kiosco gana en pairs, lives y difficulty', () => {
    const result = resolveMemoryConfig({
      kioskOverride: { pairs: 5, lives: 7, difficulty: 'easy' },
      experienceConfig: { pairs: 3, lives: 4, difficulty: 'medium' },
      gameConfig: { pairs: 4, lives: 4, difficulty: 'medium' },
    });
    expect(result.pairs).toBe(5);
    expect(result.lives).toBe(7);
    expect(result.difficulty).toBe('easy');
    expect(result.source).toBe('kiosk');
  });

  it('kiosk override parcial (solo pairs) autocalcula vidas con preset', () => {
    const result = resolveMemoryConfig({
      kioskOverride: { pairs: 6 },
      experienceConfig: { difficulty: 'hard' },
    });
    expect(result.pairs).toBe(6);
    expect(result.difficulty).toBe('hard');
    expect(result.lives).toBe(5); // getRecommendedLives(6, 'hard') = 5
    expect(result.source).toBe('kiosk');
  });

  it('experience config gana cuando kioskOverride es null', () => {
    const result = resolveMemoryConfig({
      kioskOverride: null,
      experienceConfig: { pairs: 3, lives: 5, difficulty: 'easy' },
      gameConfig: { pairs: 4, lives: 4, difficulty: 'medium' },
    });
    expect(result.pairs).toBe(3);
    expect(result.lives).toBe(5);
    expect(result.difficulty).toBe('easy');
    expect(result.source).toBe('experience');
  });

  it('game config gana cuando experiencia no tiene config', () => {
    const result = resolveMemoryConfig({
      kioskOverride: null,
      experienceConfig: undefined,
      gameConfig: { pairs: 4, lives: 4, difficulty: 'medium' },
    });
    expect(result.pairs).toBe(4);
    expect(result.lives).toBe(4);
    expect(result.difficulty).toBe('medium');
    expect(result.source).toBe('game');
  });

  it('default total cuando todas las fuentes están vacías', () => {
    const result = resolveMemoryConfig({});
    expect(result.pairs).toBe(MEMORY_PAIRS_DEFAULT);
    expect(result.difficulty).toBe(MEMORY_DIFFICULTY_DEFAULT);
    expect(result.lives).toBe(4);
    expect(result.source).toBe('default');
  });
});

