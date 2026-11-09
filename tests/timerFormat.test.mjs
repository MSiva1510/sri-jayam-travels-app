// formatElapsed: stopwatch / countdown digit formatting.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatElapsed } from '../src/utils/timerFormat.js'

test('formats sub-minute with centiseconds', () => {
  assert.equal(formatElapsed(0), '00:00.00')
  assert.equal(formatElapsed(6150), '00:06.15')
  assert.equal(formatElapsed(59999), '00:59.99')
})

test('formats minutes and rolls into hours', () => {
  assert.equal(formatElapsed(125000), '02:05.00')
  assert.equal(formatElapsed(3600000), '1:00:00')
  assert.equal(formatElapsed(3723000), '1:02:03')
})

test('clamps garbage to zero', () => {
  assert.equal(formatElapsed(-5), '00:00.00')
  assert.equal(formatElapsed(NaN), '00:00.00')
  assert.equal(formatElapsed(undefined), '00:00.00')
})
