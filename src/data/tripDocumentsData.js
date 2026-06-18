// ─── Trip Document Uploads ────────────────────────────────────
// Stores trip-related receipt/document images locally (base64)
// keyed by tripId. Module 5 (Day 20.5).
//
// NOTE: localStorage has a ~5MB quota shared across the whole
// origin, so images are stored as compressed base64 JPEG/PNG at
// a capped resolution (see compressImageFile below) to avoid
// blowing the quota with a handful of phone-camera photos.

export const TRIP_DOCS_KEY = 'sjt_trip_documents'

export const DOC_TYPES = {
  parking_ticket: { key: 'parking_ticket', label: 'Parking Ticket', icon: '🅿️' },
  toll_receipt:   { key: 'toll_receipt',   label: 'Toll Receipt',   icon: '🛣️' },
  fuel_receipt:   { key: 'fuel_receipt',   label: 'Fuel Receipt',   icon: '⛽' },
  misc_expense:   { key: 'misc_expense',   label: 'Misc Expense',   icon: '🧾' },
}

// ── Load all documents for a trip ──────────────────────────────
export function loadTripDocuments(tripId) {
  if (!tripId) return []
  try {
    const all = loadAllTripDocuments()
    return all[tripId] || []
  } catch { return [] }
}

export function loadAllTripDocuments() {
  try {
    const raw = localStorage.getItem(TRIP_DOCS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// ── Save a document — { tripId, docType, dataUrl, fileName, uploadedBy } ─
export function saveTripDocument(doc) {
  if (!doc?.tripId || !doc?.dataUrl) return null
  const all     = loadAllTripDocuments()
  const list    = all[doc.tripId] || []
  const entry = {
    id:         `DOC-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
    tripId:     doc.tripId,
    docType:    doc.docType || 'misc_expense',
    dataUrl:    doc.dataUrl,
    fileName:   doc.fileName || 'receipt.jpg',
    uploadedBy: doc.uploadedBy || null,
    uploadedAt: new Date().toISOString(),
  }
  list.push(entry)
  all[doc.tripId] = list
  try {
    localStorage.setItem(TRIP_DOCS_KEY, JSON.stringify(all))
    return entry
  } catch (e) {
    // Likely quota exceeded — surface to caller so UI can warn the user
    return null
  }
}

// ── Delete a single document ─────────────────────────────────
export function deleteTripDocument(tripId, docId) {
  if (!tripId || !docId) return
  const all  = loadAllTripDocuments()
  const list = (all[tripId] || []).filter(d => d.id !== docId)
  all[tripId] = list
  try { localStorage.setItem(TRIP_DOCS_KEY, JSON.stringify(all)) } catch {}
}

// ── Clear all documents for a trip ────────────────────────────
export function clearTripDocuments(tripId) {
  if (!tripId) return
  const all = loadAllTripDocuments()
  delete all[tripId]
  try { localStorage.setItem(TRIP_DOCS_KEY, JSON.stringify(all)) } catch {}
}

// ── Compress an image File down to a small base64 JPEG ────────
// Keeps localStorage usage sane — caps the longest edge at
// maxDim px and re-encodes as JPEG at the given quality.
export function compressImageFile(file, maxDim = 900, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load image'))
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width))
          width  = maxDim
        } else if (height > maxDim) {
          width  = Math.round(width * (maxDim / height))
          height = maxDim
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export function getDocTypeCfg(docType) {
  return DOC_TYPES[docType] || DOC_TYPES.misc_expense
}
