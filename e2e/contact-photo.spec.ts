import { test, expect } from '@playwright/test'

/**
 * Runs against the real API: uploads a photo through the form, checks it shows
 * as the avatar everywhere, and that editing another field keeps it.
 */

// A 1x1 PNG. The form resizes whatever is chosen, so a tiny file is enough.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

test('uploads a photo, shows it as the avatar, and keeps it through an edit', async ({ page }) => {
  const stamp = Date.now().toString().slice(-6)
  const last = `Photo${stamp}`
  const fullName = `Testy ${last}`

  await page.goto('/contacts/new')
  await page.getByLabel('First name').fill('Testy')
  await page.getByLabel('Last name').fill(last)
  await page.getByLabel('Email', { exact: false }).first().fill(`photo-${stamp}@example.com`)
  await page.getByLabel('Photo', { exact: false }).setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  await expect(page.getByRole('img', { name: 'Selected photo' })).toBeVisible()
  await page.getByRole('button', { name: 'Create contact' }).click()

  // Detail page: the photo is the avatar.
  await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible()
  const avatar = page.getByRole('img', { name: `Photo of ${fullName}` })
  await expect(avatar).toBeVisible()
  await expect(avatar).toHaveAttribute('src', /^data:image\/jpeg;base64,/)

  // List page: same avatar on the row.
  await page.goto(`/contacts?q=${last}`)
  await expect(page.getByRole('img', { name: `Photo of ${fullName}` })).toBeVisible()

  // Editing an unrelated field must not drop the photo (PUT replaces everything).
  await page.getByRole('link', { name: `Edit ${fullName}` }).click()
  await expect(page.getByRole('img', { name: 'Selected photo' })).toBeVisible()
  await page.getByLabel('Job title').fill('Chief Engineer')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Chief Engineer').first()).toBeVisible()
  await expect(page.getByRole('img', { name: `Photo of ${fullName}` })).toBeVisible()

  // Removing it brings the initials back.
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible()
  await expect(page.getByRole('img', { name: `Photo of ${fullName}` })).toHaveCount(0)

  // Clean up.
  await page.getByRole('button', { name: `Delete ${fullName}` }).click()
  await page.getByRole('button', { name: `Confirm deleting ${fullName}` }).click()
  await expect(page).toHaveURL(/\/contacts\/?(\?.*)?$/)
})
