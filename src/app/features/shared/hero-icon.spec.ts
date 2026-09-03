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

  it('debe renderizar el SVG outline arrow-left', async () => {
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement | null;
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.getAttribute('stroke-width')).toBe('2.5');

    const path = svg?.querySelector('path');
    expect(path?.getAttribute('d')).toContain('M10.5 19.5');
  });

  it('debe renderizar el SVG outline x-mark', async () => {
    fixture.componentRef.setInput('name', 'x-mark');
    await fixture.whenStable();

    const path = fixture.nativeElement.querySelector('path') as SVGPathElement | null;
    expect(path?.getAttribute('d')).toBe('M6 18 18 6M6 6l12 12');
  });
});
