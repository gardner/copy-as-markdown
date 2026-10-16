import { describe, expect, it } from 'vitest';
import Markdown from '../src/lib/markdown.js';

describe('untrusted Markdown inputs', () => {
  const markdown = new Markdown();

  it.each(['javascript:alert(1)', 'data:text/html,hello', 'vbscript:msgbox(1)', 'java\nscript:alert(1)'])(
    'drops executable link and image destinations: %s',
    (url) => {
      expect(markdown.linkTo('label', url)).toBe('label');
      expect(Markdown.imageFor('label', url)).toBe('label');
      expect(Markdown.linkedImage('label', url, url)).toBe('label');
    },
  );

  it('encodes destinations that could close the generated Markdown link', () => {
    expect(markdown.linkTo('label', 'https://example.com/a)![injected](https://evil.example/x'))
      .toBe('[label](https://example.com/a%29!%5Binjected%5D%28https://evil.example/x)');
  });

  it('escapes HTML, backslashes and image syntax in labels', () => {
    const output = markdown.linkTo('\\] <img src=x> ![track](https://evil.example/x)', 'https://example.com');
    expect(output).not.toContain('<img');
    expect(output).not.toContain('![track]');
    expect(output).toContain('\\\\');
    expect(Markdown.imageFor('](' + 'https://evil.example)', 'https://example.com/img')).toContain('\\]');
  });

  it('flattens label line breaks and rejects entity-obfuscated schemes', () => {
    expect(markdown.linkTo('hello\n# injected', 'https://example.com')).not.toContain('\n');
    expect(markdown.linkTo('label', 'javascript&colon;alert(1)')).toBe('label');
  });
});
