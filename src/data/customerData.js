// ─── Customer Data & Storage ──────────────────────────────────
// Follows the same localStorage-merge pattern as tripTypes.js

export const CUSTOMERS_KEY = 'sjt_customers'

// ── Customer type config ──────────────────────────────────────
export const CUSTOMER_TYPES = [
  { key:'individual', label:'Individual',   badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',       dot:'bg-blue-500'    },
  { key:'corporate',  label:'Corporate',    badge:'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', dot:'bg-violet-500'  },
  { key:'agent',      label:'Travel Agent', badge:'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',         dot:'bg-teal-500'    },
]
export const getCustomerTypeCfg = key => CUSTOMER_TYPES.find(t => t.key === key) || CUSTOMER_TYPES[0]

// ── Booking data is imported lazily to avoid circular deps ────
// (tripTypes.js → customerData.js would be circular)

// ── Auto-incrementing ID ──────────────────────────────────────
export function generateCustomerId() {
  const ts = Date.now().toString().slice(-4)
  return `CUS-${ts}`
}

// ── Mock seed customers ───────────────────────────────────────
// Enriched from the TRIPS mock data (matches contact numbers)
export const MOCK_CUSTOMERS = [
  {
    id:'CUS-0001', type:'individual', status:'active',
    name:'Rajan Kumar',       mobile:'9876543210', altMobile:'',
    email:'rajan.kumar@gmail.com', address:'12 Gandhi Nagar', city:'Chennai', state:'Tamil Nadu',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Prefers Ramanan as driver. Usually airport runs.',
    createdAt:'2026-01-15T08:00:00Z', updatedAt:'2026-05-28T06:30:00Z',
  },
  {
    id:'CUS-0002', type:'corporate', status:'active',
    name:'Meena Devi',        mobile:'9123456789', altMobile:'9000011122',
    email:'meena@techcorp.in', address:'45 IT Park', city:'Bangalore', state:'Karnataka',
    gst:'29AAACM0000A1Z5', companyName:'TechCorp Solutions', contactPerson:'Meena Devi', billingAddress:'45 IT Park, Whitefield, Bangalore',
    notes:'Corporate account. Monthly billing. GST invoice required.',
    createdAt:'2026-02-01T09:00:00Z', updatedAt:'2026-05-27T08:00:00Z',
  },
  {
    id:'CUS-0003', type:'individual', status:'active',
    name:'Suresh Pillai',     mobile:'9988776655', altMobile:'',
    email:'', address:'Auroville Township', city:'Auroville', state:'Tamil Nadu',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Regular local visits. Family of 6 — needs SUV.',
    createdAt:'2026-01-20T10:00:00Z', updatedAt:'2026-05-26T10:00:00Z',
  },
  {
    id:'CUS-0004', type:'individual', status:'active',
    name:'Ananya Singh',      mobile:'9012345678', altMobile:'',
    email:'ananya.singh@email.com', address:'15 Lake View', city:'Puducherry', state:'Puducherry',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Multi-day pilgrimages. Advance payment preferred.',
    createdAt:'2026-03-05T07:00:00Z', updatedAt:'2026-05-25T07:00:00Z',
  },
  {
    id:'CUS-0005', type:'agent', status:'active',
    name:'Vikram Nair',       mobile:'8765432109', altMobile:'9911223344',
    email:'vikram@travelagent.com', address:'Travel Hub, T Nagar', city:'Chennai', state:'Tamil Nadu',
    gst:'33AABCV0000A1Z5', companyName:'Nair Travel Services', contactPerson:'Vikram Nair', billingAddress:'Travel Hub, 22 T Nagar, Chennai',
    notes:'Travel agent. Sends bulk bookings. 5% commission agreed.',
    createdAt:'2026-01-10T08:00:00Z', updatedAt:'2026-05-24T09:00:00Z',
  },
  {
    id:'CUS-0006', type:'individual', status:'active',
    name:'Priya Lakshmi',     mobile:'7654321098', altMobile:'',
    email:'priya.lak@gmail.com', address:'22 Nehru Street', city:'Puducherry', state:'Puducherry',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'VIP customer. Always requests clean vehicle.',
    createdAt:'2026-02-14T10:00:00Z', updatedAt:'2026-05-23T10:00:00Z',
  },
  {
    id:'CUS-0007', type:'individual', status:'active',
    name:'Arun Balaji',       mobile:'6543210987', altMobile:'',
    email:'', address:'Oulgaret', city:'Puducherry', state:'Puducherry',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Referral from Suresh Pillai.',
    createdAt:'2026-04-01T09:00:00Z', updatedAt:'2026-05-22T08:00:00Z',
  },
  {
    id:'CUS-0008', type:'corporate', status:'active',
    name:'Kavitha Mohan',     mobile:'9871234560', altMobile:'9000099988',
    email:'kavitha@pharma.in', address:'Pharma Park', city:'Puducherry', state:'Puducherry',
    gst:'34AAACK0000A1Z5', companyName:'Kavitha Pharma Ltd', contactPerson:'Kavitha Mohan', billingAddress:'Pharma Park Phase 2, Puducherry',
    notes:'Corporate. Prefers Babu as driver. Requires receipt.',
    createdAt:'2026-01-25T08:00:00Z', updatedAt:'2026-05-21T08:00:00Z',
  },
  {
    id:'CUS-0009', type:'individual', status:'active',
    name:'Deepak Raj',        mobile:'9988001122', altMobile:'',
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
    name:'Sathish Kumar',     mobile:'9123000111', altMobile:'',
    email:'', address:'Mudaliarpet', city:'Puducherry', state:'Tamil Nadu',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Airport drops primarily.',
    createdAt:'2026-03-18T08:00:00Z', updatedAt:'2026-05-18T08:00:00Z',
  },
  {
    id:'CUS-0012', type:'individual', status:'active',
    name:'Radha Krishnan',    mobile:'8765000222', altMobile:'',
    email:'radhakrishnan@email.com', address:'Cuddalore Main Road', city:'Cuddalore', state:'Tamil Nadu',
    gst:'', companyName:'', contactPerson:'', billingAddress:'',
    notes:'Cuddalore-Puducherry regular.',
    createdAt:'2026-04-05T07:00:00Z', updatedAt:'2026-05-17T07:00:00Z',
  },
]

// ── localStorage helpers ──────────────────────────────────────
export function loadCustomers() {
  try {
    const raw    = localStorage.getItem(CUSTOMERS_KEY)
    const stored = raw ? JSON.parse(raw) : []
    const storedIds = new Set(stored.map(c => c.id))
    return [...stored, ...MOCK_CUSTOMERS.filter(c => !storedIds.has(c.id))]
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch { return MOCK_CUSTOMERS }
}

export function saveCustomer(customer) {
  try {
    const raw    = localStorage.getItem(CUSTOMERS_KEY)
    const stored = raw ? JSON.parse(raw) : []
    const idx    = stored.findIndex(c => c.id === customer.id)
    if (idx >= 0) stored[idx] = customer
    else          stored.unshift(customer)
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(stored))
  } catch {}
}

export function deleteCustomer(id) {
  try {
    const raw    = localStorage.getItem(CUSTOMERS_KEY)
    const stored = raw ? JSON.parse(raw) : []
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(stored.filter(c => c.id !== id)))
    // If it's a mock customer, mark deleted so it doesn't re-appear from merge
    if (MOCK_CUSTOMERS.find(c => c.id === id)) {
      const withDel = [...stored.filter(c => c.id !== id), { id, _deleted: true }]
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(withDel))
    }
  } catch {}
}

// ── Derive stats for a customer from bookings array ───────────
export function getCustomerStats(customerId, customerName, bookings) {
  // Match by customer name (bookings store name not ID)
  const mine = bookings.filter(b => b.customer === customerName)
  return {
    totalTrips:     mine.length,
    completedTrips: mine.filter(b => b.status === 'completed').length,
    cancelledTrips: mine.filter(b => b.status === 'cancelled').length,
    activeTrips:    mine.filter(b => ['assigned','started'].includes(b.status)).length,
    totalRevenue:   mine.reduce((s, b) => s + (b.fare || 0), 0),
    lastTrip:       mine.sort((a,b) => b.createdAt?.localeCompare(a.createdAt ?? '') ?? 0)[0] || null,
    upcoming:       mine.filter(b => ['draft','confirmed','assigned'].includes(b.status))
                        .sort((a,b) => a.startDate?.localeCompare(b.startDate ?? '') ?? 0),
    recent:         mine.filter(b => b.status === 'completed')
                        .sort((a,b) => b.createdAt?.localeCompare(a.createdAt ?? '') ?? 0)
                        .slice(0, 5),
  }
}
