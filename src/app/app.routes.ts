import { Routes } from '@angular/router';
import { brandGuard } from './features/brands/brand.guard';
import { experienceGuard } from './features/experiences/experience.guard';
import { appInitGuard } from './core/lifecycle/app-init.guard';
import { adminGuard } from './features/admin/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/splash/splash').then((m) => m.Splash),
  },
  {
    path: 'admin/login',
    canActivate: [appInitGuard],
    loadComponent: () =>
      import('./features/admin/admin-login').then((m) => m.AdminLogin),
  },
  {
    path: 'admin',
    canActivate: [appInitGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-panel').then((m) => m.AdminPanel),
  },
  {
    path: 'welcome',
    canActivate: [appInitGuard],
    loadComponent: () =>
      import('./features/welcome/welcome').then((m) => m.Welcome),
  },
  {
    path: 'brands',
    canActivate: [appInitGuard],
    loadComponent: () =>
      import('./features/brands/brand-select').then((m) => m.BrandSelect),
  },
  {
    path: 'brands/:brandId/games',
    canActivate: [appInitGuard, brandGuard],
    loadComponent: () =>
      import('./features/experiences/experience-select').then(
        (m) => m.ExperienceSelect,
      ),
  },
  {
    path: 'play/:experienceId',
    canActivate: [appInitGuard, experienceGuard],
    loadComponent: () =>
      import('./features/play/game-host').then((m) => m.GameHost),
  },
  {
    path: 'result/:experienceId/:result',
    redirectTo: '/play/:experienceId',
    pathMatch: 'full',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/shared/unavailable-screen').then(
        (m) => m.UnavailableScreen,
      ),
  },
];
