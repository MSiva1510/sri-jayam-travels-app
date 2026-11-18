// Minimal Vite-served harness that renders the real modal components with
// inert callbacks. Playwright uses this to exercise layout, themes and form
// behaviour without requiring Supabase credentials or application auth.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import CustomerModal from '../src/components/customers/CustomerModal'
import ExpenseModal from '../src/components/expenses/ExpenseModal'

const params = new URLSearchParams(window.location.search)
const modal = params.get('modal') === 'expense' ? 'expense' : 'customer'
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ap-bg)', color: 'var(--ap-text-1)', padding: 24 }}>
      <p id="harness-status">Harness ready: {modal}{dark ? ' / dark' : ' / light'}</p>
      {open ? (
        modal === 'customer' ? (
          <CustomerModal customer={customer} onClose={handleClose} onSave={handleSave} />
        ) : (
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
      ) : (
        <button id="reopen" type="button" onClick={() => setOpen(true)}>Reopen modal</button>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Harness />)
