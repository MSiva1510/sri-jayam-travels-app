// ─── documentData — Supabase access for the Documents page ─────
// The page used to own all of this. Keeping it here gives the redesigned
// modal one injectable upload/save/preview boundary and leaves the storage
// bucket, signed-URL convention and legacy row shape untouched.

import supabase from '../lib/supabase'
import {
  DOC_BUCKET,
  SIGNED_URL_TTL,
  buildDocumentPayload,
} from '../utils/documentForm.js'
import { isMissingColumnError } from '../utils/vehicleUtils.js'

export const PREVIEW_URL_TTL = 60 * 60

// Columns introduced by 20261120_document_management_fields.sql. Until that
// migration is applied, writes retry with the original payload shape.
export const DOCUMENT_NEW_COLUMNS = [
  'document_number', 'issuing_authority', 'issue_date',
  'reminder_enabled', 'reminder_interval', 'tags',
  'back_file_url', 'back_file_name', 'back_file_size',
  'file_path', 'back_file_path',
]

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function withoutNewColumns(payload) {
  const legacy = { ...payload }
  for (const column of DOCUMENT_NEW_COLUMNS) delete legacy[column]
  return legacy
}

export async function fetchDocuments() {
  const { data, error } = await requireSupabase()
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Could not load documents')
  return Array.isArray(data) ? data : []
}

// Upload the chosen file to the private bucket. The signed URL is kept for
// backward compatibility with existing previews; the object path is stored
// so a short-lived link can be regenerated later.
export async function uploadDocumentFile(file, { category = 'other', side = 'front' } = {}) {
  const client = requireSupabase()
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const suffix = side === 'back' ? '-back' : ''
  const path = `${category || 'other'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffix}.${ext}`
  const { error: uploadError } = await client.storage
    .from(DOC_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (uploadError) throw new Error(uploadError.message || 'File upload failed')

  const { data, error } = await client.storage
    .from(DOC_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not create a file link')
  return { url: data.signedUrl, name: file.name, size: file.size, path }
}

export async function saveDocument(form, { frontMeta = null, backMeta = null } = {}) {
  const client = requireSupabase()
  const payload = buildDocumentPayload(form, frontMeta, backMeta)
  const isUpdate = form.id && !String(form.id).startsWith('local-')

  const write = async body => {
    const query = isUpdate
      ? client.from('documents')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', form.id)
      : client.from('documents').insert(body)
    const { data, error } = await query.select().single()
    return { data, error }
  }

  let { data, error } = await write(payload)
  if (error && isMissingColumnError(error)) {
    // The migration is applied manually. Keep the app usable on a database
    // that has not picked up the new columns yet.
    const retry = await write(withoutNewColumns(payload))
    data = retry.data
    error = retry.error
  }
  if (error) throw new Error(error.message || 'Could not save document')
  return data
}

export async function deleteDocument(id) {
  const { error } = await requireSupabase().from('documents').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Could not delete document')
}

// Regenerate a short-lived link from the stored object path. Legacy rows
// without a path keep using their original signed URL.
export async function getDocumentFileUrl(doc, side = 'front') {
  if (!doc) return null
  const path = side === 'back' ? doc.back_file_path : doc.file_path
  const legacy = side === 'back' ? doc.back_file_url : doc.file_url
  if (!path) return legacy || null
  const { data, error } = await requireSupabase()
    .storage
    .from(DOC_BUCKET)
    .createSignedUrl(path, PREVIEW_URL_TTL)
  if (error || !data?.signedUrl) {
    if (legacy) return legacy
    throw new Error(error?.message || 'Could not open this file')
  }
  return data.signedUrl
}

// Best-effort cleanup for removed/replaced files. Never called before the
// database write succeeds, and never allowed to fail a save.
export async function deleteDocumentFiles(paths = []) {
  const clean = paths.filter(Boolean)
  if (!clean.length) return
  try {
    await requireSupabase().storage.from(DOC_BUCKET).remove(clean)
  } catch (error) {
    console.warn('[documents] could not remove old files:', error?.message || error)
  }
}
