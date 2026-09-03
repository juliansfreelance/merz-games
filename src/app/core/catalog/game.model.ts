import { ExperienceConfig } from './game-experience.model';

/**
 * Activos locales a nivel de motor de juego.
 * Admite valores escalares y colecciones (p. ej. lista de SFX).
 */
export type GameAssets = { [key: string]: string | string[] | undefined };

/**
 * Motor de juego registrado en el catálogo.
 *
 * `entry`, `capabilities`, `image`, `description`, `assets` y `config` son opcionales
 * para no romper manifests existentes.
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
  capabilities?: string[]
  /** Imagen o icono representativo del juego. Opcional. */
  image?: string;
  /** Descripción general del juego. Opcional. */
  description?: string;
  /**
   * Activos compartidos por todas las experiencias que usan este motor.
   * (p. ej. SFX de flip, match, mismatch). Opcional.
   */
  assets?: GameAssets;
  /**
   * Configuración maestra del motor que aplica a todas sus experiencias.
   * Puede ser sobreescrita por experience.config (nivel más específico).
   * (p. ej. { pairs: 4 } para el motor de Memoria). Opcional.
   */
  config?: ExperienceConfig;
  /** Indica si el motor de juego está en fase de desarrollo o beta. Opcional. */
  develop?: boolean;
}

