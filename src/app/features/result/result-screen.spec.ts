import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ResultScreen } from './result-screen';
import { isValidPlayResult } from '../../core/catalog/play-result.model';
import { GameSession } from '../../core/session/game-session';
import { CatalogService } from '../../core/catalog/catalog';

describe('isValidPlayResult', () => {
  it('should return true for valid results', () => {
    expect(isValidPlayResult('win')).toBe(true);
    expect(isValidPlayResult('lose')).toBe(true);
    expect(isValidPlayResult('out-of-lives')).toBe(true);
  });

  it('should return false for unknown values', () => {
    expect(isValidPlayResult('draw')).toBe(false);
    expect(isValidPlayResult('')).toBe(false);
    expect(isValidPlayResult('WIN')).toBe(false);
    expect(isValidPlayResult('nones')).toBe(false);
  });
});

describe('ResultScreen overlay', () => {
  let fixture: ComponentFixture<ResultScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultScreen],
      providers: [
        provideRouter([]),
        {
          provide: GameSession,
          useValue: {
            start: vi.fn(),
            dismissResult: vi.fn(),
            playResult: signal(null),
          },
        },
        {
          provide: CatalogService,
          useValue: {
            getExperienceById: () => ({ id: 'radiesse-memory', brandId: 'radiesse' }),
          },
        },
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

  it('debe renderizar un dialog modal a pantalla completa', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.classList).toContain('fixed');
    expect(dialog.classList).toContain('inset-0');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('¡Ganaste un premio!');
  });

  it('debe animar la entrada del overlay y de la tarjeta', () => {
    const dialog = fixture.nativeElement.querySelector('.result-overlay') as HTMLElement;
    const card = fixture.nativeElement.querySelector('.result-card') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(card).toBeTruthy();
  });

  it('en victoria no muestra «Volver a jugar»', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Volver a jugar');
    expect(fixture.nativeElement.textContent).toContain('Ver más juegos');
  });

  it('en out-of-lives muestra «Volver a jugar»', () => {
    fixture.componentRef.setInput('result', 'out-of-lives');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin más intentos');
    expect(fixture.nativeElement.textContent).toContain('Volver a jugar');
  });
});
