import DOMPurify from 'dompurify';
import { escapeLabel, safeDestination } from './safe-markdown.js';

export const MAX_SELECTION_LENGTH = 1_000_000;
const MAX_NODES = 10_000;
const MAX_DEPTH = 128;
const MAX_TABLE_CELLS = 20_000;
const OMIT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'BASE', 'LINK', 'META', 'INPUT', 'TEXTAREA', 'SELECT', 'NOSCRIPT']);
const ATTRIBUTES = new Set(['href', 'src', 'alt', 'title', 'class', 'start', 'colspan', 'rowspan', 'align']);

function cleanAttributes(element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    if (!ATTRIBUTES.has(attribute.name)) element.removeAttribute(attribute.name);
  }
  // Turndown inserts link titles directly between Markdown double quotes.
  if (element.hasAttribute('title')) {
    element.setAttribute('title', escapeLabel(element.getAttribute('title')!).replace(/"/g, '\\"'));
  }
  for (const name of ['href', 'src']) {
    if (!element.hasAttribute(name)) continue;
    const url = safeDestination(element.getAttribute(name)!, name === 'src');
    if (url) element.setAttribute(name, url);
    else element.removeAttribute(name);
  }
  // Language labels are emitted directly after a code fence by Turndown.
  if (element.tagName === 'CODE') {
    const language = /(?:^|\s)language-([\w+-]{1,40})(?=\s|$)/i.exec(element.className)?.[1];
    element.setAttribute('class', language ? `language-${language}` : '');
  }
}

function tableExpansion(element: Element): number {
  if (!['TD', 'TH'].includes(element.tagName)) return 0;
  let cells = 1;
  for (const attribute of ['colspan', 'rowspan']) {
    const raw = element.getAttribute(attribute);
    if (raw === null) continue;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
      throw new Error('Table span exceeds the conversion limit.');
    }
    cells *= value;
  }
  return cells;
}

/** Sanitize into a detached fragment; never attach selected HTML to a live document. */
export function parseSelection(html: string): HTMLElement {
  if (typeof html !== 'string' || html.length > MAX_SELECTION_LENGTH) {
    throw new Error('Selection is too large to convert safely.');
  }
  const fragment = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_ATTR: Array.from(ATTRIBUTES),
    FORBID_TAGS: Array.from(OMIT, name => name.toLowerCase()),
  });
  const container = fragment.ownerDocument.createElement('div');
  container.append(fragment);
  const pending: { node: Node; depth: number }[] = [{ node: container, depth: 0 }];
  let nodes = 0;
  let cells = 0;
  while (pending.length > 0) {
    const { node, depth } = pending.pop()!;
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new Error('Selection complexity limit exceeded.');
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (OMIT.has(element.tagName.toUpperCase())) {
        element.remove();
        continue;
      }
      cleanAttributes(element);
      cells += tableExpansion(element);
      if (cells > MAX_TABLE_CELLS) throw new Error('Table expansion limit exceeded.');
    }
    for (const child of Array.from(node.childNodes)) pending.push({ node: child, depth: depth + 1 });
  }
  return container;
}
