import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroIcon } from './hero-icon';
import { playUiSfx, UiSfx } from './ui-sfx';
import { SuperadminAuthService } from '../admin/superadmin-auth.service';
import { MediaPlayer } from '../../core/media/media-player';

/**
 * SuperadminPinDialog — Diálogo modal táctil para ingresar el PIN de superadministrador
 * y desbloquear funcionalidades en desarrollo/beta.
 */
@Component({
  selector: 'app-superadmin-pin-dialog',
  imports: [CommonModule, HeroIcon, UiSfx],
  template: `
    <div
      class="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
      style="background: rgba(3, 7, 18, 0.72); backdrop-filter: blur(20px);"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
    >
      <div
        class="relative w-full max-w-md bg-neutral-900/90 border border-white/20 rounded-3xl p-6 sm:p-7 kiosk:p-8 shadow-2xl flex flex-col items-center gap-4 sm:gap-5 text-center text-white select-none"
      >
        <!-- Icono Candado -->
        <div class="size-14 sm:size-16 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-400">
          <app-hero-icon name="lock-closed" class="text-2xl sm:text-3xl" />
        </div>

        <div class="space-y-1 sm:space-y-1.5">
          <h2 class="text-lg sm:text-xl kiosk:text-2xl font-extrabold font-['Montserrat'] uppercase tracking-tight text-white">
            {{ title() }}
          </h2>
          <p class="text-neutral-300 text-xs sm:text-sm leading-relaxed max-w-xs sm:max-w-sm">
            {{ subtitle() }}
          </p>
        </div>

        <!-- Indicador de PIN ingresado -->
        <div class="relative w-full max-w-[260px] flex items-center justify-center">
          <div
            class="w-full rounded-2xl border border-white/20 bg-white/5 backdrop-blur-md px-4 py-3 flex items-center justify-center gap-2.5 min-h-[48px] pr-12"
            aria-live="polite"
          >
            @if (showPin()) {
              <span class="font-mono text-xl sm:text-2xl tracking-[0.25em] text-amber-300 font-bold">
                {{ pin() || '····' }}
              </span>
            } @else {
              @for (slot of pinSlots(); track $index) {
                <span
                  class="size-3 sm:size-3.5 rounded-full border transition-all duration-150"
                  [class]="slot ? 'bg-amber-400 border-amber-300 scale-110 shadow-sm shadow-amber-400/50' : 'bg-white/10 border-white/25'"
                ></span>
              }
            }
          </div>
          <button
            type="button"
            uiSfx="click"
            class="absolute right-2.5 size-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
            [attr.aria-label]="showPin() ? 'Ocultar PIN' : 'Ver PIN'"
            (click)="toggleShowPin()"
          >
            <app-hero-icon [name]="showPin() ? 'eye-slash' : 'eye'" class="text-base" />
          </button>
        </div>

        <!-- Mensaje de Error y Pista Profesional -->
        @if (error()) {
          <div class="space-y-1 px-2 py-1 text-center" role="alert">
            <p class="text-rose-300 text-xs sm:text-sm font-semibold">
              {{ error() }}
            </p>
            <p class="text-[11px] sm:text-xs text-amber-300/90 font-medium">
              {{ hint() }}
            </p>
          </div>
        }

        <!-- Teclado numérico táctil -->
        <div class="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[280px] sm:max-w-[300px]">
          @for (key of pinKeys; track key) {
            <button
              type="button"
              uiSfx="click"
              class="h-12 sm:h-14 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-xl sm:text-2xl font-bold active:scale-95 active:bg-white/20 cursor-pointer transition-transform"
              style="touch-action: manipulation;"
              (click)="appendDigit(key)"
            >
              {{ key }}
            </button>
          }

          <button
            type="button"
            uiSfx="back"
            class="h-12 sm:h-14 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-[10px] sm:text-xs font-bold uppercase tracking-wider active:scale-95 cursor-pointer text-neutral-300 flex flex-col items-center justify-center gap-0.5 text-center"
            style="touch-action: manipulation;"
            (click)="backspace()"
          >
            <app-hero-icon name="backspace" class="text-base sm:text-lg" />
            <span>Borrar</span>
          </button>

          <button
            type="button"
            uiSfx="click"
            class="h-12 sm:h-14 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-xl sm:text-2xl font-bold active:scale-95 cursor-pointer transition-transform"
            style="touch-action: manipulation;"
            (click)="appendDigit('0')"
          >
            0
          </button>

          <button
            type="button"
            uiSfx="select"
            class="h-12 sm:h-14 rounded-2xl bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/50 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-amber-300 active:scale-95 cursor-pointer transition-transform flex flex-col items-center justify-center gap-0.5 text-center"
            style="touch-action: manipulation;"
            (click)="submitPin()"
          >
            <app-hero-icon name="check" class="text-base sm:text-lg" />
            <span>Entrar</span>
          </button>
        </div>

        <!-- Botón Cancelar -->
        <div class="w-full pt-1">
          <button
            type="button"
            uiSfx="back"
            class="w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            style="touch-action: manipulation;"
            (click)="cancel()"
          >
            <app-hero-icon name="arrow-left" class="text-sm" />
            <span>Cancelar y volver</span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SuperadminPinDialog {
  private readonly superadminAuth = inject(SuperadminAuthService);
  private readonly media = inject(MediaPlayer);

  readonly title = input('Funcionalidad en Desarrollo');
  readonly subtitle = input(
    'Esta opción se encuentra en fase de pruebas técnicas. Ingrese el PIN de superadministrador para acceder.',
  );

  readonly unlocked = output<void>();
  readonly cancelled = output<void>();

  protected readonly pinKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  protected readonly pin = signal('');
  protected readonly error = signal('');
  protected readonly hint = signal(this.superadminAuth.hint);
  protected readonly showPin = signal(false);

  protected toggleShowPin(): void {
    this.showPin.update((v) => !v);
  }

  /** Muestra 6 ranuras de estado */
  protected readonly pinSlots = computed(() => {
    const current = this.pin();
    return [0, 1, 2, 3, 4, 5].map((i) => i < current.length);
  });

  protected appendDigit(digit: string): void {
    if (this.pin().length >= 8) return;
    this.error.set('');
    const next = this.pin() + digit;
    this.pin.set(next);

    // Auto-validar al llegar a 6 dígitos
    if (next.length === 6) {
      this.evaluatePin(next);
    }
  }

  protected backspace(): void {
    this.error.set('');
    this.pin.update((p) => p.slice(0, -1));
  }

  protected submitPin(): void {
    this.evaluatePin(this.pin());
  }

  private evaluatePin(candidate: string): void {
    const ok = this.superadminAuth.verify(candidate);
    if (ok) {
      playUiSfx(this.media, 'select');
      this.unlocked.emit();
    } else {
      playUiSfx(this.media, 'back');
      this.error.set('PIN de superadministrador incorrecto.');
      this.pin.set('');
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
