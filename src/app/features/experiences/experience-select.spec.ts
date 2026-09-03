import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExperienceSelect } from './experience-select';
import { CatalogService } from '../../core/catalog/catalog';
import { SuperadminAuthService } from '../admin/superadmin-auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MediaPlayer } from '../../core/media/media-player';
import { of } from 'rxjs';
import { vi } from 'vitest';

describe('ExperienceSelect Component', () => {
  let fixture: ComponentFixture<ExperienceSelect>;
  let component: ExperienceSelect;
  let catalog: CatalogService;
  let superadminAuth: SuperadminAuthService;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ExperienceSelect],
      providers: [
        CatalogService,
        SuperadminAuthService,
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(new Map([['brandId', 'radiesse']])),
          },
        },
        {
          provide: MediaPlayer,
          useValue: {
            playSfx: vi.fn(),
            play: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperienceSelect);
    component = fixture.componentInstance;
    catalog = TestBed.inject(CatalogService);
    superadminAuth = TestBed.inject(SuperadminAuthService);
    fixture.detectChanges();
  });

  it('debe crearse y listar las experiencias de la marca', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Encuentra la Pareja');
    expect(el.textContent).toContain('Triqui');
  });

  it('al pulsar una experiencia regular navega directamente a /play', () => {
    const exp = catalog.experiences().find((e) => e.id === 'radiesse-memory');
    expect(exp).toBeTruthy();

    component.onExperienceClick(exp!, false);
    expect(router.navigate).toHaveBeenCalledWith(['/play', 'radiesse-memory']);
  });

  it('al pulsar una experiencia en desarrollo (Triqui) solicita superadmin PIN', () => {
    superadminAuth.lock();
    const exp = catalog.experiences().find((e) => e.id === 'radiesse-triqui');
    expect(exp).toBeTruthy();

    component.onExperienceClick(exp!, true);
    fixture.detectChanges();

    expect(component['pendingExperienceId']()).toBe('radiesse-triqui');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-superadmin-pin-dialog')).toBeTruthy();
  });

  it('al desbloquear el diálogo navega a la experiencia en desarrollo', () => {
    component['pendingExperienceId'].set('radiesse-triqui');
    component['onSuperadminUnlocked']();

    expect(router.navigate).toHaveBeenCalledWith(['/play', 'radiesse-triqui']);
    expect(component['pendingExperienceId']()).toBeNull();
  });
});
