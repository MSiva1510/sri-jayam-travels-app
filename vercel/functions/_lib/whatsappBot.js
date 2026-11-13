// ─── WhatsApp auto-reply bot (pure) ──────────────────────────────────────
// One conversation per customer phone (whatsapp_conversations.state/data).
// botStep() turns an incoming message into replies, the next state and at
// most one action for the webhook to carry out:
//   create_booking — insert a 'pending' booking (office approves on the web)
//   trip_status    — look up the customer's trips (statusReply() words it)
//   handoff        — pause the bot so staff answer from the inbox
// Replies are free text / buttons: allowed because the customer just wrote.

export const MENU_BUTTONS = [
  { id: 'book', title: 'Book a trip' },
  { id: 'status', title: 'My trip status' },
  { id: 'staff', title: 'Talk to staff' },
]

// Trip models. The ids are the values stored in bookings.type.
export const TRIP_TYPE_BUTTONS = [
  { id: 'one_way', title: 'One way' },
  { id: 'round_trip', title: 'Round trip' },
  { id: 'self_drive', title: 'Self drive' },
]

const TRIP_TYPE_ALIASES = {
  one_way: ['one_way', 'one way', 'oneway', 'single', 'single trip', '1'],
  round_trip: ['round_trip', 'round trip', 'roundtrip', 'round', 'return', 'two way', '2'],
  self_drive: ['self_drive', 'self drive', 'selfdrive', 'self driving', 'drive myself', '3'],
}

const TRIP_TYPE_LABEL = {
  one_way: 'One way',
  round_trip: 'Round trip',
  self_drive: 'Self drive',
}

const RESET_WORDS = ['hi', 'hii', 'hello', 'hey', 'menu', 'start', 'vanakkam', '0']
const CANCEL_WORDS = ['cancel', 'stop', 'exit']

const BOOK_VERBS = /\b(?:book|booking|reserve|need|want|hire)\b/
const BOOK_NOUNS = /\b(?:cab|taxi|car|trip|ride|vehicle)\b/

/** "book cab", "cab", "taxi", "I want to book a cab" … all start a booking. */
function isBookIntent(input) {
  if (input === '1' || input === 'book' || input === 'booking') return true
  if (/^(?:cab|taxi|car|trip)$/.test(input)) return true
  return BOOK_VERBS.test(input) && BOOK_NOUNS.test(input)
}

function isStatusIntent(input) {
  return input === '2' || /\bstatus\b/.test(input)
}

function isStaffIntent(input) {
  return input === '3' || /\b(?:staff|agent|human|operator)\b/.test(input) || /\btalk to\b/.test(input)
}

/** Button id / typed wording → bookings.type, or null. */
export function tripType(input) {
  const t = norm(input)
  for (const [type, aliases] of Object.entries(TRIP_TYPE_ALIASES)) {
    if (aliases.includes(t)) return type
  }
  return null
}

const STATUS_LABEL = {
  draft: 'Draft', pending: 'Waiting for confirmation', approved: 'Confirmed', confirmed: 'Confirmed',
  assigned: 'Driver assigned', started: 'On the way', completed: 'Completed', closed: 'Completed',
  cancelled: 'Cancelled',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function norm(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[.!?]+$/, '')
}

function firstName(name) {
  const n = String(name ?? '').trim().split(/\s+/)[0]
  return n ? ` ${n}` : ''
}

