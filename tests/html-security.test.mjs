import test from 'node:test'
import assert from 'node:assert/strict'

import {
  escapeHtml,
  escapeCsvCell,
  PRINT_CSP_META,
} from '../src/utils/htmlSecurity.js'

test('print values cannot break out of HTML text or attributes', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">&'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;',
  )
  assert.equal(escapeHtml(null), '')
})

test('CSV cells beginning with formula markers are neutralised', () => {
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)")
  assert.equal(escapeCsvCell('+cmd'), "'+cmd")
  assert.equal(escapeCsvCell('-2'), "'-2")
  assert.equal(escapeCsvCell('@SUM'), "'@SUM")
})

test('CSV quoting survives commas, quotes and newlines', () => {
  assert.equal(escapeCsvCell('Chennai, TN'), '"Chennai, TN"')
  assert.equal(escapeCsvCell('a"b'), '"a""b"')
  assert.equal(escapeCsvCell('line1\nline2'), '"line1\nline2"')
})

test('print documents get a restrictive content security policy', () => {
  assert.match(PRINT_CSP_META, /default-src 'none'/)
  assert.match(PRINT_CSP_META, /form-action 'none'/)
})
