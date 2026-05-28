const { test, expect } = require('../fixtures/base');

/**
 * Aegis v2 -- Network Resilience Tests
 * Simulates API failures, timeouts, and malformed responses to verify
 * the application degrades gracefully without crashes.
 *
 * These tests use page.evaluate() for form interactions to bypass
 * viewport visibility constraints -- we are testing API error handling,
 * not button clickability.
 */
test.describe('Aegis Network Resilience Tests', () => {

    test('handles API 500 error without crashing', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.goto('/');
        await page.locator('body').waitFor({ state: 'attached' });

        // Programmatically fill form and trigger submission
        await page.evaluate(() => {
            document.querySelector('#prep-name').value = 'Test User';
            document.querySelector('#prep-company').value = 'Test Corp';
            document.querySelector('#prep-name').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#prep-company').dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Install route intercept AFTER page is initialized
        await page.route('**/api/chat', async route => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Internal Server Error' }),
            });
        });

        // Trigger submit programmatically
        await page.evaluate(() => {
            document.querySelector('#prep-submit-btn').click();
        });

        // Wait for the app to process the error response
        await page.waitForTimeout(5000);

        const criticalErrors = pageErrors.filter(e =>
            !e.includes('ResizeObserver') && !e.includes('Script error')
        );
        expect(criticalErrors.length).toBe(0);
    });

    test('handles API timeout without crashing', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.goto('/');
        await page.locator('body').waitFor({ state: 'attached' });

        await page.evaluate(() => {
            document.querySelector('#prep-name').value = 'Test User';
            document.querySelector('#prep-company').value = 'Test Corp';
            document.querySelector('#prep-name').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#prep-company').dispatchEvent(new Event('input', { bubbles: true }));
        });

        await page.route('**/api/chat', async route => {
            await route.abort('timedout');
        });

        await page.evaluate(() => {
            document.querySelector('#prep-submit-btn').click();
        });

        await page.waitForTimeout(5000);

        const criticalErrors = pageErrors.filter(e =>
            !e.includes('ResizeObserver') && !e.includes('Script error')
        );
        expect(criticalErrors.length).toBe(0);
    });

    test('handles malformed JSON response without crashing', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.goto('/');
        await page.locator('body').waitFor({ state: 'attached' });

        await page.evaluate(() => {
            document.querySelector('#prep-name').value = 'Test User';
            document.querySelector('#prep-company').value = 'Test Corp';
            document.querySelector('#prep-name').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#prep-company').dispatchEvent(new Event('input', { bubbles: true }));
        });

        await page.route('**/api/chat', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: 'NOT_VALID_JSON{{{{{',
            });
        });

        await page.evaluate(() => {
            document.querySelector('#prep-submit-btn').click();
        });

        await page.waitForTimeout(5000);

        const criticalErrors = pageErrors.filter(e =>
            !e.includes('ResizeObserver') && !e.includes('Script error')
        );
        expect(criticalErrors.length).toBe(0);
    });
});
