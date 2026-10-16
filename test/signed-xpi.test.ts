import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';
import { verifySignedXpi } from '../scripts/lib/signed-xpi.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));

async function fixture(change: (zip: JSZip) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'signed-xpi-test-'));
  directories.push(dir);
  const source = path.join(dir, 'source');
  mkdirSync(source);
  const manifest = JSON.stringify({ version: '3.8.1', browser_specific_settings: { gecko: { id: 'fixture@example' } } });
  writeFileSync(path.join(source, 'manifest.json'), manifest);
  writeFileSync(path.join(source, 'background.js'), '/* trusted build */');
  const zip = new JSZip().file('manifest.json', manifest).file('background.js', '/* trusted build */');
  zip.file('META-INF/cose.sig', 'test metadata, not a cryptographic signature');
  change(zip);
  const xpi = path.join(dir, 'signed.xpi');
  writeFileSync(xpi, await zip.generateAsync({ type: 'nodebuffer' }));
  return { xpi, source };
}

describe('signed artifact verification', () => {
  it('accepts signing metadata only when the payload matches the built extension', async () => {
    const { xpi, source } = await fixture(() => {});
    await expect(verifySignedXpi(xpi, source)).resolves.toBeUndefined();
  });
  it('rejects unsigned ZIPs renamed to XPI', async () => {
    const { xpi, source } = await fixture(zip => zip.remove('META-INF/cose.sig'));
    await expect(verifySignedXpi(xpi, source)).rejects.toThrow(/signing metadata/);
  });
  it.each(['background.js', 'manifest.json'])('rejects a changed %s', async (name) => {
    const { xpi, source } = await fixture(zip => zip.file(name, 'untrusted payload'));
    await expect(verifySignedXpi(xpi, source)).rejects.toThrow(/does not match/);
  });
  it('rejects extra payload files', async () => {
    const { xpi, source } = await fixture(zip => zip.file('unexpected.js', 'bad'));
    await expect(verifySignedXpi(xpi, source)).rejects.toThrow(/Unexpected/);
  });
  it('rejects missing payload files', async () => {
    const { xpi, source } = await fixture(zip => zip.remove('background.js'));
    await expect(verifySignedXpi(xpi, source)).rejects.toThrow(/Missing/);
  });
  it('rejects oversized archives before parsing them', async () => {
    const { xpi, source } = await fixture(() => {});
    writeFileSync(xpi, Buffer.alloc(25_000_001));
    expect(readFileSync(xpi).length).toBeGreaterThan(25_000_000);
    await expect(verifySignedXpi(xpi, source)).rejects.toThrow(/size limit/);
  });
});
