import {
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CellIndex, Mark } from '../../core/games/triqui/triqui.model';
import { AssetSrc } from '../../core/platform/asset-src';

/**
 * Celda individual táctil del tablero 3×3 de Triqui.
 * - Soporta eventos de puntero (ratón y toque unificados).
 * - Objetivos de toque amplios para pantallas de 55" en kiosco.
 * - Renderizado de marca (X u O) con imagen o fallback vectorial.
 * - Resaltado de línea ganadora con glow del acento/blurTint.
 * - Accesibilidad semántica con role="gridcell" y etiquetas ARIA descriptivas.
 */
@Component({
  selector: 'app-triqui-cell',
  imports: [AssetSrc],
  host: {
    class: 'relative flex items-center justify-center aspect-square w-full h-full select-none',
  },
  template: `
    <button
      type="button"
      role="gridcell"
      [attr.aria-label]="ariaLabel()"
      [disabled]="disabled() || mark() !== null"
      (pointerup)="onClick()"
      class="relative w-full h-full rounded-2xl sm:rounded-3xl border-2 transition-all duration-200 flex items-center justify-center overflow-hidden cursor-pointer touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      [class.cursor-not-allowed]="disabled() || mark() !== null"
      [class.border-dashed]="!isWinning()"
      [class.border-white/20]="!isWinning()"
      [class.border-solid]="isWinning()"
      [class.border-white/70]="isWinning()"
      [class.bg-white/[0.03]]="!isWinning() && mark() === null"
      [class.hover:bg-white/[0.07]]="!disabled() && mark() === null"
      [class.active:scale-95]="!disabled() && mark() === null"
      [class.bg-white/[0.06]]="!isWinning() && mark() !== null"
      [class.scale-[1.03]]="isWinning()"
      [class.z-10]="isWinning()"
      [style.box-shadow]="isWinning() ? winningGlow() : 'none'"
      [style.background]="isWinning() ? winningBackground() : ''"
    >
      @if (mark() === 'X') {
        @if (markXUrl()) {
          <img
            [src]="markXUrl()"
            alt="X"
            class="w-3/4 h-3/4 object-contain animate-mark-pop pointer-events-none select-none drop-shadow-md"
          />
        } @else {
          <span
            class="text-4xl sm:text-5xl lg:text-6xl font-black font-['Montserrat'] text-white animate-mark-pop pointer-events-none select-none drop-shadow-lg"
            [style.color]="accentColor()"
          >
            ✕
          </span>
        }
      } @else if (mark() === 'O') {
        @if (markOUrl()) {
          <img
            [src]="markOUrl()"
            alt="O"
            class="w-3/4 h-3/4 object-contain animate-mark-pop pointer-events-none select-none drop-shadow-md"
          />
        } @else {
          <span
            class="text-4xl sm:text-5xl lg:text-6xl font-black font-['Montserrat'] text-neutral-200 animate-mark-pop pointer-events-none select-none drop-shadow-lg"
          >
            ○
          </span>
        }
      }
    </button>
  `,
  styles: [`
    @keyframes markPop {
      0% {
        transform: scale(0.4) rotate(-10deg);
        opacity: 0;
      }
      70% {
        transform: scale(1.1) rotate(2deg);
        opacity: 1;
      }
      100% {
        transform: scale(1) rotate(0deg);
        opacity: 1;
      }
    }

    .animate-mark-pop {
      animation: markPop 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }

    @media (prefers-reduced-motion: reduce) {
      .animate-mark-pop {
        animation: none;
      }
    }
  `],
})
export class TriquiCell {
  readonly index = input.required<CellIndex>();
  readonly mark = input<Mark | null>(null);
  readonly markXUrl = input<string>('');
  readonly markOUrl = input<string>('');
  readonly accentColor = input<string>('#00E5FF');
  readonly blurTint = input<string | undefined>(undefined);
  readonly isWinning = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  readonly cellClick = output<CellIndex>();

  protected readonly ariaLabel = computed<string>(() => {
    const idx = this.index();
    const row = Math.floor(idx / 3) + 1;
    const col = (idx % 3) + 1;
    const m = this.mark();

    if (m === 'X') return `Tu marca X en fila ${row}, columna ${col}`;
    if (m === 'O') return `Marca de la computadora O en fila ${row}, columna ${col}`;
    return `Casilla vacía en fila ${row}, columna ${col}`;
  });

  protected readonly winningGlow = computed<string>(() => {
    const color = this.blurTint() || this.accentColor();
    return `0 0 28px ${color}88, inset 0 0 16px ${color}33`;
  });

  protected readonly winningBackground = computed<string>(() => {
    const color = this.blurTint() || this.accentColor();
    return `radial-gradient(circle at center, ${color}22 0%, rgba(255,255,255,0.08) 100%)`;
  });

  protected onClick(): void {
    if (this.disabled() || this.mark() !== null) return;
    this.cellClick.emit(this.index());
  }
}
