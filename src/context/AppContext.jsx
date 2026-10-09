// ─── AppContext — sidebar state + dark mode (persisted) ───────
import { createContext, useContext, useState, useEffect } from 'react'

const THEME_KEY = 'sjt-theme'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // ── Theme mode: 'light' | 'dark' | 'system' (persisted) ──────
  // Migrates the legacy boolean key on first run.
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const m = localStorage.getItem('sjt-theme-mode')
      if (m === 'light' || m === 'dark' || m === 'system') return m
      const legacy = localStorage.getItem(THEME_KEY)
      if (legacy === 'dark' || legacy === 'light') return legacy
      return 'system'
    } catch { return 'system' }
  })
  const [darkMode, setDarkModeState] = useState(false)
  // Topbar toggle keeps working: explicit light/dark choice.
  const setDarkMode = (v) => setThemeMode(v ? 'dark' : 'light')

  // ── Font size: root px 12–24 (migrates legacy sm/md/lg) ──────
  const [fontSize, setFontSize] = useState(() => {
    try {
      const raw = localStorage.getItem('sjt-font-size')
      const n = Number(raw)
      if (Number.isFinite(n)) return Math.min(24, Math.max(12, Math.round(n)))
      if (raw === 'sm') return 14
      if (raw === 'lg') return 18
      return 16
    } catch { return 16 }
  })

  // ── Sidebar style: 'default' | 'compact' | 'minimal' ─────────
  const [sidebarStyle, setSidebarStyle] = useState(() => {
    try { return localStorage.getItem('sjt-sidebar-style') || 'default' } catch { return 'default' }
  })

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed,   setCollapsed]   = useState(false)

  // ── Resolve theme mode → dark class ──────────────────────────
  useEffect(() => {
    try { localStorage.setItem('sjt-theme-mode', themeMode) } catch {}
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = themeMode === 'dark' || (themeMode === 'system' && !!mq?.matches)
      setDarkModeState(dark)
      const root = document.documentElement
      if (dark) root.classList.add('dark')
      else root.classList.remove('dark')
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light') } catch {}
    }
    apply()
    if (themeMode === 'system' && mq?.addEventListener) {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [themeMode])

  // ── Sidebar style → collapsed rail + minimal slimming ────────
  useEffect(() => {
    try { localStorage.setItem('sjt-sidebar-style', sidebarStyle) } catch {}
    setCollapsed(sidebarStyle !== 'default')
    try { document.body.classList.toggle('sb-minimal', sidebarStyle === 'minimal') } catch {}
  }, [sidebarStyle])

  // ── Appearance (Settings page): sidebar color, brand color, compact
  // density + font size. Applied as CSS vars / classes so every page
  // follows instantly, restored on boot, refreshed on sjt:appearance.
  useEffect(() => {
    const apply = () => {
      try {
        const root = document.documentElement
        root.style.setProperty('--sjt-theme', localStorage.getItem('sjt_theme_color') || '#0a1230')
        const pair = (() => { try { return JSON.parse(localStorage.getItem('sjt-color-pair') || 'null') } catch { return null } })()
        if (pair?.brand) {
          root.style.setProperty('--sjt-brand', pair.brand)
          try { localStorage.setItem('sjt_brand_color', pair.brand) } catch {}
        } else {
          root.style.setProperty('--sjt-brand', localStorage.getItem('sjt_brand_color') || '#2563eb')
        }
        if (pair?.sb) {
          root.style.setProperty('--sjt-sb', pair.sb)
          try { localStorage.setItem('sjt_sb_color', pair.sb) } catch {}
        }
        const raw = localStorage.getItem('sjt-font-size')
        const n = Number(raw)
        setFontSize(Number.isFinite(n) ? Math.min(24, Math.max(12, Math.round(n))) : raw === 'sm' ? 14 : raw === 'lg' ? 18 : 16)
        const compact = localStorage.getItem('sjt_compact') === '1'
        document.body.classList.toggle('compact', compact)
      } catch {}
    }
    apply()
    window.addEventListener('sjt:appearance', apply)
    return () => window.removeEventListener('sjt:appearance', apply)
  }, [])

  // ── Close mobile sidebar on desktop resize ───────────────────
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setSidebarOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Font-size root px (rem scaling) ──────────────────────────
  useEffect(() => {
    try {
      const px = Math.min(24, Math.max(12, Math.round(Number(fontSize) || 16)))
      document.documentElement.style.fontSize = `${px}px`
      localStorage.setItem('sjt-font-size', String(px))
    } catch {}
  }, [fontSize])

  return (
    <AppContext.Provider value={{
      darkMode, setDarkMode,
      themeMode, setThemeMode,
      fontSize, setFontSize,
      sidebarStyle, setSidebarStyle,
      sidebarOpen, setSidebarOpen,
      collapsed,   setCollapsed,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
