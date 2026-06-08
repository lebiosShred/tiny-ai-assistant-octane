const { test, expect } = require('@playwright/test');

test.describe('Octane Services Knowledge Base Security and Isolation Suite', () => {
    test('verifies Octane Services folder is excluded from API GET listing', async ({ request, baseURL }) => {
        const response = await request.get(`${baseURL}/api/knowledge`);
        expect(response.ok()).toBe(true);
        
        const files = await response.json();
        // The list should not contain "Octane Services" folder itself
        const containsFolder = files.some(file => file.name === 'Octane Services');
        expect(containsFolder).toBe(false);
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
});
