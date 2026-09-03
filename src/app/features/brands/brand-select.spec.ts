import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrandSelect } from './brand-select';
import { CatalogService } from '../../core/catalog/catalog';
import { SuperadminAuthService } from '../admin/superadmin-auth.service';
import { Router } from '@angular/router';
import { MediaPlayer } from '../../core/media/media-player';
import { vi } from 'vitest';

describe('BrandSelect Component', () => {
  let fixture: ComponentFixture<BrandSelect>;
  let component: BrandSelect;
  let catalog: CatalogService;
  let superadminAuth: SuperadminAuthService;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BrandSelect],
      providers: [
        CatalogService,
        SuperadminAuthService,
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
    superadminAuth = TestBed.inject(SuperadminAuthService);
    fixture.detectChanges();
  });

  it('debe listar las marcas disponibles incluyendo las que están en desarrollo', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Radiesse');
    expect(el.textContent).toContain('Ultherapy');
    expect(el.textContent).toContain('Merz');
  });

  it('al pulsar una marca regular navega directamente a sus juegos', () => {
    const radiesseBrand = catalog.getBrandById('radiesse');
    expect(radiesseBrand).toBeTruthy();

    component.onBrandClick(radiesseBrand!);
    expect(router.navigate).toHaveBeenCalledWith(['/brands', 'radiesse', 'games']);
  });

  it('al pulsar una marca en desarrollo (merz) sin superadmin solicita PIN', () => {
    superadminAuth.lock();
    const merzBrand = catalog.getBrandById('merz');
    expect(merzBrand).toBeTruthy();

    component.onBrandClick(merzBrand!);
    fixture.detectChanges();

    expect(component['pendingBrandId']()).toBe('merz');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-superadmin-pin-dialog')).toBeTruthy();
  });

  it('al desbloquear el diálogo navega a la marca en desarrollo', () => {
    component['pendingBrandId'].set('merz');
    component['onSuperadminUnlocked']();

    expect(router.navigate).toHaveBeenCalledWith(['/brands', 'merz', 'games']);
    expect(component['pendingBrandId']()).toBeNull();
  });
});
