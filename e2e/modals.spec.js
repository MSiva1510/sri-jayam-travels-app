import { test, expect } from '@playwright/test'

const harnessURL = query => `/e2e/modal-harness.html${query ? `?${query}` : ''}`

const waitForClose = page => expect.poll(
  () => page.evaluate(() => window.__modalHarness?.closes.length ?? 0)
).toBe(1)

const getSave = page => page.evaluate(() => window.__modalHarness.saves[0])

const expectHorizontallyCentered = (page, box) => {
  const viewport = page.viewportSize()
  const dialogCenter = box.x + box.width / 2
  expect(Math.abs(dialogCenter - viewport.width / 2)).toBeLessThan(2)
}

test('customer modal: desktop layout, sections, validation and save payload', async ({ page }) => {
  await page.goto(harnessURL('modal=customer'))
  await expect(page.locator('#harness-status')).toContainText('Harness ready')

  const dialog = page.getByRole('dialog', { name: 'New Customer' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Customer Management')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Customer information', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Address', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Preferences & Flags', exact: true })).toBeVisible()

  const box = await dialog.boundingBox()
  expect(box.width).toBeGreaterThanOrEqual(650)
  expect(box.width).toBeLessThanOrEqual(720)
  expect(box.height).toBeLessThanOrEqual(900)
  expectHorizontallyCentered(page, box)

  // Header and footer remain visible while the form body scrolls.
  await dialog.locator('div.overflow-y-auto').evaluate(el => { el.scrollTop = el.scrollHeight })
  await expect(dialog.getByRole('button', { name: 'Close customer form' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Create Customer' })).toBeVisible()

  await dialog.locator('#cus-name').fill('Test Customer')
  await dialog.locator('#cus-mobile').fill('9876543210')
  await dialog.getByRole('radio', { name: 'Corporate' }).click()
  await expect(dialog.getByText('Corporate Details')).toBeVisible()
  await dialog.locator('#cus-companyName').fill('Bright Travels LLP')

  page.once('dialog', confirmation => confirmation.accept())
  await dialog.locator('label').filter({ hasText: 'Blacklisted' }).click()

  await dialog.getByRole('button', { name: 'Create Customer' }).click()
  await expect.poll(() => page.evaluate(() => window.__modalHarness.saves.length)).toBe(1)
  await waitForClose(page)

  const payload = await getSave(page)
  expect(payload).toMatchObject({
    name: 'Test Customer',
    mobile: '9876543210',
    type: 'corporate',
    companyName: 'Bright Travels LLP',
    isBlacklisted: true,
  })
  expect(payload.id).toMatch(/^CUS-/)
})

test('customer modal: mobile full-screen sheet, dark theme and Escape close', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(harnessURL('modal=customer&theme=dark'))

  const dialog = page.getByRole('dialog', { name: 'New Customer' })
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box.width).toBeGreaterThanOrEqual(385)
  expect(box.width).toBeLessThanOrEqual(395)
  expect(box.height).toBeGreaterThanOrEqual(840)
  expect(box.height).toBeLessThanOrEqual(850)
  expectHorizontallyCentered(page, box)

  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
  const surface = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ap-surface').trim()
  )
  expect(surface).toBe('#121a26')

  await page.keyboard.press('Escape')
  await waitForClose(page)
  await expect(dialog).toHaveCount(0)
})

test('customer modal: edit flow keeps the existing customer id', async ({ page }) => {
  await page.goto(harnessURL('modal=customer&mode=edit'))

  const dialog = page.getByRole('dialog', { name: 'Edit Customer' })
  await expect(dialog).toBeVisible()
  expectHorizontallyCentered(page, await dialog.boundingBox())
  await expect(dialog.locator('#cus-name')).toHaveValue('Asha Traders')
  await expect(dialog.getByRole('radio', { name: 'Corporate' })).toHaveAttribute('aria-checked', 'true')

  await dialog.locator('#cus-city').fill('Coimbatore')
  await dialog.getByRole('button', { name: 'Update Customer' }).click()
  await expect.poll(() => page.evaluate(() => window.__modalHarness.saves.length)).toBe(1)
  await waitForClose(page)

  const payload = await getSave(page)
  expect(payload).toMatchObject({ id: 'CUS-1001', name: 'Asha Traders', city: 'Coimbatore' })
})

