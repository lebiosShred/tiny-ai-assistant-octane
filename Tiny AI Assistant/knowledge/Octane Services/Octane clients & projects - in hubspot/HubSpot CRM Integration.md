# HubSpot CRM Integration & Sales Pipeline Playbook

This playbook documents how Octane Software Solutions integrates its sales pipeline, contacts, and client call logs into HubSpot Professional CRM.

## HubSpot CRM as the Central Directory
HubSpot serves as the single source of truth for the sales development reps (SDRs) and executive directors. All interactions flow directly into the contact and deal timelines.

### 1. Unified Call Logging
* 3CX Softphone: Direct integration. Logs all outgoing and incoming audio calls to the matching contact record along with recording links and call metadata.
* Microsoft Teams: Unified via Fathom (Free). Auto-syncs completed video meeting recordings and transcripts directly to the HubSpot contact timeline.
* Verification Property: Ensure contacts use E.164 phone number formatting and have active email addresses associated to enable automatic matching.

### 2. Early-Game Sales Pipeline Deal Board
The pipeline progresses across seven mandatory stages:
1. Lead Captured: Booking form submitted or contact added.
2. MQL (Marketing Qualified Lead): Lead meets company size and interest criteria.
3. Prescreen Booked: Call scheduled (requires a shared calendar booking link in HubSpot).
4. Prescreen Completed: Basic qualification questions answered.
5. Discovery Booked: Detailed discovery call scheduled.
6. Discovery Completed: Mapped to the 4 Pillars (Pain Points, Impact, Decision Process, Next Steps).
7. Positioning Meeting: Official hand-over to the Executive Director (45-minute briefing).

### 3. Automated Call Prep and Dossiers
* Webhooks: Contact creation or property changes (like updating the call transcript) trigger local server webhooks (/api/hubspot/webhook).
* Ingestion: The server retrieves the contact properties and calls the Mistral AI/Claude API.
* Output: Generates a 12-section client briefing dossier (LinkedIn details, likely pain points, conversation starters) and attaches it back to the HubSpot Contact/Deal record as a CRM Note.
