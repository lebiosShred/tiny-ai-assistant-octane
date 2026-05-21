# Tiny Sales Pipeline -- Progress Log

**Last Updated:** May 21, 2026  
**Status:** In Progress (Ready for Rep/Owner Calendar Integration)  
**Lead Engineer:** CJ Amiel (Octane Software Solutions)  

---

## 1. Executive Summary Status

| Deliverable | Status | Description |
| :--- | :--- | :--- |
| **Pipeline Rebranding** | ✅ Completed | Updated all files (`HOW-PROPOSAL.md`, `early-game-architecture.html`, `executive-summary.html`, `README.md`) to reflect the **"Tiny"** name. |
| **Workflow Diagram** | ✅ Completed | Embedded a responsive dark-themed Mermaid flowchart at the top and in Section 2 of `executive-summary.html`. |
| **Tool Stack Mapping** | ✅ Completed | Defined the $0 extra-spend tooling stack (HubSpot, Fathom, Jamie AI, Vidyard, 3CX, Teams). |

---

## 2. Component Progress Breakdown

### Component 01: Pre-Screen Calendar
* **Status:** 🟧 Pending Setup
* **Technical Design:**
  * HubSpot Meeting Page configured as **Round-Robin** (technical requirement to group multiple reps under one link).
  * Operational routing is **shift-deterministic** based on non-overlapping working hours.
* **Rep Shifts:**
  * **Albert:** 7:00 AM -- 2:00 PM AEST
  * **Isha:** 2:00 PM -- 9:00 PM AEST
* **Handoff Action Items:**
  * [ ] Invite Albert and Isha to the HubSpot portal with Sales Hub seats.
  * [ ] Albert and Isha to sync their Outlook/365 calendars with HubSpot.
  * [ ] Albert and Isha to configure their profile working hours to match their respective shifts.
  * [ ] Construct the aggregated HubSpot Round-Robin scheduling page.
  * [ ] Map pre-screen booking form fields (Name, Email, Website, Phone, LinkedIn, Service Interest, Discuss Details).
  * [ ] Generate the high-resolution QR code pointing to the final calendar page.

### Component 02: Claude Prep Dossier
* **Status:** 🟩 Architecture Confirmed
* **Workflow:**
  * Prospect books call → HubSpot Ticket auto-creates.
  * Rep copies the Company URL from HubSpot.
  * Rep runs the URL through Claude Desktop using the research prompt.
  * Claude parses the site and outputs a structured client prep dossier in under 60 seconds.

### Component 03: The Call & Script
* **Status:** 🟧 Draft (Awaiting Approval)
* **Status Details:** The 12-question pre-screen call framework is currently a draft and pending team/Anthony approval.
* **Integration Logic:**
  * All Teams/Zoom calls auto-joined by **Fathom** for transcription and recording.
  * Fathom auto-syncs call records directly to HubSpot contact/deal timelines.
  * **GDPR/Privacy Fallback:** If a prospect declines the bot, reps deploy **Jamie AI** locally (data hosted in Frankfurt, Germany).

### Component 04: HubSpot Coaching Hub
* **Status:** 🟩 Architecture Confirmed
* **Workflow:**
  * Management accesses the CRM's **Coaching Playlists** page to audit transcripts.
  * Direct keyword-searching across all call timelines.
  * One-click snippet clipping to train reps.

### Component 05: Claude Sales Reports
* **Status:** 🟩 Architecture Confirmed
* **Workflow:**
  * Post-call, the Fathom transcript is exported.
  * Rep pastes the transcript into Claude to produce a formatted Call Conversion Report.
  * The report is attached to the HubSpot deal record for management review.

---

## 3. Key Operational Rules
1. **No Round-Robin Randomization:** Bookings route deterministically based on AEST shift hours.
2. **Same-Day Bookings Blocked:** HubSpot calendar buffer set to a minimum of 12 hours.
3. **No Placeholders:** All visuals, diagrams, and structures are functional and fully embedded.
