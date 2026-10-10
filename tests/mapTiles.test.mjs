// Basemap contract: keyless, theme-aware, correctly attributed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAP_ATTRIBUTION,
  LEAFLET_ATTRIBUTION,
  cartoRasterTiles,
  cartoLeafletUrl,
  CARTO_LEAFLET_SUBDOMAINS,
  streetStyle,
  satelliteStyle,
  osmFallbackStyle,
} from '../src/utils/mapTiles.js'

test('carto raster tiles cover all four subdomains with no template leftovers', () => {
  for (const tiles of [cartoRasterTiles('rastertiles/voyager'), cartoRasterTiles('dark_all')]) {
    assert.equal(tiles.length, 4)
    for (const host of ['a', 'b', 'c', 'd']) {
      assert.ok(tiles.some((t) => t.startsWith(`https://${host}.basemaps.cartocdn.com/`)), host)
    }
    for (const t of tiles) {
      assert.ok(!t.includes('{s}'), `MapLibre cannot expand {s}: ${t}`)
      assert.ok(t.includes('{z}/{x}/{y}'), t)
    }
  }
})

test('light uses voyager, dark uses dark_all', () => {
  assert.ok(cartoLeafletUrl(false).includes('rastertiles/voyager'))
  assert.ok(cartoLeafletUrl(true).includes('dark_all'))
  assert.ok(cartoLeafletUrl(false).includes('{s}'), 'Leaflet must keep {s} for its own expansion')
  assert.equal(CARTO_LEAFLET_SUBDOMAINS, 'abcd')
})

test('maplibre styles are valid raster v8 with attribution', () => {
  for (const style of [streetStyle(false), streetStyle(true), satelliteStyle(), osmFallbackStyle()]) {
    assert.equal(style.version, 8)
    assert.equal(style.sources.basemap.type, 'raster')
    assert.ok(Array.isArray(style.sources.basemap.tiles) && style.sources.basemap.tiles.length > 0)
    assert.ok(style.sources.basemap.attribution.length > 0)
    assert.deepEqual(style.layers, [{ id: 'basemap', type: 'raster', source: 'basemap' }])
  }
})

test('attribution credits both OSM and CARTO', () => {
  for (const text of [MAP_ATTRIBUTION, LEAFLET_ATTRIBUTION]) {
    assert.ok(/openstreetmap/i.test(text), text)
    assert.ok(/carto/i.test(text), text)
  }
})
