import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Atmosphere, ContentManifest } from './content-manifest.model';
import { CatalogService, collectContentAssetUrls, DEFAULT_ATMOSPHERE, semverGte } from './catalog';
import { PlatformService } from '../platform/platform.service';
import { UpdateSnapshot, UpdateStatus } from './update.model';
import manifestSeed from '../../../../content/manifests/content-manifest.json';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MANIFEST_KEY = 'merz-games.catalog-manifest';

/** Construye un mock de PlatformService con storage en memoria. */
function buildMockPlatform(appVersion = '0.1.0', initialStorage: Record<string, string> = {}) {
  const store = { ...initialStorage };
  return {
    appVersion: signal(appVersion),
    storageGet: (key: string) => store[key] ?? null,
    storageSet: (key: string, value: string) => {
      store[key] = value;
    },
    store,
  };
}

function buildCatalog(appVersion = '0.1.0', initialStorage: Record<string, string> = {}) {
  const mockPlatform = buildMockPlatform(appVersion, initialStorage);
  TestBed.configureTestingModule({
    providers: [CatalogService, { provide: PlatformService, useValue: mockPlatform }],
  });
  return {
    catalog: TestBed.inject(CatalogService),
    store: mockPlatform.store,
  };
}

// ─── Contrato del JSON semilla ────────────────────────────────────────────────

describe('Content Catalog Manifest Contract', () => {
  const manifest = manifestSeed as ContentManifest;

  it('should parse manifest and have a valid semver version', () => {
    expect(manifest).toBeTruthy();
    expect(manifest.version).toBe('0.6.0');
  });

  it('should contain brands, games, and experiences collections', () => {
    expect(manifest.brands).toBeInstanceOf(Array);
    expect(manifest.games).toBeInstanceOf(Array);
    expect(manifest.experiences).toBeInstanceOf(Array);
  });

  it('should include institutional atmosphere and brand atmospheres', () => {
    const homeAtmosphere = manifest.app?.theme?.home ?? manifest.atmosphere;
    expect(homeAtmosphere).toBeDefined();
    expect(homeAtmosphere?.baseColor).toBe('#000000');
    expect(homeAtmosphere?.blobs.length).toBeGreaterThan(0);

    const radiesse = manifest.brands.find((b) => b.id === 'radiesse');
    expect(radiesse?.atmosphere).toBeDefined();
    expect(radiesse?.atmosphere?.blurTint).toBe('#00E5FF');
    expect(radiesse?.image).toBeDefined();
    expect(radiesse?.description).toBeDefined();

    const ultherapy = manifest.brands.find((b) => b.id === 'ultherapy');
    expect(ultherapy?.atmosphere).toBeDefined();
    expect(ultherapy?.atmosphere?.blurTint).toBe('#D4AF37');
    expect(ultherapy?.image).toBeDefined();
    expect(ultherapy?.description).toBeDefined();
  });

  it('should include radiesse and ultherapy brands', () => {
    const brandIds = manifest.brands.map((b) => b.id);
    expect(brandIds).toContain('radiesse');
    expect(brandIds).toContain('ultherapy');

    const radiesse = manifest.brands.find((b) => b.id === 'radiesse');
    expect(radiesse?.name).toContain('Radiesse');
    expect(radiesse?.enabled).toBe(true);

    const ultherapy = manifest.brands.find((b) => b.id === 'ultherapy');
    expect(ultherapy?.name).toContain('Ultherapy');
    expect(ultherapy?.enabled).toBe(true);
  });

  it('debe definir attractionVideos para radiesse y ultherapy pero no para merz', () => {
    const radiesse = manifest.brands.find((b) => b.id === 'radiesse');
    expect(radiesse?.attractionVideos).toBeDefined();
    expect(radiesse?.attractionVideos?.length).toBe(1);
    expect(radiesse?.attractionVideos?.[0].source).toBe('/content/videos/radiesse.mp4');
    expect(radiesse?.attractionVideos?.[0].enabled).toBe(true);

    const ultherapy = manifest.brands.find((b) => b.id === 'ultherapy');
    expect(ultherapy?.attractionVideos).toBeDefined();
    expect(ultherapy?.attractionVideos?.length).toBe(1);
    expect(ultherapy?.attractionVideos?.[0].source).toBe('/content/videos/ultherapy.mp4');
    expect(ultherapy?.attractionVideos?.[0].enabled).toBe(true);

    const merz = manifest.brands.find((b) => b.id === 'merz');
    expect(merz?.attractionVideos).toBeUndefined();
  });

  it('should include memory and triqui games', () => {
    const gameIds = manifest.games.map((g) => g.id);
    expect(gameIds).toContain('memory');
    expect(gameIds).toContain('triqui');

    const memory = manifest.games.find((g) => g.id === 'memory');
    expect(memory?.enabled).toBe(true);

    const triqui = manifest.games.find((g) => g.id === 'triqui');
    expect(triqui?.enabled).toBe(true);
  });

  it('should have correct relations in experiences', () => {
    const brandIds = new Set(manifest.brands.map((b) => b.id));
    const gameIds = new Set(manifest.games.map((g) => g.id));
    const experienceIds = manifest.experiences.map((e) => e.id);

    // No duplicate experience IDs
    const uniqueExperienceIds = new Set(experienceIds);
    expect(uniqueExperienceIds.size).toBe(experienceIds.length);

    // Check each experience references existing enabled brands and games
    manifest.experiences.forEach((exp) => {
      expect(brandIds.has(exp.brandId)).toBe(true);
      expect(gameIds.has(exp.gameId)).toBe(true);

      const brand = manifest.brands.find((b) => b.id === exp.brandId);
      const game = manifest.games.find((g) => g.id === exp.gameId);

      expect(brand?.enabled).toBe(true);
      expect(game?.enabled).toBe(true);
    });

    // Check that we have the 4 expected core experiences
    expect(experienceIds).toContain('radiesse-memory');
    expect(experienceIds).toContain('ultherapy-memory');
    expect(experienceIds).toContain('radiesse-triqui');
    expect(experienceIds).toContain('ultherapy-triqui');
  });

  it('semilla sigue parseando con campos opcionales ausentes', () => {
    manifest.experiences.forEach((exp) => {
      expect(exp.id).toBeTruthy();
    });
    manifest.games.forEach((game) => {
      expect(game.id).toBeTruthy();
    });
  });
});

