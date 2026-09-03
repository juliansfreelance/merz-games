import { Injectable, signal } from '@angular/core';
import { SUPERADMIN_HINT, verifySuperadminPin } from './pin';

/**
 * SuperadminAuthService — Gestiona la sesión temporal de desbloqueo de superadmin
 * para interactuar con marcas y juegos en desarrollo.
 */
@Injectable({ providedIn: 'root' })
export class SuperadminAuthService {
  private readonly _isUnlocked = signal(false);

  readonly isUnlocked = this._isUnlocked.asReadonly();
  readonly hint = SUPERADMIN_HINT;

  verify(pin: string): boolean {
    const ok = verifySuperadminPin(pin);
    if (ok) {
      this._isUnlocked.set(true);
    }
    return ok;
  }

  unlock(): void {
    this._isUnlocked.set(true);
  }

  lock(): void {
    this._isUnlocked.set(false);
  }
}
