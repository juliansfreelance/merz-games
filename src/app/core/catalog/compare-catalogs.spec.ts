import { compareCatalogs } from './compare-catalogs';
import { ContentManifest } from './content-manifest.model';

function item(
  id: string,
  version: string,
  enabled = true,
): { id: string; version: string; enabled: boolean; name: string; order: number } {
  return { id, version, enabled, name: id, order: 1 };
}

function game(
  id: string,
  version: string,
  enabled = true,
): {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  enabled: boolean;
} {
  return { id, name: id, version, minAppVersion: '0.1.0', enabled };
}

function experience(id: string, brandId: string, gameId: string, version: string, enabled = true) {
  return { id, brandId, gameId, version, enabled, order: 1 };
}

function manifest(partial: Partial<ContentManifest>): ContentManifest {
  return {
    version: '1.0.0',
    brands: [item('radiesse', '1.0.0'), item('ultherapy', '1.0.0')],
    games: [game('memory', '1.0.0'), game('triqui', '1.0.0')],
    experiences: [
      experience('radiesse-memory', 'radiesse', 'memory', '1.0.0'),
      experience('ultherapy-memory', 'ultherapy', 'memory', '1.0.0'),
      experience('radiesse-triqui', 'radiesse', 'triqui', '1.0.0'),
    ],
    ...partial,
  };
}

describe('compareCatalogs', () => {
  it('marca unchanged cuando local y remoto coinciden', () => {
    const local = manifest({});
    const diff = compareCatalogs(local, local);
    expect(diff.hasChanges).toBe(false);
    expect(diff.items.every((entry) => entry.kind === 'unchanged')).toBe(true);
  });

  it('detecta una experiencia nueva y otra con subida de versión', () => {
    const local = manifest({});
    const remote = manifest({
      version: '1.1.0',
      experiences: [
        experience('radiesse-memory', 'radiesse', 'memory', '1.2.0'),
        experience('ultherapy-memory', 'ultherapy', 'memory', '1.0.0'),
        experience('radiesse-triqui', 'radiesse', 'triqui', '1.0.0'),
        experience('ultherapy-triqui', 'ultherapy', 'triqui', '1.0.0'),
      ],
    });

    const diff = compareCatalogs(local, remote);
    const byId = new Map(diff.items.map((entry) => [`${entry.collection}:${entry.id}`, entry]));

    expect(byId.get('experiences:ultherapy-triqui')?.kind).toBe('added');
    expect(byId.get('experiences:radiesse-memory')).toEqual(
      expect.objectContaining({
        kind: 'updated',
        fromVersion: '1.0.0',
        toVersion: '1.2.0',
      }),
    );
    expect(byId.get('experiences:ultherapy-memory')?.kind).toBe('unchanged');
    expect(byId.get('games:memory')?.kind).toBe('unchanged');
    expect(diff.hasChanges).toBe(true);
  });

  it('aisla radiesse-memory de ultherapy-memory y del motor', () => {
    const local = manifest({});
    const remote = manifest({
      experiences: [
        experience('radiesse-memory', 'radiesse', 'memory', '1.4.0'),
        experience('ultherapy-memory', 'ultherapy', 'memory', '1.0.0'),
        experience('radiesse-triqui', 'radiesse', 'triqui', '1.0.0'),
      ],
    });

    const kinds = Object.fromEntries(
      compareCatalogs(local, remote).items.map((entry) => [
        `${entry.collection}:${entry.id}`,
        entry.kind,
      ]),
    );

    expect(kinds['experiences:radiesse-memory']).toBe('updated');
    expect(kinds['experiences:ultherapy-memory']).toBe('unchanged');
    expect(kinds['games:memory']).toBe('unchanged');
    expect(kinds['brands:radiesse']).toBe('unchanged');
  });

  it('detecta disabled cuando enabled pasa de true a false con la misma versión', () => {
    const local = manifest({});
    const remote = manifest({
      brands: [item('radiesse', '1.0.0', false), item('ultherapy', '1.0.0')],
    });

    const radiesse = compareCatalogs(local, remote).items.find(
      (entry) => entry.collection === 'brands' && entry.id === 'radiesse',
    );
    expect(radiesse?.kind).toBe('disabled');
  });

  it('añadir Belotero y belotero-triqui no altera Radiesse ni Ultherapy', () => {
    const local = manifest({});
    const remote = manifest({
      version: '1.2.0',
      brands: [item('radiesse', '1.0.0'), item('ultherapy', '1.0.0'), item('belotero', '0.1.0')],
      experiences: [
        experience('radiesse-memory', 'radiesse', 'memory', '1.0.0'),
        experience('ultherapy-memory', 'ultherapy', 'memory', '1.0.0'),
        experience('radiesse-triqui', 'radiesse', 'triqui', '1.0.0'),
        experience('belotero-triqui', 'belotero', 'triqui', '0.1.0'),
      ],
    });

    const byId = new Map(
      compareCatalogs(local, remote).items.map((entry) => [
        `${entry.collection}:${entry.id}`,
        entry.kind,
      ]),
    );

    expect(byId.get('brands:belotero')).toBe('added');
    expect(byId.get('experiences:belotero-triqui')).toBe('added');
    expect(byId.get('brands:radiesse')).toBe('unchanged');
    expect(byId.get('brands:ultherapy')).toBe('unchanged');
    expect(byId.get('experiences:radiesse-memory')).toBe('unchanged');
    expect(byId.get('experiences:ultherapy-memory')).toBe('unchanged');
    expect(byId.get('games:memory')).toBe('unchanged');
    expect(byId.get('games:triqui')).toBe('unchanged');
  });
});
