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

  it('debe listar las marcas disponibles', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Radiesse');
    expect(el.textContent).toContain('Ultherapy');
  });

  it('al pulsar una marca regular navega directamente a sus juegos', () => {
    const radiesseBrand = catalog.getBrandById('radiesse');
    expect(radiesseBrand).toBeTruthy();

    component.onBrandClick(radiesseBrand!);
    expect(router.navigate).toHaveBeenCalledWith(['/brands', 'radiesse', 'games']);
  });

  it('al pulsar una marca en desarrollo sin superadmin solicita PIN', () => {
    superadminAuth.lock();
    const devBrand = {
      id: 'dev-brand',
      name: 'Dev Brand',
      version: '0.1.0',
      enabled: true,
      develop: true,
      order: 3,
      image: '',
      logo: '',
    };

    component.onBrandClick(devBrand);
    fixture.detectChanges();

    expect(component['pendingBrandId']()).toBe('dev-brand');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-superadmin-pin-dialog')).toBeTruthy();
  });

  it('al desbloquear el diálogo navega a la marca en desarrollo', () => {
    component['pendingBrandId'].set('dev-brand');
    component['onSuperadminUnlocked']();

    expect(router.navigate).toHaveBeenCalledWith(['/brands', 'dev-brand', 'games']);
    expect(component['pendingBrandId']()).toBeNull();
  });
});
