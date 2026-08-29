import { TestBed } from '@angular/core/testing';
import { KioskSettings, ScreensaverMode } from './kiosk-settings';
import { PlatformService } from '../platform/platform.service';
import { AppLogger } from '../logging/app-error';
import { signal } from '@angular/core';

const SETTINGS_KEY = 'merz-games.kiosk-settings';

function buildSettings(initialStorage: Record<string, string> = {}) {
  const store = { ...initialStorage };
  const mockPlatform = {
    appVersion: signal('0.1.0'),
    storageGet: (key: string) => store[key] ?? null,
    storageSet: (key: string, value: string) => { store[key] = value; },
  };

  TestBed.configureTestingModule({
    providers: [
      KioskSettings,
      AppLogger,
      { provide: PlatformService, useValue: mockPlatform },
    ],
  });

  return {
    settings: TestBed.inject(KioskSettings),
    store,
  };
}

describe('KioskSettings', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('debe inicializar con "classic" por defecto', () => {
    const { settings } = buildSettings();
    expect(settings.screensaverMode()).toBe<ScreensaverMode>('classic');
  });

  it('debe recuperar "video" si estaba persistido', () => {
    const initial = {
      [SETTINGS_KEY]: JSON.stringify({ screensaverMode: 'video' }),
    };
    const { settings } = buildSettings(initial);
    expect(settings.screensaverMode()).toBe<ScreensaverMode>('video');
  });

  it('debe recuperar "classic" si estaba persistido', () => {
    const initial = {
      [SETTINGS_KEY]: JSON.stringify({ screensaverMode: 'classic' }),
    };
    const { settings } = buildSettings(initial);
    expect(settings.screensaverMode()).toBe<ScreensaverMode>('classic');
  });

  it('setScreensaverMode("video") actualiza el Signal', () => {
    const { settings } = buildSettings();
    settings.setScreensaverMode('video');
    expect(settings.screensaverMode()).toBe<ScreensaverMode>('video');
  });

  it('setScreensaverMode("classic") actualiza el Signal', () => {
    const { settings } = buildSettings();
    settings.setScreensaverMode('video');
    settings.setScreensaverMode('classic');
    expect(settings.screensaverMode()).toBe<ScreensaverMode>('classic');
  });

  it('round-trip: persiste y restaura "video"', () => {
    const store: Record<string, string> = {};
    const mockPlatform = {
      appVersion: signal('0.1.0'),
      storageGet: (key: string) => store[key] ?? null,
      storageSet: (key: string, value: string) => { store[key] = value; },
    };

    // Primera instancia: cambia a 'video' y fuerza el efecto de persistencia
    TestBed.configureTestingModule({
      providers: [
        KioskSettings,
        AppLogger,
        { provide: PlatformService, useValue: mockPlatform },
      ],
    });
    TestBed.inject(KioskSettings).setScreensaverMode('video');
    // Forzar ejecución del effect() para que escriba al store antes del reset
    TestBed.flushEffects();
    TestBed.resetTestingModule();

    // Segunda instancia: debe leer 'video' del store compartido
    TestBed.configureTestingModule({
      providers: [
        KioskSettings,
        AppLogger,
        { provide: PlatformService, useValue: mockPlatform },
      ],
    });
    const settings2 = TestBed.inject(KioskSettings);
    expect(settings2.screensaverMode()).toBe<ScreensaverMode>('video');
  });

  it('JSON corrupto en storage debe usar "classic"', () => {
    const initial = { [SETTINGS_KEY]: '{invalid-json' };
    const { settings } = buildSettings(initial);
    expect(settings.screensaverMode()).toBe<ScreensaverMode>('classic');
  });
});
