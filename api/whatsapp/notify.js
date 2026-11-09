// Vercel entry point → netlify/functions/whatsapp-notify.js
// Called by the bookings trigger (pg_net) or staff.
import { handler } from '../../netlify/functions/whatsapp-notify.js'
import { wrapNetlifyHandler } from '../../server/vercelAdapter.js'

export default wrapNetlifyHandler(handler, 'api/whatsapp/notify')
