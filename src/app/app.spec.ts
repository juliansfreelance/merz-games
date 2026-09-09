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
    isNative: boolean;
    appVersion: ReturnType<typeof signal<string>>;
    isKiosk: ReturnType<typeof signal<boolean>>;
    storageGet: (key: string) => string | null;
    storageSet: (key: string, value: string) => void;
    enterKiosk: () => Promise<any>;
    toggleKiosk?: () => Promise<any>;
  };

  beforeEach(async () => {
    mockPlatformService = {
      isNative: false,
      appVersion: signal('0.1.0'),
      isKiosk: signal(true),
      storageGet: () => null,
      storageSet: () => {},
      enterKiosk: vi.fn().mockResolvedValue({ ok: false }),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: PlatformService, useValue: mockPlatformService },
        CatalogService,
        provideRouter([
          { path: '', component: DummyAdmin },
          { path: 'welcome', component: DummyAdmin },
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

  it('no muestra el botón de ajustes rápidos en / ni en /admin/login, pero sí en /welcome', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await fixture.whenStable();
    fixture.detectChanges();

    // En ruta raíz / (splash)
    let btn = fixture.nativeElement.querySelector('button[aria-label="Ajustes rápidos de sonido y operación"]');
    expect(btn).toBeNull();

    // En /welcome
    await router.navigateByUrl('/welcome');
    fixture.detectChanges();
    btn = fixture.nativeElement.querySelector('button[aria-label="Ajustes rápidos de sonido y operación"]');
    expect(btn).toBeTruthy();

    // En /admin/login
    await router.navigateByUrl('/admin/login');
    fixture.detectChanges();
    btn = fixture.nativeElement.querySelector('button[aria-label="Ajustes rápidos de sonido y operación"]');
    expect(btn).toBeNull();
  });

  it('al pulsar el botón de ajustes rápidos abre el diálogo y al cerrarlo lo oculta', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/welcome');
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button[aria-label="Ajustes rápidos de sonido y operación"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();

    // Abrir diálogo
    btn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-quick-settings-dialog')).toBeTruthy();

    // Cerrar diálogo
    const closeBtn = fixture.nativeElement.querySelector('button[aria-label="Cerrar ventana de ajustes"]') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-quick-settings-dialog')).toBeNull();
  });
});

