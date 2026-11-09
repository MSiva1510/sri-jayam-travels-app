// ─── Stopwatch / countdown formatting ───────────────────────────
// "MM:SS.cs" under an hour, "H:MM:SS" beyond.
export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0))
  const cs = Math.floor((total % 1000) / 10)
  const s = Math.floor(total / 1000) % 60
  const m = Math.floor(total / 60000) % 60
  const h = Math.floor(total / 3600000)
  const p2 = (n) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${p2(m)}:${p2(s)}`
  return `${p2(m)}:${p2(s)}.${p2(cs)}`
}
