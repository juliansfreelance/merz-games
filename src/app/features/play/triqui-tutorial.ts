import {
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  Renderer2,
  DOCUMENT,
  DestroyRef,
} from '@angular/core';
import { HeroIcon } from '../shared/hero-icon';
import { UiSfx } from '../shared/ui-sfx';
import { AssetSrc } from '../../core/platform/asset-src';
import { Mark } from '../../core/games/triqui/triqui.model';

/** Espera para que el tablero se vea antes del tutorial automático. */
export const TUTORIAL_AUTO_REVEAL_MS = 420;

/**
 * TriquiTutorial — Modal interactivo de instrucciones para el juego de Triqui (Tres en Raya).
 *
 * Características:
 * - Backdrop a pantalla completa con blur glass (`fixed inset-0 z-50`).
 * - Bloqueo de scroll en document.body mientras está activo.
 * - Cierre explícito mediante botón x-mark o botón «¡Entendido, a jugar!» (sin auto-dismiss).
 * - Explicación clara de las vidas: perder resta una vida; empatar no descuenta vidas.
 * - Mini escena visual animada demostrando la línea de 3 y la mano táctil.
 */
@Component({
  selector: 'app-triqui-tutorial',
  imports: [HeroIcon, UiSfx, AssetSrc],
  template: `
    @if (visible()) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        style="background: rgba(3, 7, 18, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
        role="dialog"
        aria-modal="true"
        aria-label="Instrucciones del juego Triqui"
        animate.enter="tutorial-overlay-enter"
        (click)="dismiss()"
      >
        <div
          class="relative w-full max-w-lg bg-neutral-900/90 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-6 text-center select-none backdrop-blur-xl"
          [style.box-shadow]="'0 0 50px -10px ' + glowColor() + '33'"
          animate.enter="tutorial-card-enter"
          (click)="stopPropagation($event)"
        >
          <!-- Botón de cerrar con Heroicons outline x-mark -->
          <button
            type="button"
            uiSfx="back"
            class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/20 flex items-center justify-center text-white/70 hover:text-white text-lg transition-all cursor-pointer select-none"
            aria-label="Cerrar instrucciones"
            (click)="dismiss()"
          >
            <app-hero-icon name="x-mark" />
          </button>

          <!-- Título del Tutorial -->
          <div class="space-y-1">
            <span class="text-xs uppercase tracking-[0.25em] font-extrabold text-white/80">
              Tutorial de Juego
            </span>
            <h2 class="text-xl sm:text-2xl font-black font-['Montserrat'] tracking-tight text-white uppercase">
              ¿Cómo Jugar Triqui?
            </h2>
          </div>

          <!-- Escena de Demostración: Mini Tablero 3x3 Animado -->
          <div class="demo-scene relative w-44 h-44 flex items-center justify-center py-2">
            <div class="grid grid-cols-3 gap-2 w-full h-full p-2 bg-white/[0.03] border border-white/10 rounded-2xl">
              <!-- Celdas de demostración -->
              <!-- Fila 0 -->
              <div class="demo-cell border border-white/15 bg-white/[0.04] rounded-xl flex items-center justify-center p-1.5">
                @if (playerMarkUrl()) {
                  <img [src]="playerMarkUrl()" [alt]="playerSymbolText()" class="w-7 h-7 object-contain drop-shadow" />
                } @else {
                  <span class="font-bold text-xl" [class]="playerSymbol() === 'X' ? 'text-cyan-400' : 'text-amber-200'">{{ playerSymbolText() }}</span>
                }
              </div>
              <div class="demo-cell border border-white/15 bg-white/[0.04] rounded-xl flex items-center justify-center p-1.5">
                @if (aiMarkUrl()) {
                  <img [src]="aiMarkUrl()" [alt]="aiSymbolText()" class="w-7 h-7 object-contain drop-shadow" />
                } @else {
                  <span class="font-bold text-xl" [class]="playerSymbol() === 'X' ? 'text-amber-200' : 'text-cyan-400'">{{ aiSymbolText() }}</span>
                }
              </div>
              <div class="demo-cell border border-white/15 bg-white/[0.04] rounded-xl flex items-center justify-center text-neutral-600 font-bold text-xs">
                ·
              </div>
              <!-- Fila 1 -->
              <div class="demo-cell border border-white/15 bg-white/[0.04] rounded-xl flex items-center justify-center text-neutral-600 font-bold text-xs">
                ·
              </div>
              <div class="demo-cell border border-white/15 bg-white/[0.04] rounded-xl flex items-center justify-center p-1.5">
                @if (playerMarkUrl()) {
                  <img [src]="playerMarkUrl()" [alt]="playerSymbolText()" class="w-7 h-7 object-contain drop-shadow" />
                } @else {
                  <span class="font-bold text-xl" [class]="playerSymbol() === 'X' ? 'text-cyan-400' : 'text-amber-200'">{{ playerSymbolText() }}</span>
                }
              </div>
              <div class="demo-cell border border-white/15 bg-white/[0.04] rounded-xl flex items-center justify-center p-1.5">
                @if (aiMarkUrl()) {
                  <img [src]="aiMarkUrl()" [alt]="aiSymbolText()" class="w-7 h-7 object-contain drop-shadow" />
                } @else {
                  <span class="font-bold text-xl" [class]="playerSymbol() === 'X' ? 'text-amber-200' : 'text-cyan-400'">{{ aiSymbolText() }}</span>
                }
              </div>
              <!-- Fila 2: Celda 8 ganadora animada -->
              <div class="demo-cell border border-white/15 bg-white/[0.04] rounded-xl flex items-center justify-center text-neutral-600 font-bold text-xs">
                ·
              </div>
              <div class="demo-cell border border-white/15 bg-white/[0.04] rounded-xl flex items-center justify-center text-neutral-600 font-bold text-xs">
                ·
              </div>
              <div
                class="demo-cell-target rounded-xl flex items-center justify-center relative overflow-hidden p-1.5"
                [style.border]="'1px solid ' + glowColor() + '88'"
                [style.background]="glowColor() + '15'"
              >
                @if (playerMarkUrl()) {
                  <img [src]="playerMarkUrl()" [alt]="playerSymbolText()" class="demo-winning-x w-7 h-7 object-contain drop-shadow" />
                } @else {
                  <span class="demo-winning-x font-bold text-xl" [class]="playerSymbol() === 'X' ? 'text-cyan-400' : 'text-amber-200'">
                    {{ playerSymbolText() }}
                  </span>
                }
              </div>
            </div>

            <!-- Mano animada haciendo clic en la celda 8 para ganar en diagonal -->
            <div class="demo-hand-track">
              <svg
                viewBox="0 0 602 634"
                aria-hidden="true"
                class="demo-hand filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
              >
                <path
                  fill="#ffffff"
                  d="M424.94,196.15c-10.56-4.06-21.92-3.71-31.99.99-7.36,3.43-13.39,8.89-17.54,15.76-12.05-14.84-32.61-20.4-50.13-12.23l-.4.19c-7.46,3.48-13.57,9.06-17.73,16.09-12.14-14.14-32.21-19.29-49.35-11.3l-.4.19c-6.89,3.21-12.5,8.21-16.53,14.26l-23.41-50.2c-10.05-21.55-35.03-31.59-55.89-22.02-20.94,9.61-29.78,35.13-19.7,56.74l87.63,187.92-22.07-8.48c-21.8-8.38-45.71,2.77-53.31,24.86-6.79,19.75,1.88,42.37,20.17,52.62l.13.07c5.25,2.94,10.68,5.98,15.8,9.14l126.83,78.23c11.34,7,18.14,12.42,23.83,24.63l4.81,10.32c4.13,8.86,14.42,12.81,22.97,8.83l164.6-76.75c8.55-3.99,12.14-14.41,8-23.27l-11.79-25.29c-2.59-5.55-4.15-11.45-4.64-17.52l-3.44-31.16c-1.61-14.61-2.59-29.39-3.38-42.09-.46-7.41-2.29-14.6-5.44-21.36l-63.74-136.68c-4.87-10.44-13.36-18.42-23.92-22.47ZM323.56,248.22c-4.7-10.97-.22-23.36,10.24-28.24l.4-.19c10.63-4.95,23.4-.05,28.54,10.97l38.69,82.98c2.44,5.23,8.5,7.56,13.54,5.2l.19-.09c5.04-2.35,7.16-8.49,4.72-13.72-5.99-12.84-27.51-59.01-28.18-60.45-4.77-10.85-.22-23.59,10.16-28.43,5.14-2.4,10.94-2.58,16.33-.5,5.39,2.07,9.72,6.14,12.21,11.47l63.74,136.68c2,4.28,3.15,8.82,3.44,13.51.8,12.96,1.8,28.04,3.46,43.13l3.39,30.69c.71,8.6,2.93,16.95,6.6,24.8l10.36,22.22-158.66,73.98-3.38-7.24c-7.49-16.07-17.14-24.7-32.06-33.9l-126.83-78.23c-5.5-3.39-11.13-6.54-16.57-9.59l-.13-.07c-9.33-5.22-13.75-16.77-10.28-26.85,3.88-11.27,16.08-16.96,27.21-12.69l47.91,18.41c7.71,2.96,14.81-4.99,11.26-12.61l-99.4-213.16c-5.1-10.94-.98-23.98,9.5-29.07,10.67-5.18,23.66-.27,28.83,10.82l77.55,166.31c2.44,5.24,8.52,7.56,13.57,5.19l.17-.08c5.02-2.35,7.12-8.46,4.71-13.67-2.82-6.11-18.28-39.32-22.65-48.7-6.49-13.94-13.69-29.4-16.31-35.04-.61-1.32-1.08-2.72-1.31-4.16-1.55-9.45,3.15-18.95,11.78-22.97l.4-.19c10.63-4.95,23.4-.05,28.54,10.97l42.21,90.51c2.44,5.23,8.5,7.56,13.54,5.2h0c5.03-2.34,7.15-8.46,4.74-13.68l-32.19-69.56Z"
                />
              </svg>
            </div>
          </div>

          <!-- Reglas Detalladas -->
          <div class="w-full space-y-3 text-left bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5">
            <!-- Regla 1: Marca y alineación -->
            <div class="flex items-start gap-3">
              <div class="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5">
                1
              </div>
              <p class="text-xs sm:text-sm text-white leading-relaxed">
                Tú juegas con la marca
                <span class="inline-flex items-center align-middle gap-1 mx-1 px-2 py-0.5 rounded-lg bg-white/10 border border-white/15">
                  @if (playerMarkUrl()) {
                    <img [src]="playerMarkUrl()" [alt]="playerSymbolText()" class="w-4 h-4 object-contain inline" />
                  } @else {
                    <span class="font-bold text-xs text-white">{{ playerSymbolText() }}</span>
                  }
                </span>
                y la computadora juega con la marca
                <span class="inline-flex items-center align-middle gap-1 mx-1 px-2 py-0.5 rounded-lg bg-white/10 border border-white/15">
                  @if (aiMarkUrl()) {
                    <img [src]="aiMarkUrl()" [alt]="aiSymbolText()" class="w-4 h-4 object-contain inline" />
                  } @else {
                    <span class="font-bold text-xs text-white">{{ aiSymbolText() }}</span>
                  }
                </span>.
                Alinea 3 marcas en línea horizontal, vertical o diagonal para ganar la ronda.
              </p>
            </div>

            <!-- Regla 2: Vidas -->
            <div class="flex items-start gap-3">
              <div class="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5">
                2
              </div>
              <div class="text-xs sm:text-sm text-white leading-relaxed">
                <span class="font-bold text-white">Atención a tus vidas:</span>
                <span class="text-white ml-1">
                  Si la computadora te gana la ronda, <strong class="font-bold text-white">perderás una vida</strong>. Los empates <strong class="font-bold text-white">no descuentan vidas</strong>.
                </span>
              </div>
            </div>

            <!-- Regla 3: Objetivo -->
            <div class="flex items-start gap-3">
              <div class="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5">
                3
              </div>
              <p class="text-xs sm:text-sm text-white leading-relaxed">
                Supera a la computadora antes de agotar tus 3 oportunidades para ganar tu premio.
              </p>
            </div>
          </div>

          <!-- Botón de Cierre con estilo Kiosk -->
          <button
            type="button"
            uiSfx="click"
            class="w-full min-h-12 sm:min-h-14 px-8 sm:px-12 py-3.5 sm:py-4 rounded-full border border-white/25 bg-white/[0.08] backdrop-blur-md text-white font-extrabold font-['Montserrat'] tracking-[0.18em] uppercase text-xs sm:text-sm shadow-xl shadow-black/40 hover:bg-white/[0.16] hover:border-white/40 active:scale-95 transition-all duration-150 cursor-pointer select-none"
            (click)="dismiss()"
          >
            ¡Entendido, a jugar!
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .demo-hand-track {
      position: absolute;
      bottom: -0.5rem;
      right: -0.5rem;
      width: 3.5rem;
      height: 3.5rem;
      z-index: 20;
      animation: demoTap 3s ease-in-out infinite;
      pointer-events: none;
    }

    .demo-hand {
      width: 100%;
      height: 100%;
    }

    .demo-winning-x {
      animation: demoShowX 3s ease-in-out infinite;
    }

    @keyframes demoTap {
      0%, 20% {
        transform: translate(25px, 25px) scale(0.9);
        opacity: 0;
      }
      35% {
        transform: translate(0px, 0px) scale(1);
        opacity: 1;
      }
      45% {
        transform: translate(-3px, -3px) scale(0.92);
        opacity: 1;
      }
      55% {
        transform: translate(0px, 0px) scale(1);
        opacity: 1;
      }
      75%, 100% {
        transform: translate(25px, 25px);
        opacity: 0;
      }
    }

    @keyframes demoShowX {
      0%, 40% {
        transform: scale(0);
        opacity: 0;
      }
      50%, 80% {
        transform: scale(1.15);
        opacity: 1;
      }
      90%, 100% {
        transform: scale(0);
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .demo-hand-track, .demo-winning-x {
        animation: none;
      }
    }

    .tutorial-overlay-enter {
      animation: tutorialOverlayIn 0.45s ease-out both;
    }

    .tutorial-overlay-leave {
      animation: tutorialOverlayOut 0.28s ease-in both;
    }

    .tutorial-card-enter {
      animation: tutorialCardIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
    }

    .tutorial-card-leave {
      animation: tutorialCardOut 0.22s ease-in both;
    }

    @keyframes tutorialOverlayIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes tutorialOverlayOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    @keyframes tutorialCardIn {
      from {
        opacity: 0;
        transform: scale(0.92) translateY(18px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes tutorialCardOut {
      from {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      to {
        opacity: 0;
        transform: scale(0.96) translateY(10px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tutorial-overlay-enter,
      .tutorial-overlay-leave,
      .tutorial-card-enter,
      .tutorial-card-leave {
        animation: none;
      }
    }
  `],
})
export class TriquiTutorial {
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private _openTimer: ReturnType<typeof setTimeout> | null = null;

