import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { LivesIndicator } from './lives-indicator';

@Component({
  standalone: true,
  imports: [LivesIndicator],
  template: `
    <app-lives-indicator
      [remainingLives]="lives()"
      [maxLives]="maxLives()"
      [compactAbove]="compactAbove()"
    />
  `,
})
class TestHost {
  readonly lives = signal(3);
  readonly maxLives = signal(3);
  readonly compactAbove = signal(3);
}

describe('LivesIndicator', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost, LivesIndicator],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra corazones individuales cuando remainingLives <= 3', () => {
    host.lives.set(3);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const svgs = compiled.querySelectorAll('svg');
    expect(svgs.length).toBe(3);
    expect(compiled.textContent).not.toContain('×');
  });

  it('muestra modo compacto con texto "× N" cuando remainingLives > 3', () => {
    host.lives.set(5);
    host.maxLives.set(6);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('× 5');
    // Solo un corazón en modo compacto
    const svgs = compiled.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
  });

  it('transición suave de modo compacto (4) a modo individual (3)', () => {
    host.lives.set(4);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('× 4');

    // Cambiar a 3
    host.lives.set(3);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('×');
    const svgs = compiled.querySelectorAll('svg');
    expect(svgs.length).toBe(3);
  });

  it('anima el corazón individual al perder una vida en modo <= 3', () => {
    vi.useFakeTimers();
    host.lives.set(3);
    fixture.detectChanges();

    host.lives.set(2);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Mientras la animación dura 450ms, se muestra el corazón en estado dying/losing
    const losingHeart = compiled.querySelector('.animate-heart-pulse');
    expect(losingHeart).toBeTruthy();

    vi.advanceTimersByTime(500);
    fixture.detectChanges();

    // Tras el timer, quedan exactamente 2 corazones
    const svgs = compiled.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
  });

  it('activa animación de pulso en modo compacto al perder una vida', () => {
    vi.useFakeTimers();
    host.lives.set(6);
    fixture.detectChanges();

    host.lives.set(5);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const pulsingHeart = compiled.querySelector('.animate-heart-pulse');
    expect(pulsingHeart).toBeTruthy();

    vi.advanceTimersByTime(500);
    fixture.detectChanges();
    expect(compiled.querySelector('.animate-heart-pulse')).toBeNull();
  });
});
