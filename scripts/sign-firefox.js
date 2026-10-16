import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { signAddon } from 'web-ext/util/submit-addon';

const root = path.join(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/firefox-extension/manifest.json'), 'utf8'));
const apiKey = process.env.AMO_JWT_ISSUER;
const apiSecret = process.env.AMO_JWT_SECRET;
if (!apiKey || !apiSecret) throw new Error('Set AMO_JWT_ISSUER and AMO_JWT_SECRET before signing.');
if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) {
  throw new Error('Commit all source changes before signing so the source archive matches the build.');
}
const downloadDir = path.join(root, 'dist/firefox-signed');
fs.rmSync(downloadDir, { recursive: true, force: true });
fs.mkdirSync(downloadDir, { recursive: true });
await signAddon({
  apiKey,
  apiSecret,
  amoBaseUrl: 'https://addons.mozilla.org/api/v5/',
  id: manifest.browser_specific_settings.gecko.id,
  channel: 'unlisted',
  xpiPath: path.join(root, 'dist/copy-as-markdown-unsigned.zip'),
  submissionSource: path.join(root, `dist/copy-as-markdown-source-v${manifest.version}.zip`),
  downloadDir,
  savedIdPath: path.join(downloadDir, '.web-extension-id'),
  savedUploadUuidPath: path.join(root, 'dist/.amo-upload-uuid'),
  validationCheckTimeout: 900_000,
  approvalCheckTimeout: 900_000,
});
