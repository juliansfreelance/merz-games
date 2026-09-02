import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * CatalogCard — Tarjeta interactiva de marca o experiencia para el catálogo.
 *
 * Optimizada con mayor ancho útil y padding refinado para visualización amplia en kiosco 1080x1920.
 */
@Component({
  selector: 'app-catalog-card',
  imports: [CommonModule],
  host: {
    class: 'block w-full h-full',
  },
  template: `
    <div
      role="button"
      tabindex="0"
      class="group relative w-full h-full min-h-[340px] sm:min-h-[380px] kiosk:min-h-[480px] rounded-3xl kiosk:rounded-[2.5rem] border border-white/15 bg-white/[0.06] backdrop-blur-md active:bg-white/[0.12] active:scale-[0.98] transition-all duration-200 p-4 sm:p-5 lg:p-6 kiosk:p-6 overflow-hidden cursor-pointer shadow-md shadow-black/20 hover:shadow-lg hover:shadow-black/25 flex flex-col items-center text-center justify-between gap-3 sm:gap-4 kiosk:gap-5 select-none hover:border-white/30 hover:bg-white/[0.09]"
      style="touch-action: manipulation;"
      (pointerup)="handleClick($event)"
      (keydown.enter)="handleKey($event)"
      (keydown.space)="handleKey($event)"
      [attr.aria-label]="computedAriaLabel()"
    >
      <!-- 1. Imagen / Preview Superior (Aspecto 16:10 amplio) -->
      <div class="relative w-full aspect-[16/10] rounded-2xl kiosk:rounded-3xl overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
        @if (image() && !imageError()) {
          <img
            [src]="image()"
            [alt]="title()"
            class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            (error)="onImageError()"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"></div>
        } @else {
          <!-- Fallback elegante con icono y texto "Imagen" -->
          <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-white/10 to-white/5 text-white/40 gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke-width="1.5" stroke="currentColor" class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 opacity-70">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            <span class="text-xs sm:text-sm kiosk:text-base font-medium text-white/50 tracking-wider">Imagen</span>
          </div>
        }

        @if (badge()) {
          <span class="absolute top-2.5 right-2.5 kiosk:top-3.5 kiosk:right-3.5 px-3 py-1 kiosk:px-4 kiosk:py-1.5 rounded-full text-[11px] sm:text-xs kiosk:text-sm font-extrabold tracking-widest uppercase bg-black/50 text-white border border-white/20 backdrop-blur-md shadow-sm">
            {{ badge() }}
          </span>
        }
      </div>

      <!-- 2. Contenido Central: Título y Descripción -->
      <div class="w-full space-y-1.5 sm:space-y-2 px-1 flex-1 flex flex-col justify-center items-center">
        <h2
          class="text-lg sm:text-xl lg:text-2xl kiosk:text-2xl kiosk-tall:text-3xl font-extrabold uppercase text-white tracking-tight text-center [&>sup]:text-[0.55em] [&>sup]:top-[-0.5em] [&>sup]:font-normal"
          [innerHTML]="title()"
        ></h2>
        <p class="text-xs sm:text-sm lg:text-base kiosk:text-base kiosk-tall:text-lg font-normal text-neutral-300 line-clamp-3 leading-relaxed max-w-sm sm:max-w-md kiosk:max-w-lg">
          {{ cleanDescription() }}
        </p>
      </div>

      <!-- 3. Botón CTA Inferior con apariencia de píldora (cápsula) -->
      <div class="w-full pt-1 flex justify-center shrink-0">
        <div
          class="inline-flex items-center justify-center min-w-[140px] sm:min-w-[180px] lg:min-w-[200px] kiosk:min-w-[240px] px-8 sm:px-10 lg:px-12 kiosk:px-12 py-2.5 sm:py-3 lg:py-3.5 kiosk:py-4 rounded-full font-extrabold text-xs sm:text-sm lg:text-base kiosk:text-base tracking-[0.2em] uppercase text-neutral-100 bg-white/[0.08] border border-white/25 backdrop-blur-md shadow-lg shadow-black/40 group-hover:bg-white/[0.16] group-hover:text-white group-hover:border-white/40 group-active:scale-95 transition-all duration-150 select-none"
        >
          {{ actionLabel() }}
        </div>
      </div>
    </div>
  `,
})
export class CatalogCard {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly image = input<string | undefined>(undefined);
  readonly badge = input<string | undefined>(undefined);
  readonly actionLabel = input<string>('Jugar');
  readonly ariaLabel = input<string | undefined>(undefined);

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
    this.selected.emit();
  }

  protected handleKey(event: Event): void {
    event.preventDefault();
    this.selected.emit();
  }
}
