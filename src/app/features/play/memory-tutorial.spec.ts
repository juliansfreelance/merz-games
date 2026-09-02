import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemoryTutorial } from './memory-tutorial';

describe('MemoryTutorial', () => {
  let fixture: ComponentFixture<MemoryTutorial>;
  let component: MemoryTutorial;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemoryTutorial],
    }).compileComponents();

    fixture = TestBed.createComponent(MemoryTutorial);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tutorialText', 'Toca dos cartas y encuentra la pareja');
    fixture.componentRef.setInput('pairs', 4);
    fixture.componentRef.setInput('backUrl', '/content/images/games/memory/cards/card-back.png');
    fixture.componentRef.setInput('sampleFaceUrl', '/content/images/games/memory/cards/card-01.png');
    fixture.componentRef.setInput('accentColor', '#00E5FF');
    fixture.detectChanges();
  });

  afterEach(() => {
    // Asegurar limpieza de overflow en document.body
    document.body.style.overflow = '';
  });

  it('debe crearse inicialmente oculto hasta que se llame a showTutorial()', () => {
    expect(component).toBeTruthy();
    expect(component.visible()).toBe(false);
    const modalElement = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(modalElement).toBeNull();
  });

  it('showTutorial() debe mostrar el modal a pantalla completa y aplicar bloqueo de scroll', () => {
    component.showTutorial();
    fixture.detectChanges();

    expect(component.visible()).toBe(true);
    const modalElement = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(modalElement).toBeTruthy();
    expect(modalElement.classList).toContain('fixed');
    expect(modalElement.classList).toContain('inset-0');
    expect(modalElement.classList).toContain('z-50');

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('debe explicar con claridad cómo se pierden las vidas en caso de fallo', () => {
    component.showTutorial();
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;
    expect(textContent).toContain('Atención a tus vidas:');
    expect(textContent).toContain('perderás una vida');
  });

  it('debe cerrarse al pulsar el botón «¡Entendido, a jugar!» o «✕» y liberar el scroll', () => {
    let closedEmitted = false;
    component.closed.subscribe(() => {
      closedEmitted = true;
    });

    component.showTutorial();
    fixture.detectChanges();
    expect(component.visible()).toBe(true);

    const closeBtn = fixture.nativeElement.querySelector('button[aria-label="Cerrar instrucciones"]') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
    expect(closedEmitted).toBe(true);
    expect(document.body.style.overflow).toBe('');
  });

  it('NO debe auto-cerrarse solo; permanece abierto hasta acción del usuario', () => {
    vi.useFakeTimers();
    component.showTutorial();
    fixture.detectChanges();
    expect(component.visible()).toBe(true);

    // Avanzar el tiempo 10 segundos
    vi.advanceTimersByTime(10000);
    fixture.detectChanges();

    // Sigue visible porque no hay temporizador de auto-cierre
    expect(component.visible()).toBe(true);
    vi.useRealTimers();
  });
});
