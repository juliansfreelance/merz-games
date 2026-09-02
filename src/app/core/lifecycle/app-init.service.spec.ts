import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { AppInitService } from './app-init.service';
import { appInitGuard } from './app-init.guard';

describe('AppInit Lifecycle', () => {
  let service: AppInitService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AppInitService,
        {
          provide: Router,
          useValue: {
            parseUrl: (url: string) => ({ toString: () => url } as UrlTree),
          },
        },
      ],
    });
    service = TestBed.inject(AppInitService);
    router = TestBed.inject(Router);
  });

  it('debe inicializarse en false por defecto', () => {
    expect(service.isInitialized()).toBe(false);
  });

  it('markAsInitialized debe cambiar el estado a true', () => {
    service.markAsInitialized();
    expect(service.isInitialized()).toBe(true);
  });

  it('reset debe devolver el estado a false', () => {
    service.markAsInitialized();
    service.reset();
    expect(service.isInitialized()).toBe(false);
  });

  it('appInitGuard debe redirigir a "/" si no está inicializado', () => {
    TestBed.runInInjectionContext(() => {
      const result = appInitGuard({} as any, {} as any);
      expect(result).not.toBe(true);
      expect((result as UrlTree).toString()).toBe('/');
    });
  });

  it('appInitGuard debe permitir la navegación si ya fue inicializado', () => {
    service.markAsInitialized();
    TestBed.runInInjectionContext(() => {
      const result = appInitGuard({} as any, {} as any);
      expect(result).toBe(true);
    });
  });
});
