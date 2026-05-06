import { test, expect } from '@playwright/test';

test.describe('Navigation UX', () => {
  test('active menu state highlights correctly', async ({ page }) => {
    // Mock user API
    await page.route('/api/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'Test User' }),
      });
    });

    await page.goto('/');
    
    // Check Nora link (base path)
    const noraLink = page.getByRole('link', { name: 'Nora', exact: true });
    await noraLink.click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(noraLink).toHaveClass(/bg-indigo-50/);

    // Check Utilities link (with query params)
    const utilitiesLink = page.getByRole('link', { name: 'Utilities' });
    await utilitiesLink.click();
    await expect(page).toHaveURL(/\/modules\?domain=household/);
    await expect(utilitiesLink).toHaveClass(/bg-indigo-50/);

    // Check Games link (with query params)
    const gamesLink = page.getByRole('link', { name: 'Games' });
    await gamesLink.click();
    await expect(page).toHaveURL(/\/modules\?domain=learning/);
    await expect(gamesLink).toHaveClass(/bg-indigo-50/);
    
    // Verify Utilities is NO LONGER active
    await expect(utilitiesLink).not.toHaveClass(/bg-indigo-50/);
  });
});
