import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { isValidPlayResult, PlayResult } from '../../core/catalog/play-result.model';
import { CatalogService } from '../../core/catalog/catalog';
import { UnavailableScreen } from '../shared/unavailable-screen';
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
    accentClass: 'text-yellow-400',
  },
  lose: {
    icon: '🎯',
    title: '¡Sigue intentándolo!',
    message: 'Esta vez no fue, pero la próxima puede ser tuya. ¡Vuelve a intentarlo!',
    accentClass: 'text-blue-400',
  },
  'out-of-lives': {
    icon: '⏱️',
    title: 'Sin más intentos',
    message: 'Agotaste tus intentos para esta sesión. ¡Vuelve a jugar pronto!',
    accentClass: 'text-neutral-400',
  },
};

/**
 * Pantalla de resultado genérica.
 * Maneja los tres estados: win, lose, out-of-lives.
 * Sin stock de premios, sin PII, sin datos concretos.
 * Resultado inválido → UnavailableScreen.
 */
@Component({
  selector: 'app-result-screen',
  imports: [UnavailableScreen, KioskButton],
  template: `
    @if (config()) {
      <div class="flex flex-col items-center justify-between h-full w-full px-8 py-16 bg-neutral-950 text-white">

        <!-- Resultado -->
        <div class="flex-1 flex flex-col items-center justify-center text-center gap-6">

          <span class="text-7xl" role="img" [attr.aria-label]="config()!.title">
            {{ config()!.icon }}
          </span>

          <div class="space-y-4">
            <h1 class="text-4xl font-extrabold" [class]="config()!.accentClass">
              {{ config()!.title }}
            </h1>
            <p class="text-neutral-400 text-base leading-relaxed max-w-xs">
              {{ config()!.message }}
            </p>
          </div>

          @if (brandName()) {
            <p class="text-neutral-600 text-sm">
              {{ brandName() }} · {{ gameName() }}
            </p>
          }

        </div>

        <!-- CTAs -->
        <div class="w-full max-w-xs space-y-3">
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
