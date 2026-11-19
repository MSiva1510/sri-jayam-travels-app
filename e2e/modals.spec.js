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

// ── Vehicle modal ────────────────────────────────────────────────

const isoDay = offset => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const vehicleSection = (dialog, title) =>
  dialog.locator('section').filter({ hasText: title })

test('vehicle modal: desktop layout, sections, formatting and save payload', async ({ page }) => {
  await page.goto(harnessURL('modal=vehicle'))

  const dialog = page.getByRole('dialog', { name: 'Add Vehicle' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Fleet Management')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Vehicle Information', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Service Tracking', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Insurance Details', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Permit Details', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Fitness Certificate (FC)', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Pollution Certificate (PUC)', exact: true })).toBeVisible()

  const box = await dialog.boundingBox()
  expect(box.width).toBeGreaterThanOrEqual(850)
  expect(box.width).toBeLessThanOrEqual(950)
  expectHorizontallyCentered(page, box)

  // macOS-style geometry: 22px panel radius, 46–48px controls.
  const panelRadius = await dialog.evaluate(el => getComputedStyle(el).borderRadius)
  expect(panelRadius).toBe('22px')
  const regBox = await dialog.locator('#veh-reg').boundingBox()
  expect(regBox.height).toBeGreaterThanOrEqual(46)
  expect(regBox.height).toBeLessThanOrEqual(48)

  // Header and footer stay pinned while the form body scrolls.
  await dialog.locator('div.overflow-y-auto').evaluate(el => { el.scrollTop = el.scrollHeight })
  await expect(dialog.getByRole('button', { name: 'Close vehicle form' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add Vehicle' })).toBeVisible()

  const submit = dialog.getByRole('button', { name: 'Add Vehicle' })
  await expect(submit).toBeDisabled()

  // Registration is uppercased and stripped of separators; model is required too.
  await dialog.locator('#veh-reg').fill('py 01-ab!1234extra')
  await expect(dialog.locator('#veh-reg')).toHaveValue('PY01AB1234EX')
  await expect(submit).toBeDisabled()

  await dialog.locator('#veh-model').fill('Innova Crysta')
  await expect(submit).toBeEnabled()

  await expect(dialog.locator('#veh-year')).toHaveValue(String(new Date().getFullYear()))
  await dialog.locator('#veh-year').fill('2022')
  await dialog.locator('#veh-type').selectOption('7+1 SUV')
  await dialog.locator('#veh-km').fill('150734')
  await dialog.locator('#veh-fuelType').selectOption('Diesel')
  await dialog.locator('#veh-color').fill('Silver')
  await dialog.locator('#veh-status').selectOption('maintenance')

  // Service Tracking: numeric-only odometers and an overdue indicator.
  await dialog.locator('#veh-lastServiceDate').fill('2026-09-01')
  await dialog.locator('#veh-lastServiceKm').fill('145000')
  await dialog.locator('#veh-nextServiceDate').fill(isoDay(-5))
  await dialog.locator('#veh-nextServiceKm').fill('155000')
  await expect(vehicleSection(dialog, 'Service Tracking').getByText(/Service due/)).toBeVisible()

  // Documents: numbers are uppercased, expiry chips derive from the dates.
  await dialog.locator('#veh-insProvider').fill('TATA AIG')
  await dialog.locator('#veh-insNumber').fill('tata/aig-1234')
  await expect(dialog.locator('#veh-insNumber')).toHaveValue('TATA/AIG-1234')
  await dialog.locator('#veh-insExpiry').fill(isoDay(120))
  await expect(vehicleSection(dialog, 'Insurance Details').getByText('Valid')).toBeVisible()

  await dialog.locator('#veh-permitNumber').fill('kl/permit/0099')
  await dialog.locator('#veh-permitExpiry').fill(isoDay(12))
  await expect(vehicleSection(dialog, 'Permit Details').getByText(/Expiring Soon/)).toBeVisible()

  await dialog.locator('#veh-fcNumber').fill('fc-7788')
  await dialog.locator('#veh-fcExpiry').fill(isoDay(-4))
  await expect(vehicleSection(dialog, 'Fitness Certificate (FC)').getByText(/Expired/)).toBeVisible()

  await dialog.locator('#veh-pucNumber').fill('puc-4455')
  // No PUC expiry yet: the section must not invent a status.
  await expect(vehicleSection(dialog, 'Pollution Certificate (PUC)').getByText(/Valid|Expired|Expiring/)).toHaveCount(0)

  await submit.click()
  await expect.poll(() => page.evaluate(() => window.__modalHarness.saves.length)).toBe(1)
  await waitForClose(page)

  const payload = await getSave(page)
  expect(payload.id).toMatch(/^VEH-/)
  expect(payload).toMatchObject({
    reg: 'PY01AB1234EX',
    type: '7+1 SUV',
    model: 'Innova Crysta',
    year: '2022',
    km: '150734',
    fuelType: 'Diesel',
    color: 'Silver',
    status: 'maintenance',
    lastServiceDate: '2026-09-01',
    lastServiceKm: '145000',
    nextServiceDate: isoDay(-5),
    nextServiceKm: '155000',
    insProvider: 'TATA AIG',
    insNumber: 'TATA/AIG-1234',
    insExpiry: isoDay(120),
    permitNumber: 'KL/PERMIT/0099',
    permitExpiry: isoDay(12),
    fcNumber: 'FC-7788',
    fcExpiry: isoDay(-4),
    pucNumber: 'PUC-4455',
  })
  expect(payload.pucExpiry).toBe('')
})

test('vehicle modal: required messages and submit guard', async ({ page }) => {
  await page.goto(harnessURL('modal=vehicle'))

  const dialog = page.getByRole('dialog', { name: 'Add Vehicle' })
  const submit = dialog.getByRole('button', { name: 'Add Vehicle' })
  await expect(submit).toBeDisabled()

  await dialog.locator('#veh-reg').click()
  await dialog.locator('#veh-model').click()
  await expect(dialog.getByText('Required', { exact: true })).toHaveCount(1)
  await dialog.locator('#veh-reg').click()
  await expect(dialog.getByText('Required', { exact: true })).toHaveCount(2)

  await dialog.locator('#veh-reg').fill('PY01AB1234')
  await expect(dialog.getByText('Required', { exact: true })).toHaveCount(1)
  await expect(submit).toBeDisabled()

  await dialog.locator('#veh-model').fill('Dzire')
  await expect(dialog.getByText('Required', { exact: true })).toHaveCount(0)
  await expect(submit).toBeEnabled()

  // Cancel goes through the shared close animation.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await waitForClose(page)
  await expect(dialog).toHaveCount(0)
})

test('vehicle modal: edit flow keeps the existing vehicle id and snake_case values', async ({ page }) => {
  await page.goto(harnessURL('modal=vehicle&mode=edit'))

  const dialog = page.getByRole('dialog', { name: 'Edit Vehicle' })
  await expect(dialog).toBeVisible()

  await expect(dialog.locator('#veh-reg')).toHaveValue('PY01CY1255')
  await expect(dialog.locator('#veh-type')).toHaveValue('7+1 SUV')
  await expect(dialog.locator('#veh-model')).toHaveValue('Innova Crysta')
  await expect(dialog.locator('#veh-year')).toHaveValue('2022')
  await expect(dialog.locator('#veh-km')).toHaveValue('150734')
  await expect(dialog.locator('#veh-fuelType')).toHaveValue('Diesel')
  await expect(dialog.locator('#veh-color')).toHaveValue('Silver')
  await expect(dialog.locator('#veh-status')).toHaveValue('active')
  await expect(dialog.locator('#veh-insNumber')).toHaveValue('TATA-AIG-PY01CY1255')
  const dates = await page.evaluate(() => window.__modalHarness.vehicleDates)
  await expect(dialog.locator('#veh-insExpiry')).toHaveValue(dates.insExpiry)
  await expect(dialog.locator('#veh-fcExpiry')).toHaveValue(dates.fcExpiry)
  await expect(dialog.locator('#veh-pucExpiry')).toHaveValue(dates.pucExpiry)
  await expect(dialog.locator('#veh-lastServiceKm')).toHaveValue('145000')
  await expect(dialog.locator('#veh-nextServiceDate')).toHaveValue(dates.nextServiceDate)

  // Read-only indicators come from the saved dates.
  await expect(vehicleSection(dialog, 'Insurance Details').getByText('Valid')).toBeVisible()
  await expect(vehicleSection(dialog, 'Service Tracking').getByText(/Due in \d+d/)).toBeVisible()

  await dialog.locator('#veh-model').fill('Innova Hycross')
  await dialog.getByRole('button', { name: 'Save Changes' }).click()
  await expect.poll(() => page.evaluate(() => window.__modalHarness.saves.length)).toBe(1)
  await waitForClose(page)

  const payload = await getSave(page)
  expect(payload).toMatchObject({
    id: 'vehicle-1',
    reg: 'PY01CY1255',
    model: 'Innova Hycross',
    type: '7+1 SUV',
    km: 150734,
  })
})

test('vehicle modal: mobile full-screen sheet, dark theme and Escape close', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(harnessURL('modal=vehicle&theme=dark'))

  const dialog = page.getByRole('dialog', { name: 'Add Vehicle' })
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

  // Inputs stack to a single column on mobile and nothing overflows.
  const regBox = await dialog.locator('#veh-reg').boundingBox()
  const modelBox = await dialog.locator('#veh-model').boundingBox()
  expect(modelBox.y).toBeGreaterThan(regBox.y + regBox.height)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)

  await page.keyboard.press('Escape')
  await waitForClose(page)
  await expect(dialog).toHaveCount(0)
})
