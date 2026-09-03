import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component, signal } from '@angular/core';
import { App } from './app';
import { PlatformService } from './core/platform/platform.service';
import { CatalogService } from './core/catalog/catalog';

@Component({ template: '' })
class DummyAdmin {}

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
        provideRouter([
          { path: 'admin/login', component: DummyAdmin },
        ]),
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

  it('debe activar la atmósfera de administración cuando la ruta inicia con /admin', async () => {
    const fixture = TestBed.createComponent(App);
    const catalog = TestBed.inject(CatalogService);
    const router = TestBed.inject(Router);
    await fixture.whenStable();
    fixture.detectChanges();

    const app = fixture.componentInstance as any;
    await router.navigateByUrl('/admin/login');
    fixture.detectChanges();

    expect(app.currentAtmosphere()).toEqual(catalog.adminAtmosphere());
  });
});
