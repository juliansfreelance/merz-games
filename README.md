# Merz Games

Kiosco interactivo táctil para consultorios. La misma aplicación corre en todas las pantallas; el contenido (marcas, juegos y experiencias) vive en un catálogo versionado, no en ramas hardcodeadas del frontend.

- **App** `0.1.0` — Angular 22 + Tauri 2 (Windows)
- **Catálogo** `0.6.0` — Radiesse, Ultherapy y Merz (desarrollo); motores Memoria (`0.5.0`) y Triqui (`0.6.0`)
- **Estado** — navegable de punta a punta: ambos juegos, panel administrativo y flujo de actualizaciones (manifest). Pendiente: kiosco de producción (fullscreen al arrancar, protector a los 3 min) y escritura de packs de contenido a disco

---

## Qué es

Pantallas de **55"** en orientación vertical (**9:16**, diseño base **1080×1920px**). Offline-first: jugar y operar el kiosco no dependen de red. Internet solo entra cuando un administrador busca actualizaciones.

Tres conceptos del catálogo:

| Concepto | Qué es | Semilla actual |
| --- | --- | --- |
| **Marca** | Identidad, atmósfera, disclaimer, `develop?` | Radiesse, Ultherapy, Merz (`develop`) |
| **Motor** | Reglas reutilizables | Memoria (parejas, vidas, dificultad); Triqui (humano vs IA, `develop`) |
| **Experiencia** | Combinación versionada marca + motor | Cartas / marcas X-O por marca; `merz-memory` (`develop`) |

`GameHost` resuelve `experienceId` → `gameId` → componente. Los motores en `src/app/core/games/<id>/` son TypeScript puro: no conocen Angular, rutas ni Tauri.

Un registro con `develop: true` (marca, motor o experiencia) pide el PIN de superadmin. No es un selector para el paciente.

---

## Stack

- Angular 22 (standalone, signals, lazy routes, Signal Forms)
- TypeScript `~6.0.2`
- Tailwind CSS v4 (variantes `kiosk` / `kiosk-tall`)
- Tauri 2 (`@tauri-apps/api`, `@tauri-apps/plugin-updater`, CLI `^2.0.0`)
- Vitest (`npm test`)
- Tipografía Montserrat local; iconos **Heroicons** outline vía `HeroIcon` + `heroicons.data.ts` (colección outline completa, sin CDN)

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
/brands                        Selector de marcas (Cover Flow 3D)
/brands/:brandId/games         Experiencias de la marca (Cover Flow 3D)
/play/:experienceId            GameHost + cromado + motor real
                               + overlay de tutorial y de resultado
