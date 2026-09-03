import {
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { KioskSettings } from '../settings/kiosk-settings';
import { GameSession } from '../session/game-session';
import { MediaPlayer } from '../media/media-player';
import { AppLogger } from '../logging/app-error';

/** Rutas en las que el watchdog de inactividad nunca debe dispararse. */
function isExcludedRoute(url: string): boolean {
  const clean = url.split('?')[0];
  if (!clean || clean === '/' || clean === '') {
    return true;
  }
  return clean.startsWith('/admin');
}

/**
 * Servicio de vigilancia de inactividad táctil/usuario (IdleWatchdog).
 *
 * Responsabilidades:
 * - Supervisar la inactividad en todas las pantallas de paciente.
 * - Desactivado en splash (`/`) y en el panel administrativo (`/admin`, `/admin/login`).
 * - Disparar el protector tras `KioskSettings.screensaverIdleMs()` (default 3 min).
 * - Reiniciar el contador tras toques (`pointerdown`, `pointerup`, `keydown`).
 * - Al salir del protector (`dismiss()`): abandonar partida activa, reanudar BGM y navegar a `/welcome`.
 * - NUNCA dispara actualizaciones ni consultas de red.
 */
@Injectable({ providedIn: 'root' })
export class IdleWatchdog {
  private readonly router = inject(Router);
  private readonly settings = inject(KioskSettings);
  private readonly session = inject(GameSession);
  private readonly mediaPlayer = inject(MediaPlayer);
  private readonly logger = inject(AppLogger);
  private readonly destroyRef = inject(DestroyRef);

  /** Indica si el protector de pantalla está visible actualmente. */
  readonly isActive = signal<boolean>(false);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentUrl = '';
  private isListening = false;

  private readonly onUserInteraction = (): void => {
    // Si el protector ya está activo, la interacción la gestiona el propio overlay al hacer dismiss.
    if (this.isActive()) return;
    this.resetTimer();
  };

  constructor() {
    this.currentUrl = this.router.url;
    this.initListeners();

    // Escuchar cambios de ruta para pausar o activar el watchdog
    const sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl = event.urlAfterRedirects || event.url;
        this.onRouteChanged();
      });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.teardownListeners();
      this.clearTimer();
    });

    this.onRouteChanged();
  }

  /**
   * Cierra el protector de pantalla ante el toque del usuario:
   * - Oculta el overlay.
   * - Abandona la partida activa si estaba en juego (`leavePlay()`).
   * - Reanuda BGM si estaba pausada por un clip.
   * - Navega a la pantalla de bienvenida (`/welcome`).
   * - Reinicia la cuenta regresiva del watchdog.
   */
  dismiss(): void {
    if (!this.isActive()) return;

    this.logger.info('IdleWatchdog', 'Protector descartado por interacción del usuario.');
    this.isActive.set(false);

    // Limpiar sesión de juego si estaba en `/play` o `/result`
    this.session.leavePlay();

    // Reanudar BGM
    this.mediaPlayer.resumeBgm();

    // Redirigir a bienvenida
    void this.router.navigateByUrl('/welcome');

    // Reiniciar ciclo de inactividad
    this.resetTimer();
  }

  /**
   * Fuerza el disparo del protector (útil para pruebas o diagnósticos).
   */
  triggerNow(): void {
    if (isExcludedRoute(this.currentUrl)) return;
    this.clearTimer();
    this.isActive.set(true);
    this.logger.info('IdleWatchdog', 'Protector activado.');
  }

  // ─── Interno ─────────────────────────────────────────────────────────────────

  private onRouteChanged(): void {
    if (isExcludedRoute(this.currentUrl)) {
      this.clearTimer();
      // Si navegamos a admin, el protector no debe estar visible
      if (this.isActive()) {
        this.isActive.set(false);
      }
    } else {
      this.resetTimer();
    }
  }

  private resetTimer(): void {
    this.clearTimer();
    if (isExcludedRoute(this.currentUrl)) return;

    const idleMs = this.settings.screensaverIdleMs();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!isExcludedRoute(this.currentUrl) && !this.isActive()) {
        this.isActive.set(true);
        this.logger.info('IdleWatchdog', `Inactividad detectada tras ${idleMs} ms. Mostrando protector.`);
      }
    }, idleMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private initListeners(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined' || this.isListening) {
      return;
    }

    document.addEventListener('pointerdown', this.onUserInteraction, { passive: true });
    document.addEventListener('pointerup', this.onUserInteraction, { passive: true });
    document.addEventListener('keydown', this.onUserInteraction, { passive: true });
    this.isListening = true;
  }

  private teardownListeners(): void {
    if (typeof document === 'undefined' || !this.isListening) {
      return;
    }

    document.removeEventListener('pointerdown', this.onUserInteraction);
    document.removeEventListener('pointerup', this.onUserInteraction);
    document.removeEventListener('keydown', this.onUserInteraction);
    this.isListening = false;
  }
}
