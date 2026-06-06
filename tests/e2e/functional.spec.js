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

    test('Session-less direct chat enables instant message sending and preserves history on subsequent metadata save', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();

        // 1. Enter session-less direct chat
        await indexPage.newChatBtn.click();

        // Close drawer to clear view
        await indexPage.closeDrawer();

        // Send a query immediately session-less
        const queryText = 'Hi Tiny, tell me about DevOps Blue Support.';
        await indexPage.sendMessage(queryText);

        // 2. Assert immediate UI rendering of the user's message
        const chatLogText = await page.locator('#chat-messages-log').innerText();
        expect(chatLogText).toContain(queryText);

        // 3. Wait for LLM response
        await indexPage.waitForResponse(20000);
        const responseText = await indexPage.getLastResponseText();
        expect(responseText.length).toBeGreaterThan(5);

        // 4. Fill metadata later and Save Sources
        await indexPage.fillMetadata('Alice Smith', 'Acme Systems', 'alice@acmesystems.com');
        await indexPage.submitForm();

        // Wait for Save confirmation
        await page.waitForFunction(
            () => {
                const toast = document.querySelector('#toast');
                return toast && toast.classList.contains('show') && toast.innerText.includes('saved');
            },
            { timeout: 10000 }
        );

        // 5. Verify prior conversation history is preserved in UI
        const postSaveChatText = await page.locator('#chat-messages-log').innerText();
        expect(postSaveChatText).toContain(queryText);
    });

    test('Documentation page contains Tiny AI Assistant branding', async ({ page }) => {
        const docsPage = new DocsPage(page);
        await docsPage.goto();

        // Check logo text span and page content for branding
        const logoText = await page.locator('.logo-text').first().innerText();
        expect(logoText).toContain('Tiny AI Assistant');
    });

    test('verifies glassmorphic confirmation modal pops up and blocks until confirmed', async ({ page }) => {
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();

        // Override Playwright active flag and navigator.webdriver to test modal interaction
        await page.evaluate(() => {
            window.__playwright_active = false;
            Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
        });

        // Fill metadata
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');

        // Click Save Sources button
        await indexPage.submitForm();

        // Verify the modal is visible
        const modal = page.locator('#confirm-modal');
        await expect(modal).not.toHaveClass(/modal-hidden/);

        // Verify title
        const title = await page.locator('#confirm-modal-title').innerText();
        expect(title).toContain('Save Prospect Sources');

        // Click Cancel
        await page.click('#btn-cancel-confirm');
        await expect(modal).toHaveClass(/modal-hidden/);

        // Click Save Sources again, then confirm
        await indexPage.submitForm();
        await expect(modal).not.toHaveClass(/modal-hidden/);
        await page.click('#btn-submit-confirm');

        // Verify modal is hidden and session successfully initializes
        await expect(modal).toHaveClass(/modal-hidden/);
        await indexPage.waitForChatInit();
    });

    test('verifies confirmation modal pops up for conversational add prospect folder command', async ({ page }) => {
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();

        // Override Playwright active flag to test modal interaction
        await page.evaluate(() => {
            window.__playwright_active = false;
            Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
        });

        await indexPage.closeDrawer();

        // Send create prospect command
        await indexPage.sendMessage('add a prospect name "NewlyCreated"\\');

        // Verify the modal is visible
        const modal = page.locator('#confirm-modal');
        await expect(modal).not.toHaveClass(/modal-hidden/);

        // Verify title
        const title = await page.locator('#confirm-modal-title').innerText();
        expect(title).toContain('Add New Prospect');

        // Click Cancel
        await page.click('#btn-cancel-confirm');
        await expect(modal).toHaveClass(/modal-hidden/);

        // Verify original command text is restored in input
        const inputText = await page.inputValue('#chat-user-input');
        expect(inputText).toBe('add a prospect name "NewlyCreated"\\');
    });
});
