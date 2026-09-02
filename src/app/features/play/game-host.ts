import {
  Component,
  computed,
  effect,
  inject,
  Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { CatalogService } from '../../core/catalog/catalog';
import { GameSession } from '../../core/session/game-session';
import { GameExperience } from '../../core/catalog/game-experience.model';
import { UnavailableScreen } from '../shared/unavailable-screen';
import { GameChrome } from '../shared/game-chrome';
import { MemoryPlay } from './memory-play';
import { TriquiPlay } from './triqui-play';

type GameStubInputs = Record<string, unknown>;

/**
 * Registro de motores de juego conocidos.
 * NO hay if/switch por marca; la lógica es puramente: gameId → componente.
 */
const GAME_STUB_BY_ID: Readonly<Record<string, Type<unknown>>> = {
  memory: MemoryPlay,
  triqui: TriquiPlay,
};

/**
 * GameHost — Anfitrión genérico de experiencias de juego.
 * - Resuelve experienceId → experiencia → gameId → componente de juego.
 * - Envuelve el juego en el cromado `GameChrome`.
 * - Sincroniza vidas con `GameSession`.
 */
@Component({
  selector: 'app-game-host',
  imports: [NgComponentOutlet, UnavailableScreen, GameChrome],
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
        (back)="goBackToGames()"
      >
        <ng-container
          [ngComponentOutlet]="component"
          [ngComponentOutletInputs]="resolvedInputs()"
        />
      </app-game-chrome>
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

  private readonly experienceId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('experienceId') ?? '')),
    { initialValue: '' },
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

  protected readonly gameTitle = computed(() => {
    const exp = this.experience();
    if (!exp) return 'Experiencia de Juego';
    return exp.title ?? this.game()?.name ?? 'Juego Merz';
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

  /** Componente stub resuelto para el gameId de la experiencia. undefined = no disponible. */
  protected readonly resolvedComponent = computed<Type<unknown> | undefined>(() => {
    const exp = this.experience();
    if (!exp) return undefined;
    return GAME_STUB_BY_ID[exp.gameId];
  });

  /** Inputs pasados al componente de juego via NgComponentOutlet. */
  protected readonly resolvedInputs = computed<GameStubInputs | undefined>(() => {
    const exp = this.experience();
    if (!exp) return undefined;
    return {
      experienceId: exp.id,
      brandId: exp.brandId,
      gameId: exp.gameId,
      remainingLives: this.session.remainingLives(),
      theme: exp.theme ?? {},
      assets: exp.assets ?? {},
      config: exp.config ?? {},
    };
  });

  constructor() {
    effect(() => {
      const exp = this.experience();
      if (exp) {
        this.session.start(exp.id);
      }
    });
  }

  goBackToGames(): void {
    const brandId = this.brand()?.id;
    if (brandId) {
      this.router.navigate(['/brands', brandId, 'games']);
    } else {
      this.router.navigate(['/brands']);
    }
  }
}
