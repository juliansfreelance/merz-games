import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  TriquiPlay,
  getRandomAiThinkingDelay,
  AI_THINKING_MIN_DELAY_MS,
  AI_THINKING_MAX_DELAY_MS,
} from './triqui-play';
import { GameSession, TriquiTurnInfo } from '../../core/session/game-session';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { MediaPlayer } from '../../core/media/media-player';

describe('TriquiPlay Component', () => {
  let fixture: ComponentFixture<TriquiPlay>;
  let component: TriquiPlay;
  let mockSession: {
    round: ReturnType<typeof signal>;
    sessionRound: ReturnType<typeof signal>;
    remainingLives: ReturnType<typeof signal>;
    tutorialRequested: ReturnType<typeof signal>;
    autoShowTutorial: ReturnType<typeof signal>;
    markTutorialShown: ReturnType<typeof vi.fn>;
    triquiTurn: ReturnType<typeof signal<TriquiTurnInfo | null>>;
    setTriquiTurn: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    loseLife: ReturnType<typeof vi.fn>;
    announce: ReturnType<typeof vi.fn>;
  };
  let mockSettings: {
    triquiDifficulty: ReturnType<typeof signal>;
    triquiFirstPlayer: ReturnType<typeof signal>;
  };
  let mockMedia: {
    preload: ReturnType<typeof vi.fn>;
    playSfx: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockSession = {
      round: signal(1),
      sessionRound: signal(1),
      remainingLives: signal(3),
      tutorialRequested: signal(0),
      autoShowTutorial: signal(true),
      markTutorialShown: vi.fn(() => mockSession.autoShowTutorial.set(false)),
      triquiTurn: signal<TriquiTurnInfo | null>(null),
      setTriquiTurn: vi.fn(),
      complete: vi.fn(),
      loseLife: vi.fn().mockReturnValue(2),
      announce: vi.fn(),
    };

    mockSettings = {
      triquiDifficulty: signal(null),
      triquiFirstPlayer: signal(null),
    };

    mockMedia = {
      preload: vi.fn(),
      playSfx: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TriquiPlay],
      providers: [
        { provide: GameSession, useValue: mockSession },
        { provide: KioskSettings, useValue: mockSettings },
        { provide: MediaPlayer, useValue: mockMedia },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TriquiPlay);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('experienceId', 'radiesse-triqui');
    fixture.componentRef.setInput('brandId', 'radiesse');
    fixture.componentRef.setInput('gameId', 'triqui');
    fixture.componentRef.setInput('remainingLives', 3);
    fixture.componentRef.setInput('theme', { accentColor: '#00E5FF' });
    fixture.componentRef.setInput('assets', {});
    fixture.componentRef.setInput('config', { difficulty: 'easy', firstPlayer: 'patient' });
    fixture.componentRef.setInput('blurTint', '#00E5FF');
    fixture.componentRef.setInput('gameConfig', { difficulty: 'medium', firstPlayer: 'patient' });
    fixture.componentRef.setInput('gameAssets', {});

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('debe crearse y aceptar blurTint como input', () => {
    expect(component).toBeTruthy();
    expect(component.blurTint()).toBe('#00E5FF');
  });

  it('debe renderizar la rejilla con 9 celdas táctiles', async () => {
    // Esperar a que la precarga termine
    await fixture.whenStable();
    fixture.detectChanges();

    const cells = fixture.nativeElement.querySelectorAll('[role="gridcell"]');
    expect(cells.length).toBe(9);
  });

  it('al pulsar una celda libre coloca la marca y reproduce sfx', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const cells = fixture.nativeElement.querySelectorAll('[role="gridcell"]') as NodeListOf<HTMLButtonElement>;
    cells[4].dispatchEvent(new PointerEvent('pointerup'));
    fixture.detectChanges();

    expect(mockMedia.playSfx).toHaveBeenCalledWith(expect.stringContaining('put.mp3'));
    expect(component.board()[4]).toBe('X');
  });

  it('al cerrar el tutorial reproduce game-start.mp3', () => {
    mockMedia.playSfx.mockClear();
    component['onTutorialClosed']();
    expect(mockMedia.playSfx).toHaveBeenCalledWith(
      expect.stringContaining('game-start.mp3'),
    );
  });

  it('resuelve la dificultad desde config si no hay override en kiosco', () => {
    expect(component.resolvedDifficulty()).toBe('easy');
  });

  it('override de kiosco tiene precedencia sobre config', () => {
    mockSettings.triquiDifficulty.set('hard');
    expect(component.resolvedDifficulty()).toBe('hard');
  });

  it('sincroniza el estado del turno con GameSession para el cromado exterior', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockSession.setTriquiTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'player',
      }),
    );
  });
});

describe('getRandomAiThinkingDelay', () => {
  it('genera un retardo dentro del rango configurado [700, 1400]', () => {
    for (let i = 0; i < 50; i++) {
      const delay = getRandomAiThinkingDelay();
      expect(delay).toBeGreaterThanOrEqual(AI_THINKING_MIN_DELAY_MS);
      expect(delay).toBeLessThanOrEqual(AI_THINKING_MAX_DELAY_MS);
    }
  });

  it('respeta RNG inyectable para determinismo', () => {
    // Con rng = () => 0 retorna exactamente el mínimo
    expect(getRandomAiThinkingDelay(700, 1400, () => 0)).toBe(700);
    // Con rng = () => 0.99999 retorna exactamente el máximo
    expect(getRandomAiThinkingDelay(700, 1400, () => 0.99999)).toBe(1400);
    // Con rng = () => 0.5 retorna el valor medio
    expect(getRandomAiThinkingDelay(700, 1400, () => 0.5)).toBe(1050);
  });
});
