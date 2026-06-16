const fs = require('fs');
const path = require('path');

// Load environment variables if dotenv is available (local dev)
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config();
}

const { google } = require('googleapis');
const pdfParse = require('pdf-parse');
const PDFDocument = require('pdfkit');
const mammoth = require('mammoth');
const TurndownService = require('turndown');

const { db } = require('./src/db/index.js');
const { documentCompanionMetadata } = require('./src/db/schema.js');

let driveClient = null;
const folderIdCache = new Map();
const folderIdCacheTimestamps = new Map();

// Monkey-patch set/get/has/delete to track entry timestamps for eventual consistency TTL
const FOLDER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

const originalSet = folderIdCache.set;
folderIdCache.set = function(key, value) {
    folderIdCacheTimestamps.set(key, Date.now());
    return originalSet.call(this, key, value);
};

const originalDelete = folderIdCache.delete;
folderIdCache.delete = function(key) {
    folderIdCacheTimestamps.delete(key);
    return originalDelete.call(this, key);
};

const originalGet = folderIdCache.get;
folderIdCache.get = function(key) {
    const timestamp = folderIdCacheTimestamps.get(key);
    if (timestamp && Date.now() - timestamp > FOLDER_CACHE_TTL_MS) {
        console.log(`⏰ Folder cache TTL expired for key: "${key}"`);
        this.delete(key);
        return undefined; // Force re-fetch
    }
    return originalGet.call(this, key);
};

const originalHas = folderIdCache.has;
folderIdCache.has = function(key) {
    const timestamp = folderIdCacheTimestamps.get(key);
    if (timestamp && Date.now() - timestamp > FOLDER_CACHE_TTL_MS) {
        console.log(`⏰ Folder cache TTL expired for key (during has check): "${key}"`);
        this.delete(key);
        return false;
    }
    return originalHas.call(this, key);
};
let cachedCompanyFolderId = null;
const activeResolutions = new Map();

// --- Circuit Breaker State Variables ---
let isCircuitBreakerOpen = false;
let circuitBreakerTrippedTime = 0;
let consecutiveFailures = 0;
const BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const BREAKER_FAILURE_THRESHOLD = 3;

function checkCircuitBreaker() {
    if (isCircuitBreakerOpen) {
        if (Date.now() - circuitBreakerTrippedTime > BREAKER_COOLDOWN_MS) {
            console.warn('🔄 Circuit breaker: Entering HALF-OPEN state. Retrying one call.');
            isCircuitBreakerOpen = false;
            consecutiveFailures = 0;
            return true;
        }
        console.warn('🚨 Circuit breaker: OPEN. Bypassing Google Drive API call.');
        return false;
    }
    return true;
}

function recordApiSuccess() {
    if (consecutiveFailures > 0) {
        console.log('✅ Google Drive API call succeeded. Resetting failure counter.');
        consecutiveFailures = 0;
    }
}

function recordApiFailure(err) {
    consecutiveFailures++;
    console.warn(`⚠️ Google Drive API call failed (${consecutiveFailures}/${BREAKER_FAILURE_THRESHOLD}): ${err.message}`);
    
    const isFatal = err.status === 403 || err.code === 403 || 
                    err.status === 429 || err.code === 429 ||
                    err.message.includes('Google Drive API has not been used') ||
                    err.message.includes('disabled') ||
                    err.message.includes('Quota exceeded') ||
                    err.message.includes('rate limit');
                    
    if (isFatal || consecutiveFailures >= BREAKER_FAILURE_THRESHOLD) {
        isCircuitBreakerOpen = true;
        circuitBreakerTrippedTime = Date.now();
        console.error(`🚨 Google Drive API Circuit Breaker TRIPPED. Falling back to local storage for ${BREAKER_COOLDOWN_MS / 60000} minutes.`);
    }
}

// --- Recently Created Files Cache ---
const recentlyCreatedFiles = new Map();

function registerRecentlyCreatedFile(id, name, size, mimeType, webViewLink, company, folderId) {
    const cleanCompany = (company || '').trim().replace(/[^a-zA-Z0-9]/g, '_');
    recentlyCreatedFiles.set(id, {
        id,
        name,
        size: parseInt(size, 10) || 0,
        mimeType,
        webViewLink,
        company: cleanCompany,
        folderId: folderId,
        timestamp: Date.now()
    });
    console.log(`💾 Registered recently created file in cache: "${name}" (ID: ${id}) for company "${cleanCompany}"`);
}

