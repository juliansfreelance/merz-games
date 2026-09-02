/**
 * Specs de memory-config:
 * - Precedencia de la cascada (kiosco > experiencia > motor > default).
 * - Rechazo de valores inválidos sin romper la cascada.
 * - Tabla de columnas de rejilla.
 */

import {
  GRID_COLUMNS_BY_TOTAL,
  MEMORY_PAIRS_DEFAULT,
  MEMORY_PAIRS_MAX,
  MEMORY_PAIRS_MIN,
  getGridColumns,
  resolveMemoryPairs,
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
