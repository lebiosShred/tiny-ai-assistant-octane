const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Aegis Chat Chronology E2E Suite', () => {

    test.beforeEach(async ({ page }) => {
        // Mock the file upload endpoint
        await page.route('**/api/gdrive/upload-stream', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    fileId: 'mock-gdrive-file-id-123',
                    parsedText: 'Mock resume/linkedin parsed text content for Sarah Chen.'
                })
            });
        });

        // Mock the chat history save endpoint (differentiating GET and POST)
        await page.route('**/api/history', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        id: 'mock-session-chat-id-xyz',
                        gDriveFolderId: 'mock-folder-id'
                    })
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([])
                });
            }
        });

        // Mock the chat LLM endpoint
        await page.route('**/api/chat', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: 'I have analyzed the uploaded document and updated the folder.'
                        }
                    }]
                })
            });
        });
    });

    test('Verifies user query appears BEFORE file upload notifications chronologically', async ({ page }) => {
        test.setTimeout(45000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();

        // 1. Initialize session using SDR Prep Briefing Form
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah.chen@meridianlogistics.com.au');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();

        // 2. Attach a mock file for uploading
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('#chat-attach-btn').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
            name: 'sarah-chen-linkedin-profile.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('dummy pdf content')
        });

        // 3. Type text query and click send
        const queryText = "tiny can you save these files to sarah chen's folder.";
        await indexPage.chatInput.fill(queryText);
        await indexPage.sendBtn.click();

        // 4. Wait for chat response stream to finish
        await indexPage.waitForResponse();

        // 5. Query and assert chronological sequencing in chat log
        const messageCards = page.locator('#chat-messages-log .chat-message-card');
        const count = await messageCards.count();
        
        // We expect at least 3 cards:
        // 1. User message card (with queryText)
        // 2. Assistant upload notification card
        // 3. Assistant AI response card
        expect(count).toBeGreaterThanOrEqual(3);

        const cardClasses = [];
        const cardTexts = [];
        for (let i = 0; i < count; i++) {
            const card = messageCards.nth(i);
            const className = await card.getAttribute('class');
            const text = await card.innerText();
            cardClasses.push(className);
            cardTexts.push(text);
        }

        console.log('Detected Chat Message Sequence:', cardTexts);

        // Find the index of the user message card containing our queryText
        const userMsgIndex = cardTexts.findIndex(text => text.includes(queryText));
        expect(userMsgIndex).toBeGreaterThan(-1);

        // Find the index of the upload system notification card
        const uploadNotificationIndex = cardTexts.findIndex(text => text.includes('[SYSTEM: Document Uploaded]'));
        expect(uploadNotificationIndex).toBeGreaterThan(-1);

        // Find the index of the AI response card
        const aiResponseIndex = cardTexts.findIndex(text => text.includes('I have analyzed the uploaded document'));
        expect(aiResponseIndex).toBeGreaterThan(-1);

        // Verify strict chronology: User Prompt -> System Upload Message -> AI Response
        expect(userMsgIndex).toBeLessThan(uploadNotificationIndex);
        expect(uploadNotificationIndex).toBeLessThan(aiResponseIndex);
    });
});
