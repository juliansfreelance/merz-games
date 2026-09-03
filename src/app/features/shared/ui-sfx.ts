import { Directive, inject, input } from '@angular/core';
import { MediaPlayer } from '../../core/media/media-player';

export type UiSfxKind = 'click' | 'back' | 'select';

/** Efectos de UI locales (offline). */
export const UI_SFX: Record<UiSfxKind, string> = {
  click: '/content/audio/sfx/click.mp3',
  back: '/content/audio/sfx/click-back.mp3',
  select: '/content/audio/sfx/select.mp3',
};

export function playUiSfx(media: MediaPlayer, kind: UiSfxKind = 'click'): void {
  media.playSfx(UI_SFX[kind]);
}

/**
 * Reproduce SFX de UI al hacer click.
 * `click` = avanzar / OK; `back` = volver / cerrar; `select` = elegir marca o juego.
 */
@Directive({
  selector: '[uiSfx]',
  host: {
    '(click)': 'onClick()',
  },
})
export class UiSfx {
  readonly uiSfx = input<UiSfxKind>('click');

  private readonly media = inject(MediaPlayer);

  protected onClick(): void {
    playUiSfx(this.media, this.uiSfx());
  }
}
