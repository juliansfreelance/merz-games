import { assetUrl } from '../platform/asset-url';

export interface VideoFileMeta {
  bytes: number | null;
  durationSec: number | null;
}

/** Formato legible de bytes (p. ej. `3.5 MB`). */
export function formatVideoBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Formato `m:ss` / `h:mm:ss` a partir de segundos. */
export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

export function formatVideoMetaLabel(meta: VideoFileMeta): string {
  const parts = [formatVideoBytes(meta.bytes), formatVideoDuration(meta.durationSec)].filter(
    (p): p is string => !!p,
  );
  return parts.length > 0 ? parts.join(' · ') : 'Metadatos no disponibles';
}

async function probeBytes(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) {
      const cl = head.headers.get('content-length');
      if (cl && Number.isFinite(Number(cl))) return Number(cl);
    }
  } catch {
    /* HEAD puede fallar en algunos hosts; se intenta Range. */
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    });
    const cr = res.headers.get('content-range');
    const match = cr ? /\/(\d+)\s*$/.exec(cr) : null;
    if (match && Number.isFinite(Number(match[1]))) return Number(match[1]);
  } catch {
    /* sin tamaño */
  }

  return null;
}

function probeDuration(url: string): Promise<number | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const finish = (value: number | null) => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };

    video.onloadedmetadata = () => {
      const d = video.duration;
      finish(Number.isFinite(d) ? d : null);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

/** Obtiene peso (bytes) y duración de un asset de video local o remoto. */
export async function probeVideoFileMeta(source: string): Promise<VideoFileMeta> {
  const url = assetUrl(source);
  const [bytes, durationSec] = await Promise.all([probeBytes(url), probeDuration(url)]);
  return { bytes, durationSec };
}
