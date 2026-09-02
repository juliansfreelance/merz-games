/**
 * Algoritmo puro de layout adaptativo para el juego de parejas.
 *
 * Calcula matemáticamente la mejor distribución de columnas x filas
 * para aprovechar al máximo el espacio disponible del contenedor real
 * sin desbordar ni provocar scroll.
 */

// ── Constantes centralizadas de layout ────────────────────────────────────────

/** Ancho mínimo en px para que una carta sea jugable y legible en pantallas táctiles. */
export const MIN_CARD_WIDTH = 70;

/**
 * Ancho máximo en px por carta como cota superior de seguridad en pantallas ultra anchas (ej. 4K).
 * Elevado a 420px para no truncar prematuramente en quioscos de 1080x1920 o tablets.
 */
export const MAX_CARD_WIDTH = 420;

/** Relación de aspecto estándar de las cartas (ancho / alto, atlas 400x318). */
export const DEFAULT_CARD_ASPECT_RATIO = 400 / 318;

/** Espaciado (gap) mínimo y por defecto entre cartas. */
export const DEFAULT_GAP = 12;

/** Padding interior de seguridad para tolerancias de subpíxeles y bordes. */
export const DEFAULT_PADDING_X = 4;
export const DEFAULT_PADDING_Y = 4;

export interface CardLayoutOptions {
  /** Ancho real del contenedor en píxeles. */
  containerWidth: number;
  /** Alto real del contenedor en píxeles. */
  containerHeight: number;
  /** Cantidad total de cartas en juego (debe ser un entero >= 2). */
  totalCards: number;
  /**
   * Relación de aspecto de la carta (ancho / alto).
   * Default: 400 / 318 ≈ 1.2578 (atlas de cartas del juego).
   */
  aspectRatio?: number;
  /** Espaciado (gap) entre cartas en píxeles. Default: 12. */
  gap?: number;
  /** Padding interior horizontal de seguridad en píxeles. Default: 12. */
  paddingX?: number;
  /** Padding interior vertical de seguridad en píxeles. Default: 12. */
  paddingY?: number;
  /** Límite mínimo de ancho por carta en píxeles para asegurar jugabilidad. Default: 70. */
  minCardWidth?: number;
  /** Límite máximo de ancho por carta en píxeles para evitar cartas gigantescas. Default: 260. */
  maxCardWidth?: number;
}

export interface CardLayoutResult {
  /** Número óptimo de columnas. */
  columns: number;
  /** Número óptimo de filas. */
  rows: number;
  /** Ancho final de cada carta en píxeles. */
  cardWidth: number;
  /** Alto final de cada carta en píxeles. */
  cardHeight: number;
  /** Ancho total del tablero (columnas + gaps) en píxeles. */
  boardWidth: number;
  /** Alto total del tablero (filas + gaps) en píxeles. */
  boardHeight: number;
}

/**
 * Calcula la altura mínima requerida para el slot del tablero para garantizar
 * que las cartas alcancen al menos `minCardWidth` (y su altura proporcional).
 *
 * En vertical (portrait), para 8 cartas usa 2 columnas x 4 filas.
 * Para un mínimo de 70px de ancho => alto ~56px por carta => ~300px mínimos de slot.
 */
export function calculateMinimumBoardHeight(
  totalCards: number,
  isLandscape = false,
  minCardWidth = MIN_CARD_WIDTH,
  gap = DEFAULT_GAP,
  paddingY = DEFAULT_PADDING_Y,
  aspectRatio = DEFAULT_CARD_ASPECT_RATIO,
): number {
  if (totalCards <= 0) return 200;

  // En portrait favorecemos más filas que columnas (e.g. 8 -> 2 cols x 4 filas, 6 -> 2x3, 12 -> 3x4)
  let rows = 4;
  if (isLandscape) {
    // En horizontal favorecemos menos filas (e.g. 8 -> 4 cols x 2 filas)
    rows = Math.max(2, Math.floor(Math.sqrt(totalCards)));
  } else {
    // En vertical buscamos al menos 2 columnas
    const cols = 2;
    rows = Math.ceil(totalCards / cols);
  }

  const minCardHeight = minCardWidth / aspectRatio;
  const minHeight = rows * minCardHeight + (rows - 1) * gap + paddingY * 2;

  return Math.ceil(minHeight);
}

/**
 * Obtiene todas las parejas enteras de (columnas, filas) tales que columnas * filas = total.
 * Filtra combinaciones de 1 sola fila o 1 sola columna si total >= 6 para evitar tiras inviables.
 */
