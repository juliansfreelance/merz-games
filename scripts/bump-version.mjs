#!/usr/bin/env node
/**
 * Alinea la versión de la app en package.json, src-tauri/tauri.conf.json,
 * src-tauri/Cargo.toml, el fallback de Pages (`app-version.ts`) y el README.
 *
 * Uso:
 *   node scripts/bump-version.mjs 0.1.1
 *   node scripts/bump-version.mjs --patch
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = process.argv[2];

if (!arg) {
  console.error('Uso: node scripts/bump-version.mjs <semver| --patch | --minor | --major>');
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function bumpSemver(current, kind) {
  const [major, minor, patch] = current.split('.').map(Number);
  if ([major, minor, patch].some((n) => Number.isNaN(n))) {
    throw new Error(`Versión inválida: ${current}`);
  }
  if (kind === '--major') return `${major + 1}.0.0`;
  if (kind === '--minor') return `${major}.${minor + 1}.0`;
  if (kind === '--patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Flag desconocido: ${kind}`);
}

const packagePath = join(root, 'package.json');
const tauriPath = join(root, 'src-tauri', 'tauri.conf.json');
const cargoPath = join(root, 'src-tauri', 'Cargo.toml');
const appVersionPath = join(root, 'src', 'app', 'core', 'platform', 'app-version.ts');
const readmePath = join(root, 'README.md');

const pkg = readJson(packagePath);
const current = pkg.version;
const next = arg.startsWith('--') ? bumpSemver(current, arg) : arg;

if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`Semver inválido: ${next}`);
  process.exit(1);
}

pkg.version = next;
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const tauri = readJson(tauriPath);
tauri.version = next;
writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);

let cargo = readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${next}"`);
writeFileSync(cargoPath, cargo);

writeFileSync(
  appVersionPath,
  `/** Versión de la app. La mantiene \`scripts/bump-version.mjs\` alineada con package.json. */\nexport const APP_VERSION = '${next}';\n`,
);

let readme = readFileSync(readmePath, 'utf8');
readme = readme.replace(/\*\*App\*\* \| `[^`]+`/, `**App** | \`${next}\``);
writeFileSync(readmePath, readme);

console.log(`[bump-version] ${current} → ${next}`);
