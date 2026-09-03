import { Brand } from '../catalog/brand.model';
import { ScreensaverVideoOrder } from '../settings/kiosk-settings';

/** Elemento normalizado de la lista de reproducción del protector de pantalla. */
export interface ScreensaverPlaylistItem {
  readonly brandId: string;
  readonly brandName: string;
  readonly videoUrl: string;
  readonly order: number;
}

/**
 * Construye la lista de reproducción de videos de atracción a partir del catálogo de marcas.
 *
 * Reglas:
 * - Solo marcas habilitadas (`enabled: true`).
 * - Solo marcas con `attractionVideo` no vacío y local (no URLs remotas http:// o https://).
 * - Ordenadas por `order` ascendente.
 * - Cero `if` por marca: Radiesse, Ultherapy o cualquier marca futura entra automáticamente.
 */
export function buildScreensaverPlaylist(
  brands: readonly Brand[] | null | undefined,
): readonly ScreensaverPlaylistItem[] {
  if (!brands || brands.length === 0) {
    return [];
  }

  const validItems: ScreensaverPlaylistItem[] = [];

  for (const brand of brands) {
    if (!brand.enabled) continue;
    const video = brand.attractionVideo?.trim();
    if (!video) continue;

    // Solo rutas locales offline
    if (video.startsWith('http://') || video.startsWith('https://')) {
      continue;
    }

    validItems.push({
      brandId: brand.id,
      brandName: brand.name,
      videoUrl: video,
      order: brand.order ?? 0,
    });
  }

  // Ordenar por orden de catálogo
  return validItems.sort((a, b) => a.order - b.order);
}

/**
 * Obtiene el siguiente elemento de la playlist según el orden configurado.
 *
 * @param playlist Lista de elementos disponibles.
 * @param order Modo de ordenación ('sequential' o 'random').
 * @param currentBrandId ID de la marca del clip actual o recién finalizado/fallido.
 * @param rng Función generadora de números pseudo-aleatorios (0 a 1) para tests deterministas.
 * @returns El siguiente ítem o `null` si la playlist está vacía.
 */
export function getNextPlaylistItem(
  playlist: readonly ScreensaverPlaylistItem[],
  order: ScreensaverVideoOrder,
  currentBrandId?: string | null,
  rng: () => number = Math.random,
): ScreensaverPlaylistItem | null {
  if (!playlist || playlist.length === 0) {
    return null;
  }

  if (playlist.length === 1) {
    return playlist[0];
  }

  if (order === 'sequential') {
    if (!currentBrandId) {
      return playlist[0];
    }
    const currentIndex = playlist.findIndex((item) => item.brandId === currentBrandId);
    if (currentIndex === -1) {
      return playlist[0];
    }
    const nextIndex = (currentIndex + 1) % playlist.length;
    return playlist[nextIndex];
  }

  // Modo 'random': no repetir el mismo clip de forma consecutiva cuando hay 2 o más
  const candidates = playlist.filter((item) => item.brandId !== currentBrandId);
  const pool = candidates.length > 0 ? candidates : playlist;

  const rawRng = rng();
  const clampedRng = Math.max(0, Math.min(0.999999, isNaN(rawRng) ? 0 : rawRng));
  const selectedIndex = Math.floor(clampedRng * pool.length);
  return pool[selectedIndex] ?? pool[0];
}
