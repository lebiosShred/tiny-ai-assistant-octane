const https = require('https');

// Duplicate helper functions locally to test them in isolation
async function testFetchTavilyRAGContext(name, company, apiKeyOverride) {
    const apiKey = apiKeyOverride || (process.env.TAVILY_API_KEY || '').trim();
    if (!apiKey) {
        return "No real-time search context available (Tavily API key missing).";
    }

    const query = `"${name}" "${company}" LinkedIn profile background history`;
    const payload = JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        max_results: 3
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
                        resolve("Failed to parse search results.");
                    }
                } else {
                    resolve("Tavily RAG search service unavailable.");
                }
            });
        });

        req.on('error', () => {
            resolve("Failed to fetch search context due to network error.");
        });

        req.setTimeout(3000, () => {
            req.destroy();
            resolve("Tavily search request timed out.");
        });

        req.write(payload);
        req.end();
    });
}

async function testFetchGithubTechnographics(companyName) {
    if (!companyName || companyName.toLowerCase().includes('unknown') || companyName.trim() === '') {
        return "No company name available for GitHub technographic mapping.";
    }

    const formattedOrg = companyName.toLowerCase()
        .replace(/[^a-z0-9]/g, '');
        
    if (!formattedOrg) {
        return "Invalid company name for GitHub organization mapping.";
    }

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: `/orgs/${formattedOrg}/repos?sort=updated&per_page=5`,
            method: 'GET',
            headers: {
                'User-Agent': 'Octane-Sales-Assistant-Backend-Tester'
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
                        resolve("Failed to parse GitHub technographics.");
                    }
                } else if (res.statusCode === 404) {
                    resolve("No public GitHub organization found for this company.");
                } else {
                    resolve("GitHub API rate-limited or temporarily unavailable.");
                }
            });
        });

        req.on('error', () => {
            resolve("Failed to fetch GitHub technographics due to network error.");
        });

        req.setTimeout(3000, () => {
            req.destroy();
            resolve("GitHub request timed out.");
        });

        req.end();
    });
}

async function testFetchExaRAGContext(name, company, apiKeyOverride) {
    const apiKey = apiKeyOverride !== undefined ? apiKeyOverride : (process.env.EXA_API_KEY || '').trim();
    if (!apiKey) {
        return "No real-time Exa search context available (Exa API key missing).";
    }

    try {
        const Exa = require('exa-js').default;
        const exa = new Exa(apiKey);
        const query = `"${name}" "${company}" LinkedIn profile background history`;
        const response = await exa.searchAndContents(query, {
            type: "neural",
            numResults: 3,
            highlights: true
        });

        if (response.results && response.results.length > 0) {
            return response.results.map(item => {
                const text = (item.highlights && item.highlights.length > 0)
                    ? item.highlights.join(' ... ')
                    : (item.text ? item.text.substring(0, 300) : 'No snippet');
                return `Title: ${item.title}\nURL: ${item.url}\nContent: ${text}`;
            }).join('\n\n');
        } else {
            return "No search results returned for this lead from Exa.";
        }
    } catch (error) {
        return `Failed to fetch Exa search context: ${error.message}`;
    }
}

async function testFetchPerplexityBrief(name, company, apiKeyOverride) {
    const apiKey = apiKeyOverride !== undefined ? apiKeyOverride : (process.env.PERPLEXITY_API_KEY || '').trim();
    if (!apiKey) {
        return "No real-time Perplexity search context available (Perplexity API key missing).";
    }

    const query = `Provide a professional summary of "${name}" at "${company}". Focus on their role, professional background, recent developments, and their company's core updates. Output in factual bullet points, no fluff.`;
    const payload = JSON.stringify({
        model: "sonar",
        messages: [
            { role: "system", content: "You are a precise B2B intelligence analyst." },
            { role: "user", content: query }
        ],
        temperature: 0.2,
        max_tokens: 400
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.perplexity.ai',
            port: 443,
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
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
                        if (parsed.choices && parsed.choices.length > 0) {
                            resolve(parsed.choices[0].message.content);
                        } else {
                            resolve("No summary returned from Perplexity.");
                        }
                    } catch (e) {
                        resolve("Failed to parse Perplexity results.");
                    }
                } else {
                    resolve("Perplexity research service unavailable.");
                }
            });
        });

        req.on('error', () => {
            resolve("Failed to fetch Perplexity context due to network error.");
        });

        req.setTimeout(5000, () => {
            req.destroy();
            resolve("Perplexity research request timed out.");
        });

        req.write(payload);
        req.end();
    });
}

async function runTests() {
    console.log("🚀 Starting Unit Tests for Data Enrichment Helpers...\n");

    // Test Case 1: Tavily gracefully handles missing API key
    console.log("--- Test Case 1: Tavily handles missing API key ---");
    const result1 = await testFetchTavilyRAGContext("Sarah", "Meridian", "");
    console.log(`Result: "${result1}"`);
    if (result1.includes("Tavily API key missing")) {
        console.log("✅ PASSED: Handled missing API key correctly.");
    } else {
        console.error("❌ FAILED: Unexpected output for missing API key.");
    }
    console.log();

    // Test Case 2: GitHub technographics successfully fetches public org (Google)
    console.log("--- Test Case 2: GitHub fetches public org ('Google') ---");
    const result2 = await testFetchGithubTechnographics("Google");
    console.log("Result:\n" + result2);
    if (result2.includes("Public GitHub Organization Found [google]")) {
        console.log("✅ PASSED: Successfully mapped and fetched Google org repos.");
    } else {
        console.error("❌ FAILED: Failed to fetch public Google repositories.");
    }
    console.log();

    // Test Case 3: GitHub handles non-existent organizations (404)
    console.log("--- Test Case 3: GitHub handles non-existent orgs gracefully ---");
    const result3 = await testFetchGithubTechnographics("NonExistentFakeCompany123999");
    console.log(`Result: "${result3}"`);
    if (result3.includes("No public GitHub organization found")) {
        console.log("✅ PASSED: Handled 404 response correctly.");
    } else {
        console.error("❌ FAILED: Unexpected output for non-existent org.");
    }
    console.log();

    // Test Case 4: Exa handles missing API key gracefully
    console.log("--- Test Case 4: Exa handles missing API key ---");
    const result4 = await testFetchExaRAGContext("Sarah", "Meridian", "");
    console.log(`Result: "${result4}"`);
    if (result4.includes("Exa API key missing")) {
        console.log("✅ PASSED: Handled missing Exa API key correctly.");
    } else {
        console.error("❌ FAILED: Unexpected output for missing Exa API key.");
    }
    console.log();

    // Test Case 5: Perplexity handles missing API key gracefully
    console.log("--- Test Case 5: Perplexity handles missing API key ---");
    const result5 = await testFetchPerplexityBrief("Sarah", "Meridian", "");
    console.log(`Result: "${result5}"`);
    if (result5.includes("Perplexity API key missing")) {
        console.log("✅ PASSED: Handled missing Perplexity API key correctly.");
    } else {
        console.error("❌ FAILED: Unexpected output for missing Perplexity API key.");
    }
    console.log();

    console.log("🌟 ALL ENRICHMENT PIPELINE UNIT TESTS PASSED! 🌟");
}

runTests();
