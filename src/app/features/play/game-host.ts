import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  Type,
  untracked,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { CatalogService } from '../../core/catalog/catalog';
import { GameSession } from '../../core/session/game-session';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { resolveMemoryConfig } from '../../core/games/memory/memory-config';
import { GameExperience } from '../../core/catalog/game-experience.model';
import { UnavailableScreen } from '../shared/unavailable-screen';
import { GameChrome } from '../shared/game-chrome';
import { ResultScreen } from '../result/result-screen';
import { GameExitConfirmDialog } from '../shared/game-exit-confirm-dialog';
import { MemoryPlay } from './memory-play';
import { TriquiPlay } from './triqui-play';

type GameComponentInputs = Record<string, unknown>;

/**
 * Registro de componentes de juego por gameId.
 * NO hay if/switch por marca; la lógica es puramente: gameId → componente.
 * Fase 5: memory ya no es un stub; Fase 6 registrará triqui real.
 */
const GAME_COMPONENT_BY_ID: Readonly<Record<string, Type<unknown>>> = {
  memory: MemoryPlay,
  triqui: TriquiPlay,
};

/**
 * GameHost — Anfitrión genérico de experiencias de juego.
 * - Resuelve experienceId → experiencia → gameId → componente de juego.
 * - Envuelve el juego en el cromado `GameChrome`.
 * - Superpone el overlay de resultado (glass) sin salir de `/play`.
 * - Sincroniza vidas con `GameSession`.
 */
