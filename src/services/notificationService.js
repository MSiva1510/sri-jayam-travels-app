// ─── Notification Service ─────────────────────────────────────
// Supabase-backed notification system (no localStorage fallback).

import supabase from '../lib/supabase'

// ── Notification type catalogue ───────────────────────────────
export const NOTIFICATION_TYPES = {
  BOOKING_CREATED:    { icon:'📋', category:'booking',    priority:'normal', title:'New Booking'             },
  BOOKING_PENDING:    { icon:'⏳', category:'booking',    priority:'normal', title:'Awaiting Approval'       },
  BOOKING_APPROVED:   { icon:'✅', category:'booking',    priority:'normal', title:'Booking Approved'        },
  BOOKING_CANCELLED:  { icon:'❌', category:'booking',    priority:'high',   title:'Booking Cancelled'       },
  TRIP_ASSIGNED:      { icon:'👤', category:'trip',       priority:'normal', title:'Trip Assigned'           },
  TRIP_STARTED:       { icon:'🚗', category:'trip',       priority:'normal', title:'Trip Started'            },
  TRIP_COMPLETED:     { icon:'🏁', category:'trip',       priority:'normal', title:'Trip Completed'          },
  EXPENSE_ADDED:      { icon:'💸', category:'expense',    priority:'low',    title:'Expense Added'           },
  EXPENSE_APPROVED:   { icon:'✅', category:'expense',    priority:'normal', title:'Expense Approved'        },
  PAYROLL_GENERATED:  { icon:'💰', category:'payroll',    priority:'normal', title:'Payroll Generated'       },
  PAYROLL_PAID:       { icon:'🏦', category:'payroll',    priority:'high',   title:'Payroll Paid'            },
  DOCUMENT_EXPIRY:    { icon:'📄', category:'document',   priority:'high',   title:'Document Expiring'       },
  DOCUMENT_EXPIRED:   { icon:'⚠️', category:'document',   priority:'urgent', title:'Document Expired'        },
  VEHICLE_SERVICE:    { icon:'🔧', category:'vehicle',    priority:'normal', title:'Service Due'             },
  VEHICLE_EXPIRY:     { icon:'🚘', category:'vehicle',    priority:'high',   title:'Vehicle Doc Expiring'    },
  ATTENDANCE_MISSING: { icon:'📅', category:'attendance', priority:'normal', title:'Attendance Missing'      },
}

// ── Create a notification ─────────────────────────────────────
export async function createNotification({ type, message, userId, relatedId, actionUrl } = {}) {
  const tpl = NOTIFICATION_TYPES[type] || { icon:'🔔', category:'general', priority:'normal', title:'Notification' }
  const payload = {
    type,
    title:      tpl.title,
    message:    message || tpl.title,
    icon:       tpl.icon,
    category:   tpl.category,
    priority:   tpl.priority,
    related_id: relatedId || null,
    action_url: actionUrl || null,
    status:     'unread',
    is_read:    false,
    created_at: new Date().toISOString(),
  }

  if (!supabase || !userId) return { ...payload, id: `notif-${Date.now()}` }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({ ...payload, user_id: userId })
      .select()
      .single()
    if (!error && data) return data
  } catch (err) {
    console.error('[notificationService] create failed:', err.message)
  }
  return { ...payload, id: `notif-${Date.now()}` }
}

// ── Load notifications ────────────────────────────────────────
export async function loadNotifications(userId, { status, category, limit = 50 } = {}) {
  if (!supabase || !userId) return []
  try {
    let q = supabase.from('notifications').select('*').eq('user_id', userId)
    if (status)   q = q.eq('status', status)
    if (category) q = q.eq('category', category)
    q = q.order('created_at', { ascending: false }).limit(limit)
    const { data, error } = await q
    if (!error && data) return data
  } catch {}
  return []
}

// ── Mark read ─────────────────────────────────────────────────
export async function markRead(id) {
  if (!supabase) return
  try {
    await supabase.from('notifications')
      .update({ is_read: true, status: 'read', read_at: new Date().toISOString() })
      .eq('id', id)
  } catch {}
}

export async function markAllRead(userId) {
  if (!supabase || !userId) return
  try {
    await supabase.from('notifications')
      .update({ is_read: true, status: 'read', read_at: new Date().toISOString() })
      .eq('user_id', userId).eq('status', 'unread')
  } catch {}
}

// ── Archive / dismiss ─────────────────────────────────────────
export async function archiveNotification(id) {
  if (!supabase) return
  try {
    await supabase.from('notifications')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', id)
  } catch {}
}

export async function dismissNotification(id) {
  if (!supabase) return
  try {
    await supabase.from('notifications')
      .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
      .eq('id', id)
  } catch {}
}

// ── Unread count ──────────────────────────────────────────────
export async function getUnreadCount(userId) {
  if (!supabase || !userId) return 0
  try {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'unread')
    return count || 0
  } catch {}
  return 0
}

// ── Event emitters ────────────────────────────────────────────
export const notify = {
  bookingCreated:    (msg, uid, rid) => createNotification({ type:'BOOKING_CREATED',    message:msg, userId:uid, relatedId:rid }),
  bookingPending:    (msg, uid, rid) => createNotification({ type:'BOOKING_PENDING',    message:msg, userId:uid, relatedId:rid }),
  bookingApproved:   (msg, uid, rid) => createNotification({ type:'BOOKING_APPROVED',   message:msg, userId:uid, relatedId:rid }),
  bookingCancelled:  (msg, uid, rid) => createNotification({ type:'BOOKING_CANCELLED',  message:msg, userId:uid, relatedId:rid }),
  tripAssigned:      (msg, uid, rid) => createNotification({ type:'TRIP_ASSIGNED',      message:msg, userId:uid, relatedId:rid }),
  tripStarted:       (msg, uid, rid) => createNotification({ type:'TRIP_STARTED',       message:msg, userId:uid, relatedId:rid }),
  tripCompleted:     (msg, uid, rid) => createNotification({ type:'TRIP_COMPLETED',     message:msg, userId:uid, relatedId:rid }),
  expenseAdded:      (msg, uid, rid) => createNotification({ type:'EXPENSE_ADDED',      message:msg, userId:uid, relatedId:rid }),
  payrollGenerated:  (msg, uid, rid) => createNotification({ type:'PAYROLL_GENERATED',  message:msg, userId:uid, relatedId:rid }),
  documentExpiry:    (msg, uid, rid) => createNotification({ type:'DOCUMENT_EXPIRY',    message:msg, userId:uid, relatedId:rid }),
  vehicleExpiry:     (msg, uid, rid) => createNotification({ type:'VEHICLE_EXPIRY',     message:msg, userId:uid, relatedId:rid }),
  attendanceMissing: (msg, uid, rid) => createNotification({ type:'ATTENDANCE_MISSING', message:msg, userId:uid, relatedId:rid }),
}
