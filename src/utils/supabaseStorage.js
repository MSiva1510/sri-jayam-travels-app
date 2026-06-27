// ─────────────────────────────────────────────────────────────────────
// SUPABASE STORAGE UTILITIES
// File upload and storage management
// ─────────────────────────────────────────────────────────────────────

import supabase from '../lib/supabase'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Upload file to Supabase storage
 * @param {string} bucketName - Storage bucket name
 * @param {string} fileName - Name to save file as
 * @param {File} file - File to upload
 * @returns {Promise<string|null>} Public URL or null on failure
 */
export async function uploadFile(bucketName, fileName, file) {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, cannot upload file')
    return null
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, { upsert: false })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path)

    return urlData.publicUrl
  } catch (error) {
    console.error(`File upload failed for ${fileName}:`, error)
    return null
  }
}

/**
 * Delete file from Supabase storage
 * @param {string} bucketName
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function deleteFile(bucketName, filePath) {
  if (!isSupabaseConfigured()) {
    return false
  }

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath])

    if (error) throw error
    return true
  } catch (error) {
    console.error(`File deletion failed for ${filePath}:`, error)
    return false
  }
}

/**
 * Get public URL for a file
 * @param {string} bucketName
 * @param {string} filePath
 * @returns {string|null}
 */
export function getPublicUrl(bucketName, filePath) {
  if (!isSupabaseConfigured()) {
    return null
  }

  try {
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath)

    return data.publicUrl
  } catch (error) {
    console.error('Error getting public URL:', error)
    return null
  }
}

/**
 * Upload driver license image
 * @param {string} driverId
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function uploadDriverLicense(driverId, file) {
  const fileName = `driver-licenses/${driverId}-${Date.now()}.jpg`
  return uploadFile('documents', fileName, file)
}

/**
 * Upload driver profile photo
 * @param {string} driverId
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function uploadDriverPhoto(driverId, file) {
  const fileName = `driver-photos/${driverId}-${Date.now()}.jpg`
  return uploadFile('documents', fileName, file)
}

/**
 * Upload expense bill image
 * @param {string} expenseId
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function uploadExpenseBill(expenseId, file) {
  const fileName = `expense-bills/${expenseId}-${Date.now()}.jpg`
  return uploadFile('documents', fileName, file)
}

/**
 * Upload trip document
 * @param {string} tripId
 * @param {string} docType - Type of document
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function uploadTripDocument(tripId, docType, file) {
  const fileName = `trip-documents/${tripId}/${docType}-${Date.now()}.pdf`
  return uploadFile('documents', fileName, file)
}

/**
 * Upload vehicle document
 * @param {string} vehicleId
 * @param {string} docType - Type of document (registration, insurance, permit, etc)
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function uploadVehicleDocument(vehicleId, docType, file) {
  const fileName = `vehicle-documents/${vehicleId}/${docType}-${Date.now()}.pdf`
  return uploadFile('documents', fileName, file)
}

/**
 * Delete driver license image
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function deleteDriverLicense(filePath) {
  return deleteFile('documents', filePath)
}

/**
 * Delete driver photo
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function deleteDriverPhoto(filePath) {
  return deleteFile('documents', filePath)
}

/**
 * Delete expense bill
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function deleteExpenseBill(filePath) {
  return deleteFile('documents', filePath)
}

export default {
  uploadFile,
  deleteFile,
  getPublicUrl,
  uploadDriverLicense,
  uploadDriverPhoto,
  uploadExpenseBill,
  uploadTripDocument,
  uploadVehicleDocument,
  deleteDriverLicense,
  deleteDriverPhoto,
  deleteExpenseBill,
}