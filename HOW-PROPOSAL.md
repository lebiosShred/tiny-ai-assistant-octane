# HOW: Early Game Sales Pipeline -- Implementation Proposal

> **Prepared by:** CJ Amiel (Octane Software Solutions)
> **For:** Anthony Coundouris + Sheila Ocana
> **Date:** May 2025 (Updated May 2026)
> **Scope:** Build 5 components of the Early Game Sales Pipeline

---

## Confirmed Tool Stack

| Tool | Purpose | Status |
|---|---|---|
| **HubSpot Professional** | CRM, calendar booking, tickets, pipeline, call directory, coaching playlists | ✅ Owned |
| **3CX** | Cold call dialling, call recording, call downloads | ✅ Owned |
| **Microsoft Teams** | Video meetings, screen sharing, scheduling | ✅ Owned |
| **Microsoft Outlook** | Email, calendar sync with HubSpot | ✅ Owned |
| **Microsoft OneDrive** | Client file storage | ✅ Owned |
| **Claude** | AI research, report generation, SOW drafting | ✅ Covered |
| **Fathom (Free)** | Auto-join Teams meetings, transcription, HubSpot sync | $0/mo |
| **Zapier / Make.com** | Workflow automation (Fathom → Claude API → HubSpot) | ~$30/mo |

**Total new monthly cost: ~$30**

> **Bot-Free Fallback:** If prospects push back on the Fathom bot joining calls, deploy **Jamie AI** (🇩🇪 Germany). It runs locally on the rep's device, is invisible to participants, supports 100+ languages, and is GDPR-compliant with Frankfurt data hosting.

---

## Component 01: Pre-Screen Calendar

### What We're Building
A single booking system with timezone-aware shift-based routing, embedded on a branded context page with QR code support.

> [!NOTE]
> **Operational vs. Technical Routing:** Calendar bookings route dynamically based on availability, as Albert and Isha cover standard shift hours. To combine both representatives' availability under a single scheduling link, HubSpot's shared calendar configuration is utilized.

### HOW -- Step by Step

**1.1 HubSpot Meeting Links (Shift-Based Combined Calendar)**

| Setting | Value |
|---|---|
| Meeting type | Round-Robin (Required by HubSpot to combine calendars) |
| Duration | 30 minutes |
| Reps in rotation | Albert & Isha |
| Capacity | 28 x 30-minute slots per day across 14-hour window |
| Geographic coverage | Single link for Australia, New Zealand, Middle East |
| Scheduling buffer | 12 hours minimum lead time |
| Same-day bookings | Disabled |
| Meeting modes | Phone or Online (Teams/Zoom) |

- Navigate to HubSpot > Sales > Meetings > Create Meeting Link
- Select "Round Robin" as the scheduling type (to combine multiple rep calendars under one link)
- Add Albert and Isha as team members
- Set each rep's availability window in their HubSpot profile calendar settings (Albert and Isha: standard shift hours)
- Under "Scheduling" tab: set "Minimum notice time" to 12 hours
- Under "Scheduling" tab: disable same-day availability

**1.2 Form Fields (Collected at Booking)**

| Field | Type | Required |
|---|---|---|
| Full Name | Text | Yes |
| Company Email | Email | Yes |
| Company Name | Text | Yes |
| Position / Title | Text | Yes |
| Service Interest | Dropdown: "Planning & Analytics" / "AI" | Yes |
| Company URL | URL | Yes |
| What would you like to discuss? | Textarea | Yes |

- Configure these as custom properties in HubSpot > Settings > Properties
- Map them to the meeting booking form under the meeting link settings

**1.3 Direct Calendar Links (Amendra + Steny)**

- Create two separate HubSpot meeting links (not round-robin, individual)
- These are used for outbound/email campaigns only -- not published on the website
- Each link is embedded in the rep's email signature and outbound templates

**1.4 Context Page (Not Standalone Calendar)**

Anthony's requirement: The calendar must be embedded within a page that gives context, not presented as a bare HubSpot widget. Reference model: salesstar.com/steve-hughson-meeting.

Build approach:
- Create a dedicated landing page on the Octane website (or HubSpot landing page)
- Page structure:
  1. Header: "Book a Discovery Call with Octane"
  2. What to expect section (2-3 bullet points explaining the 30-min pre-screen format)
  3. Who you'll speak with (photos + bios of Albert and Isha)
  4. Embedded HubSpot meeting widget (iframe or JS embed)
  5. Footer: "Questions? Email us at [contact]"
- The page URL becomes the single public booking link

