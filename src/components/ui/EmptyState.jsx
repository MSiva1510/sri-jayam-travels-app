import { Inbox } from 'lucide-react'

export default function EmptyState({ title = 'No data', sub = '', icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-navy-300 dark:text-white/20">
      <Icon size={40} strokeWidth={1.2} />
      <div className="text-sm font-semibold">{title}</div>
      {sub && <div className="text-xs">{sub}</div>}
    </div>
  )
}
