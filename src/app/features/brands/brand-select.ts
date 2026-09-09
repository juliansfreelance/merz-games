import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog';
import { Brand } from '../../core/catalog/brand.model';
import { KioskButton } from '../shared/kiosk-button';
import { KioskCard } from '../shared/kiosk-card';
import { CatalogCard } from '../shared/catalog-card';
import { KioskDisclaimer } from '../shared/kiosk-disclaimer';
import { HeroIcon } from '../shared/hero-icon';
import { SuperadminPinDialog } from '../shared/superadmin-pin-dialog';
import { SuperadminAuthService } from '../admin/superadmin-auth.service';

/**
 * Selector de marcas con scroll nativo completo (mouse, touch y teclado) y soporte de atmósfera institucional.
 */
@Component({
  selector: 'app-brand-select',
  imports: [KioskButton, KioskCard, CatalogCard, KioskDisclaimer, HeroIcon, SuperadminPinDialog],
  host: {
    class: 'block w-full h-full min-h-0 overflow-y-auto overscroll-contain',
  },
  template: `
    <div class="flex flex-col min-h-full w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 kiosk:py-10 text-white justify-between select-none gap-4">

      <!-- Encabezado con estética de agencia -->
      <header class="text-center space-y-2 sm:space-y-3 kiosk:space-y-6 shrink-0 pt-1">
        <div class="inline-flex flex-col items-center justify-center gap-3 sm:gap-4 kiosk:gap-5">
          <span class="w-full flex items-center justify-center px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm kiosk:text-base font-extrabold font-['Montserrat'] tracking-[0.35em] sm:tracking-[0.4em] uppercase bg-white/10 text-white border border-white/20 backdrop-blur-md shadow-md select-none">
            HOY TU PIEL
          </span>
          <h1 class="text-xl sm:text-2xl lg:text-3xl kiosk:text-4xl kiosk-tall:text-5xl font-extrabold font-['Montserrat'] uppercase text-white tracking-tight whitespace-nowrap">
            TAMBIÉN GANA
          </h1>
        </div>
        <p class="text-neutral-300 text-xs sm:text-base lg:text-lg kiosk:text-2xl max-w-md sm:max-w-xl mx-auto leading-relaxed">
          Selecciona la marca con la que deseas interactuar y jugar
        </p>
      </header>

      <!-- Zona de tarjetas -->
      <div class="flex-1 w-full my-2 sm:my-4 kiosk:my-8 px-4 sm:px-6">
        <div class="w-full max-w-6xl mx-auto min-h-full flex flex-row flex-wrap justify-center content-center items-stretch gap-4 sm:gap-6 lg:gap-8 py-4">
          @if (catalog.brands().length === 0) {
            <app-kiosk-card class="w-full max-w-md">
              <p class="text-center text-neutral-400 py-6">
                No hay marcas disponibles en este momento.
              </p>
            </app-kiosk-card>
          }

          @for (brand of catalog.brands(); track brand.id) {
            <div class="w-full max-w-[340px] sm:w-[380px] md:w-[440px] lg:w-[460px] kiosk:w-[470px] kiosk-tall:w-[480px] flex shrink-0">
              <app-catalog-card
                [title]="brand.name"
                [description]="brand.description ?? 'Toca para descubrir los juegos disponibles.'"
                [image]="brand.image"
                badge="Marca"
                actionLabel="Seleccionar"
                [ariaLabel]="'Jugar con ' + brand.name"
                [develop]="brand.develop ?? false"
                (selected)="onBrandClick(brand)"
              />
            </div>
          }
        </div>
      </div>

      <!-- Sticky Footer unificado con botón volver y disclaimers -->
      <app-kiosk-disclaimer>
        <div class="w-full max-w-xs sm:max-w-md kiosk:max-w-lg">
          <app-kiosk-button variant="ghost" (click)="goBack()">
            <app-hero-icon name="arrow-left" />
            Volver al inicio
          </app-kiosk-button>
        </div>
      </app-kiosk-disclaimer>

      <!-- Diálogo modal de superadmin si la marca está en desarrollo -->
      @if (pendingBrandId()) {
        <app-superadmin-pin-dialog
          title="Marca en Desarrollo"
          subtitle="Esta marca se encuentra en fase de pruebas técnicas. Ingrese el PIN de superadministrador para acceder."
          (unlocked)="onSuperadminUnlocked()"
          (cancelled)="pendingBrandId.set(null)"
        />
      }

    </div>
  `,
})
export class BrandSelect {
  protected readonly catalog = inject(CatalogService);
  protected readonly superadminAuth = inject(SuperadminAuthService);
  private readonly router = inject(Router);

  protected readonly pendingBrandId = signal<string | null>(null);

  constructor() {
    this.catalog.clearSelectedBrand();
  }

  onBrandClick(brand: Brand): void {
    if (brand.develop && !this.superadminAuth.isUnlocked()) {
      this.pendingBrandId.set(brand.id);
      return;
    }
    this.selectBrand(brand.id);
  }

  protected onSuperadminUnlocked(): void {
    const id = this.pendingBrandId();
    this.pendingBrandId.set(null);
    if (id) {
      this.selectBrand(id);
    }
  }

  selectBrand(brandId: string): void {
    this.catalog.setSelectedBrand(brandId);
    this.router.navigate(['/brands', brandId, 'games']);
  }

  goBack(): void {
    this.router.navigate(['/welcome']);
  }
}
