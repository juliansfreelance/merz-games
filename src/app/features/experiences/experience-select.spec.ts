import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExperienceSelect } from './experience-select';
import { CatalogService } from '../../core/catalog/catalog';
import { ActivatedRoute, Router } from '@angular/router';
import { MediaPlayer } from '../../core/media/media-player';
import { of } from 'rxjs';
import { vi } from 'vitest';

describe('ExperienceSelect Component', () => {
  let fixture: ComponentFixture<ExperienceSelect>;
  let component: ExperienceSelect;
  let catalog: CatalogService;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ExperienceSelect],
      providers: [
        CatalogService,
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
    fixture.detectChanges();
  });

  it('debe crearse y listar las experiencias de la marca', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Encuentra la Pareja');
    expect(el.textContent).toContain('Triqui');
  });

  it('al pulsar una experiencia navega directamente a /play', () => {
    const exp = catalog.experiences().find((e) => e.id === 'radiesse-memory');
    expect(exp).toBeTruthy();

    component.onExperienceClick(exp!);
    expect(router.navigate).toHaveBeenCalledWith(['/play', 'radiesse-memory']);
  });

  it('no muestra diálogo de PIN al seleccionar una experiencia', () => {
    const exp = catalog.experiences().find((e) => e.id === 'radiesse-triqui');
    expect(exp).toBeTruthy();

    component.onExperienceClick(exp!);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-superadmin-pin-dialog')).toBeFalsy();
    expect(router.navigate).toHaveBeenCalledWith(['/play', 'radiesse-triqui']);
  });
});
