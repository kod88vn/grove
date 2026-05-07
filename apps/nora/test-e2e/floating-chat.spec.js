import { test, expect } from '@playwright/test';

test.describe('Floating Chat', () => {
  test('initial greeting flows on open', async ({ page }) => {
    // Mock user API
    await page.route('/api/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'Test User' }),
      });
    });

    // Mock greeting stream
    await page.route('/api/chat', async (route) => {
      const payload = route.request().postDataJSON();
      if (payload.mode === 'greeting') {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'data: {"word": "Hello "}\n\ndata: {"word": "Test User, "}\n\ndata: {"word": "how "}\n\ndata: {"word": "can "}\n\ndata: {"word": "I "}\n\ndata: {"word": "help?"}\n\n',
        });
      }
    });

    await page.goto('/');
    
    // Open chat
    const trigger = page.getByRole('button', { name: 'Ask Nora' });
    await trigger.click();

    // Verify greeting starts streaming
    const chatContainer = page.getByRole('dialog', { name: 'Ask Nora' });
    await expect(chatContainer).toBeVisible();
    
    // Wait for the full greeting to appear
    await expect(page.getByText('Hello Test User, how can I help?')).toBeVisible({ timeout: 10000 });
  });

  test('can send a message and see thinking state', async ({ page }) => {
    await page.route('/api/me', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ name: 'Test User' }) });
    });

    // Real message stream with thinking
    await page.route('/api/chat', async (route) => {
      const payload = route.request().postDataJSON();
      if (payload.mode === 'greeting') {
        await route.fulfill({ status: 200, body: 'data: {"word": "Hi"}\n\n' });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'data: {"thinking": "I am thinking..."}\n\ndata: {"word": "The weather is sunny."}\n\n',
        });
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Ask Nora' }).click();

    const textarea = page.getByPlaceholder('Message Nora…');
    await textarea.fill('How is the weather?');
    await textarea.press('Enter');

    // Verify thinking state and response
    await expect(page.getByText('I am thinking...')).toBeVisible();
    await expect(page.getByText('The weather is sunny.')).toBeVisible();
  });
});
