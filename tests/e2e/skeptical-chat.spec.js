const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Tiny Assistant Skepticism & Hallucination Prevention E2E Suite', () => {

    test('verifies prompt skepticism rule (Rule 8) is injected and sent in API payload', async ({ page }) => {
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();

        // Close drawer to clear view
        await indexPage.closeDrawer();

        // Spy on the /api/chat outgoing request
        const [request] = await Promise.all([
            page.waitForRequest(req => req.url().includes('/api/chat') && req.method() === 'POST'),
            indexPage.sendMessage("I just had a talk with Sarah right now save the details.")
        ]);

        const payload = JSON.parse(request.postData() || '{}');
        const messages = payload.messages || [];
        const systemMsg = messages.find(m => m.role === 'system')?.content || '';

        // Assert that the client-side system prompt includes our skepticism guardrail rule
        expect(systemMsg).toContain('8. If the user');
        expect(systemMsg).toContain('MUST be skeptical');
        expect(systemMsg).toContain('Do NOT assume or fabricate');
    });

    test('verifies Tiny rejects ambiguous logging commands in live conversation and asks for details', async ({ page }) => {
        // Only run this in live integration test mode (when TEST_URL is configured)
        if (!process.env.TEST_URL) {
            test.skip();
            return;
        }
        
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();

        // Close drawer
        await indexPage.closeDrawer();

        // Send ambiguous call logging instruction
        await indexPage.sendMessage("tiny I just had a talk with Sarah right now save the details.");
        
        // Wait for response from live LLM (which should request clarification per Rule 8)
        await indexPage.waitForResponse(40000);
        const responseText = await indexPage.getLastResponseText();
        console.log('\n🤖 Live Skepticism Response:');
        console.log(responseText);

        // Verify the response is skeptical and does not report a successful log registration
        expect(responseText).not.toContain('successfully registered the new call');
        expect(responseText).not.toContain('Call Log Registered');
        
        // Assert that Tiny is asking for the specific details/notes of the talk
        const lowerResponse = responseText.toLowerCase();
        const containsClarificationRequest = 
            lowerResponse.includes('detail') || 
            lowerResponse.includes('notes') || 
            lowerResponse.includes('what did you') || 
            lowerResponse.includes('provide') ||
            lowerResponse.includes('discuss');
        expect(containsClarificationRequest).toBe(true);
    });
});
