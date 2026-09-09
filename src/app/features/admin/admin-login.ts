import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, minLength, required } from '@angular/forms/signals';
import { AdminSession } from './admin-session';
import { KioskButton } from '../shared/kiosk-button';
import { HeroIcon } from '../shared/hero-icon';
import { UiSfx } from '../shared/ui-sfx';
import { CatalogService } from '../../core/catalog/catalog';
import { verifyResetSuperadminPin } from './pin';

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * Login táctil del panel de administración (PIN local, sin PII).
 */
@Component({
  selector: 'app-admin-login',
  imports: [KioskButton, HeroIcon, UiSfx],
  host: {
    class: 'flex flex-col flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain',
    style: 'touch-action: pan-y; -webkit-overflow-scrolling: touch;',
    '[style.--panel-primary-color]': 'catalog.panelPrimaryColor()',
  },
  styles: [`
    :host {
      --panel-primary: var(--panel-primary-color, #fdc700);
    }
    .text-yellow-300, .text-yellow-400 { color: var(--panel-primary) !important; }
  `],
  template: `
    <div
      class="flex flex-col items-center justify-between flex-1 min-h-full w-full px-6 sm:px-12 lg:px-16 py-6 sm:py-8 text-white select-none gap-6 relative"
    >
      <div
        class="flex-1 flex flex-col items-center justify-center text-center gap-6 sm:gap-8 kiosk:gap-10 max-w-xl kiosk:max-w-2xl my-auto w-full"
      >
        <div
          class="w-20 h-20 sm:w-24 sm:h-24 kiosk:w-28 kiosk:h-28 rounded-3xl bg-white/5 border border-white/15 backdrop-blur-md flex items-center justify-center shadow-xl shadow-black/40"
        >
          <app-hero-icon name="cog-6-tooth" class="text-3xl sm:text-4xl kiosk:text-5xl text-white/80" />
        </div>

        <div class="space-y-2">
          <span
            class="inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm kiosk:text-base font-extrabold font-['Montserrat'] tracking-[0.35em] uppercase bg-white/10 text-white border border-white/20"
          >
            Administración
          </span>
          <h1
            class="text-2xl sm:text-3xl kiosk:text-4xl font-extrabold font-['Montserrat'] uppercase tracking-tight"
          >
            Acceso al panel
          </h1>
          <p class="text-neutral-300 text-sm sm:text-base kiosk:text-xl max-w-md mx-auto">
            Ingresa el PIN de la clínica (4 a 10 dígitos). No se pide nombre ni correo.
          </p>
        </div>

        <div class="w-full max-w-xs sm:max-w-sm relative flex items-center justify-center">
          <div
            class="w-full rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md px-6 py-4 font-mono text-2xl sm:text-3xl kiosk:text-4xl tracking-[0.3em] text-white overflow-hidden text-ellipsis whitespace-nowrap text-center pr-14"
            aria-live="polite"
          >
            {{ pinDisplay() }}
          </div>
          <button
            type="button"
            uiSfx="click"
            class="absolute right-3 size-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
            [attr.aria-label]="showPin() ? 'Ocultar PIN' : 'Ver PIN'"
            (click)="toggleShowPin()"
          >
            <app-hero-icon [name]="showPin() ? 'eye-slash' : 'eye'" class="text-xl" />
          </button>
        </div>

        @if (error()) {
          <p class="text-rose-300 text-sm sm:text-base kiosk:text-lg" role="alert">
            {{ error() }}
          </p>
        }

        <div class="grid grid-cols-3 gap-3 sm:gap-4 kiosk:gap-5 w-full max-w-sm kiosk:max-w-md">
          @for (key of pinKeys; track key) {
            <button
              type="button"
              uiSfx="click"
              class="min-h-16 sm:min-h-20 kiosk:min-h-24 rounded-2xl bg-white/8 border border-white/20 text-2xl sm:text-3xl kiosk:text-4xl font-bold active:scale-95 active:bg-white/20"
              style="touch-action: manipulation;"
              (click)="appendDigit(key)"
            >
              {{ key }}
            </button>
          }
          <button
            type="button"
            uiSfx="back"
            class="min-h-16 sm:min-h-20 kiosk:min-h-24 rounded-2xl bg-white/8 border border-white/20 active:scale-95 flex items-center justify-center text-center"
            style="touch-action: manipulation;"
            (click)="backspace()"
          >
            <app-hero-icon name="backspace" class="text-2xl sm:text-3xl kiosk:text-4xl text-white" />
          </button>
          <button
            type="button"
            uiSfx="click"
            class="min-h-16 sm:min-h-20 kiosk:min-h-24 rounded-2xl bg-white/8 border border-white/20 text-2xl sm:text-3xl kiosk:text-4xl font-bold active:scale-95"
            style="touch-action: manipulation;"
            (click)="appendDigit('0')"
          >
            0
          </button>
          <button
            type="button"
            uiSfx="click"
            class="min-h-16 sm:min-h-20 kiosk:min-h-24 rounded-2xl bg-white/15 border border-white/30 active:scale-95 flex items-center justify-center text-center text-yellow-300"
            style="touch-action: manipulation;"
            (click)="submitPin()"
          >
            <app-hero-icon name="paper-airplane" class="text-2xl sm:text-3xl kiosk:text-4xl text-yellow-300" />
          </button>
        </div>

        <button
          type="button"
          uiSfx="click"
          class="text-xs sm:text-sm font-semibold text-neutral-300 hover:text-white underline underline-offset-4 active:scale-95 transition-all pt-1"
          (click)="openRecovery()"
        >
          ¿Olvidaste tu PIN?
        </button>
      </div>

      <div class="w-full max-w-xs sm:max-w-md pb-4">
        <app-kiosk-button variant="ghost" (click)="goBack()">
          <app-hero-icon name="arrow-left" />
          Volver
        </app-kiosk-button>
      </div>
    </div>

    <!-- Modal de Recuperación / Restablecimiento de PIN -->
    @if (showRecoveryModal()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
        style="background: rgba(3, 7, 18, 0.72); backdrop-filter: blur(20px);"
      >
        <div
          class="w-full max-w-lg rounded-3xl bg-neutral-900/90 border border-white/20 p-6 sm:p-8 space-y-6 text-white shadow-2xl backdrop-blur-md"
        >
          <div class="flex items-center justify-between border-b border-white/10 pb-4">
            <div class="flex items-center gap-3">
              <div class="size-10 sm:size-12 aspect-square rounded-xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center shrink-0">
                <app-hero-icon name="lock-open" class="text-lg sm:text-xl text-yellow-400" />
              </div>
              <div>
                <h2 class="text-lg sm:text-xl font-bold font-['Montserrat'] uppercase">
                  Restablecer PIN
                </h2>
                <p class="text-xs text-neutral-400">Recuperación de acceso administrativo</p>
              </div>
            </div>
          </div>

          @if (pinHint()) {
            <div class="p-4 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-200 space-y-1">
              <span class="font-bold text-xs uppercase tracking-wider text-yellow-400 block flex items-center gap-1.5">
                <app-hero-icon name="light-bulb" class="text-sm" />
                Frase de recordación guardada:
              </span>
              <p class="italic text-sm sm:text-base text-white font-medium">"{{ pinHint() }}"</p>
            </div>
          }

          <p class="text-neutral-300 text-xs sm:text-sm">
            Si no recuerdas tu PIN, ingresa la clave de superadministrador de restablecimiento para restaurar el PIN a su valor por defecto (<strong>2580</strong>).
          </p>

          <div class="relative w-full flex items-center justify-center">
            <div
              class="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 font-mono text-xl sm:text-2xl tracking-[0.3em] text-white text-center pr-12"
            >
              {{ recoveryPinDisplay() }}
            </div>
            <button
              type="button"
              uiSfx="click"
              class="absolute right-3 size-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
              [attr.aria-label]="showRecoveryPin() ? 'Ocultar PIN' : 'Ver PIN'"
              (click)="toggleShowRecoveryPin()"
            >
              <app-hero-icon [name]="showRecoveryPin() ? 'eye-slash' : 'eye'" class="text-lg" />
            </button>
          </div>

          @if (recoveryError()) {
            <p class="text-rose-400 text-xs sm:text-sm text-center font-medium">
              {{ recoveryError() }}
            </p>
          }

          @if (recoverySuccess()) {
            <p class="text-emerald-400 text-xs sm:text-sm text-center font-medium">
              {{ recoverySuccess() }}
            </p>
          }

          <!-- Teclado Numérico del Modal -->
          <div class="grid grid-cols-3 gap-2.5 max-w-xs mx-auto w-full">
            @for (key of pinKeys; track key) {
              <button
                type="button"
                uiSfx="click"
                class="min-h-12 rounded-xl bg-white/10 border border-white/20 text-lg font-bold active:scale-95"
                (click)="appendRecoveryDigit(key)"
              >
                {{ key }}
              </button>
            }
            <button
              type="button"
              uiSfx="back"
              class="min-h-12 rounded-xl bg-white/10 border border-white/20 text-xs font-bold uppercase active:scale-95 flex items-center justify-center"
              (click)="recoveryBackspace()"
            >
              <app-hero-icon name="backspace" class="text-lg" />
            </button>
            <button
              type="button"
              uiSfx="click"
              class="min-h-12 rounded-xl bg-white/10 border border-white/20 text-lg font-bold active:scale-95"
              (click)="appendRecoveryDigit('0')"
            >
              0
            </button>
            <button
              type="button"
              uiSfx="click"
              class="min-h-12 rounded-xl bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 font-bold active:scale-95 flex items-center justify-center"
              (click)="submitRecovery()"
            >
              <app-hero-icon name="paper-airplane" class="text-lg text-yellow-300" />
            </button>
          </div>

          <div class="flex justify-end gap-3 pt-2 border-t border-white/10">
            <app-kiosk-button variant="ghost" (click)="closeRecovery()">
              Cerrar
            </app-kiosk-button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminLogin {
  protected readonly catalog = inject(CatalogService);
  protected readonly session = inject(AdminSession);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pinKeys = PIN_KEYS;
  protected readonly error = signal('');
  protected readonly submitting = signal(false);

  protected readonly pinModel = signal({ pin: '' });
  protected readonly pinForm = form(this.pinModel, (schemaPath) => {
    required(schemaPath.pin, { message: 'Ingresa el PIN' });
    minLength(schemaPath.pin, 4, { message: 'El PIN tiene al menos 4 dígitos' });
  });

  protected readonly showRecoveryModal = signal(false);
  protected readonly recoveryPin = signal('');
  protected readonly recoveryError = signal('');
  protected readonly recoverySuccess = signal('');

  protected readonly showPin = signal(false);
  protected readonly showRecoveryPin = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.pinModel.set({ pin: '' });
    });
  }

  protected toggleShowPin(): void {
    this.showPin.update((v) => !v);
  }

  protected toggleShowRecoveryPin(): void {
    this.showRecoveryPin.update((v) => !v);
  }

  protected pinDisplay(): string {
    const pin = this.pinModel().pin;
    if (!pin) return '····';
    return this.showPin() ? pin : '•'.repeat(pin.length);
  }

  protected appendDigit(digit: string): void {
    this.error.set('');
    const current = this.pinModel().pin;
    if (current.length >= 10) return;
    this.pinModel.set({ pin: current + digit });
  }

  protected backspace(): void {
    this.error.set('');
    this.pinModel.set({ pin: this.pinModel().pin.slice(0, -1) });
  }

  protected async submitPin(): Promise<void> {
    if (this.submitting()) return;
    if (this.pinForm().invalid()) {
      this.error.set('Ingresa un PIN de al menos 4 dígitos.');
      return;
    }

    this.submitting.set(true);
    const pin = this.pinModel().pin;
    this.pinModel.set({ pin: '' });
    try {
      const ok = await this.session.login(pin);
      if (ok) {
        await this.router.navigateByUrl('/admin');
        return;
      }
      this.error.set('PIN incorrecto. Intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected goBack(): void {
    this.session.logout();
    void this.router.navigateByUrl('/welcome');
  }

  protected openRecovery(): void {
    this.showRecoveryModal.set(true);
    this.recoveryPin.set('');
    this.recoveryError.set('');
    this.recoverySuccess.set('');
  }

  protected closeRecovery(): void {
    this.showRecoveryModal.set(false);
    this.recoveryPin.set('');
    this.recoveryError.set('');
    this.recoverySuccess.set('');
  }

  protected pinHint(): string {
    return this.session.getPinHint();
  }

  protected recoveryPinDisplay(): string {
    const pin = this.recoveryPin();
    if (!pin) return '····';
    return this.showRecoveryPin() ? pin : '•'.repeat(pin.length);
  }

  protected appendRecoveryDigit(digit: string): void {
    this.recoveryError.set('');
    const current = this.recoveryPin();
    if (current.length >= 10) return;
    this.recoveryPin.set(current + digit);
  }

  protected recoveryBackspace(): void {
    this.recoveryError.set('');
    this.recoveryPin.set(this.recoveryPin().slice(0, -1));
  }

  protected submitRecovery(): void {
    const pin = this.recoveryPin();
    const expected = this.catalog.resetSuperadminPin();
    if (verifyResetSuperadminPin(pin, expected)) {
      this.session.resetPinToDefault();
      this.recoverySuccess.set('¡PIN restablecido a 2580 por defecto con éxito!');
      this.recoveryError.set('');
      setTimeout(() => {
        this.closeRecovery();
      }, 1500);
    } else {
      this.recoveryError.set('Clave de restablecimiento incorrecta.');
    }
  }
}