**1.5 QR Code**

- Generate a QR code pointing to the context page URL
- Tool: Any QR generator (QR Code Generator, or HubSpot's built-in QR feature)
- Output: PNG/SVG at print resolution for business cards, brochures, event collateral

**1.6 CRM Automation on Booking**

When a booking is confirmed, HubSpot automatically:
1. Creates a Contact record (if new)
2. Creates a Ticket in the "Early Game" pipeline
3. Sends an alert to the assigned rep
4. Blocks the rep's calendar

Configure via HubSpot Workflows:
- Trigger: "Meeting booked" event
- Actions: Create ticket > Set ticket owner to meeting host > Send internal notification email

**1.6.1 HubSpot Deal Board Stages**

The "Early Game" sales pipeline Ticket progresses through 7 mandatory stages on the HubSpot Deal Board:

| Stage # | Stage Name | Description |
|---|---|---|
| 1 | **Lead Captured** | Initial prospect details logged in CRM |
| 2 | **MQL** | Marketing Qualified Lead status verified |
| 3 | **Prescreen Booked** | Pre-screen call scheduled via round-robin or direct link |
| 4 | **Prescreen Completed** | Pre-screen call done, transcript and 6 reports attached |
| 5 | **Discovery Booked** | Positional Meeting scheduled with Steny, Kevin, or Amendra |
| 6 | **Discovery Completed** | Positional Meeting done, technical constraints documented |
| 7 | **Positioning Meeting** | Formal solution and proposal presented to the prospect |

**1.7 The "Event Skip Path" (Batch Processing)**

For bulk leads gathered at events (e.g., Forefront), manual pre-screening is inefficient.
- **Upload:** Export event leads to CSV and import into HubSpot.
- **Batch Score:** Run a bulk HubSpot workflow that triggers a Claude API script to score leads (1-10) based on
    firmographics (Title, Company Size, Industry).
- **Skip Path:** Leads scoring 8+ bypass the Sales Team Pre-Screen and are routed directly to the "Warm Outreach"
    cadence. Leads < 8 are routed to generic nurture sequences. Isha and Albert only manually process the 8+ leads.

---

## Component 02: Pre-Screen Preparation

### What We're Building
An AI Sales Assistant named **Tiny** (code-named after Sheila's dog because "she's very small and cute but delivers big value"). Tiny operates as a Claude-powered research assistant that automatically digests client data to produce a structured 10-point pre-screening briefing.

In Phase 1, Tiny is configured as a Claude Project. The sales representatives (Albert and Isha) manually feed prospect information into Tiny before every pre-screening call to gain a critical intelligence advantage.

### HOW -- Step by Step

**2.1 Claude Project Setup**

- Create a Claude Project named **"Tiny - Pre-Screen Prep"**
- Upload the following as permanent Project Knowledge:
  - Octane service catalog (TM1 Support, AI/Agentic, Data Integration)
  - Competitor profiles (key competitors in TM1/Planning Analytics space)
  - Case studies and client examples
  - Product sheets and pricing frameworks
  - The training data spreadsheet referenced in the brief

**2.1b Platform Selection & Trade-offs (Claude vs. watsonx Orchestrate)**

During the design phase, the team deliberated on the underlying platform for the Tiny AI Assistant:
- **watsonx Orchestrate:** As Octane's primary AI offering, watsonx Orchestrate has zero incremental licensing
    costs for the business. However, it requires significant build time and technical integration before the sales
    team can use it.
- **Claude Projects (Selected for Phase 1):** Claude Projects provide an immediate, out-of-the-box UI for the
    Sales Team to run manual-first prep prompts. It provides the fastest go-to-market speed with no initial
    development overhead.
- **Token Costs & Limits:** Amendra noted that high prep volume means Claude will frequently require manual
    token/credit top-ups, which introduces minor operational friction.
- **Future State (Phase 2):** If Claude's API token costs become a burden, the team will evaluate switching the
    backend to watsonx Orchestrate or leveraging Open Router API endpoints to manage token budgets.

**2.2 OneDrive Connection**

Anthony's brief states: "This assistant has a permanent connection to OneDrive Client folders where it can read and understand every job that has ever been specified."

Current Claude limitations: Claude Projects cannot natively connect to OneDrive. Two approaches:

| Approach | Effort | Reliability |
|---|---|---|
| **Manual upload (Phase 1):** Rep downloads relevant files from OneDrive and uploads to the Claude conversation | Low | High -- works today |
| **MCP Integration (Phase 2):** Configure Claude's MCP (Model Context Protocol) with a OneDrive connector so Claude can browse folders directly | Medium | Medium -- depends on Claude's MCP rollout |

* Recommendation:** Start with manual upload. The rep already has access to OneDrive. Adding 30 seconds of file
    download doesn't break the workflow. Automate later when MCP stabilizes.

**2.3 Prep Prompt Template**

The rep pastes this into the Claude Project conversation along with the 6 inputs:

```
You are a sales preparation assistant for Octane Software Solutions.

I'm about to have a 30-minute pre-screen call with a prospect. Using the
information below and your knowledge of Octane's services, produce a
10-POINT BRIEFING.

--- INPUTS ---
1. Client: [Name], [Position] at [Company]
2. Booking form answers: [paste form data]
3. LinkedIn profile: [attach PDF]
4. Company URL: [URL]
5. Service track: [TM1 / AI]
6. Company Email: [paste company email]

--- PRODUCE THESE 10 POINTS ---
1. LinkedIn profile analysis -- role history, tenure, seniority, network signals
2. Recent social media activity -- posts, articles, comments (if visible)
3. Company overview -- products, services, revenue signals, industry
4. Octane services relevant to this prospect
5. Key competitors this prospect may be evaluating
6. Competing applications they may already use
7. Complementary applications in their stack
8. TM1 or AI applications relevant to their industry/role
9. Likely pain points -- based on role, company size, and service interest
10. Conversation starters -- 3 specific openers that demonstrate relevance
    from the first sentence (do NOT use generic discovery questions)

Format: Numbered list. Each point should be 2-4 sentences. Be specific.
Use the prospect's actual company and role context, not generic advice.
```

**2.4 Output Format**

The rep receives a structured document they can review in 3-5 minutes before the call. Example output structure:

```
PRE-SCREEN BRIEFING: Jane Doe -- Acme Corp
═══════════════════════════════════════════════════

1. LINKEDIN ANALYSIS
   Head of FP&A for 3 years. Previously Senior Financial Analyst at...

2. RECENT ACTIVITY
   Posted about "planning tool frustrations" on LinkedIn 2 weeks ago...

[...etc through all 10 points]
```

**2.5 Workflow (Rep's Perspective)**

1. Rep receives HubSpot alert that a booking is confirmed
2. Rep opens the prospect's HubSpot contact record → copies form answers
3. Rep downloads the prospect's LinkedIn PDF (LinkedIn > More > Save to PDF)
4. Rep opens Claude Project **"Tiny - Pre-Screen Prep"**
5. Rep pastes the prompt template, fills in the 6 inputs, attaches LinkedIn PDF
6. Tiny generates the 10-point briefing (~60 seconds)
7. Rep reviews briefing before the call

Total rep time: 5-8 minutes.

---

## Component 03: Pre-Screen Call

### What We're Building
A structured 30-minute discovery call framework with automatic transcription and post-call AI synthesis.

### HOW -- Step by Step

**3.1 Recording Setup (Three Channels)**

The team uses three recording tools depending on the call type and security/GDPR requirements:

| Call Type | Tool | Recording | Transcription | HubSpot Sync |
|---|---|---|---|---|
| **Cold calls (outbound/inbound)** | 3CX | ✅ Auto | ✅ Built-in | ✅ Auto-logs calls + recording links |
| **Scheduled video meetings** | Fathom Free | ✅ Auto-joins Teams | ✅ Unlimited | ✅ Basic contact sync |
| **Sensitive/GDPR meetings** | Jamie AI | ✅ Local (no bot) | ✅ Germany hosting | ❌ Manual upload (or API) |

**3CX Setup (Already Configured):**
- 3CX is already in use for cold call dialling
- Calls are recorded automatically, downloadable as WAV files
- 3CX → HubSpot integration auto-logs calls with recording links to the contact timeline
- Verify: HubSpot integration template has `SupportsTranscription="true"` enabled for transcript sync
- Verify: Phone numbers in HubSpot use E.164 format for reliable contact matching

**Fathom Free Setup (New):**
- Create Fathom accounts for Albert, Isha, Amendra, Kevin, Steny
- Connect each account to Microsoft Teams
- Configure auto-join: Fathom bot automatically joins all scheduled Teams meetings
- Connect Fathom → HubSpot integration (basic sync: logs recording + transcript to contact)
- Anthony does NOT need a Fathom account (he reviews calls via HubSpot's Call Index)

**Jamie AI Setup (GDPR Fallback):**
- Deploy Jamie AI local application on Sales Representatives' desktop devices
- Configure for invisible, bot-free background recording on sensitive calls
- Process transcripts locally with data hosted in Frankfurt, Germany
- Rep manually uploads output to HubSpot ticket timeline

**3.2 The 12-Question Framework**

Three variants based on prospect type. The rep reads these conversationally -- they do NOT type answers during the call. 3CX or Fathom captures everything.

**Variant A: First-Time TM1 User (Finalized & Aligned)**

<!-- DOC-SYNC-START: Variant A -->
| # | Question |
|---|---|
| 1 | **Context:** Why did you contact us? What do you hope to achieve? |
| 2 | **Context:** Why do you think you need TM1? |
| 3 | **Context:** Is this for a single department or across the company? |
| 4 | **Context:** What will you primarily use TM1 for? |
| 5 | **Context:** What application would you like TM1 to replace? |
| 6 | **Context:** How are you currently managing budgeting and forecasting? |
| 7 | **Context:** How many people are involved in the planning process? |
| 8 | **Context:** How long does your budgeting or forecasting cycle typically take? |
| 9 | **Context:** What is the most frustrating part of your current process? |
| 10 | **Context:** How confident are you in the numbers you are producing? |
| 11 | **Project:** What does success look like for this project? |
| 12 | **Project:** Do you have a target completion date? |
| 13 | **Project:** Does your firm have a policy on cloud or on-premise? |
| 14 | **Project:** What is the minimum you need TM1 to do? |
| 15 | **Project:** What are the nice-to-have functions that can be added later? |
| 16 | **Project:** Who will support TM1 after handover -- IT or finance? |
| 17 | **Project:** Who are the project stakeholders? First names and titles will do. |
| 18 | **Planning:** What are the busiest times of year we should plan around? |
| 19 | **Planning:** Can you share a requirements document? |
| 20 | **Planning:** What budget range do you have in mind? |
| 21 | **Planning:** How many data sources need to integrate with TM1 eg ERP, ledgers, databases? Are they cloud or on-premise, and will any new ones need to be added? |
| 22 | **Planning:** Are data reconciliation and load processes manual or automated? |
| 23 | **Licenses:** How many TM1 licenses will you need? |
| 24 | **Licenses:** How many will be admin licenses? |
| 25 | **Licenses:** Do you expect to need more licenses over time? |
| 26 | **Licenses:** Do you have casual users who only log in once a year? |
| 27 | **Reports:** Do you use any reporting tools against TM1 data eg Power BI? |
| 28 | **Reports:** How many reports need to be built? |
| 29 | **Reports:** Will you report using cube views, PAX or PAW? |
| 30 | **Reports:** Do you need static reports or dynamic dashboards? If you have a dashboard, please paste a screenshot below. |
| 31 | **Excel:** What are the manual data reconciliation processes? |
| 32 | **Excel:** Are data load and mapping processes manual or automated? |
| 33 | **Excel:** What are the most complicated Excel computations? Please describe the logic and paste screenshots below. |
| 34 | **Excel:** How much of what you need from TM1 is already being done in Excel today? |
| 35 | **Excel:** Do users contribute data directly? If yes, please paste screenshots of the input templates below. |
| 36 | **Anaplan:** Which business processes are covered eg budgeting, forecasting, workforce planning, sales planning? |
| 37 | **Anaplan:** How many models do you have and how many users interact with them? |
| 38 | **Anaplan:** How is data loaded into Anaplan -- manually, via CloudWorks, Anaplan Connect, or API? |
| 39 | **Anaplan:** What source systems feed data into Anaplan eg ERP, CRM, HR? |
| 40 | **Anaplan:** How do users interact with the model -- via dashboards, NUX pages, or Excel? |
| 41 | **Anaplan:** Do users contribute data directly, or is the model read-only for most? |
| 42 | **Jedox:** Which business processes are covered eg budgeting, forecasting, consolidation, reporting? |
| 43 | **Jedox:** Is Jedox deployed on-premise or cloud? |
| 44 | **Jedox:** How is data loaded into Jedox -- via ETL integrator, scripts, or manually? |
| 45 | **Jedox:** What source systems feed data into Jedox eg SAP, ERP, databases? |
| 46 | **Jedox:** Do users interact via Excel reports, Jedox Web, or both? |
| 47 | **Jedox:** Do users contribute data directly via input templates? |
<!-- DOC-SYNC-END: Variant A -->

**Variant B: Existing TM1 User (Finalized & Aligned)**

<!-- DOC-SYNC-START: Variant B -->
| # | Question |
|---|---|
| 1 | **Context:** Why did you contact us? What do you hope to achieve? |
| 2 | **Context:** How long have you been users of TM1? |
| 3 | **Context:** What do you primarily use TM1 to do? |
| 4 | **Context:** Where does it fall short or create friction? |
| 5 | **Context:** Which parts of finance are actively using it today? |
| 6 | **Context:** Is usage across the business or limited to finance? |
| 7 | **Context:** Have users mostly adopted TM1 or do they resort to using Excel? |
| 8 | **Context:** Do users find it difficult to make enhancements? Who makes the enhancements? |
| 9 | **Context:** Are you aware of performance, speed, or usability challenges? |
| 10 | **Context:** Is the instance cloud or on-premise? |
<!-- DOC-SYNC-END: Variant B -->

**Variant C: First-Time AI User (Decommissioned)**

AI Solutions interest leads bypass the pre-screen discovery call track completely and are automatically routed directly to Steny's calendar. No Variant C battlecard script is utilized on the pre-screen dashboard.




**3.3 Post-Call: Transcript → Questionnaire Mapping**

After the call ends:

**If the call was on Teams (Fathom):**
1. Fathom processes the recording automatically (~2-5 minutes)
2. Rep opens the call in Fathom → copies the full transcript
3. Rep opens Claude and pastes the transcript with the mapping prompt below

**If the call was via 3CX (cold call):**
1. Rep opens the call in HubSpot contact timeline (transcript auto-synced from 3CX)
2. Alternatively: Rep downloads the WAV from 3CX Admin → uploads to Fathom for transcription
3. Rep copies transcript → pastes into Claude

**Mapping Prompt:**

```
Below is a transcript from a 30-minute pre-screen call. The prospect is a
[First-time TM1 / Existing TM1 / First-time AI] user.

Map the prospect's answers to each of the 12 questions below. If a question
was not explicitly addressed, note "Not discussed" and flag it for follow-up.

After mapping all 12 answers, provide:
- QUALIFICATION SCORE: Hot / Warm / Cold
- SCORING RATIONALE: 2-3 sentences explaining the score
- RECOMMENDED NEXT STEP: What should happen next

Scoring criteria:
- HOT: Has budget, has timeline, has authority, has clear pain point
- WARM: Has 2-3 of the above, missing 1-2
- COLD: Exploratory only, no budget/timeline/authority confirmed

[Paste 12 questions for the relevant variant here]

--- TRANSCRIPT ---
[Paste transcript]
```

**3.4 Booking the Positional Meeting**

Before ending the call, the rep books the prospect directly with Amendra:
- Option 1: Rep shares Amendra's direct calendar link in Teams chat
- Option 2: Rep three-way checks Amendra's availability and books live
- Option 3: Rep sends Amendra's booking link via email immediately after call

The booking confirmation auto-creates a second ticket in HubSpot linked to the same contact.

**3.5 The 2-Minute Screencast (Sales Team Handover)**

Before the ticket is moved to "Ready for Positional Meeting", the representative must record a mandatory 2-minute video debrief using a tool like Loom or Fathom's built-in recorder.
- **0-30s:** Introduce the prospect and company.
- **30-90s:** Explain the primary pain point and why they need TM1/AI.
- **90-120s:** The representative's "gut feel" on the deal (hot/cold, red flags).
- **Action:** Paste the video link into the HubSpot ticket alongside the Claude Mega-Prompt output.

---

## Component 04: Central Call Directory

### What We're Building
A single place where Anthony and the team can access every recorded call chronologically, with coaching tools built in.

### HOW -- Step by Step

**4.1 HubSpot as the Central Directory (Already Owned)**

HubSpot Professional includes a native call management system that serves as the central directory. No additional tool needed.

**HubSpot CRM → Calls Index** provides:
- Chronological listing of all calls across the org
- Filter by: call owner (rep), date range, call outcome, duration
- Full transcript view + audio playback
- Transcript search across all recorded calls
- Coaching playlists (curate call clips for training)
- Call clips (highlight key moments, share with team)
- Talk-time analytics (basic conversation intelligence)

Setup:
- Navigate to HubSpot > Settings > Calling > Call Setup
- Enable call recording and transcription (requires Super Admin)
- Navigate to HubSpot > Settings > Calling > Call Types
- Customize the Call Types list to include: **Prospect Call**, **Audit Call**, **Pulse Check**, and **Internal Meeting**
- Ensure all reps (Albert, Isha, Amendra, Kevin, Steny) have Sales Hub seats and classify their calls accordingly
- Anthony gets HubSpot access with read permissions to all calls

**4.2 How Calls Flow Into HubSpot**

Both recording channels feed into HubSpot automatically:

| Source | How It Gets to HubSpot | What Lands |
|---|---|---|
| **3CX cold calls** | 3CX → HubSpot integration (auto-log) | Recording link, transcript, call metadata |
| **Teams meetings** | Fathom Free → HubSpot sync | Recording link, transcript, contact association |

This gives two access paths:
1. **Anthony's coaching view:** HubSpot CRM → Calls (chronological, filterable by rep, with playlist/clip tools)
2. **Rep's deal view:** HubSpot ticket timeline (all calls, emails, and notes for one prospect in one place)

**4.3 Coaching Workflow (Anthony)**

Anthony's coaching process using HubSpot's built-in tools:

1. Navigate to CRM → Calls
2. Filter by rep (e.g., show only Albert's calls this week)
3. Listen to recordings inline, read transcripts
4. Clip key moments (good or bad) using the clip tool
5. Add clips to coaching playlists (e.g., "Objection Handling Best Practices", "New Hire Training")
6. Share playlists with reps for self-review

**4.4 Report Extraction from Directory**

For the 6 structured report types (Component 05), the rep copies the transcript from either:
- **Fathom** (for Teams meetings) -- open the call, copy transcript
- **HubSpot contact timeline** (for 3CX calls) -- open the call activity, copy transcript

The transcript is then pasted into Claude for structured report generation.

---

## Component 05: Sales Reports (Manual-First)

### What We're Building
6 structured report types generated from call transcripts using **Tiny (the AI Sales Assistant)** via dedicated prompt templates.

### HOW -- Step by Step

**5.1 The "Manual-First" Workflow (Phase 1)**

To build muscle memory and ensure that the sales staff (Albert and Isha) fully master the qualifying criteria, the early-game pipeline runs on a manual-first workflow. Reps are expected to copy and paste call transcripts between Fathom (or Jamie AI) and Tiny. 

**The Manual Step-by-Step Flow:**
1. **Retrieve Transcript:** Once a call ends, the rep opens the call transcript from **Fathom** (for video meetings) or the **HubSpot contact timeline** (for 3CX audio recordings).
2. **Access Tiny:** The rep opens Claude and accesses the dedicated **"Tiny - Sales Reports" Project**.
3. **Execute Prompts:** The rep pastes the call transcript and runs the prompts for the required reports (Recap Email, Summary Sheet, Detailed Notes, Proposal Draft, Questionnaire Mapping, and Action Items).
4. **Verify & Learn:** The rep reviews Tiny's output. This review step is crucial: it forces the rep to digest the prospect's responses and internalize the qualifying parameters before handoff.
5. **Log in CRM:** The rep copies the verified reports and pastes them into the **HubSpot Ticket** as a consolidated Note.
6. **Sales Representative Reality:** Isha finishes the call, runs the copy-paste flow with Tiny, and updates HubSpot within 5 minutes, completing the deal handover.

**5.1c Zapier/Make.com Automation Upgrade (Phase 2)**

Once the manual process is operating reliably and the reps fully understand the pipeline mechanics, we can remove the administrative friction by activating background automation:
1. **Trigger:** Fathom automatically syncs the completed meeting transcript to the HubSpot Contact Record.
2. **Action:** A webhook triggers Zapier/Make.com, which pulls the transcript and sends it to the Claude API.
3. **Cognitive Synthesis:** Claude runs a consolidated "Mega-Prompt" to generate all reports in a single execution.
4. **Action:** Zapier/Make.com writes the consolidated output directly back into the HubSpot Ticket as a Note, eliminating manual copy-pasting.

**5.2 Claude Project Setup**

To facilitate the Phase 1 manual workflow, reps use a Claude Project named **"Tiny - Sales Reports"** with the following uploaded knowledge:
- Octane service catalog
- SOW templates
- Pricing frameworks
- Brand voice guidelines

**5.3 The 6 Report Prompt Templates**

**Report 1: Questionnaire Mapping**
(Already defined in Component 03, Section 3.3 above)

**Report 2: Recap Email**
[⏲ < 2 hours]
```text
Generate a concise client-facing email summarising the 3 most important points from this call to replace the '. xx.' placeholders in the template below.

--- TEMPLATE ---
[Subject] observations from 🧐 our session
[copy]
Hey {{client’s name}},
I have some takeaways I’d like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.
. xx. 
. xx.
. xx.
You should have received an invitation confirming our appointment together.
Kind regards,
Anthony.

--- TRANSCRIPT ---
[Paste transcript]
```

**Report 3: Summary Sheet**
```
Generate a brief, structured internal summary of this call. Format:

SUMMARY: [Company] -- [Date]
ATTENDEES: [Names]
SERVICE TRACK: [TM1 / AI]
KEY DISCUSSION POINTS: (3-5 bullet points)
PROSPECT SENTIMENT: (Positive / Neutral / Cautious)
NEXT STEPS: (What was agreed)
RED FLAGS: (Any concerns or objections raised)

--- TRANSCRIPT ---
[Paste transcript]
```

**Report 4: Detailed Notes**
```
Generate detailed meeting notes from this transcript. Capture context,
nuance, and any points that don't fit into a structured format. Organize
chronologically by topic discussed. Include direct quotes where the
prospect reveals key priorities or concerns.

--- TRANSCRIPT ---
[Paste transcript]
```

**Report 5: Proposal Draft**
```
Using the call transcript and the collected answers to the 12 questions, draft a preliminary, tailored proposal. Use the following structured outline and guidelines:

1. UNDERSTANDING OF REQUIREMENTS
- Summarize the client's current background, systems, pain points, and goals.
- Explicitly detail GL systems, Excel complexity, or existing TM1 setup metrics depending on the track.

2. PROPOSED SOLUTION
- Pitch the corresponding Octane service package(s) based on the collected variables:
  - First-Time TM1: Pitch TM1 Projects (Phase 1, 2, or 3) and/or Data Integration (if using Power BI/Qlik/Tableau).
  - Existing TM1: Pitch Octane Blue / Red DevOps Support (starting with 40-hour DevOps Blue, transitioning to Red,
      highlighting no distinction between support and dev, rollover hours, rotation of consultants), TM1 Upgrade
      Services (if legacy/unlicensed version), or a TM1 Flight Check (if experiencing RAM/HDD/log file/performance
      red flags).
  - First-Time AI: Pitch watsonx Orchestrate & watsonx.ai (integrating TM1, Adobe, Google, GCP) starting with a
      2-6 week co-creation Proof of Concept (POC) based on the standard POC template.
- Highlight standard inclusions and exclusions for the proposed packages:
  - TM1 Projects: Include 5 standard report conversions, 1 instance per environment (Dev/Test/Prod), training
      platforms. Exclude DB service account creation, local PA cloud exports.
  - Octane Blue: Include 24/7 SLA-based ticketing (Urgent <1hr, High 4hr, Medium 8hr, Low 24hr), rollover hours,
      monthly health checks, free training library.
  - TM1 Flight Check: Include 6-day analysis, user interviews, RAM/HDD assessment.
  - Data Integration: Include 60-day free trial, setup + email support, low-code interface.
  - watsonx Orchestrate POC: Include co-creation, working demo, client resources.

3. APPROACH & METHODOLOGY
- Detail standard project phases and timelines (e.g., 6-week TM1 Upgrade, 2-6 week POC, 6-week Phase 1 TM1 project).
- Outline the critical path milestones (e.g., resource plan approval, handover checklist, kickoff).

4. TEAM & RESOURCES
- Explain Octane's staffing model (onshore/offshore hybrid, dedicated lead and shared support resources, team lead
    oversight, certified developer requirements).

5. NEXT STEPS & DISCOVERY OPEN ITEMS
- Identify any missing technical variables from the 12 questions (e.g., RAM usage not confirmed, GL system not
    specified) as "Discovery Open Items" for the upcoming Positional Meeting.
- Outline the kickoff steps (e.g., booking the decision workshop or setup call).

Do NOT include custom pricing amounts. Only state standard list-price frameworks (e.g., Octane Blue support is A$4,560/month, Training is A$1,850/day).
Tone: consultative, professional, and specific to the prospect's inputs.

--- TRANSCRIPT(S) ---
[Paste transcript(s)]
```

**Report 6: Action Items**
```
Identify all action items, follow-up tasks, and commitments made during this call.
For each item, specify:
1. The action required (specific and descriptive).
2. The owner (prospect, rep, or specific partner if named).
3. The context or deadline mentioned (if any).

Format as a clean bulleted list grouped by Owner.

--- TRANSCRIPT ---
[Paste transcript]
```

---

## Delivery Timeline

| Phase | Components | Duration | Deliverable |
|---|---|---|---|
| Week 1 | 01 (Calendar) | 3-4 days | HubSpot meeting links configured, context page live, QR code generated |
| Week 2 | 02 (Prep) + 05 (Reports) | 4-5 days | Both Claude Projects created with all prompts tested and documented |
| Week 3 | 03 (Call Framework) + 04 (Directory) | 4-5 days | 12-question frameworks set up as draft, Fathom Free accounts created, 3CX → HubSpot integration verified, HubSpot Calls Index configured for coaching |
| Week 4 | Testing + Training | 3-4 days | End-to-end dry run with Albert or Isha, SOP handoff to Sheila |

---

## What This Proposal Does NOT Cover

These items are outside the 5-component scope but are architected in the Early Game Sales Pipeline HTML:

- **Component 06:** Middle Game Triage (Once the positional meeting closes out, leads are triaged: **Kevin**
    handles TM1 / Planning Analytics demos, **Steny** handles Artificial Intelligence tracks).
- **Component 07:** Commercial SOW generation via Claude
- **Component 08:** Deal pipeline tracking and close process
- **Phase 2:** Agentic automation via Make.com + Claude API + Fathom webhooks + enrichment APIs

These can be scoped separately once Components 01-05 are operational.

---

## Upgrade Path (Prioritised by Impact)

### ✅ Tier 1: Implement Now ($0 additional)

| Priority | Tool | Cost | What It Adds |
|---|---|---|---|
| **P2** | Keep **Fathom Free** | $0/mo | Already optimal for current team size |
| **P3** | Keep **Zapier** | ~$30/mo | Already configured, low complexity |

### ⏳ Tier 2: When Volume Grows ($49-99/mo additional)

| Priority | Tool | Cost | Trigger | What It Adds |
|---|---|---|---|---|
| **P4** | **Apollo.io Basic** | $49/user/mo | Representatives spend > 30 min/day on prep | Automates Component 02 entirely (lead enrichment → Claude → HubSpot briefing). 275M+ contacts, native HubSpot sync. |
| **P5** | **Fathom Paid** | ~$15-20/user/mo | Zapier task limits become a bottleneck | Native HubSpot field-level sync without Zapier middleman |
| **P6** | **n8n (self-hosted)** 🇩🇪 | ~$10/mo (VPS) | Running 50+ automations/month | Eliminates Zapier per-task costs. Open-source, German-built, unlimited executions, full JS/Python code nodes for custom AI workflows. |

### 🔮 Tier 3: Future Phase (Enterprise Scale)

| Priority | Tool | Cost | Trigger | What It Adds |
|---|---|---|---|---|
| **P7** | **PandaDoc** | $19/user/mo | Proposal volume > 10/month | Branded proposals + e-signatures from Claude-generated content. Auto-fills from HubSpot deal fields. |
| **P8** | **Retorio** 🇩🇪 | Quote-based | Hiring 3+ new representatives | AI avatar role-play for sales onboarding. Behavioral analysis (tone, body language). EU AI Act + GDPR compliant. |
| **P9** | **Jamie AI** 🇩🇪 | Paid tier | Prospects push back on Fathom bot | Bot-free, invisible meeting recording. Runs locally on device. 100+ languages. GDPR-first, Frankfurt hosting. |

### Non-English Tools of Note

| Tool | Country | Relevance |
|---|---|---|
| **Modjo** | 🇫🇷 France | European Gong alternative. GDPR-native, 100+ languages, ~€99/user. Worth evaluating if coaching analytics become a priority. |
| **Claap** | 🇫🇷 France | Combines meeting AI + async video + coaching clips. Deep HubSpot integration. 99+ languages. |
| **Notta** | 🇯🇵 Japan | Best Japanese transcription. Bilingual meeting support. In-person hardware (Notta Memo). Relevant if Octane expands into Japanese market. |
| **Sansan** | 🇯🇵 Japan | Business card CRM with Claude MCP connector. APAC-focused. Event lead processing. |
| **Pabbly Connect** | 🇮🇳 India | Zapier alternative with lifetime deal pricing (~$249 one-time). No per-task limits. Budget fallback for P6. |
| **Salesken** | 🇮🇳 India | Real-time in-call coaching. Battle cards and objection prompts appear live during the call. |

### Cost Projection

| Configuration | Monthly Cost | Coverage |
|---|---|---|
| **Current (P1-P3)** | ~$30-35/mo | Fathom Free + Zapier + Claude API |
| **+ Apollo (P4)** | ~$80-85/mo | Fully automated prep + recording + reports |
| **+ n8n swap (P6)** | ~$60-65/mo | Drops Zapier, unlimited automations |
| **Full stack (P1-P7)** | ~$100-130/mo | Fully automated pipeline with proposals + e-sign |
