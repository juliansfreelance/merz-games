import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PlatformService } from './core/platform/platform.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly platformService = inject(PlatformService);

  protected readonly title = signal('Merz Games');
  protected readonly isNative = this.platformService.isNative;
  protected readonly platformKind = this.platformService.platformKind;
  protected readonly appVersion = this.platformService.appVersion;
}
