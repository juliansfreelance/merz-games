import { Injectable, signal } from '@angular/core';

/**
 * Servicio de ciclo de vida de la aplicación.
 * Registra en memoria si el Splash Preloader ya completó la carga inicial.
 */
@Injectable({
  providedIn: 'root',
})
export class AppInitService {
  private readonly _isInitialized = signal(false);

  readonly isInitialized = this._isInitialized.asReadonly();

  markAsInitialized(): void {
    this._isInitialized.set(true);
  }

  reset(): void {
    this._isInitialized.set(false);
  }
}
