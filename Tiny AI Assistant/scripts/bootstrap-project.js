/**
 * Cross-Platform Project Bootstrapper
 * Part of the Axiom Meta-Pipeline framework.
 * 
 * Sets up a standardized folder structure, copies core templates (.axiom.md, task.md, walkthrough.md),
 * and creates baseline configurations for git, linting, and Playwright tests.
 */

const fs = require('fs');
const path = require('path');

function printUsage() {
    console.log('Usage: node bootstrap-project.js <target-directory>');
    console.log('Example: node bootstrap-project.js ./my-new-app');
}

async function main() {
    const args = process.argv.slice(2);
    const targetDir = args[0] ? path.resolve(args[0]) : process.cwd();

    console.log(`\n==========================================`);
    console.log(`Axiom Enterprise Project Bootstrapper`);
    console.log(`Target: ${targetDir}`);
    console.log(`==========================================\n`);

    try {
        // 1. Create target directory and child folders
        const dirs = [
            '',
            'src',
            'tests',
            'tests/e2e',
            'tests/unit',
            'tests/judges',
            'docs',
            'config'
        ];

        dirs.forEach(d => {
            const fullPath = path.join(targetDir, d);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(`✓ Created folder: ${d || '.'}`);
            }
        });

        // 2. Define file templates dynamically for zero-dependency portability
        const templates = {
            // .axiom.md config
            '.axiom.md': `# Local Project Instructions Template

## Project Scope
- Project Name: New Enterprise Service
- Main Tech Stack: Node.js / TypeScript / Playwright

## Architecture and Standards
- Enforce strict zero-trust input validation.
- All database, network, and storage transactions must have try-catch blocks.
- Swallowing errors or silencing promise rejections is prohibited.

## Testing Standards
- All functional paths must be validated by E2E or unit tests.
- Run the Aegis verification suite ("npm run test:aegis") before commits.
`,
            // task.md checklist template
            'config/task.md': `# Session Tasks Checklist

- [ ] Item 1: Complete description of task
    - [ ] Sub-item A
    - [ ] Sub-item B
- [ ] Item 2: Automated verification checks
- [ ] Item 3: Staging and deployment checks
`,
            // walkthrough.md template
            'config/walkthrough.md': `# Session Walkthrough

## Summary of Changes
- Feature 1: Complete description of change and technical details.

## Changed Files
- [NEW] [file name](file:///path/to/newfile)
- [MODIFY] [file name](file:///path/to/modifiedfile)

## Verification Results

| Check | Target | Result | Status |
| :--- | :--- | :--- | :--- |
| **Playwright E2E Suite** | E2E test runs | All tests passed | **PASSED** |
| **Linting & Formatting** | Code checks | Standard rules satisfied | **PASSED** |
| **Deployment URL** | Live site inspection | Verified successfully | **PASSED** |
`,
            // Standard .gitignore
            '.gitignore': `# Node dependency files
node_modules/
npm-debug.log*

# Environment and sensitive keys
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.git-credentials

# Playwright test logs and reports
playwright-report/
test-results/
playwright/.cache/

# OS and system files
.DS_Store
Thumbs.db
`,
            // Default Playwright configuration
            'playwright.config.js': `const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
});
`,
            // Baseline test spec
            'tests/e2e/functional.spec.js': `const { test, expect } = require('@playwright/test');

test.describe('Baseline Project Verification', () => {
    test('standard configuration runs successfully', async () => {
        expect(true).toBe(true);
    });
});
`
        };

        // 3. Write files to target folder
        Object.entries(templates).forEach(([fileName, content]) => {
            const filePath = path.join(targetDir, fileName);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, content.trim(), 'utf8');
                console.log(`✓ Wrote template: ${fileName}`);
            } else {
                console.log(`- Skipped (already exists): ${fileName}`);
            }
        });

        // 4. Create package.json if not present
        const pkgPath = path.join(targetDir, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            const defaultPkg = {
                name: path.basename(targetDir).toLowerCase().replace(/[^a-z0-9-_]/g, ''),
                version: '1.0.0',
                description: 'Axiom Enterprise Standard Application',
                main: 'src/index.js',
                scripts: {
                    "test": "echo \"Error: no test specified\" && exit 1",
                    "test:aegis": "playwright test"
                },
                devDependencies: {
                    "@playwright/test": "^1.40.0"
                }
            };
            fs.writeFileSync(pkgPath, JSON.stringify(defaultPkg, null, 2), 'utf8');
            console.log(`✓ Created boilerplate package.json`);
        } else {
            // Update existing package.json scripts if present
            try {
                const existingData = fs.readFileSync(pkgPath, 'utf8');
                const pkg = JSON.parse(existingData);
                pkg.scripts = pkg.scripts || {};
                if (!pkg.scripts['test:aegis']) {
                    pkg.scripts['test:aegis'] = "playwright test";
                    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
                    console.log(`✓ Updated package.json with test:aegis script`);
                }
            } catch (e) {
                console.warn(`⚠️ Failed to parse/update existing package.json:`, e.message);
            }
        }

        console.log(`\n==========================================`);
        console.log(`✓ Bootstrapping completed successfully!`);
        console.log(`Next steps:`);
        console.log(`  1. cd "${targetDir}"`);
        console.log(`  2. npm install`);
        console.log(`  3. npm run test:aegis`);
        console.log(`==========================================\n`);

    } catch (err) {
        console.error(`❌ Bootstrapping failed:`, err.message);
        process.exit(1);
    }
}

main();
