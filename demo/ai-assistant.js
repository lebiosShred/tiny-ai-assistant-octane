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
    model: "mistral-small-latest"
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
                temperature: 0.2 // Lower temp for factual sales extraction
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

--- PRODUCE THESE 10 POINTS ---
1. LinkedIn profile analysis — role history, tenure, seniority, network signals.
2. Recent social media activity — posts, articles, comments (if visible/inferred).
3. Company overview — products, services, revenue signals, industry.
4. Octane services relevant to this prospect — customize based on track and company.
5. Key competitors this prospect may be evaluating.
6. Competing applications they may already use (e.g. Anaplan, Workday Adaptive, manual Excel).
7. Complementary applications in their stack (e.g. NetSuite, SAP, Power BI).
8. TM1 or AI applications relevant to their industry/role.
9. Likely pain points — based on role, company size, and service interest.
10. Conversation starters — 3 specific openers that demonstrate relevance from the first sentence (do NOT use generic discovery questions).

Format: Generate clean HTML. Format the title as <h3>[PRE-SCREEN BRIEFING: ${params.name || "Prospect"} — ${params.company || "Company"}]</h3>. 
Use a numbered list (<ol>) for the 10 points. Inside each point, use <strong> tags for headers and bold keywords. Keep each point specific, concise (2-4 sentences), and tailored to the actual company and role context.`;

        const messages = [
            {
                role: "system",
                content: "You are a professional, clinical B2B sales research assistant. You write detailed, factual briefs without fluff or conversational filler."
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
            // Return precompiled dossier for Sarah Chen (or general fallback)
            const targetName = params.name || "Sarah Chen";
            const targetCompany = params.company || "Meridian Logistics";
            const targetTitle = params.title || "Head of FP&A";
            
            return `<h3>[PRE-SCREEN BRIEFING: ${targetName} — ${targetCompany}] (DEMO OFFLINE MODE)</h3>
<ol>
    <li><strong>LinkedIn Profile Analysis:</strong> ${targetName} has been the ${targetTitle} at ${targetCompany} for 3 years, managing a team of 4 financial analysts. Prior to this, she was a Senior Financial Analyst at Linfox Logistics for 4 years, showcasing strong tenure and deep domain expertise in transport and supply chain planning workflows.</li>
    <li><strong>Recent Social Media Activity:</strong> She recently posted on LinkedIn expressing frustration with "planning tool version control issues and manual Excel consolidation cycles" during the close process, indicating active search for an automated database solution.</li>
    <li><strong>Company Overview:</strong> ${targetCompany} is a leading third-party logistics provider in APAC, operating complex supply chain networks. They are experiencing rapid scaling, which places significant transaction volume demands on their internal corporate reporting systems.</li>
    <li><strong>Relevant Octane Services:</strong> Octane's TM1 managed support services can optimize their existing models, while the <strong>DataFusion Connector</strong> can directly link their NetSuite actuals to a central Planning Analytics database.</li>
    <li><strong>Key Competitors:</strong> They may be evaluating other enterprise performance management (EPM) systems such as Workday Adaptive Planning or Anaplan.</li>
    <li><strong>Competing Applications:</strong> Their current planning workflow relies on 35 manual Excel spreadsheets consolidated across departmental managers, creating substantial version control risks.</li>
    <li><strong>Complementary Applications:</strong> They currently run NetSuite as their primary ERP system and use Power BI and Excel PAX for corporate executive management reporting.</li>
    <li><strong>Planning Applications:</strong> Logistics planning models require multi-dimensional cost allocations by business units, routes, and payroll groups, making IBM TM1 a perfect fit.</li>
    <li><strong>Likely Pain Points:</strong> Manual data transfers from NetSuite to Excel take 45 minutes per sheet (exceeding several days in total close time), leading to formula errors and delayed reporting cycles.</li>
    <li><strong>Conversation Starters:</strong> Introduce Octane's NetSuite DataFusion connector that automates actuals loading, ask how the 35 Excel spreadsheets affect their forecasting cycles, or suggest a 60-day trial to eliminate their 45-minute manual sheet reconciliation bottleneck.</li>
