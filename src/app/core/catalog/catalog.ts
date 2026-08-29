import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { PlatformService } from '../platform/platform.service';
import { AppLogger } from '../logging/app-error';
import { ContentManifest } from './content-manifest.model';
import { Brand } from './brand.model';
import { Game } from './game.model';
import { GameExperience } from './game-experience.model';
import manifestSeed from '../../../../content/manifests/content-manifest.json';

/** Clave de localStorage donde se persiste el último manifest válido. */
const MANIFEST_STORAGE_KEY = 'merz-games.catalog-manifest';

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
 * Valida un manifest: relaciones de marcas/motores, enabled, minAppVersion.
 * Retorna una lista de errores (vacía si es válido).
 */
function validateManifest(
  manifest: ContentManifest,
  appVersion: string,
): string[] {
  const errors: string[] = [];

  if (
    !manifest ||
    !Array.isArray(manifest.brands) ||
    !Array.isArray(manifest.games) ||
    !Array.isArray(manifest.experiences)
  ) {
    errors.push('Estructura de manifest inválida: faltan colecciones.');
    return errors;
  }

  const brandMap = new Map<string, Brand>(manifest.brands.map((b) => [b.id, b]));
  const gameMap = new Map<string, Game>(manifest.games.map((g) => [g.id, g]));

  for (const exp of manifest.experiences) {
    const brand = brandMap.get(exp.brandId);
    if (!brand) {
      errors.push(`Experiencia "${exp.id}": marca "${exp.brandId}" no encontrada.`);
      continue;
    }
    if (!brand.enabled) {
      errors.push(`Experiencia "${exp.id}": marca "${exp.brandId}" está deshabilitada.`);
    }
    const game = gameMap.get(exp.gameId);
    if (!game) {
      errors.push(`Experiencia "${exp.id}": motor "${exp.gameId}" no encontrado.`);
      continue;
    }
    if (!game.enabled) {
      errors.push(`Experiencia "${exp.id}": motor "${exp.gameId}" está deshabilitado.`);
    }
    if (game.minAppVersion && !semverGte(appVersion, game.minAppVersion)) {
      errors.push(
        `Experiencia "${exp.id}": motor "${exp.gameId}" requiere app >= ${game.minAppVersion}.`,
      );
    }
  }

  return errors;
}

/**
 * CatalogService — gestor local del catálogo (Fase 3+).
 *
 * Responsabilidades:
 * - Arrancar con la semilla embebida (offline-first garantizado).
 * - Intentar recuperar el último manifest válido persistido en localStorage.
 * - Validar relaciones antes de activar cualquier manifest.
 * - Persistir cada manifest válido activo (reemplazo atómico).
 * - Exponer Signals: `brands`, `experiences`, `selectedBrand`, `experiencesForSelectedBrand`.
 *
 * NO hace fetch de red, NO importa @tauri-apps/api, NO implementa el updater.
 */
@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly platform = inject(PlatformService);
  private readonly logger = inject(AppLogger);

  /** Manifest activo en memoria. Arranca con la semilla. */
  private readonly manifest = signal<ContentManifest>(
    manifestSeed as ContentManifest,
  );

  // ─── Signals públicos de catálogo ───────────────────────────────────────────

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

  /**
   * Marca actualmente seleccionada.
   * `linkedSignal`: al cambiar el catálogo se ajusta automáticamente.
   * - Si la marca seleccionada sigue en `brands` → se mantiene.
   * - Si desapareció → primera marca habilitada (o `undefined`).
   */
  readonly selectedBrand = linkedSignal<Brand[], Brand | undefined>({
    source: this.brands,
    computation: (newBrands, prev) => {
      if (!prev?.value) return newBrands[0];
      const stillExists = newBrands.find((b) => b.id === prev.value?.id);
      return stillExists ?? newBrands[0];
    },
  });

  /** Experiencias válidas de la marca seleccionada. */
  readonly experiencesForSelectedBrand = computed<GameExperience[]>(() => {
    const brand = this.selectedBrand();
    if (!brand) return [];
    return this.experiences().filter((exp) => exp.brandId === brand.id);
  });

  constructor() {
    // Intentar cargar el manifest persistido al arrancar.
    this.tryLoadPersistedManifest();

    // Persistir el manifest activo cada vez que cambie (side effect real).
    effect(() => {
      const current = this.manifest();
      try {
        this.platform.storageSet(MANIFEST_STORAGE_KEY, JSON.stringify(current));
      } catch {
        this.logger.warn('CatalogService', 'No se pudo persistir el manifest.');
      }
    });
  }

  // ─── API de consulta ────────────────────────────────────────────────────────

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

  /**
   * Establece la marca activa (p. ej. al entrar a `/brands/:brandId/games`).
   * Si `brandId` no está en `brands`, no se actualiza.
   */
  setSelectedBrand(brandId: string): void {
    const brand = this.brands().find((b) => b.id === brandId);
    if (brand) {
      this.selectedBrand.set(brand);
    }
  }

  /**
   * Intenta cargar un manifest externo (p. ej. entregado por el updater en Fase 6).
   * Si es válido, lo activa. Si no, conserva el actual y registra el error.
   */
  loadManifest(rawJson: unknown): boolean {
    const appVersion = this.platform.appVersion();
    const candidate = rawJson as ContentManifest;
    const errors = validateManifest(candidate, appVersion);
    if (errors.length > 0) {
      this.logger.warn(
        'CatalogService',
        'Manifest rechazado, conservando el actual:',
        errors,
      );
      return false;
    }
    this.manifest.set(candidate);
    this.logger.info('CatalogService', 'Manifest externo activado.', candidate.version);
    return true;
  }

  // ─── Internos ───────────────────────────────────────────────────────────────

  /**
   * Intenta recuperar y activar el último manifest persistido en storage.
   * Si falla (ausente, corrupto, inválido) → la semilla embebida permanece activa.
   * Jamás deja el kiosco sin catálogo.
   */
  private tryLoadPersistedManifest(): void {
    const raw = this.platform.storageGet(MANIFEST_STORAGE_KEY);
    if (!raw) {
      this.logger.info('CatalogService', 'Sin manifest persistido, usando semilla.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(
        'CatalogService',
        'Manifest persistido corrupto (JSON inválido), usando semilla.',
      );
      return;
    }

    const appVersion = this.platform.appVersion();
    const errors = validateManifest(parsed as ContentManifest, appVersion);
    if (errors.length > 0) {
      this.logger.warn(
        'CatalogService',
        'Manifest persistido inválido, usando semilla:',
        errors,
      );
      return;
    }

    this.manifest.set(parsed as ContentManifest);
    this.logger.info(
      'CatalogService',
      'Manifest persistido cargado:',
      (parsed as ContentManifest).version,
    );
  }
}
