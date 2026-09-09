import { inject, Injectable, signal } from '@angular/core';
import { PlatformService } from '../../core/platform/platform.service';
import { CatalogService } from '../../core/catalog/catalog';
import { getPinHint, persistPinHash, persistPinHint, resetAdminPin, verifyPin } from './pin';

/**
 * Sesión de administración en memoria (no se persiste).
 * El PIN nunca se registra en logs.
 */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly platform = inject(PlatformService);
  private readonly catalog = inject(CatalogService);
  private readonly _authenticated = signal(false);

  readonly authenticated = this._authenticated.asReadonly();

  async login(pin: string): Promise<boolean> {
    const defaultPin = this.catalog.defaultAdminPin();
    const ok = await verifyPin(this.platform, pin, defaultPin);
    this._authenticated.set(ok);
    return ok;
  }

  logout(): void {
    this._authenticated.set(false);
  }

  async changePin(current: string, next: string, hint?: string): Promise<boolean> {
    const defaultPin = this.catalog.defaultAdminPin();
    const ok = await verifyPin(this.platform, current, defaultPin);
    if (!ok) return false;
    await persistPinHash(this.platform, next);
    if (hint !== undefined) {
      persistPinHint(this.platform, hint);
    }
    return true;
  }

  getPinHint(): string {
    return getPinHint(this.platform);
  }

  resetPinToDefault(): void {
    resetAdminPin(this.platform);
  }
}
