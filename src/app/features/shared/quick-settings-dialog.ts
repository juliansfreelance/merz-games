import { Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroIcon } from './hero-icon';
import { playUiSfx, UI_SFX, UiSfx } from './ui-sfx';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { MediaPlayer } from '../../core/media/media-player';
import { PlatformService } from '../../core/platform/platform.service';

/**
 * QuickSettingsDialog — Diálogo táctil flotante accesible para toda la audiencia
 * (médico acompañante, paciente, operador) sin contraseñas:
 * 1. Ajustes de sonido por sesión (en memoria: se descartan al reiniciar/recargar).
 * 2. Ajustes de operación directos (Kiosco/Restaurar ventana, Reiniciar, Cerrar).
 */
@Component({
  selector: 'app-quick-settings-dialog',
  imports: [CommonModule, HeroIcon, UiSfx],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none"
      style="background: rgba(3, 7, 18, 0.78); backdrop-filter: blur(24px);"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes rápidos de sonido y operación"
      (click)="onBackdropClick($event)"
      (keydown.escape)="close.emit()"
    >
      <div
        class="relative w-full max-w-lg bg-neutral-900/95 border border-white/20 rounded-3xl p-5 sm:p-7 kiosk:p-8 shadow-2xl flex flex-col gap-5 text-white my-auto max-h-[92vh] overflow-y-auto"
        (click)="$event.stopPropagation()"
      >
        <!-- =============================================================== -->
        <!-- ENCABEZADO DEL MODAL                                            -->
        <!-- =============================================================== -->
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
          <div class="flex items-center gap-3">
            <div class="size-11 sm:size-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <app-hero-icon name="cog-8-tooth" class="text-2xl" />
            </div>
            <div>
              <h2 class="text-base sm:text-lg kiosk:text-xl font-extrabold font-['Montserrat'] uppercase tracking-tight text-white">
                Ajustes Rápidos
              </h2>
              <p class="text-neutral-400 text-xs sm:text-sm">
                Audio de sesión y operaciones de la app
              </p>
            </div>
          </div>

          <!-- Botón cerrar (X) -->
          <button
            type="button"
            uiSfx="click"
            class="size-10 sm:size-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer shrink-0"
            aria-label="Cerrar ventana de ajustes"
            (click)="close.emit()"
          >
            <app-hero-icon name="x-mark" class="text-lg sm:text-xl" />
          </button>
        </div>

        <!-- =============================================================== -->
        <!-- SECCIÓN 1: SONIDO DE LA SESIÓN                                  -->
        <!-- =============================================================== -->
        <div class="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4 shadow-inner">
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
            <div class="flex items-center gap-2">
              <app-hero-icon
                [name]="soundEnabled() ? 'speaker-wave' : 'speaker-x-mark'"
                class="text-lg text-yellow-400 shrink-0"
              />
              <span class="font-extrabold uppercase tracking-wider text-xs sm:text-sm text-white">
                Sonido de la Sesión
              </span>
            </div>

            <!-- Interruptor General -->
            <button
              type="button"
              uiSfx="click"
              class="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer select-none"
              [class]="soundEnabled() ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-300' : 'bg-white/10 border-white/20 text-neutral-400'"
              (click)="toggleSound()"
            >
              {{ soundEnabled() ? 'Sonido Activado' : 'Silenciado' }}
            </button>
          </div>

          <!-- Nota de sesión temporal -->
          <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs leading-relaxed">
            <app-hero-icon name="information-circle" class="text-base shrink-0 mt-0.5 text-amber-400" />
            <span>
              Estos ajustes de audio aplican <strong>solo a la sesión activa</strong>. Al recargar o reiniciar la aplicación, volverán a los definidos en el panel de control.
            </span>
          </div>

          <!-- Slider Música de fondo (BGM) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs sm:text-sm">
              <span class="font-bold text-neutral-200 flex items-center gap-2">
                <app-hero-icon name="musical-note" class="text-xs sm:text-sm text-yellow-400" />
                <span>Música de fondo (BGM)</span>
              </span>
              <span class="font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-yellow-400 text-xs">
                {{ Math.round(bgmVolume() * 100) }}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              [value]="Math.round(bgmVolume() * 100)"
              class="w-full h-2.5 rounded-lg bg-white/8 border border-white/15 accent-yellow-400 cursor-pointer touch-manipulation"
              (input)="onBgmInput($event)"
            />
          </div>

          <!-- Slider Efectos de sonido (SFX) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs sm:text-sm">
              <span class="font-bold text-neutral-200 flex items-center gap-2">
                <app-hero-icon name="bell" class="text-xs sm:text-sm text-yellow-400" />
                <span>Efectos de sonido (SFX)</span>
              </span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="text-[11px] font-bold text-neutral-300 hover:text-yellow-400 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  (click)="testSfx()"
                >
                  <app-hero-icon name="play" class="text-xs text-yellow-400" />
                  <span>Probar</span>
                </button>
                <span class="font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-yellow-400 text-xs">
                  {{ Math.round(sfxVolume() * 100) }}%
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              [value]="Math.round(sfxVolume() * 100)"
              class="w-full h-2.5 rounded-lg bg-white/8 border border-white/15 accent-yellow-400 cursor-pointer touch-manipulation"
              (input)="onSfxInput($event)"
            />
          </div>

          <!-- Botón restablecer a panel de control si hay overrides de sesión -->
          @if (hasSessionAudioOverrides()) {
            <div class="pt-1 flex justify-end">
              <button
                type="button"
                uiSfx="click"
                class="text-xs text-neutral-400 hover:text-amber-300 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                (click)="resetSessionAudio()"
              >
                <app-hero-icon name="arrow-path" class="text-xs text-amber-400" />
                <span>Restaurar audio del sistema</span>
              </button>
            </div>
          }
        </div>

        <!-- =============================================================== -->
        <!-- SECCIÓN 2: AJUSTES DE OPERACIÓN                                 -->
        <!-- =============================================================== -->
        <div class="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4 shadow-inner">
          <div class="flex items-center justify-between pb-2 border-b border-white/10">
            <div class="flex items-center gap-2">
              <app-hero-icon name="adjustments-horizontal" class="text-lg text-yellow-400 shrink-0" />
              <span class="font-extrabold uppercase tracking-wider text-xs sm:text-sm text-white">
                Ajustes de Operación
              </span>
            </div>
          </div>

          <!-- Confirmación táctil inline para Reiniciar / Cerrar -->
          @if (confirmAction()) {
            <div class="p-4 rounded-2xl bg-neutral-950/80 border border-amber-400/30 space-y-3 text-center animate-fadeIn">
              <div class="space-y-1">
                <p class="font-bold text-sm sm:text-base text-white">
                  @if (confirmAction() === 'restart') {
                    ¿Deseas reiniciar la aplicación ahora?
                  } @else {
                    ¿Deseas cerrar la aplicación?
                  }
                </p>
                <p class="text-xs text-neutral-400 leading-relaxed">
                  @if (confirmAction() === 'restart') {
                    La aplicación se recargará y volverá a la pantalla inicial.
                  } @else {
                    Se cerrará la aplicación de kiosco en el equipo.
                  }
                </p>
              </div>

              <div class="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  uiSfx="click"
                  class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/15 text-neutral-300 border border-white/15 cursor-pointer active:scale-95 transition-all"
                  (click)="cancelConfirm()"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  uiSfx="click"
                  class="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                  [class]="confirmAction() === 'restart' ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950' : 'bg-rose-600 hover:bg-rose-500 text-white'"
                  (click)="executeConfirmedAction()"
                >
                  <app-hero-icon [name]="confirmAction() === 'restart' ? 'arrow-path' : 'power'" class="text-sm" />
                  <span>
                    {{ confirmAction() === 'restart' ? 'Sí, reiniciar' : 'Sí, cerrar' }}
                  </span>
                </button>
              </div>
            </div>
          } @else {
            <!-- Acciones de Operación principales -->
            <div [class]="isNative() ? 'grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3'">
              <!-- 1. Kiosco / Restaurar ventana -->
              <button
                type="button"
                uiSfx="click"
                class="flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/15 text-center transition-all cursor-pointer group"
                (click)="onToggleKiosk()"
              >
                <div class="size-10 rounded-xl bg-white/10 group-hover:bg-white/15 flex items-center justify-center text-neutral-200 transition-all">
                  <app-hero-icon [name]="isKiosk() ? 'arrows-pointing-in' : 'arrows-pointing-out'" class="text-xl" />
                </div>
                <div class="space-y-0.5">
                  <span class="block text-xs font-bold text-white">
                    {{ isKiosk() ? (isNative() ? 'Restaurar' : 'Salir Kiosco') : (isNative() ? 'Modo Kiosco' : 'Pantalla Completa') }}
                  </span>
                  <span class="block text-[10px] text-neutral-400">
                    {{ isKiosk() ? (isNative() ? 'Modo ventana' : 'Ventana normal') : (isNative() ? 'Pantalla completa' : 'Activar fullscreen') }}
                  </span>
                </div>
              </button>

              <!-- 2. Reiniciar -->
              <button
                type="button"
                uiSfx="click"
                class="flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/15 text-center transition-all cursor-pointer group"
                (click)="requestAction('restart')"
              >
                <div class="size-10 rounded-xl bg-amber-500/15 group-hover:bg-amber-500/25 flex items-center justify-center text-amber-400 transition-all">
                  <app-hero-icon name="arrow-path" class="text-xl" />
                </div>
                <div class="space-y-0.5">
                  <span class="block text-xs font-bold text-white">Reiniciar</span>
                  <span class="block text-[10px] text-neutral-400">Recargar sistema</span>
                </div>
              </button>

              <!-- 3. Cerrar (Solo en app nativa) -->
              @if (isNative()) {
                <button
                  type="button"
                  uiSfx="click"
                  class="flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/15 text-center transition-all cursor-pointer group"
                  (click)="requestAction('exit')"
                >
                  <div class="size-10 rounded-xl bg-rose-500/15 group-hover:bg-rose-500/25 flex items-center justify-center text-rose-400 transition-all">
                    <app-hero-icon name="power" class="text-xl" />
                  </div>
                  <div class="space-y-0.5">
                    <span class="block text-xs font-bold text-white">Cerrar</span>
                    <span class="block text-[10px] text-neutral-400">Salir de la app</span>
                  </div>
                </button>
              }
            </div>
          }

          <!-- Mensaje de estado/resultado de operación si aplica -->
          @if (opMessage()) {
            <p class="text-xs text-amber-300 text-center font-medium py-1" role="status">
              {{ opMessage() }}
            </p>
          }
        </div>
      </div>
    </div>
  `,
})
export class QuickSettingsDialog {
  private readonly settings = inject(KioskSettings);
  private readonly mediaPlayer = inject(MediaPlayer);
  private readonly platform = inject(PlatformService);

  readonly close = output<void>();

  protected readonly Math = Math;

  protected readonly soundEnabled = computed(() => this.settings.soundEnabled());
  protected readonly bgmVolume = computed(() => this.settings.bgmVolume());
  protected readonly sfxVolume = computed(() => this.settings.sfxVolume());
  protected readonly hasSessionAudioOverrides = computed(() => this.settings.hasSessionAudioOverrides());
  protected readonly isKiosk = computed(() => this.platform.isKiosk());
  protected readonly isNative = computed(() => this.platform.isNative);

  protected readonly confirmAction = signal<'restart' | 'exit' | null>(null);
  protected readonly opMessage = signal<string | null>(null);

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  // ─── Control de Sonido ──────────────────────────────────────────────────────

  protected toggleSound(): void {
    this.settings.setSessionSoundEnabled(!this.soundEnabled());
  }

  protected onBgmInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Math.max(0, Math.min(100, Number(input.value)));
    this.settings.setSessionBgmVolume(value / 100);
  }

  protected onSfxInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Math.max(0, Math.min(100, Number(input.value)));
    this.settings.setSessionSfxVolume(value / 100);
  }

  protected testSfx(): void {
    playUiSfx(this.mediaPlayer, 'select');
  }

  protected resetSessionAudio(): void {
    this.settings.clearSessionAudioOverrides();
  }

  // ─── Ajustes de Operación ───────────────────────────────────────────────────

  protected async onToggleKiosk(): Promise<void> {
    this.opMessage.set(null);
    const result = await this.platform.toggleKiosk();
    if (!result.ok) {
      this.opMessage.set(result.message ?? 'No se pudo alternar el modo de pantalla.');
    } else {
      this.opMessage.set(
        this.isKiosk() ? 'Modo kiosco (pantalla completa) activado.' : 'Modo ventana restaurado.',
      );
    }
  }

  protected requestAction(action: 'restart' | 'exit'): void {
    this.opMessage.set(null);
    this.confirmAction.set(action);
  }

  protected cancelConfirm(): void {
    this.confirmAction.set(null);
  }

  protected async executeConfirmedAction(): Promise<void> {
    const action = this.confirmAction();
    this.confirmAction.set(null);
    if (!action) return;

    if (action === 'restart') {
      const res = await this.platform.restart();
      if (!res.ok) {
        this.opMessage.set(res.message ?? 'No se pudo reiniciar.');
      }
    } else if (action === 'exit') {
      const res = await this.platform.exit();
      if (!res.ok) {
        this.opMessage.set(res.message ?? 'No se pudo cerrar la aplicación.');
      }
    }
  }
}
