/**
 * Motor de juego registrado en el catálogo.
 *
 * `entry`, `capabilities`, `image` y `description` son opcionales para no romper la semilla actual.
 * Las Fases 5–6 los rellenan al registrar los motores reales.
 */
export interface Game {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  enabled: boolean;
  /** Identificador del módulo/componente de entrada (p. ej. 'memory'). Opcional. */
  entry?: string;
  /** Capacidades que ofrece este motor (p. ej. ['canvas', 'touch']). Opcional. */
  capabilities?: string[];
  /** Imagen o icono representativo del juego. Opcional. */
  image?: string;
  /** Descripción general del juego. Opcional. */
  description?: string;
}
