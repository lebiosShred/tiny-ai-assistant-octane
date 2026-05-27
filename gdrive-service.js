const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const pdfParse = require('pdf-parse');

// Load environment variables if dotenv is available (local dev)
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config();
}

const KEY_FILE_PATH = path.join(__dirname, 'credentials', 'google-service-account.json');
let driveClient = null;

// Initialize Google Drive API client
function getDriveClient() {
    if (driveClient) {
        return driveClient;
    }

    if (!fs.existsSync(KEY_FILE_PATH)) {
        console.warn(`⚠️ Google Drive Service Account key not found at: ${KEY_FILE_PATH}. Real GDrive API calls will fail.`);
        return null;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });

        driveClient = google.drive({ version: 'v3', auth });
        console.log('✅ Google Drive API client initialized successfully.');
        return driveClient;
    } catch (err) {
        console.error('❌ Failed to initialize Google Drive API client:', err);
        return null;
    }
}

/**
 * Lists files and folders immediately inside a parent folder ID.
 * @param {string} folderId Google Drive Folder ID
 * @returns {Promise<Array>} List of file objects
 */
async function listFolder(folderId) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    // Default to root if folderId is not specified
    const targetFolderId = folderId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root';

    try {
        const response = await drive.files.list({
            q: `'${targetFolderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, parents)',
            orderBy: 'folder,name',
            pageSize: 100
        });

        const files = response.data.files || [];
        return files.map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            isFolder: file.mimeType === 'application/vnd.google-apps.folder',
            size: file.size ? parseInt(file.size, 10) : 0,
            parents: file.parents
        }));
    } catch (err) {
        console.error(`❌ Error listing folder ${targetFolderId}:`, err.message);
        throw err;
    }
}

/**
 * Extracts text content from a Google Drive file by ID.
 * Supports Google Docs, Google Sheets, PDF files, and plain text files.
 * @param {string} fileId Google Drive File ID
 * @returns {Promise<string>} Extracted text content
 */
async function getFileContent(fileId) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    try {
        // 1. Get file metadata to check mimeType
        const metadataResponse = await drive.files.get({
            fileId: fileId,
            fields: 'name,mimeType'
        });

        const { name, mimeType } = metadataResponse.data;
        console.log(`📄 Fetching content for file: "${name}" (${mimeType})`);

        // 2. Export or download based on mimeType
        if (mimeType === 'application/vnd.google-apps.document') {
            // Google Doc: export as plain text
            const exportResponse = await drive.files.export({
                fileId: fileId,
                mimeType: 'text/plain'
            }, { responseType: 'text' });
            return exportResponse.data;
        } 
        
        if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            // Google Sheet: export as CSV
            const exportResponse = await drive.files.export({
                fileId: fileId,
                mimeType: 'text/csv'
            }, { responseType: 'text' });
            return exportResponse.data;
        }

        if (mimeType === 'application/pdf') {
            // PDF file: download as arrayBuffer, then parse text
            const downloadResponse = await drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'arraybuffer' });

            const buffer = Buffer.from(downloadResponse.data);
            const data = await pdfParse(buffer);
            return data.text;
        }

        // Generic text files (txt, csv, logs, etc.)
        if (mimeType.startsWith('text/') || mimeType === 'application/json' || name.endsWith('.txt') || name.endsWith('.md')) {
            const downloadResponse = await drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'text' });
            return downloadResponse.data;
        }

        // Return basic metadata warning for unsupported binary formats
        return `[Metadata Only] File: ${name}\nFormat: ${mimeType}\nContent extraction is not supported for this file type.`;
    } catch (err) {
        console.error(`❌ Error retrieving file content for ${fileId}:`, err.message);
        throw err;
    }
}

/**
 * Searches for files containing a specific query string.
 * Because the service account only has access to files shared with it, 
 * this naturally scopes the search to the relevant shared client folders.
 * @param {string} query Search keyword
 * @param {string} rootFolderId Optional root folder constraint
 * @returns {Promise<Array>} List of matching files
 */
async function searchFiles(query, rootFolderId) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    if (!query) {
        return [];
    }

    try {
        // Clean query to avoid injection/syntax errors in Drive search
        const escapedQuery = query.replace(/'/g, "\\'");
        
        // Search by name or fullText containing the query
        let qString = `(name contains '${escapedQuery}' or fullText contains '${escapedQuery}') and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
        
        const response = await drive.files.list({
            q: qString,
            fields: 'files(id, name, mimeType, size)',
            pageSize: 50
        });

        const files = response.data.files || [];
        return files.map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            isFolder: false,
            size: file.size ? parseInt(file.size, 10) : 0
        }));
    } catch (err) {
        console.error(`❌ Error searching files for "${query}":`, err.message);
        throw err;
    }
}

module.exports = {
    listFolder,
    getFileContent,
    searchFiles
};
