// ─── BookingPicker ──────────────────────────────────────────────
// Booking selection for new invoices. Search, status/date/driver/vehicle
// filters, readable cards and explicit already-invoiced / not-billable
// states replace the previous single cramped list.

import { useMemo, useState } from 'react'
import { CalendarDays, CarFront, ChevronDown, ChevronUp, FileText, MapPin, Search, UserRound, X } from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import SegmentedControl from '../ui/SegmentedControl'
import EmptyState from '../ui/EmptyState'
import StatusPill from '../ui/StatusPill'
import { fieldCls } from '../ui/Field'
import {
  formatINR, invoiceEligibility, normalizeInvoice, shortDate, shortLocation,
} from '../../data/invoiceModel'

const REASON_LABEL = {
  'not-completed': 'Not completed',
  'already-invoiced': 'Already invoiced',
}

export default function BookingPicker({
  bookings = [], records = [], payments = [], currency = 'Rs.',
  busyKey = '', onClose, onSelect, onOpenInvoice,
}) {
  const [tab, setTab] = useState('completed')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [driver, setDriver] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [status, setStatus] = useState('')
  const [expanded, setExpanded] = useState({})

  const rows = useMemo(() => bookings.map(booking => {
    const invoice = normalizeInvoice({ source: booking, records, payments })
    return { booking, invoice, eligibility: invoiceEligibility(booking, records) }
  }), [bookings, records, payments])

  const completed = rows.filter(row => ['completed', 'closed'].includes(String(row.booking.status || '').toLowerCase()))
  // Cancelled trips are not billable at all — keep them out of the chooser
  // instead of offering a disabled "Create invoice" action.
  const ongoing = rows.filter(row => {
    const status = String(row.booking.status || '').toLowerCase()
    return status !== 'cancelled' && !['completed', 'closed'].includes(status)
  })
  const base = tab === 'completed' ? completed : ongoing

  const drivers = [...new Set(bookings.map(b => b.driver).filter(Boolean))].sort()
  const vehicles = [...new Set(bookings.map(b => b.vehicle || b.vehicleReg).filter(Boolean))].sort()
  const statuses = [...new Set(ongoing.map(row => row.booking.status).filter(Boolean))].sort()

  const filtered = base.filter(({ booking, invoice }) => {
    const q = search.trim().toLowerCase()
    const haystack = [
      booking.customer, booking.bookingNo, booking.reference, booking.bookingRef,
      booking.pickup, booking.drop, booking.driver, booking.vehicle,
      invoice.invoiceNo,
    ].map(value => String(value || '').toLowerCase()).join(' ')
    if (q && !haystack.includes(q)) return false
    if (date && !String(booking.startDate || '').startsWith(date)) return false
    if (driver && (booking.driver || '') !== driver) return false
    if (vehicle && (booking.vehicle || booking.vehicleReg || '') !== vehicle) return false
    if (status && (booking.status || '') !== status) return false
    return true
  })

  const toggleExpanded = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <ModalOverlay onClose={onClose} center>
      <div className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col rounded-[20px] ap-surface border border-[var(--ap-border)] shadow-2xl overflow-hidden animate-fade-up"
        role="dialog" aria-modal="true" aria-label="Select booking to invoice">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--ap-border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-[12px] bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
              <FileText size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">Select a booking</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Only completed trips can be invoiced.</p>
            </div>
          </div>
          <IconButton icon={X} label="Close booking picker" onClick={onClose} />
        </div>

        <div className="px-4 pt-3 space-y-2.5">
          <SegmentedControl
            ariaLabel="Booking status"
            value={tab}
            onChange={setTab}
            options={[
              { key: 'completed', label: `Completed (${completed.length})` },
              { key: 'ongoing', label: `New / Ongoing (${ongoing.length})` },
            ]}
          />
          <label className="relative block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search customer, booking ID, reference or route…"
              aria-label="Search bookings"
              className={`${fieldCls} h-11 pl-9`}
            />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="block">
              <span className="sr-only">Trip date</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                aria-label="Filter by trip date" className={`${fieldCls} h-10`} />
            </label>
            <label className="block">
              <span className="sr-only">Driver</span>
              <select value={driver} onChange={e => setDriver(e.target.value)}
                aria-label="Filter by driver" className={`${fieldCls} h-10`}>
                <option value="">All drivers</option>
                {drivers.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Vehicle</span>
              <select value={vehicle} onChange={e => setVehicle(e.target.value)}
                aria-label="Filter by vehicle" className={`${fieldCls} h-10`}>
                <option value="">All vehicles</option>
                {vehicles.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Status</span>
              <select value={status} onChange={e => setStatus(e.target.value)}
                aria-label="Filter by status" className={`${fieldCls} h-10`}
                disabled={tab === 'completed'}>
                <option value="">All statuses</option>
                {statuses.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="No matching bookings"
              description="Try another search or clear the filters." />
          ) : filtered.map(({ booking, invoice, eligibility }) => {
            const busy = busyKey === invoice.key
            const invoiced = !!invoice.record
            const expandedRow = !!expanded[booking.id]
            return (
              <div key={booking.id}
                className={`rounded-[16px] border px-3.5 py-3 transition-colors ${
                  eligibility.eligible
                    ? 'border-[var(--ap-border)] bg-[var(--ap-surface)]'
                    : 'border-[var(--ap-border)] bg-[var(--ap-surface-2)] opacity-80'
                }`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{booking.customer || '—'}</p>
                      {invoiced && <StatusPill tone={invoice.paymentStatus === 'paid' ? 'green' : 'blue'}>Invoiced</StatusPill>}
                      {!eligibility.eligible && !invoiced && (
                        <StatusPill tone={eligibility.reason === 'cancelled' ? 'red' : 'gray'}>
                          {REASON_LABEL[eligibility.reason] || 'Unavailable'}
                        </StatusPill>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                      {booking.bookingNo || booking.id} · {shortDate(booking.startDate)}
                    </p>
                    <div className="flex items-start gap-1.5 mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <MapPin size={12} className="mt-0.5 flex-shrink-0 text-slate-400" />
                      <span className="min-w-0 break-words">
                        {shortLocation(booking.pickup)} <span className="text-slate-300 dark:text-slate-600 mx-1">→</span> {shortLocation(booking.drop)}
                        {(expandedRow) && (
                          <span className="block text-[10px] text-slate-400 mt-1 space-y-0.5">
                            <span className="block">From: {booking.pickup || '—'}</span>
                            <span className="block">To: {booking.drop || '—'}</span>
                          </span>
                        )}
                      </span>
                      <button type="button" onClick={() => toggleExpanded(booking.id)}
                        aria-label={expandedRow ? 'Hide full addresses' : 'Show full addresses'}
                        aria-expanded={expandedRow}
                        className="ml-auto flex-shrink-0 p-1 text-slate-400 hover:text-blue-600">
                        {expandedRow ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mt-2 text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-1"><UserRound size={11} /> {booking.driver || 'No driver'}</span>
                      <span className="inline-flex items-center gap-1"><CarFront size={11} /> {booking.vehicle || 'No vehicle'}</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {String(booking.status || '').toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 pl-1">
                    <p className="text-sm font-bold text-navy-800 dark:text-blue-300 tabular-nums">
                      {formatINR(invoice.total, currency)}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{invoice.km ? `${invoice.km} km` : 'Fare'}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-[var(--ap-border)]">
                  {invoiced ? (
                    <Button variant="outline" size="sm" onClick={() => onOpenInvoice?.(invoice)}>
                      View invoice
                    </Button>
                  ) : (
                    <Button size="sm" disabled={!eligibility.eligible || busy}
                      onClick={() => onSelect?.(booking)}>
                      {busy ? 'Creating…' : eligibility.eligible ? 'Create invoice' : REASON_LABEL[eligibility.reason] || 'Unavailable'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ModalOverlay>
  )
}
