import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { AppLogger } from '../logging/app-error';
import { PlayResult } from '../catalog/play-result.model';

/** Vidas máximas por partida. */
export const MAX_LIVES = 3;

/**
 * Espera para mostrar el overlay de resultado.
 * Cubre el volteo 3D (~350 ms) y el pulso de match (~500 ms), y deja ver
 * la ventana de mismatch (~800 ms) antes del glass de perder.
 */
export const RESULT_REVEAL_DELAY_MS = 1100;

/** Estados posibles del turno para juegos por turnos (Triqui). */
export type TriquiTurnState = 'player' | 'ai' | 'over';

export interface TriquiTurnInfo {
  state: TriquiTurnState;
  markXUrl: string;
  markOUrl: string;
}

/**
 * Servicio de sesión de juego en curso.
 *
 * Mantiene el estado efímero de la partida activa en memoria:
 * - Vidas restantes (`remainingLives`)
 * - Resultado actual (`playResult`)
 * - Contador de rondas (`round`)
 * - Trigger para solicitud de tutorial (`tutorialRequested`)
 * - Auto-tutorial de sesión (`autoShowTutorial`) — solo en la primera ronda
 * - Estado del turno para juegos por turnos (`triquiTurn`)
 *
 * API para los motores:
 * - `start(experienceId)` — inicia/reinicia la sesión al entrar a `/play/:experienceId`.
 * - `loseLife()` — resta una vida; a 0 programa `out-of-lives`.
 * - `complete('win' | 'lose')` — termina la partida con un resultado explícito.
 * - `remainingLives` — Signal con las vidas restantes actuales.
 * - `playResult` — Signal con el resultado a mostrar en overlay, o `null`.
 * - `round` — Se incrementa en cada `start()` para remount del motor.
 */
@Injectable({ providedIn: 'root' })
export class GameSession {
  private readonly logger = inject(AppLogger);

  readonly maxLives = MAX_LIVES;

  /** Vidas restantes en la sesión activa. */
  readonly remainingLives = signal<number>(MAX_LIVES);

  /** Experiencia activa actualmente. */
  readonly activeExperienceId = signal<string>('');

  /**
   * Resultado pendiente de mostrar como overlay sobre el juego.
   * `null` mientras la partida está en curso.
   */
  readonly playResult = signal<PlayResult | null>(null);

  /**
   * Generación de la partida. Cada `start()` incrementa el valor para que
   * GameHost remonte el motor (tablero nuevo) sin salir de `/play`.
   */
  readonly round = signal<number>(0);

  /**
   * Ronda dentro de la sesión actual (1, 2, 3…).
   * Se reinicia en `start()` y avanza en `nextRound()` (empates / derrotas).
   */
  readonly sessionRound = signal<number>(0);

  /**
   * Contador / trigger de solicitud de tutorial desde el cromado u otros controles globales.
   * Se incrementa cuando el usuario pulsa el botón «?» junto a las vidas.
   */
  readonly tutorialRequested = signal<number>(0);

  /**
   * Si true, el motor debe abrir el tutorial al montar (sesión nueva, vidas a tope).
   * `start()` lo activa; `nextRound()` y el primer auto-show lo desactivan.
   */
  readonly autoShowTutorial = signal(false);

  /**
   * Estado del turno en juegos por turnos (como Triqui) para ser proyectado en el cromado exterior.
   * `null` cuando no hay juego por turnos activo.
   */
  readonly triquiTurn = signal<TriquiTurnInfo | null>(null);

  private _resultTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dismissResult());
  }

  setTriquiTurn(turn: TriquiTurnInfo | null): void {
    this.triquiTurn.set(turn);
  }

  /** Solicita la apertura del tutorial interactivo del juego activo. */
  requestTutorial(): void {
    this.tutorialRequested.update((n) => n + 1);
  }

  /**
   * Inicia (o reinicia) la sesión para la experiencia indicada.
   * Llamar al entrar a `/play/:experienceId` y al pulsar «Volver a jugar».
   */
  start(experienceId: string): void {
    this.dismissResult();
    this.setTriquiTurn(null);
    this.activeExperienceId.set(experienceId);
    this.remainingLives.set(MAX_LIVES);
    this.autoShowTutorial.set(true);
    this.sessionRound.set(1);
    this.round.update((n) => n + 1);
    this.logger.info(
      'GameSession',
      `Sesión iniciada: ${experienceId}, vidas: ${MAX_LIVES}, ronda: 1`,
    );
  }

  /**
   * Avanza a la siguiente ronda dentro de la misma sesión activa.
   * Conserva las vidas restantes (remainingLives).
   * Cierra el overlay de resultado e incrementa round para remount del tablero.
   */
  nextRound(): void {
    this.dismissResult();
    this.autoShowTutorial.set(false);
    this.sessionRound.update((n) => n + 1);
    this.round.update((n) => n + 1);
    this.logger.info(
      'GameSession',
      `Siguiente ronda (${this.sessionRound()}): vidas conservadas (${this.remainingLives()})`,
    );
  }

  /** El motor ya mostró (o no debe mostrar) el tutorial automático de esta sesión. */
  markTutorialShown(): void {
    this.autoShowTutorial.set(false);
  }

  /**
   * Descuenta una vida de la sesión activa.
   * Si las vidas llegan a 0, programa el overlay `out-of-lives`.
   *
   * @returns Vidas restantes después del descuento.
   */
  loseLife(): number {
    const current = this.remainingLives();
    if (current <= 0) {
      this.scheduleResult('out-of-lives');
      return 0;
    }

    const remaining = current - 1;
    this.remainingLives.set(remaining);
    this.logger.info('GameSession', `Vida perdida. Restantes: ${remaining}`);

    if (remaining === 0) {
      this.scheduleResult('out-of-lives');
    }

    return remaining;
  }

  /**
   * Completa la partida con un resultado explícito (victoria o derrota).
   * No descuenta vidas; programa el overlay de resultado.
   */
  complete(result: Exclude<PlayResult, 'out-of-lives'>): void {
    this.logger.info('GameSession', `Partida completada: ${result}`);
    this.scheduleResult(result);
  }

  /**
   * Anuncia un resultado de ronda (derrota con vidas o empate).
   * Programa el overlay correspondiente tras RESULT_REVEAL_DELAY_MS sin resetear vidas.
   */
  announce(result: 'lose' | 'draw'): void {
    this.logger.info('GameSession', `Resultado anunciado: ${result}`);
    this.scheduleResult(result);
  }

  /** Cancela el timer y oculta el overlay de resultado. */
  dismissResult(): void {
    if (this._resultTimer !== null) {
      clearTimeout(this._resultTimer);
      this._resultTimer = null;
    }
    this.playResult.set(null);
  }

  /**
   * Sale de /play (botón Volver del cromado o destrucción del host).
   * Cierra overlay, turno y desmonta el motor antes de la navegación.
   */
  leavePlay(): void {
    this.dismissResult();
    this.setTriquiTurn(null);
    this.autoShowTutorial.set(false);
    this.activeExperienceId.set('');
    this.round.set(0);
  }

  // ─── Interno ─────────────────────────────────────────────────────────────────

  private scheduleResult(result: PlayResult): void {
    const experienceId = this.activeExperienceId();
    if (!experienceId) {
      this.logger.warn('GameSession', 'scheduleResult llamado sin experienceId activo.');
      return;
    }
    if (this.playResult() === result || this._resultTimer !== null) {
      return;
    }
    this._resultTimer = setTimeout(() => {
      this.playResult.set(result);
      this._resultTimer = null;
    }, RESULT_REVEAL_DELAY_MS);
  }
}
