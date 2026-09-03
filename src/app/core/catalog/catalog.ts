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
import { Atmosphere, ContentManifest } from './content-manifest.model';
import { Brand } from './brand.model';
import { Game } from './game.model';
import { GameExperience } from './game-experience.model';
import manifestSeed from '../../../../content/manifests/content-manifest.json';

const seed = manifestSeed as unknown as ContentManifest;

/** Clave de localStorage donde se persiste el último manifest válido. */
const MANIFEST_STORAGE_KEY = 'merz-games.catalog-manifest';

/** Atmósfera institucional de respaldo (Multicolor desvanecido suave: magenta, rosa, esmeralda, índigo, cian). */
export const DEFAULT_ATMOSPHERE: Readonly<Atmosphere> = {
  baseColor: '#0b0914',
  blurTint: '#7c3aed',
  blobs: [
    { from: '#d946ef', to: '#a855f7', opacity: 0.32 },
    { from: '#f43f5e', to: '#e11d48', opacity: 0.28 },
    { from: '#10b981', to: '#059669', opacity: 0.30 },
    { from: '#6366f1', to: '#3b82f6', opacity: 0.32 },
    { from: '#00E5FF', to: '#0891b2', opacity: 0.28 },
  ],
};

/** Disclaimer general de la actividad para todas las pantallas de navegación. */
export const DEFAULT_ACTIVITY_DISCLAIMER =
  'Esta actividad corresponde a una dinámica de habilidad mental y no a un concurso, sorteo o juego de azar. La ejecución, administración y cumplimiento de la mecánica son responsabilidad exclusiva de cada clínica participante.';


/** Datos normalizados para renderizar una Card de Catálogo. */
export interface CatalogCardItem {
  id: string;
  title: string;
  description: string;
  image?: string;
  badge?: string;
  ariaLabel: string;
}

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

function pushAssetUrl(target: Set<string>, value: string | string[] | undefined): void {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item) target.add(item);
    }
    return;
  }
  target.add(value);
}

function pushAssetRecord(
  target: Set<string>,
  record: Record<string, string | string[] | undefined> | undefined,
): void {
  if (!record) return;
  for (const value of Object.values(record)) {
    pushAssetUrl(target, value);
  }
}

/**
 * Recolecta URLs locales de imágenes y audio del manifest (marcas, motores,
 * experiencias y BGM) para precargarlas en el splash.
 */
export function collectContentAssetUrls(manifest: ContentManifest): string[] {
  const urls = new Set<string>();

  for (const brand of manifest.brands.filter((b) => b.enabled)) {
    pushAssetUrl(urls, brand.image);
    pushAssetUrl(urls, brand.logo);
  }

  for (const game of manifest.games.filter((g) => g.enabled)) {
    pushAssetUrl(urls, game.image);
    pushAssetRecord(urls, game.assets);
  }

  for (const exp of manifest.experiences.filter((e) => e.enabled)) {
    pushAssetUrl(urls, exp.image);
    pushAssetUrl(urls, exp.theme?.backgroundImage);
    pushAssetRecord(urls, exp.assets);
  }

  pushAssetUrl(urls, manifest.audio?.backgroundMusic);
  return [...urls];
}

/** Overlay de contenido embebido sobre un manifest persistido (assets, copy, atmósfera). */
function hydrateManifestFromSeed(candidate: ContentManifest): void {
  if (seed.atmosphere) {
    candidate.atmosphere = seed.atmosphere;
  }
  if (seed.audio) {
    candidate.audio = seed.audio;
  }

  for (const brand of candidate.brands ?? []) {
    const seedBrand = seed.brands?.find((b) => b.id === brand.id);
    if (!seedBrand) continue;
    if (seedBrand.atmosphere) brand.atmosphere = seedBrand.atmosphere;
    if (seedBrand.disclaimer) brand.disclaimer = seedBrand.disclaimer;
    if (seedBrand.image) brand.image = seedBrand.image;
    if (seedBrand.logo) brand.logo = seedBrand.logo;
    if (seedBrand.description) brand.description = seedBrand.description;
    if (seedBrand.name) brand.name = seedBrand.name;
  }

  for (const exp of candidate.experiences ?? []) {
    const seedExp = seed.experiences?.find((e) => e.id === exp.id);
    if (!seedExp) continue;
    if (seedExp.image) exp.image = seedExp.image;
    if (seedExp.title) exp.title = seedExp.title;
    if (seedExp.description) exp.description = seedExp.description;
    if (seedExp.assets) exp.assets = seedExp.assets;
    if (seedExp.theme) exp.theme = seedExp.theme;
    if (seedExp.config) exp.config = seedExp.config;
  }

  for (const game of candidate.games ?? []) {
    const seedGame = seed.games?.find((g) => g.id === game.id);
    if (!seedGame) continue;
    if (seedGame.assets) game.assets = seedGame.assets;
    if (seedGame.config) game.config = seedGame.config;
    if (seedGame.image) game.image = seedGame.image;
    if (seedGame.description) game.description = seedGame.description;
  }
}

