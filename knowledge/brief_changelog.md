# Technical Brief -- Change Log

This file tracks all detected changes between the canonical baseline and newly fetched versions of Anthony's Sales Process Technical Brief.

**Source Document:** [Google Doc](https://docs.google.com/document/d/1cHrzNKxx-Xgn4X2FLJETWublWTCfHiySW_HYlUd_aDg)
**Baseline File:** [technical_brief_baseline.md](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/knowledge/technical_brief_baseline.md)

---

## Version History

| Version | Date (AEST) | Lines | Bytes | Changes Detected |
|:--------|:------------|:------|:------|:-----------------|
| v1 (baseline) | 2026-05-27 00:00 | 147 | 7525 | Initial baseline established |

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

(No changes detected yet -- baseline just established)
