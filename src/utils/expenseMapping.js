// ─── Expense DB/UI mapping (pure) ───────────────────────────────
// Kept dependency-free so the column aliases can be unit-tested directly.
// The repository re-exports toDbExpense/EXPENSE_SELECT for existing callers.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Type-specific detail columns from 20261118_expense_type_details.sql.
export const DETAIL_COLUMNS = Object.freeze([
  'parking_location', 'parking_duration', 'toll_name', 'toll_route',
  'bata_driver', 'bata_trip', 'maintenance_vendor', 'maintenance_invoice',
])
export const DETAIL_COLUMN_RE = /(parking_location|parking_duration|toll_name|toll_route|bata_driver|bata_trip|maintenance_vendor|maintenance_invoice)/i

const BASE_EXPENSE_SELECT = 'id, expense_no, booking_id, driver_id, driver_name, vehicle_reg, trip_ref, amount, expense_date, description, created_by, status, type, odometer_km, litres_filled, fuel_station, fuel_rate, receipt_url, receipt_name, created_at, updated_at'
export const EXPENSE_SELECT = BASE_EXPENSE_SELECT.replace(
  ', created_at,',
  `, ${DETAIL_COLUMNS.join(', ')}, created_at,`
)
export { BASE_EXPENSE_SELECT }

export function toDbExpense(data = {}) {
  const bookingId = [data.booking_id, data.bookingId, data.tripRef]
    .find(v => UUID_RE.test(String(v || '')))
  const uiType = data.type === 'misc' ? 'other' : data.type
  // DB check constraint only allows pending / approved / rejected.
  const status = ['pending', 'approved', 'rejected'].includes(data.status)
    ? data.status
    : (['draft', 'submitted'].includes(data.status) ? 'pending' : data.status)
  const payload = {
    expense_no: data.expense_no ?? data.expenseNo,
    expense_type: data.expense_type ?? (['fuel', 'toll'].includes(uiType) ? uiType : 'other'),
    booking_id: bookingId ?? null,
    trip_ref: data.trip_ref ?? (UUID_RE.test(String(data.tripRef || '')) ? undefined : data.tripRef),
    driver_id: UUID_RE.test(String(data.driver_id || '')) ? data.driver_id : undefined,
    driver_name: data.driver_name ?? data.driver,
    vehicle_reg: data.vehicle_reg ?? data.vehicle,
    amount: data.amount,
    expense_date: data.expense_date ?? data.date ?? data.receiptDate,
    description: data.description ?? data.notes ?? data.location,
    created_by: UUID_RE.test(String(data.created_by || '')) ? data.created_by : undefined,
    status,
    approval_status: data.approval_status ?? status,
    type: uiType,
    odometer_km: data.odometerKm,
    litres_filled: data.litresFilled,
    fuel_station: data.fuelStation,
    fuel_rate: data.fuelRate,
    receipt_url: data.receipt_url ?? data.receiptUrl ?? undefined,
    receipt_name: data.receipt_name ?? data.receiptName ?? undefined,
    parking_location: data.parking_location ?? data.parkingLocation,
    parking_duration: data.parking_duration ?? data.parkingDuration,
    toll_name: data.toll_name ?? data.tollName,
    toll_route: data.toll_route ?? data.tollRoute,
    bata_driver: data.bata_driver ?? data.bataDriver,
    bata_trip: data.bata_trip ?? data.bataTrip,
    maintenance_vendor: data.maintenance_vendor ?? data.maintenanceVendor,
    maintenance_invoice: data.maintenance_invoice ?? data.maintenanceInvoice,
  }
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

export function normalizeExpense(row = {}) {
  return {
    ...row,
    id: row.id || row.expense_id,
    expenseNo: row.expense_no ?? row.expenseNo ?? '',
    date: row.date ?? row.expense_date ?? '',
    amount: Number(row.amount ?? 0),
    description: row.description ?? row.notes ?? row.location ?? '',
    tripRef: row.trip_ref ?? row.tripRef ?? row.booking_id ?? '',
    bookingId: row.bookingId ?? row.booking_id ?? '',
    driver: row.driver ?? row.driver_name ?? '',
    vehicle: row.vehicle_reg ?? row.vehicle ?? row.vehicle_registration ?? row.vehicle_id ?? '',
    addedBy: row.addedBy ?? row.created_by ?? '',
    receiptName: row.receiptName ?? row.receipt_name ?? row.bill_image_url ?? '',
    receiptUrl: row.receiptUrl ?? row.receipt_url ?? row.bill_image_url ?? '',
    receiptDate: row.receiptDate ?? row.expense_date ?? '',
    status: !row.status || ['draft', 'submitted'].includes(row.status) ? 'pending' : row.status,
    createdAt: row.createdAt ?? row.created_at ?? '',
    updatedAt: row.updatedAt ?? row.updated_at ?? row.created_at ?? '',
    // Fuel-specific fields
    odometerKm: row.odometer_km || row.odometerKm || 0,
    litresFilled: row.litres_filled || row.litresFilled || 0,
    fuelStation: row.fuel_station || row.fuelStation || '',
    fuelRate: row.fuel_rate || row.fuelRate || 0,
    // Type-specific details (20261118_expense_type_details.sql)
    parkingLocation: row.parking_location ?? row.parkingLocation ?? '',
    parkingDuration: row.parking_duration ?? row.parkingDuration ?? '',
    tollName: row.toll_name ?? row.tollName ?? '',
    tollRoute: row.toll_route ?? row.tollRoute ?? '',
    bataDriver: row.bata_driver ?? row.bataDriver ?? '',
    bataTrip: row.bata_trip ?? row.bataTrip ?? '',
    maintenanceVendor: row.maintenance_vendor ?? row.maintenanceVendor ?? '',
    maintenanceInvoice: row.maintenance_invoice ?? row.maintenanceInvoice ?? '',
  }
}
