import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { KioskSettings } from '../../core/settings/kiosk-settings';
import { CatalogService } from '../../core/catalog/catalog';
import { MediaPlayer } from '../../core/media/media-player';
import {
  buildScreensaverPlaylist,
  getNextPlaylistItem,
  ScreensaverPlaylistItem,
} from '../../core/kiosk/screensaver-playlist';

/** Tiempo mínimo de animación clásica entre videos en modo video (mínimo 20 s). */
export const CLASSIC_DWELL_MS = 20_000;

/** Tiempo de transición entre logotipos en modo clásico. */
export const LOGO_CYCLE_MS = 6_000;

/**
 * Componente de protector de pantalla (Screensaver).
 *
 * Soporta dos modos gobernados por KioskSettings:
 * 1. **Modo Clásico:** Pantalla tenue con logotipos institucionales y de marcas
 *    en movimiento flotante y alternancia continua. Cero elementos de video.
 * 2. **Modo Videos:** Ciclo estricto:
 *    clásico (≥ 20 s) → clip N → clásico (≥ 20 s) → clip N+1 → ...
 *    Inicia siempre en clásico. Cada clip se reproduce completo (`loop = false`).
 *    El BGM se pausa durante la reproducción del clip y se reanuda en los descansos clásicos.
 *
 * Salida: Un toque en cualquier punto del contenedor emite `dismiss`.
 */
@Component({
  selector: 'app-screensaver',
  standalone: true,
  templateUrl: './screensaver.html',
  styleUrl: './screensaver.css',
  host: {
    'class': 'fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none cursor-pointer overflow-hidden',
    '(pointerdown)': 'onDismiss()',
  },
})
export class Screensaver {
  private readonly settings = inject(KioskSettings);
  private readonly catalog = inject(CatalogService);
  private readonly mediaPlayer = inject(MediaPlayer);
  private readonly destroyRef = inject(DestroyRef);

  /** Emite cuando el usuario toca la pantalla para salir del protector. */
  readonly dismiss = output<void>();

  /** Referencia al elemento de video cuando está presente en la plantilla. */
  private readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('screensaverVideo');

  readonly mode = this.settings.screensaverMode;

  /** Lista de clips habilitados del catálogo. */
  readonly playlist = computed(() => buildScreensaverPlaylist(this.catalog.brands()));

  /** Clip actualmente seleccionado para reproducción. */
  readonly currentClip = signal<ScreensaverPlaylistItem | null>(null);

  /** Indica si la vista está actualmente mostrando un video. */
  readonly isShowingVideo = signal<boolean>(false);

  /** Volumen efectivo para el video (0 si soundEnabled = false). */
  readonly effectiveVolume = computed(() =>
    this.mediaPlayer.effectiveVideoVolume(this.settings.videoVolume()),
  );

  /** Colección de logotipos a alternar en modo clásico. */
  readonly logos = computed<readonly string[]>(() => {
    const brandLogos = this.catalog
      .brands()
      .filter((b) => b.enabled && b.logo)
      .map((b) => b.logo!);

    return [
      '/content/images/MerzAestheticsLogo.svg',
      '/content/images/merzGamesLogotipo.png',
      ...brandLogos,
    ];
  });

  /** Índice del logotipo actualmente visible. */
  readonly currentLogoIndex = signal<number>(0);

  /** Logotipo actualmente visible. */
  readonly currentLogo = computed(() => {
    const list = this.logos();
    if (list.length === 0) return '/content/images/MerzAestheticsLogo.svg';
    return list[this.currentLogoIndex() % list.length];
  });

  private dwellTimer: ReturnType<typeof setTimeout> | null = null;
  private logoTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.startLogoCycle();

    if (this.mode() === 'video') {
      this.startClassicDwell();
    }

    this.destroyRef.onDestroy(() => {
      this.stopVideoAndTimers();
    });
  }

  protected onDismiss(): void {
    this.stopVideoAndTimers();
    this.dismiss.emit();
  }

  protected onVideoEnded(): void {
    this.finishVideoAndReturnToClassic();
  }

  protected onVideoError(): void {
    // Si el video falla (archivo faltante, error de códec, etc.), saltamos a clásico
    this.finishVideoAndReturnToClassic();
  }

  // ─── Gestión del ciclo de video ──────────────────────────────────────────

  private startClassicDwell(): void {
    this.clearDwellTimer();
    this.dwellTimer = setTimeout(() => {
      this.dwellTimer = null;
      this.advanceToNextClip();
    }, CLASSIC_DWELL_MS);
  }

  private advanceToNextClip(): void {
    const list = this.playlist();
    if (list.length === 0) {
      // Sin videos en la playlist: permanecer en clásico
      return;
    }

    const next = getNextPlaylistItem(
      list,
      this.settings.screensaverVideoOrder(),
      this.currentClip()?.brandId,
    );

    if (!next) {
      return;
    }

    // Pausar BGM para no solapar audio
    this.mediaPlayer.pauseBgm();

    this.currentClip.set(next);
    this.isShowingVideo.set(true);

    // Si el elemento ya existe, asegurar play
    setTimeout(() => {
      const el = this.videoElement()?.nativeElement;
      if (el) {
        el.volume = this.effectiveVolume();
        el.currentTime = 0;
        void el.play()?.catch(() => {
          this.finishVideoAndReturnToClassic();
        });
      }
    }, 0);
  }

  private finishVideoAndReturnToClassic(): void {
    this.isShowingVideo.set(false);
    this.mediaPlayer.resumeBgm();

    if (this.mode() === 'video') {
      this.startClassicDwell();
    }
  }

  private startLogoCycle(): void {
    this.clearLogoTimer();
    this.logoTimer = setInterval(() => {
      const total = this.logos().length;
      if (total > 1) {
        this.currentLogoIndex.update((i) => (i + 1) % total);
      }
    }, LOGO_CYCLE_MS);
  }

  private clearDwellTimer(): void {
    if (this.dwellTimer !== null) {
      clearTimeout(this.dwellTimer);
      this.dwellTimer = null;
    }
  }

  private clearLogoTimer(): void {
    if (this.logoTimer !== null) {
      clearInterval(this.logoTimer);
      this.logoTimer = null;
    }
  }

  private stopVideoAndTimers(): void {
    this.clearDwellTimer();
    this.clearLogoTimer();

    const el = this.videoElement()?.nativeElement;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }

    this.mediaPlayer.resumeBgm();
  }
}
