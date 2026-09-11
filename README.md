# Merz Games

Kiosco interactivo táctil para consultorios (**9:16** / diseño base **1080×1920**, pantallas 55"). Offline-first: jugar y operar no dependen de red. Internet solo cuando el personal busca actualizaciones en el panel.

| | |
| --- | --- |
| **App** | `1.0.0` — Angular 22 + Tauri 2 (Windows + Android APK) |
| **Catálogo** | `0.6.0` — Radiesse, Ultherapy; Belotero (`develop`); motores Memoria y Triqui |
| **Estado** | Fases **1–11** cerradas (Windows + APK Android sideload, API 24+). CI Android / Play Store pendientes. |

---

## Stack

- Angular 22 (standalone, signals, lazy routes)
- TypeScript `~6.0.2`, Tailwind CSS v4 (`kiosk` / `kiosk-tall`)
- Tauri 2 (`@tauri-apps/api`, `@tauri-apps/plugin-fs` acotado a AppLocalData; `@tauri-apps/plugin-updater` **solo desktop**)
- Vitest + Prettier (`npm run format:check`; ESLint queda como follow-up)
- Montserrat local; Heroicons outline vía `HeroIcon` (sin CDN)

---

## Requisitos

1. **Rust** — [rustup.rs](https://rustup.rs/)
2. **C++ Build Tools** (VS, «Desarrollo para escritorio con C++»)
3. **WebView2** (Windows 10/11)
4. Node con `packageManager: npm@12.0.2`
5. **Android (APK):** Android Studio + SDK/NDK, `ANDROID_HOME` / `NDK_HOME`, targets `rustup` (`aarch64-linux-android`, `armv7-linux-androideabi`, …). Mínimo dispositivo: **Android 7.0 / API 24** (cubre 7.1.2).

Videos de atracción: masters en `resources/videos/` (mismo basename que `source` en el manifiesto). Comprimir con `npm run videos:compress` (ffmpeg, máx. 1080p); antes del build: `npm run copy:videos`. Pack CI: Release `content-videos`.

---

## Comandos

```bash
npm start              # http://localhost:4200/
npm test               # Vitest
npm run build          # dist/merz-games/browser
npm run format:check   # Prettier (ámbitos de release)
npm run videos:compress # masters → public/content/videos/ (ffmpeg)
npm run copy:videos    # MP4 → public/content/videos/
npm run bump:version -- 1.0.0   # package.json + tauri.conf + Cargo.toml
npm run tauri:dev      # ventana 1080×1920 + ng serve
npm run tauri:build    # copy:videos + MSI/NSIS + firmas updater
npm run tauri:android:dev    # emulador / device
npm run tauri:android:build  # copy:videos + APK release (minSdk 24; fallback Windows)
```

`tauri.conf.json` deja `fullscreen: false`. En desktop nativo, al boot `App` llama `enter_kiosk`. En Android esos comandos son no-op (`sensorPortrait`). En `ng serve` / `tauri:dev` el comportamiento de desarrollo no cambia.

**Entrega a consultorio (Windows):** preferir el instalador **NSIS** (`*-setup.exe`) — es el que usa el updater (`updaterJsonPreferNsis: true`). El **MSI** queda para IT / despliegue corporativo.

**Entrega Android:** APK sideload (`npm run tauri:android:build` → `app-universal-release.apk`, arm64 + armv7). Mínimo **Android 7.0 / API 24**. El updater binario (`latest.json`) es **solo Windows**; en Android se reinstala el APK. Packs OTA de contenido sí aplican en nativo. Notch: safe area en `.app-shell`. Audio se silencia al ir a segundo plano.

---

## Navegación

```text
/                              Splash
/welcome                       Bienvenida
/brands                        Cover Flow de marcas
/brands/:brandId/games         Cover Flow de experiencias
/play/:experienceId            GameHost + overlay resultado
/admin/login                   PIN del panel
/admin                         Panel
```

Paciente: splash → welcome → marcas → experiencias → partida. Vidas mínimas 3. Resultado = overlay glass (victoria con confetti; Triqui también empate).

**Cover Flow:** carrusel 3D táctil (`CoverFlow`). Config en `app.cover` del manifest.

---

## Protector de pantalla

Tras inactividad configurable (`screensaverIdleMs`, default **3 min**, 30 s–15 min). Overlay (no ruta). Pausado en splash y `/admin*`.

| Modo | Comportamiento |
| --- | --- |
| **classic** | Logos Merz + marcas; sin `<video>` |
| **video** | Clásico ≥ 20 s → clip → clásico ≥ 20 s → siguiente; orden `sequential` \| `random`; `videoVolume` |

Clips del catálogo (`app.protector.attractionVideos` + por marca). Si falta el MP4 → respaldo clásico. Toque → `/welcome`. En segundo plano el clip se pausa (`setBackgroundSuspended`).

---

## Panel de administración

Long-press ~2 s del badge de versión (esquina inferior derecha) → `/admin/login`.

- **PIN clínica:** `2580` (SHA-256, tiempo constante). Cambiable en Seguridad.
- **Superadmin `210726`:** contenido `develop: true` y `developMode` en Diagnóstico. No va en la cara del paciente.
- **Belotero** y demás `develop` solo se listan con `app.developMode` ON.

| Sección | |
| --- | --- |
| Operación | Reiniciar, cerrar; entrar/salir kiosco **solo Windows/web** (`enter_kiosk` / `leave_kiosk` ocultos en Android) |
| Ajustes | Audio, protector, catálogo, Memoria, Triqui, overrides, fábrica |
| Diagnóstico | Versiones, entorno, `developMode` |
| Actualizaciones | Único sitio que dispara check/apply |
| Seguridad | Cambiar PIN |

---

## Actualizaciones (dos canales)

Sin `git pull`, sin tokens write en el cliente. Check **solo** desde el panel.

| Canal | Qué | URL canónica |
| --- | --- | --- |
| **App** | Ejecutable firmado (Tauri Updater) | `https://github.com/juliansfreelance/merz-games/releases/latest/download/latest.json` |
| **Contenido** | `content-manifest.json` + archivos | JSON: `…/master/content/manifests/content-manifest.json` |

- Contenido: `fetch` → `compareCatalogs` → confirmación → **pack OTA** (`pendingAssets` a AppLocalData de `com.merzgames.app`) → `loadManifest`. JSON inválido o `minAppVersion` alto → se conserva el catálogo local y **no** se instala el pack. En navegador el JSON sí; el pack no. Hashes opcionales en `content-index.json` (404 = verificar tipo/tamaño).
- Origen de archivos: imágenes/audio → raw `master`/`public/`; MP4 → Release `content-videos` (no están en git).
- Runtime: `assetUrl` usa **pack > bundle**. Tras el apply, jugar y el protector siguen **offline**.
- App (Windows): pubkey minisign real en `tauri.conf.json`; firma con secretos de CI. Sin Release / sin red → error u `offline` honestos. En Android: `skipped` (reinstalar APK).
- Orden apply: pack a disco → JSON → binario (puede reiniciar; el binario no aplica en Android). Restaurar fábrica: semilla + vaciar packs OTA (el bundle se conserva).

### Secretos de GitHub (Release)

| Secret | Contenido |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Contenido del `.key` (nunca el archivo en el repo) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password del key (vacío si se generó sin password) |
| `GITHUB_TOKEN` | Lo inyecta Actions (`contents: write`) |

Generar par (local, fuera de git):

```bash
npm run tauri signer generate -- -w .tauri/merz-games.key --ci
```

La **pubkey** ya está en `plugins.updater.pubkey`. La privada vive en `.tauri/` (gitignored) y en el secret de Actions.

Firma Authenticode de Windows: **opcional**. Sin certificado de agencia, SmartScreen puede avisar — riesgo conocido.

### Release

```bash
npm run bump:version -- 1.0.0   # o --patch
git tag v1.0.0
git push origin v1.0.0          # dispara .github/workflows/release.yml (Windows MSI/NSIS)
```

También `workflow_dispatch` en Actions. El job Windows: test → copy videos → `tauri-action` → Release con MSI, NSIS, `.sig` y `latest.json`.

Videos en CI: Release auxiliar opcional `content-videos`, o masters en el runner vía `CONTENT_VIDEOS_DIR` / `resources/videos/`.

Operativa Windows: [`resources/docs/Manual de despliegue.md`](resources/docs/Manual%20de%20despliegue.md). Android: [`manual-instalacion-y-panel-android.md`](resources/docs/manual-instalacion-y-panel-android.md). Walkthroughs: [`Fase 10` packs](resources/docs/walkthrough/Fase%2010%20—%20Walkthrough%20plataforma%20y%20packs%20OTA.md), [`Fase 11` APK](resources/docs/walkthrough/Fase%2011%20—%20Walkthrough%20APK%20Android.md).

---

## Layout

- Kiosco vertical 9:16; landscape 16:9 con cromado de juego en dos columnas.
- Android: `sensorPortrait` + safe area (`.app-shell--android`).
- Variantes `kiosk` / `kiosk-tall`. Letterboxing si el viewport no es 9:16.
- Táctil: Pointer Events, sin hover crítico.

---

## Estructura

```text
src/app/core/
  platform/     isNative, isAndroid, supportsBinaryUpdater, content-fs, assetUrl
  catalog/      loadManifest, compareCatalogs
  update/       content-update, content-pack, app-update, coordinador
  kiosk/        IdleWatchdog, screensaver playlist
  games/        memory/, triqui/
  …
src/app/features/
  splash/, welcome/, brands/, experiences/, play/
  admin/, screensaver/, shared/ (CoverFlow, CatalogCard, …)
content/manifests/      content-manifest.json (+ content-index.json opcional)
public/content/          imágenes, audio (videos gitignored)
scripts/copy-videos.mjs  scripts/bump-version.mjs  scripts/android-build.mjs
.github/workflows/       test.yml, release.yml, pages.yml
src-tauri/               Tauri 2 + pubkey updater (desktop) + plugin-fs
src-tauri/capabilities/    default.json (fs) + desktop-updater.json
src-tauri/gen/android/   proyecto APK (minSdk 24; no commitear app/build)
releases/README.md       formato latest.json
```

Persistencia local: `merz-games.catalog-manifest`, `merz-games.kiosk-settings`, `merz-games.admin-pin-hash`. Packs OTA (Tauri nativo): AppLocalData de `com.merzgames.app` (`content/`).

---

## Fuera de alcance

Inventario de premios, stats, PII, Store de Windows, Play Store, iOS, CI de APK, Authenticode, motores nuevos (Ruleta, Quiz, …: `UnavailableScreen` si el `gameId` no está registrado).
