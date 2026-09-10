export type AssetKind = 'image' | 'audio' | 'video' | 'unknown';

export interface VerifyAssetResult {
  readonly ok: boolean;
  readonly sha256?: string;
  readonly errorMessage?: string;
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|ico|bmp)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

export function assetKindFromPath(path: string): AssetKind {
  if (IMAGE_EXT.test(path)) return 'image';
  if (AUDIO_EXT.test(path)) return 'audio';
  if (VIDEO_EXT.test(path)) return 'video';
  return 'unknown';
}

function bytesStartWith(data: Uint8Array, magic: number[]): boolean {
  if (data.length < magic.length) return false;
  return magic.every((b, i) => data[i] === b);
}

function asciiAt(data: Uint8Array, offset: number, text: string): boolean {
  if (data.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (data[offset + i] !== (text.codePointAt(i) ?? -1)) return false;
  }
  return true;
}

function looksLikeHtml(data: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false }).decode(data.slice(0, 160)).trimStart();
  return /^<!doctype html/i.test(head) || /^<html/i.test(head);
}

function looksLikeSvg(data: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false }).decode(data.slice(0, 256));
  return /<svg[\s>]/i.test(head) || /<\?xml/i.test(head);
}

const IMAGE_MAGIC: Record<string, (data: Uint8Array) => boolean> = {
  '.png': (d) => bytesStartWith(d, [0x89, 0x50, 0x4e, 0x47]),
  '.jpg': (d) => bytesStartWith(d, [0xff, 0xd8, 0xff]),
  '.jpeg': (d) => bytesStartWith(d, [0xff, 0xd8, 0xff]),
  '.gif': (d) => asciiAt(d, 0, 'GIF8'),
  '.webp': (d) => asciiAt(d, 0, 'RIFF') && asciiAt(d, 8, 'WEBP'),
  '.svg': looksLikeSvg,
  '.ico': (d) =>
    bytesStartWith(d, [0x00, 0x00, 0x01, 0x00]) || bytesStartWith(d, [0x00, 0x00, 0x02, 0x00]),
};

const AUDIO_MAGIC: Record<string, (data: Uint8Array) => boolean> = {
  '.wav': (d) => asciiAt(d, 0, 'RIFF') && asciiAt(d, 8, 'WAVE'),
  '.mp3': (d) => asciiAt(d, 0, 'ID3') || (d[0] === 0xff && (d[1] & 0xe0) === 0xe0),
  '.ogg': (d) => asciiAt(d, 0, 'OggS'),
};

const VIDEO_MAGIC: Record<string, (data: Uint8Array) => boolean> = {
  '.mp4': (d) => asciiAt(d, 4, 'ftyp'),
  '.mov': (d) => asciiAt(d, 4, 'ftyp'),
  '.webm': (d) => d[0] === 0x1a && d[1] === 0x45 && d[2] === 0xdf && d[3] === 0xa3,
};

function matchesKindMagic(
  checkers: Record<string, (data: Uint8Array) => boolean>,
  ext: string,
  data: Uint8Array,
): boolean {
  const check = checkers[ext];
  return check ? check(data) : !looksLikeHtml(data);
}

export function matchesAssetMagic(kind: AssetKind, ext: string, data: Uint8Array): boolean {
  if (data.length === 0) return false;
  if (looksLikeHtml(data) && kind !== 'unknown') return false;

  const lower = ext.toLowerCase();
  if (kind === 'image') return matchesKindMagic(IMAGE_MAGIC, lower, data);
  if (kind === 'audio') return matchesKindMagic(AUDIO_MAGIC, lower, data);
  if (kind === 'video') return matchesKindMagic(VIDEO_MAGIC, lower, data);
  return !looksLikeHtml(data);
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error('Web Crypto no disponible para SHA-256.');
  }
  const copy = new Uint8Array(data);
  const digest = await cryptoObj.subtle.digest('SHA-256', copy);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyAssetBytes(
  path: string,
  data: Uint8Array,
  expectedSha256?: string,
): Promise<VerifyAssetResult> {
  if (!data.length) {
    return { ok: false, errorMessage: `El archivo ${path} llegó vacío.` };
  }

  const kind = assetKindFromPath(path);
  const dot = path.lastIndexOf('.');
  const ext = dot >= 0 ? path.slice(dot) : '';
  if (kind !== 'unknown' && !matchesAssetMagic(kind, ext, data)) {
    return {
      ok: false,
      errorMessage: `El archivo ${path} no tiene un formato ${kind} válido.`,
    };
  }

  let sha256: string | undefined;
  try {
    sha256 = await sha256Hex(data);
  } catch (error) {
    if (expectedSha256) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, errorMessage: detail };
    }
  }

  if (expectedSha256) {
    const expected = expectedSha256.trim().toLowerCase();
    if (!sha256 || sha256 !== expected) {
      return {
        ok: false,
        sha256,
        errorMessage: `Hash incorrecto en ${path}.`,
      };
    }
  }

  return { ok: true, sha256 };
}
