const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Aegis Table Styling and Parsing Spec', () => {

    test.beforeEach(async ({ page }) => {
        // Intercept and stub the API completion response to ensure test determinism
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
                        console.error('Failed to parse post data:', e);
                    }
                }
                
                let reply = '';

                if (userMessage.includes('Show me the list of leads')) {
                    reply = `
| Client Name | Company | Service Track |
|-------------|---------|---------------|
| Sarah Chen  | Meridian Logistics | TM1 & AI |
                    `;
                } else {
                    reply = 'General assistant response.';
                }

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        choices: [{ message: { role: 'assistant', content: reply } }]
                    })
                });
            });
        }
    });

    test('verifies that markdown tables in chat bubbles are parsed as HTML tables and correctly styled', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // Send a message that triggers a table response.
        await indexPage.sendMessage('Show me the list of leads');
        await indexPage.waitForResponse(20000);

        // Check if a table exists in the last assistant response card
        const table = page.locator('#chat-messages-log .chat-message-card.assistant:last-child .chat-message-content table');
        await expect(table).toBeVisible();

        // Check th exists and has th contents
        const thCount = await table.locator('th').count();
        expect(thCount).toBe(3);

        const firstTh = await table.locator('th').first().innerText();
        expect(firstTh).toBe('Client Name');

        // Check td exists and has td contents
        const tdCount = await table.locator('td').count();
        expect(tdCount).toBe(3);

        const firstTd = await table.locator('td').first().innerText();
        expect(firstTd).toBe('Sarah Chen');

        // Verify that the table computed white-space is 'normal'
        const whiteSpace = await table.evaluate(el => window.getComputedStyle(el).whiteSpace);
        expect(whiteSpace).toBe('normal');
    });
});
