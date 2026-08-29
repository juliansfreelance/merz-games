import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ContentManifest } from './content-manifest.model';
import { CatalogService, semverGte } from './catalog';
import { PlatformService } from '../platform/platform.service';
import { UpdateSnapshot, UpdateStatus } from './update.model';
import manifestSeed from '../../../../content/manifests/content-manifest.json';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MANIFEST_KEY = 'merz-games.catalog-manifest';

/** Construye un mock de PlatformService con storage en memoria. */
function buildMockPlatform(
  appVersion = '0.1.0',
  initialStorage: Record<string, string> = {},
) {
  const store = { ...initialStorage };
  return {
    appVersion: signal(appVersion),
    storageGet: (key: string) => store[key] ?? null,
    storageSet: (key: string, value: string) => { store[key] = value; },
    store,
  };
}

function buildCatalog(
  appVersion = '0.1.0',
  initialStorage: Record<string, string> = {},
) {
  const mockPlatform = buildMockPlatform(appVersion, initialStorage);
  TestBed.configureTestingModule({
    providers: [
      CatalogService,
      { provide: PlatformService, useValue: mockPlatform },
    ],
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
    expect(manifest.version).toBe('0.1.0');
  });

  it('should contain brands, games, and experiences collections', () => {
    expect(manifest.brands).toBeInstanceOf(Array);
    expect(manifest.games).toBeInstanceOf(Array);
    expect(manifest.experiences).toBeInstanceOf(Array);
  });

  it('should include radiesse and ultherapy brands', () => {
    const brandIds = manifest.brands.map((b) => b.id);
    expect(brandIds).toContain('radiesse');
    expect(brandIds).toContain('ultherapy');

    const radiesse = manifest.brands.find((b) => b.id === 'radiesse');
    expect(radiesse?.name).toBe('Radiesse');
    expect(radiesse?.enabled).toBe(true);

    const ultherapy = manifest.brands.find((b) => b.id === 'ultherapy');
    expect(ultherapy?.name).toBe('Ultherapy');
    expect(ultherapy?.enabled).toBe(true);
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
    // Los nuevos campos theme/assets/config son opcionales y no deben romper
    manifest.experiences.forEach((exp) => {
      expect(exp.id).toBeTruthy();
      // theme, assets, config pueden ser undefined — eso es correcto
    });
    manifest.games.forEach((game) => {
      expect(game.id).toBeTruthy();
      // entry, capabilities pueden ser undefined — eso es correcto
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

// ─── CatalogService — comportamiento base ────────────────────────────────────

describe('CatalogService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should expose enabled brands sorted by order', () => {
    const { catalog } = buildCatalog();
    const brands = catalog.brands();
    expect(brands.length).toBeGreaterThan(0);
    brands.forEach((b) => expect(b.enabled).toBe(true));
    for (let i = 1; i < brands.length; i++) {
      expect(brands[i - 1].order).toBeLessThanOrEqual(brands[i].order);
    }
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

  it('selectedBrand debe inicializar con la primera marca habilitada', () => {
    const { catalog } = buildCatalog();
    const first = catalog.brands()[0];
    expect(catalog.selectedBrand()).toEqual(first);
  });

  it('setSelectedBrand debe actualizar selectedBrand', () => {
    const { catalog } = buildCatalog();
    catalog.setSelectedBrand('ultherapy');
    expect(catalog.selectedBrand()?.id).toBe('ultherapy');
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
    // Los selectores no cambiaron — brands() la expone automáticamente
  });
});

// ─── CatalogService — persistencia y fallback ────────────────────────────────

describe('CatalogService — persistencia', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('JSON corrupto en storage debe usar semilla sin error', () => {
    const { catalog } = buildCatalog('0.1.0', {
      [MANIFEST_KEY]: '{invalid-json!!}',
    });
    // Debe arrancar con la semilla (radiesse y ultherapy)
    const brandIds = catalog.brands().map((b) => b.id);
    expect(brandIds).toContain('radiesse');
    expect(brandIds).toContain('ultherapy');
  });

  it('manifest persistido inválido (relaciones rotas) debe usar semilla', () => {
    const broken: ContentManifest = {
      version: '0.2.0',
      brands: [{ id: 'radiesse', name: 'Radiesse', version: '0.1.0', enabled: true, order: 1 }],
      games: [{ id: 'memory', name: 'Memory', version: '0.1.0', minAppVersion: '0.1.0', enabled: true }],
      experiences: [
        {
          id: 'bad-exp',
          brandId: 'marca-inexistente', // relación rota
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

    // Debe usar la semilla y no exponer la experiencia con relación rota
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
});

// ─── Modelo update ────────────────────────────────────────────────────────────

describe('UpdateModel', () => {
  it('UpdateStatus debe incluir todos los estados requeridos', () => {
    const validStates: UpdateStatus[] = [
      'idle', 'checking', 'available', 'downloading',
      'installing', 'completed', 'error', 'offline',
    ];
    // Verificar que los tipos compilan y se pueden usar como literales
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
});
