import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { PlatformService } from './core/platform/platform.service';
import { CatalogService } from './core/catalog/catalog';

describe('App', () => {
  let mockPlatformService: {
    appVersion: ReturnType<typeof signal<string>>;
    storageGet: (key: string) => string | null;
    storageSet: (key: string, value: string) => void;
  };

  beforeEach(async () => {
    mockPlatformService = {
      appVersion: signal('0.1.0'),
      storageGet: () => null,
      storageSet: () => {},
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: PlatformService, useValue: mockPlatformService },
        CatalogService,
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should create the app shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should contain a router-outlet and floating-gradient', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
    expect(compiled.querySelector('app-floating-gradient')).toBeTruthy();
  });

  it('should display app version badge', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('0.1.0');
  });
});
