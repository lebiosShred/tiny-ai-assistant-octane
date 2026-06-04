const { test, expect } = require('../fixtures/base');

/**
 * Aegis v2 -- Visual Regression Suite
 * Generates and compares pixel-level screenshot baselines.
 * First run creates baselines. Subsequent runs compare against them.
 * Update baselines: npm run test:aegis:update-snapshots
 */
test.describe('Aegis Visual Regression Suite', () => {

    test('index page matches visual baseline', async ({ page }) => {
        await page.goto('/');
        await page.locator('body').waitFor({ state: 'attached' });

        // Mask dynamic content that changes between runs
        await expect(page).toHaveScreenshot('index-full.png', {
            fullPage: true,
            timeout: 15000,
            mask: [
                page.locator('#chat-messages-log'),
                page.locator('#recent-chats-list'),
            ],
        });
    });

    test('docs page matches visual baseline', async ({ page }) => {
        await page.goto('/docs.html');
        await page.locator('body').waitFor({ state: 'attached' });

        await expect(page).toHaveScreenshot('docs-full.png', {
            fullPage: true,
            timeout: 15000,
        });
    });

    test('book page matches visual baseline', async ({ page }) => {
        await page.goto('/book.html');
        await page.locator('body').waitFor({ state: 'attached' });

        await expect(page).toHaveScreenshot('book-full.png', {
            fullPage: true,
            timeout: 15000,
        });
    });
});
