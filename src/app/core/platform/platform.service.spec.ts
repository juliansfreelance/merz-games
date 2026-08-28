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
});
