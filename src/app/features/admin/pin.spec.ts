import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PlatformService } from '../../core/platform/platform.service';
import {
  ADMIN_PIN_STORAGE_KEY,
  DEFAULT_ADMIN_PIN,
  persistPinHash,
  sha256Hex,
  SUPERADMIN_HINT,
  SUPERADMIN_PIN,
  timingSafeEqual,
  verifyPin,
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
    store,
  };
}

describe('PIN admin', () => {
  it('acepta el PIN por defecto cuando no hay hash persistido', async () => {
    const platform = buildPlatform();
    expect(await verifyPin(platform as unknown as PlatformService, DEFAULT_ADMIN_PIN)).toBe(true);
    expect(await verifyPin(platform as unknown as PlatformService, '0000')).toBe(false);
  });

  it('acepta un PIN persistido y rechaza el default anterior', async () => {
    const platform = buildPlatform();
    await persistPinHash(platform as unknown as PlatformService, '147258');
    expect(platform.store[ADMIN_PIN_STORAGE_KEY]).toBeTruthy();
    expect(await verifyPin(platform as unknown as PlatformService, '147258')).toBe(true);
    expect(await verifyPin(platform as unknown as PlatformService, DEFAULT_ADMIN_PIN)).toBe(false);
  });

  it('timingSafeEqual distingue hashes distintos', async () => {
    const a = await sha256Hex('1111');
    const b = await sha256Hex('2222');
    expect(timingSafeEqual(a, a)).toBe(true);
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it('verifySuperadminPin acepta 210726 y rechaza otros pines', () => {
    expect(SUPERADMIN_PIN).toBe('210726');
    expect(verifySuperadminPin('210726')).toBe(true);
    expect(verifySuperadminPin('2580')).toBe(false);
    expect(verifySuperadminPin('123456')).toBe(false);
    expect(SUPERADMIN_HINT).toContain('Lo mejor 2026');
    expect(SUPERADMIN_HINT).toContain('DD/MM/AA');
  });
});
