// Multi-vendor GPS polling.
//
// The Sri Jayam fleet is split across two tracking companies — PY01CY1255 on
// KingsTrack, PY01VF1255 + PY01DF1255 on GPSTrack.in — so the provider layer
// must poll both and merge, and one vendor failing must not stop the other.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createGpsProvider, parseProviderNames, settingsForProvider, GPS_PROVIDER_NAMES,
} from '../src/services/gpsProvider/index.js'

const KINGS_ROW = {
  Vehicle: 'PY01CY1255', Latitude: 11.9416, Longitude: 79.8083, Speed: 0,
  Timestamp: new Date().toISOString(), GPS: 'A', Ignition: 'OFF', Status: 'Stopped',
  Odometer: 1200, IMEI: '861551040058083',
}
const GPSTRACK_ROWS = [
  { latitude: 11.8942, longitude: 79.8066, speed: 0, date: Date.now(), ignitionStatus: 'OFF', vehicleStatus: 'PARKED', regNo: 'PY01VF1255', deviceId: '0867440061832671', odoDistance: 40361 },
  { latitude: 11.8936, longitude: 79.8052, speed: 41, date: Date.now(), ignitionStatus: 'ON', vehicleStatus: 'MOVING', regNo: 'PY01DF1255', deviceId: '0869925072569047', odoDistance: 18599 },
]

const SETTINGS = {
  provider: 'kingstrack,gpstrack', use_proxy: false, timeout: 10,
  company_id: 'c1', user_id: 'u1',
  api_token: 'tok', api_email: 'fleet@example.com',
}

const json = (body, ok = true, status = 200) => ({
  ok, status, json: async () => body, text: async () => JSON.stringify(body),
})

/** route by host so both adapters can be driven from one mock */
function mockFetch({ kings = () => json([KINGS_ROW]), gpstrack = () => json(GPSTRACK_ROWS) } = {}) {
  const calls = { kings: 0, gpstrack: 0 }
  globalThis.fetch = async (url) => {
    const u = String(url?.url ?? url)
    if (u.includes('apmkingstrack')) { calls.kings++; return kings() }
    if (u.includes('gpstrack.in'))   { calls.gpstrack++; return gpstrack() }
    throw new Error('unexpected host: ' + u)
  }
  return calls
}

test('parseProviderNames accepts the separators people actually type', () => {
  assert.deepEqual(parseProviderNames('gpstrack'), ['gpstrack'])
  assert.deepEqual(parseProviderNames('kingstrack,gpstrack'), ['kingstrack', 'gpstrack'])
  assert.deepEqual(parseProviderNames(' KingsTrack + gpstrack '), ['kingstrack', 'gpstrack'])
  assert.deepEqual(parseProviderNames('gpstrack,gpstrack'), ['gpstrack'], 'de-duplicates')
  assert.deepEqual(parseProviderNames(''), [])
  assert.deepEqual(parseProviderNames(null), [])
})

test('settingsForProvider scopes per-vendor keys and drops the shared api_url when multi', () => {
  const raw = { api_url: 'https://shared', api_token: 't', gpstrack_api_url: 'https://gps', kingstrack_timeout: 9 }
  const single = settingsForProvider('gpstrack', raw, false)
  assert.equal(single.api_url, 'https://gps', 'prefixed key wins')

  const multi = settingsForProvider('kingstrack', raw, true)
  assert.equal(multi.api_url, undefined, 'ambiguous across vendors → adapter default')
  assert.equal(multi.timeout, 9, 'prefixed override still applies')
  assert.equal(multi.api_token, 't', 'unprefixed keys stay shared')
})

test('unknown provider name is rejected', () => {
  assert.throws(() => createGpsProvider('nope', SETTINGS), /Unknown provider/)
  assert.throws(() => createGpsProvider('', SETTINGS), /No provider configured/)
  assert.deepEqual(GPS_PROVIDER_NAMES, ['kingstrack', 'gpstrack'])
})

test('both vendors are polled and the fleet is merged', async () => {
  const calls = mockFetch()
  const provider = createGpsProvider('kingstrack,gpstrack', SETTINGS)
  assert.equal(provider.name, 'kingstrack+gpstrack')

  const res = await provider.fetchFleet()
  assert.equal(res.ok, true)
  assert.equal(res.partial, false)
  assert.equal(calls.kings, 1)
  assert.equal(calls.gpstrack, 1)

  const regs = res.snapshots.map(s => s.registration).sort()
  assert.deepEqual(regs, ['PY01CY1255', 'PY01DF1255', 'PY01VF1255'], 'all three vehicles present')
  assert.deepEqual(
    res.snapshots.map(s => s._provider),
    ['kingstrack', 'gpstrack', 'gpstrack'],
    'each snapshot is tagged with its source',
  )
  assert.deepEqual(res.providers.map(p => [p.name, p.ok, p.count]), [['kingstrack', true, 1], ['gpstrack', true, 2]])
})

test('one dead vendor still lets the other update (the bug this fixes)', async () => {
  mockFetch({ kings: () => json({ error: 'down' }, false, 500) })
  const res = await createGpsProvider('kingstrack,gpstrack', SETTINGS).fetchFleet()

  assert.equal(res.ok, true, 'healthy vendor keeps the sync alive')
  assert.equal(res.partial, true)
  assert.match(res.error, /kingstrack/)
  assert.deepEqual(res.snapshots.map(s => s.registration), ['PY01VF1255', 'PY01DF1255'])
})

test('a device reported by both vendors is not duplicated', async () => {
  mockFetch({ kings: () => json([{ ...KINGS_ROW, Vehicle: 'PY01VF1255', IMEI: '0867440061832671' }]) })
  const res = await createGpsProvider('kingstrack,gpstrack', SETTINGS).fetchFleet()
  const vf = res.snapshots.filter(s => s.registration === 'PY01VF1255')
  assert.equal(vf.length, 1)
  assert.equal(vf[0]._provider, 'kingstrack', 'first listed vendor wins')
})

test('a single provider keeps the plain (non-composite) shape', async () => {
  const calls = mockFetch()
  const provider = createGpsProvider('gpstrack', SETTINGS)
  assert.equal(provider.name, 'gpstrack')
  const res = await provider.fetchFleet()
  assert.equal(res.ok, true)
  assert.equal(calls.kings, 0, 'only the selected vendor is called')
  assert.equal(res.snapshots.length, 2)
})
