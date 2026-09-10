# Artefactos del updater (canal app)

El endpoint canónico del plugin Tauri es el `latest.json` que genera
[`tauri-action`](https://github.com/tauri-apps/tauri-action) en cada GitHub Release:

```text
https://github.com/juliansfreelance/merz-games/releases/latest/download/latest.json
```

Configurado en `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`.

## Formato esperado (referencia)

```json
{
  "version": "0.1.1",
  "notes": "…",
  "pub_date": "2026-01-01T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<contenido del .sig>",
      "url": "https://github.com/juliansfreelance/merz-games/releases/download/v0.1.1/Merz.Games_0.1.1_x64-setup.exe"
    }
  }
}
```

No versionar aquí un `updater.json` con firmas de producción: las firmas
cambian en cada build. El workflow `.github/workflows/release.yml` sube
`latest.json` al Release.

Canal de **contenido** (JSON): ver `CONTENT_MANIFEST_URL` en
`src/app/core/update/update.constants.ts` (raw de la rama `master`).
