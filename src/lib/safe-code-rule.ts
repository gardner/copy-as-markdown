import type { Rule } from 'turndown';

/** CommonMark accepts closing fences indented by up to three spaces. */
export const safeCodeRule: Rule = {
  filter(node, options) {
    return options.codeBlockStyle === 'fenced'
      && node.nodeName === 'PRE' && node.firstChild?.nodeName === 'CODE';
  },
  replacement(_content, node, options) {
    const code = (node as HTMLElement).firstElementChild!;
    const text = code.textContent || '';
    const marker = options.fence === '~~~' ? '~' : '`';
    let size = 3;
    for (const run of text.matchAll(marker === '`' ? /`+/g : /~+/g)) {
      size = Math.max(size, run[0].length + 1);
    }
    const fence = marker.repeat(size);
    const language = /language-([\w+-]{1,40})/i.exec(code.className)?.[1] || '';
    return `\n\n${fence}${language}\n${text.replace(/\n$/, '')}\n${fence}\n\n`;
  },
};
