import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IdleWatchdog } from './idle-watchdog';
import { KioskSettings } from '../settings/kiosk-settings';
import { GameSession } from '../session/game-session';
import { MediaPlayer } from '../media/media-player';
import { AppLogger } from '../logging/app-error';
import { signal } from '@angular/core';

describe('IdleWatchdog', () => {
  let routerEvents$: Subject<any>;
  let mockRouter: any;
  let mockSettings: any;
  let mockSession: any;
  let mockMediaPlayer: any;

  beforeEach(() => {
    vi.useFakeTimers();
    routerEvents$ = new Subject<any>();

    mockRouter = {
      url: '/welcome',
      events: routerEvents$.asObservable(),
      navigateByUrl: vi.fn().mockResolvedValue(true),
    };

    mockSettings = {
      screensaverIdleMs: signal(180_000),
    };

    mockSession = {
      leavePlay: vi.fn(),
    };

    mockMediaPlayer = {
      resumeBgm: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        IdleWatchdog,
        AppLogger,
        { provide: Router, useValue: mockRouter },
        { provide: KioskSettings, useValue: mockSettings },
        { provide: GameSession, useValue: mockSession },
        { provide: MediaPlayer, useValue: mockMediaPlayer },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('debe arrancar inactivo y activarse tras el tiempo de inactividad en /welcome', () => {
    const watchdog = TestBed.inject(IdleWatchdog);
    expect(watchdog.isActive()).toBe(false);

    // Avanzar 179 segundos -> sigue inactivo
    vi.advanceTimersByTime(179_000);
    expect(watchdog.isActive()).toBe(false);

    // Avanzar 1 segundo más (total 180s = 3 min) -> se activa
    vi.advanceTimersByTime(1_000);
    expect(watchdog.isActive()).toBe(true);
  });

  it('NO debe activarse si la ruta es "/" (splash)', () => {
    mockRouter.url = '/';
    const watchdog = TestBed.inject(IdleWatchdog);

    routerEvents$.next(new NavigationEnd(1, '/', '/'));

    vi.advanceTimersByTime(300_000);
    expect(watchdog.isActive()).toBe(false);
  });

  it('NO debe activarse en rutas de administración (/admin y /admin/login)', () => {
    const watchdog = TestBed.inject(IdleWatchdog);

    routerEvents$.next(new NavigationEnd(1, '/admin/login', '/admin/login'));
    vi.advanceTimersByTime(300_000);
    expect(watchdog.isActive()).toBe(false);

    routerEvents$.next(new NavigationEnd(2, '/admin', '/admin'));
    vi.advanceTimersByTime(300_000);
    expect(watchdog.isActive()).toBe(false);
  });

  it('resetea el contador si ocurre un evento de usuario antes del timeout', () => {
    const watchdog = TestBed.inject(IdleWatchdog);

    // Avanzar 100 segundos
    vi.advanceTimersByTime(100_000);
    expect(watchdog.isActive()).toBe(false);

    // Interacción de usuario (toque en pantalla)
    document.dispatchEvent(new Event('pointerdown'));

    // Avanzar 100 segundos más (si no se hubiese reseteado, a los 180s ya habría saltado)
    vi.advanceTimersByTime(100_000);
    expect(watchdog.isActive()).toBe(false);

    // Otros 80 segundos (total 180s desde el toque) -> salta
    vi.advanceTimersByTime(80_000);
    expect(watchdog.isActive()).toBe(true);
  });

  it('dismiss() desactiva el protector, limpia sesión, reanuda BGM y navega a /welcome', () => {
    mockRouter.url = '/play/radiesse-memory';
    const watchdog = TestBed.inject(IdleWatchdog);

    routerEvents$.next(new NavigationEnd(1, '/play/radiesse-memory', '/play/radiesse-memory'));
    vi.advanceTimersByTime(180_000);
    expect(watchdog.isActive()).toBe(true);

    watchdog.dismiss();

    expect(watchdog.isActive()).toBe(false);
    expect(mockSession.leavePlay).toHaveBeenCalled();
    expect(mockMediaPlayer.resumeBgm).toHaveBeenCalled();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/welcome');
  });

  it('respeta el nuevo tiempo configurado en screensaverIdleMs en el siguiente ciclo', () => {
    const watchdog = TestBed.inject(IdleWatchdog);

    // Cambiar configuración a 60 segundos
    mockSettings.screensaverIdleMs.set(60_000);

    // Navegar o reiniciar timer con toque
    document.dispatchEvent(new Event('pointerdown'));

    vi.advanceTimersByTime(59_000);
    expect(watchdog.isActive()).toBe(false);

    vi.advanceTimersByTime(1_000);
    expect(watchdog.isActive()).toBe(true);
  });
});
