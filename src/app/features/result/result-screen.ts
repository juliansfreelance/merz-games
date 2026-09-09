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
import { HeroIcon } from '../shared/hero-icon';
import { MediaPlayer } from '../../core/media/media-player';
import { ExperienceResultText } from '../../core/catalog/game-experience.model';

const RESULT_SFX: Record<PlayResult, string> = {
  win: '/content/audio/sfx/game-win.mp3',
  lose: '/content/audio/sfx/game-lose.mp3',
  draw: '/content/audio/sfx/game-draw.mp3',
  'out-of-lives': '/content/audio/sfx/game-lose.mp3',
};

const RESULT_ICONS: Record<PlayResult, string> = {
  win: '/content/images/experiences/result/win.png',
  lose: '/content/images/experiences/result/die.png',
  'out-of-lives': '/content/images/experiences/result/lose.png',
  draw: '/content/images/experiences/result/draw.png',
};

const DEFAULT_RESULT_TEXTS: Record<PlayResult, Required<ExperienceResultText>> = {
  win: {
    title: '¡GANASTE!',
    description: 'Completaste el reto con éxito.<br>Gracias por ser parte de esta experiencia Merz Aesthetics.',
    note: 'Conquistaste el tablero y descubriste más sobre nuestros tratamientos.',
  },
  lose: {
    title: 'PERDISTE ESTA RONDA',
    description: 'La máquina ganó esta jugada.<br>Te quedan {lives} oportunidades.<br>Concéntrate y sigue jugando.',
    note: 'Aún puedes recuperarte en la siguiente ronda.<br>Ajusta tu estrategia y vuelve a intentarlo.',
  },
  'out-of-lives': {
    title: 'SIN MÁS INTENTOS',
    description: 'Agotaste tus intentos en esta sesión.<br>Vuelve a intentarlo pronto y sigue descubriendo más del universo de la estética.',
    note: 'Aún puedes volver a jugar o descubrir más experiencias Merz Aesthetics.',
  },
  draw: {
    title: '¡EMPATE!',
    description: 'La ronda terminó en empate.<br>Te quedan {lives} oportunidades.<br>Pon atención y sigue jugando.',
    note: 'Ninguno logró cerrar la jugada.<br>Prepárate para la siguiente ronda.',
  },
};

/** Duración del efecto Fireworks de canvas-confetti. */
const FIREWORKS_DURATION_MS = 15_000;

/**
 * Overlay de resultado (victoria / derrota / sin vidas / empate).
 * Remaquetado para coincidir con los mocks de la marca y permitir textos customizables.
 */
