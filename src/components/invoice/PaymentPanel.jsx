// ─── PaymentPanel ───────────────────────────────────────────────
// Records one payment at a time against a persisted invoice record and
// shows the append-only payment history. Every submit carries a fresh
// idempotency key; the button is guarded so a rapid double tap reuses it.

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, IndianRupee } from 'lucide-react'
import Button from '../ui/Button'
import { fieldCls } from '../ui/Field'
import StatusPill from '../ui/StatusPill'
import { PAYMENT_METHODS, formatINR, shortDate } from '../../data/invoiceModel'
import { invoicePaymentKey } from '../../data/invoiceRecordData'

const today = () => new Date().toISOString().slice(0, 10)

export default function PaymentPanel({
  invoice, currency = 'Rs.', busy = false, error = '', disabled = false,
  paymentVersion = 0, onRecord,
}) {
  const balance = invoice?.balance || 0
  const [amount, setAmount] = useState(String(balance || ''))
  const [method, setMethod] = useState('Cash')
  const [reference, setReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const keyRef = useRef(invoicePaymentKey())
  const submittingRef = useRef(false)

  useEffect(() => {
    keyRef.current = invoicePaymentKey()
    setAmount(String(invoice?.balance || ''))
    setMethod('Cash')
    setReference('')
    setPaymentDate(today())
    submittingRef.current = false
  }, [invoice?.key, invoice?.balance, paymentVersion])

  // A failed RPC must be retryable with the SAME idempotency key.
  useEffect(() => {
    if (error) submittingRef.current = false
  }, [error])

  const submit = (event) => {
    event.preventDefault()
    const value = Number(amount)
    if (!invoice?.record || submittingRef.current || busy || disabled) return
    if (!Number.isFinite(value) || value <= 0 || value > balance + 0.01) return
    submittingRef.current = true
    // Keep the key until the parent confirms success (paymentVersion bump).
    // Rotating here would let a network retry create a second payment.
    const idempotencyKey = keyRef.current
    onRecord?.({
      invoiceId: invoice.record.id,
      amount: Math.round(value * 100) / 100,
      method,
      reference: reference.trim(),
      paymentDate,
      idempotencyKey,
    })
  }

  const history = invoice?.paymentRecords || []

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment</p>
          <StatusPill tone={invoice?.paymentStatus === 'paid' ? 'green' : invoice?.paymentStatus === 'partial' ? 'amber' : 'gray'}>
            {invoice?.paymentStatus || 'pending'}
          </StatusPill>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div>
            <p className="text-[10px] text-slate-400">Received</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatINR(invoice?.paid || 0, currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Balance</p>
            <p className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{formatINR(balance, currency)}</p>
          </div>
        </div>
      </div>

      {!invoice?.record ? (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          Issue this invoice before recording a payment.
        </div>
      ) : balance <= 0 ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={14} /> Settled in full.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-2.5">
          <label className="block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</span>
            <input
              type="number" min="0.01" step="0.01" max={balance}
              value={amount} onChange={e => setAmount(e.target.value)}
              inputMode="decimal" className={`${fieldCls} mt-1 h-11`}
              aria-label="Payment amount"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Method</span>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className={`${fieldCls} mt-1 h-11`} aria-label="Payment method">
                {PAYMENT_METHODS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</span>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                className={`${fieldCls} mt-1 h-11`} aria-label="Payment date" />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reference (optional)</span>
            <input value={reference} onChange={e => setReference(e.target.value)}
              placeholder="UPI / cheque / transaction ref" className={`${fieldCls} mt-1 h-11`} />
          </label>
          {error && (
            <p role="alert" className="flex items-start gap-2 text-[11px] text-red-600 dark:text-red-400">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {error}
            </p>
          )}
          <Button type="submit" icon={IndianRupee} className="w-full"
            disabled={busy || disabled || !(Number(amount) > 0) || Number(amount) > balance + 0.01}>
            {busy ? 'Saving…' : `Record ${formatINR(Number(amount) || 0, currency)}`}
          </Button>
        </form>
      )}

      <div className="border-t border-[var(--ap-border)] pt-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">History ({history.length})</p>
        {history.length === 0 ? (
          <p className="text-[11px] text-slate-400">No payments recorded yet.</p>
        ) : (
          <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
            {history.map(payment => (
              <li key={payment.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--ap-border)] px-2.5 py-2 text-[11px]">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {payment.method} · {shortDate(payment.payment_date || payment.paymentDate)}
                  </p>
                  {payment.reference && <p className="text-slate-400 truncate">{payment.reference}</p>}
                </div>
                <span className={`font-bold tabular-nums flex-shrink-0 ${['reversed', 'refunded'].includes(String(payment.status || '').toLowerCase()) ? 'text-slate-400 line-through' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatINR(payment.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
