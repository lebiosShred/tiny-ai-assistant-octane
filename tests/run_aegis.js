const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { runE2ETests } = require('./aegis_e2e');
const { evaluateOutputs } = require('./aegis_judge');

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Checks if port is already active to determine whether to reuse an active server
 */
function isServerRunning(port) {
    return new Promise((resolve) => {
        const socket = new require('net').Socket();
        socket.setTimeout(500);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, '127.0.0.1');
    });
}

/**
 * Starts the local backend server.js as a subprocess
 */
function startServer() {
    return new Promise((resolve, reject) => {
        console.log('[Aegis Runner] Starting local server.js backend...');
        const serverProcess = spawn('node', ['server.js'], {
            cwd: path.resolve(__dirname, '..'),
            env: { ...process.env, PORT: PORT.toString() },
            shell: true
        });

        // Suppress massive log dumps but hook stderr for debugging
        serverProcess.stderr.on('data', (data) => {
            console.error(`[Server Error] ${data.toString().trim()}`);
        });

        // Poll server availability
        let retries = 20;
        const interval = setInterval(async () => {
            const active = await isServerRunning(PORT);
            if (active) {
                clearInterval(interval);
                console.log(`[Aegis Runner] Server launched successfully on ${BASE_URL}.`);
                resolve(serverProcess);
            } else {
                retries--;
                if (retries <= 0) {
                    clearInterval(interval);
                    serverProcess.kill('SIGTERM');
                    reject(new Error('Timed out waiting for local server to bind to port 8080.'));
                }
            }
        }, 500);
    });
}

async function run() {
    console.log('================================================================');
    console.log('🛡️  Aegis E2E & LLM-as-a-Judge Validation Suite');
    console.log('================================================================');

    let serverProcess = null;
    const reportPath = path.resolve(__dirname, '../scratch/aegis_report.json');
    const scratchDir = path.dirname(reportPath);

    if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
    }

    try {
        // 1. Establish server availability
        const alreadyRunning = await isServerRunning(PORT);
        if (alreadyRunning) {
            console.log(`[Aegis Runner] Active listener detected on port ${PORT}. Reusing active background server.`);
        } else {
            serverProcess = await startServer();
        }

        // 2. Execute E2E Playwright Browser Tests
        const e2eResults = await runE2ETests(BASE_URL);

        // 3. Extract dossier and execute LLM Judge evaluations
        let judgeResults = null;
        if (e2eResults.sdrFlow.passed && e2eResults.sdrFlow.dossierExtracted) {
            judgeResults = await evaluateOutputs(e2eResults.sdrFlow.dossierExtracted);
        } else {
            console.log('[Aegis Runner] ⚠️ SDR dossier extraction skipped or failed. Judge evaluation skipped.');
        }

        // 4. Compile complete report
        const finalReport = {
            timestamp: new Date().toISOString(),
            suite: 'Aegis Validation Suite',
            environment: BASE_URL,
            summary: {
                overallSuccess: e2eResults.success && (!judgeResults || judgeResults.passed),
                e2eSuitePassed: e2eResults.success,
                judgePassed: judgeResults ? judgeResults.passed : false
            },
            e2e: e2eResults,
            judge: judgeResults
        };

        // Write report payload
        fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2), 'utf-8');
        console.log(`[Aegis Runner] Complete audit log saved to: ${reportPath}`);

        // 5. Print visual summary
        console.log('\n================================================================');
        console.log('📋  Aegis Executive Audit Summary');
        console.log('================================================================');
        console.log(`- **Audit Verdict**: ${finalReport.summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`- **E2E Browser Core**: ${finalReport.summary.e2eSuitePassed ? 'PASS' : 'FAIL'}`);
        console.log(`- **Web Contrast (WCAG AA)**: ${e2eResults.accessibility.passed ? 'PASS' : 'FAIL'}`);
        console.log(`- **Direct Steny AI Booking**: ${e2eResults.bookingFlow.aiDirectRouteToSteny ? 'PASS' : 'FAIL'}`);
        console.log(`- **Variant B Questionnaire (10 Qs)**: ${e2eResults.playbookFlow.questionCount === 10 ? 'PASS (10 Questions)' : `FAIL (${e2eResults.playbookFlow.questionCount} Questions)`}`);

        if (judgeResults) {
            console.log(`- **Semantic LLM-as-a-Judge**: ${judgeResults.passed ? 'PASS' : 'FAIL'}`);
            console.log(`  * Factual Grounding: ${judgeResults.metrics.factualGrounding}/5.0`);
            console.log(`  * Tone Fidelity: ${judgeResults.metrics.toneFidelity}/5.0`);
            console.log(`  * Policy Compliance: ${judgeResults.metrics.policyCompliance}/5.0`);

            if (judgeResults.violations.length > 0) {
                console.log('\n⚠️  Judge Compliance Criticisms / Violations:');
                judgeResults.violations.forEach(v => {
                    console.log(`   [${v.severity}] ${v.policy}: ${v.reason}`);
                });
            }
        }

        console.log('================================================================\n');

        // Cleanup server process if spawned
        if (serverProcess) {
            console.log('[Aegis Runner] Terminating local subprocess server...');
            serverProcess.kill('SIGKILL');
        }

        if (!finalReport.summary.overallSuccess) {
            process.exit(1);
        } else {
            process.exit(0);
        }

    } catch (err) {
        console.error('[Aegis Runner] ❌ Execution pipeline failed:', err);
        if (serverProcess) {
            serverProcess.kill('SIGKILL');
        }
        process.exit(1);
    }
}

run();
