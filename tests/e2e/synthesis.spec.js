const { test, expect } = require('../fixtures/base');

/**
 * Aegis v2 -- Call Report Synthesis E2E Suite
 * Validates Google Drive list loading, file parsing, assistant prompt generation,
 * and client email recap dispatch triggers.
 */
test.describe('Aegis Synthesis E2E Suite', () => {

    test('Step 3: End-to-End Report Generation Pipeline, Google Drive & Email Dispatch UI Integrity', async ({ page }) => {
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

        // Mock GDrive and Chat Endpoints BEFORE goto
        await page.route('**/api/gdrive/list', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    items: [
                        { id: 'file-123', name: 'Lead_Intake_AECOM_Kyle_Fouche.pdf', size: 10240, isFolder: false }
                    ]
                })
            });
        });

        await page.route('**/api/gdrive/read*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'success',
                    content: 'This SOW covers TM1 Flight Check for AECOM.'
                })
            });
        });

        await page.route('**/api/chat', async route => {
            const request = route.request();
            const postData = JSON.parse(request.postData() || '{}');
            const messages = postData.messages || [];
            const userMsg = messages.find(m => m.role === 'user')?.content || '';

            let reply = 'Simulated assistant response';
            if (userMsg.includes('recap') || userMsg.includes('Recap')) {
                reply = `Here is your call summary and takeaways:
- Discussed TM1 Flight Check
- Estimated timeline: 6 days

Kind regards,
Albert`;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: reply
                        }
                    }]
                })
            });
        });

        await page.route('**/api/email/recap', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'success' })
            });
        });

        // Navigate to dashboard page
        await page.goto('/');
        await page.locator('body').waitFor({ state: 'attached' });

        // 1. Initialize new chat session
        await page.click('#btn-new-chat');
        await page.locator('#chat-messages-log').waitFor({ state: 'visible' });

        // 2. Open sources drawer and verify GDrive selector loads files
        await page.click('#btn-toggle-sources');
        await page.locator('#sources-drawer').waitFor({ state: 'visible' });

        // Wait for select files options to load
        await page.waitForFunction(
            () => document.querySelector('#source-gdrive-file').options.length > 1,
            { timeout: 10000 }
        );

        // Select the file and trigger change
        await page.selectOption('#source-gdrive-file', 'file-123');
        await page.evaluate(() => {
            document.querySelector('#source-gdrive-file').dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Fill form fields
        await page.evaluate(() => {
            document.querySelector('#meta-name').value = 'Kyle Fouche';
            document.querySelector('#meta-company').value = 'AECOM';
            document.querySelector('#meta-email').value = 'kyle.fouche@aecom.com';
            document.querySelector('#source-transcript-text').value = 'AECOM transcription details: Kyle is the main contact.';
            document.querySelector('#meta-name').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#meta-company').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#meta-email').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#source-transcript-text').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#btn-save-sources').click();
        });

        // Wait for chat workspace initialization to complete
        await page.waitForFunction(
            () => {
                const log = document.querySelector('#chat-messages-log');
                return log && log.innerText.includes('Chat session initialized');
            },
            { timeout: 15000 }
        );

        // 3. Trigger recap email generation in chat console
        await page.click('button[data-prompt-type="recapEmail"]');

        // Wait for recap email bubble with send recap action button to appear
        const sendRecapBtn = page.locator('button:has-text("✉️ Send Recap")');
        await expect(sendRecapBtn).toBeVisible({ timeout: 15000 });

        // 4. Click Send Recap and verify it changes state/shows success
        await sendRecapBtn.click();
        await page.waitForFunction(
            () => {
                const toast = document.querySelector('#toast');
                return toast && toast.classList.contains('show') && toast.innerText.includes('sent');
            },
            { timeout: 5000 }
        );

        const toastText = await page.locator('#toast').innerText();
        expect(toastText).toContain('email sent');
    });
});
