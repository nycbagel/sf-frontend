import { test, expect, type Page } from '@playwright/test'

/**
 * A contact can carry several typed addresses. Runs against the real API, so
 * each test creates its own contact and deletes it again.
 */

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

async function fillAddress(
  page: Page,
  index: number,
  fields: { type: 'home' | 'work' | 'other'; street?: string; city: string },
) {
  const row = page.getByRole('group', { name: `Address ${index + 1}` })
  await row.getByLabel('Type').selectOption(fields.type)
  if (fields.street) await row.getByLabel('Street address').fill(fields.street)
  await row.getByLabel('City').fill(fields.city)
}

async function deleteFromDetailPage(page: Page, fullName: string) {
  await page.getByRole('button', { name: `Delete ${fullName}` }).click()
  await page.getByRole('button', { name: `Confirm deleting ${fullName}` }).click()
  await expect(page).toHaveURL(/\/contacts\/?(\?.*)?$/)
}

test.describe('Contact addresses', () => {
  test('creates a contact with a home and a work address, then removes one', async ({ page }) => {
    const last = `Addr${Date.now().toString().slice(-6)}`
    const fullName = `Multi ${last}`

    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Multi')
    await page.getByLabel('Last name').fill(last)
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('addr'))

    await page.getByRole('button', { name: 'Add address' }).click()
    await fillAddress(page, 0, { type: 'home', street: '1 Market St', city: 'San Francisco' })
    await page.getByRole('button', { name: 'Add address' }).click()
    await fillAddress(page, 1, { type: 'work', city: 'Arlington' })
    await page.getByRole('button', { name: 'Create contact' }).click()

    // Both addresses show on the detail page, grouped under their type badge.
    await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible()
    const home = page.getByText('Home', { exact: true }).locator('..')
    await expect(home.getByRole('listitem')).toHaveCount(1)
    await expect(home).toContainText('1 Market St, San Francisco')
    const work = page.getByText('Work', { exact: true }).locator('..')
    await expect(work.getByRole('listitem')).toHaveCount(1)
    await expect(work).toContainText('Arlington')

    // Edit: drop the home address, keep work.
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page.getByRole('group', { name: 'Address 2' })).toBeVisible()
    await page.getByRole('button', { name: 'Remove address 1' }).click()
    await expect(page.getByRole('group', { name: 'Address 2' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible()
    await expect(page.getByText('Work', { exact: true }).locator('..').getByRole('listitem')).toHaveCount(1)
    await expect(page.getByText('Home', { exact: true })).toHaveCount(0)
    await expect(page.getByText('1 Market St')).toHaveCount(0)

    await deleteFromDetailPage(page, fullName)
  })

  test('keeps the typed addresses when validation fails', async ({ page }) => {
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('OnlyFirst')
    await page.getByRole('button', { name: 'Add address' }).click()
    await fillAddress(page, 0, { type: 'other', city: 'Oslo' })
    await page.getByRole('button', { name: 'Create contact' }).click()

    await expect(page.getByText('Please fix the highlighted fields.')).toBeVisible()
    const row = page.getByRole('group', { name: 'Address 1' })
    await expect(row.getByLabel('Type')).toHaveValue('other')
    await expect(row.getByLabel('City')).toHaveValue('Oslo')
  })

  test('a blank address row is ignored rather than rejected', async ({ page }) => {
    const last = `Blank${Date.now().toString().slice(-6)}`
    const fullName = `Row ${last}`

    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Row')
    await page.getByLabel('Last name').fill(last)
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('blank'))
    await page.getByRole('button', { name: 'Add address' }).click()
    await page.getByRole('button', { name: 'Create contact' }).click()

    await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible()
    await expect(page.getByText('Home', { exact: true })).toHaveCount(0)

    await deleteFromDetailPage(page, fullName)
  })
})