/result/:experienceId/:result  redirect → /play/:experienceId
/admin/login                   PIN del panel (tras splash)
/admin                         Panel (sesión admin en memoria)
/**                            UnavailableScreen
```

Flujo de paciente: splash → bienvenida → marcas → experiencias → partida. El resultado es overlay glass sobre `/play` (victoria con confetti; en Triqui también empate).

**Vidas:** mínimo 3 por partida. En Memoria la cascada o el panel pueden subirlas (semilla `lives: 4`; presets fácil / medio / difícil o `custom`). En Triqui son 3 fijas; «Siguiente ronda» conserva las vidas. El HUD muestra corazones individuales si quedan 3 o menos, o `❤️ × N` si hay más.

---

## Cover Flow

`/brands` y `/brands/:brandId/games` comparten el componente reutilizable `CoverFlow` (`src/app/features/shared/cover-flow.ts`). No hay lista vertical con scroll: los cards se presentan en un carrusel horizontal 3D (perspectiva, `rotateY`, profundidad Z, brillo interpolado).

Comportamiento:

- Drag / swipe horizontal (Pointer Events: mouse y touch) con snap spring al soltar; la velocidad influye en el índice destino.
- Tap en un card lateral → lo centra (`enableClickToSnap`); tap en el card activo → acción original del `CatalogCard` (Seleccionar / Jugar).
- Teclado `ArrowLeft` / `ArrowRight`; rueda horizontal del trackpad si `enableScroll`.
- Contenedor con **mínimo `50vh`**; tamaño mínimo de card **460×520px** (no se escala por debajo; puede crecer si hay espacio).
- Sin React ni dependencias de animación externas: CSS transforms + `requestAnimationFrame`.

La configuración se lee de `app.cover` en [`content/manifests/content-manifest.json`](content/manifests/content-manifest.json) vía `CatalogService.coverConfig()` (defaults si faltan campos):

| Clave | Tipo | Default | Qué controla |
| --- | --- | --- | --- |
| `enableReflection` | boolean | `true` | Reflejo bajo el card (desactivado en puntero grueso / viewport estrecho) |
| `enableClickToSnap` | boolean | `true` | Tap en lateral centra ese card |
| `enableScroll` | boolean | `true` | Navegación con rueda / trackpad horizontal |
| `enableAudio` | boolean | `true` | Tick sintético al cambiar de card (respeta `soundEnabled` del kiosco) |
| `reduceMotion` | boolean | `false` | Sin spring / sin `rotateY` (también respeta `prefers-reduced-motion`) |
| `stackSpacing` | number | `100` | Separación entre cards apilados laterales (px base) |
| `centerGap` | number | `250` | Separación del card activo a su vecino (px base) |
| `rotation` | number | `50` | Ángulo Y de laterales (grados) |
| `initialIndex` | number | `0` | Índice inicial al abrir |
| `scrollThreshold` | number | `100` | Umbral de delta acumulado para saltar con la rueda |

Ejemplo en el manifest:

```json
"app": {
  "cover": {
    "enableReflection": false,
    "enableClickToSnap": true,
    "enableScroll": true,
    "enableAudio": true,
    "reduceMotion": false,
    "stackSpacing": 200,
    "centerGap": 400,
    "rotation": 50,
    "initialIndex": 0,
    "scrollThreshold": 100
  }
}
```

---

## Panel de administración

No hay un botón «Admin» visible para el paciente. **Mantén pulsado ~2 s el badge de versión** (`v0.1.0`, esquina inferior derecha) para ir a `/admin/login`. Un toque corto no abre nada.

- **PIN de clínica:** `2580` por defecto. SHA-256 con comparación en tiempo constante; clave `merz-games.admin-pin-hash`. Se cambia en *Seguridad / PIN*. No se pide nombre ni correo; el PIN no se registra en logs.
- Tras el splash (`appInitGuard`). Sin sesión, el guard redirige al login. Salir del panel cierra la sesión y vuelve a `/welcome`.
- **Superadmin `210726`:** modal al tocar contenido `develop: true` (marca Merz, motor Triqui, experiencia `merz-memory`). Sesión temporal aparte de la del panel.

Secciones:

| Sección | Qué hace |
| --- | --- |
| **Operación** | Reiniciar, cerrar, salir de kiosco (comandos Rust). En el navegador: deshabilitado + «Solo en la app de escritorio». Confirmación táctil, no `window.confirm`. |
| **Ajustes de juego** | Generales (audio, protector), catálogo visible, Memoria, Triqui, overrides por experiencia, restaurar de fábrica. |
| **Diagnóstico** | Versiones, marcas/motores/experiencias, entorno, resolución. Sin estadísticas ni PII. |
| **Actualizaciones** | Check y apply solo desde este CTA. |
| **Seguridad / PIN** | Cambiar el PIN de clínica. |

Ajustes locales (ese PC). El override vale en la **siguiente** partida, no a mitad de tablero.

- Protector `classic` \| `video` (el modo se guarda; el comportamiento a los 3 min aún no corre).
- Sonido: silencio global + sliders BGM/SFX (prueba de SFX al soltar).
- Switches para habilitar u ocultar marcas y experiencias.
- Memoria: parejas 2–6, vidas (mínimo 3), presets de dificultad. Ajuste manual de vidas → `custom`.
- Triqui: dificultad y primer jugador (`patient` \| `alternate` \| `random`). Vidas fijas.
- Restaurar fábrica: semilla del manifest + ajustes locales.

---

## Layout

- Optimizado para kiosco vertical 9:16 (1080×1920). En landscape 16:9 el cromado de juego usa dos columnas.
- Layout fluido; variantes Tailwind `kiosk` (`min-height: 1100px`) y `kiosk-tall` (`min-height: 1500px`).
- Si el viewport no es 9:16, el contenedor se centra con letterboxing.
- Interacción táctil: Pointer Events, sin hover crítico, `touch-action` para evitar zoom/pan en la pantalla física.
- Selectores de catálogo (Cover Flow): zona de cards con `min-h-[50vh]`; cards mínimo 460×520px.
- `/admin*` usa atmósfera técnica propia.

---

## Actualizaciones

Dos canales independientes. **No** hay `git pull` en runtime ni tokens de escritura. El check **no** se dispara al arrancar ni en el splash: solo el CTA del panel.

```text
Aplicación   →  Tauri Updater (GitHub Releases)
Contenido    →  GET del content-manifest + CatalogService.loadManifest
```

- **Contenido:** `https://raw.githubusercontent.com/juliansfreelance/merz-games/main/content/manifests/content-manifest.json`
- Hoy el flujo de contenido es **manifest only**: se aplica el JSON validado. Los assets nuevos se listan como pendientes; no se escribe `%LOCALAPPDATA%/merz-games/content/` todavía (no hay pack publicado ni `plugin-fs`).
- Si el JSON es inválido o `minAppVersion` no cuadra, `loadManifest` rechaza y se conserva el catálogo anterior.
- **App:** plugin oficial. `tauri.conf.json` sigue con pubkey/endpoint placeholder; el check nativo falla con un mensaje claro, sin inventar un repo.
- Sin red: estado `offline`. El kiosco sigue jugable.
- Orden al instalar: contenido primero, binario al final (puede reiniciar).

| Acción | `ng serve` | `tauri:dev` |
| --- | --- | --- |
| Panel / PIN / ajustes / diagnóstico | Completo | Completo |
| Reiniciar / cerrar / salir kiosco | Deshabilitado + copy | Comandos Rust |
| Check contenido | `fetch` → JSON, `offline` o `error` | Igual |
| Check app | Copy: solo escritorio | Plugin; placeholder → error honesto |
| Assets a disco | No | No (pendientes listados) |

El catálogo arranca desde la semilla local [`content/manifests/content-manifest.json`](content/manifests/content-manifest.json) y se persiste en `localStorage`. Un catálogo con **versión distinta** a la semilla no se pisa con los assets embebidos al reiniciar.

```text
merz-games.catalog-manifest   último manifest válido
merz-games.kiosk-settings     protector, sonido, volúmenes, overrides de juego
merz-games.admin-pin-hash     SHA-256 hex del PIN de clínica
```

Runtime futuro de assets:

```text
%LOCALAPPDATA%/merz-games/content/
```

---

## Estructura del repositorio

```text
src/app/core/
  platform/     frontera Angular / Tauri (restart, exit, leaveKiosk)
  catalog/      modelos, loadManifest, compareCatalogs
  update/       content-update, app-update, coordinador
  games/        memory/ y triqui/ — motores puros
  session/      vidas, overlay de resultado, nextRound
  settings/     kiosk settings (incluye experienceOverrides)
  media/        BGM + SFX de juego y de UI
  lifecycle/    splash obligatorio
  logging/      AppLogger + AppErrorHandler

src/app/features/
  splash/, welcome/, brands/, experiences/
  play/         GameHost, MemoryPlay, TriquiPlay, tutoriales
  admin/        login PIN, panel, guard, superadmin
  result/       overlay de resultado
  shared/       cromado, CatalogCard, CoverFlow, botones, HeroIcon,
                UiSfx, LivesIndicator, SuperadminPinDialog, AdminConfirm

content/manifests/content-manifest.json
public/content/   imágenes, BGM y SFX de la semilla
src-tauri/        Tauri 2 (Windows)
```
