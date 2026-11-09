// ─── Polymorphic skins ──────────────────────────────────────────
// One Button/Card API, place-appropriate surfacing:
//
//   flat  → current design-system look (DEFAULT; existing pages unchanged)
//   glass → floating overlays: map controls, modal sheets, toasts, chips
//   neu   → Soft UI: dashboard cards + tactile controls on flat grounds
//   skeuo → physical depth for hero / primary actions
//
// Skins are self-contained treatments: when skin !== 'flat' the caller
// must NOT also apply the flat variant background (conflicting classes).

const TONE_OF_VARIANT = {
  primary: 'accent', teal: 'accent',
  secondary: 'neutral', ghost: 'neutral', outline: 'neutral',
  amber: 'warn', danger: 'danger',
}

const toneOf = (variant) => TONE_OF_VARIANT[variant] || 'neutral'

export const BUTTON_SKIN = {
  glass: {
    accent: 'text-white border border-white/30 bg-[var(--ap-accent)]/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] hover:bg-[var(--ap-accent)]/85 active:scale-95',
    neutral: 'text-slate-800 dark:text-white border border-white/25 bg-white/45 dark:bg-white/10 backdrop-blur-xl shadow-[0_8px_24px_rgba(2,6,23,0.18),inset_0_1px_0_rgba(255,255,255,0.5)] hover:bg-white/60 dark:hover:bg-white/15 active:scale-95',
    warn: 'text-white border border-white/30 bg-amber-500/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] hover:bg-amber-500/85 active:scale-95',
    danger: 'text-white border border-white/30 bg-red-600/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] hover:bg-red-600/85 active:scale-95',
  },
  neu: {
    accent: 'text-[var(--ap-accent)] dark:text-white border border-white/60 dark:border-white/10 bg-[#e9edf4] dark:bg-[var(--ap-surface-2)] shadow-[5px_5px_12px_rgba(163,177,198,0.55),-5px_-5px_12px_rgba(255,255,255,0.95)] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.06)] hover:brightness-[1.03] active:shadow-[inset_4px_4px_10px_rgba(163,177,198,0.5),inset_-4px_-4px_10px_rgba(255,255,255,0.9)] dark:active:shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5)]',
    neutral: 'text-slate-600 dark:text-slate-200 border border-white/60 dark:border-white/10 bg-[#e9edf4] dark:bg-[var(--ap-surface-2)] shadow-[5px_5px_12px_rgba(163,177,198,0.55),-5px_-5px_12px_rgba(255,255,255,0.95)] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.06)] hover:brightness-[1.03] active:shadow-[inset_4px_4px_10px_rgba(163,177,198,0.5),inset_-4px_-4px_10px_rgba(255,255,255,0.9)] dark:active:shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5)]',
    warn: 'text-amber-700 dark:text-amber-300 border border-white/60 dark:border-white/10 bg-[#f3e9d2] dark:bg-[var(--ap-surface-2)] shadow-[5px_5px_12px_rgba(163,177,198,0.55),-5px_-5px_12px_rgba(255,255,255,0.95)] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.06)] hover:brightness-[1.03] active:shadow-[inset_4px_4px_10px_rgba(163,177,198,0.5),inset_-4px_-4px_10px_rgba(255,255,255,0.9)] dark:active:shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5)]',
    danger: 'text-red-600 dark:text-red-300 border border-white/60 dark:border-white/10 bg-[#f6e2e2] dark:bg-[var(--ap-surface-2)] shadow-[5px_5px_12px_rgba(163,177,198,0.55),-5px_-5px_12px_rgba(255,255,255,0.95)] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.06)] hover:brightness-[1.03] active:shadow-[inset_4px_4px_10px_rgba(163,177,198,0.5),inset_-4px_-4px_10px_rgba(255,255,255,0.9)] dark:active:shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5)]',
  },
  skeuo: {
    accent: 'text-white border border-[#1e40af]/70 bg-gradient-to-b from-[#5b97f8] via-[var(--ap-accent)] to-[#1d4ed8] shadow-[0_2px_0_#1e3a8a,0_8px_18px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.55)] [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] hover:brightness-[1.06] active:translate-y-[2px] active:shadow-[0_0_0_#1e3a8a,0_3px_8px_rgba(37,99,235,0.4),inset_0_2px_4px_rgba(0,0,0,0.25)]',
    neutral: 'text-slate-700 dark:text-slate-100 border border-slate-400/70 dark:border-black/60 bg-gradient-to-b from-white via-slate-100 to-slate-300 dark:from-[#3a4a63] dark:via-[#2b3850] dark:to-[#1c2536] shadow-[0_2px_0_#94a3b8,0_8px_18px_rgba(2,6,23,0.25),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_0_rgba(0,0,0,0.7),0_8px_18px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] [text-shadow:0_1px_0_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.5)] hover:brightness-[1.04] active:translate-y-[2px] active:shadow-[0_0_0_#94a3b8,0_3px_8px_rgba(2,6,23,0.2),inset_0_2px_4px_rgba(0,0,0,0.2)]',
    warn: 'text-white border border-[#92400e]/70 bg-gradient-to-b from-[#fbbf24] via-amber-500 to-[#b45309] shadow-[0_2px_0_#92400e,0_8px_18px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,255,255,0.55)] [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] hover:brightness-[1.06] active:translate-y-[2px] active:shadow-[0_0_0_#92400e,0_3px_8px_rgba(245,158,11,0.4),inset_0_2px_4px_rgba(0,0,0,0.25)]',
    danger: 'text-white border border-[#7f1d1d]/70 bg-gradient-to-b from-[#f87171] via-red-600 to-[#991b1b] shadow-[0_2px_0_#7f1d1d,0_8px_18px_rgba(220,38,38,0.45),inset_0_1px_0_rgba(255,255,255,0.55)] [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] hover:brightness-[1.06] active:translate-y-[2px] active:shadow-[0_0_0_#7f1d1d,0_3px_8px_rgba(220,38,38,0.4),inset_0_2px_4px_rgba(0,0,0,0.25)]',
  },
}

/** Full treatment for Button when skin !== 'flat'. */
export function buttonSkin(skin, variant) {
  const group = BUTTON_SKIN[skin]
  if (!group) return ''
  return `${group[toneOf(variant)]} focus:ring-[var(--ap-accent)]`
}

export const CARD_SKIN = {
  flat: 'ap-surface',
  glass: 'border border-white/25 bg-white/45 dark:bg-white/10 backdrop-blur-xl shadow-[0_8px_24px_rgba(2,6,23,0.18),inset_0_1px_0_rgba(255,255,255,0.4)]',
  neu: 'border border-white/50 dark:border-white/5 bg-[#e9edf4] dark:bg-[var(--ap-surface-2)] shadow-[8px_8px_20px_rgba(163,177,198,0.5),-8px_-8px_20px_rgba(255,255,255,0.95)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.45),-6px_-6px_14px_rgba(255,255,255,0.05)]',
}

/** Surface class for TactileCard. */
export function cardSkin(skin) {
  return CARD_SKIN[skin] || CARD_SKIN.flat
}
