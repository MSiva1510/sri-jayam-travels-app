// Vercel entry point → vercel/functions/whatsapp-webhook.js
// Meta callback URL: https://app.travelsjayam.in/api/whatsapp/webhook
import { handler } from '../../vercel/functions/whatsapp-webhook.js'
import { wrapFunctionHandler } from '../../server/vercelAdapter.js'

export default wrapFunctionHandler(handler, 'api/whatsapp/webhook')
