import { Component } from '@angular/core';

/**
 * Tarjeta contenedora reutilizable para el kiosco.
 * Borde sutil, fondo semitransparente, padding estándar.
 */
@Component({
  selector: 'app-kiosk-card',
  host: { class: 'block' },
  template: `
    <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
      <ng-content />
    </div>
  `,
})
export class KioskCard {}
