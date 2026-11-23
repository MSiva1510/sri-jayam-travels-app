import { expect, test } from '@playwright/test'

const harnessURL = query => `/e2e/trips-harness.html${query ? `?${query}` : ''}`

test('dashboard create-trip handoff opens the new booking modal', async ({ page }) => {
  await page.goto(harnessURL('openCreate=1'))

  const dialog = page.getByRole('dialog', { name: 'Create Booking' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('New Booking', { exact: true })).toBeVisible()
  await expect(page.locator('#nav-state')).toHaveText('')

  await dialog.getByRole('button', { name: 'Close booking form' }).click()
  await expect(dialog).toHaveCount(0)
})

test('trips page still opens the modal from its own button', async ({ page }) => {
  await page.goto(harnessURL())

  const dialog = page.getByRole('dialog', { name: 'Create Booking' })
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'New Booking' }).click()
  await expect(dialog).toBeVisible()
})