@Component({
  selector: 'app-result-screen',
  imports: [KioskButton, HeroIcon],
  template: `
    <div
      class="result-overlay result-overlay-enter fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style="background: rgba(3, 7, 18, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="titleText()"
      animate.enter="result-overlay-enter"
      (click)="stopPropagation($event)"
    >
      <div
        class="result-card result-card-enter relative w-full max-w-lg bg-neutral-900/90 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-5 text-center select-none backdrop-blur-xl"
        animate.enter="result-card-enter"
      >
        <!-- Logo Merz Aesthetics -->
        <img
          src="/content/images/MerzAestheticsLogo.svg"
          alt="Merz Aesthetics Logo"
          class="h-4 sm:h-5 w-auto mx-auto opacity-90 select-none pointer-events-none mb-1 sm:mb-2"
        />

        <!-- Marca / Juego (Salto de línea, marca destacada) -->
        @if (brandName()) {
          <div class="flex flex-col items-center justify-center gap-1.5 uppercase tracking-widest select-none mb-2 sm:mb-4 [&>span>sup]:text-[0.6em] [&>span>sup]:top-[-0.4em]">
            <span class="text-lg sm:text-xl font-black text-white" [innerHTML]="brandName()"></span>
            @if (gameName()) {
              <span class="inline-flex items-center justify-center gap-2 flex-wrap">
                <span class="text-xs sm:text-sm font-semibold text-neutral-300" [innerHTML]="gameName()"></span>
                @if (develop()) {
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-amber-500/25 text-amber-300 border border-amber-400/40 normal-case">
                    Beta
                  </span>
                }
              </span>
            }
          </div>
        }

        <!-- Imagen del Resultado (sin background, bordes ni efectos) -->
        <img
          [src]="iconUrl()"
          [alt]="result()"
          loading="eager"
          decoding="async"
          class="w-full h-36 sm:h-44 object-contain pointer-events-none select-none"
        />

        <!-- Título y Descripción -->
        <div class="space-y-2 sm:space-y-3 w-full">
          <h1
            class="text-2xl sm:text-3xl font-extrabold font-['Montserrat'] tracking-tight text-white uppercase [&>strong]:font-black [&>sup]:text-[0.6em] [&>sup]:top-[-0.4em]"
            [innerHTML]="titleText()"
          ></h1>
          <p
            class="text-neutral-300 text-sm sm:text-base leading-relaxed max-w-md mx-auto [&>strong]:font-bold [&>strong]:text-white [&>sup]:text-[0.6em] [&>sup]:top-[-0.4em]"
            [innerHTML]="descriptionText()"
          ></p>
        </div>

        <!-- Nota / Texto adicional de resultado -->
        @if (noteText()) {
          <p
            class="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-normal [&>strong]:font-semibold [&>strong]:text-neutral-200 [&>sup]:text-[0.6em] [&>sup]:top-[-0.4em]"
            [innerHTML]="noteText()"
          ></p>
        }

        <!-- Botones de Acción -->
        <div class="w-full space-y-2.5 sm:space-y-3 pt-1">
          @if (result() === 'draw' || result() === 'lose') {
            <app-kiosk-button variant="primary" (click)="nextRound()">
              Siguiente ronda
            </app-kiosk-button>
          } @else if (result() === 'out-of-lives') {
            <app-kiosk-button variant="primary" (click)="replay()">
              Volver a jugar
            </app-kiosk-button>
            <app-kiosk-button variant="secondary" (click)="goToExperiences()">
              Ver más juegos
            </app-kiosk-button>
            <app-kiosk-button variant="ghost" (click)="goToBrands()">
              <app-hero-icon name="arrow-left" />
              Cambiar de marca
            </app-kiosk-button>
          } @else {
            <app-kiosk-button variant="primary" (click)="goToExperiences()">
              Ver más juegos
            </app-kiosk-button>
            <app-kiosk-button variant="ghost" (click)="goToBrands()">
              <app-hero-icon name="arrow-left" />
              Cambiar de marca
            </app-kiosk-button>
          }
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
  private readonly media = inject(MediaPlayer);

  readonly result = input.required<PlayResult>();
  readonly experienceId = input.required<string>();
  readonly brandName = input<string>('');
  readonly gameName = input<string>('');
  /** Experiencia en fase beta / desarrollo. */
  readonly develop = input<boolean>(false);

  protected readonly experience = computed(() =>
    this.catalog.getExperienceById(this.experienceId()),
  );

  protected readonly iconUrl = computed<string>(() => RESULT_ICONS[this.result()]);

  private readonly customConfig = computed(() =>
    this.experience()?.results?.[this.result()],
  );

  protected readonly titleText = computed<string>(() => {
    return this.customConfig()?.title ?? DEFAULT_RESULT_TEXTS[this.result()].title;
  });

  protected readonly descriptionText = computed<string>(() => {
    const raw = this.customConfig()?.description ?? DEFAULT_RESULT_TEXTS[this.result()].description;
    const lives = this.session.remainingLives();
    if (lives === 1) {
      return raw
        .replace(/Te quedan\s*\{lives\}\s*oportunidades/gi, 'Te queda 1 oportunidad')
        .replace(/\{lives\}\s*oportunidades/gi, '1 oportunidad')
        .replace(/\{lives\}/g, '1');
    }
    return raw.replace(/\{lives\}/g, lives.toString());
  });

  protected readonly noteText = computed<string>(() => {
    return this.customConfig()?.note ?? DEFAULT_RESULT_TEXTS[this.result()].note;
  });

  private _fireworksTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this._lockScroll();
    inject(DestroyRef).onDestroy(() => {
      this._unlockScroll();
      this._stopFireworks();
    });

    afterNextRender(() => {
      this.media.playSfx(RESULT_SFX[this.result()]);
      if (this.result() === 'win') {
        this._startFireworks();
      }
    });
  }

  protected stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  nextRound(): void {
    this._stopFireworks();
    this.session.nextRound();
  }

  replay(): void {
    this._stopFireworks();
    this.session.start(this.experienceId());
  }

  goToExperiences(): void {
    this._stopFireworks();
    this.session.leavePlay();
    const exp = this.experience();
    if (exp) {
      this.router.navigate(['/brands', exp.brandId, 'games']);
    } else {
      this.router.navigate(['/brands']);
    }
  }

  goToBrands(): void {
    this._stopFireworks();
    this.session.leavePlay();
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

