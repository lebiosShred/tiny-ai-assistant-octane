# Requirements Traceability Matrix

**Source:** [Technical Brief Baseline v1](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/technical_brief_baseline.md)
**Training Data:** [Customer Profiles](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/customer_profiles.md)
**Last Audited:** 2026-05-27 00:25 AEST

---

## Status Legend

| Status | Meaning |
|:-------|:--------|
| ✅ Done | Fully implemented and verified |
| 🔶 Partial | Implemented but with gaps |
| ❌ Not Started | No implementation exists |
| 🚫 Blocked | Cannot proceed (external dependency) |

---

## Component 01 -- Booking Page

**Implementation:** [book.html](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html) | [book.css](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.css)

| REQ ID | Brief Requirement | Status | File(s) + Lines | Verification |
|:-------|:-----------------|:-------|:----------------|:-------------|
| 01.01 | Single booking link (AU/NZ/ME) | ✅ Done | [book.html](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html) -- single page, no geo-routing | Load page, verify single URL |
| 01.02 | Albert: 7:00 AM - 2:00 PM Sydney | ✅ Done | [book.html L412-421](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L412-L421) -- hostsProfiles config | Verify Albert avatar + time slots |
| 01.03 | Isha: 2:00 PM - 9:00 PM Sydney | ✅ Done | [book.html L412-421](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L412-L421) -- hostsProfiles config | Verify Isha avatar + time slots |
| 01.04 | 28 x 30-min slots/day (14hr window) | ✅ Done | [book.html L555-566](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L555-L566) -- mockTimeSlots | Count available slots per day |
| 01.05 | No same-day bookings | ✅ Done | [book.html L602-636](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L602-L636) -- updateCalendarDatesForHost | Verify today is not selectable |
| 01.06 | 12-hour buffer on all bookings | ✅ Done | [book.html L602-636](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L602-L636) -- calendar starts at next-day | Verify earliest slot is 12h+ away |
| 01.07 | 1-hour buffer between calls | ✅ Done | [book.html L555-566](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L555-L566) -- slot spacing | Verify 1hr+ gap between slots |
| 01.08 | Phone or online (Teams/Zoom) | ✅ Done | [book.html L64-75](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L64-L75) -- meeting type selector | Verify dropdown options |
| 01.09 | Embedded in context page (salesstar ref) | ✅ Done | [book.html L18-58](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L18-L58) -- hero context section | Verify context copy + hosts display |
| 01.10 | Collect: name, company, position | ✅ Done | [book.html L180-220](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L180-L220) -- details form fields | Verify form fields exist and are required |
| 01.11 | Collect: service interest (Planning & Analytics or AI) | ✅ Done | [book.html L64-75](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L64-L75) -- reason selector | Verify options match brief |
| 01.12 | Collect: company URL | ✅ Done | [book.html L180-220](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L180-L220) -- company URL field | Verify URL input exists |
| 01.13 | Collect: what they'd like to discuss | ✅ Done | [book.html L64-75](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L64-L75) -- reason / other text | Verify free-text field |
| 01.14 | System Administrator separate calendar link | ✅ Done | [book.html L84-85](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L84-L85), [L425-435](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L425-L435) | Select System Administrator, verify separate calendar |
| 01.15 | Steny separate calendar link | ✅ Done | [book.html L84-85](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L84-L85), [L436-445](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L436-L445) | Select Steny, verify separate calendar |
| 01.16 | QR code for offline use | ✅ Done | [book.html L324-340](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L324-L340), [L745-791](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L745-L791) | Verify QR renders + download works |

**Component 01 Score: 16/16 (100%)**

---

## Component 02 -- Preparation for Requirement Session

**Implementation:** [ai-assistant.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js) | [app.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/app.js) | [index.html](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/index.html)

