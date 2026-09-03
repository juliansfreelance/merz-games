import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameChrome } from './game-chrome';

describe('GameChrome', () => {
  let fixture: ComponentFixture<GameChrome>;
  let component: GameChrome;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameChrome],
    }).compileComponents();

    fixture = TestBed.createComponent(GameChrome);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('gameTitle', 'Memoria Radiesse');
    fixture.componentRef.setInput('brandName', 'Radiesse');
    fixture.componentRef.setInput('remainingLives', 3);
    fixture.detectChanges();
  });

  it('debe crearse y renderizar título y marca', () => {
    expect(component).toBeTruthy();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('Memoria Radiesse');
    expect(host.textContent).toContain('Radiesse');
  });

  it('debe renderizar el indicador de vidas con 3 corazones para 3 vidas', () => {
    const host: HTMLElement = fixture.nativeElement;
    const indicator = host.querySelector('app-lives-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator?.querySelectorAll('svg').length).toBe(3);
  });

  it('debe reflejar 1 vida restante en el indicador', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('remainingLives', 1);
    fixture.detectChanges();
    vi.advanceTimersByTime(500);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const indicator = host.querySelector('app-lives-indicator');
    expect(indicator?.querySelectorAll('svg').length).toBe(1);
    vi.useRealTimers();
  });

  it('debe renderizar un solo HUD de vidas y el botón de ayuda fuera de su contenedor', () => {
    const host: HTMLElement = fixture.nativeElement;
    const livesStatuses = host.querySelectorAll('[role="status"]');
    expect(livesStatuses.length).toBe(1);

    const helpButtons = host.querySelectorAll('button[aria-label="Ver instrucciones del juego"]');
    expect(helpButtons.length).toBe(1);

    const helpButton = helpButtons[0] as HTMLButtonElement;
    const livesContainer = livesStatuses[0].closest('.rounded-2xl');
    expect(livesContainer).toBeTruthy();
    expect(livesContainer?.contains(helpButton)).toBe(false);
    expect(helpButton.parentElement).toBe(livesContainer?.parentElement);
  });

  it('muestra el contador de ronda entre vidas y el botón de ayuda', () => {
    fixture.componentRef.setInput('roundNumber', 4);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const bar = host.querySelector('.ml-auto') as HTMLElement;
    expect(bar).toBeTruthy();
    const children = Array.from(bar.children) as HTMLElement[];
    expect(children.length).toBe(3);
    expect(children[1].textContent).toContain('Ronda');
    expect(children[1].textContent).toContain('4');
    expect(children[1].getAttribute('aria-label')).toBe('Ronda 4');
    expect(children[2].getAttribute('aria-label')).toBe('Ver instrucciones del juego');
  });

  it('debe renderizar el botón de ayuda «?» y emitir evento help al pulsarlo', () => {
    let helpEmitted = false;
    component.help.subscribe(() => {
      helpEmitted = true;
    });

    const host: HTMLElement = fixture.nativeElement;
    const helpButton = host.querySelector('button[aria-label="Ver instrucciones del juego"]') as HTMLButtonElement;
    expect(helpButton).toBeTruthy();
    expect(helpButton.textContent?.trim()).toBe('?');

    helpButton.click();
    expect(helpEmitted).toBe(true);
  });
});
