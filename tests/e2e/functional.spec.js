const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');
const { DocsPage } = require('../pages/DocsPage');

/**
 * Aegis v2 -- Core Functional E2E Test Suite
 */
test.describe('Aegis Functional E2E Suite', () => {

    test.beforeEach(async ({ page }) => {
        if (!process.env.TEST_URL) {
            await page.route('**/api/chat', async route => {
                const mockContent = `
=== DOSSIER SUMMARY ===
- Prospect: Sarah Chen
- Company: Meridian Logistics
- Pain Points: Manual spreadsheets bottleneck
                `;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        choices: [{ message: { role: 'assistant', content: mockContent } }]
                    })
                });
            });
        }
    });

    test('SDR Prep Briefing form submission initializes chat session', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        
        // Start new chat session
        await indexPage.newChatBtn.click();
        
        // Fill form manually for determinism
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah.chen@meridianlogistics.com.au');

        const values = await indexPage.getFormValues();
        expect(values.name).toBe('Sarah Chen');
        expect(values.company).toBe('Meridian Logistics');

        await indexPage.submitForm();
        await indexPage.waitForChatInit();

        // Assert welcome message containing initialization text
        const welcomeText = await page.locator('#chat-messages-log').innerText();
        expect(welcomeText).toContain('Chat session initialized');
    });

    test('Generating reports via quick prompts generates a valid response', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah.chen@meridianlogistics.com.au');
        await page.fill('#source-linkedin-text', 'Sarah Chen is Head of FP&A at Meridian Logistics.');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();

        // Click Lead Sheet quick prompt
        await page.click('button[data-prompt-type="leadSheet"]');
        await indexPage.waitForResponse(20000);

        const responseText = await indexPage.getLastResponseText();
        expect(responseText.length).toBeGreaterThan(20);
        expect(responseText).toContain('Sarah Chen');
    });

    test('Documentation page contains Tiny AI Assistant branding', async ({ page }) => {
        const docsPage = new DocsPage(page);
        await docsPage.goto();

        // Check logo text span and page content for branding
        const logoText = await page.locator('.logo-text').first().innerText();
        expect(logoText).toContain('Tiny AI Assistant');
    });
});
