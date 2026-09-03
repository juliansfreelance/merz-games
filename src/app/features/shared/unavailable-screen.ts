import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { KioskButton } from './kiosk-button';
import { HeroIcon } from './hero-icon';

/**
 * Pantalla segura reutilizable.
 * Se muestra cuando un id (marca, experiencia, resultado) no existe,
 * está deshabilitado o es incompatible.
 * Fondo transparente sobre la atmósfera institucional.
 */
@Component({
  selector: 'app-unavailable-screen',
  imports: [KioskButton, HeroIcon],
  template: `
    <div class="flex flex-col items-center justify-center h-full w-full px-6 sm:px-8 gap-8 text-white select-none">

      <!-- Icono -->
      <div class="w-20 h-20 rounded-3xl bg-white/5 border border-white/15 backdrop-blur-md flex items-center justify-center shadow-xl shadow-black/30">
        <app-hero-icon name="exclamation-triangle" class="text-4xl text-amber-400/80" />
      </div>

      <!-- Texto -->
      <div class="text-center space-y-2">
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {{ title() }}
        </h1>
        <p class="text-neutral-300 text-sm sm:text-base leading-relaxed max-w-xs mx-auto">
          {{ message() }}
        </p>
      </div>

      <!-- Acciones -->
      <div class="w-full max-w-xs space-y-3">
        <app-kiosk-button variant="primary" (click)="goToBrands()">
          Ver marcas
        </app-kiosk-button>
        <app-kiosk-button variant="ghost" (click)="goToWelcome()">
          Volver al inicio
        </app-kiosk-button>
      </div>

    </div>
  `,
})
export class UnavailableScreen {
  readonly title = input('Contenido no disponible');
  readonly message = input(
    'Esta sección no se encuentra disponible en este momento.',
  );

  private readonly router = inject(Router);

  goToBrands(): void {
    this.router.navigate(['/brands']);
  }

  goToWelcome(): void {
    this.router.navigate(['/welcome']);
  }
}
