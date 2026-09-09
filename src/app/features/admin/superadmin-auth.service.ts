import { inject, Injectable, signal } from '@angular/core';
import { CatalogService } from '../../core/catalog/catalog';
import { verifyBetaSuperadminPin } from './pin';

/**
 * SuperadminAuthService — Gestiona la sesión temporal de desbloqueo de superadmin
 * para interactuar con marcas y juegos en desarrollo.
 */
@Injectable({ providedIn: 'root' })
export class SuperadminAuthService {
  private readonly catalog = inject(CatalogService);
  private readonly _isUnlocked = signal(false);

  readonly isUnlocked = this._isUnlocked.asReadonly();
  get hint(): string {
    return this.catalog.superadminHint();
  }

  verify(pin: string): boolean {
    const expected = this.catalog.betaSuperadminPin();
    const ok = verifyBetaSuperadminPin(pin, expected);
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
