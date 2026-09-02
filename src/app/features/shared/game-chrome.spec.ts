import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameChrome } from './game-chrome';

describe('GameChrome', () => {
  let fixture: ComponentFixture<GameChrome>;
  let component: GameChrome;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameChrome],
    }).compileComponents();

    fixture = TestBed.createComponent(GameChrome);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('gameTitle', 'Memoria Radiesse');
    fixture.componentRef.setInput('brandName', 'Radiesse');
    fixture.componentRef.setInput('remainingLives', 3);
    fixture.detectChanges();
  });

  it('debe crearse y renderizar título y marca', () => {
    expect(component).toBeTruthy();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('Memoria Radiesse');
    expect(host.textContent).toContain('Radiesse');
  });

  it('debe calcular 3 corazones activos con 3 vidas restantes', () => {
    const hearts = component['heartsArray']();
    expect(hearts.length).toBe(3);
    expect(hearts.filter((h) => h.active).length).toBe(3);
  });

  it('debe reflejar 1 corazón activo con 1 vida restante', () => {
    fixture.componentRef.setInput('remainingLives', 1);
    fixture.detectChanges();

    const hearts = component['heartsArray']();
    expect(hearts.length).toBe(3);
    expect(hearts.filter((h) => h.active).length).toBe(1);
  });
});
