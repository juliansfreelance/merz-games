import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  Renderer2,
  DOCUMENT,
} from '@angular/core';
import { Router } from '@angular/router';
import confetti from 'canvas-confetti';
import { PlayResult } from '../../core/catalog/play-result.model';
import { CatalogService } from '../../core/catalog/catalog';
import { GameSession } from '../../core/session/game-session';
import { KioskButton } from '../shared/kiosk-button';

interface ResultConfig {
  icon: string;
  title: string;
  message: string;
  accentClass: string;
}

const RESULT_CONFIGS: Record<PlayResult, ResultConfig> = {
  win: {
    icon: '🏆',
    title: '¡Ganaste un premio!',
    message: 'Felicitaciones por tu participación. Acércate al equipo de Merz Aesthetics para reclamar tu premio.',
    accentClass: 'text-amber-300 drop-shadow-[0_0_16px_rgba(252,211,77,0.5)]',
  },
  lose: {
    icon: '🎯',
    title: '¡Sigue intentándolo!',
    message: 'Esta vez no fue, pero la próxima puede ser tuya. ¡Vuelve a intentarlo!',
    accentClass: 'text-sky-300 drop-shadow-[0_0_16px_rgba(125,211,252,0.5)]',
  },
  'out-of-lives': {
    icon: '⏱️',
    title: 'Sin más intentos',
    message: 'Agotaste tus intentos para esta sesión. ¡Vuelve a jugar pronto!',
    accentClass: 'text-neutral-300',
  },
};

/** Duración del efecto Fireworks de canvas-confetti. */
const FIREWORKS_DURATION_MS = 15_000;

/**
 * Overlay de resultado (victoria / derrota / sin vidas).
 * Backdrop a pantalla completa con blur glass, igual que el tutorial de memoria.
 * Se superpone a `/play` sin navegar a otra ruta.
 */
@Component({
  selector: 'app-result-screen',
  imports: [KioskButton],
  template: `
    <div
      class="result-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style="background: rgba(3, 7, 18, 0.52); backdrop-filter: blur(16px);"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="config().title"
      animate.enter="result-overlay-enter"
      (click)="stopPropagation($event)"
    >
      <div
        class="result-card relative w-full max-w-lg bg-neutral-900/80 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-6 text-center select-none"
        animate.enter="result-card-enter"
      >
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-black/50">
          <span class="text-4xl sm:text-5xl" role="img" [attr.aria-hidden]="true">
            {{ config().icon }}
          </span>
        </div>

        <div class="space-y-3 sm:space-y-4">
          <h1
            class="text-2xl sm:text-3xl font-extrabold font-['Montserrat'] tracking-tight uppercase"
            [class]="config().accentClass"
          >
            {{ config().title }}
          </h1>
          <p class="text-neutral-300 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
            {{ config().message }}
          </p>
        </div>

        @if (brandName()) {
          <span class="inline-flex items-center gap-1.5 px-4 py-1.5 sm:px-6 sm:py-2 rounded-full text-xs sm:text-sm font-extrabold tracking-[0.2em] uppercase bg-white/10 text-neutral-200 border border-white/15 backdrop-blur-md [&>span>sup]:text-[0.6em] [&>span>sup]:top-[-0.4em] [&>span>sup]:font-normal">
            <span [innerHTML]="brandName()"></span> · <span [innerHTML]="gameName()"></span>
          </span>
        }

        <div class="w-full space-y-2 sm:space-y-3 pt-1">
          @if (result() !== 'win') {
            <app-kiosk-button variant="primary" (click)="replay()">
              Volver a jugar
            </app-kiosk-button>
          }
          <app-kiosk-button variant="secondary" (click)="goToExperiences()">
            Ver más juegos
          </app-kiosk-button>
          <app-kiosk-button variant="ghost" (click)="goToBrands()">
            ← Cambiar de marca
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

    @media (prefers-reduced-motion: reduce) {
      .result-overlay-enter,
      .result-card-enter {
        animation: none;
      }
    }
  `],
})
export class ResultScreen {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly session = inject(GameSession);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);

  readonly result = input.required<PlayResult>();
  readonly experienceId = input.required<string>();
  readonly brandName = input<string>('');
  readonly gameName = input<string>('');

  protected readonly config = computed<ResultConfig>(() => RESULT_CONFIGS[this.result()]);

  private _fireworksTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this._lockScroll();
    inject(DestroyRef).onDestroy(() => {
      this._unlockScroll();
      this._stopFireworks();
    });

    afterNextRender(() => {
      if (this.result() === 'win') {
        this._startFireworks();
      }
    });
  }

  protected stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  replay(): void {
    this._stopFireworks();
    this.session.start(this.experienceId());
  }

  goToExperiences(): void {
    this._stopFireworks();
    this.session.dismissResult();
    const exp = this.catalog.getExperienceById(this.experienceId());
    if (exp) {
      this.router.navigate(['/brands', exp.brandId, 'games']);
    } else {
      this.router.navigate(['/brands']);
    }
  }

  goToBrands(): void {
    this._stopFireworks();
    this.session.dismissResult();
    this.router.navigate(['/brands']);
  }

  /**
   * Fireworks de canvas-confetti: ráfagas desde los lados para no tapar el centro.
   * @see https://www.kirilv.com/canvas-confetti/
   */
  private _startFireworks(): void {
    this._stopFireworks();

    const duration = FIREWORKS_DURATION_MS;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 60,
      disableForReducedMotion: true,
    };

    const randomInRange = (min: number, max: number): number =>
      Math.random() * (max - min) + min;

    this._fireworksTimer = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        this._stopFireworks();
        return;
      }

      const particleCount = 50 * (timeLeft / duration);
      void confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      void confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  }

  private _stopFireworks(): void {
    if (this._fireworksTimer !== null) {
      clearInterval(this._fireworksTimer);
      this._fireworksTimer = null;
    }
    try {
      confetti.reset();
    } catch {
      // jsdom / entornos sin canvas
    }
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
