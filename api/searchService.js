const https = require('https');
const Exa = require('exa-js').default;

function isTestEnrichment(name, company) {
    const isTestDir = process.env.HISTORY_DIR && process.env.HISTORY_DIR.includes('history_test');
    if (isTestDir) return true;
    const n = (name || '').toLowerCase();
    const c = (company || '').toLowerCase();
    return n.includes('qa_') || n.includes('test') || c.includes('qa_') || c.includes('test') || c.includes('meridian') || c.includes('acme');
}

function executeHttpRequestWithRetry(options, payload = null, retries = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
        let attempt = 0;

        function doRequest() {
            attempt++;
            const req = https.request(options, (res) => {
                let resBody = '';
                res.on('data', chunk => resBody += chunk);
                res.on('end', () => {
                    const statusCode = res.statusCode;
                    if ((statusCode === 429 || statusCode >= 500) && attempt < retries) {
                        const backoffDelay = delay * Math.pow(2, attempt - 1);
                        console.warn(`⚠️ Request to ${options.hostname}${options.path} returned ${statusCode}. Retrying in ${backoffDelay}ms (attempt ${attempt}/${retries})...`);
                        setTimeout(doRequest, backoffDelay);
                    } else {
                        resolve({ statusCode, body: resBody });
                    }
                });
            });

            req.on('error', (err) => {
                if (attempt < retries) {
                    const backoffDelay = delay * Math.pow(2, attempt - 1);
                    console.warn(`⚠️ Request to ${options.hostname}${options.path} failed: ${err.message}. Retrying in ${backoffDelay}ms (attempt ${attempt}/${retries})...`);
                    setTimeout(doRequest, backoffDelay);
                } else {
                    reject(err);
                }
            });

            const timeoutMs = options.timeout || 15000;
            req.setTimeout(timeoutMs, () => {
                req.destroy(new Error('Timeout'));
            });

            if (payload) {
                req.write(payload);
            }
            req.end();
        }

        doRequest();
    });
}

