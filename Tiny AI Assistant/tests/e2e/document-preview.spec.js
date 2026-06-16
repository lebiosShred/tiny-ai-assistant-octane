const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Aegis Document Preview Card Spec', () => {

    test.beforeEach(async ({ page }) => {
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

        // Mock the gdrive list endpoint to return a mock empty list
        await page.route('**/api/gdrive/list', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ items: [] })
            });
        });

        // Intercept and stub the API completion response to return a document block
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

            if (userMessage.includes('generate a recap email')) {
                reply = `
Here is the email recap for our session:

[DOCUMENT: Recap Email]
Subject: Observations from our session
To: audrey.chan@erwentsearch.com.au
Body:
Hi Audrey,

Thanks for your time. Here are my key takeaways:
1. Your FP&A team uses TM1.
2. You want to explore AI.

Kind regards,
Anthony
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
    });

    test('verifies document tags are parsed into premium preview cards and copy buttons hold correct data', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Audrey Chan', 'Erwent Search', 'audrey.chan@erwentsearch.com.au');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // Send message to trigger recap email document card
        await indexPage.sendMessage('Please generate a recap email');
        await indexPage.waitForResponse(20000);

        // Verify card elements exist
        const card = page.locator('#chat-messages-log .document-preview-card');
        await expect(card).toBeVisible();

        const badge = card.locator('.doc-badge');
        await expect(badge).toHaveText('Recap Email');

        const subjectVal = card.locator('.meta-field:has-text("Subject:") .meta-value');
        await expect(subjectVal).toHaveText('Observations from our session');

        const toVal = card.locator('.meta-field:has-text("To:") .meta-value');
        await expect(toVal).toHaveText('audrey.chan@erwentsearch.com.au');

        // Check content of card body
        const cardBody = card.locator('.card-body');
        await expect(cardBody).toContainText('Thanks for your time. Here are my key takeaways:');
        await expect(cardBody).toContainText('Your FP&A team uses TM1.');

        // Verify copy buttons are visible
        const btnCopySubject = card.locator('.doc-btn-copy-subject');
        await expect(btnCopySubject).toBeVisible();
        const dataSubject = await btnCopySubject.getAttribute('data-subject');
        expect(decodeURIComponent(dataSubject)).toBe('Observations from our session');

        const btnCopyBody = card.locator('.doc-btn-copy-body');
        await expect(btnCopyBody).toBeVisible();
        const dataBody = await btnCopyBody.getAttribute('data-body');
        expect(decodeURIComponent(dataBody)).toContain('Hi Audrey,');
        expect(decodeURIComponent(dataBody)).toContain('Your FP&A team uses TM1.');

        const btnCopyDoc = card.locator('.doc-btn-copy-doc');
        await expect(btnCopyDoc).toBeVisible();
        const dataDoc = await btnCopyDoc.getAttribute('data-doc');
        expect(decodeURIComponent(dataDoc)).toContain('Subject: Observations from our session');
        expect(decodeURIComponent(dataDoc)).toContain('To: audrey.chan@erwentsearch.com.au');
    });
});
