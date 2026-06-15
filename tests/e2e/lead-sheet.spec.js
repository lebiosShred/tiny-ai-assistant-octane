const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Aegis v2 -- Lead Sheet Button and Validation Flow', () => {

    test.beforeEach(async ({ page }) => {
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
                if (userMessage.includes('Generate A Lead Sheet')) {
                    reply = '=== LEAD SHEET ===\n1. Type of sale: AI\n2. Business activity: Scanned tech website.\n3. Customer match: Matches MidMarket AI.\n4. Assessment: Relates to watsonx POC.\n5. Conversation starter: 3 personal connection points.\n6. Complementary applications: SAP, NetSuite\n7. Competing applications: Anaplan\n8. Competing consulting firms: None mentioned.';
                } else {
                    reply = 'General response';
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

    test('verifies button visibility and validation behavior', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // 1. Initial State: Button should not exist because LinkedIn and Intake are empty
        const leadSheetBtn = page.locator('button[data-prompt-type="leadSheet"]');
        await expect(leadSheetBtn).toHaveCount(0);

        // 2. Populate LinkedIn Profile Bio: Button should appear dynamically
        await page.fill('#source-linkedin-text', 'Sarah Chen is Head of FP&A at Meridian Logistics.');
        await page.dispatchEvent('#source-linkedin-text', 'input');
        await expect(leadSheetBtn).toHaveCount(1);

        // 3. Clear LinkedIn Profile Bio: Button should disappear dynamically
        await page.fill('#source-linkedin-text', '');
        await page.dispatchEvent('#source-linkedin-text', 'input');
        await expect(leadSheetBtn).toHaveCount(0);

        // 4. Populate Booking Intake Answers: Button should appear dynamically
        await page.fill('#source-intake-text', 'Looking for financial reporting automation.');
        await page.dispatchEvent('#source-intake-text', 'input');
        await expect(leadSheetBtn).toHaveCount(1);

        // 5. Trigger Lead Sheet generation
        await leadSheetBtn.click();
        await indexPage.waitForResponse(20000);

        const responseText = await indexPage.getLastResponseText();
        expect(responseText).toContain('=== LEAD SHEET ===');
        expect(responseText.toLowerCase()).toContain('type of sale');
    });
});
