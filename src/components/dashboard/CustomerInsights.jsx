import { ArrowUpRight, Users, CheckCircle, Building2, UserPlus } from 'lucide-react'
import Surface from '../ui/Surface'
import SectionHeader from '../ui/SectionHeader'
import MiniStat from './MiniStat'
import DataUnavailable from './DataUnavailable'

export default function CustomerInsights({ counts, periodTagCap, unavailable, onViewCustomers }) {
  if (unavailable) {
    return <DataUnavailable label="Customer insights unavailable" description="Customer counts are hidden until the directory loads." />
  }

  return (
    <Surface>
      <SectionHeader
        eyebrow="Customer insights"
        title="Customers"
        action={
          <button
            type="button"
            onClick={onViewCustomers}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
          >
            View all <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        }
      />
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <MiniStat icon={Users} tone="blue" value={counts.total} label="Total customers" onClick={onViewCustomers} />
        <MiniStat icon={CheckCircle} tone="green" value={counts.active} label="Active" onClick={onViewCustomers} />
        <MiniStat icon={Building2} tone="violet" value={counts.corporate} label="Corporate / agent" onClick={onViewCustomers} />
        <MiniStat icon={UserPlus} tone="teal" value={counts.newThisPeriod} label={`New ${periodTagCap}`} onClick={onViewCustomers} />
      </div>
    </Surface>
  )
}
