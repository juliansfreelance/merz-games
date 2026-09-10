import { Directive, ElementRef, Input, inject } from '@angular/core';
import { assetUrl } from './asset-url';

/**
 * Reescribe `src` de `<img>` y `<video>` para honrar el base href
 * (Tauri `/` y GitHub Pages `/merz-games/`).
 */
@Directive({
  selector: 'img[src], video[src]',
})
export class AssetSrc {
  private readonly el = inject<ElementRef<HTMLImageElement | HTMLVideoElement>>(ElementRef);

  @Input()
  set src(value: string | null | undefined) {
    if (value == null || value === '') {
      this.el.nativeElement.removeAttribute('src');
      return;
    }
    this.el.nativeElement.setAttribute('src', assetUrl(value));
  }
}
