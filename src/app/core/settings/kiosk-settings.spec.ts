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

  it('JSON corrupto en storage debe usar defaults sin lanzar error', () => {
    const initial = { [SETTINGS_KEY]: '{invalid-json' };
    const { settings } = buildSettings(initial);
    expect(settings.screensaverMode()).toBe<ScreensaverMode>('classic');
    expect(settings.soundEnabled()).toBe(true);
    expect(settings.memoryPairs()).toBeNull();
  });

  it('inicializa soundEnabled en true y memoryPairs en null por defecto', () => {
    const { settings } = buildSettings();
    expect(settings.soundEnabled()).toBe(true);
    expect(settings.memoryPairs()).toBeNull();
  });

  it('setSoundEnabled() actualiza el Signal', () => {
    const { settings } = buildSettings();
    settings.setSoundEnabled(false);
    expect(settings.soundEnabled()).toBe(false);
    settings.setSoundEnabled(true);
    expect(settings.soundEnabled()).toBe(true);
  });

  it('setMemoryPairs() actualiza el Signal y acepta null', () => {
    const { settings } = buildSettings();
    settings.setMemoryPairs(5);
    expect(settings.memoryPairs()).toBe(5);
    settings.setMemoryPairs(null);
    expect(settings.memoryPairs()).toBeNull();
  });

  it('round-trip: persiste y restaura soundEnabled y memoryPairs', () => {
    const store: Record<string, string> = {};
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
    const s1 = TestBed.inject(KioskSettings);
    s1.setSoundEnabled(false);
    s1.setMemoryPairs(3);
    TestBed.flushEffects();
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        KioskSettings,
        AppLogger,
        { provide: PlatformService, useValue: mockPlatform },
      ],
    });
    const s2 = TestBed.inject(KioskSettings);
    expect(s2.soundEnabled()).toBe(false);
    expect(s2.memoryPairs()).toBe(3);
  });

  it('triquiDifficulty inicializa en null y se actualiza con setTriquiDifficulty', () => {
    const { settings } = buildSettings();
    expect(settings.triquiDifficulty()).toBeNull();
    settings.setTriquiDifficulty('hard');
    expect(settings.triquiDifficulty()).toBe('hard');
    settings.setTriquiDifficulty(null);
    expect(settings.triquiDifficulty()).toBeNull();
  });

  it('triquiFirstPlayer inicializa en null y se actualiza con setTriquiFirstPlayer', () => {
    const { settings } = buildSettings();
    expect(settings.triquiFirstPlayer()).toBeNull();
    settings.setTriquiFirstPlayer('alternate');
    expect(settings.triquiFirstPlayer()).toBe('alternate');
    settings.setTriquiFirstPlayer(null);
    expect(settings.triquiFirstPlayer()).toBeNull();
  });

  it('round-trip: persiste y restaura triquiDifficulty y triquiFirstPlayer', () => {
    const store: Record<string, string> = {};
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
    const s1 = TestBed.inject(KioskSettings);
    s1.setTriquiDifficulty('easy');
    s1.setTriquiFirstPlayer('random');
    TestBed.flushEffects();
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        KioskSettings,
        AppLogger,
        { provide: PlatformService, useValue: mockPlatform },
      ],
    });
    const s2 = TestBed.inject(KioskSettings);
    expect(s2.triquiDifficulty()).toBe('easy');
    expect(s2.triquiFirstPlayer()).toBe('random');
  });

  it('permite overrides por experiencia específicos', () => {
    const { settings } = buildSettings();
    expect(settings.getExperienceMemoryPairs('radiesse-memory')).toBeNull();

    settings.setExperienceMemoryPairs('radiesse-memory', 5);
    expect(settings.getExperienceMemoryPairs('radiesse-memory')).toBe(5);
    // Otras experiencias siguen en null (o default)
    expect(settings.getExperienceMemoryPairs('ultherapy-memory')).toBeNull();

    settings.setExperienceTriquiDifficulty('radiesse-triqui', 'hard');
    expect(settings.getExperienceTriquiDifficulty('radiesse-triqui')).toBe('hard');
    expect(settings.getExperienceTriquiDifficulty('ultherapy-triqui')).toBeNull();

    settings.setExperienceTriquiFirstPlayer('radiesse-triqui', 'alternate');
    expect(settings.getExperienceTriquiFirstPlayer('radiesse-triqui')).toBe('alternate');
    expect(settings.getExperienceTriquiFirstPlayer('ultherapy-triqui')).toBeNull();

    // Memory config completo (pairs + lives + difficulty)
    expect(settings.getExperienceMemoryConfig('radiesse-memory')).toEqual({ pairs: 5 });
    settings.setExperienceMemoryConfig('ultherapy-memory', {
      pairs: 6,
      lives: 8,
      difficulty: 'easy',
    });
    expect(settings.getExperienceMemoryConfig('ultherapy-memory')).toEqual({
      pairs: 6,
      lives: 8,
      difficulty: 'easy',
    });
    // Limpiar override de memoria
    settings.setExperienceMemoryConfig('ultherapy-memory', null);
    expect(settings.getExperienceMemoryConfig('ultherapy-memory')).toBeNull();
  });

  it('resetToDefault restablece todos los ajustes y borra overrides por experiencia', () => {
    const { settings, store } = buildSettings();

    // Modificar configuraciones
    settings.setMemoryPairs(5);
    settings.setTriquiDifficulty('hard');
    settings.setTriquiFirstPlayer('alternate');
    settings.setSoundEnabled(false);
    settings.setScreensaverMode('video');
    settings.setExperienceMemoryPairs('radiesse-memory', 4);

    expect(settings.memoryPairs()).toBe(5);
    expect(settings.triquiDifficulty()).toBe('hard');
    expect(settings.soundEnabled()).toBe(false);
    expect(settings.screensaverMode()).toBe('video');
    expect(settings.getExperienceMemoryPairs('radiesse-memory')).toBe(4);

    // Restaurar por defecto
    settings.resetToDefault();

    expect(settings.memoryPairs()).toBeNull();
    expect(settings.triquiDifficulty()).toBeNull();
    expect(settings.triquiFirstPlayer()).toBeNull();
    expect(settings.soundEnabled()).toBe(true);
    expect(settings.screensaverMode()).toBe('classic');
    expect(settings.getExperienceMemoryPairs('radiesse-memory')).toBeNull();
  });
});
