const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const KEY_FILE_PATH = path.join(__dirname, '..', 'credentials', 'google-service-account.json');

async function run() {
    console.log('=====================================================');
    console.log('🔍 Running Google Drive Permissions Diagnostics...');
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
        console.log('📡 Requesting list of all shared items...');
        const response = await drive.files.list({
            pageSize: 100,
            fields: 'files(id, name, mimeType, parents)'
        });
        const files = response.data.files || [];
        console.log(`✓ Access check successful. Visible item count: ${files.length}`);
        
        if (files.length > 0) {
            console.log('\n--- Visible Files & Folders ---');
            files.forEach((f, idx) => {
                const type = f.mimeType === 'application/vnd.google-apps.folder' ? '[Folder]' : '[File]  ';
                console.log(`${idx + 1}. ${type} Name: "${f.name}"`);
                console.log(`   ID:   "${f.id}"`);
                console.log(`   MIME: "${f.mimeType}"`);
                console.log(`   Parents: ${JSON.stringify(f.parents || [])}`);
                console.log('---');
            });
        } else {
            console.log('\n⚠️ No items are currently visible to this service account.');
            console.log('Ensure you have explicitly shared files or folders with:');
            console.log('📧 28323029503-compute@developer.gserviceaccount.com');
        }
    } catch (err) {
        console.error('❌ Error querying Drive files:', err.message);
    }
    console.log('=====================================================');
}

run();
