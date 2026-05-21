# HOW: Tiny Sales Pipeline -- Implementation Proposal

> **Prepared by:** CJ Amiel (Octane Software Solutions)
> **For:** Anthony Coundouris + Sheila Ocana
> **Date:** May 2025 (Updated May 2026)
> **Scope:** Build 5 components of the Tiny Sales Pipeline

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
| **Vidyard (Free)** | 2-Minute Screencast recording, HubSpot auto-logging, viewer analytics | $0/mo |
| **Zapier / Make.com** | Workflow automation (Fathom → Claude API → HubSpot) | ~$30/mo |

**Total new monthly cost: ~$30**

> **Bot-Free Fallback:** If prospects push back on the Fathom bot joining calls, deploy **Jamie AI** (🇩🇪 Germany). It runs locally on the rep's device, is invisible to participants, supports 100+ languages, and is GDPR-compliant with Frankfurt data hosting.

---

## Component 01: Pre-Screen Calendar

### What We're Building
A single booking system with timezone-aware shift-based routing, embedded on a branded context page with QR code support.

> [!NOTE]
> **Operational vs. Technical Routing:** Operationally, this is not a true randomized or load-balanced round-robin. Because Albert and Isha work non-overlapping shifts (Albert: 7 AM – 2 PM AEST; Isha: 2 PM – 9 PM AEST), calendar bookings route deterministically based on the selected time slot. However, to aggregate both reps' calendars into a single booking link, we must select the **Round Robin** meeting page type in HubSpot.

### HOW -- Step by Step

**1.1 HubSpot Meeting Links (Shift-Based Combined Calendar)**

| Setting | Value |
|---|---|
| Meeting type | Round-Robin (Required by HubSpot to combine calendars) |
| Duration | 30 minutes |
| Reps in rotation | Albert (7am–2pm AEST), Isha (2pm–9pm AEST) |
| Scheduling buffer | 12 hours minimum lead time |
| Same-day bookings | Disabled |
| Meeting modes | Phone or Online (Teams/Zoom) |

- Navigate to HubSpot > Sales > Meetings > Create Meeting Link
- Select "Round Robin" as the scheduling type (to combine multiple rep calendars under one link)
- Add Albert and Isha as team members
- Set each rep's availability window in their HubSpot profile calendar settings (Albert: 7am–2pm AEST, Isha: 2pm–9pm AEST)
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

**1.3 Direct Calendar Links (Amendra + Kevin)**

- Create two separate HubSpot meeting links (not round-robin, individual)
- These are used for outbound/email campaigns only — not published on the website
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
2. Creates a Ticket in the "Tiny" pipeline
3. Sends an alert to the assigned rep
4. Blocks the rep's calendar

Configure via HubSpot Workflows:
- Trigger: "Meeting booked" event
- Actions: Create ticket > Set ticket owner to meeting host > Send internal notification email

**1.7 The "Event Skip Path" (Batch Processing)**

For bulk leads gathered at events (e.g., Forefront), manual pre-screening is inefficient.
- **Upload:** Export event leads to CSV and import into HubSpot.
- **Batch Score:** Run a bulk HubSpot workflow that triggers a Claude API script to score leads (1-10) based on firmographics (Title, Company Size, Industry).
- **Skip Path:** Leads scoring 8+ bypass the SDR Pre-Screen and are routed directly to the "Warm Outreach" cadence. Leads < 8 are routed to generic nurture sequences. Isha and Albert only manually process the 8+ leads.

---

## Component 02: Pre-Screen Preparation

### What We're Building
A Claude-powered research assistant that produces a 10-point briefing for every prospect before the pre-screen call.

### HOW — Step by Step

**2.1 Claude Project Setup**

- Create a Claude Project named "Octane Pre-Screen Prep"
- Upload the following as permanent Project Knowledge:
  - Octane service catalog (TM1 Support, AI/Agentic, DataFusion)
  - Competitor profiles (key competitors in TM1/Planning Analytics space)
  - Case studies and client examples
  - Product sheets and pricing frameworks
  - The training data spreadsheet referenced in the brief

**2.2 OneDrive Connection**

Anthony's brief states: "This assistant has a permanent connection to OneDrive Client folders where it can read and understand every job that has ever been specified."

Current Claude limitations: Claude Projects cannot natively connect to OneDrive. Two approaches:

| Approach | Effort | Reliability |
|---|---|---|
| **Manual upload (Phase 1):** Rep downloads relevant files from OneDrive and uploads to the Claude conversation | Low | High — works today |
| **MCP Integration (Phase 2):** Configure Claude's MCP (Model Context Protocol) with a OneDrive connector so Claude can browse folders directly | Medium | Medium — depends on Claude's MCP rollout |

