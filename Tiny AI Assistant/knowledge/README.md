# Anthony Workspace -- Knowledge Directory

> **Session Bootstrap File**
> Read this file at the start of every new session working in this workspace.
> It documents all active protocols, knowledge assets, and operational conventions.

_Last updated: 2026-05-27 01:18 AEST_

---

## Workspace Identity

| Field | Value |
|:---|:---|
| **Project** | Early Game Sales Pipeline |
| **Client** | Anthony Coundouris, Octane Software Solutions |
| **Workspace** | `c:\Users\SkyDr\OneDrive\Desktop\PROJECTS\Anthony` |
| **Project Board Entry** | #10 in [project_board.md](file:///c:/Users/SkyDr/.gemini/antigravity/knowledge/octane_active_projects/artifacts/project_board.md) |
| **Operator Profile** | [operator_context.md](file:///c:/Users/SkyDr/.gemini/antigravity/knowledge/octane_operator_profile/artifacts/operator_context.md) |

---

## Source of Truth

The canonical requirements document is a Google Doc maintained by Anthony Coundouris and Sheila Ocana:

| Field | Value |
|:---|:---|
| **Title** | Sales Process Technical Brief |
| **Google Doc** | [View Document](https://docs.google.com/document/d/1cHrzNKxx-Xgn4X2FLJETWublWTCfHiySW_HYlUd_aDg) |
| **Export URL** | `https://docs.google.com/document/d/1cHrzNKxx-Xgn4X2FLJETWublWTCfHiySW_HYlUd_aDg/export?format=txt` |

The brief defines **5 components**:

| # | Component | Implementation Status |
|:--|:----------|:---------------------|
| 01 | Booking Page | Implemented (demo/book.html) |
| 02 | Preparation for Requirement Session (AI Assistant) | Implemented (demo/ai-assistant.js, demo/app.js) |
| 03 | Requirement Session | Implemented |
| 04 | Central Call Recording Directory | Not started (HubSpot dependent -- deferred) |
| 05 | Automated Reports | Not started (HubSpot dependent -- deferred) |
| Addendum | Kevin's TM1 Demo Calendar | Implemented (demo/book.html with dynamic buffer constraints) |

---

## Active Protocols

### 1. Baseline-Snapshot-Diff (BSD) -- Brief Change Detection

**Purpose:** Track changes to the Google Doc technical brief across versions without manual comparison.

**Files:**

| File | Role |
|:---|:---|
| [technical_brief_baseline.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/technical_brief_baseline.md) | Golden reference snapshot (v1, fetched 2026-05-27). Contains YAML frontmatter with version, timestamp, line/byte counts. |
| [brief_changelog.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/brief_changelog.md) | Version history table, diff protocol, and structured change log. |

**Trigger phrases:** "check the brief for updates", "Anthony updated the brief", "check updates"

**Procedure:**
1. Fetch the latest text export from the Google Doc export URL
2. Save as `knowledge/technical_brief_latest.md`
3. Diff against `knowledge/technical_brief_baseline.md` (skip YAML frontmatter lines 1-8)
4. Output a structured change report (added / removed / modified lines, affected components)
5. After user approval, overwrite baseline with latest, increment version in changelog

**PowerShell diff command:**
```powershell
Compare-Object (Get-Content "knowledge\technical_brief_baseline.md" | Select-Object -Skip 8) (Get-Content "knowledge\technical_brief_latest.md") -IncludeEqual | Where-Object { $_.SideIndicator -ne '==' }
```

---

## Knowledge Assets

| File | Content | Source | Refresh Trigger |
|:---|:---|:---|:---|
| [requirements_matrix.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/requirements_matrix.md) | 64 requirements mapped to code (5 components + addendum) | Brief baseline audit | On brief change (BSD protocol) or code changes |
| [customer_profiles.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/customer_profiles.md) | 9 target customer segments with pain points, product mappings | [Google Sheet](https://docs.google.com/spreadsheets/d/1jIDnq2QAhU_eMcZZvNkAvRfyb0JIvBWs2NyjMviIiG8) | "refresh the sheet" |
| [company_info.pdf.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/company_info.pdf.md) | Octane company overview | PDF extraction | Static |
| [discovery_scripts.pdf.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/discovery_scripts.pdf.md) | Sales discovery question scripts | PDF extraction | Static |
| [services_catalog.pdf.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/services_catalog.pdf.md) | Octane services catalog | PDF extraction | Static |
| [custom-questions.json](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/custom-questions.json) | Booking form question definitions | Manual | On requirement change |

---

## Codebase Map

| Path | Purpose |
|:---|:---|
| `demo/index.html` | SDR dashboard (main entry point) |
| `demo/app.js` | Dashboard logic, dossier rendering, prospect management |
| `demo/ai-assistant.js` | AI dossier generation (Claude/Mistral integration) |
| `demo/book.html` | Booking page (Albert + Isha, System Administrator, Steny, and Kevin, Component 01 & Addendum) |
| `demo/server.js` | Express backend (API routes, email, booking) |
| `demo/styles.css` | Dashboard styles |

---

## Deferred Work

| Item | Reason | Resume When |
|:---|:---|:---|
| HubSpot integration | User directive to skip | User explicitly requests it |
| Mural process map ingestion | Cannot access Mural | User exports and drops PNG/PDF into knowledge/ |

---

## Session Startup Checklist

1. Read this file
2. Read [operator_context.md](file:///c:/Users/SkyDr/.gemini/antigravity/knowledge/octane_operator_profile/artifacts/operator_context.md) for Amie's communication preferences
3. Check [project_board.md](file:///c:/Users/SkyDr/.gemini/antigravity/knowledge/octane_active_projects/artifacts/project_board.md) for current project status
4. If user says "check the brief" -- follow the BSD protocol above
5. If user says "refresh the sheet" -- re-fetch the Google Sheet training data
