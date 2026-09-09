import { fetchContentManifest, pendingContentAssets, type FetchFn } from './content-update';
import { CONTENT_OFFLINE_MESSAGE } from './update.constants';
import { ContentManifest } from '../catalog/content-manifest.model';

function baseManifest(partial: Partial<ContentManifest> = {}): ContentManifest {
  return {
    version: '0.6.0',
    brands: [],
    games: [],
    experiences: [],
    ...partial,
  };
}

describe('fetchContentManifest', () => {
  it('marca offline cuando navigator.onLine es false', async () => {
    const original = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    try {
      const result = await fetchContentManifest('https://example.test/manifest.json');
      expect(result.kind).toBe('offline');
      expect(result.errorMessage).toBe(CONTENT_OFFLINE_MESSAGE);
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: original });
    }
  });

  it('404 → error sin remote', async () => {
    const fetchFn: FetchFn = async () =>
      new Response(null, { status: 404, statusText: 'Not Found' });

    const result = await fetchContentManifest('https://example.test/missing.json', fetchFn);
    expect(result.kind).toBe('error');
    expect(result.remote).toBeUndefined();
    expect(result.errorMessage).toMatch(/404/);
  });

  it('fallo de red (TypeError) → offline', async () => {
    const fetchFn: FetchFn = async () => {
      throw new TypeError('Failed to fetch');
    };

    const result = await fetchContentManifest('https://example.test/manifest.json', fetchFn);
    expect(result.kind).toBe('offline');
    expect(result.errorMessage).toBe(CONTENT_OFFLINE_MESSAGE);
  });

  it('JSON válido con brands/games/experiences → ok', async () => {
    const remote = baseManifest({
      brands: [
        {
          id: 'radiesse',
          name: 'Radiesse',
          version: '0.6.0',
          enabled: true,
          order: 1,
        },
      ],
      games: [
        {
          id: 'memory',
          name: 'Memoria',
          version: '0.5.0',
          minAppVersion: '0.1.0',
          enabled: true,
        },
      ],
      experiences: [
        {
          id: 'radiesse-memory',
          brandId: 'radiesse',
          gameId: 'memory',
          version: '0.5.0',
          enabled: true,
          order: 1,
        },
      ],
    });

    const fetchFn: FetchFn = async () =>
      new Response(JSON.stringify(remote), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const result = await fetchContentManifest('https://example.test/ok.json', fetchFn);
    expect(result.kind).toBe('ok');
    expect(result.remote?.version).toBe('0.6.0');
    expect(result.remote?.brands[0]?.id).toBe('radiesse');
  });

  it('payload sin arrays de catálogo → error', async () => {
    const fetchFn: FetchFn = async () =>
      new Response(JSON.stringify({ version: '9.0.0' }), { status: 200 });

    const result = await fetchContentManifest('https://example.test/bad.json', fetchFn);
    expect(result.kind).toBe('error');
    expect(result.errorMessage).toMatch(/inválido|corrupto/i);
  });
});

describe('pendingContentAssets', () => {
  it('lista solo URLs nuevas del remoto', () => {
    const local = baseManifest({
      brands: [
        {
          id: 'radiesse',
          name: 'Radiesse',
          version: '0.6.0',
          enabled: true,
          order: 1,
          logo: '/content/images/radiesse.png',
          attractionVideos: [
            { nombre: 'A', source: '/content/videos/radiesse.mp4', enabled: true },
          ],
        },
      ],
    });
    const remote = baseManifest({
      brands: [
        {
          id: 'radiesse',
          name: 'Radiesse',
          version: '0.7.0',
          enabled: true,
          order: 1,
          logo: '/content/images/radiesse.png',
          attractionVideos: [
            { nombre: 'A', source: '/content/videos/radiesse.mp4', enabled: true },
            { nombre: 'B', source: '/content/videos/radiesse2.mp4', enabled: true },
          ],
        },
      ],
    });

    expect(pendingContentAssets(local, remote)).toEqual(['/content/videos/radiesse2.mp4']);
  });
});
