const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for HTML content and attribute values. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