// ─── semverGte (función pura) ─────────────────────────────────────────────────

describe('semverGte', () => {
  it('returns true when version equals minimum', () => {
    expect(semverGte('0.1.0', '0.1.0')).toBe(true);
    expect(semverGte('1.2.3', '1.2.3')).toBe(true);
  });

  it('returns true when version is greater (patch)', () => {
    expect(semverGte('0.1.1', '0.1.0')).toBe(true);
  });

  it('returns true when version is greater (minor)', () => {
    expect(semverGte('0.2.0', '0.1.9')).toBe(true);
  });

  it('returns true when version is greater (major)', () => {
    expect(semverGte('1.0.0', '0.9.9')).toBe(true);
  });

  it('returns false when version is less (patch)', () => {
    expect(semverGte('0.1.0', '0.1.1')).toBe(false);
  });

  it('returns false when version is less (minor)', () => {
    expect(semverGte('0.1.9', '0.2.0')).toBe(false);
  });

  it('returns false when version is less (major)', () => {
    expect(semverGte('0.9.9', '1.0.0')).toBe(false);
  });
});

// ─── CatalogService — Atmósfera y Cards ───────────────────────────────────────

describe('CatalogService — Atmósfera y Cards', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('debe exponer defaultAtmosphere institucional', () => {
    const { catalog } = buildCatalog();
    const atmosphere = catalog.defaultAtmosphere();
    expect(atmosphere).toBeDefined();
    expect(atmosphere.baseColor).toBe('#000000');
    expect(atmosphere.blobs.length).toBe(5);
  });

  it('atmosphereForBrand() resuelve atmósfera propia de Radiesse', () => {
    const { catalog } = buildCatalog();
    const radiesseAtmosphere = catalog.atmosphereForBrand('radiesse');
    expect(radiesseAtmosphere.blurTint).toBe('#00E5FF');
    expect(radiesseAtmosphere.baseColor).toBe('#03171e');
  });

  it('atmosphereForBrand() resuelve atmósfera propia de Ultherapy', () => {
    const { catalog } = buildCatalog();
    const ultherapyAtmosphere = catalog.atmosphereForBrand('ultherapy');
    expect(ultherapyAtmosphere.blurTint).toBe('#D4AF37');
    expect(ultherapyAtmosphere.baseColor).toBe('#151006');
  });

  it('atmosphereForBrand() con marca desconocida o sin atmósfera retorna default', () => {
    const { catalog } = buildCatalog();
    const fallback = catalog.atmosphereForBrand('marca-desconocida');
    expect(fallback).toEqual(catalog.defaultAtmosphere());
  });

  it('adminAtmosphere() resuelve la atmósfera técnica del panel administrativo', () => {
    const { catalog } = buildCatalog();
    const adminAtmo = catalog.adminAtmosphere();
    expect(adminAtmo.baseColor).toBe('#000000');
    expect(adminAtmo.blurTint).toBe('#008083');
    expect(adminAtmo.blobs.length).toBe(5);
  });

  it('atmosphereForExperience() resuelve atmósfera de la marca correspondiente', () => {
    const { catalog } = buildCatalog();
    const radiesseMemoryAtmosphere = catalog.atmosphereForExperience('radiesse-memory');
    expect(radiesseMemoryAtmosphere.blurTint).toBe('#00E5FF');

    const ultherapyTriquiAtmosphere = catalog.atmosphereForExperience('ultherapy-triqui');
    expect(ultherapyTriquiAtmosphere.blurTint).toBe('#D4AF37');

    const unknownExpAtmosphere = catalog.atmosphereForExperience('no-existe');
    expect(unknownExpAtmosphere).toEqual(catalog.defaultAtmosphere());
  });

  it('cardForBrand() normaliza los datos para CatalogCard', () => {
    const { catalog } = buildCatalog();
    const radiesse = catalog.getBrandById('radiesse')!;
    const card = catalog.cardForBrand(radiesse);
    expect(card.id).toBe('radiesse');
    expect(card.title).toBe(radiesse.name);
    expect(card.description).toContain('colágeno');
    expect(card.image).toBeDefined();
  });

  it('cardForExperience() normaliza los datos con fallback inteligente', () => {
    const { catalog } = buildCatalog();
    const exp = catalog.getExperienceById('radiesse-memory')!;
    const card = catalog.cardForExperience(exp);
    expect(card.id).toBe('radiesse-memory');
    expect(card.title).toBe(exp.name ?? exp.title);
    expect(card.image).toBeDefined();
  });

  it('collectContentAssetUrls incluye imágenes y audio nuevos del catálogo', () => {
    const urls = collectContentAssetUrls(manifestSeed as ContentManifest);
    expect(urls).toContain('/content/images/games/triqui/radiesse/mark-x.png');
    expect(urls).toContain('/content/images/games/triqui/ultherapy/mark-o.png');
    expect(urls).toContain('/content/images/games/memory/cards/radiesse/card-back.png');
    expect(urls).toContain('/content/audio/sfx/put.mp3');
    expect(urls).toContain('/content/audio/sfx/game-win.mp3');
    expect(urls).toContain('/content/audio/bgm.mp3');
  });

  it('collectPreloadUrls() expone las mismas URLs del manifest activo', () => {
    const { catalog } = buildCatalog();
    const urls = catalog.collectPreloadUrls();
    expect(urls.length).toBeGreaterThan(20);
    expect(urls).toContain('/content/audio/sfx/put.mp3');
    expect(urls).toEqual(collectContentAssetUrls(manifestSeed as ContentManifest));
  });

  it('disclaimerForBrand() resuelve disclaimer legal propio de cada marca', () => {
    const { catalog } = buildCatalog();
    const radiesseDisclaimer = catalog.disclaimerForBrand('radiesse');
    expect(radiesseDisclaimer).toBeDefined();
    expect(radiesseDisclaimer).toContain('RADIESSE');
    expect(radiesseDisclaimer).toContain('INVIMA');

    const ultherapyDisclaimer = catalog.disclaimerForBrand('ultherapy');
    expect(ultherapyDisclaimer).toBeDefined();
    expect(ultherapyDisclaimer).toContain('ULTHERAPY');
    expect(ultherapyDisclaimer).toContain('INVIMA');

    const unknownDisclaimer = catalog.disclaimerForBrand('marca-inexistente');
    expect(unknownDisclaimer).toBeUndefined();
  });

  it('disclaimerForExperience() resuelve disclaimer según la marca de la experiencia', () => {
    const { catalog } = buildCatalog();
    const radiesseExpDisclaimer = catalog.disclaimerForExperience('radiesse-memory');
    expect(radiesseExpDisclaimer).toContain('RADIESSE');

    const ultherapyExpDisclaimer = catalog.disclaimerForExperience('ultherapy-memory');
    expect(ultherapyExpDisclaimer).toContain('ULTHERAPY');

    const unknownExpDisclaimer = catalog.disclaimerForExperience('desconocida');
    expect(unknownExpDisclaimer).toBeUndefined();
  });

  it('activityDisclaimer() retorna el texto legal de habilidad mental', () => {
    const { catalog } = buildCatalog();
    const disclaimer = catalog.activityDisclaimer();
    expect(disclaimer).toContain('habilidad mental');
    expect(disclaimer).toContain('clínica participante');
  });

  it('tercera marca con atmósfera propia en manifest es resuelta sin cambiar código', () => {
    const customAtmosphere: Atmosphere = {
      baseColor: '#2b003b',
      blurTint: '#ff00ff',
      blobs: [
        { from: '#ff00ff', to: '#7700aa', opacity: 0.25 },
        { from: '#aa00ff', to: '#330055', opacity: 0.2 },
      ],
    };

    const thirdBrandManifest: ContentManifest = {
      ...(manifestSeed as ContentManifest),
      brands: [
        ...(manifestSeed as ContentManifest).brands,
        {
          id: 'neocutis',
          name: 'Neocutis',
          version: '0.1.0',
          enabled: true,
          order: 3,
          atmosphere: customAtmosphere,
        },
      ],
      experiences: [
        ...(manifestSeed as ContentManifest).experiences,
        {
          id: 'neocutis-memory',
          brandId: 'neocutis',
          gameId: 'memory',
          version: '0.1.0',
          enabled: true,
          order: 5,
        },
      ],
    };

    const { catalog } = buildCatalog('0.1.0', {
      [MANIFEST_KEY]: JSON.stringify(thirdBrandManifest),
    });

    const atmosphere = catalog.atmosphereForBrand('neocutis');
    expect(atmosphere.baseColor).toBe('#2b003b');
    expect(atmosphere.blurTint).toBe('#ff00ff');

    const expAtmosphere = catalog.atmosphereForExperience('neocutis-memory');
    expect(expAtmosphere.blurTint).toBe('#ff00ff');
  });
});

