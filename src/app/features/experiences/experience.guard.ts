import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog';

/**
 * Guard funcional para /play/:experienceId
 * Redirige a /brands si la experiencia no existe o está deshabilitada/incompatible.
 */
export const experienceGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
) => {
  const catalog = inject(CatalogService);
  const router = inject(Router);
  const experienceId = route.paramMap.get('experienceId') ?? '';

  const experience = catalog.getExperienceById(experienceId);
  if (experience) {
    return true;
  }

  return router.createUrlTree(['/brands']);
};
