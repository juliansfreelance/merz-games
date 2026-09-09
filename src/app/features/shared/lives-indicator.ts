import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

export interface DisplayHeart {
  readonly index: number;
  readonly state: 'active' | 'losing';
}

@Component({
  selector: 'app-lives-indicator',
  standalone: true,
  template: `
    <div
      class="flex items-center gap-2 sm:gap-2.5"
      role="status"
      [attr.aria-label]="remainingLives() + ' intentos'"
    >
      @if (isCompact()) {
        <!-- Modo compacto para más de 3 vidas: ❤️ × N -->
        <div class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="w-7 h-7 sm:w-8 sm:h-8 text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.7)] transition-transform duration-200"
            [class.animate-heart-pulse]="singleHeartPulse()"
            aria-hidden="true"
          >
            <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3.5 7.02 3.5c1.82 0 3.393 1.056 4.23 2.593.837-1.537 2.41-2.593 4.23-2.593 2.306 0 4.77 1.822 4.77 4.75 0 3.924-2.438 7.11-4.739 9.266a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
          </svg>
          <span class="text-white font-extrabold text-sm sm:text-base tabular-nums tracking-wide">
            × {{ remainingLives() }}
          </span>
        </div>
      } @else {
        <!-- Modo individual para 3 vidas o menos: corazones individuales consumidos de derecha a izquierda -->
        <div class="flex items-center gap-2">
          @for (heart of individualHearts(); track heart.index) {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="w-6 h-6 sm:w-7 sm:h-7 transition-all duration-300 select-none"
              [class.text-rose-500]="heart.state === 'active'"
              [class.drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]]="heart.state === 'active'"
              [class.text-rose-800]="heart.state === 'losing'"
              [class.opacity-70]="heart.state === 'losing'"
              [class.animate-heart-pulse]="heart.state === 'losing'"
              aria-hidden="true"
            >
              <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3.5 7.02 3.5c1.82 0 3.393 1.056 4.23 2.593.837-1.537 2.41-2.593 4.23-2.593 2.306 0 4.77 1.822 4.77 4.75 0 3.924-2.438 7.11-4.739 9.266a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes life-heart-lost {
      0% {
        transform: scale(1);
      }
      25% {
        transform: scale(1.35);
      }
      50% {
        transform: scale(0.85);
      }
      75% {
        transform: scale(1.2);
      }
      100% {
        transform: scale(1);
      }
    }

    .animate-heart-pulse {
      animation: life-heart-lost 450ms ease-in-out forwards;
    }

    @media (prefers-reduced-motion: reduce) {
      .animate-heart-pulse {
        animation: none;
      }
    }
  `],
})
export class LivesIndicator {
  readonly remainingLives = input.required<number>();
  readonly maxLives = input<number>(3);
  readonly compactAbove = input<number>(3);

  private readonly destroyRef = inject(DestroyRef);
  private _pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private _losingTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastLives: number | null = null;

  protected readonly singleHeartPulse = signal(false);
  protected readonly losingHeartIndex = signal<number | null>(null);

  protected readonly isCompact = computed(() => {
    return this.remainingLives() > this.compactAbove();
  });

  protected readonly individualHearts = computed<readonly DisplayHeart[]>(() => {
    const lives = this.remainingLives();
    const losingIdx = this.losingHeartIndex();
    const list: DisplayHeart[] = [];

    for (let i = 0; i < lives; i++) {
      list.push({ index: i, state: 'active' });
    }

    if (losingIdx !== null && losingIdx >= lives) {
      list.push({ index: losingIdx, state: 'losing' });
    }

    return list;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this._pulseTimer) clearTimeout(this._pulseTimer);
      if (this._losingTimer) clearTimeout(this._losingTimer);
    });

    effect(() => {
      const current = this.remainingLives();
      const prev = this._lastLives;
      this._lastLives = current;

      if (prev === null) return; // Inicialización
      if (current >= prev) return; // No es una pérdida de vida

      // Se perdió una vida
      if (prev > this.compactAbove()) {
        // En modo compacto o transicionando de >3: animar el corazón único
        this.singleHeartPulse.set(true);
        if (this._pulseTimer) clearTimeout(this._pulseTimer);
        this._pulseTimer = setTimeout(() => {
          this.singleHeartPulse.set(false);
          this._pulseTimer = null;
        }, 450);
      } else {
        // En modo individual: marcar el corazón que desaparece (orden de derecha a izquierda)
        const dyingIndex = prev - 1;
        this.losingHeartIndex.set(dyingIndex);
        if (this._losingTimer) clearTimeout(this._losingTimer);
        this._losingTimer = setTimeout(() => {
          this.losingHeartIndex.set(null);
          this._losingTimer = null;
        }, 450);
      }
    });
  }
}
