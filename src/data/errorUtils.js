// ─── Error Utilities ─────────────────────────────────────────────
// Consistent error format across all data operations.
// Every error thrown by data layers follows this shape:
//   { message: string, field?: string, code?: string, suggestion?: string }
//   message   — human-readable explanation of what went wrong
//   field     — optional form field name to highlight (e.g. 'mobile')
//   code      — optional database/code error code (e.g. '23505', '42P10')
//   suggestion — optional advice on how to fix it

export class AppError extends Error {
  constructor({ message, field, code, suggestion }) {
    super(message)
    this.name = 'AppError'
    this.field = field || null
    this.code = code || null
    this.suggestion = suggestion || null
  }
}

// ── Database error translators ──────────────────────────────────
// Supabase/Postgres error codes → user-friendly messages

export function translateDbError(err, context = '') {
  const msg = err?.message || String(err || 'Unknown error')
  const code = err?.code || null

  // Duplicate key violations
  if (code === '23505' || /duplicate key|already exists|unique violation/i.test(msg)) {
    if (/mobile|phone/i.test(msg)) {
      return new AppError({
        message: 'This mobile number is already registered to another customer.',
        field: 'mobile',
        code: '23505',
        suggestion: 'Use a different mobile number or check if this customer already exists.',
      })
    }
    if (/email/i.test(msg)) {
      return new AppError({
        message: 'This email address is already in use.',
        field: 'email',
        code: '23505',
        suggestion: 'Use a different email address.',
      })
    }
    return new AppError({
      message: 'A record with these details already exists.',
      code: '23505',
      suggestion: 'Check for duplicate entries or use different values.',
    })
  }

  // Missing unique constraint (42P10)
  if (code === '42P10' || /no unique or exclusion constraint/i.test(msg)) {
    return new AppError({
      message: 'Database configuration error: missing unique constraint.',
      code: '42P10',
      suggestion: 'Contact system administrator to fix the database schema.',
    })
  }

  // Row-level security / permission denied
  if (code === '42501' || /row-level security|rls|permission denied/i.test(msg)) {
    return new AppError({
      message: 'Permission denied. Your account does not have access to save this data.',
      code: '42501',
      suggestion: 'Contact your administrator to grant the required permissions.',
    })
  }

  // Foreign key violation
  if (code === '23503' || /foreign key|violates foreign key/i.test(msg)) {
    return new AppError({
      message: 'Related record not found. The referenced data may have been deleted.',
      code: '23503',
      suggestion: 'Refresh the page and try again, or contact support.',
    })
  }

  // Not null violation
  // Postgres message: "null value in column "phone" of relation "customers" violates not-null constraint"
  if (code === '23502' || /not null|null value/i.test(msg)) {
    // Extract column name from Postgres error: null value in column "X" of relation "Y" ...
    const colMatch = msg.match(/null value in column "([^"]+)"/i)
    const colName = colMatch ? colMatch[1] : null
    // Map DB column names to form field names
    const colToField = {
      phone: 'mobile',
      primary_mobile: 'mobile',
      name: 'name',
      type: 'Customer Type',
      status: 'Status',
      is_active: 'Status',
    }
    const field = colName ? colToField[colName] ?? colName : null
    return new AppError({
      message: colName
        ? `The field "${colName}" is required but was not provided.`
        : 'A required field is missing.',
      field,
      code: '23502',
      suggestion: 'Fill in all required fields and try again.',
    })
  }

  // Connection / network errors
  if (/failed to fetch|network|connection|ECONNREFUSED/i.test(msg)) {
    return new AppError({
      message: 'Cannot connect to the server. Please check your internet connection.',
      code: 'NETWORK_ERROR',
      suggestion: 'Check your internet connection and try again.',
    })
  }

  // Timeout
  if (/timeout|timed out/i.test(msg)) {
    return new AppError({
      message: 'The request timed out. The server may be busy.',
      code: 'TIMEOUT',
      suggestion: 'Try again in a moment.',
    })
  }

  // Generic fallback
  return new AppError({
    message: msg || 'An unexpected error occurred.',
    code,
    suggestion: 'If this problem persists, contact support.',
  })
}

// ── Helper: format error for UI display ─────────────────────────
// Returns { field, message } suitable for setErrors({ [field]: message })
export function formatUiError(err) {
  const e = translateDbError(err)
  return {
    field: e.field,
    message: e.message,
    code: e.code,
    suggestion: e.suggestion,
  }
}

// ── Helper: throw a validation error ────────────────────────────
export function validationError(message, field) {
  return new AppError({ message, field, code: 'VALIDATION_ERROR' })
}
