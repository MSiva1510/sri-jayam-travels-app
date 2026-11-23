import { expect, test } from '@playwright/test'

const URL = '/e2e/fleet-page-harness.html'

test('real Fleet page renders the full workspace at desktop and mobile', async ({ page }) => {
  for (const width of [1280, 390]) {
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
