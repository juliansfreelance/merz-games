import { TestBed } from '@angular/core/testing';
import { PlatformService } from '../platform/platform.service';
import { AppUpdate } from './app-update';
import { APP_UPDATE_ANDROID_SIDELOAD_MESSAGE } from './update.constants';

describe('AppUpdate', () => {
  it('en navegador check() responde skipped sin throw', async () => {
    TestBed.configureTestingModule({
      providers: [
        AppUpdate,
        {
          provide: PlatformService,
          useValue: { isNative: false, supportsBinaryUpdater: false },
        },
      ],
    });

    const result = await TestBed.inject(AppUpdate).check();
    expect(result.available).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.errorMessage).toMatch(/nativa/i);
  });

  it('en navegador downloadAndInstall() no intenta instalar', async () => {
    TestBed.configureTestingModule({
      providers: [
        AppUpdate,
        {
          provide: PlatformService,
          useValue: { isNative: false, supportsBinaryUpdater: false },
        },
      ],
    });

    const result = await TestBed.inject(AppUpdate).downloadAndInstall();
    expect(result.ok).toBe(true);
    expect(result.installed).toBe(false);
    expect(result.errorMessage).toMatch(/nativa/i);
  });

  it('en Android check() indica sideload de APK', async () => {
    TestBed.configureTestingModule({
      providers: [
        AppUpdate,
        {
          provide: PlatformService,
          useValue: { isNative: true, isAndroid: true, supportsBinaryUpdater: false },
        },
      ],
    });

    const result = await TestBed.inject(AppUpdate).check();
    expect(result.available).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.errorMessage).toBe(APP_UPDATE_ANDROID_SIDELOAD_MESSAGE);
  });
});
