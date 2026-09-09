import { Atmosphere, AttractionVideo } from './content-manifest.model';

export interface Brand {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  order: number;
  /** Imagen representativa o thumbnail de la marca (ruta local). Opcional. */
  image?: string;
  /** Logotipo vectorial o imagen del logo de la marca (ruta local). Opcional. */
  logo?: string;
  /** Descripción corta de la marca para las cards del catálogo. Opcional. */
  description?: string;
  /** Atmósfera visual propia de la marca (degradado flotante y fondo). Opcional. */
  atmosphere?: Atmosphere;
  /** Disclaimer legal específico de la marca (INVIMA, registros, indicaciones). Opcional. */
  disclaimer?: string;
  /** Video de atracción promocional singular de la marca (compatibilidad hacia atrás). Opcional. */
  attractionVideo?: string;
  /** Lista de videos de atracción promocionales de la marca para el protector de pantalla. */
  attractionVideos?: AttractionVideo[];
  /** Indica si la marca se encuentra en fase de desarrollo o beta (requiere PIN superadmin). Opcional. */
  develop?: boolean;
}
