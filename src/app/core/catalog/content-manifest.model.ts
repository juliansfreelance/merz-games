import { Brand } from './brand.model';
import { Game } from './game.model';
import { GameExperience } from './game-experience.model';

export interface AtmosphereBlob {
  from: string;      // hex
  to: string;        // hex
  opacity: number;   // 0–1, sutil (p. ej. 0.08–0.22)
}

export interface Atmosphere {
  baseColor: string;   // fondo del marco (hex)
  blurTint?: string;   // tinte de blur opcional
  blobs: AtmosphereBlob[];
}

export interface AppPanelTheme {
  primaryColor?: string;   // hex, p. ej. #fdc700
  secondaryColor?: string; // hex, p. ej. #ff637e
  atmosphere?: Atmosphere;
}

export interface AppThemeConfig {
  home?: Atmosphere;
  panel?: AppPanelTheme;
}

export interface AppAudioConfig {
  soundEnabled?: boolean;
  bgmVolume?: number;
  sfxVolume?: number;
  videoVolume?: number;
  backgroundMusic?: string;
}

export interface AttractionVideo {
  /** Nombre visible del video (p. ej. 'General 1', 'Radiesse Promocional 1'). */
  nombre: string;
  /** Nombre alternativo en inglés para interoperabilidad. */
  name?: string;
  /** Ruta local al archivo de video (p. ej. '/content/videos/general1.mp4'). */
  source: string;
  /** Indica si el video está activo para reproducción en el protector. */
  enabled: boolean;
}

export interface AppProtectorConfig {
  mode?: 'classic' | 'video';
  idleMs?: number;
  videoOrder?: 'sequential' | 'random';
  /** Lista de videos de atracción institucionales o generales. */
  attractionVideos?: AttractionVideo[];
}

export interface AppSecurityConfig {
  defaultPin?: string;
  betaSuperadminPin?: string;
  resetSuperadminPin?: string;
  superadminHint?: string;
}

/**
 * Configuración del Cover Flow 3D (selectores de marcas y juegos).
 * Todos los campos son opcionales; se aplican defaults seguros si faltan.
 */
export interface AppCoverConfig {
  /** Reflejo debajo de cada card. Default: true. */
  enableReflection?: boolean;
  /** Tap en card lateral centra ese card. Default: true. */
  enableClickToSnap?: boolean;
  /** Navegación con rueda horizontal del mouse/trackpad. Default: true. */
  enableScroll?: boolean;
  /** Tick sintético al cambiar de card. Default: true. */
  enableAudio?: boolean;
  /** Forzar motion reducido (sin spring / sin rotateY). Default: false. */
  reduceMotion?: boolean;
  /** Separación entre cards apilados laterales (px base). Default: 100. */
  stackSpacing?: number;
  /** Separación del card activo a su vecino (px base). Default: 250. */
  centerGap?: number;
  /** Ángulo Y de cards laterales (grados). Default: 50. */
  rotation?: number;
  /** Índice inicial al abrir el Cover Flow. Default: 0. */
  initialIndex?: number;
  /** Umbral de deltaX acumulado para saltar con la rueda. Default: 100. */
  scrollThreshold?: number;
}

/** Defaults del Cover Flow alineados con el playground de referencia. */
export const DEFAULT_APP_COVER_CONFIG: Required<AppCoverConfig> = {
  enableReflection: true,
  enableClickToSnap: true,
  enableScroll: true,
  enableAudio: true,
  reduceMotion: false,
  stackSpacing: 100,
  centerGap: 250,
  rotation: 50,
  initialIndex: 0,
  scrollThreshold: 100,
};

export function resolveAppCoverConfig(
  partial?: AppCoverConfig | null,
): Required<AppCoverConfig> {
  return { ...DEFAULT_APP_COVER_CONFIG, ...partial };
}

export interface AppConfig {
  theme?: AppThemeConfig;
  audio?: AppAudioConfig;
  protector?: AppProtectorConfig;
  disclaimer?: string;
  security?: AppSecurityConfig;
  /** Parámetros visuales e interacción del Cover Flow. */
  cover?: AppCoverConfig;
}

export interface ContentManifest {
  version: string;
  /** Configuración global de la aplicación (tema, audio, protector, disclaimer, seguridad). */
  app?: AppConfig;
  brands: Brand[];
  games: Game[];
  experiences: GameExperience[];
  /** Atmósfera institucional default (usada en splash, welcome, selector de marcas). */
  atmosphere?: Atmosphere;
}
