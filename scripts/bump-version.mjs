#!/usr/bin/env node
/**
 * Alinea la versión de la app en package.json, src-tauri/tauri.conf.json
 * y src-tauri/Cargo.toml.
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
  const [major, minor, patch] = current.split('.').map((n) => Number(n));
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

console.log(`[bump-version] ${current} → ${next}`);
