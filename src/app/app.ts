import { Component, computed, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { PlatformService } from './core/platform/platform.service';
import { CatalogService } from './core/catalog/catalog';
import { MediaPlayer } from './core/media/media-player';
import { FloatingGradient } from './features/shared/floating-gradient';
import { Atmosphere } from './core/catalog/content-manifest.model';

/** Volumen de BGM por defecto si el manifest no especifica uno. */
const DEFAULT_BGM_VOLUME = 0.35;

@Component({
  imports: [RouterOutlet, FloatingGradient],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: {
    // El primer pointerup en cualquier punto del shell desbloquea el BGM.
    // Solo el primer gesto real del usuario activa el audio (requisito de autoplay).
    '(pointerup)': 'onFirstGesture()',
  },
})
export class App {
  private readonly platformService = inject(PlatformService);
  private readonly catalog = inject(CatalogService);
  private readonly mediaPlayer = inject(MediaPlayer);
  private readonly router = inject(Router);

  protected readonly appVersion = this.platformService.appVersion;

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects || (e as NavigationEnd).url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Resuelve la atmósfera viva según la ruta activa y el catálogo.
   * Cero ramificaciones `if (brandId === 'radiesse')`.
   */
  protected readonly currentAtmosphere = computed<Atmosphere>(() => {
    const url = this.currentUrl();

    // 1. Selector de juegos de una marca: /brands/:brandId/games
    const brandGamesMatch = url.match(/^\/brands\/([^/]+)\/games/);
    if (brandGamesMatch) {
      return this.catalog.atmosphereForBrand(brandGamesMatch[1]);
    }

    // 2. Ejecución de un juego: /play/:experienceId
    const playMatch = url.match(/^\/play\/([^/]+)/);
    if (playMatch) {
      return this.catalog.atmosphereForExperience(playMatch[1]);
    }

    // 3. Resultado de juego: /result/:experienceId/:result
    const resultMatch = url.match(/^\/result\/([^/]+)/);
    if (resultMatch) {
      return this.catalog.atmosphereForExperience(resultMatch[1]);
    }

    // 4. Default institucional: /, /welcome, /brands, unavailable
    return this.catalog.defaultAtmosphere();
  });

  /**
   * Resuelve el disclaimer legal de la marca activa según la ruta.
   */
  protected readonly currentBrandDisclaimer = computed<string | undefined>(() => {
    const url = this.currentUrl();

    // 1. Selector de juegos de una marca: /brands/:brandId/games
    const brandGamesMatch = url.match(/^\/brands\/([^/]+)\/games/);
    if (brandGamesMatch) {
      return this.catalog.disclaimerForBrand(brandGamesMatch[1]);
    }

    // 2. Ejecución de un juego: /play/:experienceId
    const playMatch = url.match(/^\/play\/([^/]+)/);
    if (playMatch) {
      return this.catalog.disclaimerForExperience(playMatch[1]);
    }

    // 3. Resultado de juego: /result/:experienceId/:result
    const resultMatch = url.match(/^\/result\/([^/]+)/);
    if (resultMatch) {
      return this.catalog.disclaimerForExperience(resultMatch[1]);
    }

    return undefined;
  });

  constructor() {
    // Configurar el BGM desde el manifest en cuanto el catálogo esté disponible.
    // La reproducción NO arranca aquí: espera el primer gesto (onFirstGesture).
    effect(() => {
      const manifest = this.catalog.rawManifest();
      const audio = manifest?.audio;
      if (audio?.backgroundMusic) {
        this.mediaPlayer.setBgm(
          audio.backgroundMusic,
          audio.volume ?? DEFAULT_BGM_VOLUME,
        );
      }
    });
  }

  /**
   * Llamado en el primer `pointerup` del host.
   * Desbloquea el BGM una sola vez (unlockBgm() es idempotente).
   * Requisito de la política de autoplay de navegadores y WebView2.
   */
  protected onFirstGesture(): void {
    this.mediaPlayer.unlockBgm();
  }
}
