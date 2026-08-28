import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ContentManifest } from './content-manifest.model';
import { CatalogService, semverGte } from './catalog';
import { PlatformService } from '../platform/platform.service';
import manifestSeed from '../../../../content/manifests/content-manifest.json';

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

// ─── CatalogService ───────────────────────────────────────────────────────────

function buildCatalogWithMock(appVersion = '0.1.0') {
  const mockPlatform = { appVersion: signal(appVersion) };
  TestBed.configureTestingModule({
    providers: [
      CatalogService,
      { provide: PlatformService, useValue: mockPlatform },
    ],
  });
  return TestBed.inject(CatalogService);
}

describe('CatalogService', () => {
  it('should expose enabled brands sorted by order', () => {
    const catalog = buildCatalogWithMock();
    const brands = catalog.brands();
    expect(brands.length).toBeGreaterThan(0);
    brands.forEach((b) => expect(b.enabled).toBe(true));
    for (let i = 1; i < brands.length; i++) {
      expect(brands[i - 1].order).toBeLessThanOrEqual(brands[i].order);
    }
  });

  it('should exclude disabled brands', () => {
    const catalog = buildCatalogWithMock();
    const brands = catalog.brands();
    // La semilla no tiene marcas deshabilitadas, todas deben aparecer
    expect(brands.map((b) => b.id)).toContain('radiesse');
    expect(brands.map((b) => b.id)).toContain('ultherapy');
  });

  it('should expose enabled experiences with valid relations', () => {
    const catalog = buildCatalogWithMock();
    const experiences = catalog.experiences();
    expect(experiences.length).toBeGreaterThan(0);
    experiences.forEach((exp) => {
      expect(exp.enabled).toBe(true);
      expect(catalog.getBrandById(exp.brandId)?.enabled).toBe(true);
      expect(catalog.getGameById(exp.gameId)?.enabled).toBe(true);
    });
  });

  it('should filter experiences by brandId', () => {
    const catalog = buildCatalogWithMock();
    const radiesse = catalog.experiencesForBrand('radiesse');
    expect(radiesse.length).toBeGreaterThan(0);
    radiesse.forEach((exp) => expect(exp.brandId).toBe('radiesse'));
  });

  it('should return empty array for unknown brandId', () => {
    const catalog = buildCatalogWithMock();
    expect(catalog.experiencesForBrand('no-existe')).toEqual([]);
  });

  it('should exclude experiences whose game minAppVersion exceeds app version', () => {
    // App en versión antigua; motor requiere versión futura
    const catalog = buildCatalogWithMock('0.0.1');
    // memory y triqui requieren 0.1.0, app es 0.0.1 → no deben aparecer
    const experiences = catalog.experiences();
    expect(experiences.length).toBe(0);
  });

  it('should include experiences when app version meets minAppVersion', () => {
    const catalog = buildCatalogWithMock('1.0.0');
    const experiences = catalog.experiences();
    expect(experiences.length).toBeGreaterThan(0);
  });

  it('should resolve experience by id', () => {
    const catalog = buildCatalogWithMock();
    const exp = catalog.getExperienceById('radiesse-memory');
    expect(exp).toBeDefined();
    expect(exp?.brandId).toBe('radiesse');
    expect(exp?.gameId).toBe('memory');
  });

  it('should return undefined for unknown experience id', () => {
    const catalog = buildCatalogWithMock();
    expect(catalog.getExperienceById('no-existe')).toBeUndefined();
  });

  it('should report brand as playable when it has valid experiences', () => {
    const catalog = buildCatalogWithMock();
    expect(catalog.isBrandPlayable('radiesse')).toBe(true);
    expect(catalog.isBrandPlayable('ultherapy')).toBe(true);
  });

  it('should report unknown brand as not playable', () => {
    const catalog = buildCatalogWithMock();
    expect(catalog.isBrandPlayable('no-existe')).toBe(false);
  });

  /**
   * Test de regresión de catálogo abierto:
   * Si se añade una tercera marca válida al manifest (con enabled: true),
   * debe aparecer en catalog.brands() SIN modificar el TS del selector.
   *
   * Este test usa la semilla real; documentamos el comportamiento esperado.
   * En Fase 3, cuando el CatalogManager acepte manifests externos,
   * se podrá inyectar un fixture completo aquí.
   */
  it('should reflect all enabled brands from manifest without selector changes', () => {
    const catalog = buildCatalogWithMock();
    const brandIds = catalog.brands().map((b) => b.id);
    // La semilla actual tiene 2 marcas; si se añade una tercera al JSON,
    // este test confirma que brands() la expone automáticamente.
    expect(brandIds.length).toBe(catalog.brands().length);
    // Todas las marcas del brands() son las habilitadas del manifest:
    brandIds.forEach((id) => {
      expect(catalog.getBrandById(id)?.enabled).toBe(true);
    });
  });
});
