import fs from 'node:fs';
import yauzl from 'yauzl';
import { readReleaseFiles } from './release-files.js';

/**
 * Checks signed-package metadata and binds every payload byte to the tested build.
 * Firefox performs cryptographic verification at installation; this is not a substitute.
 * @param {string} file
 * @param {string} source
 */
export async function verifySignedXpi(file, source) {
  if (fs.statSync(file).size > 25_000_000) throw new Error('XPI exceeds size limit.');
  const expected = readReleaseFiles(source);
  const names = new Set();
  let signature = false;
  let totalBytes = 0;
  await new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      const fail = (reason) => {
        zip.close();
        reject(reason);
      };
      zip.on('error', fail);
      zip.on('entry', (entry) => {
        const name = entry.fileName;
        if (names.has(name)) return fail(new Error(`Duplicate XPI entry: ${name}`));
        names.add(name);
        totalBytes += entry.uncompressedSize;
        if (names.size > 1000 || totalBytes > 50_000_000 || entry.uncompressedSize > 10_000_000) {
          return fail(new Error('XPI contents exceed size limit.'));
        }
        if (name.endsWith('/')) return zip.readEntry();
        if (/^META-INF\/(?:mozilla\.(?:rsa|sf)|manifest\.mf|cose\.(?:sig|manifest))$/i.test(name)) {
          signature ||= /(?:mozilla\.rsa|cose\.sig)$/i.test(name) && entry.uncompressedSize > 0;
          return zip.readEntry();
        }
        const bytes = expected.get(name);
        if (!bytes) return fail(new Error(`Unexpected XPI file: ${name}`));
        if (entry.uncompressedSize !== bytes.length) return fail(new Error(`XPI does not match build: ${name}`));
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return fail(streamError);
          let offset = 0;
          stream.on('error', fail);
          stream.on('data', (chunk) => {
            if (!chunk.equals(bytes.subarray(offset, offset + chunk.length))) {
              stream.destroy(new Error(`XPI does not match build: ${name}`));
            }
            offset += chunk.length;
          });
          stream.on('end', () => {
            if (offset !== bytes.length) return fail(new Error(`XPI does not match build: ${name}`));
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => {
        if (!signature) return reject(new Error('XPI has no Mozilla signing metadata.'));
        for (const name of expected.keys()) {
          if (!names.has(name)) return reject(new Error(`Missing XPI file: ${name}`));
        }
        resolve();
      });
      zip.readEntry();
    });
  });
}
