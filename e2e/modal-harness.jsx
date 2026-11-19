// Minimal Vite-served harness that renders the real modal components with
// inert callbacks. Playwright uses this to exercise layout, themes and form
// behaviour without requiring Supabase credentials or application auth.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import CustomerModal from '../src/components/customers/CustomerModal'
import ExpenseModal from '../src/components/expenses/ExpenseModal'
import AddDriverModal from '../src/components/drivers/AddDriverModal'
import VehicleModal from '../src/components/vehicles/VehicleModal'

const params = new URLSearchParams(window.location.search)
const requested = params.get('modal')
const modal = ['customer', 'expense', 'driver', 'vehicle'].includes(requested) ? requested : 'customer'
const dark = params.get('theme') === 'dark'
const editing = params.get('mode') === 'edit'
const driverMode = params.get('driver') === '1'

document.documentElement.classList.toggle('dark', dark)
document.documentElement.style.colorScheme = dark ? 'dark' : 'light'

const harness = {
  modal,
  dark,
  editing,
  driverMode,
  saves: [],
  closes: [],
  uploads: [],
}
window.__modalHarness = harness

const customer = editing ? {
  id: 'CUS-1001',
  name: 'Asha Traders',
  mobile: '9876543210',
  altMobile: '9876543211',
  email: 'office@example.test',
  type: 'corporate',
  address: '12 Main Road',
  city: 'Chennai',
  state: 'Tamil Nadu',
  companyName: 'Asha Traders Pvt Ltd',
  contactPerson: 'R Asha',
  gst: '33AABCA1234A1Z5',
  notes: 'Existing customer notes',
} : null

const expense = editing ? {
  id: 'expense-1001',
  expenseNo: 'EXP-2611-0007',
  type: 'toll',
  status: 'approved',
  date: '2026-11-18',
  amount: '250',
  description: 'Toll plaza payment',
  driver: 'Ravi Kumar',
  vehicle: 'TN01AB1234',
  notes: 'Existing toll note',
} : null

// Edit-mode driver uses the DB snake_case shape (as loaded from Supabase) so
// the harness proves the modal still reads both aliases.
const driver = editing ? {
  id: 'driver-1',
  driver_id: 'DRV-1001',
  name: 'Ravi Kumar',
  phone: '9000000001',
  license_number: 'TN1234567890',
  status: 'active',
  joined_date: '2024-05-01',
  license_expiry: '2027-05-01',
  bank_name: 'State Bank of India',
  emergency_contact: '9000000099',
  vehicle: 'PY01XX1234',
  badge: 'BADGE-77',
  medical_expiry: '2027-01-01',
} : null

const dayStamp = offset => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Relative dates keep the edit-mode assertions stable as time passes.
const vehicleDates = {
  insExpiry: dayStamp(200),
  fcExpiry: dayStamp(900),
  pucExpiry: dayStamp(45),
  nextServiceDate: dayStamp(12),
}
harness.vehicleDates = vehicleDates

// Edit-mode vehicle uses the DB snake_case columns the repository returns.
const vehicle = editing ? {
  id: 'vehicle-1',
  vehicle_id: 'VEH-1001',
  registration: 'PY01CY1255',
  vehicle_type: '7+1 SUV',
  model: 'Innova Crysta',
  year: 2022,
  color: 'Silver',
  fuel_type: 'Diesel',
  status: 'active',
  current_km: 150734,
  insurance_number: 'TATA-AIG-PY01CY1255',
  insurance_expiry: vehicleDates.insExpiry,
  fitness_cert_expiry: vehicleDates.fcExpiry,
  pollution_cert_expiry: vehicleDates.pucExpiry,
  last_service_km: 145000,
  driver: 'Ravi Kumar',
  // Local-only rows can carry the service dates the web form edits.
  lastServiceDate: '2026-09-01',
  nextServiceDate: vehicleDates.nextServiceDate,
  nextServiceKm: 155000,
} : null

// Seed local stores so the edit paths can update existing rows.
if (driver) window.localStorage.setItem('sjt_drivers', JSON.stringify([driver]))
if (vehicle) window.localStorage.setItem('sjt_vehicles', JSON.stringify([vehicle]))

const drivers = [
  { id: 'driver-1', name: 'Ravi Kumar', mobile: '9000000001', license: 'DL-001' },
  { id: 'driver-2', name: 'Suresh Babu', mobile: '9000000002', license: 'DL-002' },
]

const vehicles = [
  { id: 'vehicle-1', registration: 'TN01AB1234', vehicle_type: 'Sedan', make: 'Toyota', model: 'Camry' },
  { id: 'vehicle-2', registration: 'TN02CD5678', vehicle_type: 'SUV', make: 'Mahindra', model: 'XUV700' },
]

function Harness() {
  const [open, setOpen] = useState(true)

  const handleClose = () => {
    harness.closes.push({ at: Date.now() })
    setOpen(false)
  }

  const handleSave = async payload => {
    harness.saves.push(JSON.parse(JSON.stringify(payload)))
  }

  const uploadReceipt = async file => {
    harness.uploads.push({ name: file.name, size: file.size, type: file.type })
    await new Promise(resolve => setTimeout(resolve, 20))
    return {
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      name: file.name,
    }
  }

  const renderModal = () => {
    if (modal === 'customer') {
      return <CustomerModal customer={customer} onClose={handleClose} onSave={handleSave} />
    }
    if (modal === 'driver') {
      return <AddDriverModal driver={driver} onClose={handleClose} onSaved={handleSave} />
    }
    if (modal === 'vehicle') {
      return <VehicleModal vehicle={vehicle} onClose={handleClose} onSave={handleSave} />
    }
    return (
      <ExpenseModal
        expense={expense}
        drivers={drivers}
        vehicles={vehicles}
        existingExpenses={[{ expenseNo: 'EXP-2611-0007' }]}
        onClose={handleClose}
        onSave={handleSave}
        currentUser={{ name: 'Office Staff' }}
        isDriver={driverMode}
        uploadReceipt={uploadReceipt}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ap-bg)', color: 'var(--ap-text-1)', padding: 24 }}>
      <p id="harness-status">Harness ready: {modal}{dark ? ' / dark' : ' / light'}</p>
      {open ? renderModal() : (
        <button id="reopen" type="button" onClick={() => setOpen(true)}>Reopen modal</button>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Harness />)