  readonly accentColor = input<string>('#00E5FF');
  readonly blurTint = input<string | undefined>(undefined);
  readonly markXUrl = input<string>('');
  readonly markOUrl = input<string>('');
  readonly playerSymbol = input<Mark>('X');

  protected readonly playerMarkUrl = computed<string>(() =>
    this.playerSymbol() === 'X' ? this.markXUrl() : this.markOUrl(),
  );

  protected readonly aiMarkUrl = computed<string>(() =>
    this.playerSymbol() === 'X' ? this.markOUrl() : this.markXUrl(),
  );

  protected readonly playerSymbolText = computed<string>(() =>
    this.playerSymbol() === 'X' ? '✕' : '○',
  );

  protected readonly aiSymbolText = computed<string>(() =>
    this.playerSymbol() === 'X' ? '○' : '✕',
  );

  /** Color de resplandor para box-shadow y detalles de acento: blurTint institucional o accentColor */
  protected readonly glowColor = computed<string>(() => this.blurTint() || this.accentColor() || '#00E5FF');

  readonly closed = output<void>();
  readonly visible = signal(false);
  readonly opening = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this._cancelPendingOpen());
  }

  showTutorial(delayMs = 0): void {
    this._cancelPendingOpen();
    if (this.visible()) return;

    const open = (): void => {
      this.opening.set(false);
      this.visible.set(true);
      this._lockScroll();
    };

    if (delayMs <= 0) {
      open();
      return;
    }

    this.opening.set(true);
    this._openTimer = setTimeout(() => {
      this._openTimer = null;
      open();
    }, delayMs);
  }

  dismiss(): void {
    this._cancelPendingOpen();
    this.visible.set(false);
    this._unlockScroll();
    this.closed.emit();
  }

  protected stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  private _cancelPendingOpen(): void {
    if (this._openTimer !== null) {
      clearTimeout(this._openTimer);
      this._openTimer = null;
    }
    this.opening.set(false);
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
