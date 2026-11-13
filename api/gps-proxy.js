// Vercel entry point → vercel/functions/gps-proxy.js
// Signed-in staff only (bearer Supabase session).
import { handler } from '../vercel/functions/gps-proxy.js'
import { wrapFunctionHandler } from '../server/vercelAdapter.js'

export default wrapFunctionHandler(handler, 'api/gps-proxy')
