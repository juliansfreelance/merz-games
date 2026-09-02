import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog';
import { KioskButton } from '../shared/kiosk-button';
import { KioskDisclaimer } from '../shared/kiosk-disclaimer';

/**
 * Pantalla de bienvenida con breakpoint responsivo para 1080x1920 (kiosco 55").
 */
@Component({
  selector: 'app-welcome',
  imports: [KioskButton, KioskDisclaimer],
  host: {
    class: 'flex flex-col flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain',
    style: 'touch-action: pan-y; -webkit-overflow-scrolling: touch;',
  },
  template: `
    <div class="flex flex-col items-center justify-between flex-1 min-h-full w-full px-6 sm:px-12 lg:px-16 py-6 sm:py-8 text-white select-none gap-6">

      <!-- Encabezado y cuerpo central -->
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-6 sm:gap-8 kiosk:gap-12 max-w-2xl kiosk:max-w-4xl my-auto w-full px-2">

        <!-- Icono / Escudo institucional Merz Games -->
        <div class="w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44 kiosk:w-56 kiosk:h-56 rounded-3xl kiosk:rounded-[2.5rem] bg-white/5 border border-white/15 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-black/50 p-4 sm:p-5 kiosk:p-7 overflow-hidden shrink-0">
          <img
            src="/content/images/merzGamesIcono.png"
            alt="Merz Games Icono"
            class="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
          />
        </div>

        <div class="space-y-4 sm:space-y-6 kiosk:space-y-8 flex flex-col items-center w-full">
          <div class="flex flex-col items-center gap-4 sm:gap-6 kiosk:gap-8 w-full">
            <!-- Merz Aesthetics Logo + PRESENTA en pill badge glassmorphism -->
            <div class="flex flex-col items-center gap-6 sm:gap-8 kiosk:gap-10 w-full">
              <div class="w-full flex justify-center px-4">
                <img
                  src="/content/images/MerzAestheticsLogo.svg"
                  alt="Merz Aesthetics"
                  class="w-full max-w-[260px] sm:max-w-[340px] md:max-w-[420px] lg:max-w-[480px] kiosk:max-w-[620px] kiosk-tall:max-w-[700px] h-auto object-contain drop-shadow-md select-none pointer-events-none"
                />
              </div>
              <span class="inline-block text-xs sm:text-sm kiosk:text-base font-bold font-['Montserrat'] tracking-[0.4em] uppercase text-neutral-300/80 select-none">
                PRESENTA:
              </span>
              <!-- Merz Games Logotipo Principal (ligeramente más pequeño que el logo de Merz Aesthetics) -->
              <div class="w-full flex justify-center px-4">
                <img
                  src="/content/images/merzGamesLogotipo.png"
                  alt="Merz Games"
                  class="w-full max-w-[210px] sm:max-w-[280px] md:max-w-[340px] lg:max-w-[390px] kiosk:max-w-[500px] kiosk-tall:max-w-[560px] h-auto object-contain select-none pointer-events-none"
                />
              </div>
            </div>

          </div>

          <!-- Badge y Título de Campaña (igual a pantalla brands) -->
          <div class="inline-flex flex-col items-center justify-center gap-1.5 sm:gap-2 pt-1 sm:pt-2">
            <span class="w-full flex items-center justify-center px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm kiosk:text-base font-extrabold font-['Montserrat'] tracking-[0.35em] sm:tracking-[0.4em] uppercase bg-white/10 text-white border border-white/20 backdrop-blur-md shadow-md select-none">
              HOY TU PIEL
            </span>
            <h1 class="text-xl sm:text-2xl lg:text-3xl kiosk:text-4xl kiosk-tall:text-5xl font-extrabold font-['Montserrat'] uppercase text-white tracking-tight text-center whitespace-nowrap">
              TAMBIÉN GANA
            </h1>
          </div>

          <p class="text-neutral-300 text-sm sm:text-lg lg:text-xl kiosk:text-2xl leading-relaxed max-w-sm sm:max-w-md kiosk:max-w-2xl mx-auto">
            Elige tu marca favorita y participa en una experiencia de juego única.
          </p>
        </div>

      </div>

      <!-- Sticky Footer unificado con CTA Principal y disclaimers -->
      <app-kiosk-disclaimer>
        <div class="w-full max-w-xs sm:max-w-md lg:max-w-lg">
          <app-kiosk-button variant="primary" (click)="start()">
            ¡Comenzar a jugar!
          </app-kiosk-button>
        </div>
      </app-kiosk-disclaimer>

    </div>
  `,
})
export class Welcome {
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);

  constructor() {
    this.catalog.clearSelectedBrand();
  }

  start(): void {
    this.router.navigate(['/brands']);
  }
}
