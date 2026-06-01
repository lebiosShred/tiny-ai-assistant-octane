const http = require('http');
const https = require('https');
const crypto = require('crypto');

// Configure test environment
process.env.HUBSPOT_CLIENT_SECRET = 'test_secret_key';
process.env.HUBSPOT_ACCESS_TOKEN = 'test_access_token';
process.env.MISTRAL_API_KEY = 'test_mistral_key';

const PORT = 9090; // Use a different port to avoid conflicts
process.env.PORT = PORT;

console.log('🔄 Loading server...');
const serverFile = require('./server.js');

// Mock state trackers
let noteCreated = null;
let contactFetched = false;
let callFetched = false;

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
        
        // Contact details API endpoint
        if (path.includes('/crm/v3/objects/contacts/123')) {
            contactFetched = true;
            return createMockRequest(200, {
                id: '123',
                properties: {
                    firstname: 'Sarah',
                    lastname: 'Chen',
                    email: 'jane.doe@acme.com',
                    website: 'acme.com',
                    company: 'Acme Corp',
                    jobtitle: 'Head of FP&A',
                    hubspot_booking_intake: 'Need watsonx AI orchestration and generative AI tool workflows.'
                }
            });
        }
        
        // Call transcript API endpoint
        if (path.includes('/crm/v3/objects/calls/456')) {
            callFetched = true;
            return createMockRequest(200, {
                id: '456',
                properties: {
                    hs_call_body: 'Albert: Hi Jane, tell me about your systems. Jane Doe: We use Oracle and copy-paste 35 sheets. I want generative AI and watsonx integration.',
                    hs_call_recording_url: 'https://teams.microsoft.com/l/meetup-join/mock'
                }
            });
        }
        
        // Contact associations API endpoint
        if (path.includes('/crm/v3/objects/calls/456/associations/contacts')) {
            return createMockRequest(200, {
                results: [{ id: '123', type: 'call_to_contact' }]
            });
        }
        
        // Deal associations API endpoint
        if (path.includes('/crm/v3/objects/calls/456/associations/deals')) {
            return createMockRequest(200, {
                results: [{ id: '789', type: 'call_to_deal' }]
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
                const res = mockResponse(201, { id: '999', properties: { hs_note_body: 'saved' } });
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
                        content: `<h3>[PRE-SCREEN BRIEFING: Jane Doe — Acme Corp]</h3>
    <ul>
    <li><strong>LinkedIn Analysis:</strong> 3 years tenure as Head of FP&A at Acme.</li>
    <li><strong>Meeting Context:</strong> Exploring AI and automation for FP&A close processes.</li>
    <li><strong>Pain Points:</strong> Manual copy-pasting of 35 sheets.</li>
    <li><strong>Relevant Services:</strong> Watsonx Orchestrate and Data Integration.</li>
    <li><strong>Competitors:</strong> None identified.</li>
    <li><strong>Competing Apps:</strong> Anaplan, Workday.</li>
    <li><strong>Complementary Apps:</strong> Oracle, Power BI.</li>
    <li><strong>Planning Apps:</strong> Logistics allocation models.</li>
    <li><strong>Likely Pain Points:</strong> 45 min manual copy-paste per sheet.</li>
    <li><strong>Conversation Starters:</strong> Introduce the watsonx agentic automation pilot.</li>
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
    console.log('\n🚀 Starting webhook validation and sync tests...');
    
    try {
        // Test Case 1: Send webhook for Contact Creation (Call Prep)
        console.log('\n--- Test Case 1: Send webhook for Contact Creation (Call Prep) ---');
        await sendWebhook({
            subscriptionType: 'contact.creation',
            objectId: '123',
            objectTypeId: '0-1'
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        if (contactFetched && noteCreated) {
            console.log('✅ TEST CASE 1 PASSED: Call Prep dossier generated and note attached to contact successfully.');
            console.log('Dossier preview:', noteCreated.properties.hs_note_body.substring(0, 150) + '...');
        } else {
            throw new Error(`Test Case 1 Failed: contactFetched=${contactFetched}, noteCreated=${!!noteCreated}`);
        }
        
        // Reset Note Creation state for next case
        noteCreated = null;
        
        // Test Case 2: Send webhook for Call Transcript updates (Call Synthesis)
        console.log('\n--- Test Case 2: Send webhook for Call Transcript updates (Call Synthesis) ---');
        await sendWebhook({
            subscriptionType: 'crmObject.propertyChange',
            propertyName: 'hs_call_body',
            objectId: '456',
            objectTypeId: '0-48'
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        if (callFetched && noteCreated) {
            console.log('✅ TEST CASE 2 PASSED: Call Transcript synthesized and note attached to Deal/Contact.');
            console.log('Note associations:', JSON.stringify(noteCreated.associations));
        } else {
            throw new Error(`Test Case 2 Failed: callFetched=${callFetched}, noteCreated=${!!noteCreated}`);
        }
        
        console.log('\n🌟 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🌟');
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
    
    // Generate valid v3 signature
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
