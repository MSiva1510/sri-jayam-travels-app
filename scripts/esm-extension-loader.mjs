// Resolve hook: lets Node import the app's Vite-style extensionless
// relative imports (e.g. './baseRepository') when running scripts/tests
// outside Vite. App source stays untouched.
export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../')
  const hasExt = /\.[cm]?js$/.test(specifier)
  if (relative && !hasExt) {
    try {
      return await nextResolve(`${specifier}.js`, context)
    } catch {
      // fall through
    }
    try {
      return await nextResolve(`${specifier}/index.js`, context)
    } catch {
      // fall through
    }
  }
  return nextResolve(specifier, context)
}
