import { Routes } from '@angular/router';
import { brandGuard } from './features/brands/brand.guard';
import { experienceGuard } from './features/experiences/experience.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/splash/splash').then((m) => m.Splash),
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./features/welcome/welcome').then((m) => m.Welcome),
  },
  {
    path: 'brands',
    loadComponent: () =>
      import('./features/brands/brand-select').then((m) => m.BrandSelect),
  },
  {
    path: 'brands/:brandId/games',
    canActivate: [brandGuard],
    loadComponent: () =>
      import('./features/experiences/experience-select').then(
        (m) => m.ExperienceSelect,
      ),
  },
  {
    path: 'play/:experienceId',
    canActivate: [experienceGuard],
    loadComponent: () =>
      import('./features/play/game-host').then((m) => m.GameHost),
  },
  {
    path: 'result/:experienceId/:result',
    loadComponent: () =>
      import('./features/result/result-screen').then((m) => m.ResultScreen),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/shared/unavailable-screen').then(
        (m) => m.UnavailableScreen,
      ),
  },
];
