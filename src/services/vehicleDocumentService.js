// ─────────────────────────────────────────────────────────────────────
// VEHICLE DOCUMENT SERVICE
// Manages vehicle document uploads and tracking
// ─────────────────────────────────────────────────────────────────────

import supabase from '../lib/supabase'
import { isSupabaseConfigured } from '../lib/supabase'
import { vehicleRepository } from '../repositories/vehicleRepository'

/**
 * Document types
 */
export const VEHICLE_DOCUMENT_TYPES = {
  RC_BOOK: 'rc_book',
  INSURANCE: 'insurance',
  FC: 'fc',
  PERMIT: 'permit',
  POLLUTION: 'pollution',
  VEHICLE_IMAGE: 'vehicle_image',
  OTHER: 'other',
}

/**
 * Upload vehicle document
 * @param {string} vehicleId
 * @param {string} docType
 * @param {File} file
 * @returns {Promise<Object>} {success, url, error}
 */
export async function uploadVehicleDocument(vehicleId, docType, file) {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, cannot upload document')
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    const fileName = `vehicle-documents/${vehicleId}/${docType}-${Date.now()}.pdf`
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file, { upsert: false })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(data.path)

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    }
  } catch (error) {
    console.error(`Document upload failed:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Upload vehicle image
 * @param {string} vehicleId
 * @param {File} file
 * @returns {Promise<Object>} {success, url, error}
 */
export async function uploadVehicleImage(vehicleId, file) {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, cannot upload image')
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    const fileName = `vehicle-images/${vehicleId}/${Date.now()}.jpg`
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file, { upsert: false })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(data.path)

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    }
  } catch (error) {
    console.error(`Image upload failed:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete vehicle document
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
export async function deleteVehicleDocument(filePath) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    const { error } = await supabase.storage
      .from('documents')
      .remove([filePath])

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error(`Document deletion failed:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Update vehicle document field
 * @param {string} vehicleId
 * @param {string} docType
 * @param {string} docUrl
 * @param {string} expiryDate (optional)
 * @returns {Promise<Object>}
 */
export async function updateVehicleDocumentField(vehicleId, docType, docUrl, expiryDate = null) {
  try {
    const vehicle = await vehicleRepository.getById(vehicleId)
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' }
    }

    const fieldMap = {
      [VEHICLE_DOCUMENT_TYPES.RC_BOOK]: 'rc_book_url',
      [VEHICLE_DOCUMENT_TYPES.INSURANCE]: ['insurance_url', 'insurance_expiry'],
      [VEHICLE_DOCUMENT_TYPES.FC]: ['fc_url', 'fc_expiry'],
      [VEHICLE_DOCUMENT_TYPES.PERMIT]: ['permit_url', 'permit_expiry'],
      [VEHICLE_DOCUMENT_TYPES.POLLUTION]: ['pollution_url', 'pollution_expiry'],
    }

    const field = fieldMap[docType]
    if (!field) {
      return { success: false, error: 'Invalid document type' }
    }

    let updateData = {}
    if (Array.isArray(field)) {
      updateData[field[0]] = docUrl
      if (expiryDate) updateData[field[1]] = expiryDate
    } else {
      updateData[field] = docUrl
    }

    const updated = await vehicleRepository.update(vehicleId, updateData)
    return { success: true, vehicle: updated }
  } catch (error) {
    console.error('Update document field failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Check document expiry status
 * @param {string} expiryDate
 * @returns {string} 'valid', 'expiring_soon', 'expired'
 */
export function checkDocumentExpiry(expiryDate) {
  if (!expiryDate) return 'unknown'

  const expiry = new Date(expiryDate)
  const today = new Date()
  const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= 30) return 'expiring_soon'
  return 'valid'
}

/**
 * Get all documents for a vehicle
 * @param {Object} vehicle
 * @returns {Array} Documents with status
 */
export function getVehicleDocuments(vehicle) {
  const documents = []

  const docTypes = [
    { field: 'rc_book_url', name: 'RC Book', type: VEHICLE_DOCUMENT_TYPES.RC_BOOK },
    { field: 'insurance_url', name: 'Insurance', type: VEHICLE_DOCUMENT_TYPES.INSURANCE, expiry: 'insurance_expiry' },
    { field: 'fc_url', name: 'FC Certificate', type: VEHICLE_DOCUMENT_TYPES.FC, expiry: 'fc_expiry' },
    { field: 'permit_url', name: 'Permit', type: VEHICLE_DOCUMENT_TYPES.PERMIT, expiry: 'permit_expiry' },
    { field: 'puc_number', name: 'Pollution', type: VEHICLE_DOCUMENT_TYPES.POLLUTION, expiry: 'puc_expiry' },
  ]

  docTypes.forEach(doc => {
    if (vehicle[doc.field]) {
      documents.push({
        type: doc.type,
        name: doc.name,
        url: vehicle[doc.field],
        expiryDate: doc.expiry ? vehicle[doc.expiry] : null,
        expiryStatus: doc.expiry ? checkDocumentExpiry(vehicle[doc.expiry]) : null,
      })
    }
  })

  return documents
}

export default {
  VEHICLE_DOCUMENT_TYPES,
  uploadVehicleDocument,
  uploadVehicleImage,
  deleteVehicleDocument,
  updateVehicleDocumentField,
  checkDocumentExpiry,
  getVehicleDocuments,
}