import { PlatformService } from '../../core/platform/platform.service';

/** PIN de clínica por defecto. Documentado en README. No se registra en logs. */
export const DEFAULT_ADMIN_PIN = '2580';

/** Longitudes mínima y máxima para el PIN de administración */
export const ADMIN_PIN_MIN_LENGTH = 4;
export const ADMIN_PIN_MAX_LENGTH = 10;

/** Clave de localStorage para el hash SHA-256 del PIN (hex). */
export const ADMIN_PIN_STORAGE_KEY = 'merz-games.admin-pin-hash';

/** Clave de localStorage para la frase de recordación personalizada del PIN. */
export const ADMIN_PIN_HINT_STORAGE_KEY = 'merz-games.admin-pin-hint';

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

export async function expectedPinHash(platform: PlatformService, defaultPin: string = DEFAULT_ADMIN_PIN): Promise<string> {
  const stored = platform.storageGet(ADMIN_PIN_STORAGE_KEY);
  if (stored && stored.length > 0) return stored;
  return sha256Hex(defaultPin);
}

export async function verifyPin(platform: PlatformService, pin: string, defaultPin: string = DEFAULT_ADMIN_PIN): Promise<boolean> {
  const [actual, expected] = await Promise.all([sha256Hex(pin), expectedPinHash(platform, defaultPin)]);
  return timingSafeEqual(actual, expected);
}

export async function persistPinHash(platform: PlatformService, pin: string): Promise<void> {
  const hash = await sha256Hex(pin);
  platform.storageSet(ADMIN_PIN_STORAGE_KEY, hash);
}

export function getPinHint(platform: PlatformService): string {
  return platform.storageGet(ADMIN_PIN_HINT_STORAGE_KEY) ?? '';
}

export function persistPinHint(platform: PlatformService, hint: string): void {
  if (hint.trim().length > 0) {
    platform.storageSet(ADMIN_PIN_HINT_STORAGE_KEY, hint.trim());
  } else {
    platform.storageRemove(ADMIN_PIN_HINT_STORAGE_KEY);
  }
}

export function resetAdminPin(platform: PlatformService): void {
  platform.storageRemove(ADMIN_PIN_STORAGE_KEY);
  platform.storageRemove(ADMIN_PIN_HINT_STORAGE_KEY);
}

/**
 * PIN de Superadministrador para acceso y pruebas de funciones en desarrollo / beta.
 */
export const SUPERADMIN_PIN = '210726';

/**
 * PIN de Superadministrador para restablecimiento de PIN de clínica a valor por defecto (2580).
 */
export const SUPERADMIN_RESET_PIN = '998877';

/**
 * Frase de validación técnica mostrada en caso de error en el PIN de desarrollo.
 * Sutil y profesional para recordar la clave a largo plazo sin ser explícita para terceros.
 */
export const SUPERADMIN_HINT = 'Validación de ingeniería · Hito: Lo mejor 2026 (DD/MM/AA · T.)';

/**
 * Comprueba si el PIN coincide con el PIN de superadmin para funciones beta / desarrollo.
 */
export function verifyBetaSuperadminPin(pin: string, expectedPin: string = SUPERADMIN_PIN): boolean {
  return timingSafeEqual(pin, expectedPin);
}

/**
 * Comprueba si el PIN coincide con el PIN de superadmin para restablecer el PIN de la clínica.
 */
export function verifyResetSuperadminPin(pin: string, expectedPin: string = SUPERADMIN_RESET_PIN): boolean {
  return timingSafeEqual(pin, expectedPin);
}

/**
 * Comprueba de forma segura si el PIN suministrado coincide con el PIN de superadmin (alias de beta PIN).
 */
export function verifySuperadminPin(pin: string, expectedPin: string = SUPERADMIN_PIN): boolean {
  return verifyBetaSuperadminPin(pin, expectedPin);
}
