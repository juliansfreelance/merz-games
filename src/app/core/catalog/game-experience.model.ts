/**
 * Experiencia de juego concreta (marca × motor).
 *
 * `theme`, `assets` y `config` son opcionales para no romper la semilla actual.
 * Las Fases 4–5 los rellenan con valores reales.
 */

/** Paleta de colores y tipografía para la experiencia. */
export interface ExperienceTheme {
  primaryColor?: string;
  accentColor?: string;
  backgroundImage?: string;
  fontFamily?: string;
}

/** Rutas a activos locales (imágenes, audio, video). */
export interface ExperienceAssets {
  logo?: string;
  backgroundMusic?: string;
  cardBack?: string;
  [key: string]: string | undefined;
}

/** Parámetros de configuración específicos del motor. */
export type ExperienceConfig = Record<string, string | number | boolean>;

export interface GameExperience {
  id: string;
  brandId: string;
  gameId: string;
  version: string;
  enabled: boolean;
  order: number;
  /** Personalización visual de la experiencia. Opcional. */
  theme?: ExperienceTheme;
  /** Activos locales que el motor puede consumir. Opcional. */
  assets?: ExperienceAssets;
  /** Configuración específica del motor para esta experiencia. Opcional. */
  config?: ExperienceConfig;
}

