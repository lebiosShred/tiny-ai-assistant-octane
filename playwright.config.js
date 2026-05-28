// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Aegis v2 -- Playwright Configuration
 * Enterprise E2E, Visual Regression, Accessibility, and Performance Test Runner
 */
module.exports = defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 2,
    outputDir: 'test-results/',

    reporter: [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'scratch/aegis-results.json' }],
        ['list']
    ],

    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.02,
            threshold: 0.2,
            animations: 'disabled',
        },
    },

    use: {
        baseURL: 'http://localhost:8080',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },

    webServer: {
        command: 'node server.js',
        port: 8080,
        reuseExistingServer: !process.env.CI,
        cwd: __dirname,
        timeout: 15000,
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
