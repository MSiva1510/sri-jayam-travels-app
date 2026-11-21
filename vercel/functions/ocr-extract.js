// ─── Document OCR extraction endpoint ─────────────────────────────────────
// POST /api/ocr/extract
//   Authorization: Bearer <Supabase session token>   (staff / admin / manager)
//   Content-Type: application/json
//   { "fileName": "rc.pdf", "mimeType": "application/pdf", "dataBase64": "…" }
//
// Runs the document scan on the server (provider API key stays server-side)
// and returns the structured fields + confidence:
//   { ok: true,  provider: "openai", fields: { holderName, documentNumber, … }, confidence: 87 }
//   { ok: false, error: "…" }
//
// Staff only (admin / manager), same check as the GPS proxy — OCR scans are a
// manager/admin workflow (upload → scan → review → save).

import { extractBearer, verifySupabaseStaff } from './_lib/verifySupabaseUser.js'
import { runOcrExtraction } from './_lib/ocrProvider.js'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // binary size cap for OCR (under the storage bucket limit)
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  }
}

export async function handler(event, _context, env = process.env, fetchImpl = fetch) {
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Method not allowed' })
  }

  const auth = await verifySupabaseStaff(extractBearer(event.headers), env)
  if (!auth.ok) return reply(auth.status, { error: auth.error })

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return reply(400, { error: 'Invalid JSON body' })
  }

  const fileName = String(payload.fileName || '')
  const mimeType = String(payload.mimeType || 'image/jpeg')
  const dataBase64 = String(payload.dataBase64 || '')
  if (!dataBase64) return reply(400, { error: 'A file (base64 data) is required' })
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return reply(415, { error: 'Unsupported file type for OCR' })
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64) || dataBase64.length % 4 !== 0) {
    return reply(400, { error: 'Invalid base64 file data' })
  }

  const binary = Buffer.from(dataBase64, 'base64')
  if (binary.length > MAX_FILE_BYTES) {
    return reply(413, { error: 'File is too large for OCR (max 5 MB)' })
  }

  const result = await runOcrExtraction({ base64: dataBase64, mimeType, fileName, env, fetchImpl })
  if (!result.ok) {
    return reply(503, { ok: false, error: result.error, provider: result.provider })
  }

  return reply(200, {
    ok: true,
    provider: result.provider || 'openai',
    fields: result.fields || {},
    confidence: result.confidence ?? null,
  })
}
