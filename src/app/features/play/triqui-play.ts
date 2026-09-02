import { Component, inject, input } from '@angular/core';
import { GameSession } from '../../core/session/game-session';
import {
  ExperienceAssets,
  ExperienceConfig,
  ExperienceTheme,
} from '../../core/catalog/game-experience.model';
import { KioskButton } from '../shared/kiosk-button';

/**
 * Stub del motor Triqui (Tres en Raya).
 * - Renderiza el área de tablero que se completará en la Fase 6.
 * - Incluye atajos de QA provisionales para probar la sesión y navegación.
 */
@Component({
  selector: 'app-triqui-play',
  imports: [KioskButton],
  template: `
    <div class="flex flex-col items-center justify-between h-full w-full p-2 text-white gap-4 select-none">

      <!-- Área de Tablero Placeholder (Fase 6 integrará aquí la IA y Canvas) -->
      <div class="flex-1 w-full flex flex-col items-center justify-center gap-4">
        <!-- Mock de tablero 3x3 -->
        <div class="grid grid-cols-3 gap-2.5 w-full max-w-[240px] aspect-square">
          @for (cell of [0, 1, 2, 3, 4, 5, 6, 7, 8]; track cell) {
            <div class="aspect-square rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.04] flex items-center justify-center shadow-inner">
              <span class="text-white/20 text-2xl font-bold">·</span>
            </div>
          }
        </div>
        <p class="text-xs text-neutral-400 text-center max-w-xs">
          Tablero interactivo de Tres en Raya (Fase 6)
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
export class TriquiPlay {
  readonly experienceId = input.required<string>();
  readonly brandId = input.required<string>();
  readonly gameId = input.required<string>();
  readonly remainingLives = input<number>(3);
  readonly theme = input<ExperienceTheme>({});
  readonly assets = input<ExperienceAssets>({});
  readonly config = input<ExperienceConfig>({});
  /** Configuración maestra del motor (game.config). Opcional. */
  readonly gameConfig = input<ExperienceConfig>({});
  /** Assets del motor (game.assets). Opcional. */
  readonly gameAssets = input<Record<string, unknown>>({});

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
