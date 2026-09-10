import { CONTENT_PUBLIC_RAW_BASE, CONTENT_VIDEOS_RELEASE_BASE } from './update.constants';

const VIDEO_EXT = /\.(mp4|webm)$/i;

/** Ruta de catálogo segura (`/content/...`) o `null` si es traversal / host extraño. */
export function normalizeContentPath(path: string): string | null {
  if (!path) return null;
  const trimmed = path.trim().replaceAll('\\', '/');
  if (/^(https?:|blob:|data:)/i.test(trimmed)) return null;
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withSlash.includes('..') || withSlash.includes('://')) return null;
  if (!withSlash.startsWith('/content/')) return null;
  return withSlash;
}

/** Relativo al directorio `content/` de AppData (`images/a.png`). */
export function toContentRel(path: string): string | null {
  const normalized = normalizeContentPath(path);
  if (!normalized) return null;
  return normalized.slice('/content/'.length);
}

export function basename(path: string): string {
  const normalized = path.replaceAll('\\', '/');
  const i = normalized.lastIndexOf('/');
  return i >= 0 ? normalized.slice(i + 1) : normalized;
}

export function isVideoAssetPath(path: string): boolean {
  return VIDEO_EXT.test(path);
}

export function pendingHasVideos(paths: readonly string[]): boolean {
  return paths.some((p) => isVideoAssetPath(p));
}

/**
 * URL HTTPS de descarga para una ruta del manifiesto.
 * Videos → Release `content-videos`. Resto → raw `public/` en `master`.
 */
export function localAssetToRemoteUrl(localPath: string): string | null {
  const normalized = normalizeContentPath(localPath);
  if (!normalized) return null;
  if (normalized.startsWith('/content/videos/')) {
    return `${CONTENT_VIDEOS_RELEASE_BASE}/${encodeURIComponent(basename(normalized))}`;
  }
  const withoutLeading = normalized.slice(1);
  return `${CONTENT_PUBLIC_RAW_BASE}/${withoutLeading.split('/').map(encodeURIComponent).join('/')}`;
}
