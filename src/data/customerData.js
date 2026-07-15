// ─── Customer Data & Storage ──────────────────────────────────
// Storage: Supabase `customers` table via customerRepository

import { customerRepository } from '../repositories/customerRepository'
import { withCache, cacheClear } from '../utils/dataCache'

export const CUSTOMER_TYPES = [
  { key:'individual', label:'Individual',   badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',       dot:'bg-blue-500'   },
  { key:'corporate',  label:'Corporate',    badge:'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', dot:'bg-violet-500' },
  { key:'agent',      label:'Travel Agent', badge:'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',         dot:'bg-teal-500'   },
]
export const getCustomerTypeCfg = key => CUSTOMER_TYPES.find(t => t.key === key) || CUSTOMER_TYPES[0]

export function generateCustomerId() {
  const ts = Date.now().toString().slice(-6)
  return `CUS-${ts}`
}

// ── Supabase customer store ───────────────────────────────────
// All functions are async — callers must await them.

async function _loadCustomers() {
  try {
    return await customerRepository.getAll()
  } catch (err) {
    console.error('[customerData] loadCustomers failed:', err)
    return MOCK_CUSTOMERS
  }
}
export const loadCustomers = withCache('customers', _loadCustomers)
export const getCustomers = loadCustomers



export async function saveCustomer(customer) {
  try {
    const { id, ...rest } = customer
    const existing = id ? await customerRepository.getById(id) : null
    if (existing) {
      return await customerRepository.update(id, { ...rest, updatedAt: new Date().toISOString() })
    }
    return await customerRepository.create({ id: id || generateCustomerId(), ...rest })
  } catch (err) {
    console.error('[customerData] saveCustomer failed:', err)
    return null
  }
}

export async function deleteCustomer(id) {
  try {
    return await customerRepository.delete(id)
  } catch (err) {
    console.error('[customerData] deleteCustomer failed:', err)
    return false
  }
}

export async function findCustomerByMobile(mobile) {
  if (!mobile || mobile.length < 10) return null
  try {
    return await customerRepository.searchByMobile(mobile)
  } catch (err) {
    console.error('[customerData] findCustomerByMobile failed:', err)
    return null
  }
}

export async function upsertCustomerFromBooking({ name, mobile, address }) {
  if (!name?.trim()) return null
  try {
    const existing = mobile ? await findCustomerByMobile(mobile) : null
    if (existing) return existing
    const now = new Date().toISOString()
    const customer = {
      id:             generateCustomerId(),
      type:           'individual',
      status:         'active',
      name:           name.trim(),
      mobile:         mobile || '',
      altMobile:      '',
      email:          '',
      address:        address || '',
      city:           '',
      state:          '',
      gst:            '',
      companyName:    '',
      contactPerson:  '',
      billingAddress: '',
      notes:          'Auto-created from booking.',
      createdAt:      now,
      updatedAt:      now,
    }
    return await customerRepository.create(customer)
  } catch (err) {
    console.error('[customerData] upsertCustomerFromBooking failed:', err)
    return null
  }
}

// ── Computed stats (no storage — derived from bookings array) ─
export function getCustomerStats(customerId, customerName, bookings) {
  const mine = bookings.filter(b => b.customer === customerName)
  return {
    totalTrips:     mine.length,
    completedTrips: mine.filter(b => b.status === 'completed').length,
    cancelledTrips: mine.filter(b => b.status === 'cancelled').length,
    activeTrips:    mine.filter(b => ['assigned','started'].includes(b.status)).length,
    totalRevenue:   mine.reduce((s, b) => s + (b.fare || 0), 0),
    lastTrip:       mine.sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||''))[0] || null,
    upcoming:       mine.filter(b => ['draft','confirmed','assigned'].includes(b.status))
                        .sort((a, b) => (a.startDate||'').localeCompare(b.startDate||'')),
    recent:         mine.filter(b => b.status === 'completed')
                        .sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||''))
                        .slice(0, 5),
  }
}

