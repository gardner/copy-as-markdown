import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';

test('production extension loads its packaged sanitizer and converts offline', async () => {
  const extension = path.join(import.meta.dirname, '../../chrome');
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const externalRequests: string[] = [];
    context.on('request', (request) => {
      if (/^https?:/.test(request.url())) externalRequests.push(request.url());
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/dist/static/popup.html`);
    await expect(popup.locator('body')).toContainText('Current tab link');
    const response = await worker.evaluate(async () => {
      await chrome.offscreen.createDocument({
        url: 'dist/static/offscreen.html',
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Exercise the packaged selection parser in a security test.',
      });
      return chrome.runtime.sendMessage({
        target: 'offscreen-markdown',
        html: '<h1>Packaged parser</h1><a href="javascript:alert(1)">Safe label</a>'
          + '<img src="https://exfil.invalid/production">',
        options: { headingStyle: 'atx' },
      });
    });
    expect(response.ok).toBe(true);
    expect(response.markdown).toContain('# Packaged parser');
    expect(response.markdown).not.toContain('javascript:');
    expect(externalRequests).toEqual([]);
  } finally {
    await context.close();
  }
});
