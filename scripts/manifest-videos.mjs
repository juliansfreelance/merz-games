/**
 * Lista de MP4 de atracción definidos en content-manifest.json.
 * `source` del manifiesto (p. ej. `/content/videos/ultherapy.mp4`) → basename
 * que debe existir en `resources/videos/` (o CONTENT_VIDEOS_DIR).
 */
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * @param {string} root raíz del repo
 * @returns {{ source: string, fileName: string }[]}
 */
export function listAttractionVideosFromManifest(root) {
  const manifestPath = join(root, 'content', 'manifests', 'content-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const sources = new Set();

  for (const video of manifest.app?.protector?.attractionVideos ?? []) {
    if (typeof video?.source === 'string' && video.source.trim()) {
      sources.add(video.source.trim());
    }
  }

  for (const brand of manifest.brands ?? []) {
    for (const video of brand.attractionVideos ?? []) {
      if (typeof video?.source === 'string' && video.source.trim()) {
        sources.add(video.source.trim());
      }
    }
  }

  return [...sources]
    .map((source) => {
      const normalized = source.replaceAll('\\', '/');
      const fileName = basename(normalized);
      return { source, fileName };
    })
    .filter((entry) => entry.fileName.toLowerCase().endsWith('.mp4'))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}