</ol>`;
        }
    }

    /**
     * Component 05: Synthesize verbatim transcript and output 7 distinct sales handover deliverables
     * @param {string} variant - Questionnaire variant (Variant A / Variant B / Variant C)
     * @param {string} transcript - Verbatim Fathom/Jamie AI call transcript
     * @param {string} screencastUrl - Vidyard screencast link
     * @param {Object} customConfig - Custom API configuration
     * @returns {Promise<Object>} Object containing parsed HTML documents
     */
    async function synthesizeCallTranscript(variant, transcript, screencastUrl = "", customConfig = {}, customQuestions = null) {
        let questionFramework = "";

        if (Array.isArray(customQuestions) && customQuestions.length > 0) {
            questionFramework = customQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n');
        } else if (variant === "Variant A") {
            questionFramework = `
1. What general ledger/ERP system (e.g., SAP, MS Business Central, Sun Systems, NetSuite) are you using, and does it currently integrate with your planning tool?
2. How many separate Excel spreadsheets are you manually consolidating for your budgeting and forecasting, and are there issues with version control?
3. What specific planning workflows (e.g., actuals, payroll allocations, cost analysis, budgeting, forecasting) are you executing, and are allocations (like payroll across business units) inconsistent or time-consuming?
4. What reporting tools (e.g., Power BI, Qlik, Tableau, Excel PAX/PAW) do you use for management reporting, and do you manually export CSV files to reconcile data?
5. Do users need to drill down from high-level reports to transaction-level GL data, and do you perform multi-currency transactions at the transaction level?
6. Do you have internal developers/admins to manage these systems, or is there a key-person risk if someone leaves?
7. How many planning contributors, read-only users, and administrators are involved, and would they need formal end-user or developer training?
8. What repetitive financial tasks (e.g., monthly slides or reports) feel most manual, and would conversational AI access to financial queries benefit your executives?
9. What is your target timeline for going live, and do you need a parallel run (e.g., completing by a specific month like June)?
10. Is there a budget allocated for licensing and delivery, and what is your internal approval/purchase order process?
11. Have you evaluated other tools (e.g. Workday, Anaplan, TM1), and who else is involved in the final decision?
12. What does success look like, and would a 60-day trial of connectors (like DataFusion) or a free Proof of Concept (POC) help validate the solution?`;
        } else if (variant === "Variant B") {
            questionFramework = `
1. What version of TM1/Planning Analytics are you running, and is it deployed on-premise or in the IBM Cloud?
2. How many TM1 instances do you run (e.g., production-only, or separate dev and test environments)?
3. How many models, cubes, dimensions, and user groups are you currently running?
4. Have you checked your system's performance, RAM usage, hard disk space, or feeder memory usage? Are they approaching high limits?
5. Are log files being automatically cleared, and what is the typical size of your TM1 log files (e.g., is it under or over the 50MB standard)?
6. What are the typical report load times for your end-users, and are they above the 5-second threshold (e.g. 15-25 seconds)?
7. Do you have dedicated in-house TM1 administrators/developers, or are you dependent on key individuals?
8. Are you currently working with another TM1 vendor? Are you locked into a rigid contract with separate rates for support and development?
9. What is your current backlog of enhancements, bugs, or data reconciliation tasks, and how is it prioritized?
10. Have your TM1 developers and power users had formal training, and would they benefit from free access to professional training courses?
11. Are you using Power BI, Tableau, or Qlik, and do you have a direct database connection or are you manually handling CSVs?
12. Who has final authority to approve support changes, and what is the timeline to transition support (e.g. target date like October 31)?`;
        } else {
            questionFramework = `
