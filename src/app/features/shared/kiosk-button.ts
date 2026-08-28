import { Component, input } from '@angular/core';

export type KioskButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASSES: Record<KioskButtonVariant, string> = {
  primary:
    'bg-white text-neutral-900 font-bold hover:bg-neutral-100 active:scale-95 active:bg-neutral-200',
  secondary:
    'border-2 border-white/30 text-white font-semibold hover:border-white/60 active:scale-95 active:bg-white/10',
  ghost:
    'text-neutral-400 font-medium hover:text-white active:scale-95 active:text-neutral-300',
};

/**
 * Botón reutilizable para kiosco táctil.
 * Target grande, feedback en :active, sin hover crítico.
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
      'w-full min-h-14 px-6 py-4 rounded-2xl transition-all duration-150 text-lg leading-tight cursor-pointer select-none';
    return `${base} ${VARIANT_CLASSES[this.variant()]}`;
  }
}
