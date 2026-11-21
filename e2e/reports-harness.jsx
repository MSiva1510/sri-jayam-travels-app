// Offline layout harness for the redesigned Reports workspace.
// Fixture rows exist only here; production always uses Supabase/local store.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import '../src/index.css'

import { AuthProvider } from '../src/context/AuthContext'
import Reports from '../src/pages/Reports'

// Playwright installs a fixed 2026-11-21 clock before navigating here.
const seed = {
  sjt_trips: [
    { id: 'b1', bookingNo: 'BK-2611-001', customer: 'Anand Travels', status: 'completed', startDate: '2026-11-05', pickup: 'Chennai', drop: 'Coimbatore', driver: 'Ravi', vehicle: 'TN 37 AB 1234', fare: 5000, km: 180 },
    { id: 'b2', bookingNo: 'BK-2611-002', customer: 'Kavya', status: 'started', startDate: '2026-11-10', pickup: 'Coimbatore', drop: 'Airport', driver: 'Kumar', vehicle: 'TN 37 CD 5678', fare: 3000, km: 28 },
    { id: 'b3', bookingNo: 'BK-2611-003', customer: 'Blue Lines Ltd', status: 'cancelled', startDate: '2026-11-12', pickup: 'Erode', drop: 'Salem', driver: 'Ravi', vehicle: 'TN 37 AB 1234', fare: 1200, km: 140 },
    { id: 'b4', bookingNo: 'BK-2611-004', customer: 'Meera', status: 'confirmed', startDate: '2026-11-18', pickup: 'City Centre', drop: 'Airport', driver: 'Kumar', vehicle: 'TN 37 CD 5678', fare: 4000, km: 30 },
    { id: 'b5', bookingNo: 'BK-2601-005', customer: 'Anand Travels', status: 'completed', startDate: '2026-01-15', pickup: 'Salem', drop: 'Chennai', driver: 'Ravi', vehicle: 'TN 37 AB 1234', fare: 7000, km: 220 },
  ],
  sjt_customers: [
    { id: 'c1', name: 'Anand Travels', type: 'corporate', city: 'Chennai', mobile: '9000000001', status: 'active' },
    { id: 'c2', name: 'Kavya', type: 'individual', city: 'Coimbatore', mobile: '9000000002', status: 'active' },
    { id: 'c3', name: 'Blue Lines Ltd', type: 'agent', city: 'Erode', mobile: '9000000003', status: 'active' },
    { id: 'c4', name: 'Meera', type: 'individual', city: 'Salem', mobile: '9000000004', status: 'active' },
  ],
  sjt_drivers: [
    { id: 'd1', name: 'Ravi', status: 'active', vehicle: 'TN 37 AB 1234' },
    { id: 'd2', name: 'Kumar', status: 'on-leave', vehicle: 'TN 37 CD 5678' },
  ],
  sjt_vehicles: [
    { id: 'v1', reg: 'TN 37 AB 1234', status: 'active', type: 'sedan', model: 'Swift Dzire', insExpiry: '2026-11-18', permitExpiry: '2026-12-20', fcExpiry: '2027-08-10', pucExpiry: '2027-02-10', nextServiceDate: '2026-11-25' },
    { id: 'v2', reg: 'TN 37 CD 5678', status: 'maintenance', type: 'suv', model: 'Ertiga', insExpiry: '2027-10-10', permitExpiry: '2027-10-10', fcExpiry: '2027-10-10', pucExpiry: '2027-10-10' },
  ],
  sjt_expenses: [
    { id: 'e1', date: '2026-11-03', amount: 2400, type: 'fuel', vehicle: 'TN 37 AB 1234', tripRef: 'BK-2611-001', status: 'approved' },
    { id: 'e2', date: '2026-11-09', amount: 900, type: 'toll', vehicle: 'TN 37 AB 1234', tripRef: 'BK-2611-001', status: 'approved' },
    { id: 'e3', date: '2026-10-14', amount: 1800, type: 'maintenance', vehicle: 'TN 37 CD 5678', status: 'approved' },
  ],
  sjt_settlements: [
    { id: 's1', driver: 'Ravi', status: 'paid', netAmount: 8400, incentive: 500, year: 2026, month: 11 },
    { id: 's2', driver: 'Kumar', status: 'pending', netAmount: 3200, incentive: 0, year: 2026, month: 11 },
    { id: 's3', driver: 'Ravi', status: 'approved', netAmount: 2100, incentive: 0, year: 2026, month: 11 },
  ],
}

Object.entries(seed).forEach(([key, value]) => {
  localStorage.setItem(key, JSON.stringify(value))
})

function LocationEcho() {
  const location = useLocation()
  return <output id="last-nav" className="sr-only" aria-live="polite">{location.pathname}</output>
}

function Harness() {
  const [dark, setDark] = useState(false)
  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <main id="reports-root" className="bg-[var(--ap-bg)] min-h-screen px-4 py-5 font-sf">
      <LocationEcho />
      <button id="theme-toggle" type="button" onClick={toggleDark}
        className="ap-focus mb-4 rounded-xl border border-[var(--ap-border)] px-3 py-1.5 text-xs font-semibold">
        Toggle theme
      </button>
      <Reports />
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/reports']}>
    <AuthProvider>
      <Harness />
    </AuthProvider>
  </MemoryRouter>,
)
