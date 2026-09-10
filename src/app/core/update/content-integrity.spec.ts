import { sha256Hex, verifyAssetBytes } from './content-integrity';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);
const HTML = new TextEncoder().encode('<!DOCTYPE html><html></html>');

describe('content-integrity', () => {
  it('acepta PNG con magic bytes', async () => {
    const result = await verifyAssetBytes('/content/images/a.png', PNG);
    expect(result.ok).toBe(true);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rechaza HTML disfrazado de imagen', async () => {
    const result = await verifyAssetBytes('/content/images/a.png', HTML);
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/formato/i);
  });

  it('rechaza archivo vacío', async () => {
    const result = await verifyAssetBytes('/content/audio/a.mp3', new Uint8Array());
    expect(result.ok).toBe(false);
  });

  it('hash OK / fail', async () => {
    const digest = await sha256Hex(PNG);
    const ok = await verifyAssetBytes('/content/images/a.png', PNG, digest);
    expect(ok.ok).toBe(true);

    const fail = await verifyAssetBytes('/content/images/a.png', PNG, 'ab'.repeat(32));
    expect(fail.ok).toBe(false);
    expect(fail.errorMessage).toMatch(/hash/i);
  });
});
