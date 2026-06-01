require('dotenv').config();
const https = require('https');

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
            service_track_interest: 'N/A'
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
                if(res.statusCode === 201 || res.statusCode === 200) {
                    console.log(`[SUCCESS] Imported ${contact.email}`);
                    resolve(JSON.parse(data));
                } else if (res.statusCode === 409) {
                    console.log(`[EXISTS] Contact already exists: ${contact.email}. Attempting to update to trigger webhook...`);
                    // If conflict, try to fetch and update
                    const existingData = JSON.parse(data);
                    const existingId = existingData.message.match(/Contact already exists. Existing ID: (\d+)/);
                    if (existingId && existingId[1]) {
                        updateContact(existingId[1], contact).then(resolve).catch(reject);
                    } else {
                        resolve(null);
                    }
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

function updateContact(id, contact) {
    const payload = JSON.stringify({
        properties: {
            jobtitle: contact.jobtitle,
            hubspot_booking_intake: 'Event Lead - No Intake',
            service_track_interest: 'N/A'
        }
    });

    const options = {
        hostname: 'api.hubapi.com',
        port: 443,
        path: `/crm/v3/objects/contacts/${id}`,
        method: 'PATCH',
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
                if(res.statusCode === 200) {
                    console.log(`[SUCCESS] Updated existing contact ${contact.email} (ID: ${id})`);
                    resolve(JSON.parse(data));
                } else {
                    console.error(`[FAILED UPDATE] ${contact.email} - Status: ${res.statusCode} - ${data}`);
                    resolve(null);
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function runImport() {
    console.log("Running E2E test import for Tom Elkins...");
    const lead = { 
        email: 'thomas.elkins@lionco.com', 
        firstname: 'Tom', 
        lastname: 'Elkins', 
        company: 'Lion Nathan Australia Pty Ltd', 
        jobtitle: 'Finance Transformation Director' 
    };

    const result = await createContact(lead);
    console.log("Result:", result ? `Contact ID: ${result.id}` : "Failed");
}

runImport();
