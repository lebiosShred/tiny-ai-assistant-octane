const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Aegis v2 -- UX Enhancements E2E Tests', () => {

    test('verifies Clear All button empties staged files staging panel', async ({ page }) => {
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();

        // 1. Stage a mock file for upload
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#chat-attach-btn');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles([{
            name: 'test_prospect_doc.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('mock SOW document content')
        }]);

        // 2. Assert file chip is visible in staging panel
        const stagingPanel = page.locator('#chat-pending-attachments');
        await expect(stagingPanel).toBeVisible();
        await expect(stagingPanel).toContainText('test_prospect_doc.txt');

        // 3. Click Clear All button
        const clearAllBtn = page.locator('.btn-clear-all-staged');
        await expect(clearAllBtn).toBeVisible();
        await clearAllBtn.click();

        // 4. Assert staging panel is hidden and empty
        await expect(stagingPanel).toBeHidden();
        await expect(stagingPanel).toBeEmpty();
        console.log('✅ SUCCESS: Clear All staging queue button verified successfully!');
    });

    test('verifies calendar transition loading overlay displays on tab toggle', async ({ page }) => {
        // Go to booking page
        await page.goto('/book');
        
        const spinner = page.locator('#calendar-loading-spinner');
        const tabIsha = page.locator('#tab-isha');
        const tabAlbert = page.locator('#tab-albert');

        // 1. Verify spinner is initially visible or finishes load
        await expect(tabIsha).toBeVisible();
        
        // 2. Toggle to Isha and verify spinner shows
        await tabIsha.click();
        await expect(spinner).toBeVisible();

        // 3. Toggle back to Albert and verify spinner shows again
        await tabAlbert.click();
        await expect(spinner).toBeVisible();
        
        console.log('✅ SUCCESS: Calendar loading transition overlay verified successfully!');
    });
});
