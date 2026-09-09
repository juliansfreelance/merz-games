import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SuperadminPinDialog } from './superadmin-pin-dialog';
import { SuperadminAuthService } from '../admin/superadmin-auth.service';
import { MediaPlayer } from '../../core/media/media-player';
import { SUPERADMIN_PIN } from '../admin/pin';
import { vi } from 'vitest';

describe('SuperadminPinDialog', () => {
  let fixture: ComponentFixture<SuperadminPinDialog>;
  let component: SuperadminPinDialog;
  let authService: SuperadminAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperadminPinDialog],
      providers: [
        SuperadminAuthService,
        {
          provide: MediaPlayer,
          useValue: {
            playSfx: vi.fn(),
            play: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SuperadminPinDialog);
    component = fixture.componentInstance;
    authService = TestBed.inject(SuperadminAuthService);
    fixture.detectChanges();
  });

  it('debe crearse y mostrar 6 ranuras de PIN vacías', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Funcionalidad en Desarrollo');
    const slots = el.querySelectorAll('span.rounded-full');
    expect(slots.length).toBe(6);
  });

  it('al ingresar PIN incorrecto muestra el mensaje de error y la pista', () => {
    // Ingresar 6 dígitos erróneos
    '123456'.split('').forEach((d) => component['appendDigit'](d));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component['error']()).toContain('PIN de superadministrador incorrecto');
    expect(el.textContent).toContain(authService.hint);
  });

  it('al ingresar 210726 emite unlocked y desbloquea el servicio', () => {
    const unlockedSpy = vi.fn();
    component.unlocked.subscribe(unlockedSpy);

    SUPERADMIN_PIN.split('').forEach((d) => component['appendDigit'](d));
    fixture.detectChanges();

    expect(unlockedSpy).toHaveBeenCalled();
    expect(authService.isUnlocked()).toBe(true);
  });

  it('al pulsar cancelar emite cancelled', () => {
    const cancelSpy = vi.fn();
    component.cancelled.subscribe(cancelSpy);

    component['cancel']();
    expect(cancelSpy).toHaveBeenCalled();
  });
});
