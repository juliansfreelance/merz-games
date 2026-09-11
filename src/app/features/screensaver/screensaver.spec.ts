import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Screensaver, CLASSIC_DWELL_MS } from './screensaver';
import { KioskSettings, ScreensaverMode, ScreensaverVideoOrder } from '../../core/settings/kiosk-settings';
import { CatalogService } from '../../core/catalog/catalog';
import { MediaPlayer } from '../../core/media/media-player';
import { Brand } from '../../core/catalog/brand.model';

describe('Screensaver Component', () => {
  let fixture: ComponentFixture<Screensaver>;
  let component: Screensaver;

  let screensaverModeSignal: any;
  let screensaverVideoOrderSignal: any;
  let videoVolumeSignal: any;
  let soundEnabledSignal: any;
  let brandsSignal: any;

  let mockSettings: any;
  let mockCatalog: any;
  let mockMediaPlayer: any;

  const sampleBrands: Brand[] = [
    {
      id: 'radiesse',
      name: 'Radiesse',
      version: '0.1.0',
      enabled: true,
      order: 1,
      attractionVideo: '/content/videos/radiesse.mp4',
      logo: '/content/images/brands/RadiesseLogo.svg',
    },
    {
      id: 'ultherapy',
      name: 'Ultherapy',
      version: '0.1.0',
      enabled: true,
      order: 2,
      attractionVideo: '/content/videos/ultherapy.mp4',
      logo: '/content/images/brands/UltherapyLogo.svg',
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();

    screensaverModeSignal = signal<ScreensaverMode>('classic');
    screensaverVideoOrderSignal = signal<ScreensaverVideoOrder>('sequential');
    videoVolumeSignal = signal<number>(0.5);
    soundEnabledSignal = signal<boolean>(true);
    brandsSignal = signal<Brand[]>(sampleBrands);

    mockSettings = {
      screensaverMode: screensaverModeSignal,
      screensaverVideoOrder: screensaverVideoOrderSignal,
      videoVolume: videoVolumeSignal,
      soundEnabled: soundEnabledSignal,
    };

    mockCatalog = {
      brands: brandsSignal,
      rawManifest: signal<any>({ app: { protector: { attractionVideos: [] } } }),
    };

    mockMediaPlayer = {
      pauseBgm: vi.fn(),
      resumeBgm: vi.fn(),
      isBackgroundSuspended: signal(false),
      effectiveVideoVolume: vi.fn().mockImplementation((vol?: number) => {
        return soundEnabledSignal() ? (vol ?? 0.5) : 0;
      }),
    };

    TestBed.configureTestingModule({
      imports: [Screensaver],
      providers: [
        { provide: KioskSettings, useValue: mockSettings },
        { provide: CatalogService, useValue: mockCatalog },
        { provide: MediaPlayer, useValue: mockMediaPlayer },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function setup(mode: ScreensaverMode = 'classic') {
    screensaverModeSignal.set(mode);
    fixture = TestBed.createComponent(Screensaver);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('Modo Clásico', () => {
    it('debe iniciar en clásico y NO mostrar ningún video en el DOM', () => {
      setup('classic');

      expect(component.isShowingVideo()).toBe(false);
      const videoEl = fixture.nativeElement.querySelector('video');
      expect(videoEl).toBeNull();
    });

    it('permanece en clásico indefinidamente (nunca pasa a video tras 20s)', () => {
      setup('classic');

      vi.advanceTimersByTime(30_000);
      fixture.detectChanges();

      expect(component.isShowingVideo()).toBe(false);
      const videoEl = fixture.nativeElement.querySelector('video');
      expect(videoEl).toBeNull();
      expect(mockMediaPlayer.pauseBgm).not.toHaveBeenCalled();
    });

    it('contiene el logotipo Merz Aesthetics y el slogan HOY TU PIEL TAMBIÉN GANA', () => {
      setup('classic');

      const el = fixture.nativeElement as HTMLElement;
      const img = el.querySelector('img');
      expect(img?.getAttribute('src')).toMatch(/\/content\/images\/MerzAestheticsLogo\.svg$/);
      expect(el.textContent).toContain('HOY TU PIEL');
      expect(el.textContent).toContain('TAMBIÉN GANA');
    });
  });

  describe('Modo Video', () => {
    it('inicia en clásico (≥ 20 s) antes de mostrar el primer video', () => {
      setup('video');

      expect(component.isShowingVideo()).toBe(false);
      expect(fixture.nativeElement.querySelector('video')).toBeNull();

      // Avanzar 19 segundos -> sigue en clásico
      vi.advanceTimersByTime(CLASSIC_DWELL_MS - 1000);
      fixture.detectChanges();
      expect(component.isShowingVideo()).toBe(false);

      // Avanzar 1 segundo más (total 20s) -> pasa a video
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(component.isShowingVideo()).toBe(true);
      expect(component.currentClip()?.brandId).toBe('radiesse');
      expect(mockMediaPlayer.pauseBgm).toHaveBeenCalled();

      const videoEl = fixture.nativeElement.querySelector('video');
      expect(videoEl).not.toBeNull();
    });

    it('al terminar un video (ended), regresa a clásico y reanuda BGM', () => {
      setup('video');

      // Avanzar a video
      vi.advanceTimersByTime(CLASSIC_DWELL_MS);
      fixture.detectChanges();
      expect(component.isShowingVideo()).toBe(true);

      // Simular finalización del clip
      (component as any).onVideoEnded();
      fixture.detectChanges();

      expect(component.isShowingVideo()).toBe(false);
      expect(mockMediaPlayer.resumeBgm).toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('video')).toBeNull();
    });

    it('al fallar un video (error), regresa a clásico y salta al siguiente en el próximo ciclo', () => {
      setup('video');

      // Avanzar a clip 1 (radiesse)
      vi.advanceTimersByTime(CLASSIC_DWELL_MS);
      fixture.detectChanges();
      expect(component.currentClip()?.brandId).toBe('radiesse');

      // Simular error en video
      (component as any).onVideoError();
      fixture.detectChanges();
      expect(component.isShowingVideo()).toBe(false);
      expect(mockMediaPlayer.resumeBgm).toHaveBeenCalled();

      // Avanzar otros 20 segundos de dwell clásico -> pasa a clip 2 (ultherapy)
      vi.advanceTimersByTime(CLASSIC_DWELL_MS);
      fixture.detectChanges();
      expect(component.isShowingVideo()).toBe(true);
      expect(component.currentClip()?.brandId).toBe('ultherapy');
    });

    it('con playlist vacía, permanece en clásico sin error ni pantalla negra', () => {
      brandsSignal.set([]);
      setup('video');

      vi.advanceTimersByTime(CLASSIC_DWELL_MS + 5000);
      fixture.detectChanges();

      expect(component.isShowingVideo()).toBe(false);
      expect(fixture.nativeElement.querySelector('video')).toBeNull();
    });
  });

  describe('Interacción y Dismiss', () => {
    it('un toque en el protector emite dismiss y reanuda BGM', () => {
      setup('classic');

      const dismissSpy = vi.fn();
      component.dismiss.subscribe(dismissSpy);

      fixture.nativeElement.dispatchEvent(new Event('pointerdown'));

      expect(dismissSpy).toHaveBeenCalled();
      expect(mockMediaPlayer.resumeBgm).toHaveBeenCalled();
    });
  });
});
