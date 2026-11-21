// ─── OCR Service — provider-based document extraction ─────────────
// Abstraction over the document scanning provider. The UI (Add Document
// modal) talks only to this module so the engine can be swapped later
// (OpenAI Vision, Google Document AI, Tesseract server-side, …) without
// touching the components.
//
// All provider traffic goes through the server-side Vercel function
// (/api/ocr/extract) so the provider API key never reaches the browser.

import supabase from '../lib/supabase'

const OCR_PROVIDER = (import.meta.env?.VITE_OCR_PROVIDER || 'stub').toLowerCase()
const OCR_PROXY_PATH = '/api/ocr/extract'
const OCR_MAX_FILE_BYTES = 5 * 1024 * 1024 // binary cap mirrors the server-side limit
const OCR_MAX_BASE64_CHARS = Math.ceil((OCR_MAX_FILE_BYTES * 4) / 3) + 64 // base64 overhead

async function fileToBase64(file) {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export async function extractDocument({ file } = {}) {
  const provider = OCR_PROVIDER
  if (!file) return { ok: false, error: 'No document file provided', fields: null, confidence: null, provider }
  // Stub / unconfigured provider — extraction is not available in this
  // environment. The UI must never present a fake success here.
  if (provider === 'stub' || !provider) {
    return {
      ok: false,
      error: 'OCR provider is not configured for this deployment',
      fields: null,
      confidence: null,
      provider: provider || 'stub',
    }
  }
  try {
    if (file.size > OCR_MAX_FILE_BYTES) {
      return { ok: false, error: 'File is too large for OCR (max 5 MB)', fields: null, confidence: null, provider }
    }
    const dataBase64 = await fileToBase64(file)
    if (dataBase64.length > OCR_MAX_BASE64_CHARS) {
      return { ok: false, error: 'File is too large for OCR (max 5 MB)', fields: null, confidence: null, provider }
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) {
      return { ok: false, error: 'Your session has expired. Sign in again and retry.', fields: null, confidence: null, provider }
    }

    const res = await fetch(OCR_PROXY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'image/jpeg', dataBase64 }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'OCR extraction failed', fields: null, confidence: null, provider: data?.provider || provider }
    }
    return { ok: true, fields: data.fields || {}, confidence: data.confidence ?? null, provider: data.provider || provider }
  } catch (err) {
    return { ok: false, error: err?.message || 'OCR request failed', fields: null, confidence: null, provider }
  }
}

export async function runOcrWorkflow({ file } = {}) {
  return extractDocument({ file })
}
