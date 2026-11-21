// ─── Browser-local GPS history helpers ────────────────────────
export const GPS_HISTORY_KEY = 'sjt_gps_history'

export function loadGPSHistory() {
  try {
    const r = localStorage.getItem(GPS_HISTORY_KEY)
    return r ? JSON.parse(r) : []
  } catch {
    return []
  }
}
