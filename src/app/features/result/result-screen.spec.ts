import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ResultScreen } from './result-screen';
import { isValidPlayResult } from '../../core/catalog/play-result.model';
import { GameSession } from '../../core/session/game-session';
import { CatalogService } from '../../core/catalog/catalog';
import { MediaPlayer } from '../../core/media/media-player';

describe('isValidPlayResult', () => {
  it('should return true for valid results', () => {
    expect(isValidPlayResult('win')).toBe(true);
    expect(isValidPlayResult('lose')).toBe(true);
    expect(isValidPlayResult('out-of-lives')).toBe(true);
    expect(isValidPlayResult('draw')).toBe(true);
  });

  it('should return false for unknown values', () => {
    expect(isValidPlayResult('tie')).toBe(false);
    expect(isValidPlayResult('')).toBe(false);
    expect(isValidPlayResult('WIN')).toBe(false);
    expect(isValidPlayResult('nones')).toBe(false);
  });
});

describe('ResultScreen overlay', () => {
  let fixture: ComponentFixture<ResultScreen>;
  let mockSession: {
    start: ReturnType<typeof vi.fn>;
    nextRound: ReturnType<typeof vi.fn>;
    dismissResult: ReturnType<typeof vi.fn>;
    leavePlay: ReturnType<typeof vi.fn>;
    playResult: ReturnType<typeof signal>;
    remainingLives: ReturnType<typeof signal>;
  };
  let playSfx: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockSession = {
      start: vi.fn(),
      nextRound: vi.fn(),
      dismissResult: vi.fn(),
      leavePlay: vi.fn(),
      playResult: signal(null),
      remainingLives: signal(2),
    };
    playSfx = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ResultScreen],
      providers: [
        provideRouter([]),
        {
          provide: GameSession,
          useValue: mockSession,
        },
        {
          provide: CatalogService,
          useValue: {
            getExperienceById: () => ({ id: 'radiesse-memory', brandId: 'radiesse' }),
          },
        },
        { provide: MediaPlayer, useValue: { playSfx } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResultScreen);
    fixture.componentRef.setInput('result', 'win');
    fixture.componentRef.setInput('experienceId', 'radiesse-memory');
    fixture.componentRef.setInput('brandName', 'Radiesse');
    fixture.componentRef.setInput('gameName', 'Encuentra la Pareja');
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('debe renderizar un dialog modal a pantalla completa con logo e imagen de resultado', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.classList).toContain('fixed');
    expect(dialog.classList).toContain('inset-0');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('¡GANASTE!');
    const logoImg = fixture.nativeElement.querySelector('img[src="/content/images/MerzAestheticsLogo.svg"]');
    expect(logoImg).toBeTruthy();
    const resultImg = fixture.nativeElement.querySelector('img[src="/content/images/experiences/result/win.png"]');
    expect(resultImg).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Beta');
  });

  it('muestra badge Beta junto al nombre del juego cuando develop es true', () => {
    fixture.componentRef.setInput('develop', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Encuentra la Pareja');
    expect(fixture.nativeElement.textContent).toContain('Beta');
  });

  it('debe animar la entrada del overlay y de la tarjeta', () => {
    const dialog = fixture.nativeElement.querySelector('.result-overlay') as HTMLElement;
    const card = fixture.nativeElement.querySelector('.result-card') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(card).toBeTruthy();
  });

  it('en victoria no muestra «Volver a jugar» ni «Siguiente ronda»', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Volver a jugar');
    expect(fixture.nativeElement.textContent).not.toContain('Siguiente ronda');
    expect(fixture.nativeElement.textContent).toContain('Ver más juegos');
  });

  it('reproduce game-win.mp3 al aparecer el overlay de victoria', async () => {
    await fixture.whenStable();
    expect(playSfx).toHaveBeenCalledWith(expect.stringContaining('game-win.mp3'));
  });

  it('en out-of-lives muestra «Volver a jugar» y llama a start()', () => {
    fixture.componentRef.setInput('result', 'out-of-lives');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SIN MÁS INTENTOS');
    expect(fixture.nativeElement.textContent).toContain('Volver a jugar');

    const replayBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.includes('Volver a jugar')) as HTMLButtonElement;
    replayBtn.click();
    expect(mockSession.start).toHaveBeenCalledWith('radiesse-memory');
  });

  it('en draw muestra únicamente el botón «Siguiente ronda» y oculta las salidas del flujo', () => {
    mockSession.remainingLives.set(2);
    fixture.componentRef.setInput('result', 'draw');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('¡EMPATE!');
    expect(fixture.nativeElement.textContent).toContain('Te quedan 2 oportunidades.');
    expect(fixture.nativeElement.textContent).toContain('Siguiente ronda');
    expect(fixture.nativeElement.textContent).not.toContain('Volver a jugar');
    expect(fixture.nativeElement.textContent).not.toContain('Ver más juegos');
    expect(fixture.nativeElement.textContent).not.toContain('Cambiar de marca');

    const nextRoundBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.includes('Siguiente ronda')) as HTMLButtonElement;
    nextRoundBtn.click();
    expect(mockSession.nextRound).toHaveBeenCalled();
  });

  it('en lose muestra únicamente el botón «Siguiente ronda» y oculta las salidas del flujo', () => {
    mockSession.remainingLives.set(1);
    fixture.componentRef.setInput('result', 'lose');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('PERDISTE ESTA RONDA');
    expect(fixture.nativeElement.textContent).toContain('Te queda 1 oportunidad.');
    expect(fixture.nativeElement.textContent).toContain('Siguiente ronda');
    expect(fixture.nativeElement.textContent).not.toContain('Volver a jugar');
    expect(fixture.nativeElement.textContent).not.toContain('Ver más juegos');
    expect(fixture.nativeElement.textContent).not.toContain('Cambiar de marca');

    const nextRoundBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.includes('Siguiente ronda')) as HTMLButtonElement;
    nextRoundBtn.click();
    expect(mockSession.nextRound).toHaveBeenCalled();
  });
});
