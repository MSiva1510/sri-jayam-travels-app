const STATUS_MAP = {
  done:        'badge badge-done',
  pending:     'badge badge-pending',
  active:      'badge badge-active',
  'on-leave':  'badge badge-pending',
  maintenance: 'badge badge-maintenance',
  // Booking lifecycle statuses used by the dashboard recent-trips table.
  // Without these every booking fell back to generic active + raw string.
  draft:      'badge badge-pending',
  confirmed:  'badge badge-active',
  assigned:   'badge badge-active',
  started:    'badge badge-active',
  completed:  'badge badge-done',
  cancelled:  'badge badge-maintenance',
}

const STATUS_LABELS = {
  done: '✓ Done', pending: '⏳ Pending',
  active: '● Active', 'on-leave': '○ On Leave',
  maintenance: '⚠ Service',
  draft: '○ Draft', confirmed: '● Confirmed',
  assigned: '● Assigned', started: '● Started',
  completed: '✓ Completed', cancelled: '✕ Cancelled',
}

export default function Badge({ status }) {
  return (
    <span className={STATUS_MAP[status] || 'badge badge-active'}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
