import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../../src/lib/html-to-markdown.js';

describe('selection parser security', () => {
  it('drops executable and entity-obfuscated link and image URLs', () => {
    const output = htmlToMarkdown('<a href="javascript&#58;alert(1)">keep</a><img src="data:text/html,x" alt="image">', {});
    expect(output).not.toMatch(/javascript:|data:/);
    expect(output).toContain('keep');
  });

  it('removes embedded documents, foreign markup and raw HTML tables', () => {
    const output = htmlToMarkdown('<iframe srcdoc="bad">bad</iframe><svg><text>bad</text></svg><table><tr><td><img src=x onerror=bad()></td></tr></table>', {});
    expect(output).not.toMatch(/bad|<|onerror/);
  });

  it('rejects excessive input before parsing', () => {
    expect(() => htmlToMarkdown('x'.repeat(1_000_001), {})).toThrow(/large|limit/i);
  });

  it('rejects deeply nested input before recursive conversion', () => {
    expect(() => htmlToMarkdown(`${'<div>'.repeat(140)}x${'</div>'.repeat(140)}`, {})).toThrow(/deep|limit/i);
  });

  it('rejects excessive table expansion', () => {
    expect(() => htmlToMarkdown('<table><tr><td colspan="10001">x</td></tr></table>', {})).toThrow(/span|limit/i);
  });

  it('keeps indented closing fences inside code blocks', () => {
    const result = htmlToMarkdown('<pre><code>  ```\n&lt;img src=x onerror=bad()&gt;</code></pre>', { codeBlockStyle: 'fenced' });
    expect(result.startsWith('````\n')).toBe(true);
    expect(result.endsWith('\n````')).toBe(true);
  });

  it('escapes literal HTML text and malicious image labels', () => {
    const result = htmlToMarkdown('<p>&lt;img src=x onerror=bad()&gt;</p><img alt="](&quot;bad&quot;)" src="https://example.com/image">', {});
    expect(result).not.toContain('<img');
    expect(result).toContain('\\]');
  });

  it('preserves Markdown escaping inside table cells', () => {
    const result = htmlToMarkdown('<table><tr><td>[click](javascript:alert(1))</td></tr></table>', {});
    expect(result).toContain(String.raw`\[click\](javascript:alert(1))`);
    expect(result).not.toContain(String.raw`\\[click`);
  });

  it('keeps hostile link titles inside inline and reference titles', () => {
    const html = '<a href="https://safe.example" title="x\\&quot;) ![payload](https://exfil.invalid/img) (&quot;">label</a>';
    const title = String.raw`x\\\") \!\[payload\](https://exfil.invalid/img) (\"`;
    expect(htmlToMarkdown(html, {})).toBe(`[label](https://safe.example "${title}")`);
    expect(htmlToMarkdown(html, { linkStyle: 'referenced' })).toBe(`[label][1]\n\n[1]: https://safe.example "${title}"`);
  });
});
