import { ContentManifest } from './content-manifest.model';

export type CatalogChangeKind = 'added' | 'updated' | 'disabled' | 'unchanged';

export type CatalogCollection = 'brands' | 'games' | 'experiences';

export interface CatalogDiffItem {
  collection: CatalogCollection;
  id: string;
  kind: CatalogChangeKind;
  fromVersion?: string;
  toVersion?: string;
}

export interface CatalogDiff {
  readonly items: readonly CatalogDiffItem[];
  readonly hasChanges: boolean;
}

interface VersionedEnabled {
  id: string;
  version: string;
  enabled: boolean;
}

function diffCollection(
  collection: CatalogCollection,
  localItems: readonly VersionedEnabled[],
  remoteItems: readonly VersionedEnabled[],
): CatalogDiffItem[] {
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const items: CatalogDiffItem[] = [];

  for (const remote of remoteItems) {
    const local = localMap.get(remote.id);
    if (!local) {
      items.push({
        collection,
        id: remote.id,
        kind: 'added',
        toVersion: remote.version,
      });
      continue;
    }

    if (local.version !== remote.version) {
      items.push({
        collection,
        id: remote.id,
        kind: 'updated',
        fromVersion: local.version,
        toVersion: remote.version,
      });
      continue;
    }

    if (local.enabled && !remote.enabled) {
      items.push({
        collection,
        id: remote.id,
        kind: 'disabled',
        fromVersion: local.version,
        toVersion: remote.version,
      });
      continue;
    }

    items.push({
      collection,
      id: remote.id,
      kind: 'unchanged',
      fromVersion: local.version,
      toVersion: remote.version,
    });
  }

  return items;
}

/**
 * Compara dos manifests por id en brands / games / experiences.
 * Puro y testeable: no toca red, storage ni Angular.
 */
export function compareCatalogs(
  local: ContentManifest,
  remote: ContentManifest,
): CatalogDiff {
  const items = [
    ...diffCollection('brands', local.brands, remote.brands),
    ...diffCollection('games', local.games, remote.games),
    ...diffCollection('experiences', local.experiences, remote.experiences),
  ];

  return {
    items,
    hasChanges: items.some((item) => item.kind !== 'unchanged'),
  };
}

export function catalogDiffSummary(diff: CatalogDiff): {
  added: CatalogDiffItem[];
  updated: CatalogDiffItem[];
  disabled: CatalogDiffItem[];
  unchanged: CatalogDiffItem[];
} {
  return {
    added: diff.items.filter((item) => item.kind === 'added'),
    updated: diff.items.filter((item) => item.kind === 'updated'),
    disabled: diff.items.filter((item) => item.kind === 'disabled'),
    unchanged: diff.items.filter((item) => item.kind === 'unchanged'),
  };
}
