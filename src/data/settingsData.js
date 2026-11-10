// ─── Company Settings ─────────────────────────────────────────
// Persists all admin-configurable settings to Supabase (`settings`
// table, key = 'company_settings'). Loaded with deep-merge so new
// defaults don't break old saves. Business data — never localStorage.

import { loadSettingValue, saveSettingValue, deleteSettingValue } from './settingsStore'
import { translateDbError } from './errorUtils'

export const SETTINGS_KEY = 'company_settings'

export const DEFAULT_SETTINGS = {
  biz: {
    name:    'Sri Jayam Travels',
    phone:   '+91 94423 37470',
    email:   'srijayamtravels1255@gmail.com',
    website: 'www.travelsjayam.in',
    address: 'No.4 Subburaya Pillai Street, Ariyakuppam, Puducherry – 605007',
    gstin:   '',
    logo:    'https://www.travelsjayam.in/logo.png',
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

function mergeWithDefaults(saved) {
  if (!saved) return DEFAULT_SETTINGS
  return {
    biz:           { ...DEFAULT_SETTINGS.biz,           ...saved.biz           },
    invoice:       { ...DEFAULT_SETTINGS.invoice,       ...saved.invoice       },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...saved.notifications },
    appearance:    { ...DEFAULT_SETTINGS.appearance,    ...saved.appearance    },
    updatedAt:     saved.updatedAt ?? null,
  }
}

export async function loadSettings() {
  try {
    return mergeWithDefaults(await loadSettingValue(SETTINGS_KEY, null))
  } catch (error) {
    console.error('[settingsData] loadSettings failed:', error)
    throw error
  }
}

export async function saveSettings(settings) {
  const value = { ...settings, updatedAt: new Date().toISOString() }
  try {
    await saveSettingValue(SETTINGS_KEY, value)
    return true
  } catch (error) {
    throw translateDbError(error, 'saveSettings')
  }
}

export async function resetSettings() {
  try {
    await deleteSettingValue(SETTINGS_KEY)
    return true
  } catch (error) {
    throw translateDbError(error, 'resetSettings')
  }
}

// ── Convenience getters used by InvoiceModal ──────────────────
export async function getBizInfo() {
  return (await loadSettings()).biz
}

export async function getInvoiceSettings() {
  return (await loadSettings()).invoice
}