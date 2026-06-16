const https = require('https');

const apiKey = 'AIzaSyBuYILyoRDz8jEIXwWNrNki93oY6Pphq8A';
const payload = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
});

const options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log(res.statusCode, body));
});
req.write(payload);
req.end();
