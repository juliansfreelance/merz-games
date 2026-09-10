import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameExitConfirmDialog } from './game-exit-confirm-dialog';
import { MediaPlayer } from '../../core/media/media-player';

describe('GameExitConfirmDialog Component', () => {
  let fixture: ComponentFixture<GameExitConfirmDialog>;
  let component: GameExitConfirmDialog;
  let mockMedia: {
    playSfx: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockMedia = {
      playSfx: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [GameExitConfirmDialog],
      providers: [
        { provide: MediaPlayer, useValue: mockMedia },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameExitConfirmDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse y mostrar los textos por defecto', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('¿ABANDONAR LA PARTIDA?');
    expect(compiled.textContent).toContain('Continuar jugando');
    expect(compiled.textContent).toContain('Sí, salir');
  });

  it('debe personalizar títulos, mensajes y marcas mediante inputs', () => {
    fixture.componentRef.setInput('title', '¿SALIR DE RADIESSE?');
    fixture.componentRef.setInput('message', 'Perderás el juego actual.');
    fixture.componentRef.setInput('confirmLabel', 'Abandonar');
    fixture.componentRef.setInput('cancelLabel', 'Quedarme');
    fixture.componentRef.setInput('brandName', 'Radiesse');
    fixture.componentRef.setInput('gameName', 'Memoria');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('¿SALIR DE RADIESSE?');
    expect(compiled.textContent).toContain('Perderás el juego actual.');
    expect(compiled.textContent).toContain('Abandonar');
    expect(compiled.textContent).toContain('Quedarme');
    expect(compiled.textContent).toContain('Radiesse');
    expect(compiled.textContent).toContain('Memoria');
  });

  it('emite cancelled al pulsar el botón de cancelar', () => {
    const cancelSpy = vi.fn();
    component.cancelled.subscribe(cancelSpy);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    // El botón primario es "Continuar jugando" (cancelar salida)
    const cancelBtn = Array.from(buttons).find((b) => (b as HTMLElement).textContent?.includes('Continuar jugando')) as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();
    cancelBtn.click();

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('emite confirmed al pulsar el botón de confirmación', () => {
    const confirmSpy = vi.fn();
    component.confirmed.subscribe(confirmSpy);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const confirmBtn = Array.from(buttons).find((b) => (b as HTMLElement).textContent?.includes('Sí, salir')) as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    confirmBtn.click();

    expect(confirmSpy).toHaveBeenCalled();
  });

  it('emite cancelled al pulsar el backdrop', () => {
    const cancelSpy = vi.fn();
    component.cancelled.subscribe(cancelSpy);

    const backdrop = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    backdrop.click();

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('renderiza la imagen warning.png con el estilo de pantalla de resultado y sin botón superior derecho', () => {
    const img = fixture.nativeElement.querySelector('img[src$="/content/images/experiences/result/warning.png"]');
    expect(img).toBeTruthy();
    expect(img.classList).toContain('object-contain');

    // No debe existir el botón 'x-mark' en la parte superior derecha
    const closeBtn = fixture.nativeElement.querySelector('button[aria-label="Cerrar y continuar jugando"]');
    expect(closeBtn).toBeNull();
  });

  it('el backdrop posee exactamente el mismo estilo que las pantallas de resultado (ResultScreen)', () => {
    const overlay = fixture.nativeElement.querySelector('.result-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.classList).toContain('result-overlay-enter');
    expect(overlay.classList).toContain('fixed');
    expect(overlay.classList).toContain('inset-0');
    expect(overlay.getAttribute('style')).toContain('background: rgba(3, 7, 18, 0.65)');
    expect(overlay.getAttribute('style')).toContain('backdrop-filter: blur(16px)');
  });
});
