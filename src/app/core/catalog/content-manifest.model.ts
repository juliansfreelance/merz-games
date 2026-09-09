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

/**
 * Configuración de audio de la aplicación a nivel de manifest.
 * Un manifest persistido sin este campo no rompe la app: todos los campos son opcionales.
 */
export interface ManifestAudio {
  /** URL local de la música de fondo de toda la aplicación. */
  backgroundMusic?: string;
  /** Volumen de la música de fondo (0–1). Default: 0.35. */
  volume?: number;
  /** Habilita o deshabilita el audio a nivel de manifest. KioskSettings.soundEnabled tiene precedencia. */
  enabled?: boolean;
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

export interface AppConfig {
  theme?: AppThemeConfig;
  audio?: AppAudioConfig;
  protector?: AppProtectorConfig;
  disclaimer?: string;
  security?: AppSecurityConfig;
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
  /** Configuración de audio de la aplicación (BGM, volumen global). Opcional para compatibilidad. */
  audio?: ManifestAudio;
}
