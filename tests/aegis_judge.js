const https = require('https');

/**
 * Native helper to send a POST request to Mistral API
 */
function callMistralAPI(apiKey, prompt, systemPrompt = '') {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                { role: 'user', content: prompt }
            ],
            temperature: 0.0,
            response_format: { type: 'json_object' }
        });

        const options = {
            hostname: 'api.mistral.ai',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
                        resolve(JSON.parse(parsed.choices[0].message.content.trim()));
                    } else {
                        reject(new Error(`API Error: ${data}`));
                    }
                } catch (err) {
                    reject(new Error(`Failed to parse response: ${err.message}. Raw: ${data}`));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(payload);
        req.end();
    });
}

/**
 * Local Rule-based parser to audit policy constraints without requiring API keys.
 */
function runLocalPolicyAudit(text) {
    const findings = [];
    const normalized = text.toLowerCase();

    // 1. Fireflies check
    if (normalized.includes('fireflies')) {
        findings.push({
            severity: 'CRITICAL',
            policy: 'Purge Fireflies integration references',
            reason: 'Mention of forbidden tool "Fireflies" detected in evaluation payload.'
        });
    }

    // 2. Variant C check
    if (normalized.includes('variant c') || normalized.includes('ai discovery track') || normalized.includes('discover ai solutions track')) {
        // Wait, "AI Solutions Discussion" is allowed since it is the new track, but selector options for Variant C are prohibited
        if (normalized.includes('variant c')) {
            findings.push({
                severity: 'CRITICAL',
                policy: 'Variant C decommissioning',
                reason: 'Option/mention of decommissioned Variant C detected.'
            });
        }
    }

    // 3. Structured placeholders
    if (normalized.includes('[insert') || normalized.includes('{{') || normalized.includes('__placeholder__')) {
        findings.push({
            severity: 'WARNING',
            policy: 'Zero-placeholder compliance',
            reason: 'Potential template placeholders or brackets detected in output.'
        });
    }

    // 4. TM1 alignment
    if (normalized.includes('tm1') && !normalized.includes('planning analytics')) {
        findings.push({
            severity: 'INFO',
            policy: 'TM1/Planning Analytics co-reference',
            reason: 'Mentioned legacy TM1 without co-referencing current IBM Planning Analytics branding.'
        });
    }

    return findings;
}

/**
 * Runs the semantic and policy evaluations on captured E2E test results.
 */
async function evaluateOutputs(dossierText) {
    console.log('[Aegis Judge] Commencing semantic audit of extracted artifacts...');
    
    const evaluation = {
        passed: true,
        metrics: {
            factualGrounding: 5.0,
            toneFidelity: 5.0,
            policyCompliance: 5.0
        },
        violations: [],
        suggestions: []
    };

    // Run strict local heuristics first
    const localViolations = runLocalPolicyAudit(dossierText);
    for (const v of localViolations) {
        evaluation.violations.push(v);
        if (v.severity === 'CRITICAL') {
            evaluation.passed = false;
            evaluation.metrics.policyCompliance = 1.0;
        } else if (v.severity === 'WARNING' && evaluation.metrics.policyCompliance > 3.0) {
            evaluation.metrics.policyCompliance = 3.0;
        }
    }

    // Check if API key is present for advanced G-Eval scoring
    const apiKey = (process.env.MISTRAL_API_KEY || '').trim();
    if (!apiKey) {
        console.log('[Aegis Judge] ⚠️ MISTRAL_API_KEY environment variable is absent. Using local rule-based assertions (Heuristic Mode).');
        if (evaluation.passed) {
            console.log('[Aegis Judge] ✅ Local compliance audits passed successfully.');
        } else {
            console.log(`[Aegis Judge] ❌ Local compliance audit caught ${localViolations.length} violations.`);
        }
        return evaluation;
    }

    console.log('[Aegis Judge] API key detected. Triggering advanced LLM semantic evaluation...');
    try {
        const systemPrompt = `You are an enterprise AI Auditor and QA Evaluation Judge. You analyze generated sales briefs and dossiers against strict guidelines. You return exclusively valid JSON with structure:
{
  "factualGroundingScore": 5.0,
  "toneFidelityScore": 5.0,
  "justification": "Detailed explanation of scores",
  "criticisms": ["list of issues found"],
  "remedies": ["actions to fix issues"]
}`;

        const userPrompt = `Audit the following generated pre-screening dossier text. Verify it represents high-quality professional B2B advisory prep, matches corporate tone, and contains zero hallucinations or placeholders:

[EXTRACTED BRIEF START]
${dossierText}
[EXTRACTED BRIEF END]`;

        const judgeResponse = await callMistralAPI(apiKey, userPrompt, systemPrompt);
        console.log('[Aegis Judge] Advanced LLM analysis complete.');

        evaluation.metrics.factualGrounding = judgeResponse.factualGroundingScore;
        evaluation.metrics.toneFidelity = judgeResponse.toneFidelityScore;

        if (judgeResponse.criticisms && judgeResponse.criticisms.length > 0) {
            judgeResponse.criticisms.forEach(c => {
                evaluation.violations.push({
                    severity: 'WARNING',
                    policy: 'LLM Auditor Criticism',
                    reason: c
                });
            });
            if (judgeResponse.factualGroundingScore < 3.0 || judgeResponse.toneFidelityScore < 3.0) {
                evaluation.passed = false;
            }
        }
        if (judgeResponse.remedies) {
            evaluation.suggestions = judgeResponse.remedies;
        }

    } catch (err) {
        console.error('[Aegis Judge] ❌ LLM Judge failed to execute, falling back to local results:', err.message);
        evaluation.violations.push({
            severity: 'WARNING',
            policy: 'Auditor Exception',
            reason: `Semantic LLM evaluation failed to execute: ${err.message}`
        });
    }

    return evaluation;
}

module.exports = { evaluateOutputs };

if (require.main === module) {
    // Dry run
    evaluateOutputs("This is a sample output dossier containing no fireflies details. We route AI to Steny.").then(res => {
        console.log('Audit dry run results:', JSON.stringify(res, null, 2));
    });
}
