// ─── Server-side OCR provider (document intelligence) ────────────────────
// Runs inside the Vercel function runtime so the provider API key never
// reaches the browser. The handler (ocr-extract.js) talks to this module only,
// which keeps the engine pluggable (OpenAI Vision today, swap later).

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/chat/completions'

function ocrConfig(env = process.env) {
  const apiKey = env.OPENAI_API_KEY
  const model = env.OPENAI_OCR_MODEL || 'gpt-4o-mini'
  return { apiKey, model }
}

function normalizeDate(value) {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s)
  if (iso) return iso[0]
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * Extract structured fields from a base64-encoded document image.
 *
 * @param {{ base64: string, mimeType?: string, fileName?: string }} input
 * @param {Record<string, string>} [env]
 * @param {(url: string, init?: any) => Promise<any>} [fetchImpl]
 * @returns {Promise<{ ok: boolean, fields: object|null, confidence: number|null, error: string|null, provider: string }>}
 */
export async function runOcrExtraction({ base64, mimeType, fileName = '', env = process.env, fetchImpl = fetch }) {  const { apiKey, model } = ocrConfig(env)
  const provider = 'openai'
  const mime = mimeType || 'image/jpeg'

  if (!apiKey) {
    return { ok: false, fields: null, confidence: null, error: 'OCR is not configured on the server (OPENAI_API_KEY is missing)', provider }
  }

  const prompt = [
    'You are a document data extractor for a taxi fleet management company in India.',
    'Read the supplied official document image and return ONLY a JSON object (no markdown, no prose) with these keys:',
    'holderName (person or entity name on the document), documentNumber (licence / registration / certificate number),',
    'issueDate (YYYY-MM-DD or null), expiryDate (YYYY-MM-DD or null), vehicleNumber (registration plate or null),',
    'docType (one of: licence, aadhaar, pan, passport, rc, insurance, fc, permit, puc, fitness, tax_token, agreement, registration, other).',
  ].join(' ')

  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You extract structured data from official documents. Respond with JSON only.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${String(base64)}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { ok: false, fields: null, confidence: null, error: `OCR provider failed (${response.status}) ${text.slice(0, 160)}`, provider }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    let raw = {}
    if (typeof content === 'string') {
      try { raw = JSON.parse(content) } catch { raw = {} }
    } else if (content && typeof content === 'object') {
      raw = content
    }

    const fields = {
      holderName: raw.holderName || raw.holder_name || raw.name || null,
      documentNumber: raw.documentNumber || raw.document_number || raw.number || null,
      issueDate: normalizeDate(raw.issueDate || raw.issue_date || raw.issued_on),
      expiryDate: normalizeDate(raw.expiryDate || raw.expiry_date || raw.expires_on),
      vehicleNumber: raw.vehicleNumber || raw.vehicle_number || raw.registration || null,
      docType: raw.docType || raw.documentType || raw.doc_type || null,
    }

    const present = [fields.holderName, fields.documentNumber, fields.expiryDate, fields.docType].filter(Boolean).length
    const confidence = present > 0 ? Math.round((present / 4) * 100) : 0

    return { ok: true, fields, confidence, error: null, provider }
  } catch (error) {
    return { ok: false, fields: null, confidence: null, error: error?.message || 'OCR provider request failed', provider }
  }
}
