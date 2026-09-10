import {
  Component,
  input,
  output,
  signal,
  inject,
  computed,
  Renderer2,
  DOCUMENT,
  DestroyRef,
} from '@angular/core';
import { HeroIcon } from '../shared/hero-icon';
import { UiSfx } from '../shared/ui-sfx';
import { AssetSrc } from '../../core/platform/asset-src';

/** Espera para que el tablero se vea antes del tutorial automático. */
export const TUTORIAL_AUTO_REVEAL_MS = 420;

/**
 * MemoryTutorial — Modal de pantalla completa con backdrop para las instrucciones del juego de memoria.
 *
 * Características solicitadas:
 * - Tipo modal con backdrop a toda la pantalla (`fixed inset-0 z-50`).
 * - Bloqueo de scroll en el host o body mientras esté activo.
 * - Explicación clara de las vidas: cada fallo de pareja resta 1 intento.
 * - NO se auto-cierra: solo se cierra con su botón explícito de acción/cierre.
 * - Visual interactivo similar a la referencia: cartas girando/volteándose y mano animada con ondas de toque.
 */
@Component({
  selector: 'app-memory-tutorial',
  imports: [HeroIcon, UiSfx, AssetSrc],
  template: `
    <!-- Modal Backdrop a pantalla completa con bloqueo -->
    @if (visible()) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        style="background: rgba(3, 7, 18, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
        role="dialog"
        aria-modal="true"
        aria-label="Instrucciones del juego de memoria"
        animate.enter="tutorial-overlay-enter"
        (click)="stopPropagation($event)"
      >
        <!-- Tarjeta / Contenedor Central del Modal -->
        <div
          class="relative w-full max-w-lg bg-neutral-900/80 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-6 text-center select-none"
          [style.box-shadow]="'0 0 50px -10px ' + glowColor() + '33'"
          animate.enter="tutorial-card-enter"
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
              ¿Cómo Jugar?
            </h2>
          </div>

          <!-- Escena de Demostración: Cartas Animadas (Inspirado en superhero-memory-match-hd) -->
          <div class="demo-scene relative w-full h-36 sm:h-40 flex items-center justify-center gap-4 py-2">
            <!-- Carta 1 de demostración (voltea sincronizada) -->
            <div class="demo-card-container w-24 sm:w-28 aspect-[400/318] perspective-1000">
              <div class="demo-card-scene w-full h-full relative demo-flip-anim-1">
                <!-- Dorso -->
                <div class="demo-face absolute inset-0 border border-white/20 bg-white/5 backdrop-blur-md flex items-center justify-center shadow-lg overflow-hidden">
                  @if (backUrl()) {
                    <img [src]="backUrl()" alt="" aria-hidden="true" class="w-full h-full object-cover" />
                  } @else {
                    <span class="text-white/40 text-xl font-bold">?</span>
                  }
                </div>
                <!-- Cara -->
                <div class="demo-face demo-face-front absolute inset-0 border border-emerald-400/60 bg-emerald-950/30 flex items-center justify-center shadow-lg overflow-hidden">
                  @if (sampleFaceUrl()) {
                    <img [src]="sampleFaceUrl()" alt="" aria-hidden="true" class="w-full h-full object-cover" />
                  } @else {
                    <div class="w-7 h-7 rounded-full" [style.background]="accentColor()"></div>
                  }
                </div>
              </div>
            </div>

            <!-- Carta 2 de demostración (voltea después y hace match) -->
            <div class="demo-card-container w-24 sm:w-28 aspect-[400/318] perspective-1000">
              <div class="demo-card-scene w-full h-full relative demo-flip-anim-2">
                <!-- Dorso -->
                <div class="demo-face absolute inset-0 border border-white/20 bg-white/5 backdrop-blur-md flex items-center justify-center shadow-lg overflow-hidden">
                  @if (backUrl()) {
                    <img [src]="backUrl()" alt="" aria-hidden="true" class="w-full h-full object-cover" />
                  } @else {
                    <span class="text-white/40 text-xl font-bold">?</span>
                  }
                </div>
                <!-- Cara -->
                <div class="demo-face demo-face-front absolute inset-0 border border-emerald-400/60 bg-emerald-950/30 flex items-center justify-center shadow-lg overflow-hidden">
                  @if (sampleFaceUrl()) {
                    <img [src]="sampleFaceUrl()" alt="" aria-hidden="true" class="w-full h-full object-cover" />
                  } @else {
                    <div class="w-7 h-7 rounded-full" [style.background]="accentColor()"></div>
                  }
                </div>
              </div>
            </div>

            <!-- Mano animada haciendo toque sobre la carta con alternancia de estado -->
            <div class="demo-hand-track">
              <!-- Mano en reposo / movimiento (mano.svg) -->
              <svg
                viewBox="0 0 602 634"
                aria-hidden="true"
                class="demo-hand-idle filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
              >
                <path
                  fill="#ffffff"
                  d="M424.94,196.15c-10.56-4.06-21.92-3.71-31.99.99-7.36,3.43-13.39,8.89-17.54,15.76-12.05-14.84-32.61-20.4-50.13-12.23l-.4.19c-7.46,3.48-13.57,9.06-17.73,16.09-12.14-14.14-32.21-19.29-49.35-11.3l-.4.19c-6.89,3.21-12.5,8.21-16.53,14.26l-23.41-50.2c-10.05-21.55-35.03-31.59-55.89-22.02-20.94,9.61-29.78,35.13-19.7,56.74l87.63,187.92-22.07-8.48c-21.8-8.38-45.71,2.77-53.31,24.86-6.79,19.75,1.88,42.37,20.17,52.62l.13.07c5.25,2.94,10.68,5.98,15.8,9.14l126.83,78.23c11.34,7,18.14,12.42,23.83,24.63l4.81,10.32c4.13,8.86,14.42,12.81,22.97,8.83l164.6-76.75c8.55-3.99,12.14-14.41,8-23.27l-11.79-25.29c-2.59-5.55-4.15-11.45-4.64-17.52l-3.44-31.16c-1.61-14.61-2.59-29.39-3.38-42.09-.46-7.41-2.29-14.6-5.44-21.36l-63.74-136.68c-4.87-10.44-13.36-18.42-23.92-22.47ZM323.56,248.22c-4.7-10.97-.22-23.36,10.24-28.24l.4-.19c10.63-4.95,23.4-.05,28.54,10.97l38.69,82.98c2.44,5.23,8.5,7.56,13.54,5.2l.19-.09c5.04-2.35,7.16-8.49,4.72-13.72-5.99-12.84-27.51-59.01-28.18-60.45-4.77-10.85-.22-23.59,10.16-28.43,5.14-2.4,10.94-2.58,16.33-.5,5.39,2.07,9.72,6.14,12.21,11.47l63.74,136.68c2,4.28,3.15,8.82,3.44,13.51.8,12.96,1.8,28.04,3.46,43.13l3.39,30.69c.71,8.6,2.93,16.95,6.6,24.8l10.36,22.22-158.66,73.98-3.38-7.24c-7.49-16.07-17.14-24.7-32.06-33.9l-126.83-78.23c-5.5-3.39-11.13-6.54-16.57-9.59l-.13-.07c-9.33-5.22-13.75-16.77-10.28-26.85,3.88-11.27,16.08-16.96,27.21-12.69l47.91,18.41c7.71,2.96,14.81-4.99,11.26-12.61l-99.4-213.16c-5.1-10.94-.98-23.98,9.5-29.07,10.67-5.18,23.66-.27,28.83,10.82l77.55,166.31c2.44,5.24,8.52,7.56,13.57,5.19l.17-.08c5.02-2.35,7.12-8.46,4.71-13.67-2.82-6.11-18.28-39.32-22.65-48.7-6.49-13.94-13.69-29.4-16.31-35.04-.61-1.32-1.08-2.72-1.31-4.16-1.55-9.45,3.15-18.95,11.78-22.97l.4-.19c10.63-4.95,23.4-.05,28.54,10.97l42.21,90.51c2.44,5.23,8.5,7.56,13.54,5.2h0c5.03-2.34,7.15-8.46,4.74-13.68l-32.19-69.56Z"
                />
              </svg>
              <!-- Mano haciendo clic / evento de pulsación (manoEvent.svg) -->
              <svg
                viewBox="0 0 602 634"
                aria-hidden="true"
                class="demo-hand-event filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.8)] drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]"
              >
                <path
                  fill="#ffffff"
                  d="M424.94,196.15c-10.56-4.06-21.92-3.71-31.99.99-7.36,3.43-13.39,8.89-17.54,15.76-12.05-14.84-32.61-20.4-50.13-12.23l-.4.19c-7.46,3.48-13.57,9.06-17.73,16.09-12.14-14.14-32.21-19.29-49.35-11.3l-.4.19c-6.89,3.21-12.5,8.21-16.53,14.26l-23.41-50.2c-10.05-21.55-35.03-31.59-55.89-22.02-20.94,9.61-29.78,35.13-19.7,56.74l87.63,187.92-22.07-8.48c-21.8-8.38-45.71,2.77-53.31,24.86-6.79,19.75,1.88,42.37,20.17,52.62l.13.07c5.25,2.94,10.68,5.98,15.8,9.14l126.83,78.23c11.34,7,18.14,12.42,23.83,24.63l4.81,10.32c4.13,8.86,14.42,12.81,22.97,8.83l164.6-76.75c8.55-3.99,12.14-14.41,8-23.27l-11.79-25.29c-2.59-5.55-4.15-11.45-4.64-17.52l-3.44-31.16c-1.61-14.61-2.59-29.39-3.38-42.09-.46-7.41-2.29-14.6-5.44-21.36l-63.74-136.68c-4.87-10.44-13.36-18.42-23.92-22.47ZM323.56,248.22c-4.7-10.97-.22-23.36,10.24-28.24l.4-.19c10.63-4.95,23.4-.05,28.54,10.97l38.69,82.98c2.44,5.23,8.5,7.56,13.54,5.2l.19-.09c5.04-2.35,7.16-8.49,4.72-13.72-5.99-12.84-27.51-59.01-28.18-60.45-4.77-10.85-.22-23.59,10.16-28.43,5.14-2.4,10.94-2.58,16.33-.5,5.39,2.07,9.72,6.14,12.21,11.47l63.74,136.68c2,4.28,3.15,8.82,3.44,13.51.8,12.96,1.8,28.04,3.46,43.13l3.39,30.69c.71,8.6,2.93,16.95,6.6,24.8l10.36,22.22-158.66,73.98-3.38-7.24c-7.49-16.07-17.14-24.7-32.06-33.9l-126.83-78.23c-5.5-3.39-11.13-6.54-16.57-9.59l-.13-.07c-9.33-5.22-13.75-16.77-10.28-26.85,3.88-11.27,16.08-16.96,27.21-12.69l47.91,18.41c7.71,2.96,14.81-4.99,11.26-12.61l-99.4-213.16c-5.1-10.94-.98-23.98,9.5-29.07,10.67-5.18,23.66-.27,28.83,10.82l77.55,166.31c2.44,5.24,8.52,7.56,13.57,5.19l.17-.08c5.02-2.35,7.12-8.46,4.71-13.67-2.82-6.11-18.28-39.32-22.65-48.7-6.49-13.94-13.69-29.4-16.31-35.04-.61-1.32-1.08-2.72-1.31-4.16-1.55-9.45,3.15-18.95,11.78-22.97l.4-.19c10.63-4.95,23.4-.05,28.54,10.97l42.21,90.51c2.44,5.23,8.5,7.56,13.54,5.2h0c5.03-2.34,7.15-8.46,4.74-13.68l-32.19-69.56Z"
                />
                <path fill="#ffffff" d="M116.62,59.29c-5.18,2.41-7.41,8.57-5,13.74l17.67,37.89c2.41,5.18,8.57,7.41,13.74,5,5.18-2.41,7.41-8.57,5-13.74l-17.67-37.89c-2.41-5.18-8.57-7.41-13.74-5Z"/>
                <path fill="#ffffff" d="M56.88,132.77c-5.37-1.95-11.3.81-13.25,6.18h0c-1.95,5.37.81,11.3,6.18,13.25l39.29,14.3c5.37,1.95,11.3-.81,13.25-6.18h0c1.95-5.37-.81-11.3-6.18-13.25l-39.29-14.3Z"/>
                <path fill="#ffffff" d="M91.23,215.48l-37.89,17.67c-5.18,2.41-7.41,8.57-5,13.74h0c2.41,5.18,8.57,7.41,13.74,5l37.89-17.67c5.18-2.41,7.41-8.57,5-13.74h0c-2.41-5.18-8.57-7.41-13.74-5Z"/>
                <path fill="#ffffff" d="M290.48,122.57l-37.89,17.67c-5.18,2.41-7.41,8.57-5,13.74h0c2.41,5.18,8.57,7.41,13.74,5l37.89-17.67c5.18-2.41,7.41-8.57,5-13.74h0c-2.41-5.18-8.57-7.41-13.74-5Z"/>
                <path fill="#ffffff" d="M224.56,54.58h0c-5.37-1.95-11.3.81-13.25,6.18l-14.3,39.29c-1.95,5.37.81,11.3,6.18,13.25h0c5.37,1.95,11.3-.81,13.25-6.18l14.3-39.29c1.95-5.37-.81-11.3-6.18-13.25Z"/>
              </svg>
            </div>
          </div>

          <!-- Pasos e Instrucciones Detalladas -->
          <div class="w-full space-y-3 text-left bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5">
            <!-- Regla 1: Emparejar cartas -->
            <div class="flex items-start gap-3">
              <div class="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5">
                1
              </div>
              <p class="text-xs sm:text-sm text-white leading-relaxed">
                Toca dos cartas por turno para voltearlas y memorizar sus figuras. Si coinciden, quedarán descubiertas.
              </p>
            </div>

            <!-- Regla 2: Explicación de pérdida de vidas -->
            <div class="flex items-start gap-3">
              <div class="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5">
                2
              </div>
              <div class="text-xs sm:text-sm text-white leading-relaxed">
                <span class="font-bold text-white">Atención a tus vidas:</span>
                <span class="text-white ml-1">
                  Cada vez que falles y las dos cartas no coincidan, <strong class="font-bold text-white">perderás una vida</strong>. ¡Piensa bien cada movimiento!
                </span>
              </div>
            </div>

            <!-- Regla 3: Meta del juego -->
            <div class="flex items-start gap-3">
              <div class="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5">
                3
              </div>
              <p class="text-xs sm:text-sm text-white leading-relaxed">
                Encuentra todas las parejas antes de quedarte sin vidas para ganar la partida.
              </p>
            </div>
          </div>

          <!-- Botón de Cierre / ¡Entendido! con diseño Glass y borde blanco de la app -->
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
    .perspective-1000 {
      perspective: 1000px;
    }

    .demo-card-scene {
      transform-style: preserve-3d;
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .demo-face {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }

    .demo-face-front {
      transform: rotateY(180deg);
    }

    /* Animación continua de volteo de demostración */
    .demo-flip-anim-1 {
      animation: demoFlip1 4s ease-in-out infinite;
    }

    .demo-flip-anim-2 {
      animation: demoFlip2 4s ease-in-out infinite;
    }

    @keyframes demoFlip1 {
      0%, 15% { transform: rotateY(0deg); }
      25%, 80% { transform: rotateY(180deg); }
      90%, 100% { transform: rotateY(0deg); }
    }

    @keyframes demoFlip2 {
      0%, 40% { transform: rotateY(0deg); }
      50%, 80% { transform: rotateY(180deg); }
      90%, 100% { transform: rotateY(0deg); }
    }

    /* Animación de la mano guiando el toque */
    .demo-hand-track {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 4.5rem;
      height: 4.5rem;
      margin-top: -2.25rem;
      margin-left: -2.25rem;
      z-index: 30;
      animation: demoHandMove 4s ease-in-out infinite;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .demo-hand-idle {
      position: absolute;
      width: 100%;
      height: 100%;
      animation: demoHandIdleAnim 4s ease-in-out infinite;
    }

    .demo-hand-event {
      position: absolute;
      width: 100%;
      height: 100%;
      animation: demoHandEventAnim 4s ease-in-out infinite;
    }

    @keyframes demoHandMove {
      0% { transform: translate(-70px, 40px); opacity: 0; }
      10% { transform: translate(-70px, 15px); opacity: 1; }
      20% { transform: translate(-70px, 5px) scale(0.92); }
      25% { transform: translate(-70px, 15px) scale(1); }
      35% { transform: translate(50px, 35px); }
      45% { transform: translate(50px, 5px) scale(0.92); }
      50% { transform: translate(50px, 15px) scale(1); }
      75% { opacity: 1; }
      85%, 100% { transform: translate(50px, 50px); opacity: 0; }
    }

    /* Alternancia de la mano en reposo vs mano con evento de clic */
    @keyframes demoHandIdleAnim {
      0%, 17% { opacity: 1; }
      18%, 23% { opacity: 0; }
      24%, 42% { opacity: 1; }
      43%, 48% { opacity: 0; }
      49%, 100% { opacity: 1; }
    }

    @keyframes demoHandEventAnim {
      0%, 17% { opacity: 0; }
      18%, 23% { opacity: 1; }
      24%, 42% { opacity: 0; }
      43%, 48% { opacity: 1; }
      49%, 100% { opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .demo-flip-anim-1, .demo-flip-anim-2, .demo-hand-track {
        animation: none;
      }
      .demo-face-front {
        transform: rotateY(0deg);
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
export class MemoryTutorial {
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private _openTimer: ReturnType<typeof setTimeout> | null = null;

  /** Texto de instrucción desde la configuración o fallback. */
  readonly tutorialText = input<string>('Toca dos cartas y encuentra la pareja');
  /** Número de parejas del nivel. */
  readonly pairs = input<number>(4);
  /** URL del dorso de la carta de la marca. */
  readonly backUrl = input<string>('');
  /** URL de una cara de ejemplo para la animación. */
  readonly sampleFaceUrl = input<string>('');
  /** Color de acento de la experiencia. */
  readonly accentColor = input<string>('#00E5FF');
  /** Tinte de atmósfera de la marca (blurTint). */
  readonly blurTint = input<string | undefined>(undefined);

  /** Color de resplandor para box-shadow: blurTint o accentColor */
  protected readonly glowColor = computed<string>(() => this.blurTint() || this.accentColor() || '#00E5FF');

  /** Emite cuando el modal se cierra mediante su botón de acción. */
  readonly closed = output<void>();

  /** Estado visible del modal (inicialmente false hasta que se active explícitamente o al inicio). */
  readonly visible = signal(false);
  /** True mientras espera el delay del auto-show (el tablero ya está en pantalla). */
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
      // Entornos de prueba SSR / Vitest
    }
  }

  private _unlockScroll(): void {
    try {
      this.renderer.removeStyle(this.document.body, 'overflow');
    } catch {
      // Entornos de prueba SSR / Vitest
    }
  }
}
