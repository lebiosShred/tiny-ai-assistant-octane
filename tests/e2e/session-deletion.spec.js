const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Aegis Chat Session Deletion Suite', () => {

    test('verifies hover-reveal deletion flow with confirmation modal', async ({ page }) => {
        test.setTimeout(45000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();

        // 1. Force the page to show the confirmation modal by overriding webdriver flags
        await page.evaluate(() => {
            window.__playwright_active = false;
            Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
        });

        // 2. Start a new session
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah.chen@meridianlogistics.com.au');
        
        // Save sources to create the session
        await indexPage.submitForm();
        
        // Confirm the save modal
        const modal = page.locator('#confirm-modal');
        await expect(modal).not.toHaveClass(/modal-hidden/);
        await page.click('#btn-submit-confirm');
        await expect(modal).toHaveClass(/modal-hidden/);

        // Wait for session initialization
        await indexPage.waitForChatInit();

        // Open the sidebar drawer so its child elements become visible
        await indexPage.toggleSourcesBtn.click();

        // 3. Click the prospect header to expand the sessions list under Sarah Chen
        const prospectHeader = page.locator('.sidebar-prospect-header[data-prospect-name="Sarah Chen"]').first();
        await prospectHeader.click();

        // 4. Locate the created session item under Meridian Logistics and get its unique ID
        const sessionItem = page.locator('[data-session-id^="synthesis_Meridian_Logistics_"]').first();
        await expect(sessionItem).toBeVisible();
        const sessionId = await sessionItem.getAttribute('data-session-id');
        expect(sessionId).toBeTruthy();

        // 5. Click the delete button on the session item (force click to bypass hover-reveal CSS block check)
        const delBtn = sessionItem.locator('.btn-delete-session');
        await expect(delBtn).toBeAttached();
        await delBtn.click({ force: true });

        // 6. Verify the delete confirmation modal pops up
        await expect(modal).not.toHaveClass(/modal-hidden/);
        const modalTitle = await page.locator('#confirm-modal-title').innerText();
        expect(modalTitle).toContain('Delete Chat Session');

        // 7. Click Cancel first to verify abort path
        await page.click('#btn-cancel-confirm');
        await expect(modal).toHaveClass(/modal-hidden/);
        // Session item should still exist
        await expect(sessionItem).toBeVisible();

        // 8. Click delete again and confirm
        await delBtn.click({ force: true });
        await expect(modal).not.toHaveClass(/modal-hidden/);
        await page.click('#btn-submit-confirm');
        await expect(modal).toHaveClass(/modal-hidden/);

        // 9. Verify the specific session item is removed from the DOM
        const deletedItem = page.locator(`[data-session-id="${sessionId}"]`);
        await expect(deletedItem).not.toBeVisible();
    });
});
