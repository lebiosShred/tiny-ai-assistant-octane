# Bulk Ingestion Architecture & Pipeline

This module dictates the standard operating procedure for bulk event lead processing at Octane Software Solutions. It ensures that leads gathered offline or from external marketing lists that bypass the `demo/index.html` web intake form still receive accurate pre-screen dossier enrichment.

## Architecture & Integration Strategy

### 1. The HubSpot CSV Import (The Origin)
Instead of building a separate raw-ingestion DB, all event leads must be directly imported into HubSpot.
- Map First Name, Last Name, Email, Job Title, and Company Name.
- Set a hidden property (or custom property) `hubspot_booking_intake` to the literal string: `"Event Lead - No Intake"`.
- Set `serviceTrack` to `"N/A"`.

### 2. Event Routing Fallback (The Node.js Pipeline)
Because these leads have "No Intake", the `server.js` route for AI brief synthesis evaluates `params.intakeAnswers` and sets:
```javascript
params.track = 'N/A';
```
The system will then trigger the standard `handleCallPrep` function against the Mistral/Claude completion endpoint, but explicitly instruct the AI that the service track is "N/A" (Generic Overview/Discovery Phase).

### 3. Deployable Node.js Bulk Import Script
For programmatic uploads, save this as `scripts/bulk_event_import.js`.

```javascript
const https = require('https');
const fs = require('fs');

const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

function createContact(contact) {
    const payload = JSON.stringify({
        properties: {
            email: contact.email,
            firstname: contact.firstname,
            lastname: contact.lastname,
            company: contact.company,
            jobtitle: contact.jobtitle,
            hubspot_booking_intake: 'Event Lead - No Intake',
            service_track_interest: 'N/A' // Custom Hubspot Property mapping
        }
    });

    const options = {
        hostname: 'api.hubapi.com',
        port: 443,
        path: '/crm/v3/objects/contacts',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if(res.statusCode === 201) {
                    console.log(`[SUCCESS] Imported ${contact.email}`);
                    resolve(JSON.parse(data));
                } else {
                    console.error(`[FAILED] ${contact.email} - Status: ${res.statusCode} - ${data}`);
                    resolve(null);
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// Example Execution
async function runImport() {
    // Array derived from CSV parser in production
    const eventLeads = [
        { email: 'jane.doe@meridian.com', firstname: 'Jane', lastname: 'Doe', company: 'Meridian Logistics', jobtitle: 'VP Supply Chain' },
        { email: 'john.smith@acme.org', firstname: 'John', lastname: 'Smith', company: 'Acme Corp', jobtitle: 'CFO' }
    ];

    for (const lead of eventLeads) {
        await createContact(lead);
        // Rate limiting buffer
        await new Promise(r => setTimeout(r, 500)); 
    }
}

// runImport();
```

## Maintenance & Execution
To deploy, run the script from the Node.js environment via a secure cron job or CLI invocation after each marketing event. The resulting contacts will immediately trip the `contact.creation` webhook back to our `server.js`, resulting in automated AI briefing prep.
