import {
  Component,
  computed,
  effect,
  inject,
  Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { CatalogService } from '../../core/catalog/catalog';
import { GameSession } from '../../core/session/game-session';
import { GameExperience } from '../../core/catalog/game-experience.model';
import { UnavailableScreen } from '../shared/unavailable-screen';
import { MemoryPlay } from './memory-play';
import { TriquiPlay } from './triqui-play';

type GameStubInputs = Record<string, unknown>;

/**
 * Registro de motores stub conocidos.
 * Añadir un motor en Fase 4/5 = registrar aquí.
 * NO hay if/switch por marca; la lógica es: gameId → componente.
 */
const GAME_STUB_BY_ID: Readonly<Record<string, Type<unknown>>> = {
  memory: MemoryPlay,
  triqui: TriquiPlay,
};

/**
 * Host genérico de experiencias de juego.
 * - Resuelve experienceId → experiencia → gameId → componente stub.
 * - gameId desconocido → UnavailableScreen (no un switch por marca).
 * - Pasa inputs al stub: experienceId, brandId, gameId, remainingLives, theme, assets, config.
 * - Inicia la sesión (3 vidas) via effect() al cambiar de experiencia.
 * - No importa @tauri-apps/api.
 */
@Component({
  selector: 'app-game-host',
  imports: [NgComponentOutlet, UnavailableScreen],
  template: `
    @if (resolvedComponent(); as component) {
      <div class="h-full w-full overflow-y-auto">
        <ng-container
          [ngComponentOutlet]="component"
          [ngComponentOutletInputs]="resolvedInputs()"
        />
      </div>
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
  private readonly catalog = inject(CatalogService);
  private readonly session = inject(GameSession);

  private readonly experienceId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('experienceId') ?? '')),
    { initialValue: '' },
  );

  private readonly experience = computed<GameExperience | undefined>(() =>
    this.catalog.getExperienceById(this.experienceId()),
  );

  /** Componente stub resuelto para el gameId de la experiencia. undefined = no disponible. */
  protected readonly resolvedComponent = computed<Type<unknown> | undefined>(() => {
    const exp = this.experience();
    if (!exp) return undefined;
    return GAME_STUB_BY_ID[exp.gameId];
  });

  /** Inputs que se pasan al stub via NgComponentOutlet. */
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
    /**
     * Iniciar (o reiniciar) la sesión cada vez que cambia la experiencia activa.
     * DEBE estar en effect() y NO en computed(): un computed no puede
     * producir efectos secundarios (escritura de signals) → causaría NG0600.
     */
    effect(() => {
      const exp = this.experience();
      if (exp) {
        this.session.start(exp.id);
      }
    });
  }
}
