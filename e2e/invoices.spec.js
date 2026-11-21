import { expect, test } from '@playwright/test'

const URL = '/e2e/invoice-harness.html'
const UUID = '5f2c1a90-1d2e-4f3a-9b11-0c22d4e6a701'
const DATE = '2026-11-21'

const go = (page, query = '') => page.goto(`${URL}${query}`)
const state = (page, key) => page.evaluate(name => window.__invoiceHarness[name], key)
const token = page => page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--ap-surface-2').trim())

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    rootScroll: document.getElementById('harness-root').scrollWidth,
    rootClient: document.getElementById('harness-root').clientWidth,
  }))
  expect(metrics.docScroll, `document scrollWidth ${metrics.docScroll} > clientWidth ${metrics.docClient}`)
    .toBeLessThanOrEqual(metrics.docClient + 1)
  expect(metrics.rootScroll, `harness scrollWidth ${metrics.rootScroll} > clientWidth ${metrics.rootClient}`)
    .toBeLessThanOrEqual(metrics.rootClient + 1)
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('chooser exposes three explicit paths, records every choice and follows the dark theme', async ({ page }) => {
  await go(page, '?view=chooser')
  await expect(page.locator('#harness-status')).toHaveText('Harness ready')

  const chooser = page.getByRole('dialog', { name: 'Create a new invoice' })
  await expect(chooser).toBeVisible()
  for (const name of ['Existing Booking', 'Manual Invoice', 'Quotation']) {
    await expect(chooser.getByRole('button', { name })).toBeVisible()
  }

  const lightToken = await token(page)
  await page.locator('#theme-toggle').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await token(page)).not.toBe(lightToken)

  const cases = [
    ['Manual Invoice', 'manual'],
    ['Quotation', 'quotation'],
    ['Existing Booking', 'booking'],
  ]
  const expected = []
  for (const [index, [label, key]] of cases.entries()) {
    if (index > 0) {
      await page.evaluate(() => window.__invoiceHarness.show('chooser'))
      const dialog = page.getByRole('dialog', { name: 'Create a new invoice' })
      await expect(dialog).toBeVisible()
    }
    const dialog = page.getByRole('dialog', { name: 'Create a new invoice' })
    await dialog.getByRole('button', { name: label }).click()
    expected.push(key)
    await expect.poll(() => state(page, 'choices')).toEqual(expected)
  }
})

