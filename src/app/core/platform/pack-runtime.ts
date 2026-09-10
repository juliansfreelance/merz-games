/**
 * Índice síncrono del pack OTA instalado.
 * `assetUrl` lo consulta para preferir AppData frente al bundle.
 */

const packAbsByRel = new Map<string, string>();
let convertFileSrcFn: ((absolutePath: string) => string) | null = null;

/** Normaliza `/content/images/a.png` o `content/images/a.png` → `images/a.png`. */
export function toPackRelative(path: string): string | null {
  if (!path) return null;
  const trimmed = path.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!trimmed.startsWith('content/')) return null;
  const rel = trimmed.slice('content/'.length);
  if (!rel || rel.includes('..')) return null;
  return rel;
}

export function hydratePackRuntime(opts: {
  readonly files: Readonly<Record<string, string>>;
  readonly convertFileSrc: (absolutePath: string) => string;
}): void {
  packAbsByRel.clear();
  for (const [rel, abs] of Object.entries(opts.files)) {
    packAbsByRel.set(rel.replaceAll('\\', '/'), abs);
  }
  convertFileSrcFn = opts.convertFileSrc;
}

export function clearPackRuntime(): void {
  packAbsByRel.clear();
  convertFileSrcFn = null;
}

export function packHasFile(rel: string): boolean {
  return packAbsByRel.has(rel.replaceAll('\\', '/'));
}

export function packFileCount(): number {
  return packAbsByRel.size;
}

/**
 * URL servible en el WebView si el archivo está en el pack.
 * `manifestPath` es la ruta del catálogo (`/content/...`).
 */
export function packAssetSrc(manifestPath: string): string | null {
  const rel = toPackRelative(manifestPath);
  if (!rel || !convertFileSrcFn) return null;
  const abs = packAbsByRel.get(rel);
  if (!abs) return null;
  return convertFileSrcFn(abs);
}
