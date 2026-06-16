import re

def clean_server(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Remove sseClients
    content = re.sub(r'const sseClients = new Set\(\);\n', '', content)
    
    # Remove broadcastSDRAlert definition
    content = re.sub(r'function broadcastSDRAlert\(data\) \{.*?\}\n', '', content, flags=re.DOTALL)
    
    # Remove /api/alerts/stream endpoint
    # Find exact bounds or use regex
    # The endpoint starts with: // API Alerts SSE Stream Route
    content = re.sub(r'    // API Alerts SSE Stream Route\n    if \(pathname === \'/api/alerts/stream\' && req\.method === \'GET\'\) \{.*?    \}\n', '', content, flags=re.DOTALL)
    
    # Remove broadcastSDRAlert call in POST /api/history
    content = re.sub(r'                                // Push real-time alert event \(STILL broadcast even if Drive upload failed, leveraging server-side fallback\)\n.*?                                \}\);\n', '', content, flags=re.DOTALL)

    # Clean up the `if (pathname.startsWith('/api/') && pathname !== '/api/alerts/stream') {` to just `if (pathname.startsWith('/api/')) {`
    content = content.replace("pathname !== '/api/alerts/stream'", "true")
    
    with open('server_clean.js', 'w', encoding='utf-8') as f:
        f.write(content)

clean_server('server.js')
