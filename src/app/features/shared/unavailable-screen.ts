import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { KioskButton } from './kiosk-button';

/**
 * Pantalla segura reutilizable.
 * Se muestra cuando un id (marca, experiencia, resultado) no existe,
 * está deshabilitado o es incompatible.
 * Fondo transparente sobre la atmósfera institucional.
 */
@Component({
  selector: 'app-unavailable-screen',
  imports: [KioskButton],
  template: `
    <div class="flex flex-col items-center justify-center h-full w-full px-6 sm:px-8 gap-8 text-white select-none">

      <!-- Icono -->
      <div class="w-20 h-20 rounded-3xl bg-white/5 border border-white/15 backdrop-blur-md flex items-center justify-center shadow-xl shadow-black/30">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             stroke-width="1.5" stroke="currentColor" class="w-10 h-10 text-amber-400/80">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
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
