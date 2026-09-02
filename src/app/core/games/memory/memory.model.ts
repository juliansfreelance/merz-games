/**
 * Modelos del motor de Memoria (Encuentra la Pareja).
 *
 * Este archivo NO importa Angular, Router, catálogo ni @tauri-apps/api.
 * Es TypeScript puro y puede ejecutarse en Node sin DOM.
 */

/** Estado visible de una carta en el tablero. */
export type MemoryCardState = 'hidden' | 'revealed' | 'matched';

/** Representación inmutable de una carta en el tablero. */
export interface MemoryCard {
  /** Identificador único en la baraja (UUID o secuencial). */
  readonly id: string;
  /**
   * Clave de pareja: ambas cartas de la misma pareja comparten este valor.
   * Equivale al índice de la cara en el pool de la experiencia.
   */
  readonly pairKey: string;
  /** URL local de la imagen de la cara de la carta. */
  readonly faceUrl: string;
  /** Estado actual de la carta. */
  state: MemoryCardState;
}

/** Eventos emitidos por el motor. El componente los traduce a sonido, animación y sesión. */
export type MemoryEvent =
  | { readonly type: 'flip';     readonly cardId: string }
  | { readonly type: 'match';    readonly pairKey: string }
  | { readonly type: 'mismatch'; readonly cardIds: readonly [string, string] }
  | { readonly type: 'win' }
  | { readonly type: 'lose' };

/** Opciones de construcción del motor. */
export interface MemoryEngineOptions {
  /**
   * Pool de URLs de caras de la experiencia.
   * El motor elige `pairs` caras de este pool (sin repetir pairKey).
   */
  readonly faces: readonly string[];
  /**
   * Número de parejas a jugar, ya resuelto y validado por memory-config.
   * El motor nunca asume un valor fijo; toda la lógica se deriva de este valor.
   */
  readonly pairs: number;
  /** Vidas iniciales de la sesión (normalmente MAX_LIVES = 3). */
  readonly lives: number;
  /**
   * Función generadora de números aleatorios [0, 1).
   * Default: Math.random. Inyectable para tests deterministas.
   */
  readonly rng?: () => number;
}
