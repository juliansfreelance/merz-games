import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog';
import { KioskButton } from '../shared/kiosk-button';
import { KioskCard } from '../shared/kiosk-card';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

/**
 * Selector de experiencias de una marca.
 * @for sobre experiencesForBrand(brandId) — cero listas hardcodeadas.
 * Estado vacío claro si la marca no tiene experiencias válidas.
 */
@Component({
  selector: 'app-experience-select',
  imports: [KioskButton, KioskCard],
  template: `
    <div class="flex flex-col h-full w-full px-8 py-12 bg-neutral-950 text-white gap-8">

      <!-- Encabezado -->
      <header class="text-center space-y-2">
        <h1 class="text-3xl font-extrabold text-white">
          {{ brandName() }}
        </h1>
        <p class="text-neutral-400">Elige un juego para esta marca</p>
      </header>

      <!-- Lista de experiencias -->
      <div class="flex-1 flex flex-col justify-center gap-4">

        @if (experiences().length === 0) {
          <app-kiosk-card>
            <div class="text-center py-4 space-y-2">
              <p class="text-neutral-300 font-semibold">Sin juegos disponibles</p>
              <p class="text-neutral-500 text-sm">
                Esta marca no tiene experiencias activas en este momento.
              </p>
            </div>
          </app-kiosk-card>
        }

        @for (exp of experiences(); track exp.id) {
          <button
            class="w-full min-h-20 rounded-2xl border border-white/10 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all duration-150 text-left px-6 py-5 cursor-pointer"
            style="touch-action: manipulation;"
            (pointerup)="selectExperience(exp.id)"
            [attr.aria-label]="'Jugar ' + gameName(exp.gameId)"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xl font-bold text-white">{{ gameName(exp.gameId) }}</p>
                <p class="text-sm text-neutral-400 mt-1">Toca para jugar</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   stroke-width="2" stroke="currentColor" class="w-6 h-6 text-neutral-500 shrink-0">
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </button>
        }

      </div>

      <!-- Acciones de retroceso -->
      <app-kiosk-button variant="ghost" (click)="goBack()">
        ← Volver a marcas
      </app-kiosk-button>

    </div>
  `,
})
export class ExperienceSelect {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);

  private readonly brandId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('brandId') ?? '')),
    { initialValue: '' },
  );

  protected readonly experiences = computed(() =>
    this.catalog.experiencesForBrand(this.brandId()),
  );

  protected brandName(): string {
    return this.catalog.getBrandById(this.brandId())?.name ?? this.brandId();
  }

  protected gameName(gameId: string): string {
    return this.catalog.getGameById(gameId)?.name ?? gameId;
  }

  selectExperience(experienceId: string): void {
    this.router.navigate(['/play', experienceId]);
  }

  goBack(): void {
    this.router.navigate(['/brands']);
  }
}
