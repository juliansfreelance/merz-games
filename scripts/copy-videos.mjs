#!/usr/bin/env node
/**
 * Copia los MP4 de atracción a public/content/videos/ antes de tauri build.
 *
 * Orígenes (en orden):
 * 1. CONTENT_VIDEOS_DIR (env)
 * 2. resources/videos/ (masters / pack kiosco, gitignored)
 * 3. public/content/videos/ ya poblado
 *
 * Catálogo canónico: general1 + radiesse + ultherapy (1 clip por marca).
 *
 * No falla si faltan archivos en modo desarrollo (COPY_VIDEOS_STRICT≠1).
 * En CI de release: COPY_VIDEOS_STRICT=1.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const destDir = join(root, 'public', 'content', 'videos');
const strict = process.env.COPY_VIDEOS_STRICT === '1';

/** Rutas esperadas por content-manifest.json (basename). */
const REQUIRED = ['general1.mp4', 'radiesse.mp4', 'ultherapy.mp4'];

/** Alias de masters / fallbacks ligeros → destinos del catálogo. */
const MASTER_MAP = {
  'Radiesse.mp4': ['radiesse.mp4'],
  'radiesse.mp4': ['radiesse.mp4'],
  'radiesse2.mp4': ['radiesse.mp4'],
  'Ultherapy.mp4': ['ultherapy.mp4'],
  'ultherapy.mp4': ['ultherapy.mp4'],
  'ultherapy2.mp4': ['ultherapy.mp4'],
  'general1.mp4': ['general1.mp4'],
  'General 1.mp4': ['general1.mp4'],
  'General1.mp4': ['general1.mp4'],
};

function listMp4(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.mp4'))
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile());
}

function ensureDest() {
  mkdirSync(destDir, { recursive: true });
}

function copyMapped(sourcePath) {
  const name = basename(sourcePath);
  const targets = MASTER_MAP[name] ?? [name.toLowerCase()];
  for (const target of targets) {
    if (!REQUIRED.includes(target)) continue;
    const dest = join(destDir, target);
    copyFileSync(sourcePath, dest);
    console.log(`[copy-videos] ${name} → ${target}`);
  }
}

const candidates = [];
if (process.env.CONTENT_VIDEOS_DIR) {
  candidates.push(resolve(process.env.CONTENT_VIDEOS_DIR));
}
candidates.push(join(root, 'resources', 'videos'));
candidates.push(destDir);

ensureDest();

let copied = 0;
for (const dir of candidates) {
  const files = listMp4(dir);
  if (files.length === 0) continue;
  if (dir === destDir && REQUIRED.every((name) => existsSync(join(destDir, name)))) {
    console.log(`[copy-videos] destino ya tiene ${REQUIRED.length} MP4 canónicos; nada que hacer`);
    break;
  }
  for (const file of files) {
    if (dir === destDir && !MASTER_MAP[basename(file)]) continue;
    copyMapped(file);
    copied += 1;
  }
  if (copied > 0) break;
}

// Preferir *2 ligeros sobre masters pesados si ambos existen en resources
const resourcesDir = join(root, 'resources', 'videos');
for (const [light, target] of [
  ['radiesse2.mp4', 'radiesse.mp4'],
  ['ultherapy2.mp4', 'ultherapy.mp4'],
]) {
  const lightPath = join(resourcesDir, light);
  const heavyPath = join(resourcesDir, target);
  const dest = join(destDir, target);
  if (!existsSync(lightPath)) continue;
  const lightSize = statSync(lightPath).size;
  const heavySize = existsSync(heavyPath) ? statSync(heavyPath).size : Infinity;
  if (lightSize < heavySize) {
    copyFileSync(lightPath, dest);
    console.log(`[copy-videos] preferir ligero ${light} → ${target}`);
  }
}

const present = REQUIRED.filter((name) => existsSync(join(destDir, name)));
const missing = REQUIRED.filter((name) => !existsSync(join(destDir, name)));

console.log(`[copy-videos] presentes ${present.length}/${REQUIRED.length}`);
if (missing.length) {
  const msg = `[copy-videos] faltan: ${missing.join(', ')}. Coloca masters en resources/videos/, npm run videos:compress, o CONTENT_VIDEOS_DIR.`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
  console.warn('[copy-videos] modo no estricto: el instalador puede caer a protector clásico si faltan clips.');
}