export function getFactorPairs(total: number): Array<[columns: number, rows: number]> {
  if (total <= 0) return [];
  const pairs: Array<[number, number]> = [];

  for (let c = 1; c <= total; c++) {
    if (total % c === 0) {
      const r = total / c;
      // Para 6 o más cartas, evitar 1xN o Nx1 salvo que no haya otra factorización
      if (total >= 6 && (c === 1 || r === 1)) {
        continue;
      }
      pairs.push([c, r]);
    }
  }

  // Fallback si todas fueron filtradas (ej. números primos raros)
  if (pairs.length === 0) {
    for (let c = 1; c <= total; c++) {
      if (total % c === 0) {
        pairs.push([c, total / c]);
      }
    }
  }

  return pairs;
}

/**
 * Calcula la mejor combinación de columnas x filas que produzca las cartas
 * de mayor tamaño posible dentro del contenedor sin desbordamiento.
 */
export function computeCardLayout(options: CardLayoutOptions): CardLayoutResult {
  const {
    containerWidth,
    containerHeight,
    totalCards,
    aspectRatio = DEFAULT_CARD_ASPECT_RATIO,
    gap = DEFAULT_GAP,
    paddingX = DEFAULT_PADDING_X,
    paddingY = DEFAULT_PADDING_Y,
    minCardWidth = MIN_CARD_WIDTH,
    maxCardWidth = MAX_CARD_WIDTH,
  } = options;

  // Si las dimensiones no son válidas o no hay cartas, devolver fallback seguro
  if (containerWidth <= 0 || containerHeight <= 0 || totalCards <= 0) {
    return {
      columns: 2,
      rows: Math.max(1, Math.ceil(totalCards / 2)),
      cardWidth: 100,
      cardHeight: 100 / aspectRatio,
      boardWidth: 200 + gap,
      boardHeight: (100 / aspectRatio) * Math.max(1, Math.ceil(totalCards / 2)),
    };
  }

  const isVerticalSlot = containerHeight > containerWidth;
  const factorPairs = getFactorPairs(totalCards);

  let bestResult: CardLayoutResult | null = null;
  let bestCardWidth = -1;

  for (const [cols, rows] of factorPairs) {
    const availW = containerWidth - paddingX * 2 - (cols - 1) * gap;
    const availH = containerHeight - paddingY * 2 - (rows - 1) * gap;

    if (availW <= 0 || availH <= 0) continue;

    const maxWByCol = availW / cols;
    const maxHByRow = availH / rows;

    // Con aspect ratio = W / H => H = W / ratio => W_max_from_H = maxHByRow * ratio
    let cardW = Math.min(maxWByCol, maxHByRow * aspectRatio);
    if (maxCardWidth > 0 && cardW > maxCardWidth) {
      cardW = maxCardWidth;
    }
    const cardH = cardW / aspectRatio;

    // Criterio de preferencia secundario para desempates:
    // En vertical favorecer filas >= columnas; en horizontal favorecer columnas >= filas
    let score = cardW;
    const orientationMatch = isVerticalSlot ? rows >= cols : cols >= rows;
    if (orientationMatch) {
      // Ligero bonus proporcional para favorecer la orientación natural ante tamaños similares
      score += 0.001;
    }

    if (score > bestCardWidth) {
      bestCardWidth = score;
      // Truncar a 1 decimal para estabilidad subpíxel sin desbordar
      const finalCardW = Math.floor(cardW * 10) / 10;
      const finalCardH = Math.floor(cardH * 10) / 10;
      const boardWidth = cols * finalCardW + (cols - 1) * gap;
      const boardHeight = rows * finalCardH + (rows - 1) * gap;

      bestResult = {
        columns: cols,
        rows,
        cardWidth: finalCardW,
        cardHeight: finalCardH,
        boardWidth: Math.ceil(boardWidth),
        boardHeight: Math.ceil(boardHeight),
      };
    }
  }

  // Si ninguna combinación cupo con los paddings dados, usar estimación mínima
  if (!bestResult) {
    const cols = isVerticalSlot ? 2 : Math.max(2, Math.ceil(totalCards / 2));
    const rows = Math.ceil(totalCards / cols);
    const cardW = Math.max(40, Math.min(containerWidth / cols, 100));
    const cardH = cardW / aspectRatio;

    return {
      columns: cols,
      rows,
      cardWidth: Math.floor(cardW),
      cardHeight: Math.floor(cardH),
      boardWidth: Math.ceil(cols * cardW + (cols - 1) * gap),
      boardHeight: Math.ceil(rows * cardH + (rows - 1) * gap),
    };
  }

  return bestResult;
}
