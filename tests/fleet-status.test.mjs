import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FLEET_STATUSES, hasGpsFix, mergeFleetVehicles, normReg,
  speedText, vehStatus,
} from '../src/components/fleet/fleetStatus.js'

const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString()

test('movement status is separate from GPS connection and ignition', () => {
  const now = Date.now()
  assert.equal(vehStatus({ timestamp: iso(1), speed_kmh: 24, ignition: false }, now), 'moving')
  assert.equal(vehStatus({ timestamp: iso(1), speed_kmh: 0, ignition: true }, now), 'stopped')
  assert.equal(vehStatus({ timestamp: iso(30), speed_kmh: 0, ignition: true }, now), 'offline')
  assert.equal(vehStatus({ timestamp: null, speed_kmh: 0 }, now), 'offline')
})

test('status palette uses green moving, blue stopped and red offline', () => {
  assert.equal(FLEET_STATUSES.moving.tone, 'green')
  assert.equal(FLEET_STATUSES.stopped.tone, 'blue')
  assert.equal(FLEET_STATUSES.offline.tone, 'red')
})

test('speed is unknown without a GPS fix', () => {
  assert.equal(speedText({ timestamp: null, speed_kmh: 0 }), '—')
  assert.equal(speedText({ timestamp: iso(1), speed_kmh: 32 }), '32 km/h')
  assert.equal(hasGpsFix({ latitude: 11.94, longitude: 79.8 }), true)
  assert.equal(hasGpsFix({ latitude: null, longitude: null }), false)
})

test('fleet roster keeps vehicles without GPS as offline, never stopped', () => {
  const snapshots = [
    {
      id: 'gps-1', registration: 'PY 01 CY 1255', vehicle_id: 'v1',
      timestamp: iso(2), speed_kmh: 18, latitude: 11.94, longitude: 79.8,
    },
  ]
  const vehicles = [
    { id: 'v1', registration: 'PY01CY1255', model: 'Swift Dzire' },
    { id: 'v2', registration: 'PY01XY1255', model: 'Bolero' },
  ]
  const merged = mergeFleetVehicles(vehicles, snapshots)

  assert.equal(merged.length, 2)
  assert.equal(merged[0].vehicle_model, 'Swift Dzire')
  assert.equal(vehStatus(merged[0]), 'moving')
  assert.equal(vehStatus(merged[1]), 'offline')
  assert.equal(merged[1].timestamp, null)
  assert.equal(merged[1].latitude, null)
  assert.equal(speedText(merged[1]), '—')
})

test('unmatched GPS rows remain visible and registration matching ignores formatting', () => {
  assert.equal(normReg('py-01 / cy 1255'), 'PY01CY1255')
  const gps = [{ id: 'gps-2', registration: 'PY99ZZ9999', timestamp: iso(3), speed_kmh: 0 }]
  const merged = mergeFleetVehicles([{ id: 'v1', registration: 'PY01CY1255' }], gps)

  assert.deepEqual(merged.map(s => s.id), ['vehicle:v1', 'gps-2'])
})