test('expense modal: desktop layout, categories, dropdowns, receipt and save payload', async ({ page }) => {
  await page.goto(harnessURL('modal=expense'))

  const dialog = page.getByRole('dialog', { name: 'New Expense' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Expense Management')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Expense Details', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Trip & Vehicle', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Receipt Upload', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible()

  const box = await dialog.boundingBox()
  expect(box.width).toBeGreaterThanOrEqual(850)
  expect(box.width).toBeLessThanOrEqual(950)
  expectHorizontallyCentered(page, box)

  const typeValues = await dialog.locator('#exp-type option').evaluateAll(
    options => options.map(option => option.value).filter(Boolean)
  )
  expect(typeValues).toEqual([
    'fuel', 'toll', 'parking', 'bata', 'food',
    'maintenance', 'repair', 'permit', 'insurance', 'misc',
  ])

  const dropdowns = dialog.locator('button[aria-haspopup="listbox"]')
  await dropdowns.nth(0).click()
  await dialog.locator('input[role="combobox"]').fill('Ravi')
  await dialog.getByRole('option', { name: /Ravi Kumar/ }).click()
  await expect(dropdowns.nth(0)).toContainText('Ravi Kumar')

  await dropdowns.nth(1).click()
  await dialog.locator('input[role="combobox"]').fill('TN01')
  await dialog.getByRole('option', { name: /TN01AB1234/ }).click()
  await expect(dropdowns.nth(1)).toContainText('TN01AB1234')

  await dialog.locator('#exp-type').selectOption('parking')
  await expect(dialog.getByText('Parking Details')).toBeVisible()
  await dialog.locator('#exp-amount').fill('120')
  await dialog.locator('#exp-description').fill('Airport parking')
  await dialog.locator('#exp-parkingLocation').fill('Chennai Airport')
  await dialog.locator('#exp-parkingDuration').fill('3.5')

  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake png payload'),
  })
  await expect(dialog.getByText('receipt.png')).toBeVisible()

  await dialog.getByRole('button', { name: 'Add Expense' }).click()
  await expect.poll(() => page.evaluate(() => window.__modalHarness.saves.length)).toBe(1)
  await waitForClose(page)

  const payload = await getSave(page)
  expect(payload).toMatchObject({
    type: 'parking',
    amount: 120,
    description: 'Airport parking',
    parkingLocation: 'Chennai Airport',
    parkingDuration: '3.5',
    driver: 'Ravi Kumar',
    vehicle: 'TN01AB1234',
    receiptName: 'receipt.png',
    status: 'pending',
  })
  expect(payload.id).toMatch(/^EXP-/)
  expect(payload.expenseNo).toMatch(/^EXP-\d{4}-\d{4}$/)
  expect(await page.evaluate(() => window.__modalHarness.uploads)).toEqual([
    { name: 'receipt.png', size: 16, type: 'image/png' },
  ])
})

test('expense modal: every expense type shows the correct conditional panel', async ({ page }) => {
  await page.goto(harnessURL('modal=expense'))
  const dialog = page.getByRole('dialog', { name: 'New Expense' })

  const panels = {
    fuel: 'Fuel Information',
    parking: 'Parking Details',
    toll: 'Toll Details',
    bata: 'Driver Bata Details',
    maintenance: 'Maintenance Details',
  }

  for (const [type, title] of Object.entries(panels)) {
    await dialog.locator('#exp-type').selectOption(type)
    await expect(dialog.getByText(title, { exact: true })).toBeVisible()
  }

  for (const type of ['food', 'repair', 'permit', 'insurance', 'misc']) {
    await dialog.locator('#exp-type').selectOption(type)
    for (const title of Object.values(panels)) {
      await expect(dialog.getByText(title, { exact: true })).toHaveCount(0)
    }
  }
})

test('expense modal: edit flow keeps expense number and saved values', async ({ page }) => {
  await page.goto(harnessURL('modal=expense&mode=edit'))

  const dialog = page.getByRole('dialog', { name: 'EXP-2611-0007' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('#exp-amount')).toHaveValue('250')
  await expect(dialog.getByText('Toll Details')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Save Changes' })).toBeVisible()

  await dialog.locator('#exp-amount').fill('300')
  await dialog.locator('#exp-tollName').fill('New Toll Plaza')
  await dialog.getByRole('button', { name: 'Save Changes' }).click()
  await expect.poll(() => page.evaluate(() => window.__modalHarness.saves.length)).toBe(1)
  await waitForClose(page)

  const payload = await getSave(page)
  expect(payload).toMatchObject({
    id: 'expense-1001',
    expenseNo: 'EXP-2611-0007',
    amount: 300,
    tollName: 'New Toll Plaza',
  })
})

test('expense modal: mobile full-screen sheet, dark theme and driver restrictions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(harnessURL('modal=expense&theme=dark&driver=1'))

  const dialog = page.getByRole('dialog', { name: 'New Expense' })
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box.width).toBeGreaterThanOrEqual(385)
  expect(box.width).toBeLessThanOrEqual(395)
  expect(box.height).toBeGreaterThanOrEqual(840)
  expect(box.height).toBeLessThanOrEqual(850)

  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
  const typeValues = await dialog.locator('#exp-type option').evaluateAll(
    options => options.map(option => option.value).filter(Boolean)
  )
  expect(typeValues).toEqual(['toll', 'parking', 'bata', 'food'])
  await expect(dialog.locator('#exp-status')).toHaveCount(0)
  await expect(dialog.locator('#exp-driver')).toHaveValue('Office Staff')
  await expect(dialog.getByRole('button', { name: 'Submit Expense' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await waitForClose(page)
  await expect(dialog).toHaveCount(0)
})