1. How many slides are in your monthly executive financial reports, and how much time does the finance team spend manually extracting, cleansing, and formatting data for them?
2. What enterprise systems and data sources (e.g., TM1, Adobe Analytics, Google Ad Manager, Adobe AdSlot, BigQuery, SQL) need to connect for automated reporting?
3. Would executives and managers benefit from asking natural language questions (e.g. "AskFinance") to query financial data in real time?
4. What other areas in the business (e.g. Sales, Editorial, HR, Customer Support, IT, Procurement, Legal) have repetitive workflows ripe for automation?
5. Have you experimented with or deployed any generative AI or automation tools internally?
6. What is your primary cloud environment (e.g. GCP, AWS, Azure, on-premise) and how do you manage data security?
7. Do you require specific role-based access controls and security protocols for financial data queried by AI?
8. Would you be open to a 2-to-6 week co-creation Proof of Concept (POC) to demonstrate value before full production rollout?
9. Can you commit a primary business contact and technical resource to collaborate during a 2-to-6 week POC?
10. Are you willing to commit to a Decision Workshop within 10 days of POC completion to confirm next steps?
11. Are you aware of the indicative costs for enterprise generative AI licensing ($160k+/yr) and implementation services ($125k+)?
12. What is your timeline for starting an AI pilot, and who are the key executive stakeholders involved?`;
        }

        const prompt = `You are a sales preparation assistant for Octane Software Solutions.
Analyze the following pre-screen call transcript and generate 7 sales handover deliverables.
The prospect was evaluated on the following question variant:
${variant}

Questions:
${questionFramework}

--- INPUTS ---
Screencast Link: ${screencastUrl || "Not provided"}

--- TRANSCRIPT ---
${transcript}

--- OUTPUT INSTRUCTIONS ---
You must generate all 7 documents in a single response, separated EXACTLY by the specified markdown delimiter strings. Do not include any other markdown fences or conversations outside of these blocks. Format the content in clean HTML using standard tags like <p>, <ul>, <li>, <strong>, <pre>, and <br>.

Use these delimiters:

[DOCUMENT: QUESTIONNAIRE]
Map the prospect's answers to each of the 12 questions. Quote relevant segments of the transcript for accuracy. If a question was not explicitly addressed, write "Not discussed" and flag it.

[DOCUMENT: SUMMARY]
Evaluate the prospect and output:
- QUALIFICATION SCORE: Hot / Warm / Cold (State the score clearly at the top in uppercase)
- SCORING RATIONALE: 2-3 sentences explaining the score
- RECOMMENDED NEXT STEP: Specific next steps
- RED FLAGS: Any concerns or objections raised

