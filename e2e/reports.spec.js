import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const URL = '/e2e/reports-harness.html'
const TABS = [
  ['Overview', 'Business at a glance'],
  ['Trips', 'Trip performance'],
  ['Drivers', 'Driver performance'],
  ['Vehicles', 'Fleet analytics'],
  ['Customers', 'Customer intelligence'],
  ['Expenses', 'Expense intelligence'],
  ['Payroll', 'Payroll & settlements'],
  ['Monthly', 'Monthly performance · 2026'],
  ['Operations', 'Operations monitor'],
  ['Alerts', 'Business alerts'],
]

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('#reports-root')
    return {
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
      rootScroll: root.scrollWidth,
      rootClient: root.clientWidth,
    }
  })
  expect(metrics.docScroll, `document scrollWidth ${metrics.docScroll} should not exceed ${metrics.docClient}`)
    .toBeLessThanOrEqual(metrics.docClient + 1)
  expect(metrics.rootScroll, `reports scrollWidth ${metrics.rootScroll} should not exceed ${metrics.rootClient}`)
    .toBeLessThanOrEqual(metrics.rootClient + 1)
}

async function openCsvDownload(page) {
  await page.getByRole('button', { name: 'Export Report' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV', exact: true }).click(),
  ])
  return download
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-21T09:00:00') })
  await page.goto(URL)
  await expect(page.locator('#reports-root')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reports & Analytics', level: 1 })).toBeVisible()
})

for (const width of [1440, 1280, 1024, 768, 390, 360]) {
  test(`reports workspace has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByText('Business performance, fleet insights and financial intelligence.')).toBeVisible()
    await expect(page.getByText('Business at a glance')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
}

test('all ten report tabs render with their scoped views', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const [tab, heading] of TABS) {
    await page.getByRole('radio', { name: tab, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})

test('global period applies to trips and drives KPIs, filters and exports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('radio', { name: 'Trips', exact: true }).click()

  await expect(page.getByText('01 Nov 2026 → 21 Nov 2026', { exact: true })).toBeVisible()
  await expect(page.locator('table tbody tr')).toHaveCount(4)

  await page.getByLabel('Search trips').fill('Ravi')
  await expect(page.locator('table tbody tr')).toHaveCount(2)
  await expect(page.getByText('Showing 1 to 2 of 2 trips')).toBeVisible()

  const download = await openCsvDownload(page)
  expect(download.suggestedFilename()).toMatch(/^trips_report_/)
  const csv = await readFile(await download.path(), 'utf8')
  expect(csv).toContain('Ravi')
  expect(csv).not.toContain('Kavya')

  await page.getByRole('button', { name: /^Clear filters/ }).click()
  await expect(page.locator('table tbody tr')).toHaveCount(4)

  await page.getByLabel('Quick period').selectOption('last-month')
  await expect(page.getByText('No trips match these filters')).toBeVisible()
  await expect(page.locator('table tbody tr')).toHaveCount(0)

  await page.getByRole('button', { name: 'Clear All' }).click()
  await expect(page.getByLabel('Quick period')).toHaveValue('this-month')
  await expect(page.locator('table tbody tr')).toHaveCount(4)
})

test('unsupported tabs state their fixed scope and use the shared export menu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.getByRole('radio', { name: 'Vehicles', exact: true }).click()
  await expect(page.getByText(/Global date range does not apply/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fleet analytics' })).toBeVisible()

  await page.getByRole('radio', { name: 'Monthly', exact: true }).click()
  await expect(page.getByText(/Future months are shown as empty reporting periods/)).toBeVisible()
  await expect(page.getByText('Upcoming', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Export/ }).first()).toBeVisible()

  await page.getByRole('radio', { name: 'Operations', exact: true }).click()
  await expect(page.getByText(/No timestamp is supplied by this report/)).toBeVisible()
  const inProgress = page.getByText('Trips in progress').locator('xpath=../..')
  await expect(inProgress.getByText('1', { exact: true })).toBeVisible()
})

test('failed report loads show an error instead of zeros', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('radio', { name: 'Drivers', exact: true }).click()
  await expect(page.getByText('Could not load this report').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible()
})

test('critical alerts stay visible under filters and search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('radio', { name: 'Alerts', exact: true }).click()

  const critical = page.getByText('TN 37 AB 1234 Insurance')
  await expect(critical).toBeVisible()

  await page.getByLabel('Priority').selectOption('medium')
  await expect(critical).toBeVisible()

  await page.getByLabel('Search alerts').fill('nothing-matches')
  await expect(critical).toBeVisible()
  await expect(page.locator('body')).not.toContainText('No alerts at this time')
})

test('dark theme renders without overflow and refresh gives feedback', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.locator('#theme-toggle').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expectNoHorizontalOverflow(page)

  await page.getByRole('button', { name: 'Refresh Data' }).click()
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeVisible()
  await page.clock.runFor(800)
  await expect(page.getByRole('button', { name: 'Refresh Data' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
