// ─── InvoiceDocument ────────────────────────────────────────────
// The printable document shared by InvoiceModal and the live editor preview.
// It only receives the normalized invoice model, so customer-facing output
// can never leak an internal database id.

import { forwardRef } from 'react'
import { formatINR, shortDate } from '../../data/invoiceModel'
import { amountInWords } from '../../utils/amountInWords'
import qrWhatsapp from '../../assets/qr-whatsapp.jpg'
import qrReview from '../../assets/qr-review.png'

const TRIP_TYPE_LABELS = {
  one_way: 'One Way', round_trip: 'Round Trip', multi_loc: 'Multi Location',
  local_visit: 'Local Visit', multi_day: 'Multi Day', self_drive: 'Self Drive',
}

function tripTypeLabel(value) {
  if (!value) return '—'
  if (TRIP_TYPE_LABELS[value]) return TRIP_TYPE_LABELS[value]
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function longDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function stampFor(invoice) {
  if (invoice.isQuote) return { text: 'QUOTE', tone: 'border-sky-500 text-sky-600' }
  if (invoice.paymentStatus === 'paid') return { text: 'PAID', tone: 'border-emerald-500 text-emerald-600' }
  if (invoice.paymentStatus === 'partial') return { text: 'PARTIAL', tone: 'border-amber-500 text-amber-600' }
  if (invoice.paymentStatus === 'overdue') return { text: 'DUE', tone: 'border-red-500 text-red-600' }
  if (['completed', 'closed'].includes(String(invoice.status || '').toLowerCase())) {
    return { text: 'COMPLETED', tone: 'border-slate-400 text-slate-500' }
  }
  return { text: 'PENDING', tone: 'border-amber-500 text-amber-600' }
}

const InvoiceDocument = forwardRef(function InvoiceDocument(
  { invoice, biz = {}, settings = {} },
  ref,
) {
  const currency = settings.currency || 'Rs.'
  const money = (value) => formatINR(value, currency)
  const stamp = stampFor(invoice)
  const invDate = longDate(invoice.invoiceDate)
  const tripDate = shortDate(invoice.tripDate)
  const monthPill = (invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date())
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const meta = [
    [invoice.isQuote ? 'Quote Date' : 'Invoice Date', invDate],
    ['Trip Date', tripDate],
    [invoice.isQuote ? 'Quote No.' : 'Inv No.', invoice.invoiceNo],
  ]
  if (invoice.bookingRef) meta.push(['Booking Ref', invoice.bookingRef])
  if (invoice.isQuote && invoice.validUntil) meta.push(['Valid Until', shortDate(invoice.validUntil)])

  return (
    <div ref={ref} className="print-doc p-4 sm:p-6 space-y-3.5 text-slate-800 bg-white">

      {/* Header */}
      <div className="print-break-avoid flex items-start justify-between gap-4 rounded-2xl px-4 sm:px-5 py-4"
        style={{ background: 'linear-gradient(135deg, #0d1b4b 0%, #1b2a6b 100%)' }}>
        <div className="flex items-center gap-3 min-w-0">
          {biz.logo ? (
            <img src={biz.logo} alt={biz.name} className="h-11 w-11 rounded-lg bg-white object-contain p-1 flex-shrink-0"
              onError={e => { e.target.style.display = 'none' }} />
          ) : (
            <div className="h-11 w-11 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
              <span className="font-semibold text-[10px]" style={{ color: '#0d1b4b' }}>SJT</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-sf font-semibold text-white text-base sm:text-lg leading-tight tracking-wide">{biz.name || 'Sri Jayam Travels'}</p>
            {biz.address && <p className="text-[10px] text-white/70 leading-snug">{biz.address}</p>}
            {(biz.phone || biz.email) && (
              <p className="text-[10px] text-white/70">{[biz.phone && `Tel: ${biz.phone}`, biz.email].filter(Boolean).join(' | ')}</p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-sf font-semibold text-lg sm:text-xl tracking-[0.2em]" style={{ color: '#38bdf8' }}>
            {invoice.isQuote ? 'QUOTATION' : 'INVOICE'}
          </p>
          <p className="text-[10px] font-mono text-white/85 mt-0.5"># {invoice.invoiceNo}</p>
          <span className="inline-block mt-1.5 text-[10px] font-bold text-white px-2.5 py-0.5 rounded-full" style={{ background: '#2563eb' }}>
            {monthPill}
          </span>
        </div>
      </div>

      {/* Customer + meta */}
      <div className="print-break-avoid rounded-2xl border border-slate-200 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bill To</p>
          <p className="font-extrabold text-slate-800 text-sm mt-0.5">{invoice.customer}</p>
          {invoice.contact && <p className="text-[11px] text-slate-500 mt-0.5">Tel: {invoice.contact}</p>}
          {invoice.customerGstin && <p className="text-[11px] text-slate-500 mt-0.5">GSTIN: {invoice.customerGstin}</p>}
          {invoice.billingAddress && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{invoice.billingAddress}</p>}
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] sm:justify-end">
          {meta.map(([label, value]) => (
            <div key={label} className="contents">
              <span className="text-slate-400">{label}</span>
              <span className="font-bold text-slate-700 text-right">{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Route */}
      {(invoice.pickup || invoice.drop) && (
        <div className="print-break-avoid rounded-2xl px-4 py-3.5 text-white"
          style={{ background: 'linear-gradient(135deg, #16205c 0%, #24368f 100%)' }}>
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em]">Trip Route</p>
          <p className="font-sf font-semibold text-base sm:text-lg mt-1 leading-snug break-words">
            {invoice.pickup || '—'} <span className="mx-2 font-normal text-white/60">to</span> {invoice.drop || '—'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            {[
              ['Vehicle', invoice.vehicle || '—'],
              ['Trip Type', tripTypeLabel(invoice.raw?.type)],
              ['Driver', invoice.driver || '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                <p className="text-[9px] font-bold text-white/55 uppercase tracking-wider">{label}</p>
                <p className="text-xs font-bold text-white truncate mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distance strip — only when the source actually has odometer data */}
      {(invoice.raw?.startKm || invoice.raw?.endKm || invoice.km > 0) && (
        <div className="print-break-avoid grid grid-cols-3 gap-2 text-center">
          {[
            ['Start KM', invoice.raw?.startKm ?? invoice.raw?.start_km ?? '—'],
            ['End KM', invoice.raw?.endKm ?? invoice.raw?.end_km ?? '—'],
            ['Total Distance', invoice.km ? `${invoice.km.toLocaleString('en-IN')} km` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 px-2 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="font-sf font-semibold text-slate-800 text-lg sm:text-xl tabular-nums leading-tight">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Fare breakdown — the one source for the total */}
      <div className="print-break-avoid rounded-2xl border border-slate-200 overflow-hidden">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] px-4 pt-3">
          {invoice.isQuote ? 'Estimated Breakdown' : 'Fare Breakdown'}
        </p>
        {invoice.lineItems.map((item, index) => (
          <div key={`${item.description}-${index}`} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0">
            <p className="text-xs text-slate-700 min-w-0 break-words">
              {item.description}
              {item.quantity > 1 && <span className="text-slate-400"> · {item.quantity} × {money(item.unitPrice)}</span>}
            </p>
            <p className="text-xs font-bold text-slate-800 whitespace-nowrap tabular-nums">{money(item.total)}</p>
          </div>
        ))}
        {!invoice.isQuote && (invoice.paid > 0 || invoice.record) && (
          <div className="grid grid-cols-2 gap-px bg-slate-100 border-t border-slate-100 text-[11px]">
            <div className="bg-white px-4 py-2">
              <span className="text-slate-400">Received</span>
              <p className="font-bold text-emerald-700 tabular-nums">{money(invoice.paid)}</p>
            </div>
            <div className="bg-white px-4 py-2">
              <span className="text-slate-400">Balance</span>
              <p className="font-bold text-slate-800 tabular-nums">{money(invoice.balance)}</p>
            </div>
          </div>
        )}
        <div className="mx-3 mb-3 mt-1 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3"
          style={{ background: '#16205c' }}>
          <p className="text-[11px] font-bold text-white/85 uppercase tracking-wider">
            {invoice.isQuote ? 'Estimated Total' : 'Total Amount Due'}
          </p>
          <p className="font-sf font-semibold text-white text-base tabular-nums">{money(invoice.total)}</p>
        </div>
        <p className="px-4 pb-3 text-[11px] italic text-slate-500">In words: {amountInWords(invoice.total)}</p>
      </div>

      {/* Driver strip — only when there is driver data */}
      {(invoice.driver || invoice.driverMobile || invoice.vehicle) && (
        <div className="print-break-avoid grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            ['Driver', invoice.driver || '—'],
            ['Driver Mobile', invoice.driverMobile || '—'],
            ['Vehicle No.', invoice.vehicle || '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 px-3 py-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-xs font-bold text-slate-700 truncate mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {(invoice.notes || invoice.terms) && (
        <div className="print-break-avoid rounded-xl border border-slate-200 px-4 py-3 text-[11px] text-slate-600 leading-relaxed space-y-1">
          {invoice.notes && <p><span className="font-bold text-slate-500">Notes: </span>{invoice.notes}</p>}
          {invoice.terms && <p><span className="font-bold text-slate-500">Terms: </span>{invoice.terms}</p>}
        </div>
      )}

      {/* Footer */}
      <div className="print-break-avoid flex items-end justify-between gap-3 pt-1 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800">{biz.name || 'Sri Jayam Travels'}</p>
          {(biz.address || biz.phone || biz.email) && (
            <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
              {biz.address && <>{biz.address}<br /></>}
              {[biz.phone && `Tel: ${biz.phone}`, biz.email].filter(Boolean).join(' | ')}
            </p>
          )}
          {settings.footerText && <p className="text-[10px] text-slate-400 italic mt-1">{settings.footerText}</p>}
          {biz.gstin && settings.showGSTIN && <p className="text-[10px] text-slate-400 mt-0.5">GSTIN: {biz.gstin}</p>}
        </div>
        <div className="flex items-end gap-2.5 flex-shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <img src={qrWhatsapp} alt="WhatsApp Us QR" width={56} height={56} className="w-14 h-14 rounded-lg border border-slate-200 object-cover" />
            <span className="text-[8px] font-bold text-slate-500">WhatsApp Us</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <img src={qrReview} alt="Google Review QR" width={56} height={56} className="w-14 h-14 rounded-lg border border-slate-200 object-cover" />
            <span className="text-[8px] font-bold text-slate-500">Google Review</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-14 h-14 rounded-full border-[3px] flex flex-col items-center justify-center ${stamp.tone}`}>
              <span className="text-[10px] font-semibold leading-none">{stamp.text}</span>
              <span className="text-[8px] font-semibold mt-0.5">{tripDate}</span>
            </div>
          </div>
        </div>
      </div>

      {settings.termsText && (
        <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-2">{settings.termsText}</p>
      )}
    </div>
  )
})

export default InvoiceDocument
