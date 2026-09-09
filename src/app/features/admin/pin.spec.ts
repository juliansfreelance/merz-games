import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PlatformService } from '../../core/platform/platform.service';
import {
  ADMIN_PIN_MAX_LENGTH,
  ADMIN_PIN_STORAGE_KEY,
  DEFAULT_ADMIN_PIN,
  getPinHint,
  persistPinHash,
  persistPinHint,
  resetAdminPin,
  sha256Hex,
  SUPERADMIN_HINT,
  SUPERADMIN_PIN,
  SUPERADMIN_RESET_PIN,
  timingSafeEqual,
  verifyBetaSuperadminPin,
  verifyPin,
  verifyResetSuperadminPin,
  verifySuperadminPin,
} from './pin';

function buildPlatform(store: Record<string, string> = {}) {
  return {
    appVersion: signal('0.1.0'),
    isNative: false,
    platformKind: 'browser' as const,
    storageGet: (key: string) => store[key] ?? null,
    storageSet: (key: string, value: string) => {
      store[key] = value;
    },
    storageRemove: (key: string) => {
      delete store[key];
    },
    store,
  };
}

describe('PIN admin', () => {
  it('acepta el PIN por defecto cuando no hay hash persistido', async () => {
    const platform = buildPlatform();
    expect(await verifyPin(platform as unknown as PlatformService, DEFAULT_ADMIN_PIN)).toBe(true);
    expect(await verifyPin(platform as unknown as PlatformService, '0000')).toBe(false);
  });

  it('acepta un PIN persistido de hasta 10 dígitos y rechaza el default anterior', async () => {
    const platform = buildPlatform();
    expect(ADMIN_PIN_MAX_LENGTH).toBe(10);
    await persistPinHash(platform as unknown as PlatformService, '3001234567');
    expect(platform.store[ADMIN_PIN_STORAGE_KEY]).toBeTruthy();
    expect(await verifyPin(platform as unknown as PlatformService, '3001234567')).toBe(true);
    expect(await verifyPin(platform as unknown as PlatformService, DEFAULT_ADMIN_PIN)).toBe(false);
  });

  it('timingSafeEqual distingue hashes distintos', async () => {
    const a = await sha256Hex('1111');
    const b = await sha256Hex('2222');
    expect(timingSafeEqual(a, a)).toBe(true);
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it('valida las dos claves independientes de superadministrador (beta 210726 y reset 998877)', () => {
    expect(SUPERADMIN_PIN).toBe('210726');
    expect(SUPERADMIN_RESET_PIN).toBe('998877');

    expect(verifyBetaSuperadminPin('210726')).toBe(true);
    expect(verifyBetaSuperadminPin('998877')).toBe(false);

    expect(verifyResetSuperadminPin('998877')).toBe(true);
    expect(verifyResetSuperadminPin('210726')).toBe(false);

    expect(verifySuperadminPin('210726')).toBe(true);
    expect(SUPERADMIN_HINT).toContain('Lo mejor 2026');
  });

  it('gestiona la frase de recordación y el restablecimiento del PIN a valores de fábrica', async () => {
    const platform = buildPlatform();
    const service = platform as unknown as PlatformService;

    persistPinHint(service, 'Mi frase secreta');
    expect(getPinHint(service)).toBe('Mi frase secreta');

    await persistPinHash(service, '9999');
    expect(await verifyPin(service, '9999')).toBe(true);

    resetAdminPin(service);
    expect(getPinHint(service)).toBe('');
    expect(await verifyPin(service, DEFAULT_ADMIN_PIN)).toBe(true);
  });
});
