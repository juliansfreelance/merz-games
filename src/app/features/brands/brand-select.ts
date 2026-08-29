import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog';
import { KioskButton } from '../shared/kiosk-button';
import { KioskCard } from '../shared/kiosk-card';

/**
 * Selector de marcas.
 * @for sobre catalog.brands() — cero listas hardcodeadas.
 * Añadir una marca al JSON semilla la hace aparecer aquí automáticamente.
 */
@Component({
  selector: 'app-brand-select',
  imports: [KioskButton, KioskCard],
  template: `
    <div class="flex flex-col h-full w-full px-8 py-12 bg-neutral-950 text-white gap-8">

      <!-- Encabezado -->
      <header class="text-center space-y-2">
        <h1 class="text-3xl font-extrabold text-white">Elige tu marca</h1>
        <p class="text-neutral-400">Selecciona la marca con la que quieres jugar</p>
      </header>

      <!-- Lista de marcas -->
      <div class="flex-1 flex flex-col justify-center gap-4">

        @if (catalog.brands().length === 0) {
          <!-- Estado vacío -->
          <app-kiosk-card>
            <p class="text-center text-neutral-400 py-4">
              No hay marcas disponibles en este momento.
            </p>
          </app-kiosk-card>
        }

        @for (brand of catalog.brands(); track brand.id) {
          <button
            class="w-full min-h-20 rounded-2xl border border-white/10 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all duration-150 text-left px-6 py-5 cursor-pointer"
            style="touch-action: manipulation;"
            (pointerup)="selectBrand(brand.id)"
            [attr.aria-label]="'Jugar con ' + brand.name"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xl font-bold text-white">{{ brand.name }}</p>
                <p class="text-sm text-neutral-400 mt-1">Toca para ver los juegos</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   stroke-width="2" stroke="currentColor" class="w-6 h-6 text-neutral-500 shrink-0">
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </button>
        }

      </div>

      <!-- Volver -->
      <app-kiosk-button variant="ghost" (click)="goBack()">
        ← Volver al inicio
      </app-kiosk-button>

    </div>
  `,
})
export class BrandSelect {
  protected readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);

  selectBrand(brandId: string): void {
    this.catalog.setSelectedBrand(brandId);
    this.router.navigate(['/brands', brandId, 'games']);
  }

  goBack(): void {
    this.router.navigate(['/welcome']);
  }
}
