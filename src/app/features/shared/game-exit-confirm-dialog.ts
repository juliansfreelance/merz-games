import {
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  input,
  output,
  Renderer2,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KioskButton } from './kiosk-button';
import { HeroIcon } from './hero-icon';

/**
 * GameExitConfirmDialog — Diálogo modal táctil de confirmación para abandonar la partida
 * y regresar al catálogo de juegos.
 *
 * Características:
 * - Mismo estilo y animación que las pantallas de resultado (ResultScreen).
 * - Icono central de advertencia en formato de imagen limpia (/content/images/experiences/result/warning.png).
 * - Logo Merz Aesthetics, Marca y Juego con jerarquía idéntica a ResultScreen.
 * - Sin botón de cerrar en la esquina superior derecha (salida controlada por botones de acción).
 * - Botón principal enfocado en la acción segura («Continuar jugando»).
 * - Botón secundario para confirmar la salida («Sí, salir»).
 */
@Component({
  selector: 'app-game-exit-confirm-dialog',
  imports: [CommonModule, KioskButton, HeroIcon],
  template: `
    <div
      class="result-overlay result-overlay-enter fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style="background: rgba(3, 7, 18, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      animate.enter="result-overlay-enter"
      (click)="cancelled.emit()"
    >
      <div
        class="result-card result-card-enter relative w-full max-w-lg bg-neutral-900/90 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-5 text-center select-none backdrop-blur-xl"
        animate.enter="result-card-enter"
        (click)="stopPropagation($event)"
      >
        <!-- Logo Merz Aesthetics -->
        <img
          src="/content/images/MerzAestheticsLogo.svg"
          alt="Merz Aesthetics Logo"
          class="h-4 sm:h-5 w-auto mx-auto opacity-90 select-none pointer-events-none mb-1 sm:mb-2"
        />

        <!-- Marca / Juego (Salto de línea, marca destacada) -->
        @if (brandName()) {
          <div class="flex flex-col items-center justify-center gap-1 uppercase tracking-widest select-none mb-2 sm:mb-4 [&>span>sup]:text-[0.6em] [&>span>sup]:top-[-0.4em]">
            <span class="text-lg sm:text-xl font-black text-white" [innerHTML]="brandName()"></span>
            @if (gameName()) {
              <span class="text-xs sm:text-sm font-semibold text-neutral-300" [innerHTML]="gameName()"></span>
            }
          </div>
        }

        <!-- Imagen de Advertencia (sin background, bordes ni efectos) -->
        <img
          [src]="iconUrl()"
          [alt]="title()"
          loading="eager"
          decoding="async"
          class="w-36 h-36 sm:w-44 sm:h-44 object-contain pointer-events-none select-none"
        />

        <!-- Título y Mensaje -->
        <div class="space-y-2 sm:space-y-3 w-full">
          <h1
            class="text-2xl sm:text-3xl font-extrabold font-['Montserrat'] tracking-tight text-white uppercase [&>strong]:font-black [&>sup]:text-[0.6em] [&>sup]:top-[-0.4em]"
            [innerHTML]="title()"
          ></h1>
          <p
            class="text-neutral-300 text-sm sm:text-base leading-relaxed max-w-md mx-auto [&>strong]:font-bold [&>strong]:text-white [&>sup]:text-[0.6em] [&>sup]:top-[-0.4em]"
            [innerHTML]="message()"
          ></p>
        </div>

        <!-- Botones de Acción -->
        <div class="w-full space-y-2.5 sm:space-y-3 pt-1">
          <!-- Acción segura: continuar jugando (botón primario para evitar abandono accidental) -->
          <app-kiosk-button variant="primary" (click)="cancelled.emit()">
            {{ cancelLabel() }}
          </app-kiosk-button>

          <!-- Acción de salida: confirma abandonar -->
          <app-kiosk-button variant="ghost" (click)="confirmed.emit()">
            <app-hero-icon name="arrow-left" />
            {{ confirmLabel() }}
          </app-kiosk-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .result-overlay-enter {
      animation: resultOverlayFade 0.5s ease-out both;
    }

    .result-card-enter {
      animation: resultCardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
    }

    @keyframes resultOverlayFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes resultCardIn {
      from {
        opacity: 0;
        transform: scale(0.92) translateY(16px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
  `],
})
export class GameExitConfirmDialog {
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);

  readonly iconUrl = input<string>('/content/images/experiences/result/warning.png');
  readonly title = input<string>('¿ABANDONAR LA PARTIDA?');
  readonly message = input<string>(
    'Si regresas a la selección de juegos, perderás tu progreso actual en esta sesión.<br><strong>¿Deseas salir o continuar jugando?</strong>',
  );
  readonly confirmLabel = input<string>('Sí, salir');
  readonly cancelLabel = input<string>('Continuar jugando');
  readonly brandName = input<string | undefined>(undefined);
  readonly gameName = input<string | undefined>(undefined);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();


  constructor() {
    this._lockScroll();
    inject(DestroyRef).onDestroy(() => {
      this._unlockScroll();
    });
  }

  protected stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  private _lockScroll(): void {
    try {
      this.renderer.setStyle(this.document.body, 'overflow', 'hidden');
    } catch {
      // Vitest / SSR
    }
  }

  private _unlockScroll(): void {
    try {
      this.renderer.removeStyle(this.document.body, 'overflow');
    } catch {
      // Vitest / SSR
    }
  }
}
