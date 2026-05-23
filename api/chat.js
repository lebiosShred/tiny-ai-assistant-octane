import https from 'https';

export default function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    // Determine API Key: prefer custom Authorization header, fallback to environment variable
    let apiKey = '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7).trim();
    }
    
    const isMockKey = apiKey === "N1V4ErGCSlQSLdDrc7vhkSfpf334TgRo";
    if (!apiKey || isMockKey) {
        apiKey = (process.env.MISTRAL_API_KEY || '').trim();
    }

    if (!apiKey) {
        res.status(400).json({ error: 'API key is missing. Set MISTRAL_API_KEY environment variable or configure a custom key in Settings.' });
        return;
    }

    const payload = JSON.stringify(req.body);

    const options = {
        hostname: 'api.mistral.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        res.status(proxyRes.statusCode);
        for (const [key, value] of Object.entries(proxyRes.headers)) {
            res.setHeader(key, value);
        }
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        res.status(502).json({ error: `Proxy connection error: ${err.message}` });
    });

    proxyReq.write(payload);
    proxyReq.end();
}
