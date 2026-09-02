import { Component, input } from '@angular/core';

export type KioskButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASSES: Record<KioskButtonVariant, string> = {
  primary:
    'bg-white/[0.08] border border-white/25 text-neutral-100 font-extrabold tracking-[0.18em] uppercase hover:bg-white/[0.16] hover:border-white/40 hover:text-white active:scale-95 active:bg-white/25 backdrop-blur-md shadow-xl shadow-black/40',
  secondary:
    'bg-transparent border border-white/20 text-neutral-300 font-bold tracking-[0.16em] uppercase hover:border-white/40 hover:text-white active:scale-95 active:bg-white/10',
  ghost:
    'text-neutral-400 font-bold tracking-wider uppercase hover:text-white active:scale-95 active:text-neutral-200',
};

/**
 * Botón reutilizable para kiosco táctil con apariencia de píldora (cápsula de lujo).
 * Escalado proporcional para kiosco táctil 1080x1920 (55").
 */
@Component({
  selector: 'app-kiosk-button',
  host: { class: 'block w-full' },
  template: `
    <button
      [class]="buttonClasses()"
      [attr.aria-label]="ariaLabel() || null"
      style="touch-action: manipulation;"
    >
      <ng-content />
    </button>
  `,
})
export class KioskButton {
  readonly variant = input<KioskButtonVariant>('primary');
  readonly ariaLabel = input<string>('');

  protected buttonClasses(): string {
    const base =
      'w-full min-h-12 sm:min-h-14 lg:min-h-16 kiosk:min-h-20 px-8 sm:px-10 lg:px-12 kiosk:px-16 py-3.5 sm:py-4 lg:py-5 kiosk:py-6 rounded-full transition-all duration-150 text-xs sm:text-sm lg:text-base kiosk:text-lg leading-tight cursor-pointer select-none flex items-center justify-center';
    return `${base} ${VARIANT_CLASSES[this.variant()]}`;
  }
}
