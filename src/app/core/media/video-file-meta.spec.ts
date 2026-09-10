import { formatVideoBytes, formatVideoDuration, formatVideoMetaLabel } from './video-file-meta';

describe('video-file-meta formatters', () => {
  it('formatVideoBytes formatea B/KB/MB', () => {
    expect(formatVideoBytes(500)).toBe('500 B');
    expect(formatVideoBytes(1536)).toBe('1.5 KB');
    expect(formatVideoBytes(3_635_247)).toBe('3.5 MB');
    expect(formatVideoBytes(null)).toBeNull();
  });

  it('formatVideoDuration formatea m:ss y h:mm:ss', () => {
    expect(formatVideoDuration(45)).toBe('0:45');
    expect(formatVideoDuration(83)).toBe('1:23');
    expect(formatVideoDuration(3661)).toBe('1:01:01');
    expect(formatVideoDuration(null)).toBeNull();
  });

  it('formatVideoMetaLabel une peso y duración', () => {
    expect(formatVideoMetaLabel({ bytes: 1024 * 1024, durationSec: 90 })).toBe('1.0 MB · 1:30');
    expect(formatVideoMetaLabel({ bytes: null, durationSec: null })).toBe(
      'Metadatos no disponibles',
    );
  });
});