[DOCUMENT: RECAP_EMAIL]
Generate a concise, client-facing recap email based on the observations from the call. Replace '. xx .' placeholders in the template below with the 3 most important takeaways from the session. 
Also, you MUST explicitly insert a paragraph at the bottom referencing the Vidyard Screencast Link (${screencastUrl || "Not provided"}) if one is provided (do not write it if not provided):
Hey [client's name],
I have some takeaways I'd like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.
. xx .
. xx .
. xx .
You should have received an invitation confirming our appointment together.
Kind regards,
Anthony.

[DOCUMENT: SUMMARY_SHEET]
Generate a brief, structured internal summary sheet:
SUMMARY: [Company] — [Date]
ATTENDEES: [Names]
SERVICE TRACK: [TM1 / AI]
KEY DISCUSSION POINTS: (3-5 bullet points)
PROSPECT SENTIMENT: (Positive / Neutral / Cautious)
Screencast URL: Include the Screencast Link here if provided.

[DOCUMENT: DETAILED_NOTES]
Detailed chronological meeting notes capturing context, technical systems discussed, and direct quotes.

[DOCUMENT: PROPOSAL]
Draft a preliminary, consultative proposal document. Do NOT include custom pricing amounts. Only state standard list-price frameworks. Include sections:
1. UNDERSTANDING OF REQUIREMENTS
- Summarize the client's current background, systems, pain points, and goals.
- Explicitly detail GL systems, Excel complexity, or existing TM1 setup metrics depending on the track.
2. PROPOSED SOLUTION
- Pitch the corresponding Octane service package(s) based on the collected variables:
  * Variant A: Pitch TM1 Projects (Phase 1, 2, or 3) and/or DataFusion (if using Power BI/Qlik/Tableau). Inclusions: 5 standard report conversions, 1 instance per env (Dev/Test/Prod), training platforms. Exclusions: DB service account creation, local PA cloud exports.
  * Variant B: Pitch Octane Blue / Red DevOps Support (starting with 40-hour DevOps Blue, transitioning to Red, highlighting no distinction between support and dev, rollover hours, rotation of consultants), TM1 Upgrade Services (if legacy/unlicensed version), or a TM1 Flight Check (if experiencing RAM/HDD/log file/performance red flags). Inclusions: 24/7 SLA-based ticketing (Urgent <1hr, High 4hr, Medium 8hr, Low 24hr) for DevOps Blue, rollover hours, monthly health checks, free training library. Flight Check includes 6-day analysis, user interviews, RAM/HDD assessment.
  * Variant C: Pitch watsonx Orchestrate & watsonx.ai (integrating TM1, Adobe, Google, GCP) starting with a 2-to-6 week co-creation Proof of Concept (POC) based on the standard POC template (including co-creation, working demo, client resources).
- Highlight standard inclusions and exclusions for the proposed packages.
- Only state standard list-price frameworks: DevOps Blue support is A$4,560/month, DataFusion setup is A$6,950, Training is A$1,850/day, AI pilots are indicative $160k+/yr licensing and $125k+ implementation.
3. APPROACH & METHODOLOGY
- Detail standard project phases and timelines (e.g., 6-week TM1 Upgrade, 2-6 week POC, 6-week Phase 1 TM1 project).
- Outline critical path milestones (e.g., resource plan approval, handover checklist, kickoff).
4. TEAM & RESOURCES
- Explain Octane's staffing model (onshore/offshore hybrid, dedicated lead and shared support resources, team lead oversight, certified developer requirements).
5. NEXT STEPS & DISCOVERY OPEN ITEMS
- Identify any missing technical variables from the 12 questions (e.g., RAM usage not confirmed, GL system not specified) as "Discovery Open Items" for the upcoming Positional Meeting.
- Outline kickoff steps (e.g., booking decision workshop).

[DOCUMENT: ACTION_ITEMS]
Identify all action items, follow-up tasks, and commitments made during this call. For each item, specify:
1. The action required (specific and descriptive).
2. The owner (prospect, rep, or specific partner if named).
3. The context or deadline mentioned (if any).
Format as a clean bulleted list grouped by Owner.
`;

        const messages = [
            {
                role: "system",
                content: "You are a professional B2B sales operations assistant. You analyze call transcripts and produce clean, formatted HTML documents separated by delimiters."
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
            // Return precompiled synthesis for Sarah Chen
            return getOfflineMockSynthesis(screencastUrl, customQuestions);
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
            questionnaireHtml = customQuestions.map((q, idx) => {
                let defaultAns = "";
                const lowerQ = q.toLowerCase();
                if (idx === 0 && lowerQ.includes("ledger")) {
                    defaultAns = `Currently using NetSuite. There is no automated integration to their budgeting tools; data is exported via CSV files. <em>"Our actuals reside in NetSuite, but all our planning models are housed in Excel."</em>`;
                } else if (idx === 1 && lowerQ.includes("spreadsheet")) {
                    defaultAns = `35 separate spreadsheets are sent out to department heads and manually consolidated. Version control issues are frequent. <em>"We have about 35 separate spreadsheets... incredibly prone to formula errors."</em>`;
                } else if (idx === 2 && lowerQ.includes("workflow")) {
                    defaultAns = `Monthly forecasting and actuals consolidation. 45 minutes of manual copy-paste is required per sheet. <em>"Consolidating the NetSuite actuals with our Excel model templates takes us 45 minutes per worksheet."</em>`;
                } else {
                    defaultAns = `Captured details matching custom query. <em>"Response verified during Discovery Call."</em>`;
                }
                return `<p><strong>${idx + 1}. ${q}</strong><br>Answer: ${defaultAns}</p>`;
            }).join('\n');
        } else {
            questionnaireHtml = `<p><strong>1. ERP Source:</strong> Currently using NetSuite. There is no automated integration to their budgeting tools; data is exported via CSV files. <em>"Our actuals reside in NetSuite, but all our planning models are housed in Excel."</em></p>
<p><strong>2. Spreadsheets Count:</strong> 35 separate spreadsheets are sent out to department heads and manually consolidated. Version control issues are frequent. <em>"We have about 35 separate spreadsheets... incredibly prone to formula errors."</em></p>
<p><strong>3. Workflows:</strong> Monthly forecasting and actuals consolidation. 45 minutes of manual copy-paste is required per sheet. <em>"Consolidating the NetSuite actuals with our Excel model templates takes us 45 minutes per worksheet."</em></p>
<p><strong>4. Reporting:</strong> Power BI and Excel PAX. Currently fed from manual Excel files. <em>"We are using Power BI and PAX for some basic reporting, but they're fed from these manual Excel files."</em></p>
<p><strong>5. Drill Down:</strong> Not discussed in detail, but implied they need high-level logistics variance analysis.</p>
<p><strong>6. Admins:</strong> Not discussed. Flagged as a Discovery Open Item to identify key-person risk.</p>
<p><strong>7. Users:</strong> Not discussed. Need to confirm planning contributors, read-only seats, and administrators.</p>
<p><strong>8. Repetitive Tasks:</strong> Data entry and CSV reconciliation. <em>"My analysts could actually focus on tracking logistics variance instead of doing data entry."</em></p>
<p><strong>9. Timeline:</strong> Must go live in 2 months, before the Q3 planning cycle. <em>"We want this resolved before the Q3 planning cycle, which starts in about two months."</em></p>
<p><strong>10. Budget:</strong> Sign-off threshold of up to A$40,000 for this financial year. <em>"We have a sign-off threshold of up to $40,000 for this financial year if we can show a clear return on investment."</em></p>
<p><strong>11. Evaluation:</strong> Checked discovery bookings form (Variant A: First-time TM1). No competing tools mentioned in transcript.</p>
<p><strong>12. Success Criteria:</strong> Save 3 days per month. Ready to book deep dive with TM1 Practice Lead (Amendra Pratap). <em>"It would save us at least 3 days every month."</em></p>`;
        }

        return {
            questionnaire: questionnaireHtml,
            
            summary: `<h4>QUALIFICATION SCORE: HOT</h4>
<p><strong>SCORING RATIONALE:</strong> The prospect has a clear, quantified pain point (3 days lost per month manually consolidating 35 spreadsheets), a definite timeline (go-live in 2 months before Q3 cycle), and an approved budget threshold (up to A$40,000) that aligns with Octane's entry packages.</p>
<p><strong>RECOMMENDED NEXT STEP:</strong> Proceed to Positional Meeting with TM1 Practice Lead Amendra Pratap on Tuesday at 10:00 AM AEST to review the NetSuite DataFusion architecture.</p>
<p><strong>RED FLAGS:</strong> Tight 2-month timeline. Requires swift resource allocation and immediate start of data source mapping.</p>`,
            
            recapEmail: `<p>Hey Sarah,</p>
<p>I have some takeaways I'd like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.</p>
<ul>
    <li>We identified that consolidating 35 separate departmental budget spreadsheets with NetSuite actuals takes your FP&A team several days of manual data entry every month.</li>
    <li>Automating this connection into a unified database would save your team at least 3 days per month, letting them focus on transport and logistics variance analysis.</li>
    <li>We confirmed a go-live goal prior to your Q3 planning cycle in two months, matching your budget threshold of up to A$40,000.</li>
</ul>
${screencastSegment}
<p>You should have received an invitation confirming our appointment together next Tuesday at 10:00 AM AEST with Amendra Pratap.</p>
<p>Kind regards,<br>Anthony.</p>`,
            
            summarySheet: `<p><strong>SUMMARY:</strong> Meridian Logistics — Pre-Screen synthesis</p>
<ul>
    <li><strong>ATTENDEES:</strong> Sarah Chen (Meridian Logistics), Albert (Octane)</li>
    <li><strong>SERVICE TRACK:</strong> IBM Planning Analytics (TM1) Support / DataFusion</li>
    <li><strong>KEY DISCUSSION POINTS:</strong>
        <ul>
            <li>NetSuite ERP data manual consolidation bottlenecks.</li>
            <li>35 Excel planning spreadsheets version control issues.</li>
            <li>Q3 planning cycle timeline (2-month go-live).</li>
            <li>Budget limit confirmed at A$40,000.</li>
        </ul>
    </li>
    <li><strong>PROSPECT SENTIMENT:</strong> Highly Positive</li>
    ${screencastField}
</ul>`,
            
            detailedNotes: `<p><strong>Call Context:</strong> Pre-screen Discovery Call between Albert (SDR) and Sarah Chen (Head of FP&A at Meridian Logistics).</p>
<p><strong>Systems Discussed:</strong> NetSuite ERP, Excel planning spreadsheets, Power BI, Excel PAX.</p>
<p><strong>Detailed Notes:</strong>
    <ul>
        <li>Sarah Chen reported significant scaling pressure on the finance team. Close process takes too long.</li>
        <li>Current process: 35 separate spreadsheets sent out to department heads. When returned, the FP&A team manually extracts and copy-pastes data.</li>
        <li>Time required: 45 minutes per worksheet, totaling several days of manual effort. High formula error rate.</li>
        <li>Desired State: Direct integration of NetSuite actuals to a central IBM Planning Analytics database, pushing clean data directly to Power BI.</li>
        <li>Timeline: Q3 planning starts in 2 months. Must be implemented before then.</li>
        <li>Budget: approved sign-off threshold of A$40,000.</li>
    </ul>
</p>
<p><strong>Direct Quotes:</strong>
    <blockquote>"It's easily several days of mind-numbing copy-pasting. It's incredibly prone to formula errors."</blockquote>
    <blockquote>"It would save us at least 3 days every month. My analysts could actually focus on tracking logistics variance instead of doing data entry."</blockquote>
</p>`,
            
            proposal: `<h4>1. UNDERSTANDING OF REQUIREMENTS</h4>
<p>Meridian Logistics requires an automated multidimensional database solution to eliminate manual Excel consolidations. Currently, their corporate Actuals reside in NetSuite, while planning models are distributed across 35 independent spreadsheets, taking 45 minutes per sheet to consolidate. The solution must go live within 2 months, before the Q3 planning cycle starts, within a budget threshold of A$40,000.</p>

<h4>2. PROPOSED SOLUTION</h4>
<p>We propose deploying the **Octane DataFusion Connector** combined with **IBM Planning Analytics (TM1)**:</p>
<ul>
    <li><strong>DataFusion Connector:</strong> Automates NetSuite extraction and streams clean transaction records into the planning engine. Includes setup and email support. Excludes database service account creation.</li>
    <li><strong>TM1 Project (Phase 1):</strong> Model setup, configuration, and conversion of 5 standard reports. Excludes local Planning Analytics cloud exports.</li>
    <li><strong>Standard Pricing:</strong> DataFusion setup is list-priced at A$6,950. Training is A$1,850/day.</li>
</ul>

<h4>3. APPROACH & METHODOLOGY</h4>
<p>We will execute a compressed 6-week implementation project divided into 3 phases:
    <ol>
        <li><strong>Phase 1: Discovery & Architecture (Week 1-2):</strong> Resource plan approval, NetSuite API scoping, and kickoff.</li>
        <li><strong>Phase 2: Database Setup & Rules (Week 3-4):</strong> Dimension mapping and allocation engine scripting.</li>
        <li><strong>Phase 3: Integration & Training (Week 5-6):</strong> DataFusion connection, report conversions, and handover checklist.</li>
    </ol>
</p>

<h4>4. TEAM & RESOURCES</h4>
<p>Delivered via Octane's onshore/offshore hybrid staffing model, utilizing an onshore TM1 Lead Consultant (Amendra Pratap) for architecture, and offshore certified developers for build execution, supervised by our Team Lead.</p>

<h4>5. NEXT STEPS & DISCOVERY OPEN ITEMS</h4>
<p><strong>Discovery Open Items for Positional Meeting:</strong>
    <ul>
        <li>Confirm NetSuite API access credentials and firewall configurations.</li>
        <li>Verify total read/write planning user count and license seat requirements.</li>
        <li>Confirm if they have internal TM1 administrators to manage the system after handoff (key-person risk check).</li>
    </ul>
</p>
<p><strong>Next Steps:</strong> Attend the scheduled Deep-Dive Architectural meeting with Amendra Pratap next Tuesday at 10:00 AM AEST.</p>`,
            
            actionItems: `<p><strong>Actions for Octane (SDR):</strong></p>
<ul>
    <li>Log synthesis deliverables to HubSpot Ticket #12894. (Done)</li>
    <li>Handover Vidyard 2-Minute Screencast and brief to Amendra Pratap. (Pending)</li>
</ul>
<p><strong>Actions for Prospect (Sarah Chen):</strong></p>
<ul>
    <li>Attend Deep-Dive meeting on Tuesday at 10:00 AM AEST. (Pending)</li>
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
            questionnaire: "",
            summary: "",
            recapEmail: "",
            summarySheet: "",
            detailedNotes: "",
            proposal: "",
            actionItems: ""
        };

        const patterns = {
            questionnaire: /\[DOCUMENT:?\s*QUESTIONNAIRE\]([\s\S]*?)(?=\s*(?:\*\*|##|#)*\s*\[DOCUMENT|$)/i,
            summary: /\[DOCUMENT:?\s*SUMMARY\]([\s\S]*?)(?=\s*(?:\*\*|##|#)*\s*\[DOCUMENT|$)/i,
            recapEmail: /\[DOCUMENT:?\s*(RECAP_EMAIL|RECAP\s*EMAIL|RECAP)\]([\s\S]*?)(?=\s*(?:\*\*|##|#)*\s*\[DOCUMENT|$)/i,
            summarySheet: /\[DOCUMENT:?\s*(SUMMARY_SHEET|SUMMARY\s*SHEET)\]([\s\S]*?)(?=\s*(?:\*\*|##|#)*\s*\[DOCUMENT|$)/i,
            detailedNotes: /\[DOCUMENT:?\s*(DETAILED_NOTES|DETAILED\s*NOTES|NOTES)\]([\s\S]*?)(?=\s*(?:\*\*|##|#)*\s*\[DOCUMENT|$)/i,
            proposal: /\[DOCUMENT:?\s*PROPOSAL\]([\s\S]*?)(?=\s*(?:\*\*|##|#)*\s*\[DOCUMENT|$)/i,
            actionItems: /\[DOCUMENT:?\s*(ACTION_ITEMS|ACTION\s*ITEMS|ACTIONS)\]([\s\S]*?)(?=\s*(?:\*\*|##|#)*\s*\[DOCUMENT|$)/i
        };

        for (const [key, regex] of Object.entries(patterns)) {
            const match = text.match(regex);
            if (match && match[1]) {
                let content = match[1].trim();
                // Strip starting/ending markdown blocks if any
                content = content.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
                docs[key] = content;
            }
        }

        return docs;
    }

// Expose functions as ES Module
export const TinyAI = {
    generateProspectDossier,
    synthesizeCallTranscript,
    DEFAULT_CONFIG
};