export function prettyDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : String(iso)
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** "today" / "tomorrow" / "5/11" / "05-11-2026" / "5.11.26" → 'YYYY-MM-DD' (not in the past). */
export function parseTripDate(text, today) {
  const t = norm(text)
  if (t === 'today' || t === 'inru' || t === 'indru') return today
  if (t === 'tomorrow' || t === 'tmrw' || t === 'naalai' || t === 'nalai') return addDays(today, 1)
  const m = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2}|\d{4}))?$/.exec(t)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const thisYear = Number(today.slice(0, 4))
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : thisYear
  const make = y => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const valid = y => {
    const d = new Date(`${make(y)}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.getUTCDate() === day && d.getUTCMonth() + 1 === month
  }
  if (!valid(year)) return null
  if (!m[3] && make(year) < today) year += 1 // "5/1" in December means next January
  if (!valid(year) || make(year) < today) return null
  return make(year)
}

/** "6", "6:30 am", "18:45", "6.30pm" → 'HH:MM' (24 h); "skip" → null. */
export function parseTripTime(text) {
  const t = norm(text).replace(/\s+/g, '')
  const m = /^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/.exec(t)
  if (!m) return undefined
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

const text = body => ({ kind: 'text', body })
const buttons = (body, list) => ({ kind: 'buttons', body, buttons: list })
const location = body => ({ kind: 'location', body })

/** Valid WGS-84 point, or null. */
function point(lat, lng) {
  const a = Number(lat)
  const b = Number(lng)
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180
    ? { lat: a, lng: b }
    : null
}

/**
 * Reads a place from anything the customer can send:
 *   • a WhatsApp location share — whatsappWebhook.textOf() flattens it to
 *     "Name · Address · 12.9716,79.1587"
 *   • a Google / Apple / Bing maps link (full links carry coordinates, short
 *     links are kept as they are)
 *   • a bare "12.9716,79.1587" or "geo:12.9716,79.1587"
 * Returns { lat, lng, label } / { url } or null when it reads as plain text.
 */
export function parseLocation(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null

  // WhatsApp share: "Ariyakuppam · Main Road · 12.9716,79.1587"
  let m = /^(.*?)\s·\s(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(s)
  if (m) {
    const p = point(m[2], m[3])
    return p ? { ...p, label: m[1].trim() } : null
  }

  // geo:12.9716,79.1587
  m = /^geo:(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i.exec(s)
  if (m) {
    const p = point(m[1], m[2])
    return p ? { ...p, label: '' } : null
  }

  if (/(?:google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl|maps\.apple\.com|bing\.com\/maps)/i.test(s)) {
    for (const re of [
      /[?&](?:q|query|ll|center|daddr|saddr|destination|coordinates)=?(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
      /[?&]cp=(-?\d+(?:\.\d+)?)~(-?\d+(?:\.\d+)?)/i,
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    ]) {
      m = re.exec(s)
      if (m) {
        const p = point(m[1], m[2])
        if (p) return { ...p, label: '' }
      }
    }
    return { url: s } // short link: keep it, coordinates are behind the redirect
  }

  // Typed coordinates only.
  m = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(s)
  if (m) {
    const p = point(m[1], m[2])
    return p ? { ...p, label: '' } : null
  }
  return null
}

/** One tidy line for the booking + summary ("Name (12.97160, 79.15870)"). */
export function locationText(raw) {
  const s = String(raw ?? '').trim()
  const loc = parseLocation(s)
  if (!loc) return s.slice(0, 200)
  if (loc.url) return loc.url.slice(0, 200)
  const at = `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
  return (loc.label ? `${loc.label} (${at})` : at).slice(0, 200)
}

function menu(contactName, welcome = false) {
  return buttons(
    `${welcome
      ? `Vanakkam${firstName(contactName)}! Welcome to Sri Jayam Travels 🚖\n`
      : ''}How can we help you?`,
    MENU_BUTTONS,
  )
}

function bookingSummary(d) {
  const rows = [`Trip: ${TRIP_TYPE_LABEL[d.type] ?? TRIP_TYPE_LABEL.one_way}`]
  rows.push(
    `Pickup: ${d.pickup}`,
    `Drop: ${d.drop}`,
    `Date: ${prettyDate(d.date)}`,
  )
  if (d.return_date) rows.push(`Return: ${prettyDate(d.return_date)}`)
  rows.push(`Time: ${d.time ?? 'Not given'}`)
  return rows.join('\n')
}

/**
 * @param conv  { state, data } of whatsapp_conversations (or null)
 * @param msg   { text, replyId, contactName }
 * @param today 'YYYY-MM-DD' in IST
 * @returns { replies, state, data, action }
 */
export function botStep(conv, msg, today) {
  const state = conv?.state ?? null
  const data = conv?.data ?? {}
  const input = norm(msg.replyId || msg.text)
  const raw = String(msg.text ?? '').trim()
  const done = (replies, nextState = null, nextData = {}, action = null) =>
    ({ replies, state: nextState, data: nextData, action })
  const isFirstHi = input === 'hi' && !conv?.welcome_checked_at

  // First contact with the bot: greet before the flow (menu button, typed
  // place, status ask … all get the "Vanakkam … Welcome" start of the chat).
  const greetFirst = (replies) => {
    if (conv?.welcome_checked_at || state) return replies
    return [menu(msg.contactName, true), ...replies]
  }

  if (CANCEL_WORDS.includes(input) && state) {
    return done([buttons('Cancelled — no booking was made. What would you like to do?', MENU_BUTTONS)])
  }
  if (RESET_WORDS.includes(input)) {
    return {
      ...done([menu(msg.contactName, isFirstHi)]),
      welcome: isFirstHi,
    }
  }

  switch (state) {
    case 'book_type': {
      const type = tripType(input)
      if (!type) {
        return done(
          [buttons('Please choose your trip type:', TRIP_TYPE_BUTTONS)],
          state,
          data,
        )
      }
      return done(
        [location('Sure! Share your pickup location, or type the place name.')],
        'book_pickup',
        { ...data, type, ...(type === 'self_drive' ? { self_drive: true } : {}) },
      )
    }

    case 'book_pickup':
      if (!raw) return done([location('Please share your pickup location, or type the place name.')], state, data)
      return done(
        [location('Where to? Share the drop location, or type the place name.')],
        'book_drop',
        { ...data, pickup: locationText(raw) },
      )

    case 'book_drop':
      if (!raw) return done([location('Please share the drop location, or type the place name.')], state, data)
      return done(
        [text('Which date? Type today, tomorrow or a date like 5/11.')],
        'book_date',
        { ...data, drop: locationText(raw) },
      )

    case 'book_date': {
      const date = parseTripDate(raw, today)
      if (!date) return done([text('Sorry, I could not read that date. Type today, tomorrow or a date like 5/11.')], state, data)
      if (data.type === 'round_trip') {
        return done([text('Return date? Type today, tomorrow or a date like 5/11.')], 'book_return_date', { ...data, date })
      }
      return done([text('Pickup time? For example 6:30 am. Type skip if not sure.')], 'book_time', { ...data, date })
    }

    case 'book_return_date': {
      const returnDate = parseTripDate(raw, today)
      if (!returnDate) return done([text('Sorry, I could not read that date. Type today, tomorrow or a date like 5/11.')], state, data)
      if (returnDate < data.date) {
        return done([text('The return date cannot be before the pickup date. Please type the return date again.')], state, data)
      }
      return done([text('Pickup time? For example 6:30 am. Type skip if not sure.')], 'book_time', { ...data, return_date: returnDate })
    }

    case 'book_time': {
      const time = input === 'skip' ? null : parseTripTime(raw)
      if (time === undefined) return done([text('Please type a time like 6:30 am, or skip.')], state, data)
      const next = { ...data, time }
      return done(
        [buttons(`Please check your trip:\n${bookingSummary(next)}`, [
          { id: 'confirm', title: 'Confirm' },
          { id: 'cancel', title: 'Cancel' },
        ])],
        'book_confirm',
        next,
      )
    }

    case 'book_confirm':
      if (input === 'confirm' || input === 'yes' || input === 'ok') {
        if (data.self_drive && !data.dlNum) {
          // Self-drive needs the ID details once, before the final confirm.
          return done(
            [text('Self Drive — ID Details:\n1) Aadhaar\n2) PAN Card\n3) Passport\n4) Voter ID\n\nReply with the ID type number (1-4) or name:')],
            'book_selfdrive_id_type',
            data,
          )
        }
        return done([], null, {}, { type: 'create_booking', booking: data })
      }
      return done(
        [buttons('Tap Confirm to send the booking, or Cancel.', [
          { id: 'confirm', title: 'Confirm' },
          { id: 'cancel', title: 'Cancel' },
        ])],
        state,
        data,
      )

    case 'book_selfdrive_id_type': {
      const idMap = { '1': 'Aadhaar', '2': 'PAN Card', '3': 'Passport', '4': 'Voter ID' }
      const typed = {
        aadhaar: 'Aadhaar', aadhar: 'Aadhaar',
        pan: 'PAN Card', 'pan card': 'PAN Card',
        passport: 'Passport',
        voter: 'Voter ID', 'voter id': 'Voter ID',
      }
      const idType = idMap[input] || typed[input]
      if (!idType) {
        return done(
          [text('Please reply with ID type: 1) Aadhaar, 2) PAN Card, 3) Passport, 4) Voter ID')],
          state,
          data,
        )
      }
      return done(
        [text(`Please enter your ${idType} number:`)],
        'book_selfdrive_id_num',
        { ...data, idType },
      )
    }

    case 'book_selfdrive_id_num': {
      if (!raw || raw.length < 3) {
        return done([text('Please enter a valid ID number:')], state, data)
      }
      return done(
        [text('Please enter your Driving Licence number:')],
        'book_selfdrive_dl_num',
        { ...data, idNum: raw },
      )
    }

    case 'book_selfdrive_dl_num': {
      if (!raw || raw.length < 3) {
        return done([text('Please enter a valid Driving Licence number:')], state, data)
      }
      return done(
        [text('Please enter your Driving Licence expiry date (DD/MM/YYYY):')],
        'book_selfdrive_dl_expiry',
        { ...data, dlNum: raw },
      )
    }

    case 'book_selfdrive_dl_expiry': {
      if (!raw || raw.length < 5) {
        return done([text('Please enter a valid expiry date (DD/MM/YYYY):')], state, data)
      }
      const next = { ...data, dlExpiry: raw }
      return done(
        [buttons(`Please check your self-drive trip:\n${bookingSummary(next)}\n\nID: ${next.idType} — ${next.idNum}\nDL: ${next.dlNum}\nDL Expiry: ${next.dlExpiry}\n\nTap Confirm to book:`, [
          { id: 'confirm', title: 'Confirm' },
          { id: 'cancel', title: 'Cancel' },
        ])],
        'book_confirm',
        next,
      )
    }

    default:
      break
  }

  if (isStatusIntent(input)) {
    return done(greetFirst([]), null, {}, { type: 'trip_status' })
  }
  if (isStaffIntent(input)) {
    return done(greetFirst([text('Okay, our team will reply here shortly. Type menu any time to use the bot again.')]), null, {}, { type: 'handoff' })
  }
  if (isBookIntent(input)) {
    return done(
      [...greetFirst([buttons('Which type of trip do you need?', TRIP_TYPE_BUTTONS)])],
      'book_type',
      {},
    )
  }
  return done(greetFirst([menu(msg.contactName)]))
}

/** Reply after create_booking succeeded. */
export function bookedReply(bookingNumber, data, customer = null) {
  const vip = customer ? (customer.is_vip || customer.isVip) : false
  const freq = customer ? (customer.is_frequent_traveller || customer.isFrequentTraveller) : false
  const honor = vip ? 'Valued VIP customer' : freq ? 'Frequent traveller' : ''
  const honorLine = honor ? `\n${honor} — thank you for traveling with us.` : ''
  return text(
    `Thank you! Your request ${bookingNumber} is booked:${honorLine}\n${bookingSummary(data)}\n\n` +
    'Our office will confirm the fare and send the driver details here.',
  )
}

/** Reply for trip_status: the customer's newest trips (bookings newest first). */
export function statusReply(bookings, driversById = {}) {
  const live = bookings.filter(b => b.status !== 'draft').slice(0, 3)
  if (!live.length) {
    return buttons('We could not find a trip for this number. Would you like to book one?', [
      { id: 'book', title: 'Book a trip' },
      { id: 'staff', title: 'Talk to staff' },
    ])
  }
  const lines = live.map(b => {
    const d = driversById[b.driver_id]
    const driver = d ? `\nDriver: ${d.name}${d.phone ? ` (${String(d.phone).replace(/\D/g, '').slice(-10)})` : ''}` : ''
    const car = b.vehicle_reg ? `\nCar: ${b.vehicle_reg}` : ''
    return `*${b.booking_number || 'Trip'}* — ${STATUS_LABEL[b.status] ?? b.status}\n` +
      `${prettyDate(b.start_date)}${b.start_time ? ` ${String(b.start_time).slice(0, 5)}` : ''}: ` +
      `${b.pickup_location || '-'} → ${b.drop_location || '-'}${driver}${car}`
  })
  return text(`${lines.join('\n\n')}\n\nType menu for more options.`)
}

/** FY booking number like the apps: FY26-OCT-0053 (sequence across the FY). */
export function nextBookingNumber(dateIso, existing, bump = 0) {
  const [y, m] = dateIso.split('-').map(Number)
  const fyStart = m >= 4 ? y : y - 1
  const prefix = `FY${String(fyStart % 100).padStart(2, '0')}-`
  let max = 0
  for (const n of existing) {
    const match = /^FY\d{2}-[A-Z]{3}-(\d+)$/.exec(String(n ?? '').trim())
    if (match && String(n).startsWith(prefix)) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}${MONTHS[m - 1].toUpperCase()}-${String(max + 1 + bump).padStart(4, '0')}`
}
