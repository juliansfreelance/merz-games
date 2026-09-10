#!/usr/bin/env node
/**
 * Transcodifica MP4 de atracción a perfil kiosco (H.264 + AAC, máx. 1080p).
 *
 * Lee los `source` de content-manifest.json. Entrada primaria:
 *   resources/videos/<basename>
 * (o CONTENT_VIDEOS_DIR). Salida: public/content/videos/<basename>
 *
 * Ejemplo: source "/content/videos/ultherapy.mp4"
 *   → resources/videos/ultherapy.mp4
 *   → public/content/videos/ultherapy.mp4
 *
 * Requiere ffmpeg. Resolución (en orden): FFMPEG_BIN, rutas fijas de
 * instalación, localizador del sistema (where.exe / which). Si no está,
 * sale con código 1 (no bloquea tauri:dev; sí debe usarse antes de
 * publicar content-videos).
 *
 * Uso: npm run videos:compress
 */
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { listAttractionVideosFromManifest } from './manifest-videos.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const destDir = join(root, 'public', 'content', 'videos');
const sourceDir = process.env.CONTENT_VIDEOS_DIR
  ? resolve(process.env.CONTENT_VIDEOS_DIR)
  : join(root, 'resources', 'videos');

/** Aviso blando si un clip de salida supera este tamaño (1080p kiosco). */
const WARN_BYTES = 80 * 1024 * 1024;

const spawnOpts = { encoding: 'utf8', windowsHide: true, shell: false };

function isRunnableFfmpeg(bin) {
  if (!bin) return false;
  if (isAbsolute(bin) && !existsSync(bin)) return false;
  return spawnSync(bin, ['-version'], spawnOpts).status === 0;
}

/** Busca ffmpeg.exe bajo WinGet Packages (instalación Gyan.FFmpeg). */
function wingetFfmpegCandidates() {
  const local = process.env.LOCALAPPDATA;
  if (!local) return [];
  const packagesRoot = join(local, 'Microsoft', 'WinGet', 'Packages');
  if (!existsSync(packagesRoot)) return [];

  const found = [];
  try {
    for (const pkg of readdirSync(packagesRoot)) {
      if (!/ffmpeg/i.test(pkg)) continue;
      const pkgDir = join(packagesRoot, pkg);
      let children;
      try {
        children = readdirSync(pkgDir);
      } catch {
        continue;
      }
      for (const child of children) {
        const bin = join(pkgDir, child, 'bin', 'ffmpeg.exe');
        if (existsSync(bin)) found.push(bin);
      }
    }
  } catch {
    /* ignore */
  }
  return found;
}

function knownFfmpegCandidates() {
  const fromEnv = process.env.FFMPEG_BIN ? resolve(process.env.FFMPEG_BIN) : null;
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles ?? String.raw`C:\Program Files`;
    const pf86 = process.env['ProgramFiles(x86)'] ?? String.raw`C:\Program Files (x86)`;
    const local = process.env.LOCALAPPDATA;
    const home = process.env.USERPROFILE;
    return [
      fromEnv,
      ...wingetFfmpegCandidates(),
      join(pf, 'ffmpeg', 'bin', 'ffmpeg.exe'),
      join(pf86, 'ffmpeg', 'bin', 'ffmpeg.exe'),
      String.raw`C:\ffmpeg\bin\ffmpeg.exe`,
      local ? join(local, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe') : null,
      home ? join(home, 'scoop', 'shims', 'ffmpeg.exe') : null,
      String.raw`C:\ProgramData\chocolatey\bin\ffmpeg.exe`,
    ].filter(Boolean);
  }
  return [fromEnv, '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'].filter(
    Boolean,
  );
}

function locateFfmpegAbsolute() {
  const locator =
    process.platform === 'win32'
      ? join(process.env.SystemRoot ?? String.raw`C:\Windows`, 'System32', 'where.exe')
      : '/usr/bin/which';
  if (!existsSync(locator)) return [];
  const result = spawnSync(locator, ['ffmpeg'], spawnOpts);
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => isAbsolute(line) && existsSync(line));
}

function findFfmpeg() {
  for (const candidate of [...knownFfmpegCandidates(), ...locateFfmpegAbsolute()]) {
    if (isRunnableFfmpeg(candidate)) return candidate;
  }
  // Último recurso: nombre en PATH (p. ej. shell recién reiniciado tras winget).
  if (isRunnableFfmpeg('ffmpeg') || isRunnableFfmpeg('ffmpeg.exe')) {
    return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  }
  return null;
}

function transcode(ffmpegBin, input, output) {
  // Máx. 1080p sin upscale: respeta iw/ih si el master es más pequeño.
  const args = [
    '-y',
    '-i',
    input,
    '-vf',
    "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '23',
    '-maxrate',
    '8M',
    '-bufsize',
    '16M',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p',
    output,
  ];
  console.log(`[compress-videos] ffmpeg → ${output}`);
  const result = spawnSync(ffmpegBin, args, { stdio: 'inherit', windowsHide: true, shell: false });
  if (result.status !== 0) {
    throw new Error(`ffmpeg falló para ${input} (exit ${result.status})`);
  }
}

const targets = listAttractionVideosFromManifest(root);
if (targets.length === 0) {
  console.warn('[compress-videos] el manifiesto no declara attractionVideos; nada que hacer');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

const ffmpegBin = findFfmpeg();
if (!ffmpegBin) {
  console.error(
    '[compress-videos] no se encontró ffmpeg. Instálalo (p. ej. winget install Gyan.FFmpeg), cierra y abre la terminal, o define FFMPEG_BIN con la ruta a ffmpeg.exe.',
  );
  console.error(
    '[compress-videos] Alternativa: coloca los MP4 del manifiesto ya listos en resources/videos/ y usa npm run copy:videos.',
  );
  process.exit(1);
}

console.log(`[compress-videos] usando ${ffmpegBin}`);

if (!existsSync(sourceDir)) {
  console.error(`[compress-videos] No existe el directorio fuente: ${sourceDir}`);
  process.exit(1);
}

console.log(`[compress-videos] fuente=${sourceDir}`);
console.log(`[compress-videos] destino=${destDir}`);
console.log(`[compress-videos] clips del manifiesto: ${targets.map((t) => t.fileName).join(', ')}`);

let failed = 0;
for (const { fileName, source } of targets) {
  const src = join(sourceDir, fileName);
  if (!existsSync(src)) {
    console.warn(
      `[compress-videos] falta fuente para ${fileName} (manifiesto: ${source}) en ${sourceDir}`,
    );
    failed += 1;
    continue;
  }

  const out = join(destDir, fileName);
  try {
    transcode(ffmpegBin, src, out);
    const outSize = statSync(out).size;
    console.log(`[compress-videos] ok ${fileName} ${(outSize / 1024 / 1024).toFixed(1)} MB`);
    if (outSize > WARN_BYTES) {
      console.warn(
        `[compress-videos] aviso: ${fileName} supera ${(WARN_BYTES / 1024 / 1024).toFixed(0)} MB (${(outSize / 1024 / 1024).toFixed(1)} MB)`,
      );
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    failed += 1;
  }
}

if (failed) {
  process.exit(1);
}
console.log('[compress-videos] listo');
