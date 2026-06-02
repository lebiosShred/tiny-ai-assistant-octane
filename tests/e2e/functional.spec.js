const { test, expect } = require('../fixtures/base');
const { IndexPage } = require('../pages/IndexPage');
const { BookPage } = require('../pages/BookPage');
const { DocsPage } = require('../pages/DocsPage');
/**
 * Aegis v2 -- Core Functional E2E Test Suite
 */
test.describe('Aegis Functional E2E Suite', () => {

    test.beforeEach(async ({ page }) => {
        if (!process.env.TEST_URL) {
            await page.route('**/api/chat', async route => {
                const mockContent = `
[DOCUMENT: DOSSIER]
<p>Mocked dossier content for deterministic testing.</p>
[DOCUMENT: QUESTIONS A]
<ol><li>Q1</li><li>Q2</li><li>Q3</li><li>Q4</li><li>Q5</li></ol>
[DOCUMENT: QUESTIONS B]
<ol><li>Q1</li><li>Q2</li><li>Q3</li><li>Q4</li><li>Q5</li><li>Q6</li><li>Q7</li><li>Q8</li><li>Q9</li><li>Q10</li></ol>
                `;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        choices: [{ message: { role: 'assistant', content: mockContent } }]
                    })
                });
            });
        }
    });

    test('SDR Prep Briefing form submission generates valid dossier', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.loadSample();

        // Wait for the asynchronous fetch to populate the form fields
        await page.waitForFunction(() => document.querySelector('#prep-name').value !== '', { timeout: 10000 });

        const values = await indexPage.getFormValues();
        expect(values.name.length).toBeGreaterThan(0);
        expect(values.company.length).toBeGreaterThan(0);

        await indexPage.submitForm();
        await indexPage.waitForDossier(20000);

        const dossierText = await indexPage.getDossierText();
        expect(dossierText.length).toBeGreaterThan(50);

        // Attach extracted dossier for downstream judge consumption
        test.info().annotations.push({
            type: 'dossier',
            description: dossierText.substring(0, 2000),
        });
    });

    test('Variant B enforces exactly 10 questions', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.loadSample();
        await page.waitForFunction(() => document.querySelector('#prep-name').value !== '', { timeout: 10000 });
        await indexPage.submitForm();
        await indexPage.waitForDossier(20000);
        await indexPage.goToPlaybook();
        await indexPage.switchVariant('B');

        // Wait for Variant B to specifically finish loading (10 questions total)
        await page.waitForFunction(
            () => {
                const el = document.querySelector('#teleprompter-counter');
                return el && el.innerText.includes('10');
            },
            { timeout: 5000 }
        );

        const count = await indexPage.getQuestionCount();
        expect(count).toBe(10);
    });

    test('Variant B contains no italicized tips', async ({ page }) => {
        test.setTimeout(60000);
        const indexPage = new IndexPage(page);
        await indexPage.goto();
        await indexPage.loadSample();
        await page.waitForFunction(() => document.querySelector('#prep-name').value !== '', { timeout: 10000 });
        await indexPage.submitForm();
        await indexPage.waitForDossier(20000);
        await indexPage.goToPlaybook();
        await indexPage.switchVariant('B');

        await page.waitForFunction(
            () => {
                const el = document.querySelector('#teleprompter-counter');
                return el && /\d+/.test(el.innerText);
            },
            { timeout: 5000 }
        );

        const hasItalics = await indexPage.hasItalicizedTips();
        expect(hasItalics).toBe(false);
    });

    test('AI Solutions booking routes directly to Steny', async ({ page }) => {
        const bookPage = new BookPage(page);
        await bookPage.goto();
        await bookPage.selectMeetingType('AI Solutions Discussion | 45 mins');

        // Wait for dynamic host update
        await page.waitForFunction(
            () => {
                const el = document.querySelector('#hosts-display-subtitle');
                return el && el.innerText.includes('Steny');
            },
            { timeout: 5000 }
        );

        const host = await bookPage.getHostDetails();
        expect(host.subtitle).toContain('Steny');
        expect(host.title).toContain('Host');
    });

    test('Documentation page contains Tiny AI Assistant branding', async ({ page }) => {
        const docsPage = new DocsPage(page);
        await docsPage.goto();

        // Check logo text span and page content for branding
        const logoText = await page.locator('.logo-text').first().innerText();
        expect(logoText).toContain('Tiny AI Assistant');
    });
});
