/**
 * MemoryEngine — Motor puro del juego de Memoria (Encuentra la Pareja).
 *
 * Restricciones de diseño:
 * - Sin imports de Angular, Router, catálogo ni @tauri-apps/api.
 * - Sin efectos secundarios externos: emite eventos y el componente actúa.
 * - Determinista con RNG inyectable para tests.
 * - Tolerante a errores: pool insuficiente → recorte con warning, nunca excepción.
 */

import { MemoryCard, MemoryEngineOptions, MemoryEvent } from './memory.model';

/** Retardo en ms antes de voltear cartas fallidas al dorso (ventana de evaluación). */
export const MISMATCH_DELAY_MS = 800;

let _cardIdCounter = 0;
function nextCardId(): string {
  return `mc-${++_cardIdCounter}`;
}

export class MemoryEngine {
  /** Baraja completa, inmutable en estructura pero mutable en `state`. */
  readonly cards: readonly MemoryCard[];

  private readonly _lives: { current: number };
  /** IDs de las cartas actualmente reveladas (máximo 2). */
  private _revealed: string[] = [];
  /** true mientras espera que el componente llame resolvePending() */
  private _pendingEvaluation = false;

  constructor(options: MemoryEngineOptions) {
    const { faces, pairs: requestedPairs, lives, rng = Math.random } = options;

    // Limitar pares al pool disponible, mínimo 2
    const availablePairs = Math.min(requestedPairs, faces.length);
    if (availablePairs < requestedPairs) {
      console.warn(
        `MemoryEngine: el pool de caras (${faces.length}) es menor que las parejas pedidas (${requestedPairs}). ` +
        `Se recorta a ${availablePairs} parejas.`,
      );
    }
    const effectivePairs = Math.max(2, availablePairs);

    // Seleccionar `effectivePairs` caras aleatorias del pool disponible
    const poolCopy = [...faces];
    this._shuffleArray(poolCopy, rng);
    const chosen = poolCopy.slice(0, effectivePairs);

    // Duplicar y mezclar con Fisher-Yates
    const deck: MemoryCard[] = [
      ...chosen.map((faceUrl, i) => this._makeCard(String(i), faceUrl)),
      ...chosen.map((faceUrl, i) => this._makeCard(String(i), faceUrl)),
    ];
    this._shuffleArray(deck, rng);

    this.cards = deck;
    this._lives = { current: lives };
  }

  // ─── API pública ──────────────────────────────────────────────────────────────

  /**
   * Revela una carta por su id.
   *
   * Devuelve un array de eventos a procesar en orden:
   * - `flip` siempre que el toque sea válido.
   * - `match` o `mismatch` al completar el segundo volteo.
   * - `win` o `lose` si corresponde.
   *
   * Devuelve `[]` (vacío) para toques inválidos:
   * - Carta ya emparejada.
   * - Carta ya revelada (mismo toque dos veces).
   * - Tercer toque mientras hay una evaluación pendiente.
   */
  reveal(cardId: string): readonly MemoryEvent[] {
    if (this._pendingEvaluation) return [];

    const card = this.cards.find((c) => c.id === cardId);
    if (!card) return [];
    if (card.state === 'matched') return [];
    if (card.state === 'revealed') return [];

    const events: MemoryEvent[] = [];

    card.state = 'revealed';
    events.push({ type: 'flip', cardId });
    this._revealed.push(cardId);

    if (this._revealed.length === 2) {
      const [id1, id2] = this._revealed as [string, string];
      const c1 = this.cards.find((c) => c.id === id1)!;
      const c2 = this.cards.find((c) => c.id === id2)!;

      if (c1.pairKey === c2.pairKey) {
        // Pareja acertada
        c1.state = 'matched';
        c2.state = 'matched';
        events.push({ type: 'match', pairKey: c1.pairKey });
        this._revealed = [];

        if (this._isVictory()) {
          events.push({ type: 'win' });
        }
      } else {
        // Pareja fallida
        this._pendingEvaluation = true;
        this._lives.current -= 1;
        events.push({ type: 'mismatch', cardIds: [id1, id2] });

        if (this._lives.current <= 0) {
          events.push({ type: 'lose' });
        }
      }
    }

    return events;
  }

  /**
   * Cierra la ventana de evaluación de un par fallido.
   * Voltea al dorso las dos cartas reveladas y devuelve eventos si corresponde.
   * El componente llama este método tras el retardo de animación (MISMATCH_DELAY_MS).
   */
  resolvePending(): readonly MemoryEvent[] {
    if (!this._pendingEvaluation) return [];

    for (const id of this._revealed) {
      const card = this.cards.find((c) => c.id === id);
      if (card && card.state === 'revealed') {
        card.state = 'hidden';
      }
    }
    this._revealed = [];
    this._pendingEvaluation = false;
    return [];
  }

  // ─── Internos ─────────────────────────────────────────────────────────────────

  private _makeCard(pairKey: string, faceUrl: string): MemoryCard {
    return { id: nextCardId(), pairKey, faceUrl, state: 'hidden' };
  }

  private _shuffleArray<T>(arr: T[], rng: () => number): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private _isVictory(): boolean {
    return this.cards.every((c) => c.state === 'matched');
  }
}
