import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { PlatformService } from './core/platform/platform.service';

describe('App', () => {
  let mockPlatformService: { appVersion: ReturnType<typeof signal<string>> };

  beforeEach(async () => {
    mockPlatformService = {
      appVersion: signal('0.1.0'),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: PlatformService, useValue: mockPlatformService },
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should create the app shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should contain a router-outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should display app version badge', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('0.1.0');
  });
});
