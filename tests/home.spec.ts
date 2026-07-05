import { test, expect } from '@playwright/test';

test('home redirects to the workflows list', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/workflows$/);
  await expect(page.getByRole('heading', { name: /workflows/i })).toBeVisible();
});

test('can open the workflow editor with the node palette', async ({ page }) => {
  await page.goto('/workflows/new');
  await expect(page.getByText('Node Palette')).toBeVisible();
  await expect(page.getByText('Navigation')).toBeVisible();
});
