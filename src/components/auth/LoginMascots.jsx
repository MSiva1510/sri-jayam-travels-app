// ─── Login Mascots ─────────────────────────────────────────────
// Four SVG characters that react to the login form.
//
//   state:  'idle'    → eyes follow the mouse, drift + blink randomly
//           'looking' → eyes look at `target` (the focused input)
//           'away'    → they turn / look away (password is visible)
//           'error'   → sad: eyebrows, frowns, shake (while the error shows)
//           'success' → happy closed eyes + bounce
//   target: { x, y } in viewport px (only used for 'looking')
//
// Pupil movement is done with refs + requestAnimationFrame so nothing
// re-renders per mouse move. All motion is transform/opacity only and
// respects prefers-reduced-motion (see login.css).

import { useEffect, useRef } from 'react'

const MAX_TRAVEL = 3.4 // px a pupil may move from centre

// ── One eye: white, pupil, eyelid (blink / closed), happy arc ──
function Eye({ cx, cy, rx = 8, ry = 9, lid, register }) {
  return (
    <g className="eye" transform={`translate(${cx} ${cy})`}>
      <ellipse className="eye-white" rx={rx} ry={ry} fill="#fff" />
      <g className="pupil" ref={el => register(el)}>
        <circle r={3.6} fill="#1f2033" />
        <circle r={1.1} cx={1.2} cy={-1.4} fill="#fff" />
      </g>
      {/* eyelid slides down from the top; colour matches the body */}
      <ellipse className="eyelid" rx={rx + 1} ry={ry + 1} fill={lid} />
      {/* happy arc, only visible in the success state */}
      <path className="eye-happy" d={`M${-rx} 2 Q0 ${-ry - 1} ${rx} 2`} fill="none" stroke="#1f2033" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  )
}

// ── One eyebrow: slants inward for a sad look; only shown on error ──
function Brow({ cx, cy, flip, w = 12 }) {
  // left brow rises toward the centre, right brow mirrors it
  const x1 = cx - w / 2, x2 = cx + w / 2
  const y1 = flip ? cy : cy + 4, y2 = flip ? cy + 4 : cy
  return (
    <path className="brow" d={`M${x1} ${y1} L${x2} ${y2}`}
      fill="none" stroke="#1f2033" strokeWidth="2.8" strokeLinecap="round" />
  )
}

