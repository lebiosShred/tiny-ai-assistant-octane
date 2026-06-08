const https = require('https');
const Exa = require('exa-js').default;

function isTestEnrichment(name, company) {
    const isTestDir = process.env.HISTORY_DIR && process.env.HISTORY_DIR.includes('history_test');
    if (isTestDir) return true;
    const n = (name || '').toLowerCase();
    const c = (company || '').toLowerCase();
    return n.includes('qa_') || n.includes('test') || c.includes('qa_') || c.includes('test') || c.includes('meridian');
}

function searchWeb(query) {
    if (isTestEnrichment('', query)) {
        console.log(`🌐 Mocking web search for test query: "${query}"`);
        return Promise.resolve(`Source: Mock Search Result (https://mock.com)\nContent: This is mock search data for query: "${query}". Competitor details or technographics are simulated for testing.`);
    }
    return new Promise((resolve) => {
        const apiKey = (process.env.TAVILY_API_KEY || '').trim();
        if (!apiKey) {
            console.warn("⚠️ TAVILY_API_KEY is not configured.");
            resolve("");
            return;
        }

        const payload = JSON.stringify({
            api_key: apiKey,
            query: query,
            search_depth: "basic",
            include_answer: false,
            max_results: 3
        });

        const options = {
            hostname: 'api.tavily.com',
            port: 443,
            path: '/search',
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error(`⚠️ Tavily API returned status ${res.statusCode}: ${resBody}`);
                    resolve("");
                    return;
                }
                try {
                    const data = JSON.parse(resBody);
                    if (!data.results || !Array.isArray(data.results)) {
                        resolve("");
                        return;
                    }
                    const formatted = data.results.map(r => `Source: ${r.title} (${r.url})\nContent: ${r.content}\n`).join("\n");
                    resolve(formatted);
                } catch (e) {
                    console.error("⚠️ Failed to parse Tavily API response:", e);
                    resolve("");
                }
            });
        });

        req.on('error', (err) => {
            console.error("⚠️ Tavily request error:", err);
            resolve("");
        });

        req.setTimeout(8000, () => {
            console.warn("⚠️ Tavily searchWeb request timed out.");
            req.destroy();
            resolve("");
        });

        req.write(payload);
        req.end();
    });
}

async function fetchTavilyRAGContext(name, company) {
    if (isTestEnrichment(name, company)) {
        console.log(`🌐 Mocking Tavily RAG search for: "${name}" at "${company}"`);
        return `Title: Mock LinkedIn Profile\nURL: https://linkedin.com/mock\nContent: Mock background history for ${name} at ${company}. Experienced financial planning and scheduling lead. Circular circular circular updates. Circular economy Circular circular circular updates. Circular economy circular circular updates circular. Circular circular circular. circular circular. circular. circular circular circular circular circular.`;
    }
    const apiKey = (process.env.TAVILY_API_KEY || '').trim();
    if (!apiKey) {
        console.warn("⚠️ TAVILY_API_KEY is not configured on the server. Skipping RAG search.");
        return "No real-time search context available (Tavily API key missing).";
    }

    const query = `"${name}" "${company}" LinkedIn profile background history`;
    const payload = JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "advanced",
        max_results: 5
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.tavily.com',
            port: 443,
            path: '/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.results && parsed.results.length > 0) {
                            const formatted = parsed.results.map(item => 
                                `Title: ${item.title}\nURL: ${item.url}\nContent: ${item.content}`
                            ).join('\n\n');
                            resolve(formatted);
                        } else {
                            resolve("No search results returned for this lead.");
                        }
                    } catch (e) {
                        console.error("⚠️ Failed to parse Tavily API response:", e.message);
                        resolve("Failed to parse search results.");
                    }
                } else {
                    console.error(`⚠️ Tavily API returned status ${res.statusCode}: ${data}`);
                    resolve("Tavily RAG search service unavailable.");
                }
            });
        });

        req.on('error', (err) => {
            console.error("❌ Tavily request failed:", err.message);
            resolve("Failed to fetch search context due to network error.");
        });

        req.setTimeout(15000, () => {
            console.warn("⚠️ Tavily request timed out.");
            req.destroy();
            resolve("Tavily search request timed out.");
        });

        req.write(payload);
        req.end();
    });
}