test('booking picker tabs and search cover customer, booking ID, reference and route', async ({ page }) => {
  await go(page, '?view=bookings')
  const dialog = page.getByRole('dialog', { name: 'Select booking to invoice' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio', { name: 'Completed (3)' })).toBeChecked()
  await expect(dialog.getByRole('radio', { name: 'New / Ongoing (1)' })).toBeVisible()

  const search = dialog.getByRole('textbox', { name: 'Search bookings' })
  const cases = [
    ['Anand', 'Anand Travels', 'Meera Nair'],
    ['BK-2026-012', 'Meera Nair', 'Anand Travels'],
    ['REF-7781', 'Anand Travels', 'Meera Nair'],
    ['Tiruppur', 'Anand Travels', 'Meera Nair'],
  ]
  for (const [query, visible, hidden] of cases) {
    await search.fill(query)
    await expect(dialog.getByText(visible, { exact: true })).toBeVisible()
    await expect(dialog.getByText(hidden, { exact: true })).toHaveCount(0)
  }
  await search.fill('')

  await dialog.getByRole('radio', { name: 'New / Ongoing (1)' }).click()
  await expect(dialog.getByText('Raj Tours', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Anand Travels', { exact: true })).toHaveCount(0)
  // Cancelled trips never reach the picker, even on the New/Ongoing tab.
  await expect(dialog.getByText('Blue Lines Ltd', { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Cancelled' })).toHaveCount(0)
})

test('booking picker filters, blocked rows, address expansion and invoice hand-off work', async ({ page }) => {
  await go(page, '?view=bookings')
  const dialog = page.getByRole('dialog', { name: 'Select booking to invoice' })

  await dialog.getByLabel('Filter by trip date').fill('2026-11-20')
  await expect(dialog.getByText('Meera Nair', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Anand Travels', { exact: true })).toHaveCount(0)
  await dialog.getByLabel('Filter by trip date').fill('')

  await dialog.getByLabel('Filter by driver').selectOption('Ravi Kumar')
  await expect(dialog.getByText('Anand Travels', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Meera Nair', { exact: true })).toHaveCount(0)
  await dialog.getByLabel('Filter by driver').selectOption('')

  await dialog.getByLabel('Filter by vehicle').selectOption('TN 37 CD 5678')
  await expect(dialog.getByText('Meera Nair', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Anand Travels', { exact: true })).toHaveCount(0)
  await dialog.getByLabel('Filter by vehicle').selectOption('')

  await dialog.getByRole('radio', { name: 'New / Ongoing (1)' }).click()
  await dialog.getByLabel('Filter by status').selectOption('confirmed')
  await expect(dialog.getByText('Raj Tours', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Not completed' })).toBeDisabled()
  await expect(dialog.getByText('Blue Lines Ltd', { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Cancelled' })).toHaveCount(0)
  await dialog.getByLabel('Filter by status').selectOption('')

  await dialog.getByRole('radio', { name: 'Completed (3)' }).click()
  const invoicedRow = dialog.getByText('Kavya', { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-[16px]")][1]')
  const viewInvoice = invoicedRow.getByRole('button', { name: 'View invoice' })
  await expect(viewInvoice).toBeVisible()
  await expect(invoicedRow).toContainText('Kavya')
  await expect(invoicedRow.getByText('Invoiced', { exact: true })).toBeVisible()
  await expect(invoicedRow.getByRole('button', { name: /Create invoice|Cancelled|Not completed/ })).toHaveCount(0)
  await expect(dialog.getByText('Blue Lines Ltd', { exact: true })).toHaveCount(0)
  await viewInvoice.click()
  await expect.poll(() => state(page, 'opens')).toHaveLength(1)

  await page.evaluate(() => window.__invoiceHarness.show('bookings'))
  const picker = page.getByRole('dialog', { name: 'Select booking to invoice' })
  expect(await picker.innerText()).toContain('…')
  await picker.getByRole('button', { name: 'Show full addresses' }).first().click()
  await expect(picker.getByText('From: No 14 Subburaya Pillai Street Ariyakuppam Puducherry')).toBeVisible()

  const create = picker.getByRole('button', { name: 'Create invoice' })
  await expect(create.first()).toBeEnabled()
  await create.first().click()
  await expect.poll(() => state(page, 'selects')).toHaveLength(1)
  expect((await state(page, 'selects'))[0].id).toBe(UUID)
  await expect(page.getByRole('dialog', { name: 'Review trip invoice' })).toBeVisible()
})

test('booking editor previews the real trip total and never prints the database ID', async ({ page }) => {
  await go(page, '?view=booking-editor')
  const editor = page.getByRole('dialog', { name: 'Review trip invoice' })
  await expect(editor).toBeVisible()

  await expect(editor.locator('input[readonly]').first()).toHaveValue('Anand Travels')
  await expect(editor.locator('input[readonly]').nth(1)).toHaveValue('9876543210')
  await expect(editor.locator('input[disabled]').first()).toBeDisabled()
  await expect(editor.getByLabel('Item', { exact: true }).first()).toBeDisabled()
  await expect(editor.getByText('Rs. 4,800').first()).toBeVisible()

  const preview = editor.locator('.print-doc')
  expect(await preview.innerText()).not.toContain(UUID)

  await editor.getByRole('button', { name: 'Issue Invoice' }).click()
  await expect.poll(() => state(page, 'submits')).toHaveLength(1)
  const [submitted] = await state(page, 'submits')
  expect(submitted.doc.total).toBe(4800)
  expect(submitted.doc.lineItems.map(item => item.description))
    .toEqual(['Trip Fare', 'Toll Charges', 'Driver Bata', 'Parking'])
  expect(submitted.doc.fare).toBe(4200)
  expect(submitted.doc.toll).toBe(180)
  expect(submitted.doc.parking).toBe(120)
  expect(submitted.invoice.total).toBe(4800)
  expect(submitted.doc.docType).toBe('invoice')
})

test('manual editor adds and removes line items, prefills customers and saves a manual payload', async ({ page }) => {
  await go(page, '?view=editor')
  const editor = page.getByRole('dialog', { name: 'Create manual invoice' })
  await expect(editor).toBeVisible()
  await expect(editor.getByRole('button', { name: 'Save Invoice' })).toBeDisabled()

  await editor.getByLabel('Rate', { exact: true }).first().fill('1000')
  await expect(editor.getByText('Rs. 1,000').first()).toBeVisible()

  await editor.getByRole('button', { name: 'Add' }).click()
  await editor.getByLabel('Item', { exact: true }).nth(1).fill('Parking')
  await editor.getByLabel('Qty', { exact: true }).nth(1).fill('2')
  await editor.getByLabel('Rate', { exact: true }).nth(1).fill('250')
  await expect(editor.getByText('Rs. 1,500').first()).toBeVisible()

  await editor.getByRole('button', { name: 'Remove line item' }).first().click()
  await expect(editor.getByLabel('Item', { exact: true })).toHaveCount(1)
  await expect(editor.getByText('Rs. 500').first()).toBeVisible()

  await editor.getByRole('button', { name: 'Add' }).click()
  await editor.getByLabel('Item', { exact: true }).nth(1).fill('Toll Charges')
  await editor.getByLabel('Rate', { exact: true }).nth(1).fill('100')
  await editor.locator('select').filter({ hasText: 'Enter a new customer' }).selectOption('cust-1')
  await expect(editor.getByPlaceholder('Full name')).toHaveValue('Anand Travels')
  await expect(editor.getByPlaceholder('Mobile')).toHaveValue('9876543210')

  await editor.getByRole('button', { name: 'Save Invoice' }).click()
  await expect.poll(() => state(page, 'submits')).toHaveLength(1)
  const [submitted] = await state(page, 'submits')
  expect(submitted.doc.lineItems).toHaveLength(2)
  expect(submitted.doc.isManual).toBe(true)
  expect(submitted.doc.docType).toBe('invoice')
  expect(submitted.doc.total).toBe(600)
  expect(submitted.invoice.customer).toBe('Anand Travels')
})

test('quotation editor keeps validity and terms and never offers issue or payment controls', async ({ page }) => {
  await go(page, '?view=editor&kind=quotation')
  const editor = page.getByRole('dialog', { name: 'Create quotation' })
  await expect(editor).toBeVisible()
  await expect(editor.getByText('Valid until', { exact: true })).toBeVisible()
  await expect(editor.getByText('Terms & conditions', { exact: true })).toBeVisible()
  await expect(editor.getByRole('button', { name: 'Save Draft' })).toBeVisible()

  await editor.getByPlaceholder('Full name').fill('Raj Tours')
  await editor.getByLabel('Rate', { exact: true }).first().fill('9500')
  await editor.locator('input[type="date"]').nth(1).fill('2026-12-21')
  await editor.getByPlaceholder('Optional terms for this document…').fill('Valid for 30 days.')
  await editor.getByRole('button', { name: 'Save Draft' }).click()

  const modal = page.getByRole('dialog')
  await expect(modal).toContainText('Quotation')
  await expect(modal.getByRole('button', { name: 'Print / PDF' })).toBeVisible()
  await expect(modal.getByRole('link', { name: /WhatsApp/ })).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Issue Invoice' })).toHaveCount(0)
  await expect(modal.getByText('Payment', { exact: true })).toHaveCount(0)
  await expect(modal.getByText(/Quotations are estimates/)).toBeVisible()

  await expect.poll(() => state(page, 'submits')).toHaveLength(1)
  const [submitted] = await state(page, 'submits')
  expect(submitted.doc.docType).toBe('quotation')
  expect(submitted.doc.isManual).toBe(true)
  expect(submitted.doc.validUntil).toBe('2026-12-21')
  expect(submitted.doc.terms).toBe('Valid for 30 days.')
  expect(submitted.invoice.isQuote).toBe(true)
})

test('desktop invoice modal splits document from settlement and excludes reversed payments', async ({ page }) => {
  await go(page, '?view=modal&doc=trip')
  const modal = page.getByRole('dialog', { name: 'Invoice INV-2026-021' })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Print / PDF' })).toBeVisible()
  await expect(modal.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', /wa\.me/)

  const documentBox = await modal.locator('.print-doc').boundingBox()
  const asideBox = await modal.locator('aside').boundingBox()
  expect(asideBox.x).toBeGreaterThan(documentBox.x + documentBox.width - 20)

  const aside = modal.locator('aside')
  await expect(aside).toContainText('4,800')
  await expect(aside).toContainText('3,000')
  await expect(aside).toContainText('1,800')
  await expect(aside.getByText('History (3)')).toBeVisible()
  await expect(aside.getByText('UPIREF-4455')).toBeVisible()
  await expect(aside.getByText('UPI · 21 Nov 2026')).toBeVisible()
  await expect(aside.locator('li').filter({ hasText: 'REVERSED-REF' }).locator('span').last())
    .toHaveClass(/line-through/)
})

test('payment panel records full and partial amounts after applying persisted rows', async ({ page }) => {
  await go(page, '?view=payment')
  await expect(page.getByLabel('Payment amount')).toHaveValue('1800')
  await page.getByLabel('Payment method').selectOption('UPI')
  await page.getByPlaceholder('UPI / cheque / transaction ref').fill('FULL-1')
  await page.locator('input[type="date"]').fill(DATE)
  await page.getByRole('button', { name: /Record Rs\. 1,800/ }).click()
  await expect.poll(() => state(page, 'payments')).toHaveLength(1)
  expect((await state(page, 'payments'))[0]).toMatchObject({
    invoiceId: 'rec-trip-001',
    amount: 1800,
    method: 'UPI',
    reference: 'FULL-1',
    paymentDate: DATE,
  })
  await page.locator('#apply-payments').click()
  await expect(page.getByText('Settled in full.')).toBeVisible()

  await go(page, '?view=payment')
  await page.getByLabel('Payment amount').fill('500')
  await page.getByRole('button', { name: /Record Rs\. 500/ }).click()
  await expect.poll(() => state(page, 'payments')).toHaveLength(1)
  expect((await state(page, 'payments'))[0].amount).toBe(500)
  await page.locator('#apply-payments').click()
  await expect(page.getByLabel('Payment amount')).toHaveValue('1300')
  await expect(page.getByText('Balance')).toBeVisible()
})

test('payment panel blocks over-balance and requires an issued record', async ({ page }) => {
  await go(page, '?view=payment')
  await page.getByLabel('Payment amount').fill('1801')
  await expect(page.getByRole('button', { name: /Record Rs\. 1,801/ })).toBeDisabled()
  expect(await state(page, 'payments')).toEqual([])

  await go(page, '?view=payment&doc=unissued')
  await expect(page.getByText('Issue this invoice before recording a payment.')).toBeVisible()
  await expect(page.getByLabel('Payment amount')).toHaveCount(0)
})

test('rapid double submit creates exactly one payment', async ({ page }) => {
  await go(page, '?view=payment')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find(candidate => candidate.textContent.includes('Record Rs.'))
    button.click()
    button.click()
  })
  await expect.poll(() => state(page, 'payments')).toHaveLength(1)
  expect((await state(page, 'payments'))[0].idempotencyKey).toEqual(expect.any(String))
})

test('issued manual documents lock destructive actions', async ({ page }) => {
  await go(page, '?view=modal&doc=manual')
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('button', { name: 'Issued — locked' })).toBeDisabled()
  await expect(modal.getByRole('button', { name: 'Issue Invoice' })).toHaveCount(0)
})

test('canCreate=0 disables save and hides issue, delete and payment actions', async ({ page }) => {
  await go(page, '?view=editor&canCreate=0')
  await expect(page.getByRole('button', { name: 'Save Invoice' })).toBeDisabled()

  await go(page, '?view=modal&doc=manual&canCreate=0')
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('button', { name: 'Issue Invoice' })).toHaveCount(0)
  await expect(modal.getByRole('button', { name: 'Delete Manual Invoice' })).toHaveCount(0)
  await expect(modal.getByText('Read-only access')).toBeVisible()
  await expect(modal.getByRole('button', { name: /Record Rs\./ })).toBeDisabled()

  await go(page, '?view=chooser&canCreate=0')
  await page.getByRole('button', { name: 'Existing Booking' }).click()
  await page.getByRole('button', { name: 'Create invoice' }).first().click()
  await expect(page.getByRole('button', { name: 'Issue Invoice' })).toBeDisabled()
})

test('all invoice views stay within the viewport at 1440, 1280, 768 and 390px', async ({ page }) => {
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const view of ['chooser', 'bookings', 'editor', 'modal']) {
      await go(page, `?view=${view}`)
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoHorizontalOverflow(page)
    }
  }
})

test('mobile editor preview toggle works while bottom actions stay visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await go(page, '?view=editor')
  const editor = page.getByRole('dialog', { name: 'Create manual invoice' })
  const preview = editor.getByRole('button', { name: 'Preview' })
  const save = editor.getByRole('button', { name: 'Save Invoice' })

  await expect(preview).toBeVisible()
  await expect(preview).toBeInViewport()
  await expect(save).toBeVisible()
  await expect(save).toBeInViewport()

  await preview.click()
  await expect(editor.getByText('Live preview', { exact: true })).toBeVisible()
  await expect(editor.getByPlaceholder('Full name')).toBeHidden()
  await expect(save).toBeVisible()
  await expect(save).toBeInViewport()

  await editor.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(editor.getByPlaceholder('Full name')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('overlay portals to body, stays open on inner clicks and closes via the backdrop', async ({ page }) => {
  await go(page, '?view=chooser')
  const dialog = page.getByRole('dialog', { name: 'Create a new invoice' })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(element => !document.getElementById('root').contains(element))).toBe(true)

  await page.waitForTimeout(150)
  expect(await state(page, 'closes')).toEqual([])

  const card = dialog.getByRole('button', { name: 'Manual Invoice' })
  await card.focus()
  await expect(card).toBeFocused()
  await dialog.getByText('Choose how you want to prepare this document.').click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  expect(await state(page, 'closes')).toEqual([])

  await page.locator('[aria-hidden="true"]').click({ position: { x: 2, y: 2 } })
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => state(page, 'closes')).toEqual(['chooser'])
  const active = await page.evaluate(() => ({
    id: document.activeElement?.id || '',
    tag: document.activeElement?.tagName || '',
  }))
  expect(['BODY', 'open-chooser']).toContain(active.tag === 'BODY' ? 'BODY' : active.id)
})