// ── Seed / reference data ─────────────────────────────────────
export const MOCK_CUSTOMERS = [
  {
    id:'CUS-0001', type:'individual', status:'active',
    name:'Rajan Kumar', mobile:'9876543210', altMobile:'',
    email:'rajan.kumar@gmail.com', address:'12 Gandhi Nagar', city:'Chennai', state:'Tamil Nadu',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Prefers Ramanan as driver. Usually airport runs.',
    createdAt:'2026-01-15T08:00:00Z', updatedAt:'2026-05-28T06:30:00Z',
  },
  {
    id:'CUS-0002', type:'corporate', status:'active',
    name:'Meena Devi', mobile:'9123456789', altMobile:'9000011122',
    email:'meena@techcorp.in', address:'45 IT Park', city:'Bangalore', state:'Karnataka',
    gst:'29AAACM0000A1Z5', companyName:'TechCorp Solutions', contactPerson:'Meena Devi', billingAddress:'45 IT Park, Whitefield, Bangalore',
    notes:'Corporate account. Monthly billing. GST invoice required.',
    createdAt:'2026-02-01T09:00:00Z', updatedAt:'2026-05-27T08:00:00Z',
  },
  {
    id:'CUS-0003', type:'individual', status:'active',
    name:'Suresh Pillai', mobile:'9988776655', altMobile:'',
    email:'', address:'Auroville Township', city:'Auroville', state:'Tamil Nadu',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Regular local visits. Family of 6 — needs SUV.',
    createdAt:'2026-01-20T10:00:00Z', updatedAt:'2026-05-26T10:00:00Z',
  },
  {
    id:'CUS-0004', type:'individual', status:'active',
    name:'Ananya Singh', mobile:'9012345678', altMobile:'',
    email:'ananya.singh@email.com', address:'15 Lake View', city:'Puducherry', state:'Puducherry',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Multi-day pilgrimages. Advance payment preferred.',
    createdAt:'2026-03-05T07:00:00Z', updatedAt:'2026-05-25T07:00:00Z',
  },
  {
    id:'CUS-0005', type:'agent', status:'active',
    name:'Vikram Nair', mobile:'8765432109', altMobile:'9911223344',
    email:'vikram@travelagent.com', address:'Travel Hub, T Nagar', city:'Chennai', state:'Tamil Nadu',
    gst:'33AABCV0000A1Z5', companyName:'Nair Travel Services', contactPerson:'Vikram Nair', billingAddress:'Travel Hub, 22 T Nagar, Chennai',
    notes:'Travel agent. Sends bulk bookings. 5% commission agreed.',
    createdAt:'2026-01-10T08:00:00Z', updatedAt:'2026-05-24T09:00:00Z',
  },
  {
    id:'CUS-0006', type:'individual', status:'active',
    name:'Priya Lakshmi', mobile:'7654321098', altMobile:'',
    email:'priya.lak@gmail.com', address:'22 Nehru Street', city:'Puducherry', state:'Puducherry',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'VIP customer. Always requests clean vehicle.',
    createdAt:'2026-02-14T10:00:00Z', updatedAt:'2026-05-23T10:00:00Z',
  },
  {
    id:'CUS-0007', type:'individual', status:'active',
    name:'Arun Balaji', mobile:'6543210987', altMobile:'',
    email:'', address:'Oulgaret', city:'Puducherry', state:'Puducherry',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Referral from Suresh Pillai.',
    createdAt:'2026-04-01T09:00:00Z', updatedAt:'2026-05-22T08:00:00Z',
  },
  {
    id:'CUS-0008', type:'corporate', status:'active',
    name:'Kavitha Mohan', mobile:'9871234560', altMobile:'9000099988',
    email:'kavitha@pharma.in', address:'Pharma Park', city:'Puducherry', state:'Puducherry',
    gst:'34AAACK0000A1Z5', companyName:'Kavitha Pharma Ltd', contactPerson:'Kavitha Mohan', billingAddress:'Pharma Park Phase 2, Puducherry',
    notes:'Corporate. Prefers Babu as driver. Requires receipt.',
    createdAt:'2026-01-25T08:00:00Z', updatedAt:'2026-05-21T08:00:00Z',
  },
  {
    id:'CUS-0009', type:'individual', status:'active',
    name:'Deepak Raj', mobile:'9988001122', altMobile:'',
    email:'deepak.raj@email.com', address:'11 Acharya Road', city:'Puducherry', state:'Puducherry',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Outstation specialist. Needs multi-day trips.',
    createdAt:'2026-03-10T07:00:00Z', updatedAt:'2026-05-20T07:00:00Z',
  },
  {
    id:'CUS-0010', type:'individual', status:'active',
    name:'Lakshmi Narayanan', mobile:'8877665544', altMobile:'9900001234',
    email:'lakshminarayanan@gmail.com', address:'Reddiyarpalayam', city:'Puducherry', state:'Puducherry',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Long-distance regular. Always pays in advance.',
    createdAt:'2026-02-20T09:00:00Z', updatedAt:'2026-05-19T09:00:00Z',
  },
  {
    id:'CUS-0011', type:'individual', status:'active',
    name:'Sathish Kumar', mobile:'9123000111', altMobile:'',
    email:'', address:'Mudaliarpet', city:'Puducherry', state:'Puducherry',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Airport drops primarily.',
    createdAt:'2026-03-18T08:00:00Z', updatedAt:'2026-05-18T08:00:00Z',
  },
  {
    id:'CUS-0012', type:'individual', status:'active',
    name:'Radha Krishnan', mobile:'8765000222', altMobile:'',
    email:'radhakrishnan@email.com', address:'Cuddalore Main Road', city:'Cuddalore', state:'Tamil Nadu',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Cuddalore-Puducherry regular.',
    createdAt:'2026-04-05T07:00:00Z', updatedAt:'2026-05-17T07:00:00Z',
  },
]