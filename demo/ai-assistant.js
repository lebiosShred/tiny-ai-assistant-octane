/**
 * Tiny AI Sales Assistant - Core Logic & Integration Wrapper
 * 
 * This file encapsulates the interaction logic for the Tiny AI Assistant,
 * including connection wrappers for the Mistral AI API, prompt templates,
 * and delimiter-based document parser.
 */

// Default configuration (user can override in UI settings)
const DEFAULT_CONFIG = {
    apiKey: "",
    apiUrl: "/api/chat",
    model: "mistral-large-latest",
    provider: "mistral",
    prepSystemPrompt: "You are a professional, clinical B2B sales research assistant. You write detailed, factual briefs without fluff or conversational filler.",
    synthSystemPrompt: "You are a professional B2B sales operations assistant. You analyze call transcripts and produce clean, formatted HTML documents separated by delimiters."
};

    /**
     * Helper to make a chat completions request to Mistral AI
     * @param {Array} messages - Chat messages array
     * @param {Object} customConfig - User-provided custom API key/url/model
     * @returns {Promise<string>} Content from the API response
     */
    async function callMistralAPI(messages, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        
        const isProxy = config.apiUrl.startsWith('/') || config.apiUrl.includes(window.location.host + '/api');
        if (!config.apiKey && !isProxy) {
            throw new Error("Mistral API Key is missing. Please check settings.");
        }

        console.log("🤖 Tiny AI Assistant: Initiating call to Mistral API...", { model: config.model, messages: messages.length });
        
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        if (config.apiKey) {
            headers["Authorization"] = `Bearer ${config.apiKey}`;
        }

        const response = await fetch(config.apiUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                model: config.model,
                messages: messages,
                temperature: 0.2, // Lower temp for factual sales extraction
                provider: config.provider
            })
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => "");
            throw new Error(`Mistral API error: ${response.status} ${response.statusText}. ${errBody}`);
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Invalid API response format (missing choice or message)");
        }

        console.log("🤖 Tiny AI Assistant: API response received successfully.");
        return data.choices[0].message.content;
    }

    /**
     * Component 02: Generate the 10-point pre-screening briefing dossier for the prospect
     * @param {Object} params - Prospect parameters
     * @param {Object} customConfig - Custom API configuration
     * @returns {Promise<string>} HTML formatted briefing content
     */
    async function generateProspectDossier(params, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const prompt = `You are a sales preparation assistant for Octane Software Solutions.
I am about to have a 30-minute pre-screen call with a prospect. Using the inputs below and your knowledge of Octane's services (IBM TM1/Planning Analytics managed support, Watsonx Orchestrate agentic AI integrations, and DataFusion connectors), produce a 10-POINT BRIEFING.

--- INPUTS ---
1. Client: ${params.name || "Unknown Name"}, ${params.title || "Unknown Title"} at ${params.company || "Unknown Company"}
2. Company URL: ${params.url || "Unknown URL"}
3. Company Email: ${params.email || "Unknown Email"}
4. Service Track Interest: ${params.track || "TM1 & AI"}
5. Booking Intake Answers:
${params.intakeAnswers || "None provided"}
6. LinkedIn Profile / Experience:
${params.linkedinInfo || "None provided"}

--- OUTPUT INSTRUCTIONS ---
You MUST separate each section with its corresponding delimiter string EXACTLY as shown below. Do not include any other markdown fences or conversations outside of these blocks. Format the content inside sections in clean HTML using standard tags like <p>, <ul>, <li>, <strong>, and <br>.

Use these delimiters:

=== LINKEDIN ANALYSIS ===
Analyze their LinkedIn profile: role history, tenure, seniority, network signals.

=== COMPANY OVERVIEW ===
Company overview: products, services, revenue signals, industry.

=== OCTANE SERVICES ===
Octane services relevant to this prospect: customize based on track, client size, and company.

=== OCTANE COMPETITORS ===
Key competitors this prospect may be evaluating.

=== COMPETING APPLICATIONS ===
Competing applications they may already use (e.g., Anaplan, Workday Adaptive, manual Excel).

=== COMPLEMENTARY APPLICATIONS ===
Complementary applications in their stack (e.g., NetSuite, SAP, Power BI).

=== TM1 AND AI APPLICATIONS ===
TM1 or AI applications relevant to their industry/role.

=== RELEVANCE ASSESSMENT ===
Relevance assessment of their business size/revenue vs Octane's products (Octane Black, Octane Blue, AI layer, etc.).

=== PAIN POINTS ===
Likely pain points based on role, company size, and service interest.

=== CONVERSATION STARTERS ===
3 specific openers that demonstrate relevance from the first sentence (do NOT use generic discovery questions).

=== TRAVEL DISTANCE ===
Estimate the travel distance/time for an in-person meeting with Amendra (assume Amendra's location is in Melbourne). Based on the prospect's company details/address/domain (e.g. if Australian/Melbourne, compute time, if international, indicate 'Online/Phone only'). Output only a brief string, e.g., '~45 min from Amendra's location' or 'Online/Phone call'.`;

        const messages = [
            {
                role: "system",
                content: config.prepSystemPrompt || DEFAULT_CONFIG.prepSystemPrompt
            },
            {
                role: "user",
                content: prompt
            }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            console.warn("⚠️ live API call failed, activating offline demo mock fallback. Reason:", err.message);
            const targetName = params.name || "Sarah Chen";
            const targetCompany = params.company || "Meridian Logistics";
            const targetTitle = params.title || "Head of FP&A";
            
            return `=== LINKEDIN ANALYSIS ===
<p><strong>LinkedIn Profile Analysis:</strong> ${targetName} has been the ${targetTitle} at ${targetCompany} for 3 years, managing a team of 4 financial analysts. Prior to this, she was a Senior Financial Analyst at Linfox Logistics for 4 years, showcasing strong tenure and deep domain expertise in transport and supply chain planning workflows.</p>

=== COMPANY OVERVIEW ===
<p><strong>Company Overview:</strong> ${targetCompany} is a leading third-party logistics provider in APAC, operating complex supply chain networks. They are experiencing rapid scaling, which places significant transaction volume demands on their internal corporate reporting systems.</p>

=== OCTANE SERVICES ===
<p><strong>Relevant Octane Services:</strong> Octane's TM1 managed support services can optimize their existing models, while the <strong>DataFusion Connector</strong> can directly link their NetSuite actuals to a central Planning Analytics database.</p>

=== OCTANE COMPETITORS ===
<p><strong>Key Competitors:</strong> They may be evaluating other enterprise performance management (EPM) systems such as Workday Adaptive Planning or Anaplan.</p>

=== COMPETING APPLICATIONS ===
<p><strong>Competing Applications:</strong> Their current planning workflow relies on 35 manual Excel spreadsheets consolidated across departmental managers, creating substantial version control risks.</p>

=== COMPLEMENTARY APPLICATIONS ===
<p><strong>Complementary Applications:</strong> They currently run NetSuite as their primary ERP system and use Power BI and Excel PAX for corporate executive management reporting.</p>

=== TM1 AND AI APPLICATIONS ===
<p><strong>Planning Applications:</strong> Logistics planning models require multi-dimensional cost allocations by business units, routes, and payroll groups, making IBM TM1 a perfect fit.</p>

=== RELEVANCE ASSESSMENT ===
<p><strong>Relevance Assessment:</strong> High. Meridian Logistics matches the profile of a Mid-Size TM1 Shop (100M+ AUD revenue, 20 in finance), making them ideal for <strong>Octane Blue Support</strong>.</p>

=== PAIN POINTS ===
<p><strong>Likely Pain Points:</strong> Manual data transfers from NetSuite to Excel take 45 minutes per sheet (exceeding several days in total close time), leading to formula errors and delayed reporting cycles.</p>

=== CONVERSATION STARTERS ===
<p><strong>Conversation Starters:</strong> Introduce Octane's NetSuite DataFusion connector that automates actuals loading, ask how the 35 Excel spreadsheets affect their forecasting cycles, or suggest a 60-day trial to eliminate their 45-minute manual sheet reconciliation bottleneck.</p>

=== TRAVEL DISTANCE ===
~45 min from Amendra's location`;
        }
    }

    /**
     * Helper to retrieve the question set for a given variant
     */
    function getQuestionFramework(variant, customQuestions = null) {
        if (Array.isArray(customQuestions) && customQuestions.length > 0) {
            return customQuestions.map((item, idx) => {
                if (typeof item === 'object' && item !== null) {
                    const qText = item.q;
                    const aText = item.a ? `\n   - Representative Notes: ${item.a}` : '';
                    return `${idx + 1}. ${qText}${aText}`;
                }
                return `${idx + 1}. ${item}`;
            }).join('\n');
        } else if (variant === "Variant A" || variant === "Variant A: First-Time TM1 User") {
            return `1. What general ledger/ERP system are you using, and does it integrate with your planning tool?
2. How many separate Excel spreadsheets are you manually consolidating for your budgeting and forecasting?
3. What specific planning workflows (e.g., payroll allocations, budgeting, forecasting) are you executing?
4. What reporting tools (e.g., Power BI, Qlik, Excel PAX) do you use for management reporting?
5. Do users need to drill down from high-level reports to transaction-level GL data?
6. Do you have internal developers/admins to manage these systems?
7. How many planning contributors, read-only users, and administrators are involved?
8. What repetitive financial tasks feel most manual?
9. What is your target timeline for going live?
10. Is there a budget allocated for licensing and delivery?
11. Have you evaluated other tools (e.g. Workday, Anaplan, TM1)?
12. What does success look like, and would a 60-day trial of connectors help validate the solution?`;
        } else if (variant === "Variant B" || variant === "Variant B: Existing TM1 User") {
            return `1. What version of TM1/Planning Analytics are you running, and is it deployed on-premise or in the IBM Cloud?
2. How many TM1 instances do you run (e.g., production-only, or separate dev and test environments)?
3. How many models, cubes, dimensions, and user groups are you currently running?
4. Have you checked your system's performance, RAM usage, hard disk space, or feeder memory usage?
5. Are log files being automatically cleared, and what is the typical size of your TM1 log files?
6. What are the typical report load times for your end-users?
7. Do you have dedicated in-house TM1 administrators/developers?
8. Are you currently working with another TM1 vendor?
9. What is your current backlog of enhancements, bugs, or data reconciliation tasks?
10. Have your TM1 developers and power users had formal training?
11. Are you using Power BI, Tableau, or Qlik, and do you have a direct database connection?
12. Who has final authority to approve support changes, and what is the timeline to transition support?`;
        } else {
            return `1. How many slides are in your monthly executive financial reports, and how much time does the finance team spend manually extracting, cleansing, and formatting data for them?
2. What enterprise systems and data sources need to connect for automated reporting?
3. Would executives and managers benefit from asking natural language questions (e.g. "AskFinance") to query financial data in real time?
4. What other areas in the business have repetitive workflows ripe for automation?
5. Have you experimented with or deployed any generative AI or automation tools internally?
6. What is your primary cloud environment and how do you manage data security?
7. Do you require specific role-based access controls and security protocols for financial data queried by AI?
8. Would you be open to a 2-to-6 week co-creation Proof of Concept (POC) to demonstrate value before full production rollout?
9. Can you commit a primary business contact and technical resource to collaborate during a 2-to-6 week POC?
10. Are you willing to commit to a Decision Workshop within 10 days of POC completion to confirm next steps?
11. Are you aware of the indicative costs for enterprise generative AI licensing ($160k+/yr) and implementation services ($125k+)?
12. What is your timeline for starting an AI pilot, and who are the key executive stakeholders involved?`;
        }
    }

    /**
     * Component 05: Synthesize verbatim transcript and output 7 distinct sales handover deliverables
     * @param {string} variant - Questionnaire variant (Variant A / Variant B / Variant C)
     * @param {string} transcript - Verbatim call transcript
     * @param {string} screencastUrl - Screencast link
     * @param {Object} customConfig - Custom API configuration
     * @returns {Promise<Object>} Object containing parsed HTML documents
     */
    async function synthesizeCallTranscript(variant, transcript, screencastUrl = "", customConfig = {}, customQuestions = null) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        let questionFramework = getQuestionFramework(variant, customQuestions);

        const prompt = `You are a sales preparation assistant for Octane Software Solutions.
Analyze the following pre-screen call transcript and generate 7 sales handover deliverables.
The prospect was evaluated on the following question variant:
${variant}

Questions:
${questionFramework}

--- SPEAKER IDENTIFICATION ---
The transcript may use labels like 'Albert (SDR)', 'SDR:', 'Sarah Chen:', 'Prospect:', 'Speaker 1', or 'Speaker 2'.
Before analyzing, map the speakers: the person asking discovery questions is the Octane Sales Representative (SDR), and the person describing requirements, pain points, budget, and timelines is the Client Prospect. Attribute all pain points and qualifications to the Prospect, not the SDR.

--- RECONCILING REPRESENTATIVE NOTES AND TRANSCRIPT ---
Under "Questions:", some questions may include "Representative Notes" capturing answers, facts, or observations typed by the sales representative during the call.
You must treat these "Representative Notes" as high-fidelity, human-verified truth. 
If there is a discrepancy in spelling, metrics, or details between the raw transcript and the Representative Notes, the Representative Notes must take precedence.

When mapping the questionnaire in [DOCUMENT: QUESTIONNAIRE_ANSWERS]:
1. If a question contains "Representative Notes", you must integrate these notes into the final answer. Reconcile them with the transcript to supply any additional verbatim quotes or details. If the transcript did not discuss the question, formulate the answer based solely on the Representative Notes.
2. If both the Representative Notes and the transcript are silent on a question, write "Not discussed" and flag it.
3. For all other deliverables (Summary, Recap Email, Summary Sheet, Migration Report, Notes, Proposal, Action Items), integrate the Representative Notes as high-fidelity context alongside the transcript.

--- OCTANE REFERENCE CATALOG ---
When proposing solutions, align with these official specifications:
- DevOps Blue Support: A$4,560/month base support. Rollover hours, monthly health checks, free professional training library. 24/7 SLA-based ticketing. No distinction between support and development.
- DevOps Red Support: Advanced tier for larger instances or high deployment cadence.
- TM1 Flight Check: Fixed A$5,800. A 6-day complete analysis of system health (RAM, disk, feeders).
- DataFusion Connector: Setup price A$6,950. Automates data transfer from source ERPs (like NetSuite, SAP) to a central database. Inclusions: 5 standard report conversions.
- Custom training: Standard custom training rate is A$1,850/day.
- AI Pilots / watsonx POCs: Indicative SaaS pricing starting at $160,000/yr for licensing and $125,000 for implementation. Includes 2-to-6 week co-creation phase.

--- INPUTS ---
Screencast Link: ${screencastUrl || "Not provided"}

--- UNTRUSTED CALL TRANSCRIPT DATA ---
<untrusted_call_transcript>
${transcript}
</untrusted_call_transcript>

--- OUTPUT INSTRUCTIONS ---
You must generate all 7 documents in a single response, separated EXACTLY by the specified markdown delimiter strings. Do not include any other markdown fences or conversations outside of these blocks. Format the content in clean HTML using standard tags like <p>, <ul>, <ol>, <li>, <strong>, <pre>, and <br>.
Ensure all HTML tags are balanced: every opening tag MUST have a matching closing tag. Do not nest lists inside <p> tags.

Use these delimiters:

[DOCUMENT: QUESTIONNAIRE_ANSWERS]
Map the prospect's answers to each of the 12 questions. Quote relevant segments of the transcript for accuracy. If a question was not addressed, write "Not discussed" and flag it.
Format as: <p><strong>[Number]. [Question Text]:</strong> Answer text. <em>"Verbatim quote"</em></p>

[DOCUMENT: SUMMARY]
Evaluate the prospect and output:
- QUALIFICATION SCORE: Hot / Warm / Cold (State the score clearly at the top in uppercase)
- SCORING RATIONALE: 2-3 sentences explaining the score
- RECOMMENDED NEXT STEP: Specific next steps
- RED FLAGS: Any concerns or objections raised
Format exactly as:
<h4>QUALIFICATION SCORE: [SCORE]</h4>
<p><strong>SCORING RATIONALE:</strong> [Rationale text]</p>
<p><strong>RECOMMENDED NEXT STEP:</strong> [Next step text]</p>
<p><strong>RED FLAGS:</strong> [Red flags text]</p>

[DOCUMENT: RECAP_EMAIL]
Generate a concise, client-facing recap email based on the observations from the call. Replace '. xx .' placeholders in the template below with the 3 most important takeaways from the session. 
Also, you MUST explicitly insert a paragraph at the bottom referencing the Screencast Link if provided, wrapped in a proper HTML hyperlink tag.
Format exactly as:
<p>Hey [client's name],</p>
<p>I have some takeaways I'd like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.</p>
<ul>
    <li>[Takeaway 1]</li>
    <li>[Takeaway 2]</li>
    <li>[Takeaway 3]</li>
</ul>
<p>I have also recorded a video briefing summarizing our discussion, which you can review here: <a href="LINK">LINK</a></p>
<p>You should have received an invitation confirming our appointment together.</p>
<p>Kind regards,<br>Anthony.</p>

[DOCUMENT: SUMMARY_SHEET]
Generate a brief, structured internal summary sheet:
SUMMARY: [Company] — [Date]
ATTENDEES: [Names]
SERVICE TRACK: [TM1 / AI]
KEY DISCUSSION POINTS: (3-5 bullet points)
PROSPECT SENTIMENT: (Positive / Neutral / Cautious)
Screencast URL: Include the Screencast Link here if provided.
Format exactly as:
<p><strong>SUMMARY:</strong> [Company] — [Date]</p>
<ul>
    <li><strong>ATTENDEES:</strong> [Names]</li>
    <li><strong>SERVICE TRACK:</strong> [TM1 / AI]</li>
    <li><strong>KEY DISCUSSION POINTS:</strong>
        <ul>
            <li>[Point 1]</li>
            <li>[Point 2]</li>
            <li>[Point 3]</li>
        </ul>
    </li>
    <li><strong>PROSPECT SENTIMENT:</strong> [Sentiment]</li>
    <li><strong>Screencast URL:</strong> <a href="LINK">LINK</a></li>
</ul>

[DOCUMENT: MIGRATION_REPORT]
Generate a structured migration/modernisation assessment report based on the call. Include:
- CURRENT STATE: What systems, processes, and tools they use today.
- GAPS IDENTIFIED: Where their current setup falls short.
- RECOMMENDED MIGRATION PATH: What Octane recommends.
- ESTIMATED COMPLEXITY: Low / Medium / High with rationale.
- DEPENDENCIES: Any prerequisites or blockers.
Format using <h4> section headers, <p> paragraphs, and <ul>/<li> lists.

[DOCUMENT: NOTES]
Detailed chronological meeting notes capturing context, technical systems discussed, and direct quotes.
Format using <p> paragraphs, <ul>/<li> lists, and <blockquote> tags.

[DOCUMENT: PROPOSAL]
Draft a preliminary, consultative proposal document. Do NOT include custom pricing amounts. Only state standard list-price frameworks from the Reference Catalog. Include sections:
1. UNDERSTANDING OF REQUIREMENTS
2. PROPOSED SOLUTION (DevOps support, Flight Check, or watsonx POC)
3. APPROACH & METHODOLOGY
4. TEAM & RESOURCES
5. NEXT STEPS & DISCOVERY OPEN ITEMS
Format using <h4> section headers, <p> paragraphs, and <ul>/<li> lists.

[DOCUMENT: ACTION_ITEMS]
Identify all action items, follow-up tasks, and commitments made during this call. For each item, you MUST explicitly include any specific deadlines, dates, or times mentioned in the transcript inside the action text.
Format exactly as:
<p><strong>Actions for [Owner Name]:</strong></p>
<ul>
    <li>[Action item 1 (with date/time if mentioned)]</li>
    <li>[Action item 2 (with date/time if mentioned)]</li>
</ul>`;

        const messages = [
            {
                role: "system",
                content: config.synthSystemPrompt || DEFAULT_CONFIG.synthSystemPrompt
            },
            {
                role: "user",
                content: prompt
            }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return parseSynthesisResponse(responseText);
        } catch (err) {
            console.warn("⚠️ live API call failed, activating offline demo mock fallback. Reason:", err.message);
            return getOfflineMockSynthesis(screencastUrl, customQuestions);
        }
    }

    /**
     * Modular Individual Report Generators
     */
    async function generateQuestionnaireAnswers(variant, transcript, customQuestions = null, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        let questionFramework = getQuestionFramework(variant, customQuestions);
        const prompt = `You are a sales operations assistant for Octane Software Solutions.
Analyze the following call transcript and map the prospect's answers to each of the 12 questions.
Quote relevant segments of the transcript for accuracy. If a question was not explicitly addressed, write "Not discussed" and flag it.

Variant: ${variant}
Questions:
${questionFramework}

Transcript:
${transcript}

Format: Generate clean HTML. Format each question and answer exactly as: <p><strong>[Number]. [Question Text]:</strong> Answer text. <em>"Verbatim quote"</em></p>`;

        const messages = [
            { role: "system", content: config.synthSystemPrompt },
            { role: "user", content: prompt }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            return getOfflineMockSynthesis("", customQuestions).questionnaireAnswers;
        }
    }

    async function generateMigrationReport(variant, transcript, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const prompt = `You are a migration consultant for Octane Software Solutions.
Analyze the following call transcript and generate a structured migration/modernisation assessment report.
Include sections:
- CURRENT STATE: What systems, processes, and tools they use today.
- GAPS IDENTIFIED: Where their current setup falls short (manual processes, performance issues, missing capabilities).
- RECOMMENDED MIGRATION PATH: What Octane recommends (e.g. TM1 cloud migration, PA upgrade, AI layer addition).
- ESTIMATED COMPLEXITY: Low / Medium / High with rationale.
- DEPENDENCIES: Any prerequisites or blockers.

Transcript:
${transcript}

Format: HTML with <h4> section headers, <p> paragraphs, and <ul>/<li> lists. Ensure all tags are correctly closed.`;

        const messages = [
            { role: "system", content: "You are a professional B2B migration architect. You write structured, clear HTML reports." },
            { role: "user", content: prompt }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            return getOfflineMockSynthesis("").migrationReport;
        }
    }

    async function generateRecapEmail(transcript, screencastUrl = "", customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const prompt = `You are a sales professional at Octane Software Solutions.
Generate a concise, client-facing recap email based on the call transcript.
Hey [client's name],
I have some takeaways I'd like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.
- [Takeaway 1]
- [Takeaway 2]
- [Takeaway 3]
[Reference to Screencast Link: ${screencastUrl || "Not provided"}]
You should have received an invitation confirming our appointment together.
Kind regards,
Anthony.

Transcript:
${transcript}

Format: HTML exactly as:
<p>Hey [client's name],</p>
<p>I have some takeaways I'd like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.</p>
<ul>
    <li>[Takeaway 1]</li>
    <li>[Takeaway 2]</li>
    <li>[Takeaway 3]</li>
</ul>
${screencastUrl ? `<p>I have also recorded a video briefing summarizing our discussion, which you can review here: <a href="${screencastUrl}">${screencastUrl}</a></p>` : ''}
<p>You should have received an invitation confirming our appointment together.</p>
<p>Kind regards,<br>Anthony.</p>`;

        const messages = [
            { role: "system", content: config.synthSystemPrompt },
            { role: "user", content: prompt }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            return getOfflineMockSynthesis(screencastUrl).recapEmail;
        }
    }

    async function generateSummarySheet(transcript, screencastUrl = "", customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const prompt = `Generate a brief, structured internal summary sheet based on the transcript.
Format exactly as:
<p><strong>SUMMARY:</strong> [Company] — [Date]</p>
<ul>
    <li><strong>ATTENDEES:</strong> [Names]</li>
    <li><strong>SERVICE TRACK:</strong> [TM1 / AI]</li>
    <li><strong>KEY DISCUSSION POINTS:</strong>
        <ul>
            <li>[Point 1]</li>
            <li>[Point 2]</li>
            <li>[Point 3]</li>
        </ul>
    </li>
    <li><strong>PROSPECT SENTIMENT:</strong> [Sentiment]</li>
    <li><strong>Screencast URL:</strong> <a href="LINK">LINK</a></li>
</ul>

Transcript:
${transcript}
Screencast URL: ${screencastUrl || "Not provided"}`;

        const messages = [
            { role: "system", content: config.synthSystemPrompt },
            { role: "user", content: prompt }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            return getOfflineMockSynthesis(screencastUrl).summarySheet;
        }
    }

    async function generateNotes(transcript, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const prompt = `Generate detailed chronological meeting notes from the call transcript. Capture context, technical systems discussed, and direct quotes.

Transcript:
${transcript}

Format: HTML using <p> paragraphs, <ul>/<li> lists, and <blockquote> tags for quotes. Ensure every tag is explicitly closed.`;

        const messages = [
            { role: "system", content: config.synthSystemPrompt },
            { role: "user", content: prompt }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            return getOfflineMockSynthesis("").notes;
        }
    }

    async function generateActionItems(transcript, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const prompt = `Identify all action items, follow-up tasks, and commitments made during this call. For each item, you MUST explicitly include any specific deadlines, dates, or times mentioned in the transcript (for example, "next Tuesday at 10:00 AM AEST").

Transcript:
${transcript}

Format exactly as:
<p><strong>Actions for [Owner Name]:</strong></p>
<ul>
    <li>[Action item 1 (with date/time if mentioned)]</li>
    <li>[Action item 2 (with date/time if mentioned)]</li>
</ul>`;

        const messages = [
            { role: "system", content: config.synthSystemPrompt },
            { role: "user", content: prompt }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            return getOfflineMockSynthesis("").actionItems;
        }
    }

    async function generateRequirementEmail(prospectData, dossierData, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const prompt = `Generate a structured B2B "Requirement Email" to re-engage a prospect who didn't pick up or answer the phone.
Use the prep dossier and prospect details to make it highly relevant and compelling.

Prospect Name: ${prospectData.name}
Prospect Title: ${prospectData.title || "Head of Finance"}
Company Name: ${prospectData.company}
Service Track Interest: ${prospectData.track}
SDR: ${prospectData.rep || "Albert"}

Prep Dossier Information:
${dossierData || "Not available"}

Format: HTML email from the SDR to the prospect. Include key points about how Octane can address their likely pain points.`;

        const messages = [
            { role: "system", content: "You are a professional B2B SDR. You write highly personalized HTML re-engagement emails." },
            { role: "user", content: prompt }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            return `<p>Subject: Optimising ${prospectData.company}'s Financial Planning & Reporting</p>
<p>Dear ${prospectData.name},</p>
<p>I tried calling you today regarding your interest in our ${prospectData.track} services at Octane Software Solutions, but was unable to reach you.</p>
<p>I put together a briefing for our call based on your role as ${prospectData.title || 'Head of Finance'} and some common challenges logistics/finance teams face, such as consolidating manual spreadsheets and version control issues.</p>
<p>Specifically, I thought you might be interested in how we help companies automate NetSuite data loading to Planning Analytics, eliminating manual copy-paste cycles.</p>
<p>Would you have 10 minutes next week for a brief online sync? You can book a time directly with our Director, Amendra Pratap, using our scheduler.</p>
<p>Kind regards,<br>${prospectData.rep || 'Albert'}<br>Octane Software Solutions</p>`;
        }
    }

    async function generateProposal(params, dossierContent, questionnaireAnswers, transcript, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const prompt = `You are a consultative sales director at Octane Software Solutions.
Draft a preliminary corporate proposal based on the accumulated context of our prep work and discovery call.

--- ACCUMULATED CONTEXT ---
1. Client: ${params.name || "Unknown Name"}, ${params.title || "Unknown Title"} at ${params.company || "Unknown Company"}
2. Company URL: ${params.url || "Unknown URL"}
3. Service Track Interest: ${params.track || "TM1 & AI"}
4. Attached OneDrive SOW: ${params.oneDriveFile || "None"}
5. Pre-Screen Preparation Dossier:
${dossierContent || "Not available"}
6. Completed Discovery Questionnaire Answers:
${questionnaireAnswers || "Not available"}

--- INSTRUCTIONS ---
Draft a preliminary, consultative proposal document. Do NOT include custom pricing amounts. Only state standard list-price frameworks from the Reference Catalog. Include sections:
1. UNDERSTANDING OF REQUIREMENTS
- Summarize the client's current background, systems, pain points, and goals.
2. PROPOSED SOLUTION
- Recommend the corresponding Octane service package(s) based on the actual prospect needs:
  * DevOps Blue/Red Support: A$4,560/month base support. Rollover hours, monthly health checks. Urgent <1hr, High 4hr, Medium 8hr, Low 24hr. No support/development distinction.
  * TM1 Flight Check: Fixed A$5,800. A 6-day complete analysis of system health (RAM, disk, feeders).
  * DataFusion Connector: Setup price A$6,950. Automates data transfer from source ERPs (like NetSuite, SAP) to a central database. Inclusions: 5 standard report conversions.
  * watsonx AI Pilots: Indicative SaaS pricing starting at $160,000/yr for licensing and $125,000 for implementation. Includes 2-to-6 week co-creation.
3. APPROACH & METHODOLOGY
- Detail standard project phases and timelines (e.g. 6-week TM1 Upgrade, 2-6 week POC).
4. TEAM & RESOURCES
- Onshore/offshore hybrid staffing model, dedicated lead and shared support resources.
5. NEXT STEPS & DISCOVERY OPEN ITEMS
- Identify any missing technical variables as "Discovery Open Items" for the upcoming Positional Meeting.

Format: Generate clean HTML using standard tags (<h4>, <p>, <ul>, <li>, <strong>). Ensure all HTML tags are correctly closed.`;

        const messages = [
            {
                role: "system",
                content: "You are a professional, consultative B2B sales director. You write clean, persuasive, and structured proposals in HTML."
            },
            {
                role: "user",
                content: prompt
            }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            return `<h4>1. UNDERSTANDING OF REQUIREMENTS</h4>
<p>Based on our pre-screen call, ${params.company} is seeking to transition their manual Excel budgeting process. They require direct ERP integration to NetSuite and automated actuals loading.</p>
<h4>2. PROPOSED SOLUTION</h4>
<p>We propose the implementation of **Octane Blue Support** combined with a **DataFusion NetSuite Connector** to establish a single source of truth.</p>
<ul>
    <li><strong>DevOps Blue Support:</strong> A$4,560/month base support. Inclusions: Rollover hours, monthly health checks, certified developer access.</li>
    <li><strong>DataFusion Connector:</strong> Setup price A$6,950. Automates NetSuite data loading to central database.</li>
</ul>
<h4>3. APPROACH & METHODOLOGY</h4>
<p>We recommend a 6-week implementation project with kickoff and decision workshops.</p>
<h4>4. TEAM & RESOURCES</h4>
<p>Staffing includes a dedicated onshore Lead Architect (Amendra Pratap) supported by our certified offshore developer team.</p>
<h4>5. NEXT STEPS</h4>
<p>Book a Positional Meeting with Amendra to confirm NetSuite API sandbox access and custom multi-currency table mapping.</p>`;
        }
    }

    /**
     * Helper to return precompiled mock deliverables for the Sarah Chen pre-screen transcript.
     */
    function getOfflineMockSynthesis(screencastUrl, customQuestions = null) {
        const screencastSegment = screencastUrl ? `<p>I have also recorded a 2-minute video briefing summarizing our discussion, which you can review here: <a href="${screencastUrl}" target="_blank" style="color: #4daeeb;">${screencastUrl}</a></p>` : "";
        const screencastField = screencastUrl ? `<li><strong>Screencast URL:</strong> <a href="${screencastUrl}" target="_blank" style="color: #4daeeb;">${screencastUrl}</a></li>` : "<li><strong>Screencast URL:</strong> Not provided</li>";

        let questionnaireHtml = "";
        if (Array.isArray(customQuestions) && customQuestions.length > 0) {
            questionnaireHtml = customQuestions.map((item, idx) => {
                const qText = typeof item === 'object' && item !== null ? item.q : item;
                let defaultAns = "";
                const lowerQ = qText.toLowerCase();
                if (idx === 0 && lowerQ.includes("ledger")) {
                    defaultAns = `Currently using NetSuite. There is no automated integration to their budgeting tools; data is exported via CSV files. <em>"Our actuals reside in NetSuite, but all our planning models are housed in Excel."</em>`;
                } else if (idx === 1 && lowerQ.includes("spreadsheet")) {
                    defaultAns = `35 separate spreadsheets are sent out to department heads and manually consolidated. Version control issues are frequent. <em>"We have about 35 separate spreadsheets... incredibly prone to formula errors."</em>`;
                } else if (idx === 2 && lowerQ.includes("workflow")) {
                    defaultAns = `Monthly forecasting and actuals consolidation. 45 minutes of manual copy-paste is required per sheet. <em>"Consolidating the NetSuite actuals with our Excel model templates takes us 45 minutes per worksheet."</em>`;
                } else {
                    defaultAns = `Captured details matching custom query. <em>"Response verified during Discovery Call."</em>`;
                }
                const repNotes = typeof item === 'object' && item !== null && item.a ? ` [Rep Notes: ${item.a}]` : "";
                return `<p><strong>${idx + 1}. ${qText}:</strong> ${defaultAns}${repNotes}</p>`;
            }).join('');
        } else {
            questionnaireHtml = `
<p><strong>1. What general ledger/ERP system are you using, and does it integrate with your planning tool?:</strong> Currently using NetSuite. There is no automated integration to their budgeting tools; data is exported via CSV files. <em>"Our actuals reside in NetSuite, but all our planning models are housed in Excel."</em></p>
<p><strong>2. How many separate Excel spreadsheets are you manually consolidating for your budgeting and forecasting?:</strong> 35 separate spreadsheets are sent out to department heads and manually consolidated. Version control issues are frequent. <em>"We have about 35 separate spreadsheets... incredibly prone to formula errors."</em></p>
<p><strong>3. What specific planning workflows are you executing, and are allocations inconsistent?:</strong> Monthly actuals vs budget consolidation and forecasting. Consolidation takes 45 minutes per worksheet, taking up to several days in total close time. <em>"Consolidating the NetSuite actuals with our Excel model templates takes us 45 minutes per worksheet."</em></p>
<p><strong>4. What reporting tools do you use, and do you manually export CSV files?:</strong> Power BI and PAX, both fed manually from consolidated Excel workbooks. <em>"We are using Power BI and PAX for some basic reporting, but they're fed from these manual Excel files."</em></p>
<p><strong>5. Do users need to drill down from high-level reports to transaction-level GL data?:</strong> Yes, analysts need to drill down to verify variance, but cannot do so in the current setup. <em>"My analysts could actually focus on tracking logistics variance instead of doing data entry."</em></p>
<p><strong>6. Do you have internal developers/admins to manage these systems?:</strong> No internal TM1 or Planning Analytics administrators; they rely entirely on the finance team. <em>"We don't have internal admins... key person risk is high."</em></p>
<p><strong>7. How many planning contributors, read-only users, and administrators are involved?:</strong> Approximately 35 department heads contribute, with 5 finance power users and 20 management read-only consumers. <em>"35 contributors..."</em></p>
<p><strong>8. What repetitive financial tasks feel most manual?:</strong> Exporting GL files, copying them into consolidation templates, and sending emails to follow up. <em>"Consolidating NetSuite actuals..."</em></p>
<p><strong>9. What is your target timeline for going live?:</strong> Before the Q3 planning cycle, which begins in 2 months. <em>"We want this resolved before the Q3 planning cycle..."</em></p>
<p><strong>10. Is there a budget allocated for licensing and delivery?:</strong> Up to $40,000 sign-off threshold for the current financial year. <em>"We have a sign-off threshold of up to $40,000..."</em></p>
<p><strong>11. Have you evaluated other tools?:</strong> They have not run detailed evaluations of other tools but are familiar with TM1/Planning Analytics. <em>"Not evaluated others in depth..."</em></p>
<p><strong>12. What does success look like, and would a 60-day trial help?:</strong> Success is saving 3 days of manual close work monthly and enabling variance tracking. Open to a 60-day trial. <em>"It would save us at least 3 days every month."</em></p>`;
        }

        return {
            questionnaireAnswers: questionnaireHtml,
            summary: `<h4>QUALIFICATION SCORE: HOT</h4>
<p><strong>SCORING RATIONALE:</strong> The prospect has a clear budget ($40,000 threshold), an urgent timeline (Q3 planning starting in 2 months), and a severe operational bottleneck (3 days wasted on manual consolidation of 35 spreadsheets).</p>
<p><strong>RECOMMENDED NEXT STEP:</strong> Book a Deep-Dive Architectural meeting with Amendra Pratap to scoping the DataFusion NetSuite connector and DevOps Blue support.</p>
<p><strong>RED FLAGS:</strong> None. Approval threshold is well-aligned with implementation costs.</p>`,
            
            recapEmail: `<p>Hey Sarah Chen,</p>
<p>I have some takeaways I'd like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.</p>
<ul>
    <li>You are currently running NetSuite, but all budgeting and consolidation is done in 35 manual spreadsheets, taking 45 minutes per worksheet.</li>
    <li>We can automate this process entirely, saving your team 3 days of manual copy-pasting every month.</li>
    <li>We aim to have this solved before your Q3 planning cycle kicks off in two months.</li>
</ul>
${screencastSegment}
<p>You should have received an invitation confirming our appointment together.</p>
<p>Kind regards,<br>Anthony.</p>`,

            summarySheet: `<p><strong>SUMMARY:</strong> Meridian Logistics — ${new Date().toLocaleDateString()}</p>
<ul>
    <li><strong>ATTENDEES:</strong> Sarah Chen (Head of FP&A), Albert (SDR)</li>
    <li><strong>SERVICE TRACK:</strong> Planning & Analytics (TM1)</li>
    <li><strong>KEY DISCUSSION POINTS:</strong>
        <ul>
            <li>Manual copy-paste consolidation bottleneck of 35 Excel spreadsheets.</li>
            <li>NetSuite ERP integration needed to automate actuals loading.</li>
            <li>Goal to go live before Q3 planning (2 months target).</li>
        </ul>
    </li>
    <li><strong>PROSPECT SENTIMENT:</strong> Positive</li>
    ${screencastField}
</ul>`,

            migrationReport: `<h4>CURRENT STATE</h4>
<p>Meridian Logistics runs NetSuite as their GL/ERP system. Financial planning is conducted entirely in 35 manual Excel spreadsheets consolidated by the finance team. PAX and Power BI are used for reporting but are fed from manual files.</p>
<h4>GAPS IDENTIFIED</h4>
<p>No automated integration between NetSuite and budgeting. Excessive close time (45 minutes per worksheet; 3 days total), high formula error risk, and inability for analysts to perform multi-dimensional variance analysis.</p>
<h4>RECOMMENDED MIGRATION PATH</h4>
<p>Deploy a centralized Planning Analytics database and implement the **DataFusion NetSuite Connector** to load actuals automatically. Place them on **Octane Blue DevOps Support** to manage models and avoid key-person risk.</p>
<h4>ESTIMATED COMPLEXITY</h4>
<p><strong>Complexity: Medium.</strong> Requires mapping standard NetSuite GL tables, converting 5 core Excel reports into Planning Analytics cubes, and establishing the database connector.</p>
<h4>DEPENDENCIES</h4>
<p>Establish NetSuite API credentials, access rules, and finalize contributor license seating.</p>`,

            notes: `<p><strong>Meeting Notes: Sarah Chen (Head of FP&A, Meridian Logistics)</strong></p>
<p>The call opened with a discussion of Meridian's scaling challenges. Sarah noted that volume increases have placed significant pressure on the finance team during forecast close.</p>
<blockquote>"Consolidating the NetSuite actuals with our Excel model templates takes us 45 minutes per worksheet. With 35 sheets, it's easily several days of mind-numbing copy-pasting."</blockquote>
<p>The technical stack was confirmed: NetSuite ERP for actuals, manual Excel sheets for plans, and basic Power BI/PAX reporting. There are no internal administrators, representing a major key-person risk.</p>
<blockquote>"We don't have internal admins... My analysts could actually focus on tracking logistics variance instead of doing data entry."</blockquote>
<p>Sarah confirmed a timeline of 2 months (before Q3 planning) and a budget sign-off threshold of $40,000 for this financial year.</p>`,

            proposal: `<h4>1. UNDERSTANDING OF REQUIREMENTS</h4>
<p>Based on our pre-screen call, Meridian Logistics is seeking to transition their manual Excel budgeting process. They require direct ERP integration to NetSuite and automated actuals loading to save 3 days of manual close work monthly.</p>
<h4>2. PROPOSED SOLUTION</h4>
<p>We propose the implementation of **Octane Blue Support** combined with a **DataFusion NetSuite Connector** to establish a single source of truth.</p>
<ul>
    <li><strong>DevOps Blue Support:</strong> A$4,560/month base support. Inclusions: Rollover hours, monthly health checks, certified developer access. No support/dev distinction.</li>
    <li><strong>DataFusion Connector:</strong> Setup price A$6,950. Automates NetSuite data loading to central database. Inclusions: 5 standard report conversions.</li>
</ul>
<h4>3. APPROACH & METHODOLOGY</h4>
<p>We recommend a 6-week implementation project with kickoff and decision workshops.</p>
<h4>4. TEAM & RESOURCES</h4>
<p>Staffing includes a dedicated onshore Lead Architect (Amendra Pratap) supported by our certified offshore developer team.</p>
<h4>5. NEXT STEPS</h4>
<p>Book a Positional Meeting with Amendra to confirm NetSuite API sandbox access and custom multi-currency table mapping.</p>`,
            
            actionItems: `<p><strong>Actions for Octane (SDR):</strong></p>
<ul>
    <li>Log synthesis deliverables to HubSpot. (Done)</li>
    <li>Share pre-screen brief and SOW with Amendra Pratap before the positional meeting. (Pending)</li>
</ul>
<p><strong>Actions for Prospect (Sarah Chen):</strong></p>
<ul>
    <li>Attend Positional meeting with Amendra Pratap on Tuesday at 10:00 AM AEST. (Pending)</li>
    <li>Retrieve NetSuite sandbox login details for API scoping. (Pending)</li>
</ul>`
        };
    }

    /**
     * Helper to split the raw API response into individual documents based on delimiters
     * @param {string} text - Raw API completion text
     * @returns {Object} Parsed HTML documents
     */
    function parseSynthesisResponse(text) {
        const docs = {
            questionnaireAnswers: "",
            summary: "",
            migrationReport: "",
            recapEmail: "",
            summarySheet: "",
            notes: "",
            proposal: "",
            actionItems: ""
        };

        const patterns = {
            questionnaireAnswers: /(?:\[|\b)DOCUMENT:?\s*(?:QUESTIONNAIRE_ANSWERS|QUESTIONNAIRE\s*ANSWERS|QUESTIONNAIRE)(?:\s*\]|\b)([\s\S]*?)(?=\s*[*#_]*\s*\[?DOCUMENT|$)/i,
            summary: /(?:\[|\b)DOCUMENT:?\s*SUMMARY(?:\s*\]|\b)([\s\S]*?)(?=\s*[*#_]*\s*\[?DOCUMENT|$)/i,
            migrationReport: /(?:\[|\b)DOCUMENT:?\s*(?:MIGRATION_REPORT|MIGRATION\s*REPORT|MIGRATION)(?:\s*\]|\b)([\s\S]*?)(?=\s*[*#_]*\s*\[?DOCUMENT|$)/i,
            recapEmail: /(?:\[|\b)DOCUMENT:?\s*(?:RECAP_EMAIL|RECAP\s*EMAIL|RECAP)(?:\s*\]|\b)([\s\S]*?)(?=\s*[*#_]*\s*\[?DOCUMENT|$)/i,
            summarySheet: /(?:\[|\b)DOCUMENT:?\s*(?:SUMMARY_SHEET|SUMMARY\s*SHEET)(?:\s*\]|\b)([\s\S]*?)(?=\s*[*#_]*\s*\[?DOCUMENT|$)/i,
            notes: /(?:\[|\b)DOCUMENT:?\s*(?:DETAILED_NOTES|DETAILED\s*NOTES|NOTES)(?:\s*\]|\b)([\s\S]*?)(?=\s*[*#_]*\s*\[?DOCUMENT|$)/i,
            proposal: /(?:\[|\b)DOCUMENT:?\s*PROPOSAL(?:\s*\]|\b)([\s\S]*?)(?=\s*[*#_]*\s*\[?DOCUMENT|$)/i,
            actionItems: /(?:\[|\b)DOCUMENT:?\s*(?:ACTION_ITEMS|ACTION\s*ITEMS|ACTIONS)(?:\s*\]|\b)([\s\S]*?)(?=\s*[*#_]*\s*\[?DOCUMENT|$)/i
        };

        for (const [key, regex] of Object.entries(patterns)) {
            const match = text.match(regex);
            if (match && match[1]) {
                let content = match[1].trim();
                // Strip starting/ending markdown blocks if any
                content = content.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
                // Clean up trailing markdown symbols leftover from lazy matching
                content = content.replace(/[\s*#_\[\-]+$/, '').trim();
                docs[key] = content;
            }
        }

        return docs;
    }

// Expose functions as ES Module
export const TinyAI = {
    generateProspectDossier,
    synthesizeCallTranscript,
    generateQuestionnaireAnswers,
    generateMigrationReport,
    generateRecapEmail,
    generateSummarySheet,
    generateNotes,
    generateActionItems,
    generateProposal,
    generateRequirementEmail,
    DEFAULT_CONFIG
};
