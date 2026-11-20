import {
  IndianRupee, TrendingUp, Car, Receipt, CheckCircle, Clock,
} from 'lucide-react'
import MetricCard from '../ui/MetricCard'
import { formatINR } from '../../utils/dashboardData'
import DataUnavailable from './DataUnavailable'

const trendProps = delta => delta === undefined
  ? {}
  : { trend: Math.abs(delta), trendUp: delta >= 0 }

export default function DashboardKpiGrid({ canRevenue, data, onNavigate, unavailable = {} }) {
  const { totals, deltas, expense, periodTagCap, periodTag, bookingCounts, allTime } = data

  if (unavailable.bookings || unavailable.expenses) {
    return <DataUnavailable label="Business KPIs unavailable" description="Fare, kilometre and expense figures are hidden until their data sources load." />
  }

  if (canRevenue) {
    return (
      <section aria-label="Primary business metrics" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Total Fare"
          value={formatINR(totals.fare)}
          sub={`${totals.periodRevenueCount} trips ${periodTag}`}
          icon={IndianRupee}
          tone="blue"
          {...trendProps(deltas.fare)}
          onClick={() => onNavigate('/reports')}
        />
        <MetricCard
          label="Net Income"
          value={formatINR(totals.net)}
          sub={`After trip costs ${periodTag}`}
          icon={TrendingUp}
          tone="green"
          {...trendProps(deltas.net)}
          onClick={() => onNavigate('/reports')}
        />
        <MetricCard
          label="Kilometres Travelled"
          value={totals.km.toLocaleString('en-IN')}
          sub={`Kilometres covered ${periodTag}`}
          icon={Car}
          tone="violet"
          onClick={() => onNavigate('/trips')}
        />
        <MetricCard
          label="Total Expenses"
          value={formatINR(totals.expenses)}
          sub={`${expense.entries} entries ${periodTag}`}
          icon={Receipt}
          tone="amber"
          {...trendProps(deltas.expenses)}
          trendGood={deltas.expenses === undefined ? undefined : deltas.expenses <= 0}
          onClick={() => onNavigate('/expenses')}
        />
      </section>
    )
  }

  return (
    <section aria-label="Primary operations metrics" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard label="Total Trips" value={bookingCounts.total} sub={periodTagCap} icon={Car} tone="blue" onClick={() => onNavigate('/trips')} />
      <MetricCard label="Bills Done" value={bookingCounts.completed} sub={`Completed ${periodTag}`} icon={CheckCircle} tone="green" onClick={() => onNavigate('/trips')} />
      <MetricCard label="Total KM" value={totals.km.toLocaleString('en-IN')} sub={periodTagCap} icon={Car} tone="violet" onClick={() => onNavigate('/trips')} />
      <MetricCard label="Pending Bills" value={bookingCounts.pending} sub="Awaiting invoice" icon={Clock} tone="amber" onClick={() => onNavigate('/trips')} />
      <span className="sr-only">{allTime.doneTrips} completed trips all time</span>
    </section>
  )
}
