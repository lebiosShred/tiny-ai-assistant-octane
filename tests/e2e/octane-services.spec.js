const { test, expect } = require('@playwright/test');

test.describe('Octane Services, Competitors & Complementary Apps Security and Isolation Suite', () => {
    test('verifies Octane Services, Competitors, and Complementary folders are excluded from API GET listing', async ({ request, baseURL }) => {
        const response = await request.get(`${baseURL}/api/knowledge`);
        expect(response.ok()).toBe(true);
        
        const files = await response.json();
        
        // Exclude Octane Services folder
        const containsServices = files.some(file => file.name === 'Octane Services');
        expect(containsServices).toBe(false);

        // Exclude Octane Competitors folder
        const containsCompetitors = files.some(file => file.name === 'Octane Competitors');
        expect(containsCompetitors).toBe(false);

        // Exclude Complementary Applications folder
        const containsComplementary = files.some(file => file.name === 'Complementary Applications');
        expect(containsComplementary).toBe(false);
    });

    test('verifies DELETE requests targeting Octane Services are forbidden', async ({ request, baseURL }) => {
        // Try deleting the folder directly
        const responseFolder = await request.delete(`${baseURL}/api/knowledge?fileName=Octane%20Services`);
        expect(responseFolder.status()).toBe(403);
        const dataFolder = await responseFolder.json();
        expect(dataFolder.error).toBe('Access forbidden.');

        // Try deleting a file inside the folder
        const responseFile = await request.delete(`${baseURL}/api/knowledge?fileName=Octane%20Services/01_about_octane.md`);
        expect(responseFile.status()).toBe(403);
        const dataFile = await responseFile.json();
        dataFile.error ? expect(dataFile.error).toBe('Access forbidden.') : expect(dataFile.error).toBe('Directory traversal forbidden.');
    });

    test('verifies DELETE requests targeting Octane Competitors are forbidden', async ({ request, baseURL }) => {
        // Try deleting the folder directly
        const responseFolder = await request.delete(`${baseURL}/api/knowledge?fileName=Octane%20Competitors`);
        expect(responseFolder.status()).toBe(403);
        const dataFolder = await responseFolder.json();
        expect(dataFolder.error).toBe('Access forbidden.');

        // Try deleting a file inside the folder
        const responseFile = await request.delete(`${baseURL}/api/knowledge?fileName=Octane%20Competitors/competitor_research_plan.md`);
        expect(responseFile.status()).toBe(403);
        const dataFile = await responseFile.json();
        dataFile.error ? expect(dataFile.error).toBe('Access forbidden.') : expect(dataFile.error).toBe('Directory traversal forbidden.');
    });

    test('verifies DELETE requests targeting Complementary Applications are forbidden', async ({ request, baseURL }) => {
        // Try deleting the folder directly
        const responseFolder = await request.delete(`${baseURL}/api/knowledge?fileName=Complementary%20Applications`);
        expect(responseFolder.status()).toBe(403);
        const dataFolder = await responseFolder.json();
        expect(dataFolder.error).toBe('Access forbidden.');

        // Try deleting a file inside the folder
        const responseFile = await request.delete(`${baseURL}/api/knowledge?fileName=Complementary%20Applications/complementary_apps_overview.md`);
        expect(responseFile.status()).toBe(403);
        const dataFile = await responseFile.json();
        dataFile.error ? expect(dataFile.error).toBe('Access forbidden.') : expect(dataFile.error).toBe('Directory traversal forbidden.');
    });
});

