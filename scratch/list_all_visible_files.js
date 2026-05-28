const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const KEY_FILE_PATH = path.join(__dirname, '..', 'credentials', 'google-service-account.json');

async function run() {
    console.log('=====================================================');
    console.log('🔍 Listing All Files and Folders Shared with Service Account...');
    console.log('=====================================================');

    if (!fs.existsSync(KEY_FILE_PATH)) {
        console.error('❌ Credentials key not found.');
        return;
    }

    const auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE_PATH,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    const drive = google.drive({ version: 'v3', auth });

    try {
        console.log('📡 Requesting full list of items...');
        const response = await drive.files.list({
            pageSize: 100,
            fields: 'files(id, name, mimeType, parents, size)'
        });
        const files = response.data.files || [];
        console.log(`✓ Retrieved ${files.length} items.`);
        
        files.forEach((f, idx) => {
            const type = f.mimeType === 'application/vnd.google-apps.folder' ? '[Folder]' : '[File]  ';
            const sizeLabel = f.size ? ` (${(parseInt(f.size) / 1024).toFixed(1)} KB)` : '';
            console.log(`${idx + 1}. ${type} Name: "${f.name}"`);
            console.log(`   ID:   "${f.id}"`);
            console.log(`   MIME: "${f.mimeType}"${sizeLabel}`);
            console.log(`   Parents: ${JSON.stringify(f.parents || [])}`);
            console.log('---');
        });
    } catch (err) {
        console.error('❌ Error listing files:', err.message);
    }
    console.log('=====================================================');
}

run();
