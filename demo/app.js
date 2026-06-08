document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // Hide quick prompts bar if not running in automation test (with manual override via ?show_prompts)
    const showPrompts = navigator.webdriver || new URLSearchParams(window.location.search).has('show_prompts');
    if (!showPrompts) {
        const bar = document.querySelector('.quick-prompts-bar');
        if (bar) {
            bar.style.setProperty('display', 'none', 'important');
        }
    }

    // Helpers
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showToast(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    function updateValidationBadges() {
        const gdriveBadge = document.getElementById('gdrive-status-badge');
        const linkedinBadge = document.getElementById('linkedin-status-badge');
        const intakeBadge = document.getElementById('intake-status-badge');
        const transcriptBadge = document.getElementById('transcript-status-badge');

        const companyName = metaCompany ? metaCompany.value.trim() : '';
        const normalizedCo = companyName ? companyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';

        if (gdriveBadge) {
            const val = sourceGdriveFileSelect ? sourceGdriveFileSelect.value : '';
            if (val) {
                const normalizedContent = (gdriveFileContent || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (normalizedCo && !normalizedContent.includes(normalizedCo)) {
                    gdriveBadge.innerText = 'Mismatch Warning';
                    gdriveBadge.className = 'validation-badge warning';
                } else {
                    gdriveBadge.innerText = 'Ready';
                    gdriveBadge.className = 'validation-badge ready';
                }
            } else {
                gdriveBadge.innerText = 'None';
                gdriveBadge.className = 'validation-badge missing';
            }
        }

        if (linkedinBadge) {
            const val = sourceLinkedinText ? sourceLinkedinText.value.trim() : '';
            if (val) {
                const normalizedContent = val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (normalizedCo && !normalizedContent.includes(normalizedCo)) {
                    linkedinBadge.innerText = 'Mismatch Warning';
                    linkedinBadge.className = 'validation-badge warning';
                } else {
                    linkedinBadge.innerText = 'Ready';
                    linkedinBadge.className = 'validation-badge ready';
                }
            } else {
                linkedinBadge.innerText = 'Missing';
                linkedinBadge.className = 'validation-badge missing';
            }
        }

        if (intakeBadge) {
            const val = sourceIntakeText ? sourceIntakeText.value.trim() : '';
            if (val) {
                intakeBadge.innerText = 'Ready';
                intakeBadge.className = 'validation-badge ready';
            } else {
                intakeBadge.innerText = 'Missing';
                intakeBadge.className = 'validation-badge missing';
            }
        }

        let hasTranscript = false;
        if (transcriptBadge) {
            const val = sourceTranscriptText ? sourceTranscriptText.value.trim() : '';
            if (val) {
                transcriptBadge.innerText = 'Ready';
                transcriptBadge.className = 'validation-badge ready';
                hasTranscript = true;
            } else {
                transcriptBadge.innerText = 'Missing';
                transcriptBadge.className = 'validation-badge missing';
            }
        }

        // Dynamically generate or remove transcript-dependent quick prompt buttons
        const container = document.querySelector('.quick-prompts-buttons');
        if (container) {
            const dynamicTypes = [
                { type: 'recapEmail', text: '✉️ Recap Email' },
                { type: 'migration', text: '📊 Migration' },
                { type: 'actionItems', text: '✅ Action Items' },
                { type: 'summarySheet', text: '📄 Summary Sheet' },
                { type: 'notes', text: '📝 Notes' },
                { type: 'proposal', text: '💼 Proposal' }
            ];
            dynamicTypes.forEach(item => {
                const existingBtn = container.querySelector(`[data-prompt-type="${item.type}"]`);
                if (hasTranscript) {
                    if (!existingBtn) {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'btn btn-quick-prompt';
                        btn.setAttribute('data-prompt-type', item.type);
                        btn.innerText = item.text;
                        container.appendChild(btn);
                    }
                } else {
                    if (existingBtn) {
                        existingBtn.remove();
                    }
                }
            });
        }
    }

    // State Variables
    let currentChatId = null;
    let activeFolderId = null;
    const expandedCompanies = new Set();
    const expandedProspects = new Set();
    let activeProspectName = null;
    let chatsList = [];
    let chatHistory = [];
    let transitDistance = "Online/Phone call only (Distance unavailable)";
    let gdriveFileContent = "";
    let gdriveFolders = [];

    // DOM Elements
    const btnNewChat = document.getElementById('btn-new-chat');
    const btnNewChatActive = document.getElementById('btn-new-chat-active');
    const chatSearch = document.getElementById('chat-search');
    const recentChatsList = document.getElementById('recent-chats-list');
    const sourcesList = document.getElementById('sources-list');
    const workspaceEmptyState = document.getElementById('workspace-empty-state');
    const workspaceActiveChat = document.getElementById('workspace-active-chat');

    const activeChatClientTitle = document.getElementById('active-chat-client-title');
    const activeChatClientMeta = document.getElementById('active-chat-client-meta');

    // Drawer Elements
    const btnToggleSources = document.getElementById('btn-toggle-sources');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const sourcesDrawer = document.getElementById('sources-drawer');
    const drawerBackdrop = document.getElementById('drawer-backdrop');

    // Chat active console
    const chatActiveConsole = document.getElementById('chat-active-console');
    const chatDragOverlay = document.getElementById('chat-drag-overlay');

    function toggleDrawer(isOpen) {
        if (!sourcesDrawer) return;
        if (isOpen) {
            sourcesDrawer.classList.add('open');
            drawerBackdrop?.classList.add('show');
        } else {
            sourcesDrawer.classList.remove('open');
            drawerBackdrop?.classList.remove('show');
        }
    }

    // Forms & Inputs (Sources)
    const chatSourcesForm = document.getElementById('chat-sources-form');
    const metaName = document.getElementById('meta-name');
    const metaCompany = document.getElementById('meta-company');
    const metaTitle = document.getElementById('meta-title');
    const metaEmail = document.getElementById('meta-email');
    const metaPhone = document.getElementById('meta-phone');
    const metaRep = document.getElementById('meta-rep');
    const metaTrack = document.getElementById('meta-track');

    // --- Track Checkbox ↔ Hidden Input Bidirectional Sync ---
    const trackCheckboxGroup = document.getElementById('track-checkbox-group');
    if (metaTrack && trackCheckboxGroup) {
        const trackCheckboxes = trackCheckboxGroup.querySelectorAll('input[type="checkbox"]');
        const nativeValueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

        // Sync checkboxes → hidden input
        function syncTrackFromCheckboxes() {
            const checked = Array.from(trackCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
            nativeValueDesc.set.call(metaTrack, checked.join(', '));
        }

        // Sync hidden input → checkboxes (called when .value is set programmatically)
        function syncCheckboxesFromTrack(newVal) {
            const vals = String(newVal).split(',').map(v => v.trim()).filter(Boolean);
            trackCheckboxes.forEach(cb => {
                cb.checked = vals.includes(cb.value);
            });
        }

        // Override .value on this specific element to intercept programmatic sets
        Object.defineProperty(metaTrack, 'value', {
            get() { return nativeValueDesc.get.call(this); },
            set(v) {
                nativeValueDesc.set.call(this, v);
                syncCheckboxesFromTrack(v);
            },
            configurable: true
        });

        // Listen for checkbox changes
        trackCheckboxes.forEach(cb => {
            cb.addEventListener('change', syncTrackFromCheckboxes);
        });

        // Initialize: sync checkboxes from current hidden input value
        syncCheckboxesFromTrack(metaTrack.value);
    }
    // --- End Track Checkbox Sync ---

    const sourceGdriveFileSelect = document.getElementById('source-gdrive-file');
    const sourceGdriveFileId = document.getElementById('source-gdrive-file-id');
    const btnRefreshGdrive = document.getElementById('btn-refresh-gdrive');

    const sourceLinkedinText = document.getElementById('source-linkedin-text');
    const sourceLinkedinFile = document.getElementById('source-linkedin-file');
    const sourceLinkedinDropzone = document.getElementById('source-linkedin-dropzone');

    const sourceIntakeText = document.getElementById('source-intake-text');

    const sourceTranscriptText = document.getElementById('source-transcript-text');
    const sourceTranscriptFile = document.getElementById('source-transcript-file');
    const sourceTranscriptDropzone = document.getElementById('source-transcript-dropzone');
    const sourceTranscriptProgress = document.getElementById('source-transcript-progress');
    const sourceTranscriptProgressBar = document.getElementById('source-transcript-progress-bar');
    const sourceTranscriptStatus = document.getElementById('source-transcript-status');

    const activeAudioContainer = document.getElementById('active-audio-container');
    const activeAudioPlayer = document.getElementById('active-audio-player');

    const btnLoadSample = document.getElementById('btn-load-sample');

    // PDF/Text Preview Modal Elements & Listeners
    const pdfPreviewModal = document.getElementById('pdf-preview-modal');
    const closePdfModalBtn = document.getElementById('close-pdf-modal-btn');
    const pdfModalTitle = document.getElementById('pdf-modal-title');
    const pdfRenderTarget = document.getElementById('pdf-render-target');
    const textPreviewTarget = document.getElementById('text-preview-target');

    if (closePdfModalBtn && pdfPreviewModal) {
        closePdfModalBtn.addEventListener('click', () => {
            pdfPreviewModal.classList.add('modal-hidden');
        });
    }
    if (pdfPreviewModal) {
        const backdrop = pdfPreviewModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                pdfPreviewModal.classList.add('modal-hidden');
            });
        }
    }

    // Chat Console Elements
    const chatMessagesLog = document.getElementById('chat-messages-log');
    const chatLoadingIndicator = document.getElementById('chat-loading-indicator');
    const chatUserInput = document.getElementById('chat-user-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatAttachBtn = document.getElementById('chat-attach-btn');
    const chatAttachFile = document.getElementById('chat-attach-file');
    const chatUploadProgress = document.getElementById('chat-upload-progress');
    const chatUploadProgressBar = document.getElementById('chat-upload-progress-bar');
    const chatUploadProgressText = document.getElementById('chat-upload-progress-text');
    // Predefined prompt buttons are managed dynamically via validation changes and event delegation

    // Setup Resizer Splitter
    const resizer = document.getElementById('workspace-splitter');
    const layoutContainer = document.querySelector('.client-chat-layout');
    if (resizer && layoutContainer) {
        let isResizing = false;
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const containerRect = layoutContainer.getBoundingClientRect();
            const newSidebarWidth = e.clientX - containerRect.left;
            if (newSidebarWidth > 180 && newSidebarWidth < 450) {
                layoutContainer.style.gridTemplateColumns = `${newSidebarWidth}px 12px 1fr`;
            }
        });
        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.body.style.cursor = '';
        });
        resizer.addEventListener('dblclick', () => {
            layoutContainer.style.gridTemplateColumns = '260px 12px 1fr';
        });
    }

    // --- Loading & Loading Chats list ---
    // --- Loading & Loading Chats list ---
    async function loadChatsList(preFetchedData = null) {
        try {
            chatsList = preFetchedData || await (await fetch('/api/history', { headers: { 'Cache-Control': 'no-cache' } })).json();
            renderChatsList();
        } catch (err) {
            console.error('Error loading chats:', err);
            showToast('Failed to load recent chats.');
        }
    }

    function renderChatsList() {
        if (typeof gdriveFolders !== 'undefined' && gdriveFolders && gdriveFolders.length > 0) {
            loadProspectsTree({ items: gdriveFolders });
        } else {
            loadProspectsTree();
        }
    }

    // Sidebar Search setup for GDrive files list
    if (chatSearch) {
        chatSearch.addEventListener('input', () => {
            const query = chatSearch.value.toLowerCase().trim();
            document.querySelectorAll('.gdrive-file-item').forEach(item => {
                const fileName = item.querySelector('.chat-list-item-title').innerText.toLowerCase();
                item.style.display = fileName.includes(query) ? 'block' : 'none';
            });
        });
    }

    // Dropdown population helper to prevent redundant file lists
    function populateGdriveDropdown(files) {
        if (!sourceGdriveFileSelect) return;
        sourceGdriveFileSelect.innerHTML = '<option value="">-- Select File from GDrive --</option>';
        if (files && files.length > 0) {
            files.forEach(file => {
                const opt = document.createElement('option');
                opt.value = file.id;
                opt.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                sourceGdriveFileSelect.appendChild(opt);
            });
        } else {
            sourceGdriveFileSelect.innerHTML = '<option value="">No files in client folder</option>';
        }
    }

    // --- Google Drive Explorer Loader ---
    async function loadGoogleDriveFiles(preFetchedData = null) {
        if (!sourceGdriveFileSelect) return;
        if (preFetchedData) {
            const files = preFetchedData.items ? preFetchedData.items.filter(f => !f.isFolder) : [];
            populateGdriveDropdown(files);
            return;
        }

        sourceGdriveFileSelect.innerHTML = '<option value="">-- Loading GDrive files... --</option>';
        try {
            const company = metaCompany ? metaCompany.value.trim() : '';
            let url = '/api/gdrive/list';
            if (activeFolderId) {
                url = `/api/gdrive/list?folderId=${encodeURIComponent(activeFolderId)}`;
                if (company) url += `&company=${encodeURIComponent(company)}`;
            } else if (company) {
                url = `/api/gdrive/list?company=${encodeURIComponent(company)}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('GDrive list failed');
            const data = await response.json();
            const files = data.items ? data.items.filter(f => !f.isFolder) : [];
            populateGdriveDropdown(files);
        } catch (err) {
            console.error('Error loading Google Drive files:', err);
            sourceGdriveFileSelect.innerHTML = '<option value="">Error loading GDrive files</option>';
        }
    }

    async function selectProspect(companyFolder, prospectName, filesData = null) {
        activeFolderId = companyFolder.id;
        activeProspectName = prospectName;
        
        // Highlight active folder and prospect in the sidebar
        document.querySelectorAll('.sidebar-folder-header').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.sidebar-prospect-item').forEach(el => el.classList.remove('active'));
        
        const folderHeader = document.querySelector(`.sidebar-folder-header[data-folder-id="${companyFolder.id}"]`);
        if (folderHeader) folderHeader.classList.add('active');
        const prospectItem = document.querySelector(`.sidebar-prospect-item[data-prospect-name="${prospectName}"][data-folder-id="${companyFolder.id}"]`);
        if (prospectItem) prospectItem.classList.add('active');
        
        // Clear inputs immediately to avoid displaying stale data from prior active chats
        if (metaName) metaName.value = prospectName || '';
        if (metaTitle) metaTitle.value = '';
        if (metaEmail) metaEmail.value = '';
        if (metaPhone) metaPhone.value = '';
        
        if (metaCompany) {
            metaCompany.value = companyFolder.name;
            metaCompany.dispatchEvent(new Event('input', { bubbles: true }));
            metaCompany.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Find matching history session (check active first, then fallback to most recent)
        let matchSession = null;
        if (currentChatId) {
            matchSession = chatsList.find(c => c.id === currentChatId);
            if (matchSession && (
                !matchSession.company || matchSession.company.toLowerCase().trim() !== companyFolder.name.toLowerCase().trim() ||
                !matchSession.name || matchSession.name.toLowerCase().trim() !== prospectName.toLowerCase().trim()
            )) {
                matchSession = null;
            }
        }
        if (!matchSession) {
            // Filter all matching sessions and sort descending by date (most recent first)
            const matches = chatsList.filter(c => 
                c.company && c.company.toLowerCase().trim() === companyFolder.name.toLowerCase().trim() &&
                c.name && c.name.toLowerCase().trim() === prospectName.toLowerCase().trim()
            );
            matches.sort((a, b) => new Date(b.date) - new Date(a.date));
            matchSession = matches[0] || null;
        }
        
        sourcesList.innerHTML = '<div style="color: #64748b; font-size: 0.75rem; padding: 1rem; text-align: center;">Loading files...</div>';
        
        try {
            if (matchSession) {
                // Fetch details and files list in parallel
                const [detailRes, filesRes] = await Promise.all([
                    fetch(`/api/history/detail?id=${encodeURIComponent(matchSession.id)}`),
                    filesData ? Promise.resolve({ ok: true, json: () => filesData }) : fetch(`/api/gdrive/list?folderId=${encodeURIComponent(companyFolder.id)}`)
                ]);
                
                if (!detailRes.ok) throw new Error('Failed to load chat details');
                if (!filesRes.ok) throw new Error('Failed to list files');
                
                const detailData = await detailRes.json();
                const resolvedFilesData = filesData || await filesRes.json();
                
                await selectChat(matchSession.id, detailData, resolvedFilesData);
                await loadSourcesForCompany(companyFolder.id, companyFolder.name, resolvedFilesData);
            } else {
                currentChatId = null;
                workspaceEmptyState.classList.add('hidden');
                workspaceActiveChat.classList.remove('hidden');
                chatMessagesLog.innerHTML = '';
                chatHistory = [];
                renderChatHistory();
                
                if (metaName) metaName.value = prospectName || '';
                if (metaTitle) metaTitle.value = '';
                if (metaEmail) metaEmail.value = '';
                if (metaPhone) metaPhone.value = '';
                if (metaRep) metaRep.value = 'Albert';
                if (metaTrack) metaTrack.value = 'Planning & Analytics (TM1)';
                
                const resolvedFilesData = filesData || await (await fetch(`/api/gdrive/list?folderId=${encodeURIComponent(companyFolder.id)}`)).json();
                await loadSourcesForCompany(companyFolder.id, companyFolder.name, resolvedFilesData);
            }
        } catch (err) {
            console.error('Error loading prospect data on select:', err);
            showToast('Failed to load prospect data.');
            sourcesList.innerHTML = '<div style="color: #ef4444; font-size: 0.75rem; padding: 1rem; text-align: center;">Failed to load files</div>';
        }
    }

    async function loadProspectsTree(preFetchedData = null) {
        if (!recentChatsList) return;
        recentChatsList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 1.5rem; text-align: center;">Loading folders...</div>';
        try {
            const data = preFetchedData || await (await fetch('/api/gdrive/list')).json();
            recentChatsList.innerHTML = '';
            
            if (data.items && data.items.length > 0) {
                const folders = data.items.filter(item => item.isFolder);
                // Deduplicate folders by name (case-insensitive) to prevent sidebar UI duplicates
                const seenNames = new Set();
                const uniqueFolders = [];
                folders.forEach(folder => {
                    if (folder.name) {
                        const normName = folder.name.trim().toLowerCase();
                        if (!seenNames.has(normName)) {
                            seenNames.add(normName);
                            uniqueFolders.push(folder);
                        }
                    }
                });
                gdriveFolders = uniqueFolders;
                if (uniqueFolders.length === 0) {
                    recentChatsList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 1.5rem; text-align: center;">No prospect folders found</div>';
                    return;
                }
                
                // If activeFolderId is not set, try to find a folder matching metaCompany
                if (!activeFolderId && metaCompany && metaCompany.value) {
                    const compName = metaCompany.value.trim().toLowerCase();
                    const matchingFolder = uniqueFolders.find(f => f.name.toLowerCase().trim() === compName);
                    if (matchingFolder) {
                        activeFolderId = matchingFolder.id;
                    }
                }
                
                let firstFolderObj = null;
                let firstProspectName = null;
                
                uniqueFolders.forEach((folder, index) => {
                    const folderItem = document.createElement('div');
                    folderItem.className = 'sidebar-folder-item';
                    folderItem.setAttribute('data-folder-id', folder.id);
                    folderItem.style.marginBottom = '0.5rem';
                    
                    const folderHeader = document.createElement('div');
                    folderHeader.className = 'sidebar-folder-header';
                    folderHeader.setAttribute('data-folder-id', folder.id);
                    if (activeFolderId === folder.id) {
                        folderHeader.classList.add('active');
                    }
                    
                    const toggleHtml = `<span class="sidebar-folder-toggle" style="display:inline-block; transition:transform 0.2s ease;">▼</span>`;
                    
                    folderHeader.innerHTML = `
                        <div class="sidebar-folder-title">
                            📁 ${folder.name}
                        </div>
                        ${toggleHtml}
                    `;
                    
                    folderItem.appendChild(folderHeader);
                    
                    const contents = document.createElement('div');
                    contents.className = 'sidebar-folder-contents';
                    const isExpanded = expandedCompanies.has(folder.name) || activeFolderId === folder.id;
                    if (isExpanded) {
                        contents.classList.remove('collapsed');
                    } else {
                        contents.classList.add('collapsed');
                        const toggleSpan = folderHeader.querySelector('.sidebar-folder-toggle');
                        if (toggleSpan) toggleSpan.style.transform = 'rotate(-90deg)';
                    }
                    
                    const sessionsList = document.createElement('div');
                    sessionsList.className = 'sidebar-prospect-sessions'; // Reusing class for styling
                    
                    // 1. New Session button
                    const newSessionBtn = document.createElement('div');
                    newSessionBtn.className = 'sidebar-new-session-btn';
                    newSessionBtn.innerText = '➕ New Session';
                    newSessionBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        startNewSessionForProspect(folder, '');
                    });
                    sessionsList.appendChild(newSessionBtn);
                    
                    // 2. Fetch history items for this company
                    const matchedSessions = chatsList.filter(c => 
                        c.company && c.company.toLowerCase().trim() === folder.name.toLowerCase().trim()
                    );
                    
                    // Sort by date descending
                    matchedSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
                    
                    matchedSessions.forEach(session => {
                        const sessionItem = document.createElement('div');
                        sessionItem.className = 'sidebar-session-item';
                        sessionItem.setAttribute('data-session-id', session.id);
                        if (currentChatId === session.id) {
                            sessionItem.classList.add('active');
                        }
                        
                        let displayDate = '';
                        try {
                            const d = new Date(session.date);
                            displayDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        } catch (e) {}
                        
                        // Append prospect name if available in the history metadata
                        const sessionContact = session.name && session.name !== 'Unknown Name' ? ` [${session.name}]` : '';
                        const titleText = (session.title || 'Untitled Session') + sessionContact;
                        
                        const textSpan = document.createElement('span');
                        textSpan.className = 'session-text';
                        textSpan.innerText = `💬 ${titleText} (${displayDate})`;
                        sessionItem.appendChild(textSpan);
                        
                        const delBtn = document.createElement('button');
                        delBtn.className = 'btn-delete-session';
                        delBtn.type = 'button';
                        delBtn.innerText = '🗑️';
                        delBtn.title = 'Delete Session';
                        delBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            confirmDeleteSession(session.id, titleText);
                        });
                        sessionItem.appendChild(delBtn);

                        sessionItem.title = `${titleText} (${new Date(session.date).toLocaleString()})`;
                        
                        sessionItem.addEventListener('click', (e) => {
                            e.stopPropagation();
                            selectChat(session.id);
                        });
                        sessionsList.appendChild(sessionItem);
                    });
                    
                    contents.appendChild(sessionsList);
                    
                    folderItem.appendChild(contents);
                    
                    folderHeader.addEventListener('click', async () => {
                        const isCollapsed = contents.classList.toggle('collapsed');
                        const toggleSpan = folderHeader.querySelector('.sidebar-folder-toggle');
                        if (toggleSpan) {
                            toggleSpan.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
                        }
                        if (isCollapsed) {
                            expandedCompanies.delete(folder.name);
                        } else {
                            expandedCompanies.add(folder.name);
                        }
                        await selectProspect(folder, '');
                    });
                    
                    recentChatsList.appendChild(folderItem);
                    if (index === 0) {
                        firstFolderObj = folder;
                        firstProspectName = '';
                    }
                });
                
                const isEmptyState = workspaceEmptyState && !workspaceEmptyState.classList.contains('hidden');
                if (!currentChatId && !activeFolderId && firstFolderObj && isEmptyState) {
                    await selectProspect(firstFolderObj, firstProspectName);
                } else if (activeFolderId) {
                    const activeFolder = uniqueFolders.find(f => f.id === activeFolderId);
                    if (activeFolder) {
                        await loadSourcesForCompany(activeFolderId, activeFolder.name);
                    }
                }
            } else {
                recentChatsList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 1.5rem; text-align: center;">No prospect folders found</div>';
            }
        } catch (err) {
            console.error('Error loading prospects tree:', err);
            recentChatsList.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem; padding: 1.5rem; text-align: center;">Error loading folders</div>';
        }
    }

    async function loadSourcesForCompany(folderId, companyName, preFetchedFiles = null) {
        if (!sourcesList) return;
        sourcesList.innerHTML = '<div style="color: #64748b; font-size: 0.75rem; padding: 1rem; text-align: center;">Loading files...</div>';
        try {
            const data = preFetchedFiles || await (await fetch(`/api/gdrive/list?folderId=${encodeURIComponent(folderId)}`)).json();
            sourcesList.innerHTML = '';
            
            const files = data.items ? data.items.filter(f => !f.isFolder) : [];
            
            // Construct and render metadata context header at the top
            const headerInfo = document.createElement('div');
            headerInfo.className = 'sources-header-info';
            headerInfo.style.cssText = 'padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 0.75rem; font-size: 0.8rem; color: #475569; background: #f8fafc; border-radius: 6px;';
            headerInfo.innerHTML = `
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 0.25rem;">${companyName}</div>
                <div style="color: #64748b;">Account Documents</div>
            `;
            sourcesList.appendChild(headerInfo);
            
            populateGdriveDropdown(files);
            
            if (files.length === 0) {
                const noFilesMsg = document.createElement('div');
                noFilesMsg.style.cssText = 'color: #64748b; font-size: 0.75rem; padding: 1rem; text-align: center;';
                noFilesMsg.innerText = 'No files inside folder';
                sourcesList.appendChild(noFilesMsg);
                return;
            }
            
            files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'sidebar-file-item';
                if (sourceGdriveFileId && sourceGdriveFileId.value === file.id) {
                    fileItem.classList.add('active');
                }
                
                fileItem.innerHTML = `
                    <div class="sidebar-file-title">
                        <span>📄</span> ${file.name}
                    </div>
                    <span class="sidebar-file-size">${(file.size / 1024).toFixed(1)} KB</span>
                `;
                
                fileItem.addEventListener('click', () => {
                    document.querySelectorAll('.sidebar-file-item').forEach(el => el.classList.remove('active'));
                    fileItem.classList.add('active');
                    
                    if (pdfPreviewModal) {
                        pdfPreviewModal.classList.remove('modal-hidden');
                    }
                    if (pdfModalTitle) {
                        pdfModalTitle.innerText = file.name || 'Document Preview';
                    }
                    if (pdfRenderTarget) {
                        pdfRenderTarget.classList.add('hidden');
                    }
                    if (textPreviewTarget) {
                        textPreviewTarget.classList.remove('hidden');
                        textPreviewTarget.innerHTML = '<div style="color: #64748b; font-size: 0.9rem; padding: 2rem; text-align: center;">⚡ Reading file content...</div>';
                    }
                    
                    setTimeout(async () => {
                        try {
                            const response = await fetch(`/api/gdrive/read?fileId=${encodeURIComponent(file.id)}&ignoreCache=true`);
                            if (!response.ok) throw new Error("GDrive read failed");
                            const data = await response.json();
                            if (textPreviewTarget) {
                                try {
                                    const markdown = data.content || '';
                                    const parsedHtml = (window.marked && typeof window.marked.parse === 'function')
                                        ? window.marked.parse(markdown)
                                        : (window.marked && typeof window.marked === 'function')
                                            ? window.marked(markdown)
                                            : null;
                                    
                                    if (parsedHtml !== null) {
                                        const cleanHtml = (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function')
                                            ? window.DOMPurify.sanitize(parsedHtml)
                                            : parsedHtml;
                                        textPreviewTarget.innerHTML = cleanHtml || '[Empty File]';
                                    } else {
                                        textPreviewTarget.textContent = markdown || '[Empty File]';
                                    }
                                } catch (renderErr) {
                                    console.warn("Markdown rendering failed:", renderErr);
                                    textPreviewTarget.textContent = data.content || '[Empty File]';
                                }
                            }
                            gdriveFileContent = data.content || '';
                            if (sourceGdriveFileId) sourceGdriveFileId.value = file.id;
                            if (sourceGdriveFileSelect) {
                                sourceGdriveFileSelect.value = file.id;
                            }
                            if (typeof updateValidationBadges === 'function') updateValidationBadges();
                            if (typeof triggerAutoSave === 'function') triggerAutoSave();
                        } catch (err) {
                            console.error("Error reading file:", err);
                            if (textPreviewTarget) {
                                textPreviewTarget.innerHTML = `<div style="color: #ef4444; font-size: 0.9rem; padding: 2rem; text-align: center;">❌ Failed to load file content.<br><span style="font-size: 0.8rem; color: #94a3b8;">${err.message}</span></div>`;
                            }
                        }
                    }, 100);
                });
                
                sourcesList.appendChild(fileItem);
            });
        } catch (err) {
            console.error('Error loading company files:', err);
            sourcesList.innerHTML = '<div style="color: #ef4444; font-size: 0.75rem; padding: 1rem; text-align: center;">Failed to load files</div>';
        }
    }

    // --- Start New Session Helper ---
    async function startNewSessionForProspect(companyFolder, prospectName) {
        currentChatId = null;
        activeFolderId = companyFolder.id;
        activeProspectName = prospectName || '';
        chatHistory = [];
        chatMessagesLog.innerHTML = '';
        
        // Auto-populate inputs
        if (metaName) metaName.value = activeProspectName;
        if (metaCompany) {
            metaCompany.value = companyFolder.name;
            metaCompany.dispatchEvent(new Event('input', { bubbles: true }));
            metaCompany.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (metaTitle) metaTitle.value = '';
        if (metaEmail) metaEmail.value = '';
        if (metaPhone) metaPhone.value = '';
        if (metaRep) metaRep.value = 'Albert';
        if (metaTrack) metaTrack.value = 'Planning & Analytics (TM1)';
        
        // Set headers
        if (activeChatClientTitle) {
            activeChatClientTitle.innerText = activeProspectName ? `${companyFolder.name} (${activeProspectName})` : companyFolder.name;
        }
        if (activeChatClientMeta) activeChatClientMeta.innerText = `New Chat Session — Interest: Planning & Analytics (TM1)`;
        
        if (workspaceEmptyState) workspaceEmptyState.classList.add('hidden');
        if (workspaceActiveChat) workspaceActiveChat.classList.remove('hidden');
        
        chatHistory = [];
        renderChatHistory();
        
        sourcesList.innerHTML = '<div style="color: #64748b; font-size: 0.75rem; padding: 1rem; text-align: center;">Loading files...</div>';
        try {
            const resolvedFilesData = await (await fetch(`/api/gdrive/list?folderId=${encodeURIComponent(companyFolder.id)}`)).json();
            await loadSourcesForCompany(companyFolder.id, companyFolder.name, resolvedFilesData);
        } catch(e) {
            console.error('Failed to pre-fetch files for new session', e);
            sourcesList.innerHTML = '<div style="color: #ef4444; font-size: 0.75rem; padding: 1rem; text-align: center;">Error loading files</div>';
        }
        
        // Re-render the sidebar to reflect new active state
        renderChatsList();
    }

    // --- Delete Chat Session ---
    async function confirmDeleteSession(sessionId, sessionTitle) {
        const confirmed = await showConfirmModal({
            title: 'Delete Chat Session',
            message: `Are you sure you want to delete the chat session "${sessionTitle || 'Untitled Session'}"? This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            type: 'danger'
        });
        if (confirmed) {
            try {
                const res = await fetch(`/api/history?id=${encodeURIComponent(sessionId)}`, {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error(`HTTP status ${res.status}`);
                showToast('Chat session deleted successfully.');
                
                // If the deleted session was the active one, clear active workspace state
                if (currentChatId === sessionId) {
                    currentChatId = null;
                    chatHistory = [];
                    chatMessagesLog.innerHTML = '';
                    
                    // Re-select the active prospect to load folder details or fall back to empty state
                    const activeFolder = gdriveFolders.find(f => f.id === activeFolderId);
                    if (activeFolder && activeProspectName) {
                        selectProspect(activeFolder, activeProspectName);
                    } else {
                        workspaceEmptyState.classList.remove('hidden');
                        workspaceActiveChat.classList.add('hidden');
                    }
                }
                
                // Reload list from server and update UI
                await loadChatsList();
            } catch (err) {
                console.error('Failed to delete session:', err);
                showToast(`Failed to delete session: ${err.message}`);
            }
        }
    }

    // --- Select Chat ---
    async function selectChat(id, preFetchedDetail = null, preFetchedFiles = null) {
        currentChatId = id;
        renderChatsList();
        toggleDrawer(false);
 
        workspaceEmptyState.classList.add('hidden');
        workspaceActiveChat.classList.remove('hidden');
        chatMessagesLog.innerHTML = '';
 
        try {
            const data = preFetchedDetail || await (await fetch(`/api/history/detail?id=${encodeURIComponent(id)}`)).json();
 
            // Populate metadata
            metaName.value = data.name || '';
            activeProspectName = data.name || null;
            metaCompany.value = data.company || '';
            metaTitle.value = data.title || '';
            metaEmail.value = data.email || '';
            metaPhone.value = data.phone || '';
            metaRep.value = data.rep || 'Albert';
            metaTrack.value = data.track || 'Planning & Analytics (TM1)';
            
            // Set folder ID
            activeFolderId = data.gDriveFolderId || null;
            
            gdriveFileContent = data.gDriveFileContent || '';
            sourceGdriveFileId.value = data.gDriveFileId || '';
            
            if (preFetchedFiles) {
                const files = preFetchedFiles.items ? preFetchedFiles.items.filter(f => !f.isFolder) : [];
                populateGdriveDropdown(files);
            } else {
                await loadGoogleDriveFiles();
            }
            if (data.gDriveFileId) {
                sourceGdriveFileSelect.value = data.gDriveFileId;
            } else if (data.gDriveFile || data.oneDriveFile) {
                const filename = data.gDriveFile || data.oneDriveFile;
                const options = Array.from(sourceGdriveFileSelect.options);
                const matchedOpt = options.find(opt => opt.text.includes(filename));
                if (matchedOpt) {
                    sourceGdriveFileSelect.value = matchedOpt.value;
                    sourceGdriveFileId.value = matchedOpt.value;
                }
            }

            // Populate source textareas from saved session data
            sourceLinkedinText.value = data.linkedinInfo || data.linkedin || '';
            sourceIntakeText.value = data.intakeAnswers || data.intake || '';
            sourceTranscriptText.value = data.transcript || '';

            // --- AUTO-INGEST: If textareas are empty, try loading content from GDrive files in batch ---
            // This bridges the gap where files exist in GDrive but were never saved in the session JSON.
            if (activeFolderId && (!sourceLinkedinText.value.trim() || !sourceIntakeText.value.trim() || !sourceTranscriptText.value.trim())) {
                try {
                    const batchRes = await fetch(`/api/gdrive/batch-read?folderId=${encodeURIComponent(activeFolderId)}&ignoreCache=true`);
                    if (batchRes.ok) {
                        const batchData = await batchRes.json();
                        let updated = false;

                        if (batchData.linkedin && !sourceLinkedinText.value.trim()) {
                            sourceLinkedinText.value = batchData.linkedin;
                            console.log(`📄 Auto-ingested LinkedIn Profile content`);
                            updated = true;
                        }
                        if (batchData.intake && !sourceIntakeText.value.trim()) {
                            sourceIntakeText.value = batchData.intake;
                            console.log(`📄 Auto-ingested Intake Answers content`);
                            updated = true;
                        }
                        if (batchData.transcript && !sourceTranscriptText.value.trim()) {
                            sourceTranscriptText.value = batchData.transcript;
                            console.log(`📄 Auto-ingested Call Transcript content`);
                            updated = true;
                        }

                        if (updated) {
                            updateValidationBadges();
                            // Auto-save the session with the newly ingested data so it persists
                            triggerAutoSave();
                        }
                    }
                } catch (autoIngestErr) {
                    console.warn('⚠️ Auto-ingestion from GDrive batch-read failed:', autoIngestErr.message);
                }
            }

            // Setup Header Info
            activeChatClientTitle.innerText = `${data.company} (${data.name})`;
            activeChatClientMeta.innerText = `${data.title || 'No Title'} — Interest: ${data.track || 'Planning & Analytics (TM1)'}`;

            // Distance setup
            transitDistance = data.transitDistance || "Online/Phone call only (Distance unavailable)";

            // Restore Chat history
            if (Array.isArray(data.messages) && data.messages.length > 0) {
                chatHistory = data.messages;
            } else {
                // If it is an old dossier or synthesis, construct initial messages for backward compatibility
                chatHistory = [];
                if (data.type === 'dossier' && data.content) {
                    chatHistory.push({
                        role: 'assistant',
                        content: `**[Lead Prep Briefing]**\n\n${data.content}`,
                        timestamp: data.date
                    });
                } else if (data.type === 'synthesis' && data.content) {
                    let combinedText = "**[Call Reports Summary]**\n\n";
                    const docs = typeof data.content === 'object' ? data.content : {};
                    for (const key in docs) {
                        combinedText += `### ${key.toUpperCase()}\n${docs[key]}\n\n`;
                    }
                    chatHistory.push({
                        role: 'assistant',
                        content: combinedText,
                        timestamp: data.date
                    });
                } else {
                    chatHistory = [];
                }
            }
            renderChatHistory();
            updateValidationBadges();
            renderChatsList();

        } catch (err) {
            console.error('Error loading chat detail:', err);
            showToast('Failed to load chat details.');
        }
    }

    /**
     * Parse simple Markdown inline code, bolding, and lists into HTML.
     */
    function formatMessageContent(content) {
        if (!content) return '';
        let escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        // Parse inline code
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Parse bold markdown
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Parse lists
        const lines = escaped.split('\n');
        let inList = false;
        const processedLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const liContent = trimmed.substring(2);
                let listHtml = '';
                if (!inList) {
                    listHtml += '<ul class="chat-message-list">';
                    inList = true;
                }
                listHtml += `<li>${liContent}</li>`;
                return listHtml;
            } else {
                let suffix = '';
                if (inList) {
                    suffix = '</ul>';
                    inList = false;
                }
                return suffix + line;
            }
        });
        if (inList) {
            processedLines.push('</ul>');
        }
        
        let htmlResult = processedLines.join('\n');
        htmlResult = htmlResult.replace(/\n/g, '<br>');
        return htmlResult;
    }

    function renderChatHistory() {
        chatMessagesLog.innerHTML = '';
        chatHistory.forEach((msg, idx) => {
            const card = document.createElement('div');
            card.className = `chat-message-card ${msg.role === 'user' ? 'user' : 'assistant'}`;
            
            if (msg.role === 'assistant' && msg.content.includes('[INSUFFICIENT_DATA_FOR_REPORT]')) {
                card.className = 'chat-message-card assistant error-state';
                const rawCompany = metaCompany?.value?.trim() || '';
                const companyName = rawCompany.split('\n')[0].split('---')[0].trim();
                const companySnippet = companyName ? ` for <strong>${companyName}</strong>` : '';
                card.innerHTML = `
                    <div class="insufficient-data-card">
                        <div class="card-title">
                            <i data-lucide="alert-triangle" style="width: 16px; height: 16px; color: #dc2626;"></i>
                            <span>Insufficient Source Data</span>
                        </div>
                        <div class="card-description">
                            Tiny cannot generate this report${companySnippet} because the required source information (e.g. call transcript, LinkedIn biography, or booking intake) is missing. Please open the <strong>Sources Drawer</strong> and fill in the missing inputs.
                        </div>
                    </div>
                `;
            } else {
                const pre = document.createElement('pre');
                pre.className = 'chat-message-content';
                pre.innerHTML = formatMessageContent(msg.content);
                card.appendChild(pre);
            }

            // Add actions for assistant messages (plain text copy and email triggers)
            if (msg.role === 'assistant' && !msg.content.includes('[INSUFFICIENT_DATA_FOR_REPORT]')) {
                const actions = document.createElement('div');
                actions.className = 'chat-message-actions';
                
                const btnCopy = document.createElement('button');
                btnCopy.type = 'button';
                btnCopy.className = 'chat-message-btn';
                btnCopy.innerText = '📋 Copy';
                btnCopy.addEventListener('click', () => {
                    navigator.clipboard.writeText(msg.content);
                    showToast('Copied to clipboard!');
                });
                actions.appendChild(btnCopy);

                // Add recap email dispatcher button if it matches email format
                const isRecapEmail = msg.content.includes('takeaways') || 
                                     msg.content.includes('Recap') || 
                                     msg.content.includes('Kind regards');
                                     
                if (isRecapEmail) {
                    const btnSendEmail = document.createElement('button');
                    btnSendEmail.type = 'button';
                    btnSendEmail.className = 'chat-message-btn';
                    btnSendEmail.innerText = '✉️ Send Recap';
                    btnSendEmail.addEventListener('click', async () => {
                        if (!metaEmail.value.trim()) {
                            showToast("Error: Client email is missing!");
                            return;
                        }
                        btnSendEmail.disabled = true;
                        btnSendEmail.innerText = '⏳ Sending...';
                        try {
                            const res = await fetch('/api/email/recap', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: metaEmail.value.trim(),
                                    name: metaName.value.trim(),
                                    company: metaCompany.value.trim(),
                                    recapText: msg.content,
                                    rep: metaRep.value
                                })
                            });
                            const resData = await res.json();
                            if (res.ok && resData.status === 'success') {
                                showToast("✔️ Recap email sent successfully!");
                                btnSendEmail.innerText = '✉️ Sent';
                            } else {
                                throw new Error(resData.error || 'Dispatch failed');
                            }
                        } catch (err) {
                            showToast(`Failed to send email: ${err.message}`);
                            btnSendEmail.disabled = false;
                            btnSendEmail.innerText = '✉️ Send Recap';
                        }
                    });
                    actions.appendChild(btnSendEmail);
                }
                
                card.appendChild(actions);
            }

            chatMessagesLog.appendChild(card);
        });

        // Scroll to bottom
        chatMessagesLog.scrollTop = chatMessagesLog.scrollHeight;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // --- Save Sources / Update client chat ---
    function parseInitPrompt(text) {
        let name = '';
        let company = '';
        let email = '';
        
        // 1. Match email address
        const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            email = emailMatch[1].trim();
        }
        
        // 2. Match explicit tags/labels
        const nameMatch = text.match(/(?:client|name|prospect):[ \t]*([^,\n\r]+)/i);
        const companyMatch = text.match(/(?:company|companmy|compny|copmany|compnay|companey|organization|org|co):[ \t]*([^,\n\r]+)/i);
        
        if (nameMatch) {
            name = nameMatch[1].trim();
        }
        if (companyMatch) {
            company = companyMatch[1].trim();
        }
        
        // 3. Match natural language patterns (e.g. Sarah Chen at Meridian Logistics)
        if (!name || !company) {
            const atMatch = text.match(/([A-Z][a-zA-Z0-9\s._-]{1,30})\s+at\s+([A-Z][a-zA-Z0-9\s._-]{1,30})/);
            if (atMatch) {
                if (!name) name = atMatch[1].trim();
                if (!company) company = atMatch[2].trim();
            }
        }
        
        // 4. Default fallbacks if email exists but name/company are missing
        if (!name && email) {
            name = email.split('@')[0];
        }
        if (!company && email) {
            company = email.split('@')[1].split('.')[0];
        }
        
        return { name, company, email };
    }

    async function saveDiscoverySession(name, company, email) {
        if (metaName) metaName.value = name;
        if (metaCompany) metaCompany.value = company;
        if (metaEmail) metaEmail.value = email;

        // Perform distance calculation dynamically
        try {
            const distanceRes = await fetch('/api/calculate-distance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination: company })
            });
            if (distanceRes.ok) {
                const dData = await distanceRes.json();
                transitDistance = dData.distanceString || "Online/Phone call only (Distance unavailable)";
            }
        } catch (err) {
            console.warn("API distance check failed:", err.message);
        }

        const payload = {
            id: currentChatId || undefined,
            type: 'synthesis', // Unified type for chat persistence
            name: name,
            company: company,
            title: metaTitle ? metaTitle.value.trim() : '',
            email: email,
            phone: metaPhone ? metaPhone.value.trim() : '',
            rep: metaRep ? metaRep.value : 'Albert',
            track: metaTrack ? metaTrack.value : 'Planning & Analytics (TM1)',
            oneDriveFile: sourceGdriveFileSelect ? (sourceGdriveFileSelect.options[sourceGdriveFileSelect.selectedIndex]?.text || '') : '',
            gDriveFile: sourceGdriveFileSelect ? (sourceGdriveFileSelect.options[sourceGdriveFileSelect.selectedIndex]?.text || '') : '',
            gDriveFileId: sourceGdriveFileId ? sourceGdriveFileId.value : '',
            gDriveFileContent: gdriveFileContent,
            linkedinInfo: sourceLinkedinText ? sourceLinkedinText.value.trim() : '',
            intakeAnswers: sourceIntakeText ? sourceIntakeText.value.trim() : '',
            transcript: sourceTranscriptText ? sourceTranscriptText.value.trim() : '',
            transitDistance: transitDistance,
            gDriveFolderId: activeFolderId || undefined,
            messages: chatHistory
        };

        try {
            const response = await fetch('/api/history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to save sources');

            showToast('Sources and metadata saved successfully.');
            
            // If it was a new chat, update currentChatId
            if (!currentChatId) {
                currentChatId = result.id;
            }
            
            await loadChatsList();
            // Setup Header Info directly to prevent clearing chat history and race conditions
            if (activeChatClientTitle) activeChatClientTitle.innerText = `${payload.company} (${payload.name})`;
            if (activeChatClientMeta) activeChatClientMeta.innerText = `${payload.title || 'No Title'} — Interest: ${payload.track || 'Planning & Analytics (TM1)'}`;
            renderChatHistory();

        } catch (err) {
            console.error('Error saving sources:', err);
            showToast(`Error saving sources: ${err.message}`);
        }
    }

    const btnSaveSources = document.getElementById('btn-save-sources');
    if (btnSaveSources) {
        btnSaveSources.addEventListener('click', async (e) => {
            e.preventDefault();
            const name = metaName ? metaName.value.trim() : '';
            const company = metaCompany ? metaCompany.value.trim() : '';
            const email = metaEmail ? metaEmail.value.trim() : '';
            
            if (!name || !company) {
                showToast('Please fill in both Client Name and Company.');
                return;
            }

            const confirmed = await showConfirmModal({
                title: 'Save Prospect Sources',
                message: `Are you sure you want to save the prospect details and initialize/update the session for "${name}" at "${company}"?`,
                confirmText: 'Save',
                cancelText: 'Cancel',
                type: 'primary'
            });

            if (confirmed) {
                await saveDiscoverySession(name, company, email);
            }
        });
    }

    // --- Create New Chat ---
    const handleNewChat = () => {
        currentChatId = null;
        activeProspectName = null;
        renderChatsList();

        workspaceEmptyState.classList.add('hidden');
        workspaceActiveChat.classList.remove('hidden');
        chatMessagesLog.innerHTML = '';

        toggleDrawer(true);

        // Clear inputs
        metaName.value = '';
        metaCompany.value = '';
        metaTitle.value = '';
        metaEmail.value = '';
        metaPhone.value = '';
        metaRep.value = 'Albert';
        metaTrack.value = 'Planning & Analytics (TM1)';
        sourceGdriveFileSelect.innerHTML = '<option value="">-- Select File from GDrive --</option>';
        sourceGdriveFileId.value = '';
        gdriveFileContent = '';
        sourceLinkedinText.value = '';
        sourceIntakeText.value = '';
        sourceTranscriptText.value = '';
        activeAudioContainer.classList.add('hidden');
        activeAudioPlayer.src = '';

        activeChatClientTitle.innerText = "New Chat";
        activeChatClientMeta.innerText = "Add client sources and save to start conversation with Tiny";

        chatHistory = [];
        chatMessagesLog.innerHTML = `<div style="font-size:0.95rem;color:#64748b;text-align:center;padding:2rem;">Add client details and click <strong>Save Sources</strong> to begin.</div>`;
        
        // Clear active file selection state and reload file tree and files list in parallel
        if (sourceGdriveFileId) sourceGdriveFileId.value = '';
        gdriveFileContent = '';
        
        Promise.all([
            loadGoogleDriveFiles(),
            loadProspectsTree()
        ]);
        updateValidationBadges();
    };

    if (btnNewChat) {
        btnNewChat.addEventListener('click', handleNewChat);
    }
    if (btnNewChatActive) {
        btnNewChatActive.addEventListener('click', handleNewChat);
    }

    // --- LLM Interaction Helpers ---
    async function callTinyAPI(promptText) {
        // Parse metadata on first prompt if session is not yet initialized
        if (!currentChatId) {
            // Bypass metadata parser if the prompt is a file/folder creation command
            const isCreationCommand = /(?:create|make|generate|add)\s+(?:a\s+)?(folder|directory|file|readme|prospect|client|lead|company)/i.test(promptText) ||
                                      /(?:create|make|generate|add)\s+.*?\s+at\s+/i.test(promptText);
            if (!isCreationCommand) {
                const parsed = parseInitPrompt(promptText);
                if (parsed.name && parsed.company) {
                    const confirmed = await showConfirmModal({
                        title: 'Add New Prospect',
                        message: `Would you like to add a new prospect and initialize a session for "${parsed.name}" at "${parsed.company}"?`,
                        confirmText: 'Add Prospect',
                        cancelText: 'Cancel',
                        type: 'primary'
                    });
                    if (confirmed) {
                        await saveDiscoverySession(parsed.name, parsed.company, parsed.email);
                    }
                    return;
                }
            }
        }

        // Combine chat history sessions and Google Drive client folders
        const activeLeads = [];
        const seenCompanies = new Set();
        
        // Add existing chats from chatsList first
        chatsList.forEach(c => {
            if (c.company) {
                const normalizedCo = c.company.toLowerCase().trim();
                activeLeads.push(`- ${c.name || 'Unknown Name'} at ${c.company} (${c.track || 'TM1 & AI'})`);
                seenCompanies.add(normalizedCo);
            }
        });
        
        // Add any remaining Google Drive folders that don't have local chat history files
        gdriveFolders.forEach(folder => {
            if (folder.name) {
                const normalizedCo = folder.name.toLowerCase().trim();
                if (!seenCompanies.has(normalizedCo)) {
                    activeLeads.push(`- Unknown Name at ${folder.name} (TM1 & AI)`);
                    seenCompanies.add(normalizedCo);
                }
            }
        });
        
        const leadsSummary = activeLeads.join('\n') || 'None';

        // Compile context and previous history
        const systemPrompt = `You are "Tiny", a helpful, conversational AI sales assistant for Octane Software Solutions.
You help sales representatives prepare for pre-screening calls, analyze transcripts, and generate plain text deliverables.
You are given the following sources for the client:
- Client Name: ${metaName.value.trim()}
- Company: ${metaCompany.value.trim()}
- Job Title: ${metaTitle.value.trim()}
- Email: ${metaEmail.value.trim()}
- Phone: ${metaPhone.value.trim()}
- Sales Rep: ${metaRep.value}
- Service Track: ${metaTrack.value}
- Connected Google Drive SOW: ${sourceGdriveFileSelect.options[sourceGdriveFileSelect.selectedIndex]?.text || 'None'}
- Google Drive SOW Content: ${gdriveFileContent}
- LinkedIn Profile Bio: ${sourceLinkedinText.value.trim()}
- Booking Intake Answers: ${sourceIntakeText.value.trim()}
- Call Transcript: ${sourceTranscriptText.value.trim()}
- Travel Distance from Amendra's Origin: ${transitDistance}

Active Leads in System:
${leadsSummary}

Reference Catalog & Services Specifications (SOLE SOURCE OF TRUTH):
- DevOps Blue Support: Includes 24/7 SLA ticketing (Urgent <1hr, High 4hr, Medium 8hr, Low 24hr), rollover support hours, monthly health checks, and free training library.
- DevOps Red Support: Advanced DevOps support tier. Rollover hours, certified developers, onshore/offshore hybrid model.
- TM1 Flight Check: 6-day analysis, RAM/HDD log file performance checks, user interviews.
- Data Integration Connector: Setup + email support, 60-day free trial.
- watsonx Orchestrate POC: 2-6 weeks co-creation, working demo, client resources.
- Custom Training: Standard power user training sessions.

Rules:
1. NEVER quote numerical prices, rates, or dollar values in any output. Focus exclusively on qualitative service specifications.
2. Produce deliverables in PLAIN TEXT. Do NOT use HTML formatting, custom markdown styling, or branding guidelines. Use simple headers, dashes, and spacing.
3. Be concise and factual. Do not make up facts. Use the client details provided.
4. If the required input data for the requested report or query is missing from the sources (e.g., LinkedIn and Intake are both empty when generating a Lead Sheet, or the transcript is empty when generating a recap email, migration assessment, action items, summary sheet, notes, or proposal), you MUST output exactly '[INSUFFICIENT_DATA_FOR_REPORT]'. Do NOT fabricate, placeholder, or assume any information.
5. If the user asks for focus prompts or query sections, resolve them using these specific guidelines:
    - "Identify the type of sale / Are we selling them TM1 planning analytics or artificial intelligence?": Determine the track from the Service Track field and booking details. Decide if we are selling them TM1 planning analytics or artificial intelligence.
    - "Business activity": Scan the client's website. Tell me which industry sector they belong to. Estimate their revenue and size of their headcount. Give me a brief description of their business. Tell me specifically each of their products and services. Give me exactly one sentence for each.
    - "Customer match": How well does this customer match to our list of customer profiles? Have we served this organisation or a similar organisation in the past (e.g. Steric, Shift, GreyOrange, mycar)?
    - "Assessment": How does their business activity relate to TM1 or AI? What services should we offer them qualitatively from the catalog (never quote pricing values)? What are their likely painpoints we need to address?
    - "Conversation starter": Scan the client's website and their personal LinkedIn profile. Find news or interesting stories that can be used to connect with them. Provide three stories at a personal level. Look at their past working history and see if there are organisations that we have done work for and cite the work that we did. If not at a personal level, offer stories involving the organisation (found on their news and press release pages on the website). Stories regarding the organisation need to connect to our subject matter TM1 and AI. Otherwise, they are not relevant.
    - "Complementary applications": In the customers current stack, identify applications they are using that are complementary with us (e.g. NetSuite, SAP, Dynamics, Power BI, Tableau).
    - "Competing applications": In the customers current stack, identify applications they are using that are competing with us (e.g. Anaplan, Workday Adaptive Planning, Board).
    - "Competing consulting firms": Did the client mention they are working with a firm competing with us?
6. If a source field (such as the LinkedIn Profile Bio or Booking Intake Answers) is empty or contains placeholder text, you MUST explain the missing data to the user rather than calling the upload tool. Do not call any upload tools unless you are explicitly given new profile/content data to upload.
7. If the user asks you to analyze, search, read, or retrieve information from a prospect's files (such as a LinkedIn profile PDF, call transcript, or intake document) and the corresponding source fields above are empty or incomplete, you MUST call 'search_prospect_files' or 'read_prospect_file' to dynamically query and fetch the content. When a prospect's name (e.g. Sarah Chen) is provided in the query, refer to the "Active Leads in System" list to map them to their correct company name (e.g. Meridian Logistics) so you can pass the correct company argument to the tool.
8. If the user asks to save, register, or log call notes, summaries, transcripts, or details, but does not explicitly provide the conversation notes, content, or transcript text within their prompt, you MUST be skeptical. Do NOT assume or fabricate details from pre-existing profile or intake answers. Instead, politely ask the user to provide the specific details or notes of their conversation before calling 'register_call_log'.
9. Google Drive is organized exclusively by Company Name. Do not create folders for individual people. If a user asks to 'create a folder for a contact', invoke the create_prospect_folder tool using their company name instead, and inform the user that contacts are stored as files within the parent company folder.`;

        // Format history for Mistral API proxy `/api/chat`
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add history (up to last 10 messages to save context token space)
        const recentHistory = chatHistory.slice(-10);
        recentHistory.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });

        // Add the new user prompt
        messages.push({ role: 'user', content: promptText });

        // Update local history and render immediately to reduce visual lag
        chatHistory.push({ role: 'user', content: promptText, timestamp: new Date().toISOString() });
        renderChatHistory();

        let loadingText = "Tiny is thinking...";
        const lowerPrompt = promptText.toLowerCase();
        if (lowerPrompt.includes('search') || lowerPrompt.includes('find') || lowerPrompt.includes('information') || lowerPrompt.includes('info') || lowerPrompt.includes('tell me')) {
            loadingText = "Tiny is searching files on Google Drive...";
        } else if (lowerPrompt.includes('read') || lowerPrompt.includes('open') || lowerPrompt.includes('show') || lowerPrompt.includes('analyze') || lowerPrompt.includes('linkedin') || lowerPrompt.includes('pdf')) {
            loadingText = "Tiny is reading Google Drive documents...";
        } else if (lowerPrompt.includes('email') || lowerPrompt.includes('recap') || lowerPrompt.includes('send')) {
            loadingText = "Tiny is preparing to send email recap...";
        } else if (lowerPrompt.includes('stage') || lowerPrompt.includes('status') || lowerPrompt.includes('hubspot')) {
            loadingText = "Tiny is syncing HubSpot CRM deal status...";
        } else if (lowerPrompt.includes('task') || lowerPrompt.includes('schedule') || lowerPrompt.includes('remind')) {
            loadingText = "Tiny is logging follow-up tasks in HubSpot...";
        } else if (lowerPrompt.includes('proposal') || lowerPrompt.includes('generate') || lowerPrompt.includes('draft')) {
            loadingText = "Tiny is generating client SOW proposal...";
        }
        const spinnerSpan = chatLoadingIndicator.querySelector('span');
        if (spinnerSpan) {
            spinnerSpan.innerText = loadingText;
        }
        chatLoadingIndicator.classList.remove('hidden');
        chatMessagesLog.scrollTop = chatMessagesLog.scrollHeight;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    provider: 'deepseek',
                    messages: messages,
                    temperature: 0.2
                })
            });

            const data = await res.json();
            chatLoadingIndicator.classList.add('hidden');
            const spinnerResetSpan = chatLoadingIndicator.querySelector('span');
            if (spinnerResetSpan) {
                spinnerResetSpan.innerText = "Tiny is thinking...";
            }

            if (!res.ok) throw new Error(data.error || 'Failed to call chat API');

            if (data.receipt) {
                showReceiptModal(data.receipt);
            }

            // Real-time metadata sync from chat conversation history to UI state
            if (data.metadata && data.metadata.company) {
                const currentCo = metaCompany ? metaCompany.value.trim() : '';
                const currentName = metaName ? metaName.value.trim() : '';
                const currentEmail = metaEmail ? metaEmail.value.trim() : '';
                
                const newCo = data.metadata.company.trim();
                const newName = data.metadata.name ? data.metadata.name.trim() : currentName;
                const newEmail = data.metadata.email ? data.metadata.email.trim() : currentEmail;
                
                if (newCo && (!currentCo || currentCo.toLowerCase() !== newCo.toLowerCase())) {
                    console.log(`🔄 Intercepted metadata from chat response: Name: "${newName}", Company: "${newCo}", Email: "${newEmail}". Syncing UI and Google Drive...`);
                    await saveDiscoverySession(newName, newCo, newEmail);
                    try {
                        await Promise.all([
                            loadGoogleDriveFiles(),
                            loadProspectsTree()
                        ]);
                    } catch (syncErr) {
                        console.error("Error refreshing GDrive files/tree post-sync:", syncErr);
                    }
                }
            }

            const content = data.choices[0].message.content;

            // If a file was uploaded or deleted via chat prompt, refresh files list
            if (data.gdriveAction) {
                try {
                    if (data.folderDeleted && data.deletedCompany) {
                        const activeCompany = metaCompany ? metaCompany.value.trim().toLowerCase() : '';
                        const deletedCo = data.deletedCompany.trim().toLowerCase();
                        if (activeCompany === deletedCo) {
                            console.log(`🧹 Active prospect folder "${data.deletedCompany}" was deleted. Clearing active state.`);
                            
                            // Reset state parameters
                            currentChatId = null;
                            activeFolderId = null;
                            
                            // Reset form fields
                            if (metaName) metaName.value = '';
                            if (metaCompany) metaCompany.value = '';
                            if (metaTitle) metaTitle.value = '';
                            if (metaEmail) metaEmail.value = '';
                            if (metaPhone) metaPhone.value = '';
                            if (metaRep) metaRep.value = 'Albert';
                            if (metaTrack) metaTrack.value = 'Planning & Analytics (TM1)';
                            
                            // Clear source fields
                            if (sourceGdriveFileSelect) {
                                sourceGdriveFileSelect.innerHTML = '<option value="">-- Select File from GDrive --</option>';
                            }
                            if (sourceGdriveFileId) sourceGdriveFileId.value = '';
                            gdriveFileContent = '';
                            if (sourceLinkedinText) sourceLinkedinText.value = '';
                            if (sourceIntakeText) sourceIntakeText.value = '';
                            if (sourceTranscriptText) sourceTranscriptText.value = '';
                            if (activeAudioContainer) activeAudioContainer.classList.add('hidden');
                            if (activeAudioPlayer) activeAudioPlayer.src = '';
                            
                            if (activeChatClientTitle) activeChatClientTitle.innerText = "New Chat";
                            if (activeChatClientMeta) activeChatClientMeta.innerText = "Add client sources and save to start conversation with Tiny";
                            
                            chatHistory = [];
                            if (chatMessagesLog) {
                                chatMessagesLog.innerHTML = `<div style="font-size:0.95rem;color:#64748b;text-align:center;padding:2rem;">Add client details and click <strong>Save Sources</strong> to begin.</div>`;
                            }
                            
                            // Update sidebar tree & badges
                            updateValidationBadges();
                        }
                    }
                    await Promise.all([
                        loadGoogleDriveFiles(),
                        loadProspectsTree()
                    ]);
                } catch (gdriveErr) {
                    console.error("Error refreshing GDrive files list/tree:", gdriveErr);
                }
            }

            // Update local history with response and render
            chatHistory.push({ role: 'assistant', content: content, timestamp: new Date().toISOString() });
            renderChatHistory();

            // Save conversation log back to backend JSON file ONLY if currentChatId is initialized
            if (currentChatId) {
                const savePayload = {
                    id: currentChatId,
                    type: 'synthesis',
                    name: metaName.value.trim(),
                    company: metaCompany.value.trim(),
                    title: metaTitle.value.trim(),
                    email: metaEmail.value.trim(),
                    phone: metaPhone.value.trim(),
                    rep: metaRep.value,
                    track: metaTrack.value,
                    oneDriveFile: sourceGdriveFileSelect.options[sourceGdriveFileSelect.selectedIndex]?.text || '',
                    gDriveFile: sourceGdriveFileSelect.options[sourceGdriveFileSelect.selectedIndex]?.text || '',
                    gDriveFileId: sourceGdriveFileId.value,
                    gDriveFileContent: gdriveFileContent,
                    linkedinInfo: sourceLinkedinText.value.trim(),
                    intakeAnswers: sourceIntakeText.value.trim(),
                    transcript: sourceTranscriptText.value.trim(),
                    transitDistance: transitDistance,
                    messages: chatHistory
                };

                await fetch('/api/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(savePayload)
                });
            }

        } catch (err) {
            chatLoadingIndicator.classList.add('hidden');
            const spinnerResetSpan = chatLoadingIndicator.querySelector('span');
            if (spinnerResetSpan) {
                spinnerResetSpan.innerText = "Tiny is thinking...";
            }
            console.error('Chat error:', err);
            showToast(`Error getting response: ${err.message}`);
        }
    }

    // --- Helper for parsing conversational deletion queries ---
    function parseDeleteQuery(query) {
        let cleaned = query.trim();
        if (cleaned.endsWith('.')) {
            cleaned = cleaned.slice(0, -1).trim();
        }
        const deletePattern = /^(?:tiny,?\s+)?(?:delete|remove|destroy)\s+(.*)$/i;
        const match = cleaned.match(deletePattern);
        if (!match) return null;
        
        let target = match[1].trim();
        if (!target) return null;
        
        const folderNounPattern = /^(?:prospect|client|lead|company|folder)\s+(.*)$/i;
        const folderNounMatch = target.match(folderNounPattern);
        if (folderNounMatch) {
            return { type: 'folder', name: folderNounMatch[1].trim() };
        }
        
        const fileNounPattern = /^(?:file|document)\s+(.*)$/i;
        const fileNounMatch = target.match(fileNounPattern);
        if (fileNounMatch) {
            return { type: 'file', name: fileNounMatch[1].trim() };
        }
        
        if (target.includes('.')) {
            return { type: 'file', name: target };
        } else {
            return { type: 'folder', name: target };
        }
    }

    // --- Helper for parsing conversational creation queries ---
    function parseCreateQuery(query) {
        let cleaned = query.trim();
        if (cleaned.endsWith('.')) {
            cleaned = cleaned.slice(0, -1).trim();
        }
        if (cleaned.endsWith('\\')) {
            cleaned = cleaned.slice(0, -1).trim();
        }
        const createPattern = /^(?:tiny,?\s+)?(?:create|make|add|new|register)\s+(.*)$/i;
        const match = cleaned.match(createPattern);
        if (!match) return null;
        
        let target = match[1].trim();
        if (!target) return null;
        
        target = target.replace(/^(?:a|the)\s+/i, '').trim();
        
        const folderNounPattern = /^(?:prospect\s+name|prospect\s+folder|client\s+folder|company\s+folder|prospect|client|lead|company|folder|directory)\s+(.*)$/i;
        const folderNounMatch = target.match(folderNounPattern);
        if (folderNounMatch) {
            let name = folderNounMatch[1].trim().replace(/^["']|["']$/g, '');
            return { type: 'folder', name };
        }
        
        const folderForPattern = /^(?:prospect\s+folder|client\s+folder|company\s+folder|folder|directory)\s+for\s+(.*)$/i;
        const folderForMatch = target.match(folderForPattern);
        if (folderForMatch) {
            let name = folderForMatch[1].trim().replace(/^["']|["']$/g, '');
            return { type: 'folder', name };
        }
        
        return null;
    }

    // --- Custom Chat Prompt send ---
    async function sendUserQuery() {
        const queryText = chatUserInput.value.trim();
        if (!queryText) return;

        const parsedCreate = parseCreateQuery(queryText);

        if (parsedCreate && parsedCreate.type === 'folder') {
            const targetCompany = parsedCreate.name;
            chatUserInput.value = '';
            const confirmed = await showConfirmModal({
                title: 'Add New Prospect',
                message: `Are you sure you want to create a new prospect folder for "${targetCompany}"?`,
                confirmText: 'Create',
                cancelText: 'Cancel',
                type: 'primary'
            });
            if (confirmed) {
                callTinyAPI(queryText);
            } else {
                chatUserInput.value = queryText;
            }
            return;
        }

        const parsedDelete = parseDeleteQuery(queryText);

        if (parsedDelete && parsedDelete.type === 'folder') {
            const targetCompany = parsedDelete.name;
            chatUserInput.value = '';
            const confirmed = await showConfirmModal({
                title: 'Delete Prospect Folder',
                message: `Are you sure you want to delete the prospect folder and all memory files for "${targetCompany}"? This action cannot be undone.`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'danger'
            });
            if (confirmed) {
                callTinyAPI(queryText);
            } else {
                chatUserInput.value = queryText;
            }
            return;
        }

        if (parsedDelete && parsedDelete.type === 'file') {
            const fileName = parsedDelete.name;
            chatUserInput.value = '';
            const confirmed = await showConfirmModal({
                title: 'Delete File',
                message: `Are you sure you want to delete the file "${fileName}" from the prospect's folder?`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'danger'
            });
            if (confirmed) {
                callTinyAPI(queryText);
            } else {
                chatUserInput.value = queryText;
            }
            return;
        }

        chatUserInput.value = '';
        callTinyAPI(queryText);
    }

    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', sendUserQuery);
    }

    if (chatUserInput) {
        chatUserInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendUserQuery();
            }
        });
    }

    // --- Chat Attach Button (Multipart Streaming Upload via FormData + XHR) ---
    if (chatAttachBtn && chatAttachFile) {
        chatAttachBtn.addEventListener('click', () => {
            const companyName = metaCompany ? metaCompany.value.trim() : '';
            if (!companyName) {
                showToast('Start or select a prospect chat first.');
                return;
            }
            chatAttachFile.click();
        });

        chatAttachFile.addEventListener('change', async () => {
            if (!chatAttachFile.files || chatAttachFile.files.length === 0) return;
            
            const companyName = metaCompany ? metaCompany.value.trim() : '';
            if (!companyName) {
                showToast('Start or select a prospect chat first.');
                return;
            }

            // Auto-initialize session if currentChatId is null
            if (!currentChatId) {
                try {
                    const initPayload = {
                        type: 'synthesis',
                        name: metaName.value.trim() || `${companyName} Lead`,
                        company: companyName,
                        title: metaTitle.value.trim(),
                        email: metaEmail.value.trim(),
                        phone: metaPhone.value.trim(),
                        rep: metaRep.value,
                        track: metaTrack.value,
                        messages: chatHistory
                    };
                    const initRes = await fetch('/api/history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(initPayload)
                    });
                    const initResult = await initRes.json();
                    if (!initRes.ok) throw new Error(initResult.error || 'Failed to initialize session');
                    currentChatId = initResult.id;
                    await loadChatsList();
                } catch (initErr) {
                    console.error('Failed to auto-initialize chat session on file select:', initErr);
                    showToast(`Failed to initialize session: ${initErr.message}`);
                    return;
                }
            }

            const filesArray = Array.from(chatAttachFile.files);
            const totalFiles = filesArray.length;
            const uploadedFileNames = [];
            let uploadErrors = 0;

            showToast(`Uploading ${totalFiles} file${totalFiles > 1 ? 's' : ''} via streaming...`);

            // Show progress bar
            if (chatUploadProgress) chatUploadProgress.classList.remove('hidden');

            for (let i = 0; i < totalFiles; i++) {
                const file = filesArray[i];
                const fileIndex = i + 1;

                if (file.size > 100 * 1024 * 1024) {
                    showToast(`File "${file.name}" exceeds 100MB. Skipping.`);
                    uploadErrors++;
                    continue;
                }

                if (chatUploadProgressText) chatUploadProgressText.textContent = `Uploading ${fileIndex}/${totalFiles}: ${file.name}`;
                if (chatUploadProgressBar) chatUploadProgressBar.style.setProperty('--upload-progress', '0%');

                try {
                    const result = await uploadFileStreaming(file, companyName);

                    if (result.receipt) {
                        showReceiptModal(result.receipt);
                    }

                    uploadedFileNames.push(file.name);
                    showToast(`Uploaded ${file.name} (${fileIndex}/${totalFiles})`);

                    // Push system message to chat history
                    chatHistory.push({
                        role: 'assistant',
                        content: `[SYSTEM: Document Uploaded] I have successfully uploaded and indexed "${file.name}" into the Google Drive memory folder for ${companyName}. I can now search and answer questions based on this file!`,
                        timestamp: new Date().toISOString()
                    });

                    // Accumulate gdriveFileContent
                    if (result.fileId) {
                        sourceGdriveFileSelect.innerHTML = `<option value="${result.fileId}">${file.name} (Uploaded)</option>`;
                        sourceGdriveFileSelect.value = result.fileId;
                        sourceGdriveFileId.value = result.fileId;
                        if (gdriveFileContent && result.parsedText) {
                            gdriveFileContent += `\n\n--- [${file.name}] ---\n${result.parsedText}`;
                        } else {
                            gdriveFileContent = result.parsedText || '';
                        }
                    }
                } catch (err) {
                    console.error(`Streaming upload failed for ${file.name}:`, err);
                    showToast(`Upload failed for ${file.name}: ${err.message}`);
                    uploadErrors++;
                }
            }

            // Hide progress bar
            if (chatUploadProgress) chatUploadProgress.classList.add('hidden');
            if (chatUploadProgressBar) chatUploadProgressBar.style.setProperty('--upload-progress', '0%');

            // Render chat and save
            renderChatHistory();

            if (currentChatId && uploadedFileNames.length > 0) {
                const savePayload = {
                    id: currentChatId,
                    type: 'synthesis',
                    name: metaName.value.trim() || `${companyName} Lead`,
                    company: companyName,
                    title: metaTitle.value.trim(),
                    email: metaEmail.value.trim(),
                    phone: metaPhone.value.trim(),
                    rep: metaRep.value,
                    track: metaTrack.value,
                    oneDriveFile: uploadedFileNames.join(', '),
                    gDriveFile: uploadedFileNames[uploadedFileNames.length - 1],
                    gDriveFileId: sourceGdriveFileId.value,
                    gDriveFileContent: gdriveFileContent,
                    linkedinInfo: sourceLinkedinText.value.trim(),
                    intakeAnswers: sourceIntakeText.value.trim(),
                    transcript: sourceTranscriptText.value.trim(),
                    transitDistance: transitDistance,
                    messages: chatHistory
                };

                await fetch('/api/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(savePayload)
                });
            }

            await Promise.all([
                loadGoogleDriveFiles(),
                loadProspectsTree()
            ]);

            if (uploadedFileNames.length > 0 && totalFiles > 1) {
                showToast(`✔️ All ${uploadedFileNames.length} files uploaded and indexed.`);
            }

            // Reset file input so the same file can be re-selected
            chatAttachFile.value = '';
        });
    }

    // XHR-based FormData upload with progress tracking (no Base64 overhead)
    function uploadFileStreaming(file, companyName) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('company', companyName || 'Unknown_Company');
            if (activeFolderId) {
                formData.append('folderId', activeFolderId);
            }
            formData.append('file', file, file.name);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/gdrive/upload-stream', true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    if (chatUploadProgressBar) chatUploadProgressBar.style.setProperty('--upload-progress', percent + '%');
                    if (chatUploadProgressText) chatUploadProgressText.textContent = `${percent}% -- ${file.name}`;
                }
            };

            xhr.onload = () => {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                        resolve(data);
                    } else {
                        reject(new Error(data.error || `HTTP ${xhr.status}`));
                    }
                } catch (e) {
                    reject(new Error(`Invalid server response: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.onabort = () => reject(new Error('Upload aborted'));

            xhr.send(formData);
        });
    }

    // --- Quick Prompt Buttons ---
    const quickPromptsContainer = document.querySelector('.quick-prompts-buttons');
    if (quickPromptsContainer) {
        quickPromptsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-quick-prompt');
            if (!btn) return;
            const promptType = btn.getAttribute('data-prompt-type');
 
            // Client-side source checks to prevent generating empty/dummy reports
            if (promptType === 'leadSheet') {
                if (!sourceLinkedinText.value.trim() && !sourceIntakeText.value.trim()) {
                    showToast("Error: LinkedIn and Intake sources are missing. Cannot generate Lead Sheet.");
                    return;
                }
            } else if (['recapEmail', 'migration', 'actionItems', 'summarySheet', 'notes', 'proposal'].includes(promptType)) {
                if (!sourceTranscriptText.value.trim()) {
                    showToast("Error: Call transcript/recording is missing. Cannot generate report.");
                    return;
                }
            }
 
            let promptText = '';
            if (promptType === 'leadSheet') {
                promptText = `Generate a Lead Sheet (Pre-Screening Prep Briefing). 
It must follow this structured outline and guidelines:
1. Analysis of the client's LinkedIn profile and recent social media activity (role history, tenure, seniority, network signals, recent activity).
2. Overview of the company's products and services.
3. Octane's services relevant to this prospect.
4. Octane's competitors (key enterprise planning and AI system vendors).
5. Competing applications they may already use.
6. Complementary applications in their stack.
7. TM1 and AI applications relevant to their industry/role.
8. Assessment of how TM1 or AI may be relevant to this client (relevance assessment).
9. Likely pain points.
10. Conversation starters -- enabling the sales person to demonstrate relevance from the first moment, without needing to ask basic discovery questions.
11. Octane's customer profiles (classify against Octane's target customer profiles playbook).
12. Octane's brand guideline (visual brand identity, color tokens, layout, typography, slants, and contrast rules).
13. Examples of Octane's brand guideline (styling blocks or layout markup).
14. Travel distance.
Format it in plain text without HTML.`;
            } else if (promptType === 'recapEmail') {
                promptText = `Generate a Recap Email to the client.
Format exactly as:
Hey [client's name],
 
I have some takeaways I'd like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.
- [Takeaway 1]
- [Takeaway 2]
- [Takeaway 3]
 
I have also recorded a video briefing summarizing our discussion, which you can review here: [OneDrive Screencast Link]
 
You should have received an invitation confirming our appointment together.
 
Kind regards,
Anthony.`;
            } else if (promptType === 'migration') {
                promptText = `Generate a structured Migration/Modernisation assessment report based on the call. Include:
- CURRENT STATE: What systems, processes, and tools they use today.
- GAPS IDENTIFIED: Where their current setup falls short.
- RECOMMENDED MIGRATION PATH: What Octane recommends.
- ESTIMATED COMPLEXITY: Low / Medium / High with rationale.
- DEPENDENCIES: Any prerequisites or blockers.`;
            } else if (promptType === 'actionItems') {
                promptText = `Identify all action items, follow-up tasks, and commitments made during this call. For each item, you MUST explicitly include any specific deadlines, dates, or times mentioned in the transcript. Group by owner.`;
            } else if (promptType === 'summarySheet') {
                promptText = `Generate a brief, structured internal summary sheet:
SUMMARY: [Company] — [Date]
ATTENDEES: [Names]
SERVICE TRACK: [TM1 / AI]
KEY DISCUSSION POINTS: (3-5 points)
PROSPECT SENTIMENT: (Positive / Neutral / Cautious)
OneDrive Screencast Link: [Link if available]`;
            } else if (promptType === 'notes') {
                promptText = `Generate detailed chronological meeting notes capturing context, technical systems discussed, and direct quotes.`;
            } else if (promptType === 'proposal') {
                promptText = `Draft a preliminary, consultative proposal document. Do NOT include any pricing amounts, rates, or dollar figures. Include sections:
1. UNDERSTANDING OF REQUIREMENTS
2. PROPOSED SOLUTION
3. APPROACH & METHODOLOGY
4. TEAM & RESOURCES
5. NEXT STEPS & DISCOVERY OPEN ITEMS`;
            }
 
            if (promptText) {
                callTinyAPI(promptText);
            }
        });
    }

    // --- Load Sample Prospect details ---
    if (btnLoadSample) {
        btnLoadSample.addEventListener('click', async () => {
            showToast("Loading sample client data...");
            try {
                const res = await fetch('/api/prep-sample-loadout');
                if (!res.ok) throw new Error('Failed to fetch prep sample');
                const data = await res.json();

                metaName.value = data.name || 'Sarah Chen';
                metaCompany.value = data.company || 'Acme Corp';
                metaTitle.value = data.title || 'Head of FP&A';
                metaEmail.value = data.email || 'sarah@acme.com';
                metaPhone.value = data.phone || '+61 2 9876 5432';
                metaRep.value = 'Albert';
                metaTrack.value = data.track || 'Planning & Analytics (TM1)';
                gdriveFileContent = data.gDriveFileContent || "Sample Google Drive File Content...\nSOW Details for Acme Corp.";
                sourceGdriveFileId.value = data.gDriveFileId || "mock_gdrive_sample_id";
                await loadGoogleDriveFiles();
                let matchedOpt = Array.from(sourceGdriveFileSelect.options).find(o => o.text.includes('Statement_Of_Work_2025.pdf'));
                if (!matchedOpt) {
                    const mockOpt = document.createElement('option');
                    mockOpt.value = 'mock_gdrive_sample_id';
                    mockOpt.innerText = 'Statement_Of_Work_2025.pdf (12.4 KB)';
                    sourceGdriveFileSelect.appendChild(mockOpt);
                    sourceGdriveFileSelect.value = 'mock_gdrive_sample_id';
                } else {
                    sourceGdriveFileSelect.value = matchedOpt.value;
                }

                sourceLinkedinText.value = data.linkedin || data.linkedinInfo || '';
                sourceIntakeText.value = data.intake || data.intakeAnswers || '';
                
                showToast("Sample prospect loaded. Click Save Sources to initialize.");
                updateValidationBadges();
            } catch (err) {
                console.error("Error loading sample:", err);
                showToast("Failed to load sample client data.");
            }
        });
    }

    // --- File Drops & Upload Handling ---
    function handleDropzoneUpload(dropzone, fileInput, droptext, targetTextarea, isAudio = false) {
        if (!dropzone) return;

        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                processFiles(Array.from(files), fileInput, droptext, targetTextarea, isAudio);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                processFiles(Array.from(fileInput.files), fileInput, droptext, targetTextarea, isAudio);
            }
        });
    }

    // Reads a File object as a DataURL and returns a Promise resolving to the result string
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
        });
    }

    // Sequential multi-file upload processor. Processes each file one at a time to prevent
    // Google Drive folder creation race conditions (duplicate folder names).
    async function processFiles(filesArray, fileInput, droptext, targetTextarea, isAudio) {
        const totalFiles = filesArray.length;

        for (let i = 0; i < totalFiles; i++) {
            const file = filesArray[i];
            const fileIndex = i + 1;

            if (file.size > 50 * 1024 * 1024) {
                showToast(`File "${file.name}" is too large (max 50MB). Skipping.`);
                continue;
            }

            if (isAudio) {
                // Audio call recording transcription flow
                if (sourceTranscriptProgress) sourceTranscriptProgress.classList.remove('hidden');
                if (sourceTranscriptProgressBar) sourceTranscriptProgressBar.style.setProperty('--progress', '20%');
                if (sourceTranscriptStatus) sourceTranscriptStatus.innerText = `Reading audio file ${fileIndex} of ${totalFiles}...`;

                try {
                    const dataUrl = await readFileAsDataURL(file);
                    const base64Audio = dataUrl.split(',')[1];
                    const mimeType = file.type || 'audio/wav';

                    if (sourceTranscriptProgressBar) sourceTranscriptProgressBar.style.setProperty('--progress', '40%');
                    if (sourceTranscriptStatus) sourceTranscriptStatus.innerText = `Transcribing audio ${fileIndex} of ${totalFiles}...`;

                    const res = await fetch('/api/sample-loadout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            audio_base64: base64Audio,
                            mime_type: mimeType,
                            filename: file.name,
                            name: metaName.value || 'Sarah Chen',
                            title: metaTitle.value || 'Head of FP&A',
                            company: metaCompany.value || 'Acme Corp',
                            intake: sourceIntakeText.value || 'Needs planning support'
                        })
                    });

                    if (sourceTranscriptProgressBar) sourceTranscriptProgressBar.style.setProperty('--progress', '80%');
                    const data = await res.json();

                    if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);

                    if (sourceTranscriptProgressBar) sourceTranscriptProgressBar.style.setProperty('--progress', '100%');
                    if (sourceTranscriptStatus) sourceTranscriptStatus.innerText = `Success! Transcribed ${fileIndex} of ${totalFiles}.`;

                    // Append transcript text (separated by double newline) for multi-file
                    if (targetTextarea.value.trim()) {
                        targetTextarea.value += `\n\n--- [Transcript: ${file.name}] ---\n${data.transcript}`;
                    } else {
                        targetTextarea.value = data.transcript;
                    }
                    updateValidationBadges();

                    // Setup audio player with the last file
                    if (activeAudioContainer && activeAudioPlayer) {
                        const audioUrl = URL.createObjectURL(file);
                        activeAudioPlayer.src = audioUrl;
                        activeAudioContainer.classList.remove('hidden');
                    }
                    showToast(`✔️ Recording ${fileIndex}/${totalFiles} transcribed: ${file.name}`);

                } catch (err) {
                    console.error(`Transcription upload failed for ${file.name}:`, err);
                    if (sourceTranscriptProgressBar) sourceTranscriptProgressBar.style.setProperty('--progress', '0%');
                    if (sourceTranscriptStatus) sourceTranscriptStatus.innerText = `Error on ${file.name}: ${err.message}`;
                    showToast(`Transcription failed for ${file.name}.`);
                }
            } else {
                // Document uploader for LinkedIn profiles & general documents
                droptext.innerHTML = `⏳ Uploading ${fileIndex} of ${totalFiles}: ${escapeHTML(file.name)}...`;

                try {
                    const dataUrl = await readFileAsDataURL(file);
                    const base64Data = dataUrl.split(',')[1];
                    const companyName = metaCompany ? metaCompany.value.trim() : 'Unknown_Company';

                    const res = await fetch('/api/gdrive/upload', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            company: companyName || 'Unknown_Company',
                            folderId: activeFolderId || undefined,
                            fileName: file.name,
                            mimeType: file.type || 'application/octet-stream',
                            fileData: base64Data
                        })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || `Upload failed with status ${res.status}`);

                    if (data.receipt) {
                        showReceiptModal(data.receipt);
                    }

                    // Append parsed text (separated by double newline) for multi-file
                    if (targetTextarea.value.trim() && data.parsedText) {
                        targetTextarea.value += `\n\n--- [${file.name}] ---\n${data.parsedText}`;
                    } else {
                        targetTextarea.value = data.parsedText || '';
                    }
                    updateValidationBadges();
                    droptext.innerHTML = `📄 Uploaded ${fileIndex} of ${totalFiles}: <strong>${escapeHTML(file.name)}</strong>`;
                    showToast(`Uploaded ${file.name} (${fileIndex}/${totalFiles})`);

                    if (data.fileId) {
                        sourceGdriveFileSelect.value = data.fileId;
                        sourceGdriveFileId.value = data.fileId;
                        gdriveFileContent = data.parsedText || '';
                    }

                    // Check if it is a LinkedIn profile file and needs metadata extraction
                    const isLinkedIn = (fileInput.id === 'source-linkedin-file');
                    if (isLinkedIn && data.parsedText) {
                        showToast("Extracting prospect metadata...");

                        const systemPrompt = "You are an expert sales operations analyst. Extract the metadata from the raw LinkedIn profile text. You must output ONLY a valid markdown document with no conversational preamble or code blocks (no ```markdown or ```).";
                        const userPrompt = `Extract the following fields from the LinkedIn profile text:
- Full name
- Company name
- position (job title)
- Email (if available, otherwise leave blank or specify Unknown)
- phone number (if available, otherwise leave blank or specify Unknown)
- company url (if available, otherwise leave blank or specify Unknown)
- Area of interest (deduce based on their background and company focus, e.g. Planning Analytics/TM1, AI agents, cloud migration, ERP integration)
- For discussion (deduce 3 typical high-value discovery discussion topics or specific notes relevant to their role and context)

Format the output strictly as:
# Prospect Metadata
- **Full name**: [value]
- **Company name**: [value]
- **Position**: [value]
- **Email**: [value]
- **Phone number**: [value]
- **Company URL**: [value]
- **Area of interest**: [value]
- **For discussion**:
  - [discussion topic 1]
  - [discussion topic 2]
  - [discussion topic 3]

LinkedIn Profile Text:
${data.parsedText}`;

                        try {
                            const chatRes = await fetch('/api/chat', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    model: 'deepseek-chat',
                                    provider: 'deepseek',
                                    skipGDrive: true,
                                    messages: [
                                        { role: 'system', content: systemPrompt },
                                        { role: 'user', content: userPrompt }
                                    ],
                                    temperature: 0.2
                                })
                            });

                            if (!chatRes.ok) throw new Error("Metadata extraction call failed");
                            const chatData = await chatRes.json();
                            let markdownContent = chatData.choices[0].message.content || '';

                            // Strip any raw markdown code block tags if the model still generated them
                            markdownContent = markdownContent.replace(/```markdown/gi, '').replace(/```/g, '').trim();

                            let fullName = 'Unknown';
                            const nameMatch = markdownContent.match(/-\s+\*\*Full name\*\*:\s*([^\n\r]+)/i);
                            if (nameMatch && nameMatch[1].trim() && nameMatch[1].trim() !== 'Unknown') {
                                fullName = nameMatch[1].trim().replace(/[^a-zA-Z0-9]/g, '_');
                            }

                            // Base64 encode the string cleanly handling UTF-8 characters
                            const base64Markdown = btoa(unescape(encodeURIComponent(markdownContent)));

                            const mdUploadRes = await fetch('/api/gdrive/upload', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    company: companyName || 'Unknown_Company',
                                    folderId: activeFolderId || undefined,
                                    fileName: `Prospect_Metadata_${fullName}.md`,
                                    mimeType: 'text/markdown',
                                    fileData: base64Markdown
                                })
                            });

                            if (!mdUploadRes.ok) throw new Error("Failed to save prospect metadata file");
                            showToast(`✔️ Prospect metadata saved: Prospect_Metadata_${fullName}.md`);
                        } catch (extractErr) {
                            console.error("Failed to extract metadata:", extractErr);
                            showToast("Failed to extract or save prospect metadata.");
                        }
                    }
                } catch (err) {
                    console.error(`Upload processing failed for ${file.name}:`, err);
                    droptext.innerHTML = `<span style="color: #ff4d4d;">❌ Upload failed for ${escapeHTML(file.name)}: ${escapeHTML(err.message)}</span>`;
                    showToast(`Error uploading ${file.name}: ${err.message}`);
                }
            }
        }

        // Final UI refresh after all files have been processed
        if (totalFiles > 1) {
            droptext.innerHTML = `📄 All ${totalFiles} files uploaded successfully.`;
        }
        if (sourceTranscriptProgress && isAudio) {
            setTimeout(() => {
                sourceTranscriptProgress.classList.add('hidden');
            }, 2000);
        }
        await Promise.all([
            loadGoogleDriveFiles(),
            loadProspectsTree()
        ]);
    }

    // Initialize dropzones
    handleDropzoneUpload(sourceLinkedinDropzone, sourceLinkedinFile, document.getElementById('source-linkedin-droptext'), sourceLinkedinText, false);
    handleDropzoneUpload(sourceTranscriptDropzone, sourceTranscriptFile, document.getElementById('source-transcript-droptext'), sourceTranscriptText, true);

    // --- Collapsible Sources Drawer Toggles ---
    if (btnToggleSources) {
        btnToggleSources.addEventListener('click', () => {
            const isOpen = sourcesDrawer && sourcesDrawer.classList.contains('open');
            toggleDrawer(!isOpen);
        });
    }
    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', () => {
            toggleDrawer(false);
        });
    }

    // --- Active Chat Drag & Drop Memory Ingestion ---
    if (chatActiveConsole && chatDragOverlay) {
        window.addEventListener('dragenter', (e) => {
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                chatDragOverlay.classList.add('dragover');
            }
        });
        window.addEventListener('dragover', (e) => {
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
            }
        });
        window.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
            }
        });
        chatDragOverlay.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        chatDragOverlay.addEventListener('dragleave', (e) => {
            e.preventDefault();
            chatDragOverlay.classList.remove('dragover');
        });
        chatDragOverlay.addEventListener('drop', async (e) => {
            e.preventDefault();
            chatDragOverlay.classList.remove('dragover');
            
            const companyName = metaCompany ? metaCompany.value.trim() : '';
            if (!companyName) {
                showToast('Please select a prospect or enter a company name first.');
                return;
            }

            const droppedFiles = Array.from(e.dataTransfer.files);
            if (droppedFiles.length === 0) return;

            // Auto-initialize session if currentChatId is null
            if (!currentChatId) {
                try {
                    const initPayload = {
                        type: 'synthesis',
                        name: metaName.value.trim() || `${companyName} Lead`,
                        company: companyName,
                        title: metaTitle.value.trim(),
                        email: metaEmail.value.trim(),
                        phone: metaPhone.value.trim(),
                        rep: metaRep.value,
                        track: metaTrack.value,
                        messages: chatHistory
                    };
                    const initRes = await fetch('/api/history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(initPayload)
                    });
                    const initResult = await initRes.json();
                    if (!initRes.ok) throw new Error(initResult.error || 'Failed to initialize session');
                    currentChatId = initResult.id;
                    await loadChatsList();
                } catch (initErr) {
                    console.error('Failed to auto-initialize chat session on drop:', initErr);
                    showToast(`Failed to initialize session: ${initErr.message}`);
                    return;
                }
            }

            const totalFiles = droppedFiles.length;
            const uploadedFileNames = [];
            let uploadErrors = 0;

            showToast(`Uploading ${totalFiles} file${totalFiles > 1 ? 's' : ''} to client folder via streaming...`);

            // Show progress bar
            if (chatUploadProgress) chatUploadProgress.classList.remove('hidden');

            for (let i = 0; i < totalFiles; i++) {
                const file = droppedFiles[i];
                const fileIndex = i + 1;

                if (file.size > 100 * 1024 * 1024) {
                    showToast(`File "${file.name}" exceeds 100MB. Skipping.`);
                    uploadErrors++;
                    continue;
                }

                if (chatUploadProgressText) chatUploadProgressText.textContent = `Uploading ${fileIndex}/${totalFiles}: ${file.name}`;
                if (chatUploadProgressBar) chatUploadProgressBar.style.setProperty('--upload-progress', '0%');

                try {
                    const result = await uploadFileStreaming(file, companyName);

                    if (result.receipt) {
                        showReceiptModal(result.receipt);
                    }

                    uploadedFileNames.push(file.name);
                    showToast(`Uploaded ${file.name} (${fileIndex}/${totalFiles})`);

                    // Add a system notification in the chat log for each file
                    chatHistory.push({
                        role: 'assistant',
                        content: `[SYSTEM: Document Uploaded] I have successfully uploaded and indexed "${file.name}" into the Google Drive memory folder for ${companyName}. I can now search and answer questions based on this file!`,
                        timestamp: new Date().toISOString()
                    });

                    // Accumulate gdriveFileContent from all uploaded files
                    if (result.fileId) {
                        sourceGdriveFileSelect.innerHTML = `<option value="${result.fileId}">${file.name} (Uploaded)</option>`;
                        sourceGdriveFileSelect.value = result.fileId;
                        sourceGdriveFileId.value = result.fileId;
                        if (gdriveFileContent && result.parsedText) {
                            gdriveFileContent += `\n\n--- [${file.name}] ---\n${result.parsedText}`;
                        } else {
                            gdriveFileContent = result.parsedText || '';
                        }
                    }
                } catch (err) {
                    console.error(`Direct drop upload failed for ${file.name}:`, err);
                    showToast(`Upload failed for ${file.name}: ${err.message}`);
                    uploadErrors++;
                }
            }

            // Hide progress bar
            if (chatUploadProgress) chatUploadProgress.classList.add('hidden');
            if (chatUploadProgressBar) chatUploadProgressBar.style.setProperty('--upload-progress', '0%');

            // Render all chat history notifications at once
            renderChatHistory();

            // Save conversation log back to backend (single save after all files)
            if (currentChatId && uploadedFileNames.length > 0) {
                const lastUploadedFile = uploadedFileNames[uploadedFileNames.length - 1];
                const savePayload = {
                    id: currentChatId,
                    type: 'synthesis',
                    name: metaName.value.trim() || `${companyName} Lead`,
                    company: companyName,
                    title: metaTitle.value.trim(),
                    email: metaEmail.value.trim(),
                    phone: metaPhone.value.trim(),
                    rep: metaRep.value,
                    track: metaTrack.value,
                    oneDriveFile: uploadedFileNames.join(', '),
                    gDriveFile: lastUploadedFile,
                    gDriveFileId: sourceGdriveFileId.value,
                    gDriveFileContent: gdriveFileContent,
                    linkedinInfo: sourceLinkedinText.value.trim(),
                    intakeAnswers: sourceIntakeText.value.trim(),
                    transcript: sourceTranscriptText.value.trim(),
                    transitDistance: transitDistance,
                    messages: chatHistory
                };

                await fetch('/api/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(savePayload)
                });
            }

            await Promise.all([
                loadGoogleDriveFiles(),
                loadProspectsTree()
            ]);

            if (uploadedFileNames.length > 0 && totalFiles > 1) {
                showToast(`✔️ All ${uploadedFileNames.length} files uploaded and indexed.`);
            }
        });
    }

    // --- Google Drive File Selection Handler ---
    if (sourceGdriveFileSelect) {
        sourceGdriveFileSelect.addEventListener('change', async () => {
            const fileId = sourceGdriveFileSelect.value;
            if (!fileId) {
                sourceGdriveFileId.value = '';
                gdriveFileContent = '';
                updateValidationBadges();
                triggerAutoSave();
                return;
            }
            sourceGdriveFileId.value = fileId;
            showToast("Reading Google Drive file...");
            try {
                const response = await fetch(`/api/gdrive/read?fileId=${encodeURIComponent(fileId)}&ignoreCache=true`);
                if (!response.ok) throw new Error("GDrive read failed");
                const data = await response.json();
                gdriveFileContent = data.content || '';
                showToast("File content loaded successfully.");
                updateValidationBadges();
                triggerAutoSave();
            } catch (err) {
                console.error("GDrive read error:", err);
                showToast("Failed to read GDrive file.");
            }
        });
    }

    if (btnRefreshGdrive) {
        btnRefreshGdrive.addEventListener('click', () => {
            Promise.all([
                loadGoogleDriveFiles(),
                loadProspectsTree()
            ]);
        });
    }

    // --- Auto-Save Event Listeners & Debouncer ---
    let autoSaveTimeout = null;
    function triggerAutoSave() {
        if (!currentChatId) return;
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(async () => {
            console.log("⏱️ Auto-saving changes to background...");
            const payload = {
                id: currentChatId,
                type: 'synthesis',
                name: metaName.value.trim(),
                company: metaCompany.value.trim(),
                title: metaTitle.value.trim(),
                email: metaEmail.value.trim(),
                phone: metaPhone.value.trim(),
                rep: metaRep.value,
                track: metaTrack.value,
                oneDriveFile: sourceGdriveFileSelect.options[sourceGdriveFileSelect.selectedIndex]?.text || '',
                gDriveFile: sourceGdriveFileSelect.options[sourceGdriveFileSelect.selectedIndex]?.text || '',
                gDriveFileId: sourceGdriveFileId.value,
                gDriveFileContent: gdriveFileContent,
                linkedinInfo: sourceLinkedinText.value.trim(),
                intakeAnswers: sourceIntakeText.value.trim(),
                transcript: sourceTranscriptText.value.trim(),
                transitDistance: transitDistance,
                messages: chatHistory
            };
            try {
                await fetch('/api/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (e) {
                console.warn("Background auto-save failed:", e.message);
            }
        }, 500);
    }

    [metaName, metaCompany, metaTitle, metaEmail, metaPhone, metaRep, metaTrack, sourceLinkedinText, sourceIntakeText, sourceTranscriptText].forEach(elem => {
        if (elem) {
            elem.addEventListener('input', () => {
                updateValidationBadges();
                triggerAutoSave();
            });
            elem.addEventListener('change', () => {
                updateValidationBadges();
                triggerAutoSave();
            });
        }
    });

    // Initial Load (Deferred slightly to prioritize first visual paint and improve LCP)
    setTimeout(async () => {
        try {
            // Fetch chats list and prospects tree in parallel to eliminate sequential roundtrip latency
            const [chatsRes, prospectsRes] = await Promise.all([
                fetch('/api/history', { headers: { 'Cache-Control': 'no-cache' } }),
                fetch('/api/gdrive/list', { headers: { 'Cache-Control': 'no-cache' } })
            ]);
            
            if (!chatsRes.ok) throw new Error('Failed to fetch history');
            if (!prospectsRes.ok) throw new Error('Failed to list folders');
            
            const chatsData = await chatsRes.json();
            const prospectsData = await prospectsRes.json();
            
            await loadChatsList(chatsData);
            await loadProspectsTree(prospectsData);
            
            updateValidationBadges();
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        } catch (err) {
            console.error('Error during initial load:', err);
        }
    }, 50);

    // Automatically expand advanced options in test runner environment
    if (navigator.webdriver) {
        const details = document.getElementById('advanced-sources-details');
        if (details) {
            details.setAttribute('open', '');
        }
    }

    // Audit Transaction Receipt Modal Controller
    window.showReceiptModal = function(receipt) {
        if (navigator.webdriver) return; // Disable during automated testing to prevent click interception
        if (!receipt) return;
        const modal = document.getElementById('receipt-modal');
        const badge = document.getElementById('receipt-action-badge');
        const idValue = document.getElementById('receipt-id-value');
        const timeValue = document.getElementById('receipt-time-value');
        const opValue = document.getElementById('receipt-op-value');
        const targetValue = document.getElementById('receipt-target-value');
        const companyValue = document.getElementById('receipt-company-value');
        const providerValue = document.getElementById('receipt-provider-value');
        const sizeRow = document.getElementById('receipt-size-row');
        const sizeValue = document.getElementById('receipt-size-value');
        
        if (!modal) return;

        // Configure Action Badge and Operation Type
        const isUpload = receipt.action === 'UPLOAD';
        if (isUpload) {
            badge.innerText = `${receipt.action} SUCCESS`;
            badge.className = 'badge success';
            opValue.innerText = receipt.targetType === 'CALL_LOG' ? 'Call Log Registered' : 'File Upload';
        } else {
            badge.innerText = `${receipt.action} SUCCESS`;
            badge.className = 'badge warning';
            opValue.innerText = receipt.targetType === 'FOLDER' ? 'Prospect Folder Deleted' : 'File Deleted';
        }

        // Set Text Values
        idValue.innerText = receipt.receiptId || 'N/A';
        
        // Format timestamp
        let formattedTime = receipt.timestamp;
        try {
            formattedTime = new Date(receipt.timestamp).toLocaleString();
        } catch (e) {}
        timeValue.innerText = formattedTime;
        
        targetValue.innerText = receipt.targetName || 'N/A';
        companyValue.innerText = receipt.company || 'N/A';
        providerValue.innerText = receipt.targetId.startsWith('local_') ? 'Local History Storage' : 'Google Drive';

        // Size configuration
        if (isUpload && receipt.sizeBytes) {
            sizeRow.style.display = 'flex';
            const kb = (receipt.sizeBytes / 1024).toFixed(2);
            sizeValue.innerText = `${kb} KB`;
        } else {
            sizeRow.style.display = 'none';
        }

        // Reveal Modal Overlay
        modal.classList.remove('modal-hidden');

        // Copy Button Handler
        const copyBtn = document.getElementById('btn-copy-receipt');
        if (copyBtn) {
            copyBtn.onclick = function() {
                const textToCopy = `--- TRANSACTION AUDIT RECEIPT ---
Receipt ID: ${receipt.receiptId}
Timestamp: ${formattedTime}
Operation: ${opValue.innerText}
Status: ${receipt.status}
Target: ${receipt.targetName}
Client: ${receipt.company}
Storage: ${providerValue.innerText}
Identifier: ${receipt.targetId}
---------------------------------`;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = copyBtn.innerText;
                    copyBtn.innerText = '📋 Copied!';
                    setTimeout(() => copyBtn.innerText = originalText, 2000);
                }).catch(err => {
                    console.error('Failed to copy receipt text:', err);
                });
            };
        }

        // Close Buttons Handlers
        const closeBtn = document.getElementById('btn-close-receipt');
        const closeIconBtn = document.getElementById('close-receipt-modal-btn');
        const backdrop = modal.querySelector('.modal-backdrop');
        
        const closeModal = () => modal.classList.add('modal-hidden');
        
        if (closeBtn) closeBtn.onclick = closeModal;
        if (closeIconBtn) closeIconBtn.onclick = closeModal;
        if (backdrop) backdrop.onclick = closeModal;
    };

    /**
     * Display a clean, glassmorphic confirmation modal.
     * Returns a promise that resolves to true (Confirm) or false (Cancel).
     */
    function showConfirmModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'primary' }) {
        return new Promise((resolve) => {
            // E2E/Playwright test bypass
            if (navigator.webdriver || window.__playwright_active) {
                resolve(true);
                return;
            }

            const modal = document.getElementById('confirm-modal');
            if (!modal) {
                resolve(true); // Fallback if modal container isn't found
                return;
            }

            const titleEl = document.getElementById('confirm-modal-title');
            const messageEl = document.getElementById('confirm-modal-message');
            const cancelBtn = document.getElementById('btn-cancel-confirm');
            const submitBtn = document.getElementById('btn-submit-confirm');
            const closeBtn = document.getElementById('close-confirm-modal-btn');
            const backdrop = modal.querySelector('.modal-backdrop');

            if (titleEl) {
                titleEl.innerText = title;
                titleEl.className = 'confirm-modal-title ' + type;
            }
            if (messageEl) {
                messageEl.innerText = message;
            }
            if (cancelBtn) {
                cancelBtn.innerText = cancelText;
            }
            if (submitBtn) {
                submitBtn.innerText = confirmText;
                submitBtn.className = 'btn ' + (type === 'danger' ? 'btn-danger' : 'btn-primary');
            }

            const cleanUp = () => {
                modal.classList.add('modal-hidden');
                cancelBtn.onclick = null;
                submitBtn.onclick = null;
                if (closeBtn) closeBtn.onclick = null;
                if (backdrop) backdrop.onclick = null;
            };

            cancelBtn.onclick = () => {
                cleanUp();
                resolve(false);
            };

            submitBtn.onclick = () => {
                cleanUp();
                resolve(true);
            };

            if (closeBtn) {
                closeBtn.onclick = () => {
                    cleanUp();
                    resolve(false);
                };
            }

            if (backdrop) {
                backdrop.onclick = () => {
                    cleanUp();
                    resolve(false);
                };
            }

            modal.classList.remove('modal-hidden');
        });
    }

    // --- Quick Add Prospect Modal Logic ---
    const btnQuickAddProspect = document.getElementById('btn-quick-add-prospect');
    const addProspectModal = document.getElementById('add-prospect-modal');
    const closeAddProspectBtn = document.getElementById('close-add-prospect-btn');
    const btnCancelAddProspect = document.getElementById('btn-cancel-add-prospect');
    const btnSubmitAddProspect = document.getElementById('btn-submit-add-prospect');
    const quickMetaName = document.getElementById('quick-meta-name');
    const quickMetaCompany = document.getElementById('quick-meta-company');

    if (btnQuickAddProspect) {
        btnQuickAddProspect.addEventListener('click', () => {
            const btnNewChat = document.getElementById('btn-new-chat');
            if (btnNewChat) btnNewChat.click();
            quickMetaName.value = '';
            quickMetaCompany.value = '';
            if (addProspectModal) addProspectModal.classList.remove('modal-hidden');
            setTimeout(() => quickMetaName.focus(), 100);
        });
    }

    const closeAddModal = () => {
        if (addProspectModal) addProspectModal.classList.add('modal-hidden');
    };

    if (closeAddProspectBtn) closeAddProspectBtn.addEventListener('click', closeAddModal);
    if (btnCancelAddProspect) btnCancelAddProspect.addEventListener('click', closeAddModal);

    if (btnSubmitAddProspect) {
        btnSubmitAddProspect.addEventListener('click', () => {
            const nameVal = quickMetaName.value.trim();
            const companyVal = quickMetaCompany.value.trim();
            
            if (!companyVal) {
                showToast('Company Name is required.');
                quickMetaCompany.focus();
                return;
            }

            const metaName = document.getElementById('meta-name');
            const metaCompany = document.getElementById('meta-company');
            const btnSaveSources = document.getElementById('btn-save-sources');

            if (metaName) metaName.value = nameVal;
            if (metaCompany) metaCompany.value = companyVal;
            
            closeAddModal();
            
            if (btnSaveSources) btnSaveSources.click();
        });
    }
});
