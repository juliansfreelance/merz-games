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

export interface ContentManifest {
  version: string;
  brands: Brand[];
  games: Game[];
  experiences: GameExperience[];
  /** Atmósfera institucional default (usada en splash, welcome, selector de marcas). */
  atmosphere?: Atmosphere;
}
