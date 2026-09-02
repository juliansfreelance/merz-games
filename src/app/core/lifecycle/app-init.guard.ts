import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppInitService } from './app-init.service';

/**
 * Guard que asegura que toda navegación directa o recarga pase por el Splash Loader.
 * Si la app no ha sido inicializada en memoria, redirige inmediatamente a '/'.
 */
export const appInitGuard: CanActivateFn = () => {
  const appInit = inject(AppInitService);
  const router = inject(Router);

  if (!appInit.isInitialized()) {
    return router.parseUrl('/');
  }

  return true;
};