export default function LoginMascots({ state = 'idle', target = null, className = '' }) {
  const svgRef    = useRef(null)
  const pupils    = useRef([])
  const mouse     = useRef({ x: null, y: null, at: 0 })
  const stateRef  = useRef(state)
  const targetRef = useRef(target)
  stateRef.current  = state
  targetRef.current = target

  const register = (el) => { if (el && !pupils.current.includes(el)) pupils.current.push(el) }

  // Track the mouse without re-rendering
  useEffect(() => {
    const onMove = (e) => { mouse.current = { x: e.clientX, y: e.clientY, at: performance.now() } }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // rAF loop: aim every pupil at the current target
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const tick = (now) => {
      const s = stateRef.current
      let tx, ty
      if (s === 'looking' && targetRef.current) {
        ({ x: tx, y: ty } = targetRef.current)
      } else if (s === 'error') {
        tx = null // handled below: look down-left, worried
      } else if (mouse.current.x != null && now - mouse.current.at < 4000) {
        ({ x: tx, y: ty } = mouse.current)
      } else {
        // idle drift — slow figure-of-eight
        const box = svgRef.current?.getBoundingClientRect()
        if (box) {
          tx = box.left + box.width  / 2 + Math.sin(now / 1900) * box.width  * 0.35
          ty = box.top  + box.height / 2 + Math.sin(now / 1300) * box.height * 0.18
        }
      }

      for (const p of pupils.current) {
        let ox = 0, oy = 0
        if (s === 'error') { ox = -1.2; oy = 2.6 }              // downcast
        else if (s === 'away') { ox = -MAX_TRAVEL; oy = -1.2 }  // look off to the side, away from the form
        else if (tx != null && !reduce) {
          const r = p.getBoundingClientRect()
          const dx = tx - (r.left + r.width / 2), dy = ty - (r.top + r.height / 2)
          const dist = Math.hypot(dx, dy)
          const k = Math.min(1, dist / 160) * MAX_TRAVEL
          const a = Math.atan2(dy, dx)
          ox = Math.cos(a) * k; oy = Math.sin(a) * k
        }
        p.style.transform = `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Random blinking (only while eyes are open)
  useEffect(() => {
    let t
    const blink = () => {
      const svg = svgRef.current
      if (svg && ['idle', 'looking', 'away'].includes(stateRef.current)) {
        svg.classList.add('is-blinking')
        setTimeout(() => svg.classList.remove('is-blinking'), 160)
      }
      t = setTimeout(blink, 2200 + Math.random() * 3200)
    }
    t = setTimeout(blink, 1800)
    return () => clearTimeout(t)
  }, [])

  return (
    <svg
      ref={svgRef}
      className={`mascots ${className}`}
      data-state={state}
      viewBox="0 0 420 300"
      role="img"
      aria-label="Four friendly characters watching the login form"
    >
      <defs>
        <linearGradient id="m-orange" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a3c" /><stop offset="1" stopColor="#f7761a" />
        </linearGradient>
        <linearGradient id="m-purple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a5cf6" /><stop offset="1" stopColor="#6d3ee6" />
        </linearGradient>
        <linearGradient id="m-pink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5c9a" /><stop offset="1" stopColor="#f0357a" />
        </linearGradient>
        <linearGradient id="m-yellow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd84a" /><stop offset="1" stopColor="#f8c317" />
        </linearGradient>
        <filter id="m-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#1f2033" floodOpacity="0.16" />
        </filter>
      </defs>

      <g className="mascots-group" filter="url(#m-shadow)">

        {/* ── Purple (tall, at the back) ── */}
        <g className="char char--purple" style={{ '--i': 1 }}>
          <g>
            <rect x="170" y="52" width="92" height="212" rx="24" fill="url(#m-purple)" />
            <Eye cx={200} cy={104} lid="#7a4cf0" register={register} />
            <Eye cx={234} cy={104} lid="#7a4cf0" register={register} />
            <Brow cx={200} cy={86} />
            <Brow cx={234} cy={86} flip />
            <path className="mouth" d="M209 126 Q217 133 225 126" fill="none" stroke="#1f2033" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </g>

        {/* ── Pink (middle) ── */}
        <g className="char char--pink" style={{ '--i': 2 }}>
          <g>
            <rect x="250" y="118" width="72" height="156" rx="20" fill="url(#m-pink)" />
            <Eye cx={274} cy={158} rx={7.5} ry={8.5} lid="#ff4d90" register={register} />
            <Eye cx={300} cy={158} rx={7.5} ry={8.5} lid="#ff4d90" register={register} />
            <Brow cx={274} cy={142} w={10} />
            <Brow cx={300} cy={142} w={10} flip />
            <path className="mouth" d="M281 178 Q287 182 293 178" fill="none" stroke="#1f2033" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        </g>

        {/* ── Yellow (right, one eye, deadpan) ── */}
        <g className="char char--yellow" style={{ '--i': 3 }}>
          <path d="M306 274 V214 a44 44 0 0 1 88 0 V274 Z" fill="url(#m-yellow)" />
          <Eye cx={337} cy={210} rx={7.5} ry={8.5} lid="#ffd43b" register={register} />
          <Eye cx={363} cy={210} rx={7.5} ry={8.5} lid="#ffd43b" register={register} />
          <Brow cx={337} cy={193} w={11} />
          <Brow cx={363} cy={193} w={11} flip />
          <path className="mouth mouth--flat" d="M336 236 H364" stroke="#1f2033" strokeWidth="2.6" strokeLinecap="round" />
        </g>

        {/* ── Orange (front, dome) ── */}
        <g className="char char--orange" style={{ '--i': 4 }}>
          <path d="M18 274 V262 a96 96 0 0 1 192 0 V274 Z" fill="url(#m-orange)" />
          <Eye cx={86} cy={222} lid="#ff9838" register={register} />
          <Eye cx={132} cy={222} lid="#ff9838" register={register} />
          <Brow cx={86} cy={202} w={14} />
          <Brow cx={132} cy={202} w={14} flip />
          <path className="mouth" d="M98 244 Q109 254 120 244" fill="none" stroke="#1f2033" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}
