/**
 * Resuelve assets locales contra `<base href>`.
 *
 * Las URLs con `/` inicial (`/content/...`) ignoran el base href y en
 * GitHub Pages (`/merz-games/`) irían a `origen/content/...` (404).
 * Se recorta la `/` y se resuelve con `document.baseURI`.
 */
export function assetUrl(path: string): string {
  if (!path) return path;
  if (/^(https?:|blob:|data:)/i.test(path)) return path;

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
