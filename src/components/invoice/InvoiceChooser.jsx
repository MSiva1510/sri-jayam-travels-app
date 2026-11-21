// ─── InvoiceChooser ─────────────────────────────────────────────
// Replaces the cramped picker footer with three explicit, accessible paths.

import { ArrowRight, CalendarDays, FileText, IndianRupee } from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import IconButton from '../ui/IconButton'
import { X } from 'lucide-react'

const CARDS = [
  {
    key: 'booking', icon: FileText, title: 'Existing Booking',
    description: 'Bill a completed trip using its saved fare and charges.',
    tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  },
  {
    key: 'manual', icon: IndianRupee, title: 'Manual Invoice',
    description: 'Create a bill with your own line items. No trip is created.',
    tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  },
  {
    key: 'quotation', icon: CalendarDays, title: 'Quotation',
    description: 'Prepare an estimate with validity and terms. Never becomes an invoice automatically.',
    tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  },
]

export default function InvoiceChooser({ onClose, onChoose }) {
  return (
    <ModalOverlay onClose={onClose} center>
      <div className="w-[94vw] max-w-2xl rounded-[20px] ap-surface border border-[var(--ap-border)] shadow-2xl overflow-hidden animate-fade-up"
        role="dialog" aria-modal="true" aria-label="Create a new invoice">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--ap-border)]">
          <div>
            <p className="font-sf text-base font-semibold text-slate-800 dark:text-white">Create new</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Choose how you want to prepare this document.</p>
          </div>
          <IconButton icon={X} label="Close invoice chooser" onClick={onClose} />
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CARDS.map(card => (
            <button key={card.key} type="button" onClick={() => onChoose(card.key)}
              className="ios-press group text-left rounded-[16px] border border-[var(--ap-border)] bg-[var(--ap-surface)] p-4 hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[var(--ap-accent)] focus:ring-offset-2">
              <span className={`w-10 h-10 rounded-[12px] inline-flex items-center justify-center ${card.tone}`}>
                <card.icon size={18} />
              </span>
              <p className="text-sm font-bold text-slate-800 dark:text-white mt-3">{card.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1 min-h-[48px]">{card.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ap-accent)]">
                Continue <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </ModalOverlay>
  )
}
