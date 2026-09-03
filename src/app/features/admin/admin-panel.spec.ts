import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { AdminPanel, MENU_OPTIONS, MenuOption } from './admin-panel';
import { AdminSession } from './admin-session';
import { CatalogService } from '../../core/catalog/catalog';
import { PlatformService } from '../../core/platform/platform.service';
import { UpdateCoordinator } from '../../core/update/update-coordinator';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { MediaPlayer } from '../../core/media/media-player';

describe('AdminPanel', () => {
  let fixture: ComponentFixture<AdminPanel>;
  let component: AdminPanel;
  let mockRouter: { navigateByUrl: ReturnType<typeof vi.fn> };
  let mockSession: { logout: ReturnType<typeof vi.fn>; changePin: ReturnType<typeof vi.fn> };
  let mockPlatform: {
    isNative: boolean;
    appVersion: ReturnType<typeof signal<string>>;
    platformKind: string;
    storageGet: ReturnType<typeof vi.fn>;
    storageSet: ReturnType<typeof vi.fn>;
    restart: ReturnType<typeof vi.fn>;
    exit: ReturnType<typeof vi.fn>;
    leaveKiosk: ReturnType<typeof vi.fn>;
  };
  let mockUpdates: {
    snapshot: ReturnType<typeof signal<any>>;
    check: ReturnType<typeof vi.fn>;
    apply: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockRouter = { navigateByUrl: vi.fn() };
    mockSession = { logout: vi.fn(), changePin: vi.fn().mockResolvedValue(true) };
    mockPlatform = {
      isNative: false,
      appVersion: signal('0.1.0'),
      platformKind: 'browser',
      storageGet: vi.fn().mockReturnValue(null),
      storageSet: vi.fn(),
      restart: vi.fn().mockResolvedValue({ ok: true }),
      exit: vi.fn().mockResolvedValue({ ok: true }),
      leaveKiosk: vi.fn().mockResolvedValue({ ok: true }),
    };
    mockUpdates = {
      snapshot: signal({
        status: 'idle',
        appVersion: '0.1.0',
        appUpdateAvailable: false,
        remoteAppVersion: null,
        catalogDiff: null,
        pendingAssets: [],
        errorMessage: null,
      }),
      check: vi.fn(),
      apply: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AdminPanel],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AdminSession, useValue: mockSession },
        { provide: PlatformService, useValue: mockPlatform },
        { provide: UpdateCoordinator, useValue: mockUpdates },
        CatalogService,
        KioskSettings,
        MediaPlayer,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('debe crearse y mostrar la lista de 5 opciones de menú por defecto', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(component).toBeTruthy();

    const menuButtons = el.querySelectorAll('main button[uisfx="select"]');
    expect(menuButtons.length).toBe(5);

    expect(el.textContent).toContain('Operación');
    expect(el.textContent).toContain('Ajustes de juego');
    expect(el.textContent).toContain('Diagnóstico');
    expect(el.textContent).toContain('Actualizaciones');
    expect(el.textContent).toContain('Seguridad / PIN');
  });

  it('debe navegar a la sub-página al pulsar una opción de menú', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const settingsButton = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Ajustes de juego'),
    ) as HTMLButtonElement | undefined;

    expect(settingsButton).toBeTruthy();
    settingsButton?.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Ajustes Generales');
    expect(el.textContent).toContain('Encuentra la Pareja (Memoria)');
    expect(el.textContent).toContain('Triqui (Tres en Raya)');

    // Abrir Ajustes Generales
    const generalButton = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Ajustes Generales'),
    ) as HTMLButtonElement | undefined;
    generalButton?.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Protector de pantalla');
    expect(el.textContent).toContain('Audio General');
  });

  it('el botón volver en header debe regresar al menú si está en una sub-página', async () => {
    fixture.detectChanges();
    // Abrir sección diagnóstico
    const el = fixture.nativeElement as HTMLElement;
    const diagButton = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Diagnóstico'),
    ) as HTMLButtonElement | undefined;
    diagButton?.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Diagnóstico del Sistema');

    // Pulsar botón volver en header
    const headerBackButton = el.querySelector('header button[uisfx="back"]') as HTMLButtonElement;
    expect(headerBackButton).toBeTruthy();
    headerBackButton.click();
    fixture.detectChanges();

    // Vuelve al menú
    expect(el.textContent).toContain('Panel Administrativo');
  });

  it('el botón volver en header debe salir del panel y hacer logout en el menú principal', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const headerExitButton = el.querySelector('header button[uisfx="back"]') as HTMLButtonElement;
    expect(headerExitButton).toBeTruthy();
    expect(headerExitButton.textContent).toContain('Salir');
    headerExitButton.click();

    expect(mockSession.logout).toHaveBeenCalled();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/welcome');
  });

  it('al pulsar el número de versión en el header debe entrar de una a diagnóstico', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Verificar que el botón volver del header tiene clase text-white
    const backBtn = el.querySelector('header button[uisfx="back"]') as HTMLButtonElement;
    expect(backBtn.className).toContain('text-white');

    // Botón de versión interactivo destacado
    const versionBtn = el.querySelector('header button[aria-label*="diagnóstico"]') as HTMLButtonElement;
    expect(versionBtn).toBeTruthy();
    expect(versionBtn.textContent).toContain('v0.1.0');
    expect(versionBtn.className).toContain('text-yellow-400');

    // Al hacer click, entra de una a Diagnóstico
    versionBtn.click();
    fixture.detectChanges();

    expect(component['activeSection']()).toBe('diagnostics');
    expect(el.textContent).toContain('Diagnóstico del Sistema');
  });

  it('permite cambiar volumen de BGM y SFX con feedback de toast', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const settingsButton = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Ajustes de juego'),
    ) as HTMLButtonElement | undefined;
    settingsButton?.click();
    fixture.detectChanges();

    const generalButton = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Ajustes Generales'),
    ) as HTMLButtonElement | undefined;
    generalButton?.click();
    fixture.detectChanges();

    const rangeSliders = el.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
    expect(rangeSliders.length).toBe(3); // BGM, SFX, Videos de atracción

    const bgmSlider = rangeSliders[0];
    bgmSlider.value = '65';
    bgmSlider.dispatchEvent(new Event('input'));
    bgmSlider.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(el.textContent).toContain('65%');
    expect(el.textContent).toContain('Volumen BGM');
  });

  it('permite navegar a Triqui por marca, muestra switch de juego activo y desactiva la opción por defecto duplicada', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Entrar a Ajustes de juego
    const settingsBtn = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Ajustes de juego'),
    ) as HTMLButtonElement;
    settingsBtn.click();
    fixture.detectChanges();

    // Seleccionar Triqui
    const triquiBtn = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Triqui (Tres en Raya)'),
    ) as HTMLButtonElement;
    triquiBtn.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Triqui · Seleccionar Marca');

    // Seleccionar marca Radiesse
    const radiesseBtn = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Radiesse'),
    ) as HTMLButtonElement;
    radiesseBtn.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Triqui · Radiesse');
    expect(el.textContent).toContain('Juego en esta marca');
    expect(el.textContent).toContain('Opción por defecto');

    // La opción 'Medio' (por defecto en el motor) debe tener disabled
    const medioBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Medio') && !b.textContent?.includes('Opción por defecto'),
    ) as HTMLButtonElement;
    expect(medioBtn).toBeTruthy();
    expect(medioBtn.disabled).toBe(true);

    // Conmutar el switch de estado del juego
    const catalog = TestBed.inject(CatalogService);
    const setExpSpy = vi.spyOn(catalog, 'setExperienceEnabled');
    const switchBtn = el.querySelector('button[aria-label*="juego para esta marca"]') as HTMLButtonElement;
    expect(switchBtn).toBeTruthy();
    switchBtn.click();
    fixture.detectChanges();

    expect(setExpSpy).toHaveBeenCalledWith('radiesse-triqui', false);
  });

  it('el cambio de PIN solicita confirmación antes de guardar', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const pinMenuButton = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Seguridad / PIN'),
    ) as HTMLButtonElement | undefined;
    pinMenuButton?.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('1. Ingrese su PIN anterior');
    expect(el.textContent).toContain('2. Ingrese su nuevo PIN');
    expect(el.textContent).toContain('3. Repita su nuevo PIN');

    // Introducir PIN actual
    component['pinModel'].set({ current: '2580', next: '1234', confirm: '1234' });
    fixture.detectChanges();

    // Guardar
    component['requestPinChange']();
    fixture.detectChanges();

    expect(component['confirmKind']()).toBe('changePin');
    expect(el.querySelector('app-admin-confirm')).toBeTruthy();
  });

  it('permite acceder a Marcas del Kiosco y conmutar el estado de activación de una marca', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Entrar a Ajustes de juego
    const settingsBtn = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Ajustes de juego'),
    ) as HTMLButtonElement;
    settingsBtn.click();
    fixture.detectChanges();

    // Entrar a Marcas del Kiosco
    const brandsGlobalBtn = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Marcas del Kiosco'),
    ) as HTMLButtonElement;
    expect(brandsGlobalBtn).toBeTruthy();
    brandsGlobalBtn.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Marcas del Kiosco');
    expect(el.textContent).toContain('Activa o desactiva las marcas disponibles');

    // Conmutar marca Radiesse
    const catalog = TestBed.inject(CatalogService);
    const setBrandSpy = vi.spyOn(catalog, 'setBrandEnabled');
    const radiesseSwitch = el.querySelector('button[aria-label*="marca Radiesse"]') as HTMLButtonElement;
    expect(radiesseSwitch).toBeTruthy();
    radiesseSwitch.click();
    fixture.detectChanges();

    expect(setBrandSpy).toHaveBeenCalledWith('radiesse', false);

    // Volver con el header regresa al submenú de ajustes
    const backBtn = el.querySelector('header button') as HTMLButtonElement;
    backBtn.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Ajustes Generales');
    expect(el.textContent).toContain('Marcas del Kiosco');
  });

  it('debe configurar los iconos exactos solicitados para el menú principal y la sección de operación', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Verificar iconos del menú principal
    expect(MENU_OPTIONS.find((m: MenuOption) => m.id === 'operations')?.icon).toBe('power');
    expect(MENU_OPTIONS.find((m: MenuOption) => m.id === 'settings')?.icon).toBe('adjustments-horizontal');
    expect(MENU_OPTIONS.find((m: MenuOption) => m.id === 'diagnostics')?.icon).toBe('cpu-chip');
    expect(MENU_OPTIONS.find((m: MenuOption) => m.id === 'updates')?.icon).toBe('cloud-arrow-down');
    expect(MENU_OPTIONS.find((m: MenuOption) => m.id === 'pin')?.icon).toBe('key');

    // Abrir Operación
    const opButton = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Operación'),
    ) as HTMLButtonElement | undefined;
    expect(opButton).toBeTruthy();
    opButton?.click();
    fixture.detectChanges();

    // Comprobar elementos en Operación
    expect(el.textContent).toContain('Reiniciar aplicación');
    expect(el.textContent).toContain('Cerrar aplicación');
    expect(el.textContent).toContain('Salir del modo kiosco');

    // Comprobar que existe la nota de advertencia con exclamation-triangle
    const note = el.querySelector('.bg-yellow-500\\/10');
    expect(note).toBeTruthy();
    expect(note?.querySelector('app-hero-icon')?.getAttribute('name')).toBe('exclamation-triangle');
  });

  it('debe permitir restaurar los valores por defecto del catálogo y ajustes mediante diálogo de confirmación', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Ir a Ajustes de juego
    const settingsBtn = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Ajustes de juego'),
    ) as HTMLButtonElement | undefined;
    expect(settingsBtn).toBeTruthy();
    settingsBtn?.click();
    fixture.detectChanges();

    // Encontrar botón "Restaurar por defecto"
    const resetBtn = Array.from(el.querySelectorAll('main button')).find((b) =>
      b.textContent?.includes('Restaurar por defecto'),
    ) as HTMLButtonElement | undefined;
    expect(resetBtn).toBeTruthy();

    const catalog = TestBed.inject(CatalogService);
    const settings = TestBed.inject(KioskSettings);
    const catalogResetSpy = vi.spyOn(catalog, 'resetToDefault');
    const settingsResetSpy = vi.spyOn(settings, 'resetToDefault');

    // Pulsar botón
    resetBtn?.click();
    fixture.detectChanges();

    // Comprobar diálogo de confirmación
    const confirmDialog = el.querySelector('app-admin-confirm');
    expect(confirmDialog).toBeTruthy();
    expect(confirmDialog?.textContent).toContain('¿Restaurar valores por defecto?');
    expect(confirmDialog?.textContent).toContain('content-manifest.json');

    // Confirmar en el diálogo
    const confirmBtn = Array.from(confirmDialog!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Restaurar'),
    ) as HTMLButtonElement | undefined;
    expect(confirmBtn).toBeTruthy();
    confirmBtn?.click();
    fixture.detectChanges();

    expect(catalogResetSpy).toHaveBeenCalledTimes(1);
    expect(settingsResetSpy).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Valores restaurados');
  });

  describe('Configuración de Memoria en AdminPanel', () => {
    it('changeMemoryPairsStep incrementa/decrementa parejas y recalcula vidas con preset activo', () => {
      const exp = { id: 'test-mem', brandId: 'b1', gameId: 'memory', config: { pairs: 4, lives: 4, difficulty: 'medium' } } as any;
      component['selectMemoryDifficulty'](exp, 'easy', 'Marca Test');
      let cfg = component['getEffectiveMemoryConfig'](exp);
      expect(cfg.pairs).toBe(4);
      expect(cfg.difficulty).toBe('easy');
      expect(cfg.lives).toBe(6);

      // Incrementar parejas a 5: en 'easy', recalcula vidas a 8
      component['changeMemoryPairsStep'](exp, 1, 'Marca Test');
      cfg = component['getEffectiveMemoryConfig'](exp);
      expect(cfg.pairs).toBe(5);
      expect(cfg.difficulty).toBe('easy');
      expect(cfg.lives).toBe(8);
    });

    it('changeMemoryLivesStep establece dificultad a "custom"', () => {
      const exp = { id: 'test-mem', brandId: 'b1', gameId: 'memory', config: { pairs: 4, lives: 4, difficulty: 'medium' } } as any;
      component['changeMemoryLivesStep'](exp, 1, 'Marca Test');
      const cfg = component['getEffectiveMemoryConfig'](exp);
      expect(cfg.lives).toBe(5);
      expect(cfg.difficulty).toBe('custom');
      expect(cfg.isCustomOverride).toBe(true);
    });

    it('resetExperienceMemoryToDefault restablece a la configuración del catálogo', () => {
      const exp = { id: 'test-mem', brandId: 'b1', gameId: 'memory', config: { pairs: 4, lives: 4, difficulty: 'medium' } } as any;
      component['changeMemoryLivesStep'](exp, 2, 'Marca Test');
      expect(component['getEffectiveMemoryConfig'](exp).isCustomOverride).toBe(true);

      component['resetExperienceMemoryToDefault'](exp, 'Marca Test');
      expect(component['getEffectiveMemoryConfig'](exp).isCustomOverride).toBe(false);
      expect(component['getEffectiveMemoryConfig'](exp).lives).toBe(4);
    });
  });

  describe('Fase 8: Protector de pantalla y video en AdminPanel', () => {
    it('changeScreensaver actualiza el modo y el copy explicativo', () => {
      component['changeScreensaver']('video');
      const settings = TestBed.inject(KioskSettings);
      expect(settings.screensaverMode()).toBe('video');

      expect(component['screensaverExplanation']('classic')).toContain('Cero videos');
      expect(component['screensaverExplanation']('video')).toContain('Playlist intercalada');
    });

    it('adjustIdleTime incrementa y decrementa en pasos de 30 segundos respetando límites', () => {
      const settings = TestBed.inject(KioskSettings);
      settings.setScreensaverIdleMs(180_000);

      component['adjustIdleTime'](30_000);
      expect(settings.screensaverIdleMs()).toBe(210_000);
      expect(component['formatIdleTime'](210_000)).toBe('3 min 30 s');

      component['adjustIdleTime'](-60_000);
      expect(settings.screensaverIdleMs()).toBe(150_000);
      expect(component['formatIdleTime'](150_000)).toBe('2 min 30 s');

      expect(component['formatIdleTime'](60_000)).toBe('1 minuto');
      expect(component['formatIdleTime'](30_000)).toBe('30 s');
    });

    it('changeVideoOrder actualiza a "random" y "sequential"', () => {
      const settings = TestBed.inject(KioskSettings);
      component['changeVideoOrder']('random');
      expect(settings.screensaverVideoOrder()).toBe('random');
      expect(component['videoOrderExplanation']('random')).toContain('Al azar');

      component['changeVideoOrder']('sequential');
      expect(settings.screensaverVideoOrder()).toBe('sequential');
      expect(component['videoOrderExplanation']('sequential')).toContain('Ordenado');
    });

    it('onVideoVolumeInput actualiza el volumen de video en KioskSettings', () => {
      const settings = TestBed.inject(KioskSettings);
      const event = { target: { value: '75' } } as unknown as Event;

      component['onVideoVolumeInput'](event);
      expect(settings.videoVolume()).toBe(0.75);
    });
  });
});
