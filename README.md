# Merz Games

Aplicación de kiosco interactivo táctil para consultorios, desarrollada en **Angular 22** y empaquetada con **Tauri 2**.

---

## Requisitos Previos

Para ejecutar la aplicación de escritorio y compilar con Tauri, debes tener configurado el toolchain de Rust en tu sistema:
1. **Rust**: Instalar mediante [rustup.rs](https://rustup.rs/).
2. **C++ Build Tools**: Requerido por el compilador de Rust en Windows (se instala a través del instalador de Visual Studio con la carga de trabajo "Desarrollo para el escritorio con C++").
3. **WebView2**: Runtime instalado por defecto en Windows 10/11. En versiones anteriores, se puede descargar del sitio oficial de Microsoft.

---

## Comandos de Desarrollo

El proyecto cuenta con scripts npm unificados en [package.json](file:///e:/Ula/merz-games/package.json) para el flujo de trabajo:

### Desarrollo Frontend (Navegador)
Inicia un servidor de desarrollo Angular local en `http://localhost:4200/`:
```bash
npm start
```

### Pruebas Unitarias (Vitest)
Ejecuta la suite de pruebas unitarias implementadas con Vitest:
```bash
npm test
```

### Compilación Frontend
Compila el frontend de Angular para producción en la ruta `dist/merz-games/browser`:
```bash
npm run build
```

### Ejecución de Escritorio en Desarrollo (Tauri)
Inicia la aplicación de escritorio nativa en modo desarrollo (abre la ventana de Tauri vinculada a `ng serve`):
```bash
npm run tauri:dev
```

### Compilación de Escritorio (Tauri)
Genera el empaquetado final (`.msi`, `.exe`) para producción en Windows:
```bash
npm run tauri:build
```

---

## Especificaciones del Layout

* **Orientación y Proporción**: Optimizado para pantallas de **55"** montadas en vertical con una relación de aspecto **9:16** y diseño base de **1080×1920px**.
* **Responsividad Adaptable**: El diseño es responsivo y fluido. No se utilizan dimensiones fijas absolutas en el layout principal. 
* **Safe Areas / Letterboxing**: Si el viewport difiere de la relación de aspecto 9:16 (ej. en desarrollo en navegadores horizontales o durante pruebas en ventanas Tauri con formato horizontal 4:3), el contenedor de la aplicación se centrará automáticamente preservando la proporción 9:16 mediante franjas oscuras neutras en los bordes.
* **Interacción Táctil**: Control estricto de overflow y comportamiento de toques mediante `touch-action` y `PointerEvents` para evitar comportamientos de zoom/pan no deseados en la pantalla física del kiosco.

---

## Arquitectura de Actualizaciones

El proyecto maneja dos canales de actualización completamente independientes que operan **sin usar comandos `git pull` en runtime ni tokens con permisos de escritura**:

```text
Actualización de aplicación   →  Tauri Updater (GitHub Releases)
Actualización de contenido    →  Content Update Manager (Manifest de catálogo + Assets descargables)
```

1. **Actualización del Ejecutable (App)**: Utiliza el plugin oficial Tauri Updater. Cuando se libera una versión de la app, Tauri descarga el binario desde GitHub Releases y actualiza la aplicación local.
2. **Actualización de Contenido**: El frontend de la aplicación descarga y parsea el manifiesto del catálogo de contenidos `content-manifest.json` y descarga únicamente los assets (imágenes, sonidos y motores) nuevos o modificados de las experiencias de marca.

### Ubicación del Contenido en Windows (Runtime)
Para cumplir con las políticas de permisos de Windows (evitando la necesidad de privilegios de Administrador para actualizaciones de catálogo), todo el contenido descargado dinámicamente a través del Content Update Manager se almacenará en la carpeta local de datos de la aplicación:

```text
%LOCALAPPDATA%/merz-games/content/
(Ruta habitual: C:\Users\<Usuario>\AppData\Local\merz-games\content)
```

---

## Estructura del Repositorio (Fase 1)

* `src/app/core/platform/`: Servicio `PlatformService` que abstrae el runtime (Navegador vs Escritorio Tauri).
* `src/app/core/catalog/`: Modelos TypeScript del contrato del manifiesto de contenidos.
* `content/manifests/content-manifest.json`: Semilla del manifiesto con la definición inicial de marcas (`radiesse`, `ultherapy`), motores de juego (`memory`, `triqui`) y sus experiencias vinculadas.
* `src-tauri/`: Código nativo de Tauri 2 para Windows.
