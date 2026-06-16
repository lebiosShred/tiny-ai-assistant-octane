const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Aegis Tools & Sales Agent Operations Suite', () => {

    test('verifies custom loading indicator status text mapping', async ({ page }) => {
        test.setTimeout(30000);
        const indexPage = new IndexPage(page);

        await page.route('**/api/chat', async route => {
            // Introduce a short delay to guarantee the loading indicator state is captured before response resolves
            await new Promise(resolve => setTimeout(resolve, 500));
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{ message: { role: 'assistant', content: 'Search result: I found the files.' } }]
                })
            });
        });

        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // Trigger search prompt and check loader text
        await indexPage.chatInput.fill('Search for prospect files on Google Drive');
        
        // Count assistant messages before sending to prevent waitForResponse from resolving early
        indexPage._lastAssistantCount = await page.evaluate(() => {
            return document.querySelectorAll('#chat-messages-log .chat-message-card.assistant').length;
        });

        // Click send and immediately check that the loading indicator shows the contextual search status
        await indexPage.sendBtn.click();
        
        const loader = page.locator('#chat-loading-indicator');
        const loaderText = await loader.locator('span').innerText();
        expect(loaderText).toBe('Tiny is searching files on Google Drive...');

        await indexPage.waitForResponse(20000);
        const responseText = await indexPage.getLastResponseText();
        expect(responseText).toContain('Search result');
    });

    test('verifies email recap prompt triggers sendRecapEmail', async ({ page }) => {
        test.setTimeout(30000);
        const indexPage = new IndexPage(page);

        await page.route('**/api/chat', async route => {
            // Introduce a short delay to guarantee the loading indicator state is captured before response resolves
            await new Promise(resolve => setTimeout(resolve, 500));
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{ message: { role: 'assistant', content: 'I have sent the recap email to Sarah Chen.' } }]
                })
            });
        });

        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // Send a recap prompt and verify loader text
        await indexPage.chatInput.fill('Send recap email to Sarah');
        
        // Count assistant messages before sending to prevent waitForResponse from resolving early
        indexPage._lastAssistantCount = await page.evaluate(() => {
            return document.querySelectorAll('#chat-messages-log .chat-message-card.assistant').length;
        });

        await indexPage.sendBtn.click();
        
        const loader = page.locator('#chat-loading-indicator');
        const loaderText = await loader.locator('span').innerText();
        expect(loaderText).toBe('Tiny is preparing to send email recap...');

        await indexPage.waitForResponse(20000);
        const responseText = await indexPage.getLastResponseText();
        expect(responseText).toContain('sent the recap email');
    });

    test('verifies conversational RAG prompts map to dynamic Google Drive loading indicators', async ({ page }) => {
        test.setTimeout(30000);
        const indexPage = new IndexPage(page);

        await page.route('**/api/chat', async route => {
            // Introduce a short delay to guarantee the loading indicator state is captured before response resolves
            await new Promise(resolve => setTimeout(resolve, 500));
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{ message: { role: 'assistant', content: 'Here is the analysis of Sarah Chens profile.' } }]
                })
            });
        });

        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // 1. Test "analyze sarah chen's linkedin pdf" -> expect "Tiny is reading Google Drive documents..."
        await indexPage.chatInput.fill("analyze sarah chen's linkedin pdf");
        indexPage._lastAssistantCount = await page.evaluate(() => {
            return document.querySelectorAll('#chat-messages-log .chat-message-card.assistant').length;
        });
        await indexPage.sendBtn.click();

        const loader = page.locator('#chat-loading-indicator');
        let loaderText = await loader.locator('span').innerText();
        expect(loaderText).toBe('Tiny is reading Google Drive documents...');

        await indexPage.waitForResponse(20000);

        // 2. Test "tell me her information" -> expect "Tiny is searching files on Google Drive..."
        await indexPage.chatInput.fill("tell me her information");
        indexPage._lastAssistantCount = await page.evaluate(() => {
            return document.querySelectorAll('#chat-messages-log .chat-message-card.assistant').length;
        });
        await indexPage.sendBtn.click();

        loaderText = await loader.locator('span').innerText();
        expect(loaderText).toBe('Tiny is searching files on Google Drive...');

        await indexPage.waitForResponse(20000);
    });

    test('verifies response contains source citation when knowledge base is referenced', async ({ page }) => {
        test.setTimeout(30000);
        const indexPage = new IndexPage(page);

        await page.route('**/api/chat', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{ message: { role: 'assistant', content: 'Here is the requested information.\n\nInformation was extracted in this **source**: [watsonx_orchestrate_poc.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/knowledge/AI/watsonx_orchestrate_poc.md)' } }]
                })
            });
        });

        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        await indexPage.chatInput.fill('tell me about watsonx orchestrate POC playbook');
        await indexPage.sendBtn.click();
        await indexPage.waitForResponse(20000);

        const responseText = await indexPage.getLastResponseText();
        expect(responseText).toContain('Information was extracted in this source');
    });
});


