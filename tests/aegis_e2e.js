const { chromium } = require('playwright');

/**
 * Helper to calculate relative luminance of an RGB/RGBA color string
 * to verify WCAG contrast ratios.
 */
function getLuminance(colorStr) {
    // Parse rgb(r, g, b) or rgba(r, g, b, a) or hex
    let r, g, b;
    if (colorStr.startsWith('rgb')) {
        const parts = colorStr.match(/\d+/g);
        r = parseInt(parts[0]);
        g = parseInt(parts[1]);
        b = parseInt(parts[2]);
    } else if (colorStr.startsWith('#')) {
        r = parseInt(colorStr.slice(1, 3), 16);
        g = parseInt(colorStr.slice(3, 5), 16);
        b = parseInt(colorStr.slice(5, 7), 16);
    } else {
        return 0; // Default fallback
    }

    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Calculates color contrast between foreground and background.
 */
function calculateContrast(fg, bg) {
    const l1 = getLuminance(fg);
    const l2 = getLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

async function runE2ETests(baseUrl = 'http://localhost:8080') {
    console.log(`[Aegis E2E] Initializing Playwright runner on base URL: ${baseUrl}`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Stream browser console and page errors to terminal for debugging
    page.on('console', msg => console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`));
    page.on('pageerror', err => console.error(`[Browser PageError] ${err.message}`));

    const results = {
        success: true,
        errors: [],
        accessibility: { passed: true, checks: [] },
        sdrFlow: { passed: false, dossierExtracted: null },
        playbookFlow: { passed: false, questionCount: 0, hasItalicizedTips: true },
        bookingFlow: { passed: false, aiDirectRouteToSteny: false }
    };

    try {
        // ────────────────────────────────────────────────────────
        // STEP 1: Web Accessibility Audit (Contrast Audit)
        // ────────────────────────────────────────────────────────
        console.log('[Aegis E2E] Auditing web accessibility contrast on index.html...');
        await page.goto(`${baseUrl}/`);
        await page.waitForSelector('body');

        // Audit main UI titles and panels
        const contrastAudit = await page.evaluate(() => {
            function getLuminance(rgb) {
                const parts = rgb.match(/\d+/g);
                if (!parts) return 0;
                const r = parseInt(parts[0]) / 255;
                const g = parseInt(parts[1]) / 255;
                const b = parseInt(parts[2]) / 255;
                const a = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
                return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
            }

            function getContrast(el) {
                const style = window.getComputedStyle(el);
                const fg = style.color;
                // Walk parent tree to find actual background color if transparent
                let bg = style.backgroundColor;
                let parent = el.parentElement;
                while ((bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && parent) {
                    const parentStyle = window.getComputedStyle(parent);
                    bg = parentStyle.backgroundColor;
                    parent = parent.parentElement;
                }
                if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
                    bg = 'rgb(18, 18, 18)'; // Default fallback dark mode background
                }

                const l1 = getLuminance(fg);
                const l2 = getLuminance(bg);
                const lighter = Math.max(l1, l2);
                const darker = Math.min(l1, l2);
                return (lighter + 0.05) / (darker + 0.05);
            }

            const targets = [
                { name: 'Left Panel Title', selector: '#left-panel-title' },
                { name: 'Generate Brief Button', selector: '#prep-submit-btn' },
                { name: 'Sample Loader Button', selector: '#prep-load-sample-btn' }
            ];

            return targets.map(t => {
                const el = document.querySelector(t.selector);
                if (!el) return { name: t.name, found: false, contrast: 0 };
                const contrast = getContrast(el);
                return { name: t.name, found: true, contrast: parseFloat(contrast.toFixed(2)) };
            });
        });

        results.accessibility.checks = contrastAudit;
        for (const check of contrastAudit) {
            if (check.found && check.contrast < 4.5) {
                console.log(`[Aegis E2E] ❌ Contrast failure: ${check.name} ratio is ${check.contrast}:1 (Expected >= 4.5:1)`);
                results.accessibility.passed = false;
                results.errors.push(`Contrast violation on ${check.name}: ${check.contrast}:1`);
            } else if (check.found) {
                console.log(`[Aegis E2E]   Contrast check: ${check.name} ratio is ${check.contrast}:1 (Compliant)`);
            }
        }

        // ────────────────────────────────────────────────────────
        // STEP 2: SDR Prep Briefing Flow (Sales Rep Input)
        // ────────────────────────────────────────────────────────
        console.log('[Aegis E2E] Testing SDR Prep Briefing Form Submission...');
        await page.evaluate(() => document.querySelector('#prep-load-sample-btn').click());
        console.log('[Aegis E2E] Sample Sarah Chen click executed. Submitting form...');
        
        // Assert values got filled
        const nameVal = await page.$eval('#prep-name', el => el.value);
        const companyVal = await page.$eval('#prep-company', el => el.value);
        if (nameVal !== 'Sarah Chen' || companyVal !== 'Meridian Logistics') {
            throw new Error(`Sample data loader failed. Found Name: ${nameVal}, Company: ${companyVal}`);
        }

        // Submit form
        await page.evaluate(() => document.querySelector('#prep-submit-btn').click());
        console.log('[Aegis E2E] Awaiting Prep Briefing Dossier Generation (API fetch limit: 15s)...');
        
        // Wait for the h3 or text contents to get rendered inside the output panel
        await page.waitForFunction(() => {
            const el = document.querySelector('#output-doc-content');
            return el && el.innerText.trim().length > 100;
        }, { timeout: 15000 });
        
        const dossierContent = await page.$eval('#output-doc-content', el => el.innerText);
        if (dossierContent.length > 50) {
            console.log('[Aegis E2E]   Prep briefing dossier successfully generated and rendered.');
            results.sdrFlow.passed = true;
            results.sdrFlow.dossierExtracted = dossierContent.substring(0, 1000) + '... [TRUNCATED]';
        } else {
            throw new Error('Dossier generated output is empty or too short.');
        }

        // Navigate to Step 2 (Meeting Playbook)
        await page.evaluate(() => document.querySelector('#step-1-next-btn').click());
        console.log('[Aegis E2E] Navigated to Step 2: Meeting Playbook.');

        // ────────────────────────────────────────────────────────
        // STEP 3: Playbook & Variant B Verification
        // ────────────────────────────────────────────────────────
        console.log('[Aegis E2E] Switching questionnaire variant to B...');
        await page.selectOption('#battlecard-selector', 'B');
        
        // Allow self-healing expected-length client-side check to bypass server API payload
        console.log('[Aegis E2E] Waiting for Variant B self-healing list validation...');
        await page.waitForTimeout(2000);

        const teleprompterText = await page.$eval('#teleprompter-counter', el => el.innerText);
        console.log(`[Aegis E2E] Playbook Counter reads: "${teleprompterText}"`);

        // Check total questions (matches both "X Questions" and "Question Y of X")
        const match = teleprompterText.match(/(\d+)\s*questions|of\s*(\d+)/i);
        const totalQuestions = match ? parseInt(match[1] || match[2]) : 0;
        results.playbookFlow.questionCount = totalQuestions;

        if (totalQuestions === 10) {
            console.log('[Aegis E2E]   Variant B question length successfully enforced at exactly 10 questions.');
            results.playbookFlow.passed = true;
        } else {
            results.errors.push(`Variant B questionnaire length is ${totalQuestions} (Expected 10 questions)`);
            results.success = false;
        }

        // Audit teleprompter details for prohibited italicized tips
        const italicTipCheck = await page.evaluate(() => {
            const body = document.querySelector('#battlecard-body');
            if (!body) return false;
            // Check if there are any italic elements (<i> or <em>) inside the playbook card
            const italics = body.querySelectorAll('i, em');
            return italics.length > 0;
        });

        results.playbookFlow.hasItalicizedTips = italicTipCheck;
        if (italicTipCheck) {
            results.errors.push('Italicized tips detected in rendered teleprompter view.');
            results.success = false;
            console.log('[Aegis E2E] ❌ Playbook Audit: Found prohibited italicized tips under questions.');
        } else {
            console.log('[Aegis E2E]   Playbook Audit: No italicized tips detected (Compliant).');
        }

        // ────────────────────────────────────────────────────────
        // STEP 4: SDR Documentation Readiness
        // ────────────────────────────────────────────────────────
        console.log('[Aegis E2E] Auditing SDR Documentation page docs.html...');
        await page.goto(`${baseUrl}/docs.html`);
        await page.waitForSelector('body');
        
        const docsHeaders = await page.$$eval('h1, h2', els => els.map(e => e.innerText));
        console.log(`[Aegis E2E] Docs Page Headers: ${docsHeaders.join(' | ')}`);
        if (docsHeaders.some(h => h.includes('Tiny AI Assistant'))) {
            console.log('[Aegis E2E]   Documentation page verified successfully.');
        } else {
            results.errors.push('Documentation page failed integrity check.');
            results.success = false;
        }

        // ────────────────────────────────────────────────────────
        // STEP 5: Booking Direct-to-Steny AI Flow
        // ────────────────────────────────────────────────────────
        console.log('[Aegis E2E] Testing Booking Page direct-to-Steny routing on book.html...');
        await page.goto(`${baseUrl}/book.html`);
        await page.waitForSelector('#meeting-reason', { state: 'attached' });

        // Select AI Solutions discussion programmatically and trigger change event
        await page.evaluate(() => {
            const select = document.getElementById('meeting-reason');
            select.value = 'AI Solutions Discussion | 45 mins';
            select.dispatchEvent(new Event('change'));
        });
        await page.waitForTimeout(1000);

        // Verify Steny details using correct element IDs
        const hostTitleText = await page.$eval('#hosts-display-title', el => el.innerText);
        const hostSubtitleText = await page.$eval('#hosts-display-subtitle', el => el.innerText);
        console.log(`[Aegis E2E] Dynamic booking host details loaded: Title="${hostTitleText}", Subtitle="${hostSubtitleText}"`);

        if (hostSubtitleText.includes('Steny') && hostTitleText.includes('Host')) {
            console.log('[Aegis E2E]   Direct routing for AI Discussion to Steny verified successfully.');
            results.bookingFlow.aiDirectRouteToSteny = true;
            results.bookingFlow.passed = true;
        } else {
            results.errors.push(`AI Booking direct host details are: "${hostTitleText} - ${hostSubtitleText}" (Expected Steny, Director of AI Solutions)`);
            results.success = false;
        }

    } catch (err) {
        console.error('[Aegis E2E] ❌ E2E Execution Error:', err);
        results.success = false;
        results.errors.push(err.message);
    } finally {
        await browser.close();
    }

    return results;
}

module.exports = { runE2ETests };

if (require.main === module) {
    runE2ETests().then(res => {
        console.log('[Aegis E2E] Run complete:', JSON.stringify(res, null, 2));
    });
}
