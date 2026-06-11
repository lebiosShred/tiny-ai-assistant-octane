const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Tiny Assistant Identity Mismatch Containment Suite', () => {

    test('verifies frontend auto-sync is blocked when data.isMismatch is true', async ({ page }) => {
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        
        // Let's mock /api/chat response to return isMismatch: true and a new company name.
        await page.route('**/api/chat', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: 'I noticed an identity mismatch between NSW EPA and Acme Corp. Please clarify.'
                        }
                    }],
                    isMismatch: true,
                    metadata: {
                        company: 'Acme Corp',
                        name: 'Jane Doe',
                        email: 'jane@acme.com',
                        isMismatch: true
                    }
                })
            });
        });

        // Set initial metadata to NSW EPA
        await indexPage.fillMetadata('Jane Doe', 'NSW EPA', 'jane@nswepa.gov.au');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();

        // Close drawer to clear view
        await indexPage.closeDrawer();

        // Now send a message
        await indexPage.sendMessage('Hello Tiny, can you generate a proposal?');
        await indexPage.waitForResponse();

        // Let's assert that the active company in the UI was NOT updated to 'Acme Corp'
        // (Since auto-sync should have been blocked because isMismatch was true)
        const currentValues = await indexPage.getFormValues();
        expect(currentValues.company).toBe('NSW EPA');
        
        // Assert that the header still says NSW EPA
        const clientTitleText = await page.locator('#active-chat-client-title').innerText();
        expect(clientTitleText).toContain('NSW EPA');
        expect(clientTitleText).not.toContain('Acme Corp');
    });

    test('verifies client-side system prompt contains strict instructions under identity mismatch', async ({ page }) => {
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        
        // Fill form with mismatching info:
        // target company is NSW EPA
        await indexPage.fillMetadata('Jane Doe', 'NSW EPA', 'jane@nswepa.gov.au');
        // LinkedIn contains Acme Corp (mismatch)
        await page.fill('#source-linkedin-text', 'Jane Doe is a software engineer at Acme Corp.');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // Spy on the /api/chat request
        const [request] = await Promise.all([
            page.waitForRequest(req => req.url().includes('/api/chat') && req.method() === 'POST'),
            indexPage.sendMessage("Hello Tiny")
        ]);

        const payload = JSON.parse(request.postData() || '{}');
        const messages = payload.messages || [];
        const systemMsg = messages.find(m => m.role === 'system')?.content || '';

        // The system prompt should contain the mismatch details and the target company
        expect(systemMsg).toContain('NSW EPA');
        expect(systemMsg).toContain('Acme Corp');
    });

    test('verifies that selecting only the root company folder displays a placeholder and does not load files', async ({ page }) => {
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        
        // Wait for folders to load in the sidebar
        await page.waitForSelector('.sidebar-folder-header');
        
        // Click on the first company folder header
        await page.click('.sidebar-folder-header');
        
        // Assert that the sourcesList (Prospect Files section) shows the placeholder warning message
        const sourcesList = page.locator('#sources-list');
        await expect(sourcesList).toContainText('Please select a prospect subfolder from the sidebar to view documents.', { timeout: 15000 });
        
        // Assert that the GDrive dropdown shows "-- Select a prospect folder to see files --"
        const dropdown = page.locator('#source-gdrive-file');
        await expect(dropdown).toContainText('Select a prospect folder to see files', { timeout: 15000 });
    });
});
