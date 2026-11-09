// ─── Create / check the WhatsApp trip templates in Meta ──────────────────
// Trip messages (booking confirmed, driver assigned, trip completed, new
// trip for the driver) go out as templates, which Meta must approve first
// (usually minutes, sometimes up to a day).
//
//   WHATSAPP_TOKEN=… WHATSAPP_WABA_ID=… node scripts/whatsapp-templates.mjs          # create
//   WHATSAPP_TOKEN=… WHATSAPP_WABA_ID=… node scripts/whatsapp-templates.mjs --list   # status
//
// PowerShell: $env:WHATSAPP_TOKEN="…"; $env:WHATSAPP_WABA_ID="…"; node scripts/whatsapp-templates.mjs
// Template text lives in netlify/functions/_lib/whatsappTrip.js (TEMPLATES).

import { TEMPLATES } from '../netlify/functions/_lib/whatsappTrip.js'

const token = process.env.WHATSAPP_TOKEN
const waba = process.env.WHATSAPP_WABA_ID
const version = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'
if (!token || !waba) {
  console.error('Set WHATSAPP_TOKEN and WHATSAPP_WABA_ID first.')
  process.exit(1)
}

const base = `https://graph.facebook.com/${version}/${waba}/message_templates`
const auth = { Authorization: `Bearer ${token}` }

async function list() {
  const res = await fetch(`${base}?fields=name,status,category,language&limit=100`, { headers: auth })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  const ours = data.data.filter(t => t.name in TEMPLATES)
  for (const name of Object.keys(TEMPLATES)) {
    const t = ours.find(x => x.name === name)
    console.log(`${name.padEnd(24)} ${t ? `${t.status} (${t.category}, ${t.language})` : 'NOT CREATED'}`)
  }
}

async function create() {
  for (const [name, t] of Object.entries(TEMPLATES)) {
    const res = await fetch(base, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        language: 'en',
        category: 'UTILITY',
        components: [{ type: 'BODY', text: t.body, example: { body_text: [t.example] } }],
      }),
    })
    const data = await res.json()
    if (res.ok) console.log(`created  ${name}: ${data.status}`)
    else console.log(`skipped  ${name}: ${data?.error?.error_user_msg || data?.error?.message}`)
  }
  console.log('\nApproval can take a few minutes. Check with --list.')
}

await (process.argv.includes('--list') ? list() : create())
