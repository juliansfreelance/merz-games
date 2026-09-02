import { describe, it, expect } from 'vitest';
import {
  computeCardLayout,
  getFactorPairs,
  calculateMinimumBoardHeight,
} from './card-layout';

describe('card-layout — Algoritmo de distribución adaptativa', () => {
  describe('getFactorPairs', () => {
    it('para 4 cartas devuelve [2x2]', () => {
      const pairs = getFactorPairs(4);
      expect(pairs).toContainEqual([2, 2]);
    });

    it('para 8 cartas devuelve 2x4 y 4x2 descartando 1x8 y 8x1', () => {
      const pairs = getFactorPairs(8);
      expect(pairs).toContainEqual([2, 4]);
      expect(pairs).toContainEqual([4, 2]);
      expect(pairs).not.toContainEqual([1, 8]);
      expect(pairs).not.toContainEqual([8, 1]);
    });

    it('para 12 cartas devuelve 2x6, 3x4, 4x3, 6x2', () => {
      const pairs = getFactorPairs(12);
      expect(pairs).toContainEqual([3, 4]);
      expect(pairs).toContainEqual([4, 3]);
      expect(pairs).toContainEqual([2, 6]);
      expect(pairs).toContainEqual([6, 2]);
    });
  });

  describe('computeCardLayout', () => {
    it('en slot vertical para 8 cartas elige 2 columnas x 4 filas sin desbordar', () => {
      // Slot tipo quiosco vertical: ancho 600px, alto 900px
      const layout = computeCardLayout({
        containerWidth: 600,
        containerHeight: 900,
        totalCards: 8,
      });

      expect(layout.columns).toBe(2);
      expect(layout.rows).toBe(4);
      expect(layout.boardWidth).toBeLessThanOrEqual(600);
      expect(layout.boardHeight).toBeLessThanOrEqual(900);
      expect(layout.cardWidth).toBeGreaterThan(100);
    });

    it('en slot horizontal para 8 cartas elige 4 columnas x 2 filas sin desbordar', () => {
      // Slot horizontal: ancho 1000px, alto 500px
      const layout = computeCardLayout({
        containerWidth: 1000,
        containerHeight: 500,
        totalCards: 8,
      });

      expect(layout.columns).toBe(4);
      expect(layout.rows).toBe(2);
      expect(layout.boardWidth).toBeLessThanOrEqual(1000);
      expect(layout.boardHeight).toBeLessThanOrEqual(500);
      expect(layout.cardWidth).toBeGreaterThan(120);
    });

    it('nunca sobrepasa el ancho y alto del contenedor disponible', () => {
      // Probar con dimensiones aleatorias o reducidas
      const layout = computeCardLayout({
        containerWidth: 350,
        containerHeight: 480,
        totalCards: 8,
        gap: 8,
      });

      expect(layout.boardWidth).toBeLessThanOrEqual(350);
      expect(layout.boardHeight).toBeLessThanOrEqual(480);
      expect(layout.cardWidth).toBeGreaterThan(0);
      expect(layout.cardHeight).toBeGreaterThan(0);
    });

    it('respeta maxCardWidth en pantallas horizontales ultra anchas', () => {
      const layout = computeCardLayout({
        containerWidth: 2500,
        containerHeight: 1200,
        totalCards: 8,
        maxCardWidth: 260,
      });

      expect(layout.cardWidth).toBeLessThanOrEqual(260);
    });

    it('devuelve un layout seguro si las dimensiones son 0 o negativas', () => {
      const layout = computeCardLayout({
        containerWidth: 0,
        containerHeight: 0,
        totalCards: 8,
      });

      expect(layout.columns).toBeGreaterThan(0);
      expect(layout.rows).toBeGreaterThan(0);
      expect(layout.cardWidth).toBeGreaterThan(0);
    });
  });

  describe('calculateMinimumBoardHeight', () => {
    it('calcula altura mínima suficiente para 8 cartas en portrait (4 filas)', () => {
      const minHeight = calculateMinimumBoardHeight(8, false);
      // 4 filas * (70px / 1.2578 ≈ 55.65px) + 3 * 12px gap + 8px padding ≈ 267px
      expect(minHeight).toBeGreaterThanOrEqual(260);
      expect(minHeight).toBeLessThan(450);
    });

    it('calcula altura mínima para 8 cartas en landscape (2 filas)', () => {
      const minHeight = calculateMinimumBoardHeight(8, true);
      // 2 filas * 55.65px + 1 * 12px + 8px padding ≈ 132px
      expect(minHeight).toBeGreaterThanOrEqual(130);
      expect(minHeight).toBeLessThan(250);
    });

    it('para 12 cartas en portrait requiere más altura que para 8 cartas', () => {
      const h8 = calculateMinimumBoardHeight(8, false);
      const h12 = calculateMinimumBoardHeight(12, false);
      expect(h12).toBeGreaterThan(h8);
    });
  });

  describe('ocupación del slot y maximización del tamaño', () => {
    it('en quiosco vertical (slot ~700x900) las cartas superan 260px de ancho y aprovechan >85% del eje limitante', () => {
      const layout = computeCardLayout({
        containerWidth: 700,
        containerHeight: 900,
        totalCards: 8,
      });

      // El tablero debe estar en 2x4
      expect(layout.columns).toBe(2);
      expect(layout.rows).toBe(4);
      // Las cartas deben poder crecer más allá de la antigua cota de 260px
      expect(layout.cardWidth).toBeGreaterThan(260);
      expect(layout.boardWidth).toBeLessThanOrEqual(700);
      expect(layout.boardHeight).toBeLessThanOrEqual(900);

      // Ocupación en el eje vertical (limitante) > 85%
      const heightOccupancy = layout.boardHeight / 900;
      expect(heightOccupancy).toBeGreaterThan(0.85);
    });

    it('en móvil moderno portrait (ej. 390x600) aprovecha >85% del ancho', () => {
      const layout = computeCardLayout({
        containerWidth: 380,
        containerHeight: 650,
        totalCards: 8,
      });

      expect(layout.columns).toBe(2);
      expect(layout.rows).toBe(4);
      expect(layout.boardWidth).toBeLessThanOrEqual(380);
      expect(layout.boardHeight).toBeLessThanOrEqual(650);

      // Eje horizontal limitante: (380 - 8 - 12) / 2 = 180px
      const widthOccupancy = layout.boardWidth / 380;
      expect(widthOccupancy).toBeGreaterThan(0.85);
    });
  });
});

