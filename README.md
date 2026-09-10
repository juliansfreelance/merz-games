# Merz Games

Kiosco interactivo táctil para consultorios (**9:16** / diseño base **1080×1920**, pantallas 55"). Offline-first: jugar y operar no dependen de red. Internet solo cuando el personal busca actualizaciones en el panel.

| | |
| --- | --- |
| **App** | `0.1.0` — Angular 22 + Tauri 2 (Windows) |
| **Catálogo** | `0.6.0` — Radiesse, Ultherapy; Belotero (`develop`); motores Memoria y Triqui |
| **Estado** | Fases 1–9: producto jugable, kiosco nativo, protector, panel, instaladores y canales de update listos |

---

## Stack

- Angular 22 (standalone, signals, lazy routes)
- TypeScript `~6.0.2`, Tailwind CSS v4 (`kiosk` / `kiosk-tall`)
- Tauri 2 (`@tauri-apps/api`, `@tauri-apps/plugin-updater`)
- Vitest + Prettier (`npm run format:check`; ESLint queda como follow-up)
- Montserrat local; Heroicons outline vía `HeroIcon` (sin CDN)

---

## Requisitos

1. **Rust** — [rustup.rs](https://rustup.rs/)
2. **C++ Build Tools** (VS, «Desarrollo para escritorio con C++»)
3. **WebView2** (Windows 10/11)
4. Node con `packageManager: npm@12.0.2`

Videos de atracción: masters en `resources/videos/` (gitignored). Comprimir con `npm run videos:compress` (ffmpeg); antes del build: `npm run copy:videos`. Pack CI: Release `content-videos` (3 MP4 ligeros).

---

## Comandos

```bash
npm start              # http://localhost:4200/
npm test               # Vitest
npm run build          # dist/merz-games/browser
npm run format:check   # Prettier (ámbitos de release)
npm run videos:compress # masters → public/content/videos/ (ffmpeg)
npm run copy:videos    # MP4 → public/content/videos/
npm run bump:version -- 0.1.1   # package.json + tauri.conf + Cargo.toml
npm run tauri:dev      # ventana 1080×1920 + ng serve
npm run tauri:build    # copy:videos + MSI/NSIS + firmas updater
```

`tauri.conf.json` deja `fullscreen: false`. En nativo, al boot `App` llama `enter_kiosk` (fullscreen + sin decoraciones). En `ng serve` / `tauri:dev` el comportamiento de desarrollo no cambia.

**Entrega a consultorio:** preferir el instalador **NSIS** (`*-setup.exe`) — es el que usa el updater (`updaterJsonPreferNsis: true`). El **MSI** queda para IT / despliegue corporativo.

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

Clips del catálogo (`app.protector.attractionVideos` + por marca). Si falta el MP4 → respaldo clásico. Toque → `/welcome`.

---

## Panel de administración

Long-press ~2 s del badge de versión (esquina inferior derecha) → `/admin/login`.

- **PIN clínica:** `2580` (SHA-256, tiempo constante). Cambiable en Seguridad.
- **Superadmin `210726`:** contenido `develop: true` y `developMode` en Diagnóstico. No va en la cara del paciente.
- **Belotero** y demás `develop` solo se listan con `app.developMode` ON.

| Sección | |
| --- | --- |
| Operación | Reiniciar, cerrar, entrar/salir kiosco (`enter_kiosk` / `leave_kiosk`) |
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
| **Contenido** | `content-manifest.json` | `https://raw.githubusercontent.com/juliansfreelance/merz-games/master/content/manifests/content-manifest.json` |

- Contenido: `fetch` → `compareCatalogs` → confirmación → `loadManifest`. JSON inválido o `minAppVersion` alto → se conserva el catálogo local. `pendingAssets` se **listan** (escritura a disco = Fase 10).
- App: pubkey minisign real en `tauri.conf.json`; firma con secretos de CI. Sin Release / sin red → error u `offline` honestos.
- Orden apply: contenido primero, binario después (puede reiniciar).

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
npm run bump:version -- 0.1.1   # o --patch
git tag v0.1.1
git push origin v0.1.1          # dispara .github/workflows/release.yml
```

También `workflow_dispatch` en Actions. El job Windows: test → copy videos → `tauri-action` → Release con MSI, NSIS, `.sig` y `latest.json`.

Videos en CI: Release auxiliar opcional `content-videos`, o masters en el runner vía `CONTENT_VIDEOS_DIR` / `resources/videos/`.

Manual corto: [`resources/docs/manual-instalacion-y-panel.md`](resources/docs/manual-instalacion-y-panel.md) (carpeta `resources/` local / gitignored en este repo; copia operativa junto al instalador).

---

## Layout

- Kiosco vertical 9:16; landscape 16:9 con cromado de juego en dos columnas.
- Variantes `kiosk` / `kiosk-tall`. Letterboxing si el viewport no es 9:16.
- Táctil: Pointer Events, sin hover crítico.

---

## Estructura

```text
src/app/core/
  platform/     restart, exit, enterKiosk, leaveKiosk
  catalog/      loadManifest, compareCatalogs
  update/       content-update, app-update, coordinador
  kiosk/        IdleWatchdog, screensaver playlist
  games/        memory/, triqui/
  …
src/app/features/
  splash/, welcome/, brands/, experiences/, play/
  admin/, screensaver/, shared/ (CoverFlow, CatalogCard, …)
content/manifests/content-manifest.json
public/content/          imágenes, audio (videos gitignored)
scripts/copy-videos.mjs  scripts/bump-version.mjs
.github/workflows/       test.yml, release.yml
src-tauri/               Tauri 2 + pubkey updater
releases/README.md       formato latest.json
```

Persistencia local: `merz-games.catalog-manifest`, `merz-games.kiosk-settings`, `merz-games.admin-pin-hash`.

---

## Fuera de alcance (Fase 10+)

Escritura de packs a `%LOCALAPPDATA%/merz-games/content/`, inventario de premios, stats, PII, Store de Windows.
