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

const selectExpenseType = async (dialog, label) => {
  await dialog.locator('#exp-type').click()
  await dialog.getByRole('option', { name: label, exact: true }).click()
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

  await dialog.locator('#exp-type').click()
  const typeOptions = dialog.locator('#exp-type-listbox [role="option"]')
  await expect(typeOptions).toHaveCount(10)
  const typeLabels = await typeOptions.evaluateAll(
    options => options.map(option => option.textContent.trim())
  )
  expect(typeLabels).toEqual([
    'Fuel', 'Toll', 'Parking', 'Driver Bata', 'Food',
    'Maintenance', 'Repair', 'Permit', 'Insurance', 'Miscellaneous',
  ])
  const typeIconCount = await typeOptions.evaluateAll(
    options => options.filter(option => option.querySelector('svg')).length
  )
  expect(typeIconCount).toBe(10)
  await dialog.getByRole('option', { name: 'Fuel' }).click()
  await expect(dialog.locator('#exp-type > span > svg')).toBeVisible()

  const dropdowns = dialog.locator('button[aria-haspopup="listbox"]')
  await dropdowns.nth(1).click()
  await dialog.locator('input[role="combobox"]').fill('Ravi')
  await dialog.getByRole('option', { name: /Ravi Kumar/ }).click()
  await expect(dropdowns.nth(1)).toContainText('Ravi Kumar')

  await dropdowns.nth(2).click()
  await dialog.locator('input[role="combobox"]').fill('TN01')
  await dialog.getByRole('option', { name: /TN01AB1234/ }).click()
  await expect(dropdowns.nth(2)).toContainText('TN01AB1234')

  await dialog.locator('#exp-type').click()
  await dialog.getByRole('option', { name: 'Parking' }).click()
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
    fuel: ['Fuel', 'Fuel Information'],
    parking: ['Parking', 'Parking Details'],
    toll: ['Toll', 'Toll Details'],
    bata: ['Driver Bata', 'Driver Bata Details'],
    maintenance: ['Maintenance', 'Maintenance Details'],
  }

  for (const [label, title] of Object.values(panels)) {
    await selectExpenseType(dialog, label)
    await expect(dialog.getByText(title, { exact: true })).toBeVisible()
  }

  for (const label of ['Food', 'Repair', 'Permit', 'Insurance', 'Miscellaneous']) {
    await selectExpenseType(dialog, label)
    for (const [, title] of Object.values(panels)) {
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
  await dialog.locator('#exp-type').click()
  const typeLabels = await dialog.locator('#exp-type-listbox [role="option"]').evaluateAll(
    options => options.map(option => option.textContent.trim())
  )
  expect(typeLabels).toEqual(['Toll', 'Parking', 'Driver Bata', 'Food'])
  await page.keyboard.press('Escape')
  await expect(dialog.locator('#exp-status')).toHaveCount(0)
  await expect(dialog.locator('#exp-driver')).toHaveValue('Office Staff')
  await expect(dialog.getByRole('button', { name: 'Submit Expense' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await waitForClose(page)
  await expect(dialog).toHaveCount(0)
})

test('driver modal: desktop layout, sections, validation and save payload', async ({ page }) => {
  await page.goto(harnessURL('modal=driver'))

  const dialog = page.getByRole('dialog', { name: 'New Driver' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Driver Management')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Personal Information', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Driver Login', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Bank Details', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Emergency Contact', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Driving Licence', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible()

  const box = await dialog.boundingBox()
  expect(box.width).toBeGreaterThanOrEqual(850)
  expect(box.width).toBeLessThanOrEqual(950)
  expectHorizontallyCentered(page, box)

  // Header and footer stay pinned while the form body scrolls.
  await dialog.locator('div.overflow-y-auto').evaluate(el => { el.scrollTop = el.scrollHeight })
  await expect(dialog.getByRole('button', { name: 'Close driver form' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add Driver' })).toBeVisible()

  // Submit stays disabled until the required fields are filled.
  const submit = dialog.getByRole('button', { name: 'Add Driver' })
  await expect(submit).toBeDisabled()

  await dialog.locator('#drv-name').fill('Ravi Kumar')
  await dialog.locator('#drv-mobile').fill('9000000001')
  await expect(dialog.getByText('10/10')).toBeVisible()
  await dialog.locator('#drv-license').fill('TN1234567890')

  // Login fields show only while the toggle is on.
  await expect(dialog.locator('#drv-email')).toBeVisible()
  await dialog.getByRole('switch', { name: 'Create login' }).click()
  await expect(dialog.locator('#drv-email')).toHaveCount(0)
  await expect(dialog.locator('#drv-password')).toHaveCount(0)
  await expect(submit).toBeEnabled()

  // Licence upload rejects non-image/PDF, then accepts an image.
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('nope'),
  })
  await expect(dialog.getByText('Only image or PDF files are allowed.')).toBeVisible()

  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'licence.png', mimeType: 'image/png', buffer: Buffer.from('fake png payload'),
  })
  await expect(dialog.getByText('licence.png')).toBeVisible()
  await expect(dialog.getByText('16 B · Image')).toBeVisible()

  await dialog.locator('#drv-notes').fill('Weekend shifts only')
  await submit.click()
  await expect.poll(() => page.evaluate(() => window.__modalHarness.saves.length)).toBe(1)
  await waitForClose(page)

  const payload = await getSave(page)
  expect(payload).toMatchObject({
    name: 'Ravi Kumar',
    mobile: '9000000001',
    license: 'TN1234567890',
    notes: 'Weekend shifts only',
  })
  expect(payload.id).toMatch(/^DRV-/)
  expect(payload.license_photo_url).toMatch(/^data:image\/png;base64,/)
  expect(payload).not.toHaveProperty('email')
  expect(payload).not.toHaveProperty('password')
  expect(payload).not.toHaveProperty('createLogin')
})

test('driver modal: required-field messages match the original form', async ({ page }) => {
  await page.goto(harnessURL('modal=driver'))

  const dialog = page.getByRole('dialog', { name: 'New Driver' })
  await dialog.locator('#drv-name').click()
  await dialog.locator('#drv-mobile').click()
  await expect(dialog.getByText('Required', { exact: true })).toBeVisible()

  await dialog.locator('#drv-mobile').fill('12345')
  await dialog.locator('#drv-name').click()
  await expect(dialog.getByText('10 digits required')).toBeVisible()

  await dialog.locator('#drv-email').fill('not-an-email')
  await dialog.locator('#drv-name').click()
  await expect(dialog.getByText('Valid email required for login')).toBeVisible()

  await dialog.locator('#drv-password').fill('123')
  await dialog.locator('#drv-name').click()
  await expect(dialog.getByText('Min 6 characters')).toBeVisible()
})

test('driver modal: create-login path never leaks credentials into the payload', async ({ page }) => {
  await page.goto(harnessURL('modal=driver'))

  const dialog = page.getByRole('dialog', { name: 'New Driver' })
  await dialog.locator('#drv-name').fill('Suresh Babu')
  await dialog.locator('#drv-mobile').fill('9000000002')
  await dialog.locator('#drv-license').fill('TN0987654321')
  await dialog.locator('#drv-email').fill('suresh@example.com')
  await dialog.locator('#drv-password').fill('secret123')

  // Password stays masked until the eye toggle is used.
  await expect(dialog.locator('#drv-password')).toHaveAttribute('type', 'password')
  await dialog.getByRole('button', { name: 'Show password' }).click()
  await expect(dialog.locator('#drv-password')).toHaveAttribute('type', 'text')

  // Offline harness: the auth call fails, but the driver must still save.
  let alertText = ''
  page.once('dialog', alert => { alertText = alert.message(); alert.accept() })
  await dialog.getByRole('button', { name: 'Add Driver' }).click()
  await expect.poll(() => page.evaluate(() => window.__modalHarness.saves.length)).toBe(1)
  await waitForClose(page)

  expect(alertText).toContain('login creation failed')
  const payload = await getSave(page)
  expect(payload).toMatchObject({ name: 'Suresh Babu', mobile: '9000000002' })
  expect(payload).not.toHaveProperty('email')
  expect(payload).not.toHaveProperty('password')
})

test('driver modal: edit flow keeps the existing driver id and snake_case values', async ({ page }) => {
  await page.goto(harnessURL('modal=driver&mode=edit'))

  const dialog = page.getByRole('dialog', { name: 'Ravi Kumar' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('#drv-name')).toHaveValue('Ravi Kumar')
  await expect(dialog.locator('#drv-mobile')).toHaveValue('9000000001')
  await expect(dialog.locator('#drv-license')).toHaveValue('TN1234567890')
  await expect(dialog.locator('#drv-licenseExpiry')).toHaveValue('2027-05-01')
  await expect(dialog.locator('#drv-medicalExpiry')).toHaveValue('2027-01-01')
  await expect(dialog.locator('#drv-bankName')).toHaveValue('State Bank of India')
  await expect(dialog.locator('#drv-emergencyContact')).toHaveValue('9000000099')

  // Login is create-only: no toggle and no credential fields on edit.
  await expect(dialog.getByRole('switch')).toHaveCount(0)
  await expect(dialog.locator('#drv-email')).toHaveCount(0)

  await dialog.locator('#drv-vehicle').fill('TN09ZZ0009')
  await dialog.getByRole('button', { name: 'Save Changes' }).click()
  await expect.poll(() => page.evaluate(() => window.__modalHarness.saves.length)).toBe(1)
  await waitForClose(page)

  const payload = await getSave(page)
  expect(payload).toMatchObject({ id: 'driver-1', name: 'Ravi Kumar', vehicle: 'TN09ZZ0009' })
  expect(payload).not.toHaveProperty('license_photo_url')
})

test('driver modal: reset restores the initial values', async ({ page }) => {
  await page.goto(harnessURL('modal=driver'))

  const dialog = page.getByRole('dialog', { name: 'New Driver' })
  await dialog.locator('#drv-name').fill('Temp Name')
  await dialog.locator('#drv-notes').fill('temp note')
  await dialog.getByRole('button', { name: 'Reset' }).click()
  await expect(dialog.locator('#drv-name')).toHaveValue('')
  await expect(dialog.locator('#drv-notes')).toHaveValue('')
})

test('driver modal: mobile full-screen sheet, dark theme and Escape close', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(harnessURL('modal=driver&theme=dark'))

  const dialog = page.getByRole('dialog', { name: 'New Driver' })
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