@Component({
  selector: 'app-game-host',
  imports: [NgComponentOutlet, UnavailableScreen, GameChrome, ResultScreen, GameExitConfirmDialog],
  host: {
    class: 'flex flex-col flex-1 w-full h-full min-h-0 overflow-y-auto',
    style: 'touch-action: pan-y; -webkit-overflow-scrolling: touch;',
  },
  template: `
    @if (resolvedComponent(); as component) {
      <app-game-chrome
        [gameTitle]="gameTitle()"
        [brandName]="brandName()"
        [brandLogo]="brandLogo()"
        [brandDisclaimer]="brand()?.disclaimer"
        [introText]="gameIntro()"
        [remainingLives]="session.remainingLives()"
        [maxLives]="session.maxLives()"
        [roundNumber]="roundCounter()"
        [blurTint]="brand()?.atmosphere?.blurTint"
        [develop]="isDevelop()"
        (back)="onRequestBack()"
        (help)="session.requestTutorial()"
      >
        <!-- Indicador de turno: pestaña superior centrada dentro del board-slot -->
        @if (session.triquiTurn(); as turn) {
          <div board-slot-top class="flex items-center justify-center">
            @if (turn.state === 'ai') {
              <div
                class="flex items-center gap-2 sm:gap-2.5 bg-white/10 border border-t-0 border-white/15 rounded-none rounded-b-2xl px-4 sm:px-5 py-2 backdrop-blur-md shadow-md text-xs sm:text-sm"
                role="status"
                aria-live="polite"
              >
                <div class="relative w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shrink-0">
                  @if (turn.markOUrl) {
                    <img [src]="turn.markOUrl" alt="O" class="w-4 h-4 sm:w-5 sm:h-5 object-contain drop-shadow animate-pulse" />
                  } @else {
                    <span class="text-sm sm:text-base font-bold text-amber-300 animate-pulse">○</span>
                  }
                </div>
                <span class="text-white font-bold tracking-wide">IA Analizando jugada</span>
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              </div>
            } @else if (turn.state === 'player') {
              <div
                class="flex items-center gap-2 sm:gap-2.5 bg-white/10 border border-t-0 border-white/15 rounded-none rounded-b-2xl px-4 sm:px-5 py-2 backdrop-blur-md shadow-md text-xs sm:text-sm"
                role="status"
                aria-live="polite"
              >
                <div class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shrink-0">
                  @if (turn.markXUrl) {
                    <img [src]="turn.markXUrl" alt="X" class="w-4 h-4 sm:w-5 sm:h-5 object-contain drop-shadow" />
                  } @else {
                    <span class="text-sm sm:text-base font-black text-cyan-300">✕</span>
                  }
                </div>
                <span class="text-white font-bold tracking-wide">Tu turno</span>
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
            }
          </div>
        }

        @for (round of [session.round()]; track round) {
          @if (round > 0) {
            <ng-container
              [ngComponentOutlet]="component"
              [ngComponentOutletInputs]="resolvedInputs()"
            />
          }
        }
      </app-game-chrome>
      @if (session.playResult(); as result) {
        <app-result-screen
          [result]="result"
          [experienceId]="experienceId()"
          [brandName]="brandName()"
          [gameName]="gameTitle()"
          [develop]="isDevelop()"
        />
      }
      @if (showExitConfirm()) {
        <app-game-exit-confirm-dialog
          [iconUrl]="exitConfirmConfig()?.icon || '/content/images/experiences/result/warning.png'"
          [title]="exitConfirmConfig()?.title || '¿ABANDONAR LA PARTIDA?'"
          [message]="exitConfirmConfig()?.message || 'Si regresas a la selección de juegos, perderás tu progreso actual en esta sesión.<br><strong>¿Deseas salir o continuar jugando?</strong>'"
          [confirmLabel]="exitConfirmConfig()?.confirmButtonText || 'Sí, salir'"
          [cancelLabel]="exitConfirmConfig()?.cancelButtonText || 'Continuar jugando'"
          [brandName]="brandName()"
          [gameName]="gameTitle()"
          (confirmed)="onConfirmExit()"
          (cancelled)="onCancelExit()"
        />
      }
    } @else {
      <app-unavailable-screen
        title="Juego no disponible"
        message="Esta experiencia no está disponible en este momento o el motor no es compatible."
      />
    }
  `,
})
export class GameHost {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);
  protected readonly session = inject(GameSession);
  private readonly settings = inject(KioskSettings);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private startedExperienceId = '';
  private leaving = false;
  protected readonly showExitConfirm = signal<boolean>(false);

  protected readonly exitConfirmConfig = computed(() => {
    return this.experience()?.exitConfirm;
  });

  protected readonly experienceId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('experienceId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('experienceId') ?? '' },
  );

  protected readonly experience = computed<GameExperience | undefined>(() =>
    this.catalog.getExperienceById(this.experienceId()),
  );

  protected readonly brand = computed(() => {
    const exp = this.experience();
    return exp ? this.catalog.getBrandById(exp.brandId) : undefined;
  });

  protected readonly game = computed(() => {
    const exp = this.experience();
    return exp ? this.catalog.getGameById(exp.gameId) : undefined;
  });

  /** Contador de ronda visible solo en Triqui (empates sucesivos). */
  protected readonly roundCounter = computed<number | null>(() => {
    return this.game()?.id === 'triqui' ? this.session.sessionRound() : null;
  });

  protected readonly gameTitle = computed(() => {
    const exp = this.experience();
    if (!exp) return 'Experiencia de Juego';
    return exp.name ?? exp.title ?? this.game()?.name ?? 'Juego Merz';
  });

  protected readonly isDevelop = computed(() => {
    const exp = this.experience();
    return exp ? this.catalog.isExperienceDevelop(exp) : false;
  });

  protected readonly brandName = computed(() => {
    return this.brand()?.name ?? 'Merz Aesthetics';
  });

  protected readonly brandLogo = computed(() => {
    return this.brand()?.logo ?? this.experience()?.assets?.logo ?? this.brand()?.image;
  });

  protected readonly gameIntro = computed(() => {
    const exp = this.experience();
    if (!exp) return 'Pon a prueba tu destreza en este juego interactivo.';
    return (
      exp.description ??
      this.game()?.description ??
      'Pon a prueba tu memoria y destreza en este juego interactivo.'
    );
  });

  /** Componente de juego resuelto para el gameId de la experiencia. undefined = no disponible. */
  protected readonly resolvedComponent = computed<Type<unknown> | undefined>(() => {
    const exp = this.experience();
    if (!exp) return undefined;
    return GAME_COMPONENT_BY_ID[exp.gameId];
  });

  /** Inputs pasados al componente de juego via NgComponentOutlet. */
  protected readonly resolvedInputs = computed<GameComponentInputs | undefined>(() => {
    const exp = this.experience();
    if (!exp) return undefined;
    const game = this.game();
    return {
      experienceId: exp.id,
      brandId: exp.brandId,
      gameId: exp.gameId,
      remainingLives: this.session.remainingLives(),
      theme: exp.theme ?? {},
      assets: exp.assets ?? {},
      config: exp.config ?? {},
      blurTint: this.catalog.atmosphereForExperience?.(exp.id)?.blurTint
        ?? this.brand()?.atmosphere?.blurTint,
      // Configuración y activos del motor (nivel game.config / game.assets en la cascada)
      gameConfig: game?.config ?? {},
      gameAssets: game?.assets ?? {},
      ...(exp.turnNotice !== undefined ? { turnNotice: exp.turnNotice } : {}),
    };
  });

  constructor() {
    // Una sola sesión por experienceId mientras este host viva.
    // Reentrar al mismo juego destruye el host (se sale de /play) y vuelve a llamar start().
    effect(() => {
      const exp = this.experience();
      if (!exp) return;
      untracked(() => {
        if (this.startedExperienceId === exp.id) return;
        this.startedExperienceId = exp.id;
        let initialLives = 3;
        if (exp.gameId === 'memory') {
          const kioskOverride = this.settings.getExperienceMemoryConfig(exp.id);
          const resolved = resolveMemoryConfig({
            kioskOverride,
            experienceConfig: exp.config,
            gameConfig: this.game()?.config,
          });
          initialLives = resolved.lives;
        }
        this.session.start(exp.id, initialLives);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.cancelHostAnimations();
      this.session.leavePlay();
    });
  }

  onRequestBack(): void {
    if (this.session.playResult() !== null) {
      this.goBackToGames();
      return;
    }
    this.showExitConfirm.set(true);
  }

  onConfirmExit(): void {
    this.showExitConfirm.set(false);
    this.goBackToGames();
  }

  onCancelExit(): void {
    this.showExitConfirm.set(false);
  }

  goBackToGames(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cancelHostAnimations();
    this.session.leavePlay();

    const brandId = this.brand()?.id;
    const target = brandId
      ? ['/brands', brandId, 'games']
      : ['/brands'];

    requestAnimationFrame(() => {
      void this.router.navigate(target);
    });
  }

  /** Cancela animaciones CSS/WAAPI del tablero para no dejar Animation.startTime huérfano. */
  private cancelHostAnimations(): void {
    const root = this.hostEl.nativeElement;
    if (typeof root.getAnimations !== 'function') return;
    try {
      for (const animation of root.getAnimations({ subtree: true })) {
        animation.cancel();
      }
    } catch {
      // jsdom / WebKit sin getAnimations subtree
    }
  }
}
