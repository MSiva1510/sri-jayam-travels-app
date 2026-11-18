// ─── PricingFields ────────────────────────────────────────────────
// Premium pricing card. Amounts are displayed independently on purpose:
// driver allowance (salary) and bata (customer extra) are never assumed
// to be part of the customer fare — no existing calculation is changed.

import { Wallet, Info } from 'lucide-react'
import { fieldCls } from '../ui/Field'
import { pricingBreakdown, formatINR } from '../../utils/bookingForm'

function AmountInput({ id, label, hint, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--ap-text-3)] pointer-events-none">₹</span>
        <input
          id={id}
          type="number"
          min="0"
          inputMode="decimal"
          value={value ?? ''}
          placeholder="0"
          onChange={e => {
            const v = e.target.value
            onChange(v !== '' && Number(v) < 0 ? '0' : v)
          }}
          className={`${fieldCls} pl-8 tabular-nums`}
        />
      </div>
      <p className="text-[10px] font-medium text-[var(--ap-text-3)] mt-1">{hint}</p>
    </div>
  )
}

export default function PricingFields({ fare, driverAllowance, bata, onChange }) {
  const totals = pricingBreakdown({ fare, driverAllowance, bata })
  return (
    <div className="rounded-2xl border border-[var(--ap-border)] overflow-hidden bg-[var(--ap-surface)]">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[var(--ap-surface-2)] border-b border-[var(--ap-border)]">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ap-text-2)] uppercase tracking-wider">
          <Wallet size={13} /> Fare &amp; charges
        </span>
        <span className="text-[10px] font-semibold text-[var(--ap-text-3)] uppercase tracking-wider">INR</span>
      </div>
      <div className="p-3.5 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <AmountInput id="bk-fare" label="Fare" hint="Charged to the customer"
            value={fare} onChange={v => onChange({ fare: v })} />
          <AmountInput id="bk-allowance" label="Driver allowance" hint="Paid to the driver · salary"
            value={driverAllowance} onChange={v => onChange({ driverAllowance: v })} />
          <AmountInput id="bk-bata" label="Bata" hint="Collected from the customer, extra"
            value={bata} onChange={v => onChange({ bata: v })} />
        </div>
        <div className="rounded-xl bg-[var(--ap-surface-2)] p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-[var(--ap-text-2)]">Customer fare</span>
            <span className="font-sf font-semibold text-[var(--ap-text-1)] tabular-nums">{formatINR(totals.fare)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[var(--ap-text-3)]">Driver allowance <span className="text-[10px]">(separate)</span></span>
            <span className="font-semibold text-[var(--ap-text-2)] tabular-nums">{formatINR(totals.driverAllowance)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[var(--ap-text-3)]">Bata <span className="text-[10px]">(separate)</span></span>
            <span className="font-semibold text-[var(--ap-text-2)] tabular-nums">{formatINR(totals.bata)}</span>
          </div>
          <p className="flex items-start gap-1.5 pt-1 text-[10px] leading-snug text-[var(--ap-text-3)] border-t border-[var(--ap-border)]">
            <Info size={11} className="flex-shrink-0 mt-0.5" />
            Allowance and bata are recorded separately. They are not added to the customer fare.
          </p>
        </div>
      </div>
    </div>
  )
}
