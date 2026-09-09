import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  OnInit,
} from '@angular/core';
import { GameSession, TriquiTurnState } from '../../core/session/game-session';
import {
  ExperienceAssets,
  ExperienceConfig,
  ExperienceTheme,
  ExperienceTurnNoticeConfig,
} from '../../core/catalog/game-experience.model';
import { CatalogService } from '../../core/catalog/catalog';
import { GameAssets } from '../../core/catalog/game.model';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { MediaPlayer } from '../../core/media/media-player';
import { ImageCacheService } from '../../core/media/image-cache.service';
import { TriquiEngine } from '../../core/games/triqui/triqui-engine';
import {
  CellIndex,
  Mark,
  TriquiWinningLine,
} from '../../core/games/triqui/triqui.model';
import {
  resolveTriquiDifficulty,
  resolveTriquiFirstPlayer,
  resolveTriquiPlayerSymbol,
} from '../../core/games/triqui/triqui-config';
import { TriquiCell } from './triqui-cell';
import { TriquiTutorial, TUTORIAL_AUTO_REVEAL_MS } from './triqui-tutorial';
import { HeroIcon } from '../shared/hero-icon';

/** Rango de retardo de pensamiento de la IA (milisegundos) para simular deliberación humana natural. */
export const AI_THINKING_MIN_DELAY_MS = 700;
export const AI_THINKING_MAX_DELAY_MS = 1400;

/** @deprecated Usar getRandomAiThinkingDelay() o el rango MIN/MAX. */
export const AI_THINKING_DELAY_MS = AI_THINKING_MIN_DELAY_MS;

/**
 * Genera un tiempo de pensamiento aleatorio y orgánico para la IA.
 * Emula la cadencia de un oponente que analiza las posibilidades del tablero.
 */
export function getRandomAiThinkingDelay(
  min = AI_THINKING_MIN_DELAY_MS,
  max = AI_THINKING_MAX_DELAY_MS,
  rng = Math.random,
): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Rutas estándar de los efectos de sonido de Triqui. */
const SFX = {
  put: '/content/audio/sfx/put.mp3',
  win: '/content/audio/sfx/game-win.mp3',
  lose: '/content/audio/sfx/game-lose.mp3',
  draw: '/content/audio/sfx/game-draw.mp3',
  gameStart: '/content/audio/sfx/game-start.mp3',
};

/**
 * TriquiPlay — Presentación del motor de Triqui (Tres en Raya) en el board-slot de GameChrome.
 *
 * Responsabilidades:
 * - Resolver dificultad y quién empieza mediante cascada (triqui-config.ts).
 * - Precargar marcas X/O y efectos de sonido.
 * - Instanciar y gobernar TriquiEngine.
 * - Gestionar el turno y retardo de la IA sin congelar la UI ni el cromado.
 * - Traducir eventos del motor a sesión, sonido y animaciones de línea ganadora.
 * - Gestionar tutorial overlay al inicio y ante solicitudes del usuario («?»).
 * - CERO atajos QA. CERO ramas por marca (if brandId === ...).
 */
