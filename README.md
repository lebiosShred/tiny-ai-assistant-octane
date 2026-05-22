# Anthony -- Early Game Sales Pipeline

> **Commissioned by:** Anthony Coundouris + Sheila Ocana (Run Frictionless)
> **Tech Lead / Builder:** Amendra Pratap (Octane Software Solutions)
> **Sales Team:** Albert, Isha (SDRs); Amendra, Steny, Kevin (Partners)
> **Version:** 2.0

---

## Source Brief

[Sales Process Technical Brief (Google Doc)](https://docs.google.com/document/d/1cHrzNKxx-Xgn4X2FLJETWublWTCfHiySW_HYlUd_aDg/edit?tab=t.0#heading=h.rjob1s2epa89)

Written by Anthony Coundouris and Sheila Ocana, this document defines the objective, tooling decisions, and scope of work for building a manual-first sales process. Amendra (Amiel) is assigned to produce the proposal for HOW each component will be built, and then build all five components.

---

## What This Project Is

This folder contains the **Early Game Sales Pipeline** for Octane Software Solutions -- the technical implementation of Anthony's Sales Process Technical Brief. It is a fully documented, manual-first sales pipeline that takes a prospect from first contact to Closed Won.

The architecture is built as a single, self-contained HTML page (`early-game-architecture.html` -- dynamically downloadable as `early-game-sales-pipeline.html`) that visualizes the entire 8-component pipeline with interactive walkthroughs.

---

## Scope of Work (From the Brief)

| Person | Responsibility |
|---|---|
| **Amiel (Amendra)** | Produce a proposal covering HOW each component will be built. Build all five components. |
| **Sheila** | Develop SOPs and training materials for sales staff. |
| **Anthony** | Review all five components. Provide input on the Claude prompt and pre-screen preparation training. Assist with training sales staff. |

---

## The Pipeline (8 Components)

| # | Component | Brief Requirement | Implementation Status |
|---|---|---|---|
| 01 | **Pre-Screen Calendar** | Single booking link, shift-based combined calendar (Albert 7am--2pm / Isha 2pm--9pm AEST, configured as Round-Robin in HubSpot), 12-hour buffer, no same-day bookings, embedded on a context page (not standalone), QR code for offline, separate links for Amendra + Steny. Info collected: name, company email, company, position, service interest, URL, discussion topic. | Architected |
| 02 | **Pre-Screen Preparation** | Claude project (**Tiny - Pre-Screen Prep**) with permanent OneDrive connection. 6 manual inputs. Produces 10-point briefing via **Tiny (AI Sales Assistant)**. | Architected |
| 03 | **Pre-Screen Call** | 30-minute call. 12-question framework (3 variants: TM1 new, TM1 existing, AI new -- Offerings Aligned). Zero typing. Transcript answers mapped to questionnaire. Book Positional Meeting with Amendra before call ends. | Architected |
| 04 | **Central Call Directory** | All recordings attached to HubSpot tickets AND visible in a single centralized directory. Chronological across the org, filterable by rep, usable for coaching prep without navigating HubSpot. Must support: audio playback, transcripts, report extraction, single-click report generation. | Architected |
| 05 | **Automated Reports** | 6 report types from transcripts via **Tiny (AI Sales Assistant)** Claude Project (**Tiny - Sales Reports**): (1) Questionnaire answers (3 variants), (2) Recap email, (3) Summary sheet, (4) Detailed notes, (5) Proposal draft, (6) Action items. | Architected |
| 06 | **Positional Meeting** | Senior Partner (Amendra/Steny/Kevin) conducts technical deep-dive, fully briefed by Component 05 outputs. Fathom AI records. | Architected (extension beyond brief) |
| 07 | **Commercial SOW Generation** | Claude processes Positional Meeting transcript against SOW Template. HubSpot Quotes generates trackable PDF. | Architected (extension beyond brief) |
| 08 | **Deal Pipeline & Close** | HubSpot tracks document opens, page views, signature status. Closed Won triggers delivery onboarding. | Architected (extension beyond brief) |

---

## Tools Decision (From the Brief)

| Purpose | Options Considered | Decision |
|---|---|---|
| CRM | HubSpot or Trello | **HubSpot** |
| Thinking & report creation | Claude | **Claude** |
| Call recording & directory | Fathom AI / 3CX or HubSpot | **HubSpot Calls Index** (Fathom / 3CX sync) |
| Calendar booking | HubSpot | **HubSpot** |
| Screen cast video | Microsoft Teams | **Microsoft Teams** |
| In-person meetings | Fathom AI / Jamie AI | **Fathom AI / Jamie AI** |

---

## Reference Assets (From the Brief)

- Early game explainer video: Google Drive (link in source doc)
- Process map (Mural): View board (link in source doc)
- [Early game deal board (HubSpot)](https://app.hubspot.com/contacts/2926400/objects/0-136/views/all/board?prefetch=)
- [Training data spreadsheet](https://docs.google.com/spreadsheets/d/1jIDnq2QAhU_eMcZZvNkAvRfyb0JIvBWs2NyjMviIiG8/edit?usp=sharing)

---

## Anthony's Six Concepts (Run Frictionless Framework)

The brief includes foundational sales system concepts from Anthony's Run Frictionless methodology:

1. **Customer's Goal** -- The purpose of a sales system is to achieve the customer's goal in the shortest possible time, not to make sales efficient for the company.
2. **Friction** -- Identify and eliminate friction points that slow the customer down.
3. **Drop Off** -- Understand where prospects abandon the process.
4. **4Qs** -- Four qualifying questions framework.
5. **Intel** -- Gather intelligence before engaging the prospect.
6. **Words and Pictures** -- Communication design for clarity.

---

## Interactive Features (HTML File)

The HTML file includes two modal overlays:

1. **"View Walkthrough Scenario"** -- Real-life scenario following prospect Sarah Chen (Head of FP&A at Meridian Logistics) through the entire pipeline. Includes old-way vs. new-way comparison table.

2. **"Optimize Process Version"** -- Phase 2 roadmap for Agentic Automation using Make.com + Claude API + Clearbit/Apollo API. Target: zero prep time, zero post-call admin, instant handoff.

---

## Phase 2 Roadmap (Agentic Automation)

| Metric | Manual-First (Current) | Agentic Automation (Target) |
|---|---|---|
| Prep Time per Call | 5--8 minutes | **0 minutes** |
| Post-Call Admin | 10--15 minutes | **0 minutes** |
| Data Consistency | High (rep dependent) | **Perfect (API enforced)** |
| Amendra's Visibility | Delayed until rep acts | **Instant upon call completion** |

---

## File Structure

```
Anthony/
├── early-game-architecture.html   # WHAT — Pipeline visualization (architecture diagram)
├── HOW-PROPOSAL.md                # HOW — Implementation proposal (build instructions)
└── README.md                      # This file
```
