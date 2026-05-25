const http = require('http');

const payload = JSON.stringify({
    provider: "mistral",
    model: "mistral-large-latest",
    messages: [
        {
            role: "system",
            content: "You are a B2B assistant."
        },
        {
            role: "user",
            content: "1. Client: Sarah Chen, Head of FP&A at Meridian Logistics\n2. Company URL: meridianlogistics.com.au\n--- PRODUCE THESE 10 POINTS ---\n1. LinkedIn profile analysis"
        }
    ]
});

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/chat',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-key-12345',
        'Content-Length': Buffer.byteLength(payload)
    }
};

console.log("Sending test request to http://localhost:8080/api/chat...");
const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log("Response Body (first 500 chars):");
        console.log(body.substring(0, 500));
        process.exit(0);
    });
});

req.on('error', (err) => {
    console.error("HTTP Request Error:", err);
    process.exit(1);
});

req.write(payload);
req.end();
