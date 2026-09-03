/**
 * Experiencia de juego concreta (marca × motor).
 *
 * `theme`, `assets`, `config`, `title`, `description` e `image` son opcionales para no romper la semilla actual.
 * Las Fases 5–6 los rellenan con valores reales.
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
  /** Dorso de las cartas para experiencias de Memoria. */
  cardBack?: string;
  /**
   * Caras de las cartas para experiencias de Memoria.
   * Array de URLs locales a los PNG individuales.
   */
  cardFaces?: string[];
  /** Ficha X personalizada para experiencias de Triqui. */
  markX?: string;
  /** Ficha O personalizada para experiencias de Triqui. */
  markO?: string;
  /** Índice abierto para otros activos escalares o colecciones. */
  [key: string]: string | string[] | undefined;
}


/** Parámetros de configuración específicos del motor. */
export type ExperienceConfig = Record<string, string | number | boolean | undefined>;

export interface GameExperience {
  id: string;
  brandId: string;
  gameId: string;
  version: string;
  enabled: boolean;
  order: number;
  /** Título personalizado para la experiencia en la card (si falta, se usa el nombre del motor). Opcional. */
  title?: string;
  /** Descripción de la experiencia en la card (si falta, se usa la del motor/marca). Opcional. */
  description?: string;
  /** Imagen de portada de la experiencia. Opcional. */
  image?: string;
  /** Personalización visual de la experiencia. Opcional. */
  theme?: ExperienceTheme;
  /** Activos locales que el motor puede consumir. Opcional. */
  assets?: ExperienceAssets;
  /** Configuración específica del motor para esta experiencia. Opcional. */
  config?: ExperienceConfig;
  /** Indica si la experiencia concreta está en desarrollo o beta. Opcional. */
  develop?: boolean;
}
