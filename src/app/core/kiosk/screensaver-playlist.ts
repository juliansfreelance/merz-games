import { Brand } from '../catalog/brand.model';
import { AttractionVideo } from '../catalog/content-manifest.model';
import { ScreensaverVideoOrder } from '../settings/kiosk-settings';

/** Elemento normalizado de la lista de reproducción del protector de pantalla. */
export interface ScreensaverPlaylistItem {
  readonly brandId: string;
  readonly brandName: string;
  readonly videoName?: string;
  readonly videoUrl: string;
  readonly order: number;
}

/**
 * Construye la lista de reproducción de videos de atracción a partir del catálogo de marcas
 * y de los videos generales configurados en la aplicación.
 *
 * Reglas:
 * - Solo videos habilitados (`enabled: true`).
 * - Solo marcas habilitadas (`brand.enabled: true`).
 * - Solo rutas locales offline no vacías (no URLs remotas http:// o https://).
 * - Ordenadas por `order` ascendente (los videos generales tienen orden 0).
 */
export function buildScreensaverPlaylist(
  brands: readonly Brand[] | null | undefined,
  generalVideos?: readonly AttractionVideo[] | null | undefined,
): readonly ScreensaverPlaylistItem[] {
  const validItems: ScreensaverPlaylistItem[] = [];

  // 1. Videos generales (orden 0 por defecto para rotar antes o intercalar)
  if (generalVideos && generalVideos.length > 0) {
    for (const video of generalVideos) {
      if (video.enabled === false) continue;
      const url = video.source?.trim();
      if (!url) continue;
      if (url.startsWith('http://') || url.startsWith('https://')) continue;

      validItems.push({
        brandId: 'general',
        brandName: 'General',
        videoName: video.nombre || video.name || 'General',
        videoUrl: url,
        order: 0,
      });
    }
  }

  // 2. Videos de marcas habilitadas
  if (brands && brands.length > 0) {
    for (const brand of brands) {
      if (!brand.enabled) continue;

      if (brand.attractionVideos && brand.attractionVideos.length > 0) {
        for (const video of brand.attractionVideos) {
          if (video.enabled === false) continue;
          const url = video.source?.trim();
          if (!url) continue;
          if (url.startsWith('http://') || url.startsWith('https://')) continue;

          validItems.push({
            brandId: brand.id,
            brandName: brand.name,
            videoName: video.nombre || video.name || brand.name,
            videoUrl: url,
            order: brand.order ?? 1,
          });
        }
      } else if (brand.attractionVideo) {
        // Compatibilidad hacia atrás si solo existe attractionVideo singular
        const url = brand.attractionVideo.trim();
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          validItems.push({
            brandId: brand.id,
            brandName: brand.name,
            videoName: brand.name,
            videoUrl: url,
            order: brand.order ?? 1,
          });
        }
      }
    }
  }

  // Ordenar por orden ascendente
  return validItems.sort((a, b) => a.order - b.order);
}

/**
 * Obtiene el siguiente elemento de la playlist según el orden configurado.
 *
 * @param playlist Lista de elementos disponibles.
 * @param order Modo de ordenación ('sequential' o 'random').
 * @param currentIdentifier URL del video actual o ID de la marca del clip recién finalizado.
 * @param rng Función generadora de números pseudo-aleatorios (0 a 1) para tests deterministas.
 * @returns El siguiente ítem o `null` si la playlist está vacía.
 */
export function getNextPlaylistItem(
  playlist: readonly ScreensaverPlaylistItem[],
  order: ScreensaverVideoOrder,
  currentIdentifier?: string | null,
  rng: () => number = Math.random,
): ScreensaverPlaylistItem | null {
  if (!playlist || playlist.length === 0) {
    return null;
  }

  if (playlist.length === 1) {
    return playlist[0];
  }

  if (order === 'sequential') {
    if (!currentIdentifier) {
      return playlist[0];
    }
    // Buscar primero por videoUrl (distingue entre varios clips de una misma marca) y luego por brandId
    let currentIndex = playlist.findIndex((item) => item.videoUrl === currentIdentifier);
    if (currentIndex === -1) {
      currentIndex = playlist.findIndex((item) => item.brandId === currentIdentifier);
    }
    if (currentIndex === -1) {
      return playlist[0];
    }
    const nextIndex = (currentIndex + 1) % playlist.length;
    return playlist[nextIndex];
  }

  // Modo 'random': evitar repetir el mismo clip o marca consecutivamente cuando hay alternativas
  let candidates = playlist.filter(
    (item) => item.videoUrl !== currentIdentifier && item.brandId !== currentIdentifier,
  );
  if (candidates.length === 0) {
    // Si todos los videos son de la misma marca, evitar al menos repetir el mismo video exacto
    candidates = playlist.filter((item) => item.videoUrl !== currentIdentifier);
  }
  const pool = candidates.length > 0 ? candidates : playlist;

  const rawRng = rng();
  const clampedRng = Math.max(0, Math.min(0.999999, isNaN(rawRng) ? 0 : rawRng));
  const selectedIndex = Math.floor(clampedRng * pool.length);
  return pool[selectedIndex] ?? pool[0];
}
