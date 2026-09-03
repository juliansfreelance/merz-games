import { TestBed } from '@angular/core/testing';
import { GameSession, MAX_LIVES, RESULT_REVEAL_DELAY_MS } from './game-session';
import { AppLogger } from '../logging/app-error';

function buildSession() {
  TestBed.configureTestingModule({
    providers: [GameSession, AppLogger],
  });
  return TestBed.inject(GameSession);
}

describe('GameSession', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debe inicializar con MAX_LIVES vidas', () => {
    const session = buildSession();
    expect(session.maxLives).toBe(MAX_LIVES);
    expect(session.remainingLives()).toBe(MAX_LIVES);
    expect(session.playResult()).toBeNull();
  });

  it('start() debe reiniciar vidas a MAX_LIVES y registrar experienceId', () => {
    const session = buildSession();
    session.start('primera-exp');
    session.loseLife();
    expect(session.remainingLives()).toBe(MAX_LIVES - 1);

    session.start('nueva-exp');
    expect(session.remainingLives()).toBe(MAX_LIVES);
    expect(session.activeExperienceId()).toBe('nueva-exp');
    expect(session.playResult()).toBeNull();
  });

  it('start() incrementa round para remount del motor', () => {
    const session = buildSession();
    expect(session.round()).toBe(0);
    session.start('test-exp');
    expect(session.round()).toBe(1);
    session.start('test-exp');
    expect(session.round()).toBe(2);
  });

  it('loseLife() debe restar 1 vida cada vez', () => {
    const session = buildSession();
    session.start('test-exp');

    expect(session.loseLife()).toBe(2);
    expect(session.remainingLives()).toBe(2);

    expect(session.loseLife()).toBe(1);
    expect(session.remainingLives()).toBe(1);
  });

  it('tres loseLife() programan overlay out-of-lives tras el delay', () => {
    vi.useFakeTimers();
    const session = buildSession();
    session.start('test-exp');

    session.loseLife();
    session.loseLife();
    session.loseLife();

    expect(session.remainingLives()).toBe(0);
    expect(session.playResult()).toBeNull();

    vi.advanceTimersByTime(RESULT_REVEAL_DELAY_MS);
    expect(session.playResult()).toBe('out-of-lives');
  });

  it('complete("win") programa overlay win tras el delay', () => {
    vi.useFakeTimers();
    const session = buildSession();
    session.start('test-exp');

    session.complete('win');
    expect(session.playResult()).toBeNull();

    vi.advanceTimersByTime(RESULT_REVEAL_DELAY_MS);
    expect(session.playResult()).toBe('win');
  });

  it('complete("lose") programa overlay lose tras el delay', () => {
    vi.useFakeTimers();
    const session = buildSession();
    session.start('test-exp');

    session.complete('lose');
    expect(session.playResult()).toBeNull();

    vi.advanceTimersByTime(RESULT_REVEAL_DELAY_MS);
    expect(session.playResult()).toBe('lose');
  });

  it('win no requiere datos personales (sin PII)', () => {
    const session = buildSession();
    session.start('test-exp');
    expect(() => session.complete('win')).not.toThrow();
  });

  it('start() con nuevo experienceId reinicia sin datos del anterior', () => {
    vi.useFakeTimers();
    const session = buildSession();
    session.start('exp-1');
    session.loseLife();
    session.loseLife();
    session.loseLife();

    session.start('exp-2');
    vi.advanceTimersByTime(RESULT_REVEAL_DELAY_MS);

    expect(session.remainingLives()).toBe(MAX_LIVES);
    expect(session.activeExperienceId()).toBe('exp-2');
    expect(session.playResult()).toBeNull();
    expect(session.triquiTurn()).toBeNull();
  });

  it('nextRound() conserva vidas restantes e incrementa round', () => {
    const session = buildSession();
    session.start('test-exp');
    session.loseLife();
    expect(session.remainingLives()).toBe(2);
    expect(session.round()).toBe(1);

    session.nextRound();
    expect(session.remainingLives()).toBe(2);
    expect(session.round()).toBe(2);
    expect(session.sessionRound()).toBe(2);
    expect(session.playResult()).toBeNull();
    expect(session.autoShowTutorial()).toBe(false);
  });

  it('sessionRound se reinicia a 1 en start() y sube en nextRound()', () => {
    const session = buildSession();
    expect(session.sessionRound()).toBe(0);

    session.start('test-exp');
    expect(session.sessionRound()).toBe(1);

    session.nextRound();
    session.nextRound();
    expect(session.sessionRound()).toBe(3);

    session.start('test-exp');
    expect(session.sessionRound()).toBe(1);
  });

  it('start() activa autoShowTutorial y nextRound() lo apaga', () => {
    const session = buildSession();
    expect(session.autoShowTutorial()).toBe(false);

    session.start('test-exp');
    expect(session.autoShowTutorial()).toBe(true);

    session.markTutorialShown();
    expect(session.autoShowTutorial()).toBe(false);

    session.start('test-exp');
    expect(session.autoShowTutorial()).toBe(true);
    session.nextRound();
    expect(session.autoShowTutorial()).toBe(false);
  });

  it('announce("draw") programa overlay draw tras el delay sin restar vidas', () => {
    vi.useFakeTimers();
    const session = buildSession();
    session.start('test-exp');

    session.announce('draw');
    expect(session.playResult()).toBeNull();
    expect(session.remainingLives()).toBe(MAX_LIVES);

    vi.advanceTimersByTime(RESULT_REVEAL_DELAY_MS);
    expect(session.playResult()).toBe('draw');
    expect(session.remainingLives()).toBe(MAX_LIVES);
  });

  it('announce("lose") programa overlay lose tras el delay', () => {
    vi.useFakeTimers();
    const session = buildSession();
    session.start('test-exp');

    session.announce('lose');
    expect(session.playResult()).toBeNull();

    vi.advanceTimersByTime(RESULT_REVEAL_DELAY_MS);
    expect(session.playResult()).toBe('lose');
  });

  it('start() limpia el indicador de turno de triqui al cambiar de juego', () => {
    const session = buildSession();
    session.start('ultherapy-triqui');
    session.setTriquiTurn({
      state: 'ai',
      markXUrl: '/x.png',
      markOUrl: '/o.png',
    });

    session.start('ultherapy-memory');
    expect(session.triquiTurn()).toBeNull();
    expect(session.activeExperienceId()).toBe('ultherapy-memory');
  });

  it('setTriquiTurn() actualiza y limpia el signal triquiTurn', () => {
    const session = buildSession();
    expect(session.triquiTurn()).toBeNull();

    session.setTriquiTurn({
      state: 'player',
      markXUrl: '/content/x.png',
      markOUrl: '/content/o.png',
    });
    expect(session.triquiTurn()).toEqual({
      state: 'player',
      markXUrl: '/content/x.png',
      markOUrl: '/content/o.png',
    });

    session.setTriquiTurn(null);
    expect(session.triquiTurn()).toBeNull();
  });

  it('leavePlay() cierra overlay, turno y desmonta la ronda', () => {
    vi.useFakeTimers();
    const session = buildSession();
    session.start('ultherapy-triqui');
    session.setTriquiTurn({
      state: 'player',
      markXUrl: '/x.png',
      markOUrl: '/o.png',
    });
    session.announce('draw');

    session.leavePlay();
    vi.advanceTimersByTime(RESULT_REVEAL_DELAY_MS);

    expect(session.playResult()).toBeNull();
    expect(session.triquiTurn()).toBeNull();
    expect(session.round()).toBe(0);
    expect(session.activeExperienceId()).toBe('');
  });
});

