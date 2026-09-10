import { ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AppErrorHandler } from './core/logging/app-error';
import { PlatformService } from './core/platform/platform.service';
import { ContentPack } from './core/update/content-pack';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideAppInitializer(() => {
      const platform = inject(PlatformService);
      const pack = inject(ContentPack);
      return Promise.all([platform.loadNativeVersion(), pack.whenReady()]);
    }),
  ],
};
