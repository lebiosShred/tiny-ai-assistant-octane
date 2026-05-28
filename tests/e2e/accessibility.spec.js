const { test, expect } = require('../fixtures/base');

/**
 * Aegis v2 -- WCAG 2.1 AA Accessibility Audit
 * Uses @axe-core/playwright to run 90+ automated accessibility rules.
 */
test.describe('Aegis Accessibility Audit (WCAG 2.1 AA)', () => {

    test('index.html has no WCAG AA violations', async ({ page, axeBuilder }) => {
        await page.goto('/');
        await page.locator('body').waitFor({ state: 'attached' });

        const results = await axeBuilder.analyze();

        // Attach violation details to test report
        if (results.violations.length > 0) {
            test.info().annotations.push({
                type: 'a11y-violations',
                description: JSON.stringify(results.violations.map(v => ({
                    id: v.id,
                    impact: v.impact,
                    description: v.description,
                    nodes: v.nodes.length,
                })), null, 2),
            });
        }

        expect(results.violations).toEqual([]);
    });

    test('docs.html has no WCAG AA violations', async ({ page, axeBuilder }) => {
        await page.goto('/docs.html');
        await page.locator('body').waitFor({ state: 'attached' });

        const results = await axeBuilder.analyze();

        if (results.violations.length > 0) {
            test.info().annotations.push({
                type: 'a11y-violations',
                description: JSON.stringify(results.violations.map(v => ({
                    id: v.id,
                    impact: v.impact,
                    description: v.description,
                    nodes: v.nodes.length,
                })), null, 2),
            });
        }

        expect(results.violations).toEqual([]);
    });

    test('book.html has no WCAG AA violations', async ({ page, axeBuilder }) => {
        await page.goto('/book.html');
        await page.locator('body').waitFor({ state: 'attached' });

        const results = await axeBuilder.analyze();

        if (results.violations.length > 0) {
            test.info().annotations.push({
                type: 'a11y-violations',
                description: JSON.stringify(results.violations.map(v => ({
                    id: v.id,
                    impact: v.impact,
                    description: v.description,
                    nodes: v.nodes.length,
                })), null, 2),
            });
        }

        expect(results.violations).toEqual([]);
    });
});
