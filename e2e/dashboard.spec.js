import { expect, test } from '@playwright/test'

const URL = '/e2e/dashboard-harness.html'

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('#dashboard-root')
    return {
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
      rootScroll: root.scrollWidth,
      rootClient: root.clientWidth,
    }
  })
  expect(metrics.docScroll, `document scrollWidth ${metrics.docScroll} should not exceed clientWidth ${metrics.docClient}`)
    .toBeLessThanOrEqual(metrics.docClient + 1)
  expect(metrics.rootScroll, `dashboard scrollWidth ${metrics.rootScroll} should not exceed clientWidth ${metrics.rootClient}`)
    .toBeLessThanOrEqual(metrics.rootClient + 1)
}

test.beforeEach(async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('#dashboard-root')).toBeVisible()
})

for (const width of [1440, 1280, 768, 390]) {
  test(`dashboard command center renders without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })

    await expect(page.getByRole('heading', { name: 'Fleet command center', level: 1 })).toBeVisible()
    for (const label of [
      'Total Fare', 'Net Income', 'Kilometres Travelled', 'Total Expenses',
      "Today's operations", 'Priority alerts & reminders', 'Fleet & GPS',
      'Live fleet map', 'Moving', 'Idle', 'Stopped', 'Offline',
      'Revenue & expenses', 'Upcoming & recent trips', 'Driver performance',
      'Trip contribution', 'Settlement summary', 'Customers', "Today's attendance",
    ]) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible()
    }

    await expect(page.getByText("Today's schedule")).toBeVisible()
    await expect(page.getByText('Latest trips')).toBeVisible()
    await expect(page.getByText('2 expired')).toBeVisible()
    await expect(page.getByText('3 expiring soon')).toBeVisible()
    await expect(page.getByText('5 valid')).toBeVisible()
    await expect(page.getByText('Stale data')).toBeVisible()
    await expect(page.getByText(/Shown positions are from the last stored fix/)).toBeVisible()

    const kpiValue = page.locator('section[aria-label="Primary business metrics"] p[title]').first()
    await expect(kpiValue).toBeVisible()
    expect(await kpiValue.getAttribute('title')).toBe('Rs. 12,38,967')
    expect(await kpiValue.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'KPI value should fit its card')
      .toBe(true)

    await expectNoHorizontalOverflow(page)
  })
}

test('date filter changes the KPI values, labels and chart range', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const range = page.getByText('Live overview of trips, fleet and business performance', { exact: false })
  const fareValue = page.locator('section[aria-label="Primary business metrics"] p[title]').first()

  await expect(range).toContainText('November 2026')
  await expect(fareValue).toHaveAttribute('title', 'Rs. 12,38,967')
  await expect(page.getByText('3 trips this month')).toBeVisible()
  await expect(page.getByText('6-month trend')).toBeVisible()

  await page.getByRole('radio', { name: 'This Year' }).click()

  await expect(range).toContainText('Year 2026')
  await expect(fareValue).toHaveAttribute('title', 'Rs. 12,43,967')
  await expect(page.getByText('4 trips this year')).toBeVisible()
  await expect(page.getByText('6-month trend')).toHaveCount(0)
  await expect(page.getByText('12-month trend')).toBeVisible()
})

test('dashboard actions navigate to their matching pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const lastNav = page.locator('#last-nav')
  const expectNav = async (locator, expected) => {
    await expect(locator).toBeEnabled()
    await locator.click()
    await expect(lastNav).toHaveText(expected)
  }

  await expectNav(page.getByRole('button', { name: 'Create Trip' }), '/trips#openCreate')
  await expectNav(page.getByRole('button', { name: /^Total Fare:/ }), '/reports')
  await expectNav(page.getByRole('button', { name: /^Net Income:/ }), '/reports')
  await expectNav(page.getByRole('button', { name: /^Kilometres Travelled:/ }), '/vehicles')
  await expectNav(page.getByRole('button', { name: /^Total Expenses:/ }), '/expenses')

  const operations = page.getByRole('region', { name: "Today's operations" })
  await expectNav(operations.getByRole('button', { name: 'View all trips' }), '/trips')
  await expectNav(operations.getByRole('button', { name: 'Open completed trips' }), '/trips')
  await expectNav(operations.getByRole('button', { name: 'Open pending bills' }), '/invoices')
  await expectNav(operations.getByRole('button', { name: 'Open drivers' }), '/drivers')
  await expectNav(operations.getByRole('button', { name: 'Open vehicles' }), '/vehicles')

  await expectNav(page.getByRole('button', { name: 'View vehicles' }), '/vehicles')
  await expectNav(page.getByRole('button', { name: 'View drivers' }).first(), '/drivers')
  await expectNav(page.getByRole('button', { name: 'Review TN 37 AB 1234 Insurance' }), '/vehicles')
  await expectNav(page.getByRole('button', { name: 'Review Kumar Driving Licence' }), '/drivers')
  await expectNav(page.getByRole('button', { name: 'View all fleet alerts' }), '/fleet')
  await expectNav(page.getByRole('button', { name: 'View GPS fleet' }), '/fleet')
  await expectNav(page.getByRole('button', { name: 'Manage vehicles' }), '/vehicles')
  await expectNav(page.getByRole('button', { name: 'View all expenses' }), '/expenses')
  await expectNav(page.getByRole('button', { name: 'Review expenses' }), '/expenses')
  await expectNav(page.getByRole('button', { name: 'View all trips' }).last(), '/trips')
  await expectNav(page.getByRole('button', { name: 'View Trip' }).first(), /^\/trips#b/)
  await expectNav(page.getByRole('button', { name: 'View drivers' }).last(), '/drivers')
  await expectNav(page.getByRole('button', { name: 'View all payroll' }), '/payroll')
  await expectNav(page.getByRole('button', { name: 'Review settlements' }), '/payroll')
  await expectNav(page.getByRole('button', { name: 'View all customers' }), '/customers')
  await expectNav(page.getByRole('button', { name: 'View attendance' }), '/attendance')
})

test('manager KPI cards navigate to their matching pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('#manager-toggle').click()
  const lastNav = page.locator('#last-nav')
  const expectNav = async (locator, expected) => {
    await expect(locator).toBeEnabled()
    await locator.click()
    await expect(lastNav).toHaveText(expected)
  }

  await expectNav(page.getByRole('button', { name: /^Total Trips:/ }), '/trips')
  await expectNav(page.getByRole('button', { name: /^Completed Trips:/ }), '/trips')
  await expectNav(page.getByRole('button', { name: /^Total KM:/ }), '/vehicles')
  await expectNav(page.getByRole('button', { name: /^Pending Bills:/ }), '/invoices')
})

test('dashboard orders finance ahead of operations and routine widgets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const y = async label => page.getByText(label, { exact: false }).first()
    .evaluate(el => el.getBoundingClientRect().top + window.scrollY)

  const [finance, operations, alerts, fleet, trips] = await Promise.all([
    y('Revenue & expenses'), y("Today's operations"), y('Priority alerts & reminders'),
    y('Fleet & GPS'), y('Upcoming & recent trips'),
  ])
  expect(finance).toBeLessThan(operations)
  expect(operations).toBeLessThan(alerts)
  expect(alerts).toBeLessThan(fleet)
  expect(fleet).toBeLessThan(trips)
})

test('payroll summary lists every driver', async ({ page }) => {
  const payroll = page.getByRole('region', { name: 'Payroll summary' })
  await expect(payroll.getByText('All drivers')).toBeVisible()
  await expect(payroll.getByRole('button', { name: 'Open payroll for Ravi' })).toBeVisible()
  await expect(payroll.getByRole('button', { name: 'Open payroll for Kumar' })).toBeVisible()
})

test('live fleet map card shows GPS states, opens fleet and follows the theme', async ({ page }) => {
  const mapCard = page.getByRole('region', { name: 'Live fleet map' })
  await expect(mapCard).toBeVisible()
  for (const name of [
    'Moving vehicles: 0', 'Idle vehicles: 0',
    'Stopped vehicles: 0', 'Offline vehicles: 1',
  ]) {
    await expect(mapCard.getByRole('button', { name })).toBeVisible()
  }

  await mapCard.getByRole('button', { name: 'Moving vehicles: 0' }).click()
  await expect(page.locator('#last-nav')).toHaveText('/fleet')

  const light = await mapCard.evaluate(el => getComputedStyle(el).backgroundColor)
  await page.locator('#theme-toggle').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const dark = await mapCard.evaluate(el => getComputedStyle(el).backgroundColor)
  expect(dark).not.toBe(light)
})

test('light and dark themes both render readable links', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const light = await page.locator('#dashboard-root').evaluate(el => getComputedStyle(el).backgroundColor)

  await page.locator('#theme-toggle').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const dark = await page.locator('#dashboard-root').evaluate(el => getComputedStyle(el).backgroundColor)
  expect(dark).not.toBe(light)

  // Links animate between themes; wait for the transition to settle.
  await expect.poll(() => page.getByRole('button', { name: /View all/ }).first()
    .evaluate(el => getComputedStyle(el).color)).toBe('rgb(147, 197, 253)')
  await expect(page.getByRole('heading', { name: 'Fleet command center', level: 1 })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('attendance unavailable is distinct from an actual zero', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await expect(page.getByText('Present')).toBeVisible()

  await page.locator('#attendance-toggle').click()
  await expect(page.getByText('Attendance data unavailable')).toBeVisible()
  await expect(page.getByText('Counts are hidden rather than shown as zero.')).toBeVisible()
})

test('failed fleet alerts never show a false all-clear', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await expect(page.getByText('High temperature warning')).toBeVisible()

  await page.locator('#alerts-toggle').click()
  await expect(page.getByText('Fleet alerts unavailable')).toBeVisible()
  await expect(page.getByText('No active alerts')).toHaveCount(0)
})
