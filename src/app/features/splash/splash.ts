import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog';
import { AppInitService } from '../../core/lifecycle/app-init.service';
import { MediaPlayer } from '../../core/media/media-player';
import { ImageCacheService } from '../../core/media/image-cache.service';
import { playUiSfx, UI_SFX } from '../shared/ui-sfx';
import { AssetSrc } from '../../core/platform/asset-src';

/** Logos institucionales y recursos globales que no viven en el manifest. */
const CORE_IMAGE_URLS = [
  '/content/images/merzGamesIcono.png',
  '/content/images/merzGamesLogotipo.png',
  '/content/images/MerzAestheticsLogo.svg',
  // Textura de fondo de CatalogCard (fake backdrop)
  '/content/images/texture.jpg',
  // Iconos de resultado y advertencia
  '/content/images/experiences/result/win.png',
  '/content/images/experiences/result/die.png',
  '/content/images/experiences/result/lose.png',
  '/content/images/experiences/result/draw.png',
  '/content/images/experiences/result/warning.png',
];

/** Pesos de Montserrat usados en welcome, chrome y resultados. */
const MONTSERRAT_WEIGHTS = [400, 500, 600, 700, 800, 900] as const;

const AUDIO_URL = /\.(mp3|wav|ogg|m4a)$/i;
const FONT_LOAD_TIMEOUT_MS = 8_000;
const ASSET_LOAD_TIMEOUT_MS = 12_000;
const MIN_SPLASH_MS = 1_200;

/**
 * Pantalla de Splash y precarga inteligente de recursos.
 * - Centrado geométrico perfecto (vertical y horizontal) ocupando el 100% de la altura.
 * - Espera a que los recursos esenciales (imágenes, audio, tipografías y catálogo) se carguen.
 * - Muestra un indicador visual de progreso responsivo y elegante.
 * - Al completar al 100%, realiza una transición suave (fade-out) hacia /welcome.
 */
