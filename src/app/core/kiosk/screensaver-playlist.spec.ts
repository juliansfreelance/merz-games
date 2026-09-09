import { describe, it, expect } from 'vitest';
import { Brand } from '../catalog/brand.model';
import {
  buildScreensaverPlaylist,
  getNextPlaylistItem,
  ScreensaverPlaylistItem,
} from './screensaver-playlist';

describe('ScreensaverPlaylist', () => {
  const mockBrands: Brand[] = [
    {
      id: 'radiesse',
      name: 'Radiesse',
      version: '0.1.0',
      enabled: true,
      order: 1,
      attractionVideo: '/content/videos/radiesse.mp4',
    },
    {
      id: 'ultherapy',
      name: 'Ultherapy',
      version: '0.1.0',
      enabled: true,
      order: 2,
      attractionVideo: '/content/videos/ultherapy.mp4',
    },
    {
      id: 'merz',
      name: 'Merz Aesthetics',
      version: '0.1.0',
      enabled: true,
      order: 3,
      // Sin attractionVideo
    },
    {
      id: 'disabled-brand',
      name: 'Disabled Brand',
      version: '0.1.0',
      enabled: false,
      order: 4,
      attractionVideo: '/content/videos/disabled.mp4',
    },
    {
      id: 'remote-brand',
      name: 'Remote Brand',
      version: '0.1.0',
      enabled: true,
      order: 5,
      attractionVideo: 'https://remote.server/video.mp4', // Remoto prohibido
    },
  ];

  describe('buildScreensaverPlaylist', () => {
    it('retorna array vacío si brands es nulo, indefinido o vacío', () => {
      expect(buildScreensaverPlaylist(null)).toEqual([]);
      expect(buildScreensaverPlaylist(undefined)).toEqual([]);
      expect(buildScreensaverPlaylist([])).toEqual([]);
    });

    it('filtra marcas deshabilitadas, sin video o con URLs remotas', () => {
      const playlist = buildScreensaverPlaylist(mockBrands);
      expect(playlist.length).toBe(2);
      expect(playlist[0].brandId).toBe('radiesse');
      expect(playlist[0].videoUrl).toBe('/content/videos/radiesse.mp4');
      expect(playlist[1].brandId).toBe('ultherapy');
      expect(playlist[1].videoUrl).toBe('/content/videos/ultherapy.mp4');
    });

    it('ordena por order ascendente', () => {
      const inverted: Brand[] = [
        { ...mockBrands[1], order: 10 },
        { ...mockBrands[0], order: 5 },
      ];
      const playlist = buildScreensaverPlaylist(inverted);
      expect(playlist[0].brandId).toBe('radiesse');
      expect(playlist[1].brandId).toBe('ultherapy');
    });

    it('admite una tercera marca sin modificar el código', () => {
      const withThird: Brand[] = [
        ...mockBrands,
        {
          id: 'belotero',
          name: 'Belotero',
          version: '0.1.0',
          enabled: true,
          order: 0,
          attractionVideo: '/content/videos/belotero.mp4',
        },
      ];
      const playlist = buildScreensaverPlaylist(withThird);
      expect(playlist.length).toBe(3);
      expect(playlist[0].brandId).toBe('belotero');
      expect(playlist[1].brandId).toBe('radiesse');
      expect(playlist[2].brandId).toBe('ultherapy');
    });

    it('soporta attractionVideos múltiples por marca y filtra los que tienen enabled en false', () => {
      const brandsWithMulti: Brand[] = [
        {
          id: 'radiesse',
          name: 'Radiesse',
          version: '0.1.0',
          enabled: true,
          order: 1,
          attractionVideos: [
            { nombre: 'Radiesse 1', source: '/content/videos/radiesse1.mp4', enabled: true },
            { nombre: 'Radiesse 2', source: '/content/videos/radiesse2.mp4', enabled: false },
            { nombre: 'Radiesse 3', source: '/content/videos/radiesse3.mp4', enabled: true },
          ],
        },
      ];
      const playlist = buildScreensaverPlaylist(brandsWithMulti);
      expect(playlist.length).toBe(2);
      expect(playlist[0].videoUrl).toBe('/content/videos/radiesse1.mp4');
      expect(playlist[1].videoUrl).toBe('/content/videos/radiesse3.mp4');
    });

    it('incluye videos generales con order 0 antes de los videos de marcas', () => {
      const generals = [
        { nombre: 'Gen 1', source: '/content/videos/gen1.mp4', enabled: true },
        { nombre: 'Gen Inactivo', source: '/content/videos/gen2.mp4', enabled: false },
      ];
      const playlist = buildScreensaverPlaylist(mockBrands, generals);
      expect(playlist.length).toBe(3);
      expect(playlist[0].brandId).toBe('general');
      expect(playlist[0].videoUrl).toBe('/content/videos/gen1.mp4');
      expect(playlist[1].brandId).toBe('radiesse');
      expect(playlist[2].brandId).toBe('ultherapy');
    });
  });

  describe('getNextPlaylistItem', () => {
    const items: ScreensaverPlaylistItem[] = [
      { brandId: 'b1', brandName: 'Brand 1', videoUrl: '/v1.mp4', order: 1 },
      { brandId: 'b2', brandName: 'Brand 2', videoUrl: '/v2.mp4', order: 2 },
      { brandId: 'b3', brandName: 'Brand 3', videoUrl: '/v3.mp4', order: 3 },
    ];

    it('retorna null si la playlist está vacía', () => {
      expect(getNextPlaylistItem([], 'sequential')).toBeNull();
      expect(getNextPlaylistItem([], 'random')).toBeNull();
    });

    it('retorna el único ítem disponible si la lista tiene tamaño 1', () => {
      const single = [items[0]];
      expect(getNextPlaylistItem(single, 'sequential', 'b1')).toBe(single[0]);
      expect(getNextPlaylistItem(single, 'random', 'b1')).toBe(single[0]);
    });

    describe('modo sequential', () => {
      it('retorna el primero si no hay currentBrandId o es inválido', () => {
        expect(getNextPlaylistItem(items, 'sequential')).toBe(items[0]);
        expect(getNextPlaylistItem(items, 'sequential', null)).toBe(items[0]);
        expect(getNextPlaylistItem(items, 'sequential', 'desconocido')).toBe(items[0]);
      });

      it('avanza cíclicamente 1 -> 2 -> 3 -> 1', () => {
        const next1 = getNextPlaylistItem(items, 'sequential', 'b1');
        expect(next1?.brandId).toBe('b2');

        const next2 = getNextPlaylistItem(items, 'sequential', 'b2');
        expect(next2?.brandId).toBe('b3');

        const next3 = getNextPlaylistItem(items, 'sequential', 'b3');
        expect(next3?.brandId).toBe('b1');
      });

      it('avanza secuencialmente usando videoUrl entre clips de la misma marca', () => {
        const multiBrandItems: ScreensaverPlaylistItem[] = [
          { brandId: 'radiesse', brandName: 'Radiesse', videoUrl: '/rad1.mp4', order: 1 },
          { brandId: 'radiesse', brandName: 'Radiesse', videoUrl: '/rad2.mp4', order: 1 },
          { brandId: 'ultherapy', brandName: 'Ultherapy', videoUrl: '/ulth1.mp4', order: 2 },
        ];
        const next1 = getNextPlaylistItem(multiBrandItems, 'sequential', '/rad1.mp4');
        expect(next1?.videoUrl).toBe('/rad2.mp4');

        const next2 = getNextPlaylistItem(multiBrandItems, 'sequential', '/rad2.mp4');
        expect(next2?.videoUrl).toBe('/ulth1.mp4');

        const next3 = getNextPlaylistItem(multiBrandItems, 'sequential', '/ulth1.mp4');
        expect(next3?.videoUrl).toBe('/rad1.mp4');
      });
    });

    describe('modo random', () => {
      it('evita repetir el mismo ítem consecutivamente cuando hay >= 2', () => {
        // Con currentBrandId = 'b1', los candidatos son 'b2' y 'b3'.
        // Con rng = 0 elige b2
        const nextA = getNextPlaylistItem(items, 'random', 'b1', () => 0);
        expect(nextA?.brandId).toBe('b2');

        // Con rng = 0.99 elige b3
        const nextB = getNextPlaylistItem(items, 'random', 'b1', () => 0.99);
        expect(nextB?.brandId).toBe('b3');

        // Ninguno es b1
        expect(nextA?.brandId).not.toBe('b1');
        expect(nextB?.brandId).not.toBe('b1');
      });

      it('elige entre todos si no se especificó currentBrandId', () => {
        const next = getNextPlaylistItem(items, 'random', null, () => 0);
        expect(next?.brandId).toBe('b1');
      });
    });
  });
});
