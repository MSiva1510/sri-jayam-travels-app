// Vercel entry point → vercel/functions/whatsapp-send.js
// Staff inbox replies from the web app and the manager app.
import { handler } from '../../vercel/functions/whatsapp-send.js'
import { wrapFunctionHandler } from '../../server/vercelAdapter.js'

export default wrapFunctionHandler(handler, 'api/whatsapp/send')
