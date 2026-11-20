import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useGpsHistory } from '../context/GpsHistoryContext'
import { loadDrivers } from '../data/driverData'
import { loadVehicles } from '../data/vehicleData'
import { fleetAlertRepository } from '../repositories'
import supabase from '../lib/supabase'
import { loadAttendanceToday } from '../data/attendanceData'
import { loadCustomers } from '../data/customerData'
import { loadExpenses } from '../data/expenseData'
import { loadBookings } from '../data/tripTypes'
import { loadSettlements } from '../data/settlementData'
import { buildDashboardData } from '../utils/dashboardData'

import Callout from '../components/ui/Callout'
import LiveFleetBoard from '../components/fleet/LiveFleetBoard'
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import DashboardKpiGrid from '../components/dashboard/DashboardKpiGrid'
import OperationsOverview from '../components/dashboard/OperationsOverview'
import PriorityAlerts from '../components/dashboard/PriorityAlerts'
import FleetAlertsPanel from '../components/dashboard/FleetAlertsPanel'
import FleetOverview from '../components/dashboard/FleetOverview'
import FinancialAnalytics from '../components/dashboard/FinancialAnalytics'
import TripActivity from '../components/dashboard/TripActivity'
import DriverPerformance from '../components/dashboard/DriverPerformance'
import PayrollSummary from '../components/dashboard/PayrollSummary'
import CustomerInsights from '../components/dashboard/CustomerInsights'
import AttendanceWidget from '../components/dashboard/AttendanceWidget'
import RecentActivityWidget from '../components/dashboard/RecentActivityWidget'

