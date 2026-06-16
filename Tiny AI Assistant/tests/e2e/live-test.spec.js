const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Live Production E2E Suite - Conversational RAG & LLM Integration', () => {

    test('navigates and verifies natural conversational RAG prompts against live backend', async ({ page }) => {
        // Extend timeout for live LLM completions and tool executions
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);

        // 1. Navigate to the live production URL (configured via TEST_URL)
        await indexPage.goto();
        
        // 2. Start a new chat session
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // 3. Send: "analyze sarah chen's linkedin pdf"
        await indexPage.chatInput.fill("analyze sarah chen's linkedin pdf");
        
        // Capture message count to await the new card properly
        indexPage._lastAssistantCount = await page.evaluate(() => {
            return document.querySelectorAll('#chat-messages-log .chat-message-card.assistant').length;
        });

        // Click send and immediately check that the loading indicator shows the RAG read status
        await indexPage.sendBtn.click();
        
        const loader = page.locator('#chat-loading-indicator');
        const loaderText1 = await loader.locator('span').innerText();
        expect(loaderText1).toBe('Tiny is reading Google Drive documents...');

        // Wait for the live LLM completion (up to 60 seconds for tool recursions)
        await indexPage.waitForResponse(60000);
        const responseText1 = await indexPage.getLastResponseText();
        console.log('\n🤖 Live Response to "analyze sarah chen\'s linkedin pdf":');
        console.log(responseText1);
        
        expect(responseText1.length).toBeGreaterThan(10);
        expect(responseText1).not.toContain('[INSUFFICIENT_DATA_FOR_REPORT]');
 
        // 4. Send: "tell me her information"
        await indexPage.chatInput.fill("tell me her information");
        
        indexPage._lastAssistantCount = await page.evaluate(() => {
            return document.querySelectorAll('#chat-messages-log .chat-message-card.assistant').length;
        });
 
        // Click send and check search loading status
        await indexPage.sendBtn.click();
        
        const loaderText2 = await loader.locator('span').innerText();
        expect(loaderText2).toBe('Tiny is searching files on Google Drive...');
 
        // Wait for the live LLM completion
        await indexPage.waitForResponse(60000);
        const responseText2 = await indexPage.getLastResponseText();
        console.log('\n🤖 Live Response to "tell me her information":');
        console.log(responseText2);
        
        expect(responseText2.length).toBeGreaterThan(10);
    });
});
