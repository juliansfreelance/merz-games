import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { GameSession, MAX_LIVES } from './game-session';
import { AppLogger } from '../logging/app-error';

function buildSession() {
  TestBed.configureTestingModule({
    providers: [
      GameSession,
      AppLogger,
      provideRouter([
        // Ruta mínima para que el router no falle al navegar al resultado
        { path: 'result/:experienceId/:result', children: [] },
        { path: '**', children: [] },
      ]),
    ],
  });
  return {
    session: TestBed.inject(GameSession),
    router: TestBed.inject(Router),
  };
}

describe('GameSession', () => {
  it('debe inicializar con MAX_LIVES vidas', () => {
    const { session } = buildSession();
    expect(session.maxLives).toBe(MAX_LIVES);
    expect(session.remainingLives()).toBe(MAX_LIVES);
  });

  it('start() debe reiniciar vidas a MAX_LIVES y registrar experienceId', () => {
    const { session } = buildSession();
    // Simular una vida perdida antes de reiniciar
    session.start('primera-exp');
    session.loseLife();
    expect(session.remainingLives()).toBe(MAX_LIVES - 1);

    session.start('nueva-exp');
    expect(session.remainingLives()).toBe(MAX_LIVES);
    expect(session.activeExperienceId()).toBe('nueva-exp');
  });

  it('loseLife() debe restar 1 vida cada vez', () => {
    const { session } = buildSession();
    session.start('test-exp');

    expect(session.loseLife()).toBe(2);
    expect(session.remainingLives()).toBe(2);

    expect(session.loseLife()).toBe(1);
    expect(session.remainingLives()).toBe(1);
  });

  it('tres loseLife() deben navegar a out-of-lives', async () => {
    const { session, router } = buildSession();
    session.start('test-exp');

    const navigateSpy = vi.spyOn(router, 'navigate');

    session.loseLife();
    session.loseLife();
    session.loseLife();

    expect(session.remainingLives()).toBe(0);
    expect(navigateSpy).toHaveBeenCalledWith(['/result', 'test-exp', 'out-of-lives']);
  });

  it('complete("win") debe navegar a result con win', () => {
    const { session, router } = buildSession();
    session.start('test-exp');

    const navigateSpy = vi.spyOn(router, 'navigate');
    session.complete('win');

    expect(navigateSpy).toHaveBeenCalledWith(['/result', 'test-exp', 'win']);
  });

  it('complete("lose") debe navegar a result con lose', () => {
    const { session, router } = buildSession();
    session.start('test-exp');

    const navigateSpy = vi.spyOn(router, 'navigate');
    session.complete('lose');

    expect(navigateSpy).toHaveBeenCalledWith(['/result', 'test-exp', 'lose']);
  });

  it('win no requiere datos personales (sin PII)', () => {
    const { session } = buildSession();
    session.start('test-exp');
    // complete('win') no exige nombre, DNI, ni ningún campo personal
    expect(() => session.complete('win')).not.toThrow();
  });

  it('start() con nuevo experienceId reinicia sin datos del anterior', () => {
    const { session } = buildSession();
    session.start('exp-1');
    session.loseLife();
    session.loseLife();

    session.start('exp-2');
    expect(session.remainingLives()).toBe(MAX_LIVES);
    expect(session.activeExperienceId()).toBe('exp-2');
  });
});
