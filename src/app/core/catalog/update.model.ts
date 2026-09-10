import { CatalogDiff } from './compare-catalogs';

/**
 * Estados del proceso de actualización del catálogo/app.
 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'completed'
  | 'error'
  | 'offline';

/** Progreso de descarga de packs OTA. */
export interface UpdateDownloadProgress {
  readonly completed: number;
  readonly total: number;
  readonly currentPath?: string;
}

/** Snapshot del estado de actualización. */
export interface UpdateSnapshot {
  readonly status: UpdateStatus;
  /** Versión de la app actualmente en ejecución. */
  readonly appVersion: string;
  /** Versión del catálogo actualmente activo. */
  readonly catalogVersion: string;
  /** Mensaje de error o aviso descriptivo. */
  readonly errorMessage?: string;
  /** Aviso no fatal (p. ej. packs OTA omitidos en navegador). */
  readonly note?: string;
  /** Diff local vs remoto, presente tras un check exitoso. */
  readonly catalogDiff?: CatalogDiff;
  /** Versión remota de la app, si el canal nativo respondió. */
  readonly remoteAppVersion?: string;
  /** Hay un binario publicado más nuevo. */
  readonly appUpdateAvailable?: boolean;
  /** Assets del remoto que no están en el catálogo local (pendientes de descarga OTA). */
  readonly pendingAssets?: readonly string[];
  /** Bytes/archivos del pack en curso. */
  readonly downloadProgress?: UpdateDownloadProgress;
  /** El JSON de contenido se aplicó en este ciclo. */
  readonly catalogApplied?: boolean;
}
