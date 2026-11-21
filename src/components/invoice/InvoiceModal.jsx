// ─── InvoiceModal ───────────────────────────────────────────────
// Deep-linkable detail view for trip invoices, manual bills and quotations.
// Printable output comes from the shared InvoiceDocument; payment history is
// append-only and never overwrites an earlier record.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Printer, Share2, Trash2, Wallet, X } from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import StatusPill from '../ui/StatusPill'
import Callout from '../ui/Callout'
import InvoiceDocument from './InvoiceDocument'
import PaymentPanel from './PaymentPanel'
import { getBizInfo, getInvoiceSettings, DEFAULT_SETTINGS } from '../../data/settingsData'
import { buildWhatsAppUrl, normalizeInvoice } from '../../data/invoiceModel'
import { printDocument } from '../../utils/printDocument'
import { amountInWords } from '../../utils/amountInWords'

export { amountInWords }

const STATUS_TONE = {
  paid: 'green', partial: 'amber', pending: 'gray', overdue: 'red', draft: 'gray',
}

export default function InvoiceModal({
  invoice, booking, records = [], payments = [],
  onClose, onIssue, onRecordPayment, onDelete,
  canCreate = false, canManage = false, canDelete = false, busy = false, paymentBusy = false,
  paymentError = '', paymentVersion = 0, autoPrint = false, error = '',
  biz: bizProp, settings: settingsProp,
}) {
  const data = useMemo(
    () => invoice || normalizeInvoice({ source: booking || {}, records, payments }),
    [invoice, booking, records, payments],
  )
  const printRef = useRef(null)
  const printedRef = useRef(false)
  const [biz, setBiz] = useState(bizProp || DEFAULT_SETTINGS.biz)
  const [settings, setSettings] = useState(settingsProp || DEFAULT_SETTINGS.invoice)

  useEffect(() => {
    if (bizProp) setBiz(bizProp)
    else getBizInfo().then(setBiz).catch(err => console.error('[InvoiceModal] biz settings:', err))
  }, [bizProp])
  useEffect(() => {
    if (settingsProp) setSettings(settingsProp)
    else getInvoiceSettings().then(setSettings).catch(err => console.error('[InvoiceModal] invoice settings:', err))
  }, [settingsProp])

  const currency = settings.currency || 'Rs.'

  async function handlePrint() {
    await printDocument(printRef.current, `${data.isQuote ? 'Quotation' : 'Invoice'} — ${data.invoiceNo}`)
  }

  useEffect(() => {
    if (!autoPrint || printedRef.current || !data?.invoiceNo) return
    printedRef.current = true
    const id = setTimeout(handlePrint, 250)
    return () => clearTimeout(id)
    // Auto-print is a one-shot intent carried in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, data?.invoiceNo])

  const waUrl = buildWhatsAppUrl(data, biz, currency, settings)
  const canIssue = !data.isQuote && !data.record && !data.isManual && canCreate
  const canIssueManual = !data.isQuote && !data.record && data.isManual && canCreate
  const canPay = !data.isQuote && !!data.record && data.balance > 0 && canManage

  return (
    <ModalOverlay onClose={onClose} center>
      <div
        className="w-[96vw] max-w-5xl max-h-[92vh] ap-surface rounded-[20px] shadow-2xl overflow-hidden animate-fade-up flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${data.isQuote ? 'Quotation' : 'Invoice'} ${data.invoiceNo}`}
      >
        {/* Toolbar — wraps cleanly on phones instead of cramming three buttons */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[var(--ap-border)] bg-[var(--ap-surface-2)] flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-sf font-semibold text-slate-800 dark:text-white text-sm">
                  {data.isQuote ? 'Quotation' : data.isManual ? 'Manual Invoice' : 'Trip Invoice'}
                </p>
                <StatusPill tone={STATUS_TONE[data.paymentStatus] || 'gray'}>
                  {data.paymentStatus}
                </StatusPill>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{data.invoiceNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="min-h-[36px] px-3 rounded-[10px] inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95">
              <Share2 size={14} /> <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <Button variant="secondary" size="sm" icon={Printer} onClick={handlePrint}>Print / PDF</Button>
            <IconButton icon={X} label="Close invoice" onClick={onClose} />
          </div>
        </div>

        {(error || paymentError) && (
          <div className="px-4 pt-3">
            <Callout tone="red" icon={AlertTriangle} title={error || paymentError} />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px] gap-0 lg:divide-x lg:divide-[var(--ap-border)]">
            {/* Printable document */}
            <div className="bg-white min-w-0">
              <InvoiceDocument ref={printRef} invoice={data} biz={biz} settings={settings} />
            </div>

            {/* Settlement sidebar */}
            <aside className="p-4 bg-[var(--ap-surface)] space-y-3 lg:sticky lg:top-0 lg:self-start">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                  <Wallet size={15} />
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Settlement</p>
                  <p className="text-[10px] text-slate-400">Balance = total − recorded payments</p>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ap-border)] px-3 py-2.5 text-xs space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Total</span>
                  <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">{data.total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Received</span>
                  <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{data.paid.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between gap-2 border-t border-[var(--ap-border)] pt-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Balance</span>
                  <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">{data.balance.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[10px] italic text-slate-400 pt-0.5">In words: {amountInWords(data.total)}</p>
              </div>

              {data.isQuote ? (
                <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-3 py-2.5 text-[11px] text-sky-700 dark:text-sky-300">
                  Quotations are estimates. They are never converted to invoices automatically.
                </div>
              ) : (
                <PaymentPanel
                  invoice={data}
                  currency={currency}
                  busy={paymentBusy}
                  error={paymentError}
                  disabled={!canPay || busy}
                  paymentVersion={paymentVersion}
                  onRecord={onRecordPayment}
                />
              )}

              <div className="space-y-2 border-t border-[var(--ap-border)] pt-3">
                {(canIssue || canIssueManual) && (
                  <Button icon={Check} className="w-full" disabled={busy || paymentBusy}
                    onClick={() => onIssue?.(data)}>
                    {busy ? 'Issuing…' : 'Issue Invoice'}
                  </Button>
                )}
                {data.isManual && canDelete && onDelete && (
                  <Button variant="outline" size="sm" icon={Trash2} className="w-full"
                    disabled={busy || paymentBusy || !!data.record}
                    title={data.record ? 'Issued documents are locked' : undefined}
                    onClick={() => onDelete?.(data)}>
                    {data.record ? 'Issued — locked' : `Delete ${data.isQuote ? 'Quotation' : 'Manual Invoice'}`}
                  </Button>
                )}
                {!canManage && !data.isQuote && (
                  <p className="text-[10px] text-slate-400 text-center">Read-only access</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
