import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KioskDisclaimer } from './kiosk-disclaimer';
import { CatalogService } from '../../core/catalog/catalog';
import { signal } from '@angular/core';
import { PlatformService } from '../../core/platform/platform.service';

describe('KioskDisclaimer', () => {
  let fixture: ComponentFixture<KioskDisclaimer>;
  let component: KioskDisclaimer;

  beforeEach(async () => {
    const mockPlatform = {
      appVersion: signal('0.1.0'),
      storageGet: () => null,
      storageSet: () => {},
    };

    await TestBed.configureTestingModule({
      imports: [KioskDisclaimer],
      providers: [
        CatalogService,
        { provide: PlatformService, useValue: mockPlatform },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KioskDisclaimer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse y mostrar el disclaimer de actividad por defecto', () => {
    expect(component).toBeTruthy();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('habilidad mental');
    expect(host.textContent).toContain('clínica participante');
  });

  it('debe renderizar el disclaimer de marca cuando se pasa por input', () => {
    const brandText = 'Registro Sanitario INVIMA 2021DM-0008171-R1.';
    fixture.componentRef.setInput('brandDisclaimer', brandText);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain(brandText);
    expect(host.textContent).toContain('habilidad mental');
  });
});
