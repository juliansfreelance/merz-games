import { computed, Injectable, signal } from '@angular/core';
import { inject } from '@angular/core';
import { PlatformService } from '../platform/platform.service';
import { ContentManifest } from './content-manifest.model';
import { Brand } from './brand.model';
import { Game } from './game.model';
import { GameExperience } from './game-experience.model';
import manifestSeed from '../../../../content/manifests/content-manifest.json';

/**
 * Compara dos strings de versión semver (formato "X.Y.Z").
 * Devuelve true si `version` >= `minRequired`.
 * Comparador mínimo sin librería externa.
 */
export function semverGte(version: string, minRequired: string): boolean {
  const parse = (v: string): number[] =>
    v.split('.').map((n) => parseInt(n, 10) || 0);
  const [vMajor, vMinor, vPatch] = parse(version);
  const [mMajor, mMinor, mPatch] = parse(minRequired);

  if (vMajor !== mMajor) return vMajor > mMajor;
  if (vMinor !== mMinor) return vMinor > mMinor;
  return vPatch >= mPatch;
}

/**
 * Lector mínimo de catálogo (Fase 2).
 *
 * Carga la semilla local una sola vez vía import estático (offline-first).
 * Expone Signals computados de marcas y experiencias válidas.
 *
 * NO implementa persistencia, red, rollback ni CatalogManager completo
 * (eso es Fase 3).
 */
@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly platform = inject(PlatformService);

  /** Manifest en memoria (solo la semilla local en Fase 2). */
  private readonly manifest = signal<ContentManifest>(
    manifestSeed as ContentManifest,
  );

  /** Marcas habilitadas, ordenadas por `order`. */
  readonly brands = computed<Brand[]>(() =>
    this.manifest()
      .brands.filter((b) => b.enabled)
      .sort((a, b) => a.order - b.order),
  );

  /**
   * Experiencias habilitadas con relaciones válidas y `minAppVersion` compatible.
   * Una experiencia se excluye si:
   * - No está habilitada.
   * - Su marca no existe o está deshabilitada.
   * - Su motor no existe, está deshabilitado o su `minAppVersion` supera la versión de app.
   */
  readonly experiences = computed<GameExperience[]>(() => {
    const manifest = this.manifest();
    const appVersion = this.platform.appVersion();

    const brandMap = new Map<string, Brand>(
      manifest.brands.map((b) => [b.id, b]),
    );
    const gameMap = new Map<string, Game>(
      manifest.games.map((g) => [g.id, g]),
    );

    return manifest.experiences
      .filter((exp) => {
        if (!exp.enabled) return false;
        const brand = brandMap.get(exp.brandId);
        if (!brand?.enabled) return false;
        const game = gameMap.get(exp.gameId);
        if (!game?.enabled) return false;
        if (!semverGte(appVersion, game.minAppVersion)) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
  });

  /** Experiencias válidas filtradas por brandId. */
  experiencesForBrand(brandId: string): GameExperience[] {
    return this.experiences().filter((exp) => exp.brandId === brandId);
  }

  getBrandById(id: string): Brand | undefined {
    return this.manifest().brands.find((b) => b.id === id);
  }

  getGameById(id: string): Game | undefined {
    return this.manifest().games.find((g) => g.id === id);
  }

  getExperienceById(id: string): GameExperience | undefined {
    return this.experiences().find((exp) => exp.id === id);
  }

  /** Verifica si una marca existe, está habilitada y tiene al menos una experiencia válida. */
  isBrandPlayable(brandId: string): boolean {
    const brand = this.getBrandById(brandId);
    if (!brand?.enabled) return false;
    return this.experiencesForBrand(brandId).length > 0;
  }
}
