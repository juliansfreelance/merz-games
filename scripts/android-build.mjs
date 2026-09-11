/**
 * Build APK Android con fallback Windows (sin Developer Mode / sin symlink).
 *
 * 1) copy:videos + ng build
 * 2) precompila cada ABI con `tauri android build` (falla en symlink; deja el .so)
 * 3) hardlink/copia .so → jniLibs
 * 4) gradlew :app:assembleUniversalRelease (BuildTask reutiliza libs existentes)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'src-tauri', 'gen', 'android');
const jniRoot = path.join(androidDir, 'app', 'src', 'main', 'jniLibs');
const targetDir = path.join(root, 'src-tauri', 'target');

/** ABIs de entrega kiosco (arm64 + armv7). */
const TARGETS = [
  { cli: 'aarch64', triple: 'aarch64-linux-android', abi: 'arm64-v8a' },
  { cli: 'armv7', triple: 'armv7-linux-androideabi', abi: 'armeabi-v7a' },
];

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
    ...opts,
  });
  return result.status ?? 1;
}

function linkOrCopy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (fs.existsSync(dst)) fs.unlinkSync(dst);
  try {
    fs.linkSync(src, dst);
    console.log(`[android-build] hardlink ${path.basename(src)} → ${dst}`);
  } catch {
    fs.copyFileSync(src, dst);
    console.log(`[android-build] copy ${path.basename(src)} → ${dst}`);
  }
}

function stageNativeLibs(profile = 'release') {
  let linked = 0;
  for (const { triple, abi } of TARGETS) {
    const src = path.join(targetDir, triple, profile, 'libmerz_games.so');
    if (!fs.existsSync(src)) {
      console.warn(`[android-build] falta ${src}`);
      continue;
    }
    linkOrCopy(src, path.join(jniRoot, abi, 'libmerz_games.so'));
    linked += 1;
  }
  return linked;
}

function prebuildTargets() {
  for (const { cli, triple } of TARGETS) {
    const so = path.join(targetDir, triple, 'release', 'libmerz_games.so');
    if (fs.existsSync(so)) {
      console.log(`[android-build] ya compilado: ${cli}`);
      continue;
    }
    console.log(`[android-build] precompilando ${cli} (el fallo de symlink es esperado)…`);
    run('npx', ['tauri', 'android', 'build', '--apk', '--ci', '--target', cli]);
  }
}

function findApks() {
  const out = path.join(androidDir, 'app', 'build', 'outputs', 'apk');
  if (!fs.existsSync(out)) return [];
  const found = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.apk') && !name.endsWith('-unsigned.apk')) found.push(p);
    }
  };
  walk(out);
  return found;
}

function main() {
  if (!fs.existsSync(androidDir)) {
    console.error('[android-build] Falta src-tauri/gen/android. Ejecuta: npm run tauri:android:init');
    process.exit(1);
  }

  if (run('npm', ['run', 'copy:videos']) !== 0) process.exit(1);
  if (run('npm', ['run', 'build']) !== 0) process.exit(1);

  prebuildTargets();
  const staged = stageNativeLibs('release');
  if (staged < TARGETS.length) {
    console.error(
      `[android-build] Se esperaban ${TARGETS.length} libs nativas y hay ${staged}. Revisa NDK/ANDROID_HOME.`,
    );
    process.exit(1);
  }

  // Limitar ABIs a las que preparamos (evita i686/x86_64).
  const gradleProps = `-PabiList=arm64-v8a,armeabi-v7a -ParchList=arm64,arm -PtargetList=aarch64,armv7`;
  const gradle = path.join(androidDir, 'gradlew.bat');
  const gradleStatus = run(
    gradle,
    [':app:assembleUniversalRelease', '--no-daemon', ...gradleProps.split(' ')],
    { cwd: androidDir },
  );

  if (gradleStatus !== 0) {
    process.exit(gradleStatus);
  }

  const apks = findApks();
  if (apks.length === 0) {
    console.error('[android-build] No se encontró ningún APK en app/build/outputs/apk');
    process.exit(1);
  }
  console.log('[android-build] APK generado:');
  for (const apk of apks) console.log(`  ${apk}`);
}

main();
