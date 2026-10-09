// ─── SparkChart — Apple-style area sparkline ───────────────────
// Smooth gradient area + line, emphasized last point, hover tooltip.
// Accessible: one img role with a spoken summary; points are aria-hidden.
import { useMemo, useState } from 'react'

const W = 600

function smoothPath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  return d
}

export default function SparkChart({
  data = [], valueKey = 'fare', labelKey = 'month',
  height = 96, accent = 'var(--sjt-brand)',
  format = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN')}`,
  summary,
}) {
  const [hover, setHover] = useState(null)
  const pad = 8

  const { pts, line, area } = useMemo(() => {
    const vals = data.map(d => Number(d[valueKey]) || 0)
    const max = Math.max(1, ...vals)
    const n = data.length
    const pts = vals.map((v, i) => ({
      x: n === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (n - 1),
      y: height - pad - (v / max) * (height - pad * 2),
      v,
    }))
    const line = smoothPath(pts)
    const area = pts.length
      ? `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`
      : ''
    return { pts, line, area }
  }, [data, valueKey, height])

  if (!data.length) return null
  const total = data.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0)
  const last = data[data.length - 1]
  const lastPt = pts[pts.length - 1]
  const gradId = `apspark-${valueKey}`

  return (
    <div
      className="relative w-full"
      role="img"
      aria-label={summary || `Trend across ${data.length} points, total ${format(total)}`}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${gradId})`} />}
        {line && <path d={line} fill="none" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
        {lastPt && (
          <path
            d={`M ${lastPt.x} ${lastPt.y} l 0.01 0`}
            stroke={accent}
            strokeWidth="7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            fill="none"
          />
        )}
        {pts.map((p, i) => (
          <rect
            key={i}
            x={p.x - (W / (pts.length * 2))}
            y="0"
            width={W / pts.length}
            height={height}
            fill="transparent"
            style={{ pointerEvents: 'all' }}
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && pts[hover] && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-lg bg-navy-950/95 px-2 py-1 text-[10px] font-semibold text-white shadow-lg ring-1 ring-white/10 whitespace-nowrap"
          style={{ left: `${(pts[hover].x / W) * 100}%` }}
        >
          <span className="text-white/60 mr-1">{data[hover]?.[labelKey]}</span>
          {format(pts[hover].v)}
        </div>
      )}
      <div className="mt-1.5 flex justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500" aria-hidden="true">
        {data.map((d, i) => (
          <span key={i} className="tabular-nums">{d?.[labelKey]}</span>
        ))}
      </div>
      <span className="sr-only">
        {last?.[labelKey]}: {format(lastPt?.v || 0)} · total {format(total)}
      </span>
    </div>
  )
}
