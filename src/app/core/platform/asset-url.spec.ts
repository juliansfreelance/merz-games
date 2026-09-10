import { assetUrl } from './asset-url';
import { clearPackRuntime, hydratePackRuntime } from './pack-runtime';

function withBaseHref(href: string, run: () => void): void {
  const previous = Array.from(document.querySelectorAll('base'));
  for (const el of previous) el.remove();
  const base = document.createElement('base');
  base.href = href;
  document.head.appendChild(base);
  try {
    run();
  } finally {
    base.remove();
    for (const el of previous) document.head.appendChild(el);
  }
}

describe('assetUrl', () => {
  afterEach(() => {
    clearPackRuntime();
  });

  it('deja pasar http(s), blob y data', () => {
    expect(assetUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(assetUrl('http://localhost/a.png')).toBe('http://localhost/a.png');
    expect(assetUrl('blob:http://localhost/uuid')).toBe('blob:http://localhost/uuid');
    expect(assetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('devuelve vacío si la ruta está vacía', () => {
    expect(assetUrl('')).toBe('');
  });

  it('resuelve /content contra base /', () => {
    withBaseHref('http://localhost:4200/', () => {
      expect(assetUrl('/content/images/logo.png')).toBe(
        'http://localhost:4200/content/images/logo.png',
      );
    });
  });

  it('resuelve /content contra base de GitHub Pages', () => {
    withBaseHref('https://juliansfreelance.github.io/merz-games/', () => {
      expect(assetUrl('/content/images/logo.png')).toBe(
        'https://juliansfreelance.github.io/merz-games/content/images/logo.png',
      );
      expect(assetUrl('content/audio/bgm.mp3')).toBe(
        'https://juliansfreelance.github.io/merz-games/content/audio/bgm.mp3',
      );
    });
  });

  it('pack hit gana al bundle', () => {
    hydratePackRuntime({
      files: { 'images/logo.png': '/mem/content/images/logo.png' },
      convertFileSrc: (abs) => `asset://localhost${abs}`,
    });
    withBaseHref('http://localhost:4200/', () => {
      expect(assetUrl('/content/images/logo.png')).toBe(
        'asset://localhost/mem/content/images/logo.png',
      );
      expect(assetUrl('/content/images/other.png')).toBe(
        'http://localhost:4200/content/images/other.png',
      );
    });
  });
});
