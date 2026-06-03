const { test, expect } = require('../fixtures/base');

/**
 * Aegis v2 -- Network Resilience Tests
 * Simulates API failures, timeouts, and malformed responses to verify
 * the application degrades gracefully without crashes.
 */
test.describe('Aegis Network Resilience Tests', () => {

    test('handles API 500 error without crashing', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.goto('/');
        await page.locator('body').waitFor({ state: 'attached' });

        // Initialize session
        await page.click('#btn-new-chat');
        await page.evaluate(() => {
            document.querySelector('#meta-name').value = 'Test User';
            document.querySelector('#meta-company').value = 'Test Corp';
            document.querySelector('#meta-name').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#meta-company').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#btn-save-sources').click();
        });

        // Wait for chat panel initialization
        await page.locator('#chat-messages-log').waitFor({ state: 'visible' });

        // Install route intercept for chat API
        await page.route('**/api/chat', async route => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Internal Server Error' }),
            });
        });

        // Trigger chat prompt submit
        await page.evaluate(() => {
            document.querySelector('#chat-user-input').value = 'Hello Tiny';
            document.querySelector('#chat-user-input').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#chat-send-btn').click();
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

        await page.click('#btn-new-chat');
        await page.evaluate(() => {
            document.querySelector('#meta-name').value = 'Test User';
            document.querySelector('#meta-company').value = 'Test Corp';
            document.querySelector('#meta-name').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#meta-company').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#btn-save-sources').click();
        });

        await page.locator('#chat-messages-log').waitFor({ state: 'visible' });

        await page.route('**/api/chat', async route => {
            await route.abort('timedout');
        });

        await page.evaluate(() => {
            document.querySelector('#chat-user-input').value = 'Hello Tiny';
            document.querySelector('#chat-user-input').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#chat-send-btn').click();
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

        await page.click('#btn-new-chat');
        await page.evaluate(() => {
            document.querySelector('#meta-name').value = 'Test User';
            document.querySelector('#meta-company').value = 'Test Corp';
            document.querySelector('#meta-name').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#meta-company').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#btn-save-sources').click();
        });

        await page.locator('#chat-messages-log').waitFor({ state: 'visible' });

        await page.route('**/api/chat', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: 'NOT_VALID_JSON{{{{{',
            });
        });

        await page.evaluate(() => {
            document.querySelector('#chat-user-input').value = 'Hello Tiny';
            document.querySelector('#chat-user-input').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#chat-send-btn').click();
        });

        await page.waitForTimeout(5000);

        const criticalErrors = pageErrors.filter(e =>
            !e.includes('ResizeObserver') && !e.includes('Script error')
        );
        expect(criticalErrors.length).toBe(0);
    });
});