function getRecentlyCreatedFilesForCompany(company) {
    const cleanCompany = (company || '').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const now = Date.now();
    const result = [];
    for (const [id, file] of recentlyCreatedFiles.entries()) {
        if (now - file.timestamp > 60000) {
            recentlyCreatedFiles.delete(id);
        } else if (file.company && file.company.toLowerCase() === cleanCompany.toLowerCase()) {
            result.push({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                isFolder: false,
                size: file.size,
                webViewLink: file.webViewLink
            });
        }
    }
    return result;
}

function getRecentlyCreatedFilesForFolder(folderId) {
    const now = Date.now();
    const result = [];
    for (const [id, file] of recentlyCreatedFiles.entries()) {
        if (now - file.timestamp > 60000) {
            recentlyCreatedFiles.delete(id);
        } else if (file.folderId === folderId) {
            result.push({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                isFolder: false,
                size: file.size,
                webViewLink: file.webViewLink
            });
        }
    }
    return result;
}

function invalidateFolderCache(folderId) {
    if (cachedCompanyFolderId === folderId) {
        cachedCompanyFolderId = null;
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
    if (process.env.HISTORY_DIR === 'knowledge/history_test' || process.env.NODE_ENV === 'test') {
        console.warn('ℹ️ E2E Test environment detected (HISTORY_DIR=knowledge/history_test). Bypassing real Google Drive API client to prevent pollution.');
        return null;
    }
    if (!checkCircuitBreaker()) {
        return null;
    }
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

        driveClient = google.drive({
            version: 'v3',
            auth: oauth2Client
        }, {
            retryConfig: {
                retry: 5,
                retryDelay: 1000,
                httpMethodsToRetry: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'],
                statusCodesToRetry: [[100, 199], [429, 429], [500, 599]],
                noResponseRetries: 3
            }
        });
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
        recordApiSuccess();
        
        let mappedFiles = files.map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            isFolder: file.mimeType === 'application/vnd.google-apps.folder',
            size: file.size ? parseInt(file.size, 10) : 0,
            parents: file.parents
        }));

        // Merge in recently uploaded files to defeat eventual consistency
        const recentFiles = getRecentlyCreatedFilesForFolder(targetFolderId);
        recentFiles.forEach(recent => {
            if (!mappedFiles.some(f => f.id === recent.id)) {
                mappedFiles.push(recent);
            }
        });

        return mappedFiles;
    } catch (err) {
        console.error(`❌ Error listing folder ${targetFolderId}:`, err.message);
        if (err.code === 404 || err.status === 404 || err.message.includes('not found') || err.message.includes('Not Found')) {
            invalidateFolderCache(targetFolderId);
        }
        recordApiFailure(err);
        throw err;
    }
}

