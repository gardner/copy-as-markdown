/** Keep page-controlled values inside a single Markdown label. */
export function escapeLabel(text: string): string {
  return text.replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[[\]!*_`~]/g, '\\$&');
}

function hasControls(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** No executable schemes, credentials, controls or Markdown delimiter breakout. */
export function safeDestination(value: string, image = false): string {
  if (!value || value.length > 16_384 || hasControls(value)) return '';
  // Markdown renderers decode HTML entities in destinations. Reject ambiguity.
  if (/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/i.test(value)) return '';
  const url = value.trim();
  try {
    const parsed = new URL(url, 'https://relative.invalid/');
    const protocols = image ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:'];
    if (!protocols.includes(parsed.protocol) || parsed.username || parsed.password) return '';
  } catch {
    return '';
  }
  return url.replace(/[\s()<>"'\\`[\]]/gu, (character) => {
    const code = character.codePointAt(0)!;
    return code < 128 ? `%${code.toString(16).toUpperCase().padStart(2, '0')}` : encodeURIComponent(character);
  });
}
