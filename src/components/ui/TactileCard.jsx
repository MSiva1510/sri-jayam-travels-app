// ─── TactileCard — polymorphic surface ──────────────────────────
// skin: flat (default, current look) | glass (overlays) | neu (soft UI)
import { cardSkin } from './skins'

export default function TactileCard({ skin = 'flat', className = '', children, ...rest }) {
  return (
    <div className={`${cardSkin(skin)} rounded-2xl ${className}`} {...rest}>
      {children}
    </div>
  )
}
