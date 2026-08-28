import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { KioskButton } from '../shared/kiosk-button';
import { PlayResult } from '../../core/catalog/play-result.model';

/**
 * Stub del motor Memory (Encuentra la Pareja).
 * Fase 2: placeholder de UI para validar navegación.
 * Las Fases 4–5 reemplazarán este stub por la lógica real de Memory.
 */
@Component({
  selector: 'app-memory-play',
  imports: [KioskButton],
  template: `
    <div class="flex flex-col h-full w-full px-8 py-12 bg-neutral-950 text-white gap-8">

      <!-- Info del juego -->
      <header class="text-center space-y-2">
        <p class="text-xs text-neutral-500 uppercase tracking-widest">Experiencia</p>
        <h1 class="text-3xl font-extrabold">Encuentra la Pareja</h1>
        <p class="text-neutral-400 text-sm">Marca: {{ brandId() }} · Motor: {{ gameId() }}</p>
      </header>

      <!-- Área de juego (placeholder) -->
      <div class="flex-1 flex flex-col items-center justify-center gap-4">
        <div class="w-32 h-32 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               stroke-width="1" stroke="currentColor" class="w-14 h-14 text-white/30">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
          </svg>
        </div>
        <p class="text-neutral-500 text-sm text-center max-w-xs">
          El tablero de Memory aparecerá aquí en la Fase 4.
        </p>
      </div>

      <!-- Atajos provisionales — solo para QA de navegación (Fases 4–5 los eliminan) -->
      <div class="space-y-3">
        <p class="text-center text-[11px] text-neutral-600 uppercase tracking-wider">
          [Provisional · Solo QA]
        </p>
        <app-kiosk-button variant="primary" (click)="simulate('win')">
          Simular victoria
        </app-kiosk-button>
        <app-kiosk-button variant="secondary" (click)="simulate('lose')">
          Simular derrota
        </app-kiosk-button>
        <app-kiosk-button variant="ghost" (click)="simulate('out-of-lives')">
          Simular sin intentos
        </app-kiosk-button>
        <app-kiosk-button variant="ghost" (click)="goBack()">
          ← Salir al selector
        </app-kiosk-button>
      </div>

    </div>
  `,
})
export class MemoryPlay {
  readonly experienceId = input.required<string>();
  readonly brandId = input.required<string>();
  readonly gameId = input.required<string>();

  private readonly router = inject(Router);

  simulate(result: PlayResult): void {
    this.router.navigate(['/result', this.experienceId(), result]);
  }

  goBack(): void {
    this.router.navigate(['/brands', this.brandId(), 'games']);
  }
}
