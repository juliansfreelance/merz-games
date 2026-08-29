/**
 * Estados del proceso de actualización del catálogo/app.
 * Fase 3: solo contrato de tipos + valor inicial `idle`.
 * El servicio real de descarga es Fase 6.
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

/** Snapshot mínimo del estado de actualización. */
export interface UpdateSnapshot {
  readonly status: UpdateStatus;
  /** Versión de la app actualmente en ejecución. */
  readonly appVersion: string;
  /** Versión del catálogo actualmente activo. */
  readonly catalogVersion: string;
  /** Mensaje de error descriptivo, si `status === 'error'`. */
  readonly errorMessage?: string;
}
