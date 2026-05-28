const http = require('http');

const payload = JSON.stringify({
    type: 'dossier',
    stage: 'prep',
    name: 'Axiom Test Customer',
    title: 'Chief FP&A Architect',
    company: 'Axiom FP&A Solutions',
    email: 'axiom@fpa-solutions.com.au',
    phone: '+61 2 9999 8888',
    url: 'https://fpa-solutions.com.au',
    track: 'Planning & Analytics (TM1)',
    rep: 'Albert',
    intakeAnswers: 'Service track interest: Planning Analytics (TM1)\nExcel spreadsheets consolidated: 35 sheets currently consolidated manually (verify on call)\nWorkflow description: Need advanced budgeting modernizations.\nGL/ERP system: NetSuite ERP (verify on call)'
});

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/history',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

console.log("Sending mock booking POST request to http://localhost:8080/api/history...");
const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log("Response Body:");
        console.log(body);
        if (res.statusCode === 200) {
            console.log("✅ Mock booking dossier automatically generated successfully.");
            process.exit(0);
        } else {
            console.error("❌ Mock booking dossier generation failed.");
            process.exit(1);
        }
    });
});

req.on('error', (err) => {
    console.error("HTTP Request Error:", err);
    process.exit(1);
});

req.write(payload);
req.end();