**Recommendation:** Start with manual upload. The rep already has access to OneDrive. Adding 30 seconds of file download doesn't break the workflow. Automate later when MCP stabilizes.

**2.3 Prep Prompt Template**

The rep pastes this into the Claude Project conversation along with the 5 inputs:

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

--- PRODUCE THESE 10 POINTS ---
1. LinkedIn profile analysis — role history, tenure, seniority, network signals
2. Recent social media activity — posts, articles, comments (if visible)
3. Company overview — products, services, revenue signals, industry
4. Octane services relevant to this prospect
5. Key competitors this prospect may be evaluating
6. Competing applications they may already use
7. Complementary applications in their stack
8. TM1 or AI applications relevant to their industry/role
9. Likely pain points — based on role, company size, and service interest
10. Conversation starters — 3 specific openers that demonstrate relevance
    from the first sentence (do NOT use generic discovery questions)

Format: Numbered list. Each point should be 2-4 sentences. Be specific.
Use the prospect's actual company and role context, not generic advice.
```

**2.4 Output Format**

The rep receives a structured document they can review in 3-5 minutes before the call. Example output structure:

```
PRE-SCREEN BRIEFING: Sarah Chen — Meridian Logistics
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
4. Rep opens Claude Project "Octane Pre-Screen Prep"
5. Rep pastes the prompt template, fills in the 6 inputs, attaches LinkedIn PDF
6. Claude generates the 10-point briefing (~60 seconds)
7. Rep reviews briefing before the call

Total rep time: 5-8 minutes.

---

## Component 03: Pre-Screen Call

### What We're Building
A structured 30-minute discovery call framework with automatic transcription and post-call AI synthesis.

### HOW — Step by Step

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
- Deploy Jamie AI local application on SDRs' desktop devices
- Configure for invisible, bot-free background recording on sensitive calls
- Process transcripts locally with data hosted in Frankfurt, Germany
- Rep manually uploads output to HubSpot ticket timeline

**3.2 The 12-Question Framework**

> [!WARNING]
> The 12-question framework is currently in **DRAFT** status, pending finalization by the team. The current questions are placeholder drafts.

Three variants based on prospect type. The rep reads these conversationally -- they do NOT type answers during the call. 3CX or Fathom captures everything.

**Variant A: First-Time TM1 User (DRAFT)**

| # | Question |
|---|---|
| 1 | What planning or budgeting tools are you currently using? |
| 2 | How many people are involved in your planning process? |
| 3 | What's the most painful part of your current planning cycle? |
| 4 | How long does your monthly close or forecast cycle take? |
| 5 | Are your models in Excel, and if so, how complex are they? |
| 6 | What triggered you to look at TM1 / Planning Analytics now? |
| 7 | Have you evaluated other planning tools? Which ones? |
| 8 | Who else is involved in this decision? |
| 9 | What does success look like if this project works? |
| 10 | What's your timeline for making a decision? |
| 11 | Is there a budget allocated for this initiative? |
| 12 | What would need to be true for you to move forward with us? |

**Variant B: Existing TM1 User (DRAFT)**

| # | Question |
|---|---|
| 1 | How long have you been running TM1 / Planning Analytics? |
| 2 | What version are you on? Cloud or on-premise? |
| 3 | Do you have an internal TM1 developer or admin? |
| 4 | What's working well with your current TM1 setup? |
| 5 | What's broken or frustrating about it right now? |
| 6 | How many models/cubes are you running? |
| 7 | What triggered you to look for external support now? |
| 8 | Have you worked with a TM1 partner before? What happened? |
| 9 | What does your ideal support arrangement look like? |
| 10 | Who else is involved in this decision? |
| 11 | What's your timeline? |
| 12 | What would need to be true for you to move forward with us? |

**Variant C: First-Time AI User (DRAFT)**

| # | Question |
|---|---|
| 1 | What processes in your business feel most manual or repetitive? |
| 2 | Have you experimented with any AI tools internally? |
| 3 | What data sources does your team work with most? |
| 4 | What would you automate first if you could? |
| 5 | How do you currently handle reporting and analytics? |
| 6 | What triggered your interest in AI / automation now? |
| 7 | Have you evaluated other AI consultancies? |
| 8 | Who else is involved in this decision? |
| 9 | What does success look like for an AI initiative? |
| 10 | What's your timeline for getting started? |
| 11 | Is there a budget allocated? |
| 12 | What would need to be true for you to move forward with us? |

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

**3.5 The 2-Minute Screencast (SDR Handover)**

