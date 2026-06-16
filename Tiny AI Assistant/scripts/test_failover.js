const http = require('http');
const https = require('https');

// Load environment from .env
require('dotenv').config();

const PORT = 9099;
process.env.PORT = PORT;
process.env.MISTRAL_API_KEY = 'invalid_mock_mistral_key_to_force_failover';

console.log('🔄 Launching server...');
const server = require('../server.js');

const originalRequest = https.request;

let geminiCalled = false;

// Intercept requests
https.request = function (options, callback) {
    const hostname = options.hostname;
    
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
    
    // Intercept Mistral to return 401 Unauthorized
    if (hostname === 'api.mistral.ai') {
        console.log('🕵️ Intercepted API request to api.mistral.ai. Returning mock 401 to trigger failover...');
        const reqStream = new (require('events').EventEmitter)();
        reqStream.write = function () {};
        reqStream.end = function () {
            const res = mockResponse(401, { error: "Invalid API key" });
            if (callback) callback(res);
        };
        return reqStream;
    }
    
    // Intercept Gemini request to verify failover routing
    if (hostname === 'generativelanguage.googleapis.com') {
        console.log('🕵️ Intercepted API request to Gemini (generativelanguage). Succeeded routing!');
        geminiCalled = true;
        const reqStream = new (require('events').EventEmitter)();
        reqStream.write = function () {};
        reqStream.end = function () {
            const res = mockResponse(200, {
                candidates: [{
                    content: {
                        parts: [{
                            text: '### [PRE-SCREEN BRIEFING] Failover Succeeded!'
                        }],
                        role: 'model'
                    }
                }]
            });
            if (callback) callback(res);
        };
        return reqStream;
    }
    
    return originalRequest.apply(this, arguments);
};

async function runTests() {
    console.log('\n🚀 Verifying LLM Resiliency Shield Failover Routing...');
    
    const payload = JSON.stringify({
        provider: 'mistral',
        model: 'mistral-large-latest',
        messages: [
            { role: 'system', content: 'You are a test system.' },
            { role: 'user', content: 'Testing failover routing' }
        ]
    });
    
    const req = http.request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/chat',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log(`\n==================================================`);
            console.log(`Status Code: ${res.statusCode}`);
            console.log(`Response Body:\n`, body);
            console.log(`==================================================`);
            
            if (res.statusCode === 200 && geminiCalled) {
                console.log('🎉 SUCCESS: Failover to Gemini routing verified 100% functional!');
                process.exit(0);
            } else {
                console.error('❌ FAILURE: Failover was not executed or returned error status.');
                process.exit(1);
            }
        });
    });
    
    req.on('error', (err) => {
        console.error('❌ Request error:', err.message);
        process.exit(1);
    });
    
    req.write(payload);
    req.end();
}

setTimeout(runTests, 1500);
