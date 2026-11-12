import { register } from 'node:module'

register('./esm-extension-loader.mjs', import.meta.url)
