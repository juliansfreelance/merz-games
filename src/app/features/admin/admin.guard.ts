import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminSession } from './admin-session';

/** Sin sesión de administración no se activa el panel. */
export const adminGuard: CanActivateFn = () => {
  const session = inject(AdminSession);
  const router = inject(Router);

  if (!session.authenticated()) {
    return router.createUrlTree(['/admin/login']);
  }

  return true;
};
