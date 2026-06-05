import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Phone, MapPin, Edit2, Trash2,
  X, ChevronDown, ChevronUp, Building2,
  FileText, Star, Calendar, CheckCircle,
  AlertTriangle, User, Navigation,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Avatar     from '../components/ui/Avatar'
import { useAuth } from '../context/AuthContext'
import {
  loadCustomers, saveCustomer, deleteCustomer, generateCustomerId,
  CUSTOMER_TYPES, getCustomerTypeCfg, getCustomerStats,
  MOCK_CUSTOMERS,
} from '../data/customerData'
import { loadBookings, TRIP_TYPE_CONFIG, getStatusCfg } from '../data/tripTypes'

// ─────────────────────────────────────────────────────────────
//  Type badge
// ─────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const cfg = getCustomerTypeCfg(type)
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
//  Add / Edit Customer Modal — Module 2 & 3
// ─────────────────────────────────────────────────────────────
const EMPTY_CUSTOMER = {
  id:'', type:'individual', status:'active',
  name:'', mobile:'', altMobile:'', email:'',
  address:'', city:'', state:'Tamil Nadu',
  gst:'', companyName:'', contactPerson:'', billingAddress:'',
  notes:'',
}

function CustomerModal({ customer, onClose, onSave }) {
  const isEdit = !!customer?.id
  const [form,   setForm]   = useState(() => customer || { ...EMPTY_CUSTOMER })
  const [errors, setErrors] = useState({})
  const upd = p => setForm(f => ({ ...f, ...p }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())   e.name   = 'Customer name is required'
    if (!form.mobile.trim()) e.mobile = 'Mobile number is required'
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const now = new Date().toISOString()
    onSave({
      ...form,
      id:        form.id || generateCustomerId(),
      createdAt: form.createdAt || now,
      updatedAt: now,
    })
  }

  function F({ label, field, type = 'text', required, placeholder }) {
    return (
      <div>
        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type={type} value={form[field] || ''} placeholder={placeholder}
          onChange={e => upd({ [field]: e.target.value })} required={required}
          className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-navy-800/60 text-slate-800 dark:text-slate-100
            focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all
            ${errors[field] ? 'border-red-400 dark:border-red-600' : 'border-slate-200 dark:border-navy-700'}`} />
        {errors[field] && <p className="text-[11px] text-red-500 mt-1">{errors[field]}</p>}
      </div>
    )
  }

  function Sel({ label, field, options }) {
    return (
      <div>
        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{label}</label>
        <select value={form[field] || ''} onChange={e => upd({ [field]: e.target.value })}
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/60 text-slate-800 dark:text-slate-100 focus:outline-none appearance-none">
          {options.map(o => typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
    )
  }

  function Sep({ title }) {
    return <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-t border-slate-100 dark:border-navy-700 pt-3 mt-1">{title}</p>
  }

  const isCorporate = form.type === 'corporate' || form.type === 'agent'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-[500px] max-h-[92vh] bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 flex flex-col">
        <div className="w-10 h-1 bg-slate-200 dark:bg-navy-700 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-700 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isEdit ? 'Edit Customer' : 'Add Customer'}</p>
            <h3 className="font-display font-black text-slate-800 dark:text-white text-base">
              {isEdit ? form.name : 'New Customer'}
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-navy-700">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><F label="Customer Name" field="name" required placeholder="Full name or company name" /></div>
            <F label="Mobile Number"     field="mobile"    required type="tel" placeholder="10-digit mobile" />
            <F label="Alternate Number"  field="altMobile" type="tel" placeholder="Optional" />
            <F label="Email"             field="email"     type="email" placeholder="email@example.com" />
            <Sel label="Customer Type" field="type" options={CUSTOMER_TYPES} />
          </div>

          {/* Address */}
          <Sep title="Address" />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><F label="Street Address" field="address" placeholder="Door no., Street name" /></div>
            <F label="City"  field="city"  placeholder="City" />
            <F label="State" field="state" placeholder="State" />
          </div>

          {/* Corporate fields */}
          {isCorporate && (
            <>
              <Sep title="Corporate Details" />
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><F label="Company Name"    field="companyName"    placeholder="Registered company name" /></div>
                <F label="Contact Person"  field="contactPerson" placeholder="Primary contact" />
                <F label="GST Number"      field="gst"           placeholder="GSTIN (optional)" />
                <div className="col-span-2"><F label="Billing Address" field="billingAddress" placeholder="GST billing address" /></div>
              </div>
            </>
          )}

          {/* Notes */}
          <Sep title="Notes" />
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              Customer Notes
            </label>
            <textarea value={form.notes || ''} onChange={e => upd({ notes: e.target.value })}
              placeholder="Preferred driver, vehicle, payment terms, VIP status…" rows={3}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/60 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/25 resize-none transition-all" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-navy-700 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-md active:scale-95">
            {isEdit ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Customer Profile / Detail Panel — Modules 4, 5, 7, 9
// ─────────────────────────────────────────────────────────────
function CustomerProfile({ customer, bookings, onEdit, onDelete, onBooking, canEdit, canDelete }) {
  const stats = getCustomerStats(customer.id, customer.name, bookings)
  const [tab,  setTab] = useState('overview')   // overview | trips | notes
  const isCorporate = customer.type === 'corporate' || customer.type === 'agent'

  return (
    <div className="border-t border-slate-100 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-800/20">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-3">
        {[['overview','Overview'],['trips','Trips'],['notes','Notes']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === k
                ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}>{l}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* ── Overview tab ── */}
        {tab === 'overview' && (
          <>
            {/* Booking stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label:'Total Trips',    value: stats.totalTrips,     color:'text-navy-800 dark:text-blue-300' },
                { label:'Completed',      value: stats.completedTrips, color:'text-emerald-600 dark:text-emerald-400' },
                { label:'Cancelled',      value: stats.cancelledTrips, color:'text-red-600 dark:text-red-400' },
                { label:'Total Revenue',  value: stats.totalRevenue > 0 ? `Rs.${(stats.totalRevenue/1000).toFixed(1)}k` : '—', color:'text-violet-600 dark:text-violet-400' },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-navy-800/60 rounded-xl p-2.5 border border-slate-100 dark:border-navy-700 text-center">
                  <p className={`text-lg font-display font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Contact details */}
            <div className="bg-white dark:bg-navy-800/60 rounded-xl p-3 border border-slate-100 dark:border-navy-700 space-y-2">
              {[
                { icon: Phone,    label:'Mobile',   value: customer.mobile        },
                ...(customer.altMobile ? [{ icon: Phone, label:'Alt. Mobile', value: customer.altMobile }] : []),
                ...(customer.email  ? [{ icon: FileText, label:'Email',    value: customer.email  }] : []),
                ...(customer.city   ? [{ icon: MapPin,   label:'City',     value: `${customer.city}${customer.state ? ', ' + customer.state : ''}` }] : []),
              ].map(d => (
                <div key={d.label} className="flex items-center gap-2.5">
                  <d.icon size={12} className="text-slate-400 flex-shrink-0" />
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 w-16 flex-shrink-0">{d.label}</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{d.value}</span>
                </div>
              ))}
            </div>

            {/* Corporate details — Module 6 */}
            {isCorporate && customer.companyName && (
              <div className="bg-violet-50 dark:bg-violet-900/15 rounded-xl p-3 border border-violet-200 dark:border-violet-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={13} className="text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <p className="text-xs font-bold text-violet-700 dark:text-violet-400">{customer.companyName}</p>
                </div>
                <div className="space-y-1">
                  {customer.contactPerson && (
                    <p className="text-[10px] text-violet-600 dark:text-violet-500">Contact: {customer.contactPerson}</p>
                  )}
                  {customer.gst && (
                    <p className="text-[10px] font-mono text-violet-600 dark:text-violet-500">GST: {customer.gst}</p>
                  )}
                  {customer.billingAddress && (
                    <p className="text-[10px] text-violet-600 dark:text-violet-500">{customer.billingAddress}</p>
                  )}
                </div>
              </div>
            )}

            {/* Upcoming trips */}
            {stats.upcoming.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Upcoming Trips</p>
                <div className="space-y-1.5">
                  {stats.upcoming.slice(0, 2).map(b => {
                    const typeCfg = TRIP_TYPE_CONFIG[b.type]
                    const stCfg   = getStatusCfg(b.status)
                    return (
                      <div key={b.id} className="flex items-center gap-2.5 bg-white dark:bg-navy-800/60 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-navy-700">
                        <span className="text-base flex-shrink-0">{typeCfg?.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{b.pickup} → {b.drop || '—'}</p>
                          <p className="text-[10px] text-slate-400">{b.startDate} {b.startTime || ''}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${stCfg.badge}`}>{stCfg.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Trips tab — Module 5 ── */}
        {tab === 'trips' && (
          <div>
            {stats.recent.length === 0 && stats.upcoming.length === 0 ? (
              <div className="text-center py-6">
                <Navigation size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">No trips on record yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...stats.upcoming, ...stats.recent].map(b => {
                  const typeCfg = TRIP_TYPE_CONFIG[b.type]
                  const stCfg   = getStatusCfg(b.status)
                  return (
                    <div key={b.id} className="bg-white dark:bg-navy-800/60 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-navy-700">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm flex-shrink-0">{typeCfg?.icon}</span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-mono text-slate-400">{b.bookingNo}</p>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{b.pickup} → {b.drop || '—'}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${stCfg.badge}`}>{stCfg.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar size={9} />{b.startDate}</span>
                        {b.driver   && <span className="flex items-center gap-1"><User size={9} />{b.driver}</span>}
                        {b.vehicle  && <span className="flex items-center gap-1"><span>🚗</span>{b.vehicle}</span>}
                        {b.fare > 0 && <span className="font-bold text-navy-700 dark:text-blue-300 ml-auto">Rs. {b.fare.toLocaleString('en-IN')}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Notes tab — Module 7 ── */}
        {tab === 'notes' && (
          <div>
            {customer.notes ? (
              <div className="bg-amber-50 dark:bg-amber-900/15 rounded-xl p-4 border border-amber-200 dark:border-amber-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={13} className="text-amber-500 fill-amber-500" />
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Customer Notes</p>
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{customer.notes}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-2">
                  Last updated: {customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString('en-IN') : '—'}
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <Star size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">No notes added yet</p>
                {canEdit && (
                  <button onClick={() => onEdit(customer)}
                    className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700">
                    Add a note →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap pt-1">
          {/* Module 9: Quick booking */}
          <button onClick={() => onBooking(customer)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all active:scale-95 shadow-md">
            <Plus size={13} /> Create Booking
          </button>
          {canEdit && (
            <button onClick={() => onEdit(customer)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
              <Edit2 size={13} /> Edit
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(customer.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/25 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Quick Booking Mini-Modal — Module 9
// ─────────────────────────────────────────────────────────────
function QuickBookingModal({ customer, onClose }) {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-80 bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl z-10">
        <div className="w-10 h-1 bg-slate-200 dark:bg-navy-700 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="text-center mb-5">
          <Avatar name={customer.name} size={48} className="mx-auto mb-3" />
          <h3 className="font-display font-black text-slate-800 dark:text-white text-base">{customer.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{customer.mobile}</p>
        </div>
        <div className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-3 mb-4 space-y-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Will auto-fill in booking form</p>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Customer Name</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{customer.name}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Mobile</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{customer.mobile}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
            Cancel
          </button>
          <button onClick={() => { onClose(); navigate('/trips', { state: { prefill: { customer: customer.name, contact: customer.mobile } } }) }}
            className="flex-1 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-md active:scale-95">
            Open Trips →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main Customers Page
// ─────────────────────────────────────────────────────────────
export default function Customers() {
  const { isAdmin, isManager, isDriver } = useAuth()

  const canAdd    = isAdmin || isManager
  const canEdit   = isAdmin || isManager
  const canDelete = isAdmin

  const bookings = loadBookings()

  const [customers,      setCustomers]     = useState(() => loadCustomers().filter(c => !c._deleted))
  const [search,         setSearch]        = useState('')
  const [typeFilter,     setTypeFilter]    = useState('all')
  const [sortBy,         setSortBy]        = useState('name')
  const [expanded,       setExpanded]      = useState(null)
  const [showAdd,        setShowAdd]       = useState(false)
  const [editCustomer,   setEditCustomer]  = useState(null)
  const [bookingFor,     setBookingFor]    = useState(null)
  const [toast,          setToast]         = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const reload    = () => setCustomers(loadCustomers().filter(c => !c._deleted))

  // ── Derived ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    return customers
      .filter(c => {
        const q = search.toLowerCase()
        const matchSearch = !q || c.name.toLowerCase().includes(q)
          || c.mobile.includes(q)
          || (c.email || '').toLowerCase().includes(q)
          || (c.city  || '').toLowerCase().includes(q)
          || (c.companyName || '').toLowerCase().includes(q)
        const matchType = typeFilter === 'all' || c.type === typeFilter
        return matchSearch && matchType
      })
      .sort((a, b) => {
        if (sortBy === 'name')    return a.name.localeCompare(b.name)
        if (sortBy === 'city')    return (a.city || '').localeCompare(b.city || '')
        if (sortBy === 'recent')  return (b.updatedAt || '').localeCompare(a.updatedAt || '')
        return 0
      })
  }, [customers, search, typeFilter, sortBy])

  // Module 8 counts
  const thisMonth     = new Date().toISOString().slice(0, 7)
  const newThisMonth  = customers.filter(c => c.createdAt?.startsWith(thisMonth)).length
  const corporateCount = customers.filter(c => c.type === 'corporate' || c.type === 'agent').length

  const handleSave = (c) => {
    saveCustomer(c)
    reload()
    setShowAdd(false)
    setEditCustomer(null)
    showToast(editCustomer ? 'Customer updated' : 'Customer added')
  }

  const handleDelete = (id) => {
    if (!window.confirm('Delete this customer? This cannot be undone.')) return
    deleteCustomer(id)
    reload()
    setExpanded(null)
    showToast('Customer deleted')
  }

  if (isDriver) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <AlertTriangle size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="font-bold text-slate-500 dark:text-slate-400">Customer management is not available for drivers.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customers in directory`}
        action={canAdd
          ? <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white font-bold text-sm hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-lg active:scale-95">
              <Plus size={15} /> Add Customer
            </button>
          : null}
      />

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-2.5">
          <CheckCircle size={15} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{toast}</p>
        </div>
      )}

      {/* Module 8: Dashboard widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Customers',   value: customers.length,  color:'text-navy-800 dark:text-blue-300',          filter:'all'        },
          { label:'Individual',        value: customers.filter(c=>c.type==='individual').length, color:'text-blue-600 dark:text-blue-400', filter:'individual' },
          { label:'Corporate / Agent', value: corporateCount,    color:'text-violet-600 dark:text-violet-400',       filter:'corporate'  },
          { label:'New This Month',    value: newThisMonth,      color:'text-emerald-600 dark:text-emerald-400',     filter:'all'        },
        ].map(s => (
          <div key={s.label} onClick={() => setTypeFilter(s.filter)}
            className="glass-card rounded-xl p-4 text-center hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5">
            <p className={`text-2xl font-display font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-wrap gap-2.5 items-center">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-800/60 flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Name, mobile, city…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none w-full font-body" />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1">
          {[['all','All'], ...CUSTOMER_TYPES.map(t => [t.key, t.label])].map(([k,l]) => (
            <button key={k} onClick={() => setTypeFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                typeFilter === k
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                  : 'text-slate-500 dark:text-slate-400'
              }`}>{l}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none font-body">
          <option value="name">Sort: Name</option>
          <option value="city">Sort: City</option>
          <option value="recent">Sort: Recent</option>
        </select>
      </div>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <User size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No customers found</p>
          {canAdd && (
            <button onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold hover:bg-navy-800 transition-all">
              <Plus size={13} /> Add First Customer
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(c => {
            const isOpen  = expanded === c.id
            const isCorp  = c.type === 'corporate' || c.type === 'agent'
            const stats   = getCustomerStats(c.id, c.name, bookings)

            return (
              <div key={c.id} className="glass-card rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200">
                {/* Row */}
                <div className="flex items-center gap-3 p-4 cursor-pointer select-none"
                     onClick={() => setExpanded(isOpen ? null : c.id)}>
                  <div className="relative flex-shrink-0">
                    <Avatar name={c.name} size={40} />
                    {c.notes && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white dark:border-navy-800" title="Has notes" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-slate-800 dark:text-white text-sm">{c.name}</p>
                      {isCorp && c.companyName && (
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[100px]">{c.companyName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <Phone size={9} className="flex-shrink-0" />
                      <span>{c.mobile}</span>
                      {c.city && <><span className="text-slate-300 dark:text-navy-600 mx-1">·</span><MapPin size={9} className="flex-shrink-0" /><span>{c.city}</span></>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <TypeBadge type={c.type} />
                    {stats.totalTrips > 0 && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{stats.totalTrips} trip{stats.totalTrips !== 1 ? 's' : ''}</p>
                    )}
                  </div>

                  {isOpen ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0 ml-1" />
                           : <ChevronDown size={14} className="text-slate-400 flex-shrink-0 ml-1" />}
                </div>

                {/* Expanded profile */}
                {isOpen && (
                  <CustomerProfile
                    customer={c}
                    bookings={bookings}
                    onEdit={setEditCustomer}
                    onDelete={handleDelete}
                    onBooking={setBookingFor}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {(showAdd || editCustomer) && (
        <CustomerModal
          customer={editCustomer}
          onClose={() => { setShowAdd(false); setEditCustomer(null) }}
          onSave={handleSave}
        />
      )}
      {bookingFor && (
        <QuickBookingModal customer={bookingFor} onClose={() => setBookingFor(null)} />
      )}
    </div>
  )
}
