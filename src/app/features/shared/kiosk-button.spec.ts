import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KioskButton } from './kiosk-button';
import { MediaPlayer } from '../../core/media/media-player';
import { UI_SFX } from './ui-sfx';

describe('KioskButton', () => {
  let fixture: ComponentFixture<KioskButton>;
  let playSfx: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    playSfx = vi.fn();
    await TestBed.configureTestingModule({
      imports: [KioskButton],
      providers: [{ provide: MediaPlayer, useValue: { playSfx } }],
    }).compileComponents();

    fixture = TestBed.createComponent(KioskButton);
  });

  it('reproduce click.mp3 en variant primary (avanzar/OK)', () => {
    fixture.componentRef.setInput('variant', 'primary');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button')?.click();
    expect(playSfx).toHaveBeenCalledWith(UI_SFX.click);
  });

  it('reproduce click-back.mp3 en variant ghost (volver)', () => {
    fixture.componentRef.setInput('variant', 'ghost');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button')?.click();
    expect(playSfx).toHaveBeenCalledWith(UI_SFX.back);
  });

  it('permite forzar el SFX con el input sfx', () => {
    fixture.componentRef.setInput('variant', 'ghost');
    fixture.componentRef.setInput('sfx', 'click');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button')?.click();
    expect(playSfx).toHaveBeenCalledWith(UI_SFX.click);
  });
});
