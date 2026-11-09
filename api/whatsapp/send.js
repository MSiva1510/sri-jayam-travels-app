// Vercel entry point → netlify/functions/whatsapp-send.js
// Staff inbox replies from the web app and the manager app.
import { handler } from '../../netlify/functions/whatsapp-send.js'
import { wrapNetlifyHandler } from '../../server/vercelAdapter.js'

export default wrapNetlifyHandler(handler, 'api/whatsapp/send')
