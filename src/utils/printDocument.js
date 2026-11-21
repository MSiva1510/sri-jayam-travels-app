// Shared print helper for invoice/quotation documents. Generated windows have
// no scripts and a restrictive CSP; only the printable DOM is transferred.

import { escapeHtml } from './htmlSecurity'

const PRINT_CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; base-uri 'self'; form-action 'none'">`

async function collectStyles() {
  const sheets = await Promise.all(
    [...document.querySelectorAll('link[rel="stylesheet"]')].map(async link => {
      try {
        const res = await fetch(link.href)
        return res.ok ? await res.text() : ''
      } catch {
        return ''
      }
    }),
  )
  const inline = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n')
  return `${sheets.join('\n')}\n${inline}`
}

export async function printDocument(node, title = 'Document') {
  if (!node) return
  const win = window.open('', '_blank')
  if (!win) return

  let css = ''
  try { css = await collectStyles() } catch { /* fall back to base styles */ }

  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    ${PRINT_CSP}
    <base href="${escapeHtml(window.location.origin)}/">
    <title>${escapeHtml(title)}</title>
    <style>${css}
      *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body { background: #fff !important; margin: 0; padding: 0; }
      body { font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif; }
      @page { size: A4; margin: 10mm; }
      @media print { body { width: 190mm; margin: 0 auto; } }
      .print-doc { width: 100%; max-width: 190mm; margin: 0 auto; color: #142238; }
      .print-doc img { max-width: 100%; }
      .print-break-avoid { break-inside: avoid; page-break-inside: avoid; }
    </style>
  </head><body>${node.outerHTML}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 500)
}
