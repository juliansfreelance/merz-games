import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogCard } from './catalog-card';
import { MediaPlayer } from '../../core/media/media-player';
import { UI_SFX } from './ui-sfx';

describe('CatalogCard', () => {
  let fixture: ComponentFixture<CatalogCard>;
  let component: CatalogCard;
  let playSfx: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    playSfx = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CatalogCard],
      providers: [{ provide: MediaPlayer, useValue: { playSfx } }],
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogCard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Juego Memoria');
    fixture.componentRef.setInput('description', 'Encuentra las parejas antes de que se acabe el tiempo.');
    fixture.componentRef.setInput('actionLabel', 'Jugar');
    fixture.detectChanges();
  });

  it('debe crearse y mostrar título, descripción y botón de acción', () => {
    expect(component).toBeTruthy();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('Juego Memoria');
    expect(host.textContent).toContain('Encuentra las parejas');
    expect(host.textContent).toContain('Jugar');
  });

  it('debe incluir la capa falsa de backdrop con textura', () => {
    const host: HTMLElement = fixture.nativeElement;
    const texture = host.querySelector(
      'img[src="/content/images/texture.jpg"][aria-hidden="true"]',
    ) as HTMLImageElement | null;
    expect(texture).toBeTruthy();
  });

  it('debe emitir selected al hacer pointerup en el botón CTA', () => {
    let emitted = false;
    component.selected.subscribe(() => {
      emitted = true;
    });

    const buttonElement = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    buttonElement.dispatchEvent(new PointerEvent('pointerup'));
    expect(emitted).toBe(true);
    expect(playSfx).toHaveBeenCalledWith(UI_SFX.select);
  });

  it('no debe emitir selected al hacer pointerup en el card fuera del botón', () => {
    let emitted = false;
    component.selected.subscribe(() => {
      emitted = true;
    });

    const card = fixture.nativeElement.querySelector('.group') as HTMLElement;
    card.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(emitted).toBe(false);
    expect(playSfx).not.toHaveBeenCalled();
  });
});
