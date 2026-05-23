const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = __dirname;
const DEMO_DIR = path.join(__dirname, 'demo');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

function serveFile(res, filePath) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
}

const server = http.createServer((req, res) => {
    // Enable CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // API Proxy Route
    if (pathname === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            // Determine API Key: prefer custom Authorization header from client, fallback to server process.env.MISTRAL_API_KEY
            let apiKey = '';
            const authHeader = req.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                apiKey = authHeader.substring(7).trim();
            }
            
            // Check if key is the mock decoy or empty
            const isMockKey = apiKey === "N1V4ErGCSlQSLdDrc7vhkSfpf334TgRo";
            if (!apiKey || isMockKey) {
                apiKey = (process.env.MISTRAL_API_KEY || '').trim();
            }

            if (!apiKey) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API key is missing. Set MISTRAL_API_KEY environment variable or configure a custom key in Settings.' }));
                return;
            }

            const options = {
                hostname: 'api.mistral.ai',
                port: 443,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };

            const proxyReq = https.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Proxy connection error: ${err.message}` }));
            });

            proxyReq.write(body);
            proxyReq.end();
        });
        return;
    }

    // Static Files Resolution
    let relativePath = pathname === '/' ? '/demo/index.html' : pathname;
    
    // Check if file is in /demo folder or root folder
    let targetPath = path.join(PUBLIC_DIR, relativePath);
    
    // Security check: ensure path is within PUBLIC_DIR
    if (!targetPath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(targetPath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Try to search inside /demo folder if not in root
            const fallbackPath = path.join(DEMO_DIR, relativePath);
            fs.stat(fallbackPath, (err2, stats2) => {
                if (err2 || !stats2.isFile()) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
                } else {
                    serveFile(res, fallbackPath);
                }
            });
        } else {
            serveFile(res, targetPath);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Tiny AI Proxy Server running at http://localhost:${PORT}`);
});
