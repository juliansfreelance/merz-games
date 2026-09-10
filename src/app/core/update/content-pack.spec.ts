import { TestBed } from '@angular/core/testing';
import { CONTENT_FS, MemoryContentFs } from '../platform/content-fs';
import { packAssetSrc, packHasFile, clearPackRuntime } from '../platform/pack-runtime';
import { AppLogger } from '../logging/app-error';
import { ContentPack } from './content-pack';
import { sha256Hex } from './content-integrity';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);

function pngResponse(): Response {
  return new Response(PNG, { status: 200, headers: { 'Content-Type': 'image/png' } });
}

describe('ContentPack', () => {
  let fs: MemoryContentFs;
  let pack: ContentPack;

  beforeEach(async () => {
    clearPackRuntime();
    fs = new MemoryContentFs();
    TestBed.configureTestingModule({
      providers: [
        ContentPack,
        { provide: CONTENT_FS, useValue: fs },
        { provide: AppLogger, useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      ],
    });
    pack = TestBed.inject(ContentPack);
    await pack.whenReady();
  });

  afterEach(() => {
    clearPackRuntime();
  });

  it('instala un PNG pendiente y lo deja resoluble en el pack', async () => {
    const result = await pack.install(['/content/images/brands/nueva.png'], {
      fetchFn: async () => pngResponse(),
    });
    expect(result.kind).toBe('ok');
    expect(result.installed).toEqual(['images/brands/nueva.png']);
    expect(await fs.exists('content/images/brands/nueva.png')).toBe(true);
    expect(packHasFile('images/brands/nueva.png')).toBe(true);
    expect(packAssetSrc('/content/images/brands/nueva.png')).toContain('asset://');
  });

  it('hash mismatch no instala el archivo', async () => {
    const result = await pack.install(['/content/images/brands/nueva.png'], {
      fetchFn: async () => pngResponse(),
      hashes: { '/content/images/brands/nueva.png': { sha256: 'ab'.repeat(32) } },
    });
    expect(result.kind).toBe('error');
    expect(result.errorMessage).toMatch(/hash/i);
    expect(await fs.exists('content/images/brands/nueva.png')).toBe(false);
    expect(packHasFile('images/brands/nueva.png')).toBe(false);
  });

  it('hash correcto instala', async () => {
    const digest = await sha256Hex(PNG);
    const result = await pack.install(['/content/images/a.png'], {
      fetchFn: async () => pngResponse(),
      hashes: { '/content/images/a.png': { sha256: digest } },
    });
    expect(result.kind).toBe('ok');
  });

  it('rollback restaura el archivo anterior tras un install', async () => {
    await fs.writeFile(
      'content/images/a.png',
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    );
    await pack.install(['/content/images/a.png'], { fetchFn: async () => pngResponse() });
    expect(new Uint8Array(await fs.readFile('content/images/a.png'))).toEqual(PNG);

    await pack.rollback();
    const restored = await fs.readFile('content/images/a.png');
    expect(Array.from(restored)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('fallo de red a mitad no deja JSON-side effects y limpia incoming', async () => {
    const result = await pack.install(['/content/images/a.png'], {
      fetchFn: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(result.kind).toBe('offline');
    expect(await fs.exists('content-incoming')).toBe(false);
    expect(await fs.exists('content/images/a.png')).toBe(false);
  });

  it('404 de asset no instala', async () => {
    const result = await pack.install(['/content/images/missing.png'], {
      fetchFn: async () => new Response(null, { status: 404 }),
    });
    expect(result.kind).toBe('error');
    expect(result.errorMessage).toMatch(/404/);
  });

  it('clearInstalled vacía el pack y el runtime', async () => {
    await pack.install(['/content/images/a.png'], { fetchFn: async () => pngResponse() });
    await pack.clearInstalled();
    expect(await fs.exists('content')).toBe(false);
    expect(packHasFile('images/a.png')).toBe(false);
    expect(packAssetSrc('/content/images/a.png')).toBeNull();
  });
});