async function fetchTavilyCompanyNews(company, website) {
    if (isTestEnrichment('', company)) {
        console.log(`🌐 Mocking Tavily Company News for: "${company}"`);
        return `Title: Mock Company News\nURL: https://mocknews.com\nContent: Mock news updates for ${company}. Standard updates and product launches. circular circular. circular. circular circular circular circular circular.`;
    }
    const apiKey = (process.env.TAVILY_API_KEY || '').trim();
    if (!apiKey) {
        console.warn("⚠️ TAVILY_API_KEY is not configured on the server. Skipping company updates search.");
        return "No real-time company search context available (Tavily API key missing).";
    }

    let query = `"${company}" company recent news updates press releases 2025 2026`;
    const payload = JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "advanced",
        max_results: 6
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.tavily.com',
            port: 443,
            path: '/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.results && parsed.results.length > 0) {
                            const formatted = parsed.results.map(item => 
                                `Title: ${item.title}\nURL: ${item.url}\nContent: ${item.content}`
                            ).join('\n\n');
                            resolve(formatted);
                        } else {
                            resolve("No news updates returned for this company.");
                        }
                    } catch (e) {
                        console.error("⚠️ Failed to parse Tavily news response:", e.message);
                        resolve("Failed to parse company updates.");
                    }
                } else {
                    console.error(`⚠️ Tavily news API returned status ${res.statusCode}: ${data}`);
                    resolve("Tavily news service unavailable.");
                }
            });
        });

        req.on('error', (err) => {
            console.error("❌ Tavily company search request failed:", err.message);
            resolve("Failed to fetch company search context due to network error.");
        });

        req.setTimeout(15000, () => {
            console.warn("⚠️ Tavily company search request timed out.");
            req.destroy();
            resolve("Tavily company search request timed out.");
        });

        req.write(payload);
        req.end();
    });
}

async function fetchGithubTechnographics(companyName) {
    if (!companyName || companyName.toLowerCase().includes('unknown') || companyName.trim() === '') {
        return "No company name available for GitHub technographic mapping.";
    }

    const formattedOrg = companyName.toLowerCase()
        .replace(/[^a-z0-9]/g, '');
        
    if (!formattedOrg) {
        return "Invalid company name for GitHub organization mapping.";
    }

    const githubPat = (process.env.GITHUB_PAT || '').trim();

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: `/orgs/${formattedOrg}/repos?sort=updated&per_page=5`,
            method: 'GET',
            headers: {
                'User-Agent': 'Octane-Sales-Assistant-Backend',
                ...(githubPat && { 'Authorization': `token ${githubPat}` })
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const repos = JSON.parse(data);
                        if (Array.isArray(repos) && repos.length > 0) {
                            const repoDetails = repos.map(r => 
                                `- Repo: ${r.name} | Primary Language: ${r.language || 'Unspecified'} | Description: ${r.description || 'None provided'}`
                            ).join('\n');
                            resolve(`Public GitHub Organization Found [${formattedOrg}]:\n${repoDetails}`);
                        } else {
                            resolve("GitHub organization exists but has no public repositories.");
                        }
                    } catch (e) {
                        console.error("⚠️ Failed to parse GitHub API response:", e.message);
                        resolve("Failed to parse GitHub technographics.");
                    }
                } else if (res.statusCode === 404) {
                    resolve("No public GitHub organization found for this company.");
                } else {
                    console.error(`⚠️ GitHub API returned status ${res.statusCode}: ${data}`);
                    resolve("GitHub API rate-limited or temporarily unavailable.");
                }
            });
        });

        req.on('error', (err) => {
            console.error("❌ GitHub request failed:", err.message);
            resolve("Failed to fetch GitHub technographics due to network error.");
        });

        req.setTimeout(10000, () => {
            console.warn("⚠️ GitHub request timed out.");
            req.destroy();
            resolve("GitHub request timed out.");
        });

        req.end();
    });
}

async function fetchExaRAGContext(name, company) {
    if (isTestEnrichment(name, company)) {
        console.log(`🌐 Mocking Exa RAG search for: "${name}" at "${company}"`);
        return `Title: Mock Exa Search\nURL: https://exa.ai/mock\nContent: Mock Exa search content for ${name} at ${company}.`;
    }
    const apiKey = (process.env.EXA_API_KEY || '').trim();
    if (!apiKey) {
        console.warn("⚠️ EXA_API_KEY is not configured on the server. Skipping Exa RAG search.");
        return "No real-time Exa search context available (Exa API key missing).";
    }

    const query = `"${name}" "${company}" LinkedIn profile background history`;
    try {
        const exa = new Exa(apiKey);
        console.log(`🌐 Performing Exa semantic search for: ${query}`);
        const response = await Promise.race([
            exa.searchAndContents(query, {
                type: "neural",
                numResults: 5,
                highlights: true
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000))
        ]);

        if (response.results && response.results.length > 0) {
            const formatted = response.results.map(item => {
                const text = (item.highlights && item.highlights.length > 0)
                    ? item.highlights.join(' ... ')
                    : (item.text ? item.text.substring(0, 300) : 'No snippet');
                return `Title: ${item.title}\nURL: ${item.url}\nContent: ${text}`;
            }).join('\n\n');
            return formatted;
        } else {
            return "No search results returned for this lead from Exa.";
        }
    } catch (error) {
        console.error("❌ Exa RAG search failed:", error.message);
        return `Failed to fetch Exa search context: ${error.message}`;
    }
}

module.exports = {
    searchWeb,
    fetchTavilyRAGContext,
    fetchTavilyCompanyNews,
    fetchGithubTechnographics,
    fetchExaRAGContext
};
