import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { installChromeDevtoolsNoiseFilter } from './app/core/logging/app-error';

installChromeDevtoolsNoiseFilter();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
