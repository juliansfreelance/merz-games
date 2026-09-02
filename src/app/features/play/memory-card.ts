import {
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MemoryCardState } from '../../core/games/memory/memory.model';

/**
 * MemoryCard — Carta individual del juego de Memoria.
 *
 * Rendering: DOM + CSS 3D (`rotateY`, `backface-visibility`).
 * Respeta `prefers-reduced-motion`: sin volteo 3D, cambio directo de cara.
 *
 * Cada carta es un control enfocable con aria-label que NO revela la cara oculta.
 * touch-action correcto para no competir con scroll del host.
 */
@Component({
  selector: 'app-memory-card',
  host: {
    class: 'block',
    style: 'touch-action: manipulation;',
  },
  template: `
    <button
      type="button"
      class="card-container w-full relative select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer"
      [class.is-matched]="state() === 'matched'"
      [style.aspect-ratio]="aspectRatio()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-pressed]="state() !== 'hidden'"
      [attr.aria-disabled]="state() === 'matched'"
      [disabled]="state() === 'matched'"
      (pointerup)="onTap($event)"
    >
      <!-- Escena de volteo 3D -->
      <div
        class="card-scene w-full h-full relative"
        [class.is-flipped]="state() !== 'hidden'"
      >
        <!-- Dorso -->
        <div class="card-face card-back absolute inset-0 overflow-hidden border border-white/15 bg-white/5 backdrop-blur-sm flex items-center justify-center shadow-lg">
          @if (backUrl()) {
            <img
              [src]="backUrl()"
              alt=""
              aria-hidden="true"
              class="w-full h-full object-cover"
              (error)="onImgError($event)"
            />
          } @else {
            <!-- Fallback: dorso genérico con signo de interrogación -->
            <div
              class="w-full h-full flex items-center justify-center text-white/30"
              [style.background]="'linear-gradient(135deg, ' + accentColor() + '22, ' + accentColor() + '44)'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 opacity-60">
                <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 0 1-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 0 1-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 0 1-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584ZM12 18a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd"/>
              </svg>
            </div>
          }
        </div>

        <!-- Cara frontal -->
        <div
          class="card-face card-front absolute inset-0 overflow-hidden border shadow-xl flex items-center justify-center"
          [style.border-color]="state() === 'matched' ? matchTint() : 'rgba(255,255,255,0.2)'"
        >
          @if (faceUrl()) {
            <img
              [src]="faceUrl()"
              [alt]="'Carta ' + pairKey()"
              class="card-art w-full h-full object-cover"
              (error)="onImgError($event)"
            />
          } @else {
            <!-- Placeholder si la imagen falla -->
            <div class="card-art w-full h-full flex items-center justify-center bg-white/10 text-white/40 text-2xl font-bold">
              {{ pairKey() }}
            </div>
          }

          <!-- Overlay de acierto: borde y glow con blurTint de la marca -->
          @if (state() === 'matched') {
            <div
              class="match-overlay absolute inset-0 pointer-events-none"
              [style.box-shadow]="'inset 0 0 0 2px ' + matchTint() + ', 0 0 18px ' + matchTint() + '99'"
            ></div>
          }
        </div>
      </div>
    </button>
  `,
  styles: [`
    .card-scene {
      perspective: 600px;
      transform-style: preserve-3d;
    }

    .card-face {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .card-back {
      transform: rotateY(0deg);
    }

    .card-front {
      transform: rotateY(180deg);
      transition:
        transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
        border-color 0.3s ease-out 0.35s;
    }

    .is-flipped .card-back {
      transform: rotateY(-180deg);
    }

    .is-flipped .card-front {
      transform: rotateY(0deg);
    }

    /* prefers-reduced-motion: sin rotación 3D */
    @media (prefers-reduced-motion: reduce) {
      .card-face {
        transition: none;
      }
      .card-back {
        display: block;
      }
      .card-front {
        transform: rotateY(0deg);
        display: none;
      }
      .is-flipped .card-back {
        transform: rotateY(0deg);
        display: none;
      }
      .is-flipped .card-front {
        display: block;
      }
    }

    /* Match visual DESPUÉS del volteo (0.35s): el pulso no pisa rotateY de las caras */
    .card-art {
      transition: opacity 0.4s ease-out 0.35s;
    }

    .is-matched {
      animation: matchedPulse 0.5s ease-out 0.35s both;
    }

    .is-matched .card-art {
      opacity: 0.48;
    }

    .match-overlay {
      opacity: 0;
      animation: matchOverlayIn 0.3s ease-out 0.35s forwards;
    }

    @keyframes matchedPulse {
      0%   { transform: scale(1); }
      45%  { transform: scale(1.045); }
      100% { transform: scale(1); }
    }

    @keyframes matchOverlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .is-matched,
      .match-overlay,
      .card-art,
      .card-front {
        animation: none;
        transition: none;
      }
      .match-overlay {
        opacity: 1;
      }
    }
  `],
})
export class MemoryCard {
  readonly cardId   = input.required<string>();
  readonly pairKey  = input.required<string>();
  readonly state    = input.required<MemoryCardState>();
  readonly faceUrl  = input<string>('');
  readonly backUrl  = input<string>('');
  /** Color de acento de la experiencia (hex). */
  readonly accentColor = input<string>('#00E5FF');
  /** Tinte de atmósfera de la marca (blurTint). Si falta, se usa accentColor. */
  readonly blurTint = input<string | undefined>(undefined);
  /** Relación de aspecto de las cartas como fracción CSS (default 400/318 ≈ 1.26). */
  readonly aspectRatio = input<string>('400 / 318');

  readonly flip = output<string>();

  protected readonly matchTint = computed(() => this.blurTint() || this.accentColor());

  protected readonly ariaLabel = computed(() => {
    const s = this.state();
    if (s === 'matched') return `Carta emparejada`;
    if (s === 'revealed') return `Carta revelada`;
    return `Carta oculta — toca para revelar`;
  });

  protected onTap(event: PointerEvent): void {
    event.preventDefault();
    if (this.state() === 'matched' || this.state() === 'revealed') return;
    this.flip.emit(this.cardId());
  }

  protected onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}
