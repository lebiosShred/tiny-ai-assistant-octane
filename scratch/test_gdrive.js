/**
 * Google Drive Integration Test Script
 * Runs locally to verify Service Account credentials, list shared files,
 * and test file content extraction.
 */

const fs = require('fs');
const path = require('path');
const gdriveService = require('../gdrive-service');

// Load environment variables if available
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

async function runTest() {
    console.log('==========================================');
    console.log('🧪 Starting Google Drive Integration Test...');
    console.log('==========================================');

    const keyPath = path.join(__dirname, '..', 'credentials', 'google-service-account.json');
    if (!fs.existsSync(keyPath)) {
        console.error(`❌ ERROR: Credentials key not found at: ${keyPath}`);
        console.log('Please verify the credentials file was copied correctly.');
        process.exit(1);
    }

    try {
        const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        console.log(`✓ Credentials file found.`);
        console.log(`  Project ID: ${keyData.project_id}`);
        console.log(`  Service Account: ${keyData.client_email}`);
    } catch (err) {
        console.error(`❌ ERROR: Failed to parse credentials JSON:`, err.message);
        process.exit(1);
    }

    const rootFolderId = process.env.GDRIVE_ROOT_FOLDER_ID;
    console.log(`Target Folder ID (GDRIVE_ROOT_FOLDER_ID): ${rootFolderId || 'Not Configured'}`);
    
    if (!rootFolderId) {
        console.log('\n⚠️ WARNING: GDRIVE_ROOT_FOLDER_ID is not set in environment variables.');
        console.log('We will attempt to test connection by listing the root drive level,');
        console.log('but this may return an empty list if no files have been explicitly shared with this Service Account.');
    }

    try {
        console.log('\n📡 Testing authentication and listing directory contents...');
        const items = await gdriveService.listFolder(rootFolderId);
        console.log(`✓ Connection successful! Retrieved ${items.length} items.`);
        
        if (items.length > 0) {
            console.log('\n--- Directory Contents ---');
            items.forEach((item, index) => {
                const typeLabel = item.isFolder ? '[Folder]' : '[File]  ';
                const sizeLabel = item.isFolder ? '' : ` (${(item.size / 1024).toFixed(1)} KB)`;
                console.log(`${index + 1}. ${typeLabel} ${item.name} (ID: ${item.id})${sizeLabel}`);
            });

            // If we found a file, let's test content reading on the first file
            const firstFile = items.find(item => !item.isFolder);
            if (firstFile) {
                console.log(`\n📄 Testing text extraction for file: "${firstFile.name}" (ID: ${firstFile.id})...`);
                const content = await gdriveService.getFileContent(firstFile.id);
                console.log(`✓ Text extraction completed successfully.`);
                console.log(`--- Content Snippet (first 300 chars) ---`);
                console.log(content.substring(0, 300) + (content.length > 300 ? '...' : ''));
                console.log('-----------------------------------------');
            } else {
                console.log('\nℹ️ No files found in folder to test content extraction. Share a Google Doc or PDF to test.');
            }
        } else {
            console.log('\nℹ️ Folder is empty. Ensure you have shared files/folders with the Service Account email.');
        }

        console.log('\n==========================================');
        console.log('✅ TEST COMPLETE: Integration verified.');
        console.log('==========================================');
    } catch (err) {
        console.error('\n❌ TEST FAILED: Connection or retrieval error:');
        console.error(err.stack || err.message);
        console.log('\nTroubleshooting Checklist:');
        console.log('1. Have you shared your Google Drive folder with the Service Account email?');
        console.log('2. Does the Service Account have "Viewer" permissions on the shared folder?');
        console.log('3. Is the GDRIVE_ROOT_FOLDER_ID correct?');
        console.log('==========================================');
        process.exit(1);
    }
}

runTest();
