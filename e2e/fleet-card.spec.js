import { expect, test } from '@playwright/test'

const URL = '/e2e/fleet-card-harness.html'
const actions = (page, key) => page.evaluate(name => window.__fleetCardHarness[name], key)

// The card uses a transparent overlay button as its hit target, so a real
// click lands on that button rather than the text element under the pointer.
const clickCardArea = async (page, locator) => {
  const box = await locator.boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

test.beforeEach(async ({ page }) => {
  await page.goto(URL)
  await expect(page.getByText('PY01CY1255')).toBeVisible()
})

test('clicking the vehicle card centers it on the map without opening details', async ({ page }) => {
  const card = page.locator('#fleet-card')

  await clickCardArea(page, card.getByText('PY01CY1255'))
  await expect.poll(() => actions(page, 'locates')).toEqual(['PY01CY1255'])
  expect(await actions(page, 'views')).toEqual([])

  await clickCardArea(page, card.getByText('Driver: Unassigned'))
  expect(await actions(page, 'locates')).toEqual(['PY01CY1255', 'PY01CY1255'])
  expect(await actions(page, 'views')).toEqual([])
})

test('card action buttons keep their own behavior', async ({ page }) => {
  const card = page.locator('#fleet-card')

  await card.getByRole('button', { name: 'View details' }).click()
  expect(await actions(page, 'views')).toEqual(['PY01CY1255'])
  expect(await actions(page, 'locates')).toEqual([])

  await card.getByRole('button', { name: 'Locate on map' }).click()
  expect(await actions(page, 'locates')).toEqual(['PY01CY1255'])
  expect(await actions(page, 'views')).toEqual(['PY01CY1255'])
})

test('card locate action is reachable by keyboard', async ({ page }) => {
  const locate = page.getByRole('button', { name: 'Locate PY01CY1255 on map' })
  await locate.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => actions(page, 'locates')).toEqual(['PY01CY1255'])
})
