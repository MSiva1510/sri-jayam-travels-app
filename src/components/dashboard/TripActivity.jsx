import { ArrowUpRight, CalendarClock, Route } from 'lucide-react'
import Surface from '../ui/Surface'
import SectionHeader from '../ui/SectionHeader'
import Badge from '../ui/Badge'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import DataUnavailable from './DataUnavailable'
import { TRIP_TYPE_CONFIG } from '../../data/tripTypes'
import { formatINR } from '../../utils/dashboardData'

const toTripRow = booking => ({
  id: booking.id,
  customer: booking.customer,
  date: booking.startDate,
  startTime: booking.startTime || null,
  source: booking.pickup,
  destination: booking.drop,
  vehicle: booking.vehicle || '—',
  driver: booking.driver || '—',
  status: booking.status,
  type: booking.type,
  fare: booking.fare || 0,
  net: (booking.fare || 0) - (booking.toll || 0) - (booking.bata || 0)
    - (booking.petrol || 0) - (booking.parking || 0) - (booking.extras || 0),
})

function TripList({
  title, subtitle, trips, emptyTitle, emptyDescription,
  canRevenue, onViewAll, onOpenTrip,
}) {
  return (
    <Surface padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b ap-hairline">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {title} <span className="text-slate-500 dark:text-slate-400 tabular-nums">({trips.length})</span>
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={emptyTitle}
          description={emptyDescription}
          action={<button type="button" onClick={onViewAll} className="text-xs font-semibold text-blue-600 dark:text-blue-400">Open trips →</button>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b ap-hairline bg-slate-500/5 dark:bg-white/5">
                  {['Pickup', 'Customer', 'Route', 'Vehicle', 'Driver', ...(canRevenue ? ['Fare', 'Net'] : []), 'Status', ''].map(header => (
                    <th key={header || 'action'} className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.06em] whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trips.map(trip => {
                  const typeCfg = TRIP_TYPE_CONFIG[trip.type]
                  return (
                    <tr
                      key={trip.id}
                      className="border-b ap-hairline last:border-0 hover:bg-slate-500/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${typeCfg?.gradient || 'from-slate-400 to-slate-500'} flex items-center justify-center text-xs`} aria-hidden="true">
                            {typeCfg?.icon}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                            {trip.startTime || '—'}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar name={trip.customer} size={26} />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{trip.customer}</p>
                            <p className="text-[10px] text-slate-400 tabular-nums">{trip.date}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 max-w-[220px] truncate">
                        {trip.source} <span className="text-slate-300 dark:text-slate-600 mx-1">→</span> {trip.destination}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{trip.vehicle}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{trip.driver}</td>
                      {canRevenue && <>
                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap tabular-nums">{formatINR(trip.fare)}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">{formatINR(trip.net)}</td>
                      </>}
                      <td className="px-3 py-2.5"><Badge status={trip.status} /></td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={event => { event.stopPropagation(); onOpenTrip(trip.id) }}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap"
                        >
                          View Trip
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5 p-3">
            {trips.map(trip => (
              <button
                key={trip.id}
                type="button"
                onClick={() => onOpenTrip(trip.id)}
                className="ap-surface ap-focus w-full p-3.5 text-left ios-press"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={trip.customer} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{trip.customer}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">{trip.startTime || '—'} · {trip.date}</p>
                  </div>
                  <Badge status={trip.status} />
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <Route size={13} className="text-slate-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>{trip.source} → {trip.destination}</span>
                </p>
                <div className="mt-2 pt-2 border-t ap-hairline flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">{trip.vehicle} · {trip.driver}</span>
                  {canRevenue && <span className="font-semibold text-slate-800 dark:text-white tabular-nums flex-shrink-0">{formatINR(trip.fare)}</span>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Surface>
  )
}

export default function TripActivity({
  bookingToday = [], recentTrips = [], canRevenue, unavailable, onViewAll, onOpenTrip,
}) {
  if (unavailable) {
    return <DataUnavailable label="Trip activity unavailable" description="Schedules and recent trips are hidden until bookings load." />
  }

  const todayRows = bookingToday.map(toTripRow)

  return (
    <section className="space-y-3">
      <SectionHeader
        eyebrow="Booking & trip activity"
        title="Upcoming & recent trips"
        action={
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
          >
            View all <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        }
      />
      <TripList
        title="Today's schedule"
        subtitle="Prioritised by pickup time"
        trips={todayRows}
        emptyTitle="No trips scheduled today"
        emptyDescription="Today’s bookings will appear here as soon as they are created."
        canRevenue={canRevenue}
        onViewAll={onViewAll}
        onOpenTrip={onOpenTrip}
      />
      <TripList
        title="Latest trips"
        subtitle="Latest updates first"
        trips={recentTrips}
        emptyTitle="No trips yet"
        emptyDescription="Create your first booking from the Trips page."
        canRevenue={canRevenue}
        onViewAll={onViewAll}
        onOpenTrip={onOpenTrip}
      />
    </section>
  )
}
