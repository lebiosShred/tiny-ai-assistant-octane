const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const pdf2md = require('@opendocsg/pdf2md');
const PDFDocument = require('pdfkit');
const mammoth = require('mammoth');
const TurndownService = require('turndown');

// Load environment variables if dotenv is available (local dev)
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config();
}

let driveClient = null;
const folderIdCache = new Map();
let cachedClientsFolderId = null;

function invalidateFolderCache(folderId) {
    if (cachedClientsFolderId === folderId) {
        cachedClientsFolderId = null;
    }
    for (const [key, value] of folderIdCache.entries()) {
        if (value === folderId) {
            folderIdCache.delete(key);
            console.log(`🗑️ Invalidated folder ID cache for company: "${key}"`);
        }
    }
}

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
        if (err.code === 404 || err.status === 404 || err.message.includes('not found') || err.message.includes('Not Found')) {
            invalidateFolderCache(targetFolderId);
        }
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
                const markdown = await pdf2md(buffer);
                return markdown;
            } catch (pdfErr) {
                console.warn(`⚠️ PDF parse failed for ${name} (${pdfErr.message}). Falling back to text decoding...`);
                return buffer.toString('utf8');
            }
        }

        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (name && name.endsWith('.docx'))) {
            // DOCX file: download as arrayBuffer, then parse text using mammoth + turndown
            const downloadResponse = await drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'arraybuffer' });

            const buffer = Buffer.from(downloadResponse.data);
            try {
                const markdown = await parseDocxBuffer(buffer);
                return markdown;
            } catch (docxErr) {
                console.warn(`⚠️ DOCX parse failed for ${name} (${docxErr.message}). Falling back to text decoding...`);
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

/**
 * Resolves or creates a company-specific folder inside the central "Clients" folder on Google Drive.
 * @param {string} companyName Name of the company/client
 * @returns {Promise<string>} Google Drive Folder ID
 */
async function findOrCreateClientFolder(companyName) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    const cleanCompany = (companyName || 'Unknown_Company').trim().replace(/['"\\/]/g, '');
    const cacheKey = cleanCompany.toLowerCase();
    
    if (folderIdCache.has(cacheKey)) {
        console.log(`⚡ Folder ID cache hit for "${cleanCompany}": ${folderIdCache.get(cacheKey)}`);
        return folderIdCache.get(cacheKey);
    }

    const rootFolderId = process.env.GDRIVE_ROOT_FOLDER_ID || 'root';

    try {
        // 1. Resolve or create the central "Clients" directory
        let clientsFolderId = cachedClientsFolderId;
        if (!clientsFolderId) {
            const clientsSearch = await drive.files.list({
                q: `name = 'Clients' and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`,
                fields: 'files(id, name)',
                pageSize: 1
            });
            
            const clientsFiles = clientsSearch.data.files || [];
            if (clientsFiles.length > 0) {
                clientsFolderId = clientsFiles[0].id;
                cachedClientsFolderId = clientsFolderId;
            } else {
                console.log(`📂 "Clients" folder not found under root. Creating it...`);
                const clientsCreate = await drive.files.create({
                    resource: {
                        name: 'Clients',
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [rootFolderId]
                    },
                    fields: 'id'
                });
                clientsFolderId = clientsCreate.data.id;
                cachedClientsFolderId = clientsFolderId;
            }
        }

        // 2. Resolve or create the company-specific directory
        let clientFolderId = null;
        const clientSearch = await drive.files.list({
            q: `name = '${cleanCompany}' and mimeType = 'application/vnd.google-apps.folder' and '${clientsFolderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 1
        });

        const clientFiles = clientSearch.data.files || [];
        if (clientFiles.length > 0) {
            clientFolderId = clientFiles[0].id;
        } else {
            console.log(`📂 Client folder "${cleanCompany}" not found. Creating it...`);
            const clientCreate = await drive.files.create({
                resource: {
                    name: cleanCompany,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [clientsFolderId]
                },
                fields: 'id'
            });
            clientFolderId = clientCreate.data.id;
        }

        // Cache the result
        folderIdCache.set(cacheKey, clientFolderId);
        return clientFolderId;
    } catch (err) {
        console.error(`❌ Error finding/creating GDrive client folder for "${cleanCompany}":`, err.message);
        throw err;
    }
}

/**
 * Uploads a file (from buffer) directly into a target folder on Google Drive.
 * @param {string} fileName Name of the file
 * @param {string} mimeType MIME type of the file
 * @param {Buffer} fileBuffer Buffer containing the file data
 * @param {string} folderId Parent folder ID
 * @returns {Promise<Object>} Created file metadata (id, name, webViewLink)
 */
async function uploadFile(fileName, mimeType, fileBuffer, folderId) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    try {
        const stream = require('stream').Readable.from(fileBuffer);
        const fileMetadata = {
            name: fileName,
            parents: [folderId]
        };
        const media = {
            mimeType: mimeType,
            body: stream
        };

        console.log(`📤 Uploading file "${fileName}" to folder ${folderId}`);
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink',
            supportsAllDrives: true
        });

        console.log(`✅ File uploaded successfully: "${response.data.name}" (ID: ${response.data.id})`);
        return response.data;
    } catch (err) {
        console.error(`❌ Error uploading file "${fileName}" to GDrive:`, err.message);
        if (err.code === 404 || err.status === 404 || err.message.includes('not found') || err.message.includes('Not Found')) {
            invalidateFolderCache(folderId);
        }
        throw err;
    }
}

/**
 * Utility to parse PDF buffer into text.
 * @param {Buffer} buffer 
 * @returns {Promise<string>}
 */
async function parsePdfBuffer(buffer) {
    try {
        const markdown = await pdf2md(buffer);
        return markdown;
    } catch (err) {
        console.warn(`⚠️ PDF parse failed: ${err.message}. Falling back to text decoding...`);
        return buffer.toString('utf8');
    }
}

/**
 * Utility to parse DOCX buffer into Markdown text.
 * @param {Buffer} buffer 
 * @returns {Promise<string>}
 */
async function parseDocxBuffer(buffer) {
    try {
        const mammothResult = await mammoth.convertToHtml({ buffer: buffer });
        const html = mammothResult.value;
        const turndownService = new TurndownService();
        const markdown = turndownService.turndown(html);
        return markdown;
    } catch (err) {
        console.warn(`⚠️ DOCX parse failed: ${err.message}. Falling back to text decoding...`);
        return buffer.toString('utf8');
    }
}

/**
 * Deletes a file by ID from Google Drive.
 * @param {string} fileId Google Drive File ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteFile(fileId) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    try {
        console.log(`🗑️ Deleting GDrive file: ${fileId}`);
        await drive.files.delete({
            fileId: fileId,
            supportsAllDrives: true
        });
        console.log(`✅ Google Drive file deleted successfully: ${fileId}`);
        return true;
    } catch (err) {
        console.error(`❌ Error deleting GDrive file ${fileId}:`, err.message);
        if (err.code === 404 || err.status === 404 || err.message.includes('not found') || err.message.includes('Not Found')) {
            invalidateFolderCache(fileId);
        }
        throw err;
    }
}

/**
 * Renames a folder or file by ID in Google Drive.
 * @param {string} fileId Google Drive File/Folder ID
 * @param {string} newName New name
 * @returns {Promise<boolean>} Success status
 */
async function renameFolder(fileId, newName) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    try {
        console.log(`📂 Renaming GDrive item ${fileId} to "${newName}"`);
        await drive.files.update({
            fileId: fileId,
            resource: { name: newName },
            supportsAllDrives: true
        });
        console.log(`✅ Google Drive item renamed successfully: ${fileId}`);
        
        // Update memory cache mapping
        const cleanName = newName.trim().replace(/['"\\/]/g, '');
        for (const [key, value] of folderIdCache.entries()) {
            if (value === fileId) {
                folderIdCache.delete(key);
            }
        }
        folderIdCache.set(cleanName.toLowerCase(), fileId);
        return true;
    } catch (err) {
        console.error(`❌ Error renaming GDrive item ${fileId}:`, err.message);
        if (err.code === 404 || err.status === 404 || err.message.includes('not found') || err.message.includes('Not Found')) {
            invalidateFolderCache(fileId);
        }
        throw err;
    }
}

module.exports = {
    getDriveClient,
    listFolder,
    getFileContent,
    searchFiles,
    createIntakeFile,
    findOrCreateClientFolder,
    uploadFile,
    parsePdfBuffer,
    parseDocxBuffer,
    deleteFile,
    renameFolder,
    folderIdCache,
    invalidateFolderCache
};

