// snapPoint: OSRM nearest-road lookup with cache + graceful failure.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { snapPoint, clearSnapCache } from '../src/utils/snapToRoad.js'

const json = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 503,
  json: async () => body,
})

function stubFetch(impl) {
  const fn = mock.fn(impl)
  globalThis.fetch = fn
  return fn
}

test('snaps a fix to the waypoint location', async () => {
  clearSnapCache()
  stubFetch(async (url) => {
    assert.ok(String(url).includes('router.project-osrm.org/nearest/v1/driving/79.8'))
    return json({ code: 'Ok', waypoints: [{ location: [79.8066, 11.8942] }] })
  })
  const out = await snapPoint(11.89421, 79.80661)
  assert.deepEqual(out, { lat: 11.8942, lng: 79.8066 })
})

test('caches by rounded coordinate (no second request)', async () => {
  clearSnapCache()
  const fn = stubFetch(async () => json({ code: 'Ok', waypoints: [{ location: [1, 2] }] }))
  await snapPoint(11.111111, 22.222222)
  await snapPoint(11.111112, 22.222223) // same 5dp key
  assert.equal(fn.mock.callCount(), 1)
})

test('dedupes parallel requests for the same point', async () => {
  clearSnapCache()
  const fn = stubFetch(async () => json({ code: 'Ok', waypoints: [{ location: [1, 2] }] }))
  const [a, b] = await Promise.all([snapPoint(5, 6), snapPoint(5, 6)])
  assert.deepEqual(a, b)
  assert.equal(fn.mock.callCount(), 1)
})

test('returns null on bad input, HTTP failure, or empty waypoints', async () => {
  clearSnapCache()
  assert.equal(await snapPoint(null, 1), null)
  assert.equal(await snapPoint('x', 1), null)
  stubFetch(async () => json({}, false))
  assert.equal(await snapPoint(7, 8), null)
  clearSnapCache()
  stubFetch(async () => json({ code: 'NoSegment', waypoints: [] }))
  assert.equal(await snapPoint(9, 10), null)
})
