import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { PlatformService } from './core/platform/platform.service';
import { signal } from '@angular/core';

describe('App', () => {
  let mockPlatformService: any;

  beforeEach(async () => {
    mockPlatformService = {
      isNative: false,
      platformKind: 'browser',
      appVersion: signal('0.1.0'),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: PlatformService, useValue: mockPlatformService }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title and version', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Merz Games');
    expect(compiled.textContent).toContain('v0.1.0');
    expect(compiled.textContent).toContain('Navegador');
  });

  it('should render Tauri label when platform is native', async () => {
    mockPlatformService.isNative = true;
    mockPlatformService.platformKind = 'tauri';

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Escritorio (Tauri)');
  });
});
