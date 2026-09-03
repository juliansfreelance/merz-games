import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, minLength, required } from '@angular/forms/signals';
import { AdminSession } from './admin-session';
import { KioskButton } from '../shared/kiosk-button';
import { HeroIcon } from '../shared/hero-icon';
import { UiSfx } from '../shared/ui-sfx';

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
  },
  template: `
    <div
      class="flex flex-col items-center justify-between flex-1 min-h-full w-full px-6 sm:px-12 lg:px-16 py-6 sm:py-8 text-white select-none gap-6"
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
            Ingresa el PIN de la clínica. No se pide nombre ni correo.
          </p>
        </div>

        <div
          class="w-full max-w-xs sm:max-w-sm rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md px-6 py-4 font-mono text-3xl sm:text-4xl kiosk:text-5xl tracking-[0.4em] text-white"
          aria-live="polite"
        >
          {{ pinDisplay() }}
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
            class="min-h-16 sm:min-h-20 kiosk:min-h-24 rounded-2xl bg-white/8 border border-white/20 text-xs sm:text-sm kiosk:text-base font-bold uppercase tracking-wider active:scale-95 flex flex-col items-center justify-center gap-1 text-center"
            style="touch-action: manipulation;"
            (click)="backspace()"
          >
            <app-hero-icon name="backspace" class="text-2xl sm:text-3xl" />
            <span>Borrar</span>
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
            class="min-h-16 sm:min-h-20 kiosk:min-h-24 rounded-2xl bg-white/15 border border-white/30 text-xs sm:text-sm kiosk:text-base font-extrabold uppercase tracking-wider active:scale-95 flex flex-col items-center justify-center gap-1 text-center text-yellow-300"
            style="touch-action: manipulation;"
            (click)="submitPin()"
          >
            <app-hero-icon name="check" class="text-2xl sm:text-3xl text-yellow-300" />
            <span>Entrar</span>
          </button>
        </div>
      </div>

      <div class="w-full max-w-xs sm:max-w-md pb-4">
        <app-kiosk-button variant="ghost" (click)="goBack()">
          <app-hero-icon name="arrow-left" />
          Volver
        </app-kiosk-button>
      </div>
    </div>
  `,
})
export class AdminLogin {
  private readonly session = inject(AdminSession);
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

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.pinModel.set({ pin: '' });
    });
  }

  protected pinDisplay(): string {
    const length = this.pinModel().pin.length;
    return length === 0 ? '····' : '•'.repeat(length);
  }

  protected appendDigit(digit: string): void {
    this.error.set('');
    const current = this.pinModel().pin;
    if (current.length >= 8) return;
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
}
