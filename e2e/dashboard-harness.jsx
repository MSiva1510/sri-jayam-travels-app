// Offline layout harness for the redesigned dashboard widgets.
// The sample rows exist only here; production always uses Supabase data.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'

import { buildDashboardData, toLocalMonthStr } from '../src/utils/dashboardData.js'
import DashboardHeader from '../src/components/dashboard/DashboardHeader.jsx'
import DashboardKpiGrid from '../src/components/dashboard/DashboardKpiGrid.jsx'
import OperationsOverview from '../src/components/dashboard/OperationsOverview.jsx'
import PriorityAlerts from '../src/components/dashboard/PriorityAlerts.jsx'
import FleetOverview from '../src/components/dashboard/FleetOverview.jsx'
import FleetAlertsPanel from '../src/components/dashboard/FleetAlertsPanel.jsx'
import FinancialAnalytics from '../src/components/dashboard/FinancialAnalytics.jsx'
import TripActivity from '../src/components/dashboard/TripActivity.jsx'
import DriverPerformance from '../src/components/dashboard/DriverPerformance.jsx'
import PayrollSummary from '../src/components/dashboard/PayrollSummary.jsx'
import CustomerInsights from '../src/components/dashboard/CustomerInsights.jsx'
import AttendanceWidget from '../src/components/dashboard/AttendanceWidget.jsx'

const now = new Date()
const monthKey = toLocalMonthStr(now)
const todayKey = `${monthKey}-${String(now.getDate()).padStart(2, '0')}`
const relativeDate = days => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const bookings = [
  { id: 'b1', customer: 'Anand Travels', status: 'confirmed', type: 'outstation', startDate: todayKey, startTime: '09:30', pickup: 'Chennai', drop: 'Tiruppur', driver: 'Ravi', vehicle: 'TN 37 AB 1234', fare: 1234567, km: 180, toll: 120, bata: 300 },
  { id: 'b2', customer: 'Kavya', status: 'started', type: 'local', startDate: todayKey, startTime: '14:00', pickup: 'Coimbatore', drop: 'Airport', driver: 'Kumar', vehicle: 'TN 37 CD 5678', fare: 900, km: 28, toll: 0, bata: 150 },
  { id: 'b3', customer: 'Blue Lines Ltd', status: 'completed', type: 'corporate', startDate: `${monthKey}-08`, pickup: 'Erode', drop: 'Salem', driver: 'Ravi', vehicle: 'TN 37 AB 1234', fare: 3500, km: 140, toll: 90, bata: 250 },
  { id: 'b4', customer: 'Meera', status: 'cancelled', type: 'local', startDate: `${monthKey}-11`, pickup: 'City Centre', drop: 'Airport', driver: '', vehicle: '', fare: 1200, km: 30 },
]

const data = buildDashboardData({
  bookings,
  customers: [
    { id: 'c1', name: 'Anand Travels', type: 'corporate', status: 'active', createdAt: `${monthKey}-02` },
    { id: 'c2', name: 'Kavya', type: 'individual', status: 'active', createdAt: `${monthKey}-12` },
  ],
  allExpenses: [
    { id: 'e1', date: `${monthKey}-03`, amount: 4600, type: 'fuel', status: 'approved' },
    { id: 'e2', date: `${monthKey}-09`, amount: 900, type: 'toll', status: 'submitted' },
  ],
  settlements: [
    { id: 's1', status: 'paid', netAmount: 8400 },
    { id: 's2', status: 'pending', netAmount: 3200 },
    { id: 's3', status: 'approved', netAmount: 2100 },
  ],
  todayAttendance: [{ status: 'present' }, { status: 'present' }, { status: 'leave' }],
  drivers: [
    { id: 'd1', name: 'Ravi', license_expiry: relativeDate(8) },
    { id: 'd2', name: 'Kumar', license_expiry: relativeDate(-3) },
  ],
  vehicles: [
    { id: 'v1', reg: 'TN 37 AB 1234', status: 'active', insExpiry: relativeDate(-4), permitExpiry: relativeDate(12), fcExpiry: relativeDate(220), pucExpiry: relativeDate(45) },
    { id: 'v2', reg: 'TN 37 CD 5678', status: 'maintenance', insExpiry: relativeDate(180), permitExpiry: relativeDate(19), fcExpiry: relativeDate(300), pucExpiry: relativeDate(120) },
  ],
  gps: {
    running: true,
    health: { ok: true },
    settings: { enabled: true, refresh_interval: 60 },
    snapshots: [{ timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(), speed_kmh: 18, ignition: true }],
  },
  can: () => true,
  now,
  nowMs: now.getTime(),
})

