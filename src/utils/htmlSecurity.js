// ─── Safe serialization for exports and print windows ──────────
// Print windows inherit the app origin, so every database value written
// into their HTML must be escaped. CSV cells are neutralised separately
// because spreadsheet apps evaluate cells beginning with formula markers.

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => HTML_ENTITIES[char])
}

export function escapeCsvCell(value) {
  let text = String(value ?? '')
  // Prefix with an apostrophe so Excel/Sheets treat the value as text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Print documents need no scripts, remote assets or network access.
export const PRINT_CSP_META =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; base-uri \'none\'; form-action \'none\'">'
