import https from 'https';
import fs from 'fs';
import path from 'path';

// Helper to read and concatenate knowledge files
function loadKnowledgeBase() {
    return new Promise((resolve) => {
        const knowledgeDir = path.join(process.cwd(), 'knowledge');
        fs.readdir(knowledgeDir, (err, files) => {
            if (err) {
                console.warn("⚠️ Failed to read knowledge directory:", err.message);
                resolve("");
                return;
            }
            const mdFiles = files.filter(f => f.endsWith('.md'));
            if (mdFiles.length === 0) {
                resolve("");
                return;
            }
            
            let concatenated = "\n\n=== GROUNDED KNOWLEDGE BASE ===\n";
            let readCount = 0;
            const contents = {};
            
            // Read files and preserve order
            mdFiles.forEach(file => {
                const filePath = path.join(knowledgeDir, file);
                fs.readFile(filePath, 'utf8', (err2, data) => {
                    readCount++;
                    if (!err2) {
                        contents[file] = data;
                    }
                    if (readCount === mdFiles.length) {
                        mdFiles.forEach(f => {
                            if (contents[f]) {
                                concatenated += `\n--- FILE: ${f} ---\n${contents[f]}\n`;
                            }
                        });
                        resolve(concatenated);
                    }
                });
            });
        });
    });
}

export default async function handler(req, res) {
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

    // Load knowledge base files and inject into the prompt
    const knowledgeBase = await loadKnowledgeBase();
    const payload = req.body;
    
    if (knowledgeBase && Array.isArray(payload.messages)) {
        // Look for system prompt to append knowledge base
        const systemMsg = payload.messages.find(m => m.role === 'system');
        if (systemMsg) {
            systemMsg.content += knowledgeBase;
        } else {
            payload.messages.unshift({
                role: 'system',
                content: `You are a professional B2B sales operations assistant.${knowledgeBase}`
            });
        }
    }

    const jsonPayload = JSON.stringify(payload);

    const options = {
        hostname: 'api.mistral.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(jsonPayload)
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

    proxyReq.write(jsonPayload);
    proxyReq.end();
}

