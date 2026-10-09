import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Phone, MapPin, Edit2, Trash2,
  X, ChevronDown, ChevronUp, Building2,
  FileText, Star, Repeat, Ban, Calendar,
  AlertTriangle, User, Navigation,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Avatar     from '../components/ui/Avatar'
import Button     from '../components/ui/Button'
import MetricCard from '../components/ui/MetricCard'
import Callout    from '../components/ui/Callout'
import EmptyState from '../components/ui/EmptyState'
import IconButton from '../components/ui/IconButton'
import { fieldCls, Select as FieldSelect, Textarea as FieldTextarea } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import {
  loadCustomers, saveCustomer, deleteCustomer, generateCustomerId,
  CUSTOMER_TYPES, getCustomerTypeCfg, getCustomerStats,
} from '../data/customerData'
import { loadBookings, TRIP_TYPE_CONFIG, getStatusCfg } from '../data/tripTypes'
import ModalOverlay from '../components/ui/ModalOverlay'
import { addAuditEvent } from '../data/auditLogData'
import { pageSizeFor } from '../utils/zoomPageSize'

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
//  Input Restrictions & Validation Rules
// ─────────────────────────────────────────────────────────────
const FIELD_RESTRICTIONS = {
  name: {
    maxLength: 50,
    minLength: 2,
    pattern: /^[a-zA-Z\s\-'.]*$/,
    errorMsg: 'Only letters, spaces, hyphens, and apostrophes allowed',
    placeholder: 'Full name or company name (2-50 chars)',
  },
  mobile: {
    maxLength: 10,
    minLength: 10,
    pattern: /^[0-9]*$/,
    errorMsg: 'Mobile must be exactly 10 digits',
    placeholder: '10-digit mobile number (e.g., 9876543210)',
  },
  altMobile: {
    maxLength: 10,
    minLength: 0,
    pattern: /^[0-9]*$/,
    errorMsg: 'Mobile must be 10 digits',
    placeholder: '10 digits only (optional)',
  },
  email: {
    maxLength: 100,
    pattern: /^[^\s]*@?[^\s]*\.?[^\s]*$/,
    errorMsg: 'Please enter a valid email address',
    placeholder: 'user@example.com (optional)',
  },
  city: {
    maxLength: 30,
    pattern: /^[a-zA-Z\s\-'.]*$/,
    errorMsg: 'Only letters, spaces, hyphens, and apostrophes allowed',
    placeholder: 'City name (optional)',
  },
  state: {
    maxLength: 30,
    pattern: /^[a-zA-Z\s\-'.]*$/,
    errorMsg: 'Only letters, spaces, hyphens, and apostrophes allowed',
    placeholder: 'State name (optional)',
  },
  address: {
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-',./]*$/,
    errorMsg: 'Address contains invalid characters',
    placeholder: 'Door no., Street name (optional)',
  },
  companyName: {
    maxLength: 60,
    pattern: /^[a-zA-Z0-9\s\-'.&()]*$/,
    errorMsg: 'Only alphanumeric, spaces, and basic punctuation allowed',
    placeholder: 'Registered company name (optional)',
  },
  contactPerson: {
    maxLength: 50,
    pattern: /^[a-zA-Z\s\-'.]*$/,
    errorMsg: 'Only letters, spaces, hyphens, and apostrophes allowed',
    placeholder: 'Primary contact name (optional)',
  },
  gst: {
    maxLength: 15,
    pattern: /^[0-9A-Z]*$/,
    errorMsg: 'GST must be 15 alphanumeric characters (e.g., 29AAACM0000A1Z5)',
    placeholder: 'GSTIN - 15 characters (optional)',
  },
  billingAddress: {
    maxLength: 120,
    pattern: /^[a-zA-Z0-9\s\-',./]*$/,
    errorMsg: 'Address contains invalid characters',
    placeholder: 'GST billing address (optional)',
  },
  notes: {
    maxLength: 300,
    errorMsg: 'Notes cannot exceed 300 characters',
    placeholder: 'Preferred driver, vehicle, payment terms, VIP status…',
  },
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
  isVip:false, isBlacklisted:false, isFrequentTraveller:false,
  emergencyName:'', emergencyContact:'',
}

// ─ Separate field input component to prevent re-renders ─
function FormField({ label, field, type = 'text', required, placeholder, value, onChange, error }) {
  const restrictions = FIELD_RESTRICTIONS[field]
  const maxLength = restrictions?.maxLength
  const currentLength = (value || '').length

  const handleChange = (e) => {
    let inputValue = e.target.value

    // Apply restrictions
    if (restrictions) {
      // Enforce max length
      if (maxLength && inputValue.length > maxLength) {
        inputValue = inputValue.slice(0, maxLength)
      }

      // Special handling for mobile fields - only numbers
      if (field === 'mobile' || field === 'altMobile') {
        inputValue = inputValue.replace(/\D/g, '')
      }

      // Special handling for GST - uppercase
      if (field === 'gst') {
        inputValue = inputValue.toUpperCase()
      }

      // Apply pattern restriction (only for non-email fields)
      // Email is validated on save only, not during typing
      if (restrictions.pattern && inputValue.length > 0 && field !== 'email') {
        // For pattern validation, check character by character
        const lastChar = inputValue[inputValue.length - 1]
        if (!restrictions.pattern.test(inputValue)) {
          // Remove the last invalid character
          inputValue = inputValue.slice(0, -1)
        }
      }
    }

    onChange({ target: { value: inputValue } })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {maxLength && (
          <span className={`text-[9px] font-semibold ${
            currentLength > maxLength * 0.9
              ? 'text-red-500'
              : currentLength > maxLength * 0.7
              ? 'text-amber-500'
              : 'text-slate-500 dark:text-slate-400'
          }`}>
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
      <input
        type={type}
        value={value || ''}
        placeholder={restrictions?.placeholder || placeholder}
        onChange={handleChange}
        maxLength={maxLength || undefined}
        required={required}
        className={`${fieldCls} ${error ? 'border-red-400 dark:border-red-500' : ''}`}
      />
      {error && (
        <div className="mt-1 flex items-start gap-1.5">
          <span className="text-red-500 text-[10px] font-bold mt-0.5">⚠</span>
          <p className="text-[11px] text-red-500">{error}</p>
        </div>
      )}
    </div>
  )
}

// ─ Separate select component ─
function FormSelect({ label, field, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{label}</label>
      <FieldSelect
        value={value || ''}
        onChange={onChange}
      >
        {options.map(o => typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.key} value={o.key}>{o.label}</option>)}
      </FieldSelect>
    </div>
  )
}

// ─ Section separator ─
function FormSection({ title }) {
  return <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-t border-[var(--ap-border)] pt-3 mt-1">{title}</p>
}

function CustomerModal({ customer, onClose, onSave }) {
  const isEdit = !!customer?.id
  const [form,   setForm]   = useState(() => customer || { ...EMPTY_CUSTOMER })
  const [errors, setErrors] = useState({})

  // ─ Use useCallback to memoize the updater function ─
  const upd = useCallback(p => setForm(f => ({ ...f, ...p })), [])

  const validate = () => {
    const e = {}

    // Required field validations
    if (!form.name.trim()) {
      e.name = 'Customer name is required'
    } else {
      const nameRes = FIELD_RESTRICTIONS.name
      if (form.name.length < nameRes.minLength) {
        e.name = `Name must be at least ${nameRes.minLength} characters`
      } else if (!nameRes.pattern.test(form.name)) {
        e.name = nameRes.errorMsg
      }
    }

    if (!form.mobile.trim()) {
      e.mobile = 'Mobile number is required'
    } else {
      const mobileRes = FIELD_RESTRICTIONS.mobile
      if (form.mobile.length !== mobileRes.maxLength) {
        e.mobile = `Mobile must be exactly ${mobileRes.maxLength} digits`
      } else if (!mobileRes.pattern.test(form.mobile)) {
        e.mobile = 'Mobile must contain only numbers'
      }
    }

    // Optional field validations (only if not empty)
    if (form.altMobile.trim()) {
      const altRes = FIELD_RESTRICTIONS.altMobile
      if (form.altMobile.length !== altRes.maxLength) {
        e.altMobile = `Alternate mobile must be ${altRes.maxLength} digits`
      } else if (!altRes.pattern.test(form.altMobile)) {
        e.altMobile = 'Must contain only numbers'
      }
    }

    if (form.email.trim()) {
      const emailRes = FIELD_RESTRICTIONS.email
      // Proper email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(form.email)) {
        e.email = emailRes.errorMsg
      }
    }

    if (form.gst.trim()) {
      const gstRes = FIELD_RESTRICTIONS.gst
      if (form.gst.length !== 15) {
        e.gst = 'GST must be exactly 15 characters'
      } else if (!gstRes.pattern.test(form.gst)) {
        e.gst = gstRes.errorMsg
      }
    }

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

  const isCorporate = form.type === 'corporate' || form.type === 'agent'

  // ─ Memoized change handlers for each field ─
  const handleNameChange = useCallback(e => upd({ name: e.target.value }), [upd])
  const handleMobileChange = useCallback(e => upd({ mobile: e.target.value }), [upd])
  const handleAltMobileChange = useCallback(e => upd({ altMobile: e.target.value }), [upd])
  const handleEmailChange = useCallback(e => upd({ email: e.target.value }), [upd])
  const handleTypeChange = useCallback(e => upd({ type: e.target.value }), [upd])
  const handleAddressChange = useCallback(e => upd({ address: e.target.value }), [upd])
  const handleCityChange = useCallback(e => upd({ city: e.target.value }), [upd])
  const handleStateChange = useCallback(e => upd({ state: e.target.value }), [upd])
  const handleCompanyNameChange = useCallback(e => upd({ companyName: e.target.value }), [upd])
  const handleContactPersonChange = useCallback(e => upd({ contactPerson: e.target.value }), [upd])
  const handleGstChange = useCallback(e => upd({ gst: e.target.value }), [upd])
  const handleBillingAddressChange = useCallback(e => upd({ billingAddress: e.target.value }), [upd])
  const handleNotesChange = useCallback(e => upd({ notes: e.target.value }), [upd])

  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative w-full sm:w-[500px] max-h-[92vh] sm:max-h-[85vh] ap-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-slate-500/20 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ap-border)] flex-shrink-0">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{isEdit ? 'Edit Customer' : 'Add Customer'}</p>
            <h3 className="font-sf font-semibold text-slate-900 dark:text-white text-base tracking-tight">
              {isEdit ? form.name : 'New Customer'}
            </h3>
          </div>
          <IconButton icon={X} label="Close customer form" size={16} onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-500/10" />
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FormField
                label="Customer Name"
                field="name"
                required
                value={form.name}
                onChange={handleNameChange}
                error={errors.name}
              />
            </div>
            <FormField
              label="Mobile Number"
              field="mobile"
              required
              type="tel"
              value={form.mobile}
              onChange={handleMobileChange}
              error={errors.mobile}
            />
            <FormField
              label="Alternate Number"
              field="altMobile"
              type="tel"
              value={form.altMobile}
              onChange={handleAltMobileChange}
              error={errors.altMobile}
            />
            <FormField
              label="Email"
              field="email"
              type="email"
              value={form.email}
              onChange={handleEmailChange}
              error={errors.email}
            />
            <FormSelect
              label="Customer Type"
              field="type"
              value={form.type}
              onChange={handleTypeChange}
              options={CUSTOMER_TYPES}
            />
          </div>

          {/* Address */}
          <FormSection title="Address" />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FormField
                label="Street Address"
                field="address"
                value={form.address}
                onChange={handleAddressChange}
                error={errors.address}
              />
            </div>
            <FormField
              label="City"
              field="city"
              value={form.city}
              onChange={handleCityChange}
              error={errors.city}
            />
            <FormField
              label="State"
              field="state"
              value={form.state}
              onChange={handleStateChange}
              error={errors.state}
            />
          </div>

          {/* Corporate fields */}
          {isCorporate && (
            <>
              <FormSection title="Corporate Details" />
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <FormField
                    label="Company Name"
                    field="companyName"
                    value={form.companyName}
                    onChange={handleCompanyNameChange}
                    error={errors.companyName}
                  />
                </div>
                <FormField
                  label="Contact Person"
                  field="contactPerson"
                  value={form.contactPerson}
                  onChange={handleContactPersonChange}
                  error={errors.contactPerson}
                />
                <FormField
                  label="GST Number"
                  field="gst"
                  value={form.gst}
                  onChange={handleGstChange}
                  error={errors.gst}
                />
                <div className="col-span-2">
                  <FormField
                    label="Billing Address"
                    field="billingAddress"
                    value={form.billingAddress}
                    onChange={handleBillingAddressChange}
                    error={errors.billingAddress}
                  />
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <FormSection title="Notes" />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Customer Notes
              </label>
              <span className={`text-[9px] font-semibold ${
                form.notes.length > 270 ? 'text-red-500' : form.notes.length > 210 ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'
              }`}>{form.notes.length}/300</span>
            </div>
            <FieldTextarea
              value={form.notes || ''}
              onChange={e => { let val = e.target.value; if (val.length > 300) val = val.slice(0,300); handleNotesChange({ target:{ value:val } }) }}
              placeholder="Preferred driver, vehicle, payment terms…"
              rows={3} maxLength={300}
            />
          </div>

          {/* Emergency Contact */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 mt-1">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Contact Name</label>
                <input value={form.emergencyName||''} onChange={e=>upd({emergencyName:e.target.value})} placeholder="Family member / Friend"
                  className={fieldCls} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Mobile</label>
                <input value={form.emergencyContact||''} onChange={e=>upd({emergencyContact:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="10-digit mobile"
                  className={fieldCls} />
              </div>
            </div>
          </div>

          {/* Customer Flags */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 mt-1">Customer Flags</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { key:'isVip',               label:'⭐ VIP Customer',       on:'border-amber-400 bg-amber-500/10 text-amber-700 dark:text-amber-300'  },
                { key:'isFrequentTraveller', label:'🔁 Frequent Traveller', on:'border-blue-400 bg-blue-500/10 text-blue-700 dark:text-blue-300'     },
                { key:'isBlacklisted',       label:'🚫 Blacklisted',        on:'border-red-400 bg-red-500/10 text-red-700 dark:text-red-300'          },
              ].map(f => (
                <button key={f.key} type="button" onClick={() => upd({ [f.key]: !form[f.key] })}
                  className={`ap-focus flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                    form[f.key] ? `${f.on} ring-2 ring-current/30` : 'border-[var(--ap-border)] text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)]'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-[var(--ap-border)] bg-[var(--ap-surface-2)] rounded-b-3xl flex-shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleSave}>{isEdit ? 'Update' : 'Create'} Customer</Button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────────────────────
//  Customer Profile (expanded details)
// ─────────────────────────────────────────────────────────────
function CustomerProfile({ customer, bookings, onEdit, onDelete, onBooking, onFlag, canEdit, canDelete }) {
  const isCorp = customer.type === 'corporate' || customer.type === 'agent'
  const stats = getCustomerStats(customer.id, customer.name, bookings)

  const renderField = (label, value, icon = null, href = null) => (
    value ? (
      <div className="flex items-start gap-2.5">
        {icon && <span className="text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5">{icon}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">{label}</p>
          {href ? (
            <a href={href} className="text-blue-600 dark:text-blue-400 text-sm font-semibold break-words hover:underline">{value}</a>
          ) : (
            <p className="text-slate-800 dark:text-slate-100 text-sm break-words">{value}</p>
          )}
        </div>
      </div>
    ) : null
  )

  const flags = [
    { key: 'isVip',               label: 'VIP',      Icon: Star,   on: 'border-amber-400 bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-300'  },
    { key: 'isFrequentTraveller', label: 'Frequent', Icon: Repeat, on: 'border-blue-400 bg-blue-50 dark:bg-blue-900/15 text-blue-700 dark:text-blue-300'      },
    { key: 'isBlacklisted',       label: 'Listed',   Icon: Ban,    on: 'border-red-400 bg-red-50 dark:bg-red-900/15 text-red-700 dark:text-red-300'            },
  ]

  return (
    <div className="border-t border-[var(--ap-border)] bg-[var(--ap-surface-2)] px-4 py-4 space-y-4">

      {/* VIP / Blacklist badges */}
      {(customer.isVip || customer.isBlacklisted || customer.isFrequentTraveller) && (
        <div className="flex gap-2 flex-wrap">
          {customer.isVip               && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">⭐ VIP</span>}
          {customer.isFrequentTraveller && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">🔁 Frequent</span>}
          {customer.isBlacklisted       && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">🚫 Blacklisted</span>}
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        {renderField('Customer No.', customer.customer_id)}
        {renderField('Name', customer.name)}
        {renderField('Type', getCustomerTypeCfg(customer.type).label)}
        {renderField('Mobile', customer.mobile, <Phone size={14} />, `tel:${customer.mobile}`)}
        {renderField('Alternate', customer.altMobile)}
        {renderField('Email', customer.email)}
        {renderField('Status', customer.status)}
      </div>

      {/* Address */}
      {(customer.address || customer.city || customer.state) && (
        <>
          <div className="border-t border-[var(--ap-border)] pt-3" />
          <div className="grid grid-cols-2 gap-4">
            {renderField('Address', customer.address, <MapPin size={14} />)}
            {renderField('City', customer.city)}
            {renderField('State', customer.state)}
          </div>
        </>
      )}

      {/* Corporate */}
      {isCorp && (customer.companyName || customer.gst) && (
        <>
          <div className="border-t border-[var(--ap-border)] pt-3" />
          <div className="grid grid-cols-2 gap-4">
            {renderField('Company', customer.companyName, <Building2 size={14} />)}
            {renderField('Contact', customer.contactPerson)}
            {renderField('GST', customer.gst)}
            {renderField('Billing Address', customer.billingAddress)}
          </div>
        </>
      )}

      {/* Notes */}
      {customer.notes && (
        <>
          <div className="border-t border-[var(--ap-border)] pt-3" />
          <div className="flex gap-2.5">
            <FileText size={14} className="text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Notes</p>
              <p className="text-slate-700 dark:text-slate-300 text-sm">{customer.notes}</p>
            </div>
          </div>
        </>
      )}

      {/* Emergency Contact */}
      {(customer.emergencyName || customer.emergencyContact) && (
        <>
          <div className="border-t border-[var(--ap-border)] pt-3" />
          <div className="grid grid-cols-2 gap-3">
            {customer.emergencyName    && renderField('Emergency Name',   customer.emergencyName)}
            {customer.emergencyContact && renderField('Emergency Mobile', customer.emergencyContact)}
          </div>
        </>
      )}

      {/* Stats */}
      {stats.totalTrips > 0 && (
        <>
          <div className="border-t border-[var(--ap-border)] pt-3" />
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-lg bg-[var(--ap-surface)] p-2">
              <p className="font-sf font-semibold text-slate-900 dark:text-white">{stats.totalTrips}</p>
              <p className="text-slate-500 dark:text-slate-400 text-[9px]">Total Trips</p>
            </div>
            <div className="rounded-lg bg-[var(--ap-surface)] p-2">
              <p className="font-bold text-emerald-600 dark:text-emerald-400">{stats.completedTrips}</p>
              <p className="text-slate-500 dark:text-slate-400 text-[9px]">Completed</p>
            </div>
            <div className="rounded-lg bg-[var(--ap-surface)] p-2">
              <p className="font-bold text-blue-600 dark:text-blue-400">{stats.activeTrips}</p>
              <p className="text-slate-500 dark:text-slate-400 text-[9px]">Active</p>
            </div>
            <div className="rounded-lg bg-[var(--ap-surface)] p-2">
              <p className="font-bold text-slate-800 dark:text-white">₹{stats.totalRevenue?.toLocaleString('en-IN')}</p>
              <p className="text-slate-500 dark:text-slate-400 text-[9px]">Revenue</p>
            </div>
          </div>
        </>
      )}

      {/* Quick flags — tap to flag/unflag without opening Edit */}
      {canEdit && (
        <div className="border-t border-[var(--ap-border)] pt-3 flex gap-2 flex-wrap">
          {flags.map(({ key, label, Icon, on }) => {
            const isOn = !!customer[key]
            return (
              <button key={key} onClick={() => onFlag && onFlag(customer, key)}
                aria-pressed={isOn}
                className={`flex items-center gap-1.5 px-3 min-h-[32px] rounded-lg border text-[11px] font-bold transition-all active:scale-95 ${
                  isOn ? on : 'border-[var(--ap-border)] text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)]'
                }`}>
                <Icon size={12} /> {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-[var(--ap-border)] pt-3 flex gap-2">
        {canEdit && (
          <button onClick={() => onEdit(customer)} aria-label={`Edit ${customer.name}`}
            className="flex items-center gap-2 px-3 py-2 min-h-[36px] rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all flex-1">
            <Edit2 size={12} /> Edit
          </button>
        )}
        <button onClick={() => onBooking(customer)} aria-label={`Book trip for ${customer.name}`}
          className="flex items-center gap-2 px-3 py-2 min-h-[36px] rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all flex-1">
          <Calendar size={12} /> Book Trip
        </button>
        {canDelete && (
          <button onClick={() => onDelete(customer.id)} aria-label={`Delete ${customer.name}`}
            className="flex items-center gap-2 px-3 py-2 min-h-[36px] rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-all">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Upcoming trips */}
      {stats.upcoming?.length > 0 && (
        <>
          <div className="border-t border-[var(--ap-border)] pt-3" />
          <div>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Upcoming Trips</p>
            <div className="space-y-1.5">
              {stats.upcoming.slice(0, 3).map(b => (
                <div key={b.id} className="flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--ap-surface)]">
                  <span className="flex-1">{b.tripType}</span>
                  <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{b.startDate?.split('T')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main Customers List
// ─────────────────────────────────────────────────────────────export default function Customers() {
export default function Customers() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  // ── Async state ────────────────────────────────────────────
  const [customers,    setCustomers]    = useState([])
  const [bookings,     setBookings]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showAdd,      setShowAdd]      = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [flagFilter,   setFlagFilter]   = useState('all')
  const [sortBy,       setSortBy]       = useState('name')
  const [expanded,     setExpanded]     = useState(null)
  const [loadError,    setLoadError]    = useState(null)

  // ── Pagination: zoom-adaptive rows per page + go-to-page ───
  // 90% → 7 · 100% → 6 · 110%+ → 5 (phones stay at 5).
  const [pageSize, setPageSize] = useState(() => pageSizeFor(6, 5))
  const [page, setPage] = useState(1)
  const [goPage, setGoPage] = useState('')
  useEffect(() => {
    const onResize = () => {
      setPageSize(prev => {
        const next = pageSizeFor(6, 5)
        if (next !== prev) setPage(1)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Book Trip goes straight to Trips with the customer prefilled (no confirm modal)
  const bookTripFor = (c) => navigate('/trips', { state: { prefill: { customer: c.name, contact: c.mobile || '' } } })

  const canAdd    = ['admin', 'manager'].includes(user?.role)
  const canEdit   = ['admin', 'manager'].includes(user?.role)
  const canDelete = user?.role === 'admin'

  // ── Load from Supabase on mount ────────────────────────────
  const reload = useCallback(async () => {
    try {
      const [c, b] = await Promise.all([loadCustomers(), loadBookings()])
      setCustomers(Array.isArray(c) ? c.filter(x => !x._deleted) : [])
      setBookings(Array.isArray(b) ? b : [])
      setLoadError(null)
    } catch (err) {
      console.error('[Customers] load failed:', err)
      setLoadError('Could not load customers. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const showToast = (title) => toast?.({ type: 'success', title })

  const handleSave = async (customer) => {
    const isNew = !customers.find(c => c.id === customer.id)
    try {
      await saveCustomer(customer)
      if (isNew) {
        addAuditEvent('CUSTOMER_ADDED', { description: `${customer.name} — ${customer.type || 'individual'}` })
      }
      await reload()
      setShowAdd(false)
      setEditCustomer(null)
      showToast(`${isNew ? 'Added' : 'Updated'} ${customer.name}`)
    } catch (err) {
      console.error('[Customers] save failed:', err)
      toast?.({ type: 'error', title: 'Could not save customer. Please try again.' })
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    try {
      await deleteCustomer(id)
      await reload()
      showToast('Customer deleted')
    } catch (err) {
      console.error('[Customers] delete failed:', err)
      toast?.({ type: 'error', title: 'Could not delete customer. Please try again.' })
    }
  }

  // Quick flag toggle (VIP / Frequent / Blacklisted) — saves immediately
  const handleFlag = async (customer, key) => {
    try {
      await saveCustomer({ ...customer, [key]: !customer[key], updatedAt: new Date().toISOString() })
      await reload()
      showToast(`${customer.name} ${!customer[key] ? 'flagged' : 'unflagged'}`)
    } catch (err) {
      console.error('[Customers] flag failed:', err)
      toast?.({ type: 'error', title: 'Could not update flag. Please try again.' })
    }
  }

  const filtered = useMemo(() => {
    return customers
      .filter(c => typeFilter === 'all' || c.type === typeFilter)
      .filter(c => {
        if (flagFilter === 'vip')         return c.isVip
        if (flagFilter === 'frequent')    return c.isFrequentTraveller
        if (flagFilter === 'blacklisted') return c.isBlacklisted
        return true
      })
      .sort((a, b) =>
        sortBy === 'name'   ? (a.name ?? '').localeCompare(b.name ?? '') :
        sortBy === 'city'   ? (a.city || '').localeCompare(b.city || '') :
        sortBy === 'recent' ? (b.updatedAt || '').localeCompare(a.updatedAt || '') :
        0
      )
  }, [customers, typeFilter, flagFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  useEffect(() => { setPage(1) }, [typeFilter, flagFilter, sortBy, customers.length, pageSize])

  const pageItems = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const set = new Set([1, 2, safePage - 1, safePage, safePage + 1, totalPages - 1, totalPages])
    const nums = [...set].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b)
    const out = []
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('…')
      out.push(n)
    })
    return out
  })()

  const goToPage = () => {
    const n = parseInt(goPage, 10)
    if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), totalPages))
    setGoPage('')
  }

  const corporateCount = customers.filter(c => c.type === 'corporate' || c.type === 'agent').length
  const newThisMonth = customers.filter(c => {
    const created = new Date(c.createdAt || 0)
    const now = new Date()
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
  }).length

  if (user?.role === 'driver') {
    return (
      <div className="space-y-5 animate-fade-up">
        <PageHeader title="Customers" subtitle="Driver access view" />
        <div className="ap-surface rounded-2xl">
          <EmptyState icon={User} title="Customer management is not available for drivers." />
        </div>
      </div>
    )
  }

  // Compact density fits one screen at 100% zoom; the page flows
  // naturally (sticky pagination included) so 90–110% zoom never clips.
  return (
    <div className="space-y-3 md:space-y-2 animate-fade-up">
      <PageHeader compact
        title="Customers"
        subtitle={`${customers.length} customers in directory`}
        action={canAdd
          ? <Button icon={Plus} onClick={() => setShowAdd(true)}>Add Customer</Button>
          : null}
      />

      {loadError && (
        <Callout tone="red" icon={AlertTriangle} title={loadError} actionLabel="Retry" onAction={reload} />
      )}

      {/* Widgets — one row, New This Month is display-only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label:'Total',      value: customers.length,  icon: User,        tone:'gray',   filter:'all',        tap:true  },
          { label:'Individual', value: customers.filter(c=>c.type==='individual').length, icon: User, tone:'blue', filter:'individual', tap:true },
          { label:'Corporate',  value: corporateCount,    icon: Building2,   tone:'violet', filter:'corporate',  tap:true  },
          { label:'New This Month', value: newThisMonth,  icon: Calendar,    tone:'green',  filter:null,         tap:false },
        ].map(s => (
          <MetricCard key={s.label} icon={s.icon} tone={s.tone} label={s.label} value={s.value}
            onClick={s.tap ? () => { setTypeFilter(s.filter); setPage(1) } : undefined}
            className={s.tap && typeFilter === s.filter ? 'ring-2 ring-blue-500/40' : ''} />
        ))}
      </div>

      {/* Single slim filter row — no sliders */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-[140px]">
            <FieldSelect value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} aria-label="Filter by type">
              <option value="all">All Types</option>
              {CUSTOMER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </FieldSelect>
          </div>
          <div className="w-[130px]">
            <FieldSelect value={flagFilter} onChange={e => { setFlagFilter(e.target.value); setPage(1) }} aria-label="Filter by flag">
              <option value="all">All Flags</option>
              <option value="vip">VIP</option>
              <option value="frequent">Frequent</option>
              <option value="blacklisted">Listed</option>
            </FieldSelect>
          </div>
          <div className="w-[120px]">
            <FieldSelect value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort customers">
              <option value="name">Name</option>
              <option value="city">City</option>
              <option value="recent">Recent</option>
            </FieldSelect>
          </div>
        </div>
      </div>

      {/* Customer list */}
      {loading ? (
        <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading customers">
          <span className="sr-only">Loading customers…</span>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="ap-surface rounded-xl p-2.5 flex items-center gap-2.5" aria-hidden="true">
              <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ap-surface rounded-2xl">
          <EmptyState icon={User} title="No customers found"
            description="Add your first customer to get started."
            action={canAdd ? <Button icon={Plus} size="sm" onClick={() => setShowAdd(true)}>Add First Customer</Button> : undefined} />
        </div>
      ) : (
        <div className="space-y-2">
          {pageRows.map(c => {
            const isOpen  = expanded === c.id
            const stats   = getCustomerStats(c.id, c.name, bookings)
            const subParts = [
              c.mobile || null,
              c.city || null,
              stats.totalTrips > 0 ? `${stats.totalTrips} trip${stats.totalTrips !== 1 ? 's' : ''}` : null,
            ].filter(Boolean)

            return (
              <div key={c.id} className="ap-surface rounded-2xl overflow-hidden transition-all duration-200">
                {/* Row */}
                <div className="ap-focus flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none rounded-2xl"
                     onClick={() => setExpanded(isOpen ? null : c.id)}>
                  <div className="relative flex-shrink-0">
                    <Avatar name={c.name} size={36} />
                    {c.notes && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-[var(--ap-surface)]" title="Has notes" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-sf font-semibold text-slate-900 dark:text-white text-[13px] truncate">{c.name}</p>
                      {(c.isVip || c.isBlacklisted) && (
                        c.isBlacklisted
                          ? <span title="Blacklisted" className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          : <Star size={11} className="text-amber-500 flex-shrink-0" aria-label="VIP customer" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5 tabular-nums">
                      {subParts.length > 0 ? subParts.join(' · ') : 'No details yet'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <TypeBadge type={c.type} />
                    {isOpen ? <ChevronUp size={13} className="text-slate-500 dark:text-slate-400 flex-shrink-0" />
                             : <ChevronDown size={13} className="text-slate-500 dark:text-slate-400 flex-shrink-0" />}
                  </div>
                </div>

                {/* Expanded profile */}
                {isOpen && (
                  <CustomerProfile
                    customer={c}
                    bookings={bookings}
                    onEdit={setEditCustomer}
                    onDelete={handleDelete}
                    onBooking={bookTripFor}
                    onFlag={handleFlag}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination — 5 per page (hidden while a profile is open) */}
      {!loading && filtered.length > 0 && !expanded && (
      <div className="ap-surface rounded-2xl px-3 py-2 flex items-center justify-between gap-3 flex-wrap sticky bottom-3 z-10">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          Page {safePage} of {totalPages} · {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}
            aria-label="Previous page"
            className="ap-focus min-w-[36px] min-h-[36px] px-2.5 rounded-[12px] border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            ←
          </button>
          {pageItems.map((n, i) => n === '…'
            ? <span key={`e${i}`} className="text-xs text-slate-400 px-1">…</span>
            : (
              <button key={n} onClick={() => setPage(n)}
                aria-label={`Go to page ${n}`}
                aria-current={n === safePage ? 'page' : undefined}
                className={`ap-focus min-w-[36px] min-h-[36px] px-2.5 rounded-[12px] text-xs font-bold tabular-nums active:scale-95 transition-all ${
                  n === safePage
                    ? 'bg-[var(--ap-accent)] text-white shadow'
                    : 'border border-[var(--ap-border)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)]'
                }`}>
                {n}
              </button>
            ))}
          <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}
            aria-label="Next page"
            className="ap-focus min-w-[36px] min-h-[36px] px-2.5 rounded-[12px] border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            →
          </button>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">Go to</span>
          <input
            value={goPage}
            onChange={e => setGoPage(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') goToPage() }}
            onBlur={() => { if (goPage) goToPage() }}
            placeholder={String(totalPages)}
            inputMode="numeric"
            aria-label={`Go to page, 1 to ${totalPages}`}
            className={`${fieldCls} w-14 text-center tabular-nums`}
          />
        </div>
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
    </div>
  )
}