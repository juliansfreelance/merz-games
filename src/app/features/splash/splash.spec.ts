import { TestBed } from '@angular/core/testing';
import { Splash } from './splash';
import { provideRouter } from '@angular/router';

describe('Splash', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Splash],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Splash);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have a tappable area', () => {
    const fixture = TestBed.createComponent(Splash);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tapArea = el.querySelector('[role="button"]');
    expect(tapArea).toBeTruthy();
  });
});
