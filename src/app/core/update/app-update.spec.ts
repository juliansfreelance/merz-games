import { TestBed } from '@angular/core/testing';
import { PlatformService } from '../platform/platform.service';
import { AppUpdate } from './app-update';

describe('AppUpdate', () => {
  it('en navegador check() responde skipped sin throw', async () => {
    TestBed.configureTestingModule({
      providers: [
        AppUpdate,
        {
          provide: PlatformService,
          useValue: { isNative: false },
        },
      ],
    });

    const result = await TestBed.inject(AppUpdate).check();
    expect(result.available).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.errorMessage).toMatch(/escritorio/i);
  });

  it('en navegador downloadAndInstall() no intenta instalar', async () => {
    TestBed.configureTestingModule({
      providers: [
        AppUpdate,
        {
          provide: PlatformService,
          useValue: { isNative: false },
        },
      ],
    });

    const result = await TestBed.inject(AppUpdate).downloadAndInstall();
    expect(result.ok).toBe(true);
    expect(result.installed).toBe(false);
    expect(result.errorMessage).toMatch(/escritorio/i);
  });
});