@Component({
  selector: 'app-splash',
  imports: [AssetSrc],
  host: {
    class: 'block w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden',
  },
  template: `
    <div
      class="flex flex-col items-center justify-center h-full w-full flex-1 text-white cursor-pointer select-none px-6 sm:px-12 transition-all duration-700 ease-out font-['Montserrat']"
      [class.opacity-0]="isExiting()"
      [class.scale-95]="isExiting()"
      style="touch-action: manipulation;"
      (pointerup)="onTap()"
      role="button"
      aria-label="Toca para continuar"
    >

      <!-- Fuerza la descarga de todos los pesos antes de ir a /welcome. -->
      <div class="sr-only" aria-hidden="true">
        <span class="font-normal">Aa</span>
        <span class="font-medium">Aa</span>
        <span class="font-semibold">Aa</span>
        <span class="font-bold">Aa</span>
        <span class="font-extrabold">Aa</span>
        <span class="font-black">Aa</span>
      </div>

      <!-- Bloque Central exactamente centrado vertical y horizontalmente -->
      <div class="flex flex-col items-center justify-center max-w-md kiosk:max-w-lg w-full gap-8 sm:gap-10 kiosk:gap-14 text-center my-auto">

        <!-- Icono / Escudo Institucional -->
        <div
          class="w-28 h-28 sm:w-36 sm:h-36 kiosk:w-48 kiosk:h-48 rounded-3xl kiosk:rounded-[2.5rem] bg-white/5 border border-white/15 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-black/50 p-4 sm:p-6 shrink-0 transition-transform duration-500"
          [class.animate-pulse]="!isComplete()"
          [class.scale-105]="isComplete()"
        >
          <img
            src="/content/images/merzGamesIcono.png"
            alt="Merz Games Icono"
            class="w-full h-full object-contain select-none pointer-events-none drop-shadow-md"
          />
        </div>

        <!-- Logotipo Institucional Merz Aesthetics -->
        <div class="flex flex-col items-center w-full">
          <img
            src="/content/images/MerzAestheticsLogo.svg"
            alt="Merz Aesthetics"
            class="w-full max-w-60 sm:max-w-75 kiosk:max-w-95 h-auto object-contain drop-shadow-md select-none pointer-events-none"
          />
        </div>

        <!-- Barra de Progreso del Loader -->
        <div class="w-full max-w-65 sm:max-w-[320px] kiosk:max-w-100 flex flex-col items-center gap-3 pt-2">
          <div class="w-full h-2 sm:h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/15 backdrop-blur-md p-0.5 shadow-inner">
            <div
              class="h-full rounded-full bg-linear-to-r from-emerald-400 via-cyan-400 to-indigo-500 shadow-[0_0_14px_rgba(0,229,255,0.85)] transition-all duration-300 ease-out"
              [style.width.%]="progress()"
            ></div>
          </div>

          <div class="flex items-center justify-between w-full text-xs sm:text-sm text-neutral-300 font-medium tracking-wider px-1">
            <span class="truncate max-w-50 sm:max-w-60 text-left">{{ statusMessage() }}</span>
            <span class="tabular-nums text-white font-extrabold">{{ progress() }}%</span>
          </div>
        </div>

      </div>

    </div>
  `,
})
export class Splash implements OnInit {
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);
  private readonly appInit = inject(AppInitService);
  private readonly media = inject(MediaPlayer);
  private readonly imageCache = inject(ImageCacheService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly progress = signal(0);
  protected readonly statusMessage = signal('Iniciando...');
  protected readonly isComplete = signal(false);
  protected readonly isExiting = signal(false);

  private timeoutIds: ReturnType<typeof setTimeout>[] = [];
  private destroyed = false;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearAllTimeouts();
    });

    this.runPreloader();
  }

  onTap(): void {
    if (this.isComplete()) {
      playUiSfx(this.media, 'click');
      this.advance();
    }
  }

  private async runPreloader(): Promise<void> {
    const startTime = Date.now();
    this.statusMessage.set('Cargando catálogo...');
    this.progress.set(15);

    const allUrls = Array.from(
      new Set([
        ...CORE_IMAGE_URLS,
        ...Object.values(UI_SFX),
        ...this.catalog.collectPreloadUrls(),
      ]),
    );

    const imageUrls = allUrls.filter((url) => !AUDIO_URL.test(url));
    const audioUrls = allUrls.filter((url) => AUDIO_URL.test(url));

    // Fuentes + cada archivo de contenido. No se marca 100 % hasta terminar ambos.
    const totalItems = imageUrls.length + audioUrls.length + 1;
    let loadedCount = 0;

    this.statusMessage.set('Cargando tipografías...');
    await this.preloadFonts();
    loadedCount++;
    if (this.destroyed) return;
    this.updateProgress(loadedCount, totalItems, 'Cargando recursos...');

    await Promise.all([
      ...imageUrls.map(async (url) => {
        await this.preloadImage(url);
        loadedCount++;
        if (this.destroyed) return;
        this.updateProgress(
          loadedCount,
          totalItems,
          loadedCount === totalItems ? '¡Listo!' : 'Cargando imágenes...',
        );
      }),
      ...audioUrls.map(async (url) => {
        await this.withTimeout(
          this.media.preloadUntilReady(url, ASSET_LOAD_TIMEOUT_MS),
          ASSET_LOAD_TIMEOUT_MS,
        );
        loadedCount++;
        if (this.destroyed) return;
        this.updateProgress(
          loadedCount,
          totalItems,
          loadedCount === totalItems ? '¡Listo!' : 'Cargando audio...',
        );
      }),
    ]);

    if (this.destroyed) return;

    const elapsed = Date.now() - startTime;
    const remainingTime = Math.max(0, MIN_SPLASH_MS - elapsed);

    this.scheduleTimeout(() => {
      this.progress.set(100);
      this.statusMessage.set('¡Listo!');
      this.isComplete.set(true);

      this.scheduleTimeout(() => {
        this.advance();
      }, 400);
    }, remainingTime);
  }

  private async preloadFonts(): Promise<void> {
    if (typeof document === 'undefined' || !('fonts' in document)) return;

    const loadAll = async (): Promise<void> => {
      await Promise.all(
        MONTSERRAT_WEIGHTS.map((weight) =>
          document.fonts.load(`${weight} 1em "Montserrat"`).catch(() => []),
        ),
      );
      await document.fonts.ready;
    };

    await this.withTimeout(loadAll(), FONT_LOAD_TIMEOUT_MS);
  }

  private updateProgress(
    loaded: number,
    total: number,
    message: string,
  ): void {
    const rawPercent = Math.min(95, Math.round((loaded / total) * 95));
    this.progress.set(Math.max(this.progress(), rawPercent));
    this.statusMessage.set(message);
  }

  private preloadImage(url: string): Promise<void> {
    return this.imageCache.preload(url, ASSET_LOAD_TIMEOUT_MS);
  }

  private withTimeout(task: Promise<unknown>, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.timeoutIds.push(timer);
      void task.finally(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private advance(): void {
    if (this.isExiting() || this.destroyed) return;
    this.isExiting.set(true);

    this.scheduleTimeout(() => {
      this.appInit.markAsInitialized();
      this.router.navigate(['/welcome'], { replaceUrl: true });
    }, 700);
  }

  private scheduleTimeout(fn: () => void, delay: number): void {
    const id = setTimeout(fn, delay);
    this.timeoutIds.push(id);
  }

  private clearAllTimeouts(): void {
    for (const id of this.timeoutIds) {
      clearTimeout(id);
    }
    this.timeoutIds = [];
  }
}
