import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ImageCacheService } from './image-cache.service';

describe('ImageCacheService', () => {
  let service: ImageCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ImageCacheService],
    });
    service = TestBed.inject(ImageCacheService);
  });

  afterEach(() => {
    service.clear();
  });

  it('debe crearse correctamente con caché vacía', () => {
    expect(service).toBeTruthy();
    expect(service.cachedCount()).toBe(0);
    expect(service.has('/content/test.png')).toBe(false);
  });

  it('retorna inmediatamente si la URL es vacía o falsy', async () => {
    await service.preload('');
    expect(service.cachedCount()).toBe(0);
  });

  it('almacena la imagen en caché al precargar exitosamente', async () => {
    const originalImage = globalThis.Image;
    try {
      class MockImage {
        src = '';
        complete = false;
        naturalWidth = 100;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        decode = vi.fn().mockResolvedValue(undefined);

        constructor() {
          setTimeout(() => {
            this.complete = true;
            this.onload?.();
          }, 5);
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      await service.preload('/content/test.png');
      expect(service.has('/content/test.png')).toBe(true);
      expect(service.cachedCount()).toBe(1);
      expect(service.get('/content/test.png')).toBeDefined();
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('reutiliza la caché si se solicita la misma URL dos veces', async () => {
    const originalImage = globalThis.Image;
    let instances = 0;
    try {
      class MockImage {
        src = '';
        complete = true;
        naturalWidth = 10;
        onload: (() => void) | null = null;
        decode = vi.fn().mockResolvedValue(undefined);
        constructor() {
          instances++;
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      await service.preload('/content/logo.png');
      await service.preload('/content/logo.png');

      expect(instances).toBe(1);
      expect(service.cachedCount()).toBe(1);
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('resuelve de forma resiliente si la imagen falla', async () => {
    const originalImage = globalThis.Image;
    try {
      class FailingImage {
        src = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {
          setTimeout(() => {
            this.onerror?.();
          }, 5);
        }
      }
      globalThis.Image = FailingImage as unknown as typeof Image;

      await expect(service.preload('/content/broken.png')).resolves.toBeUndefined();
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('preloadMany() precarga una lista de URLs', async () => {
    const originalImage = globalThis.Image;
    try {
      class MockImage {
        src = '';
        complete = true;
        naturalWidth = 10;
        decode = vi.fn().mockResolvedValue(undefined);
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      await service.preloadMany(['/content/a.png', '/content/b.png', '/content/a.png']);
      expect(service.cachedCount()).toBe(2);
      expect(service.has('/content/a.png')).toBe(true);
      expect(service.has('/content/b.png')).toBe(true);
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('clear() vacía la caché y resetea el contador', async () => {
    const originalImage = globalThis.Image;
    try {
      class MockImage {
        src = '';
        complete = true;
        naturalWidth = 10;
        decode = vi.fn().mockResolvedValue(undefined);
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      await service.preload('/content/x.png');
      expect(service.cachedCount()).toBe(1);

      service.clear();
      expect(service.cachedCount()).toBe(0);
      expect(service.has('/content/x.png')).toBe(false);
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('release() elimina una URL concreta', async () => {
    const originalImage = globalThis.Image;
    try {
      class MockImage {
        src = '';
        complete = true;
        naturalWidth = 10;
        decode = vi.fn().mockResolvedValue(undefined);
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      await service.preloadMany(['/content/a.png', '/content/b.png']);
      service.release('/content/a.png');
      expect(service.has('/content/a.png')).toBe(false);
      expect(service.has('/content/b.png')).toBe(true);
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('releaseAllExcept() conserva solo las URLs pedidas', async () => {
    const originalImage = globalThis.Image;
    try {
      class MockImage {
        src = '';
        complete = true;
        naturalWidth = 10;
        decode = vi.fn().mockResolvedValue(undefined);
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      await service.preloadMany(['/content/a.png', '/content/b.png', '/content/c.png']);
      service.releaseAllExcept(['/content/b.png']);
      expect(service.has('/content/a.png')).toBe(false);
      expect(service.has('/content/b.png')).toBe(true);
      expect(service.has('/content/c.png')).toBe(false);
    } finally {
      globalThis.Image = originalImage;
    }
  });
});
