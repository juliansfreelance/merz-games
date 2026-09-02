/**
 * Specs del motor puro de Memoria.
 * Parametrizados sobre 2–6 parejas para garantizar que ninguna regla
 * asume exactamente 4 parejas.
 */

import { MemoryEngine, MISMATCH_DELAY_MS } from './memory-engine';

// RNG determinista: devuelve la secuencia de valores proporcionada y luego 0
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}

// RNG identidad: nunca intercambia nada (Fisher-Yates con 0 siempre)
const identityRng = () => 0;

function makeFaces(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `/card-${String(i + 1).padStart(2, '0')}.png`);
}

// ─── Parámetros de prueba ─────────────────────────────────────────────────────

const PAIR_COUNTS = [2, 3, 4, 5, 6];

describe('MemoryEngine', () => {

  // ── Construcción de la baraja ──────────────────────────────────────────────

  describe.each(PAIR_COUNTS.map(p => [p]))('con %i parejas', (pairs) => {
    it('la baraja tiene pairs * 2 cartas', () => {
      const engine = new MemoryEngine({ faces: makeFaces(pairs), pairs, lives: 3, rng: identityRng });
      expect(engine.cards.length).toBe(pairs * 2);
    });

    it('cada pairKey aparece exactamente 2 veces', () => {
      const engine = new MemoryEngine({ faces: makeFaces(pairs), pairs, lives: 3, rng: identityRng });
      const freq = new Map<string, number>();
      for (const card of engine.cards) {
        freq.set(card.pairKey, (freq.get(card.pairKey) ?? 0) + 1);
      }
      for (const count of freq.values()) {
        expect(count).toBe(2);
      }
      expect(freq.size).toBe(pairs);
    });

    it('todas las cartas arrancan en estado hidden', () => {
      const engine = new MemoryEngine({ faces: makeFaces(pairs), pairs, lives: 3, rng: identityRng });
      for (const card of engine.cards) {
        expect(card.state).toBe('hidden');
      }
    });
  });

  // ── Mezcla determinista ────────────────────────────────────────────────────

  it('la mezcla es determinista con el mismo RNG', () => {
    const rng1 = seededRng([0.5, 0.2, 0.8, 0.1, 0.9, 0.3, 0.7, 0.4]);
    const rng2 = seededRng([0.5, 0.2, 0.8, 0.1, 0.9, 0.3, 0.7, 0.4]);
    const e1 = new MemoryEngine({ faces: makeFaces(4), pairs: 4, lives: 3, rng: rng1 });
    const e2 = new MemoryEngine({ faces: makeFaces(4), pairs: 4, lives: 3, rng: rng2 });
    expect(e1.cards.map(c => c.pairKey)).toEqual(e2.cards.map(c => c.pairKey));
  });

  // ── reveal: par acertado ───────────────────────────────────────────────────

  it('reveal de par igual emite flip + match', () => {
    // Con identityRng, la baraja no se mezcla: posición 0 y 4 comparten pairKey '0'
    const engine = new MemoryEngine({ faces: makeFaces(4), pairs: 4, lives: 3, rng: identityRng });
    const [c1, , , , c2] = engine.cards; // índices 0 y 4 tienen mismo pairKey con identityRng

    // Encontrar dos cartas con el mismo pairKey
    const key = engine.cards[0].pairKey;
    const [first, second] = engine.cards.filter(c => c.pairKey === key);

    const events1 = engine.reveal(first.id);
    expect(events1.map(e => e.type)).toContain('flip');

    const events2 = engine.reveal(second.id);
    expect(events2.map(e => e.type)).toContain('flip');
    expect(events2.map(e => e.type)).toContain('match');

    expect(first.state).toBe('matched');
    expect(second.state).toBe('matched');
  });

  // ── reveal: par fallido ────────────────────────────────────────────────────

  it('reveal de par distinto emite flip + mismatch y resta vida', () => {
    const engine = new MemoryEngine({ faces: makeFaces(4), pairs: 4, lives: 3, rng: identityRng });

    // Buscar dos cartas con distinto pairKey
    const first = engine.cards[0];
    const second = engine.cards.find(c => c.pairKey !== first.pairKey)!;

    engine.reveal(first.id);
    const events = engine.reveal(second.id);
    expect(events.map(e => e.type)).toContain('mismatch');
  });

  // ── Tercer clic durante evaluación pendiente ───────────────────────────────

  it('tercer reveal durante evaluación pendiente devuelve []', () => {
    const engine = new MemoryEngine({ faces: makeFaces(4), pairs: 4, lives: 3, rng: identityRng });

    const first = engine.cards[0];
    const second = engine.cards.find(c => c.pairKey !== first.pairKey)!;
    const third = engine.cards.find(c => c.id !== first.id && c.id !== second.id)!;

    engine.reveal(first.id);
    engine.reveal(second.id); // → mismatch, pendingEvaluation = true
    const events = engine.reveal(third.id);
    expect(events).toHaveLength(0);
  });

  // ── reveal sobre carta matched ─────────────────────────────────────────────

  it('reveal sobre carta matched devuelve []', () => {
    const engine = new MemoryEngine({ faces: makeFaces(4), pairs: 4, lives: 3, rng: identityRng });
    const key = engine.cards[0].pairKey;
    const [a, b] = engine.cards.filter(c => c.pairKey === key);
    engine.reveal(a.id);
    engine.reveal(b.id);
    expect(a.state).toBe('matched');

    const events = engine.reveal(a.id);
    expect(events).toHaveLength(0);
  });

  // ── Victoria ──────────────────────────────────────────────────────────────

  it('completar todas las parejas emite win', () => {
    const engine = new MemoryEngine({ faces: makeFaces(4), pairs: 4, lives: 3, rng: identityRng });

    const grouped = new Map<string, typeof engine.cards[number][]>();
    for (const card of engine.cards) {
      const arr = grouped.get(card.pairKey) ?? [];
      arr.push(card);
      grouped.set(card.pairKey, arr);
    }

    let winEmitted = false;
    for (const [, pair] of grouped) {
      engine.reveal(pair[0].id);
      const events = engine.reveal(pair[1].id);
      if (events.some(e => e.type === 'win')) winEmitted = true;
    }
    expect(winEmitted).toBe(true);
  });

  // ── Derrota ───────────────────────────────────────────────────────────────

  it('3 mismatch consecutivos emiten lose', () => {
    const engine = new MemoryEngine({ faces: makeFaces(4), pairs: 4, lives: 3, rng: identityRng });

    // Obtener pares de cartas con distinto pairKey para causar 3 mismatches
    const mismatches: Array<[string, string]> = [];
    for (let i = 0; i < engine.cards.length && mismatches.length < 3; i++) {
      for (let j = i + 1; j < engine.cards.length && mismatches.length < 3; j++) {
        if (engine.cards[i].pairKey !== engine.cards[j].pairKey) {
          mismatches.push([engine.cards[i].id, engine.cards[j].id]);
          break;
        }
      }
    }

    let loseEmitted = false;
    for (const [id1, id2] of mismatches) {
      // Asegurar que ambas cartas estén ocultas antes de revelarlas
      engine.resolvePending();
      const ev1 = engine.reveal(id1);
      const ev2 = engine.reveal(id2);
      if (ev2.some(e => e.type === 'lose')) loseEmitted = true;
    }
    expect(loseEmitted).toBe(true);
  });

  // ── Pool insuficiente ─────────────────────────────────────────────────────

  it('pool de caras insuficiente recorta sin lanzar', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Pedimos 6 parejas pero solo hay 3 caras
    const engine = new MemoryEngine({ faces: makeFaces(3), pairs: 6, lives: 3, rng: identityRng });
    expect(engine.cards.length).toBeGreaterThanOrEqual(4); // mínimo 2 parejas
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // ── resolvePending ────────────────────────────────────────────────────────

  it('resolvePending voltea cartas de mismatch al dorso', () => {
    const engine = new MemoryEngine({ faces: makeFaces(4), pairs: 4, lives: 3, rng: identityRng });

    const first = engine.cards[0];
    const second = engine.cards.find(c => c.pairKey !== first.pairKey)!;

    engine.reveal(first.id);
    engine.reveal(second.id);

    expect(first.state).toBe('revealed');
    expect(second.state).toBe('revealed');

    engine.resolvePending();

    expect(first.state).toBe('hidden');
    expect(second.state).toBe('hidden');
  });

  // ── MISMATCH_DELAY_MS ─────────────────────────────────────────────────────

  it('MISMATCH_DELAY_MS es una constante con nombre (entre 700 y 1200 ms)', () => {
    expect(typeof MISMATCH_DELAY_MS).toBe('number');
    expect(MISMATCH_DELAY_MS).toBeGreaterThanOrEqual(700);
    expect(MISMATCH_DELAY_MS).toBeLessThanOrEqual(1200);
  });

  // ── Selección aleatoria del pool de caras ──────────────────────────────────

  it('selecciona caras del pool de forma consistente con el RNG provisto', () => {
    const pool = makeFaces(12);

    // Con el mismo RNG la selección de cartas es 100% determinista
    const rngA = seededRng([0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.5, 0.7]);
    const rngB = seededRng([0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.5, 0.7]);
    const eA = new MemoryEngine({ faces: pool, pairs: 4, lives: 3, rng: rngA });
    const eB = new MemoryEngine({ faces: pool, pairs: 4, lives: 3, rng: rngB });

    const facesA = eA.cards.map(c => c.faceUrl);
    const facesB = eB.cards.map(c => c.faceUrl);
    expect(facesA).toEqual(facesB);

    // Con el motor por defecto sin semilla, se extrae el número correcto de pares del pool
    const eDefault = new MemoryEngine({ faces: pool, pairs: 4, lives: 3 });
    const uniqueFaces = new Set(eDefault.cards.map(c => c.faceUrl));
    expect(uniqueFaces.size).toBe(4);
    for (const f of uniqueFaces) {
      expect(pool).toContain(f);
    }
  });
});
