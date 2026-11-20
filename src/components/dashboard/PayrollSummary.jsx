import { ArrowUpRight, IndianRupee, Users } from 'lucide-react'
import Surface from '../ui/Surface'
import SectionHeader from '../ui/SectionHeader'
import StatusPill from '../ui/StatusPill'
import Avatar from '../ui/Avatar'
import Callout from '../ui/Callout'
import MiniStat from './MiniStat'
import DataUnavailable from './DataUnavailable'
import { formatINR } from '../../utils/dashboardData'

const DRIVER_SETTLEMENT = {
  paid:    { tone: 'green',  label: 'Paid' },
  pending: { tone: 'amber',  label: 'Pending' },
  approved:{ tone: 'violet', label: 'Unpaid' },
  none:    { tone: 'gray',   label: 'No settlement' },
}

export default function PayrollSummary({ payroll, unavailable, onViewPayroll }) {
  if (unavailable) {
    return <DataUnavailable label="Payroll unavailable" description="Settlement counts are hidden until payroll data loads." />
  }

  return (
    <Surface as="section" aria-label="Payroll summary">
      <SectionHeader
        eyebrow="Payroll & settlements"
        title="Settlement summary"
        badge={<span className="badge badge-active">{payroll.drivers?.length ?? 0} drivers</span>}
        action={
          <button
            type="button"
            onClick={onViewPayroll}
            aria-label="View all payroll"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
          >
            View all <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        }
      />
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <MiniStat icon={IndianRupee} tone="green" value={`Rs. ${(payroll.totalPaid / 1000).toFixed(1)}k`} label="Total paid" onClick={onViewPayroll} />
        <MiniStat icon={IndianRupee} tone="blue" value={payroll.pending} label="Pending approval" onClick={onViewPayroll} />
        <MiniStat icon={IndianRupee} tone="violet" value={payroll.approved} label="Approved · unpaid" onClick={onViewPayroll} />
        <MiniStat icon={IndianRupee} tone="gray" value={payroll.total} label="Total settlements" onClick={onViewPayroll} />
      </div>

      {/* Every driver is listed, including drivers without a settlement row. */}
      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          <Users size={12} aria-hidden="true" /> All drivers
        </p>
        <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
          {(payroll.drivers?.length ?? 0) === 0 ? (
            <p className="rounded-xl border ap-hairline px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
              No drivers yet.
            </p>
          ) : payroll.drivers.map(driver => {
            const state = DRIVER_SETTLEMENT[driver.status] || DRIVER_SETTLEMENT.none
            return (
              <button
                key={driver.id || driver.name}
                type="button"
                onClick={onViewPayroll}
                aria-label={`Open payroll for ${driver.name}`}
                className="ap-focus flex w-full items-center gap-2.5 rounded-xl border ap-hairline bg-slate-500/[0.02] px-3 py-2 text-left transition-colors hover:bg-[var(--ap-surface-2)] dark:bg-white/[0.02]"
              >
                <Avatar name={driver.name} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{driver.name}</span>
                  <span className="block text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                    {driver.amount > 0 ? formatINR(driver.amount) : '—'}
                  </span>
                </span>
                <StatusPill tone={state.tone}>{state.label}</StatusPill>
              </button>
            )
          })}
        </div>
      </div>

      {(payroll.pending > 0 || payroll.approved > 0) && (
        <Callout
          className="mt-3"
          tone="violet"
          title={
            (payroll.pending > 0 ? `${payroll.pending} settlement${payroll.pending !== 1 ? 's' : ''} awaiting approval` : '') +
            (payroll.pending > 0 && payroll.approved > 0 ? ' · ' : '') +
            (payroll.approved > 0 ? `${payroll.approved} approved — ready to pay` : '')
          }
          actionLabel="Review"
          actionAriaLabel="Review settlements"
          onAction={onViewPayroll}
        />
      )}
    </Surface>
  )
}