@Component({
  selector: 'app-triqui-play',
  imports: [TriquiCell, TriquiTutorial, HeroIcon],
  host: {
    class: 'triqui-play-host absolute inset-0 flex items-center justify-center select-none',
    style: 'touch-action: manipulation;',
  },
  styles: [`
    :host {
      container-type: size;
      container-name: triqui-slot;
    }

    /* Cuadrado inscrito en el board-slot, con margen para no saturar el área. */
    .triqui-board {
      width: 82cqmin;
      height: 82cqmin;
      max-width: 100%;
      max-height: 100%;
    }

    .turn-notice-enter {
      animation: turnNoticeFadeIn 0.35s ease-out both;
    }
    .turn-notice-leave {
      animation: turnNoticeFadeOut 0.28s ease-in both;
    }
    .turn-notice-card-enter {
      animation: turnNoticeCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .turn-notice-card-leave {
      animation: turnNoticeCardOut 0.25s ease-in both;
    }

    @keyframes turnNoticeFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes turnNoticeFadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes turnNoticeCardIn {
      from {
        opacity: 0;
        transform: scale(0.85) translateY(12px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    @keyframes turnNoticeCardOut {
      from {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      to {
        opacity: 0;
        transform: scale(0.9) translateY(-8px);
      }
    }

    .turn-notice-glass {
      background: rgba(15, 15, 20, 0.32);
      backdrop-filter: blur(24px) saturate(160%);
      -webkit-backdrop-filter: blur(24px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.35);
    }
    .turn-notice-progress-track {
      width: 100%;
      height: 3.5px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      overflow: hidden;
    }
    .turn-notice-progress-fill {
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      opacity: 0.4;
      transform-origin: left center;
      animation-name: turnNoticeProgressAnim;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }
    @keyframes turnNoticeProgressAnim {
      0% {
        transform: scaleX(1);
      }
      100% {
        transform: scaleX(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .turn-notice-enter,
      .turn-notice-leave,
      .turn-notice-card-enter,
      .turn-notice-card-leave,
      .turn-notice-progress-fill {
        animation: none;
      }
    }
  `],
  template: `
    <!-- Estado de precarga -->
    @if (loading()) {
      <div class="flex flex-col items-center justify-center gap-4 text-white/60 py-8" role="status" aria-label="Cargando partida">
        <svg class="animate-spin w-10 h-10 text-white/40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="text-sm font-medium">Preparando el tablero…</span>
      </div>
    }

    <!-- Tablero de Triqui Activo -->
    @if (!loading()) {
      <div
        class="triqui-board relative flex flex-col items-center justify-center p-2 sm:p-4"
        role="grid"
        aria-label="Tablero de Triqui 3 por 3"
      >
        <!-- Tutorial Modal de pantalla completa interactivo -->
        <app-triqui-tutorial
          #tutorialModal
          [accentColor]="accentColor()"
          [blurTint]="blurTint()"
          [markXUrl]="markXUrl()"
          [markOUrl]="markOUrl()"
          [playerSymbol]="activePlayerMark()"
          (closed)="onTutorialClosed()"
        />

        <!-- Rejilla 3x3: Fondo negro transparentoso y borde grueso del color blurTint -->
        <div
          class="grid grid-cols-3 grid-rows-3 gap-2.5 sm:gap-3.5 w-full h-full p-3 sm:p-5 rounded-3xl backdrop-blur-xl shadow-2xl transition-all duration-300"
          style="background: rgba(0, 0, 0, 0.15);"
          [style.border]="'3.5px solid ' + boardBorderColor()"
          [style.box-shadow]="'0 0 35px -5px ' + boardBorderColor() + '44, inset 0 0 25px rgba(0,0,0,0.6)'"
        >
          @for (cell of cellIndices; track cell) {
            <app-triqui-cell
              [index]="cell"
              [mark]="board()[cell]"
              [markXUrl]="markXUrl()"
              [markOUrl]="markOUrl()"
              [accentColor]="accentColor()"
              [blurTint]="blurTint()"
              [isWinning]="isWinningCell(cell)"
              [disabled]="isAiThinking() || turnNoticeVisible() || (engine()?.isOver ?? false)"
              (cellClick)="onCellClick($event)"
            />
          }
        </div>
      </div>

      <!-- Notificación de primer turno: Contenida dentro de board-slot con estilo de backdrop unificado -->
      @if (turnNoticeVisible()) {
        <div
          class="turn-notice absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-4 select-none overflow-hidden rounded-3xl"
          style="background: rgba(3, 7, 18, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); touch-action: none;"
          [class.turn-notice-enter]="!turnNoticeExiting()"
          [class.turn-notice-leave]="turnNoticeExiting()"
          role="status"
          aria-live="polite"
          (click)="dismissTurnNotice()"
        >
          <div
            class="turn-notice-glass relative w-full max-w-77.5 sm:max-w-85 rounded-3xl p-6 sm:p-7 flex flex-col items-center text-center gap-3.5 shadow-2xl transition-all"
            [class.turn-notice-card-enter]="!turnNoticeExiting()"
            [class.turn-notice-card-leave]="turnNoticeExiting()"
            (click)="$event.stopPropagation()"
          >
            <!-- Botón con icono x-mark en la esquina superior derecha -->
            <button
              type="button"
              (click)="dismissTurnNotice()"
              class="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer select-none touch-manipulation focus:outline-none"
              aria-label="Cerrar aviso"
            >
              <app-hero-icon name="x-mark" class="w-5 h-5" />
            </button>

            <!-- Título de turno -->
            <h2 class="text-xl sm:text-2xl font-black font-['Montserrat'] tracking-wider uppercase text-white drop-shadow-sm px-6 pt-1">
              {{ turnNoticeTitle() }}
            </h2>

            <!-- Mensaje descriptivo con asset inline y formato HTML -->
            <p
              class="text-neutral-200 font-medium text-sm sm:text-base leading-snug [&>strong]:font-bold [&>strong]:text-white [&>img]:inline-block [&>img]:w-6 [&>img]:h-6 [&>img]:align-middle [&>img]:mx-1"
              [innerHTML]="turnNoticeMessageHtml()"
            ></p>

            <!-- Barra de progreso de auto-cierre muy tenue -->
            <div class="turn-notice-progress-track w-full mt-1" aria-hidden="true">
              <div
                class="turn-notice-progress-fill rounded-full"
                [style.animationDuration]="turnNoticeDurationSec() + 's'"
                [style.background]="accentColor()"
              ></div>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class TriquiPlay implements OnInit {
  // ── Inputs del motor (suministrados por GameHost via NgComponentOutlet) ─────
  readonly experienceId = input.required<string>();
  readonly brandId = input.required<string>();
  readonly gameId = input.required<string>();
  readonly remainingLives = input<number>(3);
  readonly theme = input<ExperienceTheme>({});
  readonly assets = input<ExperienceAssets>({});
  readonly config = input<ExperienceConfig>({});
  /** Tinte de atmósfera de la experiencia/marca (blurTint). */
  readonly blurTint = input<string | undefined>(undefined);
  /** Configuración maestra del motor (game.config). */
  readonly gameConfig = input<ExperienceConfig>({});
  /** Assets del motor (game.assets). */
  readonly gameAssets = input<GameAssets>({});
  /** Configuración de aviso de primer turno. */
  readonly turnNotice = input<ExperienceTurnNoticeConfig | undefined>(undefined);

  // ── Servicios ───────────────────────────────────────────────────────────────
  protected readonly session = inject(GameSession);
  private readonly catalog = inject(CatalogService);
  private readonly settings = inject(KioskSettings);
  private readonly media = inject(MediaPlayer);
  private readonly imageCache = inject(ImageCacheService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Constante de celdas fijas 0 a 8 ─────────────────────────────────────────
  protected readonly cellIndices: readonly CellIndex[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  // ── Estado Local ────────────────────────────────────────────────────────────
  protected readonly loading = signal(true);
  protected readonly isAiThinking = signal(false);
  protected readonly turnNoticeVisible = signal(false);
  protected readonly turnNoticeExiting = signal(false);
  private readonly _engine = signal<TriquiEngine | null>(null);
  private readonly _board = signal<readonly (Mark | null)[]>(Array(9).fill(null));
  private readonly _winningLine = signal<TriquiWinningLine | null>(null);

  protected readonly engine = this._engine.asReadonly();
  readonly board = this._board.asReadonly();
  protected readonly winningLine = this._winningLine.asReadonly();

  // ── Referencias y Temporizadores ────────────────────────────────────────────
  protected readonly tutorialModal = viewChild<TriquiTutorial>('tutorialModal');
  private _aiTimer: ReturnType<typeof setTimeout> | null = null;
  private _turnNoticeTimer: ReturnType<typeof setTimeout> | null = null;
  private _turnNoticeExitTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;
  private lastHelpReq = inject(GameSession).tutorialRequested();

  /** Duración por defecto del aviso de primer turno antes del auto-cierre (segundos). */
  readonly TURN_NOTICE_DEFAULT_DURATION_SEC = 30;
  /** Duración de la animación de salida del aviso (ms). */
  readonly TURN_NOTICE_EXIT_DURATION_MS = 280;

  // ── Computados de Configuración ─────────────────────────────────────────────

  /** Experiencia actual consultada desde el catálogo como fallback seguro. */
  protected readonly experience = computed(() =>
    this.catalog.getExperienceById(this.experienceId()),
  );

  /** Configuración de aviso de turno: input -> experiencia -> defaults. */
  protected readonly resolvedTurnNoticeConfig = computed<ExperienceTurnNoticeConfig | undefined>(() => {
    return this.turnNotice() ?? this.experience()?.turnNotice;
  });

  /** Identifica quién es el iniciador de la partida: 'player' | 'ai'. */
  protected readonly starter = computed<'player' | 'ai'>(() => {
    const eng = this._engine();
    if (!eng) return 'player';
    return eng.currentMark === eng.playerMark ? 'player' : 'ai';
  });

  /** URL del asset de la ficha con la que arranca el iniciador. */
  protected readonly turnNoticeStarterAssetUrl = computed<string>(() => {
    const eng = this._engine();
    if (!eng) return this.markXUrl();
    const starterMark = eng.currentMark;
    return starterMark === 'X' ? this.markXUrl() : this.markOUrl();
  });

  /** Duración en segundos del aviso de primer turno antes del auto-cierre (default 30s). */
  protected readonly turnNoticeDurationSec = computed<number>(() => {
    const cfg = this.resolvedTurnNoticeConfig();
    const sec = cfg?.durationSeconds;
    return typeof sec === 'number' && sec > 0 ? sec : this.TURN_NOTICE_DEFAULT_DURATION_SEC;
  });

  /** Texto del botón de confirmación/cierre (default "¡Entendido!"). */
  protected readonly turnNoticeButtonText = computed<string>(() => {
    const cfg = this.resolvedTurnNoticeConfig();
    return cfg?.buttonText?.trim() || '¡Entendido!';
  });

  /** Título de la notificación. */
  protected readonly turnNoticeTitle = computed<string>(() => {
    const cfg = this.resolvedTurnNoticeConfig();
    const isPlayer = this.starter() === 'player';
    if (isPlayer) {
      return cfg?.player?.title ?? '¡ES TU TURNO!';
    } else {
      return cfg?.ai?.title ?? 'INICIA TU RIVAL';
    }
  });

  /** Mensaje de la notificación con {asset} reemplazado por la imagen inline y soporte HTML. */
  protected readonly turnNoticeMessageHtml = computed<string>(() => {
    const cfg = this.resolvedTurnNoticeConfig();
    const isPlayer = this.starter() === 'player';
    const raw = isPlayer
      ? (cfg?.player?.message ?? 'Inicias tú con {asset}. ¡Elige bien tu jugada!')
      : (cfg?.ai?.message ?? 'Inicia la IA con {asset}. ¡No la dejes ganar!');

    const assetImg = `<img src="${this.turnNoticeStarterAssetUrl()}" alt="Ficha" class="inline-block w-6 h-6 sm:w-7 sm:h-7 align-middle mx-1 pointer-events-none select-none object-contain" />`;
    return raw.replace(/\{asset\}/g, assetImg);
  });

  readonly resolvedDifficulty = computed(() => {
    const expId = this.experienceId();
    const kioskOverride = this.settings.getExperienceTriquiDifficulty
      ? this.settings.getExperienceTriquiDifficulty(expId)
      : this.settings.triquiDifficulty();
    return resolveTriquiDifficulty({
      kioskOverride,
      experienceConfig: this.config(),
      gameConfig: this.gameConfig(),
    }).difficulty;
  });

  protected readonly resolvedFirstPlayer = computed(() => {
    const expId = this.experienceId();
    const kioskOverride = this.settings.getExperienceTriquiFirstPlayer
      ? this.settings.getExperienceTriquiFirstPlayer(expId)
      : this.settings.triquiFirstPlayer();
    return resolveTriquiFirstPlayer({
      kioskOverride,
      experienceConfig: this.config(),
      gameConfig: this.gameConfig(),
    }).firstPlayer;
  });

  readonly resolvedPlayerSymbol = computed(() => {
    const expId = this.experienceId();
    const kioskOverride = this.settings.getExperienceTriquiPlayerSymbol
      ? this.settings.getExperienceTriquiPlayerSymbol(expId)
      : this.settings.triquiPlayerSymbol();
    return resolveTriquiPlayerSymbol({
      kioskOverride,
      experienceConfig: this.config(),
      gameConfig: this.gameConfig(),
    }).playerSymbol;
  });

  /** Figura activa asignada al jugador en la ronda actual ('X' u 'O'). */
  readonly activePlayerMark = computed<Mark>(() => {
    return this._engine()?.playerMark ?? 'X';
  });

  protected readonly accentColor = computed<string>(() => {
    return this.theme().accentColor ?? '#00E5FF';
  });

  /** Color de borde del tablero: tinte de marca (blurTint) o acento de la experiencia. */
  protected readonly boardBorderColor = computed<string>(() => {
    return this.blurTint() || this.accentColor() || '#00E5FF';
  });

  /** URL de ficha X: experiencia -> carpeta marca -> motor -> fallback global. */
  protected readonly markXUrl = computed<string>(() => {
    const fromExp = this.assets().markX;
    if (typeof fromExp === 'string' && fromExp) return fromExp;

    const brand = this.brandId();
    if (brand) {
      return `/content/images/games/triqui/${brand}/mark-x.png`;
    }

    const fromMotor = this.gameAssets()['markX'];
    if (typeof fromMotor === 'string' && fromMotor) return fromMotor;

    return '/content/images/games/triqui/mark-x.png';
  });

  /** URL de ficha O: experiencia -> carpeta marca -> motor -> fallback global. */
  protected readonly markOUrl = computed<string>(() => {
    const fromExp = this.assets().markO;
    if (typeof fromExp === 'string' && fromExp) return fromExp;

    const brand = this.brandId();
    if (brand) {
      return `/content/images/games/triqui/${brand}/mark-o.png`;
    }

    const fromMotor = this.gameAssets()['markO'];
    if (typeof fromMotor === 'string' && fromMotor) return fromMotor;

    return '/content/images/games/triqui/mark-o.png';
  });

  constructor() {
    // Tutorial automático solo al iniciar la sesión (vidas a tope) en la primera ronda, no en cada ronda
    effect(() => {
      const isLoaded = !this.loading();
      const modal = this.tutorialModal();
      const auto = this.session.autoShowTutorial();
      const isFirstRound = this.session.sessionRound() === 1;
      if (isLoaded && modal && auto && isFirstRound) {
        untracked(() => {
          modal.showTutorial(TUTORIAL_AUTO_REVEAL_MS);
          this.session.markTutorialShown();
        });
      }
    });

    // Abrir modal al pulsar el botón «?» del cromado.
    // untracked: showTutorial() lee visible(); si el effect lo rastrea, al cerrar se reabre solo.
    effect(() => {
      const req = this.session.tutorialRequested();
      const modal = this.tutorialModal();
      if (req <= this.lastHelpReq || !modal) return;
      this.lastHelpReq = req;
      untracked(() => modal.showTutorial());
    });

    // Sincronizar el indicador de turno exterior con GameSession
    effect(() => {
      if (this.loading()) {
        this.session.setTriquiTurn(null);
        return;
      }

      const eng = this._engine();
      let state: TriquiTurnState = 'player';
      if (this.isAiThinking()) {
        state = 'ai';
      } else if (eng?.isOver) {
        state = 'over';
      } else {
        state = eng?.currentMark === eng?.playerMark ? 'player' : 'ai';
      }

      const isPlayerX = eng?.playerMark !== 'O';
      const playerMarkUrl = isPlayerX ? this.markXUrl() : this.markOUrl();
      const aiMarkUrl = isPlayerX ? this.markOUrl() : this.markXUrl();

      this.session.setTriquiTurn({
        state,
        markXUrl: playerMarkUrl,
        markOUrl: aiMarkUrl,
      });
    });
  }

  // ── Ciclo de Vida ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this._preloadAndInit();
    this.destroyRef.onDestroy(() => {
      this._destroyed = true;
      this.session.setTriquiTurn(null);
      if (this._aiTimer !== null) {
        clearTimeout(this._aiTimer);
        this._aiTimer = null;
      }
      if (this._turnNoticeTimer !== null) {
        clearTimeout(this._turnNoticeTimer);
        this._turnNoticeTimer = null;
      }
      if (this._turnNoticeExitTimer !== null) {
        clearTimeout(this._turnNoticeExitTimer);
        this._turnNoticeExitTimer = null;
      }
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  protected onTutorialClosed(): void {
    const eng = this._engine();
    const isStartOfGame = eng ? eng.board.every((c) => c === null) : false;
    if (isStartOfGame) {
      this._showTurnNotice();
    } else {
      this.media.playSfx(SFX.gameStart);
      if (eng && eng.currentMark === eng.aiMark && !eng.isOver && !this.isAiThinking()) {
        this._triggerAiTurn(eng);
      }
    }
  }

  /** Muestra la notificación de primer turno antes de iniciar la jugada. */
  private _showTurnNotice(): void {
    if (this._destroyed) return;
    this.turnNoticeVisible.set(true);
    this.turnNoticeExiting.set(false);

    if (this._turnNoticeTimer !== null) {
      clearTimeout(this._turnNoticeTimer);
    }
    const durationMs = this.turnNoticeDurationSec() * 1000;
    this._turnNoticeTimer = setTimeout(() => {
      this.dismissTurnNotice();
    }, durationMs);
  }

  /**
   * Descarta la notificación de primer turno, lanza la transición de salida con el SFX
   * y posteriormente arranca el turno de la IA si le corresponde.
   */
  protected dismissTurnNotice(): void {
    if (!this.turnNoticeVisible() || this.turnNoticeExiting() || this._destroyed) return;

    if (this._turnNoticeTimer !== null) {
      clearTimeout(this._turnNoticeTimer);
      this._turnNoticeTimer = null;
    }

    // Pasa a la transición de salida
    this.turnNoticeExiting.set(true);

    // Reproducir el SFX de inicio justo al pasar a la transición de salida
    this.media.playSfx(SFX.gameStart);

    if (this._turnNoticeExitTimer !== null) {
      clearTimeout(this._turnNoticeExitTimer);
    }
    this._turnNoticeExitTimer = setTimeout(() => {
      this._turnNoticeExitTimer = null;
      if (this._destroyed) return;

      this.turnNoticeVisible.set(false);
      this.turnNoticeExiting.set(false);

      // Si le toca arrancar a la IA
      const eng = this._engine();
      if (eng && eng.currentMark === eng.aiMark && !eng.isOver && !this.isAiThinking()) {
        this._triggerAiTurn(eng);
      }
    }, this.TURN_NOTICE_EXIT_DURATION_MS);
  }

  protected isWinningCell(cell: CellIndex): boolean {
    const line = this._winningLine();
    return line !== null && line.includes(cell);
  }

  protected onCellClick(cell: CellIndex): void {
    const eng = this._engine();
    if (!eng || eng.isOver || this.isAiThinking() || this.turnNoticeVisible()) return;
    if (eng.currentMark !== eng.playerMark) return;

    const events = eng.place(cell);
    if (events.length === 0) return;

    // Sincronizar tablero inmediatamente
    this._refreshState(eng);

    for (const ev of events) {
      if (ev.type === 'place') {
        this.media.playSfx(SFX.put);
      } else if (ev.type === 'win') {
        this._winningLine.set(ev.line);
        this.session.complete('win');
        return;
      } else if (ev.type === 'draw') {
        this.session.announce('draw');
        return;
      }
    }

    // Si la ronda sigue, disparar el turno de la IA con retardo
    if (!eng.isOver && eng.currentMark === eng.aiMark) {
      this._triggerAiTurn(eng);
    }
  }

  // ── Lógica de la IA ─────────────────────────────────────────────────────────

  private _triggerAiTurn(eng: TriquiEngine): void {
    if (this._destroyed) return;
    this.isAiThinking.set(true);

    const delay = getRandomAiThinkingDelay();

    this._aiTimer = setTimeout(() => {
      this._aiTimer = null;
      if (this._destroyed) return;
      if (eng.isOver) {
        this.isAiThinking.set(false);
        return;
      }

      const events = eng.aiPlace();
      this._refreshState(eng);
      this.isAiThinking.set(false);

      for (const ev of events) {
        if (ev.type === 'place') {
          this.media.playSfx(SFX.put);
        } else if (ev.type === 'lose') {
          this._winningLine.set(ev.line);
          const rem = this.session.loseLife();
          if (rem > 0) {
            this.session.announce('lose');
          }
          return;
        } else if (ev.type === 'draw') {
          this.session.announce('draw');
          return;
        }
      }
    }, delay);
  }

  // ── Inicialización y Precarga ───────────────────────────────────────────────

  private async _preloadAndInit(): Promise<void> {
    this.loading.set(true);

    const difficulty = this.resolvedDifficulty();
    const firstPlayer = this.resolvedFirstPlayer();
    const playerSymbol = this.resolvedPlayerSymbol();
    // Usamos sessionRound 1-based → índice 0 para alternate/random
    const sessionRound = Math.max(0, this.session.sessionRound() - 1);

    const eng = new TriquiEngine({
      difficulty,
      firstPlayer,
      playerSymbol,
      sessionRound,
    });

    this._engine.set(eng);
    this._refreshState(eng);
    this.loading.set(false);

    if (this._destroyed) return;

    // Precarga de assets en segundo plano (fire-and-forget resiliente)
    const preloadPromises: Promise<void>[] = [
      this._preloadImage(this.markXUrl()),
      this._preloadImage(this.markOUrl()),
      ...Object.values(SFX).map((url) => this._preloadAudio(url)),
    ];
    void Promise.allSettled(preloadPromises);

    // Si arranca sin tutorial automático pendiente, mostrar aviso de primer turno
    const tutorial = this.tutorialModal();
    const waitingTutorial =
      this.session.autoShowTutorial() ||
      !!tutorial?.visible() ||
      !!tutorial?.opening();

    if (!waitingTutorial) {
      this._showTurnNotice();
    }
  }

  private _refreshState(eng: TriquiEngine): void {
    this._board.set([...eng.board]);
  }

  private _preloadImage(url: string): Promise<void> {
    return this.imageCache.preload(url);
  }

  private _preloadAudio(url: string): Promise<void> {
    return new Promise((resolve) => {
      this.media.preload(url);
      resolve();
    });
  }
}
