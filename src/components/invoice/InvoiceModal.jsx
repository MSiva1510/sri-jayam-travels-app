// ─── Invoice Modal ────────────────────────────────────────────
// Printable, WhatsApp-shareable trip invoice (Sri Jayam Travels format).
// Reads business config from settingsData (persisted in localStorage).
// Print inlines the app stylesheets so paper matches the screen.

import { useRef, useState, useEffect } from 'react'
import { X, Printer, Share2, MapPin, Phone, Mail, Globe } from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import { getBizInfo, getInvoiceSettings, DEFAULT_SETTINGS } from '../../data/settingsData'
import qrWhatsapp from '../../assets/qr-whatsapp.jpg'
import qrReview from '../../assets/qr-review.png'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShort(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtMoney(amount, cur) {
  return `${cur} ${Number(amount || 0).toLocaleString('en-IN')}`
}

// ── Amount in words (Indian system: crore / lakh / thousand) ──
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
}

function threeDigits(n) {
  const h = Math.floor(n / 100)
  const r = n % 100
  return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? twoDigits(r) : '')
}

export function amountInWords(num) {
  const n = Math.round(Number(num) || 0)
  if (n === 0) return 'Zero Rupees Only'
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thou = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  let words = ''
  if (crore) words += threeDigits(crore) + ' Crore '
  if (lakh) words += twoDigits(lakh) + ' Lakh '
  if (thou) words += twoDigits(thou) + ' Thousand '
  if (rest) words += threeDigits(rest) + ' '
  return words.trim() + ' Rupees Only'
}

const TRIP_TYPE_LABELS = {
  one_way: 'One Way', round_trip: 'Round Trip', multi_loc: 'Multi Location',
  local_visit: 'Local Visit', multi_day: 'Multi Day', self_drive: 'Self Drive',
}

