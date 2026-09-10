#!/usr/bin/env node
/**
 * Prepara dist/merz-games/browser para GitHub Pages:
 * - 404.html (fallback SPA)
 * - .nojekyll
 * - fuentes en CSS relativas al bundle (honran /merz-games/)
 */
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist', 'merz-games', 'browser');

function rebaseFonts(source) {
  return source
    .replaceAll('url(/fonts/', 'url(fonts/')
    .replaceAll("url('/fonts/", "url('fonts/")
    .replaceAll('url("/fonts/', 'url("fonts/');
}

function walkFiles(dir, ext) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full, ext));
    else if (entry.name.endsWith(ext)) files.push(full);
  }
  return files;
}

writeFileSync(join(dist, '.nojekyll'), '');

let touched = 0;
for (const file of [...walkFiles(dist, '.css'), ...walkFiles(dist, '.html')]) {
  const original = readFileSync(file, 'utf8');
  const next = rebaseFonts(original);
  if (next !== original) {
    writeFileSync(file, next);
    touched++;
  }
}

copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));

console.log(`Pages dist listo (${touched} archivos con fuentes rebased).`);