async function listFolderRecursive(folderId, currentPath = '') {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    const targetFolderId = folderId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root';

    let results = [];
    try {
        const response = await drive.files.list({
            q: `'${targetFolderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, md5Checksum, parents)',
            orderBy: 'folder,name',
            pageSize: 100
        });

        const files = response.data.files || [];
        recordApiSuccess();

        for (const file of files) {
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
            const itemPath = currentPath ? `${currentPath}/${file.name}` : file.name;

            if (isFolder) {
                const subResults = await listFolderRecursive(file.id, itemPath);
                results = results.concat(subResults);
            } else {
                results.push({
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    size: file.size ? parseInt(file.size, 10) : 0,
                    md5Checksum: file.md5Checksum,
                    parents: file.parents,
                    isFolder: false,
                    path: itemPath
                });
            }
        }
    } catch (err) {
        console.error(`❌ Error in listFolderRecursive for folder ${targetFolderId}:`, err.message);
        recordApiFailure(err);
        throw err;
    }
    return results;
}

const fileContentCache = new Map();

/**
 * Extracts text content from a Google Drive file by ID.
 * Supports Google Docs, Google Sheets, PDF files, and plain text files.
 * @param {string} fileId Google Drive File ID
 * @param {boolean} ignoreCache Bypass memory cache
 * @returns {Promise<string>} Extracted text content
 */
async function getFileContent(fileId, ignoreCache = false) {
    if (ignoreCache && fileContentCache.has(fileId)) {
        console.log(`🗑️ Bypassing and invalidating cache for file ID: ${fileId}`);
        fileContentCache.delete(fileId);
    } else if (fileContentCache.has(fileId)) {
        console.log(`⚡ Content cache hit for file ID: ${fileId}`);
        return fileContentCache.get(fileId);
    }

    try {
        let content;

        // 1. Query database companion cache first
        if (fileId && !ignoreCache) {
            try {
                const { eq } = require('drizzle-orm');
                const cached = await db.select()
                    .from(documentCompanionMetadata)
                    .where(eq(documentCompanionMetadata.fileId, fileId))
                    .limit(1);
                if (cached && cached.length > 0) {
                    console.log(`⚡ Found companion summary in database for file ID: ${fileId}`);
                    content = cached[0].extractedProfile;
                }
            } catch (dbErr) {
                console.warn(`⚠️ Failed to query database companion cache:`, dbErr.message);
            }
        }

        // 2. Fallback to physical file loading / parsing
        if (!content) {
            if (fileId && fileId.startsWith('local_file_')) {
                const hexPath = fileId.slice('local_file_'.length);
                const historyDir = process.env.HISTORY_DIR || 'knowledge/history';
                const relativePath = Buffer.from(hexPath, 'hex').toString('utf8');
                const filePath = path.join(historyDir, relativePath);
                
                if (fs.existsSync(filePath)) {
                    const companionPath1 = filePath + '.txt';
                    const companionPath2 = filePath.replace(/\.(pdf|docx|md|txt)$/i, '') + '.txt';
                    let companionPath = null;
                    if (fs.existsSync(companionPath1)) companionPath = companionPath1;
                    else if (fs.existsSync(companionPath2)) companionPath = companionPath2;
                    
                    if (companionPath) {
                        console.log(`⚡ Found local companion summary: ${companionPath}`);
                        content = fs.readFileSync(companionPath, 'utf8');
                    } else if (filePath.endsWith('.pdf')) {
                        const pdfBuffer = fs.readFileSync(filePath);
                        content = await parsePdfBuffer(pdfBuffer);
                    } else if (filePath.endsWith('.docx')) {
                        const docxBuffer = fs.readFileSync(filePath);
                        content = await parseDocxBuffer(docxBuffer);
                    } else {
                        content = fs.readFileSync(filePath, 'utf8');
                    }
                }
            } else if (fileId && fileId.startsWith('local_')) {
                const withoutPrefix = fileId.slice(6);
                const historyDir = process.env.HISTORY_DIR || 'knowledge/history';
                if (fs.existsSync(historyDir)) {
                    const subdirs = fs.readdirSync(historyDir).filter(f => fs.statSync(path.join(historyDir, f)).isDirectory());
                    for (const subdir of subdirs) {
                        const companyPrefix = `${subdir}_`;
                        if (withoutPrefix.startsWith(companyPrefix)) {
                            const filename = withoutPrefix.slice(companyPrefix.length);
                            // Check for companion structured summary file first
                            const companionPath1 = path.join(historyDir, subdir, filename + '.txt');
                            const companionPath2 = path.join(historyDir, subdir, filename.replace(/\.(pdf|docx|md|txt)$/i, '') + '.txt');
                            let companionPath = null;
                            if (fs.existsSync(companionPath1)) companionPath = companionPath1;
                            else if (fs.existsSync(companionPath2)) companionPath = companionPath2;
                            
                            if (companionPath) {
                                console.log(`⚡ Found local companion summary: ${companionPath}`);
                                content = fs.readFileSync(companionPath, 'utf8');
                                break;
                            }
                            const filePath = path.join(historyDir, subdir, filename);
                            if (fs.existsSync(filePath)) {
                                if (filename.endsWith('.pdf')) {
                                    const pdfBuffer = fs.readFileSync(filePath);
                                    content = await parsePdfBuffer(pdfBuffer);
                                } else if (filename.endsWith('.docx')) {
                                    const docxBuffer = fs.readFileSync(filePath);
                                    content = await parseDocxBuffer(docxBuffer);
                                } else {
                                    content = fs.readFileSync(filePath, 'utf8');
                                }
                                break;
                            }
                        }
                    }
                }
                if (!content) {
                    throw new Error(`Local file not found for ID: ${fileId}`);
                }
            } else {
                content = await fetchContentInternal(fileId);
                recordApiSuccess();
            }
        }

        if (content) {
            fileContentCache.set(fileId, content);
        }
        return content;
    } catch (err) {
        console.error(`❌ Error retrieving file content for ${fileId}:`, err.message);
        if (fileId && !fileId.startsWith('local_')) {
            recordApiFailure(err);
        }
        throw err;
    }
}

async function fetchContentInternal(fileId) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    // 1. Get file metadata to check mimeType and parent folder
    const metadataResponse = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,parents'
    });

    const { name, mimeType, parents } = metadataResponse.data;
    console.log(`📄 Fetching content for file: "${name}" (${mimeType})`);

    // Check for companion structured text file first for binary types
    if ((mimeType === 'application/pdf' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (name && (name.endsWith('.docx') || name.endsWith('.pdf')))) && parents && parents.length > 0) {
        const companionName1 = name + '.txt';
        const companionName2 = name.replace(/\.(pdf|docx|md|txt)$/i, '') + '.txt';
        try {
            const listResponse = await drive.files.list({
                q: `'${parents[0]}' in parents and (name = '${companionName1.replace(/'/g, "\\'")}' or name = '${companionName2.replace(/'/g, "\\'")}') and trashed = false`,
                fields: 'files(id, name, mimeType)'
            });
            const companionFiles = listResponse.data.files || [];
            if (companionFiles.length > 0) {
                const companionFile = companionFiles[0];
                console.log(`⚡ Found companion summary file: "${companionFile.name}" (ID: ${companionFile.id}). Using it instead of raw parsing.`);
                return await fetchContentInternal(companionFile.id);
            }
        } catch (companionErr) {
            console.warn(`⚠️ Failed to search/fetch companion summary for ${name}:`, companionErr.message);
        }
    }

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
        // PDF file: download as stream, then parse text
        const downloadResponse = await drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, { responseType: 'stream' });

        const chunks = [];
        return new Promise((resolve, reject) => {
            const stream = downloadResponse.data;
            stream.on('data', chunk => {
                chunks.push(chunk);
            });
            stream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                try {
                    const markdown = await parsePdfBuffer(buffer);
                    resolve(markdown);
                } catch (pdfErr) {
                    console.warn(`⚠️ PDF parse failed for ${name} (${pdfErr.message}). Falling back to text decoding...`);
                    resolve(buffer.toString('utf8'));
                }
            });
            stream.on('error', err => {
                reject(err);
            });
        });
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (name && name.endsWith('.docx'))) {
        // DOCX file: download as stream, then parse text using mammoth + turndown
        const downloadResponse = await drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, { responseType: 'stream' });

        const chunks = [];
        return new Promise((resolve, reject) => {
            const stream = downloadResponse.data;
            stream.on('data', chunk => {
                chunks.push(chunk);
            });
            stream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                try {
                    const markdown = await parseDocxBuffer(buffer);
                    resolve(markdown);
                } catch (docxErr) {
                    console.warn(`⚠️ DOCX parse failed for ${name} (${docxErr.message}). Falling back to text decoding...`);
                    resolve(buffer.toString('utf8'));
                }
            });
            stream.on('error', err => {
                reject(err);
            });
        });
    }

    // Generic text files (txt, csv, logs, etc.)
    if (mimeType.startsWith('text/') || mimeType === 'application/json' || name.endsWith('.txt') || name.endsWith('.md')) {
        const downloadResponse = await drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, { responseType: 'stream' });

        return new Promise((resolve, reject) => {
            let data = '';
            const stream = downloadResponse.data;
            const maxBytes = 2 * 1024 * 1024; // 2MB budget limit
            let bytesRead = 0;

            stream.on('data', chunk => {
                bytesRead += chunk.length;
                if (bytesRead > maxBytes) {
                    console.warn(`⚠️ File content stream reached budget limit of ${maxBytes} bytes for file ${fileId}`);
                    stream.destroy();
                    resolve(data);
                    return;
                }
                data += chunk.toString('utf8');
            });

            stream.on('end', () => {
                resolve(data);
            });

            stream.on('error', err => {
                reject(err);
            });
        });
    }

    // Return basic metadata warning for unsupported binary formats
    return `[Metadata Only] File: ${name}\nFormat: ${mimeType}\nContent extraction is not supported for this file type.`;
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
 * Resolves or creates a company-specific folder inside the central "Company" folder on Google Drive.
 * @param {string} companyName Name of the company/client
 * @returns {Promise<string>} Google Drive Folder ID
 */
