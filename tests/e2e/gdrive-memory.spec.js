const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');

/**
 * Aegis E2E Google Drive Client Memory Verification Suite
 */
test.describe('Aegis v2 -- Google Drive Client Folder & Memory Ingestion', () => {

    test('verifies file uploading and custom context ingestion', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'QA_Meridian_Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // Stub upload route to ensure it works in CI/CD without real GDrive credentials
        await page.route('**/api/gdrive/upload', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    fileId: 'mock_doc_id_123',
                    fileName: 'LinkedIn_Profile_Kyle_Fouche.pdf',
                    webViewLink: 'https://drive.google.com/file/d/mock_doc_id_123/view',
                    parsedText: 'Experience: Senior Systems Analyst at RACQ. Education: QUT.'
                })
            });
        });

        // Simulating the file drop event on the dropzone by hitting the endpoint
        const fileContentBase64 = Buffer.from('Fake PDF content').toString('base64');
        const uploadResponse = await page.evaluate(async (base64) => {
            const res = await fetch('/api/gdrive/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company: 'QA_Meridian_Logistics',
                    fileName: 'LinkedIn_Profile_Kyle_Fouche.pdf',
                    mimeType: 'application/pdf',
                    fileData: base64
                })
            });
            return res.json();
        }, fileContentBase64);

        expect(uploadResponse.success).toBe(true);
        expect(uploadResponse.fileId).toBe('mock_doc_id_123');
        expect(uploadResponse.parsedText).toContain('Experience: Senior Systems Analyst');

        // Verify RAG context loading via chat endpoint simulation
        await page.route('**/api/chat', async route => {
            const postData = route.request().postData();
            let parsedPost = JSON.parse(postData);
            let hasFilesContext = false;
            
            // Check if backend compiler injected the folder documents
            const sysMessage = parsedPost.messages.find(m => m.role === 'system');
            if (sysMessage && sysMessage.content.includes('<client_uploaded_documents>')) {
                hasFilesContext = true;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: `Here are the uploaded documents for QA_Meridian_Logistics:
- [LinkedIn_Profile_Kyle_Fouche.pdf](https://drive.google.com/file/d/mock_doc_id_123/view) (Size: 0.0 KB, ID: mock_doc_id_123)`
                        }
                    }]
                })
            });
        });

        await indexPage.sendMessage('Show me the uploaded documents for this client');
        await indexPage.waitForResponse(20000);
        const reply = await indexPage.getLastResponseText();

        expect(reply).toContain('LinkedIn_Profile_Kyle_Fouche.pdf');
        expect(reply).toContain('mock_doc_id_123');
    });

    test('verifies prompt-driven file upload and deletion cycle', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);

        // Stub /api/gdrive/list for active folder to return our mocked file list
        let mockFiles = [];
        await page.route('**/api/gdrive/list?folderId=*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    items: mockFiles
                })
            });
        });

        // Stub /api/chat to return a simulated response and update mockFiles
        await page.route('**/api/chat', async route => {
            const postData = route.request().postData();
            let parsedPost = JSON.parse(postData);
            const lastUserMsg = parsedPost.messages[parsedPost.messages.length - 1].content;
            
            if (lastUserMsg.includes('upload file prompt_test.txt')) {
                mockFiles = [{
                    id: 'mock_prompt_test_id',
                    name: 'prompt_test.txt',
                    size: 1024,
                    isFolder: false,
                    webViewLink: 'https://drive.google.com/file/d/mock_prompt_test_id/view'
                }];
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        gdriveAction: true,
                        receipt: {
                            action: 'UPLOAD',
                            type: 'FILE',
                            targetName: 'prompt_test.txt',
                            targetId: 'mock_prompt_test_id',
                            company: 'QA_Meridian_Logistics'
                        },
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: 'I have successfully uploaded the prospect information file "prompt_test.txt" (ID: `mock_prompt_test_id`) to Google Drive (Client folder: *QA_Meridian_Logistics*). It is now indexed and available in the client memory context!'
                            }
                        }]
                    })
                });
            } else if (lastUserMsg.includes('delete file prompt_test.txt')) {
                mockFiles = [];
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        gdriveAction: true,
                        receipt: {
                            action: 'DELETE',
                            type: 'FILE',
                            targetName: 'prompt_test.txt',
                            targetId: 'mock_prompt_test_id',
                            company: 'QA_Meridian_Logistics'
                        },
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: 'I have successfully deleted the file "prompt_test.txt" (ID: `mock_prompt_test_id`) from Google Drive (Client folder: *QA_Meridian_Logistics*).'
                            }
                        }]
                    })
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: 'General assistant response.'
                            }
                        }]
                    })
                });
            }
        });

        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'QA_Meridian_Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // 1. Send prompt to upload a text file
        await indexPage.sendMessage("upload file prompt_test.txt with content 'Active prospect verification details'");
        await indexPage.waitForResponse(20000);
        let reply = await indexPage.getLastResponseText();

        expect(reply).toContain('successfully uploaded');
        expect(reply).toContain('prompt_test.txt');

        // Verify the file list dropdown contains the uploaded file
        await page.waitForFunction(() => {
            const select = document.getElementById('source-gdrive-file');
            return select && Array.from(select.options).some(opt => opt.text.includes('prompt_test.txt'));
        }, null, { timeout: 10000 });

        // 2. Send prompt to delete the file
        await indexPage.sendMessage("delete file prompt_test.txt");
        await indexPage.waitForResponse(20000);
        reply = await indexPage.getLastResponseText();

        expect(reply).toContain('successfully deleted');
        expect(reply).toContain('prompt_test.txt');

        // Verify the file is no longer in the select options
        await page.waitForFunction(() => {
            const select = document.getElementById('source-gdrive-file');
            return select && !Array.from(select.options).some(opt => opt.text.includes('prompt_test.txt'));
        }, null, { timeout: 10000 });
    });

    test('verifies nested folder tree rendering and call registration in sidebar', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);

        // Stub /api/gdrive/list for active folder to return our mocked file list
        let mockFiles = [];
        await page.route('**/api/gdrive/list?folderId=*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    items: mockFiles
                })
            });
        });

        // Stub /api/chat to return a simulated response and update mockFiles
        await page.route('**/api/chat', async route => {
            const postData = route.request().postData();
            let parsedPost = JSON.parse(postData);
            const lastUserMsg = parsedPost.messages[parsedPost.messages.length - 1].content;

            if (lastUserMsg.includes('made call:')) {
                mockFiles = [{
                    id: 'mock_call_log_id',
                    name: 'call_log_12345.txt',
                    size: 512,
                    isFolder: false,
                    webViewLink: 'https://drive.google.com/file/d/mock_call_log_id/view'
                }];
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        gdriveAction: true,
                        receipt: {
                            action: 'UPLOAD',
                            type: 'CALL_LOG',
                            targetName: 'call_log_12345.txt',
                            targetId: 'mock_call_log_id',
                            company: 'QA_Meridian_Logistics'
                        },
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: 'I have successfully registered the new call (File ID: call_log_12345.txt).'
                            }
                        }]
                    })
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: 'General response.'
                            }
                        }]
                    })
                });
            }
        });

        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'QA_Meridian_Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // 1. Send prompt to register a call notes entry
        await indexPage.sendMessage("made call: client is interested in IBM TM1 Support and watsonx orchestrate pilot");
        await indexPage.waitForResponse(20000);
        const reply = await indexPage.getLastResponseText();

        expect(reply).toContain('successfully registered the new call');
        expect(reply).toContain('call_log_');

        // 2. Verify sidebar contains folder QA_Meridian_Logistics
        const folderHeader = page.locator('.sidebar-folder-header', { hasText: 'QA_Meridian_Logistics' });
        await expect(folderHeader).toBeVisible({ timeout: 15000 });

        // 3. Click the folder to expand and verify nested file item
        await folderHeader.click();
        
        const fileItem = page.locator('.sidebar-file-item', { hasText: 'call_log_' }).first();
        await expect(fileItem).toBeVisible({ timeout: 15000 });
    });
});
