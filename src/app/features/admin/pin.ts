import { PlatformService } from '../../core/platform/platform.service';

/** PIN de clínica por defecto. Documentado en README. No se registra en logs. */
export const DEFAULT_ADMIN_PIN = '2580';

/** Clave de localStorage para el hash SHA-256 del PIN (hex). */
export const ADMIN_PIN_STORAGE_KEY = 'merz-games.admin-pin-hash';

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export async function expectedPinHash(platform: PlatformService): Promise<string> {
  const stored = platform.storageGet(ADMIN_PIN_STORAGE_KEY);
  if (stored && stored.length > 0) return stored;
  return sha256Hex(DEFAULT_ADMIN_PIN);
}

export async function verifyPin(platform: PlatformService, pin: string): Promise<boolean> {
  const [actual, expected] = await Promise.all([sha256Hex(pin), expectedPinHash(platform)]);
  return timingSafeEqual(actual, expected);
}

export async function persistPinHash(platform: PlatformService, pin: string): Promise<void> {
  const hash = await sha256Hex(pin);
  platform.storageSet(ADMIN_PIN_STORAGE_KEY, hash);
}

/**
 * PIN de Superadministrador para acceso y pruebas de funciones en desarrollo / beta.
 */
export const SUPERADMIN_PIN = '210726';

/**
 * Frase de validación técnica mostrada en caso de error en el PIN de desarrollo.
 * Sutil y profesional para recordar la clave a largo plazo sin ser explícita para terceros.
 */
export const SUPERADMIN_HINT = 'Validación de ingeniería · Hito: Lo mejor 2026 (DD/MM/AA · T.)';

/**
 * Comprueba de forma segura si el PIN suministrado coincide con el PIN de superadmin.
 */
export function verifySuperadminPin(pin: string): boolean {
  return timingSafeEqual(pin, SUPERADMIN_PIN);
}
