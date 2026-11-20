import { ArrowUpRight, IndianRupee } from 'lucide-react'
import Surface from '../ui/Surface'
import SectionHeader from '../ui/SectionHeader'
import Callout from '../ui/Callout'
import MiniStat from './MiniStat'
import DataUnavailable from './DataUnavailable'

export default function PayrollSummary({ payroll, unavailable, onViewPayroll }) {
  if (unavailable) {
    return <DataUnavailable label="Payroll unavailable" description="Settlement counts are hidden until payroll data loads." />
  }

  return (
    <Surface>
      <SectionHeader
        eyebrow="Payroll & settlements"
        title="Settlement summary"
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
