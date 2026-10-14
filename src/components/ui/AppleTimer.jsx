// ─── AppleTimer — stopwatch + countdown ─────────────────────────
// Skeuomorphic timer card: progress ring, mono digits, physical keys.
// mode: 'stopwatch' | 'countdown'. durationMs sets the countdown total.
import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Flag } from 'lucide-react'
import Button from './Button'
import { formatElapsed } from '../../utils/timerFormat'

const R = 54
const CIRC = 2 * Math.PI * R

export default function AppleTimer({ mode = 'stopwatch', durationMs = 5 * 60_000, onFinish }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0) // stopwatch ms elapsed / countdown ms remaining counts down via elapsed too
  const [laps, setLaps] = useState([])
  const [done, setDone] = useState(false)
  const baseRef = useRef(0)   // accumulated ms when paused
  const startRef = useRef(0)  // Date.now() when (re)started
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const now = baseRef.current + (Date.now() - startRef.current)
      if (mode === 'countdown' && now >= durationMs) {
        baseRef.current = durationMs
        setElapsed(durationMs)
        setRunning(false)
        setDone(true)
        onFinishRef.current?.()
        return
      }
      setElapsed(now)
    }, 50)
    return () => clearInterval(id)
  }, [running, mode, durationMs])

  // Switching modes resets the timer.
  useEffect(() => {
    baseRef.current = 0
    setElapsed(0)
    setLaps([])
    setRunning(false)
    setDone(false)
  }, [mode, durationMs])

  const start = () => { startRef.current = Date.now(); setRunning(true); setDone(false) }
  const pause = () => { baseRef.current = elapsed; setRunning(false) }
  const reset = () => { baseRef.current = 0; setElapsed(0); setLaps([]); setRunning(false); setDone(false) }
  const lap = () => { if (running) setLaps((l) => [...l, elapsed]) }

  const shown = mode === 'countdown' ? Math.max(0, durationMs - elapsed) : elapsed
  const frac = mode === 'stopwatch'
    ? null
    : durationMs > 0 ? Math.min(1, Math.max(0, elapsed / durationMs)) : 0

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[140px] h-[140px]">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" strokeWidth="9"
            className="stroke-slate-200 dark:stroke-white/10" />
          <circle cx="64" cy="64" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
            stroke="var(--ap-accent)"
            strokeDasharray={`${((frac ?? (elapsed / 60000) % 1) * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`}
            className="transition-[stroke-dasharray] duration-100" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="apple-timer-digits">{done ? 'Done' : formatElapsed(shown)}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
            {mode === 'countdown' ? 'remaining' : running ? 'running' : elapsed > 0 ? 'paused' : 'ready'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!running ? (
          <Button skin="skeuo" variant="primary" size="sm" icon={Play} onClick={start}>
            {elapsed > 0 && !done ? 'Resume' : 'Start'}
          </Button>
        ) : (
          <Button skin="neu" variant="secondary" size="sm" icon={Pause} onClick={pause}>Pause</Button>
        )}
        <Button skin="neu" variant="secondary" size="sm" icon={RotateCcw} onClick={reset}>Reset</Button>
        {mode === 'stopwatch' && (
          <Button skin="neu" variant="secondary" size="sm" icon={Flag} onClick={lap} disabled={!running}>Lap</Button>
        )}
      </div>

      {laps.length > 0 && (
        <div className="w-full max-h-32 overflow-y-auto rounded-xl border border-[var(--ap-border)] divide-y divide-[var(--ap-border)]">
          {laps.map((l, i) => (
            <div key={i} className="flex justify-between px-3 py-1.5 text-xs tabular-nums">
              <span className="font-bold text-slate-500 dark:text-slate-400">Lap {laps.length - i}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{formatElapsed(l)}</span>
            </div>
          )).reverse()}
        </div>
      )}
    </div>
  )
}
