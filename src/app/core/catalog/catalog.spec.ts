import { ContentManifest } from './content-manifest.model';
import manifestSeed from '../../../../content/manifests/content-manifest.json';

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
