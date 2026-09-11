import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  effect,
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
import { AssetSrc } from '../../core/platform/asset-src';

/** Tiempo mínimo de animación clásica entre videos en modo video (mínimo 20 s). */
export const CLASSIC_DWELL_MS = 20_000;

/** [0, 1) para posición y dirección visual del logo. */
function randomUnit(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
}

/**
 * Componente de protector de pantalla (Screensaver).
 *
 * Soporta dos modos gobernados por KioskSettings:
 * 1. **Modo Clásico:** Pantalla con logo Merz Aesthetics y slogan "HOY TU PIEL TAMBIÉN GANA"
 *    rebotando por todo el ancho y alto de la pantalla continuamente.
 * 2. **Modo Videos:** Ciclo estricto:
 *    clásico rebotador (≥ 20 s) → clip N → clásico rebotador (≥ 20 s) → clip N+1 → ...
 *    Inicia siempre en clásico. Cada clip se reproduce completo (`loop = false`).
 *    El BGM se pausa durante la reproducción del clip y se reanuda en los descansos clásicos.
 *
 * Salida: Un toque en cualquier punto del contenedor emite `dismiss`.
 */
@Component({
  selector: 'app-screensaver',
  standalone: true,
  imports: [AssetSrc],
  templateUrl: './screensaver.html',
  styleUrl: './screensaver.css',
  host: {
    'class': 'fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none cursor-pointer overflow-hidden',
    '(pointerdown)': 'onDismiss()',
  },
})
export class Screensaver implements AfterViewInit {
  private readonly settings = inject(KioskSettings);
  private readonly catalog = inject(CatalogService);
  private readonly mediaPlayer = inject(MediaPlayer);
  private readonly destroyRef = inject(DestroyRef);

  /** Emite cuando el usuario toca la pantalla para salir del protector. */
  readonly dismiss = output<void>();

  /** Referencias a los elementos del DOM. */
  private readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('screensaverVideo');
  private readonly bounceElement = viewChild<ElementRef<HTMLDivElement>>('bounceBox');
  private readonly containerElement = viewChild<ElementRef<HTMLDivElement>>('screensaverContainer');

  readonly mode = this.settings.screensaverMode;

  /** Lista de clips habilitados del catálogo (marcas y videos generales). */
  readonly playlist = computed(() =>
    buildScreensaverPlaylist(
      this.catalog.brands(),
      this.catalog.rawManifest?.()?.app?.protector?.attractionVideos,
    ),
  );

  /** Clip actualmente seleccionado para reproducción. */
  readonly currentClip = signal<ScreensaverPlaylistItem | null>(null);

  /** Indica si la vista está actualmente mostrando un video. */
  readonly isShowingVideo = signal<boolean>(false);

  /** Volumen efectivo para el video (0 si soundEnabled = false). */
  readonly effectiveVolume = computed(() =>
    this.mediaPlayer.effectiveVideoVolume(this.settings.videoVolume()),
  );

  private dwellTimer: ReturnType<typeof setTimeout> | null = null;
  private animFrameId: number | null = null;
  private posX = 0;
  private posY = 0;
  private velX = 140;
  private velY = 110;
  private lastTimestamp = 0;

  constructor() {
    if (this.mode() === 'video') {
      this.startClassicDwell();
    }

    // Clips del protector: pausar en segundo plano; reanudar solo si seguimos en modo video.
    effect(() => {
      const suspended = this.mediaPlayer.isBackgroundSuspended();
      if (!this.isShowingVideo()) return;
      const el = this.videoElement()?.nativeElement;
      if (!el) return;
      if (suspended) {
        el.pause();
        return;
      }
      el.volume = this.effectiveVolume();
      void el.play()?.catch(() => {
        this.finishVideoAndReturnToClassic();
      });
    });

    this.destroyRef.onDestroy(() => {
      this.stopVideoAndTimers();
    });
  }

  ngAfterViewInit(): void {
    if (!this.isShowingVideo()) {
      this.startBouncing();
    }
  }

  protected onDismiss(): void {
    this.stopVideoAndTimers();
    this.dismiss.emit();
  }

  protected onVideoEnded(): void {
    this.finishVideoAndReturnToClassic();
  }

  protected onVideoError(): void {
    this.finishVideoAndReturnToClassic();
  }

  // ─── Rebote continuo (DVD Bounce) ─────────────────────────────────────────

  private startBouncing(): void {
    this.stopBouncing();

    setTimeout(() => {
      const container = this.containerElement()?.nativeElement;
      const box = this.bounceElement()?.nativeElement;
      if (!container || !box) return;

      const W = container.clientWidth || 1080;
      const H = container.clientHeight || 1920;
      const w = box.offsetWidth || 340;
      const h = box.offsetHeight || 180;

      const maxX = Math.max(0, W - w);
      const maxY = Math.max(0, H - h);

      // Posición inicial aleatoria dentro de los límites
      this.posX = randomUnit() * maxX;
      this.posY = randomUnit() * maxY;

      // Velocidad y dirección inicial
      const speed = 140;
      const angle = (randomUnit() * 0.4 + 0.3) * Math.PI;
      this.velX = speed * Math.cos(angle) * (randomUnit() > 0.5 ? 1 : -1);
      this.velY = speed * Math.sin(angle) * (randomUnit() > 0.5 ? 1 : -1);

      this.lastTimestamp = performance.now();

      const updateFrame = (now: number) => {
        const dt = Math.min((now - this.lastTimestamp) / 1000, 0.1);
        this.lastTimestamp = now;

        const currentW = container.clientWidth || 1080;
        const currentH = container.clientHeight || 1920;
        const currentw = box.offsetWidth || 340;
        const currenth = box.offsetHeight || 180;

        const boundsX = Math.max(0, currentW - currentw);
        const boundsY = Math.max(0, currentH - currenth);

        this.posX += this.velX * dt;
        this.posY += this.velY * dt;

        if (this.posX <= 0) {
          this.posX = 0;
          this.velX = Math.abs(this.velX);
        } else if (this.posX >= boundsX) {
          this.posX = boundsX;
          this.velX = -Math.abs(this.velX);
        }

        if (this.posY <= 0) {
          this.posY = 0;
          this.velY = Math.abs(this.velY);
        } else if (this.posY >= boundsY) {
          this.posY = boundsY;
          this.velY = -Math.abs(this.velY);
        }

        box.style.transform = `translate3d(${this.posX.toFixed(1)}px, ${this.posY.toFixed(1)}px, 0)`;

        this.animFrameId = requestAnimationFrame(updateFrame);
      };

      this.animFrameId = requestAnimationFrame(updateFrame);
    }, 0);
  }

  private stopBouncing(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
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
      return;
    }

    const next = getNextPlaylistItem(
      list,
      this.settings.screensaverVideoOrder(),
      this.currentClip()?.videoUrl ?? this.currentClip()?.brandId,
    );

    if (!next) {
      return;
    }

    this.stopBouncing();
    this.mediaPlayer.pauseBgm();

    this.currentClip.set(next);
    this.isShowingVideo.set(true);

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

    this.startBouncing();

    if (this.mode() === 'video') {
      this.startClassicDwell();
    }
  }

  private clearDwellTimer(): void {
    if (this.dwellTimer !== null) {
      clearTimeout(this.dwellTimer);
      this.dwellTimer = null;
    }
  }

  private stopVideoAndTimers(): void {
    this.clearDwellTimer();
    this.stopBouncing();

    const el = this.videoElement()?.nativeElement;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }

    this.mediaPlayer.resumeBgm();
  }
}
