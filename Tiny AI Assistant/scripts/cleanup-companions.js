require('dotenv').config();
const gdriveService = require('../gdrive-service');

async function cleanupCompanions() {
    console.log('🧹 Starting Google Drive companion files cleanup...');
    try {
        const drive = gdriveService.getDriveClient();
        if (!drive) {
            console.error('❌ Failed to initialize Google Drive client.');
            return;
        }

        console.log('Listing text/plain files from Google Drive...');
        const res = await drive.files.list({
            q: "mimeType = 'text/plain' and trashed = false",
            fields: 'files(id, name, parents)',
            pageSize: 1000
        });

        const files = res.data.files || [];
        console.log(`Found ${files.length} text files total. Filtering for companion files...`);

        const companionFiles = files.filter(f => {
            const name = f.name.toLowerCase();
            return name.endsWith('.pdf.txt') || name.endsWith('.txt.txt') || name.endsWith('.docx.txt') || name.endsWith('.md.txt');
        });

        console.log(`Identified ${companionFiles.length} companion files to purge.`);

        for (const file of companionFiles) {
            console.log(`Deleting companion file: "${file.name}" (ID: ${file.id})...`);
            try {
                await gdriveService.deleteFile(file.id);
                console.log(`✅ Deleted: ${file.name}`);
            } catch (delErr) {
                console.error(`❌ Failed to delete ${file.name}:`, delErr.message);
            }
            // Add a small delay between requests to stay under rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log('🎉 Google Drive companion files cleanup complete.');
    } catch (err) {
        console.error('❌ Cleanup companions failed:', err);
    }
}

cleanupCompanions();
