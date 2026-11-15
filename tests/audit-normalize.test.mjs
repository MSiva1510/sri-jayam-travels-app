// The bell's Activity tab and the dashboard widget read audit_logs rows
// straight from Supabase. Those rows carry action/changed_at/new_values, while
// the UI renders label/icon/description/timestamp — normalizeAuditRow bridges
// the two, and these tests pin that contract so rows never render blank again.
import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeAuditRow } from '../src/data/auditLogData.js'

test('maps a known action to its icon and human label', () => {
  const row = normalizeAuditRow({
    id: '1',
    action: 'USER_LOGIN',
    table_name: 'security',
    module: 'security',
    severity: 'info',
    new_values: { description: 'Admin (admin) logged in' },
    changed_at: '2026-11-15T15:21:45.428+00:00',
  })

  assert.equal(row.icon, '🔐')
  assert.equal(row.label, 'User Login')
  assert.equal(row.description, 'Admin (admin) logged in')
  assert.equal(row.timestamp, '2026-11-15T15:21:45.428+00:00')
  assert.equal(row.module, 'security')
})

test('falls back to a readable label for unknown actions', () => {
  const row = normalizeAuditRow({ id: '2', action: 'SOMETHING_NEW_HAPPENED', changed_at: '2026-01-01T00:00:00Z' })

  assert.equal(row.icon, '📌')
  assert.equal(row.label, 'Something New Happened')
  assert.equal(row.description, '')
  assert.equal(row.timestamp, '2026-01-01T00:00:00Z')
})

test('uses changed_by/table_name as description when no description exists', () => {
  const row = normalizeAuditRow({ action: 'CUSTOMER_ADDED', changed_by: 'Admin', table_name: 'customers' })
  assert.equal(row.description, 'Admin')
  assert.equal(row.label, 'Customer Added')
})

test('never returns undefined fields for an empty row', () => {
  const row = normalizeAuditRow({})
  assert.equal(row.icon, '📌')
  assert.equal(row.label, 'Activity')
  assert.equal(row.timestamp, null)
})

test('a row with no icon/label/timestamp has a usable id', () => {
  const row = normalizeAuditRow({ action: 'USER_LOGOUT', changed_at: '2026-11-15T15:21:17.701+00:00' })
  assert.equal(typeof row.id, 'string')
  assert.ok(row.id.length > 0)
})