// ─── CatalogService — comportamiento base ────────────────────────────────────

describe('CatalogService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should expose enabled brands without beta when developMode is off', () => {
    const { catalog } = buildCatalog();
    expect(catalog.developMode()).toBe(false);
    const brands = catalog.brands();
    expect(brands.length).toBeGreaterThan(0);
    brands.forEach((b) => {
      expect(b.enabled).toBe(true);
      expect(b.develop).toBeFalsy();
    });
  });

  it('with developMode on exposes enabled brands with activas before beta, then by order', () => {
    const { catalog } = buildCatalog();
    catalog.setDevelopMode(true);
    const brands = catalog.brands();
    expect(brands.length).toBeGreaterThan(0);
    brands.forEach((b) => expect(b.enabled).toBe(true));

    let sawBeta = false;
    for (const brand of brands) {
      if (brand.develop) {
        sawBeta = true;
      } else {
        expect(sawBeta).toBe(false);
      }
    }

    const actives = brands.filter((b) => !b.develop);
    const betas = brands.filter((b) => !!b.develop);
    expect(betas.length).toBeGreaterThan(0);
    for (let i = 1; i < actives.length; i++) {
      expect(actives[i - 1].order).toBeLessThanOrEqual(actives[i].order);
    }
    for (let i = 1; i < betas.length; i++) {
      expect(betas[i - 1].order).toBeLessThanOrEqual(betas[i].order);
    }
  });

  it('reorderBrands actualiza el order relativo dentro del grupo', () => {
    const { catalog } = buildCatalog();
    const actives = catalog.brands().filter((b) => !b.develop);
    expect(actives.length).toBeGreaterThanOrEqual(2);

    const reversed = actives.map((b) => b.id).reverse();
    catalog.reorderBrands(reversed);

    const nextActives = catalog.brands().filter((b) => !b.develop);
    expect(nextActives.map((b) => b.id)).toEqual(reversed);
    expect(nextActives[0].order).toBe(1);
    expect(nextActives[1].order).toBe(2);
  });

  it('reorderExperiences actualiza el order relativo de experiencias', () => {
    const { catalog } = buildCatalog();
    const radiesseExps = catalog
      .rawManifest()
      .experiences.filter((e) => e.brandId === 'radiesse' && e.enabled && !e.develop);
    expect(radiesseExps.length).toBeGreaterThanOrEqual(2);

    const sorted = radiesseExps.slice().sort((a, b) => a.order - b.order);
    const reversed = sorted.map((e) => e.id).reverse();
    catalog.reorderExperiences(reversed);

    const next = catalog
      .rawManifest()
      .experiences.filter((e) => reversed.includes(e.id))
      .sort((a, b) => a.order - b.order);
    expect(next.map((e) => e.id)).toEqual(reversed);
  });

  it('should exclude disabled brands', () => {
    const { catalog } = buildCatalog();
    const brands = catalog.brands();
    expect(brands.map((b) => b.id)).toContain('radiesse');
    expect(brands.map((b) => b.id)).toContain('ultherapy');
  });

  it('should expose enabled experiences with valid relations', () => {
    const { catalog } = buildCatalog();
    const experiences = catalog.experiences();
    expect(experiences.length).toBeGreaterThan(0);
    experiences.forEach((exp) => {
      expect(exp.enabled).toBe(true);
      expect(catalog.getBrandById(exp.brandId)?.enabled).toBe(true);
      expect(catalog.getGameById(exp.gameId)?.enabled).toBe(true);
    });
  });

  it('should filter experiences by brandId', () => {
    const { catalog } = buildCatalog();
    const radiesse = catalog.experiencesForBrand('radiesse');
    expect(radiesse.length).toBeGreaterThan(0);
    radiesse.forEach((exp) => expect(exp.brandId).toBe('radiesse'));
  });

  it('should return empty array for unknown brandId', () => {
    const { catalog } = buildCatalog();
    expect(catalog.experiencesForBrand('no-existe')).toEqual([]);
  });

  it('should exclude experiences whose game minAppVersion exceeds app version', () => {
    const { catalog } = buildCatalog('0.0.1');
    const experiences = catalog.experiences();
    expect(experiences.length).toBe(0);
  });

  it('should include experiences when app version meets minAppVersion', () => {
    const { catalog } = buildCatalog('1.0.0');
    const experiences = catalog.experiences();
    expect(experiences.length).toBeGreaterThan(0);
  });

  it('should resolve experience by id', () => {
    const { catalog } = buildCatalog();
    const exp = catalog.getExperienceById('radiesse-memory');
    expect(exp).toBeDefined();
    expect(exp?.brandId).toBe('radiesse');
    expect(exp?.gameId).toBe('memory');
  });

  it('should return undefined for unknown experience id', () => {
    const { catalog } = buildCatalog();
    expect(catalog.getExperienceById('no-existe')).toBeUndefined();
  });

  it('should report brand as playable when it has valid experiences', () => {
    const { catalog } = buildCatalog();
    expect(catalog.isBrandPlayable('radiesse')).toBe(true);
    expect(catalog.isBrandPlayable('ultherapy')).toBe(true);
  });

  it('should report unknown brand as not playable', () => {
    const { catalog } = buildCatalog();
    expect(catalog.isBrandPlayable('no-existe')).toBe(false);
  });

  it('should reflect all enabled brands from manifest without selector changes', () => {
    const { catalog } = buildCatalog();
    const brandIds = catalog.brands().map((b) => b.id);
    expect(brandIds.length).toBe(catalog.brands().length);
    brandIds.forEach((id) => {
      expect(catalog.getBrandById(id)?.enabled).toBe(true);
    });
  });
});

