// A lightweight SVG bar chart — no external charting lib needed
export default function MiniChart({ data, height = 80, barColor = '#3b82f6', lineColor = '#0d1b4b' }) {
  if (!data?.length) return null

  const w      = 400
  const h      = height
  const pad    = { t: 8, b: 24, l: 0, r: 0 }
  const inner  = { w: w - pad.l - pad.r, h: h - pad.t - pad.b }
  const maxVal = Math.max(...data.map(d => d.fare))
  const barW   = inner.w / data.length
  const gap    = barW * 0.25

  // line points for net
  const linePoints = data.map((d, i) => {
    const x = pad.l + i * barW + barW / 2
    const y = pad.t + inner.h - (d.net / maxVal) * inner.h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      {/* Bars */}
      {data.map((d, i) => {
        const bH  = (d.fare / maxVal) * inner.h
        const x   = pad.l + i * barW + gap / 2
        const y   = pad.t + inner.h - bH
        const bW  = barW - gap
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={bW} height={bH}
              rx={3}
              fill={barColor} opacity={0.18}
            />
            {/* filled portion = net */}
            <rect
              x={x}
              y={pad.t + inner.h - (d.net / maxVal) * inner.h}
              width={bW}
              height={(d.net / maxVal) * inner.h}
              rx={3}
              fill={barColor} opacity={0.5}
            />
          </g>
        )
      })}

      {/* Net line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke={barColor}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />

      {/* Month labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={pad.l + i * barW + barW / 2}
          y={h - 4}
          textAnchor="middle"
          fontSize={9}
          fontFamily="DM Sans, sans-serif"
          fontWeight={500}
          fill="currentColor"
          opacity={0.4}
        >
          {d.month}
        </text>
      ))}
    </svg>
  )
}
