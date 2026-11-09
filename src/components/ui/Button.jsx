import { buttonSkin } from './skins'

export default function Button({
  children, onClick, variant = 'primary', size = 'md', skin = 'flat',
  icon: Icon, iconRight, disabled, className = '', ...rest
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-[5px] transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary:  'bg-[var(--ap-accent)] text-white hover:opacity-90 focus:ring-[var(--ap-accent)] shadow-lg hover:shadow-xl active:scale-95',
    secondary:'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[var(--ap-surface-2)] dark:text-slate-200 dark:hover:bg-[var(--ap-surface-elevated)] focus:ring-slate-400 active:scale-95',
    teal:     'bg-teal-600 text-white hover:bg-teal-500 focus:ring-teal-400 shadow-lg hover:shadow-xl active:scale-95',
    amber:    'bg-amber-500 text-white hover:bg-amber-400 focus:ring-amber-400 shadow-md hover:shadow-lg active:scale-95',
    danger:   'bg-red-600 text-white hover:bg-red-500 focus:ring-red-400 shadow-md active:scale-95',
    ghost:    'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] focus:ring-slate-300 active:scale-95',
    outline:  'border border-slate-300 dark:border-[var(--ap-border)] text-slate-700 dark:text-slate-200 bg-[var(--ap-surface-2)] hover:border-[var(--ap-accent)] hover:bg-[var(--ap-surface-2)] focus:ring-[var(--ap-accent)] active:scale-95',
  }

  const sizes = {
    sm:  'text-[13px] px-4 py-2 min-h-[34px]',
    md:  'text-[15px] px-6 py-3 min-h-[44px]',
    lg:  'text-base px-7 py-3.5 min-h-[50px]',
  }

  return (
    <button
      className={`${base} ${skin === 'flat' ? variants[variant] : buttonSkin(skin, variant)} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {Icon && !iconRight && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 19 : 17} />}
      {children}
      {Icon && iconRight && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 19 : 17} />}
    </button>
  )
}
