import { test, expect } from '@playwright/test';

test.describe('Navigation UX', () => {
  test('chat navigation highlights correctly', async ({ page }) => {
    // Mock user API
    await page.route('/api/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'Test User' }),
      });
    });

    await page.goto('/');
    
    const noraLink = page.getByRole('link', { name: 'Nora', exact: true });
    await noraLink.click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(noraLink).toHaveClass(/bg-indigo-50/);
  });
});
