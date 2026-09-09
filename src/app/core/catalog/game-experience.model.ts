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

export interface ExperienceResultText {
  title?: string;
  description?: string;
  note?: string;
}

export interface ExperienceResultsConfig {
  win?: ExperienceResultText;
  lose?: ExperienceResultText;
  'out-of-lives'?: ExperienceResultText;
  draw?: ExperienceResultText;
}

/** Mensaje de aviso de inicio de turno. */
export interface TurnNoticeMessage {
  title?: string;
  message?: string;
}

/** Configuración de aviso de primer turno (quién arranca la partida). */
export interface ExperienceTurnNoticeConfig {
  /** Duración en segundos antes de cerrarse automáticamente (por defecto 30). */
  durationSeconds?: number;
  /** Texto del botón de confirmación/cierre (por defecto "¡Entendido!"). */
  buttonText?: string;
  player?: TurnNoticeMessage;
  ai?: TurnNoticeMessage;
}

/** Configuración de confirmación de abandono de juego al pulsar "Volver a juegos". */
export interface ExperienceExitConfirmConfig {
  /** Ruta opcional al icono o imagen del diálogo (por defecto /content/images/experiences/result/warning.png). */
  icon?: string;
  /** Título del diálogo de confirmación (ej. "¿ABANDONAR LA PARTIDA?"). */
  title?: string;
  /** Mensaje descriptivo con soporte para HTML. */
  message?: string;
  /** Texto del botón para confirmar la salida (ej. "Sí, salir"). */
  confirmButtonText?: string;
  /** Texto del botón para cancelar y seguir jugando (ej. "Continuar jugando"). */
  cancelButtonText?: string;
}

export interface GameExperience {
  id: string;
  brandId: string;
  gameId: string;
  version: string;
  enabled: boolean;
  order: number;
  /** Nombre personalizado para la experiencia en la card y juego. Opcional. */
  name?: string;
  /** Título personalizado para la experiencia (alias legacy de `name`). Opcional. */
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
  /** Configuración personalizada de textos de resultado por tipo. Opcional. */
  results?: ExperienceResultsConfig;
  /** Configuración personalizada de aviso de primer turno. Opcional. */
  turnNotice?: ExperienceTurnNoticeConfig;
  /** Configuración personalizada de confirmación al intentar abandonar la partida. Opcional. */
  exitConfirm?: ExperienceExitConfirmConfig;
  /** Indica si la experiencia concreta está en desarrollo o beta. Opcional. */
  develop?: boolean;
}
