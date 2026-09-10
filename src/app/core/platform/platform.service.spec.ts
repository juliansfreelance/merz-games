import { TestBed } from '@angular/core/testing';
import { APP_VERSION } from './app-version';
import { PlatformService } from './platform.service';

describe('PlatformService', () => {
  let service: PlatformService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlatformService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to browser mode in test environment', () => {
    expect(service.isNative).toBe(false);
    expect(service.platformKind).toBe('browser');
    expect(service.appVersion()).toBe(APP_VERSION);
  });

  it('loadNativeVersion en navegador conserva APP_VERSION', async () => {
    await service.loadNativeVersion();
    expect(service.appVersion()).toBe(APP_VERSION);
  });

  it('restart en navegador recarga la pagina con window.location.reload', async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadSpy },
    });

    const restart = await service.restart();
    expect(restart.ok).toBe(true);
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('exit en navegador no aplica y reporta mensaje explicativo', async () => {
    const exit = await service.exit();
    expect(exit.ok).toBe(false);
    expect(exit.message).toContain('solo está disponible en la app de escritorio');
  });

  it('enterKiosk y leaveKiosk en navegador gestionan el modo y fullscreen', async () => {
    const requestFsSpy = vi.fn().mockResolvedValue(undefined);
    const exitFsSpy = vi.fn().mockResolvedValue(undefined);

    document.documentElement.requestFullscreen = requestFsSpy;
    document.exitFullscreen = exitFsSpy;

    const enter = await service.enterKiosk();
    expect(enter.ok).toBe(true);
    expect(service.isKiosk()).toBe(true);

    const leave = await service.leaveKiosk();
    expect(leave.ok).toBe(true);
    expect(service.isKiosk()).toBe(false);

    await service.toggleKiosk();
    expect(service.isKiosk()).toBe(true);
  });
});
