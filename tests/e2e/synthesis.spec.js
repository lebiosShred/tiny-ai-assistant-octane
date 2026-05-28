const { test, expect } = require('../fixtures/base');

/**
 * Aegis v2 -- Call Report Synthesis E2E Suite
 * Thoroughly validates the entire Step 3 reports pipeline, navigation, UI states,
 * and individual document tab rendering.
 */
test.describe('Aegis Synthesis E2E Suite', () => {

    test('Step 3: End-to-End Report Generation Pipeline, Tab Navigation, and UI Integrity', async ({ page }) => {
        await page.goto('/');
        await page.locator('body').waitFor({ state: 'attached' });

        // Step 1: Route interceptor mapping mock API responses to Mistral choices format
        await page.route('**/api/chat', async route => {
            const request = route.request();
            const postData = JSON.parse(request.postData() || '{}');
            const messages = postData.messages || [];
            const systemMessage = messages.find(m => m.role === 'system')?.content || '';
            
            if (systemMessage.includes('research') || systemMessage.includes('brief') || systemMessage.includes('dossier')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: `
### PAIN POINTS
- Highly manual workflow processes
- Scalability bottlenecks in existing TM1 instances
### CONVERSATION STARTERS
- "How do you currently handle manual syncs?"
- "What issues are you seeing with TM1 sizing limits?"
                                `
                            }
                        }]
                    })
                });
            } else if (systemMessage.includes('Synthesizer') || systemMessage.includes('operations') || systemMessage.includes('synth')) {
                // Return a raw delimited string of documents exactly matching parseSynthesisResponse expectations
                const mockOutputText = `
[DOCUMENT: QUESTIONNAIRE_ANSWERS]
<h3>1. Questionnaire Answers</h3><p>Prospect verified manual spreadsheets are a major bottleneck.</p><ul><li>Active TM1 databases: 4</li><li>Users affected: 15</li></ul>

[DOCUMENT: SUMMARY]
<h4>QUALIFICATION SCORE: HOT</h4>
<p><strong>SCORING RATIONALE:</strong> The prospect has a clear budget and urgent timeline.</p>
<p><strong>RECOMMENDED NEXT STEP:</strong> Schedule deep dive.</p>
<p><strong>RED FLAGS:</strong> None.</p>

[DOCUMENT: MIGRATION_REPORT]
<h3>3. Migration Report</h3><p>Direct migration pathway determined to be highly viable.</p>

[DOCUMENT: RECAP_EMAIL]
<h3>4. Client Recap Email</h3><p>Dear Sarah, thank you for outlining your TM1 pain points...</p>

[DOCUMENT: SUMMARY_SHEET]
<h3>5. Summary Sheet</h3><p>Enterprise data transition project metrics...</p>

[DOCUMENT: NOTES]
<h3>6. Meeting Notes</h3><p>Prospect was very receptive to Steny AI capabilities.</p>

[DOCUMENT: PROPOSAL]
<h3>7. Consultative Proposal</h3><p>Steny AI proposed migration plan and commercial options...</p>

[DOCUMENT: ACTION_ITEMS]
<h3>8. Action Items</h3><p>Send calendar invite for next session.</p>
                `;

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: mockOutputText
                            }
                        }]
                    })
                });
            } else {
                await route.continue();
            }
        });

        // 1. Advance through Step 1 (Dossier Generation)
        await page.evaluate(() => {
            document.querySelector('#prep-name').value = 'Sarah Chen';
            document.querySelector('#prep-company').value = 'Meridian Logistics';
            document.querySelector('#prep-email').value = 'sarah.chen@meridianlogistics.com.au';
            document.querySelector('#prep-phone').value = '+61 2 9876 5432';
            
            document.querySelector('#prep-name').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#prep-company').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#prep-email').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#prep-phone').dispatchEvent(new Event('input', { bubbles: true }));
            
            document.querySelector('#prep-submit-btn').click();
        });

        // Wait for dossier to complete and render in right panel
        await page.locator('#output-doc-content').waitFor({ state: 'visible', timeout: 15000 });
        await expect(page.locator('#output-doc-content')).toContainText('PAIN POINTS');

        // 2. Navigate to Step 2 (Session)
        await page.evaluate(() => {
            document.querySelector('#step-1-next-btn').click();
        });
        await expect(page.locator('#step-2-content')).toHaveClass(/active/);

        // 3. Bypass Step 2 booking validation and navigate to Step 3 (Reports)
        await page.evaluate(() => {
            const btn = document.querySelector('#positional-confirm-btn');
            if (btn) {
                btn.disabled = true;
            }
            document.querySelector('#step-2-next-btn').click();
        });
        await expect(page.locator('#step-3-content')).toHaveClass(/active/);

        // 4. Fill in transcript data and trigger synthesis
        const sampleTranscript = `
        Sarah Chen: We are using 4 legacy TM1 databases. They are extremely slow.
        Albert: Let's run a complete migration report.
        Sarah Chen: Manual spreadsheets are taking 15 hours per week.
        `;

        await page.evaluate((transcriptText) => {
            document.querySelector('#synth-transcript').value = transcriptText;
            document.querySelector('#synth-transcript').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#synth-submit-btn').click();
        }, sampleTranscript);

        // 5. Assert the focus stays on Step 3 and the reports container is visible
        const step3Content = page.locator('#step-3-content');
        await expect(step3Content).toHaveClass(/active/);

        const step2Content = page.locator('#step-2-content');
        await expect(step2Content).not.toHaveClass(/active/);

        const outputResults = page.locator('#output-results');
        await expect(outputResults).toBeVisible();

        const outputDocNav = page.locator('#output-doc-nav');
        await expect(outputDocNav).toBeVisible();

        // 6. Deep Tab Verification: Step through every report type and assert DOM content updates correctly
        const outputDocContent = page.locator('#output-doc-content');

        // Tab 1: Questionnaire Answers
        await page.click('button[data-doc="questionnaireAnswers"]');
        await expect(page.locator('button[data-doc="questionnaireAnswers"]')).toHaveClass(/active/);
        await expect(outputDocContent).toContainText('Prospect verified manual spreadsheets');
        await expect(outputDocContent).toContainText('Active TM1 databases: 4');

        // Tab 2: Migration Report
        await page.click('button[data-doc="migrationReport"]');
        await expect(page.locator('button[data-doc="migrationReport"]')).toHaveClass(/active/);
        await expect(outputDocContent).toContainText('Direct migration pathway determined');

        // Tab 3: Recap Email
        await page.click('button[data-doc="recapEmail"]');
        await expect(page.locator('button[data-doc="recapEmail"]')).toHaveClass(/active/);
        await expect(outputDocContent).toContainText('Dear Sarah, thank you for outlining');

        // Tab 4: Summary Sheet
        await page.click('button[data-doc="summarySheet"]');
        await expect(page.locator('button[data-doc="summarySheet"]')).toHaveClass(/active/);
        await expect(outputDocContent).toContainText('Enterprise data transition project metrics');

        // Tab 5: Notes
        await page.click('button[data-doc="notes"]');
        await expect(page.locator('button[data-doc="notes"]')).toHaveClass(/active/);
        await expect(outputDocContent).toContainText('very receptive to Steny AI capabilities');

        // Tab 6: Proposal
        await page.click('button[data-doc="proposal"]');
        await expect(page.locator('button[data-doc="proposal"]')).toHaveClass(/active/);
        await expect(outputDocContent).toContainText('proposed migration plan and commercial options');

        // Tab 7: Action Items
        await page.click('button[data-doc="actionItems"]');
        await expect(page.locator('button[data-doc="actionItems"]')).toHaveClass(/active/);
        await expect(outputDocContent).toContainText('Send calendar invite for next session');

        // Tab 8: Transcript
        await page.click('button[data-doc="transcript"]');
        await expect(page.locator('button[data-doc="transcript"]')).toHaveClass(/active/);
        await expect(outputDocContent).toContainText('using 4 legacy TM1 databases');

        // 7. Verify UI styling indicators match generated state
        const generateButtons = page.locator('.report-type-btn');
        const count = await generateButtons.count();
        expect(count).toBe(7);

        for (let i = 0; i < count; i++) {
            const btn = generateButtons.nth(i);
            const style = await btn.getAttribute('style');
            expect(style).toContain('border-color: rgb(0, 200, 83)'); // green highlight verification
        }
    });
});
