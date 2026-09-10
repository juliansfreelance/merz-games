#!/usr/bin/env node
/**
 * Copia los MP4 de atracción definidos en content-manifest.json
 * hacia public/content/videos/ antes de tauri build.
 *
 * Orígenes (en orden, por cada basename del manifiesto):
 * 1. CONTENT_VIDEOS_DIR (env)
 * 2. resources/videos/
 * 3. public/content/videos/ (ya presente)
 *
 * Sin aliases ni lista fija: el manifiesto es la fuente de verdad.
 * `source: "/content/videos/ultherapy.mp4"` → `resources/videos/ultherapy.mp4`.
 *
 * No falla si faltan archivos en modo desarrollo (COPY_VIDEOS_STRICT≠1).
 * En CI de release: COPY_VIDEOS_STRICT=1.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAttractionVideosFromManifest } from './manifest-videos.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const destDir = join(root, 'public', 'content', 'videos');
const strict = process.env.COPY_VIDEOS_STRICT === '1';

const searchDirs = [];
if (process.env.CONTENT_VIDEOS_DIR) {
  searchDirs.push(resolve(process.env.CONTENT_VIDEOS_DIR));
}
searchDirs.push(join(root, 'resources', 'videos'));

const required = listAttractionVideosFromManifest(root);

if (required.length === 0) {
  console.warn('[copy-videos] el manifiesto no declara attractionVideos; nada que copiar');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

function findSource(fileName) {
  for (const dir of searchDirs) {
    const candidate = join(dir, fileName);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const present = [];
const missing = [];

for (const { fileName, source } of required) {
  const dest = join(destDir, fileName);
  if (existsSync(dest)) {
    console.log(`[copy-videos] ya en destino: ${fileName}`);
    present.push(fileName);
    continue;
  }

  const src = findSource(fileName);
  if (!src) {
    missing.push(fileName);
    console.warn(`[copy-videos] falta ${fileName} (manifiesto: ${source})`);
    continue;
  }

  copyFileSync(src, dest);
  console.log(`[copy-videos] ${fileName}`);
  present.push(fileName);
}

console.log(`[copy-videos] presentes ${present.length}/${required.length}`);
if (missing.length) {
  const msg = `[copy-videos] faltan: ${missing.join(', ')}. Colócalos en resources/videos/ (mismo basename que el source del manifiesto), npm run videos:compress, o CONTENT_VIDEOS_DIR.`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
  console.warn(
    '[copy-videos] modo no estricto: el instalador puede caer a protector clásico si faltan clips.',
  );
}
