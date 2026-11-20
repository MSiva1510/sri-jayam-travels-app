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
import DocumentModal from '../src/components/documents/DocumentModal'
import { buildDocumentPayload } from '../src/utils/documentForm.js'

const params = new URLSearchParams(window.location.search)
const requested = params.get('modal')
const modal = ['customer', 'expense', 'driver', 'vehicle', 'document'].includes(requested) ? requested : 'customer'
const dark = params.get('theme') === 'dark'
const editing = params.get('mode') === 'edit'
const ocrSuccess = params.get('ocr') === '1'
const driverMode = params.get('driver') === '1'
// Legacy rows can carry `inactive` from softDelete(), which is not a normal
// dropdown option but must still display correctly when editing.
const vehicleStatus = params.get('status') || 'active'

document.documentElement.classList.toggle('dark', dark)
document.documentElement.style.colorScheme = dark ? 'dark' : 'light'

const harness = {
  modal,
  dark,
  editing,
  driverMode,
  saves: [],
  saveMeta: [],
  closes: [],
  uploads: [],
  scans: [],
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

// Edit-mode document uses the snake_case row shape returned by Supabase,
// including legacy aliases and both attachment sides.
const documentDates = {
  issue: '2026-01-02',
  expiry: dayStamp(200),
  reminder: dayStamp(170),
}
harness.documentDates = documentDates
const documentFixture = editing ? {
  id: 'doc-1001',
  document_id: 'DOC-1001',
  document_type: 'insurance',
  related_entity: 'vehicle',
  title: 'Insurance 2026',
  category: 'vehicle',
  doc_type: 'insurance',
  vehicle_id: 'vehicle-1',
  document_number: 'INS-9',
  issuing_authority: 'LIC',
  issue_date: documentDates.issue,
  expiry_date: documentDates.expiry,
  reminder_date: documentDates.reminder,
  reminder_enabled: true,
  reminder_interval: 30,
  notes: 'Existing document note',
  tags: ['fleet', 'important'],
  status: 'active',
  file_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  file_name: 'front.png',
  file_size: 100,
  back_file_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  back_file_name: 'back.png',
  back_file_size: 80,
} : null

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
  status: vehicleStatus,
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

const customers = [
  { id: 'customer-1', name: 'Asha Traders' },
  { id: 'customer-2', name: 'Bright Logistics' },
]

function Harness() {
  const [open, setOpen] = useState(true)

  const handleClose = () => {
    harness.closes.push({ at: Date.now() })
    setOpen(false)
  }

  const handleSave = async (payload, meta) => {
    // Mirror saveDocument(): the modal supplies a form + upload metadata and
    // the data layer turns it into the row written to Supabase.
    const saved = modal === 'document'
      ? {
        ...buildDocumentPayload(payload, meta?.frontMeta, meta?.backMeta),
        // saveDocument() uses form.id in the WHERE clause rather than in the
        // update body; keep it here so edit assertions see the targeted row.
        ...(payload.id ? { id: payload.id } : {}),
      }
      : payload
    harness.saves.push(JSON.parse(JSON.stringify(saved)))
    if (meta) harness.saveMeta.push(JSON.parse(JSON.stringify(meta)))
  }

  const uploadReceipt = async file => {
    harness.uploads.push({ name: file.name, size: file.size, type: file.type })
    await new Promise(resolve => setTimeout(resolve, 20))
    return {
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      name: file.name,
    }
  }

  const uploadDocument = async (file, options = {}) => {
    harness.uploads.push({ name: file.name, size: file.size, type: file.type, ...options })
    await new Promise(resolve => setTimeout(resolve, 20))
    return {
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      name: file.name,
      size: file.size,
      path: `test/${options.side || 'front'}/${file.name}`,
    }
  }

  const scanDocument = async file => {
    harness.scans.push({ name: file.name, size: file.size })
    if (ocrSuccess) {
      return {
        ok: true,
        provider: 'harness',
        confidence: 91,
        fields: {
          holderName: 'Ravi Kumar',
          documentNumber: 'DL-HARNESS-1',
          issuingAuthority: 'Transport Department',
          issueDate: '2025-01-10',
          expiryDate: '2030-01-10',
          docType: 'license',
          vehicleNumber: 'TN01AB1234',
        },
      }
    }
    return { ok: false, error: 'OCR provider is not configured', fields: null, confidence: null, provider: 'stub' }
  }

  const previewDocument = async () =>
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

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
    if (modal === 'document') {
      return (
        <DocumentModal
          document={documentFixture}
          drivers={drivers}
          vehicles={vehicles}
          customers={customers}
          onClose={handleClose}
          onSave={handleSave}
          uploadFile={uploadDocument}
          scanDocument={scanDocument}
          onPreview={previewDocument}
        />
      )
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
