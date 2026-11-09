// Vercel entry point → netlify/functions/whatsapp-webhook.js
// Meta callback URL: https://app.travelsjayam.in/api/whatsapp/webhook
import { handler } from '../../netlify/functions/whatsapp-webhook.js'
import { wrapNetlifyHandler } from '../../server/vercelAdapter.js'

export default wrapNetlifyHandler(handler, 'api/whatsapp/webhook')
