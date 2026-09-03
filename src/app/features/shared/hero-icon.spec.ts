import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroIcon } from './hero-icon';

describe('HeroIcon', () => {
  let fixture: ComponentFixture<HeroIcon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroIcon],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroIcon);
    fixture.componentRef.setInput('name', 'arrow-left');
    await fixture.whenStable();
  });

  it('debe renderizar el SVG outline arrow-left con stroke-width por defecto 1.5', async () => {
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement | null;
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.getAttribute('stroke-width')).toBe('1.5');

    const path = svg?.querySelector('path');
    expect(path?.getAttribute('d')).toContain('M10.5 19.5');
  });

  it('debe renderizar el SVG outline x-mark', async () => {
    fixture.componentRef.setInput('name', 'x-mark');
    await fixture.whenStable();

    const path = fixture.nativeElement.querySelector('path') as SVGPathElement | null;
    expect(path?.getAttribute('d')).toBe('M6 18 18 6M6 6l12 12');
  });

  it('debe renderizar cog-6-tooth con dos paths outline', async () => {
    fixture.componentRef.setInput('name', 'cog-6-tooth');
    await fixture.whenStable();

    const paths = fixture.nativeElement.querySelectorAll('path');
    expect(paths.length).toBe(2);
    expect(paths[0]?.getAttribute('d')).toContain('M9.594 3.94');
    expect(paths[1]?.getAttribute('d')).toContain('M15 12a3 3 0 1 1-6 0');
  });

  it('debe renderizar los nuevos iconos del menú administrativo', async () => {
    for (const name of ['chevron-right', 'power', 'adjustments-horizontal', 'cpu-chip', 'key', 'check', 'information-circle'] as const) {
      fixture.componentRef.setInput('name', name);
      await fixture.whenStable();
      const paths = fixture.nativeElement.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    }
  });
});
