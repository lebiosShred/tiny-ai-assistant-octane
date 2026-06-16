const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

test.describe('Aegis v2 -- Duplicate Prospect Alerts & Warning Badges', () => {

    test('verifies sidebar duplicate badges and confirm warning modal on saving similar names', async ({ page }) => {
        const indexPage = new IndexPage(page);

        // Mock history to return a prospect named Sarah_Chen
        await page.route('**/api/history', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        {
                            id: 'synthesis_Sarah_Chen_123456',
                            type: 'synthesis',
                            name: 'Sarah_Chen',
                            company: 'Meridian Logistics',
                            date: new Date().toISOString()
                        }
                    ])
                });
            } else {
                await route.fallback();
            }
        });

        // Mock GDrive list to return two subfolders for Sarah_Chen and Sarah Chen
        await page.route('**/api/gdrive/list**', async route => {
            const url = route.request().url();
            if (url.includes('folderId=')) {
                // Return subfolders inside Meridian Logistics
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: [
                            {
                                id: 'gdrive_subfolder_sarah_chen_1',
                                name: 'Sarah_Chen',
                                isFolder: true,
                                mimeType: 'application/vnd.google-apps.folder'
                            },
                            {
                                id: 'gdrive_subfolder_sarah_chen_2',
                                name: 'Sarah Chen',
                                isFolder: true,
                                mimeType: 'application/vnd.google-apps.folder'
                            }
                        ]
                    })
                });
            } else {
                // Return root client folders
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: [
                            {
                                id: 'gdrive_company_meridian_logistics',
                                name: 'Meridian Logistics',
                                isFolder: true,
                                mimeType: 'application/vnd.google-apps.folder'
                            }
                        ]
                    })
                });
            }
        });

        await indexPage.goto();

        // 1. Assert sidebar folder expansion and duplicate flagging
        await page.waitForSelector('.sidebar-folder-header');
        // Click on the company folder header to fetch and render subfolders
        await page.click('.sidebar-folder-header');
        
        // Wait for subfolder rendering
        await page.waitForSelector('.sidebar-prospect-header');
        
        // Verify duplicates are merged into a single node
        const headers = page.locator('.sidebar-prospect-header');
        await expect(headers).toHaveCount(1);
        await expect(headers.first()).toContainText('Sarah Chen');
        
        // Verify no duplicate warnings render in the sidebar since they are merged
        const warningBadges = page.locator('.prospect-duplicate-warning');
        await expect(warningBadges).toHaveCount(0);

        // 2. Open drawer and fill details for Sarah Chen under Meridian Logistics to trigger duplicate warning
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await page.evaluate(() => window.__test_force_duplicate_warning = true);
        await indexPage.submitForm();

        // The custom warning modal should be triggered
        const confirmModal = page.locator('#confirm-modal');
        await expect(confirmModal).not.toHaveClass(/modal-hidden/);

        const modalTitle = page.locator('#confirm-modal-title');
        await expect(modalTitle).toHaveText('⚠️ Duplicate Prospect Warning');

        const modalMessage = page.locator('#confirm-modal-message');
        await expect(modalMessage).toContainText('already exists under "Meridian Logistics"');

        // Cancel saving and verify modal closes
        await page.click('#btn-cancel-confirm');
        await expect(confirmModal).toHaveClass(/modal-hidden/);
    });

    test('verifies cross-company duplicate warnings and company suffixes in sidebar', async ({ page }) => {
        const indexPage = new IndexPage(page);

        // Mock history to return a prospect named Sarah Chen under Meridian Logistics
        await page.route('**/api/history', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        {
                            id: 'synthesis_Sarah_Chen_123456',
                            type: 'synthesis',
                            name: 'Sarah Chen',
                            company: 'Meridian Logistics',
                            date: new Date().toISOString()
                        }
                    ])
                });
            } else {
                await route.fallback();
            }
        });

        // Mock GDrive list to return company folders and subfolders
        await page.route('**/api/gdrive/list**', async route => {
            const url = route.request().url();
            if (url.includes('folderId=gdrive_company_acme_corp')) {
                // Return Sarah Chen subfolder under Acme Corp
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: [
                            {
                                id: 'gdrive_subfolder_sarah_chen_acme',
                                name: 'Sarah Chen',
                                isFolder: true,
                                mimeType: 'application/vnd.google-apps.folder'
                            }
                        ]
                    })
                });
            } else if (url.includes('folderId=gdrive_company_meridian_logistics')) {
                // Return Sarah Chen subfolder under Meridian Logistics
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: [
                            {
                                id: 'gdrive_subfolder_sarah_chen_meridian',
                                name: 'Sarah Chen',
                                isFolder: true,
                                mimeType: 'application/vnd.google-apps.folder'
                            }
                        ]
                    })
                });
            } else {
                // Return root client company folders
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: [
                            {
                                id: 'gdrive_company_acme_corp',
                                name: 'Acme Corp',
                                isFolder: true,
                                mimeType: 'application/vnd.google-apps.folder'
                            },
                            {
                                id: 'gdrive_company_meridian_logistics',
                                name: 'Meridian Logistics',
                                isFolder: true,
                                mimeType: 'application/vnd.google-apps.folder'
                            }
                        ]
                    })
                });
            }
        });

        await indexPage.goto();

        // Expand both folders in sidebar to trigger loading
        await page.waitForSelector('.sidebar-folder-header');
        
        const headers = page.locator('.sidebar-folder-header');
        await expect(headers).toHaveCount(2);

        // Click first (Acme Corp) and second (Meridian Logistics) to expand them
        await headers.nth(0).click();
        await headers.nth(1).click();

        // Wait for subfolder rendering
        await page.waitForSelector('.sidebar-prospect-header');

        // Verify the names are clarified with company suffixes in the sidebar
        const prospectHeaders = page.locator('.sidebar-prospect-header');
        await expect(prospectHeaders).toHaveCount(2);
        
        await expect(prospectHeaders.nth(0)).toContainText('Sarah Chen (Acme Corp)');
        await expect(prospectHeaders.nth(1)).toContainText('Sarah Chen (Meridian Logistics)');

        // Now trigger cross-company duplicate creation warning
        await indexPage.newChatBtn.click();
        // Try creating Sarah Chen under Acme Corp (she already exists under Meridian Logistics in history)
        await indexPage.fillMetadata('Sarah Chen', 'Acme Corp', 'sarah@acme.com');
        await page.evaluate(() => window.__test_force_duplicate_warning = true);
        await indexPage.submitForm();

        // Verify modal warning shows the cross-company message
        const confirmModal = page.locator('#confirm-modal');
        await expect(confirmModal).not.toHaveClass(/modal-hidden/);

        const modalMessage = page.locator('#confirm-modal-message');
        await expect(modalMessage).toContainText('already exists under "Meridian Logistics"');
        await expect(modalMessage).toContainText('Are you sure this is a different person');

        // Cancel saving and verify modal closes
        await page.click('#btn-cancel-confirm');
        await expect(confirmModal).toHaveClass(/modal-hidden/);
    });
});