function tripTypeLabel(t) {
  if (!t) return '—'
  if (TRIP_TYPE_LABELS[t]) return TRIP_TYPE_LABELS[t]
  return String(t).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function InvoiceModal({ booking, onClose, docType }) {
  // Document kind: 'invoice' (default) or 'quotation' — switchable at creation.
  const kind    = docType || booking.docType || 'invoice'
  const isQuote = kind === 'quotation'
  const printRef    = useRef()
  const [biz,         setBiz]         = useState(DEFAULT_SETTINGS.biz)
  const [invSettings, setInvSettings] = useState(DEFAULT_SETTINGS.invoice)
  useEffect(() => {
    getBizInfo().then(setBiz).catch(err => console.error('[InvoiceModal] load biz info failed:', err))
    getInvoiceSettings().then(setInvSettings).catch(err => console.error('[InvoiceModal] load invoice settings failed:', err))
  }, [])
  const cur = invSettings.currency

  const invNo      = booking.bookingNo || booking.id
  const invDate    = fmtShort(new Date().toISOString().slice(0, 10))
  const tripDate   = fmtShort(booking.startDate)
  const monthPill  = (booking.startDate ? new Date(booking.startDate) : new Date())
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const leadSource = booking.leadSource || booking.source || '—'
  const startKm    = booking.startKm ?? booking.start_km ?? '—'
  const endKm      = booking.endKm ?? booking.end_km ?? '—'
  const totalKm    = booking.km || 0
  const isDone     = booking.status === 'completed' || booking.status === 'closed'

  // Expense items
  const toll    = booking.toll    || 0
  const bata    = booking.bata    || 0
  const petrol  = booking.petrol  || 0
  const parking = booking.parking || 0
  const extras  = booking.extras  || 0

  const lineItems = [
    { desc: `Trip Fare — ${booking.pickup || '—'} to ${booking.drop || '—'}${totalKm ? ` (${totalKm} km)` : ''}`, amt: booking.fare || 0, show: true },
    { desc: 'Toll Charges',  amt: toll,    show: toll > 0    },
    { desc: 'Driver Bata',   amt: bata,    show: bata > 0    },
    { desc: 'Fuel / Petrol', amt: petrol,  show: petrol > 0  },
    { desc: 'Parking',       amt: parking, show: parking > 0 },
    { desc: 'Other Charges', amt: extras,  show: extras > 0  },
  ].filter(r => r.show)

  // WhatsApp message
  const waText = encodeURIComponent(
    `*${biz.name}*\n` +
    `${isQuote ? 'Quotation' : 'Invoice'}: ${invNo}\n` +
    `Customer: ${booking.customer}\n` +
    `Date: ${fmtDate(booking.startDate)}\n` +
    `${booking.pickup || '—'} → ${booking.drop || '—'}\n` +
    `Distance: ${totalKm || '—'} km\n` +
    `Fare: ${cur} ${(booking.fare || 0).toLocaleString('en-IN')}\n\n` +
    `${invSettings.footerText}\n` +
    `${biz.phone}`
  )

  async function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    // Inline app stylesheets so paper matches the screen (same-origin CSS)
    let css = ''
    try {
      const sheets = await Promise.all(
        [...document.querySelectorAll('link[rel="stylesheet"]')].map(async l => {
          try {
            const r = await fetch(l.href)
            return r.ok ? await r.text() : ''
          } catch { return '' }
        })
      )
      const inline = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n')
      css = sheets.join('\n') + '\n' + inline
    } catch { /* fall through with print base styles */ }
    const html = printRef.current?.innerHTML || ''
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <base href="${window.location.origin}/"/>
      <title>${isQuote ? 'Quotation' : 'Invoice'} — ${invNo}</title>
      <style>${css}
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; margin: 0; }
        @page { size: A4; margin: 10mm; }
        @media print {
          body { width: 190mm; margin: 0 auto; }
        }
      </style>
    </head><body>${html}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  return (
    <ModalOverlay onClose={onClose} center>
      <div
        className="w-full max-w-2xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden animate-fade-up"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${isQuote ? 'Quotation' : 'Invoice'} ${invNo}`}
      >
        {/* Toolbar (screen only — outside the print area) */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700 flex-wrap">
          <div>
            <p className="font-display font-black text-slate-800 dark:text-white text-sm">{isQuote ? 'Quotation' : 'Invoice'}</p>
            <p className="text-[10px] text-slate-400 font-mono">{invNo}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-[12px] bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all">
              <Share2 size={13} /> WhatsApp
            </a>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-[12px] bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition-all">
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose}
              aria-label="Close invoice"
              className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-[12px] border border-slate-200 dark:border-navy-600 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700 active:scale-95 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable invoice body */}
        <div className="overflow-y-auto max-h-[80vh] bg-white">
          <div ref={printRef} className="p-4 sm:p-6 space-y-4 text-slate-800">

            {/* ── Header band ── */}
            <div className="flex items-start justify-between gap-4 rounded-2xl px-4 sm:px-5 py-4"
              style={{ background: 'linear-gradient(135deg, #0d1b4b 0%, #1b2a6b 100%)' }}>
              <div className="flex items-center gap-3 min-w-0">
                {biz.logo ? (
                  <img src={biz.logo} alt={biz.name} className="h-11 w-11 rounded-lg bg-white object-contain p-1 flex-shrink-0"
                    onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <div className="h-11 w-11 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                    <span className="font-black text-[10px]" style={{ color: '#0d1b4b' }}>SJT</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-display font-black text-white text-base sm:text-lg leading-tight tracking-wide">{biz.name}</p>
                  <p className="text-[10px] text-white/70 leading-snug">{biz.address}</p>
                  <p className="text-[10px] text-white/70">Tel: {biz.phone} | {biz.email}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-display font-black text-lg sm:text-xl tracking-[0.2em]" style={{ color: '#38bdf8' }}>{isQuote ? 'QUOTATION' : 'INVOICE'}</p>
                <p className="text-[10px] font-mono text-white/85 mt-0.5"># {invNo}</p>
                <span className="inline-block mt-1.5 text-[10px] font-bold text-white px-2.5 py-0.5 rounded-full" style={{ background: '#2563eb' }}>
                  {monthPill}
                </span>
              </div>
            </div>

            {/* ── Bill To + meta ── */}
            <div className="rounded-2xl border border-slate-200 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bill To</p>
                <p className="font-extrabold text-slate-800 text-sm mt-0.5">{booking.customer}</p>
                {booking.contact && <p className="text-[11px] text-slate-500 mt-0.5">Tel: {booking.contact}</p>}
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] sm:justify-end">
                {[
                  [isQuote ? 'Quote Date' : 'Invoice Date', invDate],
                  ['Trip Date', tripDate],
                  [isQuote ? 'Quote No.' : 'Inv No.', invNo],
                  ['Lead Source', leadSource],
                ].map(([l, v]) => (
                  <div key={l} className="contents">
                    <span className="text-slate-400">{l}</span>
                    <span className="font-bold text-slate-700 text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Trip route band ── */}
            <div className="rounded-2xl px-4 py-3.5 text-white" style={{ background: 'linear-gradient(135deg, #16205c 0%, #24368f 100%)' }}>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em]">Trip Route</p>
              <p className="font-display font-black text-base sm:text-lg mt-1 leading-snug">
                {booking.pickup || '—'}
                <span className="mx-2 font-normal text-white/60">to</span>
                {booking.drop || '—'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                {[
                  ['Vehicle', booking.vehicle || '—'],
                  ['Trip Type', tripTypeLabel(booking.type)],
                  ['Driver', booking.driver || '—'],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <p className="text-[9px] font-bold text-white/55 uppercase tracking-wider">{l}</p>
                    <p className="text-xs font-bold text-white truncate mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Odometer strip ── */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Start KM', startKm, 'odometer'],
                ['End KM', endKm, 'odometer'],
                ['Total Distance', totalKm ? totalKm.toLocaleString('en-IN') : '—', 'kilometres'],
              ].map(([l, v, sub]) => (
                <div key={l} className="rounded-2xl border border-slate-200 px-2 py-2.5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{l}</p>
                  <p className="font-display font-black text-slate-800 text-lg sm:text-xl tabular-nums leading-tight">{v}</p>
                  <p className="text-[9px] text-slate-400">{sub}</p>
                </div>
              ))}
            </div>

            {/* ── Fare breakdown ── */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] px-4 pt-3">Fare Breakdown</p>
              {lineItems.map(r => (
                <div key={r.desc} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0">
                  <p className="text-xs text-slate-700 min-w-0">{r.desc}</p>
                  <p className="text-xs font-bold text-slate-800 whitespace-nowrap tabular-nums">{fmtMoney(r.amt, cur)}</p>
                </div>
              ))}
              <div className="mx-3 mb-3 mt-1 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3"
                style={{ background: '#16205c' }}>
                <p className="text-[11px] font-bold text-white/85 uppercase tracking-wider">{isQuote ? 'Estimated Total' : 'Total Amount Due'}</p>
                <p className="font-display font-black text-white text-base tabular-nums">{fmtMoney(booking.fare, cur)}</p>
              </div>
              <p className="px-4 pb-3 text-[11px] italic text-slate-500">In words: {amountInWords(booking.fare)}</p>
            </div>

            {/* ── Driver / vehicle strip ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                ['Driver', booking.driver || '—'],
                ['Driver Mobile', booking.driverMobile || booking.driver_contact || '—'],
                ['Vehicle No.', booking.vehicle || '—'],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-slate-200 px-3 py-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{l}</p>
                  <p className="text-xs font-bold text-slate-700 truncate mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            {/* ── Footer ── */}
            <div className="flex items-end justify-between gap-3 pt-1 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-slate-800">{biz.name}</p>
                <p className="text-[10px] text-slate-500 leading-snug mt-0.5">{biz.address}<br />Tel: {biz.phone} | {biz.email}</p>
                <p className="text-[10px] text-slate-400 italic mt-1">Thank you for choosing {biz.name}!</p>
                {biz.gstin && invSettings.showGSTIN && (
                  <p className="text-[10px] text-slate-400 mt-0.5">GSTIN: {biz.gstin}</p>
                )}
              </div>
              <div className="flex items-end gap-2.5 flex-shrink-0">
                <div className="flex flex-col items-center gap-0.5">
                  <img src={qrWhatsapp} alt="WhatsApp Us QR" width={64} height={64} className="w-16 h-16 rounded-lg border border-slate-200 object-cover" />
                  <span className="text-[8px] font-bold text-slate-500">WhatsApp Us</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <img src={qrReview} alt="Google Review QR" width={64} height={64} className="w-16 h-16 rounded-lg border border-slate-200 object-cover" />
                  <span className="text-[8px] font-bold text-slate-500">Google Review</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-16 h-16 rounded-full border-[3px] flex flex-col items-center justify-center ${
                    isQuote
                      ? 'border-sky-500 text-sky-600'
                      : isDone
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-amber-500 text-amber-600'
                  }`}>
                    <span className="text-[11px] font-black leading-none">{isQuote ? 'QUOTE' : isDone ? 'PAID' : (booking.status || 'PENDING').toUpperCase().slice(0, 9)}</span>
                    <span className="text-[8px] font-semibold mt-0.5">{tripDate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Terms ── */}
            {invSettings.termsText && (
              <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-2">{invSettings.termsText}</p>
            )}

          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
