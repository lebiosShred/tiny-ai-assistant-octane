const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Ingestion-Time RAG Synthesis Companion File Resolution Suite', () => {
    const historyDir = path.resolve(__dirname, '../../knowledge/history_test');
    const companyFolder = path.join(historyDir, 'TestCompany');
    const pdfPath = path.join(companyFolder, 'sarah_chen.pdf');
    const companionPath = path.join(companyFolder, 'sarah_chen.pdf.txt');

    test.beforeAll(() => {
        // Ensure folders and mock files exist
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }
        if (!fs.existsSync(companyFolder)) {
            fs.mkdirSync(companyFolder, { recursive: true });
        }

        // Write mock files
        fs.writeFileSync(pdfPath, 'Fake PDF raw binary content', 'utf8');
        fs.writeFileSync(companionPath, 'Structured Profile: Sarah Chen at Department of Responsible Gambling', 'utf8');
    });

    test.afterAll(() => {
        // Cleanup mock files
        try {
            if (fs.existsSync(companionPath)) fs.unlinkSync(companionPath);
            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
            if (fs.existsSync(companyFolder)) fs.rmdirSync(companyFolder);
        } catch (err) {
            console.warn('Cleanup failed:', err.message);
        }
    });

    test('successfully resolves companion summary file instead of raw PDF text', async ({ request, baseURL }) => {
        // Call the API endpoint to read the file using local file ID format
        const fileId = 'local_TestCompany_sarah_chen.pdf';
        const response = await request.get(`${baseURL}/api/gdrive/read?fileId=${fileId}`);
        
        expect(response.ok()).toBe(true);
        const data = await response.json();
        
        // Assert the returned content is the structured summary content, not the raw PDF text
        expect(data.content).toBe('Structured Profile: Sarah Chen at Department of Responsible Gambling');
    });
});
