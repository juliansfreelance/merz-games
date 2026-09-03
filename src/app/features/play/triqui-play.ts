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
} from '../../core/catalog/game-experience.model';
import { GameAssets } from '../../core/catalog/game.model';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { MediaPlayer } from '../../core/media/media-player';
import { TriquiEngine } from '../../core/games/triqui/triqui-engine';
import {
  CellIndex,
  Mark,
  TriquiWinningLine,
} from '../../core/games/triqui/triqui.model';
import {
  resolveTriquiDifficulty,
  resolveTriquiFirstPlayer,
} from '../../core/games/triqui/triqui-config';
import { TriquiCell } from './triqui-cell';
import { TriquiTutorial, TUTORIAL_AUTO_REVEAL_MS } from './triqui-tutorial';

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
  imports: [TriquiCell, TriquiTutorial],
  host: {
    class: 'flex flex-col items-center justify-center h-full w-full relative select-none p-2 sm:p-4',
    style: 'touch-action: manipulation;',
  },
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
        class="relative w-full h-full flex flex-col items-center justify-center max-w-[min(100%,480px)] max-h-[min(100%,480px)] aspect-square m-auto"
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
              [disabled]="isAiThinking() || (engine()?.isOver ?? false)"
              (cellClick)="onCellClick($event)"
            />
          }
        </div>
      </div>
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

  // ── Servicios ───────────────────────────────────────────────────────────────
  protected readonly session = inject(GameSession);
  private readonly settings = inject(KioskSettings);
  private readonly media = inject(MediaPlayer);
  private readonly destroyRef = inject(DestroyRef);

  // ── Constante de celdas fijas 0 a 8 ─────────────────────────────────────────
  protected readonly cellIndices: readonly CellIndex[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  // ── Estado Local ────────────────────────────────────────────────────────────
  protected readonly loading = signal(true);
  protected readonly isAiThinking = signal(false);
  private readonly _engine = signal<TriquiEngine | null>(null);
  private readonly _board = signal<readonly (Mark | null)[]>(Array(9).fill(null));
  private readonly _winningLine = signal<TriquiWinningLine | null>(null);

  protected readonly engine = this._engine.asReadonly();
  readonly board = this._board.asReadonly();
  protected readonly winningLine = this._winningLine.asReadonly();

  // ── Referencias ─────────────────────────────────────────────────────────────
  protected readonly tutorialModal = viewChild<TriquiTutorial>('tutorialModal');
  private _aiTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;
  private lastHelpReq = 0;

  // ── Computados de Configuración ─────────────────────────────────────────────

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
    // Tutorial automático solo al iniciar la sesión (vidas a tope), no en cada ronda
    effect(() => {
      const isLoaded = !this.loading();
      const modal = this.tutorialModal();
      const auto = this.session.autoShowTutorial();
      if (isLoaded && modal && auto) {
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
        state = 'player';
      }

      this.session.setTriquiTurn({
        state,
        markXUrl: this.markXUrl(),
        markOUrl: this.markOUrl(),
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
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  protected onTutorialClosed(): void {
    this.media.playSfx(SFX.gameStart);

    // Si la ronda arrancaba con la IA y está esperando mover
    const eng = this._engine();
    if (eng && eng.currentMark === 'O' && !eng.isOver && !this.isAiThinking()) {
      this._triggerAiTurn(eng);
    }
  }

  protected isWinningCell(cell: CellIndex): boolean {
    const line = this._winningLine();
    return line !== null && line.includes(cell);
  }

  protected onCellClick(cell: CellIndex): void {
    const eng = this._engine();
    if (!eng || eng.isOver || this.isAiThinking()) return;
    if (eng.currentMark !== 'X') return;

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
    if (!eng.isOver && (eng.currentMark as string) === 'O') {
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
    // Usamos sessionRound 1-based → índice 0 para alternate/random
    const sessionRound = Math.max(0, this.session.sessionRound() - 1);

    const eng = new TriquiEngine({
      difficulty,
      firstPlayer,
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

    // Si arranca la IA, esperar al tutorial (visible o aún por entrar).
    if (eng.currentMark === 'O' && !eng.isOver) {
      const tutorial = this.tutorialModal();
      const waitingTutorial =
        this.session.autoShowTutorial() ||
        !!tutorial?.visible() ||
        !!tutorial?.opening();
      if (!waitingTutorial) {
        this._triggerAiTurn(eng);
      }
    }
  }

  private _refreshState(eng: TriquiEngine): void {
    this._board.set([...eng.board]);
  }

  private _preloadImage(url: string): Promise<void> {
    return new Promise((resolve) => {
      if (!url || typeof Image === 'undefined') {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 0);
      const img = new Image();
      img.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
      img.src = url;
      if (img.complete) {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  private _preloadAudio(url: string): Promise<void> {
    return new Promise((resolve) => {
      this.media.preload(url);
      resolve();
    });
  }
}
