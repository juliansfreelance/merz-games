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

export type { Brand } from './brand.model';
export type { Game } from './game.model';
export type { GameExperience } from './game-experience.model';
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

/** Atmósfera técnica del panel de administración (tonos sirena de policía: exclusivamente rojos y azules vibrantes). */
export const ADMIN_ATMOSPHERE: Readonly<Atmosphere> = {
  baseColor: '#050814',
  blurTint: '#3b82f6',
  blobs: [
    { from: '#ef4444', to: '#b91c1c', opacity: 0.45 },
    { from: '#3b82f6', to: '#1d4ed8', opacity: 0.45 },
    { from: '#dc2626', to: '#991b1b', opacity: 0.40 },
    { from: '#2563eb', to: '#1e40af', opacity: 0.42 },
    { from: '#f87171', to: '#60a5fa', opacity: 0.35 },
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
  develop?: boolean;
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

  pushAssetUrl(urls, manifest.app?.audio?.backgroundMusic ?? manifest.audio?.backgroundMusic);
  return [...urls];
}

/** Overlay de contenido embebido sobre un manifest persistido (assets, copy, atmósfera). */
function hydrateManifestFromSeed(candidate: ContentManifest): void {
  if (seed.app) {
    candidate.app = {
      ...seed.app,
      ...candidate.app,
      theme: {
        ...seed.app?.theme,
        ...candidate.app?.theme,
        home: candidate.app?.theme?.home ?? seed.app?.theme?.home,
        panel: {
          ...seed.app?.theme?.panel,
          ...candidate.app?.theme?.panel,
        },
      },
      audio: {
        ...seed.app?.audio,
        ...candidate.app?.audio,
      },
      protector: {
        ...seed.app?.protector,
        ...candidate.app?.protector,
        attractionVideos: (() => {
          const seedVideos = seed.app?.protector?.attractionVideos;
          if (!seedVideos) return candidate.app?.protector?.attractionVideos;
          const candidateVideos = candidate.app?.protector?.attractionVideos ?? [];
          return seedVideos.map((seedV) => {
            const existing = candidateVideos.find((cv) => cv.source === seedV.source);
            return existing ? { ...seedV, enabled: existing.enabled } : { ...seedV };
          });
        })(),
      },
      security: {
        ...seed.app?.security,
        ...candidate.app?.security,
      },
    };
  }
  if (seed.atmosphere) {
    candidate.atmosphere = seed.atmosphere;
  }
  if (seed.audio) {
    candidate.audio = seed.audio;
  }

  for (const brand of candidate.brands ?? []) {
    const seedBrand = seed.brands?.find((b) => b.id === brand.id);
    if (!seedBrand) continue;
    if (seedBrand.develop !== undefined) brand.develop = seedBrand.develop;
    if (seedBrand.atmosphere) brand.atmosphere = seedBrand.atmosphere;
    if (seedBrand.disclaimer) brand.disclaimer = seedBrand.disclaimer;
    if (seedBrand.image) brand.image = seedBrand.image;
    if (seedBrand.logo) brand.logo = seedBrand.logo;
    if (seedBrand.description) brand.description = seedBrand.description;
    if (seedBrand.name) brand.name = seedBrand.name;
    if (seedBrand.attractionVideo) brand.attractionVideo = seedBrand.attractionVideo;
    if (seedBrand.attractionVideos) {
      const candidateVideos = brand.attractionVideos ?? [];
      brand.attractionVideos = seedBrand.attractionVideos.map((seedV) => {
        const existing = candidateVideos.find((cv) => cv.source === seedV.source);
        return existing ? { ...seedV, enabled: existing.enabled } : { ...seedV };
      });
    }
  }

  for (const exp of candidate.experiences ?? []) {
    const seedExp = seed.experiences?.find((e) => e.id === exp.id);
    if (!seedExp) continue;
    if (seedExp.develop !== undefined) exp.develop = seedExp.develop;
    if (seedExp.image) exp.image = seedExp.image;
    if (seedExp.name) exp.name = seedExp.name;
    if (seedExp.title) exp.title = seedExp.title;
    if (seedExp.description) exp.description = seedExp.description;
    if (seedExp.assets) exp.assets = seedExp.assets;
    if (seedExp.theme) exp.theme = seedExp.theme;
    if (seedExp.config) exp.config = seedExp.config;
  }

  for (const game of candidate.games ?? []) {
    const seedGame = seed.games?.find((g) => g.id === game.id);
    if (!seedGame) continue;
    if (seedGame.develop !== undefined) game.develop = seedGame.develop;
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
      this.manifest().app?.theme?.home ??
      this.manifest().atmosphere ??
      seed.app?.theme?.home ??
      seed.atmosphere ??
      DEFAULT_ATMOSPHERE
    );
  });

  /** Color primario de acento del panel administrativo (#fdc700 por defecto). */
  readonly panelPrimaryColor = computed<string>(() => {
    return (
      this.manifest().app?.theme?.panel?.primaryColor ??
      seed.app?.theme?.panel?.primaryColor ??
      '#fdc700'
    );
  });

  /** Color secundario de acento del panel administrativo (#ff637e por defecto). */
  readonly panelSecondaryColor = computed<string>(() => {
    return (
      this.manifest().app?.theme?.panel?.secondaryColor ??
      seed.app?.theme?.panel?.secondaryColor ??
      '#ff637e'
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
   * Determina si una marca está en fase de desarrollo o beta.
   */
  isBrandDevelop(brand: Brand | string): boolean {
    const b = typeof brand === 'string' ? this.getBrandById(brand) : brand;
    return b?.develop === true;
  }

  /**
   * Determina si un motor de juego está en fase de desarrollo o beta.
   */
  isGameDevelop(gameId: string): boolean {
    return this.getGameById(gameId)?.develop === true;
  }

  /**
   * Determina si una experiencia concreta está en desarrollo o beta.
   * Es verdadero si la propia experiencia, su marca o su motor tienen develop: true.
   */
  isExperienceDevelop(experience: GameExperience | string): boolean {
    const exp =
      typeof experience === 'string'
        ? this.rawManifest().experiences.find((e) => e.id === experience)
        : experience;
    if (!exp) return false;
    if (exp.develop === true) return true;
    if (this.isBrandDevelop(exp.brandId)) return true;
    if (this.isGameDevelop(exp.gameId)) return true;
    return false;
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
   * Resuelve la atmósfera técnica para el panel y login administrativo.
   */
  adminAtmosphere(): Atmosphere {
    return (
      this.manifest().app?.theme?.panel?.atmosphere ??
      (seed as ContentManifest).app?.theme?.panel?.atmosphere ??
      ADMIN_ATMOSPHERE
    );
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
    return (
      this.manifest().app?.disclaimer ??
      (seed as ContentManifest).app?.disclaimer ??
      DEFAULT_ACTIVITY_DISCLAIMER
    );
  }

  /**
   * Retorna el PIN por defecto para acceso administrativo si no existe un hash persistido.
   */
  defaultAdminPin(): string {
    return (
      this.manifest().app?.security?.defaultPin ??
      (seed as ContentManifest).app?.security?.defaultPin ??
      '2580'
    );
  }

  /**
   * Retorna el PIN de superadministrador para funciones beta / en desarrollo.
   */
  betaSuperadminPin(): string {
    return (
      this.manifest().app?.security?.betaSuperadminPin ??
      (seed as ContentManifest).app?.security?.betaSuperadminPin ??
      '210726'
    );
  }

  /**
   * Retorna el PIN de superadministrador para restablecer el PIN del usuario al valor por defecto.
   */
  resetSuperadminPin(): string {
    return (
      this.manifest().app?.security?.resetSuperadminPin ??
      (seed as ContentManifest).app?.security?.resetSuperadminPin ??
      '998877'
    );
  }

  /**
   * Retorna la frase de recordación por defecto del superadministrador.
   */
  superadminHint(): string {
    return (
      this.manifest().app?.security?.superadminHint ??
      (seed as ContentManifest).app?.security?.superadminHint ??
      'Validación de ingeniería · Hito: Lo mejor 2026 (DD/MM/AA · T.)'
    );
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
      develop: brand.develop ?? seedBrand?.develop ?? false,
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

    const title = exp.name ?? exp.title ?? seedExp?.name ?? seedExp?.title ?? game?.name ?? seedGame?.name ?? exp.id;
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
      develop: this.isExperienceDevelop(exp),
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

  /**
   * Habilita o deshabilita una experiencia específica en el catálogo y persiste el cambio.
   */
  setExperienceEnabled(experienceId: string, enabled: boolean): void {
    const current = this.manifest();
    const updated = {
      ...current,
      experiences: current.experiences.map((exp) =>
        exp.id === experienceId ? { ...exp, enabled } : exp,
      ),
    };
    this.manifest.set(updated);
    this.logger.info('CatalogService', `Experiencia "${experienceId}" enabled: ${enabled}`);
  }

  /**
   * Habilita o deshabilita una marca específica en el catálogo y persiste el cambio.
   */
  setBrandEnabled(brandId: string, enabled: boolean): void {
    const current = this.manifest();
    const updated = {
      ...current,
      brands: current.brands.map((b) =>
        b.id === brandId ? { ...b, enabled } : b,
      ),
    };
    this.manifest.set(updated);
    this.logger.info('CatalogService', `Marca "${brandId}" enabled: ${enabled}`);
  }

  /**
   * Restablece el estado de habilitación de todas las marcas a los valores por defecto de content-manifest.json.
   */
  resetBrandsToDefault(): void {
    const current = this.manifest();
    const seedBrands = manifestSeed.brands;
    const updated = {
      ...current,
      brands: current.brands.map((b) => {
        const seedB = seedBrands.find((sb) => sb.id === b.id);
        return seedB ? { ...b, enabled: seedB.enabled } : b;
      }),
    };
    this.manifest.set(updated);
    try {
      this.platform.storageSet(MANIFEST_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      this.logger.warn('CatalogService', 'No se pudo persistir las marcas tras restaurar.');
    }
    this.logger.info('CatalogService', 'Marcas del kiosco restauradas a los valores por defecto.');
  }

  /**
   * Habilita o deshabilita un video de atracción de una marca específica.
   */
  setBrandVideoEnabled(brandId: string, videoSource: string, enabled: boolean): void {
    const current = this.manifest();
    const updated = {
      ...current,
      brands: current.brands.map((b) => {
        if (b.id !== brandId || !b.attractionVideos) return b;
        return {
          ...b,
          attractionVideos: b.attractionVideos.map((v) =>
            v.source === videoSource ? { ...v, enabled } : v,
          ),
        };
      }),
    };
    this.manifest.set(updated);
    this.logger.info('CatalogService', `Video "${videoSource}" de marca "${brandId}" enabled: ${enabled}`);
  }

  /**
   * Habilita o deshabilita un video de atracción institucional/general del protector.
   */
  setGeneralVideoEnabled(videoSource: string, enabled: boolean): void {
    const current = this.manifest();
    const currentVideos = current.app?.protector?.attractionVideos ?? [];
    const updated = {
      ...current,
      app: {
        ...current.app,
        protector: {
          ...current.app?.protector,
          attractionVideos: currentVideos.map((v) =>
            v.source === videoSource ? { ...v, enabled } : v,
          ),
        },
      },
    };
    this.manifest.set(updated);
    this.logger.info('CatalogService', `Video general "${videoSource}" enabled: ${enabled}`);
  }

  /**
   * Restablece el estado de habilitación de todos los videos de atracción (generales y de marcas)
   * a sus valores por defecto definidos en content-manifest.json.
   */
  resetVideosToDefault(): void {
    const current = this.manifest();
    const seedProtectorVideos = manifestSeed.app?.protector?.attractionVideos;
    const seedBrands = manifestSeed.brands;

    const updated = {
      ...current,
      app: {
        ...current.app,
        protector: {
          ...current.app?.protector,
          attractionVideos: seedProtectorVideos ? JSON.parse(JSON.stringify(seedProtectorVideos)) : undefined,
        },
      },
      brands: current.brands.map((b) => {
        const seedB = seedBrands.find((sb) => sb.id === b.id);
        if (!seedB || !seedB.attractionVideos) return b;
        return {
          ...b,
          attractionVideos: JSON.parse(JSON.stringify(seedB.attractionVideos)),
        };
      }),
    };
    this.manifest.set(updated);
    try {
      this.platform.storageSet(MANIFEST_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      this.logger.warn('CatalogService', 'No se pudo persistir los videos tras restaurar.');
    }
    this.logger.info('CatalogService', 'Videos de atracción restaurados a los valores por defecto.');
  }

  /**
   * Restaura el catálogo completo a los valores por defecto del manifest original (content-manifest.json).
   * Restablece las marcas y experiencias habilitadas/deshabilitadas a su estado original de fábrica.
   */
  resetToDefault(): void {
    const cleanManifest = JSON.parse(JSON.stringify(manifestSeed)) as ContentManifest;
    this.manifest.set(cleanManifest);
    this.selectedBrand.set(undefined);
    try {
      this.platform.storageSet(MANIFEST_STORAGE_KEY, JSON.stringify(cleanManifest));
    } catch {
      this.logger.warn('CatalogService', 'No se pudo persistir el manifest tras restaurar.');
    }
    this.logger.info('CatalogService', 'Catálogo restaurado a los valores por defecto de content-manifest.json');
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
    // Solo hidratar desde la semilla embebida si es la misma versión.
    // Un catálogo aplicado por el updater (versión distinta) debe conservarse.
    if (candidate.version === seed.version) {
      hydrateManifestFromSeed(candidate);
    }

    this.manifest.set(candidate);
    this.logger.info('CatalogService', 'Manifest persistido cargado:', candidate.version);
  }
}
