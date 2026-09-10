import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CatalogService, Brand, Game, GameExperience } from '../../core/catalog/catalog';
import { AttractionVideo } from '../../core/catalog/content-manifest.model';
import { CatalogDiffItem } from '../../core/catalog/compare-catalogs';
import { UpdateStatus } from '../../core/catalog/update.model';
import {
  KioskSettings,
  ScreensaverMode,
  ScreensaverVideoOrder,
} from '../../core/settings/kiosk-settings';
import { PlatformService, KioskCommandResult } from '../../core/platform/platform.service';
import { AssetSrc } from '../../core/platform/asset-src';
import { UpdateCoordinator } from '../../core/update/update-coordinator';
import { ContentPack } from '../../core/update/content-pack';
import { pendingHasVideos } from '../../core/update/content-remote-url';
import { Difficulty, FirstPlayer, PlayerSymbolChoice } from '../../core/games/triqui/triqui.model';
import {
  resolveTriquiDifficulty,
  resolveTriquiFirstPlayer,
  resolveTriquiPlayerSymbol,
} from '../../core/games/triqui/triqui-config';
import { MemoryConfig, MemoryDifficulty } from '../../core/games/memory/memory.model';
import {
  getRecommendedLives,
  MEMORY_PAIRS_MIN,
  MEMORY_PAIRS_MAX,
  MEMORY_LIVES_MIN,
  resolveMemoryConfig,
} from '../../core/games/memory/memory-config';
import { MediaPlayer } from '../../core/media/media-player';
import {
  formatVideoMetaLabel,
  probeVideoFileMeta,
  type VideoFileMeta,
} from '../../core/media/video-file-meta';
import { AdminSession } from './admin-session';
import { AdminConfirm } from './admin-confirm';
import { SuperadminAuthService } from './superadmin-auth.service';
import { KioskButton } from '../shared/kiosk-button';
import { HeroIcon, HeroIconName } from '../shared/hero-icon';
import { SuperadminPinDialog } from '../shared/superadmin-pin-dialog';
import { playUiSfx, UiSfx } from '../shared/ui-sfx';

export type AdminSection = 'operations' | 'settings' | 'diagnostics' | 'updates' | 'pin';

export type SettingsView = 'menu' | 'general' | 'brands-global' | 'games' | 'brands' | 'experience';

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

type ConfirmKind =
  | 'restart'
  | 'exit'
  | 'leaveKiosk'
  | 'enterKiosk'
  | 'applyUpdate'
  | 'changePin'
  | 'resetDefaults'
  | 'resetAudio'
  | 'resetScreensaver'
  | 'resetGeneral'
  | 'resetBrands'
  | 'resetExperience'
  | 'switchToGlobal'
  | 'resetGlobalGame'
  | null;

type CatalogGroupId = 'active' | 'beta' | 'inactive';

interface KioskBrandSection {
  id: CatalogGroupId;
  title: string;
  titleClass: string;
  dotClass: string;
  emptyLabel: string;
  reorderable: boolean;
  brands: Brand[];
}

interface ExperienceGroupSection {
  id: CatalogGroupId;
  title: string;
  titleClass: string;
  reorderable: boolean;
  items: GameExperience[];
}

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
  { label: 'Jugador', value: 'patient' },
  { label: 'Alternado', value: 'alternate' },
  { label: 'Azar', value: 'random' },
];

const TRIQUI_SYMBOL_OPTIONS: Array<{ label: string; value: PlayerSymbolChoice }> = [
  { label: '✕', value: 'X' },
  { label: '○', value: 'O' },
  { label: 'Aleatorio', value: 'random' },
];

