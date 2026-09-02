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

export interface ContentManifest {
  version: string;
  brands: Brand[];
  games: Game[];
  experiences: GameExperience[];
  /** Atmósfera institucional default (usada en splash, welcome, selector de marcas). */
  atmosphere?: Atmosphere;
  /** Configuración de audio de la aplicación (BGM, volumen global). Opcional para compatibilidad. */
  audio?: ManifestAudio;
}
