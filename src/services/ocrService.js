// ─── OCR Service — provider-based document extraction ─────────
// Abstraction over the document scanning provider. The UI (Add Document
// modal) talks only to this module so the engine can be swapped later
// (OpenAI Vision, Google Document AI, Tesseract server-side, …) without
// touching the components.
//
// Contract:
//   extractDocument({ file }) →
//     { ok: true,  fields: { holderName, documentNumber, issueDate, expiryDate, vehicleNumber, ... }, confidence: {…} }
//     | { ok: false, error: string, fields: null, confidence: null }

const OCR_PROVIDER = (import.meta.env?.VITE_OCR_PROVIDER || 'stub').toLowerCase()

export const OCR_STEPS = ['upload', 'scan', 'review', 'save']

export async function extractDocument({ file } = {}) {
  if (!file) return { ok: false, error: 'No document file provided', fields: null, confidence: null, provider: OCR_PROVIDER }
  // Stub / unconfigured provider — extraction is not available in this
  // environment. The UI must never present a fake success here.
  if (OCR_PROVIDER === 'stub' || !OCR_PROVIDER) {
    return {
      ok: false,
      error: 'OCR provider is not configured for this deployment',
      fields: null,
      confidence: null,
      provider: OCR_PROVIDER || 'stub',
    }
  }
  // Real provider call would stream the file to a server-side proxy so the
  // API key never reaches the browser.
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/ocr/extract', { method: 'POST', body: fd })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'OCR extraction failed', fields: null, confidence: null, provider: OCR_PROVIDER }
    }
    return { ok: true, fields: data.fields || {}, confidence: data.confidence || {}, provider: OCR_PROVIDER }
  } catch (err) {
    return { ok: false, error: err?.message || 'OCR request failed', fields: null, confidence: null, provider: OCR_PROVIDER }
  }
}

export async function runOcrWorkflow({ file } = {}) {
  return extractDocument({ file })
}

export function confidenceTone(value) {
  if (value == null) return 'low'
  const n = Number(value)
  if (Number.isNaN(n)) return 'low'
  return n >= 80 ? 'high' : n >= 50 ? 'mid' : 'low'
}
