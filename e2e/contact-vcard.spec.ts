import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

/**
 * "Download vCard" on the detail page hands the browser a `.vcf` file built by
 * the API. Runs against the real API, so the test creates its own contact and
 * deletes it again.
 */

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

async function deleteFromDetailPage(page: Page, fullName: string) {
  await page.getByRole('button', { name: `Delete ${fullName}` }).click()
  await page.getByRole('button', { name: `Confirm deleting ${fullName}` }).click()
  await expect(page).toHaveURL(/\/contacts\/?(\?.*)?$/)
}

test.describe('Contact vCard export', () => {
  test('downloads a .vcf carrying the name and a typed address', async ({ page }) => {
    const last = `Vcard${Date.now().toString().slice(-6)}`
    const fullName = `Export ${last}`

    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Export')
    await page.getByLabel('Last name').fill(last)
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('vcard'))
    await page.getByRole('button', { name: 'Add address' }).click()
    const row = page.getByRole('group', { name: 'Address 1' })
    await row.getByLabel('Type').selectOption('work')
    await row.getByLabel('City').fill('Arlington')
    await page.getByRole('button', { name: 'Create contact' }).click()
    await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Download vCard' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe(`export-${last.toLowerCase()}.vcf`)
    const body = await readFile((await download.path())!, 'utf8')
    expect(body).toMatch(/^BEGIN:VCARD\r\nVERSION:3\.0\r\n/)
    expect(body).toContain(`FN:${fullName}`)
    expect(body).toContain('ADR;TYPE=WORK:;;;Arlington;;;')
    expect(body.endsWith('END:VCARD\r\n')).toBe(true)

    await deleteFromDetailPage(page, fullName)
  })

  test('the download route is a 404 for an unknown contact', async ({ request }) => {
    const response = await request.get('/contacts/99999999/vcard')
    expect(response.status()).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Contact 99999999 not found' })
  })
})
