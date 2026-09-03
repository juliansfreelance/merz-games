import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AdminSession } from './admin-session';
import { adminGuard } from './admin.guard';
import { DEFAULT_ADMIN_PIN } from './pin';
import { PlatformService } from '../../core/platform/platform.service';

describe('AdminSession', () => {
  let session: AdminSession;
  const store: Record<string, string> = {};

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminSession,
        {
          provide: PlatformService,
          useValue: {
            appVersion: signal('0.1.0'),
            storageGet: (key: string) => store[key] ?? null,
            storageSet: (key: string, value: string) => {
              store[key] = value;
            },
          },
        },
      ],
    });
    session = TestBed.inject(AdminSession);
    for (const key of Object.keys(store)) delete store[key];
  });

  it('empieza sin sesión', () => {
    expect(session.authenticated()).toBe(false);
  });

  it('login correcto abre sesión y logout la cierra', async () => {
    expect(await session.login(DEFAULT_ADMIN_PIN)).toBe(true);
    expect(session.authenticated()).toBe(true);
    session.logout();
    expect(session.authenticated()).toBe(false);
  });

  it('login incorrecto no abre sesión', async () => {
    expect(await session.login('0000')).toBe(false);
    expect(session.authenticated()).toBe(false);
  });
});

describe('adminGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminSession,
        {
          provide: PlatformService,
          useValue: {
            appVersion: signal('0.1.0'),
            storageGet: () => null,
            storageSet: () => undefined,
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: string[]) =>
              ({ toString: () => commands.join('/') } as UrlTree),
          },
        },
      ],
    });
  });

  it('sin sesión redirige al login', () => {
    TestBed.runInInjectionContext(() => {
      const result = adminGuard({} as never, {} as never);
      expect(result).not.toBe(true);
      expect((result as UrlTree).toString()).toBe('/admin/login');
    });
  });

  it('con sesión permite el panel', async () => {
    const session = TestBed.inject(AdminSession);
    await session.login(DEFAULT_ADMIN_PIN);
    TestBed.runInInjectionContext(() => {
      expect(adminGuard({} as never, {} as never)).toBe(true);
    });
  });
});
