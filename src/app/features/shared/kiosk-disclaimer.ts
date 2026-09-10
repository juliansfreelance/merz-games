import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogService } from '../../core/catalog/catalog';
import { AssetSrc } from '../../core/platform/asset-src';

/**
 * KioskDisclaimer — Sticky Footer unificado para todas las pantallas del kiosco.
 *
 * Características:
 * - Se ancla naturalmente en la parte inferior de la ventana cuando el contenido es corto (sticky footer).
 * - Desciende de forma natural con scroll fluido si el contenido es largo, evitando cualquier solapamiento.
 * - Incluye opcionalmente:
 *   1. Logo/Icono de la marca al 30% de ancho con altura automática y margin-bottom.
 *   2. Botón de acción/retorno (ng-content) con margin-bottom para separarse del disclaimer.
 *   3. Disclaimers legales (INVIMA institucional + Dinámica de habilidad mental).
 */
@Component({
  selector: 'app-kiosk-disclaimer',
  imports: [CommonModule, AssetSrc],
  host: {
    class: 'block w-full mt-auto shrink-0',
  },
  template: `
    <footer class="w-full flex flex-col items-center justify-center text-center px-4 sm:px-6 kiosk:px-8 pt-3 pb-2.5 sm:pb-3.5 z-30 select-none">

      <!-- 1. Logotipo o icono de marca (30% de ancho, h-auto y margin-bottom para separar del botón) -->
      @if (logo(); as logoUrl) {
        <div class="w-full flex items-center justify-center mb-3 sm:mb-4 kiosk:mb-6">
          <img
            [src]="logoUrl"
            [alt]="logoAlt() || 'Logotipo'"
            class="w-[30%] max-w-65 min-w-35 h-auto object-contain drop-shadow-md select-none pointer-events-none"
          />
        </div>
      }

      <!-- 2. Botón de acción / retorno con margin-bottom para separarse del disclaimer -->
      <div class="w-full flex justify-center mb-6 sm:mb-8 kiosk:mb-12 empty:hidden">
        <ng-content />
      </div>

      <!-- 3. Disclaimers Legales -->
      <div class="max-w-4xl mx-auto flex flex-col items-center justify-center space-y-1">
        @if (computedBrandDisclaimer(); as brandText) {
          <p
            class="text-[9px] sm:text-[10px] kiosk:text-xs text-neutral-300/85 leading-tight font-medium tracking-normal text-center"
            [innerHTML]="brandText"
          ></p>
        }
        <p class="text-[8.5px] sm:text-[9.5px] kiosk:text-[11px] text-neutral-400/70 leading-tight tracking-normal text-center max-w-3xl">
          {{ computedActivityDisclaimer() }}
        </p>
      </div>

    </footer>
  `,
})
export class KioskDisclaimer {
  private readonly catalog = inject(CatalogService);

  /** Logo o icono opcional de la marca para el footer. */
  readonly logo = input<string | undefined>(undefined);

  /** Texto alternativo para el logo. */
  readonly logoAlt = input<string | undefined>(undefined);

  /** Disclaimer de marca opcional pasado como input o resuelto desde el catálogo. */
  readonly brandDisclaimer = input<string | undefined>(undefined);

  /** Disclaimer de actividad opcional pasado como input o resuelto desde el catálogo. */
  readonly activityDisclaimer = input<string | undefined>(undefined);

  protected readonly computedBrandDisclaimer = computed(
    () => this.brandDisclaimer() ?? this.catalog.selectedBrand()?.disclaimer,
  );

  protected readonly computedActivityDisclaimer = computed(
    () => this.activityDisclaimer() ?? this.catalog.activityDisclaimer(),
  );
}
