import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, X, ChevronDown, ChevronUp, CheckCircle,
  Clock, IndianRupee, User, Calendar, Edit2,
  Trash2, FileText, AlertTriangle,
  Printer, Send, Wallet, ChevronLeft, ChevronRight,
  Download, Eye, Search,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Avatar     from '../components/ui/Avatar'
import Button     from '../components/ui/Button'
import MetricCard from '../components/ui/MetricCard'
import StatusPill from '../components/ui/StatusPill'
import IconButton from '../components/ui/IconButton'
import Callout    from '../components/ui/Callout'
import EmptyState from '../components/ui/EmptyState'
import { fieldCls, Select as FieldSelect } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import {
  loadSettlements, saveSettlement, deleteSettlement, generateSettlementId,
  loadPayrollSettings, savePayrollSettings,
  buildSettlement, calculateIncentive, resolveDailyWage,
  tripDriverAmount, buildDriverMonthlyPayroll,
  SETTLEMENT_STATUSES, getSettlementStatusCfg,
  PAYMENT_METHODS, DEDUCTION_TYPES,
  DEFAULT_PAYROLL_SETTINGS, monthLabel, settlementExists,
  savePayslip, loadPayslips,
  loadTripPayslips, saveTripPayslip,
} from '../data/settlementData'
import { loadBookings } from '../data/tripTypes'
import { loadExpenses } from '../data/expenseData'
import { loadDrivers } from '../data/driverData'
import ModalOverlay from '../components/ui/ModalOverlay'
import { addAuditEvent } from '../data/auditLogData'

// ─────────────────────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CUR_YEAR  = new Date().getFullYear()
const CUR_MONTH = new Date().getMonth() + 1

const STATUS_TONE = { draft:'gray', pending:'blue', approved:'violet', paid:'green' }
function StatusBadge({ status }) {
  const cfg = getSettlementStatusCfg(status)
  return <StatusPill tone={STATUS_TONE[status] || 'gray'}>{cfg.label}</StatusPill>
}

