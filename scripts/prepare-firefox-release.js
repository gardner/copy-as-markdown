import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifySignedXpi } from './lib/signed-xpi.js';

const root = path.join(import.meta.dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const signed = path.join(root, 'dist/firefox-signed');
const candidates = fs.readdirSync(signed).filter(file => file.endsWith('.xpi'));
if (candidates.length !== 1) throw new Error('Expected exactly one signed XPI.');
const xpi = path.join(signed, candidates[0]);
await verifySignedXpi(xpi, path.join(root, 'dist/firefox-extension'));
const files = new Map([
  [`copy-as-markdown-firefox-v${version}.xpi`, fs.readFileSync(xpi)],
  [`copy-as-markdown-source-v${version}.zip`, fs.readFileSync(path.join(root, `dist/copy-as-markdown-source-v${version}.zip`))],
]);
const destination = path.join(root, 'dist/firefox-release');
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
const sums = [];
for (const [name, bytes] of files) {
  fs.writeFileSync(path.join(destination, name), bytes);
  sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
}
fs.writeFileSync(path.join(destination, 'SHA256SUMS'), `${sums.join('\n')}\n`);
console.log(`Verified and checksummed Firefox ${version} release assets.`);
