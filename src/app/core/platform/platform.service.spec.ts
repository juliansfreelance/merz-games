import { TestBed } from '@angular/core/testing';
import { PlatformService } from './platform.service';

describe('PlatformService', () => {
  let service: PlatformService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlatformService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to browser mode in test environment', () => {
    expect(service.isNative).toBe(false);
    expect(service.platformKind).toBe('browser');
    expect(service.appVersion()).toBe('0.1.0');
  });

  it('restart / exit / leaveKiosk se degradan en navegador', async () => {
    const restart = await service.restart();
    const exit = await service.exit();
    const leave = await service.leaveKiosk();

    expect(restart.ok).toBe(false);
    expect(exit.ok).toBe(false);
    expect(leave.ok).toBe(false);
    expect(restart.message).toBe('Solo en la app de escritorio');
    expect(exit.message).toBe('Solo en la app de escritorio');
    expect(leave.message).toBe('Solo en la app de escritorio');
  });
});