export default function Dashboard() {
  const { can, isAdmin, isManager } = useAuth()
  const navigate = useNavigate()
  const {
    snapshots: liveSnapshots, running: gpsRunning, settings: gpsSettings,
    health: gpsHealth, error: gpsError,
  } = useGpsHistory()

  // ── Async state ───────────────────────────────────────────
  const [bookings, setBookings] = useState([])
  const [customers, setCustomers] = useState([])
  const [allExpenses, setAllExpenses] = useState([])
  const [settlements, setSettlements] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [drivers, setDrivers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [fleetAlerts, setFleetAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErrors, setLoadErrors] = useState([])
  const [period, setPeriod] = useState('month') // 'month' | 'year'

  // Each source loads independently — one failing table/query must not blank
  // out the rest. Failures are surfaced, never replaced with sample data.
  const reload = async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      loadBookings(),
      loadCustomers(),
      loadExpenses(),
      loadSettlements(),
      loadAttendanceToday(),
      loadDrivers(),
      loadVehicles(),
      fleetAlertRepository.getActiveAlerts({ limit: 50 }),
    ])
    const [bks, cust, exps, stls, att, drv, veh, alerts] = results
    const errors = []

    setBookings(bks.status === 'fulfilled' && Array.isArray(bks.value) ? bks.value : [])
    setCustomers(cust.status === 'fulfilled' && Array.isArray(cust.value) ? cust.value.filter(c => !c._deleted) : [])
    setAllExpenses(exps.status === 'fulfilled' && Array.isArray(exps.value) ? exps.value : [])
    setSettlements(stls.status === 'fulfilled' && Array.isArray(stls.value) ? stls.value : [])
    setTodayAttendance(att.status === 'fulfilled' && Array.isArray(att.value) ? att.value : [])
    setDrivers(drv.status === 'fulfilled' && Array.isArray(drv.value) ? drv.value : [])
    setVehicles(veh.status === 'fulfilled' && Array.isArray(veh.value) ? veh.value : [])
    setFleetAlerts(alerts.status === 'fulfilled' && Array.isArray(alerts.value) ? alerts.value : [])

    const labels = ['bookings', 'customers', 'expenses', 'settlements', 'attendance', 'drivers', 'vehicles', 'fleetAlerts']
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[Dashboard] failed to load ${labels[index]}:`, result.reason)
        errors.push(labels[index])
      }
    })
    setLoadErrors(errors)
    setLoading(false)
  }

  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fleet alerts stay live: an SOS from the mobile app, or another manager
  // resolving an alert, updates this panel without a page reload.
  const reloadAlerts = async () => {
    try {
      const alerts = await fleetAlertRepository.getActiveAlerts({ limit: 50 })
      setFleetAlerts(Array.isArray(alerts) ? alerts : [])
    } catch (error) {
      console.error('[Dashboard] failed to refresh fleetAlerts:', error)
    }
  }

  useEffect(() => {
    const channel = supabase
      ?.channel('dashboard-fleet-alerts')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'fleet_alerts' },
        () => reloadAlerts())
      .subscribe()
    const poll = setInterval(reloadAlerts, 60_000)
    return () => {
      clearInterval(poll)
      if (channel) supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date()
  const unavailable = useMemo(
    () => Object.fromEntries(loadErrors.map(key => [key, true])),
    [loadErrors],
  )
  // Derive fresh values every render. The inputs are already loaded arrays and
  // the builder is pure/small; this guarantees the Month / This Year control
  // never serves a memoised snapshot from the previous range.
  const data = buildDashboardData({
    bookings, customers, allExpenses, settlements, todayAttendance,
    drivers, vehicles, period,
    gps: {
      snapshots: liveSnapshots,
      settings: gpsSettings,
      health: gpsHealth,
      running: gpsRunning,
      error: gpsError,
    },
    can,
    now,
    nowMs: now.getTime(),
  })

  if (loading) return <DashboardSkeleton />

  const dateLabel = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const attendanceDateLabel = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  const rangeLabel = period === 'year'
    ? `Year ${now.getFullYear()}`
    : now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const go = path => navigate(path)
  const openTrip = tripId => navigate('/trips', { state: { tripId } })

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up font-sf">
      {/* 1. Header and dashboard controls */}
      <DashboardHeader
        period={period}
        onPeriodChange={setPeriod}
        canBook={can('trips')}
        onNewBooking={() => go('/trips')}
        dateLabel={dateLabel}
        rangeLabel={rangeLabel}
      />

      {loadErrors.length > 0 && (
        <Callout
          tone="red"
          icon={AlertTriangle}
          title={`Couldn't load ${loadErrors.join(', ')}.`}
          sub="Unavailable sections are marked — try refreshing."
          actionLabel="Retry"
          onAction={reload}
        />
      )}

      {/* 2. Primary business KPIs */}
      <DashboardKpiGrid
        canRevenue={can('revenueDashboard')}
        data={data}
        onNavigate={go}
        unavailable={unavailable}
      />

      {/* 3. Today's operations */}
      {(can('revenueDashboard') || can('trips')) && (
        <OperationsOverview
          counts={data.todayCounts}
          allTime={data.allTime}
          driverCount={data.driverCounts.total}
          vehicleCount={data.vehicleCounts.total}
          unavailable={unavailable.bookings}
          onViewAll={() => go('/trips')}
          onViewBills={() => go('/invoices')}
          onViewDrivers={() => go('/drivers')}
          onViewVehicles={() => go('/vehicles')}
        />
      )}

      {/* 4. Priority alerts and reminders */}
      <PriorityAlerts
        alerts={data.documents.alerts}
        expiredCount={data.documents.expiredCount}
        soonCount={data.documents.soonCount}
        validCount={data.documents.validCount}
        attentionItems={data.attentionItems}
        unavailable={unavailable.vehicles || unavailable.drivers}
        onReviewAlert={alert => go(alert.to)}
        onViewAlerts={go}
        onAction={go}
      />

      {can('fleetAlerts') && (
        <FleetAlertsPanel
          alerts={fleetAlerts}
          unavailable={unavailable.fleetAlerts}
          onViewAll={() => go('/fleet')}
        />
      )}

      {/* 5. Fleet status and GPS overview */}
      {(can('vehicles') || isAdmin || isManager) && (
        <>
          <FleetOverview
            vehicleCounts={data.vehicleCounts}
            gps={data.gps}
            vehiclesUnavailable={unavailable.vehicles}
            onVehicles={() => go('/vehicles')}
            onGps={() => go('/fleet')}
          />
          {(isAdmin || isManager) && <LiveFleetBoard />}
        </>
      )}

      {/* 6. Revenue and expense analytics */}
      <FinancialAnalytics
        canRevenue={can('revenueDashboard')}
        canProfit={can('profitReports')}
        canExpenses={can('expenses')}
        data={data}
        onNavigate={go}
        unavailable={unavailable}
      />

      {/* 7. Upcoming and recent trips */}
      <TripActivity
        bookingToday={data.bookingToday}
        recentTrips={data.recentTrips}
        canRevenue={can('revenueDashboard')}
        unavailable={unavailable.bookings}
        onViewAll={() => go('/trips')}
        onOpenTrip={openTrip}
      />

      {/* 8. Driver performance and payroll */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <DriverPerformance
          driverStats={data.driverStats}
          canFinancialAnalytics={can('financialAnalytics')}
          unavailable={unavailable.bookings || unavailable.expenses}
          onViewDrivers={() => go('/drivers')}
        />
        {can('payroll') && (
          <PayrollSummary
            payroll={data.payroll}
            unavailable={unavailable.settlements}
            onViewPayroll={() => go('/payroll')}
          />
        )}
      </div>

      {/* 9. Customer insights */}
      {can('customers') && (
        <CustomerInsights
          counts={data.customerCounts}
          periodTagCap={data.periodTagCap}
          unavailable={unavailable.customers}
          onViewCustomers={() => go('/customers')}
        />
      )}

      {/* 10. Attendance and recent activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        {can('attendance') && (
          <AttendanceWidget
            attendance={data.attendance}
            dateLabel={attendanceDateLabel}
            available={!unavailable.attendance}
            onViewAttendance={() => go('/attendance')}
          />
        )}
        {(isAdmin || isManager) && <RecentActivityWidget limit={5} />}
      </div>
    </div>
  )
}
