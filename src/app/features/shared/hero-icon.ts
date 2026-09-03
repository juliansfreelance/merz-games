import { Component, computed, input } from '@angular/core';

/** Iconos outline 24px tomados de `heroicons` (paquete local, sin CDN). */
const OUTLINE_PATHS = {
  'arrow-left': 'M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18',
  'x-mark': 'M6 18 18 6M6 6l12 12',
} as const;

export type HeroIconName = keyof typeof OUTLINE_PATHS;

/**
 * Icono Heroicons outline embebido (offline). Hereda `currentColor` del texto padre.
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
      stroke-width="2.5"
      stroke="currentColor"
      class="size-[1.3em]"
    >
      <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="path()" />
    </svg>
  `,
})
export class HeroIcon {
  readonly name = input.required<HeroIconName>();

  protected readonly path = computed(() => OUTLINE_PATHS[this.name()]);
}
