// ─── Company Settings ─────────────────────────────────────────
// Persists all admin-configurable settings to localStorage.
// Loaded with deep-merge so new defaults don't break old saves.

export const SETTINGS_KEY = 'sjt_company_settings'

export const DEFAULT_SETTINGS = {
  biz: {
    name:    'Sri Jayam Travels',
    phone:   '+91 94423 37470',
    email:   'srijayamtravels1255@gmail.com',
    website: 'www.srijayamtravels.in',
    address: 'No.4 Subburaya Pillai Street, Ariyakuppam, Puducherry – 605007',
    gstin:   '',
    logo:    'https://travelsjayam.in/wp-content/uploads/2025/05/Untitled-design-1.png',
  },
  invoice: {
    prefix:      'SJT',
    currency:    'Rs.',
    footerText:  'Thank you for choosing Sri Jayam Travels!',
    termsText:   'Payment due upon service completion. No cancellation refund within 24 hours of trip.',
    billType:    'Both',
    fyStart:     'April',
    showGSTIN:   false,
  },
  notifications: {
    whatsapp:    true,
    email:       false,
    autoInvoice: true,
  },
  appearance: {
    compactMode: false,
  },
  updatedAt: null,
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const saved = JSON.parse(raw)
    return {
      biz:           { ...DEFAULT_SETTINGS.biz,           ...saved.biz           },
      invoice:       { ...DEFAULT_SETTINGS.invoice,       ...saved.invoice       },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...saved.notifications },
      appearance:    { ...DEFAULT_SETTINGS.appearance,    ...saved.appearance    },
      updatedAt:     saved.updatedAt,
    }
  } catch { return DEFAULT_SETTINGS }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...settings,
      updatedAt: new Date().toISOString(),
    }))
    return true
  } catch { return false }
}

export function resetSettings() {
  try { localStorage.removeItem(SETTINGS_KEY); return true } catch { return false }
}

// ── Convenience getters used by InvoiceModal ──────────────────
export function getBizInfo() {
  return loadSettings().biz
}

export function getInvoiceSettings() {
  return loadSettings().invoice
}
