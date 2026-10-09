// ─── Surface — Apple-style neutral card ────────────────────────
// Hairline border, soft diffuse shadow, translucent neutral fill.
// Additive primitive: does not alter existing glass-card/ios-card.
export default function Surface({
  children, className = '', as: Tag = 'div',
  padded = true, elevated = false, hairline = true, ...rest
}) {
  const cls = [
    'ap-surface',
    elevated ? 'ap-surface-elevated' : '',
    hairline ? '' : 'border-transparent',
    padded ? 'p-5' : '',
    className,
  ].filter(Boolean).join(' ')
  return <Tag className={cls} {...rest}>{children}</Tag>
}
