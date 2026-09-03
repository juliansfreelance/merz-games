import { ErrorHandler, inject, Injectable } from '@angular/core';

/**
 * Ruido de Chrome DevTools (web-vitals inyectado) al navegar en Angular.
 * @see https://github.com/angular/angular/issues/70464
 */
export function isChromeDevtoolsStartTimeNoise(
  error: unknown,
  filename?: string,
): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (!message.includes("reading 'startTime'")) return false;

  const stack = error instanceof Error ? (error.stack ?? '') : '';
  const file = filename ?? '';

  // Si el stack apunta a código nuestro, no lo silenciamos.
  const looksLikeApp =
    /\.(ts|js):\d+/.test(stack) &&
    !stack.includes('reportAllChanges') &&
    !stack.includes('<anonymous>') &&
    !/VM\d+/i.test(stack) &&
    !/VM\d+/i.test(file);

  return !looksLikeApp;
}

let windowHookInstalled = false;

function shouldSwallowDevtoolsEvent(event: Event): boolean {
  if (typeof PromiseRejectionEvent !== 'undefined' && event instanceof PromiseRejectionEvent) {
    return isChromeDevtoolsStartTimeNoise(event.reason);
  }
  if (typeof ErrorEvent !== 'undefined' && event instanceof ErrorEvent) {
    return isChromeDevtoolsStartTimeNoise(event.error ?? event.message, event.filename);
  }
  return false;
}

/** Intercepta el TypeError de DevTools antes de que llegue como Uncaught. */
export function installChromeDevtoolsNoiseFilter(): void {
  if (windowHookInstalled) return;
  if (typeof window === 'undefined') return;
  windowHookInstalled = true;

  const swallow = (event: Event): void => {
    if (!shouldSwallowDevtoolsEvent(event)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  window.addEventListener('error', swallow, true);
  window.addEventListener('unhandledrejection', swallow, true);
}

// ─── Logger ───────────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Logger centralizado de la aplicación.
 * Reemplaza los `console.log` dispersos en features.
 * En producción podría enrutar a un servicio externo; por ahora escribe
 * en la consola con prefijo para facilitar el filtrado en DevTools.
 */
@Injectable({ providedIn: 'root' })
export class AppLogger {
  private readonly prefix = '[MerzGames]';

  info(context: string, message: string, ...args: unknown[]): void {
    console.info(`${this.prefix}[${context}] ${message}`, ...args);
  }

  warn(context: string, message: string, ...args: unknown[]): void {
    console.warn(`${this.prefix}[${context}] ${message}`, ...args);
  }

  error(context: string, message: string, ...args: unknown[]): void {
    console.error(`${this.prefix}[${context}] ${message}`, ...args);
  }
}

// ─── ErrorHandler ─────────────────────────────────────────────────────────────

/**
 * Manejador global de errores de Angular.
 * - Registra el error con `AppLogger` en lugar de dejarlo llegar a la consola sin contexto.
 * - Evita pantallas blancas en producción: el error se captura aquí;
 *   los errores de catálogo inválido se manejan con degradación en `CatalogService`.
 *
 * Regístrate en `app.config.ts`:
 * ```ts
 * { provide: ErrorHandler, useClass: AppErrorHandler }
 * ```
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly logger = inject(AppLogger);

  constructor() {
    installChromeDevtoolsNoiseFilter();
  }

  handleError(error: unknown): void {
    if (isChromeDevtoolsStartTimeNoise(error)) {
      return;
    }

    const message =
      error instanceof Error ? error.message : String(error);
    const stack =
      error instanceof Error ? (error.stack ?? '') : '';

    this.logger.error('ErrorHandler', message, stack);

    // Re-lanzar en desarrollo para que Vite/Angular pueda mostrar el overlay.
    // En producción (ng build) el flag de entorno controlaría esto;
    // por ahora lo relanzamos siempre para no ocultar bugs durante Fases 3–7.
    throw error;
  }
}
