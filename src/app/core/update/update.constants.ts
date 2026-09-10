/**
 * Manifest de contenido publicado.
 * Rama canónica: `master` (canal estable del catálogo en consultorio).
 */
export const CONTENT_MANIFEST_URL =
  'https://raw.githubusercontent.com/juliansfreelance/merz-games/master/content/manifests/content-manifest.json';

/** Fallo al consultar o instalar el canal del ejecutable (red, firma o Release ausente). */
export const APP_UPDATE_ERROR_MESSAGE =
  'No se pudo consultar o instalar la actualización del ejecutable. Comprueba la red y que el Release esté firmado.';

/** @deprecated Usar APP_UPDATE_ERROR_MESSAGE. */
export const APP_UPDATE_PLACEHOLDER_MESSAGE = APP_UPDATE_ERROR_MESSAGE;

export const CONTENT_OFFLINE_MESSAGE =
  'Sin conexión. El kiosco sigue operando con el catálogo local.';