Before the ticket is moved to "Ready for Positional Meeting", the SDR must record a mandatory 2-minute video debrief using a tool like Loom or Fathom's built-in recorder.
- **0-30s:** Introduce the prospect and company.
- **30-90s:** Explain the primary pain point and why they need TM1/AI.
- **90-120s:** The SDR's "gut feel" on the deal (hot/cold, red flags).
- **Action:** Paste the video link into the HubSpot ticket alongside the Claude Mega-Prompt output.

---

## Component 04: Central Call Directory

### What We're Building
A single place where Anthony and the team can access every recorded call chronologically, with coaching tools built in.

### HOW — Step by Step

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

For the 5 structured report types (Component 05), the rep copies the transcript from either:
- **Fathom** (for Teams meetings) -- open the call, copy transcript
- **HubSpot contact timeline** (for 3CX calls) -- open the call activity, copy transcript

The transcript is then pasted into Claude for structured report generation.

---

## Component 05: Sales Reports (Manual-First)

### What We're Building
5 structured report types generated from call transcripts using Claude Projects and prompt templates.

### HOW — Step by Step

**5.1 The "Manual-First" Workflow (Phase 1)**

To build muscle memory and ensure that the sales staff (Albert and Isha) fully master the qualifying criteria, the early-game pipeline runs on a manual-first workflow. Reps are expected to copy and paste call transcripts between Fathom (or Jamie AI) and Claude. 

**The Manual Step-by-Step Flow:**
1. **Retrieve Transcript:** Once a call ends, the rep opens the call transcript from **Fathom** (for video meetings) or the **HubSpot contact timeline** (for 3CX audio recordings).
2. **Access Claude:** The rep opens Claude and accesses the dedicated **"Octane Sales Reports" Project**.
3. **Execute Prompts:** The rep pastes the call transcript and runs the prompts for the required reports (Recap Email, Summary Sheet, Detailed Notes, Proposal Draft, and Questionnaire Mapping).
4. **Verify & Learn:** The rep reviews Claude's output. This review step is crucial: it forces the rep to digest the prospect's responses and internalize the qualifying parameters before handoff.
5. **Log in CRM:** The rep copies the verified reports and pastes them into the **HubSpot Ticket** as a consolidated Note.
6. **SDR Reality:** Isha finishes the call, runs the copy-paste flow in Claude, and updates HubSpot within 5 minutes. She then records her 2-Minute Screencast via **Vidyard** (Section 5.1b), completing the deal handover.

**5.1b The 2-Minute Screencast (Vidyard)**

The screencast is the ultimate human layer. It gives Kevin/Steny/Amendra the rep's gut feel on the deal -- tone, body language cues, and confidence level that AI cannot capture.

| Setting | Value |
|---|---|
| Tool | **Vidyard** (Free tier: 25 videos/month, unlimited with Pro at $19/user/mo) |
| Format | Screen + camera (picture-in-picture) |
| Duration | Exactly 2 minutes. No more. |
| HubSpot Logging | Vidyard auto-logs the video to the Contact Activity Timeline |
| Viewer Analytics | Kevin/Steny can see if/when the video was watched |

