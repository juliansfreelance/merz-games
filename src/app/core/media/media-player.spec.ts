import { TestBed } from '@angular/core/testing';
import { MediaPlayer } from './media-player';
import { AppLogger } from '../logging/app-error';

// ─── Mocks ────────────────────────────────────────────────────────────────────

/** Mock de HTMLAudioElement / HTMLVideoElement para tests. */
class MockMediaElement {
  src = '';
  loop = false;
  volume = 1;
  preload = '';
  currentTime = 0;

  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  load = vi.fn();
}

function buildPlayer() {
  // Reemplazar createElement para devolver mocks
  const elements: MockMediaElement[] = [];
  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'audio' || tag === 'video') {
      const el = new MockMediaElement() as unknown as HTMLElement;
      elements.push(el as unknown as MockMediaElement);
      return el;
    }
    return origCreateElement(tag);
  });

  TestBed.configureTestingModule({
    providers: [MediaPlayer, AppLogger],
  });

  return {
    player: TestBed.inject(MediaPlayer),
    elements,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MediaPlayer', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('play() debe llamar a element.play()', async () => {
    const { player, elements } = buildPlayer();
    player.play('assets/sounds/test.mp3');

    expect(elements.length).toBeGreaterThan(0);
    expect(elements[elements.length - 1].play).toHaveBeenCalled();
  });

  it('play() debe respetar loop y volume', async () => {
    const { player, elements } = buildPlayer();
    player.play('assets/sounds/test.mp3', { loop: true, volume: 0.5 });

    const el = elements[elements.length - 1];
    expect(el.loop).toBe(true);
    expect(el.volume).toBe(0.5);
  });

  it('stop() debe pausar y limpiar el elemento activo', () => {
    const { player, elements } = buildPlayer();
    player.play('assets/sounds/test.mp3');

    const el = elements[elements.length - 1];
    player.stop();

    expect(el.pause).toHaveBeenCalled();
    expect(el.src).toBe('');
  });

  it('stop() sin reproducción activa no debe lanzar error', () => {
    const { player } = buildPlayer();
    expect(() => player.stop()).not.toThrow();
  });

  it('play() dos veces debe detener el primero', () => {
    const { player, elements } = buildPlayer();
    player.play('assets/sounds/a.mp3');
    const first = elements[0];
    player.play('assets/sounds/b.mp3');

    expect(first.pause).toHaveBeenCalled();
    expect(first.src).toBe('');
  });

  it('preload() no debe iniciar reproducción', () => {
    const { player, elements } = buildPlayer();
    player.preload('assets/sounds/test.mp3');

    expect(elements.length).toBe(1);
    expect(elements[0].play).not.toHaveBeenCalled();
    expect(elements[0].preload).toBe('auto');
  });

  it('volume debe quedar entre 0 y 1 (clamp)', () => {
    const { player, elements } = buildPlayer();

    player.play('assets/sounds/test.mp3', { volume: 2.5 });
    expect(elements[elements.length - 1].volume).toBe(1);

    player.play('assets/sounds/test.mp3', { volume: -1 });
    expect(elements[elements.length - 1].volume).toBe(0);
  });
});
