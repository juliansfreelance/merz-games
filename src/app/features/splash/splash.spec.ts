import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Splash } from './splash';
import { provideRouter } from '@angular/router';
import { MediaPlayer } from '../../core/media/media-player';

describe('Splash (Preloader)', () => {
  beforeEach(async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        load: vi.fn().mockResolvedValue([]),
      },
    });

    await TestBed.configureTestingModule({
      imports: [Splash],
      providers: [
        provideRouter([]),
        {
          provide: MediaPlayer,
          useValue: {
            playSfx: vi.fn(),
            preload: vi.fn(),
            preloadUntilReady: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Splash);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have a tappable area', () => {
    const fixture = TestBed.createComponent(Splash);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tapArea = el.querySelector('[role="button"]');
    expect(tapArea).toBeTruthy();
  });

  it('debe iniciar la precarga y actualizar el estado de progreso', () => {
    const fixture = TestBed.createComponent(Splash);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    expect(component.progress()).toBeGreaterThanOrEqual(15);
    expect(component.statusMessage()).toBeTruthy();
  });
});
