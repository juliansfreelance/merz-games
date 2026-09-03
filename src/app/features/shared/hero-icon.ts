import { Component, computed, input } from '@angular/core';
import { HEROICONS_OUTLINE_PATHS, HeroIconName } from './heroicons.data';

export type { HeroIconName };

/**
 * Icono Heroicons outline oficial de https://heroicons.com/ (paquete npm `heroicons`).
 * Hereda `currentColor` del texto padre y soporta todos los iconos de la colección oficial.
 */
@Component({
  selector: 'app-hero-icon',
  host: {
    class: 'inline-flex shrink-0 items-center justify-center',
    'aria-hidden': 'true',
  },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      [attr.stroke-width]="strokeWidth()"
      stroke="currentColor"
      class="size-[1.3em]"
    >
      @for (d of paths(); track d) {
        <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="d" />
      }
    </svg>
  `,
})
export class HeroIcon {
  readonly name = input.required<HeroIconName>();
  readonly strokeWidth = input<string>('1.5');

  protected readonly paths = computed(() => {
    const value = HEROICONS_OUTLINE_PATHS[this.name()];
    if (!value) return [];
    return typeof value === 'string' ? [value] : [...value];
  });
}
