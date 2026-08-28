import { Brand } from './brand.model';
import { Game } from './game.model';
import { GameExperience } from './game-experience.model';

export interface ContentManifest {
  version: string;
  brands: Brand[];
  games: Game[];
  experiences: GameExperience[];
}
