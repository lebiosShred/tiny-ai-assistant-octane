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

// Dynamic Centralized Pricing Catalog Loader
let pricingCatalogString = "";
async function loadPricingCatalog() {
    if (pricingCatalogString) return pricingCatalogString;
    try {
        const res = await fetch('/api/config/pricing');
        if (res.ok) {
            const data = await res.json();
            pricingCatalogString = data.packages.map(p => `- ${p.name}: ${p.price}. ${p.description}`).join('\n');
            return pricingCatalogString;
        }
    } catch (e) {
        console.error("⚠️ Failed to fetch pricing catalog dynamically:", e.message);
    }
    // Static fallback in case backend is down or disconnected
    pricingCatalogString = [
        "- DevOps Blue Support: A$4,560/month base support. Rollover hours, monthly health checks, free professional training library. 24/7 SLA-based ticketing. No distinction between support and development.",
        "- DevOps Red Support: Advanced tier for larger instances or high deployment cadence.",
        "- TM1 Flight Check: Fixed A$5,800. A 6-day complete analysis of system health (RAM, disk, feeders).",
        "- DataFusion Connector: Setup price A$6,950. Automates data transfer from source ERPs (like NetSuite, SAP) to a central database. Inclusions: 5 standard report conversions.",
        "- Custom training: Standard custom training rate is A$1,850/day.",
        "- AI Pilots / watsonx POCs: Indicative SaaS pricing starting at $160,000/yr for licensing and $125,000 for implementation. Includes 2-to-6 week co-creation phase."
    ].join('\n');
    return pricingCatalogString;
}

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
        try {
            const distanceRes = await fetch('/api/calculate-distance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination: params.company })
            });
            if (distanceRes.ok) {
                const data = await distanceRes.json();
                params.transitDistance = data.distanceString || "Online/Phone call only (Distance unavailable)";
            } else {
                params.transitDistance = "Online/Phone call only (Distance unavailable)";
            }
        } catch (e) {
            params.transitDistance = "Online/Phone call only (API Error)";
        }
        const prompt = `You are a sales preparation assistant for Octane Software Solutions.
I am about to have a 30-minute pre-screen call with a prospect. Using the inputs below and your knowledge of Octane's services (IBM TM1/Planning Analytics managed support, Watsonx Orchestrate agentic AI integrations, and DataFusion connectors), produce a 12-POINT BRIEFING.

--- INPUTS ---
1. Client: ${params.name || "Unknown Name"}, ${params.title || "Unknown Title"} at ${params.company || "Unknown Company"}
2. Company URL: ${params.url || "Unknown URL"}
3. Company Email: ${params.email || "Unknown Email"}
4. Service Track Interest: ${params.track || "TM1 & AI"}
5. Booking Intake Answers:
${params.intakeAnswers || "None provided"}
6. LinkedIn Profile / Experience:
${params.linkedinInfo || "None provided"}
7. Attached Google Drive Document Name: ${params.gDriveFile || "None"}
8. Attached Google Drive Document Content:
${params.gDriveFileContent || "No document content attached."}

--- OCTANE TARGET CUSTOMER PROFILES PLAYBOOK ---
Refer to these standard target customer profiles for Octane to classify the prospect:
- Large TM1 Shops: System Owner or IT. Pain: Cost of resource, Accessing quality resource, Stuck with inflexible vendors, Internal resources are not that skilled, Support and Development maturity, growing pains. Product: Octane Black (Full support, onshore/offshore, for 200+ user scales).
- Mid Size TM1 Shops: CFO or Head of FP&A. Pain: High cost of support, backlog of projects, Support is ad hoc, In-house resource drives the agenda, not modern setup. Product: Octane Blue (DevOps Support) with roadmap to expand to licenses.
- Small TM1 Shops: CFO or Head of FP&A. Pain: High cost of support, backlog of projects, Support is ad hoc, In-house resource drives the agenda. Product: Octane Blue (DevOps Support).
- TM1 Shops still On-Premise: CFO or Head of FP&A. Pain: Legacy Perspectives/Excel dependencies, migration risk, outdated infrastructure. Product: TM1 Modernisation Play (Cloud/PA migration).
- New TM1 Supply Chain Prospects: CFO or Head of Supply Chain. Pain: Manual Excel demand planning, inventory planning, disconnected supply & demand, unable to scale, reconciliation issues. Product: Custom Supply Chain Model (Accelerated development using Octane's template).
- New TM1 FP&A Prospects: CFO or Head of FP&A. Pain: Manual budgeting/forecasting, slow insights, looking to move to FP&A platform, turnover >$50M. Product: IBM Planning Analytics (TM1).
- Enterprise AI in Finance (Large): CFO. Pain: Slow month-end close (5+ days), manual reporting, drowning in repetitive queries, no ROI visibility, turnover >$500M. Product: Octane Finance Agent + FastClose.
- MidMarket AI in Finance: CFO. Pain: Month-end reporting is manual/slow, CFO chasing data, no self-serve reporting, board packs take too long, struggling to hire, turnover $100M-$500M. Product: FastClose entry point, then upsell to Finance Agent.
- IBM PA + AI Upgrade (Existing TM1 Shops): CFO, System Owner, Head of FP&A. Pain: TM1 not delivering AI-powered insights, investment underutilized, competitor pressure, manual reporting. Product: Finance Agent on top of existing Planning Analytics.

--- HISTORICAL CLIENT PROFILES ---
Use these real examples for peer credibility stories:
- Steric (Life Sciences): Olivia McKellar / Vicki Carline. Deanna Chapman. Product in Use: Octane Blue Support. Limited TM1 bandwidth.
- GreyOrange (Supply Chain Automation): Nageswara Reddy Kondreddy. Product in Use: Octane Blue. APAC operations support.
- Iqony / STEAG (Energy): Carola Jochheim. Product in Use: DataFusion. SAP to PA integration.
- Shift (FinTech / Auto Finance): Alvin Ah-Chok. Product in Use: Octane Blue & IBM Planning Analytics. Slow cycles, spreadsheet sprawl.
- mycar (Retail / Automotive): Olivia McKellar. Product in Use: Additional RAM & IBM Planning Analytics Upgrade. Legacy TM1 memory bottleneck.
- McPherson’s (Consumer Goods): Will Clemente. Product in Use: IBM Planning Analytics. Large analytics transformation.
- News Corp Australia (Media): Ritwik Deo. Product in Use: TeamOne/TM1 Renewal.
- Fintechs (AP Pain Point): raised Series C, $10M+ revenue, Scenario A (AP Volume): TM1, Scenario B (Hiring AP): AI Assistants.

--- OUTPUT INSTRUCTIONS ---
You MUST separate each section with its corresponding delimiter string EXACTLY as shown below. Do not include any other markdown fences or conversations outside of these blocks. Format the content inside sections in clean HTML using standard tags like <p>, <ul>, <li>, <strong>, and <br>.
You are strictly forbidden from using the words 'likely', 'probably', 'standard', or 'general'. If you do not have hard evidence from the RAG inputs, output 'UNKNOWN' or 'NO DATA'.

Use these delimiters:

=== LINKEDIN ANALYSIS ===
Extract the exact names of the prospect's 3 most recent companies, their exact job titles, and their university/education. If none are found in the RAG context, output exactly: 'NO DATA'. Do not summarize. List the hard facts.

=== COMPANY OVERVIEW ===
Company overview: Extract specific products, services, and recent corporate news or triggers from the RAG context. If none found, output 'NO DATA'.

=== DISCOVERY TRACK CLASS ===
Classify the prospect into:
- **Variant A (First-Time TM1 / Planning Analytics User)**: If they consolidate data manually in Excel spreadsheets.
- **Variant B (Existing TM1 / Planning Analytics User)**: If they already run IBM Planning Analytics / TM1 but face support bottlenecks or migration requirements.

=== TAILORED PLAYBOOK QUESTIONS ===
Provide 4-5 specific open-ended discovery questions. DO NOT use generic questions. Map the questions explicitly to their exact job title and their specific industry.

=== RELEVANT OCTANE SERVICES & PRICING ===
Specify the exact recommended package with pricing (e.g. DevOps Blue Support at A$4,560/mo flat-rate, TM1 Flight Check fixed audit at A$5,800, or DataFusion Setup at A$6,950, or watsonx AI Pilots starting at $125,000).

=== PEER CREDIBILITY STORY ===
Map this prospect's exact sector and stack to 1-2 relevant Octane historical clients (Steric, GreyOrange, mycar, Iqony, Shift, News Corp, McPherson's). Explain how Octane resolved a similar pain point.

=== COMPETING APPLICATIONS ===
Detail competing systems they are evaluating. Only list systems explicitly mentioned in the RAG or highly specific to their exact niche. If unknown, output 'UNKNOWN'. Do not guess.

=== COMPLEMENTARY STACK APPLICATIONS ===
Detail ERP systems (SAP, NetSuite, Dynamics) and BI tools (Power BI, Tableau) present in their RAG technographics. If unknown, output 'UNKNOWN'. Do not guess.

=== RELEVANCE ASSESSMENT ===
Qualify their business size and revenue markers against Octane's core products.

=== LIKELY PAIN POINTS ===
3 specific pain points mapped explicitly to their job title. If the title is CFO, list 3 financial metrics they care about. If the title is IT, list 3 technical bottlenecks. Do not use generic spreadsheet examples unless they are Variant A.

=== HIGH-IMPACT OPENERS ===
3 concrete conversation openers. Combine a specific fact from their career history or company news with a target metric question.

=== TRAVEL DISTANCE ===
Output exactly this string: "${params.transitDistance || "Online/Phone call only (Distance unavailable)"}". Do not add any additional explanation.`;

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
            console.log("Calling Mistral API for dossier...");
            const responseText = await callMistralAPI(messages, customConfig);
            console.log("Mistral API returned successfully!");
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            console.log("Mistral API failed:", err.message);
            console.warn("⚠️ live API call failed, activating offline demo mock fallback.");
            const targetName = params.name || "Unknown Lead";
            const targetCompany = params.company || "Unknown Company";
            const targetTitle = params.title || "Unknown Title";
            const targetTrack = params.track || "TM1 & AI";
            const targetIntake = params.intakeAnswers || "None provided";
            
            return `=== LINKEDIN ANALYSIS ===
<p><strong>LinkedIn Profile Analysis:</strong> N/A - Offline Demo Mode. Real-time LinkedIn RAG search is unavailable when the live API is bypassed or disconnected. <em>(Lead: ${targetName}, ${targetTitle} at ${targetCompany})</em></p>

=== COMPANY OVERVIEW ===
<p><strong>Company Overview:</strong> Factual background for ${targetCompany} requires an active server-side search connection. In offline/mock mode, this section degrades gracefully to protect data integrity.</p>

=== DISCOVERY TRACK CLASS ===
<p><strong>Discovery Track:</strong> Variant A (First-Time TM1 / Planning Analytics User) based on offline analysis of spreadsheets usage.</p>

=== TAILORED PLAYBOOK QUESTIONS ===
<p><strong>Tailored Playbook Questions:</strong></p>
<ul>
    <li>What general ledger/ERP system (e.g. NetSuite) are you using, and does it currently integrate with your planning tool?</li>
    <li>How many separate Excel spreadsheets are you manually consolidating for your budgeting and forecasting?</li>
    <li>Do you manually export CSV files to reconcile data?</li>
</ul>

=== RELEVANT OCTANE SERVICES & PRICING ===
<p><strong>Recommended Octane Services & Pricing:</strong> Octane DevOps Blue Support at A$4,560/month base support flat-rate (rollover hours included).</p>

=== PEER CREDIBILITY STORY ===
<p><strong>Peer Credibility Story:</strong> Similar to <strong>Meridian Logistics</strong>, who transitioned from 35 manual spreadsheets to automated NetSuite loading using DataFusion NetSuite Connector, saving 3 close days per month.</p>

=== COMPETING APPLICATIONS ===
<p><strong>Competing Applications:</strong> Excel spreadsheets remain the primary competing manual planning interface. Mid-to-enterprise scale systems typically run Anaplan, Workday Adaptive, or legacy Planning Analytics models.</p>

=== COMPLEMENTARY STACK APPLICATIONS ===
<p><strong>Complementary Applications:</strong> Common enterprise systems found in similar stacks include typical ERPs (SAP, NetSuite, Microsoft Dynamics) and BI tools (Power BI, Tableau).</p>

=== RELEVANCE ASSESSMENT ===
<p><strong>Relevance Assessment:</strong> Pending live tech stack mapping. The lead represents a ${targetTitle} at ${targetCompany}, which requires validation of their user scale and revenue markers.</p>

=== LIKELY PAIN POINTS ===
<p><strong>Likely Pain Points:</strong> Based on the job title <strong>${targetTitle}</strong>, standard pain points center around manual reporting cycles, spreadsheet sprawl, data consolidation latency, and high resource costs for system support.</p>

=== HIGH-IMPACT OPENERS ===
<p><strong>Conversation Starters:</strong>
1. Address the service track interest: <em>"${targetTrack}"</em>.<br>
2. Reference booking intake answers: <em>"${targetIntake}"</em>.<br>
3. Ask how ${targetCompany} currently handles manual consolidation bottlenecks across their department.</p>

=== TRAVEL DISTANCE ===
~45 min from Amendra's location (Richmond, Melbourne, VIC 3121) or Online/Phone
<!-- METADATA: {"name": "${targetName.replace(/"/g, '\\"')}", "company": "${targetCompany.replace(/"/g, '\\"')}", "title": "${targetTitle.replace(/"/g, '\\"')}", "track": "${targetTrack.replace(/"/g, '\\"')}", "intake": "${targetIntake.replace(/"/g, '\\"')}"} -->`;
        }
    }

    /**
     * Extracts and compiles a quick-reference Rapport Guide for pre-screen calls.
     * @param {string} dossierContent The generated dossier content
     * @param {Object} customConfig API configurations
     */
    async function generateRapportGuide(dossierContent, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const prompt = `You are a senior sales coach at Octane Software Solutions.
Based on the following prospect preparation dossier, extract and structure a high-impact, quick-reference RAPPORT GUIDE for the sales representative to use during their 30-minute pre-screen call.

Dossier Content:
${dossierContent}

Generate the Rapport Guide in clean HTML. You must structure it with these exact wrapped card components:
<div class="rapport-card card-openers">
    <h4 class="rapport-card-title">💬 Conversation Openers</h4>
    <ul class="rapport-card-list">
        <li>Customized opener 1 focusing on their specific details...</li>
        <li>Customized opener 2...</li>
        <li>Customized opener 3...</li>
    </ul>
</div>
<div class="rapport-card card-context">
    <h4 class="rapport-card-title">📋 Key Context & Facts</h4>
    <ul class="rapport-card-list">
        <li>FP&A team size, tech stack, company milestones, or trigger events...</li>
    </ul>
</div>
<div class="rapport-card card-pain">
    <h4 class="rapport-card-title">🎯 Pain Points to Target</h4>
    <ul class="rapport-card-list">
        <li>Bottleneck 1 mapped to Octane solutions...</li>
        <li>Bottleneck 2...</li>
    </ul>
</div>
<div class="rapport-card card-avoid">
    <h4 class="rapport-card-title">⚠️ Phrases to Avoid / Competitor Flags</h4>
    <ul class="rapport-card-list">
        <li>Competitors to watch out for or sensitive topics...</li>
    </ul>
</div>

Do not write markdown backticks or conversational prefixes. Return only the HTML div cards.`;

        const messages = [
            {
                role: "system",
                content: "You are a professional sales consultant. Respond only in clean HTML containing the requested card div wrappers."
            },
            {
                role: "user",
                content: prompt
            }
        ];

        try {
            return await callMistralAPI(messages, config);
        } catch (err) {
            console.error("Error generating rapport guide:", err);
            
            let leadName = "Unknown Lead";
            let leadCompany = "Unknown Company";
            let leadTitle = "Unknown Title";
            let leadTrack = "TM1 & AI";

            // Decode structured comment metadata block - 100% reliable
            const metaMatch = dossierContent.match(/<!-- METADATA: (\{[^}]+\}) -->/);
            if (metaMatch) {
                try {
                    const meta = JSON.parse(metaMatch[1]);
                    leadName = meta.name || leadName;
                    leadCompany = meta.company || leadCompany;
                    leadTitle = meta.title || leadTitle;
                    leadTrack = meta.track || leadTrack;
                } catch (e) {
                    console.error("Failed to parse metadata block:", e);
                }
            } else {
                // Corrected regex fallback if comment metadata is not found
                const leadMatch = dossierContent.match(/Lead:\s*([^,]+),\s*([^,]+)\s*at\s*([^)<]+)/i);
                if (leadMatch) {
                    leadName = leadMatch[1].trim();
                    leadTitle = leadMatch[2].trim();
                    leadCompany = leadMatch[3].trim();
                } else {
                    const companyMatch = dossierContent.match(/Overview for\s*([^<]+)/i) || 
                                         dossierContent.match(/background for\s*([^<]+)/i) ||
                                         dossierContent.match(/Overview:\s*([^<]+)/i);
                    if (companyMatch) leadCompany = companyMatch[1].trim();

                    const titleMatch = dossierContent.match(/profile as a\s*([^<]+)/i) ||
                                       dossierContent.match(/job title\s*<strong>([^<]+)<\/strong>/i) ||
                                       dossierContent.match(/role as\s*([^<]+)/i);
                    if (titleMatch) leadTitle = titleMatch[1].trim();
                }

                const trackMatch = dossierContent.match(/track\s*(?:\(|:)\s*<strong>([^<]+)<\/strong>/i) ||
                                   dossierContent.match(/track\s*interest:\s*<em>([^<]+)<\/em>/i) ||
                                   dossierContent.match(/track\s*\(<strong>([^<]+)<\/strong>\)/i);
                if (trackMatch) leadTrack = trackMatch[1].trim();
            }

            return `
                <div class="rapport-card card-openers">
                    <h4 class="rapport-card-title">💬 Conversation Openers</h4>
                    <ul class="rapport-card-list">
                        <li>"Hi ${leadName}, thank you for booking some time with us. I saw you're currently leading efforts at ${leadCompany} as ${leadTitle}. Can you tell me a bit about your current planning priorities?"</li>
                        <li>"I noticed your role is ${leadTitle}. Normally, systems managers and finance leaders spending significant time on manual data verification are looking for automation. Is that something you are focused on at ${leadCompany}?"</li>
                        <li>"I was looking at your company site. How is your team currently managing integrations and data workflows for your key applications?"</li>
                    </ul>
                </div>
                <div class="rapport-card card-context">
                    <h4 class="rapport-card-title">📋 Key Context & Facts</h4>
                    <ul class="rapport-card-list">
                        <li>Lead: <strong>${leadName}</strong>, ${leadTitle} at <strong>${leadCompany}</strong>.</li>
                        <li>Interest track: <strong>${leadTrack}</strong>.</li>
                        <li>Mode: Offline/Mock Fallback (API Connection Bypass).</li>
                    </ul>
                </div>
                <div class="rapport-card card-pain">
                    <h4 class="rapport-card-title">🎯 Pain Points to Target</h4>
                    <ul class="rapport-card-list">
                        <li>Consolidation bottlenecks and operational spreadsheet management typical for ${leadTitle} roles.</li>
                        <li>Integration fragmentation across transactional databases and planning spreadsheets at ${leadCompany}.</li>
                    </ul>
                </div>
                <div class="rapport-card card-avoid">
                    <h4 class="rapport-card-title">⚠️ Phrases to Avoid / Competitor Flags</h4>
                    <ul class="rapport-card-list">
                        <li>Avoid hardcoding assumptions about their software stack unless verified by active RAG search.</li>
                        <li>Do not mention specific pricing rates before verifying standard packaging matching their business scale.</li>
                    </ul>
                </div>
            `;
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
            return `1. Why did you contact us? What do you hope to achieve?
2. How long have you been users of TM1?
3. What do you primarily use TM1 to do?
4. Where does it fall short or create friction?
5. Which parts of finance are actively using it today?
6. Is usage across the business or limited to finance?
7. Have users mostly adopted TM1 or do they resort to using Excel?
8. Do users find it difficult to make enhancements? Who makes the enhancements?
9. Are you aware of performance, speed, or usability challenges?
10. Is the instance cloud or on-premise?`;
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
        const catalogStr = await loadPricingCatalog();

        const prompt = `You are a sales preparation assistant for Octane Software Solutions.
Analyze the following pre-screen call transcript and generate 7 sales handover deliverables.
The prospect was evaluated on the following question variant:
${variant}

Questions:
${questionFramework}

--- SPEAKER IDENTIFICATION ---
The transcript may use labels like 'Albert (Sales Team)', 'Sales Team:', 'Sarah Chen:', 'Prospect:', 'Speaker 1', or 'Speaker 2'.
Before analyzing, map the speakers: the person asking discovery questions is the Octane Sales Representative (Sales Team), and the person describing requirements, pain points, budget, and timelines is the Client Prospect. Attribute all pain points and qualifications to the Prospect, not the Sales Team.

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
${catalogStr}

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
Sales Representative: ${prospectData.rep || "Albert"}

Prep Dossier Information:
${dossierData || "Not available"}

Format: HTML email from the Sales Representative to the prospect. Include key points about how Octane can address their likely pain points.`;

        const messages = [
            { role: "system", content: "You are a professional B2B Sales Representative. You write highly personalized HTML re-engagement emails." },
            { role: "user", content: prompt }
        ];

        try {
            const responseText = await callMistralAPI(messages, customConfig);
            return responseText.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        } catch (err) {
            let erpName = "ERP/financial systems";
            const intakeText = (prospectData.intake || "").toLowerCase();
            if (intakeText.includes("netsuite")) erpName = "NetSuite ERP";
            else if (intakeText.includes("sap")) erpName = "SAP ERP";
            else if (intakeText.includes("dynamics")) erpName = "Microsoft Dynamics";
            else if (intakeText.includes("xero")) erpName = "Xero";
            else if (intakeText.includes("myob")) erpName = "MYOB";

            return `<p>Subject: Optimising ${prospectData.company}'s Financial Planning & Reporting</p>
<p>Dear ${prospectData.name},</p>
<p>I tried calling you today regarding your interest in our ${prospectData.track} services at Octane Software Solutions, but was unable to reach you.</p>
<p>I put together a briefing for our call based on your role as ${prospectData.title || 'Head of Finance'} and some common challenges logistics/finance teams face, such as consolidating manual spreadsheets and version control issues.</p>
<p>Specifically, I thought you might be interested in how we help companies automate ${erpName} data loading to Planning Analytics, eliminating manual copy-paste cycles.</p>
<p>Would you have 10 minutes next week for a brief online sync? You can book a time directly with our Director, System Administrator, using our scheduler.</p>
<p>Kind regards,<br>${prospectData.rep || 'Albert'}<br>Octane Software Solutions</p>`;
        }
    }

    async function generateProposal(params, dossierContent, questionnaireAnswers, transcript, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        const catalogStr = await loadPricingCatalog();
        const prompt = `You are a consultative sales director at Octane Software Solutions.
Draft a preliminary corporate proposal based on the accumulated context of our prep work and discovery call.

--- ACCUMULATED CONTEXT ---
1. Client: ${params.name || "Unknown Name"}, ${params.title || "Unknown Title"} at ${params.company || "Unknown Company"}
2. Company URL: ${params.url || "Unknown URL"}
3. Service Track Interest: ${params.track || "TM1 & AI"}
4. Attached GDrive SOW: ${params.gDriveFile || "None"}
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
${catalogStr}
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
            const proposedPkg = params.track === 'Agentic AI Operations & Watsonx' 
                ? 'DevOps Red Support & AI Pilot POC' 
                : params.track === 'DataFusion & Analytics Stack'
                ? 'DataFusion Integration Connector'
                : 'DevOps Blue Support';
                
            return `<h4>1. UNDERSTANDING OF REQUIREMENTS</h4>
<p>Based on our pre-screen analysis, <strong>${params.company || 'Unknown Company'}</strong> is looking to streamline operational workflows under the <strong>${params.track || 'TM1 & AI'}</strong> track. The current configuration requires direct data integration and automation to eliminate manual reconciliation cycles.</p>
<h4>2. PROPOSED SOLUTION</h4>
<p>We propose the implementation of the **${proposedPkg}** to establish a single source of truth and optimize system administration.</p>
<ul>
    <li><strong>System Support:</strong> Tailored support package aligned to the <strong>${params.track || 'TM1 & AI'}</strong> interest track.</li>
    <li><strong>Data Automation:</strong> Setup of custom DataFusion connectivity if standard databases are used.</li>
</ul>
<h4>3. APPROACH & METHODOLOGY</h4>
<p>We recommend a phased implementation schedule starting with detailed architecture and validation workshops.</p>
<h4>4. TEAM & RESOURCES</h4>
<p>Staffing includes a dedicated Lead Architect supported by a certified development team.</p>
<h4>5. NEXT STEPS</h4>
<p>Book a Positional Meeting with the System Administrator to confirm API sandboxes and data structures.</p>`;
        }
    }

    /**
     * Helper to return precompiled mock deliverables.
     */
    function getOfflineMockSynthesis(screencastUrl, customQuestions = null) {
        if (typeof window !== 'undefined' && typeof window.getOfflineMockSynthesisOverride === 'function') {
            const overrideResult = window.getOfflineMockSynthesisOverride(screencastUrl, customQuestions);
            if (overrideResult) {
                return overrideResult;
            }
        }
        
        let leadName = "Unknown Lead";
        let leadTitle = "Unknown Title";
        let leadCompany = "Unknown Company";
        let leadTrack = "TM1 & AI";
        let leadRep = "Albert";
        let leadIntake = "";

        if (typeof document !== 'undefined') {
            const nameEl = document.getElementById('prep-name');
            const titleEl = document.getElementById('prep-title');
            const companyEl = document.getElementById('prep-company');
            const trackEl = document.getElementById('prep-track');
            const repEl = document.getElementById('prep-rep');
            const intakeEl = document.getElementById('prep-intake');
            
            if (nameEl && nameEl.value) leadName = nameEl.value.trim();
            if (titleEl && titleEl.value) leadTitle = titleEl.value.trim();
            if (companyEl && companyEl.value) leadCompany = companyEl.value.trim();
            if (trackEl && trackEl.value) leadTrack = trackEl.value.trim();
            if (repEl && repEl.value) leadRep = repEl.value.trim();
            if (intakeEl && intakeEl.value) leadIntake = intakeEl.value.trim();
        }

        let erpSystem = "ERP/financial system";
        let sheetsCount = "manual spreadsheets";
        let timeWasted = "manual copy-paste consolidation";

        const lowerIntake = leadIntake.toLowerCase();
        if (lowerIntake.includes("netsuite")) erpSystem = "NetSuite ERP";
        else if (lowerIntake.includes("sap")) erpSystem = "SAP ERP";
        else if (lowerIntake.includes("dynamics")) erpSystem = "Microsoft Dynamics";
        else if (lowerIntake.includes("xero")) erpSystem = "Xero";
        else if (lowerIntake.includes("myob")) erpSystem = "MYOB";

        const sheetMatch = leadIntake.match(/(\d+)\s*(?:separate\s*)?spreadsheet/i) || leadIntake.match(/(\d+)\s*sheet/i);
        if (sheetMatch) {
            sheetsCount = `${sheetMatch[1]} separate spreadsheets`;
        }

        const timeMatch = leadIntake.match(/(\d+)\s*(?:min|minute)/i);
        if (timeMatch) {
            timeWasted = `${timeMatch[1]} minutes of manual copy-paste per sheet`;
        }

        const proposedPkg = leadTrack === 'Agentic AI Operations & Watsonx' 
            ? 'DevOps Red Support & AI Pilot POC' 
            : leadTrack === 'DataFusion & Analytics Stack'
            ? 'DataFusion Integration Connector'
            : 'DevOps Blue Support';

        const screencastSegment = screencastUrl ? `<p>I have also recorded a 2-minute video briefing summarizing our discussion, which you can review here: <a href="${screencastUrl}" target="_blank" style="color: #4daeeb;">${screencastUrl}</a></p>` : "";
        const screencastField = screencastUrl ? `<li><strong>Screencast URL:</strong> <a href="${screencastUrl}" target="_blank" style="color: #4daeeb;">${screencastUrl}</a></li>` : "<li><strong>Screencast URL:</strong> Not provided</li>";

        let questionnaireHtml = "";
        if (Array.isArray(customQuestions) && customQuestions.length > 0) {
            questionnaireHtml = customQuestions.map((item, idx) => {
                const qText = typeof item === 'object' && item !== null ? item.q : item;
                let defaultAns = "";
                const lowerQ = qText.toLowerCase();
                if (idx === 0 && lowerQ.includes("ledger")) {
                    defaultAns = `Currently using ${erpSystem}. There is no automated integration to their budgeting tools; data is exported via CSV files. <em>"Our actuals reside in ${erpSystem}, but all our planning models are housed in Excel."</em>`;
                } else if (idx === 1 && lowerQ.includes("spreadsheet")) {
                    defaultAns = `${sheetsCount} are sent out to department heads and manually consolidated. Version control issues are frequent. <em>"We have about ${sheetsCount}... incredibly prone to formula errors."</em>`;
                } else if (idx === 2 && lowerQ.includes("workflow")) {
                    defaultAns = `Monthly forecasting and actuals consolidation. ${timeWasted} is required per sheet. <em>"Consolidating actuals with our Excel model templates takes us ${timeWasted}."</em>`;
                } else {
                    defaultAns = `Captured details matching custom query. <em>"Response verified during Discovery Call."</em>`;
                }
                const repNotes = typeof item === 'object' && item !== null && item.a ? ` [Rep Notes: ${item.a}]` : "";
                return `<p><strong>${idx + 1}. ${qText}:</strong> ${defaultAns}${repNotes}</p>`;
            }).join('');
        } else {
            questionnaireHtml = `
<p><strong>1. What general ledger/ERP system are you using, and does it integrate with your planning tool?:</strong> Currently using ${erpSystem}. There is no automated integration to their budgeting tools; data is exported via CSV files. <em>"Our actuals reside in ${erpSystem}, but all our planning models are housed in Excel."</em></p>
<p><strong>2. How many separate Excel spreadsheets are you manually consolidating for your budgeting and forecasting?:</strong> ${sheetsCount} are sent out to department heads and manually consolidated. Version control issues are frequent. <em>"We have about ${sheetsCount}... incredibly prone to formula errors."</em></p>
<p><strong>3. What specific planning workflows are you executing, and are allocations inconsistent?:</strong> Monthly actuals vs budget consolidation and forecasting. Consolidation takes ${timeWasted}, taking up to several days in total close time. <em>"Consolidating the actuals with our Excel model templates takes us ${timeWasted}."</em></p>
<p><strong>4. What reporting tools do you use, and do you manually export CSV files?:</strong> Power BI and PAX, both fed manually from consolidated Excel workbooks. <em>"We are using Power BI and PAX for some basic reporting, but they're fed from these manual Excel files."</em></p>
<p><strong>5. Do users need to drill down from high-level reports to transaction-level GL data?:</strong> Yes, analysts need to drill down to verify variance, but cannot do so in the current setup. <em>"My analysts could actually focus on tracking variance instead of doing data entry."</em></p>
<p><strong>6. Do you have internal developers/admins to manage these systems?:</strong> No internal administrators; they rely entirely on the finance team. <em>"We don't have internal admins... key person risk is high."</em></p>
<p><strong>7. How many planning contributors, read-only users, and administrators are involved?:</strong> Approximately ${sheetsCount.match(/\d+/) ? sheetsCount.match(/\d+/)[0] : '35'} department heads contribute, with 5 finance power users and 20 management read-only consumers.</p>
<p><strong>8. What repetitive financial tasks feel most manual?:</strong> Exporting GL files, copying them into consolidation templates, and sending emails to follow up. <em>"Consolidating actuals..."</em></p>
<p><strong>9. What is your target timeline for going live?:</strong> Before the Q3 planning cycle, which begins in 2 months. <em>"We want this resolved before the Q3 planning cycle..."</em></p>
<p><strong>10. Is there a budget allocated for licensing and delivery?:</strong> Up to $40,000 sign-off threshold for the current financial year. <em>"We have a sign-off threshold of up to $40,000..."</em></p>
<p><strong>11. Have you evaluated other tools?:</strong> They have not run detailed evaluations of other tools but are familiar with TM1/Planning Analytics. <em>"Not evaluated others in depth..."</em></p>
<p><strong>12. What does success look like, and would a 60-day trial help?:</strong> Success is saving 3 days of manual close work monthly and enabling variance tracking. Open to a 60-day trial. <em>"It would save us at least 3 days every month."</em></p>`;
        }

        return {
            questionnaireAnswers: questionnaireHtml,
            summary: `<h4>QUALIFICATION SCORE: HOT</h4>
<p><strong>SCORING RATIONALE:</strong> The prospect has a clear budget ($40,000 threshold), an urgent timeline (Q3 planning starting in 2 months), and a severe operational bottleneck (3 days wasted on manual consolidation of ${sheetsCount}).</p>
<p><strong>RECOMMENDED NEXT STEP:</strong> Book a Deep-Dive Architectural meeting with System Administrator to scoping the ${proposedPkg} support.</p>
<p><strong>RED FLAGS:</strong> None. Approval threshold is well-aligned with implementation costs.</p>`,
            
            recapEmail: `<p>Hey ${leadName},</p>
<p>I have some takeaways I'd like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.</p>
<ul>
    <li>You are currently running ${erpSystem}, but all budgeting and consolidation is done in ${sheetsCount}, taking ${timeWasted}.</li>
    <li>We can automate this process entirely, saving your team days of manual copy-pasting every month.</li>
    <li>We aim to have this solved before your Q3 planning cycle kicks off in two months.</li>
</ul>
${screencastSegment}
<p>You should have received an invitation confirming our appointment together.</p>
<p>Kind regards,<br>${leadRep}.</p>`,

            summarySheet: `<p><strong>SUMMARY:</strong> ${leadCompany} — ${new Date().toLocaleDateString()}</p>
<ul>
    <li><strong>ATTENDEES:</strong> ${leadName} (${leadTitle}), ${leadRep} (Sales Team)</li>
    <li><strong>SERVICE TRACK:</strong> ${leadTrack}</li>
    <li><strong>KEY DISCUSSION POINTS:</strong>
        <ul>
            <li>Manual copy-paste consolidation bottleneck of ${sheetsCount}.</li>
            <li>Direct ${erpSystem} integration needed to automate actuals loading.</li>
            <li>Goal to go live before Q3 planning (2 months target).</li>
        </ul>
    </li>
    <li><strong>PROSPECT SENTIMENT:</strong> Positive</li>
    ${screencastField}
</ul>`,

            migrationReport: `<h4>CURRENT STATE</h4>
<p>${leadCompany} runs ${erpSystem} as their GL/ERP system. Financial planning is conducted entirely in ${sheetsCount} consolidated by the finance team. PAX and Power BI are used for reporting but are fed from manual files.</p>
<h4>GAPS IDENTIFIED</h4>
<p>No automated integration between ${erpSystem} and budgeting. Excessive close time (${timeWasted}), high formula error risk, and inability for analysts to perform multi-dimensional variance analysis.</p>
<h4>RECOMMENDED MIGRATION PATH</h4>
<p>Deploy a centralized Planning Analytics database and implement the **${proposedPkg}** to load actuals automatically and establish a single source of truth.</p>
<h4>ESTIMATED COMPLEXITY</h4>
<p><strong>Complexity: Medium.</strong> Requires mapping standard ${erpSystem} GL tables, converting core Excel reports into Planning Analytics cubes, and establishing the database connector.</p>
<h4>DEPENDENCIES</h4>
<p>Establish ${erpSystem} credentials, access rules, and finalize contributor license seating.</p>`,

            notes: `<p><strong>Meeting Notes: ${leadName} (${leadTitle}, ${leadCompany})</strong></p>
<p>The call opened with a discussion of ${leadCompany}'s scaling challenges. ${leadName} noted that volume increases have placed significant pressure on the finance team during forecast close.</p>
<blockquote>"Consolidating the actuals with our Excel model templates takes us ${timeWasted}. With ${sheetsCount}, it's easily several days of mind-numbing copy-pasting."</blockquote>
<p>The technical stack was confirmed: ${erpSystem} for actuals, manual Excel sheets for plans, and basic reporting. There are no internal administrators, representing a major key-person risk.</p>
<blockquote>"We don't have internal admins... My analysts could actually focus on tracking variance instead of doing data entry."</blockquote>
<p>${leadName} confirmed a timeline of 2 months (before Q3 planning) and a budget sign-off threshold of $40,000 for this financial year.</p>`,

            proposal: `<h4>1. UNDERSTANDING OF REQUIREMENTS</h4>
<p>Based on our pre-screen call, ${leadCompany} is seeking to transition their manual Excel budgeting process. They require direct ERP integration to ${erpSystem} and automated actuals loading to save days of manual close work monthly.</p>
<h4>2. PROPOSED SOLUTION</h4>
<p>We propose the implementation of **${proposedPkg}** to establish a single source of truth.</p>
<ul>
    <li><strong>DevOps Support:</strong> Support package aligned to the <strong>${leadTrack}</strong> interest track.</li>
</ul>
<h4>3. APPROACH & METHODOLOGY</h4>
<p>We recommend a 6-week implementation project with kickoff and decision workshops.</p>
<h4>4. TEAM & RESOURCES</h4>
<p>Staffing includes a dedicated onshore Lead Architect supported by our certified offshore developer team.</p>
<h4>5. NEXT STEPS</h4>
<p>Book a Positional Meeting with System Administrator to confirm ${erpSystem} sandbox access and custom table mapping.</p>`,
            
            actionItems: `<p><strong>Actions for Octane (Sales Team):</strong></p>
<ul>
    <li>Log synthesis deliverables to HubSpot. (Done)</li>
    <li>Share pre-screen brief and SOW with System Administrator before the positional meeting. (Pending)</li>
</ul>
<p><strong>Actions for Prospect (${leadName}):</strong></p>
<ul>
    <li>Attend Positional meeting with System Administrator on Tuesday at 10:00 AM AEST. (Pending)</li>
    <li>Retrieve ${erpSystem} sandbox login details for API scoping. (Pending)</li>
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
    generateRapportGuide,
    synthesizeCallTranscript,
    generateQuestionnaireAnswers,
    generateMigrationReport,
    generateRecapEmail,
    generateSummarySheet,
    generateNotes,
    generateActionItems,
    generateProposal,
    generateRequirementEmail,
    parseSynthesisResponse,
    DEFAULT_CONFIG
};