| REQ ID | Brief Requirement | Status | File(s) + Lines | Verification |
|:-------|:-----------------|:-------|:----------------|:-------------|
| 02.01 | Permanent GDrive connection to client folders | ✅ Done | [gdrive-service.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/gdrive-service.js) \| [server.js L1188-1246](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/server.js#L1188-L1246) \| [app.js L1594-1736](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/app.js#L1594-L1736) | Real Google Drive API list folder, read document text (Google Doc/Sheet/PDF), and full-text search. |
| 02.02 | Input: client name, company, position | ✅ Done | [index.html](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/index.html) -- prep form fields | Verify form fields populate dossier params |
| 02.03 | Input: completed booking form | ✅ Done | [app.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/app.js) -- auto-populated from booking data | Verify booking data flows to prep |
| 02.04 | Input: LinkedIn profile (PDF export) | ✅ Done | [ai-assistant.js L86-87](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L86-L87) -- linkedinInfo param | Verify LinkedIn URL/text accepted |
| 02.05 | Input: company URL | ✅ Done | [ai-assistant.js L82](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L82) -- companyUrl param | Verify URL feeds into dossier |
| 02.06 | Input: AI or TM1 track | ✅ Done | [ai-assistant.js L83](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L83) -- track param | Verify track selection works |
| 02.07 | Input: company email | ✅ Done | [index.html](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/index.html) -- email field | Verify email input exists |
| 02.08 | Input: CRM history check | 🚫 Blocked | Not implemented | HubSpot deferred per user directive |
| 02.09 | Output: LinkedIn analysis | ✅ Done | [ai-assistant.js L106-107](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L106-L107), [L162-163](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L162-L163) | Generate dossier, verify section present |
| 02.10 | Output: company overview | ✅ Done | [ai-assistant.js L109-110](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L109-L110), [L165-166](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L165-L166) | Generate dossier, verify section present |
| 02.11 | Output: Octane services | ✅ Done | [ai-assistant.js L112-113](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L112-L113), [L168-169](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L168-L169) | Generate dossier, verify section present |
| 02.12 | Output: Octane competitors | ✅ Done | [ai-assistant.js L115-116](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L115-L116) | Generate dossier, verify section present |
| 02.13 | Output: competing applications | ✅ Done | [ai-assistant.js L118-119](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L118-L119) | Generate dossier, verify section present |
| 02.14 | Output: complementary applications | ✅ Done | [ai-assistant.js L121-122](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L121-L122) | Generate dossier, verify section present |
| 02.15 | Output: TM1 and AI applications | ✅ Done | [ai-assistant.js L124-125](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L124-L125) | Generate dossier, verify section present |
| 02.16 | Output: TM1/AI relevance assessment | ✅ Done | [ai-assistant.js L127-128](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L127-L128) | Generate dossier, verify section present |
| 02.17 | Output: likely pain points | ✅ Done | [ai-assistant.js L130-131](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L130-L131) | Generate dossier, verify section present |
| 02.18 | Output: conversation starters | ✅ Done | [ai-assistant.js L133-134](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L133-L134) | Generate dossier, verify section present |
| 02.19 | Output: Octane customer profiles | ✅ Done | [ai-assistant.js L136-137](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L136-L137), [L192-193](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L192-L193) | Generate dossier, verify profile classification |
| 02.20 | Output: travel distance from System Administrator | ✅ Done | [ai-assistant.js L139-140](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L139-L140), [L195](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L195) | Generate dossier, verify travel estimate |
| 02.21 | Training data (9 segments from GSheet) | ✅ Done | [ai-assistant.js L89-105](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L89-L105) -- OCTANE TARGET CUSTOMER PROFILES embedded in prompt | Verify 9 segments in prompt match [customer_profiles.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/customer_profiles.md) |

**Component 02 Score: 20/21 (95%) -- 1 Blocked (CRM)**

---

## Component 03 -- Requirement Session

**Implementation:** [ai-assistant.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js) | [app.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/app.js) | [index.html](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/index.html)

| REQ ID | Brief Requirement | Status | File(s) + Lines | Verification |
|:-------|:-----------------|:-------|:----------------|:-------------|
| 03.01 | Duration: 30 min (Albert or Isha) | ✅ Done | [book.html L64-75](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L64-L75) -- 30min slot enforced | Verify booking enforces 30min |
| 03.02 | Build rapport using pre-screen prep | ✅ Done | [ai-assistant.js L204-266](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L204-L266) \| [index.html L313-324](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/index.html#L313-L324) \| [app.js L1776-1784, L2038-2051](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/app.js#L1776-L1784) | Collapsible talking points guide panel generated from dossier. |
| 03.03 | Structured questionnaire (~12 questions, 3 variants) | ✅ Done | [ai-assistant.js L263-420](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L263-L420) -- synthesizeCallTranscript + question variants | Verify 3 variants available in UI |
| 03.04 | No typing -- transcript capture | ✅ Done | [app.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/app.js) -- transcript paste textarea + synthesis | Verify transcript paste field exists |
| 03.05 | Transcript answers mapped to questionnaire | ✅ Done | [ai-assistant.js L421-448](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L421-L448) -- generateQuestionnaireAnswers | Paste transcript, verify answer mapping |
| 03.06 | Complete summary document produced | ✅ Done | [ai-assistant.js L263-420](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L263-L420) -- 7 deliverables synthesized | Verify all 7 document tabs render |
| 03.07 | Book Positional Meeting with System Administrator before call ends | ✅ Done | [app.js L1451-1522](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/app.js#L1451-L1522) | vCalendar (.ics) invitation file compiled and downloaded in browser. |

**Component 03 Score: 7/7 (100%)**

---

## Component 04 -- Central Call Recording Directory

**Implementation:** None (deferred)

| REQ ID | Brief Requirement | Status | File(s) + Lines | Verification |
|:-------|:-----------------|:-------|:----------------|:-------------|
| 04.01 | Attached to correct HubSpot ticket | 🚫 Blocked | -- | HubSpot deferred |
| 04.02 | Visible in single centralised directory | 🚫 Blocked | -- | HubSpot deferred |
| 04.03 | Chronological display across org | 🚫 Blocked | -- | HubSpot deferred |
| 04.04 | Filterable by individual sales person or team | 🚫 Blocked | -- | HubSpot deferred |
| 04.05 | Usable for prep (review before workshop) | 🚫 Blocked | -- | HubSpot deferred |
| 04.06 | Listen to audio recordings | 🚫 Blocked | -- | Fireflies/HubSpot deferred |
| 04.07 | Read call transcripts | 🚫 Blocked | -- | Fireflies/HubSpot deferred |
| 04.08 | Extract content via report templates | 🚫 Blocked | -- | Fireflies/HubSpot deferred |
| 04.09 | Generate reports with single click | 🚫 Blocked | -- | Fireflies/HubSpot deferred |

**Component 04 Score: 0/9 (0%) -- All Blocked**

---

## Component 05 -- Automated Reports

**Implementation:** [ai-assistant.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js)

| REQ ID | Brief Requirement | Status | File(s) + Lines | Verification |
|:-------|:-----------------|:-------|:----------------|:-------------|
| 05.01 | Questionnaire answers (3 client-type variants) | ✅ Done | [ai-assistant.js L421-448](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L421-L448) | Generate each variant, verify output |
| 05.02 | Migration report (branded) | ✅ Done | [ai-assistant.js L450-476](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L450-L476) | Generate migration report, verify branding |
| 05.03 | Recap email (3 salient points) | ✅ Done | [ai-assistant.js L479-518](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L479-L518) | Generate recap, verify 3-point format |
| 05.04 | Summary sheet (internal use) | ✅ Done | [ai-assistant.js L521-554](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L521-L554) | Generate summary, verify internal format |
| 05.05 | Notes (detailed account) | ✅ Done | [ai-assistant.js L557-576](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L557-L576) | Generate notes, verify context/nuance captured |
| 05.06 | Proposal (from one or more calls) | ✅ Done | [ai-assistant.js L641-705](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L641-L705) | Generate proposal, verify SOW structure |
| 05.07 | Action items (ownership assigned) | ✅ Done | [ai-assistant.js L579-638](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/ai-assistant.js#L579-L638) | Generate action items, verify ownership |

**Component 05 Score: 7/7 (100%)**

---

## Addendum -- Kevin's TM1 Demo Calendar

**Implementation:** [book.html](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html) (shared page, host selector)

| REQ ID | Brief Requirement | Status | File(s) + Lines | Verification |
|:-------|:-----------------|:-------|:----------------|:-------------|
| K.01 | No same-day bookings | ✅ Done | [book.html L602-636](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L602-L636) | Select Kevin, verify same-day blocked |
| K.02 | One-week buffer | ✅ Done | [book.html L608-611](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L608-L611), [L93](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L93) | Select Kevin, verify dates start 7+ days out |
| K.03 | Online meeting only (Teams/Zoom) | ✅ Done | [book.html L464-470](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/demo/book.html#L464-L470) -- Kevin forces online-only | Select Kevin, verify phone option disabled |
| K.04 | Embedded in context page | ✅ Done | Same page as main booking -- host selector toggles | Verify context copy adapts to Kevin |

**Addendum Score: 4/4 (100%)**

---

## Overall Scorecard

| Component | Done | Partial | Blocked | Not Started | Total | Score |
|:----------|:-----|:--------|:--------|:------------|:------|:------|
| 01 Booking Page | 16 | 0 | 0 | 0 | 16 | **100%** |
| 02 AI Prep | 20 | 0 | 1 | 0 | 21 | **95%** |
| 03 Requirement Session | 7 | 0 | 0 | 0 | 7 | **100%** |
| 04 Call Directory | 0 | 0 | 9 | 0 | 9 | **0%** (blocked) |
| 05 Automated Reports | 7 | 0 | 0 | 0 | 7 | **100%** |
| Kevin Addendum | 4 | 0 | 0 | 0 | 4 | **100%** |
| **TOTAL** | **54** | **0** | **10** | **0** | **64** | **84%** |

### Gap Summary (Actionable)

*All actionable feature gaps from the technical brief are fully resolved.*

### Blocked Summary (HubSpot Deferred)

| Gap | REQ IDs | Dependency |
|:----|:--------|:-----------|
| CRM history check | 02.08 | HubSpot API access |
| All of Component 04 | 04.01 - 04.09 | HubSpot + Fireflies |