function AmtRow({ label, value, hi, deduct, sub }) {
  return (
    <div className={`flex justify-between items-center py-2 ${sub ? 'pl-3 border-l-2 border-[var(--ap-border)]' : 'border-b border-[var(--ap-border)] last:border-0'}`}>
      <span className={`text-xs ${sub ? 'text-slate-500 dark:text-slate-400' : 'text-slate-600 dark:text-slate-300'} font-medium`}>{label}</span>
      <span className={`text-xs font-bold ${deduct ? 'text-red-600 dark:text-red-400' : hi ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
        {deduct ? '− ' : ''}Rs. {Number(value||0).toLocaleString('en-IN')}
      </span>
    </div>
  )
}

function SectionHead({ title }) {
  return <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-3 mb-1.5 border-t border-[var(--ap-border)] pt-3">{title}</p>
}

function FInput({ label, field, value, onChange, type = 'text', required, placeholder, readOnly }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        {label}{required && <span className="text-red-600 dark:text-red-400 ml-0.5" aria-hidden="true">*</span>}
      </label>
      <input type={type} value={value ?? ''} onChange={e => onChange(field, e.target.value)}
        placeholder={placeholder} readOnly={readOnly} required={required}
        className={`${fieldCls} ${readOnly ? 'opacity-60 cursor-default' : ''}`} />
    </div>
  )
}

function FSelect({ label, field, value, onChange, children, required }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        {label}{required && <span className="text-red-600 dark:text-red-400 ml-0.5" aria-hidden="true">*</span>}
      </label>
      <select value={value ?? ''} onChange={e => onChange(field, e.target.value)}
        className={`${fieldCls} appearance-none`}>
        {children}
      </select>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Module 6: Salary Configuration Panel
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  Create / Edit Settlement Modal
// ─────────────────────────────────────────────────────────────
function SettlementModal({ settlement, drivers, onClose, onSave, currentUser }) {
  const [settings, setSettings] = useState(DEFAULT_PAYROLL_SETTINGS)
  const [expenses, setExpenses] = useState([])
  const [bookings, setBookings] = useState([])
  useEffect(() => {
    Promise.all([loadPayrollSettings(), loadExpenses(), loadBookings()]).then(([s, e, b]) => {
      setSettings(s ?? DEFAULT_PAYROLL_SETTINGS)
      setExpenses(Array.isArray(e) ? e : [])
      setBookings(Array.isArray(b) ? b : [])
    }).catch(() => {})
  }, [])
  const isEdit   = !!settlement?.id

  const [form, setForm] = useState(() => settlement || {
    driver: drivers?.[0]?.name || '',
    month: CUR_MONTH, year: CUR_YEAR,
    daysWorked: 0, completedTrips: 0, totalTrips: 0,
    bonus: 0, deductions: [], notes: '',
    manualFuel: 0, manualParking: 0,
  })
  const [error, setError] = useState('')

  const upd = (field, val) => setForm(f => ({ ...f, [field]: val }))

  // Auto-fill days driven + trip counts from completed bookings
  // (editable afterwards — a driven day = a date with a completed trip).
  useEffect(() => {
    if (isEdit || bookings.length === 0) return
    setForm(f => {
      if (!f.driver || !f.month || !f.year) return f
      const key = `${f.year}-${String(f.month).padStart(2, '0')}`
      const mine = bookings.filter(b =>
        b.driver === f.driver &&
        (b.startDate || '').startsWith(key)
      )
      const done = mine.filter(b => ['completed', 'closed'].includes(b.status))
      const days = new Set(done.map(b => b.startDate)).size
      return { ...f, daysWorked: days, completedTrips: done.length, totalTrips: mine.length }
    })
  }, [isEdit, bookings, form.driver, form.month, form.year])

  // Live calculation (daily wage × days driven; bata stays with the driver)
  const calc = useMemo(() => {
    const d = (drivers || []).find(x => x.name === form.driver)
    return buildSettlement({ ...form, driverId: d?.id }, expenses, settings)
  }, [form, expenses, settings, drivers])

  // Deductions management
  const addDeduction = () => setForm(f => ({ ...f, deductions: [...(f.deductions||[]), { type:'advance', label:'Advance Salary', amount:0 }] }))
  const updDeduction = (i, field, val) => setForm(f => ({
    ...f,
    deductions: f.deductions.map((d, idx) => idx === i ? { ...d, [field]: field==='amount' ? Number(val) : val } : d)
  }))
  const removeDeduction = i => setForm(f => ({ ...f, deductions: f.deductions.filter((_,idx) => idx !== i) }))

  const handleSave = async () => {
    if (!form.driver) { setError('Select a driver'); return }
    if (!form.month || !form.year) { setError('Select month and year'); return }
    // Duplicate prevention
    if (!isEdit) {
      const exists = await settlementExists(form.driver, Number(form.month), Number(form.year))
      if (exists) {
        setError(`Settlement for ${form.driver} — ${monthLabel(form.month, form.year)} already exists.`)
        return
      }
    }
    const now  = new Date().toISOString()
    const days = Number(form.daysWorked ?? form.workingDays ?? 0)
    const full = {
      ...form,
      ...calc,
      id:         form.id || generateSettlementId(),
      month:      Number(form.month),
      year:       Number(form.year),
      daysWorked: days,
      workingDays: days,
      completedTrips:Number(form.completedTrips),
      totalTrips: Number(form.totalTrips),
      status:     form.status || 'draft',
      createdBy:  form.createdBy || currentUser?.name || '',
      createdAt:  form.createdAt || now,
      updatedAt:  now
    }
    onSave(full)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative w-full sm:w-[520px] max-h-[94vh] ap-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-[var(--ap-border)] rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ap-border)] flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isEdit ? 'Edit Settlement' : 'New Settlement'}</p>
            <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base">{isEdit ? settlement.id : 'Create Settlement'}</h3>
          </div>
          <IconButton icon={X} label="Close settlement form" size={16} onClick={onClose} />
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {error && <Callout tone="red" icon={AlertTriangle} title={error} />}

          {/* Basic */}
          <div className="grid grid-cols-2 gap-3">
            <FSelect label="Driver" field="driver" value={form.driver} onChange={upd} required>
              {(drivers || []).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </FSelect>
            <FSelect label="Month" field="month" value={form.month} onChange={upd} required>
              {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
            </FSelect>
            <FInput label="Year" field="year" value={form.year} onChange={upd} type="number" required />
            <FInput label="Days Worked (driven days)" field="daysWorked" value={form.daysWorked} onChange={upd} type="number" />
            <FInput label="Completed Trips" field="completedTrips" value={form.completedTrips} onChange={upd} type="number" />
            <FInput label="Total Trips" field="totalTrips" value={form.totalTrips} onChange={upd} type="number" />
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Days, completed & total trips auto-fill from completed bookings — editable.</p>

          {/* Salary preview — live (daily wage × days driven; bata goes to driver) */}
          <div className="bg-[var(--ap-surface-2)] rounded-xl p-4 border border-[var(--ap-border)]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Live Calculation</p>
            <AmtRow label={`Daily Wage × ${calc.daysWorked} day${calc.daysWorked !== 1 ? 's' : ''} (Rs. ${calc.dailyWage.toLocaleString('en-IN')}/day)`} value={calc.wagePay} />
            {calc.bataDirect > 0 && <AmtRow label="Bata — direct to driver (not in payout)" value={calc.bataDirect} sub />}
            <AmtRow label="Fuel Reimbursement"  value={calc.fuelAmt}      sub />
            <AmtRow label="Parking"             value={calc.parkingAmt}   sub />
            <AmtRow label={`Incentive (${form.completedTrips} trips)`} value={calc.incentive} sub />
            <AmtRow label="Bonus"               value={calc.bonus}        sub />
            {calc.totalDeductions > 0 && <AmtRow label="Total Deductions" value={calc.totalDeductions} deduct />}
            <div className="mt-2 pt-2 border-t border-[var(--ap-border)] flex justify-between">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Net Amount</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Rs. {calc.netAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Manual overrides */}
          <SectionHead title="Manual Overrides (if not from expenses)" />
          <div className="grid grid-cols-2 gap-2">
            <FInput label="Fuel (Rs.)"    field="manualFuel"    value={form.manualFuel}    onChange={upd} type="number" placeholder="0" />
            <FInput label="Parking (Rs.)" field="manualParking" value={form.manualParking} onChange={upd} type="number" placeholder="0" />
          </div>
          <FInput label="Bonus (Rs.)" field="bonus" value={form.bonus} onChange={upd} type="number" placeholder="0" />

          {/* Module 8: Deductions */}
          <SectionHead title="Deductions" />
          <div className="space-y-2">
            {(form.deductions || []).map((d, i) => (
              <div key={i} className="flex items-center gap-2 bg-[var(--ap-surface-2)] rounded-xl p-2.5">
                <select value={d.type} onChange={e => updDeduction(i,'type',e.target.value)}
                  className="ap-field ap-focus flex-1 h-10 px-2.5 text-xs rounded-[10px] outline-none appearance-none">
                  {DEDUCTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <input type="number" value={d.amount} onChange={e => updDeduction(i,'amount',e.target.value)}
                  placeholder="Amount" className="ap-field ap-focus w-24 h-10 px-2.5 text-xs rounded-[10px] outline-none" />
                <IconButton icon={X} label="Remove deduction" tone="danger" size={13} onClick={() => removeDeduction(i)} className="flex-shrink-0" />
              </div>
            ))}
            <button onClick={addDeduction}
              className="ap-focus w-full py-2 rounded-xl border border-dashed border-[var(--ap-border)] text-slate-500 dark:text-slate-400 text-xs font-semibold hover:bg-slate-500/5 transition-colors">
              + Add Deduction
            </button>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200">Notes</label>
            <textarea value={form.notes||''} onChange={e => upd('notes', e.target.value)} rows={2}
              className="ap-field ap-focus w-full px-3.5 py-3 text-sm rounded-[12px] outline-none resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--ap-border)] flex gap-2 flex-shrink-0">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Create Settlement'}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────────────────────
//  Module 4: Payslip View
// ─────────────────────────────────────────────────────────────
/* Trip-based monthly payslip — renders the exact buildDriverMonthlyPayroll
   object shown in the table and drawer (single source of truth). */
function TripPayrollPayslipView({ payroll: P, onClose }) {
  const tripRows = P.trips.map(t => ({
    key: t.id ?? t.bookingNo ?? t.booking_id,
    date: (t.startDate || '').slice(0, 10),
    id: t.bookingNo || t.booking_id || t.id,
    customer: t.customer || '—',
    route: `${t.pickup || '—'} → ${t.drop || '—'}`,
    allowance: Number(t.driverAllowance ?? t.driver_allowance) || 0,
    bata: Number(t.bata) || 0,
  }))
  const printPayroll = () => {
    const row = (l, v, neg) => `<tr><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9">${l}</td><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700${neg ? ';color:#dc2626' : ''}">${neg ? '− ' : ''}Rs. ${Number(v || 0).toLocaleString('en-IN')}</td></tr>`
    const html = `<!DOCTYPE html><html><head><title>Payslip – ${P.driver} – ${monthLabel(Number(P.monthKey.slice(5)), Number(P.monthKey.slice(0, 4)))}</title>
    <style>body{font-family:Arial,sans-serif;max-width:560px;margin:24px auto;color:#111;font-size:13px}.header{background:#0d1b4b;color:white;padding:20px;border-radius:8px 8px 0 0}.net{background:#065f46;color:white;padding:12px;border-radius:8px;text-align:center;margin-top:12px}.footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:12px}table{width:100%;border-collapse:collapse}th{background:#f8fafc;padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase}</style>
    </head><body><div class="header"><div style="font-size:10px;opacity:.6;text-transform:uppercase">Sri Jayam Travels</div><h2 style="margin:4px 0">Driver Payslip</h2><p style="margin:0;opacity:.6">${monthLabel(Number(P.monthKey.slice(5)), Number(P.monthKey.slice(0, 4)))} · ${P.driver}</p></div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:16px;border-radius:0 0 8px 8px">
    <table><tbody>
    <tr><td style="padding:6px 4px">Total Trips</td><td style="padding:6px 4px;text-align:right;font-weight:700">${P.tripCount}</td></tr>
    <tr><td style="padding:6px 4px">Days Worked</td><td style="padding:6px 4px;text-align:right;font-weight:700">${P.daysWorked}</td></tr>
    </tbody></table>
    <table style="margin-top:12px"><thead><tr><th>Earnings</th><th></th></tr></thead><tbody>
    ${row('Salary (trip allowances)', P.salaryTotal)}
    ${row('Bata Extra (customer)', P.bataExtra)}
    <tr style="font-weight:900;background:#f8fafc"><td style="padding:8px 4px">Total Payable</td><td style="padding:8px 4px;text-align:right">Rs. ${P.gross.toLocaleString('en-IN')}</td></tr>
    </tbody></table>
    <table style="margin-top:12px"><thead><tr><th>Date</th><th>Trip</th><th>Customer</th><th>Route</th><th style="text-align:right">Allowance</th><th style="text-align:right">Bata Extra</th></tr></thead><tbody>
    ${tripRows.map(r => `<tr><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9">${r.date}</td><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9">${r.id}</td><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9">${r.customer}</td><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9">${r.route}</td><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;text-align:right">Rs. ${r.allowance.toLocaleString('en-IN')}</td><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700">Rs. ${r.bata.toLocaleString('en-IN')}</td></tr>`).join('')}
    </tbody></table>
    <div class="net"><div style="font-size:11px;opacity:.7;text-transform:uppercase">Total Payable</div><div style="font-size:28px;font-weight:900">Rs. ${P.gross.toLocaleString('en-IN')}</div><div style="font-size:10px;opacity:.6;margin-top:2px">Paid Rs. ${P.paidAmount.toLocaleString('en-IN')} · Balance Rs. ${P.balance.toLocaleString('en-IN')}</div></div>
    <p class="footer">Generated by Sri Jayam Travels ERP · ${new Date().toLocaleDateString('en-IN')}</p></div></body></html>`
    const w = window.open('', '_blank', 'width=640,height=800')
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close() }, 350)
  }
  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative w-full sm:w-[560px] max-h-[92vh] sm:max-h-[88vh] ap-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-[var(--ap-border)] rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-t-3xl p-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Sri Jayam Travels</p>
              <h3 className="font-sf font-semibold text-white text-lg">Driver Payslip</h3>
              <p className="text-white/60 text-xs">{monthLabel(Number(P.monthKey.slice(5)), Number(P.monthKey.slice(0, 4)))} · {P.driver}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={printPayroll} title="Print / Download PDF"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors">
                <Printer size={12} /> Print
              </button>
              <button onClick={onClose} aria-label="Close payslip" className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20"><X size={15} /></button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={P.driver} size={36} />
            <div><p className="font-bold text-white">{P.driver}</p><p className="text-white/50 text-xs">{P.tripCount} trips · {P.daysWorked} days worked</p></div>
            <div className="ml-auto"><StatusBadge status={P.status} /></div>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div className="bg-[var(--ap-surface-2)] rounded-xl p-3 border border-[var(--ap-border)]">
            <AmtRow label="Salary (trip allowances)" value={P.salaryTotal} />
            <AmtRow label="Bata Extra (customer)" value={P.bataExtra} sub />
            <div className="flex justify-between pt-2 mt-1 border-t border-[var(--ap-border)]">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total Payable</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Rs. {P.gross.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500 dark:text-slate-400">Paid Rs. {P.paidAmount.toLocaleString('en-IN')}</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">Balance Rs. {P.balance.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Trip Details ({P.tripCount})</p>
            <div className="space-y-1.5">
              {tripRows.map(r => (
                <div key={r.key} className="flex items-center gap-2 text-xs bg-[var(--ap-surface-2)] rounded-lg px-3 py-2 border border-[var(--ap-border)]">
                  <span className="text-slate-400 tabular-nums flex-shrink-0">{String(r.date).slice(5)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{r.customer}</p>
                    <p className="text-[10px] text-slate-400 truncate">{r.route}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">Rs. {r.allowance.toLocaleString('en-IN')}</p>
                    {r.bata > 0 && <p className="text-[10px] text-teal-600 dark:text-teal-400 tabular-nums">+ Rs. {r.bata.toLocaleString('en-IN')}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

function PayslipView({ settlement, onClose }) {
  const wagePay        = Number(settlement.wagePay ?? settlement.baseSalary ?? 0)
  const daysWorked     = Number(settlement.daysWorked ?? settlement.workingDays ?? 0)
  const dailyWage      = Number(settlement.dailyWage ?? (daysWorked > 0 ? Math.round(wagePay / daysWorked) : 0))
  const bataDirect     = Number(settlement.bataDirect ?? settlement.bataAmt ?? 0)
  const nightAllowance = Number(settlement.night_allowance || 0)
  const fuelIncentive  = Number(settlement.fuel_incentive  || settlement.fuelAmt  || 0)
  const perfBonus      = Number(settlement.performance_bonus || settlement.bonus  || 0)
  const penalty        = Number(settlement.penalty  || 0)
  const advance        = Number(settlement.advance  || 0)
  const parking        = Number(settlement.parkingAmt || 0)
  const incentive      = Number(settlement.incentive  || 0)
  const totalEarnings  = wagePay + nightAllowance + fuelIncentive + perfBonus + parking + incentive
  const totalDeductions= Number(settlement.totalDeductions || 0) + penalty + advance
  const netSalary      = totalEarnings - totalDeductions

  const handlePrint = () => {
    const tableRow = (l, v) => `<tr><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9">${l}</td><td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700">Rs. ${Number(v||0).toLocaleString('en-IN')}</td></tr>`
    const html = `<!DOCTYPE html><html><head><title>Payslip – ${settlement.driver} – ${monthLabel(settlement.month,settlement.year)}</title>
    <style>body{font-family:Arial,sans-serif;max-width:480px;margin:24px auto;color:#111;font-size:13px}.header{background:#0d1b4b;color:white;padding:20px;border-radius:8px 8px 0 0}.net{background:#065f46;color:white;padding:12px;border-radius:8px;text-align:center;margin-top:12px}.footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:12px}table{width:100%;border-collapse:collapse}th{background:#f8fafc;padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase}</style>
    </head><body><div class="header"><div style="font-size:10px;opacity:.6;text-transform:uppercase">Sri Jayam Travels</div><h2 style="margin:4px 0">Monthly Payslip</h2><p style="margin:0;opacity:.6">${monthLabel(settlement.month,settlement.year)} · ${settlement.driver}</p></div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:16px;border-radius:0 0 8px 8px">
    <table><thead><tr><th>Attendance</th><th style="text-align:right"></th></tr></thead><tbody>
    <tr><td style="padding:6px 4px">Days Driven</td><td style="padding:6px 4px;text-align:right;font-weight:700">${daysWorked}</td></tr>
    <tr><td style="padding:6px 4px">Total Trips</td><td style="padding:6px 4px;text-align:right;font-weight:700">${settlement.totalTrips||0}</td></tr>
    <tr><td style="padding:6px 4px">Completed Trips</td><td style="padding:6px 4px;text-align:right;font-weight:700">${settlement.completedTrips||0}</td></tr>
    </tbody></table>
    <table style="margin-top:12px"><thead><tr><th>Earnings</th><th></th></tr></thead><tbody>
    ${tableRow(`Daily Wage x ${daysWorked} days`,wagePay)}
    ${bataDirect?`<tr><td style="padding:6px 4px">Bata (direct to driver — not in payout)</td><td style="padding:6px 4px;text-align:right;font-weight:700">Rs. ${bataDirect.toLocaleString('en-IN')}</td></tr>`:''}
    ${nightAllowance?tableRow('Night Allowance',nightAllowance):''}
    ${fuelIncentive?tableRow('Fuel Incentive',fuelIncentive):''}${parking?tableRow('Parking',parking):''}
    ${incentive?tableRow('Trip Incentive',incentive):''}${perfBonus?tableRow('Performance Bonus',perfBonus):''}
    <tr style="font-weight:900;background:#f8fafc"><td style="padding:8px 4px">Gross Earnings</td><td style="padding:8px 4px;text-align:right">Rs. ${totalEarnings.toLocaleString('en-IN')}</td></tr>
    </tbody></table>
    ${totalDeductions>0?`<table style="margin-top:12px"><thead><tr><th>Deductions</th><th></th></tr></thead><tbody>
    ${penalty?tableRow('Penalty',penalty):''}${advance?tableRow('Advance Recovery',advance):''}
    ${(settlement.deductions||[]).map(d=>`<tr><td style="padding:6px 4px">${d.type}</td><td style="padding:6px 4px;text-align:right;font-weight:700;color:#dc2626">- Rs. ${Number(d.amount).toLocaleString('en-IN')}</td></tr>`).join('')}
    <tr style="color:#dc2626;font-weight:900"><td style="padding:8px 4px">Total Deductions</td><td style="padding:8px 4px;text-align:right">- Rs. ${totalDeductions.toLocaleString('en-IN')}</td></tr>
    </tbody></table>`:''}
    <div class="net"><div style="font-size:11px;opacity:.7;text-transform:uppercase">Net Salary</div><div style="font-size:28px;font-weight:900">Rs. ${netSalary.toLocaleString('en-IN')}</div><div style="font-size:10px;opacity:.6;margin-top:2px">${monthLabel(settlement.month,settlement.year)}</div></div>
    ${settlement.status==='paid'&&settlement.paymentDate?`<p style="text-align:center;color:#059669;font-size:11px;margin-top:10px">✓ Paid ${settlement.paymentDate} via ${settlement.paymentMethod||''}</p>`:''}
    <p class="footer">Generated by Sri Jayam Travels ERP · ${new Date().toLocaleDateString('en-IN')}</p></div></body></html>`
    const w = window.open('','_blank','width=560,height=700')
    w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},350)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative w-full sm:w-[420px] max-h-[92vh] sm:max-h-[88vh] ap-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-[var(--ap-border)] rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-t-3xl p-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Sri Jayam Travels</p>
              <h3 className="font-sf font-semibold text-white text-lg">Monthly Payslip</h3>
              <p className="text-white/60 text-xs">{monthLabel(settlement.month, settlement.year)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handlePrint} title="Print / Download"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors">
                <Printer size={12} /> Print
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20"><X size={15} /></button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={settlement.driver} size={36} />
            <div><p className="font-bold text-white">{settlement.driver}</p><p className="text-white/50 text-xs">{settlement.id}</p></div>
            <div className="ml-auto"><StatusBadge status={settlement.status} /></div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {/* Attendance */}
          <div className="grid grid-cols-3 gap-2">
            {[{label:'Days Driven',value:daysWorked},{label:'Trips',value:settlement.totalTrips||0},{label:'Completed',value:settlement.completedTrips||0}].map(s=>(
              <div key={s.label} className="bg-[var(--ap-surface-2)] rounded-xl p-2.5 text-center border border-[var(--ap-border)]">
                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{s.value}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Earnings */}
          <div className="bg-[var(--ap-surface-2)] rounded-xl p-3 border border-[var(--ap-border)]">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Earnings</p>
            <AmtRow label={`Daily Wage × ${daysWorked} day${daysWorked !== 1 ? 's' : ''}`} value={wagePay} />
            {bataDirect > 0 && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Bata Rs. {bataDirect.toLocaleString('en-IN')} went straight to the driver — not in payout.
              </p>
            )}
            {nightAllowance > 0 && <AmtRow label="Night Allowance"   value={nightAllowance} sub />}
            {fuelIncentive  > 0 && <AmtRow label="Fuel Incentive"    value={fuelIncentive}  sub />}
            {parking        > 0 && <AmtRow label="Parking Reimb."    value={parking}        sub />}
            {incentive      > 0 && <AmtRow label="Trip Incentive"    value={incentive}      sub />}
            {perfBonus      > 0 && <AmtRow label="Performance Bonus" value={perfBonus}      sub />}
            <div className="flex justify-between pt-2 mt-1 border-t border-[var(--ap-border)]">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Gross Earnings</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Rs. {totalEarnings.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Deductions */}
          {(totalDeductions > 0 || (settlement.deductions||[]).length > 0) && (
            <div className="bg-red-50 dark:bg-red-900/15 rounded-xl p-3 border border-red-100 dark:border-red-800/30">
              <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">Deductions</p>
              {penalty > 0 && <AmtRow label="Penalty"          value={penalty} deduct />}
              {advance > 0 && <AmtRow label="Advance Recovery" value={advance} deduct />}
              {(settlement.deductions||[]).map((d,i) => (
                <div key={i} className="flex justify-between text-xs py-1">
                  <span className="text-red-700 dark:text-red-400 font-medium">{DEDUCTION_TYPES.find(t=>t.key===d.type)?.label||d.type}</span>
                  <span className="font-bold text-red-600 dark:text-red-400">− Rs. {Number(d.amount).toLocaleString('en-IN')}</span>
                </div>
              ))}
              {totalDeductions > 0 && (
                <div className="flex justify-between pt-2 mt-1 border-t border-red-200 dark:border-red-800/40">
                  <span className="text-xs font-bold text-red-700 dark:text-red-400">Total Deductions</span>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">− Rs. {totalDeductions.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          )}

          {/* Net hero */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-2xl p-4 text-center shadow-lg">
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">Net Salary</p>
            <p className="font-sf font-semibold text-white text-3xl">Rs. {netSalary.toLocaleString('en-IN')}</p>
            <p className="text-white/60 text-[10px] mt-1">{monthLabel(settlement.month, settlement.year)}</p>
          </div>

          {settlement.status === 'paid' && settlement.paymentDate && (
            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/15 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800/30">
              <Wallet size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Paid on {settlement.paymentDate}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500">{settlement.paymentMethod}{settlement.paymentRemarks?` · ${settlement.paymentRemarks}`:''}</p>
              </div>
            </div>
          )}
          {settlement.notes && <p className="text-xs text-slate-500 dark:text-slate-400 italic">{settlement.notes}</p>}
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Salary History Panel (Module 5) ──────────────────────────
function SalaryHistoryPanel({ settlements, onViewPayslip }) {
  const [driverFilter, setDriverFilter] = useState('all')
  const drivers = useMemo(() => [...new Set(settlements.map(s=>s.driver).filter(Boolean))].sort(), [settlements])
  const filtered = useMemo(() => {
    const items = driverFilter==='all' ? settlements : settlements.filter(s=>s.driver===driverFilter)
    return [...items].sort((a,b) => b.year!==a.year ? b.year-a.year : b.month-a.month)
  }, [settlements, driverFilter])
  const driverTotals = useMemo(() => {
    const map = {}
    settlements.forEach(s => {
      if (!map[s.driver]) map[s.driver] = { driver:s.driver, count:0, total:0, paid:0 }
      map[s.driver].count++
      map[s.driver].total += Number(s.netAmount||0)
      if (s.status==='paid') map[s.driver].paid += Number(s.netAmount||0)
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  }, [settlements])
  const MN = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return (
    <div className="space-y-4">
      {driverTotals.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Driver Summary</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {driverTotals.map(d => (
              <div key={d.driver} onClick={() => setDriverFilter(driverFilter===d.driver?'all':d.driver)}
                className={`ap-surface rounded-xl p-3 cursor-pointer hover:shadow-md transition-all ${driverFilter===d.driver?'ring-2 ring-navy-500/30':''}`}>
                <div className="flex items-center gap-2.5">
                  <Avatar name={d.driver} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{d.driver}</p>
                    <p className="text-[10px] text-slate-400">{d.count} settlements</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Rs. {d.total.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-slate-400">Rs. {d.paid.toLocaleString('en-IN')} paid</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <FieldSelect value={driverFilter} onChange={e=>setDriverFilter(e.target.value)} className="w-44">
          <option value="all">All Drivers</option>
          {drivers.map(d => <option key={d} value={d}>{d}</option>)}
        </FieldSelect>
        <p className="text-xs text-slate-400">{filtered.length} records</p>
      </div>
      {filtered.length === 0 ? (
        <div className="ap-surface rounded-2xl">
          <EmptyState icon={IndianRupee} title="No salary history yet" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} className="ap-surface rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-3.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--ap-accent)] flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-blue-400 uppercase leading-none">{MN[s.month]}</span>
                  <span className="text-xs font-semibold text-white leading-tight">{s.year}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{s.driver}</p>
                  <p className="text-[10px] text-slate-400">{s.completedTrips||0} trips · {s.workingDays||0} days</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-semibold text-slate-800 dark:text-white">Rs. {Number(s.netAmount||0).toLocaleString('en-IN')}</p>
                  <StatusBadge status={s.status} />
                </div>
                <IconButton icon={FileText} label="View payslip" size={14} onClick={() => onViewPayslip(s)}
                  className="border border-[var(--ap-border)] flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Module 10: Mark Paid Modal
// ─────────────────────────────────────────────────────────────
function MarkPaidModal({ settlement, onClose, onSave }) {
  const [form, setForm] = useState({ paymentDate: new Date().toISOString().slice(0,10), paymentMethod:'Bank Transfer', paymentRemarks:'' })
  const upd = (f,v) => setForm(p => ({ ...p, [f]: v }))
  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative w-full sm:w-80 ap-surface rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl animate-fade-up">
        <div className="w-10 h-1 bg-[var(--ap-border)] rounded-full mx-auto mb-4 sm:hidden" />
        <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base mb-1">Mark as Paid</h3>
        <p className="text-xs text-slate-500 mb-4">{settlement.driver} · {monthLabel(settlement.month, settlement.year)} · Rs. {settlement.netAmount.toLocaleString('en-IN')}</p>
        <div className="space-y-3 mb-4">
          <FInput    label="Payment Date"    field="paymentDate"    value={form.paymentDate}    onChange={upd} type="date" required />
          <FSelect   label="Payment Method"  field="paymentMethod"  value={form.paymentMethod}  onChange={upd}>
            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
          </FSelect>
          <FInput    label="Remarks"         field="paymentRemarks" value={form.paymentRemarks} onChange={upd} placeholder="Optional" />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="teal" className="flex-1" onClick={() => onSave({ ...settlement, status:'paid', ...form, updatedAt: new Date().toISOString() })}>
            Confirm Payment
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────────────────────
//  Settlement row detail panel
// ─────────────────────────────────────────────────────────────
function SettlementDetail({ s, onEdit, onDelete, onApprove, onSubmit, onMarkPaid, onViewPayslip, canEdit, canDelete, canApprove, isAdmin }) {
  const canSubmit  = s.status === 'draft'
  const canApprov  = canApprove && s.status === 'pending'
  const canPay     = isAdmin && s.status === 'approved'
  const isApproved = s.status === 'approved' || s.status === 'paid'

  return (
    <div className="border-t border-[var(--ap-border)] p-4 bg-[var(--ap-surface-2)] space-y-3">
      {/* Breakdown */}
      <div className="bg-[var(--ap-surface-2)] rounded-xl p-3 border border-[var(--ap-border)]">
        <AmtRow label={`Daily Wage × ${Number(s.daysWorked ?? s.workingDays ?? 0)} days`} value={s.wagePay ?? s.baseSalary} />
        {Number(s.bataDirect ?? s.bataAmt ?? 0) > 0 && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Bata Rs. {Number(s.bataDirect ?? s.bataAmt ?? 0).toLocaleString('en-IN')} direct to driver — not in payout.
          </p>
        )}
        <AmtRow label="Fuel"                value={s.fuelAmt}          sub />
        <AmtRow label="Parking"             value={s.parkingAmt}       sub />
        <AmtRow label="Incentive"           value={s.incentive}        sub />
        {s.bonus > 0 && <AmtRow label="Bonus" value={s.bonus}         sub />}
        <AmtRow label="Gross"               value={s.grossAmount}      />
        {s.totalDeductions > 0 && <AmtRow label="Deductions" value={s.totalDeductions} deduct />}
        <div className="flex justify-between pt-2 mt-1 border-t border-[var(--ap-border)]">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Net Amount</span>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Rs. {s.netAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Deductions detail */}
      {(s.deductions||[]).length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/15 rounded-xl p-3 border border-red-100 dark:border-red-800/30">
          <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1.5">Deductions</p>
          {s.deductions.map((d,i) => (
            <div key={i} className="flex justify-between text-xs py-0.5">
              <span className="text-red-700 dark:text-red-400">{DEDUCTION_TYPES.find(t=>t.key===d.type)?.label || d.type}</span>
              <span className="font-bold text-red-600 dark:text-red-400">− Rs. {Number(d.amount).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Payment info */}
      {s.status === 'paid' && s.paymentDate && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/15 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800/30">
          <Wallet size={13} className="text-emerald-600 flex-shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            Paid {s.paymentDate} via {s.paymentMethod}
            {s.paymentRemarks ? ' · ' + s.paymentRemarks : ''}
          </p>
        </div>
      )}

      {s.notes && <p className="text-xs text-slate-500 dark:text-slate-400 italic">{s.notes}</p>}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap pt-1">
        <Button variant="outline" size="sm" icon={FileText} onClick={() => onViewPayslip(s)}>Payslip</Button>
        {canSubmit && <Button variant="primary" size="sm" icon={Send} onClick={() => onSubmit(s)}>Submit</Button>}
        {canApprov && <Button variant="primary" size="sm" icon={CheckCircle} onClick={() => onApprove(s)}>Approve</Button>}
        {canPay && <Button variant="teal" size="sm" icon={Wallet} onClick={() => onMarkPaid(s)}>Mark Paid</Button>}
        {canEdit && !isApproved && <Button variant="outline" size="sm" icon={Edit2} onClick={() => onEdit(s)}>Edit</Button>}
        {canDelete && !isApproved && <Button variant="danger" size="sm" icon={Trash2} onClick={() => onDelete(s.id)}>Delete</Button>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Per-Trip Payslip Card
// ─────────────────────────────────────────────────────────────
function TripPayslipCard({ p }) {
  const [open, setOpen] = useState(false)
  const isPaid = p.status === 'paid'
  const driverGets = tripDriverAmount(p)
  return (
    <div className="ap-surface rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setOpen(v => !v)}>
        {/* Date badge */}
        <div className="w-11 h-11 rounded-xl bg-[var(--ap-accent)] flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-[8px] font-bold text-blue-400 uppercase leading-none">
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date(p.date).getMonth()]}
          </span>
          <span className="text-sm font-semibold text-white leading-tight">{new Date(p.date).getDate()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{p.customer}</p>
          <p className="text-[10px] text-slate-400 truncate">{p.pickup} → {p.drop || '—'}</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{p.bookingNo}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">Rs. {driverGets.toLocaleString('en-IN')}</p>
          <StatusPill tone={isPaid ? 'green' : 'amber'}>{isPaid ? 'Paid' : 'Pending'}</StatusPill>
        </div>
        {open ? <ChevronUp size={13} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-[var(--ap-border)] px-4 pb-4 pt-3 space-y-2 bg-[var(--ap-surface-2)]">
          <div className="ap-surface rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Trip Fare (company)</span><span className="font-bold text-slate-700 dark:text-slate-200">Rs. {p.fare.toLocaleString('en-IN')}</span></div>
            {p.bata > 0 && <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400 pl-2">+ Bata (straight to driver)</span><span className="font-bold text-emerald-600 dark:text-emerald-400">Rs. {p.bata.toLocaleString('en-IN')}</span></div>}
            {p.fuel > 0 && <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400 pl-2">+ Fuel</span><span className="font-bold text-emerald-600 dark:text-emerald-400">Rs. {p.fuel.toLocaleString('en-IN')}</span></div>}
            {p.parking > 0 && <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400 pl-2">+ Parking</span><span className="font-bold text-emerald-600 dark:text-emerald-400">Rs. {p.parking.toLocaleString('en-IN')}</span></div>}
            <div className="flex justify-between pt-1.5 border-t border-[var(--ap-border)]">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Driver Gets</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Rs. {driverGets.toLocaleString('en-IN')}</span>
            </div>
          </div>
          {isPaid && p.paidAt && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle size={10} /> Paid on {p.paidAt.slice(0,10)}{p.paidBy ? ` by ${p.paidBy}` : ''}
            </p>
          )}
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{p.id} · {p.vehicle || '—'}</p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Driver-only payslips portal — per-trip model
// ─────────────────────────────────────────────────────────────
function DriverPayslipPortal({ user }) {
  const [_allPay, setAllPay] = useState([])
  useEffect(()=>{ loadTripPayslips().then(p=>setAllPay(Array.isArray(p)?p:[])) },[])
  const mine = _allPay.filter(p => p.driver === user?.name)

  const totalEarned = mine.reduce((s, p) => s + tripDriverAmount(p), 0)
  const totalPaid   = mine.filter(p => p.status === 'paid').reduce((s, p) => s + tripDriverAmount(p), 0)
  const pending     = mine.filter(p => p.status === 'pending').reduce((s, p) => s + tripDriverAmount(p), 0)

  return (
    <div className="space-y-4">
      {/* Earnings summary */}
      <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background:'linear-gradient(135deg,#0d1b4b 0%,#1e3a8a 60%,#1d4ed8 100%)' }}>
        <div className="p-5">
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">Sri Jayam Travels</p>
          <h2 className="font-sf font-semibold text-white text-xl mb-4">My Trip Earnings</h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label:'Total Trips',  value: mine.length },
              { label:'Paid Trips',   value: mine.filter(p => p.status === 'paid').length },
              { label:'Pending',      value: mine.filter(p => p.status === 'pending').length },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-white font-bold text-sm">{s.value}</p>
                <p className="text-white/50 text-[9px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-white/60 text-[10px] font-bold uppercase">Total Earned</p>
              <p className="font-sf font-semibold text-white text-lg">Rs. {totalEarned.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-emerald-500/30 rounded-xl p-3 text-center">
              <p className="text-white/60 text-[10px] font-bold uppercase">Pending Pay</p>
              <p className="font-sf font-semibold text-amber-300 text-lg">Rs. {pending.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trip payslip list */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Trip Payslips</p>
        {mine.length === 0 ? (
          <div className="ap-surface rounded-2xl">
            <EmptyState icon={IndianRupee} title="No trip payslips yet" description="Payslips are generated automatically when you complete a trip" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {mine.map(p => <TripPayslipCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main Payroll Page
// ─────────────────────────────────────────────────────────────
export default function Payroll() {
  const { user, isAdmin, isManager, isDriver, can } = useAuth()

  const canCreate  = isAdmin || isManager
  const canEdit    = isAdmin || isManager
  const canDelete  = isAdmin
  const canApprove = isAdmin

  const now0 = new Date()
  const [month,        setMonth]        = useState(now0.getMonth() + 1)
  const [year,         setYear]         = useState(now0.getFullYear())
  const [settlements,  setSettlements]  = useState([])
  const [tripPayslips, setTripPayslips] = useState([])
  const [bookings,     setBookings]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editItem,     setEditItem]     = useState(null)
  const [payslipItem,  setPayslipItem]  = useState(null)
  const [markPaidItem, setMarkPaidItem] = useState(null)
  const [driverFilter, setDriverFilter] = useState('all')
  const [statFilter,   setStatFilter]   = useState('all')
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [drawerDriver, setDrawerDriver] = useState(null)
  const [payslipDriver, setPayslipDriver] = useState(null)
  const [drivers,      setDrivers]      = useState([])
  const [loadError,    setLoadError]    = useState(null)

  const navigate = useNavigate()
  const { toast } = useToast()
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const hideMoney = !can('revenueDashboard')
  const money = (v) => hideMoney ? '—' : `Rs. ${Number(v || 0).toLocaleString('en-IN')}`

  const showToast = title => toast?.({ type: 'success', title })
  const showError = title => toast?.({ type: 'error', title })
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [s, p, d, b] = await Promise.allSettled([loadSettlements(), loadTripPayslips(), loadDrivers(), loadBookings()])
      setSettlements( s.status === 'fulfilled' && Array.isArray(s.value) ? s.value : [])
      setTripPayslips(p.status === 'fulfilled' && Array.isArray(p.value) ? p.value : [])
      setDrivers(     d.status === 'fulfilled' && Array.isArray(d.value) ? d.value : [])
      setBookings(    b.status === 'fulfilled' && Array.isArray(b.value) ? b.value : [])
      const failed = [s, p, d, b].some(r => r.status === 'rejected')
      if (failed) {
        [s, p, d, b].forEach(r => { if (r.status === 'rejected') console.error('[Payroll] load failed:', r.reason) })
        setLoadError('Some payroll data failed to load. Try refreshing.')
      } else {
        setLoadError(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { reload() }, [reload])

  // Driver gets their own portal (unchanged)
  if (isDriver) return (
    <div className="space-y-5 animate-fade-up max-w-lg mx-auto">
      <PageHeader title="My Payslips" subtitle="Per-trip payslip history" />
      <DriverPayslipPortal user={user} />
    </div>
  )

  // ── One payroll row per driver with eligible trips this month ──
  // Single source of truth: buildDriverMonthlyPayroll.
  const monthSettlements = useMemo(
    () => settlements.filter(s => Number(s.month) === Number(month) && Number(s.year) === Number(year)),
    [settlements, month, year]
  )
  const payrolls = useMemo(() => {
    const byDriver = new Map()
    bookings.forEach(b => {
      if ((b.startDate || '').startsWith(monthKey) && ['completed', 'closed'].includes(b.status) && b.driver) {
        if (!byDriver.has(b.driver)) byDriver.set(b.driver, [])
        byDriver.get(b.driver).push(b)
      }
    })
    return [...byDriver.keys()].sort((a, b) => a.localeCompare(b)).map(name => {
      const d = drivers.find(x => x.name === name)
      const settlement = monthSettlements.find(s => s.driver === name) || null
      return buildDriverMonthlyPayroll({
        driver: name, driverId: d?.id ?? null, monthKey,
        bookings, tripPayslips, settlement,
      })
    })
  }, [bookings, monthKey, monthSettlements, tripPayslips, drivers])

  // Completed trips in month with no driver — accuracy warning, not payroll.
  const orphanTrips = useMemo(() => bookings.filter(b =>
    (b.startDate || '').startsWith(monthKey) &&
    ['completed', 'closed'].includes(b.status) && !b.driver
  ), [bookings, monthKey])

  const filtered = useMemo(() => payrolls.filter(p => {
    const matchD = driverFilter === 'all' || p.driver === driverFilter
    const matchS = statFilter   === 'all' || p.status === statFilter
    const q = search.trim().toLowerCase()
    const matchQ = !q || p.driver.toLowerCase().includes(q)
    return matchD && matchS && matchQ
  }), [payrolls, driverFilter, statFilter, search])

  // ── KPIs (real month data) ────────────────────────────────
  const kpiDrivers  = payrolls.length
  const kpiTrips    = payrolls.reduce((s, p) => s + p.tripCount, 0)
  const kpiSalary = payrolls.reduce((s, p) => s + p.salaryTotal, 0)
  const kpiBata   = payrolls.reduce((s, p) => s + p.bataExtra, 0)
  const kpiPending  = monthSettlements.filter(s => s.status === 'pending').length
  const kpiPaid     = monthSettlements.filter(s => s.status === 'paid').length

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [month, year, search, driverFilter, statFilter])

  // Actions
  const handleSave = async s => {
    const result = await saveSettlement(s)
    if (!result) { showError('Could not save settlement. Please try again.'); return }
    await reload()
    setShowCreate(false)
    setEditItem(null)
    showToast(editItem ? 'Settlement updated' : 'Settlement created')
  }
  const handleDelete = async id => {
    if (!window.confirm('Delete this settlement?')) return
    const ok = await deleteSettlement(id)
    if (!ok) { showError('Could not delete settlement. Please try again.'); return }
    await reload()
    setExpanded(null)
    showToast('Deleted')
  }
  const handleSubmit = async s => {
    const result = await saveSettlement({ ...s, status:'pending', updatedAt: new Date().toISOString() })
    if (!result) { showError('Could not submit settlement. Please try again.'); return }
    await reload()
    showToast(`${s.id} submitted for approval`)
  }
  const handleApprove = async s => {
    const result = await saveSettlement({ ...s, status:'approved', approvedBy: user?.name, updatedAt: new Date().toISOString() })
    if (!result) { showError('Could not approve settlement. Please try again.'); return }
    await reload()
    showToast(`${s.id} approved`)
  }
  const handleMarkPaid = async s => {
    const result = await saveSettlement(s)
    if (!result) { showError('Could not mark settlement as paid. Please try again.'); return }
    await reload()
    setMarkPaidItem(null)
    showToast(`${s.id} marked as paid`)
    addAuditEvent('PAYROLL_SETTLED', {
      description: `${s.driver} — Rs. ${(s.netAmount||0).toLocaleString('en-IN')} marked paid`,
      driver: s.driver,
    })
  }
  // Generate a draft monthly settlement from the driver's trips (existing
  // saveSettlement flow — no new backend). Idempotent per driver/month.
  const handleGenerate = async ( payroll ) => {
    if (payroll.tripCount === 0) { showToast('No eligible trips for this driver this month.'); return }
    if (payroll.settlement) {
      setDrawerDriver(payroll.driver)
      setPayslipDriver(payroll.driver)
      return
    }
    const now = new Date().toISOString()
    const rec = {
      id: generateSettlementId(),
      driver: payroll.driver,
      month: Number(month), year: Number(year),
      daysWorked: payroll.daysWorked,
      workingDays: payroll.daysWorked,
      completedTrips: payroll.tripCount,
      totalTrips: payroll.tripCount,
      salaryTotal: payroll.salaryTotal,
      bataExtra: payroll.bataExtra,
      grossAmount: payroll.gross, netAmount: payroll.gross,
      status: 'draft',
      createdBy: user?.name || '', createdAt: now, updatedAt: now,
    }
    const result = await saveSettlement(rec)
    if (!result) { showError('Could not generate payslip. Please try again.'); return }
    await reload()
    setDrawerDriver(payroll.driver)
    setPayslipDriver(payroll.driver)
    showToast(`Draft payslip generated for ${payroll.driver}`)
  }
  const handleGenerateAll = async () => {
    const targets = payrolls.filter(p => p.tripCount > 0 && !p.settlement)
    if (targets.length === 0) { showToast('Nothing to generate — all drivers already have settlements.'); return }
    let done = 0
    for (const p of targets) {
      const now = new Date().toISOString()
      const result = await saveSettlement({
        id: generateSettlementId(),
        driver: p.driver, month: Number(month), year: Number(year),
        daysWorked: p.daysWorked, workingDays: p.daysWorked,
        completedTrips: p.tripCount, totalTrips: p.tripCount,
        salaryTotal: p.salaryTotal, bataExtra: p.bataExtra,
        grossAmount: p.gross, netAmount: p.gross, status: 'draft',
        createdBy: user?.name || '', createdAt: now, updatedAt: now,
      })
      if (result) done++
    }
    await reload()
    showToast(`Generated ${done} draft payslip${done === 1 ? '' : 's'}`)
  }
  const exportCsv = () => {
    const rows = [['Driver', 'Trips', 'Salary - Allowance (Rs)', 'Bata Extra (Rs)', 'Total (Rs)', 'Paid (Rs)', 'Balance (Rs)', 'Status']]
    filtered.forEach(p => rows.push([
      p.driver, p.tripCount, p.salaryTotal,
      p.bataExtra, p.gross, p.paidAmount, p.balance, p.status,
    ]))
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `payroll-${monthKey}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const setMonthDelta = (d) => {
    let m = month + d, y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }
  const periodStatus = (() => {
    if (payrolls.length === 0) return null
    const sts = monthSettlements.map(s => s.status)
    if (sts.length > 0 && sts.every(s => s === 'paid')) return 'paid'
    if (sts.includes('pending') || sts.includes('approved')) return 'pending'
    if (sts.includes('draft')) return 'draft'
    return 'draft'
  })()

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Payroll & Settlements"
        subtitle={`${monthLabel(month, year)} · ${kpiDrivers} driver${kpiDrivers !== 1 ? 's' : ''} · ${kpiTrips} trips`}
        action={
          canCreate ? (
            <Button variant="primary" icon={Plus} onClick={handleGenerateAll}>Generate Payroll</Button>
          ) : null
        }
      />

      {loadError && (
        <Callout tone="red" icon={AlertTriangle} title={loadError} actionLabel="Retry" onAction={reload} />
      )}

      {/* ── Period selector + period status ── */}
      <div className="ap-surface rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="Previous month" size={16} onClick={() => setMonthDelta(-1)} />
          <p className="font-sf font-semibold text-slate-800 dark:text-white text-sm min-w-[132px] text-center tabular-nums">
            {monthLabel(month, year)}
          </p>
          <IconButton icon={ChevronRight} label="Next month" size={16} onClick={() => setMonthDelta(1)} />
        </div>
        <div className="h-6 w-px bg-[var(--ap-border)] hidden sm:block" />
        {periodStatus ? (
          <div className="flex items-center gap-2">
            <StatusBadge status={periodStatus} />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {kpiPaid} of {payrolls.length} driver{payrolls.length !== 1 ? 's' : ''} paid
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">No trips completed this month yet</span>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label:'Total Drivers',    value: kpiDrivers, icon:User,        tone:'blue'   },
          { label:'Total Trips',      value: kpiTrips,   icon:Calendar,    tone:'blue'   },
          { label:'Salary Payable',   value: hideMoney ? '—' : `Rs.${(kpiSalary/1000).toFixed(1)}k`, icon:IndianRupee, tone:'green'  },
          { label:'Bata Extra',       value: hideMoney ? '—' : `Rs.${(kpiBata/1000).toFixed(1)}k`,   icon:Wallet,      tone:'teal'   },
          { label:'Pending Approval', value: kpiPending, icon:Clock,       tone:'amber', filter:'pending' },
          { label:'Paid',             value: kpiPaid,    icon:CheckCircle, tone:'green', filter:'paid'    },
        ].map(s => (
          <MetricCard key={s.label} icon={s.icon} tone={s.tone} label={s.label} value={s.value}
            className="p-3.5"
            onClick={s.filter ? () => setStatFilter(s.filter) : undefined} />
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search driver…" aria-label="Search driver"
            className={`${fieldCls} pl-9`} />
        </div>
        <FieldSelect value={driverFilter} onChange={e => setDriverFilter(e.target.value)} className="w-40 h-12">
          <option value="all">All Drivers</option>
          {payrolls.map(p => <option key={p.driver} value={p.driver}>{p.driver}</option>)}
        </FieldSelect>
        <FieldSelect value={statFilter} onChange={e => setStatFilter(e.target.value)} className="w-40 h-12">
          <option value="all">All Status</option>
          {SETTLEMENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </FieldSelect>
        {(search || driverFilter !== 'all' || statFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDriverFilter('all'); setStatFilter('all') }}>Clear</Button>
        )}
        <Button variant="outline" size="sm" icon={Download} className="ml-auto" onClick={exportCsv}>Export</Button>
      </div>

      {/* Completed trips with no driver — accuracy warning, not payroll */}
      {orphanTrips.length > 0 && (
        <Callout tone="amber" icon={AlertTriangle}
          title={`${orphanTrips.length} completed trip${orphanTrips.length !== 1 ? 's' : ''} in ${monthLabel(month, year)} ${orphanTrips.length !== 1 ? 'have' : 'has'} no driver assigned`}
          sub={`Payroll below excludes ${orphanTrips.length !== 1 ? 'them' : 'it'}.`}
          actionLabel="Fix in Trips" onAction={() => navigate('/trips')} />
      )}

      <>

      {/* Driver payroll table — one row per driver, trip-based */}
      {loading ? (
        <div className="ap-surface rounded-2xl overflow-hidden">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--ap-border)] last:border-0">
              <div className="w-9 h-9 rounded-full skeleton flex-shrink-0" />
              <div className="flex-1 space-y-1.5"><div className="h-3 w-28 rounded skeleton" /><div className="h-2 w-20 rounded skeleton" /></div>
              <div className="h-4 w-16 rounded skeleton" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ap-surface rounded-2xl">
          <EmptyState icon={Wallet}
            title={payrolls.length === 0 ? `No trips completed in ${monthLabel(month, year)}` : 'No drivers match these filters'}
            description={payrolls.length === 0 ? 'Payroll appears here once drivers complete trips this month' : 'Try clearing search or choosing a different status'}
            action={payrolls.length === 0 ? <Button variant="primary" size="sm" onClick={() => navigate('/trips')}>View Trips</Button> : null} />
        </div>
      ) : (<>
        {/* Desktop table */}
        <div className="ap-surface rounded-2xl overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--ap-surface-2)] border-b border-[var(--ap-border)]">
                  {['Driver','Trips','Salary','Bata Extra','Total','Paid','Balance','Status',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(p => (
                  <tr key={p.driver} onClick={() => setDrawerDriver(p.driver)}
                    className="border-b border-[var(--ap-border)] hover:bg-[var(--ap-surface-2)] transition-colors cursor-pointer">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.driver} size={28} />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{p.driver}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">{p.tripCount}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">{money(p.salaryTotal)}</td>
                    <td className="px-3 py-2.5 text-xs text-teal-600 dark:text-teal-400 tabular-nums whitespace-nowrap">{money(p.bataExtra)}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">{money(p.gross)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">{money(p.paidAmount)}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">{money(p.balance)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        <Eye size={12} /> View
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Mobile cards */}
        <div className="space-y-2.5 md:hidden">
          {pageRows.map(p => (
            <div key={p.driver} onClick={() => setDrawerDriver(p.driver)}
              className="ap-surface rounded-2xl p-4 cursor-pointer active:scale-[0.99] transition-transform">
              <div className="flex items-center gap-2.5 mb-2.5">
                <Avatar name={p.driver} size={32} />
                <p className="font-bold text-slate-800 dark:text-white text-sm flex-1 truncate">{p.driver}</p>
                <StatusBadge status={p.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[var(--ap-surface-2)] rounded-lg py-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{p.tripCount}</p>
                  <p className="text-[9px] text-slate-400">Trips</p>
                </div>
                <div className="bg-[var(--ap-surface-2)] rounded-lg py-1.5">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{hideMoney ? '—' : `Rs.${(p.gross / 1000).toFixed(1)}k`}</p>
                  <p className="text-[9px] text-slate-400">Total</p>
                </div>
                <div className="bg-[var(--ap-surface-2)] rounded-lg py-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{hideMoney ? '—' : `Rs.${(p.balance / 1000).toFixed(1)}k`}</p>
                  <p className="text-[9px] text-slate-400">Balance</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Prev</Button>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">Page {safePage} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next</Button>
          </div>
        )}
      </>)}

      {/* ── Driver detail drawer (same payroll object as table) ── */}
      {drawerDriver && (() => {
        const p = payrolls.find(x => x.driver === drawerDriver)
        if (!p) return null
        const s = p.settlement
        return (
          <ModalOverlay onClose={() => setDrawerDriver(null)}>
            <div className="relative w-full sm:w-[520px] max-h-[92vh] sm:max-h-[88vh] ap-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
              <div className="w-10 h-1 bg-[var(--ap-border)] rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
              <div className="flex items-center gap-3 px-5 pt-4 sm:pt-5 pb-3 flex-shrink-0">
                <Avatar name={p.driver} size={40} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-sf font-semibold text-slate-800 dark:text-white truncate">{p.driver}</h3>
                  <p className="text-xs text-slate-400">{monthLabel(month, year)} · {p.tripCount} trips · {p.daysWorked} days</p>
                </div>
                <StatusBadge status={p.status} />
                <IconButton icon={X} label="Close details" size={16} onClick={() => setDrawerDriver(null)} className="flex-shrink-0" />
              </div>
              <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-3">
                {/* Summary — salary collected + customer bata extra */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l:'Salary',      v: money(p.salaryTotal), c:'text-slate-700 dark:text-slate-200' },
                    { l:'Bata Extra',  v: money(p.bataExtra),   c:'text-teal-600 dark:text-teal-400' },
                    { l:'Total',       v: money(p.gross),       c:'text-emerald-600 dark:text-emerald-400' },
                  ].map(r => (
                    <div key={r.l} className="bg-[var(--ap-surface-2)] rounded-xl px-3 py-2 border border-[var(--ap-border)]">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">{r.l}</p>
                      <p className={`text-sm font-semibold tabular-nums ${r.c}`}>{r.v}</p>
                    </div>
                  ))}
                </div>
                {/* Trips */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Trips ({p.tripCount})</p>
                  {p.trips.some(t => !(Number(t.driverAllowance ?? t.driver_allowance) > 0)) && (
                    <Callout tone="amber" icon={AlertTriangle} title="Some trips have no driver allowance set"
                      actionLabel="Fix in Trips" onAction={() => navigate('/trips')} className="rounded-xl px-3 py-2 mb-1.5" />
                  )}
                  <div className="space-y-1.5">
                    {p.trips.map(t => {
                      const allow = Number(t.driverAllowance ?? t.driver_allowance) || 0
                      const extra = Number(t.bata) || 0
                      return (
                        <div key={t.id ?? t.bookingNo ?? t.booking_id} className="flex items-center gap-2 text-xs bg-[var(--ap-surface-2)] rounded-lg px-3 py-2 border border-[var(--ap-border)]">
                          <span className="text-slate-400 tabular-nums flex-shrink-0">{String(t.startDate || '').slice(5, 10)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{t.customer || '—'}</p>
                            <p className="text-[10px] text-slate-400 truncate">{t.pickup || '—'} → {t.drop || '—'}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold tabular-nums ${allow > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-amber-600 dark:text-amber-400'}`}>
                              {allow > 0 ? money(allow) : 'Not set'}
                            </p>
                            {extra > 0 && <p className="text-[10px] text-teal-600 dark:text-teal-400 tabular-nums">+ {money(extra)} extra</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {/* Totals + actions */}
                <div className="bg-[var(--ap-accent)] rounded-xl px-4 py-3">
                  <div className="flex justify-between text-xs text-white/70"><span>Paid</span><span className="font-bold tabular-nums">{money(p.paidAmount)}</span></div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-white/70 font-bold">Balance</span>
                    <span className="text-base font-semibold text-white tabular-nums">{money(p.balance)}</span>
                  </div>
                  {s?.status === 'paid' && (
                    <p className="text-[10px] text-white/50 mt-1">
                      Paid {s.paymentDate || ''}{s.paymentMethod ? ` · ${s.paymentMethod}` : ''}{s.transactionId ? ` · ${s.transactionId}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!s && canCreate && (
                    <Button variant="primary" icon={FileText} className="flex-1 min-w-[140px]" onClick={() => handleGenerate(p)}>Generate Payslip</Button>
                  )}
                  {s?.status === 'draft' && canEdit && (
                    <Button variant="primary" icon={Send} className="flex-1 min-w-[140px]" onClick={() => handleSubmit(s)}>Submit for Approval</Button>
                  )}
                  {s?.status === 'pending' && canApprove && (
                    <Button variant="primary" icon={CheckCircle} className="flex-1 min-w-[140px]" onClick={() => handleApprove(s)}>Approve &amp; Verify</Button>
                  )}
                  {s?.status === 'approved' && isAdmin && (
                    <Button variant="teal" icon={Wallet} className="flex-1 min-w-[140px]" onClick={() => setMarkPaidItem(s)}>Mark Paid</Button>
                  )}
                  {(s || p.tripCount > 0) && (
                    <Button variant="outline" icon={Printer} onClick={() => setPayslipDriver(p.driver)}>Payslip</Button>
                  )}
                  {s?.status === 'draft' && canDelete && (
                    <Button variant="danger" icon={Trash2} onClick={() => { handleDelete(s); setDrawerDriver(null) }}>Delete</Button>
                  )}
                </div>
              </div>
            </div>
          </ModalOverlay>
        )
      })()}

      {/* Modals */}
      </>
      {(showCreate || editItem) && (
        <SettlementModal
          settlement={editItem}
          drivers={drivers}
          onClose={() => { setShowCreate(false); setEditItem(null) }}
          onSave={handleSave}
          currentUser={user}
        />
      )}
      {payslipDriver && (() => {
        const p = payrolls.find(x => x.driver === payslipDriver)
        return p ? <TripPayrollPayslipView payroll={p} onClose={() => setPayslipDriver(null)} /> : null
      })()}
      {payslipItem  && <PayslipView    settlement={payslipItem}  onClose={() => setPayslipItem(null)}  />}
      {markPaidItem && <MarkPaidModal  settlement={markPaidItem} onClose={() => setMarkPaidItem(null)} onSave={handleMarkPaid} />}

    </div>
  )
}