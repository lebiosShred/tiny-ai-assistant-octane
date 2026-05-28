/**
 * Aegis v2 -- Evaluation Rubric Definitions
 *
 * Each rubric defines:
 *   - name:         Human-readable label
 *   - description:  What the rubric measures
 *   - categories:   Ordered verdict levels (best -> worst)
 *   - systemPrompt: Chain-of-thought prompt that forces JSON output
 *
 * Policy-specific rubrics also carry prohibitedTerms and requiredCoReferences
 * so heuristic judges can run the same checks without an API call.
 */

const RUBRICS = {
  factualGrounding: {
    name: 'Factual Grounding',
    description: 'Does the output contain only verifiable claims from the input context?',
    categories: ['FULLY_CORRECT', 'MOSTLY_CORRECT', 'INCOMPLETE', 'CONTRADICTORY', 'HALLUCINATED'],
    systemPrompt: [
      'You are a factual grounding auditor. Evaluate whether the generated sales brief',
      'contains ONLY information that can be verified from the provided input context',
      '(prospect name, company, role, intake notes).',
      '',
      'You MUST reason step-by-step before giving your verdict.',
      '',
      'Respond with valid JSON:',
      '{',
      '  "reasoning": "Step-by-step analysis of factual claims vs input context",',
      '  "verdict": "FULLY_CORRECT | MOSTLY_CORRECT | INCOMPLETE | CONTRADICTORY | HALLUCINATED",',
      '  "evidence": ["list of specific claims checked"]',
      '}'
    ].join('\n')
  },

  toneFidelity: {
    name: 'Tone Fidelity',
    description: 'Does the output match the configured tone preset?',
    categories: ['ALIGNED', 'PARTIAL_MATCH', 'MISALIGNED'],
    systemPrompt: [
      'You are a tone fidelity auditor for B2B sales content. Evaluate whether the',
      'generated output matches the specified tone preset.',
      '',
      'You MUST reason step-by-step before giving your verdict.',
      '',
      'Respond with valid JSON:',
      '{',
      '  "reasoning": "Step-by-step analysis of tone markers",',
      '  "verdict": "ALIGNED | PARTIAL_MATCH | MISALIGNED",',
      '  "evidence": ["specific phrases that indicate tone alignment or misalignment"]',
      '}'
    ].join('\n')
  },

  policyCompliance: {
    name: 'Policy Compliance',
    description: 'Does the output avoid all prohibited content?',
    categories: ['COMPLIANT', 'MINOR_VIOLATION', 'CRITICAL_VIOLATION'],
    prohibitedTerms: ['fireflies', 'variant c', '[insert', '{{', '__placeholder__'],
    requiredCoReferences: { tm1: 'planning analytics' },
    systemPrompt: [
      'You are a policy compliance auditor. Check the output against these rules:',
      '1. Must NOT mention "Fireflies" (decommissioned tool)',
      '2. Must NOT reference "Variant C" (decommissioned track)',
      '3. Must NOT contain template placeholders ([insert...], {{...}}, __placeholder__)',
      '4. If "TM1" is mentioned, "Planning Analytics" must also appear',
      '',
      'You MUST reason step-by-step before giving your verdict.',
      '',
      'Respond with valid JSON:',
      '{',
      '  "reasoning": "Step-by-step policy check",',
      '  "verdict": "COMPLIANT | MINOR_VIOLATION | CRITICAL_VIOLATION",',
      '  "violations": ["list of specific violations found, empty if compliant"]',
      '}'
    ].join('\n')
  },

  formatCompliance: {
    name: 'Format Compliance',
    description: 'Does the output follow expected HTML structure and delimiter conventions?',
    categories: ['VALID', 'PARTIAL', 'INVALID'],
    systemPrompt: [
      'You are a format compliance auditor. Check the output for:',
      '1. Proper HTML structure (h3, p, li tags present)',
      '2. Delimiter markers ("=== DELIMITER ===") if transcript synthesis',
      '3. Temperature score indicator (HOT/WARM/COLD)',
      '4. No raw markdown in HTML context',
      '',
      'Respond with valid JSON:',
      '{',
      '  "reasoning": "Step-by-step format analysis",',
      '  "verdict": "VALID | PARTIAL | INVALID",',
      '  "issues": ["list of format issues found"]',
      '}'
    ].join('\n')
  }
};

module.exports = { RUBRICS };
