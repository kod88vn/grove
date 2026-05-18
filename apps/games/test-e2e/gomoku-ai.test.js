import { test, expect } from '@playwright/test';

test.describe('Gomoku AI Move Making', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/gomoku');
  });

  test('AI makes first move at center', async ({ page }) => {
    // Select Fox symbol using Playwright's locator API
    await page.getByRole('button', { name: 'Fox' }).click();
    
    // Select Beginner difficulty (dev mode)
    await page.getByRole('button', { name: 'Beginner' }).click();
    
    // Wait for AI to make first move
    await page.waitForTimeout(3000);
    
    // Verify AI stone is visible at center - button has disabled attribute and title starts with "(0, 0)"
    const aiStone = page.locator('button[title^="(0, 0)"][disabled]');
    await expect(aiStone).toBeVisible();
    
    // The center button should have some emoji content (the AI symbol)
    const aiStoneText = await aiStone.textContent();
    expect(aiStoneText.length).toBeGreaterThan(0);
    
    // Page should contain "AI played" message
    const text = await page.locator('main').textContent();
    expect(text).toContain('AI played');
  });

  test('AI responds to human move with its own stone', async ({ page }) => {
    // Select Fox symbol and Beginner difficulty
    await page.getByRole('button', { name: 'Fox' }).click();
    await page.getByRole('button', { name: 'Beginner' }).click();
    
    // Wait for AI first move (center stone)
    await page.waitForTimeout(3000);
    
    // Verify AI's first move is visible at center - button has disabled attribute and title starts with "(0, 0)"
    const aiStone = page.locator('button[title^="(0, 0)"][disabled]');
    await expect(aiStone).toBeVisible();
    
    // Get the AI symbol from center button
    const aiSymbol = await aiStone.textContent();
    
    // Click on cell (1, 0) to make a human move - legal since within 3 cells of center
    const cell = page.locator('button[title^="(1, 0)"]');
    await expect(cell).toBeVisible();
    await cell.click();
    
    // Wait for AI to respond with its move
    await page.waitForTimeout(8000);
    
    // Verify human move is visible on the board - cell should now show fox emoji
    const cellText = await cell.textContent();
    expect(cellText).toContain('🦊');
    
    // Verify AI made a second move - count buttons containing the AI symbol
    const aiStones = await page.locator(`button:has-text("${aiSymbol}")`).count();
    expect(aiStones).toBeGreaterThanOrEqual(2);
  });

  test('Board cells are clickable and show human symbol', async ({ page }) => {
    // Select symbol and difficulty
    await page.getByRole('button', { name: 'Fox' }).click();
    await page.getByRole('button', { name: 'Beginner' }).click();
    
    // Wait for AI first move
    await page.waitForTimeout(3000);
    
    // Verify the AI stone is visible at center - button has disabled attribute
    const aiStone = page.locator('button[title^="(0, 0)"][disabled]');
    await expect(aiStone).toBeVisible();
    
    // Click on cell (1, 0) - should show the fox emoji after click
    const humanCell = page.locator('button[title^="(1, 0)"]');
    await expect(humanCell).toBeVisible();
    await humanCell.click();
    
    // After clicking, the cell should now show the fox emoji (🦊)
    const cellText = await humanCell.textContent();
    expect(cellText).toContain('🦊');
  });

  test('Game loads and displays Gomoku board correctly', async ({ page }) => {
    // Select symbol
    await page.getByRole('button', { name: 'Fox' }).click();
    
    // Select difficulty
    await page.getByRole('button', { name: 'Beginner' }).click();
    
    // Wait for game to initialize and AI to make first move
    await page.waitForTimeout(3000);
    
    // Verify game state elements are present
    const text = await page.locator('main').textContent();
    
    // Should show the game instructions
    expect(text).toContain('Gomoku');
    
    // Should indicate it's the player's turn after AI moves first
    expect(text).toContain('Your turn');
    
    // Should show the symbols (player vs AI)
    expect(text).toContain('🦊');
  });

  test('AI makes moves at different difficulty levels', async ({ page }) => {
    const difficulties = ['Beginner', 'Intermediate'];
    
    for (const diff of difficulties) {
      // Reload page for each difficulty
      await page.goto('/games/gomoku');
      
      // Select symbol and difficulty
      await page.getByRole('button', { name: 'Fox' }).click();
      
      // Click the difficulty button - match by text content
      await page.getByRole('button', { name: diff }).click();
      
      // Wait for AI first move
      await page.waitForTimeout(3000);
      
      // Check that AI stone is visible at center - button has disabled attribute and title starts with "(0, 0)"
      const aiStone = page.locator('button[title^="(0, 0)"][disabled]');
      await expect(aiStone).toBeVisible();
      
      const aiSymbol = await aiStone.textContent();
      expect(aiSymbol.length).toBeGreaterThan(0);
    }
  });

  test('Debug: dump page state after AI move', async ({ page }) => {
    // Select symbol and difficulty
    await page.getByRole('button', { name: 'Fox' }).click();
    await page.getByRole('button', { name: 'Beginner' }).click();
    
    // Wait for AI first move
    await page.waitForTimeout(3000);
    
    // Dump all button text content with titles (only non-empty ones)
    const buttons = await page.locator('main button').all();
    console.log('\n=== BUTTONS WITH CONTENT ===');
    for (const btn of buttons) {
      const text = await btn.textContent();
      const title = await btn.getAttribute('title');
      const disabled = await btn.isDisabled();
      if (text || title?.includes(',')) {
        console.log(`  title="${title}" text="${text}" disabled=${disabled}`);
      }
    }
    
    // Verify at least one AI stone exists (center button has disabled attribute and title starts with "(0, 0)")
    const aiStone = page.locator('button[title^="(0, 0)"][disabled]');
    await expect(aiStone).toBeVisible();
  });
});