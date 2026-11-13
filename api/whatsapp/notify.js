// Vercel entry point → vercel/functions/whatsapp-notify.js
// Called by the bookings trigger (pg_net) or staff.
import { handler } from '../../vercel/functions/whatsapp-notify.js'
import { wrapFunctionHandler } from '../../server/vercelAdapter.js'

export default wrapFunctionHandler(handler, 'api/whatsapp/notify')
