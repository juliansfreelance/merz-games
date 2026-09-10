import { TestBed } from '@angular/core/testing';
import { CONTENT_FS, MemoryContentFs, BrowserContentFs, createContentFs } from './content-fs';

describe('content-fs', () => {
  it('createContentFs en tests (sin Tauri) es browser stub', () => {
    const fs = createContentFs();
    expect(fs.available).toBe(false);
    expect(fs).toBeInstanceOf(BrowserContentFs);
  });

  it('MemoryContentFs hace write/exists/rename/remove', async () => {
    const fs = new MemoryContentFs();
    await fs.writeFile('content-incoming/images/a.png', new Uint8Array([1, 2, 3]));
    expect(await fs.exists('content-incoming/images/a.png')).toBe(true);
    await fs.rename('content-incoming/images/a.png', 'content/images/a.png');
    expect(await fs.exists('content/images/a.png')).toBe(true);
    expect(await fs.exists('content-incoming/images/a.png')).toBe(false);
    await fs.remove('content', true);
    expect(await fs.exists('content/images/a.png')).toBe(false);
  });

  it('CONTENT_FS token resuelve un fs usable', () => {
    TestBed.configureTestingModule({});
    const fs = TestBed.inject(CONTENT_FS);
    expect(fs.available).toBe(false);
  });
});
