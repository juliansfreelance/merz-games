# Merz Games

Kiosco interactivo táctil para consultorios. La misma aplicación corre en todas las pantallas; el contenido (marcas, juegos y experiencias) vive en un catálogo versionado, no en ramas hardcodeadas del frontend.

- **App** `0.1.0` — Angular 22 + Tauri 2 (Windows)
- **Catálogo** `0.6.0` — marcas Radiesse y Ultherapy; motores Memoria (`0.5.0`) y Triqui (`0.6.0`)
- **Estado** — navegable de punta a punta, ambos juegos reales. Pendiente: panel administrativo, flujo de actualizaciones y kiosco de producción (fullscreen, protector a los 3 min)

---

## Qué es

Pantallas de **55"** en orientación vertical (**9:16**, diseño base **1080×1920px**). Offline-first: jugar y operar el kiosco no dependen de red. Internet solo entra cuando un administrador busca actualizaciones.

Tres conceptos del catálogo:

| Concepto | Qué es | Semilla actual |
| --- | --- | --- |
| **Marca** | Identidad, atmósfera, disclaimer | Radiesse, Ultherapy |
| **Motor** | Reglas reutilizables | Memoria (parejas), Triqui (humano vs IA) |
| **Experiencia** | Combinación versionada marca + motor | Cartas / marcas X-O por marca |

`GameHost` resuelve `experienceId` → `gameId` → componente. Los motores en `src/app/core/games/<id>/` son TypeScript puro: no conocen Angular, rutas ni Tauri.

---

## Stack

- Angular 22 (standalone, signals, lazy routes)
- TypeScript `~6.0.2`
- Tailwind CSS v4 (variantes `kiosk` / `kiosk-tall`)
- Tauri 2 (`@tauri-apps/api` / CLI `^2.0.0`)
- Vitest (`npm test`)
- Tipografía Montserrat local; iconos **Heroicons** outline vía `HeroIcon` (sin CDN)

---

## Requisitos previos

Toolchain de Rust para el escritorio Tauri:

1. **Rust** — [rustup.rs](https://rustup.rs/)
2. **C++ Build Tools** — Visual Studio, carga «Desarrollo para el escritorio con C++»
3. **WebView2** — incluido en Windows 10/11

Node: el repo declara `packageManager: npm@12.0.2`.

---

## Comandos

```bash
npm start          # frontend en http://localhost:4200/
npm test           # Vitest
npm run build      # dist/merz-games/browser
npm run tauri:dev  # ventana Tauri 1080×1920 + ng serve
npm run tauri:build
```

`tauri:build` genera instaladores Windows (`.msi` / NSIS). El empaquetado de kiosco en fullscreen aún no está activo (`fullscreen: false` en Tauri).

---

## Navegación

```text
/                              Splash (precarga + atmósfera)
/welcome                       Bienvenida
/brands                        Selector de marcas
/brands/:brandId/games         Experiencias de la marca
/play/:experienceId            GameHost + cromado + motor real
                               + overlay de tutorial y de resultado
/result/:experienceId/:result  redirect → /play/:experienceId
/**                            UnavailableScreen
```

Flujo: splash → bienvenida → marcas → experiencias → partida. El resultado es overlay glass sobre `/play` (victoria con confetti; en Triqui también empate). Tres vidas por sesión; en Triqui «Siguiente ronda» conserva las vidas.

Aún no hay: panel de administración, flujo real de actualización ni protector de inactividad (3 min). Ajustes como `soundEnabled`, `memoryPairs`, `triquiDifficulty` y `triquiFirstPlayer` existen como API; no tienen UI todavía.

---

## Layout

- Optimizado para kiosco vertical 9:16 (1080×1920). En landscape 16:9 el cromado de juego usa dos columnas.
- Layout fluido; variantes Tailwind `kiosk` (`min-height: 1100px`) y `kiosk-tall` (`min-height: 1500px`).
- Si el viewport no es 9:16, el contenedor se centra con letterboxing.
- Interacción táctil: Pointer Events, sin hover crítico, `touch-action` para evitar zoom/pan en la pantalla física.

---

## Actualizaciones (arquitectura objetivo)

Dos canales independientes. **No** hay `git pull` en runtime ni tokens de escritura:

```text
Aplicación   →  Tauri Updater (GitHub Releases)
Contenido    →  Content Update Manager (manifest + assets)
```

Hoy el plugin updater está en `src-tauri/tauri.conf.json` con placeholders; no hay UI ni endpoints reales. El catálogo arranca desde la semilla local [`content/manifests/content-manifest.json`](content/manifests/content-manifest.json) y se persiste en `localStorage` (`merz-games.catalog-manifest`).

Cuando el Content Update Manager exista, el contenido dinámico irá a:

```text
%LOCALAPPDATA%/merz-games/content/
```

---

## Estructura del repositorio

```text
src/app/core/
  platform/     frontera Angular / Tauri
  catalog/      modelos + CatalogService (semilla + persistencia)
  games/        memory/ y triqui/ — motores puros
  session/      vidas, overlay de resultado, nextRound
  settings/     kiosk settings (API)
  media/        BGM + SFX de juego y de UI
  lifecycle/    splash obligatorio
  logging/      AppLogger + AppErrorHandler

src/app/features/
  splash/, welcome/, brands/, experiences/
  play/         GameHost, MemoryPlay, TriquiPlay, tutoriales
  result/       overlay de resultado
  shared/       cromado, cards, botones, HeroIcon, UiSfx

content/manifests/content-manifest.json
public/content/   imágenes, BGM y SFX de la semilla
src-tauri/        Tauri 2 (Windows)
```
