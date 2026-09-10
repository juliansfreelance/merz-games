import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrandSelect } from './brand-select';
import { CatalogService } from '../../core/catalog/catalog';
import { Router } from '@angular/router';
import { MediaPlayer } from '../../core/media/media-player';
import { vi } from 'vitest';

describe('BrandSelect Component', () => {
  let fixture: ComponentFixture<BrandSelect>;
  let component: BrandSelect;
  let catalog: CatalogService;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BrandSelect],
      providers: [
        CatalogService,
        { provide: Router, useValue: router },
        {
          provide: MediaPlayer,
          useValue: {
            playSfx: vi.fn(),
            play: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrandSelect);
    component = fixture.componentInstance;
    catalog = TestBed.inject(CatalogService);
    fixture.detectChanges();
  });

  it('debe listar las marcas disponibles sin contenido beta por defecto', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Radiesse');
    expect(el.textContent).toContain('Ultherapy');
    expect(catalog.brands().some((b) => !!b.develop)).toBe(false);
  });

  it('al pulsar una marca navega directamente a sus juegos', () => {
    const radiesseBrand = catalog.getBrandById('radiesse');
    expect(radiesseBrand).toBeTruthy();

    component.onBrandClick(radiesseBrand!);
    expect(router.navigate).toHaveBeenCalledWith(['/brands', 'radiesse', 'games']);
  });

  it('con developMode activo incluye marcas beta en el catálogo visible', () => {
    catalog.setDevelopMode(true);
    fixture.detectChanges();

    expect(catalog.brands().some((b) => b.id === 'belotero' && !!b.develop)).toBe(true);
  });

  it('scrollea la página completa y no recorta el footer', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList.contains('overflow-y-auto')).toBe(true);
    expect(el.classList.contains('overflow-hidden')).toBe(false);

    const cover = Array.from(el.querySelectorAll<HTMLElement>('div')).find((node) =>
      node.classList.contains('min-h-[55vh]'),
    );
    expect(cover).toBeTruthy();
    expect(cover!.classList.contains('overflow-y-auto')).toBe(false);
    expect(el.querySelector('app-kiosk-disclaimer')).toBeTruthy();
  });
});
