// ─── Trip messages: which WhatsApp templates a booking is due ───────────
// Pure: the notify function loads the booking + driver, asks dueMessages()
// what should have been sent by now, and sends whatever is not yet in
// whatsapp_outbound_messages (unique booking_id + kind), so calling it
// twice, or from every app, never sends twice.
//
// Templates must exist and be approved in WhatsApp Manager; their text is
// in TEMPLATES (scripts/whatsapp-templates.mjs creates them).

import { localPhone, waPhone } from './whatsappApi.js'

export const TEMPLATES = {
  sjt_booking_confirmed: {
    params: ['customer', 'booking no.', 'date', 'pickup', 'drop'],
    body: 'Hello {{1}}, your Sri Jayam Travels trip {{2}} on {{3}} from {{4}} to {{5}} is confirmed. We will share the driver details soon.',
    example: ['Mani', 'FY26-OCT-0052', '31 Oct 2026', 'Ariyakuppam', 'Chennai'],
  },
  sjt_driver_assigned: {
    params: ['customer', 'booking no.', 'date', 'driver', 'driver phone', 'car'],
    body: 'Hello {{1}}, your driver for trip {{2}} on {{3}} is {{4}} ({{5}}). Car number: {{6}}. Have a safe journey with Sri Jayam Travels.',
    example: ['Mani', 'FY26-OCT-0052', '31 Oct 2026', 'Ramanan', '9876543210', 'PY01VF1255'],
  },
  sjt_trip_completed: {
    params: ['customer', 'booking no.', 'pickup', 'drop', 'km', 'amount'],
    body: 'Thank you {{1}} for travelling with Sri Jayam Travels. Trip {{2}} from {{3}} to {{4}} ({{5}} km) is complete. Amount: {{6}}.',
    example: ['Mani', 'FY26-OCT-0052', 'Ariyakuppam', 'Chennai', '320', 'Rs. 5,400'],
  },
  sjt_driver_new_trip: {
    params: ['booking no.', 'date', 'time', 'pickup', 'drop', 'customer', 'customer phone'],
    body: 'New trip {{1}} on {{2}} at {{3}}: {{4}} to {{5}}. Customer: {{6}} ({{7}}). Open the Sri Jayam driver app for details.',
    example: ['FY26-OCT-0052', '31 Oct 2026', '06:00', 'Ariyakuppam', 'Chennai', 'Mani', '7305581235'],
  },
}

const ACTIVE = ['approved', 'confirmed', 'assigned', 'started']
const DONE = ['completed', 'closed']

export function tripDate(iso) {
  if (!iso) return '-'
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function rupees(n) {
  return `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
}

function daysBetween(fromIso, today) {
  const a = Date.parse(`${String(fromIso).slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  return Number.isNaN(a) ? 0 : Math.round((b - a) / 86_400_000)
}

/**
 * @param booking  bookings row
 * @param driver   drivers row of booking.driver_id (or null)
 * @param today    'YYYY-MM-DD' (IST)
 * @returns [{ kind, to, template, params }]
 */
export function dueMessages(booking, driver, today) {
  if (!booking) return []
  const out = []
  const customerTo = waPhone(booking.customer_contact)
  const name = booking.customer_name || 'Customer'
  const number = booking.booking_number || String(booking.id).slice(0, 8)
  const date = tripDate(booking.start_date)
  const age = booking.start_date ? daysBetween(booking.start_date, today) : 0
  const vehicle = booking.vehicle_reg || booking.type_data?.vehicle_registration

  // Old trips touched again (imports, edits) must not message anyone.
  const upcoming = age <= 1
  const recent = age <= 7

  if (ACTIVE.includes(booking.status) && upcoming) {
    if (customerTo) {
      out.push({
        kind: 'customer_confirmed',
        to: customerTo,
        template: 'sjt_booking_confirmed',
        params: [name, number, date, booking.pickup_location, booking.drop_location],
      })
    }
    if (driver) {
      const driverTo = waPhone(driver.phone)
      if (customerTo) {
        out.push({
          kind: `customer_driver:${driver.id}`,
          to: customerTo,
          template: 'sjt_driver_assigned',
          params: [name, number, date, driver.name, localPhone(driver.phone) || '-', vehicle],
        })
      }
      if (driverTo) {
        out.push({
          kind: `driver_trip:${driver.id}`,
          to: driverTo,
          template: 'sjt_driver_new_trip',
          params: [
            number, date, booking.start_time ? String(booking.start_time).slice(0, 5) : '-',
            booking.pickup_location, booking.drop_location, name, localPhone(booking.customer_contact) || '-',
          ],
        })
      }
    }
  }

  if (DONE.includes(booking.status) && recent && customerTo) {
    out.push({
      kind: 'customer_completed',
      to: customerTo,
      template: 'sjt_trip_completed',
      params: [
        name, number, booking.pickup_location, booking.drop_location,
        booking.total_km ? String(Math.round(Number(booking.total_km))) : '-',
        rupees(booking.total_fare ?? booking.base_fare),
      ],
    })
  }

  return out
}
