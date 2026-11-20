// ─── DocumentFilters — category, search and table controls ─────
// Extracted from the Documents page so the listing stays readable. All state
// remains controlled by the page; this component only renders and emits.

import { useEffect, useRef, useState } from 'react'
import { Columns3, Download, LayoutGrid, List, Search, X } from 'lucide-react'

import Button from '../ui/Button'
import SegmentedControl from '../ui/SegmentedControl'
import { Select as FieldSelect } from '../ui/Field'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Valid' },
  { value: 'expiring_soon', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'pending', label: 'Pending' },
  { value: 'no_expiry', label: 'No Expiry' },
]

export default function DocumentFilters({
  categories = [],
  category,
  onCategory,
  search,
  onSearch,
  typeOptions = [],
  typeFilter,
  onTypeFilter,
  ownerOptions = [],
  ownerFilter,
  onOwnerFilter,
  statusFilter,
  onStatusFilter,
  hasActiveFilters,
  onClearFilters,
  onExport,
  viewMode,
  onViewMode,
  allCols = [],
  visibleCols = [],
  onToggleCol,
}) {
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef(null)

  useEffect(() => {
    if (!colsOpen) return undefined
    const onDown = e => {
      if (colsRef.current && !colsRef.current.contains(e.target)) setColsOpen(false)
    }
    const onKey = e => { if (e.key === 'Escape') setColsOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [colsOpen])

  return (
    <div className="space-y-2.5">
      <SegmentedControl
        ariaLabel="Filter by category"
        value={category}
        onChange={onCategory}
        scroll
        options={categories.map(cat => ({ key: cat.key, label: cat.label, icon: cat.Icon }))}
      />

      <div className="ap-surface rounded-2xl px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[190px]">
          <Search size={15} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
          <input
            value={search}
            onChange={e => onSearch?.(e.target.value)}
            placeholder="Search name, owner or document number…"
            aria-label="Search documents"
            className="bg-transparent text-[13px] text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full font-body"
          />
          {search && (
            <button type="button" onClick={() => onSearch?.('')} aria-label="Clear search"
              className="w-6 h-6 rounded-md inline-flex items-center justify-center text-slate-400 hover:bg-[var(--ap-surface-2)] hover:text-slate-700 dark:hover:text-white flex-shrink-0">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="w-[150px] max-w-full">
          <FieldSelect value={typeFilter} onChange={e => onTypeFilter?.(e.target.value)} aria-label="Filter by document type">
            <option value="all">All Types</option>
            {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </FieldSelect>
        </div>

        <div className="w-[160px] max-w-full">
          <FieldSelect value={ownerFilter} onChange={e => onOwnerFilter?.(e.target.value)} aria-label="Filter by owner">
            <option value="all">All Owners</option>
            {ownerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </FieldSelect>
        </div>

        <div className="w-[130px] max-w-full">
          <FieldSelect value={statusFilter} onChange={e => onStatusFilter?.(e.target.value)} aria-label="Filter by status">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </FieldSelect>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>Clear Filters</Button>
        )}
        <Button variant="outline" size="sm" icon={Download} onClick={onExport} className="whitespace-nowrap">Export</Button>

        <SegmentedControl
          ariaLabel="Document view mode"
          value={viewMode}
          onChange={onViewMode}
          options={[
            { key: 'grid', label: 'Grid', icon: LayoutGrid },
            { key: 'list', label: 'List', icon: List },
          ]}
        />

        <div className="relative" ref={colsRef}>
          <Button
            variant="outline"
            size="sm"
            icon={Columns3}
            onClick={() => setColsOpen(v => !v)}
            className="whitespace-nowrap"
            aria-expanded={colsOpen}
            aria-haspopup="menu"
          >
            Columns
          </Button>
          {colsOpen && (
            <div role="menu" aria-label="Table columns"
              className="absolute right-0 top-full mt-2 w-52 ap-surface-elevated border border-[var(--ap-border)] shadow-2xl overflow-hidden z-50">
              <p className="px-3.5 pt-3 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Show columns</p>
              <div className="p-1.5">
                {allCols.map(c => {
                  const on = visibleCols.includes(c.key)
                  return (
                    <button key={c.key} onClick={() => onToggleCol?.(c.key)} role="menuitemcheckbox" aria-checked={on}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors text-left">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px] font-semibold transition-colors ${
                        on ? 'bg-[var(--ap-accent-2)] border-[var(--ap-accent-2)] text-white' : 'border-[var(--ap-border)] text-transparent'
                      }`}>✓</span>
                      {c.label}
                    </button>
                  )
                })}
              </div>
              <p className="px-3.5 py-2 border-t border-[var(--ap-border)] text-[10px] text-slate-400 dark:text-slate-500">Actions always shown</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
