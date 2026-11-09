// Vercel entry point → netlify/functions/gps-proxy.js
// Signed-in staff only (bearer Supabase session).
import { handler } from '../netlify/functions/gps-proxy.js'
import { wrapNetlifyHandler } from '../server/vercelAdapter.js'

export default wrapNetlifyHandler(handler, 'api/gps-proxy')
