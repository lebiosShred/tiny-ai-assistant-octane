const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configure test environment
process.env.HUBSPOT_CLIENT_SECRET = 'test_secret_key';
process.env.HUBSPOT_ACCESS_TOKEN = 'test_access_token';
process.env.MISTRAL_API_KEY = 'test_mistral_key';

const PORT = 9091; // Use a different port to avoid conflicts
process.env.PORT = PORT;

console.log('🔄 Loading server for E2E Test...');
const serverFile = require('../server.js');

// Mock state trackers
let noteCreated = null;
let contactFetched = false;

// Save original https.request
const originalRequest = https.request;

// Mock https.request to intercept external API requests
https.request = function (options, callback) {
    const hostname = options.hostname;
    const path = options.path;
    const method = options.method;
    
    const mockResponse = (statusCode, bodyObj) => {
        const res = new (require('events').EventEmitter)();
        res.statusCode = statusCode;
        res.headers = { 'content-type': 'application/json' };
        
        process.nextTick(() => {
            res.emit('data', JSON.stringify(bodyObj));
            res.emit('end');
        });
        return res;
    };
    
    const createMockRequest = (statusCode, bodyObj) => {
        const reqStream = new (require('events').EventEmitter)();
        reqStream.write = function() {};
        reqStream.end = function() {
            const res = mockResponse(statusCode, bodyObj);
            if (callback) callback(res);
        };
        return reqStream;
    };
    
    // HubSpot CRM API Mock
    if (hostname === 'api.hubapi.com') {
        console.log(`[Mock https] Intercepted HubSpot API Call: ${method} ${path}`);
        
        // Contact details API endpoint (Tom Elkins Mock)
        if (path.includes('/crm/v3/objects/contacts/12345')) {
            contactFetched = true;
            return createMockRequest(200, {
                id: '12345',
                properties: {
                    firstname: 'Tom',
                    lastname: 'Elkins',
                    email: 'thomas.elkins@lionco.com',
                    website: 'lionco.com',
                    company: 'Lion Nathan Australia Pty Ltd',
                    jobtitle: 'Finance Transformation Director',
                    hubspot_booking_intake: 'Event Lead - No Intake' // N/A Fallback Trigger
                }
            });
        }
        
        // Note creation endpoint
        if (path === '/crm/v3/objects/notes' && method === 'POST') {
            const reqStream = new (require('events').EventEmitter)();
            reqStream.write = function (data) {
                try {
                    noteCreated = JSON.parse(data);
                } catch (e) {
                    noteCreated = data;
                }
            };
            reqStream.end = function () {
                const res = mockResponse(201, { id: '9999', properties: { hs_note_body: 'saved' } });
                if (callback) callback(res);
            };
            return reqStream;
        }
        
        return createMockRequest(404, { error: 'Mock path not found' });
    }
    
    // Mistral AI API Mock
    if (hostname === 'api.mistral.ai') {
        console.log(`[Mock https] Intercepted Mistral AI Completions Call: ${method} ${path}`);
        
        const reqStream = new (require('events').EventEmitter)();
        reqStream.write = function (data) {
            // Buffer stream write
        };
        reqStream.end = function () {
            const res = mockResponse(200, {
                choices: [{
                    message: {
                        content: `<h3>[PRE-SCREEN BRIEFING: Tom Elkins — Lion Nathan Australia Pty Ltd]</h3>
<ol>
    <li><strong>LinkedIn Analysis:</strong> Finance Transformation Director. Strong background in corporate FP&A.</li>
    <li><strong>Social Media:</strong> Not highly active, focused on internal operational strategy.</li>
    <li><strong>Company Overview:</strong> Leading beverage company in Australasia.</li>
    <li><strong>Relevant Services:</strong> General overview (N/A Track identified) focusing on TM1 and AI orchestration.</li>
    <li><strong>Key Competitors:</strong> Treasury Wine Estates, Asahi Beverages.</li>
    <li><strong>Competing Apps:</strong> Likely legacy ERP/financial systems.</li>
    <li><strong>Complementary Apps:</strong> SAP, Power BI.</li>
    <li><strong>Planning Apps:</strong> Standard budget and forecast models.</li>
    <li><strong>Likely Pain Points:</strong> Integration of offline event data, data fusion across disjointed financial stacks.</li>
    <li><strong>Conversation Starters:</strong> Discuss the Sydney Lunch RT insights on generative AI.</li>
</ol>`
                    }
                }]
            });
            if (callback) callback(res);
        };
        return reqStream;
    }
    
    // Fallback to original requests
    return originalRequest.apply(this, arguments);
};

// Test Execution Flow
async function runTests() {
    console.log('\n🚀 Starting E2E Event Lead Intake Test for Tom Elkins...');
    
    try {
        // Test Case: Send webhook for Contact Creation (Call Prep)
        console.log('\n--- Test Case: Send webhook for Event Lead Intake (Call Prep) ---');
        await sendWebhook({
            subscriptionType: 'contact.creation',
            objectId: '12345',
            objectTypeId: '0-1'
        });
        
        await new Promise(r => setTimeout(r, 4500));
        
        if (contactFetched && noteCreated) {
            console.log('✅ TEST PASSED: Event Lead E2E flow executed successfully.');
            console.log('Dossier preview:\n' + noteCreated.properties.hs_note_body.substring(0, 300) + '...\n');
            
            // Check History file output
            const historyDir = path.join(__dirname, '..', 'knowledge', 'history');
            const files = fs.readdirSync(historyDir);
            const prepFile = files.find(f => f.includes('Lion_Nathan') && f.startsWith('prep_'));
            if (prepFile) {
                console.log(`✅ History file generated: ${prepFile}`);
                const historyData = JSON.parse(fs.readFileSync(path.join(historyDir, prepFile), 'utf8'));
                if (historyData.track === 'N/A') {
                    console.log('✅ Service track correctly identified as "N/A" by the server fallback logic!');
                } else {
                    console.error('❌ Service track was not N/A! It was:', historyData.track);
                    process.exit(1);
                }
            } else {
                console.warn('⚠️ No history file found containing Lion_Nathan.');
            }
            
        } else {
            throw new Error(`Test Failed: contactFetched=${contactFetched}, noteCreated=${!!noteCreated}`);
        }
        
        console.log('\n🌟 ALL E2E TESTS PASSED SUCCESSFULLY! 🌟');
        process.exit(0);
        
    } catch (err) {
        console.error('\n❌ INTEGRATION TEST FAILED:', err.message);
        process.exit(1);
    }
}

async function sendWebhook(eventPayload) {
    const payloadString = JSON.stringify([eventPayload]);
    const timestamp = Date.now().toString();
    const method = 'POST';
    const path = '/api/hubspot/webhook';
    
    const sourceString = method + path + payloadString + timestamp;
    const signature = crypto
        .createHmac('sha256', process.env.HUBSPOT_CLIENT_SECRET)
        .update(sourceString)
        .digest('base64');
        
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-hubspot-signature-v3': signature,
                'x-hubspot-request-timestamp': timestamp
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`Webhook response received: ${data}`);
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Server rejected webhook with status ${res.statusCode}: ${data}`));
                }
            });
        });
        
        req.on('error', reject);
        req.write(payloadString);
        req.end();
    });
}

// Trigger execution after server has initialized
setTimeout(runTests, 1000);