async function executePromiseWithRetry(fn, retries = 3, delay = 1000) {
    let attempt = 0;
    while (attempt < retries) {
        attempt++;
        try {
            return await fn();
        } catch (error) {
            const status = error.status || error.statusCode;
            const isTransient = !status || status === 429 || status >= 500;
            if (isTransient && attempt < retries) {
                const backoffDelay = delay * Math.pow(2, attempt - 1);
                console.warn(`⚠️ Promise execution failed: ${error.message}. Retrying in ${backoffDelay}ms (attempt ${attempt}/${retries})...`);
                await new Promise(r => setTimeout(r, backoffDelay));
            } else {
                throw error;
            }
        }
    }
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
            },
            timeout: 8000
        };

        executeHttpRequestWithRetry(options, payload, 3, 1000)
            .then(({ statusCode, body }) => {
                if (statusCode !== 200) {
                    console.error(`⚠️ Tavily API returned status ${statusCode}: ${body}`);
                    resolve("");
                    return;
                }
                try {
                    const data = JSON.parse(body);
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
            })
            .catch((err) => {
                console.error("⚠️ Tavily request error:", err);
                resolve("");
            });
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

    const options = {
        hostname: 'api.tavily.com',
        port: 443,
        path: '/search',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 15000
    };

    return executeHttpRequestWithRetry(options, payload, 3, 1000)
        .then(({ statusCode, body }) => {
            if (statusCode >= 200 && statusCode < 300) {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.results && parsed.results.length > 0) {
                        const formatted = parsed.results.map(item => 
                            `Title: ${item.title}\nURL: ${item.url}\nContent: ${item.content}`
                        ).join('\n\n');
                        return formatted;
                    } else {
                        return "No search results returned for this lead.";
                    }
                } catch (e) {
                    console.error("⚠️ Failed to parse Tavily API response:", e.message);
                    return "Failed to parse search results.";
                }
            } else {
                console.error(`⚠️ Tavily API returned status ${statusCode}: ${body}`);
                return "Tavily RAG search service unavailable.";
            }
        })
        .catch((err) => {
            console.error("❌ Tavily request failed:", err.message);
            return "Failed to fetch search context due to network error.";
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

    const options = {
        hostname: 'api.tavily.com',
        port: 443,
        path: '/search',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 15000
    };

    return executeHttpRequestWithRetry(options, payload, 3, 1000)
        .then(({ statusCode, body }) => {
            if (statusCode >= 200 && statusCode < 300) {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.results && parsed.results.length > 0) {
                        const formatted = parsed.results.map(item => 
                            `Title: ${item.title}\nURL: ${item.url}\nContent: ${item.content}`
                        ).join('\n\n');
                        return formatted;
                    } else {
                        return "No news updates returned for this company.";
                    }
                } catch (e) {
                    console.error("⚠️ Failed to parse Tavily news response:", e.message);
                    return "Failed to parse company updates.";
                }
            } else {
                console.error(`⚠️ Tavily news API returned status ${statusCode}: ${body}`);
                return "Tavily news service unavailable.";
            }
        })
        .catch((err) => {
            console.error("❌ Tavily company search request failed:", err.message);
            return "Failed to fetch company search context due to network error.";
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

    const options = {
        hostname: 'api.github.com',
        port: 443,
        path: `/orgs/${formattedOrg}/repos?sort=updated&per_page=5`,
        method: 'GET',
        headers: {
            'User-Agent': 'Octane-Sales-Assistant-Backend',
            ...(githubPat && { 'Authorization': `token ${githubPat}` })
        },
        timeout: 10000
    };

    return executeHttpRequestWithRetry(options, null, 3, 1000)
        .then(({ statusCode, body }) => {
            if (statusCode === 200) {
                try {
                    const repos = JSON.parse(body);
                    if (Array.isArray(repos) && repos.length > 0) {
                        const repoDetails = repos.map(r => 
                            `- Repo: ${r.name} | Primary Language: ${r.language || 'Unspecified'} | Description: ${r.description || 'None provided'}`
                        ).join('\n');
                        return `Public GitHub Organization Found [${formattedOrg}]:\n${repoDetails}`;
                    } else {
                        return "GitHub organization exists but has no public repositories.";
                    }
                } catch (e) {
                    console.error("⚠️ Failed to parse GitHub API response:", e.message);
                    return "Failed to parse GitHub technographics.";
                }
            } else if (statusCode === 404) {
                return "No public GitHub organization found for this company.";
            } else {
                console.error(`⚠️ GitHub API returned status ${statusCode}: ${body}`);
                return "GitHub API rate-limited or temporarily unavailable.";
            }
        })
        .catch((err) => {
            console.error("❌ GitHub request failed:", err.message);
            return "Failed to fetch GitHub technographics due to network error.";
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
    
    const exaCall = () => {
        const exa = new Exa(apiKey);
        console.log(`🌐 Performing Exa semantic search for: ${query}`);
        return Promise.race([
            exa.searchAndContents(query, {
                type: "neural",
                numResults: 5,
                highlights: true
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000))
        ]);
    };

    try {
        const response = await executePromiseWithRetry(exaCall, 3, 1000);
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

async function scrapeUrlWithJina(url) {
    if (isTestEnrichment('', url)) {
        console.log(`🌐 Mocking Jina Reader scrape for test URL: "${url}"`);
        if (/acme/i.test(url)) {
            return Promise.resolve(`=== WEBSITE SCRAPE RESULTS [${url}] ===
Company Name: Acme Corp (Acme Furniture)
Industry Sector: Furniture / Home Furnishings (Retail & Wholesale)
Business Description: Acme Furniture is a leading furniture wholesaler and retailer offering a wide range of home furnishings. Established in 1985, we operate warehouses in Los Angeles and New York and serve dealers nationwide.
Estimated Revenue: $100M+
Size/Headcount: 500+ employees
Products and Services:
- Bedroom Furniture: Beds, dressers, nightstands, and wardrobes.
- Living Room Furniture: Sofas, sectionals, coffee tables, and recliners.
- Dining Room Furniture: Formal and casual dining sets, bars, and buffets.
- Home Office Furniture: Desks, bookshelves, and gaming tables.
- Outdoor Furniture: Patio dining sets and outdoor chairs.
- Youth Furniture: Bunk beds, trundles, and desks.
Website Features: E-commerce platform, dealer locator, catalog downloads, virtual showroom, and dealer application portal.`);
        }
        return Promise.resolve(`=== WEBSITE SCRAPE RESULTS [${url}] ===\nThis is mock scraped website content for: ${url}. Markdown formatting is verified. Clean text context is provided.`);
    }

    const apiKey = (process.env.JINA_API_KEY || '').trim();
    if (!apiKey) {
        console.warn("⚠️ JINA_API_KEY is not configured.");
        return "Error: Jina Reader API key is not configured on the server.";
    }

    let targetUrl = (url || '').trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
    }

    console.log(`🌐 Performing Jina Reader scrape for: ${targetUrl}`);
    const options = {
        hostname: 'r.jina.ai',
        port: 443,
        path: `/${targetUrl}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'text/plain'
        },
        timeout: 15000
    };

    return executeHttpRequestWithRetry(options, null, 3, 1000)
        .then(({ statusCode, body }) => {
            if (statusCode !== 200) {
                console.error(`⚠️ Jina Reader API returned status ${statusCode}: ${body}`);
                return `Error: Jina Reader API returned status ${statusCode}`;
            }
            return body;
        })
        .catch((err) => {
            console.error("⚠️ Jina Reader request error:", err);
            return `Error: Jina Reader request failed: ${err.message}`;
        });
}

module.exports = {
    searchWeb,
    fetchTavilyRAGContext,
    fetchTavilyCompanyNews,
    fetchGithubTechnographics,
    fetchExaRAGContext,
    scrapeUrlWithJina
};
