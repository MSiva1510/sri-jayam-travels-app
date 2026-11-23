import { expect, test } from '@playwright/test'

const URL = '/e2e/fleet-page-harness.html'

test('real Fleet page renders the full workspace at desktop and mobile', async ({ page }) => {
  for (const width of [1440, 1366, 1280, 768, 412, 390, 360]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(URL)
    await expect(page.getByRole('heading', { name: 'Live Fleet', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filter vehicles: Total vehicles' })).toBeVisible()
    await expect(page.getByTestId('vehicle-panel')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  }
})

const overlaps = (a, b) => {
  if (!a || !b) return false
  return Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x)
    && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y)
}

for (const width of [360, 390]) {
  test(`fleet map controls and status strip stay separated at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(URL)
    await expect(page.getByRole('heading', { name: 'Live Fleet', exact: true })).toBeVisible()

    const snap = await page.getByRole('button', { name: 'Snap to road' }).boundingBox()
    const legend = await page.locator('div.absolute.bottom-3.left-3').boundingBox()
    expect(overlaps(snap, legend), 'snap control overlaps the map legend').toBe(false)

    const strip = page.locator('button[aria-label="Filter vehicles: Total vehicles"]').locator('..')
    const stripBox = await strip.boundingBox()
    const buttons = page.locator('button[aria-label^="Filter vehicles:"]')
    expect(await buttons.count()).toBe(4)
    for (const button of await buttons.all()) {
      const box = await button.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(stripBox.x - 1)
      expect(box.x + box.width).toBeLessThanOrEqual(stripBox.x + stripBox.width + 1)
      expect(box.y).toBeGreaterThanOrEqual(stripBox.y - 1)
      expect(box.y + box.height).toBeLessThanOrEqual(stripBox.y + stripBox.height + 1)
    }
  })
}

for (const width of [390, 1280]) {
  test(`nearby vehicles cluster, expand and keep labels readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(URL)

    const cluster = page.locator('.fleet-ml-cluster')
    await expect(cluster).toHaveCount(1)
    await expect(cluster).toContainText('3')
    await cluster.click()
    await expect(page.locator('.fleet-ml-label')).toHaveCount(3)
    await expect(page.locator('.fleet-ml-cluster')).toHaveCount(0)

    const hits = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('.fleet-ml-label')]
      const results = []
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i].getBoundingClientRect()
          const b = labels[j].getBoundingClientRect()
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (w > 2 && h > 2) results.push({ w: Math.round(w), h: Math.round(h) })
        }
      }
      return results
    })
    expect(hits, JSON.stringify(hits)).toEqual([])

    await page.locator('.fleet-ml-marker').first().click()
    const popup = page.locator('.maplibregl-popup-content')
    await expect(popup).toContainText('Swift Dzire')
    await expect(popup).toContainText('Babu')
    await expect(popup).toContainText('km/h')
  })
}

test('real Fleet page includes roster vehicles that have no GPS fix', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => {
    localStorage.setItem('sjt_vehicles', JSON.stringify([
      { id: 'v4', registration: 'PY01XY1255', model: 'Bolero', vehicle_type: 'SUV' },
    ]))
  })
  await page.goto(URL)

  await expect(page.getByRole('button', { name: 'Filter vehicles: Total vehicles' })).toContainText('4')
  await expect(page.getByRole('button', { name: 'Filter vehicles: Offline' })).toContainText('2')
  const offline = page.getByRole('button', { name: 'Locate PY01XY1255 on map' })
  await expect(offline).toBeVisible()
  const card = offline.locator('..')
  await expect(card).toContainText('No GPS data')
  await expect(card).toContainText('Speed: —')
})

test('selected vehicle GPS History hands off its registration', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(URL)
  await page.getByTestId('vehicle-panel').getByRole('button', { name: 'View details' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'GPS History', exact: true }).click()

  const stub = page.getByTestId('gps-history-stub')
  await expect(stub).toBeVisible()
  await expect(stub).toContainText('registration=PY01CY1255')
})

test('real Fleet page filters, refreshes and opens vehicle details', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(URL)
  const panel = page.getByTestId('vehicle-panel')

  await page.getByRole('button', { name: 'Filter vehicles: Offline' }).click()
  await expect(panel.getByRole('button', { name: 'Locate PY01DF1255 on map' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Locate PY01CY1255 on map' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Refresh GPS data' }).click()
  expect(await page.evaluate(() => window.__fleetPage.refreshes)).toBe(1)

  await panel.getByRole('button', { name: 'View details' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('PY01DF1255')
  await expect(dialog).toContainText('GPS connection')
  await dialog.getByRole('button', { name: 'Close vehicle details' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
