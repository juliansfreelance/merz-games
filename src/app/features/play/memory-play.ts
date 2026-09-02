import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  OnInit,
} from '@angular/core';
import { GameSession } from '../../core/session/game-session';
import {
  ExperienceAssets,
  ExperienceConfig,
  ExperienceTheme,
} from '../../core/catalog/game-experience.model';
import { GameAssets } from '../../core/catalog/game.model';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { MediaPlayer } from '../../core/media/media-player';
import { MemoryEngine, MISMATCH_DELAY_MS } from '../../core/games/memory/memory-engine';
import { MemoryCard as MemoryCardModel } from '../../core/games/memory/memory.model';
import { resolveMemoryPairs } from '../../core/games/memory/memory-config';
import {
  computeCardLayout,
  calculateMinimumBoardHeight,
  CardLayoutResult,
  MIN_CARD_WIDTH,
  MAX_CARD_WIDTH,
} from '../../core/games/memory/card-layout';
import { MemoryCard } from './memory-card';
import { MemoryTutorial } from './memory-tutorial';

/** URL de dorso de fallback si el manifest no provee uno. */
const FALLBACK_CARD_BACK = '/content/images/games/memory/cards/card-back.png';

/** Faces de fallback (primeras 4 del atlas recortado) para cuando la experiencia no configura caras. */
const FALLBACK_CARD_FACES: readonly string[] = Array.from(
  { length: 12 },
  (_, i) => `/content/images/games/memory/cards/card-${String(i + 1).padStart(2, '0')}.png`,
);

/** URLs de los SFX del motor de memoria. */
const SFX = {
  flip:      '/content/audio/sfx/flip.mp3',
  match:     '/content/audio/sfx/match.mp3',
  mismatch:  '/content/audio/sfx/mismatch.mp3',
  gameStart: '/content/audio/sfx/game-start.mp3',
  gameEnd:   '/content/audio/sfx/game-end.mp3',
};

/**
 * MemoryPlay — Presentación del motor de Memoria dentro del board-slot de GameChrome.
 *
 * Responsabilidades:
 * - Resolver el número de parejas con la cascada de configuración.
 * - Precargar el dorso, las caras de la ronda y los SFX.
 * - Instanciar MemoryEngine y traducir sus eventos a sesión, sonido y UI.
 * - Renderizar el tablero con rejilla derivada.
 * - Mostrar el tutorial al entrar y al pulsar «?».
 *
 * SIN atajos QA: fueron eliminados en esta fase (los de TriquiPlay se conservan).
 * SIN ramificaciones por brandId.
 */
