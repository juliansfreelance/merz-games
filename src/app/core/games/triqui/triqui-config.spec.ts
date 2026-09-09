import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TRIQUI_DIFFICULTY_DEFAULT,
  TRIQUI_FIRST_PLAYER_DEFAULT,
  TRIQUI_PLAYER_SYMBOL_DEFAULT,
  validateDifficulty,
  validateFirstPlayer,
  validatePlayerSymbol,
  resolveTriquiDifficulty,
  resolveTriquiFirstPlayer,
  resolveTriquiPlayerSymbol,
} from './triqui-config';

describe('TriquiConfig validation', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('validateDifficulty valida easy, medium y hard correctamente', () => {
    expect(validateDifficulty('easy')).toBe('easy');
    expect(validateDifficulty('medium')).toBe('medium');
    expect(validateDifficulty('hard')).toBe('hard');
  });

  it('validateDifficulty descarta valores desconocidos o no-string con warning', () => {
    expect(validateDifficulty('expert')).toBeNull();
    expect(validateDifficulty(123)).toBeNull();
    expect(validateDifficulty(null)).toBeNull();
    expect(validateDifficulty(undefined)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('validateFirstPlayer valida patient, alternate y random correctamente', () => {
    expect(validateFirstPlayer('patient')).toBe('patient');
    expect(validateFirstPlayer('alternate')).toBe('alternate');
    expect(validateFirstPlayer('random')).toBe('random');
  });

  it('validateFirstPlayer descarta valores inválidos con warning', () => {
    expect(validateFirstPlayer('cpu')).toBeNull();
    expect(validateFirstPlayer(42)).toBeNull();
    expect(validateFirstPlayer({})).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('validatePlayerSymbol valida X, O y random correctamente', () => {
    expect(validatePlayerSymbol('X')).toBe('X');
    expect(validatePlayerSymbol('O')).toBe('O');
    expect(validatePlayerSymbol('random')).toBe('random');
  });

  it('validatePlayerSymbol descarta valores inválidos con warning', () => {
    expect(validatePlayerSymbol('triangle')).toBeNull();
    expect(validatePlayerSymbol(1)).toBeNull();
    expect(validatePlayerSymbol({})).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('TriquiConfig cascada de dificultad', () => {
  it('Nivel 1 (kioskOverride) tiene máxima precedencia', () => {
    const res = resolveTriquiDifficulty({
      kioskOverride: 'hard',
      experienceConfig: { difficulty: 'easy' },
      gameConfig: { difficulty: 'medium' },
    });
    expect(res).toEqual({ difficulty: 'hard', source: 'kiosk' });
  });

  it('Nivel 1 inválido cae a Nivel 2 (experienceConfig)', () => {
    const res = resolveTriquiDifficulty({
      kioskOverride: 'invalid' as any,
      experienceConfig: { difficulty: 'hard' },
      gameConfig: { difficulty: 'medium' },
    });
    expect(res).toEqual({ difficulty: 'hard', source: 'experience' });
  });

  it('Nivel 2 (experienceConfig) tiene precedencia sobre Nivel 3 (gameConfig)', () => {
    const res = resolveTriquiDifficulty({
      kioskOverride: null,
      experienceConfig: { difficulty: 'easy' },
      gameConfig: { difficulty: 'hard' },
    });
    expect(res).toEqual({ difficulty: 'easy', source: 'experience' });
  });

  it('Nivel 3 (gameConfig) tiene precedencia sobre default', () => {
    const res = resolveTriquiDifficulty({
      kioskOverride: null,
      experienceConfig: {},
      gameConfig: { difficulty: 'hard' },
    });
    expect(res).toEqual({ difficulty: 'hard', source: 'game' });
  });

  it('Cae a Nivel 4 (default = medium) cuando no hay configuración', () => {
    const res = resolveTriquiDifficulty({
      kioskOverride: null,
    });
    expect(res).toEqual({ difficulty: TRIQUI_DIFFICULTY_DEFAULT, source: 'default' });
  });
});

describe('TriquiConfig cascada de firstPlayer', () => {
  it('Nivel 1 (kioskOverride) tiene máxima precedencia', () => {
    const res = resolveTriquiFirstPlayer({
      kioskOverride: 'alternate',
      experienceConfig: { firstPlayer: 'patient' },
      gameConfig: { firstPlayer: 'random' },
    });
    expect(res).toEqual({ firstPlayer: 'alternate', source: 'kiosk' });
  });

  it('Nivel 2 (experienceConfig) tiene precedencia sobre gameConfig', () => {
    const res = resolveTriquiFirstPlayer({
      kioskOverride: null,
      experienceConfig: { firstPlayer: 'random' },
      gameConfig: { firstPlayer: 'patient' },
    });
    expect(res).toEqual({ firstPlayer: 'random', source: 'experience' });
  });

  it('Nivel 3 (gameConfig) tiene precedencia sobre default', () => {
    const res = resolveTriquiFirstPlayer({
      kioskOverride: null,
      experienceConfig: {},
      gameConfig: { firstPlayer: 'alternate' },
    });
    expect(res).toEqual({ firstPlayer: 'alternate', source: 'game' });
  });

  it('Cae a Nivel 4 (default = patient) cuando no hay configuración', () => {
    const res = resolveTriquiFirstPlayer({
      kioskOverride: null,
    });
    expect(res).toEqual({ firstPlayer: TRIQUI_FIRST_PLAYER_DEFAULT, source: 'default' });
  });
});

describe('TriquiConfig cascada de playerSymbol', () => {
  it('Nivel 1 (kioskOverride) tiene máxima precedencia (random, X, O)', () => {
    const resRandom = resolveTriquiPlayerSymbol({
      kioskOverride: 'random',
      experienceConfig: { playerSymbol: 'X' },
      gameConfig: { playerSymbol: 'O' },
    });
    expect(resRandom).toEqual({ playerSymbol: 'random', source: 'kiosk' });

    const resO = resolveTriquiPlayerSymbol({
      kioskOverride: 'O',
      experienceConfig: { playerSymbol: 'random' },
    });
    expect(resO).toEqual({ playerSymbol: 'O', source: 'kiosk' });
  });

  it('Nivel 2 (experienceConfig) tiene precedencia sobre gameConfig', () => {
    const res = resolveTriquiPlayerSymbol({
      kioskOverride: null,
      experienceConfig: { playerSymbol: 'random' },
      gameConfig: { playerSymbol: 'O' },
    });
    expect(res).toEqual({ playerSymbol: 'random', source: 'experience' });
  });

  it('Nivel 3 (gameConfig) tiene precedencia sobre default', () => {
    const res = resolveTriquiPlayerSymbol({
      kioskOverride: null,
      experienceConfig: {},
      gameConfig: { playerSymbol: 'O' },
    });
    expect(res).toEqual({ playerSymbol: 'O', source: 'game' });
  });

  it('Cae a Nivel 4 (default = random) cuando no hay configuración', () => {
    const res = resolveTriquiPlayerSymbol({
      kioskOverride: null,
    });
    expect(res).toEqual({ playerSymbol: TRIQUI_PLAYER_SYMBOL_DEFAULT, source: 'default' });
  });
});
