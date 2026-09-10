#!/usr/bin/env node
/**
 * Transcodifica MP4 de atracción a perfil kiosco (H.264 + AAC, máx. 720p).
 *
 * Entrada: resources/videos/ (o CONTENT_VIDEOS_DIR)
 * Salida: public/content/videos/
 *
 * Requiere ffmpeg en PATH. Si no está, sale con código 1 y mensaje claro
 * (no bloquea tauri:dev; sí debe usarse antes de publicar content-videos).
 *
 * Uso: npm run videos:compress
 */
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const destDir = join(root, 'public', 'content', 'videos');
const sourceDir = process.env.CONTENT_VIDEOS_DIR
  ? resolve(process.env.CONTENT_VIDEOS_DIR)
  : join(root, 'resources', 'videos');

/** Clips canónicos del content-manifest (1 general + 1 por marca). */
const TARGETS = ['general1.mp4', 'radiesse.mp4', 'ultherapy.mp4'];

/** Preferir versión ligera ya presente si el master pesa demasiado. */
const LIGHT_FALLBACK = {
  'radiesse.mp4': 'radiesse2.mp4',
  'ultherapy.mp4': 'ultherapy2.mp4',
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function findFfmpeg() {
  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (probe.status === 0) return 'ffmpeg';
  return null;
}

function listMp4(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.toLowerCase().endsWith('.mp4'))
    .map((n) => join(dir, n));
}

function pickSource(basenameTarget) {
  const direct = join(sourceDir, basenameTarget);
  if (existsSync(direct)) return direct;
  const light = LIGHT_FALLBACK[basenameTarget];
  if (light) {
    const lightPath = join(sourceDir, light);
    if (existsSync(lightPath)) return lightPath;
  }
  // Case-insensitive scan
  const all = listMp4(sourceDir);
  const hit = all.find((p) => basename(p).toLowerCase() === basenameTarget.toLowerCase());
  return hit ?? null;
}

function transcode(ffmpegBin, input, output) {
  const args = [
    '-y',
    '-i',
    input,
    '-vf',
    "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '26',
    '-maxrate',
    '4M',
    '-bufsize',
    '8M',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p',
    output,
  ];
  console.log(`[compress-videos] ffmpeg → ${basename(output)}`);
  const result = spawnSync(ffmpegBin, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`ffmpeg falló para ${basename(input)} (exit ${result.status})`);
  }
}

mkdirSync(destDir, { recursive: true });

const ffmpegBin = findFfmpeg();
if (!ffmpegBin) {
  console.error(
    '[compress-videos] ffmpeg no está en PATH. Instálalo (p. ej. winget install Gyan.FFmpeg) y reintenta.',
  );
  console.error(
    '[compress-videos] Alternativa: coloca general1.mp4, radiesse.mp4 y ultherapy.mp4 ya ligeros en resources/videos/ y usa npm run copy:videos.',
  );
  process.exit(1);
}

if (!existsSync(sourceDir)) {
  console.error(`[compress-videos] No existe el directorio fuente: ${sourceDir}`);
  process.exit(1);
}

let failed = 0;
for (const target of TARGETS) {
  const src = pickSource(target);
  if (!src) {
    console.warn(`[compress-videos] falta fuente para ${target}`);
    failed += 1;
    continue;
  }
  const out = join(destDir, target);
  const size = statSync(src).size;
  // Si ya es ligero (&lt; 50 MB) y el basename coincide, copiar; si no, transcodificar.
  if (size <= MAX_BYTES && basename(src).toLowerCase() === target.toLowerCase()) {
    copyFileSync(src, out);
    console.log(`[compress-videos] copy (ya ligero ${(size / 1024 / 1024).toFixed(1)} MB) ${target}`);
  } else if (size <= MAX_BYTES && LIGHT_FALLBACK[target] && basename(src).toLowerCase() === LIGHT_FALLBACK[target]) {
    copyFileSync(src, out);
    console.log(
      `[compress-videos] copy fallback ${basename(src)} → ${target} (${(size / 1024 / 1024).toFixed(1)} MB)`,
    );
  } else {
    try {
      transcode(ffmpegBin, src, out);
      const outSize = statSync(out).size;
      console.log(`[compress-videos] ok ${target} ${(outSize / 1024 / 1024).toFixed(1)} MB`);
      if (outSize > MAX_BYTES) {
        console.warn(`[compress-videos] aviso: ${target} supera 50 MB (${(outSize / 1024 / 1024).toFixed(1)} MB)`);
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      failed += 1;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log('[compress-videos] listo');
