export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** JSON de contenido publicado en `master`. */
export const CONTENT_MANIFEST_URL =
  'https://raw.githubusercontent.com/juliansfreelance/merz-games/master/content/manifests/content-manifest.json';

/**
 * Índice opcional de hashes SHA-256 por ruta de manifest.
 * Si el GET es 404, el pack se instala con verificación de tipo/tamaño.
 */
export const CONTENT_INDEX_URL =
  'https://raw.githubusercontent.com/juliansfreelance/merz-games/master/content/manifests/content-index.json';

/**
 * Prefijo raw de `public/` en `master` (imágenes, audio y demás archivos versionados).
 * `/content/images/x.png` → `{base}/content/images/x.png`.
 */
export const CONTENT_PUBLIC_RAW_BASE =
  'https://raw.githubusercontent.com/juliansfreelance/merz-games/master/public';

/**
 * Release auxiliar de MP4 (no viven en git). Basename alineado al manifiesto.
 * `/content/videos/ultherapy.mp4` → `{base}/ultherapy.mp4`.
 */
export const CONTENT_VIDEOS_RELEASE_BASE =
  'https://github.com/juliansfreelance/merz-games/releases/download/content-videos';

/** Fallo al consultar o instalar el canal del ejecutable (red, firma o Release ausente). */
export const APP_UPDATE_ERROR_MESSAGE =
  'No se pudo consultar o instalar la actualización del ejecutable. Comprueba la red y que el Release esté firmado.';

/** @deprecated Usar APP_UPDATE_ERROR_MESSAGE. */
export const APP_UPDATE_PLACEHOLDER_MESSAGE = APP_UPDATE_ERROR_MESSAGE;

export const CONTENT_OFFLINE_MESSAGE =
  'Sin conexión. El kiosco sigue operando con el catálogo local.';

export const CONTENT_PACK_DESKTOP_ONLY_MESSAGE =
  'Los packs OTA (archivos nuevos) solo se descargan en la app nativa. El catálogo JSON sí se aplicó; los assets de semilla siguen en el bundle.';

/** Updater binario no aplica en Android: reinstalar APK. */
export const APP_UPDATE_ANDROID_SIDELOAD_MESSAGE =
  'En Android la app se actualiza reinstalando el APK. El canal OTA de contenido (catálogo y packs) sí funciona.';

export const CONTENT_PACK_INVALID_MESSAGE =
  'El manifest remoto no es válido o es incompatible. Se conservó el catálogo anterior.';

export const CONTENT_PACK_DOWNLOAD_ERROR_MESSAGE =
  'No se pudieron descargar los archivos de contenido. El catálogo anterior sigue activo.';

export const CONTENT_PACK_HASH_ERROR_MESSAGE =
  'Un archivo descargado no coincide con su hash. No se instaló el pack.';

export type ContentIndexMap = Readonly<
  Record<string, { readonly sha256?: string; readonly bytes?: number }>
>;

export interface ContentAssetIndex {
  readonly assets?: ContentIndexMap;
}

export async function fetchContentAssetIndex(
  url: string = CONTENT_INDEX_URL,
  fetchFn: FetchFn = (input, init) => globalThis.fetch(input, init),
): Promise<ContentIndexMap> {
  try {
    const response = await fetchFn(url, { method: 'GET', cache: 'no-store' });
    if (!response.ok) return {};
    const parsed = (await response.json()) as ContentAssetIndex;
    if (!parsed || typeof parsed !== 'object' || !parsed.assets) return {};
    return parsed.assets;
  } catch {
    return {};
  }
}

export function hashForAsset(path: string, index: ContentIndexMap | undefined): string | undefined {
  if (!index) return undefined;
  const direct = index[path]?.sha256;
  if (direct) return direct;
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return index[withSlash]?.sha256 ?? index[path.replace(/^\//, '')]?.sha256;
}
