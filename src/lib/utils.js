// shadcn/ui-style class name joiner (no external deps needed).

function flatten(value, out) {
  if (!value) return
  if (typeof value === 'string') {
    out.push(value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v) => flatten(v, out))
    return
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((k) => {
      if (value[k]) out.push(k)
    })
  }
}

export function cn(...inputs) {
  const out = []
  inputs.forEach((i) => flatten(i, out))
  return out.filter(Boolean).join(' ')
}

export default cn
