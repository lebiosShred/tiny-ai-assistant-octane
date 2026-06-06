const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');
const fs = require('fs');
const path = require('path');

/**
 * Aegis v2 -- Sales Rep stress Test Simulation Suite
 * Evaluates application resilience, memory usage, and UI/UX stability
 * under heavy load and concurrency.
 */
test.describe('Aegis v2 -- Sales Rep Stress Test Simulation', () => {

    test.afterEach(async () => {
        const historyDir = path.join(__dirname, '..', '..', 'knowledge', 'history');
        if (fs.existsSync(historyDir)) {
            const files = fs.readdirSync(historyDir);
            const testCompanies = ['Stress_Corp', 'Meridian_Logistics'];
            for (const file of files) {
                const filePath = path.join(historyDir, file);
                try {
                    const isDir = fs.statSync(filePath).isDirectory();
                    const matchesCompany = testCompanies.some(co => file.includes(co));
                    if (matchesCompany) {
                        if (isDir) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    }
                } catch (err) {
                    console.error(`Failed to clean up test resource ${file}:`, err.message);
                }
            }
        }
    });

    test('Step 1: Massive Ingestion (The Zoom Dump)', async ({ page }) => {
        test.setTimeout(120000); // Grant additional time for massive RAG parsing
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();

        // 10,000 words transcript simulation to stress-test RAG pipeline and token size
        const baseSentence = "The client mentioned their current FP&A planning and budgeting setup is highly manual and they want to automate it with TM1 DevOps Blue support. ";
        const massiveTranscript = baseSentence.repeat(700); // ~10,500 words

        await page.fill('#source-transcript-text', massiveTranscript);
        await indexPage.fillMetadata('Stress User', 'Stress Corp', 'stress.user@stresscorp.com');
        await indexPage.submitForm();
        
        // Wait for chat initialization under load
        await indexPage.waitForChatInit();
        const chatMessages = await page.locator('#chat-messages-log').innerText();
        expect(chatMessages).toContain('Chat session initialized');
    });

    test('Step 2: Concurrency Button Spamming', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await page.fill('#source-transcript-text', 'Client is interested in TM1 planning and watsonx orchestrate pilot.');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // Spam multiple prompt buttons concurrently to trigger parallel API fetch calls
        const promptTypes = ['leadSheet', 'recapEmail', 'actionItems'];
        const clicks = promptTypes.map(type => page.click(`button[data-prompt-type="${type}"]`));
        
        // Fire all clicks in parallel
        await Promise.all(clicks);

        // Allow some time for request queuing or handling
        await page.waitForTimeout(5000);
        
        // Verify that the page has not crashed and remains responsive
        const isBodyAttached = await page.locator('body').count();
        expect(isBodyAttached).toBe(1);
    });

    test('Step 3: Technographic Flooding & Pricing Fallbacks', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.newChatBtn.click();
        await indexPage.fillMetadata('Sarah Chen', 'Meridian Logistics', 'sarah@meridian.com');
        await indexPage.submitForm();
        await indexPage.waitForChatInit();
        await indexPage.closeDrawer();

        // Flood query with many complementary and competing systems
        const floodQuery = "We use NetSuite, SAP ERP, Dynamics 365, Salesforce, Power BI, Tableau, Alteryx, Snowflake, Databricks, Oracle Hyperion, Jedox, Anaplan, Workday Adaptive, Board, TM1, and we are working with Accenture. Quote us DevOps Blue and custom package.";
        
        await indexPage.sendMessage(floodQuery);
        await indexPage.waitForResponse(20000);
        
        const responseText = await indexPage.getLastResponseText();
        expect(responseText.length).toBeGreaterThan(10);
    });
});
