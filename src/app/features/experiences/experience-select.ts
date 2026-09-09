import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog';
import { GameExperience } from '../../core/catalog/game-experience.model';
import { KioskButton } from '../shared/kiosk-button';
import { KioskCard } from '../shared/kiosk-card';
import { CatalogCard } from '../shared/catalog-card';
import { CoverFlow } from '../shared/cover-flow';
import { KioskDisclaimer } from '../shared/kiosk-disclaimer';
import { HeroIcon } from '../shared/hero-icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

/**
 * Selector de experiencias con Cover Flow 3D horizontal (sin scroll vertical de cards).
 * El contenido beta solo aparece cuando `app.developMode` está activo.
 */
@Component({
  selector: 'app-experience-select',
  imports: [
    KioskButton,
    KioskCard,
    CatalogCard,
    CoverFlow,
    KioskDisclaimer,
    HeroIcon,
  ],
  host: {
    class: 'flex flex-col flex-1 w-full h-full min-h-0 overflow-hidden',
  },
  template: `
    <div class="flex flex-col h-full min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 kiosk:py-10 text-white select-none gap-4">

      <!-- Encabezado con marca activa -->
      <header class="text-center space-y-2 sm:space-y-3 kiosk:space-y-6 shrink-0 pt-1">
        <div class="inline-flex flex-col items-center justify-center gap-3 sm:gap-4 kiosk:gap-5">
          <span class="w-full flex items-center justify-center px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm kiosk:text-base font-extrabold font-['Montserrat'] tracking-[0.35em] sm:tracking-[0.4em] uppercase bg-white/10 text-white border border-white/20 backdrop-blur-md shadow-md select-none">
            HOY TU PIEL
          </span>
          <h1 class="text-xl sm:text-2xl lg:text-3xl kiosk:text-4xl kiosk-tall:text-5xl font-extrabold font-['Montserrat'] uppercase text-white tracking-tight whitespace-nowrap">
            TAMBIÉN GANA
          </h1>
        </div>
        <p class="text-neutral-300 text-xs sm:text-base lg:text-lg kiosk:text-2xl max-w-md sm:max-w-xl mx-auto leading-relaxed">
          Selecciona una experiencia interactiva para comenzar
        </p>
      </header>

      <!-- Zona Cover Flow -->
      <div class="flex-1 min-h-[55vh] w-full my-1 sm:my-2 kiosk:my-4">
        @if (experiences().length === 0) {
          <div class="w-full h-full flex items-center justify-center px-4">
            <app-kiosk-card class="w-full max-w-md">
              <div class="text-center py-6 space-y-2">
                <p class="text-neutral-200 font-semibold text-lg kiosk:text-2xl">Sin juegos disponibles</p>
                <p class="text-neutral-400 text-sm kiosk:text-base">
                  Esta marca no tiene experiencias activas en este momento.
                </p>
              </div>
            </app-kiosk-card>
          </div>
        } @else {
          <app-cover-flow
            [items]="experiences()"
            [itemTemplate]="gameCardTemplate"
            [initialIndex]="catalog.coverConfig().initialIndex"
            [stackSpacing]="catalog.coverConfig().stackSpacing"
            [centerGap]="catalog.coverConfig().centerGap"
            [rotation]="catalog.coverConfig().rotation"
            [enableReflection]="catalog.coverConfig().enableReflection"
            [enableClickToSnap]="catalog.coverConfig().enableClickToSnap"
            [enableScroll]="catalog.coverConfig().enableScroll"
            [enableAudio]="catalog.coverConfig().enableAudio"
            [reduceMotion]="catalog.coverConfig().reduceMotion"
            [scrollThreshold]="catalog.coverConfig().scrollThreshold"
            ariaLabel="Selector de juegos"
          />
        }
      </div>

      <ng-template #gameCardTemplate let-exp let-active="active">
        @let card = catalog.cardForExperience(exp);
        <app-catalog-card
          [title]="card.title"
          [description]="card.description"
          [image]="card.image"
          badge="Juego"
          actionLabel="Jugar"
          [ariaLabel]="card.ariaLabel"
          [develop]="card.develop ?? false"
          [selectable]="active"
          [fillContainer]="true"
          (selected)="onExperienceClick(exp)"
        />
      </ng-template>

      <!-- Sticky Footer unificado con logo, botón volver y disclaimers -->
      <app-kiosk-disclaimer
        class="shrink-0"
        [logo]="brandLogo()"
        [logoAlt]="brandName()"
        [brandDisclaimer]="brandDisclaimer()"
      >
        <div class="w-full max-w-xs sm:max-w-md kiosk:max-w-lg">
          <app-kiosk-button variant="ghost" (click)="goBack()">
            <app-hero-icon name="arrow-left" />
            Volver a marcas
          </app-kiosk-button>
        </div>
      </app-kiosk-disclaimer>

    </div>
  `,
})
export class ExperienceSelect {
  private readonly route = inject(ActivatedRoute);
  protected readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);

  private readonly brandId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('brandId') ?? '')),
    { initialValue: '' },
  );

  protected readonly experiences = computed(() =>
    this.catalog.experiencesForBrand(this.brandId()),
  );

  protected readonly brandLogo = computed(() =>
    this.catalog.getBrandById(this.brandId())?.logo,
  );

  protected readonly brandDisclaimer = computed(() =>
    this.catalog.getBrandById(this.brandId())?.disclaimer,
  );

  constructor() {
    effect(() => {
      const id = this.brandId();
      if (id) {
        this.catalog.setSelectedBrand(id);
      }
    });
  }

  protected brandName(): string {
    return this.catalog.getBrandById(this.brandId())?.name ?? this.brandId();
  }

  onExperienceClick(exp: GameExperience): void {
    this.selectExperience(exp.id);
  }

  selectExperience(experienceId: string): void {
    this.router.navigate(['/play', experienceId]);
  }

  goBack(): void {
    this.router.navigate(['/brands']);
  }
}
