// ─── Zoom-adaptive rows per page ──────────────────────────────
// Browser zoom level from the outer/inner width ratio — robust to
// window height and OS display scaling (both scale together).
// Tiers: ≤95% → roomy (+1 row) · ≤105% → base · above → compact (−1).
// Phones (<768px) always use the phone count (tall cards).

export function zoomTier() {
  if (typeof window === 'undefined') return 100
  const z = (window.outerWidth / window.innerWidth) * 100
  if (z <= 95) return 90
  if (z <= 105) return 100
  return 110
}

export function pageSizeFor(base100, phoneSize) {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return phoneSize ?? base100
  }
  const tier = zoomTier()
  if (tier <= 90) return base100 + 1
  if (tier >= 110) return Math.max(1, base100 - 1)
  return base100
}

// Continuous zoom tiers: +1 row per 10% zoomed out, −1 row per 10%
// zoomed in, around the base (100% zoom) size. E.g. base 8 → 10 rows
// at 80%, 7 rows at 110%, 6 rows at 120%.
export function zoomPct() {
  if (typeof window === 'undefined') return 100
  return (window.outerWidth / window.innerWidth) * 100
}
export function pageSizeForZoom(base100, phoneSize) {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return phoneSize ?? base100
  }
  const steps = Math.round((100 - zoomPct()) / 10)
  return Math.max(1, base100 + steps)
}
