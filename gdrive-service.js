const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const pdfParse = require('pdf-parse');
const PDFDocument = require('pdfkit');

// Load environment variables if dotenv is available (local dev)
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config();
}

let driveClient = null;

// Initialize Google Drive API client
function getDriveClient() {
    if (driveClient) {
        return driveClient;
    }

    if (!process.env.GDRIVE_CLIENT_ID || !process.env.GDRIVE_REFRESH_TOKEN) {
        console.warn('⚠️ Google Drive OAuth2 credentials not found in environment. Real GDrive API calls will fail.');
        return null;
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GDRIVE_CLIENT_ID,
            process.env.GDRIVE_CLIENT_SECRET,
            'http://localhost:8080'
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.GDRIVE_REFRESH_TOKEN
        });

        driveClient = google.drive({ version: 'v3', auth: oauth2Client });
        console.log('✅ Google Drive API client initialized successfully via OAuth2.');
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
            try {
                const data = await pdfParse(buffer);
                return data.text;
            } catch (pdfErr) {
                console.warn(`⚠️ PDF parse failed for ${name} (${pdfErr.message}). Falling back to text decoding...`);
                return buffer.toString('utf8');
            }
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

/**
 * Creates a formatted plain text intake document in the target Google Drive folder.
 * @param {string} fileName File name to create (e.g. Lead_Intake_Sarah_Chen.txt)
 * @param {string} contentText Text content of the intake summary
 * @param {string} parentFolderId Optional target folder ID (defaults to root/env)
 * @returns {Promise<Object>} Created file metadata (id, name)
 */
async function createIntakeFile(fileName, contentText, parentFolderId) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    const { PassThrough } = require('stream');
    const folderId = parentFolderId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root';

    try {
        console.log(`📤 Uploading lead intake file "${fileName}" to GDrive folder: ${folderId}`);
        
        // Generate PDF Buffer
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        
        const pdfBuffer = await new Promise((resolve, reject) => {
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);
            
            // Add content to PDF
            doc.fontSize(20).font('Helvetica-Bold').text('Octane Solutions - Lead Intake', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).font('Helvetica').text(contentText);
            doc.end();
        });

        const stream = require('stream').Readable.from(pdfBuffer);

        const fileMetadata = {
            name: fileName,
            parents: [folderId],
            mimeType: 'application/pdf'
        };

        const media = {
            mimeType: 'application/pdf',
            body: stream
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name',
            supportsAllDrives: true
        });

        console.log(`✅ Google Drive file created: "${response.data.name}" (ID: ${response.data.id})`);
        return response.data;
    } catch (err) {
        console.error(`❌ Error creating GDrive file "${fileName}":`, err.message);
        throw err;
    }
}

module.exports = {
    listFolder,
    getFileContent,
    searchFiles,
    createIntakeFile
};
