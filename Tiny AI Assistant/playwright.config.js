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
        baseURL: process.env.TEST_URL || 'http://localhost:8081',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },

    // Only boot local webServer if not testing a live URL
    ...(process.env.TEST_URL ? {} : {
        webServer: {
            command: 'node server.js',
            port: 8081,
            reuseExistingServer: false,
            cwd: __dirname,
            timeout: 15000,
            env: {
                PORT: '8081',
                HISTORY_DIR: 'knowledge/history_test',
                DATABASE_URL: 'postgresql://db_isolation_user:db_isolation_pass@localhost:5432/db_isolation_test'
            }
        }
    }),

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
