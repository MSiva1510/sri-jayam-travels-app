import { expect, test } from '@playwright/test'

const URL = '/e2e/fleet-workspace-harness.html'
const actions = (page, key) => page.evaluate(name => window.__fleetWorkspace[name], key)

for (const width of [1440, 1366, 1280, 1024, 768, 430, 412, 390, 360]) {
  test(`fleet workspace has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(URL)
    await expect(page.getByTestId('map-area')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
}

test('status strip and search filter the vehicle panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(URL)
  const panel = page.getByTestId('vehicle-panel')

  await expect(panel.getByRole('button', { name: 'Locate PY01CY1255 on map' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Locate PY01VF1255 on map' })).toBeVisible()

  const moving = page.getByRole('button', { name: 'Filter vehicles: Moving' })
  await moving.click()
  await expect(moving).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByRole('button', { name: 'Locate PY01CY1255 on map' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Locate PY01VF1255 on map' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Clear vehicle filters' }).click()
  await expect(panel.getByRole('button', { name: 'Locate PY01VF1255 on map' })).toBeVisible()

  await page.getByLabel('Search vehicles').fill('Etios')
  await expect(panel.getByRole('button', { name: 'Locate PY01VF1255 on map' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Locate PY01CY1255 on map' })).toHaveCount(0)
})

test('vehicle detail drawer exposes real actions and keyboard close', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(URL)

  await page.getByTestId('vehicle-panel').getByRole('button', { name: 'View details' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Current status')
  await expect(dialog).toContainText('GPS connection')

  await dialog.getByRole('button', { name: 'GPS History' }).click()
  expect(await actions(page, 'history')).toBe(1)

  await dialog.getByRole('button', { name: 'Locate on Map' }).click()
  expect((await actions(page, 'locate')).length).toBe(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByTestId('vehicle-panel').getByRole('button', { name: 'View details' }).first().click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('header refresh and map fullscreen perform real actions', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(URL)

  await page.getByRole('button', { name: 'Refresh GPS data' }).click()
  expect(await actions(page, 'refresh')).toBe(1)

  const fullscreen = page.getByRole('button', { name: 'Fullscreen map' })
  await fullscreen.click()
  expect(await actions(page, 'fullscreen')).toBe(1)
  await expect(page.getByTestId('vehicle-panel')).toHaveCount(0)
  await page.getByRole('button', { name: 'Exit map focus' }).click()
  await expect(page.getByTestId('vehicle-panel')).toBeVisible()
})

test('dark theme preserves layout without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(URL)
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByTestId('map-area')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
