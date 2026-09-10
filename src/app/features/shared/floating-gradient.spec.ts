import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FloatingGradient } from './floating-gradient';
import { Atmosphere } from '../../core/catalog/content-manifest.model';

describe('FloatingGradient', () => {
  let fixture: ComponentFixture<FloatingGradient>;
  let component: FloatingGradient;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloatingGradient],
    }).compileComponents();

    fixture = TestBed.createComponent(FloatingGradient);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente con atmósfera default', () => {
    expect(component).toBeTruthy();
  });

  it('debe renderizar el color base y manchas con input de atmósfera personalizado', () => {
    const customAtmosphere: Atmosphere = {
      baseColor: '#03131a',
      blurTint: '#00E5FF',
      blobs: [
        { from: '#00E5FF', to: '#00838F', opacity: 0.2 },
        { from: '#00B4D8', to: '#0077B6', opacity: 0.16 },
        { from: '#0D9488', to: '#0284C7', opacity: 0.18 },
      ],
    };

    fixture.componentRef.setInput('atmosphere', customAtmosphere);
    fixture.detectChanges();

    const hostElement: HTMLElement = fixture.nativeElement;
    const bgContainer = hostElement.querySelector('div');
    expect(bgContainer).toBeTruthy();
    expect(bgContainer?.style.backgroundColor).toBe('rgb(3, 19, 26)');
  });

  it('debe contener las manchas de atmósfera vivas', () => {
    const hostElement: HTMLElement = fixture.nativeElement;
    const blobs = hostElement.querySelectorAll('app-atmosphere-blobs');
    expect(blobs.length).toBeGreaterThan(0);
  });

  it('con animated=false no aplica clases de animación float', () => {
    fixture.componentRef.setInput('animated', false);
    fixture.detectChanges();

    const hostElement: HTMLElement = fixture.nativeElement;
    const animated = hostElement.querySelector('.animate-float-1');
    expect(animated).toBeNull();
  });
});
