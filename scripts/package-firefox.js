import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { readReleaseFiles } from './lib/release-files.js';

const root = path.join(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'firefox-mv3/manifest.json'), 'utf8'));
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (manifest.version !== version) throw new Error('Package and Firefox manifest versions must match.');
const destination = path.join(root, 'dist/firefox-extension');
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
fs.cpSync(path.join(root, 'firefox-mv3/dist'), path.join(destination, 'dist'), {
  recursive: true,
  filter: source => !source.endsWith('.map') && !source.endsWith('.keep'),
});
for (const name of ['MIT-LICENSE.txt', 'UPSTREAM.json']) {
  fs.copyFileSync(path.join(root, name), path.join(destination, name));
}
fs.writeFileSync(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const zip = new JSZip();
for (const [name, bytes] of readReleaseFiles(destination)) {
  zip.file(name, bytes, { date: new Date('2000-01-01T00:00:00Z') });
}
fs.writeFileSync(path.join(root, 'dist/copy-as-markdown-unsigned.zip'), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
execFileSync('git', ['archive', '--format=zip', `--output=${root}/dist/copy-as-markdown-source-v${version}.zip`, 'HEAD'], { cwd: root });
console.log(`Prepared Firefox ${version} package and committed source archive.`);
