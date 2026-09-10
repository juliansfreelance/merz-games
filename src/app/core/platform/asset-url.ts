/**
 * Resuelve assets locales: pack OTA (nativo) > bundle (`<base href>`).
 *
 * Las URLs con `/` inicial (`/content/...`) ignoran el base href y en
 * GitHub Pages (`/merz-games/`) irían a `origen/content/...` (404).
 * Se recorta la `/` y se resuelve con `document.baseURI`.
 */
import { packAssetSrc } from './pack-runtime';

export function assetUrl(path: string): string {
  if (!path) return path;
  if (/^(https?:|blob:|data:)/i.test(path)) return path;

  const fromPack = packAssetSrc(path);
  if (fromPack) return fromPack;

  const relative = path.startsWith('/') ? path.slice(1) : path;
  if (typeof document === 'undefined' || !document.baseURI) {
    return `/${relative}`;
  }

  try {
    return new URL(relative, document.baseURI).href;
  } catch {
    return `/${relative}`;
  }
}
