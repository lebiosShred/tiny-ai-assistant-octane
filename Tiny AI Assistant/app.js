document.addEventListener('DOMContentLoaded', () => {
    'use strict';

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

            // Lead Sheet button generation based on presence of LinkedIn or Booking Intake
            const hasLinkedinOrIntake = !!(
                (sourceLinkedinText ? sourceLinkedinText.value.trim() : '') ||
                (sourceIntakeText ? sourceIntakeText.value.trim() : '')
            );
            const leadSheetBtn = container.querySelector('[data-prompt-type="leadSheet"]');
            if (hasLinkedinOrIntake) {
                if (!leadSheetBtn) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'btn btn-quick-prompt';
                    btn.setAttribute('data-prompt-type', 'leadSheet');
                    btn.innerText = '📋 Lead Sheet';
                    if (container.firstChild) {
                        container.insertBefore(btn, container.firstChild);
                    } else {
                        container.appendChild(btn);
                    }
                }
            } else {
                if (leadSheetBtn) {
                    leadSheetBtn.remove();
                }
            }
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
    let stagedAttachments = [];
    const gdriveSubfolderCache = new Map();
    let loadTreeCount = 0;

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

    // Clean up address bar query variables if landing on cache-busting link
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('cb') || searchParams.has('v')) {
        searchParams.delete('cb');
        searchParams.delete('v');
        const cleanSearch = searchParams.toString();
        const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '') + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
    }

    // Toggle initial loading indicator for real users before data loads
    const isTestRunner = (navigator.webdriver || typeof window.__playwright_active !== 'undefined') && 
                         (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.search.includes('demo=true'));
    const loadingIndicator = document.getElementById('initial-loading-indicator');
    const emptyStateContent = document.getElementById('empty-state-content');
    if (isTestRunner) {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        if (emptyStateContent) emptyStateContent.classList.remove('hidden');
    }

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
    const chatPendingAttachments = document.getElementById('chat-pending-attachments');
 
    // Auto Scroll Lock Observer
    if (chatMessagesLog) {
        const observer = new MutationObserver(() => {
            const threshold = 120;
            const isNearBottom = chatMessagesLog.scrollHeight - chatMessagesLog.clientHeight - chatMessagesLog.scrollTop <= threshold;
            const isStreaming = chatMessagesLog.getAttribute('data-state') === 'streaming';
            if (isNearBottom || isStreaming) {
                chatMessagesLog.scrollTop = chatMessagesLog.scrollHeight;
            }
        });
        observer.observe(chatMessagesLog, { childList: true, subtree: true });
    }

    function renderStagingArea() {
        if (!chatPendingAttachments) return;
        if (stagedAttachments.length === 0) {
            chatPendingAttachments.innerHTML = '';
            chatPendingAttachments.classList.add('hidden');
            return;
        }

        chatPendingAttachments.classList.remove('hidden');
        chatPendingAttachments.innerHTML = '';

        // Add header with Clear All button
        const header = document.createElement('div');
        header.className = 'staging-area-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.width = '100%';
        header.style.marginBottom = '6px';
        header.style.padding = '0 4px';

        const title = document.createElement('span');
        title.innerText = `📎 Staged Files (${stagedAttachments.length})`;
        title.style.fontSize = '0.8rem';
        title.style.fontWeight = '600';
        title.style.color = '#64748b';

        const clearAllBtn = document.createElement('button');
        clearAllBtn.type = 'button';
        clearAllBtn.innerText = 'Clear All';
        clearAllBtn.className = 'btn-clear-all-staged';
        clearAllBtn.style.background = 'none';
        clearAllBtn.style.border = 'none';
        clearAllBtn.style.color = '#ef4444';
        clearAllBtn.style.fontSize = '0.8rem';
        clearAllBtn.style.fontWeight = '600';
        clearAllBtn.style.cursor = 'pointer';
        clearAllBtn.style.padding = '2px 6px';
        clearAllBtn.style.borderRadius = '4px';
        clearAllBtn.addEventListener('click', () => {
            stagedAttachments = [];
            renderStagingArea();
        });

        header.appendChild(title);
        header.appendChild(clearAllBtn);
        chatPendingAttachments.appendChild(header);

        stagedAttachments.forEach((file, index) => {
            const chip = document.createElement('div');
            chip.className = 'pending-attachment-card';
            
            const icon = document.createElement('span');
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
            icon.className = 'pending-attachment-icon';
            
            const info = document.createElement('div');
            info.className = 'pending-attachment-info';

            const name = document.createElement('span');
            name.innerText = file.name;
            name.className = 'pending-attachment-name';
            name.title = file.name;

            const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
            const size = document.createElement('span');
            size.innerText = `${sizeMb} MB`;
            size.className = 'pending-attachment-size';

            info.appendChild(name);
            info.appendChild(size);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.innerText = '✕';
            removeBtn.className = 'pending-attachment-remove';
            removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
            removeBtn.addEventListener('click', () => {
                stagedAttachments.splice(index, 1);
                renderStagingArea();
            });

            chip.appendChild(icon);
            chip.appendChild(info);
            chip.appendChild(removeBtn);
            chatPendingAttachments.appendChild(chip);
        });
    }

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
        if (activeFolderId && !activeProspectName) {
            sourceGdriveFileSelect.innerHTML = '<option value="">-- Select a prospect folder to see files --</option>';
            return;
        }
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

    async function selectProspect(companyFolder, prospectName, subfolderId = null, filesData = null) {
        activeFolderId = companyFolder.id;
        activeProspectName = prospectName;
        
        // Highlight active folder and prospect in the sidebar
        document.querySelectorAll('.sidebar-folder-header').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.sidebar-prospect-header').forEach(el => el.classList.remove('active'));
        
        const folderHeader = document.querySelector(`.sidebar-folder-header[data-folder-id="${companyFolder.id}"]`);
        if (folderHeader) folderHeader.classList.add('active');
        const prospectItem = document.querySelector(`.sidebar-prospect-header[data-prospect-name="${prospectName}"][data-folder-id="${companyFolder.id}"]`);
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
        if (!Array.isArray(chatsList)) {
            chatsList = [];
        }
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
            if (!prospectName) {
                currentChatId = null;
                workspaceEmptyState.classList.remove('hidden');
                workspaceActiveChat.classList.add('hidden');
                chatMessagesLog.innerHTML = '';
                chatHistory = [];
                renderChatHistory();
                
                if (metaName) metaName.value = '';
                if (metaTitle) metaTitle.value = '';
                if (metaEmail) metaEmail.value = '';
                if (metaPhone) metaPhone.value = '';
                if (metaRep) metaRep.value = '';
                if (metaTrack) metaTrack.value = '';
                
                if (sourceGdriveFileSelect) {
                    sourceGdriveFileSelect.innerHTML = '<option value="">-- Select a prospect folder to see files --</option>';
                }
                if (sourcesList) {
                    sourcesList.innerHTML = '<div style="color: #64748b; font-size: 0.85rem; padding: 2rem 1rem; text-align: center; border: 1px dashed #cbd5e1; border-radius: 8px; margin-top: 1rem;">Please select a prospect subfolder from the sidebar to view documents.</div>';
                }
            } else {
                if (!subfolderId) {
                    sourcesList.innerHTML = `<div style="color: #64748b; font-size: 0.85rem; padding: 2rem 1rem; text-align: center; border: 1px dashed #cbd5e1; border-radius: 8px; margin-top: 1rem;">No subfolder found. Please create a folder named "<b>${prospectName}</b>" inside "<b>${companyFolder.name}</b>" to add files.</div>`;
                }
                
                const targetFolderId = subfolderId;
                
                let detailData = null;
                let resolvedFilesData = { items: [] };
                
                if (matchSession) {
                    const promises = [ fetch(`/api/history/detail?id=${encodeURIComponent(matchSession.id)}`) ];
                    if (targetFolderId) {
                        promises.push(filesData ? Promise.resolve({ ok: true, json: () => filesData }) : fetch(`/api/gdrive/list?folderId=${encodeURIComponent(targetFolderId)}&company=${encodeURIComponent(companyFolder.name)}`, { headers: { 'Cache-Control': 'no-cache' } }));
                    }
                    
                    const results = await Promise.all(promises);
                    const detailRes = results[0];
                    const filesRes = results.length > 1 ? results[1] : null;
                    
                    if (!detailRes.ok) {
                        if (detailRes.status === 404) {
                            console.warn(`Stale session ${matchSession.id} not found on server. Reverting to new session.`);
                            showToast('Previous session not found. Starting a new session.');
                            chatsList = chatsList.filter(c => c.id !== matchSession.id);
                            renderChatsList();
                            
                            // Setup a fallback new session state
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
                            if (metaRep) metaRep.value = '';
                            if (metaTrack) metaTrack.value = '';
                            
                            if (activeChatClientTitle) {
                                activeChatClientTitle.innerText = prospectName ? `${companyFolder.name} (${prospectName})` : companyFolder.name;
                            }
                            if (activeChatClientMeta) {
                                activeChatClientMeta.innerText = '';
                            }
                            
                            if (targetFolderId) {
                                try {
                                    resolvedFilesData = filesData || await (await fetch(`/api/gdrive/list?folderId=${encodeURIComponent(targetFolderId)}&company=${encodeURIComponent(companyFolder.name)}`, { headers: { 'Cache-Control': 'no-cache' } })).json();
                                } catch (fileErr) {
                                    console.error('Failed to load files for fallback new session:', fileErr);
                                }
                            }
                        } else {
                            throw new Error('Failed to load chat details');
                        }
                    } else {
                        detailData = await detailRes.json();
                        
                        if (filesRes) {
                            if (filesRes.ok) {
                                resolvedFilesData = filesData || await filesRes.json();
                            } else {
                                console.warn('Failed to list files from GDrive during session selection.');
                                showToast('Warning: Failed to load prospect files.');
                            }
                        }
                        
                        await selectChat(matchSession.id, detailData, resolvedFilesData);
                    }
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
                    if (metaRep) metaRep.value = '';
                    if (metaTrack) metaTrack.value = '';
                    
                    if (activeChatClientTitle) {
                        activeChatClientTitle.innerText = prospectName ? `${companyFolder.name} (${prospectName})` : companyFolder.name;
                    }
                    if (activeChatClientMeta) {
                        activeChatClientMeta.innerText = '';
                    }
                    
                    if (targetFolderId) {
                        resolvedFilesData = filesData || await (await fetch(`/api/gdrive/list?folderId=${encodeURIComponent(targetFolderId)}&company=${encodeURIComponent(companyFolder.name)}`, { headers: { 'Cache-Control': 'no-cache' } })).json();
                        
                        // Clear text areas first for new sessions to avoid displaying stale data from prior active chats
                        if (sourceLinkedinText) sourceLinkedinText.value = '';
                        if (sourceIntakeText) sourceIntakeText.value = '';
                        if (sourceTranscriptText) sourceTranscriptText.value = '';
                        
                        // Lock inputs during ingestion
                        if (chatUserInput) chatUserInput.disabled = true;
                        if (chatSendBtn) chatSendBtn.disabled = true;
                        
                        // Show ingestion spinner in sources panel
                        const ingestSpinner = document.createElement('div');
                        ingestSpinner.className = 'ingest-loading-spinner-container';
                        ingestSpinner.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.5rem 1rem; margin-bottom: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 6px; font-size: 0.8rem;';
                        ingestSpinner.innerHTML = `
                            <div class="spinner" style="width: 14px; height: 14px; border: 2px solid rgba(22, 101, 52, 0.2); border-top-color: #166534; border-radius: 50%; animation: rotate 1s linear infinite; box-sizing: border-box;"></div>
                            <span>Auto-ingesting document files...</span>
                        `;
                        if (sourcesList && sourcesList.firstChild) {
                            sourcesList.insertBefore(ingestSpinner, sourcesList.firstChild);
                        } else if (sourcesList) {
                            sourcesList.appendChild(ingestSpinner);
                        }

                        // Auto-ingest content from GDrive files in batch for new session path
                        try {
                            const batchRes = await fetch(`/api/gdrive/batch-read?folderId=${encodeURIComponent(targetFolderId)}&ignoreCache=true`);
                            if (batchRes.ok) {
                                const batchData = await batchRes.json();
                                if (batchData.linkedin && sourceLinkedinText) {
                                    sourceLinkedinText.value = batchData.linkedin;
                                    console.log(`📄 Auto-ingested LinkedIn Profile content for new session`);
                                }
                                if (batchData.intake && sourceIntakeText) {
                                    sourceIntakeText.value = batchData.intake;
                                    console.log(`📄 Auto-ingested Intake Answers content for new session`);
                                }
                                if (batchData.transcript && sourceTranscriptText) {
                                    sourceTranscriptText.value = batchData.transcript;
                                    console.log(`📄 Auto-ingested Call Transcript content for new session`);
                                }
                                if (typeof updateValidationBadges === 'function') updateValidationBadges();
                            }
                        } catch (autoIngestErr) {
                            console.error('Failed auto-ingestion for new session:', autoIngestErr);
                        } finally {
                            if (chatUserInput) chatUserInput.disabled = false;
                            if (chatSendBtn) chatSendBtn.disabled = false;
                            if (ingestSpinner) ingestSpinner.remove();
                        }
                    }
                }
                
                // Populate Contact Selector for BOTH new and existing sessions
                const contactSelector = document.getElementById('meta-contact-selector');
                if (contactSelector && resolvedFilesData && resolvedFilesData.items) {
                    contactSelector.innerHTML = '<option value="">-- Select Contact --</option>';
                    const uniqueNames = new Set();
                    
                    resolvedFilesData.items.forEach(f => {
                        if (f.isFolder) return;
                        // Extract contact name from filename (e.g. Prospect_Profile_Sarah Chen.pdf -> Sarah Chen)
                        const parts = f.name.replace(/\.[^/.]+$/, '').split('_');
                        if (parts.length >= 3) {
                            const possibleName = parts.slice(2).join(' ').trim();
                            if (possibleName) uniqueNames.add(possibleName);
                        } else {
                            // Fallback if naming convention doesn't match
                            uniqueNames.add(f.name.replace(/\.[^/.]+$/, '').trim());
                        }
                    });
                    
                    uniqueNames.forEach(name => {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        contactSelector.appendChild(opt);
                    });
                    
                    contactSelector.onchange = (e) => {
                        if (e.target.value) {
                            document.getElementById('meta-name').value = e.target.value;
                        }
                    };
                }
                
                if (targetFolderId) {
                    await loadSourcesForCompany(targetFolderId, companyFolder.name, resolvedFilesData, prospectName);
                }
            }
        } catch (err) {
            console.error('Error loading prospect data on select:', err);
            showToast('Failed to load prospect data.');
            sourcesList.innerHTML = '<div style="color: #ef4444; font-size: 0.75rem; padding: 1rem; text-align: center;">Failed to load files</div>';
        }
    }

    function recalculateProspectSuffixes() {
        const clientNormalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        document.querySelectorAll('.sidebar-prospect-header').forEach(header => {
            const prospectName = header.getAttribute('data-prospect-name');
            const folderId = header.getAttribute('data-folder-id');
            const folder = gdriveFolders.find(f => f.id === folderId);
            if (!folder) return;
            
            const normName = clientNormalize(prospectName);
            const existsUnderOtherCompany = chatsList.some(c => 
                c.company && clientNormalize(c.company) !== clientNormalize(folder.name) &&
                c.name && clientNormalize(c.name) === normName
            );
            let existsInOtherCachedFolders = false;
            for (const [otherFolderId, otherData] of gdriveSubfolderCache.entries()) {
                if (otherFolderId !== folderId && otherData && otherData.items) {
                    const hasMatch = otherData.items.some(item => 
                        item.isFolder && clientNormalize(item.name) === normName
                    );
                    if (hasMatch) {
                        existsInOtherCachedFolders = true;
                        break;
                    }
                }
            }
            const isGlobalDuplicate = existsUnderOtherCompany || existsInOtherCachedFolders;
            const pTitle = header.querySelector('.sidebar-folder-title');
            if (pTitle) {
                const warningSpan = pTitle.querySelector('.prospect-duplicate-warning');
                if (isGlobalDuplicate) {
                    pTitle.innerText = '👤 ' + prospectName + ' (' + folder.name + ')';
                } else {
                    pTitle.innerText = '👤 ' + prospectName;
                }
                if (warningSpan) {
                    pTitle.appendChild(warningSpan);
                }
            }
        });
    }

    async function loadProspectsTree(preFetchedData = null) {
        if (!recentChatsList) return;
        loadTreeCount++;
        const currentCount = loadTreeCount;
        recentChatsList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 1.5rem; text-align: center;">Loading folders...</div>';
        try {
            if (!preFetchedData) {
                gdriveSubfolderCache.clear();
            }
            const data = preFetchedData || await (await fetch('/api/gdrive/list', { headers: { 'Cache-Control': 'no-cache' } })).json();
            if (currentCount !== loadTreeCount) return;
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
                
                // Pre-fetch expanded subfolders first to avoid concurrent render race conditions
                const fetchPromises = [];
                uniqueFolders.forEach(folder => {
                    const isExpanded = expandedCompanies.has(folder.name) || activeFolderId === folder.id;
                    if (isExpanded && !gdriveSubfolderCache.has(folder.id)) {
                        const fetchPromise = fetch(`/api/gdrive/list?folderId=${encodeURIComponent(folder.id)}&company=${encodeURIComponent(folder.name)}`, { headers: { 'Cache-Control': 'no-cache' } })
                            .then(res => res.json())
                            .then(gdriveData => {
                                gdriveSubfolderCache.set(folder.id, gdriveData);
                            })
                            .catch(err => {
                                console.error(`Error pre-fetching subfolders for ${folder.name}:`, err);
                            });
                        fetchPromises.push(fetchPromise);
                    }
                });
                if (fetchPromises.length > 0) {
                    await Promise.all(fetchPromises);
                    if (currentCount !== loadTreeCount) return;
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
                
                for (const [index, folder] of uniqueFolders.entries()) {
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
                    
                    const toggleHtml = `
                        <div class="sidebar-folder-actions">
                            <span class="sidebar-folder-add-btn" title="Quick Add Prospect">+</span>
                            <span class="sidebar-folder-toggle">▼</span>
                        </div>
                    `;
                    
                    folderHeader.innerHTML = `
                        <div class="sidebar-folder-title">
                            📁 ${folder.name}
                        </div>
                        ${toggleHtml}
                    `;
                    
                    // Attach event listener to the + button
                    const addBtn = folderHeader.querySelector('.sidebar-folder-add-btn');
                    if (addBtn) {
                        addBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            handleGlobalNewChat();
                            
                            const addProspectModal = document.getElementById('add-prospect-modal');
                            const quickMetaName = document.getElementById('quick-meta-name');
                            const quickMetaCompany = document.getElementById('quick-meta-company');
                            
                            if (quickMetaName) quickMetaName.value = '';
                            if (quickMetaCompany) {
                                quickMetaCompany.value = folder.name;
                                quickMetaCompany.setAttribute('readonly', 'true');
                                quickMetaCompany.style.backgroundColor = '#f1f5f9';
                                quickMetaCompany.style.cursor = 'not-allowed';
                                quickMetaCompany.style.color = '#64748b';
                            }
                            
                            if (addProspectModal) addProspectModal.classList.remove('modal-hidden');
                            setTimeout(() => { if (quickMetaName) quickMetaName.focus(); }, 100);
                        });
                    }
                    
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
                    
                    let subfoldersRendered = false;
                    const renderSubfolders = async () => {
                        if (subfoldersRendered) return;
                        subfoldersRendered = true;
                        
                        let gdriveData = gdriveSubfolderCache.get(folder.id);
                        if (!gdriveData) {
                            contents.innerHTML = '<div style="color: #64748b; font-size: 0.75rem; padding: 1rem; text-align: center;">Loading subfolders...</div>';
                            try {
                                const gdriveRes = await fetch(`/api/gdrive/list?folderId=${encodeURIComponent(folder.id)}&company=${encodeURIComponent(folder.name)}`, { headers: { 'Cache-Control': 'no-cache' } });
                                if (currentCount !== loadTreeCount) return;
                                gdriveData = await gdriveRes.json();
                                gdriveSubfolderCache.set(folder.id, gdriveData);
                            } catch (err) {
                                console.error('Error fetching subfolders:', err);
                                contents.innerHTML = '<div style="color: #ef4444; font-size: 0.75rem; padding: 1rem; text-align: center;">Failed to load subfolders</div>';
                                return;
                            }
                        }
                        
                        try {
                            if (currentCount !== loadTreeCount) return;
                            const gdriveSubfolders = (gdriveData.items || []).filter(f => f.isFolder);
                            
                            // Fetch History
                            const matchedSessions = chatsList.filter(c => 
                                c.company && c.company.toLowerCase().trim() === folder.name.toLowerCase().trim()
                            );
                            matchedSessions.sort((a, b) => new Date(b.date) - new Date(a.date));                            const prospectGroups = {};
                            const clientNormalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                            
                            // 1. Initialize from GDrive (deduplicating by normalized name)
                            gdriveSubfolders.forEach(subf => {
                                const norm = clientNormalize(subf.name);
                                let existingKey = Object.keys(prospectGroups).find(k => clientNormalize(k) === norm);
                                if (existingKey) {
                                    if (!prospectGroups[existingKey].gdriveId) {
                                        prospectGroups[existingKey].gdriveId = subf.id;
                                    }
                                } else {
                                    const displayName = subf.name.replace(/_/g, ' ').trim();
                                    prospectGroups[displayName] = {
                                        gdriveId: subf.id,
                                        sessions: []
                                    };
                                }
                            });
                            
                            // 2. Merge History (deduplicating by normalized name)
                            matchedSessions.forEach(session => {
                                const pName = (session.name && session.name.trim()) ? session.name.trim() : 'Unknown Prospect';
                                const norm = clientNormalize(pName);
                                let existingKey = Object.keys(prospectGroups).find(k => clientNormalize(k) === norm);
                                if (existingKey) {
                                    prospectGroups[existingKey].sessions.push(session);
                                    if (existingKey.includes('_') && !pName.includes('_')) {
                                        const groupData = prospectGroups[existingKey];
                                        delete prospectGroups[existingKey];
                                        prospectGroups[pName] = groupData;
                                    }
                                } else {
                                    const displayName = pName.replace(/_/g, ' ').trim();
                                    prospectGroups[displayName] = {
                                        gdriveId: null,
                                        sessions: [session]
                                    };
                                }
                            });
                            
                            contents.innerHTML = '';
 
                             for (const [prospectName, groupData] of Object.entries(prospectGroups)) {
                                const sessions = groupData.sessions;
                                const subfolderId = groupData.gdriveId;
                                
                                const prospectSubFolder = document.createElement('div');
                                prospectSubFolder.className = 'sidebar-prospect-wrapper';
                                
                                const prospectHeader = document.createElement('div');
                                prospectHeader.className = 'sidebar-prospect-header';
                                prospectHeader.setAttribute('data-prospect-name', prospectName);
                                prospectHeader.setAttribute('data-folder-id', folder.id);
                                
                                const isProspectActive = (activeProspectName && clientNormalize(activeProspectName) === clientNormalize(prospectName));
                                if (isProspectActive) {
                                    prospectHeader.classList.add('active');
                                }
                                
                                const normName = clientNormalize(prospectName);
                                const existsUnderOtherCompany = chatsList.some(c => 
                                    c.company && clientNormalize(c.company) !== clientNormalize(folder.name) &&
                                    c.name && clientNormalize(c.name) === normName
                                );
                                let existsInOtherCachedFolders = false;
                                for (const [otherFolderId, otherData] of gdriveSubfolderCache.entries()) {
                                    if (otherFolderId !== folder.id && otherData && otherData.items) {
                                        const hasMatch = otherData.items.some(item => 
                                            item.isFolder && clientNormalize(item.name) === normName
                                        );
                                        if (hasMatch) {
                                            existsInOtherCachedFolders = true;
                                            break;
                                        }
                                    }
                                }
                                const isGlobalDuplicate = existsUnderOtherCompany || existsInOtherCachedFolders;

                                const pTitle = document.createElement('div');
                                pTitle.className = 'sidebar-folder-title';
                                pTitle.style.fontSize = '0.85rem';
                                if (isGlobalDuplicate) {
                                    pTitle.innerText = '👤 ' + prospectName + ' (' + folder.name + ')';
                                } else {
                                    pTitle.innerText = '👤 ' + prospectName;
                                }
                                
                                prospectHeader.appendChild(pTitle);
                                
                                const toggleArrow = document.createElement('span');
                                toggleArrow.className = 'sidebar-prospect-toggle';
                                toggleArrow.innerText = '▼';
                                prospectHeader.appendChild(toggleArrow);
                                
                                prospectSubFolder.appendChild(prospectHeader);
                                
                                const prospectContents = document.createElement('div');
                                prospectContents.className = 'sidebar-prospect-sessions';
                                
                                let hasActiveSession = false;
                                sessions.forEach(session => {
                                    const sessionItem = document.createElement('div');
                                    sessionItem.className = 'sidebar-session-item';
                                    sessionItem.setAttribute('data-session-id', session.id);
                                    
                                    if (currentChatId === session.id) {
                                        sessionItem.classList.add('active');
                                        hasActiveSession = true;
                                    }
                                    
                                    const textSpan = document.createElement('span');
                                    textSpan.className = 'session-text';
                                    const displayDateSuffix = session.date ? ` (${new Date(session.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})})` : '';
                                    const titleText = session.title || 'Untitled Session';
                                    textSpan.innerText = `💬 ${titleText}${displayDateSuffix}`;
                                    sessionItem.appendChild(textSpan);
                                    
                                    // Edit name button
                                    const editBtn = document.createElement('button');
                                    editBtn.className = 'btn-edit-session';
                                    editBtn.type = 'button';
                                    editBtn.innerText = '✏️';
                                    editBtn.title = 'Rename Session';
                                    editBtn.addEventListener('click', (e) => {
                                        e.stopPropagation();
                                        
                                        textSpan.style.display = 'none';
                                        editBtn.style.display = 'none';
                                        delBtn.style.display = 'none';
                                        
                                        const input = document.createElement('input');
                                        input.type = 'text';
                                        input.className = 'edit-session-input';
                                        input.value = session.title || 'Untitled Session';
                                        sessionItem.insertBefore(input, sessionItem.firstChild);
                                        
                                        const saveBtn = document.createElement('button');
                                        saveBtn.className = 'btn-save-session';
                                        saveBtn.type = 'button';
                                        saveBtn.innerText = '✔️';
                                        sessionItem.appendChild(saveBtn);
                                        
                                        const cancelBtn = document.createElement('button');
                                        cancelBtn.className = 'btn-cancel-session';
                                        cancelBtn.type = 'button';
                                        cancelBtn.innerText = '❌';
                                        sessionItem.appendChild(cancelBtn);
                                        
                                        input.focus();
                                        input.select();
                                        
                                        let isActionComplete = false;
                                        const cleanup = () => {
                                            if (isActionComplete) return;
                                            isActionComplete = true;
                                            input.remove();
                                            saveBtn.remove();
                                            cancelBtn.remove();
                                            textSpan.style.display = '';
                                            editBtn.style.display = '';
                                            delBtn.style.display = '';
                                        };
                                        
                                        const doSave = async () => {
                                            const newTitle = input.value.trim();
                                            if (newTitle === '') {
                                                showToast('Session name cannot be empty.', 'error');
                                                input.focus();
                                                return;
                                            }
                                            if (newTitle === (session.title || 'Untitled Session')) {
                                                cleanup();
                                                return;
                                            }
                                            isActionComplete = true;
                                            input.disabled = true;
                                            saveBtn.disabled = true;
                                            cancelBtn.disabled = true;
                                            try {
                                                const res = await fetch('/api/history/title', {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ id: session.id, title: newTitle })
                                                });
                                                if (!res.ok) throw new Error(`HTTP status ${res.status}`);
                                                session.title = newTitle;
                                                textSpan.innerText = `💬 ${session.title}${displayDateSuffix}`;
                                                showToast('Session renamed successfully.');
                                            } catch (err) {
                                                console.error('Rename failed:', err);
                                                showToast('Failed to rename session.', 'error');
                                                isActionComplete = false;
                                                input.disabled = false;
                                                saveBtn.disabled = false;
                                                cancelBtn.disabled = false;
                                                input.focus();
                                            } finally {
                                                if (isActionComplete) cleanup();
                                            }
                                        };
                                        
                                        saveBtn.addEventListener('click', (ev) => { ev.stopPropagation(); doSave(); });
                                        cancelBtn.addEventListener('click', (ev) => { ev.stopPropagation(); cleanup(); });
                                        input.addEventListener('click', (ev) => { ev.stopPropagation(); });
                                        input.addEventListener('keydown', (ev) => {
                                            if (ev.key === 'Enter') { ev.preventDefault(); doSave(); }
                                            else if (ev.key === 'Escape') { ev.preventDefault(); cleanup(); }
                                        });
                                        input.addEventListener('blur', () => { setTimeout(cleanup, 200); });
                                    });
                                    sessionItem.appendChild(editBtn);
                                    
                                    // Delete button
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
                                    
                                    sessionItem.addEventListener('click', (e) => {
                                        e.stopPropagation();
                                        selectChat(session.id);
                                    });
                                    
                                    prospectContents.appendChild(sessionItem);
                                });
                                
                                const isSessionsCollapsed = !hasActiveSession;
                                if (isSessionsCollapsed) {
                                    prospectContents.classList.add('collapsed');
                                    toggleArrow.style.transform = 'rotate(-90deg)';
                                } else {
                                    prospectContents.classList.remove('collapsed');
                                    toggleArrow.style.transform = 'rotate(0deg)';
                                }
                                
                                prospectHeader.addEventListener('click', async (e) => {
                                    e.stopPropagation();
                                    const isCollapsedNow = prospectContents.classList.toggle('collapsed');
                                    toggleArrow.style.transform = isCollapsedNow ? 'rotate(-90deg)' : 'rotate(0deg)';
                                    
                                    const isChatPanelActive = !workspaceActiveChat.classList.contains('hidden');
                                    const isCurrentlyDisplayed = (activeProspectName === prospectName && activeFolderId === folder.id);
                                    
                                    if (isCurrentlyDisplayed && isChatPanelActive) {
                                        if (subfolderId) {
                                            await loadSourcesForCompany(subfolderId, folder.name, null, prospectName);
                                        }
                                        return;
                                    }
                                    
                                    try {
                                        await selectProspect(folder, prospectName, subfolderId);
                                    } catch (err) {
                                        console.error('Click handler: Failed to select prospect:', err);
                                    }
                                });
                                
                                prospectSubFolder.appendChild(prospectContents);
                                contents.appendChild(prospectSubFolder);
                            }
                            recalculateProspectSuffixes();
                        } catch(err) {
                            console.error('Error fetching subfolders:', err);
                            contents.innerHTML = '<div style="color: #ef4444; font-size: 0.75rem; padding: 1rem; text-align: center;">Failed to load subfolders</div>';
                        }
                    };
                    
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
                            await renderSubfolders();
                        }
                        await selectProspect(folder, '');
                    });
                    
                    if (isExpanded) {
                        await renderSubfolders();
                        if (currentCount !== loadTreeCount) return;
                    }
                    
                    recentChatsList.appendChild(folderItem);
                    if (index === 0) {
                        firstFolderObj = folder;
                        firstProspectName = '';
                    }
                }
                if (currentCount !== loadTreeCount) return;
                recalculateProspectSuffixes();
                
                const isEmptyState = workspaceEmptyState && !workspaceEmptyState.classList.contains('hidden');
                if (!currentChatId && !activeFolderId && firstFolderObj && isEmptyState && !isTestRunner) {
                    await selectProspect(firstFolderObj, firstProspectName);
                }
            } else {
                recentChatsList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 1.5rem; text-align: center;">No prospect folders found</div>';
            }
        } catch (err) {
            console.error('Error loading prospects tree:', err);
            recentChatsList.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem; padding: 1.5rem; text-align: center;">Error loading folders</div>';
        }
    }

    async function loadSourcesForCompany(folderId, companyName, preFetchedFiles = null, prospectName = null) {
        if (!sourcesList) return;
        sourcesList.innerHTML = '<div style="color: #64748b; font-size: 0.75rem; padding: 1rem; text-align: center;">Loading files...</div>';
        try {
            const data = preFetchedFiles || await (await fetch(`/api/gdrive/list?folderId=${encodeURIComponent(folderId)}&company=${encodeURIComponent(companyName)}`, { headers: { 'Cache-Control': 'no-cache' } })).json();
            sourcesList.innerHTML = '';
            
            const files = data.items ? data.items.filter(f => !f.isFolder) : [];
            
            // Construct and render metadata context header at the top
            const headerInfo = document.createElement('div');
            headerInfo.className = 'sources-header-info';
            headerInfo.style.cssText = 'padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 0.75rem; font-size: 0.8rem; color: #475569; background: #f8fafc; border-radius: 6px;';
            headerInfo.innerHTML = `
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 0.25rem;">${companyName}</div>
                <div style="color: #64748b;">${prospectName ? prospectName + ' Documents' : 'Account Documents'}</div>
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
    async function startNewSessionForProspect(companyFolder, prospectName, subfolderId = null) {
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
        if (metaRep) metaRep.value = '';
        if (metaTrack) metaTrack.value = '';
        
        // Set headers
        if (activeChatClientTitle) {
            activeChatClientTitle.innerText = activeProspectName ? `${companyFolder.name} (${activeProspectName})` : companyFolder.name;
        }
        if (activeChatClientMeta) activeChatClientMeta.innerText = '';
        
        if (workspaceEmptyState) workspaceEmptyState.classList.add('hidden');
        if (workspaceActiveChat) workspaceActiveChat.classList.remove('hidden');
        
        chatHistory = [];
        renderChatHistory();
        
        sourcesList.innerHTML = '<div style="color: #64748b; font-size: 0.75rem; padding: 1rem; text-align: center;">Loading files...</div>';
        try {
            if (!prospectName) {
                sourcesList.innerHTML = '<div style="color: #64748b; font-size: 0.85rem; padding: 2rem 1rem; text-align: center; border: 1px dashed #cbd5e1; border-radius: 8px; margin-top: 1rem;">Please select a prospect subfolder from the sidebar to view documents.</div>';
            } else if (!subfolderId) {
                sourcesList.innerHTML = `<div style="color: #64748b; font-size: 0.85rem; padding: 2rem 1rem; text-align: center; border: 1px dashed #cbd5e1; border-radius: 8px; margin-top: 1rem;">No subfolder found. Please create a folder named "<b>${prospectName}</b>" inside "<b>${companyFolder.name}</b>" to add files.</div>`;
            } else {
                const targetFolderId = subfolderId;
                const resolvedFilesData = await (await fetch(`/api/gdrive/list?folderId=${encodeURIComponent(targetFolderId)}&company=${encodeURIComponent(companyFolder.name)}`, { headers: { 'Cache-Control': 'no-cache' } })).json();
                await loadSourcesForCompany(targetFolderId, companyFolder.name, resolvedFilesData, prospectName);
            }
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
            metaRep.value = data.rep || '';
            metaTrack.value = data.track || '';
            
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
                // Lock inputs during ingestion
                if (chatUserInput) chatUserInput.disabled = true;
                if (chatSendBtn) chatSendBtn.disabled = true;
                
                // Show ingestion spinner in sources panel
                const ingestSpinner = document.createElement('div');
                ingestSpinner.className = 'ingest-loading-spinner-container';
                ingestSpinner.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.5rem 1rem; margin-bottom: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 6px; font-size: 0.8rem;';
                ingestSpinner.innerHTML = `
                    <div class="spinner" style="width: 14px; height: 14px; border: 2px solid rgba(22, 101, 52, 0.2); border-top-color: #166534; border-radius: 50%; animation: rotate 1s linear infinite; box-sizing: border-box;"></div>
                    <span>Auto-ingesting document files...</span>
                `;
                if (sourcesList && sourcesList.firstChild) {
                    sourcesList.insertBefore(ingestSpinner, sourcesList.firstChild);
                } else if (sourcesList) {
                    sourcesList.appendChild(ingestSpinner);
                }

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
                } finally {
                    if (chatUserInput) chatUserInput.disabled = false;
                    if (chatSendBtn) chatSendBtn.disabled = false;
                    if (ingestSpinner) ingestSpinner.remove();
                }
            }

            // Setup Header Info
            activeChatClientTitle.innerText = `${data.company} (${data.name})`;
            activeChatClientMeta.innerText = '';

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
    function buildHtmlTable(headers, rows) {
        let html = '<table>';
        html += '<thead><tr>';
        headers.forEach(h => {
            html += `<th>${h}</th>`;
        });
        html += '</tr></thead>';
        html += '<tbody>';
        rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    /**
     * Parse simple Markdown inline code, bolding, tables, and lists into HTML.
     */
    function formatMessageContent(content) {
        if (!content) return '';
        
        // Use marked to parse all markdown (tables, lists, bold) if available
        if (window.marked && typeof window.marked.parse === 'function') {
            const rawHtml = window.marked.parse(content);
            if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                return window.DOMPurify.sanitize(rawHtml);
            }
            return rawHtml; // Trusting marked if DOMPurify isn't loaded
        }
        
        // Fallback if marked is not available
        let escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
            
        let htmlResult = escaped.replace(/\n/g, '<br>');
        return htmlResult;
    }

    function downloadLeadSheetPDF(text, clientName) {
        function stripHtmlTags(str) {
            if (!str) return '';
            return str.replace(/<\/?[^>]+(>|$)/g, '').trim();
        }

        const requiredSections = [
            'type of sale',
            'business activity',
            'customer match',
            'assessment',
            'conversation starter',
            'complementary applications',
            'competing applications',
            'competing consulting firms'
        ];
        
        const textLower = text.toLowerCase();
        const missingSections = requiredSections.filter(sec => !textLower.includes(sec));
        if (missingSections.length > 0) {
            console.warn('PDF Schema validation warning: missing sections:', missingSections);
        }

        const lines = text.split('\n');
        const content = [];
        let currentTable = null;
        
        const styles = {
            title: { fontSize: 18, bold: true, margin: [0, 0, 0, 15], color: '#1e3a8a' },
            heading: { fontSize: 13, bold: true, margin: [0, 15, 0, 8], color: '#2563eb' },
            subheading: { fontSize: 11, bold: true, margin: [0, 10, 0, 6], color: '#1e293b' },
            text: { fontSize: 10, margin: [0, 0, 0, 8] }
        };

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;
            
            // 1. Strip lists and next steps completely
            if (line.startsWith('-') || line.startsWith('*')) {
                continue;
            }
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('suggested next steps') || lowerLine.includes('next steps')) {
                continue;
            }

            // 2. Identify the LEAD SHEET title or headings
            if (line.includes('=== LEAD SHEET ===')) {
                if (currentTable) {
                    content.push(currentTable);
                    currentTable = null;
                }
                content.push({ text: 'LEAD SHEET', style: 'title' });
            } else if (line.startsWith('### ')) {
                if (currentTable) {
                    content.push(currentTable);
                    currentTable = null;
                }
                const headingText = stripHtmlTags(line.replace('### ', '').replace(/\*\*/g, '').trim());
                content.push({ text: headingText, style: 'heading' });
            } else if (line.startsWith('#### ')) {
                if (currentTable) {
                    content.push(currentTable);
                    currentTable = null;
                }
                const subheadingText = stripHtmlTags(line.replace('#### ', '').replace(/\*\*/g, '').trim());
                content.push({ text: subheadingText, style: 'subheading' });
            } else if (line.startsWith('|')) {
                // Table parsing
                const cols = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
                if (cols.length === 0) continue;
                
                // Ignore separator line like | --- | --- |
                if (cols.every(c => /^[:-]+$/.test(c))) {
                    continue;
                }
                
                if (!currentTable) {
                    const tableHeaders = cols.map(c => stripHtmlTags(c.replace(/\*\*/g, '')));
                    let widths = [150, '*'];
                    if (tableHeaders.length === 3) {
                        widths = [30, 120, '*'];
                    } else if (tableHeaders.length > 3) {
                        widths = Array(tableHeaders.length).fill('*');
                    }
                    currentTable = {
                        table: {
                            widths: widths,
                            body: [
                                tableHeaders.map(h => ({ text: h, bold: true, fillColor: '#f1f5f9', margin: [5, 5, 5, 5] }))
                            ]
                        },
                        margin: [0, 5, 0, 15],
                        layout: {
                            hLineWidth: function (i, node) {
                                return (i === 0 || i === node.table.body.length) ? 1.5 : 0.5;
                            },
                            vLineWidth: function (i, node) {
                                return 0.5;
                            },
                            hLineColor: function (i, node) {
                                return (i === 0 || i === node.table.body.length) ? '#1e3a8a' : '#cbd5e1';
                            },
                            vLineColor: function () {
                                return '#cbd5e1';
                            }
                        }
                    };
                } else {
                    const expectedCols = currentTable.table.widths.length;
                    const rowCells = [];
                    for (let colIdx = 0; colIdx < expectedCols; colIdx++) {
                        const cellVal = cols[colIdx] || '';
                        const isBold = cellVal.startsWith('**') && cellVal.endsWith('**');
                        const cleanText = stripHtmlTags(cellVal.replace(/\*\*/g, ''));
                        rowCells.push({ text: cleanText, bold: isBold, margin: [5, 5, 5, 5] });
                    }
                    currentTable.table.body.push(rowCells);
                }
            } else {
                if (currentTable) {
                    content.push(currentTable);
                    currentTable = null;
                }
                const cleanText = stripHtmlTags(line.replace(/\*\*/g, ''));
                content.push({ text: cleanText, style: 'text' });
            }
        }
        
        if (currentTable) {
            content.push(currentTable);
        }
        
        const docDefinition = {
            content: content,
            styles: styles
        };
        
        if (window.pdfMake) {
            pdfMake.createPdf(docDefinition).download(`Lead_Sheet_${clientName.replace(/\s+/g, '_')}.pdf`);
        } else {
            showToast('PDF generation library not loaded.');
        }
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
                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-message-content';
                msgDiv.innerHTML = formatMessageContent(msg.content);
                card.appendChild(msgDiv);
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

                // Add PDF download button if it matches Lead Sheet format
                const isLeadSheet = msg.content.includes('=== LEAD SHEET ===');
                if (isLeadSheet) {
                    const btnDownloadPdf = document.createElement('button');
                    btnDownloadPdf.type = 'button';
                    btnDownloadPdf.className = 'chat-message-btn';
                    btnDownloadPdf.innerText = '📄 Download PDF';
                    btnDownloadPdf.addEventListener('click', () => {
                        const clientName = (metaName && metaName.value.trim()) || 'Prospect';
                        downloadLeadSheetPDF(msg.content, clientName);
                    });
                    actions.appendChild(btnDownloadPdf);
                }

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

        // Append loading indicator to bottom of log if it exists and is not hidden
        if (chatLoadingIndicator && chatMessagesLog && !chatLoadingIndicator.classList.contains('hidden')) {
            chatMessagesLog.appendChild(chatLoadingIndicator);
        } else if (chatLoadingIndicator) {
            chatLoadingIndicator.remove();
        }

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
            rep: metaRep ? metaRep.value : '',
            track: metaTrack ? metaTrack.value : '',
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
            closeCreateProspectModal();
            
            // If it was a new chat, update currentChatId
            if (!currentChatId) {
                currentChatId = result.id;
            }
            if (result.gDriveFolderId) {
                activeFolderId = result.gDriveFolderId;
            }
            activeProspectName = name;
            
            // Add company to expanded list to seamlessly show newly added prospect
            if (typeof expandedCompanies !== 'undefined' && payload.company) {
                expandedCompanies.add(payload.company);
            }

            // Force reload of folder explorer tree and run heavy loading tasks asynchronously in the background
            gdriveFolders = [];
            
            (async () => {
                try {
                    await loadChatsList();
                    await Promise.all([
                        loadProspectsTree(),
                        loadGoogleDriveFiles()
                    ]);
                    
                    // Setup Header Info directly to prevent clearing chat history and race conditions
                    if (activeChatClientTitle) activeChatClientTitle.innerText = `${payload.company} (${payload.name})`;
                    if (activeChatClientMeta) activeChatClientMeta.innerText = '';
                    renderChatHistory();

                    // --- AUTO-INGEST: If textareas are empty, try loading content from GDrive files in batch ---
                    if (activeFolderId && (!sourceLinkedinText.value.trim() || !sourceIntakeText.value.trim() || !sourceTranscriptText.value.trim())) {
                        if (chatUserInput) chatUserInput.disabled = true;
                        if (chatSendBtn) chatSendBtn.disabled = true;
                        
                        const ingestSpinner = document.createElement('div');
                        ingestSpinner.className = 'ingest-loading-spinner-container';
                        ingestSpinner.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.5rem 1rem; margin-bottom: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 6px; font-size: 0.8rem;';
                        ingestSpinner.innerHTML = `
                            <div class="spinner" style="width: 14px; height: 14px; border: 2px solid rgba(22, 101, 52, 0.2); border-top-color: #166534; border-radius: 50%; animation: rotate 1s linear infinite; box-sizing: border-box;"></div>
                            <span>Auto-ingesting document files...</span>
                        `;
                        if (sourcesList && sourcesList.firstChild) {
                            sourcesList.insertBefore(ingestSpinner, sourcesList.firstChild);
                        } else if (sourcesList) {
                            sourcesList.appendChild(ingestSpinner);
                        }

                        try {
                            const batchRes = await fetch(`/api/gdrive/batch-read?folderId=${encodeURIComponent(activeFolderId)}&ignoreCache=true`);
                            if (batchRes.ok) {
                                const batchData = await batchRes.json();
                                let updated = false;

                                if (batchData.linkedin && !sourceLinkedinText.value.trim()) {
                                    sourceLinkedinText.value = batchData.linkedin;
                                    console.log(`📄 Auto-ingested LinkedIn Profile content for newly initialized session`);
                                    updated = true;
                                }
                                if (batchData.intake && !sourceIntakeText.value.trim()) {
                                    sourceIntakeText.value = batchData.intake;
                                    console.log(`📄 Auto-ingested Intake Answers content for newly initialized session`);
                                    updated = true;
                                }
                                if (batchData.transcript && !sourceTranscriptText.value.trim()) {
                                    sourceTranscriptText.value = batchData.transcript;
                                    console.log(`📄 Auto-ingested Call Transcript content for newly initialized session`);
                                    updated = true;
                                }

                                if (updated) {
                                    if (typeof updateValidationBadges === 'function') updateValidationBadges();
                                    if (typeof triggerAutoSave === 'function') triggerAutoSave();
                                }
                            }
                        } catch (autoIngestErr) {
                            console.error('Failed auto-ingestion for newly initialized session:', autoIngestErr);
                        } finally {
                            if (chatUserInput) chatUserInput.disabled = false;
                            if (chatSendBtn) chatSendBtn.disabled = false;
                            if (ingestSpinner) ingestSpinner.remove();
                        }
                    }
                } catch (backgroundErr) {
                    console.error('Error running background sources load:', backgroundErr);
                }
            })();

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

            const clientNormalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            const normNewName = clientNormalize(name);
            const normNewCompany = clientNormalize(company);
            const isDuplicate = chatsList.some(chat => 
                chat.id !== currentChatId &&
                clientNormalize(chat.company) === normNewCompany &&
                clientNormalize(chat.name) === normNewName
            );

            let existsInOtherCachedFolders = false;
            let otherCompanyFromGDrive = '';
            for (const [otherFolderId, otherData] of gdriveSubfolderCache.entries()) {
                const otherFolder = gdriveFolders.find(f => f.id === otherFolderId);
                if (otherFolder && clientNormalize(otherFolder.name) !== normNewCompany && otherData && otherData.items) {
                    const hasMatch = otherData.items.some(item => 
                        item.isFolder && clientNormalize(item.name) === normNewName
                    );
                    if (hasMatch) {
                        existsInOtherCachedFolders = true;
                        otherCompanyFromGDrive = otherFolder.name;
                        break;
                    }
                }
            }

            const isGlobalDuplicate = chatsList.some(chat =>
                chat.id !== currentChatId &&
                clientNormalize(chat.company) !== normNewCompany &&
                clientNormalize(chat.name) === normNewName
            ) || existsInOtherCachedFolders;

            if (isDuplicate) {
                const confirmed = await showConfirmModal({
                    title: '⚠️ Duplicate Prospect Warning',
                    message: `A prospect named "${name}" already exists under "${company}". Saving this will create another session for the same client. Do you want to proceed?`,
                    confirmText: 'Yes, Save Anyway',
                    cancelText: 'Cancel',
                    type: 'danger',
                    forceShow: !!window.__test_force_duplicate_warning
                });
                if (!confirmed) return;
            } else if (isGlobalDuplicate) {
                const existingChat = chatsList.find(chat =>
                    chat.id !== currentChatId &&
                    clientNormalize(chat.company) !== normNewCompany &&
                    clientNormalize(chat.name) === normNewName
                );
                const existingCo = existingChat ? existingChat.company : (otherCompanyFromGDrive || 'another company');
                const confirmed = await showConfirmModal({
                    title: '⚠️ Duplicate Prospect Warning',
                    message: `A prospect named "${name}" already exists under "${existingCo}". Are you sure this is a different person and you want to proceed?`,
                    confirmText: 'Yes, Create Anyway',
                    cancelText: 'Cancel',
                    type: 'danger',
                    forceShow: !!window.__test_force_duplicate_warning
                });
                if (!confirmed) return;
            } else {
                const confirmed = await showConfirmModal({
                    title: 'Save Prospect Sources',
                    message: `Are you sure you want to save the prospect details and initialize/update the session for "${name}" at "${company}"?`,
                    confirmText: 'Save',
                    cancelText: 'Cancel',
                    type: 'primary'
                });
                if (!confirmed) return;
            }

            await saveDiscoverySession(name, company, email);
        });
    }

    // --- Create New Chat (Global / Sidebar) ---
    const handleGlobalNewChat = (prefilledCompanyName = '', prefilledProspectName = '') => {
        currentChatId = null;
        activeFolderId = null;
        activeProspectName = null;
        renderChatsList();

        workspaceEmptyState.classList.add('hidden');
        workspaceActiveChat.classList.remove('hidden');
        chatMessagesLog.innerHTML = '';

        toggleDrawer(true);

        // Clear inputs
        metaName.value = prefilledProspectName;
        metaCompany.value = prefilledCompanyName;
        metaTitle.value = '';
        metaEmail.value = '';
        metaPhone.value = '';
        metaRep.value = '';
        metaTrack.value = '';
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

    // --- Create Prospect Modal Logic ---
    const createProspectModal = document.getElementById('create-prospect-modal');
    const modalCompanyName = document.getElementById('modal-company-name');
    const modalProspectName = document.getElementById('modal-prospect-name');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const saveModalBtn = document.getElementById('save-modal-btn');

    const openCreateProspectModal = () => {
        if (!createProspectModal) return;
        modalCompanyName.value = '';
        modalProspectName.value = '';
        createProspectModal.classList.remove('hidden');
        modalCompanyName.focus();
    };

    const closeCreateProspectModal = () => {
        if (!createProspectModal) return;
        createProspectModal.classList.add('hidden');
    };

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeCreateProspectModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeCreateProspectModal);
    
    if (saveModalBtn) {
        saveModalBtn.addEventListener('click', async () => {
            const comp = modalCompanyName.value.trim();
            const pros = modalProspectName.value.trim();
            if (!comp || !pros) {
                showToast("Please enter both Company Name and Prospect Name", "error");
                return;
            }
            
            const originalText = saveModalBtn.innerText;
            saveModalBtn.disabled = true;
            saveModalBtn.innerText = "Creating...";
            
            try {
                // Initialize the session state globally first
                handleGlobalNewChat(comp, pros);
                // Call saveDiscoverySession directly to trigger backend DB and Google Drive folder initialization
                await saveDiscoverySession(pros, comp, '');
                closeCreateProspectModal();
                showToast(`Prospect "${pros}" created successfully.`);
            } catch (err) {
                console.error("Error creating prospect:", err);
                showToast(`Failed to create prospect: ${err.message || err}`, "error");
            } finally {
                saveModalBtn.disabled = false;
                saveModalBtn.innerText = originalText;
            }
        });
    }

    // --- Create New Chat (Contextual / Active Prospect Header) ---
    const handleProspectNewChat = () => {
        // Soft reset: Only nullify the current session ID. 
        // Do NOT nullify activeFolderId, activeProspectName, or overwrite the DOM metadata/header titles.
        currentChatId = null;
        renderChatsList();

        chatHistory = [];
        chatMessagesLog.innerHTML = `<div style="font-size:0.95rem;color:#64748b;text-align:center;padding:2rem;">Ready for a new session with <strong>${activeProspectName || 'this prospect'}</strong>.</div>`;
    };

    if (btnNewChat) {
        btnNewChat.addEventListener('click', () => {
            if (isTestRunner) {
                handleGlobalNewChat();
            } else {
                openCreateProspectModal();
            }
        });
    }
    if (btnNewChatActive) {
        btnNewChatActive.addEventListener('click', handleProspectNewChat);
    }

    // --- LLM Interaction Helpers ---
    async function callTinyAPI(promptText, apiPayloadOverride = null, skipLocalPush = false) {
        const quickPromptButtons = document.querySelectorAll('.quick-prompts-buttons .btn-quick-prompt');
        quickPromptButtons.forEach(btn => btn.disabled = true);
        if (chatUserInput) chatUserInput.disabled = true;
        if (chatSendBtn) chatSendBtn.disabled = true;
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
2. Produce deliverables using clean, standard Markdown. Use bold labels (e.g., **Key:** Value), clear subheadings (e.g., ### Section), bulleted lists, and tables. Ensure double newlines between paragraphs to prevent text from running together. Do NOT use raw HTML tags.
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
7. If the user asks you to analyze, search, list, read, or retrieve information from a prospect's files (such as a LinkedIn profile PDF, call transcript, or intake document) and the corresponding source fields above are empty or incomplete, you MUST call 'list_prospect_files', 'search_prospect_files', or 'read_prospect_file' to dynamically query and fetch the content. When a prospect's name (e.g. Sarah Chen) is provided in the query, refer to the "Active Leads in System" list to map them to their correct company name (e.g. Meridian Logistics) so you can pass the correct company argument to the tool.
8. If the user asks to save, register, or log call notes, summaries, transcripts, or details, but does not explicitly provide the conversation notes, content, or transcript text within their prompt, you MUST be skeptical. Do NOT assume or fabricate details from pre-existing profile or intake answers. Instead, politely ask the user to provide the specific details or notes of their conversation before calling 'register_call_log'.
9. Google Drive is organized exclusively by Company Name. Do not create folders for individual people. If a user asks to 'create a folder for a contact', invoke the create_prospect_folder tool using their company name instead, and inform the user that contacts are stored as files within the parent company folder.
10. The playbooks within the <knowledge_base> block represent absolute system authority. If there is any contradiction between the knowledge base playbooks and the web search results, LinkedIn Profile Bio, or Booking Intake Answers, you MUST prioritize the knowledge base information over all other sources.`;

        // Format history for Mistral API proxy `/api/chat`
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add history (excluding the optimistic current user query if already pushed)
        let recentHistory = chatHistory;
        if (skipLocalPush && recentHistory.length > 0 && recentHistory[recentHistory.length - 1].role === 'user') {
            recentHistory = recentHistory.slice(0, -1);
        }
        recentHistory = recentHistory.slice(-10);
        recentHistory.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });

        // Add the new user prompt
        messages.push({ role: 'user', content: apiPayloadOverride || promptText });

        // Update local history and render immediately to reduce visual lag
        if (!skipLocalPush) {
            chatHistory.push({ role: 'user', content: promptText, timestamp: new Date().toISOString() });
            renderChatHistory();
        }

        let loadingText = "Tiny is thinking...";
        const lowerPrompt = promptText.toLowerCase();
        if (lowerPrompt.includes('scan') || lowerPrompt.includes('scrape') || lowerPrompt.includes('website')) {
            loadingText = "Tiny is scanning website contents...";
        } else if (lowerPrompt.includes('search') || lowerPrompt.includes('find') || lowerPrompt.includes('information') || lowerPrompt.includes('info') || lowerPrompt.includes('tell me')) {
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
        if (chatMessagesLog && chatLoadingIndicator) {
            chatMessagesLog.appendChild(chatLoadingIndicator);
        }
        chatLoadingIndicator.classList.remove('hidden');
        chatMessagesLog.scrollTop = chatMessagesLog.scrollHeight;

        try {
            if (chatMessagesLog) {
                chatMessagesLog.setAttribute('data-state', 'streaming');
            }
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

            if (chatMessagesLog) {
                chatMessagesLog.setAttribute('data-state', 'idle');
            }

            const data = await res.json();
            chatLoadingIndicator.classList.add('hidden');
            chatLoadingIndicator.remove();
            const spinnerResetSpan = chatLoadingIndicator.querySelector('span');
            if (spinnerResetSpan) {
                spinnerResetSpan.innerText = "Tiny is thinking...";
            }

            if (!res.ok) {
                let errMsg = 'Failed to call chat API';
                if (data.error) {
                    if (typeof data.error === 'object') {
                        errMsg = data.error.message || JSON.stringify(data.error);
                    } else {
                        errMsg = data.error;
                    }
                }
                throw new Error(errMsg);
            }

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
                
                if (newCo && (!currentCo || currentCo.toLowerCase() !== newCo.toLowerCase()) && !data.isMismatch) {
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
                            if (metaRep) metaRep.value = '';
                            if (metaTrack) metaTrack.value = '';
                            
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
                    const refreshPromises = [
                        loadGoogleDriveFiles(),
                        loadProspectsTree()
                    ];
                    if (activeFolderId) {
                        const compName = metaCompany ? metaCompany.value.trim() : '';
                        refreshPromises.push(loadSourcesForCompany(activeFolderId, compName, null, activeProspectName));
                    }
                    await Promise.all(refreshPromises);
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

            // Re-enable interactive elements
            quickPromptButtons.forEach(btn => btn.disabled = false);
            if (chatUserInput) chatUserInput.disabled = false;
            if (chatSendBtn) chatSendBtn.disabled = false;

        } catch (err) {
            chatLoadingIndicator.classList.add('hidden');
            chatLoadingIndicator.remove();
            console.error('Chat API Error:', err);
            if (chatMessagesLog) {
                chatMessagesLog.setAttribute('data-state', 'idle');
            }
            const spinnerResetSpan = chatLoadingIndicator.querySelector('span');
            if (spinnerResetSpan) {
                spinnerResetSpan.innerText = "Tiny is thinking...";
            }
            
            // Push system error bubble
            chatHistory.push({ 
                role: 'assistant', 
                content: `**System Error:** Communication with the Generative AI provider failed. (${err.message}) \n\nThis is typically caused by API quota exhaustion or rate limits. Please try again later or check your API key configurations.`, 
                timestamp: new Date().toISOString() 
            });
            renderChatHistory();

            // Re-enable interactive elements
            quickPromptButtons.forEach(btn => btn.disabled = false);
            if (chatUserInput) chatUserInput.disabled = false;
            if (chatSendBtn) chatSendBtn.disabled = false;
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

    // --- Helper for parsing conversational deletion queries ---
    function parseDeleteQuery(query) {
        let cleaned = query.trim();
        if (cleaned.endsWith('.')) {
            cleaned = cleaned.slice(0, -1).trim();
        }
        if (cleaned.endsWith('\\')) {
            cleaned = cleaned.slice(0, -1).trim();
        }
        const deletePattern = /^(?:tiny,?\s+)?(?:delete|remove|destroy|purge|wipe)\s+(.*)$/i;
        const match = cleaned.match(deletePattern);
        if (!match) return null;
        
        let target = match[1].trim();
        if (!target) return null;
        
        target = target.replace(/^(?:a|the)\s+/i, '').trim();

        // Bypass interception if deleting a specific file instead of a company folder
        if (/^file\s+/i.test(target) || /\.[a-zA-Z0-9]{2,4}$/.test(target)) {
            return null;
        }
        
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
        
        return { type: 'folder', name: target };
    }

    function getLeadSheetPrompt() {
        return `Generate A Lead Sheet for the prospect. Include the heading "### === LEAD SHEET ===" at the very top.
Use the following markdown template exactly for layout and structure, placing headings outside the tables and ensuring double newlines between sections.
CRITICAL: You MUST output all 8 sections strictly as tables. You are strictly forbidden from outputting "Suggested Next Steps" or "Recommended Services" as lists. Do NOT output a separate "Suggested Next Steps" section at all. All recommendations must be inside the tables.

### === LEAD SHEET ===

### Prospect Overview
| Attribute | Detail |
| --- | --- |
| **Client Name** | ${metaName.value.trim() || 'Unknown'} |
| **Company** | ${metaCompany.value.trim() || 'Unknown'} |
| **Job Title** | ${metaTitle.value.trim() || 'Unknown'} |
| **Email** | ${metaEmail.value.trim() || 'Unknown'} |
| **Phone** | ${metaPhone.value.trim() || 'Unknown'} |
| **Service Track** | ${metaTrack.value.trim() || 'Unknown'} |

### 1. Type of sale
| Attribute | Detail |
| --- | --- |
| **Type of Sale** | [Decide: TM1 / AI / Hybrid TM1 + AI] |

### 2. Business activity
| Parameter | Value |
| --- | --- |
| **Industry Sector** | [Identify industry sector] |
| **Estimated Revenue** | [Estimate revenue] |
| **Estimated Headcount** | [Estimate headcount] |
| **Business Description** | [Brief description of their business] |
| **Products & Services** | [Key products & services with brief descriptions (one sentence each)] |

### 3. Customer match
| Metric | Assessment |
| --- | --- |
| **Profile Fit** | [How well does this customer match to our list of customer profiles?] |
| **Historical Reference** | [Have we served this organisation or a similar organisation in the past?] |

### 4. Assessment
| Area | Analysis |
| --- | --- |
| **TM1 / AI Relevance** | [How does their business activity relate to TM1 or AI?] |
| **Recommended Services** | [What services should we offer them from our catalog qualitatively? (never quote pricing values)] |
| **Likely Pain Points** | [Identify primary pain points, slow monthly cycles, model maintenance burdens, etc.] |

### 5. Conversation starter
| ID | Connection Point | Vector Details |
| --- | --- | --- |
| 1 | [Starter 1 Title] | [Connection detail/brief description] |
| 2 | [Starter 2 Title] | [Connection detail/brief description] |
| 3 | [Starter 3 Title] | [Connection detail/brief description] |

### 6. Complementary applications
| Application | Complementary Use Case |
| --- | --- |
| [Application 1] | [How it complements our TM1 or AI offering] |

### 7. Competing applications
| Application | Competing Threat |
| --- | --- |
| [Application 1] | [Why it is a competing application] |

### 8. Competing consulting firms
| Consulting Firm | Competitive Notes |
| --- | --- |
| [Firm Name] | [Details regarding competing consulting firms (e.g. did the client mention they are working with a firm competing with us?), or mention if none] |`;
    }

    // --- Custom Chat Prompt send ---
    let isSending = false;

    async function sendUserQuery() {
        if (isSending) return;
        
        const queryText = chatUserInput.value.trim();
        if (!queryText && stagedAttachments.length === 0) return;

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
                await callTinyAPI(queryText);
            } else {
                chatUserInput.value = queryText;
            }
            return;
        }

        const parsedDelete = parseDeleteQuery(queryText);
        if (parsedDelete && parsedDelete.type === 'folder') {
            const normalizeCompanyName = (name) => {
                if (!name) return '';
                return name.toLowerCase().trim()
                    .replace(/\s+(?:company|folder|directory|client|prospect)$/i, '')
                    .trim();
            };

            const targetCompany = parsedDelete.name;
            const normalizedTarget = normalizeCompanyName(targetCompany);
            
            // Find all prospects under this company name in chatsList
            const matchedSessions = chatsList.filter(c => {
                if (!c.company) return false;
                const normalizedCo = normalizeCompanyName(c.company);
                return normalizedCo === normalizedTarget || 
                       normalizedCo.includes(normalizedTarget) || 
                       normalizedTarget.includes(normalizedCo);
            });
            
            // Delineate the list of unique prospect names
            const prospectsList = [...new Set(matchedSessions.map(c => c.name || 'Unknown Prospect'))];

            chatUserInput.value = '';
            
            let htmlMsg = `<div style="text-align: left; font-family: 'Inter', sans-serif; font-size: 0.9rem; line-height: 1.5; color: #e2e8f0;">`;
            htmlMsg += `<p>Are you sure you want to delete the company folder <strong>"${targetCompany}"</strong> and all its cached memory?</p>`;
            if (prospectsList.length > 0) {
                htmlMsg += `<p style="margin-top: 12px; font-weight: 600; color: #ef4444;">The following prospects will be permanently deleted:</p>`;
                htmlMsg += `<ul style="margin-top: 6px; padding-left: 20px; list-style-type: disc; margin-bottom: 0;">`;
                prospectsList.forEach(p => {
                    htmlMsg += `<li style="margin-bottom: 4px;"><strong>${p}</strong></li>`;
                });
                htmlMsg += `</ul>`;
            } else {
                htmlMsg += `<p style="margin-top: 12px; font-style: italic; color: #94a3b8;">No active prospects were found associated with this company, but any underlying files/history matching "${targetCompany}" will be purged.</p>`;
            }
            htmlMsg += `</div>`;

            const confirmed = await showConfirmModal({
                title: 'Delete Company Data',
                messageHtml: htmlMsg,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'danger',
                forceShow: true
            });

            if (confirmed) {
                await callTinyAPI(queryText);
            } else {
                chatUserInput.value = queryText;
            }
            return;
        }

        const isLeadSheetQuery = /generate\s+(?:a\s+)?lead(?:\s+sheet)?/i.test(queryText);
        if (isLeadSheetQuery) {
            chatUserInput.value = '';
            const confirmed = await showConfirmModal({
                title: 'Generate Lead Sheet',
                message: 'Are you sure you want to generate a Lead Sheet for the active prospect?',
                confirmText: 'Generate',
                cancelText: 'Cancel',
                type: 'primary'
            });
            if (!confirmed) {
                chatUserInput.value = queryText;
                return;
            }
        }

        isSending = true;

        // --- ATOMIC TRANSACTION LOCK ---
        chatUserInput.disabled = true;
        chatSendBtn.disabled = true;

        let originalText = '';
        if (isLeadSheetQuery) {
            const uploadOverlay = document.getElementById('upload-loading-overlay');
            const uploadProgressEl = document.getElementById('upload-loading-progress');
            if (uploadOverlay) {
                const uploadTextEl = uploadOverlay.querySelector('.upload-loading-text');
                if (uploadTextEl) {
                    originalText = uploadTextEl.textContent;
                    uploadTextEl.textContent = 'Generating Lead Sheet Please Wait A Moment';
                }
                if (uploadProgressEl) {
                    uploadProgressEl.style.display = 'none';
                }
                uploadOverlay.classList.remove('modal-hidden');
            }
            document.body.classList.add('opacity-50', 'pointer-events-none');
        }

        let backupAttachments = [];
        try {
            if (stagedAttachments.length > 0) {
                // Atomic Clear: clear the input text and staged files simultaneously
                chatUserInput.value = '';
                backupAttachments = [...stagedAttachments];
                const attachmentsToUpload = [...stagedAttachments];
                stagedAttachments = [];
                renderStagingArea();

                // Optimistic UI: Push user message with attachments to chat log immediately
                const attachmentNames = attachmentsToUpload.map(f => f.name).join(', ');
                const userMsgContent = queryText.trim()
                    ? `${queryText}\n\n📁 Sent Attachments: ${attachmentNames}`
                    : `📁 Sent Attachments: ${attachmentNames}`;
                chatHistory.push({ role: 'user', content: userMsgContent, timestamp: new Date().toISOString() });
                renderChatHistory();

                let companyName = metaCompany ? metaCompany.value.trim() : '';
                let prospectName = metaName ? metaName.value.trim() : '';
                if (!prospectName && typeof activeProspectName === 'string') {
                    prospectName = activeProspectName.trim();
                }
                if (!companyName) {
                    // Try to extract from text input
                    const patterns = [
                        /(?:store|save|upload|put|send)(?:\s+(?:this|these|the|file|files|documents?))?\s+(?:to|for)\s+([^.\n\r]+)/i,
                        /(?:\bto|\bfor)\s+([^.\n\r]+)/i
                    ];

                    for (const pattern of patterns) {
                        const match = queryText.match(pattern);
                        if (match && match[1]) {
                            companyName = match[1].trim().replace(/please/gi, '').trim().replace(/[.,!?;:]+$/, '').trim();
                            if (companyName) break;
                        }
                    }

                    // Match extracted name against chatsList to find company
                    if (companyName) {
                        const matchedChat = chatsList.find(c => 
                            c.name.toLowerCase() === companyName.toLowerCase() || 
                            c.company.toLowerCase() === companyName.toLowerCase()
                        );
                        if (matchedChat) {
                            companyName = matchedChat.company;
                            prospectName = matchedChat.name;
                        }
                    }

                    if (!companyName) {
                        const promptVal = prompt("Enter the company or prospect name to store this file to:");
                        if (promptVal && promptVal.trim()) {
                            companyName = promptVal.trim();
                            const matchedChat = chatsList.find(c => 
                                c.name.toLowerCase() === companyName.toLowerCase() || 
                                c.company.toLowerCase() === companyName.toLowerCase()
                            );
                            if (matchedChat) {
                                companyName = matchedChat.company;
                                prospectName = matchedChat.name;
                            }
                        }
                    }

                    if (!companyName) {
                        showToast('Please select a prospect or enter a company name.');
                        // Restore staged files if failed to enter name
                        stagedAttachments = attachmentsToUpload;
                        renderStagingArea();
                        // Remove last message from history since we aborted
                        chatHistory.pop();
                        renderChatHistory();
                        return;
                    }

                    // Initialize the UI elements for the resolved company
                    if (metaCompany) {
                        metaCompany.value = companyName;
                        metaCompany.dispatchEvent(new Event('input', { bubbles: true }));
                        metaCompany.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    if (metaName && !metaName.value.trim()) {
                        metaName.value = prospectName || `${companyName} Lead`;
                    }
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
                        if (initResult.gDriveFolderId) {
                            activeFolderId = initResult.gDriveFolderId;
                        }
                        await loadChatsList();
                    } catch (initErr) {
                        console.error('Failed to auto-initialize chat session on file select:', initErr);
                        showToast(`Failed to initialize session: ${initErr.message}`);
                        if (backupAttachments.length > 0) {
                            stagedAttachments = [...backupAttachments];
                            renderStagingArea();
                        }
                        chatHistory.pop();
                        renderChatHistory();
                        return;
                    }
                }

                if (chatUploadProgress) chatUploadProgress.classList.remove('hidden');
                
                // Apply Global UI Lock during heavy upload I/O
                document.body.classList.add('opacity-50', 'pointer-events-none');
                
                const uploadOverlay = document.getElementById('upload-loading-overlay');
                const uploadProgressEl = document.getElementById('upload-loading-progress');
                if (uploadOverlay) {
                    uploadOverlay.classList.remove('modal-hidden');
                }

                const totalFiles = attachmentsToUpload.length;
                const uploadedFileNames = [];
                let documentPayload = "";
                const receipts = [];

                for (let i = 0; i < totalFiles; i++) {
                    const file = attachmentsToUpload[i];
                    if (uploadProgressEl) {
                        uploadProgressEl.textContent = `File ${i + 1} of ${totalFiles}: ${file.name} (0%)`;
                    }
                    if (chatUploadProgressText) chatUploadProgressText.textContent = `Uploading ${i+1}/${totalFiles}: ${file.name}`;
                    if (chatUploadProgressBar) chatUploadProgressBar.style.setProperty('--upload-progress', '0%');
                    try {
                        const result = await uploadFileStreaming(file, companyName, prospectName, (percent) => {
                            if (uploadProgressEl) {
                                uploadProgressEl.textContent = `File ${i + 1} of ${totalFiles}: ${file.name} (${percent}%)`;
                            }
                        });

                        if (result.receipt) {
                            receipts.push(result.receipt);
                        }

                        uploadedFileNames.push(file.name);
                        
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
                        if (result.parsedText) {
                            documentPayload += `\n\n--- [${file.name}] ---\n${result.parsedText}`;
                        }
                    } catch (err) {
                        console.error(`Upload failed for ${file.name}:`, err);
                        showToast(`Upload failed for ${file.name}: ${err.message}`);
                    }
                }

                if (uploadOverlay) {
                    uploadOverlay.classList.add('modal-hidden');
                }

                // Show receipt modals sequentially BEFORE proceeding
                for (const receipt of receipts) {
                    await showReceiptModal(receipt);
                }

                // Consolidate the upload message to prevent UI chat spam
                if (uploadedFileNames.length > 0) {
                    const formattedNames = uploadedFileNames.map(name => `"${name}"`).join(', ');
                    chatHistory.push({
                        role: 'assistant',
                        content: `[SYSTEM: Document Uploaded] I have successfully uploaded and indexed ${formattedNames} into the Google Drive memory folder for ${companyName}. I can now search and answer questions based on these files!`,
                        timestamp: new Date().toISOString()
                    });
                }

                if (chatUploadProgress) chatUploadProgress.classList.add('hidden');
                if (chatUploadProgressBar) chatUploadProgressBar.style.setProperty('--upload-progress', '0%');

                renderChatHistory();
                
                // Synchronize the Prospect Files Column and Release UI Lock
                await loadSourcesForCompany(activeFolderId, companyName, null, prospectName);
                document.body.classList.remove('opacity-50', 'pointer-events-none');

                const baseQueryText = isLeadSheetQuery ? getLeadSheetPrompt() : queryText;
                const combinedQuery = baseQueryText + (documentPayload ? `\n\n[Uploaded Document Context]:\n${documentPayload}` : "");
                
                // ALWAYS save the updated context to the server so subsequent queries have access to it
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
                    linkedinInfo: sourceLinkedinText ? sourceLinkedinText.value.trim() : '',
                    intakeAnswers: sourceIntakeText ? sourceIntakeText.value.trim() : '',
                    transcript: sourceTranscriptText ? sourceTranscriptText.value.trim() : '',
                    transitDistance: transitDistance,
                    messages: chatHistory
                };
                try {
                    await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(savePayload) });
                    await Promise.all([loadGoogleDriveFiles(), loadProspectsTree()]);
                    if (uploadedFileNames.length > 0 && totalFiles > 1) {
                        showToast(`✔️ All ${uploadedFileNames.length} files uploaded and indexed.`);
                    }
                } catch (postUploadErr) {
                    console.error('Failed to update session or refresh files/tree:', postUploadErr);
                }

                if (queryText.trim()) {
                    // Synchronized Release: Render chat log and call API
                    renderChatHistory();
                    await callTinyAPI(queryText, combinedQuery, true);
                }
            } else {
                chatUserInput.value = '';
                if (isLeadSheetQuery) {
                    await callTinyAPI(queryText, getLeadSheetPrompt());
                } else {
                    await callTinyAPI(queryText);
                }
            }
        } catch (err) {
            console.error('Error in sendUserQuery:', err);
            chatUserInput.value = queryText;
            if (backupAttachments.length > 0) {
                stagedAttachments = [...backupAttachments];
                renderStagingArea();
            }
            showToast(`Failed to send query: ${err.message}`);
        } finally {
            isSending = false;
            chatUserInput.disabled = false;
            chatSendBtn.disabled = false;
            chatUserInput.focus();
            
            if (isLeadSheetQuery) {
                const overlay = document.getElementById('upload-loading-overlay');
                if (overlay) {
                    overlay.classList.add('modal-hidden');
                    const textEl = overlay.querySelector('.upload-loading-text');
                    if (textEl && originalText) {
                        textEl.textContent = originalText;
                    }
                    const progressEl = document.getElementById('upload-loading-progress');
                    if (progressEl) {
                        progressEl.style.display = '';
                    }
                }
                document.body.classList.remove('opacity-50', 'pointer-events-none');
            }
        }
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
            chatAttachFile.click();
        });

        chatAttachFile.addEventListener('change', async () => {
            if (!chatAttachFile.files || chatAttachFile.files.length === 0) return;
            
            const filesArray = Array.from(chatAttachFile.files);
            
            for (let i = 0; i < filesArray.length; i++) {
                const file = filesArray[i];
                if (file.size > 100 * 1024 * 1024) {
                    showToast(`File "${file.name}" exceeds 100MB. Skipping.`);
                    continue;
                }
                stagedAttachments.push(file);
            }

            renderStagingArea();
            
            // Reset file input so the same file can be re-selected if removed
            chatAttachFile.value = '';
        });
    }

    // XHR-based FormData upload with progress tracking (no Base64 overhead)
    function uploadFileStreaming(file, companyName, prospectName, onProgress) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('company', companyName || 'Unknown_Company');
            formData.append('prospect', prospectName || 'Unknown Prospect');
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
                    if (onProgress) {
                        onProgress(percent);
                    }
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
            if (['recapEmail', 'migration', 'actionItems', 'summarySheet', 'notes', 'proposal'].includes(promptType)) {
                if (!sourceTranscriptText.value.trim()) {
                    showToast("Error: Call transcript/recording is missing. Cannot generate report.");
                    return;
                }
            }

            if (promptType === 'leadSheet') {
                if (!sourceLinkedinText.value.trim() && !sourceIntakeText.value.trim()) {
                    showToast("Error: LinkedIn Profile Bio and Booking Intake Answers are both missing. Cannot generate lead sheet.");
                    return;
                }
            }
 
            let promptText = '';
            if (promptType === 'recapEmail') {
                promptText = `Generate a Recap Email to the client based strictly on the transcript.
Format exactly as:
[Subject] observations from 🧐 our session
Hey [client's name],
I have some takeaways I'd like to share from our call together. Feel free to reply inline below my comment in a second color of your choice.
. [Takeaway 1].
. [Takeaway 2].
. [Takeaway 3].
Shortly I will send you some time slots for our upcoming demo.
Kind regards,
[Rep Name].`;
            } else if (promptType === 'migration') {
                promptText = `Execute a comprehensive, enterprise-grade Migration/Modernisation assessment based strictly on the transcript. Format as a professional consulting brief:
1. EXECUTIVE SUMMARY: High-level technical objective and strategic business drivers.
2. CURRENT ARCHITECTURE (AS-IS): Granular mapping of legacy systems, integrations, cloud footprints, and specific pain points mentioned.
3. GAPS & TECHNICAL DEBT: Explicitly highlight security risks, operational inefficiencies, and scaling limits in their current setup.
4. RECOMMENDED TARGET STATE (TO-BE): Propose a robust modernisation path (e.g., Cloud-Native, Serverless, AI-Augmented workflows) aligned with Octane's capabilities.
5. COMPLEXITY & EFFORT ESTIMATION: Evaluate the migration complexity (Low/Medium/High/Critical) citing exact dependencies, required data transformations, and potential downtime risks.
Do not use generic filler. Base all technical assertions solely on the source data.`;
            } else if (promptType === 'actionItems') {
                promptText = `Generate a precise, zero-fluff RACI-style Action Items matrix derived from the meeting transcript. 
For every commitment made, you MUST extract:
- THE TASK: Explicit, actionable description.
- THE OWNER: Assignee responsible (Account Executive, Solutions Architect, Client Contact).
- THE DEADLINE: Exact date, time, or relative SLA (e.g., "by EOD Friday") mentioned.
- THE BLOCKER: Any prerequisites preventing immediate execution.
Format as a clean markdown table. If a deadline is missing, explicitly state "Unspecified". Group items by internal vs. client responsibilities.`;
            } else if (promptType === 'summarySheet') {
                promptText = `Synthesize the call into a high-density Executive Summary Sheet using the MEDDPICC or BANT framework principles where applicable.
Include the following structured headers:
### ACCOUNT INTELLIGENCE
- **Company**: [Extracted Company Name]
- **Date**: [Call Date]
- **Key Stakeholders**: [Names, Titles, and their observed influence/buying power]
- **Service Track**: [e.g., TM1 / AI Automation / Cloud Migration]

### STRATEGIC INSIGHTS
- **Core Business Pain**: (What is the exact problem costing them money or time?)
- **Identified Goals**: (What does success look like for them?)
- **Current Sentiment**: (Highly qualified, skeptical, exploratory, stalled)
- **Technical Stack Mentioned**: (List specific software, databases, or tools they use)

### NEXT STEPS
- **Immediate Follow-up**: (Top priority action)
- **Screencast Briefing**: [OneDrive Screencast Link if available]`;
            } else if (promptType === 'notes') {
                promptText = `Transcribe the core essence of the meeting into an exhaustive, highly organized chronologic debrief.
- Discard all small talk and filler.
- Capture verbatim quotes for critical business requirements, budget constraints, or technical specifications (wrap in blockquotes).
- Segment the notes logically by the topics discussed.
- Highlight any objections or concerns raised by the prospect in **bold**.`;
            } else if (promptType === 'proposal') {
                promptText = `Draft a premium, Fortune-50 caliber consultative Statement of Work (SOW) foundation based on the discovery call.
(Strict Constraint: DO NOT hallucinate pricing, hourly rates, or exact project durations. Omit commercial terms entirely.)
Structure the document rigorously:
1. **EXECUTIVE CONTEXT**: Demonstrate a profound understanding of their unique business challenge and strategic objectives.
2. **PROPOSED ARCHITECTURE / SOLUTION**: Detail the high-level technical or strategic solution Octane will deliver. Be highly specific to their stack.
3. **METHODOLOGY & PHASES**: Outline the execution strategy (e.g., Phase 1: Discovery & Audit, Phase 2: Implementation, Phase 3: Handoff).
4. **REQUIRED RESOURCES**: Identify the key personnel profiles needed from both Octane and the client.
5. **DISCOVERY GAPS & ASSUMPTIONS**: List any critical missing information that must be clarified before finalizing a binding contract.`;
            } else if (promptType === 'leadSheet') {
                promptText = getLeadSheetPrompt();
            }
 
            if (promptText) {
                if (promptType === 'leadSheet') {
                    showConfirmModal({
                        title: 'Generate Lead Sheet',
                        message: 'Are you sure you want to generate a Lead Sheet for the active prospect?',
                        confirmText: 'Generate',
                        cancelText: 'Cancel',
                        type: 'primary'
                    }).then(async (confirmed) => {
                        if (!confirmed) return;
                        
                        const uploadOverlay = document.getElementById('upload-loading-overlay');
                        const uploadTextEl = uploadOverlay ? uploadOverlay.querySelector('.upload-loading-text') : null;
                        const uploadProgressEl = document.getElementById('upload-loading-progress');
                        let originalText = '';
                        
                        if (uploadOverlay) {
                            if (uploadTextEl) {
                                originalText = uploadTextEl.textContent;
                                uploadTextEl.textContent = 'Generating Lead Sheet Please Wait A Moment';
                            }
                            if (uploadProgressEl) {
                                uploadProgressEl.style.display = 'none';
                            }
                            uploadOverlay.classList.remove('modal-hidden');
                        }
                        document.body.classList.add('opacity-50', 'pointer-events-none');
                        
                        try {
                            await callTinyAPI(promptText);
                        } finally {
                            if (uploadOverlay) {
                                uploadOverlay.classList.add('modal-hidden');
                                if (uploadTextEl && originalText) {
                                    uploadTextEl.textContent = originalText;
                                }
                                if (uploadProgressEl) {
                                    uploadProgressEl.style.display = '';
                                }
                            }
                            document.body.classList.remove('opacity-50', 'pointer-events-none');
                        }
                    });
                } else {
                    callTinyAPI(promptText);
                }
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

                metaName.value = data.name || '';
                metaCompany.value = data.company || '';
                metaTitle.value = data.title || '';
                metaEmail.value = data.email || '';
                metaPhone.value = data.phone || '';
                metaRep.value = '';
                metaTrack.value = data.track || '';
                gdriveFileContent = data.gDriveFileContent || "";
                sourceGdriveFileId.value = data.gDriveFileId || "";
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
                            name: metaName.value || '',
                            title: metaTitle.value || '',
                            company: metaCompany.value || '',
                            intake: sourceIntakeText.value || ''
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
                    const prospectName = metaName ? metaName.value.trim() : 'Unknown Prospect';

                    const res = await fetch('/api/gdrive/upload', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            company: companyName || 'Unknown_Company',
                            prospectName: prospectName,
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
            
            const droppedFiles = Array.from(e.dataTransfer.files);
            if (droppedFiles.length === 0) return;

            for (let i = 0; i < droppedFiles.length; i++) {
                const file = droppedFiles[i];
                if (file.size > 100 * 1024 * 1024) {
                    showToast(`File "${file.name}" exceeds 100MB. Skipping.`);
                    continue;
                }
                stagedAttachments.push(file);
            }
            
            renderStagingArea();
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
        const targetChatId = currentChatId;
        if (!targetChatId) return;
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(async () => {
            if (currentChatId !== targetChatId) return;
            console.log("⏱️ Auto-saving changes to background...");
            const payload = {
                id: targetChatId,
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

    window.addEventListener('beforeunload', () => {
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
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
            if (payload.id && payload.company && payload.name) {
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/api/history', false); // Synchronous request to flush changes
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.send(JSON.stringify(payload));
                } catch (e) {
                    console.warn("Unload auto-save flush failed:", e.message);
                }
            }
        }
    });

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
                fetch('/api/history', { headers: { 'Cache-Control': 'no-cache' } }).catch(err => ({ ok: false, error: err, json: async () => [] })),
                fetch('/api/gdrive/list', { headers: { 'Cache-Control': 'no-cache' } }).catch(err => ({ ok: false, error: err, json: async () => ({ items: [] }) }))
            ]);
            
            let chatsData = [];
            let prospectsData = { items: [] };

            if (!chatsRes.ok) {
                console.error('Failed to fetch history:', chatsRes.status || chatsRes.error);
            } else {
                try { chatsData = await chatsRes.json(); } catch(e) { console.error('Error parsing history:', e); }
            }

            if (!prospectsRes.ok) {
                console.error('Failed to list folders:', prospectsRes.status || prospectsRes.error);
                const recentChatsList = document.getElementById('recent-chats-list');
                if (recentChatsList) {
                    recentChatsList.innerHTML = '<div style="padding: 1rem; color: #ef4444; font-size: 0.875rem; text-align: center; background: rgba(239, 68, 68, 0.1); border-radius: 8px; margin: 1rem;">Network Error: Proxy or API unreachable.</div>';
                }
            } else {
                try { prospectsData = await prospectsRes.json(); } catch(e) { console.error('Error parsing folders:', e); }
            }
            
            await loadChatsList(chatsData);
            if (prospectsRes.ok && prospectsData) await loadProspectsTree(prospectsData);
            
            // Hide initial loading indicator
            const loadingIndicator = document.getElementById('initial-loading-indicator');
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            
            // Dynamic Empty State Check
            const hasNoChats = !chatsData || chatsData.length === 0;
            const hasNoProspects = !prospectsData || !prospectsData.items || prospectsData.items.length === 0;
            const emptyStateContent = document.getElementById('empty-state-content');
            if (emptyStateContent) {
                if (hasNoChats && hasNoProspects) {
                    emptyStateContent.innerHTML = `
                        <img src="tiny.png" alt="Tiny Dog" class="empty-state-avatar" width="80" height="80">
                        <h3 style="margin-top: 1rem; color: #1e293b;">No Prospects Available</h3>
                        <p style="text-align: center; max-width: 400px; color: #64748b; font-size: 0.95rem; margin-top: 0.5rem;">You don't have any prospect folders in Google Drive. Click below to create your first prospect and start a conversation.</p>
                        <button type="button" class="btn btn-primary" id="btn-new-chat" style="margin-top: 1.5rem; padding: 0.5rem 1rem;">➕ Create Prospect</button>
                    `;
                    const btnCreateFirst = document.getElementById('btn-new-chat');
                    if (btnCreateFirst) {
                        btnCreateFirst.addEventListener('click', () => {
                            if (isTestRunner) {
                                handleGlobalNewChat();
                            } else {
                                openCreateProspectModal();
                            }
                        });
                    }
                } else {
                    emptyStateContent.innerHTML = `
                        <img src="tiny.png" alt="Tiny Dog" class="empty-state-avatar" width="80" height="80">
                        <h3>Tiny AI Assistant</h3>
                        <p>Select a client chat from the sidebar or click <strong>New Client Chat</strong> to get started.</p>
                        <button type="button" class="btn btn-primary" id="btn-new-chat" style="margin-top: 1rem;">➕ New Client Chat</button>
                    `;
                    const btnNewChatDynamic = document.getElementById('btn-new-chat');
                    if (btnNewChatDynamic) {
                        btnNewChatDynamic.addEventListener('click', () => {
                            if (isTestRunner) {
                                handleGlobalNewChat();
                            } else {
                                openCreateProspectModal();
                            }
                        });
                    }
                }
            }

            // Auto-select most recent chat session or explicitly display empty state
            if (!isTestRunner) {
                if (!hasNoChats) {
                    await selectChat(chatsData[0].id);
                } else {
                    if (emptyStateContent) emptyStateContent.classList.remove('hidden');
                }
            } else {
                if (emptyStateContent) emptyStateContent.classList.remove('hidden');
            }
            
            // Fix UI State Leak: Clear default 'Loading...' HTML placeholder texts
            const activeChatClientTitle = document.getElementById('active-chat-client-title');
            const activeChatClientMeta = document.getElementById('active-chat-client-meta');
            if (activeChatClientTitle && activeChatClientTitle.innerText === 'Loading...') {
                activeChatClientTitle.innerText = "New Chat";
            }
            if (activeChatClientMeta && activeChatClientMeta.innerText === 'Loading...') {
                activeChatClientMeta.innerText = "Add client sources and save to start conversation with Tiny";
            }
            
            updateValidationBadges();
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        } catch (err) {
            console.error('Error during initial load:', err);
            // Fallback: hide loader on error to keep UI interactive
            const loadingIndicator = document.getElementById('initial-loading-indicator');
            const emptyStateContent = document.getElementById('empty-state-content');
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (emptyStateContent) emptyStateContent.classList.remove('hidden');
        }
    }, 50);

    // Automatically expand advanced options in test runner environment
    if (isTestRunner) {
        const details = document.getElementById('advanced-sources-details');
        if (details) {
            details.setAttribute('open', '');
        }
    }

    // Audit Transaction Receipt Modal Controller
    window.showReceiptModal = function(receipt) {
        return new Promise((resolve) => {
            if (isTestRunner) {
                resolve();
                return;
            }
            if (!receipt) {
                resolve();
                return;
            }
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
            
            if (!modal) {
                resolve();
                return;
            }

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
            
            const closeModal = () => {
                modal.classList.add('modal-hidden');
                resolve();
            };
            
            if (closeBtn) closeBtn.onclick = closeModal;
            if (closeIconBtn) closeIconBtn.onclick = closeModal;
            if (backdrop) backdrop.onclick = closeModal;
        });
    };

    /**
     * Display a clean, glassmorphic confirmation modal.
     * Returns a promise that resolves to true (Confirm) or false (Cancel).
     */
    function showConfirmModal({ title, message, messageHtml, confirmText = 'Confirm', cancelText = 'Cancel', type = 'primary', forceShow = false }) {
        return new Promise((resolve) => {
            // E2E/Playwright test bypass
            const isTestRunnerDynamic = (navigator.webdriver || window.__playwright_active) && 
                                        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.search.includes('demo=true'));
            if (isTestRunnerDynamic && !forceShow) {
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
                if (messageHtml) {
                    messageEl.innerHTML = messageHtml;
                } else {
                    messageEl.innerText = message;
                }
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
            handleGlobalNewChat();
            quickMetaName.value = '';
            quickMetaCompany.value = '';
            quickMetaCompany.removeAttribute('readonly');
            quickMetaCompany.style.backgroundColor = '';
            quickMetaCompany.style.cursor = '';
            quickMetaCompany.style.color = '';
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
        btnSubmitAddProspect.addEventListener('click', async () => {
            const nameVal = quickMetaName.value.trim();
            const companyVal = quickMetaCompany.value.trim();
            
            if (!companyVal) {
                showToast('Company Name is required.');
                quickMetaCompany.focus();
                return;
            }

            const clientNormalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            const normNewName = clientNormalize(nameVal);
            const normNewCompany = clientNormalize(companyVal);
            const isDuplicate = chatsList.some(chat => 
                clientNormalize(chat.company) === normNewCompany &&
                clientNormalize(chat.name) === normNewName
            );

            let existsInOtherCachedFolders = false;
            let otherCompanyFromGDrive = '';
            for (const [otherFolderId, otherData] of gdriveSubfolderCache.entries()) {
                const otherFolder = gdriveFolders.find(f => f.id === otherFolderId);
                if (otherFolder && clientNormalize(otherFolder.name) !== normNewCompany && otherData && otherData.items) {
                    const hasMatch = otherData.items.some(item => 
                        item.isFolder && clientNormalize(item.name) === normNewName
                    );
                    if (hasMatch) {
                        existsInOtherCachedFolders = true;
                        otherCompanyFromGDrive = otherFolder.name;
                        break;
                    }
                }
            }

            const isGlobalDuplicate = chatsList.some(chat =>
                clientNormalize(chat.company) !== normNewCompany &&
                clientNormalize(chat.name) === normNewName
            ) || existsInOtherCachedFolders;

            if (isDuplicate) {
                const confirmed = await showConfirmModal({
                    title: '⚠️ Duplicate Prospect Warning',
                    message: `A prospect named "${nameVal}" already exists under "${companyVal}". Do you still want to proceed and create a new one?`,
                    confirmText: 'Yes, Create Anyway',
                    cancelText: 'Cancel',
                    type: 'danger',
                    forceShow: !!window.__test_force_duplicate_warning
                });
                if (!confirmed) return;
            } else if (isGlobalDuplicate) {
                const existingChat = chatsList.find(chat =>
                    clientNormalize(chat.company) !== normNewCompany &&
                    clientNormalize(chat.name) === normNewName
                );
                const existingCo = existingChat ? existingChat.company : (otherCompanyFromGDrive || 'another company');
                const confirmed = await showConfirmModal({
                    title: '⚠️ Duplicate Prospect Warning',
                    message: `A prospect named "${nameVal}" already exists under "${existingCo}". Are you sure this is a different person and you want to proceed?`,
                    confirmText: 'Yes, Create Anyway',
                    cancelText: 'Cancel',
                    type: 'danger',
                    forceShow: !!window.__test_force_duplicate_warning
                });
                if (!confirmed) return;
            }

            activeFolderId = null; // Prevent state leakage to new prospect
            closeAddModal();
            
            // Call saveDiscoverySession directly to bypass the redundant confirmation modal
            saveDiscoverySession(nameVal || 'Unknown Name', companyVal, '');
        });
    }
});
