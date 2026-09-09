import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaPlayer } from '../../core/media/media-player';
import { playUiSfx } from './ui-sfx';
import { HeroIcon } from './hero-icon';

/**
 * CatalogCard — Tarjeta interactiva de marca o experiencia para el catálogo.
 *
 * Optimizada con soporte para elementos en desarrollo/beta (tonos tenues, translúcidos e insignia con candado).
 * Usa una capa falsa de backdrop (textura + blur local) porque backdrop-filter falla en Cover Flow 3D.
 */
@Component({
  selector: 'app-catalog-card',
  imports: [CommonModule, HeroIcon],
  host: {
    class: 'block w-full h-full',
  },
  template: `
    <div
      class="group relative w-full h-full rounded-3xl kiosk:rounded-[2.5rem] transition-all duration-200 p-4 sm:p-5 lg:p-6 kiosk:p-6 overflow-hidden shadow-md shadow-black/20 hover:shadow-lg hover:shadow-black/25 flex flex-col items-center text-center justify-between gap-3 sm:gap-4 kiosk:gap-5 select-none"
      [class]="
        (fillContainer() ? '' : 'min-h-85 sm:min-h-95 kiosk:min-h-120 ') +
        (develop()
          ? 'border-2 border-dashed border-amber-400/30 hover:border-amber-400/50 transition-all duration-200'
          : 'border-2 border-slate-600/15 hover:border-slate-600/30 transition-all duration-200')
      "
    >
      <!-- Fake backdrop: textura + blur local (estable con transforms 3D) -->
      <img
        src="/content/images/texture.jpg"
        alt=""
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-60"
      />
      <div
        class="pointer-events-none absolute inset-0 z-0 bg-cyan-900/6 bg-blend-multiply transition-colors duration-200 group-hover:bg-cyan-950/9 backdrop-blur-sm inset-shadow-md inset-shadow-indigo-500"
      ></div>

      <!-- 1. Imagen / Preview Superior (Aspecto 16:10 amplio) -->
      <div class="relative z-10 w-full aspect-16/10 rounded-2xl kiosk:rounded-3xl overflow-hidden bg-slate-600/15 border-2 border-slate-600/10 shrink-0 flex items-center justify-center">
        @if (image() && !imageError()) {
          <img
            [src]="image()"
            [alt]="title()"
            class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            (error)="onImageError()"
          />
          <div class="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent pointer-events-none"></div>
        } @else {
          <!-- Fallback elegante con icono y texto "Imagen" -->
          <div class="w-full h-full flex flex-col items-center justify-center bg-linear-to-br from-white/10 to-white/5 text-white/40 gap-2">
            <app-hero-icon name="photo" class="text-3xl sm:text-4xl lg:text-5xl opacity-70" />
            <span class="text-xs sm:text-sm kiosk:text-base font-medium text-white/50 tracking-wider">Imagen</span>
          </div>
        }

        @if (develop()) {
          <span class="absolute top-2.5 right-2.5 kiosk:top-3.5 kiosk:right-3.5 px-3 py-1 kiosk:px-3.5 kiosk:py-1.5 rounded-full text-[10px] sm:text-xs font-extrabold tracking-wider uppercase bg-amber-500/25 text-amber-300 border border-amber-400/40 shadow-sm flex items-center gap-1.5">
            <app-hero-icon name="fire" class="text-xs" />
            <span>En desarrollo</span>
          </span>
        } @else if (badge()) {
          <span class="absolute top-2.5 right-2.5 kiosk:top-3.5 kiosk:right-3.5 px-3 py-1 kiosk:px-4 kiosk:py-1.5 rounded-full text-[11px] sm:text-xs kiosk:text-sm font-extrabold tracking-widest uppercase bg-black/50 text-white border border-white/20 shadow-sm">
            {{ badge() }}
          </span>
        }
      </div>

      <!-- 2. Contenido Central: Título y Descripción -->
      <div class="relative z-10 w-full space-y-1.5 sm:space-y-2 px-1 flex-1 flex flex-col justify-center items-center">
        <h2
          class="text-lg sm:text-xl lg:text-2xl kiosk:text-2xl kiosk-tall:text-3xl font-extrabold uppercase text-white leading-tight tracking-tight text-center [&>sup]:text-[0.55em] [&>sup]:top-[-0.5em] [&>sup]:font-normal"
          [innerHTML]="title()"
        ></h2>
        <p class="text-xs sm:text-sm lg:text-base kiosk:text-base kiosk-tall:text-lg leading-tight font-normal text-neutral-300 line-clamp-3 max-w-sm sm:max-w-md kiosk:max-w-lg">
          {{ cleanDescription() }}
        </p>
      </div>

      <!-- 3. Botón CTA Inferior con apariencia de píldora (cápsula) -->
      <div class="relative z-10 w-full pt-1 flex justify-center shrink-0">
        <button
          type="button"
          class="inline-flex items-center justify-center min-w-35 sm:min-w-45 lg:min-w-50 kiosk:min-w-60 px-8 sm:px-10 lg:px-12 kiosk:px-12 py-2.5 sm:py-3 lg:py-3.5 kiosk:py-4 rounded-full font-extrabold text-xs sm:text-sm lg:text-base kiosk:text-base tracking-[0.2em] uppercase transition-all duration-150 select-none gap-2"
          [class]="
            (selectable() ? 'cursor-pointer ' : 'cursor-default pointer-events-none ') +
            (develop()
              ? 'text-amber-300 bg-amber-500/15 border border-amber-400/35 group-hover:bg-amber-500/25 group-hover:border-amber-400/50'
              : 'text-neutral-100 bg-white/8 border border-white/25 shadow-lg shadow-black/40 group-hover:bg-white/16 group-hover:text-white group-hover:border-white/40 active:scale-95')
          "
          style="touch-action: manipulation;"
          [attr.tabindex]="selectable() ? 0 : -1"
          [attr.aria-label]="computedAriaLabel()"
          [disabled]="!selectable()"
          (pointerup)="handleClick($event)"
          (keydown.enter)="handleKey($event)"
          (keydown.space)="handleKey($event)"
        >
          @if (develop()) {
            <app-hero-icon name="fire" class="text-xs" />
            <span>Acceso Beta</span>
          } @else {
            <span>{{ actionLabel() }}</span>
          }
        </button>
      </div>
    </div>
  `,
})
export class CatalogCard {
  private readonly media = inject(MediaPlayer);

  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly image = input<string | undefined>(undefined);
  readonly badge = input<string | undefined>(undefined);
  readonly actionLabel = input<string>('Jugar');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly develop = input<boolean>(false);
  /** Si es false, el card no emite `selected` (p. ej. card lateral del Cover Flow). */
  readonly selectable = input<boolean>(true);
  /** Si es true, elimina min-height fijos para adaptarse al contenedor (Cover Flow). */
  readonly fillContainer = input<boolean>(false);

  readonly selected = output<void>();

  protected readonly imageError = signal(false);

  /** Sanitiza la descripción eliminando cualquier etiqueta HTML (strong, br, etc.) para texto plano limpio. */
  protected readonly cleanDescription = computed(() => {
    const raw = this.description() || '';
    return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  });

  protected computedAriaLabel(): string {
    const cleanTitle = (this.title() || '').replace(/<[^>]*>/g, '').trim();
    return this.ariaLabel() ?? `${cleanTitle} - ${this.cleanDescription()}`;
  }

  protected onImageError(): void {
    this.imageError.set(true);
  }

  protected handleClick(event: PointerEvent): void {
    event.preventDefault();
    this.select();
  }

  protected handleKey(event: Event): void {
    event.preventDefault();
    this.select();
  }

  private select(): void {
    if (!this.selectable()) return;
    playUiSfx(this.media, 'select');
    this.selected.emit();
  }
}