// ─── CatalogService — selectedBrand y experiencesForSelectedBrand ────────────

describe('CatalogService — selectedBrand', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('selectedBrand debe inicializar como undefined (atmósfera institucional por defecto)', () => {
    const { catalog } = buildCatalog();
    expect(catalog.selectedBrand()).toBeUndefined();
  });

  it('setSelectedBrand debe actualizar selectedBrand y clearSelectedBrand debe limpiarlo', () => {
    const { catalog } = buildCatalog();
    catalog.setSelectedBrand('ultherapy');
    expect(catalog.selectedBrand()?.id).toBe('ultherapy');
    catalog.clearSelectedBrand();
    expect(catalog.selectedBrand()).toBeUndefined();
  });

  it('setSelectedBrand con id desconocido no debe cambiar selectedBrand', () => {
    const { catalog } = buildCatalog();
    const before = catalog.selectedBrand();
    catalog.setSelectedBrand('no-existe');
    expect(catalog.selectedBrand()).toEqual(before);
  });

  it('experiencesForSelectedBrand debe devolver experiencias de la marca seleccionada', () => {
    const { catalog } = buildCatalog();
    catalog.setSelectedBrand('radiesse');
    const exps = catalog.experiencesForSelectedBrand();
    expect(exps.length).toBeGreaterThan(0);
    exps.forEach((e) => expect(e.brandId).toBe('radiesse'));
  });

  it('tercera marca en fixture debe ser visible sin cambiar selectores', () => {
    const thirdBrandManifest: ContentManifest = {
      ...(manifestSeed as ContentManifest),
      brands: [
        ...(manifestSeed as ContentManifest).brands,
        { id: 'tercera', name: 'Tercera Marca', version: '0.1.0', enabled: true, order: 99 },
      ],
      experiences: [
        ...(manifestSeed as ContentManifest).experiences,
        {
          id: 'tercera-memory',
          brandId: 'tercera',
          gameId: 'memory',
          version: '0.1.0',
          enabled: true,
          order: 10,
        },
      ],
    };

    const { catalog } = buildCatalog('0.1.0', {
      [MANIFEST_KEY]: JSON.stringify(thirdBrandManifest),
    });

    const brandIds = catalog.brands().map((b) => b.id);
    expect(brandIds).toContain('tercera');
  });
});

