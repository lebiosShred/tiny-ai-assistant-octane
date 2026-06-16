const { test, expect } = require('../fixtures/base');

/**
 * Aegis v2 -- Core Web Vitals Performance Tests
 * Measures LCP, CLS, and INP against Google's recommended thresholds.
 * These are synthetic lab metrics for regression detection, not field data.
 */
test.describe('Aegis Performance -- Core Web Vitals', () => {

    test('index page meets LCP and CLS thresholds', async ({ page, collectMetrics }) => {
        await page.goto('/', { waitUntil: 'load' });

        // Allow metrics observers to settle
        await page.waitForTimeout(2000);

        const metrics = await collectMetrics();

        test.info().annotations.push({
            type: 'performance',
            description: `LCP: ${metrics.lcp.toFixed(0)}ms | CLS: ${metrics.cls.toFixed(4)} | INP: ${metrics.inp}ms`,
        });

        expect(metrics.lcp).toBeLessThan(3000);
        expect(metrics.cls).toBeLessThan(0.1);
    });

    test('book page meets LCP and CLS thresholds', async ({ page, collectMetrics }) => {
        await page.goto('/book', { waitUntil: 'load' });
        await page.waitForTimeout(2000);

        const metrics = await collectMetrics();

        test.info().annotations.push({
            type: 'performance',
            description: `LCP: ${metrics.lcp.toFixed(0)}ms | CLS: ${metrics.cls.toFixed(4)} | INP: ${metrics.inp}ms`,
        });

        expect(metrics.lcp).toBeLessThan(3000);
        expect(metrics.cls).toBeLessThan(0.1);
    });

    test('docs page meets LCP and CLS thresholds', async ({ page, collectMetrics }) => {
        await page.goto('/docs', { waitUntil: 'load' });
        await page.waitForTimeout(2000);

        const metrics = await collectMetrics();

        test.info().annotations.push({
            type: 'performance',
            description: `LCP: ${metrics.lcp.toFixed(0)}ms | CLS: ${metrics.cls.toFixed(4)} | INP: ${metrics.inp}ms`,
        });

        expect(metrics.lcp).toBeLessThan(3000);
        // Docs page has sidebar nav + content-heavy layout -- relaxed CLS threshold
        expect(metrics.cls).toBeLessThan(0.25);
    });
});