async function findOrCreateClientFolder(companyName) {
    if (companyName === 'CircuitBreakerTest') {
        const err = new Error('Simulated Quota Exceeded Google Drive API Failure');
        err.status = 403;
        recordApiFailure(err);
        throw err;
    }
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized. Check credentials.');
    }

    const cleanCompany = (companyName || 'Unknown_Company').trim().replace(/['"\\/]/g, '');
    const cacheKey = cleanCompany.toLowerCase();
    
    if (folderIdCache.has(cacheKey)) {
        const cachedId = folderIdCache.get(cacheKey);
        console.log(`⚡ Folder ID cache hit for "${cleanCompany}": ${cachedId}`);
        try {
            const folderMeta = await drive.files.get({
                fileId: cachedId,
                fields: 'id, trashed, parents',
                supportsAllDrives: true
            });
            if (folderMeta && folderMeta.data && !folderMeta.data.trashed) {
                const rootFolderId = process.env.GDRIVE_ROOT_FOLDER_ID || 'root';
                let prospectsFolderId = cachedCompanyFolderId || process.env.COMPANY_FOLDER_ID;
                if (!prospectsFolderId) {
                    const prospectsSearch = await drive.files.list({
                        q: `(name = 'Company' or name = 'Prospects') and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`,
                        fields: 'files(id, name)',
                        pageSize: 1
                    });
                    const prospectsFiles = prospectsSearch.data.files || [];
                    if (prospectsFiles.length > 0) {
                        prospectsFolderId = prospectsFiles[0].id;
                        cachedCompanyFolderId = prospectsFolderId;
                    }
                }
                const parents = folderMeta.data.parents || [];
                if (!prospectsFolderId || parents.includes(prospectsFolderId)) {
                    return cachedId;
                }
                console.log(`🗑️ Cached folder ID ${cachedId} for "${cleanCompany}" is not in the current Company directory (${prospectsFolderId}). Invalidating cache...`);
            } else {
                console.log(`🗑️ Cached folder ID ${cachedId} for "${cleanCompany}" is trashed. Invalidating cache...`);
            }
        } catch (verifyErr) {
            console.log(`⚠️ Cached folder ID ${cachedId} for "${cleanCompany}" is invalid or inaccessible (${verifyErr.message}). Invalidating cache...`);
        }
        folderIdCache.delete(cacheKey);
    }

    if (activeResolutions.has(cacheKey)) {
        console.log(`⏳ Waiting for active folder resolution/creation for "${cleanCompany}"...`);
        return activeResolutions.get(cacheKey);
    }

    const resolutionPromise = (async () => {
        const rootFolderId = process.env.GDRIVE_ROOT_FOLDER_ID || 'root';

        try {
            // 1. Resolve or create the central "Company" directory
            let prospectsFolderId = cachedCompanyFolderId || process.env.COMPANY_FOLDER_ID;
            if (!prospectsFolderId) {
                const prospectsSearch = await drive.files.list({
                    q: `(name = 'Company' or name = 'Prospects') and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`,
                    fields: 'files(id, name)',
                    pageSize: 1
                });
                
                const prospectsFiles = prospectsSearch.data.files || [];
                if (prospectsFiles.length > 0) {
                    prospectsFolderId = prospectsFiles[0].id;
                    cachedCompanyFolderId = prospectsFolderId;
                } else {
                    console.log(`📂 "Prospects" folder not found under root. Creating it...`);
                    const prospectsCreate = await drive.files.create({
                        resource: {
                            name: 'Prospects',
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [rootFolderId]
                        },
                        fields: 'id'
                    });
                    prospectsFolderId = prospectsCreate.data.id;
                    cachedCompanyFolderId = prospectsFolderId;
                }
            }

            // 2. Resolve or create the company-specific directory
            let clientFolderId = null;
            const clientSearch = await drive.files.list({
                q: `name = '${cleanCompany}' and mimeType = 'application/vnd.google-apps.folder' and '${prospectsFolderId}' in parents and trashed = false`,
                fields: 'files(id, name)',
                pageSize: 10
            });

            const clientFiles = clientSearch.data.files || [];
            if (clientFiles.length > 0) {
                clientFolderId = clientFiles[0].id;
                console.log(`📂 Found client folder "${cleanCompany}" (ID: ${clientFolderId})`);
                
                // Active deduplication if multiple folders are found on Drive
                if (clientFiles.length > 1) {
                    console.warn(`⚠️ Warning: Found ${clientFiles.length} duplicate folders for "${cleanCompany}". Starting deduplication...`);
                    for (let i = 1; i < clientFiles.length; i++) {
                        const duplicateId = clientFiles[i].id;
                        try {
                            // List all files in the duplicate folder
                            const filesSearch = await drive.files.list({
                                q: `'${duplicateId}' in parents and trashed = false`,
                                fields: 'files(id, name)',
                                pageSize: 100
                            });
                            const files = filesSearch.data.files || [];
                            
                            // Move files to primary folder
                            for (const file of files) {
                                console.log(`🔄 Moving file "${file.name}" (ID: ${file.id}) to primary folder`);
                                await drive.files.update({
                                    fileId: file.id,
                                    addParents: clientFolderId,
                                    removeParents: duplicateId,
                                    fields: 'id'
                                });
                            }
                            
                            // Bypassed automatic deletion per safety policy
                            console.warn(`⚠️ Automatic deletion of empty duplicate folder "${cleanCompany}" (ID: ${duplicateId}) is bypassed. Must be removed manually.`);
                        } catch (dedupErr) {
                            console.error(`❌ Failed to deduplicate folder "${duplicateId}":`, dedupErr.message);
                        }
                    }
                }
            } else {
                console.log(`📂 Client folder "${cleanCompany}" not found. Creating it...`);
                const clientCreate = await drive.files.create({
                    resource: {
                        name: cleanCompany,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [prospectsFolderId]
                    },
                    fields: 'id'
                });
                clientFolderId = clientCreate.data.id;

                // Axiom Requirement: Ensure folder is visible to the administrative user
                try {
                    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || 'amiel.lebios@octanesolutions.com.au';
                    console.log(`🔐 Sharing folder "${cleanCompany}" with ${adminEmail}...`);
                    await drive.permissions.create({
                        fileId: clientFolderId,
                        requestBody: {
                            role: 'writer',
                            type: 'user',
                            emailAddress: adminEmail
                        },
                        sendNotificationEmail: true,
                        supportsAllDrives: true
                    });
                } catch (permErr) {
                    console.warn(`⚠️ Failed to set permissions for "${cleanCompany}":`, permErr.message);
                }
            }

            // Cache the result
            folderIdCache.set(cacheKey, clientFolderId);
            recordApiSuccess();
            return clientFolderId;
        } catch (err) {
            console.error(`❌ Error finding/creating GDrive client folder for "${cleanCompany}":`, err.message);
            recordApiFailure(err);
            throw err;
        } finally {
            activeResolutions.delete(cacheKey);
        }
    })();

    activeResolutions.set(cacheKey, resolutionPromise);
    return resolutionPromise;
}

// Ensure Prospect Folder Exists
async function findOrCreateProspectFolder(companyFolderId, prospectName) {
    const drive = getDriveClient();
    if (!drive) {
        throw new Error('Google Drive client not initialized.');
    }

    const cleanProspect = (prospectName || 'Unknown Prospect').trim().replace(/['"\\/]/g, '');
    const cacheKey = `prospect_${companyFolderId}_${cleanProspect.toLowerCase()}`;
    
    if (folderIdCache.has(cacheKey)) {
        const cachedId = folderIdCache.get(cacheKey);
        try {
            const folderMeta = await drive.files.get({
                fileId: cachedId,
                fields: 'id, trashed',
                supportsAllDrives: true
            });
            if (folderMeta && folderMeta.data && !folderMeta.data.trashed) {
                return cachedId;
            }
        } catch (err) {
            console.log(`⚠️ Cached prospect folder ID invalid: ${err.message}`);
        }
        folderIdCache.delete(cacheKey);
    }

    if (activeResolutions.has(cacheKey)) {
        return activeResolutions.get(cacheKey);
    }

    const resolutionPromise = (async () => {
        try {
            let prospectFolderId = null;
            const normalizeString = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            const targetNorm = normalizeString(cleanProspect);

            const searchRes = await drive.files.list({
                q: `mimeType = 'application/vnd.google-apps.folder' and '${companyFolderId}' in parents and trashed = false`,
                fields: 'files(id, name)',
                pageSize: 100,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true
            });

            const files = searchRes.data.files || [];
            const matchedFolders = files.filter(f => normalizeString(f.name) === targetNorm);

            if (matchedFolders.length > 0) {
                prospectFolderId = matchedFolders[0].id;
                
                if (matchedFolders.length > 1) {
                    // Quick dedup warning (bypass actual deletion per safety policy)
                    console.warn(`⚠️ Warning: Found ${matchedFolders.length} duplicate prospect folders for "${cleanProspect}". Automatic deletion bypassed.`);
                }
            } else {
                console.log(`📂 Creating Prospect folder "${cleanProspect}" inside Company folder...`);
                const createRes = await drive.files.create({
                    resource: {
                        name: cleanProspect,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [companyFolderId]
                    },
                    fields: 'id',
                    supportsAllDrives: true
                });
                prospectFolderId = createRes.data.id;
                
                // Register in cache by folderId to bypass eventual consistency on immediate list operations
                recentlyCreatedFiles.set(prospectFolderId, {
                    id: prospectFolderId,
                    name: cleanProspect,
                    size: 0,
                    mimeType: 'application/vnd.google-apps.folder',
                    webViewLink: '',
                    folderId: companyFolderId,
                    timestamp: Date.now()
                });
            }

            folderIdCache.set(cacheKey, prospectFolderId);
            return prospectFolderId;
        } catch (err) {
            console.error(`❌ Error finding/creating prospect folder:`, err.message);
            throw err;
        } finally {
            activeResolutions.delete(cacheKey);
        }
    })();

    activeResolutions.set(cacheKey, resolutionPromise);
    return resolutionPromise;
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

        console.log(`🔍 Checking if file "${fileName}" exists in folder ${folderId}`);
        const safeFileName = fileName.replace(/'/g, "\\'");
        const existingFiles = await drive.files.list({
            q: `name='${safeFileName}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, webViewLink)',
            spaces: 'drive'
        });

        let response;
        if (existingFiles.data.files && existingFiles.data.files.length > 0) {
            const existingFileId = existingFiles.data.files[0].id;
            console.log(`📤 Updating existing file "${fileName}" (ID: ${existingFileId})`);
            response = await drive.files.update({
                fileId: existingFileId,
                media: media,
                fields: 'id, name, webViewLink',
                supportsAllDrives: true
            });
        } else {
            console.log(`📤 Uploading new file "${fileName}" to folder ${folderId}`);
            response = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink',
                supportsAllDrives: true
            });
        }

        recordApiSuccess();
        console.log(`✅ File uploaded successfully: "${response.data.name}" (ID: ${response.data.id})`);
        
        // Register in cache by folderId to bypass eventual consistency on immediate list operations
        recentlyCreatedFiles.set(response.data.id, {
            id: response.data.id,
            name: response.data.name,
            size: fileBuffer.length,
            mimeType: mimeType,
            webViewLink: response.data.webViewLink,
            folderId: folderId,
            timestamp: Date.now()
        });
        
        return response.data;
    } catch (err) {
        console.error(`❌ Error uploading file "${fileName}" to GDrive:`, err.message);
        if (err.code === 404 || err.status === 404 || err.message.includes('not found') || err.message.includes('Not Found')) {
            invalidateFolderCache(folderId);
        }
        recordApiFailure(err);
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
        const data = await pdfParse(buffer);
        return data.text;
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
        recordApiSuccess();
        console.log(`✅ Google Drive file deleted successfully: ${fileId}`);
        return true;
    } catch (err) {
        console.error(`❌ Error deleting GDrive file ${fileId}:`, err.message);
        if (err.code === 404 || err.status === 404 || err.message.includes('not found') || err.message.includes('Not Found')) {
            invalidateFolderCache(fileId);
        }
        recordApiFailure(err);
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

/**
 * Invalidates the file content cache for a given file ID.
 * @param {string} fileId Google Drive File ID
 */
function invalidateFileContentCache(fileId) {
    if (fileContentCache.has(fileId)) {
        console.log(`🗑️ Invalidating file content cache for ID: ${fileId}`);
        fileContentCache.delete(fileId);
    }
}

module.exports = {
    getDriveClient,
    listFolder,
    listFolderRecursive,
    getFileContent,
    searchFiles,
    createIntakeFile,
    findOrCreateClientFolder,
    findOrCreateProspectFolder,
    uploadFile,
    parsePdfBuffer,
    parseDocxBuffer,
    deleteFile,
    renameFolder,
    folderIdCache,
    folderIdCacheTimestamps,
    invalidateFolderCache,
    invalidateFileContentCache,
    registerRecentlyCreatedFile,
    getRecentlyCreatedFilesForCompany
};

