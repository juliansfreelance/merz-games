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

  it('debe inicializar con el modo por defecto del manifest ("video")', () => {
    const { settings } = buildSettings();
    expect(settings.screensaverMode()).toBe<ScreensaverMode>('video');
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
    expect(settings.screensaverMode()).toBe<ScreensaverMode>('video');
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
    settings.setScreensaverMode('classic');
    settings.setExperienceMemoryPairs('radiesse-memory', 4);

    expect(settings.memoryPairs()).toBe(5);
    expect(settings.triquiDifficulty()).toBe('hard');
    expect(settings.soundEnabled()).toBe(false);
    expect(settings.screensaverMode()).toBe('classic');
    expect(settings.getExperienceMemoryPairs('radiesse-memory')).toBe(4);

    // Restaurar por defecto
    settings.resetToDefault();

    expect(settings.memoryPairs()).toBeNull();
    expect(settings.triquiDifficulty()).toBeNull();
    expect(settings.triquiFirstPlayer()).toBeNull();
    expect(settings.soundEnabled()).toBe(true);
    expect(settings.screensaverMode()).toBe('video');
    expect(settings.getExperienceMemoryPairs('radiesse-memory')).toBeNull();
  });

  describe('Fase 8: Ajustes del protector y video', () => {
    it('inicializa videoVolume en 0.5, order en "sequential" e idleMs en 180_000', () => {
      const { settings } = buildSettings();
      expect(settings.videoVolume()).toBe(0.5);
      expect(settings.screensaverVideoOrder()).toBe('sequential');
      expect(settings.screensaverIdleMs()).toBe(180_000);
    });

    it('setVideoVolume actualiza el Signal y aplica clamping entre 0 y 1', () => {
      const { settings } = buildSettings();
      settings.setVideoVolume(0.8);
      expect(settings.videoVolume()).toBe(0.8);

      settings.setVideoVolume(-0.5);
      expect(settings.videoVolume()).toBe(0);

      settings.setVideoVolume(1.5);
      expect(settings.videoVolume()).toBe(1);
    });

    it('setScreensaverVideoOrder actualiza a "random" y "sequential"', () => {
      const { settings } = buildSettings();
      settings.setScreensaverVideoOrder('random');
      expect(settings.screensaverVideoOrder()).toBe('random');

      settings.setScreensaverVideoOrder('sequential');
      expect(settings.screensaverVideoOrder()).toBe('sequential');
    });

    it('setScreensaverIdleMs aplica clamping entre 30s (30_000) y 15m (900_000)', () => {
      const { settings } = buildSettings();
      settings.setScreensaverIdleMs(60_000);
      expect(settings.screensaverIdleMs()).toBe(60_000);

      settings.setScreensaverIdleMs(10_000); // Demasiado bajo
      expect(settings.screensaverIdleMs()).toBe(30_000);

      settings.setScreensaverIdleMs(1_200_000); // Demasiado alto
      expect(settings.screensaverIdleMs()).toBe(900_000);

      settings.setScreensaverIdleMs(NaN); // Inválido -> fallback a default 180_000
      expect(settings.screensaverIdleMs()).toBe(180_000);
    });

    it('round-trip: persiste y recupera videoVolume, screensaverVideoOrder y screensaverIdleMs', () => {
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
      s1.setVideoVolume(0.25);
      s1.setScreensaverVideoOrder('random');
      s1.setScreensaverIdleMs(120_000);
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
      expect(s2.videoVolume()).toBe(0.25);
      expect(s2.screensaverVideoOrder()).toBe('random');
      expect(s2.screensaverIdleMs()).toBe(120_000);
    });

    it('resetToDefault restaura los ajustes de protector y video', () => {
      const { settings } = buildSettings();
      settings.setVideoVolume(0.9);
      settings.setScreensaverVideoOrder('random');
      settings.setScreensaverIdleMs(60_000);

      expect(settings.videoVolume()).toBe(0.9);
      expect(settings.screensaverVideoOrder()).toBe('random');
      expect(settings.screensaverIdleMs()).toBe(60_000);

      settings.resetToDefault();

      expect(settings.videoVolume()).toBe(0.5);
      expect(settings.screensaverVideoOrder()).toBe('sequential');
      expect(settings.screensaverIdleMs()).toBe(180_000);
    });
  });

  describe('Ajustes de Audio por Sesión', () => {
    it('inicia sin overrides de sesión y refleja los valores persistentes', () => {
      const { settings } = buildSettings();
      expect(settings.hasSessionAudioOverrides()).toBe(false);
      expect(settings.soundEnabled()).toBe(true);
      expect(settings.bgmVolume()).toBe(0.35);
      expect(settings.sfxVolume()).toBe(0.7);
    });

    it('setSessionSoundEnabled modifica el valor efectivo sin persistir en storage', () => {
      const store: Record<string, string> = {};
      const mockPlatform = {
        appVersion: signal('0.1.0'),
        storageGet: (key: string) => store[key] ?? null,
        storageSet: (key: string, value: string) => {
          store[key] = value;
        },
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          KioskSettings,
          AppLogger,
          { provide: PlatformService, useValue: mockPlatform },
        ],
      });
      const settings = TestBed.inject(KioskSettings);
      TestBed.flushEffects();

      settings.setSessionSoundEnabled(false);
      expect(settings.soundEnabled()).toBe(false);
      expect(settings.persistentSoundEnabled()).toBe(true);
      expect(settings.hasSessionAudioOverrides()).toBe(true);

      // El storage persistente NO debe haber cambiado a false
      const stored = JSON.parse(store[SETTINGS_KEY]);
      expect(stored.soundEnabled).toBe(true);
    });

    it('setSessionBgmVolume y setSessionSfxVolume modifican valores en memoria', () => {
      const { settings } = buildSettings();
      settings.setSessionBgmVolume(0.7);
      settings.setSessionSfxVolume(0.2);

      expect(settings.bgmVolume()).toBe(0.7);
      expect(settings.sfxVolume()).toBe(0.2);
      expect(settings.persistentBgmVolume()).toBe(0.35);
      expect(settings.persistentSfxVolume()).toBe(0.7);
      expect(settings.hasSessionAudioOverrides()).toBe(true);
    });

    it('clearSessionAudioOverrides restaura los valores configurados', () => {
      const { settings } = buildSettings();
      settings.setSessionSoundEnabled(false);
      settings.setSessionBgmVolume(0.9);
      settings.setSessionSfxVolume(0.1);

      expect(settings.hasSessionAudioOverrides()).toBe(true);
      expect(settings.soundEnabled()).toBe(false);

      settings.clearSessionAudioOverrides();

      expect(settings.hasSessionAudioOverrides()).toBe(false);
      expect(settings.soundEnabled()).toBe(true);
      expect(settings.bgmVolume()).toBe(0.35);
      expect(settings.sfxVolume()).toBe(0.7);
    });

    it('setSoundEnabled persistente limpia los overrides de sesión', () => {
      const { settings } = buildSettings();
      settings.setSessionSoundEnabled(false);
      expect(settings.soundEnabled()).toBe(false);

      settings.setSoundEnabled(true);
      expect(settings.hasSessionAudioOverrides()).toBe(false);
      expect(settings.soundEnabled()).toBe(true);
      expect(settings.persistentSoundEnabled()).toBe(true);
    });
  });

  describe('triquiPlayerSymbol en KioskSettings', () => {
    it('permite configurar y persistir "random" por experiencia', () => {
      const { settings } = buildSettings();
      expect(settings.getExperienceTriquiPlayerSymbol('radiesse-triqui')).toBeNull();

      settings.setExperienceTriquiPlayerSymbol('radiesse-triqui', 'random');
      expect(settings.getExperienceTriquiPlayerSymbol('radiesse-triqui')).toBe('random');

      settings.setExperienceTriquiPlayerSymbol('radiesse-triqui', 'O');
      expect(settings.getExperienceTriquiPlayerSymbol('radiesse-triqui')).toBe('O');

      settings.setExperienceTriquiPlayerSymbol('radiesse-triqui', null);
      expect(settings.getExperienceTriquiPlayerSymbol('radiesse-triqui')).toBeNull();
    });

    it('recupera triquiPlayerSymbol = "random" desde storage', () => {
      const initial = {
        [SETTINGS_KEY]: JSON.stringify({
          triquiPlayerSymbol: 'random',
        }),
      };
      const { settings } = buildSettings(initial);
      expect(settings.triquiPlayerSymbol()).toBe('random');
    });
  });
});
