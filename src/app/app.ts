import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { PlatformService } from './core/platform/platform.service';
import { CatalogService } from './core/catalog/catalog';
import { FloatingGradient } from './features/shared/floating-gradient';
import { Atmosphere } from './core/catalog/content-manifest.model';

@Component({
  imports: [RouterOutlet, FloatingGradient],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly platformService = inject(PlatformService);
  private readonly catalog = inject(CatalogService);
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
}
