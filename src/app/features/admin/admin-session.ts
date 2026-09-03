import { inject, Injectable, signal } from '@angular/core';
import { PlatformService } from '../../core/platform/platform.service';
import { persistPinHash, verifyPin } from './pin';

/**
 * Sesión de administración en memoria (no se persiste).
 * El PIN nunca se registra en logs.
 */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly platform = inject(PlatformService);
  private readonly _authenticated = signal(false);

  readonly authenticated = this._authenticated.asReadonly();

  async login(pin: string): Promise<boolean> {
    const ok = await verifyPin(this.platform, pin);
    this._authenticated.set(ok);
    return ok;
  }

  logout(): void {
    this._authenticated.set(false);
  }

  async changePin(current: string, next: string): Promise<boolean> {
    const ok = await verifyPin(this.platform, current);
    if (!ok) return false;
    await persistPinHash(this.platform, next);
    return true;
  }
}
