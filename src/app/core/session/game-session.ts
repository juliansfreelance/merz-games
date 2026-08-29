import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppLogger } from '../logging/app-error';
import { PlayResult } from '../catalog/play-result.model';

/** Vidas máximas por partida. */
export const MAX_LIVES = 3;

/**
 * Servicio de sesión de partida.
 *
 * Gestiona las 3 vidas de cada partida y coordina la navegación al resultado.
 * Sin PII, sin persistencia de participaciones: la sesión es volátil (en memoria).
 *
 * API para los motores:
 * - `start(experienceId)` — inicia/reinicia la sesión al entrar a `/play/:experienceId`.
 * - `loseLife()` — resta una vida; a 0 navega a `out-of-lives`.
 * - `complete('win' | 'lose')` — termina la partida con un resultado explícito.
 * - `remainingLives` — Signal con las vidas restantes actuales.
 */
@Injectable({ providedIn: 'root' })
export class GameSession {
  private readonly router = inject(Router);
  private readonly logger = inject(AppLogger);

  readonly maxLives = MAX_LIVES;

  /** Vidas restantes en la sesión activa. */
  readonly remainingLives = signal<number>(MAX_LIVES);

  /** Experiencia activa actualmente. */
  readonly activeExperienceId = signal<string>('');

  /**
   * Inicia (o reinicia) la sesión para la experiencia indicada.
   * Llamar al entrar a `/play/:experienceId`.
   */
  start(experienceId: string): void {
    this.activeExperienceId.set(experienceId);
    this.remainingLives.set(MAX_LIVES);
    this.logger.info('GameSession', `Sesión iniciada: ${experienceId}, vidas: ${MAX_LIVES}`);
  }

  /**
   * Descuenta una vida de la sesión activa.
   * Si las vidas llegan a 0, navega automáticamente a `out-of-lives`.
   *
   * @returns Vidas restantes después del descuento.
   */
  loseLife(): number {
    const current = this.remainingLives();
    if (current <= 0) {
      // Ya no hay vidas; navegar si no se ha hecho todavía.
      this.navigateToResult('out-of-lives');
      return 0;
    }

    const remaining = current - 1;
    this.remainingLives.set(remaining);
    this.logger.info('GameSession', `Vida perdida. Restantes: ${remaining}`);

    if (remaining === 0) {
      this.navigateToResult('out-of-lives');
    }

    return remaining;
  }

  /**
   * Completa la partida con un resultado explícito (victoria o derrota).
   * No descuenta vidas; navega directamente al resultado.
   */
  complete(result: Exclude<PlayResult, 'out-of-lives'>): void {
    this.logger.info('GameSession', `Partida completada: ${result}`);
    this.navigateToResult(result);
  }

  // ─── Interno ─────────────────────────────────────────────────────────────────

  private navigateToResult(result: PlayResult): void {
    const experienceId = this.activeExperienceId();
    if (!experienceId) {
      this.logger.warn('GameSession', 'navigateToResult llamado sin experienceId activo.');
      this.router.navigate(['/brands']);
      return;
    }
    this.router.navigate(['/result', experienceId, result]);
  }
}
