import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickSettingsDialog } from './quick-settings-dialog';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { MediaPlayer } from '../../core/media/media-player';
import { PlatformService } from '../../core/platform/platform.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('QuickSettingsDialog', () => {
  let component: QuickSettingsDialog;
  let fixture: ComponentFixture<QuickSettingsDialog>;

  let mockKioskSettings: {
    soundEnabled: ReturnType<typeof signal<boolean>>;
    bgmVolume: ReturnType<typeof signal<number>>;
    sfxVolume: ReturnType<typeof signal<number>>;
    hasSessionAudioOverrides: ReturnType<typeof signal<boolean>>;
    setSessionSoundEnabled: ReturnType<typeof vi.fn>;
    setSessionBgmVolume: ReturnType<typeof vi.fn>;
    setSessionSfxVolume: ReturnType<typeof vi.fn>;
    clearSessionAudioOverrides: ReturnType<typeof vi.fn>;
  };

  let mockMediaPlayer: {
    playSfx: ReturnType<typeof vi.fn>;
  };

  let mockPlatform: {
    isKiosk: ReturnType<typeof signal<boolean>>;
    isNative: boolean;
    toggleKiosk: ReturnType<typeof vi.fn>;
    restart: ReturnType<typeof vi.fn>;
    exit: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockKioskSettings = {
      soundEnabled: signal(true),
      bgmVolume: signal(0.4),
      sfxVolume: signal(0.8),
      hasSessionAudioOverrides: signal(false),
      setSessionSoundEnabled: vi.fn((val: boolean) => {
        mockKioskSettings.soundEnabled.set(val);
        mockKioskSettings.hasSessionAudioOverrides.set(true);
      }),
      setSessionBgmVolume: vi.fn((vol: number) => {
        mockKioskSettings.bgmVolume.set(vol);
        mockKioskSettings.hasSessionAudioOverrides.set(true);
      }),
      setSessionSfxVolume: vi.fn((vol: number) => {
        mockKioskSettings.sfxVolume.set(vol);
        mockKioskSettings.hasSessionAudioOverrides.set(true);
      }),
      clearSessionAudioOverrides: vi.fn(() => {
        mockKioskSettings.hasSessionAudioOverrides.set(false);
      }),
    };

    mockMediaPlayer = {
      playSfx: vi.fn(),
    };

    mockPlatform = {
      isKiosk: signal(true),
      isNative: true,
      toggleKiosk: vi.fn().mockResolvedValue({ ok: true }),
      restart: vi.fn().mockResolvedValue({ ok: true }),
      exit: vi.fn().mockResolvedValue({ ok: true }),
    };

    await TestBed.configureTestingModule({
      imports: [QuickSettingsDialog],
      providers: [
        { provide: KioskSettings, useValue: mockKioskSettings },
        { provide: MediaPlayer, useValue: mockMediaPlayer },
        { provide: PlatformService, useValue: mockPlatform },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickSettingsDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('muestra el estado del audio y permite alternarlo para la sesión', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sonido Activado');

    component['toggleSound']();
    expect(mockKioskSettings.setSessionSoundEnabled).toHaveBeenCalledWith(false);
  });

  it('permite cambiar el volumen de BGM y SFX de la sesión', () => {
    const bgmEvent = { target: { value: '65' } } as unknown as Event;
    component['onBgmInput'](bgmEvent);
    expect(mockKioskSettings.setSessionBgmVolume).toHaveBeenCalledWith(0.65);

    const sfxEvent = { target: { value: '25' } } as unknown as Event;
    component['onSfxInput'](sfxEvent);
    expect(mockKioskSettings.setSessionSfxVolume).toHaveBeenCalledWith(0.25);
  });

  it('testSfx() reproduce un efecto de sonido para verificar volumen', () => {
    component['testSfx']();
    expect(mockMediaPlayer.playSfx).toHaveBeenCalled();
  });

  it('resetSessionAudio() restablece los valores del panel de control', () => {
    component['resetSessionAudio']();
    expect(mockKioskSettings.clearSessionAudioOverrides).toHaveBeenCalled();
  });

  it('onToggleKiosk() invoca platform.toggleKiosk()', async () => {
    await component['onToggleKiosk']();
    expect(mockPlatform.toggleKiosk).toHaveBeenCalled();
  });

  it('solicitar reinicio activa la confirmación y ejecutarla llama a platform.restart()', async () => {
    component['requestAction']('restart');
    expect(component['confirmAction']()).toBe('restart');

    await component['executeConfirmedAction']();
    expect(mockPlatform.restart).toHaveBeenCalled();
    expect(component['confirmAction']()).toBeNull();
  });

  it('solicitar cierre activa la confirmación y ejecutarla llama a platform.exit()', async () => {
    component['requestAction']('exit');
    expect(component['confirmAction']()).toBe('exit');

    await component['executeConfirmedAction']();
    expect(mockPlatform.exit).toHaveBeenCalled();
    expect(component['confirmAction']()).toBeNull();
  });

  it('cancelConfirm() cancela la confirmación sin ejecutar la acción', () => {
    component['requestAction']('restart');
    expect(component['confirmAction']()).toBe('restart');

    component['cancelConfirm']();
    expect(component['confirmAction']()).toBeNull();
    expect(mockPlatform.restart).not.toHaveBeenCalled();
  });

  it('emite closed al hacer clic en el backdrop', () => {
    let closed = false;
    component.closed.subscribe(() => {
      closed = true;
    });

    const backdrop = fixture.nativeElement.querySelector('[role="dialog"]');
    backdrop.click();
    expect(closed).toBe(true);
  });

  it('en web oculta el boton de cerrar y mantiene reiniciar y pantalla completa', () => {
    mockPlatform.isNative = false;
    fixture = TestBed.createComponent(QuickSettingsDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());

    expect(buttons.some((t) => t?.includes('Reiniciar'))).toBe(true);
    expect(buttons.some((t) => t?.includes('Salir Kiosco') || t?.includes('Pantalla Completa') || t?.includes('Modo Kiosco') || t?.includes('Restaurar'))).toBe(true);
    expect(buttons.some((t) => t?.includes('Cerrar') && t?.includes('Salir de la app'))).toBe(false);

    // Si sale de kiosco / pantalla completa, debe mostrar opción para activar Pantalla Completa
    mockPlatform.isKiosk.set(false);
    fixture.detectChanges();
    const updatedButtons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(updatedButtons.some((t) => t?.includes('Pantalla Completa'))).toBe(true);
  });
});
