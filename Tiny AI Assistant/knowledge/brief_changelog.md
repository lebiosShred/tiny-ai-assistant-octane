# Technical Brief -- Change Log

This file tracks all detected changes between the canonical baseline and newly fetched versions of Anthony's Sales Process Technical Brief.

**Source Document:** [Google Doc](https://docs.google.com/document/d/1cHrzNKxx-Xgn4X2FLJETWublWTCfHiySW_HYlUd_aDg)
Baseline: [technical_brief_baseline.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/technical_brief_baseline.md)

---

## Version History

| Version | Date (AEST) | Lines | Bytes | Changes Detected |
|:--------|:------------|:------|:------|:-----------------|
| v1 (baseline) | 2026-05-27 00:00 | 147 | 7525 | Initial baseline established |
| v2 | 2026-05-28 20:00 | 141 | 7368 | Transitioned to Version 2 brief, refactored scheduler to deterministic, and mapped System Administrator to Amendra/Amiel |
| v3 | 2026-06-01 10:00 | 150 | 7705 | Added Brand Guidelines, SOP requirements, and deterministic API calculation for travel distance |

---

## Change Detection Protocol

When the user says "check the brief for updates" or similar:

1. Fetch the latest text export from `https://docs.google.com/document/d/1cHrzNKxx-Xgn4X2FLJETWublWTCfHiySW_HYlUd_aDg/export?format=txt`
2. Save as `knowledge/technical_brief_latest.md`
3. Run a line-by-line diff against `knowledge/technical_brief_baseline.md` (skip YAML frontmatter)
4. Output a structured change report:
   - **Added lines**: New content not in baseline
   - **Removed lines**: Content deleted from baseline
   - **Modified lines**: Content changed between versions
   - **Affected components**: Which of the 5 components (or addenda) were touched
5. After user review and approval, overwrite baseline with the latest version and increment the version number in this changelog

### Diff Command (PowerShell)
```powershell
Compare-Object (Get-Content "knowledge\technical_brief_baseline.md" | Select-Object -Skip 8) (Get-Content "knowledge\technical_brief_latest.md") -IncludeEqual | Where-Object { $_.SideIndicator -ne '==' }
```

---

## Detected Changes

### Version 2 Transition (2026-05-28)
1. **Document Baseline Sync**: Baseline synchronized to `technical_brief_latest.md` (141 lines, 7368 bytes) with updated YAML frontmatter.
2. **Scheduler Refactoring**: Replaced random round-robin (`Math.random()`) in `book.html` with deterministic allocation based on Sydney time slots:
   - **Albert**: 7:00 AM -- 2:00 PM AEST
   - **Isha**: 2:00 PM -- 9:00 PM AEST
3. **Role Mapping Updates**: Updated all business-level references to "System Administrator" to specialized team roles:
   - **Amendra**: Director, positional booking target, and travel distance origin.
   - **Amiel**: Onshore Lead Architect responsible for custom scopes of work.
   - *Security compliance:* User administrative setup in admin_setup.html remains untouched as "System Administrator".
4. **Tool Selection Updates (Fireflies Purged)**: Purged all references to Fireflies from the Technical Brief baseline and latest files, replacing them with Fathom/Jamie AI or HubSpot options to align with corporate tooling directives. Updated requirements matrix.

### Version 3 Transition (2026-06-01)
1. **API Routing Integration**: Implemented a backend deterministic routing API for Amendra's travel distance calculation to eliminate LLM hallucinations.
2. **Visual Sovereignty Enforcement**: Applied Brand Protocol V1.5 to `styles.css` (Roboto typography, 4-degree slant, strict hex codes, grayscale icons).
3. **Knowledge Ingestion**: Extended AI Assistant logic to ingest Octane Brand Protocol V1.5 and Early/Middle Game SOP constraints into the system prompt payload.
