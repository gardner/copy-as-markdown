import path from 'node:path';
import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';

const bundle = buildSync({
  stdin: {
    contents: 'export { htmlToMarkdown } from "./src/lib/html-to-markdown.ts";',
    resolveDir: path.join(import.meta.dirname, '../..'),
  },
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'SelectionAudit',
}).outputFiles[0]!.text;

test('hostile selected HTML cannot execute code or make network requests during conversion', async ({ page }) => {
  const requests: string[] = [];
  await page.route('**/*', async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  await page.goto('about:blank');
  await page.addScriptTag({ content: bundle });
  const output = await page.evaluate(() => {
    const audit = (window as unknown as { SelectionAudit: { htmlToMarkdown: (html: string, options: object) => string } }).SelectionAudit;
    return audit.htmlToMarkdown('<img src="https://exfil.invalid/private" onerror="window.compromised=true">'
      + '<iframe src="https://exfil.invalid/frame"></iframe>'
      + '<script>window.compromised=true</script><style>@import "https://exfil.invalid/css";</style>'
      + '<svg><image href="https://exfil.invalid/svg"/></svg><p>Selected text</p>', {});
  });
  // Allow resource loads and event handlers a turn to fire, if conversion activated them.
  await page.waitForTimeout(100);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => 'compromised' in window)).toBe(false);
  expect(output).toContain('Selected text');
  expect(output).not.toMatch(/<script|onerror|iframe|@import/);
});

test('sanitizer fails closed when DOMParser fails', async ({ page }) => {
  await page.goto('about:blank');
  // DOMPurify captures DOMParser at module initialization.
  await page.evaluate(() => {
    DOMParser.prototype.parseFromString = () => {
      throw new Error('simulated parser failure');
    };
  });
  await page.addScriptTag({ content: bundle });
  await expect(page.evaluate(() => {
    const audit = (window as unknown as { SelectionAudit: { htmlToMarkdown: (html: string, options: object) => string } }).SelectionAudit;
    return audit.htmlToMarkdown('<p>untrusted</p>', {});
  })).rejects.toThrow(/refusing unsafe fallback/);
});