/**
 * CatalogService — gestor local del catálogo (Fase 3+).
 *
 * Responsabilidades:
 * - Arrancar con la semilla embebida (offline-first garantizado).
 * - Intentar recuperar el último manifest válido persistido en localStorage.
 * - Validar relaciones antes de activar cualquier manifest.
 * - Persistir cada manifest válido activo (reemplazo atómico).
 * - Exponer Signals: `brands`, `experiences`, `selectedBrand`, `experiencesForSelectedBrand`, `defaultAtmosphere`.
 * - Helpers puros para resolver atmósfera por marca/experiencia y datos de cards con fallbacks.
 */
@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly platform = inject(PlatformService);
  private readonly logger = inject(AppLogger);

  /** Manifest activo en memoria. Arranca con la semilla. */
  private readonly manifest = signal<ContentManifest>(seed);

  /** Exposición del manifest completo (solo lectura). Necesario para leer campos raíz como `audio`. */
  readonly rawManifest = this.manifest.asReadonly();

  // ─── Signals públicos de catálogo ───────────────────────────────────────────

  /** Atmósfera institucional activa del manifest (con fallback a semilla y DEFAULT_ATMOSPHERE). */
  readonly defaultAtmosphere = computed<Atmosphere>(() => {
    return (
      this.manifest().atmosphere ??
      seed.atmosphere ??
      DEFAULT_ATMOSPHERE
    );
  });

  /** Marcas habilitadas, ordenadas por `order`. */
  readonly brands = computed<Brand[]>(() =>
    this.manifest()
      .brands.filter((b) => b.enabled)
      .sort((a, b) => a.order - b.order),
  );

  /**
   * Experiencias habilitadas con relaciones válidas y `minAppVersion` compatible.
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
   * Inicializa en `undefined` para que las pantallas iniciales/generales (Welcome, Brands)
   * muestren la atmósfera institucional multicolor por defecto.
   * `linkedSignal`: al cambiar el catálogo se ajusta automáticamente.
   */
  readonly selectedBrand = linkedSignal<Brand[], Brand | undefined>({
    source: this.brands,
    computation: (newBrands, prev) => {
      if (!prev?.value) return undefined;
      const stillExists = newBrands.find((b) => b.id === prev.value?.id);
      return stillExists ?? undefined;
    },
  });

  /** Atmósfera actualmente activa en el shell. */
  readonly currentAtmosphere = computed<Atmosphere>(() => {
    const brand = this.selectedBrand();
    if (brand?.atmosphere) {
      return brand.atmosphere;
    }
    return this.defaultAtmosphere();
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
   * Resuelve la atmósfera visual de una marca. Si no tiene atmósfera propia o no existe,
   * recurre a la semilla o a defaultAtmosphere. Cero ramificaciones `if (brandId === 'radiesse')`.
   */
  atmosphereForBrand(brandId: string | null | undefined): Atmosphere {
    if (!brandId) return this.defaultAtmosphere();
    const brand = this.getBrandById(brandId);
    if (brand?.atmosphere) return brand.atmosphere;

    const seedBrand = (manifestSeed as ContentManifest).brands?.find(
      (b) => b.id === brandId,
    );
    return seedBrand?.atmosphere ?? this.defaultAtmosphere();
  }

  /**
   * Resuelve la atmósfera visual de una experiencia (mediante su marca).
   */
  atmosphereForExperience(experienceId: string | null | undefined): Atmosphere {
    if (!experienceId) return this.defaultAtmosphere();
    const exp = this.getExperienceById(experienceId);
    if (exp) return this.atmosphereForBrand(exp.brandId);

    const seedExp = (manifestSeed as ContentManifest).experiences?.find(
      (e) => e.id === experienceId,
    );
    if (seedExp) return this.atmosphereForBrand(seedExp.brandId);

    return this.defaultAtmosphere();
  }

  /**
   * Resuelve el disclaimer legal propio de una marca.
   */
  disclaimerForBrand(brandId: string): string | undefined {
    const brand = this.getBrandById(brandId);
    if (brand?.disclaimer) return brand.disclaimer;

    const seedBrand = (manifestSeed as ContentManifest).brands?.find(
      (b) => b.id === brandId,
    );
    return seedBrand?.disclaimer;
  }

  /**
   * Resuelve el disclaimer legal para una experiencia según su marca asociada.
   */
  disclaimerForExperience(experienceId: string): string | undefined {
    const exp = this.getExperienceById(experienceId);
    if (exp) return this.disclaimerForBrand(exp.brandId);

    const seedExp = (manifestSeed as ContentManifest).experiences?.find(
      (e) => e.id === experienceId,
    );
    if (seedExp) return this.disclaimerForBrand(seedExp.brandId);

    return undefined;
  }

  /**
   * Retorna el disclaimer general de la actividad.
   */
  activityDisclaimer(): string {
    return DEFAULT_ACTIVITY_DISCLAIMER;
  }

  /**
   * Normaliza los datos de una marca para renderizar en `CatalogCard`.
   */
  cardForBrand(brand: Brand): CatalogCardItem {
    const seedBrand = (manifestSeed as ContentManifest).brands?.find(
      (b) => b.id === brand.id,
    );
    return {
      id: brand.id,
      title: brand.name,
      description:
        brand.description ??
        seedBrand?.description ??
        'Toca para descubrir los juegos disponibles.',
      image: brand.image ?? seedBrand?.image,
      ariaLabel: `Seleccionar marca ${brand.name}`,
    };
  }

  /**
   * Normaliza los datos de una experiencia para renderizar en `CatalogCard`.
   */
  cardForExperience(exp: GameExperience): CatalogCardItem {
    const seedExp = (manifestSeed as ContentManifest).experiences?.find(
      (e) => e.id === exp.id,
    );
    const game = this.getGameById(exp.gameId);
    const seedGame = (manifestSeed as ContentManifest).games?.find(
      (g) => g.id === exp.gameId,
    );

    const title = exp.title ?? seedExp?.title ?? game?.name ?? seedGame?.name ?? exp.id;
    const description =
      exp.description ??
      seedExp?.description ??
      game?.description ??
      seedGame?.description ??
      'Toca para iniciar esta experiencia.';
    const image = exp.image ?? seedExp?.image ?? game?.image ?? seedGame?.image;

    return {
      id: exp.id,
      title,
      description,
      image,
      ariaLabel: `Jugar ${title}`,
    };
  }

  /** URLs de contenido del manifest activo para precargar en el splash. */
  collectPreloadUrls(): string[] {
    return collectContentAssetUrls(this.manifest());
  }

  /**
   * Establece la marca activa (p. ej. al entrar a `/brands/:brandId/games`).
   */
  setSelectedBrand(brandId: string | undefined): void {
    if (!brandId) {
      this.selectedBrand.set(undefined);
      return;
    }
    const brand = this.brands().find((b) => b.id === brandId);
    if (brand) {
      this.selectedBrand.set(brand);
    }
  }

  /**
   * Limpia la marca activa, regresando a la atmósfera institucional.
   */
  clearSelectedBrand(): void {
    this.selectedBrand.set(undefined);
  }

  /**
   * Intenta cargar un manifest externo (p. ej. entregado por el updater en Fase 7).
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

    const candidate = parsed as ContentManifest;
    hydrateManifestFromSeed(candidate);

    this.manifest.set(candidate);
    this.logger.info('CatalogService', 'Manifest persistido cargado:', candidate.version);
  }
}
