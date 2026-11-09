// ─── WhatsApp Cloud API client (server only) ─────────────────────────────
// Sends through Meta's Graph API with the business number in
// WHATSAPP_PHONE_NUMBER_ID and the permanent token in WHATSAPP_TOKEN.
// Free text and buttons only reach a customer within 24 h of their last
// message; outside that window Meta accepts approved templates only.
//
// Server-only env: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//                  WHATSAPP_GRAPH_VERSION (optional, default v21.0)

const DEFAULT_GRAPH_VERSION = 'v21.0'

/** "+91 73055 81235" / "07305581235" / "7305581235" → "917305581235". */
export function waPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return digits.length >= 11 && digits.length <= 15 ? digits : null
}

/** Last 10 digits, for matching against bookings.customer_contact. */
export function localPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : null
}

/** Template parameters may not be empty or contain new lines / tabs. */
export function templateText(value, fallback = '-') {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, 900) : fallback
}

export function whatsappConfig(env = process.env) {
  const token = env.WHATSAPP_TOKEN
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) return null
  return { token, phoneNumberId, version: env.WHATSAPP_GRAPH_VERSION || DEFAULT_GRAPH_VERSION }
}

export class WhatsAppSendError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Message bodies for the Graph API "messages" endpoint. */
export const waMessage = {
  text: (to, body) => ({
    messaging_product: 'whatsapp', recipient_type: 'individual', to,
    type: 'text', text: { preview_url: false, body: String(body).slice(0, 4096) },
  }),
  buttons: (to, body, buttons) => ({
    messaging_product: 'whatsapp', recipient_type: 'individual', to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: String(body).slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map(b => ({
          type: 'reply', reply: { id: b.id, title: String(b.title).slice(0, 20) },
        })),
      },
    },
  }),
  template: (to, name, params = [], language = 'en') => ({
    messaging_product: 'whatsapp', recipient_type: 'individual', to,
    type: 'template',
    template: {
      name,
      language: { code: language },
      ...(params.length
        ? { components: [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: templateText(p) })) }] }
        : {}),
    },
  }),
}

/** Plain-text version of an outgoing message, for the inbox. */
export function messagePreview(msg) {
  if (msg.type === 'text') return msg.text.body
  if (msg.type === 'interactive') {
    const titles = msg.interactive.action.buttons.map(b => `[${b.reply.title}]`).join(' ')
    return `${msg.interactive.body.text}\n${titles}`
  }
  if (msg.type === 'template') {
    const params = msg.template.components?.[0]?.parameters?.map(p => p.text) ?? []
    return `Template ${msg.template.name}${params.length ? `: ${params.join(' · ')}` : ''}`
  }
  return ''
}

/** Sends one message; resolves to Meta's wamid. */
export async function sendWhatsApp(config, msg, fetchImpl = fetch) {
  const res = await fetchImpl(
    `https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data?.error ?? {}
    throw new WhatsAppSendError(
      err.error_data?.details || err.message || `WhatsApp send failed (${res.status})`,
      { status: res.status, code: err.code },
    )
  }
  const wamid = data?.messages?.[0]?.id
  if (!wamid) throw new WhatsAppSendError('WhatsApp did not return a message id', { status: res.status })
  return wamid
}