// ─── CatalogService — persistencia y fallback ────────────────────────────────

describe('CatalogService — persistencia', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('JSON corrupto en storage debe usar semilla sin error', () => {
    const { catalog } = buildCatalog('0.1.0', {
      [MANIFEST_KEY]: '{invalid-json!!}',
    });
    const brandIds = catalog.brands().map((b) => b.id);
    expect(brandIds).toContain('radiesse');
    expect(brandIds).toContain('ultherapy');
  });

  it('manifest persistido inválido (relaciones rotas) debe usar semilla', () => {
    const broken: ContentManifest = {
      version: '0.2.0',
      brands: [{ id: 'radiesse', name: 'Radiesse', version: '0.1.0', enabled: true, order: 1 }],
      games: [
        { id: 'memory', name: 'Memory', version: '0.1.0', minAppVersion: '0.1.0', enabled: true },
      ],
      experiences: [
        {
          id: 'bad-exp',
          brandId: 'marca-inexistente',
          gameId: 'memory',
          version: '0.1.0',
          enabled: true,
          order: 1,
        },
      ],
    };

    const { catalog } = buildCatalog('0.1.0', {
      [MANIFEST_KEY]: JSON.stringify(broken),
    });

    const ids = catalog.experiences().map((e) => e.id);
    expect(ids).not.toContain('bad-exp');
    expect(ids).toContain('radiesse-memory');
  });

  it('manifest persistido válido debe activarse sobre la semilla', () => {
    const withExtra: ContentManifest = {
      ...(manifestSeed as ContentManifest),
      brands: [
        ...(manifestSeed as ContentManifest).brands,
        { id: 'extra', name: 'Extra Brand', version: '0.1.0', enabled: true, order: 50 },
      ],
      experiences: [
        ...(manifestSeed as ContentManifest).experiences,
        {
          id: 'extra-memory',
          brandId: 'extra',
          gameId: 'memory',
          version: '0.1.0',
          enabled: true,
          order: 50,
        },
      ],
    };

    const { catalog } = buildCatalog('0.1.0', {
      [MANIFEST_KEY]: JSON.stringify(withExtra),
    });

    const brandIds = catalog.brands().map((b) => b.id);
    expect(brandIds).toContain('extra');
  });

  it('hydrateManifestFromSeed hidrata attractionVideos en un manifest persistido', () => {
    // Simular un manifest persistido donde las marcas no traían attractionVideos
    const persistedWithoutVideo: ContentManifest = {
      ...(manifestSeed as ContentManifest),
      brands: (manifestSeed as ContentManifest).brands.map((b) => {
        const copy = { ...b };
        delete copy.attractionVideos;
        return copy;
      }),
    };

    const { catalog } = buildCatalog('0.1.0', {
      [MANIFEST_KEY]: JSON.stringify(persistedWithoutVideo),
    });

    const radiesse = catalog.brands().find((b) => b.id === 'radiesse');
    expect(radiesse?.attractionVideos?.length).toBe(1);
    expect(radiesse?.attractionVideos?.[0].source).toBe('/content/videos/radiesse.mp4');

    const ultherapy = catalog.brands().find((b) => b.id === 'ultherapy');
    expect(ultherapy?.attractionVideos?.length).toBe(1);
    expect(ultherapy?.attractionVideos?.[0].source).toBe('/content/videos/ultherapy.mp4');

    const general = catalog.rawManifest()?.app?.protector?.attractionVideos;
    expect(general?.length).toBe(1);
    expect(general?.[0].source).toBe('/content/videos/general1.mp4');
  });

  it('loadManifest() con manifest inválido debe rechazarlo y conservar el actual', () => {
    const { catalog } = buildCatalog();
    const before = catalog.brands().map((b) => b.id);

    const result = catalog.loadManifest({ invalid: true });
    expect(result).toBe(false);
    expect(catalog.brands().map((b) => b.id)).toEqual(before);
  });

  it('loadManifest() con manifest válido debe activarlo', () => {
    const { catalog } = buildCatalog();
    const newManifest: ContentManifest = {
      ...(manifestSeed as ContentManifest),
      brands: [
        ...(manifestSeed as ContentManifest).brands,
        { id: 'nueva', name: 'Nueva', version: '0.1.0', enabled: true, order: 99 },
      ],
      experiences: [
        ...(manifestSeed as ContentManifest).experiences,
        {
          id: 'nueva-memory',
          brandId: 'nueva',
          gameId: 'memory',
          version: '0.1.0',
          enabled: true,
          order: 99,
        },
      ],
    };

    const result = catalog.loadManifest(newManifest);
    expect(result).toBe(true);
    expect(catalog.brands().map((b) => b.id)).toContain('nueva');
  });

  it('manifest persistido con versión distinta a la semilla no se hidrata desde seed', () => {
    const seed = manifestSeed as ContentManifest;
    const remoteCopy: ContentManifest = {
      ...seed,
      version: '9.9.9',
      brands: seed.brands.map((brand) =>
        brand.id === 'radiesse' ? { ...brand, description: 'COPY REMOTA' } : brand,
      ),
    };

    const { catalog } = buildCatalog('0.1.0', {
      [MANIFEST_KEY]: JSON.stringify(remoteCopy),
    });

    const radiesse = catalog.brands().find((brand) => brand.id === 'radiesse');
    expect(catalog.rawManifest().version).toBe('9.9.9');
    expect(radiesse?.description).toBe('COPY REMOTA');
  });
});

