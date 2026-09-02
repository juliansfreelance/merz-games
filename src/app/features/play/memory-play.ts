import { Component, inject, input } from '@angular/core';
import { GameSession } from '../../core/session/game-session';
import {
  ExperienceAssets,
  ExperienceConfig,
  ExperienceTheme,
} from '../../core/catalog/game-experience.model';
import { KioskButton } from '../shared/kiosk-button';

/**
 * Stub del motor Memory (Encuentra la Pareja).
 * - Renderiza el área de tablero que se completará en la Fase 5.
 * - Incluye atajos de QA provisionales para probar la sesión y navegación.
 */
@Component({
  selector: 'app-memory-play',
  imports: [KioskButton],
  template: `
    <div class="flex flex-col items-center justify-between h-full w-full p-2 text-white gap-4 select-none">

      <!-- Área de Tablero Placeholder (Fase 5 integrará aquí las 6 cartas y Canvas) -->
      <div class="flex-1 w-full flex flex-col items-center justify-center gap-4">
        <!-- Mock de cartas 2x3 -->
        <div class="grid grid-cols-3 gap-3 w-full max-w-xs">
          @for (card of [1, 2, 3, 4, 5, 6]; track card) {
            <div class="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.04] flex flex-col items-center justify-center gap-1 shadow-inner">
              <span class="text-xs font-bold text-white/30 tracking-wider">#{{ card }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   stroke-width="1.2" stroke="currentColor" class="w-6 h-6 text-white/20">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
          }
        </div>
        <p class="text-xs text-neutral-400 text-center max-w-xs">
          Tablero interactivo de memoria visual (Fase 5)
        </p>
      </div>

      <!-- Barra discreta de QA (Pruebas de navegación y sesión) -->
      <div class="w-full bg-black/40 border border-white/10 rounded-2xl p-3 backdrop-blur-md space-y-2">
        <div class="flex items-center justify-between text-[11px] text-neutral-400 font-mono px-1">
          <span>[Solo QA] Vidas: {{ session.remainingLives() }}</span>
          <span>exp: {{ experienceId() }}</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <app-kiosk-button variant="primary" (click)="simulateWin()">
            Ganar 🏆
          </app-kiosk-button>
          <app-kiosk-button variant="secondary" (click)="simulateLose()">
            Perder 1 Vida 💔
          </app-kiosk-button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <app-kiosk-button variant="ghost" (click)="simulateOutOfLives()">
            Agotar Vidas ⏱️
          </app-kiosk-button>
          <app-kiosk-button variant="ghost" (click)="goBack()">
            ← Salir
          </app-kiosk-button>
        </div>
      </div>

    </div>
  `,
})
export class MemoryPlay {
  readonly experienceId = input.required<string>();
  readonly brandId = input.required<string>();
  readonly gameId = input.required<string>();
  readonly remainingLives = input<number>(3);
  readonly theme = input<ExperienceTheme>({});
  readonly assets = input<ExperienceAssets>({});
  readonly config = input<ExperienceConfig>({});

  protected readonly session = inject(GameSession);

  simulateWin(): void {
    this.session.complete('win');
  }

  simulateLose(): void {
    this.session.loseLife();
  }

  simulateOutOfLives(): void {
    const lives = this.session.remainingLives();
    for (let i = 0; i < lives; i++) {
      this.session.loseLife();
    }
  }

  goBack(): void {
    window.history.back();
  }
}
