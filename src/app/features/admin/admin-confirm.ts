import { Component, input, output } from '@angular/core';
import { KioskButton } from '../shared/kiosk-button';
import { HeroIcon } from '../shared/hero-icon';

/**
 * Diálogo táctil de confirmación con iconos oficiales Heroicons.
 */
@Component({
  selector: 'app-admin-confirm',
  imports: [KioskButton, HeroIcon],
  template: `
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
      style="background: rgba(3, 7, 18, 0.62); backdrop-filter: blur(16px);"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
    >
      <div
        class="relative w-full max-w-lg bg-neutral-900/85 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-5 sm:gap-6 text-center text-white select-none"
      >
        <div class="size-14 sm:size-16 rounded-2xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-400">
          <app-hero-icon name="exclamation-triangle" class="text-2xl sm:text-3xl text-yellow-400" />
        </div>

        <div class="space-y-1.5">
          <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold font-['Montserrat'] uppercase tracking-tight">
            {{ title() }}
          </h2>
          <p class="text-neutral-300 text-sm sm:text-base kiosk:text-lg leading-relaxed">
            {{ message() }}
          </p>
        </div>

        <div class="w-full space-y-3 pt-1">
          <app-kiosk-button variant="primary" (click)="confirmed.emit()">
            <app-hero-icon name="check" class="text-lg" />
            {{ confirmLabel() }}
          </app-kiosk-button>
          <app-kiosk-button variant="ghost" (click)="cancelled.emit()">
            <app-hero-icon name="x-mark" class="text-lg" />
            {{ cancelLabel() }}
          </app-kiosk-button>
        </div>
      </div>
    </div>
  `,
})
export class AdminConfirm {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirmar');
  readonly cancelLabel = input('Cancelar');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
