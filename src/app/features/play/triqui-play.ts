import { Component, inject, input } from '@angular/core';
import { GameSession } from '../../core/session/game-session';
import { ExperienceAssets, ExperienceConfig, ExperienceTheme } from '../../core/catalog/game-experience.model';
import { KioskButton } from '../shared/kiosk-button';

/**
 * Stub del motor Triqui (Tres en Raya).
 * Fase 2: placeholder de UI para validar navegación.
 * Fase 3: cableado a GameSession (vidas reales, no Router directo).
 * Las Fases 4–5 reemplazarán este stub por la lógica real de Triqui.
 */
@Component({
  selector: 'app-triqui-play',
  imports: [KioskButton],
  template: `
    <div class="flex flex-col h-full w-full px-8 py-12 bg-neutral-950 text-white gap-8">

      <!-- Info del juego -->
      <header class="text-center space-y-2">
        <p class="text-xs text-neutral-500 uppercase tracking-widest">Experiencia</p>
        <h1 class="text-3xl font-extrabold">Tres en Raya</h1>
        <p class="text-neutral-400 text-sm">Marca: {{ brandId() }} · Motor: {{ gameId() }}</p>
      </header>

      <!-- Área de juego (placeholder) -->
      <div class="flex-1 flex flex-col items-center justify-center gap-4">
        <!-- Tablero 3×3 visual placeholder -->
        <div class="grid grid-cols-3 gap-2 w-48">
          @for (cell of [0,1,2,3,4,5,6,7,8]; track cell) {
            <div class="aspect-square rounded-xl border border-dashed border-white/20 flex items-center justify-center">
              <span class="text-white/20 text-2xl font-bold">·</span>
            </div>
          }
        </div>
        <p class="text-neutral-500 text-sm text-center max-w-xs">
          El tablero de Triqui aparecerá aquí en la Fase 5.
        </p>
      </div>

      <!-- Atajos provisionales — solo para QA de navegación (Fases 4–5 los eliminan) -->
      <div class="space-y-3">
        <p class="text-center text-[11px] text-neutral-600 uppercase tracking-wider">
          [Provisional · Solo QA]
        </p>
        <p class="text-center text-sm text-neutral-400">
          Vidas: <span class="font-bold text-white">{{ session.remainingLives() }}</span>
        </p>
        <app-kiosk-button variant="primary" (click)="simulateWin()">
          Simular victoria
        </app-kiosk-button>
        <app-kiosk-button variant="secondary" (click)="simulateLose()">
          Simular derrota
        </app-kiosk-button>
        <app-kiosk-button variant="ghost" (click)="simulateOutOfLives()">
          Simular sin intentos
        </app-kiosk-button>
        <app-kiosk-button variant="ghost" (click)="goBack()">
          ← Salir al selector
        </app-kiosk-button>
      </div>

    </div>
  `,
})
export class TriquiPlay {
  readonly experienceId = input.required<string>();
  readonly brandId = input.required<string>();
  readonly gameId = input.required<string>();
  readonly remainingLives = input<number>(3);
  /** Personalización visual pasada por GameHost (vacía en Fase 3). */
  readonly theme = input<ExperienceTheme>({});
  /** Activos locales pasados por GameHost (vacíos en Fase 3). */
  readonly assets = input<ExperienceAssets>({});
  /** Configuración del motor pasada por GameHost (vacía en Fase 3). */
  readonly config = input<ExperienceConfig>({});

  protected readonly session = inject(GameSession);

  /** [QA] Simula victoria directa. */
  simulateWin(): void {
    this.session.complete('win');
  }

  /** [QA] Simula derrota con descuento de una vida (puede llegar a out-of-lives). */
  simulateLose(): void {
    this.session.loseLife();
  }

  /**
   * [QA] Simula que el jugador se queda sin vidas:
   * llama loseLife() hasta agotarlas — el servicio navega automáticamente.
   */
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
