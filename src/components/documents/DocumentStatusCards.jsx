// ─── DocumentStatusCards — document KPI tiles ──────────────────
// A focused, status-first summary. Each tile doubles as a shortcut to the
// matching filter, so the numbers on top stay useful rather than decorative.

import { AlertTriangle, CheckCircle2, Clock, FileText, ShieldCheck } from 'lucide-react'
import MetricCard from '../ui/MetricCard'

const CARDS = [
  { key: 'all',            label: 'Total Documents', icon: FileText,    tone: 'blue' },
  { key: 'active',         label: 'Valid',           icon: CheckCircle2, tone: 'green' },
  { key: 'expiring_soon',  label: 'Expiring Soon',   icon: Clock,       tone: 'amber' },
  { key: 'expired',        label: 'Expired',         icon: AlertTriangle, tone: 'red' },
  { key: 'no_expiry',      label: 'No Expiry',       icon: ShieldCheck, tone: 'violet' },
]

export default function DocumentStatusCards({ counts = {}, active = 'all', onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2" role="group" aria-label="Document status summary">
      {CARDS.map(card => {
        const Icon = card.icon
        const selected = active === card.key
        return (
          <MetricCard
            key={card.key}
            label={card.label}
            value={counts[card.key] ?? 0}
            icon={Icon}
            tone={card.tone}
            onClick={() => onSelect?.(card.key)}
            className={selected ? 'ring-2 ring-[var(--ap-accent)]/35 ring-offset-2 ring-offset-transparent' : ''}
          />
        )
      })}
    </div>
  )
}