const UPDATE_STATUS_COPY: Record<UpdateStatus, string> = {
  idle: 'Listo para buscar actualizaciones.',
  checking: 'Buscando actualizaciones…',
  available: 'Hay cambios disponibles. Revisa la lista y confirma.',
  downloading: 'Descargando archivos…',
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
  imports: [
    KioskButton,
    HeroIcon,
    AdminConfirm,
    SuperadminPinDialog,
    UiSfx,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview,
    AssetSrc,
  ],
  host: {
    class: 'flex flex-col w-full h-full min-h-0 overflow-hidden select-none',
    '[style.--panel-primary-color]': 'catalog.panelPrimaryColor()',
    '[style.--panel-secondary-color]': 'catalog.panelSecondaryColor()',
  },
  styleUrl: './admin-panel.css',
  template: `
    <!-- Toast de Ajustes Superior Derecho (Animado Entrada y Salida con Blur Blanco del Header) -->
    @if (toast(); as t) {
      <div
        class="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-3.5 px-4.5 py-3.5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl text-white pointer-events-none max-w-sm"
        [class.animate-toast-in]="!t.exiting"
        [class.animate-toast-out]="t.exiting"
        role="status"
        aria-live="polite"
      >
        <div
          class="size-8.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0"
        >
          <app-hero-icon name="check" class="text-base text-emerald-300" />
        </div>
        <div>
          <p
            class="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 drop-shadow-sm"
          >
            {{ t.title }}
          </p>
          <p class="text-xs sm:text-sm text-white font-bold drop-shadow-sm">{{ t.message }}</p>
        </div>
      </div>
    }

    <!-- Header Fijo / Translúcido con Blur y Estilo Blanco (Versión destacada interactiva) -->
    <header
      class="shrink-0 w-full z-20 bg-white/10 backdrop-blur-xl border-b border-white/20 px-4 sm:px-6 py-3.5 sm:py-4"
    >
      <div class="max-w-xl kiosk:max-w-2xl mx-auto w-full flex items-center justify-between gap-3">
        <!-- Botón Volver en Header (icono + texto + SFX click-back) en color blanco -->
        <button
          type="button"
          uiSfx="back"
          class="h-11 sm:h-12 px-4 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/20 flex items-center gap-2 text-sm sm:text-base font-bold text-white active:scale-95 transition-all cursor-pointer select-none"
          style="touch-action: manipulation;"
          (click)="onBack()"
          [attr.aria-label]="
            isAtRootMenu() ? 'Salir del panel de administración' : 'Volver al nivel anterior'
          "
        >
          <app-hero-icon name="arrow-left" class="text-white" />
          <span class="text-white">{{ isAtRootMenu() ? 'Salir' : 'Volver' }}</span>
        </button>

        <!-- Título central de cabecera: solo texto (sin icono, sin bordes, sin background) -->
        <div class="flex items-center justify-center text-center truncate px-2">
          <h1
            class="text-base sm:text-lg kiosk:text-xl font-extrabold uppercase font-['Montserrat'] tracking-wide text-white truncate"
          >
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
            [attr.aria-label]="
              'Versión ' + platform.appVersion() + '. Tocar para ir directamente a diagnóstico'
            "
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
      <div
        class="max-w-xl kiosk:max-w-2xl mx-auto w-full flex flex-col gap-6 text-white select-none pb-12"
      >
        <!-- ═══ VISTA 0: MENÚ DE OPCIONES PRINCIPAL ═══ -->
        @if (activeSection() === null) {
          <div class="space-y-2 text-center pt-2">
            <h2
              class="text-2xl sm:text-3xl kiosk:text-4xl font-extrabold font-['Montserrat'] uppercase tracking-tight text-white"
            >
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
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/6 hover:bg-white/12 active:bg-white/18 border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg shadow-black/20"
                style="touch-action: manipulation;"
                (click)="openSection(opt.id)"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0 transition-colors"
                  >
                    <app-hero-icon [name]="opt.icon" class="text-xl sm:text-2xl text-yellow-400" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <h3
                        class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate"
                      >
                        {{ opt.title }}
                      </h3>
                      @if (opt.id === 'updates' && snapshot().appUpdateAvailable) {
                        <span
                          class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-400/20 text-yellow-300 border border-yellow-400/30"
                        >
                          Update
                        </span>
                      }
                    </div>
                    <p
                      class="text-xs sm:text-sm kiosk:text-base text-neutral-400 font-normal truncate"
                    >
                      {{ opt.subtitle }}
                    </p>
                  </div>
                </div>

                <div
                  class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0 transition-all group-hover:translate-x-0.5"
                >
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
              <h2
                class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400"
              >
                Operación del Kiosco
              </h2>
              <p class="text-neutral-400 text-sm sm:text-base">
                {{
                  isNative()
                    ? 'Control de la aplicación táctil de escritorio.'
                    : 'Control de ejecución del sistema y modo pantalla completa.'
                }}
              </p>
            </div>

            <div class="space-y-3.5 pt-2">
              <app-kiosk-button variant="primary" (click)="askConfirm('restart')">
                <app-hero-icon name="arrow-path" class="text-yellow-400" />
                Reiniciar aplicación
              </app-kiosk-button>

              @if (isNative()) {
                <app-kiosk-button variant="secondary" (click)="askConfirm('exit')">
                  <app-hero-icon name="power" class="text-rose-400" />
                  Cerrar aplicación
                </app-kiosk-button>
              }

              <app-kiosk-button
                variant="secondary"
                (click)="askConfirm(isKiosk() ? 'leaveKiosk' : 'enterKiosk')"
              >
                <app-hero-icon
                  [name]="isKiosk() ? 'arrows-pointing-in' : 'arrows-pointing-out'"
                  class="text-neutral-300"
                />
                {{
                  isKiosk()
                    ? isNative()
                      ? 'Salir del modo kiosco'
                      : 'Salir de pantalla completa'
                    : isNative()
                      ? 'Entrar al modo kiosco'
                      : 'Pantalla completa'
                }}
              </app-kiosk-button>

              @if (opMessage()) {
                <p class="text-yellow-300 text-sm kiosk:text-base text-center font-medium">
                  {{ opMessage() }}
                </p>
              }
            </div>
          </div>
        }

        <!-- ═══ SUB-PÁGINA 2: AJUSTES DE JUEGO (JERÁRQUICO) ═══ -->
        @if (activeSection() === 'settings') {
          <!-- Nivel 2.0: Submenú de Ajustes de Juego (Generales, Memoria, Triqui) -->
          @if (settingsView() === 'menu') {
            <div class="space-y-2 text-center pt-2">
              <h2
                class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400"
              >
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
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/6 hover:bg-white/12 active:bg-white/18 border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                style="touch-action: manipulation;"
                (click)="openSettingsGeneral()"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0"
                  >
                    <app-hero-icon
                      name="adjustments-horizontal"
                      class="text-xl sm:text-2xl text-yellow-400"
                    />
                  </div>
                  <div class="min-w-0">
                    <h3
                      class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate"
                    >
                      Ajustes Generales
                    </h3>
                    <p class="text-xs sm:text-sm text-neutral-400 truncate">
                      Audio (BGM y SFX) y protector de pantalla
                    </p>
                  </div>
                </div>
                <div
                  class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0"
                >
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>

              <!-- Botón Marcas y Experiencias -->
              <button
                type="button"
                uiSfx="select"
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/6 hover:bg-white/12 active:bg-white/18 border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                style="touch-action: manipulation;"
                (click)="openSettingsBrandsGlobal()"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0"
                  >
                    <app-hero-icon name="swatch" class="text-xl sm:text-2xl text-yellow-400" />
                  </div>
                  <div class="min-w-0">
                    <h3
                      class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate"
                    >
                      Marcas y Experiencias
                    </h3>
                    <p class="text-xs sm:text-sm text-neutral-400 truncate">
                      Activar, ordenar y gestionar marcas y juegos del kiosco
                    </p>
                  </div>
                </div>
                <div
                  class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0"
                >
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>

              <!-- Botón Juegos -->
              <button
                type="button"
                uiSfx="select"
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/6 hover:bg-white/12 active:bg-white/18 border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                style="touch-action: manipulation;"
                (click)="openSettingsGames()"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0"
                  >
                    <app-hero-icon
                      name="rocket-launch"
                      class="text-xl sm:text-2xl text-yellow-400"
                    />
                  </div>
                  <div class="min-w-0">
                    <h3
                      class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate"
                    >
                      Juegos
                    </h3>
                    <p class="text-xs sm:text-sm text-neutral-400 truncate">
                      Reglas y configuración de partida por motor
                    </p>
                  </div>
                </div>
                <div
                  class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0"
                >
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>

              <!-- Opción Restaurar por Defecto -->
              <div class="pt-2">
                <button
                  type="button"
                  uiSfx="select"
                  class="min-h-16 sm:min-h-18 kiosk:min-h-20 w-full rounded-2xl bg-rose-500/8 hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/50 backdrop-blur-md px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                  style="touch-action: manipulation;"
                  (click)="askConfirm('resetDefaults')"
                >
                  <div class="flex items-center gap-4 min-w-0">
                    <div
                      class="size-11 sm:size-12 rounded-xl bg-rose-400/15 border border-rose-400/30 flex items-center justify-center text-rose-400 group-hover:bg-rose-400/25 shrink-0 transition-colors"
                    >
                      <app-hero-icon name="arrow-path" class="text-xl sm:text-2xl text-rose-400" />
                    </div>
                    <div class="min-w-0">
                      <h3
                        class="text-sm sm:text-base kiosk:text-lg font-extrabold font-['Montserrat'] uppercase tracking-wide text-rose-200 group-hover:text-rose-100 transition-colors truncate"
                      >
                        Restablecer todos los ajustes del juego
                      </h3>
                      <p class="text-xs sm:text-sm text-neutral-300/80 truncate">
                        Restablecer marcas, juegos y audio según el catálogo original
                      </p>
                    </div>
                  </div>
                  <div
                    class="size-8 rounded-full bg-rose-400/10 group-hover:bg-rose-400/25 flex items-center justify-center text-rose-300 shrink-0 transition-colors"
                  >
                    <app-hero-icon name="chevron-right" />
                  </div>
                </button>
              </div>
            </div>
          }

          <!-- Nivel 2.0b: Submenú de Juegos (Memoria, Triqui) -->
          @if (settingsView() === 'games') {
            <div class="space-y-2 text-center pt-2">
              <h2
                class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400"
              >
                Juegos
              </h2>
              <p class="text-neutral-300 text-sm sm:text-base">
                Reglas y configuración de partida por motor
              </p>
            </div>

            <div class="flex flex-col gap-3.5 pt-2">
              <!-- Botón Memoria -->
              <button
                type="button"
                uiSfx="select"
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/6 hover:bg-white/12 active:bg-white/18 border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                style="touch-action: manipulation;"
                (click)="openSettingsGame('memory')"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0"
                  >
                    <app-hero-icon
                      name="square-2-stack"
                      class="text-xl sm:text-2xl text-yellow-400"
                    />
                  </div>
                  <div class="min-w-0">
                    <h3
                      class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate"
                    >
                      Encuentra la Pareja (Memoria)
                    </h3>
                    <p class="text-xs sm:text-sm text-neutral-400 truncate">
                      Parejas, dificultad y vidas
                    </p>
                  </div>
                </div>
                <div
                  class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0"
                >
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>

              <!-- Botón Triqui -->
              <button
                type="button"
                uiSfx="select"
                class="min-h-18 sm:min-h-20 kiosk:min-h-24 w-full rounded-2xl bg-white/6 hover:bg-white/12 active:bg-white/18 border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer shadow-lg"
                style="touch-action: manipulation;"
                (click)="openSettingsGame('triqui')"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    class="size-12 sm:size-14 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400/20 shrink-0"
                  >
                    <app-hero-icon name="squares-2x2" class="text-xl sm:text-2xl text-yellow-400" />
                  </div>
                  <div class="min-w-0">
                    <h3
                      class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-wide text-white group-hover:text-yellow-400 transition-colors truncate"
                    >
                      Triqui (Tres en Raya)
                    </h3>
                    <p class="text-xs sm:text-sm text-neutral-400 truncate">
                      Dificultad, primer jugador y figura
                    </p>
                  </div>
                </div>
                <div
                  class="size-8 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400 shrink-0"
                >
                  <app-hero-icon name="chevron-right" />
                </div>
              </button>
            </div>
          }

          <!-- Nivel 2.1: Ajustes Generales (Audio y Protector) -->
          @if (settingsView() === 'general') {
            <div class="space-y-6">
              <div class="space-y-1">
                <h2
                  class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400"
                >
                  Ajustes Generales
                </h2>
                <p class="text-neutral-400 text-sm sm:text-base">
                  Audio (BGM y SFX) y protector de pantalla
                </p>
              </div>

              <!-- Audio General (Media Player con efecto Glass y Sliders Blancos) -->
              <div
                class="space-y-5 p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl"
              >
                <div class="flex items-center justify-between pb-2 border-b border-white/10">
                  <div class="flex items-center gap-2.5">
                    <app-hero-icon
                      [name]="settings.soundEnabled() ? 'speaker-wave' : 'speaker-x-mark'"
                      class="text-xl text-yellow-400"
                    />
                    <span
                      class="font-extrabold uppercase tracking-wider text-sm kiosk:text-base text-white"
                      >Audio General</span
                    >
                  </div>

                  <button
                    type="button"
                    uiSfx="click"
                    class="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer"
                    [class]="
                      settings.soundEnabled()
                        ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-300'
                        : 'bg-white/10 border-white/20 text-neutral-400'
                    "
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
                    <span
                      class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-yellow-400"
                    >
                      {{ Math.round(settings.bgmVolume() * 100) }}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    [value]="settings.bgmVolume() * 100"
                    class="w-full h-2.5 rounded-lg bg-white/8 border border-white/15 backdrop-blur-md accent-white cursor-pointer"
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
                      <span
                        class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-yellow-400"
                      >
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
                    class="w-full h-2.5 rounded-lg bg-white/8 border border-white/15 backdrop-blur-md accent-white cursor-pointer"
                    (input)="onSfxVolumeInput($event)"
                    (change)="onSfxVolumeCommit($event)"
                    (pointerup)="testSfx()"
                  />
                </div>

                <!-- Slider Volumen Videos de atracción -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-neutral-200 flex items-center gap-2">
                      <app-hero-icon name="video-camera" class="text-sm text-yellow-400" />
                      <span>Videos de atracción (clips)</span>
                    </span>
                    <span
                      class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-yellow-400"
                    >
                      {{ Math.round(settings.videoVolume() * 100) }}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    [value]="settings.videoVolume() * 100"
                    class="w-full h-2.5 rounded-lg bg-white/8 border border-white/15 backdrop-blur-md accent-white cursor-pointer"
                    (input)="onVideoVolumeInput($event)"
                    (change)="onVideoVolumeCommit($event)"
                  />
                </div>

                <div
                  class="p-3 rounded-xl bg-white/4 border border-white/10 text-xs text-neutral-300 flex items-start gap-2"
                >
                  <app-hero-icon
                    name="information-circle"
                    class="text-yellow-400 shrink-0 mt-0.5"
                  />
                  <span
                    >BGM controla la música ambiental continua. SFX controla toques táctiles y
                    aciertos. Videos controla el volumen independiente de clips (en silencio si el
                    audio general está desactivado).</span
                  >
                </div>

                <!-- Botón restablecer valores por defecto de Audio -->
                <button
                  type="button"
                  uiSfx="select"
                  class="w-full py-3.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/50 backdrop-blur-md text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-md"
                  style="touch-action: manipulation;"
                  (click)="askConfirm('resetAudio')"
                >
                  <app-hero-icon name="arrow-path" class="text-base text-rose-400" />
                  <span>Restablecer valores</span>
                </button>
              </div>

              <!-- Rendimiento visual (Cover Flow + atmósfera) -->
              <div
                class="space-y-5 p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl"
              >
                <div class="flex items-center gap-2.5 pb-2 border-b border-white/10">
                  <app-hero-icon name="cpu-chip" class="text-xl text-yellow-400" />
                  <span
                    class="font-extrabold uppercase tracking-wider text-sm kiosk:text-base text-white"
                    >Rendimiento visual</span
                  >
                </div>

                <div class="flex items-center justify-between gap-4">
                  <div class="min-w-0">
                    <p class="font-bold text-sm text-white">Movimiento reducido (Cover Flow)</p>
                    <p class="text-xs text-neutral-400 mt-0.5">
                      Desactiva rotación 3D y spring. Útil en pantallas con poca GPU.
                    </p>
                  </div>
                  <button
                    type="button"
                    uiSfx="click"
                    class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer"
                    [class]="
                      settings.coverReduceMotion()
                        ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-300'
                        : 'bg-white/10 border-white/20 text-neutral-400'
                    "
                    (click)="toggleCoverReduceMotion()"
                  >
                    {{ settings.coverReduceMotion() ? 'ON' : 'OFF' }}
                  </button>
                </div>

                <div class="flex items-center justify-between gap-4">
                  <div class="min-w-0">
                    <p class="font-bold text-sm text-white">Atmósfera animada</p>
                    <p class="text-xs text-neutral-400 mt-0.5">
                      Manchas de color en movimiento. Apagar deja el tinte estático.
                    </p>
                  </div>
                  <button
                    type="button"
                    uiSfx="click"
                    class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer"
                    [class]="
                      settings.atmosphereMotionEnabled()
                        ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-300'
                        : 'bg-white/10 border-white/20 text-neutral-400'
                    "
                    (click)="toggleAtmosphereMotion()"
                  >
                    {{ settings.atmosphereMotionEnabled() ? 'ON' : 'OFF' }}
                  </button>
                </div>
              </div>

              <!-- Protector de Pantalla -->
              <div
                class="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md"
              >
                <div class="flex items-center gap-2 pb-1 border-b border-white/10">
                  <app-hero-icon name="tv" class="text-base text-yellow-400" />
                  <p class="font-bold uppercase tracking-wider text-sm kiosk:text-base text-white">
                    Protector de pantalla
                  </p>
                </div>

                <!-- Modo Clásico / Video -->
                <div class="space-y-2">
                  <p class="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Modo de visualización
                  </p>
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
                  <div
                    class="p-3 rounded-xl bg-white/4 border border-white/10 text-xs text-neutral-300 flex items-start gap-2"
                  >
                    <app-hero-icon
                      name="information-circle"
                      class="text-yellow-400 shrink-0 mt-0.5"
                    />
                    <span>{{ screensaverExplanation(settings.screensaverMode()) }}</span>
                  </div>
                </div>

                <!-- Tiempo de aparición (Inactividad) -->
                <div class="space-y-2.5 pt-2 border-t border-white/10">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold uppercase tracking-wider text-neutral-400"
                      >Tiempo de inactividad</span
                    >
                    <span
                      class="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400"
                    >
                      {{ formatIdleTime(settings.screensaverIdleMs()) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-3">
                    <button
                      type="button"
                      uiSfx="select"
                      class="flex-1 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5"
                      style="touch-action: manipulation;"
                      [disabled]="settings.screensaverIdleMs() <= 30000"
                      (click)="adjustIdleTime(-30000)"
                    >
                      <span>- 30 s</span>
                    </button>
                    <button
                      type="button"
                      uiSfx="select"
                      class="flex-1 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5"
                      style="touch-action: manipulation;"
                      [disabled]="settings.screensaverIdleMs() >= 900000"
                      (click)="adjustIdleTime(30000)"
                    >
                      <span>+ 30 s</span>
                    </button>
                  </div>
                  <p class="text-[11px] text-neutral-400">
                    Aparece tras {{ formatIdleTime(settings.screensaverIdleMs()) }} sin toques en
                    pantallas de paciente. En el panel administrativo permanece pausado.
                  </p>
                </div>

                <!-- Orden de videos (solo si modo === 'video') -->
                @if (settings.screensaverMode() === 'video') {
                  <div class="space-y-2 pt-2 border-t border-white/10">
                    <p class="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Orden de videos de atracción
                    </p>
                    <div class="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        uiSfx="select"
                        [class]="chipClass(settings.screensaverVideoOrder() === 'sequential')"
                        style="touch-action: manipulation;"
                        (click)="changeVideoOrder('sequential')"
                      >
                        Ordenado
                      </button>
                      <button
                        type="button"
                        uiSfx="select"
                        [class]="chipClass(settings.screensaverVideoOrder() === 'random')"
                        style="touch-action: manipulation;"
                        (click)="changeVideoOrder('random')"
                      >
                        Al azar
                      </button>
                    </div>
                    <p class="text-[11px] text-neutral-400">
                      {{ videoOrderExplanation(settings.screensaverVideoOrder()) }}
                    </p>
                  </div>

                  <!-- Lista de Videos de Atracción (Generales y por Marca) -->
                  <div class="space-y-3 pt-3 border-t border-white/10">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <app-hero-icon name="video-camera" class="text-base text-yellow-400" />
                        <p class="text-xs font-bold uppercase tracking-wider text-neutral-300">
                          Videos de atracción
                        </p>
                      </div>
                      <span
                        class="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400"
                      >
                        {{ activeVideosCount() }} de {{ totalVideosCount() }} activos
                      </span>
                    </div>

                    <p class="text-[11px] text-neutral-400">
                      Activa o desactiva los clips para el protector de pantalla. Solo los videos
                      activos serán incluidos en la rotación.
                    </p>

                    <!-- Grupo: Videos Generales -->
                    <div class="space-y-2 rounded-xl bg-black/30 p-3.5 border border-white/10">
                      <div
                        class="flex items-center justify-between pb-1.5 border-b border-white/10"
                      >
                        <span
                          class="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5"
                        >
                          <app-hero-icon name="building-office-2" class="text-xs text-yellow-400" />
                          <span>Videos Generales</span>
                        </span>
                        <span
                          class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300"
                        >
                          Institucionales
                        </span>
                      </div>

                      @if (generalVideos().length === 0) {
                        <p class="text-xs text-neutral-500 italic py-1">
                          No hay videos generales configurados.
                        </p>
                      }

                      @for (video of generalVideos(); track video.source) {
                        <div
                          class="flex items-center justify-between gap-3 py-2 px-2.5 rounded-lg bg-white/4 hover:bg-white/[0.07] border border-white/5 transition-colors group/row"
                        >
                          <button
                            type="button"
                            uiSfx="click"
                            (click)="openVideoPreview(video)"
                            class="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded-lg p-1 -m-1 transition-all active:scale-[0.99]"
                            title="Reproducir vista previa del video"
                            [attr.aria-label]="
                              'Reproducir vista previa de ' +
                              (video.nombre || video.name || 'Video General')
                            "
                          >
                            <div
                              class="size-8 rounded-lg bg-yellow-400/15 group-hover/row:bg-yellow-400/25 flex items-center justify-center shrink-0 border border-yellow-400/30 transition-colors"
                            >
                              <app-hero-icon
                                name="play-circle"
                                class="text-base text-yellow-400 group-hover/row:scale-110 transition-transform"
                              />
                            </div>
                            <div class="min-w-0 flex-1">
                              <p
                                class="text-xs font-bold text-white group-hover/row:text-yellow-300 transition-colors truncate"
                              >
                                {{ video.nombre || video.name || 'Video General' }}
                              </p>
                              <p class="text-[10px] text-neutral-400 truncate">
                                {{ videoMetaLabel(video.source) }}
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            uiSfx="select"
                            class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none"
                            [class]="
                              video.enabled
                                ? 'bg-emerald-500 border-emerald-400'
                                : 'bg-white/15 border-white/30'
                            "
                            (click)="toggleGeneralVideo(video)"
                            [attr.aria-label]="
                              (video.enabled ? 'Desactivar video ' : 'Activar video ') +
                              (video.nombre || video.name)
                            "
                          >
                            <span
                              class="pointer-events-none inline-flex items-center justify-center size-6 rounded-full bg-white shadow-md transform transition duration-200 ease-in-out mt-0.5"
                              [class]="video.enabled ? 'translate-x-6' : 'translate-x-0.5'"
                            >
                              <app-hero-icon
                                [name]="video.enabled ? 'check' : 'x-mark'"
                                class="text-xs"
                                [class]="video.enabled ? 'text-emerald-600' : 'text-neutral-400'"
                              />
                            </span>
                          </button>
                        </div>
                      }
                    </div>

                    <!-- Grupos: Por Marca -->
                    @for (brand of catalog.rawManifest().brands; track brand.id) {
                      @if (getBrandVideos(brand).length > 0) {
                        <div class="space-y-2 rounded-xl bg-black/30 p-3.5 border border-white/10">
                          <div
                            class="flex items-center justify-between pb-1.5 border-b border-white/10"
                          >
                            <span
                              class="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5"
                            >
                              <app-hero-icon name="tag" class="text-xs text-yellow-400" />
                              <span>{{ cleanText(brand.name) }}</span>
                            </span>
                            @if (!brand.enabled) {
                              <span
                                class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300"
                              >
                                Marca desactivada en kiosco
                              </span>
                            } @else {
                              <span
                                class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300"
                              >
                                Marca
                              </span>
                            }
                          </div>

                          @for (video of getBrandVideos(brand); track video.source) {
                            <div
                              class="flex items-center justify-between gap-3 py-2 px-2.5 rounded-lg bg-white/4 hover:bg-white/[0.07] border border-white/5 transition-colors group/row"
                            >
                              <button
                                type="button"
                                uiSfx="click"
                                (click)="openVideoPreview(video, brand)"
                                class="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded-lg p-1 -m-1 transition-all active:scale-[0.99]"
                                title="Reproducir vista previa del video"
                                [attr.aria-label]="
                                  'Reproducir vista previa de ' +
                                  (video.nombre || video.name || brand.name)
                                "
                              >
                                <div
                                  class="size-8 rounded-lg bg-yellow-400/15 group-hover/row:bg-yellow-400/25 flex items-center justify-center shrink-0 border border-yellow-400/30 transition-colors"
                                >
                                  <app-hero-icon
                                    name="play-circle"
                                    class="text-base text-yellow-400 group-hover/row:scale-110 transition-transform"
                                  />
                                </div>
                                <div class="min-w-0 flex-1">
                                  <p
                                    class="text-xs font-bold text-white group-hover/row:text-yellow-300 transition-colors truncate"
                                  >
                                    {{ video.nombre || video.name || brand.name }}
                                  </p>
                                  <p class="text-[10px] text-neutral-400 truncate">
                                    {{ videoMetaLabel(video.source) }}
                                  </p>
                                </div>
                              </button>

                              <button
                                type="button"
                                uiSfx="select"
                                class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none"
                                [class]="
                                  video.enabled
                                    ? 'bg-emerald-500 border-emerald-400'
                                    : 'bg-white/15 border-white/30'
                                "
                                (click)="toggleBrandVideo(brand.id, video)"
                                [attr.aria-label]="
                                  (video.enabled ? 'Desactivar video ' : 'Activar video ') +
                                  (video.nombre || video.name)
                                "
                              >
                                <span
                                  class="pointer-events-none inline-flex items-center justify-center size-6 rounded-full bg-white shadow-md transform transition duration-200 ease-in-out mt-0.5"
                                  [class]="video.enabled ? 'translate-x-6' : 'translate-x-0.5'"
                                >
                                  <app-hero-icon
                                    [name]="video.enabled ? 'check' : 'x-mark'"
                                    class="text-xs"
                                    [class]="
                                      video.enabled ? 'text-emerald-600' : 'text-neutral-400'
                                    "
                                  />
                                </span>
                              </button>
                            </div>
                          }
                        </div>
                      }
                    }

                    @if (activeVideosCount() === 0) {
                      <div
                        class="p-3 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-300 text-xs flex items-start gap-2"
                      >
                        <app-hero-icon
                          name="information-circle"
                          class="text-amber-400 shrink-0 mt-0.5 text-sm"
                        />
                        <span
                          >No hay videos de atracción habilitados. El protector se mantendrá
                          indefinidamente en animación clásica.</span
                        >
                      </div>
                    }
                  </div>
                }
                <!-- Botón restablecer valores por defecto del Protector -->
                <button
                  type="button"
                  uiSfx="select"
                  class="w-full py-3.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/50 backdrop-blur-md text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-md"
                  style="touch-action: manipulation;"
                  (click)="askConfirm('resetScreensaver')"
                >
                  <app-hero-icon name="arrow-path" class="text-base text-rose-400" />
                  <span>Restablecer valores</span>
                </button>
              </div>

              <!-- Zona Restaurar Ajustes Generales por Defecto -->
              <button
                type="button"
                uiSfx="select"
                class="w-full py-3.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/50 backdrop-blur-md text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-md"
                style="touch-action: manipulation;"
                (click)="askConfirm('resetGeneral')"
              >
                <app-hero-icon name="arrow-path" class="text-base text-rose-400" />
                <span>Restablecer ajustes generales</span>
              </button>
            </div>
          }

          <!-- Nivel 2.1b: Gestion Global de Marcas del Kiosco (arbol marca -> experiencias) -->
          @if (settingsView() === 'brands-global') {
            <div class="space-y-6">
              <div class="space-y-1">
                <h2
                  class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5"
                >
                  <app-hero-icon name="swatch" class="text-2xl text-yellow-400" />
                  <span>Marcas y Experiencias</span>
                </h2>
                <p class="text-neutral-400 text-sm sm:text-base">
                  Activar, ordenar y gestionar marcas y juegos del kiosco
                </p>
              </div>

              @for (section of kioskBrandSections(); track section.id) {
                <section class="space-y-3">
                  <div class="flex items-center justify-between gap-3">
                    <h3
                      class="text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center gap-2"
                      [class]="section.titleClass"
                    >
                      <span class="size-2 rounded-full" [class]="section.dotClass"></span>
                      {{ section.title }}
                      <span class="text-neutral-500 font-bold normal-case tracking-normal"
                        >({{ section.brands.length }})</span
                      >
                    </h3>
                    @if (section.reorderable && section.brands.length > 1) {
                      <span
                        class="text-[10px] sm:text-xs text-neutral-500 uppercase tracking-wider font-bold"
                        >Arrastra para ordenar</span
                      >
                    }
                  </div>

                  @if (section.brands.length === 0) {
                    <p class="text-sm text-neutral-500 px-1">{{ section.emptyLabel }}</p>
                  } @else if (section.reorderable) {
                    <div
                      class="brand-drag-list"
                      cdkDropList
                      [cdkDropListData]="section.brands"
                      (cdkDropListDropped)="
                        onKioskBrandDrop($event, section.id === 'beta' ? 'beta' : 'active')
                      "
                    >
                      @for (brand of section.brands; track brand.id) {
                        <div
                          class="brand-drag-row w-full rounded-2xl bg-white/5 border backdrop-blur-md shadow-xl overflow-hidden"
                          [class]="
                            section.id === 'beta' ? 'border-amber-400/20' : 'border-white/10'
                          "
                          cdkDrag
                          [cdkDragDisabled]="section.brands.length < 2"
                          [cdkDragData]="brand"
                        >
                          <div class="brand-drag-placeholder" *cdkDragPlaceholder></div>
                          <div class="brand-drag-preview" *cdkDragPreview>
                            <div class="min-h-14 px-5 py-3 flex items-center gap-3 text-white">
                              <app-hero-icon name="arrows-up-down" class="text-yellow-400" />
                              <span class="font-bold">{{ cleanText(brand.name) }}</span>
                            </div>
                          </div>

                          <div class="px-4 sm:px-5 py-4 flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0 flex-1">
                              @if (section.brands.length > 1) {
                                <button
                                  type="button"
                                  cdkDragHandle
                                  class="size-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-yellow-300 cursor-grab active:cursor-grabbing shrink-0"
                                  aria-label="Arrastrar marca para reordenar"
                                  style="touch-action: none;"
                                >
                                  <app-hero-icon name="arrows-up-down" class="text-lg" />
                                </button>
                              }
                              <div
                                class="size-11 sm:size-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-yellow-400 shrink-0"
                              >
                                <app-hero-icon name="tag" class="text-lg text-yellow-400" />
                              </div>
                              <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                  <h4 class="text-sm sm:text-base font-bold text-white truncate">
                                    {{ cleanText(brand.name) }}
                                  </h4>
                                  @if (brand.develop) {
                                    <span
                                      class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-400/40 text-amber-300"
                                      >Beta</span
                                    >
                                  }
                                  <span
                                    class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                                    >Activa</span
                                  >
                                </div>
                                <p class="text-xs text-neutral-400 truncate mt-0.5">
                                  {{
                                    brand.develop
                                      ? 'Visible en el kiosco con modo desarrollo activo'
                                      : 'Visible en el selector de marcas del kiosco'
                                  }}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              uiSfx="select"
                              class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 bg-emerald-500 border-emerald-400"
                              (click)="toggleBrand(brand)"
                              [attr.aria-label]="'Desactivar marca ' + cleanText(brand.name)"
                            >
                              <span
                                class="pointer-events-none inline-flex items-center justify-center size-6 rounded-full bg-white shadow-md translate-x-6 mt-0.5"
                              >
                                <app-hero-icon name="check" class="text-xs text-emerald-600" />
                              </span>
                            </button>
                          </div>

                          <div
                            class="px-4 sm:px-5 pb-4 space-y-3 border-t border-white/8 pt-3 ml-2 sm:ml-4"
                          >
                            <p
                              class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500"
                            >
                              Experiencias / juegos
                            </p>
                            @for (
                              expSection of experienceSectionsForBrand(brand.id);
                              track expSection.id
                            ) {
                              <div class="space-y-2">
                                <div class="flex items-center justify-between gap-2">
                                  <span
                                    class="text-[10px] font-extrabold uppercase tracking-wider"
                                    [class]="expSection.titleClass"
                                  >
                                    {{ expSection.title }} ({{ expSection.items.length }})
                                  </span>
                                  @if (expSection.reorderable && expSection.items.length > 1) {
                                    <span
                                      class="text-[9px] text-neutral-500 uppercase tracking-wider font-bold"
                                      >Arrastra</span
                                    >
                                  }
                                </div>
                                @if (expSection.items.length === 0) {
                                  <p class="text-xs text-neutral-600 px-1">Ninguna</p>
                                } @else if (expSection.reorderable) {
                                  <div
                                    class="brand-drag-list"
                                    style="gap: 0.5rem;"
                                    cdkDropList
                                    [cdkDropListData]="expSection.items"
                                    (cdkDropListDropped)="
                                      onKioskExperienceDrop($event, brand.id, expSection.id)
                                    "
                                  >
                                    @for (exp of expSection.items; track exp.id) {
                                      <div
                                        class="rounded-xl bg-black/20 border border-white/10 px-3 py-2.5 flex items-center justify-between gap-2"
                                        cdkDrag
                                        [cdkDragDisabled]="expSection.items.length < 2"
                                        [cdkDragData]="exp"
                                      >
                                        <div
                                          class="brand-drag-placeholder min-h-12!"
                                          *cdkDragPlaceholder
                                        ></div>
                                        <div class="brand-drag-preview" *cdkDragPreview>
                                          <div class="px-3 py-2 text-white text-sm font-bold">
                                            {{ experienceLabel(exp) }}
                                          </div>
                                        </div>
                                        <div class="flex items-center gap-2 min-w-0 flex-1">
                                          @if (expSection.items.length > 1) {
                                            <button
                                              type="button"
                                              cdkDragHandle
                                              class="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 cursor-grab active:cursor-grabbing shrink-0"
                                              aria-label="Arrastrar experiencia"
                                              style="touch-action: none;"
                                            >
                                              <app-hero-icon
                                                name="arrows-up-down"
                                                class="text-sm"
                                              />
                                            </button>
                                          }
                                          <app-hero-icon
                                            [name]="
                                              exp.gameId === 'memory'
                                                ? 'square-2-stack'
                                                : 'squares-2x2'
                                            "
                                            class="text-yellow-400 shrink-0"
                                          />
                                          <div class="min-w-0">
                                            <div class="flex items-center gap-1.5 flex-wrap">
                                              <span
                                                class="text-xs sm:text-sm font-bold text-white truncate"
                                                >{{ experienceLabel(exp) }}</span
                                              >
                                              @if (exp.develop) {
                                                <span
                                                  class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 border border-amber-400/40 text-amber-300"
                                                  >Beta</span
                                                >
                                              }
                                            </div>
                                            <p class="text-[10px] text-neutral-500 truncate">
                                              {{ exp.id }}
                                            </p>
                                          </div>
                                        </div>
                                        <div class="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            uiSfx="select"
                                            class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors"
                                            [class]="
                                              exp.enabled
                                                ? 'bg-emerald-500 border-emerald-400'
                                                : 'bg-white/15 border-white/30'
                                            "
                                            (click)="toggleExperience(exp, brand.name)"
                                            [attr.aria-label]="
                                              (exp.enabled ? 'Desactivar ' : 'Activar ') +
                                              experienceLabel(exp)
                                            "
                                          >
                                            <span
                                              class="pointer-events-none inline-flex items-center justify-center size-5 rounded-full bg-white shadow-md mt-0.5 transition-transform"
                                              [class]="
                                                exp.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                              "
                                            >
                                              <app-hero-icon
                                                [name]="exp.enabled ? 'check' : 'x-mark'"
                                                class="text-[10px]"
                                                [class]="
                                                  exp.enabled
                                                    ? 'text-emerald-600'
                                                    : 'text-neutral-400'
                                                "
                                              />
                                            </span>
                                          </button>
                                        </div>
                                      </div>
                                    }
                                  </div>
                                } @else {
                                  <div class="flex flex-col gap-2">
                                    @for (exp of expSection.items; track exp.id) {
                                      <div
                                        class="rounded-xl bg-black/20 border border-white/10 px-3 py-2.5 flex items-center justify-between gap-2 opacity-90"
                                      >
                                        <div class="flex items-center gap-2 min-w-0 flex-1">
                                          <app-hero-icon
                                            [name]="
                                              exp.gameId === 'memory'
                                                ? 'square-2-stack'
                                                : 'squares-2x2'
                                            "
                                            class="text-neutral-400 shrink-0"
                                          />
                                          <div class="min-w-0">
                                            <div class="flex items-center gap-1.5 flex-wrap">
                                              <span
                                                class="text-xs sm:text-sm font-bold text-neutral-200 truncate"
                                                >{{ experienceLabel(exp) }}</span
                                              >
                                              @if (exp.develop) {
                                                <span
                                                  class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/15 border border-amber-400/30 text-amber-300/80"
                                                  >Beta</span
                                                >
                                              }
                                            </div>
                                            <p class="text-[10px] text-neutral-500 truncate">
                                              {{ exp.id }}
                                            </p>
                                          </div>
                                        </div>
                                        <div class="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            uiSfx="select"
                                            class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 bg-white/15 border-white/30"
                                            (click)="toggleExperience(exp, brand.name)"
                                            [attr.aria-label]="'Activar ' + experienceLabel(exp)"
                                          >
                                            <span
                                              class="pointer-events-none inline-flex items-center justify-center size-5 rounded-full bg-white shadow-md translate-x-0.5 mt-0.5"
                                            >
                                              <app-hero-icon
                                                name="x-mark"
                                                class="text-[10px] text-neutral-400"
                                              />
                                            </span>
                                          </button>
                                        </div>
                                      </div>
                                    }
                                  </div>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="flex flex-col gap-3.5">
                      @for (brand of section.brands; track brand.id) {
                        <div
                          class="w-full rounded-2xl bg-white/3 border border-white/10 backdrop-blur-md shadow-xl overflow-hidden opacity-95"
                        >
                          <div class="px-4 sm:px-5 py-4 flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3.5 min-w-0">
                              <div
                                class="size-11 sm:size-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-neutral-400 shrink-0"
                              >
                                <app-hero-icon name="tag" class="text-lg" />
                              </div>
                              <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                  <h4
                                    class="text-sm sm:text-base font-bold text-neutral-200 truncate"
                                  >
                                    {{ cleanText(brand.name) }}
                                  </h4>
                                  @if (brand.develop) {
                                    <span
                                      class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-400/30 text-amber-300/80"
                                      >Beta</span
                                    >
                                  }
                                  <span
                                    class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-rose-500/20 border-rose-400/40 text-rose-300"
                                    >Desactivada</span
                                  >
                                </div>
                                <p class="text-xs text-neutral-500 truncate mt-0.5">
                                  Marca oculta en toda la aplicación
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              uiSfx="select"
                              class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 bg-white/15 border-white/30"
                              (click)="toggleBrand(brand)"
                              [attr.aria-label]="'Activar marca ' + cleanText(brand.name)"
                            >
                              <span
                                class="pointer-events-none inline-flex items-center justify-center size-6 rounded-full bg-white shadow-md translate-x-0.5 mt-0.5"
                              >
                                <app-hero-icon name="x-mark" class="text-xs text-neutral-400" />
                              </span>
                            </button>
                          </div>
                          <div
                            class="px-4 sm:px-5 pb-4 space-y-3 border-t border-white/8 pt-3 ml-2 sm:ml-4"
                          >
                            <p
                              class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500"
                            >
                              Experiencias / juegos
                            </p>
                            @for (
                              expSection of experienceSectionsForBrand(brand.id);
                              track expSection.id
                            ) {
                              <div class="space-y-2">
                                <span
                                  class="text-[10px] font-extrabold uppercase tracking-wider"
                                  [class]="expSection.titleClass"
                                >
                                  {{ expSection.title }} ({{ expSection.items.length }})
                                </span>
                                @if (expSection.items.length === 0) {
                                  <p class="text-xs text-neutral-600 px-1">Ninguna</p>
                                } @else if (expSection.reorderable) {
                                  <div
                                    class="brand-drag-list"
                                    style="gap: 0.5rem;"
                                    cdkDropList
                                    [cdkDropListData]="expSection.items"
                                    (cdkDropListDropped)="
                                      onKioskExperienceDrop($event, brand.id, expSection.id)
                                    "
                                  >
                                    @for (exp of expSection.items; track exp.id) {
                                      <div
                                        class="rounded-xl bg-black/20 border border-white/10 px-3 py-2.5 flex items-center justify-between gap-2"
                                        cdkDrag
                                        [cdkDragDisabled]="expSection.items.length < 2"
                                      >
                                        <div
                                          class="brand-drag-placeholder min-h-12!"
                                          *cdkDragPlaceholder
                                        ></div>
                                        <div class="flex items-center gap-2 min-w-0 flex-1">
                                          @if (expSection.items.length > 1) {
                                            <button
                                              type="button"
                                              cdkDragHandle
                                              class="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 cursor-grab shrink-0"
                                              style="touch-action: none;"
                                              aria-label="Arrastrar experiencia"
                                            >
                                              <app-hero-icon
                                                name="arrows-up-down"
                                                class="text-sm"
                                              />
                                            </button>
                                          }
                                          <span class="text-xs font-bold text-white truncate">{{
                                            experienceLabel(exp)
                                          }}</span>
                                          @if (exp.develop) {
                                            <span
                                              class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 border border-amber-400/40 text-amber-300"
                                              >Beta</span
                                            >
                                          }
                                        </div>
                                        <div class="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            uiSfx="select"
                                            class="relative inline-flex h-7 w-12 cursor-pointer rounded-full border-2"
                                            [class]="
                                              exp.enabled
                                                ? 'bg-emerald-500 border-emerald-400'
                                                : 'bg-white/15 border-white/30'
                                            "
                                            (click)="toggleExperience(exp, brand.name)"
                                          >
                                            <span
                                              class="pointer-events-none inline-flex items-center justify-center size-5 rounded-full bg-white shadow-md mt-0.5"
                                              [class]="
                                                exp.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                              "
                                            >
                                              <app-hero-icon
                                                [name]="exp.enabled ? 'check' : 'x-mark'"
                                                class="text-[10px]"
                                                [class]="
                                                  exp.enabled
                                                    ? 'text-emerald-600'
                                                    : 'text-neutral-400'
                                                "
                                              />
                                            </span>
                                          </button>
                                        </div>
                                      </div>
                                    }
                                  </div>
                                } @else {
                                  <div class="flex flex-col gap-2">
                                    @for (exp of expSection.items; track exp.id) {
                                      <div
                                        class="rounded-xl bg-black/20 border border-white/10 px-3 py-2.5 flex items-center justify-between gap-2"
                                      >
                                        <div class="flex items-center gap-1.5 min-w-0">
                                          <span
                                            class="text-xs font-bold text-neutral-200 truncate"
                                            >{{ experienceLabel(exp) }}</span
                                          >
                                          @if (exp.develop) {
                                            <span
                                              class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/15 border border-amber-400/30 text-amber-300/80"
                                              >Beta</span
                                            >
                                          }
                                        </div>
                                        <button
                                          type="button"
                                          uiSfx="select"
                                          class="relative inline-flex h-7 w-12 cursor-pointer rounded-full border-2 bg-white/15 border-white/30"
                                          (click)="toggleExperience(exp, brand.name)"
                                        >
                                          <span
                                            class="pointer-events-none inline-flex items-center justify-center size-5 rounded-full bg-white shadow-md translate-x-0.5 mt-0.5"
                                          >
                                            <app-hero-icon
                                              name="x-mark"
                                              class="text-[10px] text-neutral-400"
                                            />
                                          </span>
                                        </button>
                                      </div>
                                    }
                                  </div>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </section>
              }

              <button
                type="button"
                uiSfx="select"
                class="w-full py-3.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/50 backdrop-blur-md text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-md"
                style="touch-action: manipulation;"
                (click)="askConfirm('resetBrands')"
              >
                <app-hero-icon name="arrow-path" class="text-base text-rose-400" />
                <span>Restablecer valores de marcas por defecto</span>
              </button>
            </div>
          }

          <!-- Nivel 2.2: Selección de Marca / Ajustes globales del juego -->
          @if (settingsView() === 'brands' && selectedGame(); as gameId) {
            <div class="space-y-6">
              <div class="space-y-1">
                <h2
                  class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5"
                >
                  <app-hero-icon
                    [name]="gameId === 'memory' ? 'square-2-stack' : 'squares-2x2'"
                    class="text-2xl text-yellow-400"
                  />
                  <span>
                    {{ selectedGameSettingsTitle() }}
                  </span>
                </h2>
                <p class="text-neutral-400 text-sm sm:text-base">
                  {{ selectedGameSettingsDescription() }}
                </p>
              </div>

              <!-- Switch Global / Individual -->
              <div
                class="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <app-hero-icon
                      name="adjustments-horizontal"
                      class="text-base text-yellow-400"
                    />
                    <span
                      class="font-extrabold uppercase tracking-wider text-sm kiosk:text-base text-white"
                    >
                      Modo de ajustes
                    </span>
                  </div>
                  <p class="text-xs sm:text-sm text-neutral-400 mt-1">
                    @if (catalog.experiencesMode() === 'global') {
                      Configuración compartida para todas las marcas de este juego.
                    } @else {
                      Cada marca mantiene sus propias reglas de partida.
                    }
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-2 shrink-0 w-full sm:w-auto sm:min-w-64">
                  <button
                    type="button"
                    uiSfx="select"
                    [class]="chipClass(catalog.experiencesMode() === 'individual')"
                    style="touch-action: manipulation;"
                    (click)="requestExperiencesMode('individual')"
                    aria-label="Modo de ajustes individual por marca"
                  >
                    <span class="text-xs sm:text-sm font-extrabold uppercase">Individual</span>
                  </button>
                  <button
                    type="button"
                    uiSfx="select"
                    [class]="chipClass(catalog.experiencesMode() === 'global')"
                    style="touch-action: manipulation;"
                    (click)="requestExperiencesMode('global')"
                    aria-label="Modo de ajustes globales para todas las marcas"
                  >
                    <span class="text-xs sm:text-sm font-extrabold uppercase">Global</span>
                  </button>
                </div>
              </div>

              @if (catalog.experiencesMode() === 'individual') {
                <div class="flex flex-col gap-3 pt-1">
                  @for (brand of brandsWithExperienceForGame(gameId); track brand.id) {
                    @let exp = getExperienceForBrandGame(brand.id, gameId);
                    <button
                      type="button"
                      uiSfx="select"
                      class="min-h-16 sm:min-h-18 w-full rounded-2xl bg-white/6 hover:bg-white/12 active:bg-white/18 border border-white/15 hover:border-yellow-400/40 backdrop-blur-md px-5 py-3.5 flex items-center justify-between gap-4 transition-all text-left group active:scale-[0.99] cursor-pointer"
                      style="touch-action: manipulation;"
                      (click)="openSettingsExperience(brand)"
                    >
                      <div class="flex items-center gap-3.5 min-w-0">
                        <div
                          class="size-10 sm:size-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-yellow-400 font-extrabold text-sm sm:text-base shrink-0"
                        >
                          <app-hero-icon
                            [name]="gameId === 'memory' ? 'square-2-stack' : 'squares-2x2'"
                            class="text-lg text-yellow-400"
                          />
                        </div>
                        <div class="min-w-0">
                          <h3
                            class="text-sm sm:text-base font-bold text-white group-hover:text-yellow-400 transition-colors truncate"
                          >
                            {{ cleanText(brand.name) }}
                          </h3>
                          <p class="text-xs text-neutral-400 line-clamp-2">
                            {{ brandGameConfigSummary(brand.id, gameId) }}
                          </p>
                        </div>
                      </div>

                      <div class="flex items-center gap-2.5 shrink-0">
                        @if (brand.develop) {
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-400/40 text-amber-300"
                          >
                            Beta
                          </span>
                        }
                        <span
                          class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border hidden sm:inline-block"
                          [class]="
                            brand.enabled
                              ? 'bg-white/10 border-white/20 text-neutral-300'
                              : 'bg-rose-500/15 border-rose-400/30 text-rose-300'
                          "
                        >
                          {{ brand.enabled ? 'Marca activa' : 'Marca inactiva' }}
                        </span>
                        <span
                          class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border"
                          [class]="
                            exp?.enabled
                              ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                              : 'bg-rose-500/15 border-rose-400/30 text-rose-300'
                          "
                        >
                          {{ exp?.enabled ? 'Juego activo' : 'Juego off' }}
                        </span>
                        <div
                          class="size-7 rounded-full bg-white/5 group-hover:bg-yellow-400/20 flex items-center justify-center text-neutral-400 group-hover:text-yellow-400"
                        >
                          <app-hero-icon name="chevron-right" />
                        </div>
                      </div>
                    </button>
                  }
                </div>
              } @else {
                <!-- Modo global: configuración de partida compartida -->
                @if (gameId === 'memory') {
                  @let memConfig = getGlobalMemoryConfig();
                  <div
                    class="space-y-4 p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex items-center gap-2">
                        <app-hero-icon name="square-2-stack" class="text-lg text-yellow-400" />
                        <h3
                          class="font-extrabold uppercase tracking-wide text-sm kiosk:text-base text-white"
                        >
                          Configuración de partida
                        </h3>
                      </div>
                      @if (memConfig.isCustomOverride) {
                        <button
                          type="button"
                          uiSfx="select"
                          class="text-xs font-bold text-neutral-400 hover:text-yellow-400 underline transition-colors cursor-pointer"
                          (click)="resetGlobalMemoryToDefault()"
                        >
                          Restaurar catálogo
                        </button>
                      }
                    </div>
                    <p class="text-xs text-neutral-400 -mt-2">
                      Los cambios se aplican a todas las marcas de Memoria.
                    </p>

                    <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                      <div class="flex items-center justify-between">
                        <span
                          class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                          >Cantidad de parejas</span
                        >
                        <span class="text-xs text-neutral-400"
                          >({{ memConfig.pairs * 2 }} cartas en tablero)</span
                        >
                      </div>
                      <div class="flex items-center justify-between gap-3 pt-1">
                        <button
                          type="button"
                          uiSfx="select"
                          [disabled]="memConfig.pairs <= 2"
                          class="size-11 sm:size-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border border-white/15 flex items-center justify-center text-white text-xl font-bold cursor-pointer transition-all"
                          (click)="changeGlobalMemoryPairsStep(-1)"
                          aria-label="Disminuir parejas"
                        >
                          <app-hero-icon name="minus" class="text-lg" />
                        </button>
                        <div
                          class="flex-1 text-center py-2 px-4 rounded-xl bg-white/5 border border-white/10"
                        >
                          <span
                            class="text-xl sm:text-2xl font-black text-yellow-400 tabular-nums"
                            >{{ memConfig.pairs }}</span
                          >
                          <span
                            class="text-xs sm:text-sm uppercase font-bold text-neutral-300 ml-2"
                          >
                            {{ memConfig.pairs === 1 ? 'pareja' : 'parejas' }}
                          </span>
                        </div>
                        <button
                          type="button"
                          uiSfx="select"
                          [disabled]="memConfig.pairs >= 6"
                          class="size-11 sm:size-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border border-white/15 flex items-center justify-center text-white text-xl font-bold cursor-pointer transition-all"
                          (click)="changeGlobalMemoryPairsStep(1)"
                          aria-label="Aumentar parejas"
                        >
                          <app-hero-icon name="plus" class="text-lg" />
                        </button>
                      </div>
                    </div>

                    <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                      <div class="flex items-center justify-between">
                        <span
                          class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                          >Dificultad</span
                        >
                        @if (memConfig.difficulty === 'custom') {
                          <span
                            class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40"
                            >Personalizada</span
                          >
                        }
                      </div>
                      <div class="grid grid-cols-3 gap-2.5 pt-1">
                        <button
                          type="button"
                          uiSfx="select"
                          [class]="chipClass(memConfig.difficulty === 'easy')"
                          style="touch-action: manipulation;"
                          (click)="selectGlobalMemoryDifficulty('easy')"
                        >
                          <span class="text-xs sm:text-sm font-extrabold uppercase">Fácil</span>
                        </button>
                        <button
                          type="button"
                          uiSfx="select"
                          [class]="chipClass(memConfig.difficulty === 'medium')"
                          style="touch-action: manipulation;"
                          (click)="selectGlobalMemoryDifficulty('medium')"
                        >
                          <div class="flex flex-col items-center justify-center py-0.5">
                            <span class="text-xs sm:text-sm font-extrabold uppercase">Medio</span>
                            <span
                              class="text-[9px] uppercase tracking-wider text-yellow-300 font-semibold"
                              >Recomendado</span
                            >
                          </div>
                        </button>
                        <button
                          type="button"
                          uiSfx="select"
                          [class]="chipClass(memConfig.difficulty === 'hard')"
                          style="touch-action: manipulation;"
                          (click)="selectGlobalMemoryDifficulty('hard')"
                        >
                          <span class="text-xs sm:text-sm font-extrabold uppercase">Difícil</span>
                        </button>
                      </div>
                    </div>

                    <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                      <div class="flex items-center justify-between">
                        <span
                          class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                          >Vidas / errores permitidos</span
                        >
                        <span class="text-xs text-neutral-400">Mínimo 3 vidas</span>
                      </div>
                      <div class="flex items-center justify-between gap-3 pt-1">
                        <button
                          type="button"
                          uiSfx="select"
                          [disabled]="memConfig.lives <= 3"
                          class="size-11 sm:size-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border border-white/15 flex items-center justify-center text-white text-xl font-bold cursor-pointer transition-all"
                          (click)="changeGlobalMemoryLivesStep(-1)"
                          aria-label="Disminuir vidas"
                        >
                          <app-hero-icon name="minus" class="text-lg" />
                        </button>
                        <div
                          class="flex-1 text-center py-2 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            class="w-5 h-5 text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]"
                          >
                            <path
                              d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3.5 7.02 3.5c1.82 0 3.393 1.056 4.23 2.593.837-1.537 2.41-2.593 4.23-2.593 2.306 0 4.77 1.822 4.77 4.75 0 3.924-2.438 7.11-4.739 9.266a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"
                            />
                          </svg>
                          <span class="text-xl sm:text-2xl font-black text-white tabular-nums">{{
                            memConfig.lives
                          }}</span>
                          <span class="text-xs sm:text-sm uppercase font-bold text-neutral-300">{{
                            memConfig.lives === 1 ? 'vida' : 'vidas'
                          }}</span>
                        </div>
                        <button
                          type="button"
                          uiSfx="select"
                          class="size-11 sm:size-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center justify-center text-white text-xl font-bold cursor-pointer transition-all"
                          (click)="changeGlobalMemoryLivesStep(1)"
                          aria-label="Aumentar vidas"
                        >
                          <app-hero-icon name="plus" class="text-lg" />
                        </button>
                      </div>
                    </div>

                    <div
                      class="p-3.5 rounded-xl bg-white/4 border border-white/10 text-xs text-neutral-300 flex items-start gap-2.5"
                    >
                      <app-hero-icon
                        name="information-circle"
                        class="text-yellow-400 shrink-0 mt-0.5 text-base"
                      />
                      <span>{{
                        memoryConfigExplanation(memConfig, memConfig.isCustomOverride)
                      }}</span>
                    </div>
                  </div>
                }

                @if (gameId === 'triqui') {
                  @let repExp = getGlobalRepresentativeExperience();
                  @if (repExp) {
                    @let defaultDiff = getDefaultTriquiDifficulty(repExp);
                    @let currentDiff = getGlobalTriquiDifficulty();
                    @let defaultFirst = getDefaultTriquiFirstPlayer(repExp);
                    @let currentFirst = getGlobalTriquiFirstPlayer();
                    @let defaultSymbol = getDefaultTriquiPlayerSymbol(repExp);
                    @let currentSymbol = getGlobalTriquiPlayerSymbol();
                    @let isTriquiCustom =
                      currentDiff !== null || currentFirst !== null || currentSymbol !== null;

                    <div
                      class="space-y-4 p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                          <app-hero-icon name="squares-2x2" class="text-lg text-yellow-400" />
                          <h3
                            class="font-extrabold uppercase tracking-wide text-sm kiosk:text-base text-white"
                          >
                            Configuración de partida
                          </h3>
                        </div>
                        @if (isTriquiCustom) {
                          <button
                            type="button"
                            uiSfx="select"
                            class="text-xs font-bold text-neutral-400 hover:text-yellow-400 underline transition-colors cursor-pointer"
                            (click)="resetGlobalTriquiToDefault()"
                          >
                            Restaurar catálogo
                          </button>
                        }
                      </div>
                      <p class="text-xs text-neutral-400 -mt-2">
                        Los cambios se aplican a todas las marcas de Triqui.
                      </p>

                      <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span
                            class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                            >Dificultad</span
                          >
                          @if (currentDiff !== null) {
                            <span
                              class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40"
                              >Ajuste Kiosco</span
                            >
                          }
                        </div>
                        <div class="grid grid-cols-3 gap-2.5 pt-1">
                          @for (opt of triquiDifficultyOptions; track opt.value) {
                            @let isDefaultVal = opt.value === defaultDiff;
                            @let isActive = (currentDiff ?? defaultDiff) === opt.value;
                            <button
                              type="button"
                              uiSfx="select"
                              [class]="chipClass(isActive)"
                              style="touch-action: manipulation;"
                              (click)="
                                changeGlobalTriquiDifficulty(
                                  opt.value === defaultDiff ? null : opt.value,
                                  defaultDiff
                                )
                              "
                            >
                              <div class="flex flex-col items-center justify-center py-0.5">
                                <span class="text-xs sm:text-sm font-extrabold uppercase">{{
                                  opt.label
                                }}</span>
                                @if (isDefaultVal) {
                                  <span
                                    class="text-[9px] uppercase tracking-wider text-yellow-300 font-semibold"
                                    >Catálogo</span
                                  >
                                }
                              </div>
                            </button>
                          }
                        </div>
                      </div>

                      <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span
                            class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                            >Quién empieza</span
                          >
                          @if (currentFirst !== null) {
                            <span
                              class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40"
                              >Ajuste Kiosco</span
                            >
                          }
                        </div>
                        <div class="grid grid-cols-3 gap-2.5 pt-1">
                          @for (opt of triquiFirstOptions; track opt.value) {
                            @let isDefaultVal = opt.value === defaultFirst;
                            @let isActive = (currentFirst ?? defaultFirst) === opt.value;
                            <button
                              type="button"
                              uiSfx="select"
                              [class]="chipClass(isActive)"
                              style="touch-action: manipulation;"
                              (click)="
                                changeGlobalTriquiFirstPlayer(
                                  opt.value === defaultFirst ? null : opt.value,
                                  defaultFirst
                                )
                              "
                            >
                              <div class="flex flex-col items-center justify-center py-0.5">
                                <span class="text-xs sm:text-sm font-extrabold uppercase">{{
                                  opt.label
                                }}</span>
                                @if (isDefaultVal) {
                                  <span
                                    class="text-[9px] uppercase tracking-wider text-yellow-300 font-semibold"
                                    >Catálogo</span
                                  >
                                }
                              </div>
                            </button>
                          }
                        </div>
                      </div>

                      <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span
                            class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                            >Figura del Jugador</span
                          >
                          @if (currentSymbol !== null) {
                            <span
                              class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40"
                              >Ajuste Kiosco</span
                            >
                          }
                        </div>
                        <div class="grid grid-cols-3 gap-2.5 pt-1">
                          @for (opt of triquiSymbolOptions; track opt.value) {
                            @let isDefaultVal = opt.value === defaultSymbol;
                            @let isActive = (currentSymbol ?? defaultSymbol) === opt.value;
                            @let markAsset = getExperienceMarkAsset(repExp, opt.value);
                            <button
                              type="button"
                              uiSfx="select"
                              [class]="chipClass(isActive)"
                              style="touch-action: manipulation;"
                              (click)="
                                changeGlobalTriquiPlayerSymbol(
                                  opt.value === defaultSymbol ? null : opt.value,
                                  defaultSymbol
                                )
                              "
                            >
                              <div class="flex flex-col items-center justify-center py-0.5 gap-0.5">
                                @if (opt.value === 'random') {
                                  <span
                                    class="text-[10px] font-bold uppercase tracking-wider text-neutral-200"
                                    >Aleatorio</span
                                  >
                                } @else if (markAsset) {
                                  <img
                                    [src]="markAsset"
                                    [alt]="opt.value"
                                    class="size-6 sm:size-7 object-contain drop-shadow"
                                  />
                                  <span
                                    class="text-[10px] font-bold uppercase tracking-wider text-neutral-200"
                                    >{{ opt.value === 'X' ? 'Cruz' : 'Círculo' }}</span
                                  >
                                } @else {
                                  <span
                                    class="text-base sm:text-lg font-black"
                                    [class]="opt.value === 'X' ? 'text-cyan-400' : 'text-amber-200'"
                                    >{{ opt.value }}</span
                                  >
                                  <span
                                    class="text-[10px] font-bold uppercase tracking-wider text-neutral-200"
                                    >{{ opt.value === 'X' ? 'Cruz' : 'Círculo' }}</span
                                  >
                                }
                                @if (isDefaultVal) {
                                  <span
                                    class="text-[9px] uppercase tracking-wider text-yellow-300 font-semibold"
                                    >Catálogo</span
                                  >
                                }
                              </div>
                            </button>
                          }
                        </div>
                      </div>

                      <div
                        class="p-3.5 rounded-xl bg-white/4 border border-white/10 text-xs text-neutral-300 flex items-start gap-2.5"
                      >
                        <app-hero-icon
                          name="information-circle"
                          class="text-yellow-400 shrink-0 mt-0.5 text-base"
                        />
                        <div class="space-y-1">
                          <p>
                            <strong>Dificultad:</strong>
                            {{ triquiDifficultyExplanation(currentDiff, defaultDiff) }}
                          </p>
                          <p>
                            <strong>Primer Turno:</strong>
                            {{ triquiFirstPlayerExplanation(currentFirst, defaultFirst) }}
                          </p>
                        </div>
                      </div>
                    </div>
                  }
                }

                <button
                  type="button"
                  uiSfx="select"
                  class="w-full py-3.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/50 backdrop-blur-md text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-md"
                  style="touch-action: manipulation;"
                  (click)="askConfirm('resetGlobalGame')"
                >
                  <app-hero-icon name="arrow-path" class="text-base text-rose-400" />
                  <span>Restablecer valores de juego por defecto</span>
                </button>
              }
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
                      <h2
                        class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5"
                      >
                        <app-hero-icon
                          [name]="gameId === 'memory' ? 'square-2-stack' : 'squares-2x2'"
                          class="text-2xl text-yellow-400"
                        />
                        <span>{{ selectedGameSettingsTitle() }} · {{ cleanText(brand.name) }}</span>
                      </h2>
                      @if (exp.develop || brand.develop || catalog.isGameDevelop(gameId)) {
                        <span
                          class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/25 border border-amber-400/50 text-amber-300 flex items-center gap-1.5"
                        >
                          <app-hero-icon name="lock-closed" class="text-xs" />
                          <span>En desarrollo</span>
                        </span>
                      }
                    </div>
                    <p class="text-neutral-400 text-sm sm:text-base">
                      {{ selectedGameSettingsDescription() }} · ajustes de esta marca.
                    </p>
                  </div>

                  <!-- Ajustes específicos de Memoria -->
                  @if (gameId === 'memory') {
                    @let memConfig = getEffectiveMemoryConfig(exp);
                    <div
                      class="space-y-4 p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                          <app-hero-icon name="square-2-stack" class="text-lg text-yellow-400" />
                          <h3
                            class="font-extrabold uppercase tracking-wide text-sm kiosk:text-base text-white"
                          >
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
                      <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span
                            class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                          >
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

                          <div
                            class="flex-1 text-center py-2 px-4 rounded-xl bg-white/5 border border-white/10"
                          >
                            <span
                              class="text-xl sm:text-2xl font-black text-yellow-400 tabular-nums"
                            >
                              {{ memConfig.pairs }}
                            </span>
                            <span
                              class="text-xs sm:text-sm uppercase font-bold text-neutral-300 ml-2"
                            >
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
                      <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span
                            class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                          >
                            Dificultad
                          </span>
                          @if (memConfig.difficulty === 'custom') {
                            <span
                              class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40"
                            >
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
                              <span
                                class="text-[9px] uppercase tracking-wider text-yellow-300 font-semibold"
                                >Recomendado</span
                              >
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
                      <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span
                            class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                          >
                            Vidas / errores permitidos
                          </span>
                          <span class="text-xs text-neutral-400"> Mínimo 3 vidas </span>
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

                          <div
                            class="flex-1 text-center py-2 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              class="w-5 h-5 text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]"
                            >
                              <path
                                d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3.5 7.02 3.5c1.82 0 3.393 1.056 4.23 2.593.837-1.537 2.41-2.593 4.23-2.593 2.306 0 4.77 1.822 4.77 4.75 0 3.924-2.438 7.11-4.739 9.266a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"
                              />
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
                      <div
                        class="p-3.5 rounded-xl bg-white/4 border border-white/10 text-xs text-neutral-300 flex items-start gap-2.5"
                      >
                        <app-hero-icon
                          name="information-circle"
                          class="text-yellow-400 shrink-0 mt-0.5 text-base"
                        />
                        <span>{{
                          memoryConfigExplanation(memConfig, memConfig.isCustomOverride)
                        }}</span>
                      </div>
                    </div>
                  }

                  <!-- Ajustes específicos de Triqui -->
                  @if (gameId === 'triqui') {
                    @let defaultDiff = getDefaultTriquiDifficulty(exp);
                    @let currentDiff = settings.getExperienceTriquiDifficulty(exp.id);
                    @let defaultFirst = getDefaultTriquiFirstPlayer(exp);
                    @let currentFirst = settings.getExperienceTriquiFirstPlayer(exp.id);
                    @let defaultSymbol = getDefaultTriquiPlayerSymbol(exp);
                    @let currentSymbol = settings.getExperienceTriquiPlayerSymbol(exp.id);
                    @let isTriquiCustom =
                      currentDiff !== null || currentFirst !== null || currentSymbol !== null;

                    <div
                      class="space-y-4 p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl"
                    >
                      <!-- Encabezado unificado de Configuración de Partida -->
                      <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                          <app-hero-icon name="squares-2x2" class="text-lg text-yellow-400" />
                          <h3
                            class="font-extrabold uppercase tracking-wide text-sm kiosk:text-base text-white"
                          >
                            Configuración de partida
                          </h3>
                        </div>
                        @if (isTriquiCustom) {
                          <button
                            type="button"
                            uiSfx="select"
                            class="text-xs font-bold text-neutral-400 hover:text-yellow-400 underline transition-colors cursor-pointer"
                            (click)="resetExperienceTriquiToDefault(exp.id, brand.name)"
                          >
                            Restaurar catálogo
                          </button>
                        }
                      </div>

                      <!-- Control 1: Dificultad (3 columnas como en Memoria) -->
                      <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span
                            class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                          >
                            Dificultad
                          </span>
                          @if (currentDiff !== null) {
                            <span
                              class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40"
                            >
                              Ajuste Kiosco
                            </span>
                          }
                        </div>

                        <div class="grid grid-cols-3 gap-2.5 pt-1">
                          @for (opt of triquiDifficultyOptions; track opt.value) {
                            @let isDefaultVal = opt.value === defaultDiff;
                            @let isActive = (currentDiff ?? defaultDiff) === opt.value;
                            <button
                              type="button"
                              uiSfx="select"
                              [class]="chipClass(isActive)"
                              style="touch-action: manipulation;"
                              (click)="
                                changeExperienceTriquiDifficulty(
                                  exp.id,
                                  opt.value === defaultDiff ? null : opt.value,
                                  brand.name,
                                  defaultDiff
                                )
                              "
                            >
                              <div class="flex flex-col items-center justify-center py-0.5">
                                <span class="text-xs sm:text-sm font-extrabold uppercase">{{
                                  opt.label
                                }}</span>
                                @if (isDefaultVal) {
                                  <span
                                    class="text-[9px] uppercase tracking-wider text-yellow-300 font-semibold"
                                    >Catálogo</span
                                  >
                                }
                              </div>
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Control 2: Quién empieza (3 columnas como en Memoria) -->
                      <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span
                            class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                          >
                            Quién empieza
                          </span>
                          @if (currentFirst !== null) {
                            <span
                              class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40"
                            >
                              Ajuste Kiosco
                            </span>
                          }
                        </div>

                        <div class="grid grid-cols-3 gap-2.5 pt-1">
                          @for (opt of triquiFirstOptions; track opt.value) {
                            @let isDefaultVal = opt.value === defaultFirst;
                            @let isActive = (currentFirst ?? defaultFirst) === opt.value;
                            <button
                              type="button"
                              uiSfx="select"
                              [class]="chipClass(isActive)"
                              style="touch-action: manipulation;"
                              (click)="
                                changeExperienceTriquiFirstPlayer(
                                  exp.id,
                                  opt.value === defaultFirst ? null : opt.value,
                                  brand.name,
                                  defaultFirst
                                )
                              "
                            >
                              <div class="flex flex-col items-center justify-center py-0.5">
                                <span class="text-xs sm:text-sm font-extrabold uppercase">{{
                                  opt.label
                                }}</span>
                                @if (isDefaultVal) {
                                  <span
                                    class="text-[9px] uppercase tracking-wider text-yellow-300 font-semibold"
                                    >Catálogo</span
                                  >
                                }
                              </div>
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Control 3: Figura del Jugador (X u O) -->
                      <div class="p-4 rounded-xl bg-white/3 border border-white/10 space-y-2">
                        <div class="flex items-center justify-between">
                          <span
                            class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200"
                          >
                            Figura del Jugador
                          </span>
                          @if (currentSymbol !== null) {
                            <span
                              class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40"
                            >
                              Ajuste Kiosco
                            </span>
                          }
                        </div>

                        <div class="grid grid-cols-3 gap-2.5 pt-1">
                          @for (opt of triquiSymbolOptions; track opt.value) {
                            @let isDefaultVal = opt.value === defaultSymbol;
                            @let isActive = (currentSymbol ?? defaultSymbol) === opt.value;
                            @let markAsset = getExperienceMarkAsset(exp, opt.value);
                            <button
                              type="button"
                              uiSfx="select"
                              [class]="chipClass(isActive)"
                              style="touch-action: manipulation;"
                              (click)="
                                changeExperienceTriquiPlayerSymbol(
                                  exp.id,
                                  opt.value === defaultSymbol ? null : opt.value,
                                  brand.name,
                                  defaultSymbol
                                )
                              "
                            >
                              <div class="flex flex-col items-center justify-center py-0.5 gap-0.5">
                                @if (opt.value === 'random') {
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="size-6 sm:size-7 drop-shadow text-amber-300"
                                    fill="currentColor"
                                    viewBox="0 0 16 16"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M0 3.5A.5.5 0 0 1 .5 3H1c2.202 0 3.827 1.24 4.874 2.418.49.552.865 1.102 1.126 1.532.26-.43.636-.98 1.126-1.532C9.173 4.24 10.798 3 13 3v1c-1.798 0-3.173 1.01-4.126 2.082A9.6 9.6 0 0 0 7.556 8a9.6 9.6 0 0 0 1.317 1.918C9.828 10.99 11.204 12 13 12v1c-2.202 0-3.827-1.24-4.874-2.418A10.6 10.6 0 0 1 7 9.05c-.26.43-.636.98-1.126 1.532C4.827 11.76 3.202 13 1 13H.5a.5.5 0 0 1 0-1H1c1.798 0 3.173-1.01 4.126-2.082A9.6 9.6 0 0 0 6.444 8a9.6 9.6 0 0 0-1.317-1.918C4.172 5.01 2.796 4 1 4H.5a.5.5 0 0 1-.5-.5"
                                    />
                                    <path
                                      d="M13 5.466V1.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192m0 9v-3.932a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192"
                                    />
                                  </svg>
                                  <span
                                    class="text-[10px] font-bold uppercase tracking-wider text-neutral-200"
                                    >Aleatorio</span
                                  >
                                } @else if (markAsset) {
                                  <img
                                    [src]="markAsset"
                                    [alt]="opt.value"
                                    class="size-6 sm:size-7 object-contain drop-shadow"
                                  />
                                  <span
                                    class="text-[10px] font-bold uppercase tracking-wider text-neutral-200"
                                    >{{ opt.value === 'X' ? 'Cruz' : 'Círculo' }}</span
                                  >
                                } @else {
                                  <span
                                    class="text-base sm:text-lg font-black"
                                    [class]="opt.value === 'X' ? 'text-cyan-400' : 'text-amber-200'"
                                    >{{ opt.value }}</span
                                  >
                                  <span
                                    class="text-[10px] font-bold uppercase tracking-wider text-neutral-200"
                                    >{{ opt.value === 'X' ? 'Cruz' : 'Círculo' }}</span
                                  >
                                }
                                @if (isDefaultVal) {
                                  <span
                                    class="text-[9px] uppercase tracking-wider text-yellow-300 font-semibold"
                                    >Catálogo</span
                                  >
                                }
                              </div>
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Explicación contextual -->
                      <div
                        class="p-3.5 rounded-xl bg-white/4 border border-white/10 text-xs text-neutral-300 flex items-start gap-2.5"
                      >
                        <app-hero-icon
                          name="information-circle"
                          class="text-yellow-400 shrink-0 mt-0.5 text-base"
                        />
                        <div class="space-y-1">
                          <p>
                            <strong>Dificultad:</strong>
                            {{ triquiDifficultyExplanation(currentDiff, defaultDiff) }}
                          </p>
                          <p>
                            <strong>Primer Turno:</strong>
                            {{ triquiFirstPlayerExplanation(currentFirst, defaultFirst) }}
                          </p>
                          <p class="leading-normal">
                            <strong>Figura:</strong>
                            @let activePlayerSym = currentSymbol ?? defaultSymbol;
                            @if (activePlayerSym === 'random') {
                              <span
                                >Sorteo aleatorio por ronda (50% ✕, 50% ○). La inteligencia
                                artificial jugará con la figura contraria en cada ronda.</span
                              >
                            } @else {
                              El jugador utiliza la marca
                              @let activeAiSym = activePlayerSym === 'X' ? 'O' : 'X';
                              @let playerAsset = getExperienceMarkAsset(exp, activePlayerSym);
                              @if (playerAsset) {
                                <img
                                  [src]="playerAsset"
                                  alt="Jugador"
                                  class="inline-block size-4.5 object-contain align-middle mx-0.5 drop-shadow"
                                />
                              } @else {
                                <strong
                                  [class]="
                                    activePlayerSym === 'X' ? 'text-cyan-400' : 'text-amber-200'
                                  "
                                  >{{ activePlayerSym === 'X' ? '✕' : '○' }}</strong
                                >
                              }
                              y la inteligencia artificial juega con la marca
                              @let aiAsset = getExperienceMarkAsset(exp, activeAiSym);
                              @if (aiAsset) {
                                <img
                                  [src]="aiAsset"
                                  alt="IA"
                                  class="inline-block size-4.5 object-contain align-middle mx-0.5 drop-shadow"
                                />
                              } @else {
                                <strong
                                  [class]="activeAiSym === 'X' ? 'text-cyan-400' : 'text-amber-200'"
                                  >{{ activeAiSym === 'X' ? '✕' : '○' }}</strong
                                >
                              }
                              .
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  }

                  <!-- Botón al final para restablecer valores de juego por defecto -->
                  <button
                    type="button"
                    uiSfx="select"
                    class="w-full py-3.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/50 backdrop-blur-md text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-md"
                    style="touch-action: manipulation;"
                    (click)="askConfirmResetExperience(exp, brand.name)"
                  >
                    <app-hero-icon name="arrow-path" class="text-base text-rose-400" />
                    <span>Restablecer valores de juego por defecto</span>
                  </button>
                </div>
              }
            }
          }
        }

        <!-- ═══ SUB-PÁGINA 3: DIAGNÓSTICO ═══ -->
        @if (activeSection() === 'diagnostics') {
          <div class="space-y-6">
            <div class="space-y-1">
              <h2
                class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5"
              >
                <app-hero-icon name="cpu-chip" class="text-2xl text-yellow-400" />
                <span>Diagnóstico del Sistema</span>
              </h2>
              <p class="text-neutral-400 text-sm sm:text-base">
                Métricas técnicas de entorno, pantalla y catálogo activo.
              </p>
            </div>

            <div
              class="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md p-5 sm:p-6 space-y-2.5 text-sm sm:text-base kiosk:text-lg font-mono"
            >
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

            <div
              class="p-5 sm:p-6 rounded-2xl border backdrop-blur-md space-y-4"
              [class]="
                catalog.developMode()
                  ? 'border-amber-400/35 bg-amber-500/10'
                  : 'border-white/15 bg-white/5'
              "
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 space-y-1.5">
                  <p
                    class="font-extrabold uppercase tracking-wider text-sm sm:text-base flex items-center gap-2"
                    [class]="catalog.developMode() ? 'text-amber-300' : 'text-yellow-400'"
                  >
                    <app-hero-icon name="beaker" class="text-lg" />
                    <span>Modo desarrollo</span>
                  </p>
                  <p class="text-neutral-300 text-sm sm:text-base leading-relaxed">
                    @if (catalog.developMode()) {
                      Activo: el kiosco y este panel muestran marcas, juegos y experiencias beta.
                    } @else {
                      Inactivo: el contenido y las configuraciones beta permanecen ocultos en toda
                      la aplicación.
                    }
                  </p>
                </div>
                <span
                  class="shrink-0 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border"
                  [class]="
                    catalog.developMode()
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                      : 'bg-white/10 border-white/20 text-neutral-400'
                  "
                >
                  {{ catalog.developMode() ? 'ON' : 'OFF' }}
                </span>
              </div>

              <button
                type="button"
                uiSfx="select"
                class="w-full min-h-14 px-4 rounded-xl border backdrop-blur-md text-sm sm:text-base font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
                [class]="
                  catalog.developMode()
                    ? 'bg-white/5 hover:bg-white/10 border-white/20 text-neutral-200'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/40 text-amber-200'
                "
                style="touch-action: manipulation;"
                (click)="onDevelopModeToggle()"
              >
                <app-hero-icon
                  [name]="catalog.developMode() ? 'eye-slash' : 'lock-closed'"
                  class="text-lg"
                />
                <span>{{
                  catalog.developMode() ? 'Desactivar modo desarrollo' : 'Activar modo desarrollo'
                }}</span>
              </button>
            </div>

            <div
              class="space-y-5 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md"
            >
              <div class="space-y-3">
                <p
                  class="font-bold uppercase tracking-wider text-xs sm:text-sm text-yellow-400 flex items-center gap-2"
                >
                  <app-hero-icon name="swatch" class="text-sm text-yellow-400" />
                  <span>Marcas</span>
                  <span class="text-neutral-500 font-bold normal-case tracking-normal"
                    >({{ catalog.rawManifest().brands.length }})</span
                  >
                </p>
                <ul class="space-y-2">
                  @for (brand of catalog.rawManifest().brands; track brand.id) {
                    <li
                      class="rounded-xl border border-white/10 bg-white/3 px-3.5 py-3 flex items-start justify-between gap-3"
                    >
                      <div class="min-w-0 space-y-1">
                        <p class="text-sm sm:text-base font-bold text-white truncate">
                          {{ cleanText(brand.name) }}
                        </p>
                        <p class="text-[11px] sm:text-xs font-mono text-neutral-500 truncate">
                          {{ brand.id }}
                        </p>
                      </div>
                      <div class="shrink-0 flex flex-col items-end gap-1.5">
                        <span class="text-[11px] sm:text-xs font-mono text-neutral-300"
                          >v{{ brand.version }}</span
                        >
                        <div class="flex items-center gap-1.5 flex-wrap justify-end">
                          @if (brand.develop) {
                            <span
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 border border-amber-400/40 text-amber-300"
                            >
                              <app-hero-icon name="fire" class="text-[10px]" />
                              Beta
                            </span>
                          }
                          @let brandVis = diagnosticVisibility(brand.enabled, !!brand.develop, 'f');
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border"
                            [class]="brandVis.className"
                          >
                            {{ brandVis.label }}
                          </span>
                        </div>
                      </div>
                    </li>
                  }
                </ul>
              </div>

              <div class="pt-2 border-t border-white/10 space-y-3">
                <p
                  class="font-bold uppercase tracking-wider text-xs sm:text-sm text-yellow-400 flex items-center gap-2"
                >
                  <app-hero-icon name="cube" class="text-sm text-yellow-400" />
                  <span>Motores</span>
                  <span class="text-neutral-500 font-bold normal-case tracking-normal"
                    >({{ catalog.rawManifest().games.length }})</span
                  >
                </p>
                <ul class="space-y-2">
                  @for (game of catalog.rawManifest().games; track game.id) {
                    <li
                      class="rounded-xl border border-white/10 bg-white/3 px-3.5 py-3 flex items-start justify-between gap-3"
                    >
                      <div class="min-w-0 space-y-1">
                        <p class="text-sm sm:text-base font-bold text-white truncate">
                          {{ diagnosticGameName(game) }}
                        </p>
                        <p class="text-[11px] sm:text-xs font-mono text-neutral-500 truncate">
                          {{ game.id }}
                        </p>
                      </div>
                      <div class="shrink-0 flex flex-col items-end gap-1.5">
                        <span class="text-[11px] sm:text-xs font-mono text-neutral-300"
                          >v{{ game.version }}</span
                        >
                        <div class="flex items-center gap-1.5 flex-wrap justify-end">
                          @if (game.develop) {
                            <span
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 border border-amber-400/40 text-amber-300"
                            >
                              <app-hero-icon name="fire" class="text-[10px]" />
                              Beta
                            </span>
                          }
                          @let gameVis = diagnosticVisibility(!!game.enabled, !!game.develop, 'm');
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border"
                            [class]="gameVis.className"
                          >
                            {{ gameVis.label }}
                          </span>
                        </div>
                      </div>
                    </li>
                  }
                </ul>
              </div>

              <div class="pt-2 border-t border-white/10 space-y-3">
                <p
                  class="font-bold uppercase tracking-wider text-xs sm:text-sm text-yellow-400 flex items-center gap-2"
                >
                  <app-hero-icon name="sparkles" class="text-sm text-yellow-400" />
                  <span>Experiencias</span>
                  <span class="text-neutral-500 font-bold normal-case tracking-normal"
                    >({{ catalog.rawManifest().experiences.length }})</span
                  >
                </p>
                <ul class="space-y-2">
                  @for (exp of catalog.rawManifest().experiences; track exp.id) {
                    <li
                      class="rounded-xl border border-white/10 bg-white/3 px-3.5 py-3 flex items-start justify-between gap-3"
                    >
                      <div class="min-w-0 space-y-1">
                        <p class="text-sm sm:text-base font-bold text-white truncate">
                          {{ experienceLabel(exp) }}
                        </p>
                        <p class="text-[11px] sm:text-xs font-mono text-neutral-500 truncate">
                          {{ exp.id }}
                        </p>
                      </div>
                      <div class="shrink-0 flex flex-col items-end gap-1.5">
                        <span class="text-[11px] sm:text-xs font-mono text-neutral-300"
                          >v{{ exp.version }}</span
                        >
                        <div class="flex items-center gap-1.5 flex-wrap justify-end">
                          @if (catalog.isExperienceDevelop(exp)) {
                            <span
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 border border-amber-400/40 text-amber-300"
                            >
                              <app-hero-icon name="fire" class="text-[10px]" />
                              Beta
                            </span>
                          }
                          @let expVis =
                            diagnosticVisibility(
                              exp.enabled,
                              catalog.isExperienceDevelop(exp),
                              'f'
                            );
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border"
                            [class]="expVis.className"
                          >
                            {{ expVis.label }}
                          </span>
                        </div>
                      </div>
                    </li>
                  }
                </ul>
              </div>
            </div>
          </div>
        }

        <!-- ═══ SUB-PÁGINA 4: ACTUALIZACIONES ═══ -->
        @if (activeSection() === 'updates') {
          <div class="space-y-6">
            <div class="space-y-1">
              <h2
                class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5"
              >
                <app-hero-icon name="cloud-arrow-down" class="text-2xl text-yellow-400" />
                <span>Actualizaciones</span>
              </h2>
              <p class="text-neutral-400 text-sm sm:text-base">
                Revisión e instalación de versiones de catálogo y aplicación.
              </p>
            </div>

            <div
              class="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3"
            >
              <p class="text-neutral-300 text-sm sm:text-base font-medium">
                {{ updateStatusCopy() }}
              </p>

              @if (snapshot().errorMessage) {
                <div
                  class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-sm"
                >
                  {{ snapshot().errorMessage }}
                </div>
              }

              @if (snapshot().note) {
                <div
                  class="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-400/25 text-yellow-200 text-sm"
                >
                  {{ snapshot().note }}
                </div>
              }

              @if (snapshot().appUpdateAvailable) {
                <div
                  class="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-400/25 text-yellow-200 text-sm"
                >
                  App {{ snapshot().appVersion }}
                  @if (snapshot().remoteAppVersion) {
                    → {{ snapshot().remoteAppVersion }}
                  }
                  . El ejecutable se instala al final y puede reiniciar.
                </div>
              }

              @if (visibleDiff().length > 0) {
                <div class="pt-2">
                  <p class="font-bold text-xs uppercase tracking-wider text-neutral-400 mb-2">
                    Cambios detectados:
                  </p>
                  <ul class="space-y-1.5 text-sm kiosk:text-base text-neutral-200">
                    @for (item of visibleDiff(); track item.collection + item.id) {
                      <li class="flex items-center gap-2">
                        <span class="size-1.5 rounded-full bg-yellow-400"></span>
                        <span
                          >{{ collectionLabel(item) }} <strong>{{ item.id }}</strong> ·
                          {{ kindLabel(item) }}
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
                <div
                  class="text-neutral-400 text-xs sm:text-sm pt-2 border-t border-white/10 space-y-1"
                >
                  @if (isNative()) {
                    <p>
                      Se descargarán {{ snapshot().pendingAssets?.length }} archivo(s) al disco
                      @if (pendingHasVideoFiles()) {
                        <span> (incluye video; puede tardar)</span>
                      }
                      .
                    </p>
                    @if (
                      snapshot().status === 'downloading' && snapshot().downloadProgress;
                      as progress
                    ) {
                      <p class="font-medium text-neutral-300">
                        Descargando {{ progress.completed }} de {{ progress.total }}
                        @if (progress.currentPath) {
                          <span class="font-mono text-[11px]"> · {{ progress.currentPath }}</span>
                        }
                      </p>
                    }
                  } @else {
                    <p>
                      {{ snapshot().pendingAssets?.length }} archivo(s) nuevo(s). Los packs OTA solo
                      se descargan en la app de escritorio; el JSON sí puede aplicarse (assets de
                      semilla siguen en el bundle).
                    </p>
                  }
                </div>
              }
            </div>

            <app-kiosk-button variant="primary" [disabled]="updateBusy()" (click)="onUpdateCta()">
              <app-hero-icon
                [name]="
                  snapshot().appUpdateAvailable || (snapshot().catalogDiff?.items?.length ?? 0) > 0
                    ? 'arrow-down-tray'
                    : 'arrow-path'
                "
                class="text-yellow-400"
              />
              {{ updateCtaLabel() }}
            </app-kiosk-button>
          </div>
        }

        <!-- ═══ SUB-PÁGINA 5: SEGURIDAD / PIN (Inputs Verticales) ═══ -->
        @if (activeSection() === 'pin') {
          <div class="space-y-6">
            <div class="space-y-1">
              <h2
                class="text-xl sm:text-2xl kiosk:text-3xl font-extrabold uppercase tracking-wide font-['Montserrat'] text-yellow-400 flex items-center gap-2.5"
              >
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
              <div
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
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      uiSfx="click"
                      class="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                      [attr.aria-label]="showPinDigits().current ? 'Ocultar PIN' : 'Ver PIN'"
                      (click)="togglePinVisibility('current', $event)"
                    >
                      <app-hero-icon
                        [name]="showPinDigits().current ? 'eye-slash' : 'eye'"
                        class="text-base"
                      />
                    </button>
                    @if (pinField() === 'current') {
                      <span
                        class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                      >
                        Editando
                      </span>
                    }
                  </div>
                </div>
                <div
                  class="mt-2 text-2xl font-mono tracking-[0.4em] text-white overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {{ formatPinDisplay('current') }}
                </div>
              </div>

              <!-- Campo 2: Nuevo PIN -->
              <div
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
                    <span>2. Ingrese su nuevo PIN (4 a 10 dígitos)</span>
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      uiSfx="click"
                      class="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                      [attr.aria-label]="showPinDigits().next ? 'Ocultar PIN' : 'Ver PIN'"
                      (click)="togglePinVisibility('next', $event)"
                    >
                      <app-hero-icon
                        [name]="showPinDigits().next ? 'eye-slash' : 'eye'"
                        class="text-base"
                      />
                    </button>
                    @if (pinField() === 'next') {
                      <span
                        class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                      >
                        Editando
                      </span>
                    }
                  </div>
                </div>
                <div
                  class="mt-2 text-2xl font-mono tracking-[0.4em] text-white overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {{ formatPinDisplay('next') }}
                </div>
              </div>

              <!-- Campo 3: Repetir nuevo PIN -->
              <div
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
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      uiSfx="click"
                      class="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                      [attr.aria-label]="showPinDigits().confirm ? 'Ocultar PIN' : 'Ver PIN'"
                      (click)="togglePinVisibility('confirm', $event)"
                    >
                      <app-hero-icon
                        [name]="showPinDigits().confirm ? 'eye-slash' : 'eye'"
                        class="text-base"
                      />
                    </button>
                    @if (pinField() === 'confirm') {
                      <span
                        class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                      >
                        Editando
                      </span>
                    }
                  </div>
                </div>
                <div
                  class="mt-2 text-2xl font-mono tracking-[0.4em] text-white overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {{ formatPinDisplay('confirm') }}
                </div>
              </div>

              <!-- Campo 4: Frase de recordación (opcional) -->
              <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 select-none">
                <label
                  for="pin-hint-input"
                  class="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2 cursor-pointer"
                >
                  <app-hero-icon name="light-bulb" class="text-sm text-yellow-400" />
                  <span>4. Frase de recordación (opcional)</span>
                </label>
                <input
                  id="pin-hint-input"
                  type="text"
                  class="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/15 text-white text-sm sm:text-base placeholder-neutral-500 focus:outline-none focus:border-yellow-400/60 transition-all"
                  placeholder="Ej: Código interno de la sede Norte"
                  [value]="pinModel().hint"
                  (input)="updatePinHint($event)"
                />
                <p class="text-[11px] text-neutral-400">
                  Esta frase se mostrará en la pantalla de ingreso si olvidas tu PIN.
                </p>
              </div>
            </div>

            <!-- Teclado Numérico Táctil -->
            <div class="grid grid-cols-3 gap-3 max-w-sm mx-auto w-full pt-2">
              @for (key of pinKeys; track key) {
                <button
                  type="button"
                  uiSfx="click"
                  [disabled]="isPinFieldFull()"
                  [class.opacity-40]="isPinFieldFull()"
                  [class.cursor-not-allowed]="isPinFieldFull()"
                  class="min-h-14 sm:min-h-16 rounded-2xl bg-white/8 hover:bg-white/15 border border-white/15 text-xl font-bold active:scale-95 transition-all text-white disabled:pointer-events-none"
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
                [disabled]="isPinFieldFull()"
                [class.opacity-40]="isPinFieldFull()"
                [class.cursor-not-allowed]="isPinFieldFull()"
                class="min-h-14 sm:min-h-16 rounded-2xl bg-white/8 hover:bg-white/15 border border-white/15 text-xl font-bold active:scale-95 transition-all text-white disabled:pointer-events-none"
                style="touch-action: manipulation;"
                (click)="appendPinDigit('0')"
              >
                0
              </button>
              <button
                type="button"
                uiSfx="click"
                [disabled]="!canSavePin()"
                [class]="
                  canSavePin()
                    ? 'bg-yellow-400/25 hover:bg-yellow-400/35 border-yellow-400/50 text-yellow-300 active:scale-95 cursor-pointer'
                    : 'bg-white/5 border-white/10 text-neutral-500 opacity-40 cursor-not-allowed pointer-events-none'
                "
                class="min-h-14 sm:min-h-16 rounded-2xl border text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 text-center"
                style="touch-action: manipulation;"
                (click)="requestPinChange()"
              >
                <app-hero-icon
                  name="check"
                  class="text-xl"
                  [class]="canSavePin() ? 'text-yellow-300' : 'text-neutral-500'"
                />
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
        [confirmLabel]="
          kind === 'applyUpdate'
            ? 'Instalar'
            : kind === 'changePin'
              ? 'Confirmar y cambiar'
              : kind === 'switchToGlobal'
                ? 'Activar global'
                : kind === 'resetDefaults' ||
                    kind === 'resetAudio' ||
                    kind === 'resetScreensaver' ||
                    kind === 'resetGeneral' ||
                    kind === 'resetBrands' ||
                    kind === 'resetExperience' ||
                    kind === 'resetGlobalGame'
                  ? 'Restaurar'
                  : kind === 'restart'
                    ? 'Reiniciar'
                    : kind === 'exit'
                      ? 'Cerrar'
                      : kind === 'enterKiosk'
                        ? 'Activar'
                        : kind === 'leaveKiosk'
                          ? 'Salir'
                          : 'Confirmar'
        "
        (confirmed)="onConfirm()"
        (cancelled)="onConfirmCancelled()"
      />
    }

    @if (pendingDevelopModeUnlock()) {
      <app-superadmin-pin-dialog
        title="Activar modo desarrollo"
        subtitle="Ingrese el PIN de superadministrador beta para mostrar marcas, juegos y experiencias en fase de pruebas."
        (unlocked)="onDevelopModePinUnlocked()"
        (cancelled)="pendingDevelopModeUnlock.set(false)"
      />
    }

    @if (previewVideo(); as preview) {
      <div
        class="fixed inset-0 z-70 flex items-center justify-center p-4 sm:p-6"
        style="background: rgba(3, 7, 18, 0.78); backdrop-filter: blur(16px);"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="
          'Vista previa: ' + (preview.video.nombre || preview.video.name || 'Video')
        "
        (click)="closeVideoPreview()"
      >
        <div
          class="relative w-full max-w-2xl bg-neutral-900/95 border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-white select-none"
          (click)="$event.stopPropagation()"
        >
          <!-- Header del Modal -->
          <div class="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="size-10 rounded-2xl bg-yellow-400/15 flex items-center justify-center text-yellow-400 shrink-0 border border-yellow-400/30"
              >
                <app-hero-icon name="play-circle" class="text-2xl text-yellow-400" />
              </div>
              <div class="min-w-0">
                <h3
                  class="text-base sm:text-lg font-extrabold text-white truncate font-['Montserrat']"
                >
                  {{ preview.video.nombre || preview.video.name || 'Vista previa de video' }}
                </h3>
                <p class="text-xs text-neutral-400 font-mono truncate">
                  {{ preview.brandName ? 'Marca: ' + preview.brandName + ' · ' : 'Institucional · '
                  }}{{ preview.video.source }}
                </p>
              </div>
            </div>

            <!-- Botón Cerrar X -->
            <button
              type="button"
              uiSfx="click"
              (click)="closeVideoPreview()"
              class="size-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-neutral-300 hover:text-white transition-all shrink-0 cursor-pointer"
              aria-label="Cerrar vista previa"
            >
              <app-hero-icon name="x-mark" class="text-xl" />
            </button>
          </div>

          <!-- Video Player -->
          <div
            class="relative w-full aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-white/10 shadow-inner"
          >
            <video
              [src]="preview.video.source"
              controls
              autoplay
              playsinline
              class="w-full h-full object-contain"
            >
              Tu navegador no soporta la reproducción de video HTML5.
            </video>
          </div>

          <!-- Footer con Estado y Acciones para tomar decisión -->
          <div
            class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-white/10"
          >
            <div class="flex items-center gap-2.5 self-start sm:self-center">
              <span class="text-xs text-neutral-300 font-medium">Estado en protector:</span>
              @if (isPreviewVideoEnabled()) {
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                >
                  <app-hero-icon name="check" class="text-xs" />
                  Habilitado
                </span>
              } @else {
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40"
                >
                  <app-hero-icon name="x-mark" class="text-xs" />
                  Deshabilitado
                </span>
              }
            </div>

            <div class="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                uiSfx="select"
                (click)="togglePreviewVideo()"
                class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                [class]="
                  isPreviewVideoEnabled()
                    ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40'
                "
              >
                <app-hero-icon
                  [name]="isPreviewVideoEnabled() ? 'x-mark' : 'check'"
                  class="text-sm"
                />
                <span>{{
                  isPreviewVideoEnabled() ? 'Deshabilitar video' : 'Habilitar video'
                }}</span>
              </button>

              <button
                type="button"
                uiSfx="click"
                (click)="closeVideoPreview()"
                class="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95 border border-white/10 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
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
  private readonly contentPack = inject(ContentPack);
  private readonly mediaPlayer = inject(MediaPlayer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly superadminAuth = inject(SuperadminAuthService);

  protected readonly activeSection = signal<AdminSection | null>(null);
  protected readonly settingsView = signal<SettingsView>('menu');
  protected readonly selectedGame = signal<'memory' | 'triqui' | null>(null);
  protected readonly selectedBrand = signal<Brand | null>(null);
  protected readonly pendingDevelopModeUnlock = signal(false);

  protected readonly menuOptions = MENU_OPTIONS;
  protected readonly memoryPairOptions = MEMORY_PAIR_OPTIONS;
  protected readonly triquiDifficultyOptions = TRIQUI_DIFFICULTY_OPTIONS;
  protected readonly triquiFirstOptions = TRIQUI_FIRST_OPTIONS;
  protected readonly triquiSymbolOptions = TRIQUI_SYMBOL_OPTIONS;
  protected readonly pinKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

  /** Marcas habilitadas sin flag beta, ordenadas para el panel. */
  protected readonly activeKioskBrands = computed(() =>
    this.catalog
      .rawManifest()
      .brands.filter((b) => b.enabled && !b.develop)
      .slice()
      .sort((a, b) => a.order - b.order),
  );

  /** Marcas habilitadas en desarrollo/beta. */
  protected readonly betaKioskBrands = computed(() =>
    this.catalog
      .rawManifest()
      .brands.filter((b) => b.enabled && !!b.develop)
      .slice()
      .sort((a, b) => a.order - b.order),
  );

  /** Marcas deshabilitadas (activas o beta; las beta solo en modo desarrollo). */
  protected readonly inactiveKioskBrands = computed(() => {
    const showBeta = this.catalog.developMode();
    return this.catalog
      .rawManifest()
      .brands.filter((b) => !b.enabled && (showBeta || !b.develop))
      .slice()
      .sort((a, b) => a.order - b.order);
  });

  /** Secciones Activas / Beta / Inactivas del árbol de marcas. */
  protected readonly kioskBrandSections = computed(() => {
    const sections: KioskBrandSection[] = [
      {
        id: 'active',
        title: 'Activas',
        titleClass: 'text-emerald-300',
        dotClass: 'bg-emerald-400',
        emptyLabel: 'No hay marcas activas.',
        reorderable: true,
        brands: this.activeKioskBrands(),
      },
    ];

    if (this.catalog.developMode()) {
      sections.push({
        id: 'beta',
        title: 'Beta',
        titleClass: 'text-amber-300',
        dotClass: 'bg-amber-400',
        emptyLabel: 'No hay marcas beta activas.',
        reorderable: true,
        brands: this.betaKioskBrands(),
      });
    }

    sections.push({
      id: 'inactive',
      title: 'Inactivas',
      titleClass: 'text-rose-300',
      dotClass: 'bg-rose-400',
      emptyLabel: 'No hay marcas inactivas.',
      reorderable: false,
      brands: this.inactiveKioskBrands(),
    });

    return sections;
  });

  protected readonly snapshot = this.updates.snapshot;
  protected readonly confirmKind = signal<ConfirmKind>(null);
  protected readonly opMessage = signal('');
  protected readonly pinField = signal<PinField>('current');
  protected readonly pinMessage = signal('');
  protected readonly pinError = signal(false);
  protected readonly viewport = signal({ width: 0, height: 0 });

  protected readonly pinModel = signal<{
    current: string;
    next: string;
    confirm: string;
    hint?: string;
  }>({ current: '', next: '', confirm: '', hint: '' });
  protected readonly showPinDigits = signal<Record<PinField, boolean>>({
    current: false,
    next: false,
    confirm: false,
  });

  protected readonly isPinFieldFull = computed(() => {
    const field = this.pinField();
    const current = this.pinModel();
    const val = current[field] ?? '';
    return val.length >= 10;
  });

  protected readonly canSavePin = computed(() => {
    const { current, next, confirm } = this.pinModel();
    return (current?.length ?? 0) >= 4 && (next?.length ?? 0) >= 4 && (confirm?.length ?? 0) >= 4;
  });

  protected readonly isNative = computed(() => this.platform.isNative);
  protected readonly isKiosk = computed(() => this.platform.isKiosk());
  protected readonly updateBusy = computed(() => {
    const status = this.snapshot().status;
    return status === 'checking' || status === 'downloading' || status === 'installing';
  });
  protected readonly visibleDiff = computed(() =>
    (this.snapshot().catalogDiff?.items ?? []).filter((item) => item.kind !== 'unchanged'),
  );

  protected pendingHasVideoFiles(): boolean {
    return pendingHasVideos(this.snapshot().pendingAssets ?? []);
  }

  // ─── Toast Reactivo ──────────────────────────────────────────────────────────
  protected readonly toast = signal<{ title: string; message: string; exiting?: boolean } | null>(
    null,
  );
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private toastExitTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Vista Previa de Video ──────────────────────────────────────────────────
  protected readonly previewVideo = signal<{
    video: AttractionVideo;
    brandId?: string;
    brandName?: string;
  } | null>(null);

  /** Metadatos (peso/duración) de videos de atracción indexados por `source`. */
  private readonly videoMetaBySource = signal<Record<string, VideoFileMeta | 'loading' | 'error'>>(
    {},
  );
  private readonly videoMetaProbing = new Set<string>();

  private readonly attractionVideoSources = computed(() => {
    const sources = new Set<string>();
    for (const v of this.generalVideos()) {
      if (v.source) sources.add(v.source);
    }
    for (const brand of this.catalog.rawManifest().brands) {
      for (const v of this.getBrandVideos(brand)) {
        if (v.source) sources.add(v.source);
      }
    }
    return [...sources];
  });

  constructor() {
    this.refreshViewport();
    this.pinModel.set({
      current: '',
      next: '',
      confirm: '',
      hint: this.session.getPinHint?.() ?? '',
    });
    const onResize = () => this.refreshViewport();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
    }
    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      if (this.toastExitTimer) clearTimeout(this.toastExitTimer);
      if (this.previewVideo()) {
        this.mediaPlayer.resumeBgm();
      }
      this.session.logout();
    });

    effect(() => {
      const sources = this.attractionVideoSources();
      untracked(() => {
        for (const source of sources) {
          this.ensureVideoMeta(source);
        }
      });
    });
  }

  protected videoMetaLabel(source: string): string {
    const entry = this.videoMetaBySource()[source];
    if (!entry || entry === 'loading') return 'Consultando…';
    if (entry === 'error') return 'Metadatos no disponibles';
    return formatVideoMetaLabel(entry);
  }

  private ensureVideoMeta(source: string): void {
    if (!source || this.videoMetaProbing.has(source)) return;
    const current = this.videoMetaBySource()[source];
    if (current && current !== 'loading') return;
    if (current === 'loading') return;

    this.videoMetaProbing.add(source);
    this.videoMetaBySource.update((map) => ({ ...map, [source]: 'loading' }));

    void probeVideoFileMeta(source)
      .then((meta) => {
        this.videoMetaBySource.update((map) => ({ ...map, [source]: meta }));
      })
      .catch(() => {
        this.videoMetaBySource.update((map) => ({ ...map, [source]: 'error' }));
      })
      .finally(() => {
        this.videoMetaProbing.delete(source);
      });
  }

  protected showToast(title: string, message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.toastExitTimer) clearTimeout(this.toastExitTimer);

    // Entrada animada (300 ms) + permanencia de 3800 ms = 4100 ms total antes de iniciar la salida
    this.toast.set({ title, message, exiting: false });

    this.toastTimer = setTimeout(() => {
      this.toast.update((curr) => (curr ? { ...curr, exiting: true } : null));

      // Salida animada (300 ms) antes de desmontar del DOM
      this.toastExitTimer = setTimeout(() => {
        this.toast.set(null);
        this.toastTimer = null;
        this.toastExitTimer = null;
      }, 300);
    }, 4100);
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

  protected openSettingsGames(): void {
    this.selectedGame.set(null);
    this.selectedBrand.set(null);
    this.settingsView.set('games');
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

  protected onKioskBrandDrop(event: CdkDragDrop<Brand[]>, group: 'active' | 'beta'): void {
    if (event.previousIndex === event.currentIndex) return;
    const source = group === 'active' ? this.activeKioskBrands() : this.betaKioskBrands();
    if (source.length < 2) return;
    const next = source.slice();
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.catalog.reorderBrands(next.map((b) => b.id));
    this.showToast(
      group === 'active' ? 'Marcas activas' : 'Marcas beta',
      'Orden actualizado en el selector del paciente',
    );
  }

  protected experienceLabel(exp: GameExperience): string {
    const name = exp.name || exp.title;
    if (name) return this.cleanText(name);
    if (exp.gameId === 'memory') return 'Memoria';
    if (exp.gameId === 'triqui') return 'Triqui';
    return exp.gameId;
  }

  /** Nombre legible de un motor para el listado de Diagnóstico. */
  protected diagnosticGameName(game: Game): string {
    if (game.name) return this.cleanText(game.name);
    if (game.id === 'memory') return 'Memoria';
    if (game.id === 'triqui') return 'Triqui';
    return game.id;
  }

  /**
   * Estado visible en Diagnóstico según enabled, beta y modo desarrollo.
   * Beta con developMode off → Oculta/Oculto (no aparece en el kiosco).
   */
  protected diagnosticVisibility(
    enabled: boolean,
    isBeta: boolean,
    gender: 'f' | 'm',
  ): { label: string; className: string } {
    if (!enabled) {
      return {
        label: 'Off',
        className: 'bg-rose-500/15 border-rose-400/30 text-rose-300',
      };
    }
    if (isBeta && !this.catalog.developMode()) {
      return {
        label: gender === 'm' ? 'Oculto' : 'Oculta',
        className: 'bg-neutral-500/20 border-neutral-400/35 text-neutral-300',
      };
    }
    return {
      label: gender === 'm' ? 'Activo' : 'Activa',
      className: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
    };
  }

  /** Experiencias de una marca agrupadas en Activas / Beta / Inactivas. */
  protected experienceSectionsForBrand(brandId: string): ExperienceGroupSection[] {
    const showBeta = this.catalog.developMode();
    const all = this.catalog
      .rawManifest()
      .experiences.filter((e) => e.brandId === brandId && (showBeta || !e.develop))
      .slice()
      .sort((a, b) => a.order - b.order);

    const active = all.filter((e) => e.enabled && !e.develop);
    const beta = all.filter((e) => e.enabled && !!e.develop);
    const inactive = all.filter((e) => !e.enabled);

    const sections: ExperienceGroupSection[] = [
      {
        id: 'active',
        title: 'Activas',
        titleClass: 'text-emerald-300/90',
        reorderable: true,
        items: active,
      },
    ];

    if (showBeta) {
      sections.push({
        id: 'beta',
        title: 'Beta',
        titleClass: 'text-amber-300/90',
        reorderable: true,
        items: beta,
      });
    }

    sections.push({
      id: 'inactive',
      title: 'Inactivas',
      titleClass: 'text-rose-300/80',
      reorderable: false,
      items: inactive,
    });

    return sections;
  }

  protected onKioskExperienceDrop(
    event: CdkDragDrop<GameExperience[]>,
    brandId: string,
    sectionId: CatalogGroupId,
  ): void {
    if (event.previousIndex === event.currentIndex) return;
    const section = this.experienceSectionsForBrand(brandId).find((s) => s.id === sectionId);
    if (!section || section.items.length < 2 || !section.reorderable) return;
    const next = section.items.slice();
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.catalog.reorderExperiences(next.map((e) => e.id));
    this.showToast('Experiencias', 'Orden actualizado en el selector de juegos');
  }

  protected toggleBrandById(brandId: string): void {
    const brand = this.catalog.rawManifest().brands.find((b) => b.id === brandId);
    if (!brand) return;
    this.toggleBrand(brand);
  }

  protected generalVideos(): AttractionVideo[] {
    return this.catalog.rawManifest()?.app?.protector?.attractionVideos ?? [];
  }

  protected getBrandVideos(brand: Brand): AttractionVideo[] {
    if (brand.attractionVideos && brand.attractionVideos.length > 0) {
      return brand.attractionVideos;
    }
    if (brand.attractionVideo) {
      return [
        {
          nombre: this.cleanText(brand.name),
          source: brand.attractionVideo,
          enabled: true,
        },
      ];
    }
    return [];
  }

  protected activeVideosCount(): number {
    let count = 0;
    for (const v of this.generalVideos()) {
      if (v.enabled !== false) count++;
    }
    for (const b of this.catalog.rawManifest().brands) {
      if (!b.enabled) continue;
      for (const v of this.getBrandVideos(b)) {
        if (v.enabled !== false) count++;
      }
    }
    return count;
  }

  protected totalVideosCount(): number {
    let count = this.generalVideos().length;
    for (const b of this.catalog.rawManifest().brands) {
      count += this.getBrandVideos(b).length;
    }
    return count;
  }

  protected toggleGeneralVideo(video: AttractionVideo): void {
    const nextState = !video.enabled;
    this.catalog.setGeneralVideoEnabled(video.source, nextState);
    const name = video.nombre || video.name || 'Video General';
    this.showToast(name, nextState ? 'Video activado' : 'Video desactivado');
  }

  protected toggleBrandVideo(brandId: string, video: AttractionVideo): void {
    const nextState = !video.enabled;
    this.catalog.setBrandVideoEnabled(brandId, video.source, nextState);
    const name = video.nombre || video.name || 'Video';
    this.showToast(name, nextState ? 'Video activado' : 'Video desactivado');
  }

  protected openVideoPreview(video: AttractionVideo, brand?: Brand): void {
    this.mediaPlayer.pauseBgm();
    this.previewVideo.set({
      video,
      brandId: brand?.id,
      brandName: brand ? this.cleanText(brand.name) : undefined,
    });
  }

  protected closeVideoPreview(): void {
    if (this.previewVideo()) {
      this.previewVideo.set(null);
      this.mediaPlayer.resumeBgm();
    }
  }

  protected isPreviewVideoEnabled(): boolean {
    const current = this.previewVideo();
    if (!current) return false;
    if (current.brandId) {
      const brand = this.catalog.rawManifest().brands.find((b) => b.id === current.brandId);
      const v = brand?.attractionVideos?.find((item) => item.source === current.video.source);
      return v ? v.enabled !== false : current.video.enabled !== false;
    }
    const v = this.catalog
      .rawManifest()
      .app?.protector?.attractionVideos?.find((item) => item.source === current.video.source);
    return v ? v.enabled !== false : current.video.enabled !== false;
  }

  protected togglePreviewVideo(): void {
    const current = this.previewVideo();
    if (!current) return;
    if (current.brandId) {
      const brand = this.catalog.rawManifest().brands.find((b) => b.id === current.brandId);
      const v =
        brand?.attractionVideos?.find((item) => item.source === current.video.source) ??
        current.video;
      this.toggleBrandVideo(current.brandId, v);
    } else {
      const v =
        this.catalog
          .rawManifest()
          .app?.protector?.attractionVideos?.find((item) => item.source === current.video.source) ??
        current.video;
      this.toggleGeneralVideo(v);
    }
  }

  protected onBack(): void {
    if (this.activeSection() === 'settings') {
      if (this.settingsView() === 'experience') {
        this.settingsView.set('brands');
        this.selectedBrand.set(null);
        return;
      }
      if (this.settingsView() === 'brands') {
        this.settingsView.set('games');
        this.selectedBrand.set(null);
        return;
      }
      if (this.settingsView() === 'games') {
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
      if (view === 'brands-global') return 'Marcas y Experiencias';
      if (view === 'games') return 'Juegos';
      if (view === 'brands') {
        return this.selectedGameSettingsTitle();
      }
      if (view === 'experience') {
        const g = this.selectedGameSettingsTitle();
        const b = this.cleanText(this.selectedBrand()?.name ?? '');
        return b ? `${g} · ${b}` : g;
      }
      return 'Ajustes de Juego';
    }
    return sec ? this.sectionTitle(sec) : 'Administración';
  }

  protected selectedGameSettingsTitle(): string {
    return this.selectedGame() === 'memory'
      ? 'Encuentra la Pareja (Memoria)'
      : 'Triqui (Tres en Raya)';
  }

  protected selectedGameSettingsDescription(): string {
    return this.selectedGame() === 'memory'
      ? 'Parejas, dificultad y vidas'
      : 'Dificultad, primer jugador y figura';
  }

  protected currentHeaderIcon(): HeroIconName {
    const sec = this.activeSection();
    if (sec === 'settings') {
      const view = this.settingsView();
      if (view === 'general') return 'adjustments-horizontal';
      if (view === 'brands-global') return 'swatch';
      if (view === 'games') return 'rocket-launch';
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
    let out = '';
    let insideTag = false;
    for (const ch of text) {
      if (ch === '<') {
        insideTag = true;
        continue;
      }
      if (ch === '>') {
        insideTag = false;
        continue;
      }
      if (!insideTag) out += ch;
    }
    return out.trim();
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
    return this.catalog
      .rawManifest()
      .experiences.find((e) => e.brandId === brandId && e.gameId === gameId);
  }

  /** Marcas que tienen experiencia del juego seleccionado (modo individual). */
  protected brandsWithExperienceForGame(gameId: string): Brand[] {
    const showBeta = this.catalog.developMode();
    const brandIds = new Set(
      this.catalog
        .rawManifest()
        .experiences.filter((e) => e.gameId === gameId && (showBeta || !e.develop))
        .map((e) => e.brandId),
    );
    return this.catalog
      .rawManifest()
      .brands.filter((brand) => brandIds.has(brand.id) && (showBeta || !brand.develop));
  }

  protected onDevelopModeToggle(): void {
    if (this.catalog.developMode()) {
      this.catalog.setDevelopMode(false);
      this.superadminAuth.lock();
      this.showToast('Modo desarrollo', 'Desactivado. El contenido beta queda oculto.');
      return;
    }
    this.pendingDevelopModeUnlock.set(true);
  }

  protected onDevelopModePinUnlocked(): void {
    this.pendingDevelopModeUnlock.set(false);
    this.catalog.setDevelopMode(true);
    this.showToast('Modo desarrollo', 'Activado. Marcas y experiencias beta visibles.');
  }

  /** Resumen etiquetado de la config efectiva para el listado de marcas (modo individual). */
  protected brandGameConfigSummary(brandId: string, gameId: string): string {
    const exp = this.getExperienceForBrandGame(brandId, gameId);
    if (!exp) {
      return 'Sin experiencia en el catálogo';
    }

    if (gameId === 'memory') {
      const config = this.getEffectiveMemoryConfig(exp);
      return `Parejas: ${config.pairs} · Dificultad: ${this.memoryDifficultyLabel(config.difficulty)} · Vidas: ${config.lives}`;
    }

    const diff =
      this.settings.getExperienceTriquiDifficulty(exp.id) ?? this.getDefaultTriquiDifficulty(exp);
    const first =
      this.settings.getExperienceTriquiFirstPlayer(exp.id) ?? this.getDefaultTriquiFirstPlayer(exp);
    const symbol =
      this.settings.getExperienceTriquiPlayerSymbol(exp.id) ??
      this.getDefaultTriquiPlayerSymbol(exp);
    return `Dificultad: ${this.difficultyLabel(diff)} · Inicia: ${this.firstPlayerLabel(first)} · Figura: ${this.playerSymbolLabel(symbol)}`;
  }

  protected getExperiencesForSelectedGame(): GameExperience[] {
    const gameId = this.selectedGame();
    if (!gameId) return [];
    return this.catalog.rawManifest().experiences.filter((e) => e.gameId === gameId);
  }

  protected getGlobalRepresentativeExperience(): GameExperience | undefined {
    return this.getExperiencesForSelectedGame()[0];
  }

  protected requestExperiencesMode(mode: 'global' | 'individual'): void {
    const current = this.catalog.experiencesMode();
    if (mode === current) return;
    if (mode === 'global') {
      this.askConfirm('switchToGlobal');
      return;
    }
    this.catalog.setExperiencesMode('individual');
    this.showToast('Modo individual', 'Cada marca vuelve a configurar sus reglas por separado.');
  }

  protected applySwitchToGlobalMode(): void {
    const gameId = this.selectedGame();
    if (!gameId) return;
    this.settings.clearExperienceOverridesForGame(gameId);
    this.catalog.resetGameExperiencesToDefault(gameId);
    this.catalog.setExperiencesMode('global');
    const gameTitle = gameId === 'memory' ? 'Memoria' : 'Triqui';
    this.showToast(
      `${gameTitle} · Modo global`,
      'Configuración por marca restablecida al catálogo. Los ajustes de partida serán compartidos.',
    );
  }

  protected getGlobalMemoryConfig(): MemoryConfig & { isCustomOverride: boolean } {
    const exps = this.getExperiencesForSelectedGame();
    const first = exps[0];
    if (!first) {
      return { pairs: 3, lives: 3, difficulty: 'medium', isCustomOverride: false };
    }
    const resolved = this.getEffectiveMemoryConfig(first);
    const isCustomOverride = exps.some(
      (exp) => this.settings.getExperienceMemoryConfig(exp.id) !== null,
    );
    return { ...resolved, isCustomOverride };
  }

  protected applyGlobalMemoryConfig(config: {
    pairs: number;
    lives: number;
    difficulty: MemoryDifficulty;
  }): void {
    for (const exp of this.getExperiencesForSelectedGame()) {
      this.settings.setExperienceMemoryConfig(exp.id, config);
    }
  }

  protected changeGlobalMemoryPairsStep(delta: number): void {
    const current = this.getGlobalMemoryConfig();
    const nextPairs = Math.max(MEMORY_PAIRS_MIN, Math.min(MEMORY_PAIRS_MAX, current.pairs + delta));
    if (nextPairs === current.pairs) return;
    let nextLives = current.lives;
    if (current.difficulty !== 'custom') {
      nextLives = getRecommendedLives(nextPairs, current.difficulty);
    }
    this.applyGlobalMemoryConfig({
      pairs: nextPairs,
      lives: nextLives,
      difficulty: current.difficulty,
    });
    this.showToast('Memoria · Global', `${nextPairs} parejas (${nextLives} vidas)`);
  }

  protected changeGlobalMemoryLivesStep(delta: number): void {
    const current = this.getGlobalMemoryConfig();
    const nextLives = Math.max(MEMORY_LIVES_MIN, current.lives + delta);
    if (nextLives === current.lives) return;
    this.applyGlobalMemoryConfig({
      pairs: current.pairs,
      lives: nextLives,
      difficulty: 'custom',
    });
    this.showToast('Memoria · Global', `${nextLives} vidas (Personalizada)`);
  }

  protected selectGlobalMemoryDifficulty(difficulty: MemoryDifficulty): void {
    const current = this.getGlobalMemoryConfig();
    const recommendedLives = getRecommendedLives(current.pairs, difficulty);
    this.applyGlobalMemoryConfig({
      pairs: current.pairs,
      lives: recommendedLives,
      difficulty,
    });
    this.showToast(
      'Memoria · Global',
      `Dificultad ${this.memoryDifficultyLabel(difficulty)} (${recommendedLives} vidas)`,
    );
  }

  protected resetGlobalMemoryToDefault(): void {
    for (const exp of this.getExperiencesForSelectedGame()) {
      this.settings.setExperienceMemoryConfig(exp.id, null);
    }
    this.showToast('Memoria · Global', 'Restaurado a la configuración del catálogo');
  }

  protected getGlobalTriquiDifficulty(): Difficulty | null {
    const first = this.getGlobalRepresentativeExperience();
    return first ? this.settings.getExperienceTriquiDifficulty(first.id) : null;
  }

  protected getGlobalTriquiFirstPlayer(): FirstPlayer | null {
    const first = this.getGlobalRepresentativeExperience();
    return first ? this.settings.getExperienceTriquiFirstPlayer(first.id) : null;
  }

  protected getGlobalTriquiPlayerSymbol(): PlayerSymbolChoice | null {
    const first = this.getGlobalRepresentativeExperience();
    return first ? this.settings.getExperienceTriquiPlayerSymbol(first.id) : null;
  }

  protected changeGlobalTriquiDifficulty(diff: Difficulty | null, defaultDiff: Difficulty): void {
    for (const exp of this.getExperiencesForSelectedGame()) {
      this.settings.setExperienceTriquiDifficulty(exp.id, diff);
    }
    if (diff === null) {
      this.showToast(
        'Triqui · Global',
        `Opción por defecto (${this.difficultyLabel(defaultDiff)})`,
      );
    } else {
      this.showToast('Triqui · Global', `Dificultad: ${this.difficultyLabel(diff)}`);
    }
  }

  protected changeGlobalTriquiFirstPlayer(
    player: FirstPlayer | null,
    defaultFirst: FirstPlayer,
  ): void {
    for (const exp of this.getExperiencesForSelectedGame()) {
      this.settings.setExperienceTriquiFirstPlayer(exp.id, player);
    }
    if (player === null) {
      this.showToast(
        'Triqui · Global',
        `Opción por defecto (${this.firstPlayerLabel(defaultFirst)})`,
      );
    } else {
      this.showToast('Triqui · Global', `Primer jugador: ${this.firstPlayerLabel(player)}`);
    }
  }

  protected changeGlobalTriquiPlayerSymbol(
    symbol: PlayerSymbolChoice | null,
    defaultSymbol: PlayerSymbolChoice,
  ): void {
    for (const exp of this.getExperiencesForSelectedGame()) {
      this.settings.setExperienceTriquiPlayerSymbol(exp.id, symbol);
    }
    if (symbol === null) {
      this.showToast(
        'Triqui · Global',
        `Opción por defecto (${this.playerSymbolLabel(defaultSymbol)})`,
      );
    } else {
      this.showToast('Triqui · Global', `Figura: ${this.playerSymbolLabel(symbol)}`);
    }
  }

  protected resetGlobalTriquiToDefault(): void {
    for (const exp of this.getExperiencesForSelectedGame()) {
      this.settings.setExperienceTriquiDifficulty(exp.id, null);
      this.settings.setExperienceTriquiFirstPlayer(exp.id, null);
      this.settings.setExperienceTriquiPlayerSymbol(exp.id, null);
    }
    this.showToast('Triqui · Global', 'Restaurados valores por defecto del catálogo');
  }

  protected resetGlobalGameToDefault(): void {
    const gameId = this.selectedGame();
    if (!gameId) return;
    this.catalog.resetGameExperiencesToDefault(gameId);
    if (gameId === 'memory') {
      for (const exp of this.getExperiencesForSelectedGame()) {
        this.settings.setExperienceMemoryConfig(exp.id, null);
      }
    } else {
      for (const exp of this.getExperiencesForSelectedGame()) {
        this.settings.setExperienceTriquiDifficulty(exp.id, null);
        this.settings.setExperienceTriquiFirstPlayer(exp.id, null);
        this.settings.setExperienceTriquiPlayerSymbol(exp.id, null);
      }
    }
    const gameTitle = gameId === 'memory' ? 'Memoria' : 'Triqui';
    this.showToast(`${gameTitle} · Global`, 'Valores de juego restaurados por defecto');
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
        return 'Jugador';
      case 'alternate':
        return 'Alternado';
      case 'random':
        return 'Azar';
      default:
        return 'Jugador';
    }
  }

  protected playerSymbolLabel(symbol: PlayerSymbolChoice | null): string {
    if (symbol === 'random') {
      return 'Aleatorio';
    }
    return symbol === 'O' ? '○' : '✕';
  }

  protected getExperienceMarkAsset(exp: GameExperience, symbol: PlayerSymbolChoice): string {
    if (symbol === 'random') {
      return '';
    }
    const assetKey = symbol === 'X' ? 'markX' : 'markO';
    const expAsset = exp.assets?.[assetKey];
    if (typeof expAsset === 'string' && expAsset.length > 0) {
      return expAsset;
    }
    const gameAsset = this.catalog.getGameById('triqui')?.assets?.[assetKey];
    if (typeof gameAsset === 'string' && gameAsset.length > 0) {
      return gameAsset;
    }
    return '';
  }

  protected getDefaultTriquiDifficulty(exp: GameExperience): Difficulty {
    return resolveTriquiDifficulty({
      kioskOverride: null,
      experienceConfig: exp.config,
      gameConfig: this.catalog.getGameById('triqui')?.config,
    }).difficulty;
  }

  protected getDefaultTriquiFirstPlayer(exp: GameExperience): FirstPlayer {
    return resolveTriquiFirstPlayer({
      kioskOverride: null,
      experienceConfig: exp.config,
      gameConfig: this.catalog.getGameById('triqui')?.config,
    }).firstPlayer;
  }

  protected getDefaultTriquiPlayerSymbol(exp: GameExperience): PlayerSymbolChoice {
    return resolveTriquiPlayerSymbol({
      kioskOverride: null,
      experienceConfig: exp.config,
      gameConfig: this.catalog.getGameById('triqui')?.config,
    }).playerSymbol;
  }

  // ─── Setters de Ajustes con Toast ──────────────────────────────────────────

  protected getEffectiveMemoryConfig(
    exp: GameExperience,
  ): MemoryConfig & { isCustomOverride: boolean } {
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

  protected selectMemoryDifficulty(
    exp: GameExperience,
    difficulty: MemoryDifficulty,
    brandName: string,
  ): void {
    const current = this.getEffectiveMemoryConfig(exp);
    const recommendedLives = getRecommendedLives(current.pairs, difficulty);

    this.settings.setExperienceMemoryConfig(exp.id, {
      pairs: current.pairs,
      lives: recommendedLives,
      difficulty,
    });

    const cleanBrand = this.cleanText(brandName);
    this.showToast(
      `Memoria · ${cleanBrand}`,
      `Dificultad ${this.memoryDifficultyLabel(difficulty)} (${recommendedLives} vidas)`,
    );
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
      this.showToast(
        `Triqui · ${cleanBrand}`,
        `Opción por defecto (${this.difficultyLabel(defaultDiff)})`,
      );
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
      this.showToast(
        `Triqui · ${cleanBrand}`,
        `Opción por defecto (${this.firstPlayerLabel(defaultFirst)})`,
      );
    } else {
      this.showToast(`Triqui · ${cleanBrand}`, `Primer jugador: ${this.firstPlayerLabel(player)}`);
    }
  }

  protected changeExperienceTriquiPlayerSymbol(
    experienceId: string,
    symbol: PlayerSymbolChoice | null,
    brandName: string,
    defaultSymbol: PlayerSymbolChoice,
  ): void {
    this.settings.setExperienceTriquiPlayerSymbol(experienceId, symbol);
    const cleanBrand = this.cleanText(brandName);
    if (symbol === null) {
      this.showToast(
        `Triqui · ${cleanBrand}`,
        `Opción por defecto (${this.playerSymbolLabel(defaultSymbol)})`,
      );
    } else {
      this.showToast(`Triqui · ${cleanBrand}`, `Figura: ${this.playerSymbolLabel(symbol)}`);
    }
  }

  protected resetExperienceTriquiToDefault(experienceId: string, brandName: string): void {
    this.settings.setExperienceTriquiDifficulty(experienceId, null);
    this.settings.setExperienceTriquiFirstPlayer(experienceId, null);
    this.settings.setExperienceTriquiPlayerSymbol(experienceId, null);
    const cleanBrand = this.cleanText(brandName);
    this.showToast(`Triqui · ${cleanBrand}`, 'Restaurados valores por defecto del catálogo');
  }

  protected resetAudioSettings(): void {
    this.settings.resetAudioToDefault();
    this.showToast('Audio General', 'Valores de audio restaurados por defecto');
  }

  protected resetScreensaverSettings(): void {
    this.settings.resetScreensaverToDefault();
    this.catalog.resetVideosToDefault();
    this.showToast('Protector de Pantalla', 'Valores del protector restaurados por defecto');
  }

  protected resetGeneralSettings(): void {
    this.settings.resetGeneralToDefault();
    this.catalog.resetVideosToDefault();
    this.showToast('Ajustes Generales', 'Valores de ajustes generales restaurados por defecto');
  }

  protected resetBrandsSettings(): void {
    this.catalog.resetBrandsToDefault();
    this.showToast('Marcas y Experiencias', 'Valores de marcas y juegos restaurados por defecto');
  }

  protected resetCurrentGameExperienceToDefault(exp: GameExperience, brandName: string): void {
    if (!exp.enabled) {
      this.catalog.setExperienceEnabled(exp.id, true);
    }
    if (exp.gameId === 'memory') {
      this.settings.setExperienceMemoryConfig(exp.id, null);
    } else if (exp.gameId === 'triqui') {
      this.settings.setExperienceTriquiDifficulty(exp.id, null);
      this.settings.setExperienceTriquiFirstPlayer(exp.id, null);
      this.settings.setExperienceTriquiPlayerSymbol(exp.id, null);
    }
    const cleanBrand = this.cleanText(brandName);
    const gameTitle = exp.gameId === 'memory' ? 'Memoria' : 'Triqui';
    this.showToast(`${gameTitle} · ${cleanBrand}`, 'Valores de juego restaurados por defecto');
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
        return 'Fácil: La IA comete fallos intencionales y no bloquea oportunidades de victoria del jugador.';
      case 'medium':
        return 'Medio: La IA bloquea jugadas evidentes pero permite oportunidades de ganar.';
      case 'hard':
        return 'Difícil: La IA calcula movimientos óptimos con Minimax (difícil de vencer).';
    }
  }

  protected triquiFirstPlayerExplanation(
    player: FirstPlayer | null,
    defaultFirst: FirstPlayer,
  ): string {
    if (player === null) {
      return `Opción por defecto: Respeta la regla de primer jugador del catálogo (${this.firstPlayerLabel(defaultFirst)}).`;
    }
    switch (player) {
      case 'patient':
        return 'Jugador: El jugador siempre realiza la primera jugada al iniciar la dinámica.';
      case 'alternate':
        return 'Alternado: El primer turno rota entre el jugador y la IA en cada nueva partida.';
      case 'random':
        return 'Azar: Un sorteo aleatorio decide quién empieza cada partida.';
    }
  }

  protected triquiPlayerSymbolExplanation(
    symbol: PlayerSymbolChoice | null,
    defaultSymbol: PlayerSymbolChoice,
  ): string {
    if (symbol === null) {
      return `Opción por defecto: Respeta la figura del jugador definida en el catálogo (${this.playerSymbolLabel(defaultSymbol)}).`;
    }
    if (symbol === 'random') {
      return 'Aleatorio: En cada ronda se sortea al azar si juegas con ✕ o con ○.';
    }
    return symbol === 'O'
      ? 'Marca ○: El jugador utiliza la marca ○ y la inteligencia artificial juega con la marca ✕.'
      : 'Marca ✕: El jugador utiliza la marca ✕ y la inteligencia artificial juega con la marca ○.';
  }

  protected changeScreensaver(mode: ScreensaverMode): void {
    this.settings.setScreensaverMode(mode);
    this.showToast('Protector', `Modo cambiado a: ${mode === 'classic' ? 'Clásico' : 'Video'}`);
  }

  protected screensaverExplanation(mode: ScreensaverMode): string {
    return mode === 'classic'
      ? 'Clásico: Solo logotipos institucionales y de marcas en movimiento continuo sobre fondo atenuado. Cero videos.'
      : 'Video: Playlist intercalada: al menos 20 s de animación clásica entre cada clip promocional de marcas habilitadas.';
  }

  protected formatIdleTime(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) {
      return `${seconds} s`;
    }
    if (seconds === 0) {
      return minutes === 1 ? '1 minuto' : `${minutes} min`;
    }
    return `${minutes} min ${seconds} s`;
  }

  protected adjustIdleTime(deltaMs: number): void {
    const current = this.settings.screensaverIdleMs();
    const next = current + deltaMs;
    this.settings.setScreensaverIdleMs(next);
    this.showToast(
      'Tiempo Protector',
      `Aparece tras: ${this.formatIdleTime(this.settings.screensaverIdleMs())}`,
    );
  }

  protected changeVideoOrder(order: ScreensaverVideoOrder): void {
    this.settings.setScreensaverVideoOrder(order);
    this.showToast(
      'Orden de Videos',
      order === 'sequential' ? 'Ordenado por catálogo' : 'Aleatorio sin repetición',
    );
  }

  protected videoOrderExplanation(order: ScreensaverVideoOrder): string {
    return order === 'sequential'
      ? 'Ordenado: Reproduce los videos en el orden del catálogo (1, 2, 3...) con ≥ 20 s de animación clásica entre cada clip.'
      : 'Al azar: Baraja la lista evitando repetir el mismo video consecutivamente, siempre con ≥ 20 s de animación clásica entre clips.';
  }

  protected toggleSound(): void {
    const next = !this.settings.soundEnabled();
    this.settings.setSoundEnabled(next);
    this.showToast('Audio General', next ? 'Sonido activado' : 'Audio silenciado');
  }

  protected toggleCoverReduceMotion(): void {
    const next = !this.settings.coverReduceMotion();
    this.settings.setCoverReduceMotion(next);
    this.showToast('Cover Flow', next ? 'Movimiento reducido activado' : 'Cover Flow 3D activado');
  }

  protected toggleAtmosphereMotion(): void {
    const next = !this.settings.atmosphereMotionEnabled();
    this.settings.setAtmosphereMotionEnabled(next);
    this.showToast('Atmósfera', next ? 'Animación activada' : 'Atmósfera estática');
  }

  protected onBgmVolumeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const vol = Number.parseFloat(input.value) / 100;
    this.settings.setBgmVolume(vol);
  }

  protected onBgmVolumeCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.showToast('Volumen BGM', `${input.value}%`);
  }

  protected onSfxVolumeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const vol = Number.parseFloat(input.value) / 100;
    this.settings.setSfxVolume(vol);
  }

  protected onSfxVolumeCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.showToast('Volumen SFX', `${input.value}%`);
    this.testSfx();
  }

  protected onVideoVolumeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const vol = Number.parseFloat(input.value) / 100;
    this.settings.setVideoVolume(vol);
  }

  protected onVideoVolumeCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.showToast('Volumen Video', `${input.value}%`);
  }

  protected testSfx(): void {
    playUiSfx(this.mediaPlayer, 'select');
  }

  protected pendingExperienceToReset = signal<{ exp: GameExperience; brandName: string } | null>(
    null,
  );

  protected askConfirmResetExperience(exp: GameExperience, brandName: string): void {
    this.pendingExperienceToReset.set({ exp, brandName });
    this.askConfirm('resetExperience');
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
        return this.isNative() ? '¿Salir del kiosco?' : '¿Salir de pantalla completa?';
      case 'enterKiosk':
        return this.isNative() ? '¿Entrar al modo kiosco?' : '¿Activar pantalla completa?';
      case 'applyUpdate':
        return '¿Instalar actualizaciones?';
      case 'changePin':
        return '¿Generar nuevo PIN?';
      case 'resetDefaults':
        return '¿Restaurar valores por defecto?';
      case 'resetAudio':
        return '¿Restablecer ajustes de audio?';
      case 'resetScreensaver':
        return '¿Restablecer protector de pantalla?';
      case 'resetGeneral':
        return '¿Restablecer ajustes generales?';
      case 'resetBrands':
        return '¿Restablecer marcas y experiencias?';
      case 'resetExperience':
        return '¿Restablecer valores del juego?';
      case 'switchToGlobal':
        return '¿Activar ajustes globales?';
      case 'resetGlobalGame':
        return '¿Restablecer valores del juego?';
    }
  }

  protected confirmMessage(kind: Exclude<ConfirmKind, null>): string {
    const game = this.selectedGameTitle();
    const messages: Record<Exclude<ConfirmKind, null>, string> = {
      restart: this.nativeOrWeb(
        'La aplicación se reiniciará en este equipo.',
        'La aplicación se recargará y volverá a la pantalla inicial.',
      ),
      exit: 'Se cerrará Merz Games. Habrá que abrirla de nuevo.',
      leaveKiosk: this.nativeOrWeb(
        'Se quita pantalla completa y vuelven las decoraciones de ventana.',
        'Se saldrá del modo de pantalla completa en el navegador.',
      ),
      enterKiosk: this.nativeOrWeb(
        'La ventana pasará a pantalla completa sin bordes ni decoraciones.',
        'La aplicación pasará a modo pantalla completa en el navegador.',
      ),
      applyUpdate: this.applyUpdateConfirmMessage(),
      changePin: `Va a generar un nuevo PIN: "${this.pinModel().next}". ¿Desea confirmar el cambio?`,
      resetDefaults:
        'Se restablecerán marcas, juegos, audio y parámetros a los valores definidos en el catálogo original (content-manifest.json). En escritorio también se vacían los packs OTA descargados; el bundle de la app se conserva.',
      resetAudio:
        'Se restablecerán los niveles de volumen (BGM, SFX) y el estado del sonido a sus valores por defecto.',
      resetScreensaver:
        'Se restablecerá el modo, tiempo de inactividad, orden de videos, activación de clips y volumen del protector de pantalla a sus valores por defecto.',
      resetGeneral:
        'Se restablecerán todos los ajustes de audio, protector de pantalla y activación de clips a sus valores por defecto.',
      resetBrands:
        'Se restablecerán marcas y experiencias (activación y orden) a los valores del catálogo.',
      resetExperience: this.resetExperienceConfirmMessage(),
      switchToGlobal: `Se perderá la configuración individual de ${game} por cada marca. Las reglas de partida y la activación de experiencias volverán a los valores del catálogo (content-manifest.json), y a partir de entonces los ajustes de partida se aplicarán a todas las marcas.`,
      resetGlobalGame: `Se restablecerá la configuración de partida de ${game} y la activación del juego en cada marca a los valores del catálogo.`,
    };
    return messages[kind];
  }

  private selectedGameTitle(): string {
    return this.selectedGame() === 'memory' ? 'Memoria' : 'Triqui';
  }

  private nativeOrWeb(nativeText: string, webText: string): string {
    return this.isNative() ? nativeText : webText;
  }

  private applyUpdateConfirmMessage(): string {
    const pending = this.snapshot().pendingAssets?.length ?? 0;
    const hasVideos = this.pendingHasVideoFiles();
    const appTail = this.snapshot().appUpdateAvailable
      ? ' Después se instala el ejecutable, que puede reiniciar la app.'
      : '';
    if (!this.isNative()) {
      return pending > 0
        ? `Se aplicará el catálogo publicado. Los ${pending} archivo(s) nuevos no se descargan en el navegador.${appTail}`
        : `Se aplicará el catálogo publicado. El anterior se conserva si el nuevo no es válido.${appTail}`;
    }
    if (pending === 0) {
      return this.snapshot().appUpdateAvailable
        ? 'Primero se aplica el catálogo y después el ejecutable, que puede reiniciar la app.'
        : 'Se aplicará el catálogo publicado. El anterior se conserva si el nuevo no es válido.';
    }
    const videoNote = hasVideos ? ' (incluye video; puede tardar)' : '';
    return `Se descargarán ${pending} archivo(s)${videoNote} y luego se aplicará el catálogo. Si algo falla se conserva lo anterior.${appTail}`;
  }

  private resetExperienceConfirmMessage(): string {
    const pending = this.pendingExperienceToReset();
    if (!pending) {
      return 'Se restablecerá la configuración de la partida de este juego a los valores por defecto.';
    }
    const gameTitle = pending.exp.gameId === 'memory' ? 'Memoria' : 'Triqui';
    return `Se restablecerá la configuración de la partida de ${gameTitle} (${this.cleanText(pending.brandName)}) a los valores por defecto.`;
  }

  protected onConfirmCancelled(): void {
    this.confirmKind.set(null);
  }

  protected async onConfirm(): Promise<void> {
    const kind = this.confirmKind();
    this.confirmKind.set(null);
    if (!kind) return;
    await this.runConfirmedAction(kind);
  }

  private async runConfirmedAction(kind: Exclude<ConfirmKind, null>): Promise<void> {
    const actions: Record<Exclude<ConfirmKind, null>, () => void | Promise<void>> = {
      switchToGlobal: () => this.applySwitchToGlobalMode(),
      resetGlobalGame: () => this.resetGlobalGameToDefault(),
      resetDefaults: async () => {
        this.catalog.resetToDefault();
        this.settings.resetToDefault();
        await this.contentPack.clearInstalled();
        this.showToast(
          'Valores restaurados',
          'Ajustes, catálogo y packs OTA restablecidos a fábrica',
        );
      },
      resetAudio: () => this.resetAudioSettings(),
      resetScreensaver: () => this.resetScreensaverSettings(),
      resetGeneral: () => this.resetGeneralSettings(),
      resetBrands: () => this.resetBrandsSettings(),
      resetExperience: () => this.finishResetExperience(),
      changePin: () => this.executePinChange(),
      applyUpdate: () => this.updates.apply(),
      enterKiosk: () =>
        this.applyCommandResult(this.platform.enterKiosk(), {
          error: 'No se pudo activar pantalla completa.',
          success: 'Modo kiosco (pantalla completa) activado.',
        }),
      leaveKiosk: () =>
        this.applyCommandResult(this.platform.leaveKiosk(), {
          error: 'No se pudo salir del modo kiosco.',
          success: 'Modo kiosco desactivado.',
        }),
      restart: () =>
        this.applyCommandResult(this.platform.restart(), { error: 'No se pudo reiniciar.' }),
      exit: () =>
        this.applyCommandResult(this.platform.exit(), {
          error: 'No se pudo cerrar la aplicación.',
        }),
    };
    await actions[kind]();
  }

  private finishResetExperience(): void {
    const pending = this.pendingExperienceToReset();
    if (!pending) return;
    this.resetCurrentGameExperienceToDefault(pending.exp, pending.brandName);
    this.pendingExperienceToReset.set(null);
  }

  private async applyCommandResult(
    op: Promise<KioskCommandResult>,
    copy: { error: string; success?: string },
  ): Promise<void> {
    const result = await op;
    if (!result.ok) {
      this.opMessage.set(result.message ?? copy.error);
      return;
    }
    if (copy.success) this.opMessage.set(copy.success);
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

  protected togglePinVisibility(field: PinField, event?: Event): void {
    if (event) event.stopPropagation();
    const current = this.showPinDigits();
    this.showPinDigits.set({ ...current, [field]: !current[field] });
  }

  protected formatPinDisplay(field: PinField): string {
    const value = this.pinModel()[field] ?? '';
    if (value.length === 0) return '····';
    return this.showPinDigits()[field] ? value : '•'.repeat(value.length);
  }

  protected appendPinDigit(digit: string): void {
    this.pinMessage.set('');
    const field = this.pinField();
    const current = this.pinModel();
    const value = current[field] ?? '';
    if (value.length >= 10) {
      this.pinError.set(true);
      this.pinMessage.set('Límite máximo de 10 dígitos alcanzado.');
      this.mediaPlayer.playSfx('back');
      return;
    }
    this.pinModel.set({ ...current, [field]: value + digit });
  }

  protected pinBackspace(): void {
    this.pinMessage.set('');
    const field = this.pinField();
    const current = this.pinModel();
    this.pinModel.set({ ...current, [field]: current[field].slice(0, -1) });
  }

  protected updatePinHint(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.pinModel.set({ ...this.pinModel(), hint: value });
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
    if (next.length > 10) {
      this.pinError.set(true);
      this.pinMessage.set('El nuevo PIN no debe superar los 10 dígitos.');
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
    const { current, next, hint } = this.pinModel();
    const ok = await this.session.changePin(current, next, hint);
    this.pinError.set(!ok);
    if (ok) {
      this.pinMessage.set('PIN actualizado en este equipo.');
      this.showToast('Seguridad', 'PIN actualizado con éxito');
      this.pinModel.set({
        current: '',
        next: '',
        confirm: '',
        hint: this.session.getPinHint?.() ?? '',
      });
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
