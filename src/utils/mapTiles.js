// ─── Open-source basemaps (no API key) ──────────────────────────
//
// The live map used to load OpenFreeMap *vector* styles. A vector style is
// all-or-nothing (style JSON + glyphs + sprites must all arrive), and the
// old code flipped to its fallback on *any* map error — even one flaky
// tile — which is how the fleet panel ended up blank with only the
// attribution showing.
//
// Raster tiles fail per-tile instead, so we use keyless CARTO raster tiles
// with a real theme per mode (no CSS invert hacks):
//   light → CARTO "voyager"   ·  dark → CARTO "dark_all"
//   satellite → keyless Esri World Imagery
//   last resort → OSM standard raster
// Attribution "© OpenStreetMap contributors © CARTO" is required and is
// already allow-listed in the Netlify CSP (img-src / connect-src).

export const MAP_ATTRIBUTION = '© OpenStreetMap contributors © CARTO'

export const LEAFLET_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>'

export const CARTO_LIGHT_VARIANT = 'rastertiles/voyager'
export const CARTO_DARK_VARIANT = 'dark_all'

const CARTO_SUBDOMAINS = ['a', 'b', 'c', 'd']

/** Explicit tile URLs per subdomain — MapLibre does not expand `{s}`. */
export function cartoRasterTiles(variant) {
  return CARTO_SUBDOMAINS.map(
    (s) => `https://${s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}.png`
  )
}

/** Leaflet expands `{s}` itself, so keep the template form here. */
export function cartoLeafletUrl(dark) {
  const variant = dark ? CARTO_DARK_VARIANT : CARTO_LIGHT_VARIANT
  return `https://{s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}.png`
}

export const CARTO_LEAFLET_SUBDOMAINS = 'abcd'

function rasterStyle(tiles, attribution) {
  return {
    version: 8,
    sources: {
      basemap: { type: 'raster', tiles, tileSize: 256, maxzoom: 20, attribution },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
  }
}

/** MapLibre style object for the street map in the current theme. */
export function streetStyle(dark) {
  return rasterStyle(
    cartoRasterTiles(dark ? CARTO_DARK_VARIANT : CARTO_LIGHT_VARIANT),
    MAP_ATTRIBUTION
  )
}

/** Keyless satellite imagery (unchanged, theme-independent). */
export function satelliteStyle() {
  return rasterStyle(
    [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    'Imagery © Esri'
  )
}

/** Last-resort fallback when the themed style never finishes loading. */
export function osmFallbackStyle() {
  return rasterStyle(
    ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    '© OpenStreetMap contributors'
  )
}
