import { test, expect } from '@playwright/test'

const harnessURL = '/e2e/global-search-harness.html'
const activeId = page => page.evaluate(() => document.activeElement?.id || '')

test('form controls keep focus while GlobalSearch is mounted', async ({ page }) => {
  await page.goto(harnessURL)

  // A click outside the search widget used to move focus to its trigger.
  const name = page.locator('#entry-name')
  await name.click()
  await page.waitForTimeout(200)
  expect(await activeId(page)).toBe('entry-name')

  await page.keyboard.type('Typing works')
  await expect(name).toHaveValue('Typing works')

  // Closing an open dialog with the backdrop must also leave the next clicked
  // control focused so keyboard selection works normally.
  await page.getByRole('button', { name: 'Search records' }).click()
  const dialog = page.getByRole('dialog', { name: 'Search records' })
  await expect(dialog).toBeVisible()
  await page.getByTestId('global-search-backdrop').click({ position: { x: 5, y: 5 } })
  await expect(dialog).toBeHidden()

  const select = page.locator('#entry-select')
  await select.click()
  await page.waitForTimeout(200)
  expect(await activeId(page)).toBe('entry-select')

  await select.selectOption('two')
  await expect(select).toHaveValue('two')
  await expect(page.locator('#entry-value')).toContainText('|two')
})

test('GlobalSearch dialog opens, closes and restores focus to its trigger', async ({ page }) => {
  await page.goto(harnessURL)

  const trigger = page.getByRole('button', { name: 'Search records' })
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Search records' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByPlaceholder('Search customers, bookings, drivers, vehicles…')).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})
