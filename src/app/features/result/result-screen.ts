import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { isValidPlayResult, PlayResult } from '../../core/catalog/play-result.model';
import { CatalogService } from '../../core/catalog/catalog';
import { UnavailableScreen } from '../shared/unavailable-screen';
import { KioskButton } from '../shared/kiosk-button';
import { KioskDisclaimer } from '../shared/kiosk-disclaimer';

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

/**
 * Pantalla de resultado genérica con breakpoint responsivo para 1080x1920 (kiosco 55").
 */
@Component({
  selector: 'app-result-screen',
  imports: [UnavailableScreen, KioskButton, KioskDisclaimer],
  host: {
    class: 'block w-full h-full min-h-0 overflow-y-auto overscroll-contain',
  },
  template: `
    @if (config()) {
      <div class="flex flex-col items-center justify-between min-h-full w-full px-6 sm:px-12 lg:px-16 py-6 sm:py-8 text-white select-none gap-6">

        <!-- Resultado y cuerpo central -->
        <div class="flex-1 flex flex-col items-center justify-center text-center gap-6 sm:gap-8 kiosk:gap-12 max-w-xl kiosk:max-w-2xl my-auto">

          <div class="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 kiosk:w-48 kiosk:h-48 rounded-3xl kiosk:rounded-[2.5rem] bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-black/50">
            <span class="text-5xl sm:text-6xl lg:text-7xl kiosk:text-8xl" role="img" [attr.aria-label]="config()!.title">
              {{ config()!.icon }}
            </span>
          </div>

          <div class="space-y-4 sm:space-y-6 kiosk:space-y-8">
            <h1 class="text-3xl sm:text-5xl lg:text-6xl kiosk:text-7xl font-extrabold tracking-tight" [class]="config()!.accentClass">
              {{ config()!.title }}
            </h1>
            <p class="text-neutral-300 text-sm sm:text-lg lg:text-xl kiosk:text-2xl leading-relaxed max-w-sm sm:max-w-md kiosk:max-w-xl mx-auto">
              {{ config()!.message }}
            </p>
          </div>

          @if (brandName()) {
            <span class="inline-flex items-center gap-1.5 px-4 py-1.5 sm:px-6 sm:py-2.5 rounded-full text-xs sm:text-sm kiosk:text-base font-extrabold tracking-[0.2em] uppercase bg-white/10 text-neutral-200 border border-white/15 backdrop-blur-md [&>span>sup]:text-[0.6em] [&>span>sup]:top-[-0.4em] [&>span>sup]:font-normal">
              <span [innerHTML]="brandName()"></span> · <span [innerHTML]="gameName()"></span>
            </span>
          }

        </div>

        <!-- Sticky Footer unificado con CTAs y disclaimers -->
        <app-kiosk-disclaimer>
          <div class="w-full max-w-xs sm:max-w-md lg:max-w-lg space-y-2 sm:space-y-3">
            <!-- Replay si hubo derrota o sin intentos -->
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
        </app-kiosk-disclaimer>

      </div>
    } @else {
      <app-unavailable-screen
        title="Resultado desconocido"
        message="El resultado de este juego no es válido."
      />
    }
  `,
})
export class ResultScreen {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);

  private readonly params = toSignal(
    this.route.paramMap.pipe(
      map((p) => ({
        experienceId: p.get('experienceId') ?? '',
        result: p.get('result') ?? '',
      })),
    ),
    { initialValue: { experienceId: '', result: '' } },
  );

  protected readonly result = computed(() => {
    const r = this.params().result;
    return isValidPlayResult(r) ? r : null;
  });

  protected readonly config = computed<ResultConfig | null>(() => {
    const r = this.result();
    return r ? RESULT_CONFIGS[r] : null;
  });

  private readonly experience = computed(() =>
    this.catalog.getExperienceById(this.params().experienceId),
  );

  protected brandName(): string {
    const exp = this.experience();
    return exp ? (this.catalog.getBrandById(exp.brandId)?.name ?? exp.brandId) : '';
  }

  protected gameName(): string {
    const exp = this.experience();
    return exp ? (this.catalog.getGameById(exp.gameId)?.name ?? exp.gameId) : '';
  }

  replay(): void {
    this.router.navigate(['/play', this.params().experienceId]);
  }

  goToExperiences(): void {
    const exp = this.experience();
    if (exp) {
      this.router.navigate(['/brands', exp.brandId, 'games']);
    } else {
      this.router.navigate(['/brands']);
    }
  }

  goToBrands(): void {
    this.router.navigate(['/brands']);
  }
}
