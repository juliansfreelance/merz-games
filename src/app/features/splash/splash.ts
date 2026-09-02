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

/**
 * Pantalla de Splash y precarga inteligente de recursos.
 * - Centrado geométrico perfecto (vertical y horizontal) ocupando el 100% de la altura.
 * - Espera a que los recursos esenciales (imágenes clave, tipografías y catálogo) se carguen.
 * - Muestra un indicador visual de progreso responsivo y elegante.
 * - Al completar al 100%, realiza una transición suave (fade-out) hacia /welcome.
 */
@Component({
  selector: 'app-splash',
  host: {
    class: 'block w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden',
  },
  template: `
    <div
      class="flex flex-col items-center justify-center h-full w-full flex-1 text-white cursor-pointer select-none px-6 sm:px-12 transition-all duration-700 ease-out"
      [class.opacity-0]="isExiting()"
      [class.scale-95]="isExiting()"
      style="touch-action: manipulation;"
      (pointerup)="onTap()"
      role="button"
      aria-label="Toca para continuar"
    >

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
            class="w-full max-w-[240px] sm:max-w-[300px] kiosk:max-w-[380px] h-auto object-contain drop-shadow-md select-none pointer-events-none"
          />
        </div>

        <!-- Barra de Progreso del Loader -->
        <div class="w-full max-w-[260px] sm:max-w-[320px] kiosk:max-w-[400px] flex flex-col items-center gap-3 pt-2">
          <div class="w-full h-2 sm:h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/15 backdrop-blur-md p-[2px] shadow-inner">
            <div
              class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 shadow-[0_0_14px_rgba(0,229,255,0.85)] transition-all duration-300 ease-out"
              [style.width.%]="progress()"
            ></div>
          </div>

          <div class="flex items-center justify-between w-full text-xs sm:text-sm text-neutral-300 font-medium tracking-wider px-1">
            <span class="truncate max-w-[200px] sm:max-w-[240px] text-left">{{ statusMessage() }}</span>
            <span class="font-mono tabular-nums text-white font-bold">{{ progress() }}%</span>
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
  private readonly destroyRef = inject(DestroyRef);

  protected readonly progress = signal(0);
  protected readonly statusMessage = signal('Iniciando...');
  protected readonly isComplete = signal(false);
  protected readonly isExiting = signal(false);

  private timeoutIds: ReturnType<typeof setTimeout>[] = [];

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.clearAllTimeouts();
    });

    this.runPreloader();
  }

  onTap(): void {
    if (this.isComplete()) {
      this.advance();
    }
  }

  private async runPreloader(): Promise<void> {
    const startTime = Date.now();
    this.statusMessage.set('Cargando catálogo...');
    this.progress.set(20);

    // 1. Recopilar lista de URLs esenciales a precargar
    const coreUrls = [
      '/content/images/merzGamesIcono.png',
      '/content/images/merzGamesLogotipo.png',
      '/content/images/MerzAestheticsLogo.svg',
    ];

    const brandUrls = this.catalog
      .brands()
      .flatMap((b) => [b.image, b.logo])
      .filter((img): img is string => !!img);

    const experienceUrls = this.catalog
      .experiences()
      .map((e) => e.image)
      .filter((img): img is string => !!img);

    const allUrls = Array.from(
      new Set([...coreUrls, ...brandUrls, ...experienceUrls]),
    );

    let loadedCount = 0;
    const totalItems = allUrls.length + 1; // +1 para fuentes

    // 2. Esperar fuentes del documento si están soportadas
    try {
      if (typeof document !== 'undefined' && 'fonts' in document) {
        await document.fonts.ready;
      }
    } catch {
      // Continuar si falla la comprobación de fuentes
    }

    loadedCount++;
    this.updateProgress(loadedCount, totalItems, 'Cargando recursos...');

    // 3. Precarga de imágenes concurrentemente
    await Promise.all(
      allUrls.map(async (url) => {
        await this.preloadImage(url);
        loadedCount++;
        this.updateProgress(
          loadedCount,
          totalItems,
          loadedCount === totalItems ? '¡Listo!' : 'Cargando imágenes...',
        );
      }),
    );

    // 4. Asegurar un tiempo mínimo elegante de presentación (1.2s)
    const elapsed = Date.now() - startTime;
    const minDisplayTime = 1200;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);

    this.scheduleTimeout(() => {
      this.progress.set(100);
      this.statusMessage.set('¡Listo!');
      this.isComplete.set(true);

      // 5. Iniciar transición suave y navegar a /welcome
      this.scheduleTimeout(() => {
        this.advance();
      }, 400);
    }, remainingTime);
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
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      const img = new Image();
      img.src = url;

      if (img.complete) {
        resolve();
        return;
      }

      img.onload = () => resolve();
      img.onerror = () => resolve(); // Resiliente: no bloquea si falta un archivo opcional
    });
  }

  private advance(): void {
    if (this.isExiting()) return;
    this.isExiting.set(true);

    // Transición suave de 700ms antes de cambiar de ruta
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
