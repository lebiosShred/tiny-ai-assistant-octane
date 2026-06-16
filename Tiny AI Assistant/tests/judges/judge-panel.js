const https = require('https');
const { RUBRICS } = require('./rubrics');
const { evaluateWithHeuristics } = require('./heuristic-judge');

const JUDGE_TIMEOUT_MS = 12000;

// ── Provider Adapters ──

/**
 * Gemini 2.5 Flash via Google AI Studio API
 */
function callGemini(apiKey, systemPrompt, userPrompt) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        });

        const url = new URL(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
        );

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        };

        const timer = setTimeout(() => reject(new Error('Gemini timeout')), JUDGE_TIMEOUT_MS);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timer);
                try {
                    const parsed = JSON.parse(data);
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    resolve(JSON.parse(text));
                } catch (err) {
                    reject(new Error(`Gemini parse error: ${err.message}. Raw: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', (err) => { clearTimeout(timer); reject(err); });
        req.write(payload);
        req.end();
    });
}

/**
 * Mistral Large via Mistral API
 */
function callMistral(apiKey, systemPrompt, userPrompt) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0,
            response_format: { type: 'json_object' },
        });

        const options = {
            hostname: 'api.mistral.ai',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(payload),
            },
        };

        const timer = setTimeout(() => reject(new Error('Mistral timeout')), JUDGE_TIMEOUT_MS);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timer);
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.message?.content || '';
                    resolve(JSON.parse(content.trim()));
                } catch (err) {
                    reject(new Error(`Mistral parse error: ${err.message}`));
                }
            });
        });

        req.on('error', (err) => { clearTimeout(timer); reject(err); });
        req.write(payload);
        req.end();
    });
}

/**
 * GPT-4o-mini via OpenAI API
 */
function callOpenAI(apiKey, systemPrompt, userPrompt) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0,
            response_format: { type: 'json_object' },
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(payload),
            },
        };

        const timer = setTimeout(() => reject(new Error('OpenAI timeout')), JUDGE_TIMEOUT_MS);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timer);
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.message?.content || '';
                    resolve(JSON.parse(content.trim()));
                } catch (err) {
                    reject(new Error(`OpenAI parse error: ${err.message}`));
                }
            });
        });

        req.on('error', (err) => { clearTimeout(timer); reject(err); });
        req.write(payload);
        req.end();
    });
}

// ── Provider Registry ──

const PROVIDERS = [
    { name: 'Gemini', envKey: 'GEMINI_API_KEY', caller: callGemini },
    { name: 'Mistral', envKey: 'MISTRAL_API_KEY', caller: callMistral },
    { name: 'OpenAI', envKey: 'OPENAI_API_KEY', caller: callOpenAI },
];

/**
 * Resolve available providers from environment.
 */
function getAvailableProviders() {
    return PROVIDERS.filter(p => {
        const key = (process.env[p.envKey] || '').trim();
        return key.length > 0;
    }).map(p => ({
        ...p,
        apiKey: process.env[p.envKey].trim(),
    }));
}

// ── Consensus Engine ──

/**
 * Compute majority verdict from an array of provider results.
 * @param {Array<{verdict: string}>} results
 * @returns {{verdict: string, consensus: boolean}}
 */
function computeConsensus(results) {
    const validResults = results.filter(r => r && r.verdict);
    if (validResults.length === 0) {
        return { verdict: 'UNKNOWN', consensus: false };
    }

    const counts = {};
    for (const r of validResults) {
        counts[r.verdict] = (counts[r.verdict] || 0) + 1;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topVerdict = sorted[0][0];
    const topCount = sorted[0][1];
    const majority = topCount > validResults.length / 2;

    return { verdict: topVerdict, consensus: majority };
}

// ── Main Evaluation Functions ──

/**
 * Evaluate text against a single rubric using the multi-model panel.
 */
async function evaluateWithPanel(text, rubricKey, context = {}) {
    const rubric = RUBRICS[rubricKey];
    if (!rubric) throw new Error(`Unknown rubric: ${rubricKey}`);

    const providers = getAvailableProviders();

    // Zero-API fallback
    if (providers.length === 0) {
        console.log('[Aegis Judge] No API keys found. Using heuristic evaluation.');
        const heuristicResult = evaluateWithHeuristics(text, context);
        return {
            rubric: rubricKey,
            verdict: heuristicResult.metrics[rubricKey] || 'UNKNOWN',
            confidence: 'heuristic',
            providers: [{ name: 'Heuristic', verdict: heuristicResult.metrics[rubricKey], reasoning: 'Local rule-based evaluation' }],
            consensus: true,
            flaggedForReview: false,
        };
    }

    const userPrompt = `Evaluate the following generated content:\n\n[CONTENT START]\n${text.substring(0, 3000)}\n[CONTENT END]`;

    // Call all available providers in parallel
    const results = await Promise.allSettled(
        providers.map(async (p) => {
            try {
                const response = await p.caller(p.apiKey, rubric.systemPrompt, userPrompt);
                return { name: p.name, verdict: response.verdict, reasoning: response.reasoning || '', raw: response };
            } catch (err) {
                console.error(`[Aegis Judge] ${p.name} failed: ${err.message}`);
                return { name: p.name, verdict: null, reasoning: err.message, error: true };
            }
        })
    );

    const providerResults = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
    const successfulResults = providerResults.filter(r => r.verdict && !r.error);

    if (successfulResults.length === 0) {
        // All providers failed -- fall back to heuristics
        console.log('[Aegis Judge] All API providers failed. Falling back to heuristics.');
        const heuristicResult = evaluateWithHeuristics(text, context);
        return {
            rubric: rubricKey,
            verdict: heuristicResult.metrics[rubricKey] || 'UNKNOWN',
            confidence: 'heuristic-fallback',
            providers: providerResults,
            consensus: false,
            flaggedForReview: true,
        };
    }

    const { verdict, consensus } = computeConsensus(successfulResults);

    return {
        rubric: rubricKey,
        verdict,
        confidence: consensus ? 'consensus' : 'split',
        providers: providerResults,
        consensus,
        flaggedForReview: !consensus,
    };
}

/**
 * Evaluate text against ALL rubrics.
 */
async function evaluateAll(text, context = {}) {
    const rubricKeys = Object.keys(RUBRICS);
    const results = {};

    for (const key of rubricKeys) {
        results[key] = await evaluateWithPanel(text, key, context);
    }

    const overallPassed = Object.values(results).every(r => {
        const rubric = RUBRICS[r.rubric];
        // Pass if verdict is in the top half of the categories
        const categories = rubric.categories;
        const idx = categories.indexOf(r.verdict);
        return idx >= 0 && idx < Math.ceil(categories.length / 2);
    });

    return {
        passed: overallPassed,
        rubrics: results,
        flaggedForReview: Object.values(results).some(r => r.flaggedForReview),
        timestamp: new Date().toISOString(),
    };
}

/**
 * Print a clean markdown summary to console.
 */
function formatJudgeReport(results) {
    console.log('\n================================================================');
    console.log('🧑‍⚖️  Aegis Multi-Model Judge Panel Report');
    console.log('================================================================');
    console.log(`Overall Verdict: ${results.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Flagged for Review: ${results.flaggedForReview ? 'YES' : 'No'}`);
    console.log('');

    for (const [key, result] of Object.entries(results.rubrics)) {
        const rubric = RUBRICS[key];
        const providerSummary = result.providers
            .map(p => `${p.name}=${p.verdict || 'ERROR'}`)
            .join(', ');
        console.log(`  ${rubric.name}: ${result.verdict} [${result.confidence}] (${providerSummary})`);
    }
    console.log('================================================================\n');
}

module.exports = { evaluateWithPanel, evaluateAll, formatJudgeReport };
