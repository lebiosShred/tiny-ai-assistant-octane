const { RUBRICS } = require('./rubrics');

/**
 * Aegis v2 -- Heuristic Judge (Zero-API Fallback)
 * Runs all policy, format, and content checks locally without API calls.
 */

/**
 * @param {string} text -- the generated output to evaluate
 * @param {object} context -- optional: { name, company, rep, tonePreset }
 * @returns {object} evaluation result
 */
function evaluateWithHeuristics(text, context = {}) {
    const normalized = text.toLowerCase();
    const violations = [];

    let policyVerdict = 'COMPLIANT';
    let factualVerdict = 'FULLY_CORRECT';
    let formatVerdict = 'VALID';
    let toneVerdict = 'ALIGNED';

    // ── Policy Compliance Checks ──

    // 1. Fireflies (CRITICAL)
    if (normalized.includes('fireflies')) {
        violations.push({
            severity: 'CRITICAL',
            rubric: 'policyCompliance',
            rule: 'Prohibited tool reference',
            detail: 'Mention of decommissioned tool "Fireflies" detected.',
        });
        policyVerdict = 'CRITICAL_VIOLATION';
    }

    // 2. Variant C (CRITICAL)
    if (normalized.includes('variant c')) {
        violations.push({
            severity: 'CRITICAL',
            rubric: 'policyCompliance',
            rule: 'Decommissioned track reference',
            detail: 'Reference to decommissioned "Variant C" detected.',
        });
        policyVerdict = 'CRITICAL_VIOLATION';
    }

    // 3. Template placeholders (WARNING)
    const placeholderPatterns = ['[insert', '{{', '__placeholder__', '[todo', '[tbd'];
    for (const pattern of placeholderPatterns) {
        if (normalized.includes(pattern)) {
            violations.push({
                severity: 'WARNING',
                rubric: 'policyCompliance',
                rule: 'Template placeholder detected',
                detail: `Found placeholder pattern: "${pattern}"`,
            });
            if (policyVerdict === 'COMPLIANT') policyVerdict = 'MINOR_VIOLATION';
        }
    }

    // 4. TM1 co-reference (INFO)
    if (normalized.includes('tm1') && !normalized.includes('planning analytics')) {
        violations.push({
            severity: 'INFO',
            rubric: 'policyCompliance',
            rule: 'TM1/Planning Analytics co-reference',
            detail: 'Mentioned TM1 without co-referencing IBM Planning Analytics branding.',
        });
        if (policyVerdict === 'COMPLIANT') policyVerdict = 'MINOR_VIOLATION';
    }

    // ── Format Compliance Checks ──

    // 5. HTML tag presence
    const hasHtmlTags = /<h[1-6]>|<p>|<li>|<ul>|<ol>/.test(text);
    if (!hasHtmlTags && text.length > 200) {
        violations.push({
            severity: 'WARNING',
            rubric: 'formatCompliance',
            rule: 'Missing HTML structure',
            detail: 'Output exceeds 200 chars but contains no HTML tags (h1-h6, p, li).',
        });
        formatVerdict = 'PARTIAL';
    }

    // 6. Content length
    if (text.length < 200) {
        violations.push({
            severity: 'WARNING',
            rubric: 'formatCompliance',
            rule: 'Insufficient content length',
            detail: `Output is ${text.length} chars (minimum expected: 200).`,
        });
        formatVerdict = 'PARTIAL';
    }

    // ── Factual Grounding Checks (context-dependent) ──

    // 7. Prospect name presence
    if (context.name && !normalized.includes(context.name.toLowerCase())) {
        violations.push({
            severity: 'WARNING',
            rubric: 'factualGrounding',
            rule: 'Missing prospect name',
            detail: `Prospect name "${context.name}" not found in output.`,
        });
        factualVerdict = 'INCOMPLETE';
    }

    // 8. Company name presence
    if (context.company && !normalized.includes(context.company.toLowerCase())) {
        violations.push({
            severity: 'WARNING',
            rubric: 'factualGrounding',
            rule: 'Missing company name',
            detail: `Company name "${context.company}" not found in output.`,
        });
        factualVerdict = 'INCOMPLETE';
    }

    // 9. Rep name presence
    if (context.rep && !normalized.includes(context.rep.toLowerCase())) {
        violations.push({
            severity: 'INFO',
            rubric: 'factualGrounding',
            rule: 'Missing rep name',
            detail: `Rep name "${context.rep}" not found in output.`,
        });
        if (factualVerdict === 'FULLY_CORRECT') factualVerdict = 'MOSTLY_CORRECT';
    }

    // ── Sales Utility Checks ──
    let salesUtilityVerdict = 'FULLY_VALUED';

    // 1. Pricing catalog check: find all dollar values in text
    // Matches patterns like A$4,560, $160,000, A$27,360, etc.
    const dollarMatches = text.match(/(?:A\$|\$)\d{1,3}(?:,\d{3})*(?:\/\w+)?|\b\d{1,3},\d{3}\b/g) || [];
    const validPrices = ['4,560', '1,850', '5,800', '160,000', '125,000'];
    for (const match of dollarMatches) {
        const cleanNum = match.replace(/[A\$\s\/month\/day\/yr]/g, '');
        if (!validPrices.includes(cleanNum)) {
            violations.push({
                severity: 'WARNING',
                rubric: 'salesUtility',
                rule: 'Invalid catalog pricing',
                detail: `Found pricing value "${match}" not matching catalog packages (4,560, 1,850, 5,800, 160,000, 125,000).`
            });
            salesUtilityVerdict = 'PARTIAL_VALUE';
        }
    }

    // 2. Prohibited em-dash check
    const emDashRegex = /[\u2014\u2015]/;
    if (emDashRegex.test(text)) {
        violations.push({
            severity: 'WARNING',
            rubric: 'salesUtility',
            rule: 'Prohibited em-dash',
            detail: 'Found prohibited em-dash characters.'
        });
        salesUtilityVerdict = 'PARTIAL_VALUE';
    }

    // 3. Stack separation check: check if competing planning tools are grouped as complementary
    const competingPlanningTools = ['anaplan', 'adaptive planning', 'board'];
    const compIndex = normalized.indexOf('complementary');
    if (compIndex !== -1) {
        const complementarySectionText = normalized.substring(compIndex, compIndex + 300);
        for (const tool of competingPlanningTools) {
            if (complementarySectionText.includes(tool)) {
                violations.push({
                    severity: 'WARNING',
                    rubric: 'salesUtility',
                    rule: 'Misclassified software stack',
                    detail: `Found competing application "${tool}" inside complementary applications section.`
                });
                salesUtilityVerdict = 'LOW_VALUE';
            }
        }
    }

    // ── Determine overall pass/fail ──
    const hasCritical = violations.some(v => v.severity === 'CRITICAL');

    return {
        passed: !hasCritical,
        mode: 'heuristic',
        metrics: {
            factualGrounding: factualVerdict,
            toneFidelity: toneVerdict,
            policyCompliance: policyVerdict,
            formatCompliance: formatVerdict,
            salesUtility: salesUtilityVerdict,
        },
        violations,
        violationCount: violations.length,
        criticalCount: violations.filter(v => v.severity === 'CRITICAL').length,
    };
}

module.exports = { evaluateWithHeuristics };
