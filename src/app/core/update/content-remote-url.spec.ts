import {
  localAssetToRemoteUrl,
  normalizeContentPath,
  pendingHasVideos,
} from './content-remote-url';
import { CONTENT_PUBLIC_RAW_BASE, CONTENT_VIDEOS_RELEASE_BASE } from './update.constants';

describe('content-remote-url', () => {
  it('mapea imágenes al raw de public/ en master', () => {
    expect(localAssetToRemoteUrl('/content/images/brands/nueva.png')).toBe(
      `${CONTENT_PUBLIC_RAW_BASE}/content/images/brands/nueva.png`,
    );
  });

  it('mapea videos al Release content-videos por basename', () => {
    expect(localAssetToRemoteUrl('/content/videos/belotero.mp4')).toBe(
      `${CONTENT_VIDEOS_RELEASE_BASE}/belotero.mp4`,
    );
  });

  it('rechaza traversal y URLs remotas', () => {
    expect(normalizeContentPath('/content/images/../../secret.png')).toBeNull();
    expect(localAssetToRemoteUrl('https://evil.example/a.png')).toBeNull();
    expect(localAssetToRemoteUrl('/otros/logo.png')).toBeNull();
  });

  it('detecta pendientes de video', () => {
    expect(pendingHasVideos(['/content/images/a.png'])).toBe(false);
    expect(pendingHasVideos(['/content/images/a.png', '/content/videos/x.mp4'])).toBe(true);
  });
});
