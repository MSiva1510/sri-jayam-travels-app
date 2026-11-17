// Vercel entry point → vercel/functions/ocr-extract.js
import { handler } from '../../vercel/functions/ocr-extract.js'
import { wrapFunctionHandler } from '../../server/vercelAdapter.js'

export default wrapFunctionHandler(handler, 'api/ocr/extract')
