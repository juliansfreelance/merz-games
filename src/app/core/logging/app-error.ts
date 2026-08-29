import { ErrorHandler, inject, Injectable } from '@angular/core';

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

  handleError(error: unknown): void {
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
