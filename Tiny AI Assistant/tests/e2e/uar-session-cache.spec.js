const { test, expect } = require('@playwright/test');

test.describe('Aegis Backend Asynchronous Session Cache-Aside Suite', () => {

    test('verifies GET /api/history returns valid sessions without crashing', async ({ request }) => {
        const response = await request.get('/api/history');
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(Array.isArray(body)).toBeTruthy();
    });

    test('verifies full session lifecycle via API (POST, PATCH stage, PATCH title, GET detail, DELETE)', async ({ request }) => {
        const uniqueId = `qa_test_session_${Date.now()}`;
        const newSessionPayload = {
            id: uniqueId,
            type: 'dossier',
            date: new Date().toISOString(),
            name: 'QA Test Agent',
            company: 'QA Cache-Aside LLC',
            title: 'QA Systems Engineer',
            track: 'AI',
            intakeAnswers: 'Some answers'
        };

        // 1. Create session via POST /api/history
        const postRes = await request.post('/api/history', {
            data: newSessionPayload
        });
        expect(postRes.ok()).toBeTruthy();
        const postData = await postRes.json();
        expect(postData.status).toBe('success');

        // 2. Retrieve session via GET /api/history/detail
        const detailRes = await request.get(`/api/history/detail?id=${uniqueId}`);
        expect(detailRes.ok()).toBeTruthy();
        const detailData = await detailRes.json();
        expect(detailData.company).toBe('QA Cache-Aside LLC');

        // 3. Update stage via PATCH /api/history/stage
        const stageRes = await request.patch('/api/history/stage', {
            data: { id: uniqueId, stage: 'reports' }
        });
        expect(stageRes.ok()).toBeTruthy();
        const stageData = await stageRes.json();
        expect(stageData.status).toBe('success');

        // Verify stage update in details
        const detailRes2 = await request.get(`/api/history/detail?id=${uniqueId}`);
        const detailData2 = await detailRes2.json();
        expect(detailData2.stage).toBe('reports');

        // 4. Update title via PATCH /api/history/title
        const titleRes = await request.patch('/api/history/title', {
            data: { id: uniqueId, title: 'Updated Title' }
        });
        expect(titleRes.ok()).toBeTruthy();
        const titleData = await titleRes.json();
        expect(titleData.status).toBe('success');

        // Verify title update in details
        const detailRes3 = await request.get(`/api/history/detail?id=${uniqueId}`);
        const detailData3 = await detailRes3.json();
        expect(detailData3.title).toBe('Updated Title');

        // 5. Delete session via DELETE /api/history
        const deleteRes = await request.delete(`/api/history?id=${uniqueId}`);
        expect(deleteRes.ok()).toBeTruthy();
        const deleteData = await deleteRes.json();
        expect(deleteData.status).toBe('success');

        // 6. Verify session is no longer found
        const detailRes4 = await request.get(`/api/history/detail?id=${uniqueId}`);
        expect(detailRes4.status()).toBe(404);
    });
});
