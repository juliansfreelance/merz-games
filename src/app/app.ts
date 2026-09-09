import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { PlatformService } from './core/platform/platform.service';
import { CatalogService } from './core/catalog/catalog';
import { MediaPlayer } from './core/media/media-player';
import { FloatingGradient } from './features/shared/floating-gradient';
import { Atmosphere } from './core/catalog/content-manifest.model';
import { UI_SFX, UiSfx } from './features/shared/ui-sfx';
import { IdleWatchdog } from './core/kiosk/idle-watchdog';
import { Screensaver } from './features/screensaver/screensaver';
import { HeroIcon } from './features/shared/hero-icon';
import { QuickSettingsDialog } from './features/shared/quick-settings-dialog';

/** Volumen de BGM por defecto si el manifest no especifica uno. */
const DEFAULT_BGM_VOLUME = 0.35;

/** Gesto oculto: mantener pulsado el badge de versión. */
const ADMIN_LONG_PRESS_MS = 2000;

@Component({
  imports: [RouterOutlet, FloatingGradient, Screensaver, HeroIcon, UiSfx, QuickSettingsDialog],
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly watchdog = inject(IdleWatchdog);
  private versionPressTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly appVersion = this.platformService.appVersion;
  protected readonly isScreensaverActive = this.watchdog.isActive;
  protected readonly isQuickSettingsOpen = signal<boolean>(false);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects || (e as NavigationEnd).url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Indica si la ruta activa pertenece al panel o login de administración (/admin). */
  protected readonly isAdminRoute = computed<boolean>(() => {
    return this.currentUrl().startsWith('/admin');
  });

  /**
   * Determina si el botón flotante de ajustes rápidos debe mostrarse:
   * En toda la app EXCEPTO en login (/admin/login), panel de control (/admin) y splash inicial (/).
   */
  protected readonly showQuickSettings = computed<boolean>(() => {
    const url = this.currentUrl();
    if (this.isAdminRoute()) return false;
    if (url === '' || url === '/') return false;
    return true;
  });

  /**
   * Resuelve la atmósfera viva según la ruta activa y el catálogo.
   * Cero ramificaciones `if (brandId === 'radiesse')`.
   */
  protected readonly currentAtmosphere = computed<Atmosphere>(() => {
    const url = this.currentUrl();

    // 0. Panel y login de administración: atmósfera técnica con manchas propias
    if (url.startsWith('/admin')) {
      return this.catalog.adminAtmosphere();
    }

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
    this.destroyRef.onDestroy(() => this.clearVersionPress());

    this.mediaPlayer.preload(UI_SFX.click);
    this.mediaPlayer.preload(UI_SFX.back);
    this.mediaPlayer.preload(UI_SFX.select);

    // Entrar al modo kiosco nativo en Tauri al iniciar
    if (this.platformService.isNative) {
      void this.platformService.enterKiosk();
    }

    // Configurar el BGM desde el manifest en cuanto el catálogo esté disponible.
    // La reproducción NO arranca aquí: espera el primer gesto (onFirstGesture).
    effect(() => {
      const manifest = this.catalog.rawManifest();
      const bgm = manifest?.app?.audio?.backgroundMusic ?? manifest?.audio?.backgroundMusic;
      const volume = manifest?.app?.audio?.bgmVolume ?? manifest?.audio?.volume ?? DEFAULT_BGM_VOLUME;
      if (bgm) {
        this.mediaPlayer.setBgm(bgm, volume);
      }
    });
  }

  /**
   * Cierra el protector de pantalla y reanuda el flujo de paciente.
   */
  protected onDismissScreensaver(): void {
    this.watchdog.dismiss();
  }

  protected openQuickSettings(): void {
    this.isQuickSettingsOpen.set(true);
  }

  protected closeQuickSettings(): void {
    this.isQuickSettingsOpen.set(false);
  }

  /**
   * Llamado en el primer `pointerup` del host.
   * Desbloquea el BGM una sola vez (unlockBgm() es idempotente).
   * Requisito de la política de autoplay de navegadores y WebView2.
   */
  protected onFirstGesture(): void {
    this.mediaPlayer.unlockBgm();
  }

  protected onVersionPressStart(event: PointerEvent): void {
    event.preventDefault();
    this.clearVersionPress();
    this.versionPressTimer = setTimeout(() => {
      this.versionPressTimer = null;
      const url = this.router.url.split('?')[0];
      if (url.startsWith('/admin')) return;
      void this.router.navigateByUrl('/admin/login');
    }, ADMIN_LONG_PRESS_MS);
  }

  protected onVersionPressEnd(): void {
    this.clearVersionPress();
  }

  private clearVersionPress(): void {
    if (this.versionPressTimer === null) return;
    clearTimeout(this.versionPressTimer);
    this.versionPressTimer = null;
  }
}