// ─── Modelo update ────────────────────────────────────────────────────────────

describe('UpdateModel', () => {
  it('UpdateStatus debe incluir todos los estados requeridos', () => {
    const validStates: UpdateStatus[] = [
      'idle',
      'checking',
      'available',
      'downloading',
      'installing',
      'completed',
      'error',
      'offline',
    ];
    validStates.forEach((s) => {
      expect(typeof s).toBe('string');
    });
  });

  it('UpdateSnapshot debe poder construirse con estado idle', () => {
    const snapshot: UpdateSnapshot = {
      status: 'idle',
      appVersion: '0.1.0',
      catalogVersion: '0.1.0',
    };
    expect(snapshot.status).toBe('idle');
    expect(snapshot.errorMessage).toBeUndefined();
  });

  it('UpdateSnapshot debe poder incluir errorMessage', () => {
    const snapshot: UpdateSnapshot = {
      status: 'error',
      appVersion: '0.1.0',
      catalogVersion: '0.1.0',
      errorMessage: 'Algo salió mal',
    };
    expect(snapshot.errorMessage).toBe('Algo salió mal');
  });

  it('setExperienceEnabled actualiza el estado enabled de la experiencia y el signal experiences', () => {
    const { catalog } = buildCatalog();
    expect(catalog.experiences().some((e) => e.id === 'radiesse-memory')).toBe(true);

    catalog.setExperienceEnabled('radiesse-memory', false);
    expect(catalog.experiences().some((e) => e.id === 'radiesse-memory')).toBe(false);
    expect(catalog.rawManifest().experiences.find((e) => e.id === 'radiesse-memory')?.enabled).toBe(
      false,
    );

    catalog.setExperienceEnabled('radiesse-memory', true);
    expect(catalog.experiences().some((e) => e.id === 'radiesse-memory')).toBe(true);
    expect(catalog.rawManifest().experiences.find((e) => e.id === 'radiesse-memory')?.enabled).toBe(
      true,
    );
  });

  it('setBrandEnabled actualiza el estado enabled de la marca y el signal brands', () => {
    const { catalog } = buildCatalog();
    expect(catalog.brands().some((b) => b.id === 'radiesse')).toBe(true);

    catalog.setBrandEnabled('radiesse', false);
    expect(catalog.brands().some((b) => b.id === 'radiesse')).toBe(false);
    expect(catalog.rawManifest().brands.find((b) => b.id === 'radiesse')?.enabled).toBe(false);

    catalog.setBrandEnabled('radiesse', true);
    expect(catalog.brands().some((b) => b.id === 'radiesse')).toBe(true);
    expect(catalog.rawManifest().brands.find((b) => b.id === 'radiesse')?.enabled).toBe(true);
  });

  it('setExperiencesMode y resetGameExperiencesToDefault actualizan el manifest', () => {
    const { catalog } = buildCatalog();
    expect(catalog.experiencesMode()).toBe('global');

    catalog.setExperienceEnabled('radiesse-memory', false);
    catalog.setExperiencesMode('individual');
    expect(catalog.experiencesMode()).toBe('individual');
    expect(catalog.rawManifest().app?.experiencesMode).toBe('individual');

    catalog.resetGameExperiencesToDefault('memory');
    expect(catalog.rawManifest().experiences.find((e) => e.id === 'radiesse-memory')?.enabled).toBe(
      true,
    );

    catalog.setExperiencesMode('global');
    expect(catalog.experiencesMode()).toBe('global');
  });

  it('setDevelopMode controla la visibilidad de marcas y experiencias beta', () => {
    const { catalog } = buildCatalog();
    expect(catalog.developMode()).toBe(false);
    expect(catalog.brands().some((b) => b.id === 'belotero')).toBe(false);
    expect(catalog.experiences().some((e) => e.id === 'belotero-triqui')).toBe(false);

    catalog.setDevelopMode(true);
    expect(catalog.developMode()).toBe(true);
    expect(catalog.rawManifest().app?.developMode).toBe(true);
    expect(catalog.brands().some((b) => b.id === 'belotero')).toBe(true);
    expect(catalog.experiences().some((e) => e.id === 'belotero-triqui')).toBe(true);

    catalog.setDevelopMode(false);
    expect(catalog.developMode()).toBe(false);
    expect(catalog.brands().some((b) => b.id === 'belotero')).toBe(false);
  });

  it('detecta marcas, motores y experiencias en desarrollo correctamente', () => {
    const { catalog } = buildCatalog();

    // Triqui y memory tienen develop: false por defecto en el manifest
    expect(catalog.isGameDevelop('triqui')).toBe(false);
    expect(catalog.isGameDevelop('memory')).toBe(false);

    // Una marca con develop: true está en desarrollo
    expect(
      catalog.isBrandDevelop({
        id: 'dev-brand',
        name: 'Dev',
        version: '1.0.0',
        enabled: true,
        order: 1,
        develop: true,
      }),
    ).toBe(true);
    expect(catalog.isBrandDevelop('radiesse')).toBe(false);

    // Una experiencia con develop: true directo está en desarrollo
    expect(
      catalog.isExperienceDevelop({
        id: 'test-triqui',
        brandId: 'radiesse',
        gameId: 'triqui',
        version: '1.0.0',
        enabled: true,
        order: 1,
        title: '',
        description: '',
        image: '',
        develop: true,
      }),
    ).toBe(true);

    // Una experiencia con develop: true directo está en desarrollo
    expect(
      catalog.isExperienceDevelop({
        id: 'test-exp',
        brandId: 'radiesse',
        gameId: 'memory',
        version: '1.0.0',
        enabled: true,
        order: 2,
        title: '',
        description: '',
        image: '',
        develop: true,
      }),
    ).toBe(true);

    // radiesse-memory NO está en desarrollo
    expect(catalog.isExperienceDevelop('radiesse-memory')).toBe(false);

    // Las cards reflejan la propiedad develop
    const merzBrand = catalog.getBrandById('merz');
    if (merzBrand) {
      expect(catalog.cardForBrand(merzBrand).develop).toBe(true);
    }
    const radiesseMemory = catalog
      .rawManifest()
      .experiences.find((e) => e.id === 'radiesse-memory');
    if (radiesseMemory) {
      expect(catalog.cardForExperience(radiesseMemory).develop).toBe(false);
    }
  });

  it('resetToDefault restaura el catálogo completo al manifest original (content-manifest.json)', () => {
    const { catalog, store } = buildCatalog();

    // Deshabilitar marca y experiencia
    catalog.setBrandEnabled('radiesse', false);
    catalog.setExperienceEnabled('radiesse-memory', false);
    expect(catalog.getBrandById('radiesse')?.enabled).toBe(false);
    expect(catalog.rawManifest().experiences.find((e) => e.id === 'radiesse-memory')?.enabled).toBe(
      false,
    );

    // Restaurar por defecto
    catalog.resetToDefault();

    expect(catalog.getBrandById('radiesse')?.enabled).toBe(true);
    expect(catalog.rawManifest().experiences.find((e) => e.id === 'radiesse-memory')?.enabled).toBe(
      true,
    );
    expect(store[MANIFEST_KEY]).toBeTruthy();
    const stored = JSON.parse(store[MANIFEST_KEY]);
    expect(stored.brands.find((b: any) => b.id === 'radiesse').enabled).toBe(true);
  });

  it('setBrandVideoEnabled y setGeneralVideoEnabled actualizan y persisten enabled', () => {
    const { catalog, store } = buildCatalog();

    // Deshabilitar video de Radiesse
    catalog.setBrandVideoEnabled('radiesse', '/content/videos/radiesse.mp4', false);
    const radiesseVideos = catalog.getBrandById('radiesse')?.attractionVideos;
    expect(radiesseVideos?.find((v) => v.source === '/content/videos/radiesse.mp4')?.enabled).toBe(
      false,
    );

    // Deshabilitar video general
    catalog.setGeneralVideoEnabled('/content/videos/general1.mp4', false);
    const genVideos = catalog.rawManifest()?.app?.protector?.attractionVideos;
    expect(genVideos?.find((v) => v.source === '/content/videos/general1.mp4')?.enabled).toBe(
      false,
    );

    // Restaurar videos por defecto
    catalog.resetVideosToDefault();
    const restoredRadiesse = catalog.getBrandById('radiesse')?.attractionVideos;
    expect(
      restoredRadiesse?.find((v) => v.source === '/content/videos/radiesse.mp4')?.enabled,
    ).toBe(true);
    const restoredGen = catalog.rawManifest()?.app?.protector?.attractionVideos;
    expect(restoredGen?.find((v) => v.source === '/content/videos/general1.mp4')?.enabled).toBe(
      true,
    );
  });
});
