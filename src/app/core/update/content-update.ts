import { Injectable } from '@angular/core';
import { CatalogService, collectContentAssetUrls } from '../catalog/catalog';
import { ContentManifest } from '../catalog/content-manifest.model';
import {
  CONTENT_MANIFEST_URL,
  CONTENT_OFFLINE_MESSAGE,
} from './update.constants';

export type ContentFetchKind = 'ok' | 'offline' | 'error';

export interface ContentFetchResult {
  readonly kind: ContentFetchKind;
  readonly remote?: ContentManifest;
  readonly errorMessage?: string;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|load failed/i.test(message);
}

/**
 * GET del content-manifest publicado. Sin escritura a disco.
 */
export async function fetchContentManifest(
  url: string = CONTENT_MANIFEST_URL,
  fetchFn: FetchFn = (input, init) => globalThis.fetch(input, init),
): Promise<ContentFetchResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { kind: 'offline', errorMessage: CONTENT_OFFLINE_MESSAGE };
  }

  try {
    const response = await fetchFn(url, { method: 'GET', cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) {
        return {
          kind: 'error',
          errorMessage: 'Manifest de contenido no encontrado (404).',
        };
      }
      return {
        kind: 'error',
        errorMessage: `El host del catálogo respondió ${response.status}.`,
      };
    }

    const remote = (await response.json()) as ContentManifest;
    if (
      !remote ||
      !Array.isArray(remote.brands) ||
      !Array.isArray(remote.games) ||
      !Array.isArray(remote.experiences)
    ) {
      return { kind: 'error', errorMessage: 'El manifest remoto es inválido o está corrupto.' };
    }

    return { kind: 'ok', remote };
  } catch (error) {
    if (isNetworkFailure(error)) {
      return { kind: 'offline', errorMessage: CONTENT_OFFLINE_MESSAGE };
    }
    return {
      kind: 'error',
      errorMessage: 'No se pudo leer el manifest de contenido.',
    };
  }
}

export function pendingContentAssets(
  local: ContentManifest,
  remote: ContentManifest,
): string[] {
  const localUrls = new Set(collectContentAssetUrls(local));
  return collectContentAssetUrls(remote).filter((url) => !localUrls.has(url));
}

@Injectable({ providedIn: 'root' })
export class ContentUpdate {
  fetchRemote(fetchFn?: FetchFn): Promise<ContentFetchResult> {
    return fetchContentManifest(CONTENT_MANIFEST_URL, fetchFn);
  }

  apply(catalog: CatalogService, raw: unknown): boolean {
    return catalog.loadManifest(raw);
  }

  pendingAssets(local: ContentManifest, remote: ContentManifest): string[] {
    return pendingContentAssets(local, remote);
  }
}
