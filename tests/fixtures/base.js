// Aegis v2 -- Custom Test Fixtures
const base = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

/**
 * Extended test fixtures providing accessibility auditing
 * and Core Web Vitals performance metrics collection.
 */
const test = base.test.extend({
  /**
   * Pre-configured AxeBuilder targeting WCAG 2.x AA compliance.
   * Usage: const results = await axeBuilder.analyze();
   */
  axeBuilder: async ({ page }, use) => {
    const builder = new AxeBuilder({ page }).withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21aa',
    ]);
    await use(builder);
  },

  /**
   * Injects a PerformanceObserver that captures LCP, CLS, and INP
   * into window.__perfMetrics. Returns an async retrieval function.
   *
   * Usage:
   *   const getMetrics = await collectMetrics;
   *   // ... interact with page ...
   *   const metrics = await getMetrics();
   */
  collectMetrics: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.__perfMetrics = { lcp: 0, cls: 0, inp: Infinity };

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          window.__perfMetrics.lcp = entries[entries.length - 1].startTime;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__perfMetrics.cls += entry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      // Interaction to Next Paint
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration < window.__perfMetrics.inp) {
            window.__perfMetrics.inp = entry.duration;
          }
        }
      });
      inpObserver.observe({ type: 'event', buffered: true });
    });

    const getMetrics = async () => {
      return page.evaluate(() => {
        const m = window.__perfMetrics || { lcp: 0, cls: 0, inp: Infinity };
        return {
          lcp: m.lcp,
          cls: m.cls,
          inp: m.inp === Infinity ? -1 : m.inp,
        };
      });
    };

    await use(getMetrics);
  },
});

const expect = test.expect;

module.exports = { test, expect };
