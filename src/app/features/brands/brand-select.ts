import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog';
import { Brand } from '../../core/catalog/brand.model';
import { PANEL_REDUCE_MOTION_COVER_SPACING } from '../../core/catalog/content-manifest.model';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { ImageCacheService, IMAGE_CACHE_CRITICAL_URLS } from '../../core/media/image-cache.service';
import { KioskButton } from '../shared/kiosk-button';
import { KioskCard } from '../shared/kiosk-card';
import { CatalogCard } from '../shared/catalog-card';
import { CoverFlow } from '../shared/cover-flow';
import { KioskDisclaimer } from '../shared/kiosk-disclaimer';
import { HeroIcon } from '../shared/hero-icon';

/**
 * Selector de marcas con Cover Flow 3D horizontal.
 * El host scrollea la página completa; el footer viaja con el contenido.
 * El contenido beta solo aparece cuando `app.developMode` está activo.
 */
@Component({
  selector: 'app-brand-select',
  imports: [
    KioskButton,
    KioskCard,
    CatalogCard,
    CoverFlow,
    KioskDisclaimer,
    HeroIcon,
  ],
  host: {
    class: 'flex flex-col flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain',
    style: 'touch-action: pan-y; -webkit-overflow-scrolling: touch;',
  },
  template: `
    <div class="flex flex-col flex-1 min-h-full w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 kiosk:py-10 text-white select-none gap-4">

      <!-- Encabezado con estética de agencia -->
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
          Selecciona la marca con la que deseas interactuar y jugar
        </p>
      </header>

      <!-- Zona Cover Flow -->
      <div class="flex-1 min-h-[55vh] w-full my-1 sm:my-2 kiosk:my-4">
        @if (catalog.brands().length === 0) {
          <div class="w-full h-full flex items-center justify-center px-4">
            <app-kiosk-card class="w-full max-w-md">
              <p class="text-center text-neutral-400 py-6">
                No hay marcas disponibles en este momento.
              </p>
            </app-kiosk-card>
          </div>
        } @else {
          <app-cover-flow
            [items]="catalog.brands()"
            [itemTemplate]="brandCardTemplate"
            [initialIndex]="catalog.coverConfig().initialIndex"
            [stackSpacing]="coverStackSpacing()"
            [centerGap]="coverCenterGap()"
            [rotation]="catalog.coverConfig().rotation"
            [enableReflection]="catalog.coverConfig().enableReflection"
            [enableClickToSnap]="catalog.coverConfig().enableClickToSnap"
            [enableScroll]="catalog.coverConfig().enableScroll"
            [enableAudio]="catalog.coverConfig().enableAudio"
            [reduceMotion]="coverReduceMotion()"
            [scrollThreshold]="catalog.coverConfig().scrollThreshold"
            ariaLabel="Selector de marcas"
          />
        }
      </div>

      <ng-template #brandCardTemplate let-brand let-active="active">
        <app-catalog-card
          [title]="brand.name"
          [description]="brand.description ?? 'Toca para descubrir los juegos disponibles.'"
          [image]="brand.image"
          badge="Marca"
          actionLabel="Seleccionar"
          [ariaLabel]="'Jugar con ' + brand.name"
          [develop]="brand.develop ?? false"
          [selectable]="active"
          [fillContainer]="true"
          (selected)="onBrandClick(brand)"
        />
      </ng-template>

      <!-- Footer unificado con botón volver y disclaimers -->
      <app-kiosk-disclaimer>
        <div class="w-full max-w-xs sm:max-w-md kiosk:max-w-lg">
          <app-kiosk-button variant="ghost" (click)="goBack()">
            <app-hero-icon name="arrow-left" />
            Volver al inicio
          </app-kiosk-button>
        </div>
      </app-kiosk-disclaimer>

    </div>
  `,
})
export class BrandSelect {
  protected readonly catalog = inject(CatalogService);
  private readonly settings = inject(KioskSettings);
  private readonly imageCache = inject(ImageCacheService);
  private readonly router = inject(Router);

  /** Panel gana sobre el manifest: reduceMotion ON si cualquiera lo pide. */
  protected readonly coverReduceMotion = computed(
    () => this.settings.coverReduceMotion() || this.catalog.coverConfig().reduceMotion,
  );

  /** Con reduceMotion del panel: espaciado más compacto para el layout plano. */
  protected readonly coverStackSpacing = computed(() =>
    this.settings.coverReduceMotion()
      ? PANEL_REDUCE_MOTION_COVER_SPACING.stackSpacing
      : this.catalog.coverConfig().stackSpacing,
  );

  protected readonly coverCenterGap = computed(() =>
    this.settings.coverReduceMotion()
      ? PANEL_REDUCE_MOTION_COVER_SPACING.centerGap
      : this.catalog.coverConfig().centerGap,
  );

  constructor() {
    this.catalog.clearSelectedBrand();
  }

  onBrandClick(brand: Brand): void {
    this.selectBrand(brand.id);
  }

  selectBrand(brandId: string): void {
    this.catalog.setSelectedBrand(brandId);
    void this.warmBrandCache(brandId);
    this.router.navigate(['/brands', brandId, 'games']);
  }

  goBack(): void {
    this.router.navigate(['/welcome']);
  }

  private async warmBrandCache(brandId: string): Promise<void> {
    const brand = this.catalog.getBrandById(brandId);
    const brandUrls = [brand?.logo, brand?.image].filter((u): u is string => !!u);
    const expUrls = this.catalog.experiencesForBrand(brandId).flatMap((exp) => {
      const urls: string[] = [];
      if (exp.image) urls.push(exp.image);
      if (exp.theme?.backgroundImage) urls.push(exp.theme.backgroundImage);
      if (exp.assets) {
        for (const value of Object.values(exp.assets)) {
          if (typeof value === 'string' && value) urls.push(value);
          if (Array.isArray(value)) urls.push(...value.filter(Boolean));
        }
      }
      return urls;
    });
    const keep = [
      ...IMAGE_CACHE_CRITICAL_URLS,
      ...this.catalog.brands().flatMap((b) => [b.logo, b.image].filter((u): u is string => !!u)),
      ...brandUrls,
      ...expUrls,
    ];
    await this.imageCache.preloadMany([...brandUrls, ...expUrls]);
    this.imageCache.releaseAllExcept(keep);
  }
}