Content structure for the 2-minute debrief:
1. **0:00-0:30** -- Lead temperature (Hot/Warm/Cold) and why
2. **0:30-1:00** -- Key pain points that surfaced (in the rep's own words)
3. **1:00-1:30** -- What the AI reports may have missed (gut feel, tone, unspoken signals)
4. **1:30-2:00** -- Specific prep suggestion for the Positional Meeting partner

**5.1c Zapier/Make.com Automation Upgrade (Phase 2)**

Once the manual process is operating reliably and the reps fully understand the pipeline mechanics, we can remove the administrative friction by activating background automation:
1. **Trigger:** Fathom automatically syncs the completed meeting transcript to the HubSpot Contact Record.
2. **Action:** A webhook triggers Zapier/Make.com, which pulls the transcript and sends it to the Claude API.
3. **Cognitive Synthesis:** Claude runs a consolidated "Mega-Prompt" to generate all reports in a single execution.
4. **Action:** Zapier/Make.com writes the consolidated output directly back into the HubSpot Ticket as a Note, eliminating manual copy-pasting.

**5.2 Claude Project Setup**

To facilitate the Phase 1 manual workflow, reps use a Claude Project named **"Octane Sales Reports"** with the following uploaded knowledge:
- Octane service catalog
- SOW templates
- Pricing frameworks
- Brand voice guidelines

**5.3 The 5 Report Prompt Templates**

**Report 1: Questionnaire Mapping**
(Already defined in Component 03, Section 3.3 above)

**Report 2: Recap Email**
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

SUMMARY: [Company] — [Date]
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
Using this call transcript (and any previous call context), draft a
preliminary proposal for the prospect. Structure:

1. UNDERSTANDING OF REQUIREMENTS (what the prospect needs)
2. PROPOSED SOLUTION (how Octane addresses it)
3. APPROACH & METHODOLOGY (phases, timeline)
4. TEAM & RESOURCES (who from Octane would be involved)
5. NEXT STEPS (what needs to happen to proceed)

Do NOT include pricing. This is a discussion document, not a final SOW.
Tone: consultative, specific to their situation.

--- TRANSCRIPT(S) ---
[Paste transcript(s)]
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

These items are outside the 5-component scope but are architected in the Tiny Sales Pipeline HTML:

- **Component 06:** Middle Game Triage (Once the positional meeting closes out, leads are triaged: **Kevin** handles TM1 / Planning Analytics demos, **Steny** handles Artificial Intelligence tracks).
- **Component 07:** Commercial SOW generation via Claude
- **Component 08:** Deal pipeline tracking and close process
- **Phase 2:** Agentic automation via Make.com + Claude API + Fathom webhooks + enrichment APIs

These can be scoped separately once Components 01-05 are operational.

---

## Upgrade Path (Prioritised by Impact)

### ✅ Tier 1: Implement Now ($0 additional)

| Priority | Tool | Cost | What It Adds |
|---|---|---|---|
| **P1** | **Vidyard Free** | $0/mo | Standardises the 2-min screencast with HubSpot auto-logging + viewer analytics |
| **P2** | Keep **Fathom Free** | $0/mo | Already optimal for current team size |
| **P3** | Keep **Zapier** | ~$30/mo | Already configured, low complexity |

### ⏳ Tier 2: When Volume Grows ($49-99/mo additional)

| Priority | Tool | Cost | Trigger | What It Adds |
|---|---|---|---|---|
| **P4** | **Apollo.io Basic** | $49/user/mo | SDRs spend > 30 min/day on prep | Automates Component 02 entirely (lead enrichment → Claude → HubSpot briefing). 275M+ contacts, native HubSpot sync. |
| **P5** | **Fathom Paid** | ~$15-20/user/mo | Zapier task limits become a bottleneck | Native HubSpot field-level sync without Zapier middleman |
| **P6** | **n8n (self-hosted)** 🇩🇪 | ~$10/mo (VPS) | Running 50+ automations/month | Eliminates Zapier per-task costs. Open-source, German-built, unlimited executions, full JS/Python code nodes for custom AI workflows. |

### 🔮 Tier 3: Future Phase (Enterprise Scale)

| Priority | Tool | Cost | Trigger | What It Adds |
|---|---|---|---|---|
| **P7** | **PandaDoc** | $19/user/mo | Proposal volume > 10/month | Branded proposals + e-signatures from Claude-generated content. Auto-fills from HubSpot deal fields. |
| **P8** | **Retorio** 🇩🇪 | Quote-based | Hiring 3+ new SDRs | AI avatar role-play for SDR onboarding. Behavioral analysis (tone, body language). EU AI Act + GDPR compliant. |
| **P9** | **Jamie AI** 🇩🇪 | Paid tier | Prospects push back on Fathom bot | Bot-free, invisible meeting recording. Runs locally on device. 100+ languages. GDPR-first, Frankfurt hosting. |

### Non-English Tools of Note

| Tool | Country | Relevance |
|---|---|---|
| **Modjo** | 🇫🇷 France | European Gong alternative. GDPR-native, 100+ languages, ~€99/user. Worth evaluating if coaching analytics become a priority. |
| **Claap** | 🇫🇷 France | Combines meeting AI + async video + coaching clips. Deep HubSpot integration. 99+ languages. |
| **Notta** | 🇯🇵 Japan | Best Japanese transcription. Bilingual meeting support. In-person hardware (Notta Memo). Relevant if Octane expands into Japanese market. |
| **Sansan** | 🇯🇵 Japan | Business card CRM with Claude MCP connector. APAC-focused. Event lead processing. |
| **Pabbly Connect** | 🇮🇳 India | Zapier alternative with lifetime deal pricing (~$249 one-time). No per-task limits. Budget fallback for P6. |
| **Hippo Video** | 🇮🇳 India | AI video generation for sales. Multilingual. Interactive in-video CTAs. Alternative to Vidyard. |
| **Salesken** | 🇮🇳 India | Real-time in-call coaching. Battle cards and objection prompts appear live during the call. |

### Cost Projection

| Configuration | Monthly Cost | Coverage |
|---|---|---|
| **Current (P1-P3)** | ~$30-35/mo | Fathom Free + Vidyard Free + Zapier + Claude API |
| **+ Apollo (P4)** | ~$80-85/mo | Fully automated prep + recording + reports |
| **+ n8n swap (P6)** | ~$60-65/mo | Drops Zapier, unlimited automations |
| **Full stack (P1-P7)** | ~$100-130/mo | Fully automated pipeline with proposals + e-sign |