@Component({
  selector: 'app-memory-play',
  imports: [MemoryCard, MemoryTutorial],
  host: {
    class: 'flex flex-col items-center justify-center h-full w-full relative select-none',
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

    <!-- Tablero activo -->
    @if (!loading() && engine()) {
      <div
        #boardContainer
        class="relative w-full h-full flex items-center justify-center overflow-hidden p-0.5"
        [style.minHeight.px]="minBoardHeight()"
        role="status"
        [attr.aria-label]="boardStatus()"
      >
        <!-- Tutorial Modal de pantalla completa interactivo -->
        <app-memory-tutorial
          #tutorialModal
          [tutorialText]="tutorialText()"
          [pairs]="resolvedPairs()"
          [backUrl]="backUrl()"
          [sampleFaceUrl]="sampleFaceUrl()"
          [accentColor]="accentColor()"
          (closed)="onTutorialClosed()"
        />

        <!-- Rejilla de cartas calculada matemáticamente con las dimensiones reales del slot -->
        <div
          class="grid justify-center items-center m-auto transition-all duration-300 ease-out"
          [style.width.px]="layout().boardWidth"
          [style.height.px]="layout().boardHeight"
          [style.grid-template-columns]="'repeat(' + layout().columns + ', 1fr)'"
          [style.grid-template-rows]="'repeat(' + layout().rows + ', 1fr)'"
          [style.gap.px]="gridGap()"
        >
          @for (card of cards(); track card.id) {
            <app-memory-card
              [style.width.px]="layout().cardWidth"
              [style.height.px]="layout().cardHeight"
              [cardId]="card.id"
              [pairKey]="card.pairKey"
              [state]="card.state"
              [faceUrl]="card.faceUrl"
              [backUrl]="backUrl()"
              [accentColor]="accentColor()"
              [blurTint]="brandBlurTint()"
              (flip)="onCardFlip($event)"
            />
          }
        </div>
      </div>
    }
  `,
})
export class MemoryPlay implements OnInit {
  // ── Inputs del motor (inyectados por GameHost via NgComponentOutlet) ────────
  readonly experienceId = input.required<string>();
  readonly brandId      = input.required<string>();
  readonly gameId       = input.required<string>();
  readonly remainingLives = input<number>(3);
  readonly theme        = input<ExperienceTheme>({});
  readonly assets       = input<ExperienceAssets>({});
  readonly config       = input<ExperienceConfig>({});
  /** Tinte de atmósfera de la marca seleccionada (blurTint). */
  readonly blurTint     = input<string | undefined>(undefined);
  /** Configuración maestra del motor (game.config). */
  readonly gameConfig   = input<ExperienceConfig>({});
  /** Assets del motor (game.assets, p.ej. SFX compartidos). */
  readonly gameAssets   = input<GameAssets>({});

  // ── Servicios ───────────────────────────────────────────────────────────────
  private readonly session     = inject(GameSession);
  private readonly settings    = inject(KioskSettings);
  private readonly media       = inject(MediaPlayer);
  private readonly destroyRef  = inject(DestroyRef);

  // ── Estado de UI ────────────────────────────────────────────────────────────
  protected readonly loading    = signal(true);
  private readonly _engine      = signal<MemoryEngine | null>(null);
  private readonly _cards       = signal<readonly MemoryCardModel[]>([]);
  private _mismatchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computados ──────────────────────────────────────────────────────────────

  protected readonly engine = this._engine.asReadonly();
  protected readonly cards  = this._cards.asReadonly();

  protected readonly resolvedPairs = computed(() => {
    const result = resolveMemoryPairs({
      kioskOverride:    this.settings.memoryPairs(),
      experienceConfig: this.config(),
      gameConfig:       this.gameConfig(),
    });
    console.info(`MemoryPlay: pairs = ${result.pairs} (fuente: ${result.source})`);
    return result.pairs;
  });

  /** URL del dorso: experiencia → carpeta de marca correspondiente → fallback global. */
  protected readonly backUrl = computed<string>(() => {
    const fromAssets = this.assets().cardBack;
    if (fromAssets) return fromAssets;
    const brand = this.brandId();
    if (brand) {
      return `/content/images/games/memory/cards/${brand}/card-back.png`;
    }
    return FALLBACK_CARD_BACK;
  });

  /** Pool de caras: experiencia → caras de la carpeta de marca → fallback. */
  private readonly faces = computed<readonly string[]>(() => {
    const fromAssets = this.assets().cardFaces;
    if (Array.isArray(fromAssets) && fromAssets.length > 0) return fromAssets;

    const brand = this.brandId();
    if (brand === 'radiesse') {
      return Array.from(
        { length: 27 },
        (_, i) => `/content/images/games/memory/cards/radiesse/card-${String(i + 1).padStart(2, '0')}.png`,
      );
    }
    if (brand === 'ultherapy') {
      return Array.from(
        { length: 27 },
        (_, i) => `/content/images/games/memory/cards/ultherapy/card-${String(i + 28).padStart(2, '0')}.png`,
      );
    }

    return FALLBACK_CARD_FACES;
  });

  /** Color de acento de la experiencia (para glow y gradientes). */
  protected readonly accentColor = computed<string>(() => {
    return this.theme().accentColor ?? '#00E5FF';
  });

  /** blurTint de la marca; si no llega, se usa el acento de la experiencia. */
  protected readonly brandBlurTint = computed<string>(() => {
    return this.blurTint() || this.accentColor();
  });

  /** Cara de muestra para la animación del tutorial interactivo. */
  protected readonly sampleFaceUrl = computed<string>(() => {
    const pool = this.faces();
    return pool.length > 0 ? pool[0] : '';
  });

  // ── Referencias a vistas hijas ──────────────────────────────────────────
  protected readonly tutorialModal = viewChild<MemoryTutorial>('tutorialModal');
  protected readonly boardContainer = viewChild<ElementRef<HTMLElement>>('boardContainer');
  private readonly slotDimensions = signal<{ width: number; height: number }>({ width: 0, height: 0 });
  private _resizeObserver: ResizeObserver | null = null;

  /** Separación (gap) adaptativa entre cartas en píxeles. */
  protected readonly gridGap = computed<number>(() => {
    const { width } = this.slotDimensions();
    if (width >= 800) return 16;
    if (width >= 480) return 12;
    return 8;
  });

  /** Altura mínima requerida para el slot para asegurar que las cartas sean jugables (>= MIN_CARD_WIDTH). */
  protected readonly minBoardHeight = computed<number>(() => {
    const total = this.resolvedPairs() * 2;
    const { width, height } = this.slotDimensions();
    const isLandscape = width > height && width > 0;
    return calculateMinimumBoardHeight(total, isLandscape, MIN_CARD_WIDTH, this.gridGap());
  });

  /** Layout adaptativo calculado en base a las dimensiones reales del slot. */
  protected readonly layout = computed<CardLayoutResult>(() => {
    const { width, height } = this.slotDimensions();
    const minHeight = this.minBoardHeight();
    const effectiveHeight = Math.max(height, minHeight);
    const total = this.resolvedPairs() * 2;
    const gap = this.gridGap();

    return computeCardLayout({
      containerWidth: width,
      containerHeight: effectiveHeight,
      totalCards: total,
      gap,
      paddingX: 4,
      paddingY: 4,
      minCardWidth: MIN_CARD_WIDTH,
      maxCardWidth: MAX_CARD_WIDTH,
    });
  });

  /** Texto del tutorial desde config o fallback. */
  protected readonly tutorialText = computed<string>(() => {
    const fromConfig = this.config()['tutorialText'] ?? this.gameConfig()['tutorialText'];
    return typeof fromConfig === 'string' ? fromConfig : 'Toca dos cartas y encuentra la pareja';
  });

  /** Mensaje accesible del estado del tablero. */
  protected readonly boardStatus = computed<string>(() => {
    const total   = this.resolvedPairs() * 2;
    const matched = this.cards().filter(c => c.state === 'matched').length;
    return `Tablero de memoria: ${matched} de ${total} cartas emparejadas.`;
  });

  constructor() {
    // Observar cuando boardContainer esté disponible en el DOM
    effect(() => {
      const containerRef = this.boardContainer();
      if (!containerRef?.nativeElement) return;

      const el = containerRef.nativeElement;

      // Medición inicial síncrona
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.slotDimensions.set({ width: rect.width, height: rect.height });
      }

      // Observador continuo de redimensionamiento
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver?.disconnect();
        this._resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const cr = entry.contentRect;
            if (cr.width > 0 && cr.height > 0) {
              this.slotDimensions.set({ width: cr.width, height: cr.height });
            }
          }
        });
        this._resizeObserver.observe(el);
      }
    });

    // Abrir automáticamente el modal del tutorial al iniciar la partida (una vez que cargue)
    effect(() => {
      const isLoaded = !this.loading();
      const modal = this.tutorialModal();
      if (isLoaded && modal) {
        modal.showTutorial();
      }
    });

    // Abrir el modal cada vez que el usuario presione el botón «?» junto a las vidas
    effect(() => {
      const req = this.session.tutorialRequested();
      const modal = this.tutorialModal();
      if (req > 0 && modal) {
        modal.showTutorial();
      }
    });
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this._preloadAndInit();
    this.destroyRef.onDestroy(() => {
      if (this._mismatchTimer !== null) clearTimeout(this._mismatchTimer);
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  protected onTutorialClosed(): void {
    this.media.playSfx(SFX.gameStart);
  }

  protected onCardFlip(cardId: string): void {
    const eng = this._engine();
    if (!eng) return;

    const events = eng.reveal(cardId);
    if (events.length === 0) return;

    for (const event of events) {
      switch (event.type) {
        case 'flip':
          this.media.playSfx(SFX.flip);
          break;

        case 'match':
          this.media.playSfx(SFX.match);
          break;

        case 'mismatch':
          this.media.playSfx(SFX.mismatch);
          // Programar la resolución de la ventana de evaluación
          this._mismatchTimer = setTimeout(() => {
            eng.resolvePending();
            this._refreshCards(eng);
            this._mismatchTimer = null;
          }, MISMATCH_DELAY_MS);
          // Restar vida (el GameChrome actualizará los corazones via session.remainingLives())
          this.session.loseLife();
          break;

        case 'win':
          this.media.playSfx(SFX.gameEnd);
          this.session.complete('win');
          break;

        case 'lose':
          // loseLife() ya navega a out-of-lives cuando llega a 0
          break;
      }
    }

    // Actualizar el array de cartas para que Angular detecte cambios de state
    this._refreshCards(eng);
  }

  // ── Privados ─────────────────────────────────────────────────────────────────

  private async _preloadAndInit(): Promise<void> {
    this.loading.set(true);

    const pairs = this.resolvedPairs();
    const allFaces = this.faces();
    const back = this.backUrl();

    // 1. Instanciar el motor con el pool completo de caras de la marca:
    // MemoryEngine seleccionará aleatoriamente `pairs` caras distintas.
    const eng = new MemoryEngine({
      faces: allFaces,
      pairs,
      lives: this.session.remainingLives(),
    });

    // 2. Extraer las caras únicas que fueron seleccionadas para esta partida
    const uniqueFacesInDeck = Array.from(new Set(eng.cards.map((c) => c.faceUrl)));

    // 3. Precargar solo las imágenes de la partida activa y los SFX
    const preloadPromises: Promise<void>[] = [
      ...uniqueFacesInDeck.map((url) => this._preloadImage(url)),
      this._preloadImage(back),
      ...Object.values(SFX).map((url) => this._preloadAudio(url)),
    ];

    await Promise.allSettled(preloadPromises);

    this._engine.set(eng);
    this._refreshCards(eng);
    this.loading.set(false);
  }

  /** Sincroniza el signal de cartas con el estado interno del motor. */
  private _refreshCards(eng: MemoryEngine): void {
    // Crear una copia shallow para que Angular detecte el cambio de referencia
    this._cards.set([...eng.cards]);
  }

  private _preloadImage(url: string): Promise<void> {
    return new Promise((resolve) => {
      if (!url) { resolve(); return; }
      const img = new Image();
      img.onload  = () => resolve();
      img.onerror = () => resolve(); // resiliente
      img.src = url;
    });
  }

  private _preloadAudio(url: string): Promise<void> {
    return new Promise((resolve) => {
      this.media.preload(url);
      resolve(); // preload() es fire-and-forget
    });
  }
}
