import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService, Brand, GameExperience } from '../../core/catalog/catalog';
import { CatalogDiffItem } from '../../core/catalog/compare-catalogs';
import { UpdateStatus } from '../../core/catalog/update.model';
import { KioskSettings, ScreensaverMode } from '../../core/settings/kiosk-settings';
import { PlatformService } from '../../core/platform/platform.service';
import { UpdateCoordinator } from '../../core/update/update-coordinator';
import { Difficulty, FirstPlayer } from '../../core/games/triqui/triqui.model';
import { MemoryConfig, MemoryDifficulty } from '../../core/games/memory/memory.model';
import {
  getRecommendedLives,
  MEMORY_PAIRS_MIN,
  MEMORY_PAIRS_MAX,
  MEMORY_LIVES_MIN,
  resolveMemoryConfig,
} from '../../core/games/memory/memory-config';
import { MediaPlayer } from '../../core/media/media-player';
import { AdminSession } from './admin-session';
import { AdminConfirm } from './admin-confirm';
import { KioskButton } from '../shared/kiosk-button';
import { HeroIcon, HeroIconName } from '../shared/hero-icon';
import { playUiSfx, UiSfx } from '../shared/ui-sfx';

export type AdminSection =
  | 'operations'
  | 'settings'
  | 'diagnostics'
  | 'updates'
  | 'pin';

export type SettingsView = 'menu' | 'general' | 'brands-global' | 'brands' | 'experience';

type PinField = 'current' | 'next' | 'confirm';

export interface MenuOption {
  readonly id: AdminSection;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: HeroIconName;
}

export const MENU_OPTIONS: readonly MenuOption[] = [
  {
    id: 'operations',
    title: 'Operación',
    subtitle: 'Reiniciar, cerrar app y modo kiosco',
    icon: 'power',
  },
  {
    id: 'settings',
    title: 'Ajustes de juego',
    subtitle: 'Protector, sonido y reglas por marca',
    icon: 'adjustments-horizontal',
  },
  {
    id: 'diagnostics',
    title: 'Diagnóstico',
    subtitle: 'Versiones, marco y catálogo del sistema',
    icon: 'cpu-chip',
  },
  {
    id: 'updates',
    title: 'Actualizaciones',
    subtitle: 'Catálogo de contenido y binario de app',
    icon: 'cloud-arrow-down',
  },
  {
    id: 'pin',
    title: 'Seguridad / PIN',
    subtitle: 'Cambiar el PIN de acceso local',
    icon: 'key',
  },
];

type ConfirmKind = 'restart' | 'exit' | 'leaveKiosk' | 'applyUpdate' | 'changePin' | 'resetDefaults' | null;

const MEMORY_PAIR_OPTIONS = [
  { label: '2 parejas', value: 2 },
  { label: '3 parejas', value: 3 },
  { label: '4 parejas', value: 4 },
  { label: '5 parejas', value: 5 },
  { label: '6 parejas', value: 6 },
];

const TRIQUI_DIFFICULTY_OPTIONS: Array<{ label: string; value: Difficulty }> = [
  { label: 'Fácil', value: 'easy' },
  { label: 'Medio', value: 'medium' },
  { label: 'Difícil', value: 'hard' },
];

const TRIQUI_FIRST_OPTIONS: Array<{ label: string; value: FirstPlayer }> = [
  { label: 'Paciente', value: 'patient' },
  { label: 'Alternado', value: 'alternate' },
  { label: 'Azar', value: 'random' },
];

const UPDATE_STATUS_COPY: Record<UpdateStatus, string> = {
  idle: 'Listo para buscar actualizaciones.',
  checking: 'Buscando actualizaciones…',
  available: 'Hay cambios disponibles. Revisa la lista y confirma.',
  downloading: 'Preparando contenido…',
  installing: 'Instalando…',
  completed: 'Actualización completada.',
  error: 'No se pudo completar la actualización.',
  offline: 'Sin conexión. El kiosco sigue jugable.',
};

const CHANGE_KIND_LABEL: Record<CatalogDiffItem['kind'], string> = {
  added: 'nueva',
  updated: 'actualizada',
  disabled: 'deshabilitada',
  unchanged: 'sin cambios',
};

const COLLECTION_LABEL: Record<CatalogDiffItem['collection'], string> = {
  brands: 'Marca',
  games: 'Motor',
  experiences: 'Experiencia',
};

/**
 * Panel de administración estructurado por menú y subpáginas.
 * Submenús jerárquicos para Ajustes de Juego: Generales, Memoria y Triqui por marca.
 * Sliders glass blanco, SFX auto-probar al soltar, switch de experiencia activa,
 * "Opción por defecto" con badge y opción duplicada desactivada.
 */
