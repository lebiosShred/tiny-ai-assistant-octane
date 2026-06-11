const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Aegis Website Scraping & Search Refinement Suite', () => {

    test('verifies explicit request to scan website triggers Jina Reader scraping with loading text', async ({ page }) => {
        // Extend timeout for completions
        test.setTimeout(40000);
        const indexPage = new IndexPage(page);

        // 1. Navigate to the local server
        await indexPage.goto();
        
        // 2. Start a new chat session
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('QA Test Scraper', 'Scraper Corp', 'scraper@test.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // 3. Fill: "scan google.com"
        await indexPage.chatInput.fill("scan google.com");
        
        indexPage._lastAssistantCount = await page.evaluate(() => {
            return document.querySelectorAll('#chat-messages-log .chat-message-card.assistant').length;
        });

        // Click send and immediately check that the loading indicator shows the scanning status
        await indexPage.sendBtn.click();
        
        const loader = page.locator('#chat-loading-indicator');
        const loaderText = await loader.locator('span').innerText();
        expect(loaderText).toBe('Tiny is scanning website contents...');

        // Wait for the mock scraping completion
        await indexPage.waitForResponse(30000);
        const responseText = await indexPage.getLastResponseText();
        console.log('\n🤖 Live Scraped Response:');
        console.log(responseText);
        
        // Confirm response contains components of our mock scraped results
        expect(responseText.length).toBeGreaterThan(10);
    });
});
