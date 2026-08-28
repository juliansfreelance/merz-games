import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog';

/**
 * Guard funcional para /brands/:brandId/games
 * Redirige a /brands si el brandId no existe o está deshabilitado.
 */
export const brandGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const catalog = inject(CatalogService);
  const router = inject(Router);
  const brandId = route.paramMap.get('brandId') ?? '';

  const brand = catalog.getBrandById(brandId);
  if (brand?.enabled) {
    return true;
  }

  return router.createUrlTree(['/brands']);
};
