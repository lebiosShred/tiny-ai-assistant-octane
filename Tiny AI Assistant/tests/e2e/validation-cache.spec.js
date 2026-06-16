const { test, expect } = require('@playwright/test');

test.describe('Zod Validation, Search Caching & Asynchronous Queue Suite', () => {
    
    test('verifies POST /api/history Zod schema validation rules', async ({ request, baseURL }) => {
        // 1. Submit a valid history payload
        const validPayload = {
            type: 'dossier',
            company: 'QA_Test_Company',
            name: 'John Doe',
            email: 'john.doe@test.com',
            phone: '1234567890',
            stage: 'prep'
        };
        const resValid = await request.post(`${baseURL}/api/history`, { data: validPayload });
        expect(resValid.ok()).toBe(true);
        const dataValid = await resValid.json();
        expect(dataValid.status).toBe('success');
        expect(dataValid.id).toBeDefined();

        // 2. Submit an invalid history payload (missing type and company)
        const invalidPayload1 = {
            name: 'John Doe',
            email: 'john.doe@test.com'
        };
        const resInvalid1 = await request.post(`${baseURL}/api/history`, { data: invalidPayload1 });
        expect(resInvalid1.status()).toBe(400);
        const dataInvalid1 = await resInvalid1.json();
        expect(dataInvalid1.error).toBe('Schema validation failed.');
        expect(dataInvalid1.details).toContain('type: Type is required');
        expect(dataInvalid1.details).toContain('company: Company is required');

        // 3. Submit a payload with invalid email format
        const invalidPayload2 = {
            type: 'dossier',
            company: 'QA_Test_Company',
            email: 'not-an-email'
        };
        const resInvalid2 = await request.post(`${baseURL}/api/history`, { data: invalidPayload2 });
        expect(resInvalid2.status()).toBe(400);
        const dataInvalid2 = await resInvalid2.json();
        expect(dataInvalid2.error).toBe('Schema validation failed.');
        expect(dataInvalid2.details).toContain('email: Invalid email address format');

        // Clean up the created valid history file to keep env pristine
        if (dataValid.id) {
            await request.delete(`${baseURL}/api/history?id=${dataValid.id}`);
        }
    });

    test('verifies search caching and async search queue with status polling', async ({ request, baseURL }) => {
        const query = 'qa_test_search_query';

        // 1. Verify synchronous search endpoint completes successfully
        const resSync = await request.get(`${baseURL}/api/search?q=${query}`);
        expect(resSync.ok()).toBe(true);
        const dataSync = await resSync.json();
        expect(dataSync.results).toBeDefined();

        // 2. Verify async search queue endpoint accepts and queues the job
        const resAsync = await request.get(`${baseURL}/api/search?q=${query}&async=true`);
        expect(resAsync.status()).toBe(202);
        const dataAsync = await resAsync.json();
        expect(dataAsync.status).toBe('queued');
        expect(dataAsync.jobId).toBeDefined();

        // 3. Verify status polling endpoint returns job status/results
        let status = 'queued';
        let statusData = null;
        const startTime = Date.now();
        const timeout = 10000; // 10s max timeout

        while (status !== 'completed' && status !== 'failed' && (Date.now() - startTime < timeout)) {
            const resStatus = await request.get(`${baseURL}/api/search/status?jobId=${dataAsync.jobId}`);
            expect(resStatus.ok()).toBe(true);
            statusData = await resStatus.json();
            status = statusData.status;
            if (status !== 'completed' && status !== 'failed') {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        expect(status).toBe('completed');
        expect(statusData.result).toBeDefined();
    });

});