function Harness() {
  const [period, setPeriod] = useState('month')
  const [dark, setDark] = useState(false)
  const [attendanceAvailable, setAttendanceAvailable] = useState(true)
  const [alertsAvailable, setAlertsAvailable] = useState(true)
  const view = { ...data, period }
  const dateLabel = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const rangeLabel = period === 'year'
    ? `Year ${now.getFullYear()}`
    : now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <main id="dashboard-root" className="bg-[var(--ap-bg)] min-h-screen px-4 py-5 font-sf lg:pl-[276px]">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <button id="theme-toggle" type="button" onClick={toggleDark} className="ap-focus rounded-xl border border-[var(--ap-border)] px-3 py-1.5 text-xs font-semibold">
          Toggle theme
        </button>
        <button id="attendance-toggle" type="button" onClick={() => setAttendanceAvailable(v => !v)} className="ap-focus rounded-xl border border-[var(--ap-border)] px-3 py-1.5 text-xs font-semibold">
          Toggle attendance data
        </button>
        <button id="alerts-toggle" type="button" onClick={() => setAlertsAvailable(v => !v)} className="ap-focus rounded-xl border border-[var(--ap-border)] px-3 py-1.5 text-xs font-semibold">
          Toggle fleet alerts data
        </button>

        <DashboardHeader
          period={period}
          onPeriodChange={setPeriod}
          canBook
          onNewBooking={() => {}}
          dateLabel={dateLabel}
          rangeLabel={rangeLabel}
        />
        <DashboardKpiGrid canRevenue data={view} onNavigate={() => {}} />
        <OperationsOverview
          counts={view.todayCounts}
          allTime={view.allTime}
          driverCount={view.driverCounts.total}
          vehicleCount={view.vehicleCounts.total}
          onViewAll={() => {}}
        />
        <PriorityAlerts
          alerts={view.documents.alerts}
          expiredCount={view.documents.expiredCount}
          soonCount={view.documents.soonCount}
          validCount={view.documents.validCount}
          attentionItems={view.attentionItems}
          onReviewAlert={() => {}}
          onViewDocuments={() => {}}
          onAction={() => {}}
        />
        <FleetAlertsPanel
          alerts={[{ id: 'fa1', title: 'High temperature warning', priority: 'critical', status: 'active', detected_at: new Date(Date.now() - 600000).toISOString() }]}
          unavailable={!alertsAvailable}
          onViewAll={() => {}}
        />
        <FleetOverview vehicleCounts={view.vehicleCounts} gps={view.gps} onVehicles={() => {}} onGps={() => {}} />
        <FinancialAnalytics canRevenue canProfit canExpenses data={view} onNavigate={() => {}} />
        <TripActivity
          bookingToday={view.bookingToday}
          recentTrips={view.recentTrips}
          canRevenue
          onViewAll={() => {}}
          onOpenTrip={() => {}}
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <DriverPerformance driverStats={view.driverStats} canFinancialAnalytics onViewDrivers={() => {}} />
          <PayrollSummary payroll={view.payroll} onViewPayroll={() => {}} />
        </div>
        <CustomerInsights counts={view.customerCounts} periodTagCap={view.periodTagCap} onViewCustomers={() => {}} />
        <AttendanceWidget
          attendance={view.attendance}
          dateLabel="Fri, 20 Nov"
          available={attendanceAvailable}
          onViewAttendance={() => {}}
        />
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<Harness />)
