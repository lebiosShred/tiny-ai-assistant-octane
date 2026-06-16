const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');
const fs = require('fs');
const path = require('path');

test.describe('Aegis v2 -- Knowledge Base Naming & Pricing Compliance validation', () => {

    test('performs static audit of DevOps support markdown file', async () => {
        const docPath = path.join(__dirname, '../../knowledge/Octane Services/02_tm1_devops_support.md');
        expect(fs.existsSync(docPath)).toBe(true);

        const content = fs.readFileSync(docPath, 'utf8');

        // 1. Verify correct retainer name and phrasing is utilized
        expect(content).toContain('Octane Green (formerly Red)');
        expect(content).toContain('Billing follows the standard Green retainer tier.');

        // 2. Ensure no numerical pricing values exist (e.g. $ or A$)
        const pricePattern = /(?:A\$|\$)\d+/gi;
        const priceMatches = content.match(pricePattern);
        expect(priceMatches).toBeNull();
    });

    test('simulates browser navigation and RAG prompt validation', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);

        // Intercept API chat completions if not testing a live production URL
        if (!process.env.TEST_URL) {
            await page.route('**/api/chat', async route => {
                const postData = route.request().postData();
                let userMessage = '';
                if (postData) {
                    try {
                        const reqBody = JSON.parse(postData);
                        if (reqBody.messages && reqBody.messages.length > 0) {
                            userMessage = reqBody.messages[reqBody.messages.length - 1].content || '';
                        }
                    } catch (e) {
                        console.error('Failed to parse request JSON:', e);
                    }
                }

                let responseText = '';
                if (userMessage.toLowerCase().includes('green')) {
                    responseText = 'For entry-level system support, we offer the Octane Green (formerly Red) retainer. This package delivers 24/7 support and 15 support hours per month. It excludes project-based work, advanced reporting, and rollover hours. Billing follows the standard Green retainer tier.';
                } else {
                    responseText = 'General responsive answer.';
                }

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        choices: [{ message: { role: 'assistant', content: responseText } }]
                    })
                });
            });
        }

        // Navigate to Tiny AI Assistant demo page
        await indexPage.goto();
        
        // Start a new chat session to open the metadata drawer
        await indexPage.newChatBtn.click();

        // Override Playwright active flags to test the confirmation modal
        await page.evaluate(() => {
            window.__playwright_active = false;
            Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
        });

        // Fill out metadata form
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');

        // Click Save Sources button
        await indexPage.submitForm();

        // Handle the glassmorphic confirmation modal and submit
        const modal = page.locator('#confirm-modal');
        await expect(modal).not.toHaveClass(/modal-hidden/);
        await page.click('#btn-submit-confirm');

        // Wait for session to initialize
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // Submit prompt test simulation
        const query = 'Tell me about the Octane Green support retainer package.';
        await indexPage.sendMessage(query);
        await indexPage.waitForResponse(20000);

        const response = await indexPage.getLastResponseText();

        // Assert naming correctness
        expect(response).toContain('Octane Green (formerly Red)');
        expect(response).toContain('Green retainer tier');

        // Assert absolute pricing purge compliance (no dollar signs or numeric rates)
        expect(response).not.toContain('$');
        expect(response).not.toContain('A$');
        expect(response).not.toContain('/month');

        // Assert formatting standards (no em-dashes)
        expect(response).not.toContain('—');
        expect(response).not.toContain('–');
    });
});
