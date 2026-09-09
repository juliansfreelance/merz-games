import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { GameHost } from './game-host';
import { CatalogService } from '../../core/catalog/catalog';
import { GameSession, TriquiTurnInfo } from '../../core/session/game-session';
import { PlatformService } from '../../core/platform/platform.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ParamMap, convertToParamMap } from '@angular/router';

function buildParamMap(params: Record<string, string>): ParamMap {
  return convertToParamMap(params);
}

describe('GameHost', () => {
  function setup(experienceId: string, activeExperienceId = '') {
    const mockCatalog = {
      getExperienceById: (id: string) => {
        const experiences: Record<string, { id: string; brandId: string; gameId: string; version: string; enabled: boolean; order: number }> = {
          'radiesse-memory': { id: 'radiesse-memory', brandId: 'radiesse', gameId: 'memory', version: '0.1.0', enabled: true, order: 1 },
          'radiesse-triqui': { id: 'radiesse-triqui', brandId: 'radiesse', gameId: 'triqui', version: '0.1.0', enabled: true, order: 2 },
          'unknown-engine': { id: 'unknown-engine', brandId: 'radiesse', gameId: 'no-existe', version: '0.1.0', enabled: true, order: 3 },
        };
        return experiences[id];
      },
      getBrandById: (id: string) => ({ id, name: id === 'radiesse' ? 'Radiesse' : id, enabled: true }),
      selectedBrand: signal({ id: 'radiesse', name: 'Radiesse', disclaimer: 'Disclaimer test' }),
      activityDisclaimer: signal('Disclaimer actividad test'),
      getGameById: (id: string) => ({
        id,
        name: id === 'memory' ? 'Encuentra la Pareja' : 'Triqui',
        enabled: true,
        version: '0.5.0',
        minAppVersion: '0.1.0',
        config: id === 'memory' ? { pairs: 4 } : {},
        assets: {},
      }),
      isExperienceDevelop: (exp: { develop?: boolean } | string) =>
        typeof exp === 'object' && exp?.develop === true,
    };

    const mockSession = {
      maxLives: signal(3),
      remainingLives: signal(3),
      tutorialRequested: signal(0),
      requestTutorial: vi.fn(),
      start: vi.fn(),
      loseLife: vi.fn(),
      complete: vi.fn(),
      dismissResult: vi.fn(),
      leavePlay: vi.fn(),
      autoShowTutorial: signal(false),
      markTutorialShown: vi.fn(),
      playResult: signal<string | null>(null),
      round: signal(1),
      sessionRound: signal(1),
      activeExperienceId: signal(activeExperienceId),
      triquiTurn: signal<TriquiTurnInfo | null>(null),
      setTriquiTurn: vi.fn(),
    };

    const mockPlatform = {
      appVersion: signal('0.1.0'),
      storageGet: vi.fn().mockReturnValue(null),
      storageSet: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [GameHost],
      providers: [
        { provide: CatalogService, useValue: mockCatalog },
        { provide: GameSession, useValue: mockSession },
        { provide: PlatformService, useValue: mockPlatform },
        provideRouter([
          { path: 'result/:experienceId/:result', children: [] },
          { path: '**', children: [] },
        ]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: buildParamMap({ experienceId }) },
            paramMap: of(buildParamMap({ experienceId })),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(GameHost);
    fixture.detectChanges();
    return { fixture, mockSession };
  }

  it('should resolve memory stub for radiesse-memory', () => {
    const { fixture } = setup('radiesse-memory');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-memory-play')).toBeTruthy();
    expect(el.querySelector('app-game-chrome')).toBeTruthy();
  });

  it('should resolve triqui stub for radiesse-triqui', () => {
    const { fixture } = setup('radiesse-triqui');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-triqui-play')).toBeTruthy();
    expect(el.querySelector('app-game-chrome')).toBeTruthy();
    expect(el.textContent).toContain('Ronda');
  });

  it('should show unavailable screen for unknown gameId', () => {
    const { fixture } = setup('unknown-engine');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-unavailable-screen')).toBeTruthy();
  });

  it('should show unavailable screen for unknown experienceId', () => {
    const { fixture } = setup('no-existe');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-unavailable-screen')).toBeTruthy();
  });

  it('should call session.start() when experience is resolved', () => {
    const { mockSession } = setup('radiesse-memory');
    expect(mockSession.start).toHaveBeenCalledTimes(1);
    expect(mockSession.start).toHaveBeenCalledWith('radiesse-memory', 4);
  });

  it('reinicia la sesión al reentrar al mismo juego aunque ya estuviera activo', () => {
    const { mockSession } = setup('radiesse-memory', 'radiesse-memory');
    expect(mockSession.start).toHaveBeenCalledWith('radiesse-memory', 4);
  });

  it('debe superponer el overlay de resultado sobre el juego sin quitar el tablero', () => {
    const { fixture, mockSession } = setup('radiesse-memory');
    mockSession.playResult.set('win');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-memory-play')).toBeTruthy();
    expect(el.querySelector('app-result-screen')).toBeTruthy();
    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('renderiza el indicador de turno en board-slot-top cuando session.triquiTurn está activo', () => {
    const { fixture, mockSession } = setup('radiesse-triqui');
    mockSession.triquiTurn.set({
      state: 'player',
      markXUrl: '/content/x.png',
      markOUrl: '/content/o.png',
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const slotTop = el.querySelector('[board-slot-top]');
    expect(slotTop).toBeTruthy();
    expect(slotTop?.textContent).toContain('Tu turno');
    expect(el.querySelector('.board-slot [board-slot-top]')).toBeTruthy();
  });

  it('al pulsar volver durante la partida muestra el diálogo de confirmación de salida sin salir de inmediato', () => {
    const { fixture, mockSession } = setup('radiesse-memory');
    const component = fixture.componentInstance;

    // Pulsar volver
    component.onRequestBack();
    fixture.detectChanges();

    expect(component['showExitConfirm']()).toBe(true);
    expect(mockSession.leavePlay).not.toHaveBeenCalled();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-game-exit-confirm-dialog')).toBeTruthy();
  });

  it('al confirmar la salida en el diálogo abandona la partida y llama a session.leavePlay()', () => {
    const { fixture, mockSession } = setup('radiesse-memory');
    const component = fixture.componentInstance;

    component.onRequestBack();
    fixture.detectChanges();

    component.onConfirmExit();
    fixture.detectChanges();

    expect(component['showExitConfirm']()).toBe(false);
    expect(mockSession.leavePlay).toHaveBeenCalled();
  });

  it('al cancelar la salida en el diálogo lo oculta y no llama a session.leavePlay()', () => {
    const { fixture, mockSession } = setup('radiesse-memory');
    const component = fixture.componentInstance;

    component.onRequestBack();
    fixture.detectChanges();

    component.onCancelExit();
    fixture.detectChanges();

    expect(component['showExitConfirm']()).toBe(false);
    expect(mockSession.leavePlay).not.toHaveBeenCalled();
  });

  it('si la partida ya terminó con resultado, pulsar volver sale directamente sin diálogo', () => {
    const { fixture, mockSession } = setup('radiesse-memory');
    const component = fixture.componentInstance;

    mockSession.playResult.set('win');
    fixture.detectChanges();

    component.onRequestBack();
    fixture.detectChanges();

    expect(component['showExitConfirm']()).toBe(false);
    expect(mockSession.leavePlay).toHaveBeenCalled();
  });
});

