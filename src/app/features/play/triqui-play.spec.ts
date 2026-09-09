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
    triquiPlayerSymbol: ReturnType<typeof signal>;
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
      triquiPlayerSymbol: signal(null),
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
    fixture.componentRef.setInput('config', { difficulty: 'easy', firstPlayer: 'patient', playerSymbol: 'X' });
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

  it('al cerrar el tutorial al inicio muestra el aviso de turno y reproduce game-start.mp3 al salir la notificación', () => {
    mockMedia.playSfx.mockClear();
    component['onTutorialClosed']();
    fixture.detectChanges();

    // El aviso de turno debe estar visible inmediatamente al cerrar el tutorial
    expect(component['turnNoticeVisible']()).toBe(true);
    // Pero el SFX de inicio aún NO debe sonar
    expect(mockMedia.playSfx).not.toHaveBeenCalledWith(
      expect.stringContaining('game-start.mp3'),
    );

    // Al iniciar la salida de la notificación (por timeout o clic)
    component['dismissTurnNotice']();
    expect(component['turnNoticeExiting']()).toBe(true);
    // Ahora sí se reproduce game-start.mp3
    expect(mockMedia.playSfx).toHaveBeenCalledWith(
      expect.stringContaining('game-start.mp3'),
    );
  });

  it('al cerrar el tutorial en una partida ya iniciada reproduce game-start.mp3 de inmediato', () => {
    mockMedia.playSfx.mockClear();
    // Simulamos que el tablero ya tiene una marca
    component['engine']()?.place(0);

    component['onTutorialClosed']();
    expect(mockMedia.playSfx).toHaveBeenCalledWith(
      expect.stringContaining('game-start.mp3'),
    );
    expect(component['turnNoticeVisible']()).toBe(false);
  });

  it('personaliza el aviso de turno desde input turnNotice incluyendo duración y botón', () => {
    fixture.componentRef.setInput('turnNotice', {
      durationSeconds: 15,
      buttonText: 'Continuar',
      player: {
        title: '¡A JUGAR!',
        message: 'Empiezas con {asset}. ¡Adelante!',
      },
      ai: {
        title: 'TURNO RIVAL',
        message: 'Rival juega con {asset}.',
      },
    });
    fixture.detectChanges();

    expect(component['turnNoticeTitle']()).toBe('¡A JUGAR!');
    expect(component['turnNoticeMessageHtml']()).toContain('Empiezas con <img');
    expect(component['turnNoticeDurationSec']()).toBe(15);
    expect(component['turnNoticeButtonText']()).toBe('Continuar');
  });

  it('usa valores por defecto (30s y ¡Entendido!) si no están configurados', () => {
    fixture.componentRef.setInput('experienceId', 'test-triqui-no-notice');
    fixture.componentRef.setInput('turnNotice', undefined);
    fixture.detectChanges();

    expect(component['turnNoticeDurationSec']()).toBe(30);
    expect(component['turnNoticeButtonText']()).toBe('¡Entendido!');
  });

  it('el botón con icono x-mark en la tarjeta descarta el aviso de turno', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    component['turnNoticeVisible'].set(true);
    component['turnNoticeExiting'].set(false);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('.turn-notice-glass button[aria-label="Cerrar aviso"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();

    mockMedia.playSfx.mockClear();
    btn.click();
    fixture.detectChanges();

    expect(component['turnNoticeExiting']()).toBe(true);
    expect(mockMedia.playSfx).toHaveBeenCalledWith(expect.stringContaining('game-start.mp3'));
  });

  it('mientras el aviso de turno está visible no permite clicks en las celdas', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    component['turnNoticeVisible'].set(true);
    fixture.detectChanges();

    const cells = fixture.nativeElement.querySelectorAll('[role="gridcell"]') as NodeListOf<HTMLButtonElement>;
    cells[4].dispatchEvent(new PointerEvent('pointerup'));
    fixture.detectChanges();

    // No debe haber colocado ficha
    expect(component.board()[4]).toBeNull();
  });

  it('el aviso de turno se posiciona de forma absoluta dentro del board-slot con esquinas redondeadas', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    component['turnNoticeVisible'].set(true);
    fixture.detectChanges();

    const notice = fixture.nativeElement.querySelector('.turn-notice') as HTMLElement;
    expect(notice).toBeTruthy();
    expect(notice.classList).toContain('absolute');
    expect(notice.classList).toContain('inset-0');
    expect(notice.classList).toContain('rounded-3xl');
    expect(notice.classList).not.toContain('fixed');
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

  it('resuelve playerSymbol = random y asigna activePlayerMark como X u O', () => {
    mockSettings.triquiPlayerSymbol.set('random');
    expect(component.resolvedPlayerSymbol()).toBe('random');
    expect(['X', 'O']).toContain(component.activePlayerMark());
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