@Component({
  selector: 'app-admin-panel',
  imports: [KioskButton, HeroIcon, AdminConfirm, UiSfx],
  host: {
    class: 'flex flex-col w-full h-full min-h-0 overflow-hidden select-none',
  },
  template: `
    <!-- Toast de Ajustes Superior Izquierdo -->
    @if (toast(); as t) {
      <div
        class="fixed top-4 left-4 sm:top-6 sm:left-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/80 border border-yellow-400/50 backdrop-blur-xl shadow-2xl shadow-black/80 text-white pointer-events-none max-w-sm transition-all"
        role="status"
        aria-live="polite"
      >
        <div class="size-8 rounded-full bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center text-yellow-400 shrink-0">
          <app-hero-icon name="check" class="text-base text-yellow-400" />
        </div>
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-yellow-400">{{ t.title }}</p>
          <p class="text-xs sm:text-sm text-neutral-100 font-medium">{{ t.message }}</p>
        </div>
      </div>
    }

    <!-- Header Fijo / Translúcido con Blur y Estilo Blanco (Versión destacada interactiva) -->
    <header class="shrink-0 w-full z-20 bg-black/35 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3.5 sm:py-4">
      <div class="max-w-xl kiosk:max-w-2xl mx-auto w-full flex items-center justify-between gap-3">
        <!-- Botón Volver en Header (icono + texto + SFX click-back) en color blanco -->
        <button
          type="button"
          uiSfx="back"
          class="h-11 sm:h-12 px-4 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/20 flex items-center gap-2 text-sm sm:text-base font-bold text-white active:scale-95 transition-all cursor-pointer select-none"
          style="touch-action: manipulation;"
          (click)="onBack()"
          [attr.aria-label]="isAtRootMenu() ? 'Salir del panel de administración' : 'Volver al nivel anterior'"
        >
          <app-hero-icon name="arrow-left" class="text-white" />
          <span class="text-white">{{ isAtRootMenu() ? 'Salir' : 'Volver' }}</span>
        </button>

        <!-- Título central de cabecera: solo texto (sin icono, sin bordes, sin background) -->
        <div class="flex items-center justify-center text-center truncate px-2">
          <h1 class="text-base sm:text-lg kiosk:text-xl font-extrabold uppercase font-['Montserrat'] tracking-wide text-white truncate">
            {{ isAtRootMenu() ? 'Panel Administrativo' : currentHeaderTitle() }}
          </h1>
        </div>

        <!-- Indicador derecho (versión interactiva: entrar de una a diagnóstico) -->
        <div class="text-right shrink-0">
          <button
            type="button"
            uiSfx="select"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-yellow-400/15 hover:bg-yellow-400/25 active:bg-yellow-400/35 border border-yellow-400/40 text-xs sm:text-sm font-mono font-bold text-yellow-400 hover:text-yellow-300 active:scale-95 transition-all cursor-pointer select-none shadow-sm shadow-yellow-400/10"
            style="touch-action: manipulation;"
            (click)="goToDiagnostics()"
            [attr.aria-label]="'Versión ' + platform.appVersion() + '. Tocar para ir directamente a diagnóstico'"
          >
            v{{ platform.appVersion() }}
          </button>
        </div>
      </div>
    </header>

    <!-- Contenido Scrollable Central -->
    <main
      class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-6 sm:py-8"
      style="touch-action: pan-y; -webkit-overflow-scrolling: touch;"
    >
      <div class="max-w-xl kiosk:max-w-2xl mx-auto w-full flex flex-col gap-6 text-white select-none pb-12">

        <!-- ═══ VISTA 0: MENÚ DE OPCIONES PRINCIPAL ═══ -->
        @if (activeSection() === null) {
          <div class="space-y-2 text-center pt-2">
            <h2 class="text-2xl sm:text-3xl kiosk:text-4xl font-extrabold font-['Montserrat'] uppercase tracking-tight text-white">
              Panel Administrativo
            </h2>
            <p class="text-neutral-300 text-sm sm:text-base kiosk:text-lg max-w-md mx-auto">
              Selecciona una opción para gestionar la consola táctil del kiosco.
            </p>
          </div>

          <div class="flex flex-col gap-3.5 pt-2">
            @for (opt of menuOptions; track opt.id) {
              <button
                type="button"
                uiSfx="select"
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg shadow-black/20"
                style="touch-action: manipulation;"
                (click)="openSection(opt.id)"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0 transition-colors">
                    <app-hero-icon [name]="opt.icon" class="text-xl sm:text-2xl text-yellow-400" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <h3 class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate">
                        {{ opt.title }}
                      </h3>
                      @if (opt.id === 'updates' && snapshot().appUpdateAvailable) {
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                          Update
                        </span>
                      }
                    </div>
                    <p class="text-xs sm:text-sm kiosk:text-base text-neutral-400 font-normal truncate">
                      {{ opt.subtitle }}
                    </p>
                  </div>
                </div>

                <div class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0 transition-all group-hover:translate-x-0.5">
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>
            }
          </div>
        }

        <!-- ═══ SUB-PÁGINA 1: OPERACIÓN ═══ -->
        @if (activeSection() === 'operations') {
          <div class="space-y-6">
            <div class="space-y-1">
              <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400">
                Operación del Kiosco
              </h2>
              <p class="text-neutral-400 text-sm sm:text-base">
                Control nativo de la aplicación táctil de escritorio.
              </p>
            </div>

            <div class="space-y-3.5 pt-2">
              <app-kiosk-button
                variant="primary"
                [disabled]="!isNative()"
                (click)="askConfirm('restart')"
              >
                <app-hero-icon name="arrow-path" class="text-yellow-400" />
                Reiniciar aplicación
              </app-kiosk-button>

              <app-kiosk-button
                variant="secondary"
                [disabled]="!isNative()"
                (click)="askConfirm('exit')"
              >
                <app-hero-icon name="power" class="text-rose-400" />
                Cerrar aplicación
              </app-kiosk-button>

              <app-kiosk-button
                variant="secondary"
                [disabled]="!isNative()"
                (click)="askConfirm('leaveKiosk')"
              >
                <app-hero-icon name="arrows-pointing-in" class="text-neutral-300" />
                Salir del modo kiosco
              </app-kiosk-button>

              @if (!isNative()) {
                <div class="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-400/25 text-yellow-200/90 text-sm kiosk:text-base flex items-center gap-3">
                  <app-hero-icon name="exclamation-triangle" class="shrink-0 text-lg text-yellow-400" />
                  <span>Estas operaciones requieren ejecución en la app nativa de escritorio (Tauri).</span>
                </div>
              }

              @if (opMessage()) {
                <p class="text-yellow-300 text-sm kiosk:text-base text-center font-medium">{{ opMessage() }}</p>
              }
            </div>
          </div>
        }

        <!-- ═══ SUB-PÁGINA 2: AJUSTES DE JUEGO (JERÁRQUICO) ═══ -->
        @if (activeSection() === 'settings') {

          <!-- Nivel 2.0: Submenú de Ajustes de Juego (Generales, Memoria, Triqui) -->
          @if (settingsView() === 'menu') {
            <div class="space-y-2 text-center pt-2">
              <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400">
                Ajustes de Juego
              </h2>
              <p class="text-neutral-300 text-sm sm:text-base">
                Selecciona la categoría o juego que deseas configurar.
              </p>
            </div>

            <div class="flex flex-col gap-3.5 pt-2">
              <!-- Botón Ajustes Generales -->
              <button
                type="button"
                uiSfx="select"
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                style="touch-action: manipulation;"
                (click)="openSettingsGeneral()"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0">
                    <app-hero-icon name="adjustments-horizontal" class="text-xl sm:text-2xl text-yellow-400" />
                  </div>
                  <div class="min-w-0">
                    <h3 class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate">
                      Ajustes Generales
                    </h3>
                    <p class="text-xs sm:text-sm text-neutral-400 truncate">
                      Audio (BGM y SFX) y protector de pantalla
                    </p>
                  </div>
                </div>
                <div class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0">
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>

              <!-- Botón Marcas del Kiosco -->
              <button
                type="button"
                uiSfx="select"
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                style="touch-action: manipulation;"
                (click)="openSettingsBrandsGlobal()"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0">
                    <app-hero-icon name="swatch" class="text-xl sm:text-2xl text-yellow-400" />
                  </div>
                  <div class="min-w-0">
                    <h3 class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate">
                      Marcas del Kiosco
                    </h3>
                    <p class="text-xs sm:text-sm text-neutral-400 truncate">
                      Activar o desactivar marcas completas en la consola
                    </p>
                  </div>
                </div>
                <div class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0">
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>

              <!-- Botón Memoria -->
              <button
                type="button"
                uiSfx="select"
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                style="touch-action: manipulation;"
                (click)="openSettingsGame('memory')"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0">
                    <app-hero-icon name="square-2-stack" class="text-xl sm:text-2xl text-yellow-400" />
                  </div>
                  <div class="min-w-0">
                    <h3 class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate">
                      Encuentra la Pareja (Memoria)
                    </h3>
                    <p class="text-xs sm:text-sm text-neutral-400 truncate">
                      Reglas, parejas y activación por marca
                    </p>
                  </div>
                </div>
                <div class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0">
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>

              <!-- Botón Triqui -->
              <button
                type="button"
                uiSfx="select"
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                style="touch-action: manipulation;"
                (click)="openSettingsGame('triqui')"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0">
                    <app-hero-icon name="squares-2x2" class="text-xl sm:text-2xl text-yellow-400" />
                  </div>
                  <div class="min-w-0">
                    <h3 class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate">
                      Triqui (Tres en Raya)
                    </h3>
                    <p class="text-xs sm:text-sm text-neutral-400 truncate">
                      Dificultad, primer jugador y activación por marca
                    </p>
                  </div>
                </div>
                <div class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0">
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>

              <!-- Opción Restaurar por Defecto -->
              <div class="pt-2">
                <button
                  type="button"
                  uiSfx="select"
                  class="min-h-16 sm:min-h-18 kiosk:min-h-20 w-full rounded-2xl bg-rose-500/[0.08] hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/50 backdrop-blur-md px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                  style="touch-action: manipulation;"
                  (click)="askConfirm('resetDefaults')"
                >
                  <div class="flex items-center gap-4 min-w-0">
                    <div class="size-11 sm:size-12 rounded-xl bg-rose-400/15 border border-rose-400/30 flex items-center justify-center text-rose-400 group-hover:bg-rose-400/25 shrink-0 transition-colors">
                      <app-hero-icon name="arrow-path" class="text-xl sm:text-2xl text-rose-400" />
                    </div>
                    <div class="min-w-0">
                      <h3 class="text-sm sm:text-base kiosk:text-lg font-extrabold font-['Montserrat'] uppercase tracking-wide text-rose-200 group-hover:text-rose-100 transition-colors truncate">
                        Restaurar por defecto
                      </h3>
                      <p class="text-xs sm:text-sm text-neutral-300/80 truncate">
                        Restablecer marcas, juegos y audio según el catálogo original
                      </p>
                    </div>
                  </div>
                  <div class="size-8 rounded-full bg-rose-400/10 group-hover:bg-rose-400/25 flex items-center justify-center text-rose-300 shrink-0 transition-colors">
                    <app-hero-icon name="chevron-right" />
                  </div>
                </button>
              </div>
            </div>
          }

          <!-- Nivel 2.1: Ajustes Generales (Audio y Protector) -->
          @if (settingsView() === 'general') {
            <div class="space-y-6">
              <div class="space-y-1">
                <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400">
                  Ajustes Generales
                </h2>
                <p class="text-neutral-400 text-sm sm:text-base">
                  Control de ecualización de audio y comportamiento del protector.
                </p>
              </div>

              <!-- Audio General (Media Player con efecto Glass y Sliders Blancos) -->
              <div class="space-y-5 p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
                <div class="flex items-center justify-between pb-2 border-b border-white/10">
                  <div class="flex items-center gap-2.5">
                    <app-hero-icon [name]="settings.soundEnabled() ? 'speaker-wave' : 'speaker-x-mark'" class="text-xl text-yellow-400" />
                    <span class="font-extrabold uppercase tracking-wider text-sm kiosk:text-base text-white">Audio General</span>
                  </div>

                  <button
                    type="button"
                    uiSfx="click"
                    class="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer"
                    [class]="settings.soundEnabled() ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-300' : 'bg-white/10 border-white/20 text-neutral-400'"
                    (click)="toggleSound()"
                  >
                    {{ settings.soundEnabled() ? 'Sonido Activado' : 'Silenciado' }}
                  </button>
                </div>

                <!-- Slider Música de fondo (BGM) -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-neutral-200 flex items-center gap-2">
                      <app-hero-icon name="musical-note" class="text-sm text-yellow-400" />
                      <span>Música de fondo (BGM)</span>
                    </span>
                    <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-yellow-400">
                      {{ Math.round(settings.bgmVolume() * 100) }}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    [value]="settings.bgmVolume() * 100"
                    class="w-full h-2.5 rounded-lg bg-white/[0.08] border border-white/15 backdrop-blur-md accent-white cursor-pointer"
                    (input)="onBgmVolumeInput($event)"
                    (change)="onBgmVolumeCommit($event)"
                  />
                </div>

                <!-- Slider Efectos de sonido (SFX) -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-neutral-200 flex items-center gap-2">
                      <app-hero-icon name="bell" class="text-sm text-yellow-400" />
                      <span>Efectos de sonido (SFX)</span>
                    </span>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="text-[11px] font-bold text-neutral-300 hover:text-yellow-400 px-2.5 py-1 rounded-full bg-white/10 active:scale-95 transition-all flex items-center gap-1"
                        (click)="testSfx()"
                      >
                        <app-hero-icon name="play" class="text-xs text-yellow-400" />
                        <span>Probar</span>
                      </button>
                      <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-yellow-400">
                        {{ Math.round(settings.sfxVolume() * 100) }}%
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    [value]="settings.sfxVolume() * 100"
                    class="w-full h-2.5 rounded-lg bg-white/[0.08] border border-white/15 backdrop-blur-md accent-white cursor-pointer"
                    (input)="onSfxVolumeInput($event)"
                    (change)="onSfxVolumeCommit($event)"
                    (pointerup)="testSfx()"
                  />
                </div>

                <div class="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-neutral-300 flex items-start gap-2">
                  <app-hero-icon name="information-circle" class="text-yellow-400 shrink-0 mt-0.5" />
                  <span>BGM controla la música ambiental continua. SFX controla toques táctiles, aciertos y sonidos de juego. Al soltar el control se escucha la muestra del volumen.</span>
                </div>
              </div>

              <!-- Protector de Pantalla -->
              <div class="space-y-3 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <div class="flex items-center gap-2 pb-1 border-b border-white/10">
                  <app-hero-icon name="tv" class="text-base text-yellow-400" />
                  <p class="font-bold uppercase tracking-wider text-sm kiosk:text-base text-white">Protector de pantalla</p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    uiSfx="select"
                    [class]="chipClass(settings.screensaverMode() === 'classic')"
                    style="touch-action: manipulation;"
                    (click)="changeScreensaver('classic')"
                  >
                    Clásico
                  </button>
                  <button
                    type="button"
                    uiSfx="select"
                    [class]="chipClass(settings.screensaverMode() === 'video')"
                    style="touch-action: manipulation;"
                    (click)="changeScreensaver('video')"
                  >
                    Video
                  </button>
                </div>
                <div class="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-neutral-300 flex items-start gap-2">
                  <app-hero-icon name="information-circle" class="text-yellow-400 shrink-0 mt-0.5" />
                  <span>{{ screensaverExplanation(settings.screensaverMode()) }}</span>
                </div>
              </div>

              <!-- Zona Restaurar por Defecto -->
              <div class="pt-2">
                <button
                  type="button"
                  uiSfx="select"
                  class="w-full py-3.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-400/30 text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                  style="touch-action: manipulation;"
                  (click)="askConfirm('resetDefaults')"
                >
                  <app-hero-icon name="arrow-path" class="text-base text-rose-400" />
                  <span>Restaurar ajustes por defecto del catálogo</span>
                </button>
              </div>
            </div>
          }

          <!-- Nivel 2.1b: Gestión Global de Marcas del Kiosco -->
          @if (settingsView() === 'brands-global') {
            <div class="space-y-6">
              <div class="space-y-1">
                <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5">
                  <app-hero-icon name="swatch" class="text-2xl text-yellow-400" />
                  <span>Marcas del Kiosco</span>
                </h2>
                <p class="text-neutral-400 text-sm sm:text-base">
                  Activa o desactiva las marcas disponibles en la pantalla inicial del paciente.
                </p>
              </div>

              <div class="flex flex-col gap-3.5 pt-1">
                @for (brand of catalog.rawManifest().brands; track brand.id) {
                  <div
                    class="min-h-18 sm:min-h-20 w-full rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 shadow-xl"
                  >
                    <div class="flex items-center gap-3.5 min-w-0">
                      <div class="size-11 sm:size-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-yellow-400 font-extrabold text-sm sm:text-base shrink-0">
                        <app-hero-icon name="tag" class="text-lg text-yellow-400" />
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <h3 class="text-sm sm:text-base font-bold text-white truncate">
                            {{ cleanText(brand.name) }}
                          </h3>
                          @if (brand.develop) {
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-400/40 text-amber-300">
                              Beta
                            </span>
                          }
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                            [class]="brand.enabled ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-rose-500/20 border-rose-400/40 text-rose-300'"
                          >
                            {{ brand.enabled ? 'Activa' : 'Desactivada' }}
                          </span>
                        </div>
                        <p class="text-xs text-neutral-400 truncate mt-0.5">
                          {{ brand.enabled ? 'Visible en el selector de marcas del kiosco' : 'Marca oculta en toda la aplicación' }}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      uiSfx="select"
                      class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none"
                      [class]="brand.enabled ? 'bg-emerald-500 border-emerald-400' : 'bg-white/15 border-white/30'"
                      (click)="toggleBrand(brand)"
                      [attr.aria-label]="brand.enabled ? 'Desactivar marca ' + cleanText(brand.name) : 'Activar marca ' + cleanText(brand.name)"
                    >
                      <span
                        class="pointer-events-none inline-flex items-center justify-center size-6 rounded-full bg-white shadow-md transform transition duration-200 ease-in-out mt-0.5"
                        [class]="brand.enabled ? 'translate-x-6' : 'translate-x-0.5'"
                      >
                        <app-hero-icon [name]="brand.enabled ? 'check' : 'x-mark'" class="text-xs" [class]="brand.enabled ? 'text-emerald-600' : 'text-neutral-400'" />
                      </span>
                    </button>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Nivel 2.2: Selección de Marca para el juego seleccionado -->
          @if (settingsView() === 'brands' && selectedGame(); as gameId) {
            <div class="space-y-6">
              <div class="space-y-1">
                <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5">
                  <app-hero-icon [name]="gameId === 'memory' ? 'square-2-stack' : 'squares-2x2'" class="text-2xl text-yellow-400" />
                  <span>{{ gameId === 'memory' ? 'Memoria' : 'Triqui' }} · Seleccionar Marca</span>
                </h2>
                <p class="text-neutral-400 text-sm sm:text-base">
                  Elige la marca para configurar sus reglas y activación individual.
                </p>
              </div>

              <div class="flex flex-col gap-3 pt-1">
                @for (brand of catalog.rawManifest().brands; track brand.id) {
                  @let exp = getExperienceForBrandGame(brand.id, gameId);
                  <button
                    type="button"
                    uiSfx="select"
                    class="min-h-16 sm:min-h-18 w-full rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 py-3.5 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer"
                    style="touch-action: manipulation;"
                    (click)="openSettingsExperience(brand)"
                  >
                    <div class="flex items-center gap-3.5 min-w-0">
                      <div class="size-10 sm:size-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-yellow-400 font-extrabold text-sm sm:text-base shrink-0">
                        <app-hero-icon [name]="gameId === 'memory' ? 'square-2-stack' : 'squares-2x2'" class="text-lg text-yellow-400" />
                      </div>
                      <div class="min-w-0">
                        <h3 class="text-sm sm:text-base font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                          {{ cleanText(brand.name) }}
                        </h3>
                        <p class="text-xs text-neutral-400 truncate">
                          ID: {{ exp?.id ?? (brand.id + '-' + gameId) }}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-2.5 shrink-0">
                      @if (brand.develop) {
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-400/40 text-amber-300">
                          Beta
                        </span>
                      }
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border hidden sm:inline-block"
                        [class]="brand.enabled ? 'bg-white/10 border-white/20 text-neutral-300' : 'bg-rose-500/15 border-rose-400/30 text-rose-300'"
                      >
                        {{ brand.enabled ? 'Marca activa' : 'Marca inactiva' }}
                      </span>
                      <span
                        class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border"
                        [class]="exp?.enabled ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300' : 'bg-rose-500/15 border-rose-400/30 text-rose-300'"
                      >
                        {{ exp?.enabled ? 'Juego activo' : 'Juego off' }}
                      </span>
                      <div class="size-7 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400">
                        <app-hero-icon name="chevron-right" />
                      </div>
                    </div>
                  </button>
                }
              </div>
            </div>
          }

          <!-- Nivel 2.3: Configuración de la Experiencia (Juego + Marca) -->
          @if (settingsView() === 'experience' && selectedGame(); as gameId) {
            @if (selectedBrand(); as brand) {
              @let exp = getExperienceForBrandGame(brand.id, gameId);
              @if (exp) {
                <div class="space-y-6">
                  <div class="space-y-1">
                    <div class="flex flex-wrap items-center gap-3">
                      <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5">
                        <app-hero-icon [name]="gameId === 'memory' ? 'square-2-stack' : 'squares-2x2'" class="text-2xl text-yellow-400" />
                        <span>{{ gameId === 'memory' ? 'Memoria' : 'Triqui' }} · {{ cleanText(brand.name) }}</span>
                      </h2>
                      @if (exp.develop || brand.develop || catalog.isGameDevelop(gameId)) {
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/25 border border-amber-400/50 text-amber-300 flex items-center gap-1.5">
                          <app-hero-icon name="lock-closed" class="text-xs" />
                          <span>En desarrollo</span>
                        </span>
                      }
                    </div>
                    <p class="text-neutral-400 text-sm sm:text-base">
                      Ajustes específicos para esta marca en la consola táctil.
                    </p>
                  </div>

                  <!-- Control Global de la Marca -->
                  <div class="p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center justify-between gap-4">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <app-hero-icon name="swatch" class="text-sm text-yellow-400" />
                        <span class="font-extrabold uppercase tracking-wider text-xs sm:text-sm text-neutral-200">
                          Marca en el Kiosco (Global)
                        </span>
                        <span
                          class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                          [class]="isBrandEnabled(brand.id) ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-rose-500/20 border-rose-400/40 text-rose-300'"
                        >
                          {{ isBrandEnabled(brand.id) ? 'Activa' : 'Desactivada' }}
                        </span>
                      </div>
                      <p class="text-xs text-neutral-400 mt-1">
                        {{ isBrandEnabled(brand.id) ? 'Visible en el selector de marcas inicial del paciente.' : 'Marca oculta en todo el kiosco.' }}
                      </p>
                    </div>

                    <button
                      type="button"
                      uiSfx="select"
                      class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none"
                      [class]="isBrandEnabled(brand.id) ? 'bg-emerald-500 border-emerald-400' : 'bg-white/15 border-white/30'"
                      (click)="toggleBrandById(brand.id)"
                      [attr.aria-label]="isBrandEnabled(brand.id) ? 'Desactivar marca a nivel global' : 'Activar marca a nivel global'"
                    >
                      <span
                        class="pointer-events-none inline-flex items-center justify-center size-5 rounded-full bg-white shadow-md transform transition duration-200 ease-in-out mt-0.5"
                        [class]="isBrandEnabled(brand.id) ? 'translate-x-5' : 'translate-x-0.5'"
                      >
                        <app-hero-icon [name]="isBrandEnabled(brand.id) ? 'check' : 'x-mark'" class="text-[10px]" [class]="isBrandEnabled(brand.id) ? 'text-emerald-600' : 'text-neutral-400'" />
                      </span>
                    </button>
                  </div>

                  <!-- Primera Opción: Switch de juego activo / desactivado para esa marca -->
                  <div class="p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl flex items-center justify-between gap-4">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <app-hero-icon [name]="gameId === 'memory' ? 'square-2-stack' : 'squares-2x2'" class="text-base text-yellow-400" />
                        <span class="font-extrabold uppercase tracking-wider text-sm kiosk:text-base text-white">
                          Juego en esta marca
                        </span>
                        <span
                          class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                          [class]="exp.enabled ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-rose-500/20 border-rose-400/40 text-rose-300'"
                        >
                          {{ exp.enabled ? 'Activo' : 'Desactivado' }}
                        </span>
                      </div>
                      <p class="text-xs sm:text-sm text-neutral-400 mt-1">
                        {{ exp.enabled ? 'El juego está visible y disponible en la pantalla del paciente.' : 'El juego está oculto en el catálogo para esta marca.' }}
                      </p>
                    </div>

                    <button
                      type="button"
                      uiSfx="select"
                      class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none"
                      [class]="exp.enabled ? 'bg-emerald-500 border-emerald-400' : 'bg-white/15 border-white/30'"
                      (click)="toggleExperience(exp, brand.name)"
                      [attr.aria-label]="exp.enabled ? 'Desactivar juego para esta marca' : 'Activar juego para esta marca'"
                    >
                      <span
                        class="pointer-events-none inline-flex items-center justify-center size-6 rounded-full bg-white shadow-md transform transition duration-200 ease-in-out mt-0.5"
                        [class]="exp.enabled ? 'translate-x-6' : 'translate-x-0.5'"
                      >
                        <app-hero-icon [name]="exp.enabled ? 'check' : 'x-mark'" class="text-xs" [class]="exp.enabled ? 'text-emerald-600' : 'text-neutral-400'" />
                      </span>
                    </button>
                  </div>

                  <!-- Ajustes específicos de Memoria -->
                  @if (gameId === 'memory') {
                    @let memConfig = getEffectiveMemoryConfig(exp);
                    <div class="space-y-4 p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
                      <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                          <app-hero-icon name="square-2-stack" class="text-lg text-yellow-400" />
                          <h3 class="font-extrabold uppercase tracking-wide text-sm kiosk:text-base text-white">
                            Configuración de partida
                          </h3>
                        </div>
                        @if (memConfig.isCustomOverride) {
                          <button
                            type="button"
                            uiSfx="select"
                            class="text-xs font-bold text-neutral-400 hover:text-yellow-400 underline transition-colors cursor-pointer"
                            (click)="resetExperienceMemoryToDefault(exp, brand.name)"
                          >
                            Restaurar catálogo
                          </button>
                        }
                      </div>

                      <!-- Control 1: Cantidad de parejas con stepper [-] N [+] -->
                      <div class="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200">
                            Cantidad de parejas
                          </span>
                          <span class="text-xs text-neutral-400">
                            ({{ memConfig.pairs * 2 }} cartas en tablero)
                          </span>
                        </div>

                        <div class="flex items-center justify-between gap-3 pt-1">
                          <button
                            type="button"
                            uiSfx="select"
                            [disabled]="memConfig.pairs <= 2"
                            class="size-11 sm:size-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border border-white/15 flex items-center justify-center text-white text-xl font-bold cursor-pointer transition-all"
                            (click)="changeMemoryPairsStep(exp, -1, brand.name)"
                            aria-label="Disminuir parejas"
                          >
                            <app-hero-icon name="minus" class="text-lg" />
                          </button>

                          <div class="flex-1 text-center py-2 px-4 rounded-xl bg-white/5 border border-white/10">
                            <span class="text-xl sm:text-2xl font-black text-yellow-400 tabular-nums">
                              {{ memConfig.pairs }}
                            </span>
                            <span class="text-xs sm:text-sm uppercase font-bold text-neutral-300 ml-2">
                              {{ memConfig.pairs === 1 ? 'pareja' : 'parejas' }}
                            </span>
                          </div>

                          <button
                            type="button"
                            uiSfx="select"
                            [disabled]="memConfig.pairs >= 6"
                            class="size-11 sm:size-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border border-white/15 flex items-center justify-center text-white text-xl font-bold cursor-pointer transition-all"
                            (click)="changeMemoryPairsStep(exp, 1, brand.name)"
                            aria-label="Aumentar parejas"
                          >
                            <app-hero-icon name="plus" class="text-lg" />
                          </button>
                        </div>
                      </div>

                      <!-- Control 2: Presets de Dificultad -->
                      <div class="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200">
                            Dificultad
                          </span>
                          @if (memConfig.difficulty === 'custom') {
                            <span class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                              Personalizada
                            </span>
                          }
                        </div>

                        <div class="grid grid-cols-3 gap-2.5 pt-1">
                          <button
                            type="button"
                            uiSfx="select"
                            [class]="chipClass(memConfig.difficulty === 'easy')"
                            style="touch-action: manipulation;"
                            (click)="selectMemoryDifficulty(exp, 'easy', brand.name)"
                          >
                            <span class="text-xs sm:text-sm font-extrabold uppercase">Fácil</span>
                          </button>

                          <button
                            type="button"
                            uiSfx="select"
                            [class]="chipClass(memConfig.difficulty === 'medium')"
                            style="touch-action: manipulation;"
                            (click)="selectMemoryDifficulty(exp, 'medium', brand.name)"
                          >
                            <div class="flex flex-col items-center justify-center py-0.5">
                              <span class="text-xs sm:text-sm font-extrabold uppercase">Medio</span>
                              <span class="text-[9px] uppercase tracking-wider text-yellow-300 font-semibold">Recomendado</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            uiSfx="select"
                            [class]="chipClass(memConfig.difficulty === 'hard')"
                            style="touch-action: manipulation;"
                            (click)="selectMemoryDifficulty(exp, 'hard', brand.name)"
                          >
                            <span class="text-xs sm:text-sm font-extrabold uppercase">Difícil</span>
                          </button>
                        </div>
                      </div>

                      <!-- Control 3: Vidas / errores permitidos con stepper [-] N [+] -->
                      <div class="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200">
                            Vidas / errores permitidos
                          </span>
                          <span class="text-xs text-neutral-400">
                            Mínimo 3 vidas
                          </span>
                        </div>

                        <div class="flex items-center justify-between gap-3 pt-1">
                          <button
                            type="button"
                            uiSfx="select"
                            [disabled]="memConfig.lives <= 3"
                            class="size-11 sm:size-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border border-white/15 flex items-center justify-center text-white text-xl font-bold cursor-pointer transition-all"
                            (click)="changeMemoryLivesStep(exp, -1, brand.name)"
                            aria-label="Disminuir vidas"
                          >
                            <app-hero-icon name="minus" class="text-lg" />
                          </button>

                          <div class="flex-1 text-center py-2 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]">
                              <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3.5 7.02 3.5c1.82 0 3.393 1.056 4.23 2.593.837-1.537 2.41-2.593 4.23-2.593 2.306 0 4.77 1.822 4.77 4.75 0 3.924-2.438 7.11-4.739 9.266a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                            </svg>
                            <span class="text-xl sm:text-2xl font-black text-white tabular-nums">
                              {{ memConfig.lives }}
                            </span>
                            <span class="text-xs sm:text-sm uppercase font-bold text-neutral-300">
                              {{ memConfig.lives === 1 ? 'vida' : 'vidas' }}
                            </span>
                          </div>

                          <button
                            type="button"
                            uiSfx="select"
                            class="size-11 sm:size-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center justify-center text-white text-xl font-bold cursor-pointer transition-all"
                            (click)="changeMemoryLivesStep(exp, 1, brand.name)"
                            aria-label="Aumentar vidas"
                          >
                            <app-hero-icon name="plus" class="text-lg" />
                          </button>
                        </div>
                      </div>

                      <!-- Explicación contextual -->
                      <div class="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-neutral-300 flex items-start gap-2.5">
                        <app-hero-icon name="information-circle" class="text-yellow-400 shrink-0 mt-0.5 text-base" />
                        <span>{{ memoryConfigExplanation(memConfig, memConfig.isCustomOverride) }}</span>
                      </div>
                    </div>
                  }

                  <!-- Ajustes específicos de Triqui -->
                  @if (gameId === 'triqui') {
                    <!-- Triqui · Dificultad -->
                    @let defaultDiff = getDefaultTriquiDifficulty(exp);
                    @let currentDiff = settings.getExperienceTriquiDifficulty(exp.id);
                    <div class="space-y-3 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                      <div class="flex items-center gap-2">
                        <app-hero-icon name="chart-bar" class="text-sm text-yellow-400" />
                        <p class="font-bold uppercase tracking-wider text-sm kiosk:text-base text-white">
                          Dificultad
                        </p>
                      </div>

                      <div class="grid grid-cols-2 gap-3">
                        <!-- Opción por defecto -->
                        <button
                          type="button"
                          uiSfx="select"
                          [class]="chipClass(currentDiff === null)"
                          style="touch-action: manipulation;"
                          (click)="changeExperienceTriquiDifficulty(exp.id, null, brand.name, defaultDiff)"
                        >
                          <div class="flex flex-col items-center justify-center gap-1 py-0.5">
                            <span class="text-xs sm:text-sm uppercase font-bold">Opción por defecto</span>
                            <span class="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-yellow-300">
                              {{ difficultyLabel(defaultDiff) }}
                            </span>
                          </div>
                        </button>

                        @for (opt of triquiDifficultyOptions; track opt.value) {
                          @let isDefaultVal = opt.value === defaultDiff;
                          <button
                            type="button"
                            uiSfx="select"
                            [disabled]="isDefaultVal"
                            [class]="isDefaultVal ? chipDisabledClass() : chipClass(currentDiff === opt.value)"
                            style="touch-action: manipulation;"
                            (click)="changeExperienceTriquiDifficulty(exp.id, opt.value, brand.name, defaultDiff)"
                          >
                            <div class="flex flex-col items-center justify-center gap-0.5 py-0.5">
                              <span>{{ opt.label }}</span>
                              @if (isDefaultVal) {
                                <span class="text-[9px] uppercase tracking-wider text-neutral-400 font-semibold">(Por defecto)</span>
                              }
                            </div>
                          </button>
                        }
                      </div>

                      <div class="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-neutral-300 flex items-start gap-2">
                        <app-hero-icon name="information-circle" class="text-yellow-400 shrink-0 mt-0.5" />
                        <span>{{ triquiDifficultyExplanation(currentDiff, defaultDiff) }}</span>
                      </div>
                    </div>

                    <!-- Triqui · Quién empieza -->
                    @let defaultFirst = getDefaultTriquiFirstPlayer(exp);
                    @let currentFirst = settings.getExperienceTriquiFirstPlayer(exp.id);
                    <div class="space-y-3 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                      <div class="flex items-center gap-2">
                        <app-hero-icon name="user" class="text-sm text-yellow-400" />
                        <p class="font-bold uppercase tracking-wider text-sm kiosk:text-base text-white">
                          Quién empieza
                        </p>
                      </div>

                      <div class="grid grid-cols-2 gap-3">
                        <!-- Opción por defecto -->
                        <button
                          type="button"
                          uiSfx="select"
                          [class]="chipClass(currentFirst === null)"
                          style="touch-action: manipulation;"
                          (click)="changeExperienceTriquiFirstPlayer(exp.id, null, brand.name, defaultFirst)"
                        >
                          <div class="flex flex-col items-center justify-center gap-1 py-0.5">
                            <span class="text-xs sm:text-sm uppercase font-bold">Opción por defecto</span>
                            <span class="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-yellow-300">
                              {{ firstPlayerLabel(defaultFirst) }}
                            </span>
                          </div>
                        </button>

                        @for (opt of triquiFirstOptions; track opt.value) {
                          @let isDefaultVal = opt.value === defaultFirst;
                          <button
                            type="button"
                            uiSfx="select"
                            [disabled]="isDefaultVal"
                            [class]="isDefaultVal ? chipDisabledClass() : chipClass(currentFirst === opt.value)"
                            style="touch-action: manipulation;"
                            (click)="changeExperienceTriquiFirstPlayer(exp.id, opt.value, brand.name, defaultFirst)"
                          >
                            <div class="flex flex-col items-center justify-center gap-0.5 py-0.5">
                              <span>{{ opt.label }}</span>
                              @if (isDefaultVal) {
                                <span class="text-[9px] uppercase tracking-wider text-neutral-400 font-semibold">(Por defecto)</span>
                              }
                            </div>
                          </button>
                        }
                      </div>

                      <div class="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-neutral-300 flex items-start gap-2">
                        <app-hero-icon name="information-circle" class="text-yellow-400 shrink-0 mt-0.5" />
                        <span>{{ triquiFirstPlayerExplanation(currentFirst, defaultFirst) }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            }
          }
        }

        <!-- ═══ SUB-PÁGINA 3: DIAGNÓSTICO ═══ -->
        @if (activeSection() === 'diagnostics') {
          <div class="space-y-6">
            <div class="space-y-1">
              <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5">
                <app-hero-icon name="cpu-chip" class="text-2xl text-yellow-400" />
                <span>Diagnóstico del Sistema</span>
              </h2>
              <p class="text-neutral-400 text-sm sm:text-base">
                Métricas técnicas de entorno, pantalla y catálogo activo.
              </p>
            </div>

            <div class="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md p-5 sm:p-6 space-y-2.5 text-sm sm:text-base kiosk:text-lg font-mono">
              <div class="flex justify-between py-1 border-b border-white/10 items-center">
                <span class="text-neutral-400 flex items-center gap-2">
                  <app-hero-icon name="device-phone-mobile" class="text-sm text-yellow-400" />
                  <span>Versión App</span>
                </span>
                <span class="font-bold text-white">{{ platform.appVersion() }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/10 items-center">
                <span class="text-neutral-400 flex items-center gap-2">
                  <app-hero-icon name="folder" class="text-sm text-yellow-400" />
                  <span>Catálogo</span>
                </span>
                <span class="font-bold text-white">v{{ catalog.rawManifest().version }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/10 items-center">
                <span class="text-neutral-400 flex items-center gap-2">
                  <app-hero-icon name="server" class="text-sm text-yellow-400" />
                  <span>Entorno</span>
                </span>
                <span class="font-bold text-white">{{ platform.platformKind }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/10 items-center">
                <span class="text-neutral-400 flex items-center gap-2">
                  <app-hero-icon name="tv" class="text-sm text-yellow-400" />
                  <span>Resolución</span>
                </span>
                <span class="font-bold text-white">{{ viewportLabel() }}</span>
              </div>
              <div class="flex justify-between py-1 items-center">
                <span class="text-neutral-400 flex items-center gap-2">
                  <app-hero-icon name="arrows-pointing-out" class="text-sm text-yellow-400" />
                  <span>Proporción</span>
                </span>
                <span class="font-bold text-white">{{ aspectLabel() }}</span>
              </div>
            </div>

            <div class="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div>
                <p class="font-bold uppercase tracking-wider text-xs sm:text-sm text-yellow-400 pb-2 flex items-center gap-2">
                  <app-hero-icon name="swatch" class="text-sm text-yellow-400" />
                  <span>Marcas</span>
                </p>
                <div class="space-y-1.5">
                  @for (brand of catalog.rawManifest().brands; track brand.id) {
                    <p class="text-sm kiosk:text-base text-neutral-200">
                      {{ brand.id }} · v{{ brand.version }} · <span [class.text-emerald-400]="brand.enabled" [class.text-neutral-500]="!brand.enabled">{{ brand.enabled ? 'activa' : 'off' }}</span>
                    </p>
                  }
                </div>
              </div>

              <div class="pt-2 border-t border-white/10">
                <p class="font-bold uppercase tracking-wider text-xs sm:text-sm text-yellow-400 pb-2 flex items-center gap-2">
                  <app-hero-icon name="cube" class="text-sm text-yellow-400" />
                  <span>Motores</span>
                </p>
                <div class="space-y-1.5">
                  @for (game of catalog.rawManifest().games; track game.id) {
                    <p class="text-sm kiosk:text-base text-neutral-200">
                      {{ game.id }} · v{{ game.version }} · <span [class.text-emerald-400]="game.enabled" [class.text-neutral-500]="!game.enabled">{{ game.enabled ? 'activo' : 'off' }}</span>
                    </p>
                  }
                </div>
              </div>

              <div class="pt-2 border-t border-white/10">
                <p class="font-bold uppercase tracking-wider text-xs sm:text-sm text-yellow-400 pb-2 flex items-center gap-2">
                  <app-hero-icon name="sparkles" class="text-sm text-yellow-400" />
                  <span>Experiencias</span>
                </p>
                <div class="space-y-1.5">
                  @for (exp of catalog.rawManifest().experiences; track exp.id) {
                    <p class="text-sm kiosk:text-base text-neutral-200">
                      {{ exp.id }} · v{{ exp.version }} · <span [class.text-emerald-400]="exp.enabled" [class.text-neutral-500]="!exp.enabled">{{ exp.enabled ? 'activa' : 'off' }}</span>
                    </p>
                  }
                </div>
              </div>
            </div>
          </div>
        }

        <!-- ═══ SUB-PÁGINA 4: ACTUALIZACIONES ═══ -->
        @if (activeSection() === 'updates') {
          <div class="space-y-6">
            <div class="space-y-1">
              <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5">
                <app-hero-icon name="cloud-arrow-down" class="text-2xl text-yellow-400" />
                <span>Actualizaciones</span>
              </h2>
              <p class="text-neutral-400 text-sm sm:text-base">
                Revisión e instalación de versiones de catálogo y aplicación.
              </p>
            </div>

            <div class="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
              <p class="text-neutral-300 text-sm sm:text-base font-medium">{{ updateStatusCopy() }}</p>

              @if (snapshot().errorMessage) {
                <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-sm">
                  {{ snapshot().errorMessage }}
                </div>
              }

              @if (snapshot().appUpdateAvailable) {
                <div class="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-400/25 text-yellow-200 text-sm">
                  App {{ snapshot().appVersion }}
                  @if (snapshot().remoteAppVersion) {
                    → {{ snapshot().remoteAppVersion }}
                  }
                  . El ejecutable se instala al final y puede reiniciar.
                </div>
              }

              @if (visibleDiff().length > 0) {
                <div class="pt-2">
                  <p class="font-bold text-xs uppercase tracking-wider text-neutral-400 mb-2">Cambios detectados:</p>
                  <ul class="space-y-1.5 text-sm kiosk:text-base text-neutral-200">
                    @for (item of visibleDiff(); track item.collection + item.id) {
                      <li class="flex items-center gap-2">
                        <span class="size-1.5 rounded-full bg-yellow-400"></span>
                        <span>{{ collectionLabel(item) }} <strong>{{ item.id }}</strong> · {{ kindLabel(item) }}
                        @if (item.fromVersion && item.toVersion && item.kind === 'updated') {
                          ({{ item.fromVersion }} → {{ item.toVersion }})
                        }
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              }

              @if ((snapshot().pendingAssets?.length ?? 0) > 0) {
                <p class="text-neutral-400 text-xs sm:text-sm pt-2 border-t border-white/10">
                  Assets pendientes (sin descarga a disco en esta fase):
                  {{ snapshot().pendingAssets?.length }}
                </p>
              }
            </div>

            <app-kiosk-button
              variant="primary"
              [disabled]="updateBusy()"
              (click)="onUpdateCta()"
            >
              <app-hero-icon [name]="snapshot().appUpdateAvailable || (snapshot().catalogDiff?.items?.length ?? 0) > 0 ? 'arrow-down-tray' : 'arrow-path'" class="text-yellow-400" />
              {{ updateCtaLabel() }}
            </app-kiosk-button>
          </div>
        }

        <!-- ═══ SUB-PÁGINA 5: SEGURIDAD / PIN (Inputs Verticales) ═══ -->
        @if (activeSection() === 'pin') {
          <div class="space-y-6">
            <div class="space-y-1">
              <h2 class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5">
                <app-hero-icon name="key" class="text-2xl text-yellow-400" />
                <span>Cambiar PIN</span>
              </h2>
              <p class="text-neutral-400 text-sm sm:text-base">
                Toca cada campo e ingresa los dígitos correspondientes en el teclado numérico.
              </p>
            </div>

            <!-- Tres Inputs Verticales -->
            <div class="flex flex-col gap-3.5">
              <!-- Campo 1: PIN anterior -->
              <button
                type="button"
                class="w-full text-left p-4 rounded-2xl border transition-all cursor-pointer shadow-lg select-none"
                [class]="pinFieldClass('current')"
                (click)="pinField.set('current')"
              >
                <div class="flex justify-between items-center">
                  <span
                    class="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                    [class.text-yellow-400]="pinField() === 'current'"
                    [class.text-neutral-400]="pinField() !== 'current'"
                  >
                    <app-hero-icon name="lock-closed" class="text-sm" />
                    <span>1. Ingrese su PIN anterior</span>
                  </span>
                  @if (pinField() === 'current') {
                    <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                      Editando
                    </span>
                  }
                </div>
                <div class="mt-2 text-2xl font-mono tracking-[0.4em] text-white">
                  {{ pinDots(pinModel().current) }}
                </div>
              </button>

              <!-- Campo 2: Nuevo PIN -->
              <button
                type="button"
                class="w-full text-left p-4 rounded-2xl border transition-all cursor-pointer shadow-lg select-none"
                [class]="pinFieldClass('next')"
                (click)="pinField.set('next')"
              >
                <div class="flex justify-between items-center">
                  <span
                    class="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                    [class.text-yellow-400]="pinField() === 'next'"
                    [class.text-neutral-400]="pinField() !== 'next'"
                  >
                    <app-hero-icon name="key" class="text-sm" />
                    <span>2. Ingrese su nuevo PIN (mín. 4 dígitos)</span>
                  </span>
                  @if (pinField() === 'next') {
                    <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                      Editando
                    </span>
                  }
                </div>
                <div class="mt-2 text-2xl font-mono tracking-[0.4em] text-white">
                  {{ pinDots(pinModel().next) }}
                </div>
              </button>

              <!-- Campo 3: Repetir nuevo PIN -->
              <button
                type="button"
                class="w-full text-left p-4 rounded-2xl border transition-all cursor-pointer shadow-lg select-none"
                [class]="pinFieldClass('confirm')"
                (click)="pinField.set('confirm')"
              >
                <div class="flex justify-between items-center">
                  <span
                    class="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                    [class.text-yellow-400]="pinField() === 'confirm'"
                    [class.text-neutral-400]="pinField() !== 'confirm'"
                  >
                    <app-hero-icon name="shield-check" class="text-sm" />
                    <span>3. Repita su nuevo PIN</span>
                  </span>
                  @if (pinField() === 'confirm') {
                    <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                      Editando
                    </span>
                  }
                </div>
                <div class="mt-2 text-2xl font-mono tracking-[0.4em] text-white">
                  {{ pinDots(pinModel().confirm) }}
                </div>
              </button>
            </div>

            <!-- Teclado Numérico Táctil -->
            <div class="grid grid-cols-3 gap-3 max-w-sm mx-auto w-full pt-2">
              @for (key of pinKeys; track key) {
                <button
                  type="button"
                  uiSfx="click"
                  class="min-h-14 sm:min-h-16 rounded-2xl bg-white/8 hover:bg-white/15 border border-white/15 text-xl font-bold active:scale-95 transition-all text-white"
                  style="touch-action: manipulation;"
                  (click)="appendPinDigit(key)"
                >
                  {{ key }}
                </button>
              }
              <button
                type="button"
                uiSfx="back"
                class="min-h-14 sm:min-h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-300 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 text-center"
                style="touch-action: manipulation;"
                (click)="pinBackspace()"
              >
                <app-hero-icon name="backspace" class="text-xl text-neutral-300" />
                <span>Borrar</span>
              </button>
              <button
                type="button"
                uiSfx="click"
                class="min-h-14 sm:min-h-16 rounded-2xl bg-white/8 hover:bg-white/15 border border-white/15 text-xl font-bold active:scale-95 transition-all text-white"
                style="touch-action: manipulation;"
                (click)="appendPinDigit('0')"
              >
                0
              </button>
              <button
                type="button"
                uiSfx="click"
                class="min-h-14 sm:min-h-16 rounded-2xl bg-yellow-400/25 hover:bg-yellow-400/35 border border-yellow-400/50 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-yellow-300 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 text-center"
                style="touch-action: manipulation;"
                (click)="requestPinChange()"
              >
                <app-hero-icon name="check" class="text-xl text-yellow-300" />
                <span>Guardar</span>
              </button>
            </div>

            @if (pinMessage()) {
              <div
                class="p-4 rounded-xl text-center text-sm sm:text-base font-medium"
                [class.bg-rose-500/15]="pinError()"
                [class.border]="true"
                [class.border-rose-400/30]="pinError()"
                [class.text-rose-200]="pinError()"
                [class.bg-emerald-500/15]="!pinError()"
                [class.border-emerald-400/30]="!pinError()"
                [class.text-emerald-200]="!pinError()"
              >
                {{ pinMessage() }}
              </div>
            }
          </div>
        }

      </div>
    </main>

    @if (confirmKind(); as kind) {
      <app-admin-confirm
        [title]="confirmTitle(kind)"
        [message]="confirmMessage(kind)"
        [confirmLabel]="kind === 'applyUpdate' ? 'Instalar' : kind === 'changePin' ? 'Confirmar y cambiar' : kind === 'resetDefaults' ? 'Restaurar' : 'Confirmar'"
        (confirmed)="onConfirm()"
        (cancelled)="confirmKind.set(null)"
      />
    }
  `,
})
export class AdminPanel {
  protected readonly Math = Math;
  protected readonly catalog = inject(CatalogService);
  protected readonly settings = inject(KioskSettings);
  protected readonly platform = inject(PlatformService);
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);
  private readonly updates = inject(UpdateCoordinator);
  private readonly mediaPlayer = inject(MediaPlayer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly activeSection = signal<AdminSection | null>(null);
  protected readonly settingsView = signal<SettingsView>('menu');
  protected readonly selectedGame = signal<'memory' | 'triqui' | null>(null);
  protected readonly selectedBrand = signal<Brand | null>(null);

  protected readonly menuOptions = MENU_OPTIONS;
  protected readonly memoryPairOptions = MEMORY_PAIR_OPTIONS;
  protected readonly triquiDifficultyOptions = TRIQUI_DIFFICULTY_OPTIONS;
  protected readonly triquiFirstOptions = TRIQUI_FIRST_OPTIONS;
  protected readonly pinKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

  protected readonly snapshot = this.updates.snapshot;
  protected readonly confirmKind = signal<ConfirmKind>(null);
  protected readonly opMessage = signal('');
  protected readonly pinField = signal<PinField>('current');
  protected readonly pinMessage = signal('');
  protected readonly pinError = signal(false);
  protected readonly viewport = signal({ width: 0, height: 0 });

  protected readonly pinModel = signal({ current: '', next: '', confirm: '' });

  protected readonly isNative = computed(() => this.platform.isNative);
  protected readonly updateBusy = computed(() => {
    const status = this.snapshot().status;
    return status === 'checking' || status === 'downloading' || status === 'installing';
  });
  protected readonly visibleDiff = computed(() =>
    (this.snapshot().catalogDiff?.items ?? []).filter((item) => item.kind !== 'unchanged'),
  );

  // ─── Toast Reactivo ──────────────────────────────────────────────────────────
  protected readonly toast = signal<{ title: string; message: string } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.refreshViewport();
    const onResize = () => this.refreshViewport();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
    }
    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.session.logout();
    });
  }

  protected showToast(title: string, message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ title, message });
    this.toastTimer = setTimeout(() => {
      this.toast.set(null);
      this.toastTimer = null;
    }, 2500);
  }

  protected isAtRootMenu(): boolean {
    return this.activeSection() === null;
  }

  protected openSection(section: AdminSection): void {
    this.activeSection.set(section);
    if (section === 'settings') {
      this.settingsView.set('menu');
      this.selectedGame.set(null);
      this.selectedBrand.set(null);
    }
  }

  protected goToDiagnostics(): void {
    this.openSection('diagnostics');
  }

  protected openSettingsGeneral(): void {
    this.settingsView.set('general');
  }

  protected openSettingsBrandsGlobal(): void {
    this.settingsView.set('brands-global');
  }

  protected openSettingsGame(game: 'memory' | 'triqui'): void {
    this.selectedGame.set(game);
    this.selectedBrand.set(null);
    this.settingsView.set('brands');
  }

  protected openSettingsExperience(brand: Brand): void {
    this.selectedBrand.set(brand);
    this.settingsView.set('experience');
  }

  protected isBrandEnabled(brandId: string): boolean {
    return this.catalog.rawManifest().brands.find((b) => b.id === brandId)?.enabled ?? true;
  }

  protected toggleBrand(brand: Brand): void {
    const nextState = !brand.enabled;
    this.catalog.setBrandEnabled(brand.id, nextState);
    const name = this.cleanText(brand.name);
    this.showToast('Marca ' + name, nextState ? 'Marca activada' : 'Marca desactivada');
  }

  protected toggleBrandById(brandId: string): void {
    const brand = this.catalog.rawManifest().brands.find((b) => b.id === brandId);
    if (!brand) return;
    this.toggleBrand(brand);
  }

  protected onBack(): void {
    if (this.activeSection() === 'settings') {
      if (this.settingsView() === 'experience') {
        this.settingsView.set('brands');
        this.selectedBrand.set(null);
        return;
      }
      if (this.settingsView() === 'brands') {
        this.settingsView.set('menu');
        this.selectedGame.set(null);
        return;
      }
      if (this.settingsView() === 'brands-global') {
        this.settingsView.set('menu');
        return;
      }
      if (this.settingsView() === 'general') {
        this.settingsView.set('menu');
        return;
      }
      this.activeSection.set(null);
      return;
    }

    if (this.activeSection() !== null) {
      this.activeSection.set(null);
      return;
    }

    this.leavePanel();
  }

  protected currentHeaderTitle(): string {
    const sec = this.activeSection();
    if (sec === 'settings') {
      const view = this.settingsView();
      if (view === 'general') return 'Ajustes Generales';
      if (view === 'brands-global') return 'Marcas del Kiosco';
      if (view === 'brands') {
        const g = this.selectedGame() === 'memory' ? 'Memoria' : 'Triqui';
        return `${g} · Marcas`;
      }
      if (view === 'experience') {
        const g = this.selectedGame() === 'memory' ? 'Memoria' : 'Triqui';
        const b = this.cleanText(this.selectedBrand()?.name ?? '');
        return `${g} · ${b}`;
      }
      return 'Ajustes de Juego';
    }
    return sec ? this.sectionTitle(sec) : 'Administración';
  }

  protected currentHeaderIcon(): HeroIconName {
    const sec = this.activeSection();
    if (sec === 'settings') {
      const view = this.settingsView();
      if (view === 'general') return 'adjustments-horizontal';
      if (view === 'brands-global') return 'swatch';
      if (view === 'brands' || view === 'experience') {
        return this.selectedGame() === 'memory' ? 'square-2-stack' : 'squares-2x2';
      }
      return 'adjustments-horizontal';
    }
    return sec ? this.sectionIcon(sec) : 'cog-6-tooth';
  }

  protected sectionTitle(section: AdminSection): string {
    const opt = MENU_OPTIONS.find((m) => m.id === section);
    return opt?.title ?? 'Administración';
  }

  protected sectionIcon(section: AdminSection): HeroIconName {
    const opt = MENU_OPTIONS.find((m) => m.id === section);
    return opt?.icon ?? 'cog-6-tooth';
  }

  protected cleanText(text: string): string {
    return text.replace(/<[^>]*>/g, '').trim();
  }

  protected viewportLabel(): string {
    const { width, height } = this.viewport();
    return `${width}×${height}`;
  }

  protected aspectLabel(): string {
    const { width, height } = this.viewport();
    if (width <= 0 || height <= 0) return '—';
    const ratio = width / height;
    if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
    if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
    return ratio > 1 ? 'landscape' : 'portrait';
  }

  protected chipClass(active: boolean): string {
    const base =
      'min-h-14 kiosk:min-h-16 rounded-2xl border px-3 py-3 text-sm kiosk:text-base font-bold uppercase tracking-wide active:scale-95 transition-all text-center cursor-pointer';
    return active
      ? `${base} bg-yellow-400/20 border-yellow-400/50 text-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.15)]`
      : `${base} bg-white/5 border-white/15 text-neutral-300 hover:bg-white/10`;
  }

  protected chipDisabledClass(): string {
    return 'min-h-14 kiosk:min-h-16 rounded-2xl border px-3 py-3 text-sm kiosk:text-base font-bold uppercase tracking-wide text-center bg-white/[0.02] border-white/10 text-neutral-500 opacity-40 cursor-not-allowed pointer-events-none select-none';
  }

  protected pinFieldClass(field: PinField): string {
    const isActive = this.pinField() === field;
    return isActive
      ? 'border-yellow-400/60 bg-yellow-400/10 shadow-[0_0_20px_rgba(250,204,21,0.12)] ring-1 ring-yellow-400/40'
      : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10';
  }

  // ─── Helpers de Experiencias y Catálogo ──────────────────────────────────────

  protected getExperienceForBrandGame(brandId: string, gameId: string): GameExperience | undefined {
    return this.catalog.rawManifest().experiences.find(
      (e) => e.brandId === brandId && e.gameId === gameId,
    );
  }

  protected toggleExperience(exp: GameExperience, brandName: string): void {
    const nextState = !exp.enabled;
    this.catalog.setExperienceEnabled(exp.id, nextState);
    const cleanBrand = this.cleanText(brandName);
    this.showToast(
      `${cleanBrand} · ${exp.gameId === 'memory' ? 'Memoria' : 'Triqui'}`,
      nextState ? 'Juego activado' : 'Juego desactivado',
    );
  }

  // Defaults de catálogo para badges:
  protected getDefaultMemoryPairs(exp?: GameExperience): number {
    const expConfig = exp?.config?.['pairs'];
    if (typeof expConfig === 'number') return expConfig;
    const gameConfig = this.catalog.getGameById('memory')?.config?.['pairs'];
    if (typeof gameConfig === 'number') return gameConfig;
    return 4;
  }

  protected getDefaultTriquiDifficulty(exp?: GameExperience): Difficulty {
    const expDiff = exp?.config?.['difficulty'];
    if (expDiff === 'easy' || expDiff === 'medium' || expDiff === 'hard') return expDiff;
    const gameDiff = this.catalog.getGameById('triqui')?.config?.['difficulty'];
    if (gameDiff === 'easy' || gameDiff === 'medium' || gameDiff === 'hard') return gameDiff;
    return 'medium';
  }

  protected getDefaultTriquiFirstPlayer(exp?: GameExperience): FirstPlayer {
    const expFirst = exp?.config?.['firstPlayer'];
    if (expFirst === 'patient' || expFirst === 'alternate' || expFirst === 'random') return expFirst;
    const gameFirst = this.catalog.getGameById('triqui')?.config?.['firstPlayer'];
    if (gameFirst === 'patient' || gameFirst === 'alternate' || gameFirst === 'random') return gameFirst;
    return 'patient';
  }

  protected difficultyLabel(diff: Difficulty | null): string {
    switch (diff) {
      case 'easy':
        return 'Fácil';
      case 'medium':
        return 'Medio';
      case 'hard':
        return 'Difícil';
      default:
        return 'Medio';
    }
  }

  protected firstPlayerLabel(player: FirstPlayer | null): string {
    switch (player) {
      case 'patient':
        return 'Paciente';
      case 'alternate':
        return 'Alternado';
      case 'random':
        return 'Azar';
      default:
        return 'Paciente';
    }
  }

  // ─── Setters de Ajustes con Toast ──────────────────────────────────────────

  protected getEffectiveMemoryConfig(exp: GameExperience): MemoryConfig & { isCustomOverride: boolean } {
    const override = this.settings.getExperienceMemoryConfig(exp.id);
    const resolved = resolveMemoryConfig({
      kioskOverride: override,
      experienceConfig: exp.config,
      gameConfig: this.catalog.getGameById('memory')?.config,
    });
    return {
      ...resolved,
      isCustomOverride: override !== null,
    };
  }

  protected changeMemoryPairsStep(exp: GameExperience, delta: number, brandName: string): void {
    const current = this.getEffectiveMemoryConfig(exp);
    const nextPairs = Math.max(MEMORY_PAIRS_MIN, Math.min(MEMORY_PAIRS_MAX, current.pairs + delta));
    if (nextPairs === current.pairs) return;

    // Si la dificultad es un preset (easy, medium, hard), recalcular vidas automáticamente
    let nextLives = current.lives;
    if (current.difficulty !== 'custom') {
      nextLives = getRecommendedLives(nextPairs, current.difficulty);
    }

    this.settings.setExperienceMemoryConfig(exp.id, {
      pairs: nextPairs,
      lives: nextLives,
      difficulty: current.difficulty,
    });

    const cleanBrand = this.cleanText(brandName);
    this.showToast(`Memoria · ${cleanBrand}`, `${nextPairs} parejas (${nextLives} vidas)`);
  }

  protected changeMemoryLivesStep(exp: GameExperience, delta: number, brandName: string): void {
    const current = this.getEffectiveMemoryConfig(exp);
    const nextLives = Math.max(MEMORY_LIVES_MIN, current.lives + delta);
    if (nextLives === current.lives) return;

    // Al modificar manualmente las vidas, la dificultad pasa a ser 'custom'
    this.settings.setExperienceMemoryConfig(exp.id, {
      pairs: current.pairs,
      lives: nextLives,
      difficulty: 'custom',
    });

    const cleanBrand = this.cleanText(brandName);
    this.showToast(`Memoria · ${cleanBrand}`, `${nextLives} vidas (Personalizada)`);
  }

  protected selectMemoryDifficulty(exp: GameExperience, difficulty: MemoryDifficulty, brandName: string): void {
    const current = this.getEffectiveMemoryConfig(exp);
    const recommendedLives = getRecommendedLives(current.pairs, difficulty);

    this.settings.setExperienceMemoryConfig(exp.id, {
      pairs: current.pairs,
      lives: recommendedLives,
      difficulty,
    });

    const cleanBrand = this.cleanText(brandName);
    this.showToast(`Memoria · ${cleanBrand}`, `Dificultad ${this.memoryDifficultyLabel(difficulty)} (${recommendedLives} vidas)`);
  }

  protected resetExperienceMemoryToDefault(exp: GameExperience, brandName: string): void {
    this.settings.setExperienceMemoryConfig(exp.id, null);
    const cleanBrand = this.cleanText(brandName);
    this.showToast(`Memoria · ${cleanBrand}`, 'Restaurado a la configuración del catálogo');
  }

  protected memoryDifficultyLabel(diff: MemoryDifficulty): string {
    switch (diff) {
      case 'easy':
        return 'Fácil';
      case 'medium':
        return 'Medio';
      case 'hard':
        return 'Difícil';
      case 'custom':
        return 'Personalizada';
      default:
        return 'Medio';
    }
  }

  protected memoryConfigExplanation(config: MemoryConfig, isCustomOverride: boolean): string {
    const customTag = isCustomOverride ? ' [Ajuste de Kiosco]' : ' [Catálogo]';
    switch (config.difficulty) {
      case 'medium':
        return `Medio es la configuración recomendada para ${config.pairs} parejas (${config.lives} vidas).${customTag}`;
      case 'easy':
        return `Fácil: Mayor tolerancia a equivocaciones (${config.lives} vidas para ${config.pairs} parejas).${customTag}`;
      case 'hard':
        return `Difícil: Menor tolerancia a fallos (${config.lives} vidas para ${config.pairs} parejas).${customTag}`;
      case 'custom':
        return `Configuración personalizada: ${config.pairs} parejas con ${config.lives} vidas permitidas.${customTag}`;
    }
  }

  protected changeExperienceMemoryPairs(
    experienceId: string,
    pairs: number | null,
    brandName: string,
    defaultPairs: number,
  ): void {
    this.settings.setExperienceMemoryPairs(experienceId, pairs);
    const cleanBrand = this.cleanText(brandName);
    if (pairs === null) {
      this.showToast(`Memoria · ${cleanBrand}`, `Opción por defecto (${defaultPairs} parejas)`);
    } else {
      this.showToast(`Memoria · ${cleanBrand}`, `${pairs} parejas seleccionadas`);
    }
  }

  protected changeExperienceTriquiDifficulty(
    experienceId: string,
    diff: Difficulty | null,
    brandName: string,
    defaultDiff: Difficulty,
  ): void {
    this.settings.setExperienceTriquiDifficulty(experienceId, diff);
    const cleanBrand = this.cleanText(brandName);
    if (diff === null) {
      this.showToast(`Triqui · ${cleanBrand}`, `Opción por defecto (${this.difficultyLabel(defaultDiff)})`);
    } else {
      this.showToast(`Triqui · ${cleanBrand}`, `Dificultad: ${this.difficultyLabel(diff)}`);
    }
  }

  protected changeExperienceTriquiFirstPlayer(
    experienceId: string,
    player: FirstPlayer | null,
    brandName: string,
    defaultFirst: FirstPlayer,
  ): void {
    this.settings.setExperienceTriquiFirstPlayer(experienceId, player);
    const cleanBrand = this.cleanText(brandName);
    if (player === null) {
      this.showToast(`Triqui · ${cleanBrand}`, `Opción por defecto (${this.firstPlayerLabel(defaultFirst)})`);
    } else {
      this.showToast(`Triqui · ${cleanBrand}`, `Primer jugador: ${this.firstPlayerLabel(player)}`);
    }
  }

  protected memoryExplanation(pairs: number | null, defaultPairs: number): string {
    if (pairs === null) {
      return `Opción por defecto: Usa la configuración del catálogo (${defaultPairs} parejas / ${defaultPairs * 2} cartas).`;
    }
    switch (pairs) {
      case 2:
        return '2 parejas: Genera un tablero rápido de 4 cartas (2×2). Ideal para demostraciones rápidas.';
      case 3:
        return '3 parejas: Genera un tablero de 6 cartas (2×3). Nivel introductorio.';
      case 4:
        return '4 parejas: Genera un tablero de 8 cartas (2×4). Dificultad equilibrada estándar.';
      case 5:
        return '5 parejas: Genera un tablero de 10 cartas (2×5). Mayor exigencia de memoria visual.';
      case 6:
        return '6 parejas: Genera un tablero de 12 cartas (3×4). Reto avanzado para usuarios experimentados.';
      default:
        return 'Configuración personalizada.';
    }
  }

  protected triquiDifficultyExplanation(diff: Difficulty | null, defaultDiff: Difficulty): string {
    if (diff === null) {
      return `Opción por defecto: Usa la dificultad definida en el catálogo (${this.difficultyLabel(defaultDiff)}).`;
    }
    switch (diff) {
      case 'easy':
        return 'Fácil: La IA comete fallos intencionales y no bloquea oportunidades de victoria del paciente.';
      case 'medium':
        return 'Medio: La IA bloquea jugadas evidentes pero permite oportunidades de ganar.';
      case 'hard':
        return 'Difícil: La IA calcula movimientos óptimos con Minimax (difícil de vencer).';
    }
  }

  protected triquiFirstPlayerExplanation(player: FirstPlayer | null, defaultFirst: FirstPlayer): string {
    if (player === null) {
      return `Opción por defecto: Respeta la regla de primer jugador del catálogo (${this.firstPlayerLabel(defaultFirst)}).`;
    }
    switch (player) {
      case 'patient':
        return 'Paciente: El paciente siempre realiza la primera jugada al iniciar la dinámica.';
      case 'alternate':
        return 'Alternado: El primer turno rota entre el paciente y la IA en cada nueva partida.';
      case 'random':
        return 'Azar: Un sorteo aleatorio decide quién empieza cada partida.';
    }
  }

  protected changeScreensaver(mode: ScreensaverMode): void {
    this.settings.setScreensaverMode(mode);
    this.showToast('Protector', `Modo cambiado a: ${mode === 'classic' ? 'Clásico' : 'Video'}`);
  }

  protected screensaverExplanation(mode: ScreensaverMode): string {
    return mode === 'classic'
      ? 'Clásico: Animación de degradados y logotipos institucionales tras inactividad prolongada.'
      : 'Video: Reproducción continua de video promocional o institucional en el kiosco.';
  }

  protected toggleSound(): void {
    const next = !this.settings.soundEnabled();
    this.settings.setSoundEnabled(next);
    this.showToast('Audio General', next ? 'Sonido activado' : 'Audio silenciado');
  }

  protected onBgmVolumeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const vol = parseFloat(input.value) / 100;
    this.settings.setBgmVolume(vol);
  }

  protected onBgmVolumeCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.showToast('Volumen BGM', `${input.value}%`);
  }

  protected onSfxVolumeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const vol = parseFloat(input.value) / 100;
    this.settings.setSfxVolume(vol);
  }

  protected onSfxVolumeCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.showToast('Volumen SFX', `${input.value}%`);
    this.testSfx();
  }

  protected testSfx(): void {
    playUiSfx(this.mediaPlayer, 'select');
  }

  // ─── Diálogos de Confirmación ───────────────────────────────────────────────

  protected askConfirm(kind: Exclude<ConfirmKind, null>): void {
    this.opMessage.set('');
    this.confirmKind.set(kind);
  }

  protected confirmTitle(kind: Exclude<ConfirmKind, null>): string {
    switch (kind) {
      case 'restart':
        return '¿Reiniciar?';
      case 'exit':
        return '¿Cerrar la app?';
      case 'leaveKiosk':
        return '¿Salir del kiosco?';
      case 'applyUpdate':
        return '¿Instalar actualizaciones?';
      case 'changePin':
        return '¿Generar nuevo PIN?';
      case 'resetDefaults':
        return '¿Restaurar valores por defecto?';
    }
  }

  protected confirmMessage(kind: Exclude<ConfirmKind, null>): string {
    switch (kind) {
      case 'restart':
        return 'La aplicación se reiniciará en este equipo.';
      case 'exit':
        return 'Se cerrará Merz Games. Habrá que abrirla de nuevo.';
      case 'leaveKiosk':
        return 'Se quita pantalla completa y vuelven las decoraciones de ventana.';
      case 'applyUpdate':
        return this.snapshot().appUpdateAvailable
          ? 'Primero se aplica el catálogo y después el ejecutable, que puede reiniciar la app.'
          : 'Se aplicará el catálogo publicado. El anterior se conserva si el nuevo no es válido.';
      case 'changePin':
        return `Va a generar un nuevo PIN: "${this.pinModel().next}". ¿Desea confirmar el cambio?`;
      case 'resetDefaults':
        return 'Se restablecerán marcas, juegos, audio y parámetros a los valores definidos en el catálogo original (content-manifest.json).';
    }
  }

  protected async onConfirm(): Promise<void> {
    const kind = this.confirmKind();
    this.confirmKind.set(null);
    if (!kind) return;

    if (kind === 'resetDefaults') {
      this.catalog.resetToDefault();
      this.settings.resetToDefault();
      this.showToast('Valores restaurados', 'Ajustes y catálogo restablecidos a los definidos en content-manifest.json');
      return;
    }

    if (kind === 'changePin') {
      await this.executePinChange();
      return;
    }

    if (kind === 'applyUpdate') {
      await this.updates.apply();
      return;
    }

    const result =
      kind === 'restart'
        ? await this.platform.restart()
        : kind === 'exit'
          ? await this.platform.exit()
          : await this.platform.leaveKiosk();

    if (!result.ok) {
      this.opMessage.set(result.message ?? 'Solo en la app de escritorio.');
    } else if (kind === 'leaveKiosk') {
      this.opMessage.set('Modo kiosco desactivado.');
    }
  }

  // ─── Actualizaciones ────────────────────────────────────────────────────────

  protected updateStatusCopy(): string {
    return UPDATE_STATUS_COPY[this.snapshot().status];
  }

  protected updateCtaLabel(): string {
    const status = this.snapshot().status;
    if (this.updateBusy()) return UPDATE_STATUS_COPY[status];
    if (status === 'available') return 'Instalar';
    return 'Buscar actualizaciones';
  }

  protected onUpdateCta(): void {
    if (this.updateBusy()) return;
    if (this.snapshot().status === 'available') {
      this.askConfirm('applyUpdate');
      return;
    }
    void this.updates.check();
  }

  protected collectionLabel(item: CatalogDiffItem): string {
    return COLLECTION_LABEL[item.collection];
  }

  protected kindLabel(item: CatalogDiffItem): string {
    return CHANGE_KIND_LABEL[item.kind];
  }

  // ─── Seguridad y PIN Vertical ──────────────────────────────────────────────

  protected pinDots(value: string): string {
    return value.length === 0 ? '····' : '•'.repeat(value.length);
  }

  protected appendPinDigit(digit: string): void {
    this.pinMessage.set('');
    const field = this.pinField();
    const current = this.pinModel();
    const value = current[field];
    if (value.length >= 8) return;
    this.pinModel.set({ ...current, [field]: value + digit });
  }

  protected pinBackspace(): void {
    this.pinMessage.set('');
    const field = this.pinField();
    const current = this.pinModel();
    this.pinModel.set({ ...current, [field]: current[field].slice(0, -1) });
  }

  protected requestPinChange(): void {
    const { current, next, confirm } = this.pinModel();
    if (current.length < 4) {
      this.pinError.set(true);
      this.pinMessage.set('El PIN anterior debe tener al menos 4 dígitos.');
      return;
    }
    if (next.length < 4) {
      this.pinError.set(true);
      this.pinMessage.set('El nuevo PIN debe tener al menos 4 dígitos.');
      return;
    }
    if (next !== confirm) {
      this.pinError.set(true);
      this.pinMessage.set('El nuevo PIN y la confirmación no coinciden.');
      return;
    }

    this.pinError.set(false);
    this.pinMessage.set('');
    this.askConfirm('changePin');
  }

  private async executePinChange(): Promise<void> {
    const { current, next } = this.pinModel();
    const ok = await this.session.changePin(current, next);
    this.pinError.set(!ok);
    if (ok) {
      this.pinMessage.set('PIN actualizado en este equipo.');
      this.showToast('Seguridad', 'PIN actualizado con éxito');
      this.pinModel.set({ current: '', next: '', confirm: '' });
      this.pinField.set('current');
    } else {
      this.pinMessage.set('El PIN anterior no coincide.');
    }
  }

  protected leavePanel(): void {
    this.session.logout();
    void this.router.navigateByUrl('/welcome');
  }

  private refreshViewport(): void {
    if (typeof window === 'undefined') return;
    this.viewport.set({ width: window.innerWidth, height: window.innerHeight });
  }
}
