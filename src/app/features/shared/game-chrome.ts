import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KioskDisclaimer } from './kiosk-disclaimer';
import { HeroIcon } from './hero-icon';
import { UiSfx } from './ui-sfx';

/**
 * GameChrome — Cromado adaptativo de experiencia de juego con:
 * 1. Encabezado institucional centrado a una sola columna (HOY TU PIEL, TAMBIÉN GANA, Badge del juego).
 * 2. Cuerpo principal en 2 columnas en modo horizontal (Columna 1: Descripción / Columna 2: Vidas arriba a la derecha y Tablero)
 *    y 1 columna centrada en modo vertical.
 * 3. Sticky Footer unificado en la base (Logo al 30% de ancho con mb, botón volver con mb, y disclaimers legales).
 */
@Component({
  selector: 'app-game-chrome',
  imports: [CommonModule, KioskDisclaimer, HeroIcon, UiSfx],
  host: {
    class: 'flex flex-col flex-1 w-full min-h-full',
  },
  template: `
    <div class="w-full flex-1 min-h-full flex flex-col justify-between p-3 sm:p-4 lg:p-6 text-white select-none gap-4 sm:gap-6">

      <!-- ================================================================= -->
      <!-- 1. ENCABEZADO CENTRADO A UNA SOLA COLUMNA                         -->
      <!-- ================================================================= -->
      <header class="w-full shrink-0 flex flex-col items-center justify-center text-center space-y-2 sm:space-y-2.5 kiosk:space-y-3 pt-1">

        <div class="inline-flex flex-col items-center justify-center gap-1.5 sm:gap-2">
          <!-- Badge superior de campaña -->
          <span class="w-full flex items-center justify-center px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm kiosk:text-base font-extrabold font-['Montserrat'] tracking-[0.35em] sm:tracking-[0.4em] uppercase bg-white/10 text-white border border-white/20 backdrop-blur-md shadow-md select-none">
            HOY TU PIEL
          </span>

          <!-- Título principal 'TAMBIÉN GANA' -->
          <h1 class="text-lg sm:text-xl lg:text-2xl kiosk:text-3xl font-extrabold font-['Montserrat'] uppercase text-white tracking-tight leading-tight whitespace-nowrap">
            TAMBIÉN GANA
          </h1>
        </div>

        <!-- Badge con nombre del juego en mayúsculas -->
        <div class="inline-flex items-center gap-2 px-4 py-1.5 sm:px-6 sm:py-2 rounded-full text-xs sm:text-sm font-extrabold font-['Montserrat'] tracking-wider uppercase bg-white/10 text-neutral-200 border border-white/15 backdrop-blur-md shadow-sm [&>span>sup]:text-[0.6em] [&>span>sup]:top-[-0.4em] [&>span>sup]:font-normal">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          <span [innerHTML]="gameTitle()"></span>
        </div>

      </header>

      <!-- ================================================================= -->
      <!-- 2. CUERPO PRINCIPAL (2 COLUMNAS EN HORIZONTAL: DESCRIPCIÓN Y JUEGO) -->
      <!-- ================================================================= -->
      <div class="flex-1 w-full flex flex-col landscape:flex-row justify-between items-center landscape:items-stretch gap-4 sm:gap-6">

        <!-- COLUMNA 1: DESCRIPCIÓN -->
        <aside class="flex flex-col justify-center shrink-0 w-full landscape:w-80 landscape:lg:w-96 text-center landscape:text-left gap-3 py-1">
          <div
            class="text-xs sm:text-sm lg:text-base text-neutral-300 max-w-2xl landscape:max-w-none mx-auto landscape:mx-0 leading-relaxed font-normal [&>strong]:font-bold [&>strong]:text-white px-1"
            [innerHTML]="introText()"
          ></div>
        </aside>

        <!-- COLUMNA 2: ÁREA DE JUEGO (INTENTOS EN HORIZONTAL + TABLERO) -->
        <main class="flex-1 min-w-0 flex flex-col justify-between items-center relative w-full gap-3">

          <!-- Barra superior del área de juego: Indicador de turno a la izquierda (fuera del slot) + Intentos a la derecha -->
          <div class="flex w-full items-center justify-between shrink-0 gap-3 min-h-[44px]">
            <!-- Izquierda: slot para indicador de turno fuera del slot del juego -->
            <div class="flex items-center min-w-0">
              <ng-content select="[board-header-left]" />
            </div>

            <!-- Derecha: Intentos / Vidas + ayuda al lado, fuera del contenedor -->
            <div class="flex items-center gap-3 ml-auto">
              <div class="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-2 backdrop-blur-md">
                <span class="text-xs uppercase tracking-widest text-neutral-300 font-bold">
                  Intentos restantes
                </span>
                <div class="flex items-center gap-2" role="status" [attr.aria-label]="remainingLives() + ' vidas restantes'">
                  @for (heart of heartsArray(); track heart.index) {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      class="w-6 h-6 transition-all duration-300"
                      [class.text-rose-500]="heart.active"
                      [class.drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]]="heart.active"
                      [class.text-white/20]="!heart.active"
                      [class.scale-90]="!heart.active"
                    >
                      <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3.5 7.02 3.5c1.82 0 3.393 1.056 4.23 2.593.837-1.537 2.41-2.593 4.23-2.593 2.306 0 4.77 1.822 4.77 4.75 0 3.924-2.438 7.11-4.739 9.266a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                    </svg>
                  }
                </div>
                <ng-content select="[lives-action]" />
              </div>
              @if (roundNumber(); as n) {
                <div
                  class="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 sm:px-5 py-2 backdrop-blur-md"
                  role="status"
                  [attr.aria-label]="'Ronda ' + n"
                >
                  <span class="text-xs uppercase tracking-widest text-neutral-300 font-bold">
                    Ronda
                  </span>
                  <span class="text-white font-extrabold tabular-nums text-sm sm:text-base min-w-[1.25ch] text-center">
                    {{ n }}
                  </span>
                </div>
              }
              <button
                type="button"
                uiSfx="click"
                class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 flex items-center justify-center text-white/80 hover:text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer select-none"
                aria-label="Ver instrucciones del juego"
                (click)="help.emit()"
              >
                ?
              </button>
            </div>
          </div>

          <!-- Slot de Tablero de Juego (con altura mínima garantizada para no comprimir las cartas) -->
          <div class="board-slot flex-1 w-full min-h-[340px] sm:min-h-[380px] flex items-center justify-center relative rounded-3xl border border-white/10 bg-white/[0.03] p-3 sm:p-5">
            <ng-content />
          </div>

        </main>

      </div>

      <!-- ================================================================= -->
      <!-- 3. STICKY FOOTER UNIFICADO (LOGO 30% + BOTÓN RETORNO + DISCLAIMERS) -->
      <!-- ================================================================= -->
      <app-kiosk-disclaimer
        [logo]="brandLogo()"
        [logoAlt]="cleanBrandName()"
        [brandDisclaimer]="brandDisclaimer()"
      >
        <button
          type="button"
          uiSfx="back"
          class="inline-flex items-center gap-2 text-neutral-400 font-bold tracking-wider uppercase hover:text-white active:scale-95 active:text-neutral-200 text-xs sm:text-sm transition-all duration-150 py-1 px-4 cursor-pointer select-none [&>span>sup]:text-[0.6em] [&>span>sup]:top-[-0.4em] [&>span>sup]:font-normal"
          (click)="back.emit()"
        >
          <app-hero-icon name="arrow-left" />
          Volver a juegos <span [innerHTML]="brandName()"></span>
        </button>
      </app-kiosk-disclaimer>

    </div>
  `,
})
export class GameChrome {
  readonly gameTitle = input.required<string>();
  readonly brandName = input.required<string>();
  readonly brandLogo = input<string | undefined>(undefined);
  readonly brandDisclaimer = input<string | undefined>(undefined);
  readonly introText = input<string>('Pon a prueba tu memoria y destreza en este juego interactivo.');
  readonly remainingLives = input<number>(3);
  readonly maxLives = input<number>(3);
  /** Ronda de la sesión (triqui). Si es null, el contador no se muestra. */
  readonly roundNumber = input<number | null>(null);

  readonly back = output<void>();
  readonly help = output<void>();

  protected readonly cleanBrandName = computed(() => {
    return (this.brandName() || '').replace(/<[^>]*>/g, '').trim();
  });

  protected readonly heartsArray = computed(() => {
    const total = this.maxLives();
    const activeCount = this.remainingLives();
    return Array.from({ length: total }, (_, i) => ({
      index: i,
      active: i < activeCount,
    }));
  });
}
