import Surface from '../ui/Surface'
import EmptyState from '../ui/EmptyState'
import { ShieldOff } from 'lucide-react'

export default function AccessBlocked({ label }) {
  return (
    <Surface className="flex items-center min-h-[180px]">
      <EmptyState icon={ShieldOff} title={label} description="Not available for your role" className="w-full" />
    </Surface>
  )
}
