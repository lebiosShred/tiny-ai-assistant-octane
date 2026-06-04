const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

/**
 * Aegis E2E Focus Prompts Verification Suite
 * 
 * Verifies the correctness, formatting, and content resolution of focus prompts:
 * - Leads List Table
 * - Sale Type Identification (TM1 vs AI)
 * - Geolocated Business Activity
 * - Customer Profile Match
 * - Service Track Assessment
 * - News-based Conversation Starters
 */
test.describe('Aegis v2 -- Focus Prompts Validation', () => {

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
                } else if (userMessage.includes('Identify the type of sale')) {
                    reply = 'The type of sale is TM1 planning analytics based on the active Service Track.';
                } else if (userMessage.includes('Business activity')) {
                    reply = '**Industry Sector:** Logistics\n**Description:** Freight and distribution provider.\n**Headcount:** ~500 employees.\n**Revenue:** A$120M.\n**Products and Services:**\n- Custom Freight Routing: One-sentence routing description.\n- Warehousing: One-sentence storage description.';
                } else if (userMessage.includes('Customer match')) {
                    reply = 'Matches Large/Mid TM1 Shop customer profile. Similar active client served in the past: Steric.';
                } else if (userMessage.includes('Assessment')) {
                    reply = 'Relates to TM1 upgrade pipeline. Recommended services: DevOps Blue Support (A$4,560/month) and TM1 Flight Check (A$27,360).\nLikely Pain Points:\n1. Spreadsheet limits\n2. RAM bottlenecks\n3. Manual reconciliation';
                } else if (userMessage.includes('Conversation starter')) {
                    reply = 'Opener 1: Congratulate Sarah on her tenure at Meridian.\nOpener 2: Address the recent growth of Meridian Logistics in Melbourne.\nOpener 3: Mention our past TM1 optimization work at Steric.';
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

    test('verifies "Show me the list of leads" renders markdown table', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        await indexPage.sendMessage('Show me the list of leads');
        await indexPage.waitForResponse(20000);
        const responseText = await indexPage.getLastResponseText();
        
        expect(responseText).toContain('Sarah Chen');
        expect(responseText).toContain('Meridian Logistics');
        expect(responseText).toContain('|');
    });

    test('verifies "Identify the type of sale" prompt accuracy', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        await indexPage.sendMessage('Identify the type of sale');
        await indexPage.waitForResponse(20000);
        const responseText = await indexPage.getLastResponseText();
        
        expect(responseText).toContain('sale is TM1');
    });

    test('verifies geolocated "Business activity" extraction output', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        await indexPage.sendMessage('Business activity');
        await indexPage.waitForResponse(20000);
        const responseText = await indexPage.getLastResponseText();
        
        expect(responseText).toContain('Logistics');
        expect(responseText).toContain('Revenue');
        expect(responseText).toContain('Headcount');
    });

    test('verifies playbook "Customer match" analysis', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        await indexPage.sendMessage('Customer match');
        await indexPage.waitForResponse(20000);
        const responseText = await indexPage.getLastResponseText();
        
        expect(responseText).toContain('Steric');
        expect(responseText).toContain('TM1 Shop');
    });

    test('verifies "Assessment" relating business to TM1/AI services', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        await indexPage.sendMessage('Assessment');
        await indexPage.waitForResponse(20000);
        const responseText = await indexPage.getLastResponseText();
        
        expect(responseText).toContain('DevOps Blue Support');
        expect(responseText).toContain('TM1 Flight Check');
        expect(responseText).toContain('bottlenecks');
    });

    test('verifies LinkedIn and website based "Conversation starter" options', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        await indexPage.sendMessage('Conversation starter');
        await indexPage.waitForResponse(20000);
        const responseText = await indexPage.getLastResponseText();
        
        expect(responseText).toContain('Opener 1');
        expect(responseText).toContain('Sarah');
        expect(responseText).toContain('Steric');
    });
});
