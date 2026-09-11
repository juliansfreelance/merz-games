import { TestBed } from '@angular/core/testing';
import { MediaPlayer } from './media-player';
import { AppLogger } from '../logging/app-error';
import { KioskSettings } from '../settings/kiosk-settings';

// ─── Mocks ────────────────────────────────────────────────────────────────────

/** Mock de HTMLAudioElement / HTMLVideoElement para tests. */
class MockMediaElement {
  src = '';
  loop = false;
  volume = 1;
  preload = '';
  currentTime = 0;
  paused = true;
  ended = false;

  readyState = 4;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn().mockImplementation(() => { this.paused = true; });
  load = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

function buildPlayer(soundEnabled = true) {
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

  const mockSettings = {
    soundEnabled: vi.fn().mockReturnValue(soundEnabled),
    bgmVolume: vi.fn().mockReturnValue(0.4),
    sfxVolume: vi.fn().mockReturnValue(0.8),
    screensaverMode: vi.fn().mockReturnValue('classic'),
    memoryPairs: vi.fn().mockReturnValue(null),
  };

  TestBed.configureTestingModule({
    providers: [
      MediaPlayer,
      AppLogger,
      { provide: KioskSettings, useValue: mockSettings },
    ],
  });

  return {
    player: TestBed.inject(MediaPlayer),
    elements,
    mockSettings,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MediaPlayer', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  // ── Canal media genérico ──────────────────────────────────────────────────

  it('play() debe llamar a element.play()', () => {
    const { player, elements } = buildPlayer();
    player.play('assets/sounds/test.mp3');
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[elements.length - 1].play).toHaveBeenCalled();
  });

  it('play() debe respetar loop y volume', () => {
    const { player, elements } = buildPlayer();
    player.play('assets/sounds/test.mp3', { loop: true, volume: 0.5 });
    const el = elements[elements.length - 1];
    expect(el.loop).toBe(true);
    expect(el.volume).toBe(0.5);
  });

  it('stop() no debe corromper el preloadCache', () => {
    const { player, elements } = buildPlayer();
    player.preload('assets/sounds/cached.mp3');
    const cachedEl = elements[0];
    player.play('assets/sounds/cached.mp3');
    player.stop();
    // El elemento del cache NO debe tener src vacío
    expect(cachedEl.src).not.toBe('');
  });

  it('stop() sin reproducción activa no debe lanzar error', () => {
    const { player } = buildPlayer();
    expect(() => player.stop()).not.toThrow();
  });

  it('play() dos veces detiene el canal genérico previo', () => {
    const { player, elements } = buildPlayer();
    player.play('assets/sounds/a.mp3');
    const firstCount = elements.length;
    player.play('assets/sounds/b.mp3');
    // El primero debe haberse pausado
    expect(elements[firstCount - 1].pause).toHaveBeenCalled();
  });

  it('volume debe quedar entre 0 y 1 (clamp)', () => {
    const { player, elements } = buildPlayer();
    player.play('assets/sounds/test.mp3', { volume: 2.5 });
    expect(elements[elements.length - 1].volume).toBe(1);
    player.stop();
    player.play('assets/sounds/test.mp3', { volume: -1 });
    expect(elements[elements.length - 1].volume).toBe(0);
  });

  it('preload() no debe iniciar reproducción', () => {
    const { player, elements } = buildPlayer();
    player.preload('assets/sounds/test.mp3');
    expect(elements.length).toBe(1);
    expect(elements[0].play).not.toHaveBeenCalled();
    expect(elements[0].preload).toBe('auto');
  });

  it('preloadUntilReady() espera el buffer sin reproducir', async () => {
    const { player, elements } = buildPlayer();
    await player.preloadUntilReady('assets/sounds/test.mp3');
    expect(elements.length).toBe(1);
    expect(elements[0].play).not.toHaveBeenCalled();
    expect(elements[0].preload).toBe('auto');
  });

  // ── Canal SFX ─────────────────────────────────────────────────────────────

  it('dos SFX seguidos no se cancelan entre sí', () => {
    const { player, elements } = buildPlayer();
    player.playSfx('sfx/flip.mp3');
    const sfx1Count = elements.length;
    player.playSfx('sfx/match.mp3');
    // El primer SFX no debe haberse pausado
    expect(elements[sfx1Count - 1].pause).not.toHaveBeenCalled();
    // Ambos deben haber llamado play()
    expect(elements[sfx1Count - 1].play).toHaveBeenCalled();
    expect(elements[elements.length - 1].play).toHaveBeenCalled();
  });

  it('SFX no corta el canal media genérico', () => {
    const { player, elements } = buildPlayer();
    player.play('assets/media.mp3');
    const mediaEl = elements[elements.length - 1];
    player.playSfx('sfx/flip.mp3');
    // El canal media no se debe haber pausado
    expect(mediaEl.pause).not.toHaveBeenCalled();
  });

  // ── Canal BGM ─────────────────────────────────────────────────────────────

  it('BGM sobrevive a un SFX (no se pausa)', () => {
    const { player, elements } = buildPlayer();
    player.setBgm('audio/bgm.mp3');
    player.unlockBgm();
    const bgmIdx = elements.length - 1;
    player.playSfx('sfx/flip.mp3');
    expect(elements[bgmIdx].pause).not.toHaveBeenCalled();
  });

  it('unlockBgm() es idempotente (no reinicia la música)', () => {
    const { player, elements } = buildPlayer();
    player.setBgm('audio/bgm.mp3');
    player.unlockBgm();
    const callCountAfterFirst = elements[elements.length - 1].play.mock.calls.length;
    player.unlockBgm();
    expect(elements[elements.length - 1].play.mock.calls.length).toBe(callCountAfterFirst);
  });

  // ── soundEnabled = false ──────────────────────────────────────────────────

  it('play() ignorado con soundEnabled = false', () => {
    const { player, elements } = buildPlayer(false);
    player.play('assets/test.mp3');
    // No debe haber creado ningún elemento de audio
    const playEl = elements.find(el => (el as MockMediaElement).play.mock.calls.length > 0);
    expect(playEl).toBeUndefined();
  });

  it('playSfx() ignorado con soundEnabled = false', () => {
    const { player, elements } = buildPlayer(false);
    player.playSfx('sfx/flip.mp3');
    const played = elements.filter(el => (el as MockMediaElement).play.mock.calls.length > 0);
    expect(played).toHaveLength(0);
  });

  it('BGM no arranca con soundEnabled = false', () => {
    const { player, elements } = buildPlayer(false);
    player.setBgm('audio/bgm.mp3');
    player.unlockBgm();
    const played = elements.filter(el => (el as MockMediaElement).play.mock.calls.length > 0);
    expect(played).toHaveLength(0);
  });

  // ── Fase 8: BGM pause/resume, volumen de video y mute-safety ──────────────

  it('pauseBgm() pausa el BGM sin resetear currentTime', () => {
    const { player, elements } = buildPlayer(true);
    player.setBgm('audio/bgm.mp3');
    player.unlockBgm();
    const bgmEl = elements[elements.length - 1];
    bgmEl.currentTime = 15.5;

    player.pauseBgm();
    expect(bgmEl.pause).toHaveBeenCalled();
    expect(bgmEl.currentTime).toBe(15.5);
  });

  it('resumeBgm() reanuda el BGM con el volumen configurado', () => {
    const { player, elements } = buildPlayer(true);
    player.setBgm('audio/bgm.mp3', 0.4);
    player.unlockBgm();
    const bgmEl = elements[elements.length - 1];

    player.pauseBgm();
    bgmEl.play.mockClear();

    player.resumeBgm();
    expect(bgmEl.play).toHaveBeenCalled();
    expect(bgmEl.volume).toBe(0.4);
  });

  it('resumeBgm() no reanuda si soundEnabled = false', () => {
    const { player, elements } = buildPlayer(false);
    player.setBgm('audio/bgm.mp3');
    player.unlockBgm();
    player.resumeBgm();
    const played = elements.filter(el => (el as MockMediaElement).play.mock.calls.length > 0);
    expect(played).toHaveLength(0);
  });

  it('setBackgroundSuspended(true) pausa BGM y bloquea SFX', () => {
    const { player, elements } = buildPlayer(true);
    player.setBgm('audio/bgm.mp3');
    player.unlockBgm();
    const bgmEl = elements[elements.length - 1] as MockMediaElement;
    bgmEl.paused = false;

    player.setBackgroundSuspended(true);
    expect(bgmEl.pause).toHaveBeenCalled();
    expect(player.isBackgroundSuspended()).toBe(true);

    bgmEl.play.mockClear();
    player.playSfx('sfx/click.mp3');
    const sfxPlayed = elements.filter(
      (el) => el !== bgmEl && (el as MockMediaElement).play.mock.calls.length > 0,
    );
    expect(sfxPlayed).toHaveLength(0);
  });

  it('setBackgroundSuspended(false) reanuda BGM solo si lo pausó el segundo plano', () => {
    const { player, elements } = buildPlayer(true);
    player.setBgm('audio/bgm.mp3', 0.4);
    player.unlockBgm();
    const bgmEl = elements[elements.length - 1] as MockMediaElement;
    bgmEl.paused = false;

    player.setBackgroundSuspended(true);
    bgmEl.play.mockClear();
    bgmEl.paused = true;

    player.setBackgroundSuspended(false);
    expect(bgmEl.play).toHaveBeenCalled();
    expect(player.isBackgroundSuspended()).toBe(false);
  });

  it('effectiveVideoVolume() retorna 0 cuando soundEnabled = false', () => {
    const { player } = buildPlayer(false);
    expect(player.effectiveVideoVolume(0.8)).toBe(0);
    expect(player.effectiveVideoVolume()).toBe(0);
  });

  it('effectiveVideoVolume() respeta el volumen y aplica clamping con soundEnabled = true', () => {
    const { player } = buildPlayer(true);
    expect(player.effectiveVideoVolume(0.75)).toBe(0.75);
    expect(player.effectiveVideoVolume(-0.2)).toBe(0);
    expect(player.effectiveVideoVolume(1.5)).toBe(1);
  });

  it('play() de video (.mp4) NO se aborta con soundEnabled = false, sino que se reproduce con volume 0', () => {
    const { player, elements } = buildPlayer(false);
    player.play('content/videos/test.mp4', { volume: 0.8 });
    const videoEl = elements.find(el => (el as MockMediaElement).play.mock.calls.length > 0);
    expect(videoEl).toBeDefined();
    expect(videoEl?.volume).toBe(0);
  });
});
