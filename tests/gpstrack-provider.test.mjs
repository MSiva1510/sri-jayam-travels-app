// Normalisation contract for the app.gpstrack.in adapter, using a real
// payload captured on 2026-09-15 (values trimmed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGpsTrackInProvider, normalizeRegistration } from '../src/services/gpsProvider/gpsTrackInProvider.js'

const SAMPLE = [
  { latitude: 11.894224, longitude: 79.806636, speed: 0, date: Date.now() - 3 * 60 * 60 * 1000, isoDate: null, odoDistance: 40361.04, ignitionStatus: 'OFF', status: 'OFF', vehicleStatus: 'PARKED', address: '45, Uppukara St, Ariyankuppam', regNo: 'PY01VF1255', vehicleType: 'CAR . SUV', vehicleId: 'qZ6pmd', deviceId: '0867440061832671', bearing: 113 },
  { latitude: 11.893623, longitude: 79.805188, speed: 41, date: Date.now(), ignitionStatus: 'ON', status: 'ON', vehicleStatus: 'MOVING', address: '10, 3rd Cross St', regNo: 'py-01 df 1255', vehicleType: 'CAR', vehicleId: 'oSdFma', deviceId: '0869925072569047', bearing: 12 },
  { latitude: null, longitude: 79.8, regNo: 'BROKEN' },
]

test('normalizes the vendor payload into the app snapshot shape', () => {
  const p = createGpsTrackInProvider({ api_token: 't', api_email: 'e' })
  const out = p.normalizeResponse(SAMPLE)
  assert.equal(out.length, 2, 'rows without a fix are dropped')

  const [parked, moving] = out
  assert.equal(parked.registration, 'PY01VF1255')
  assert.equal(parked.imei, '0867440061832671')
  assert.equal(parked.status, 'stopped')
  assert.equal(parked.ignition, false)
  assert.equal(parked.gps_online, false, 'a 3-hour-old fix is offline')
  assert.ok(!Number.isNaN(Date.parse(parked.timestamp)) && parked.timestamp.endsWith('Z'), 'ISO UTC timestamp')
  assert.equal(parked.odometer, 40361.04)
  assert.equal(parked._epoch % 60000, 0)

  assert.equal(moving.registration, 'PY01DF1255', 'registration is normalised')
  assert.equal(moving.status, 'moving')
  assert.equal(moving.ignition, true)
  assert.equal(moving.gps_online, true)
  assert.equal(moving.speed_kmh, 41)
})

test('registration normaliser', () => {
  assert.equal(normalizeRegistration(' py 01 df-1255 '), 'PY01DF1255')
})

test('refuses to call the vendor without credentials', async () => {
  const p = createGpsTrackInProvider({})
  const r = await p.fetchFleet()
  assert.equal(r.ok, false)
  assert.match(r.error, /token and account email/)
})

test('healthCheck surfaces non-array vendor responses (bad token)', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ message: 'Invalid token' }) })
  const p = createGpsTrackInProvider({ api_token: 'bad', api_email: 'e', use_proxy: false })
  const r = await p.healthCheck()
  assert.equal(r.ok, false)
  assert.match(r.error, /Invalid token/)
})
