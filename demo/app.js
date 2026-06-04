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

        if (gdriveBadge) {
            const val = sourceGdriveFileSelect ? sourceGdriveFileSelect.value : '';
            if (val) {
                gdriveBadge.innerText = 'Ready';
                gdriveBadge.className = 'validation-badge ready';
            } else {
                gdriveBadge.innerText = 'None';
                gdriveBadge.className = 'validation-badge missing';
            }
        }

        if (linkedinBadge) {
            const val = sourceLinkedinText ? sourceLinkedinText.value.trim() : '';
            if (val) {
                linkedinBadge.innerText = 'Ready';
                linkedinBadge.className = 'validation-badge ready';
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
    let chatsList = [];
    let chatHistory = [];
    let transitDistance = "Online/Phone call only (Distance unavailable)";
    let gdriveFileContent = "";

    // DOM Elements
    const btnNewChat = document.getElementById('btn-new-chat');
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
    async function loadChatsList() {
        try {
            const response = await fetch('/api/history');
            if (!response.ok) throw new Error('Failed to fetch history');
            chatsList = await response.json();
            renderChatsList();
        } catch (err) {
            console.error('Error loading chats:', err);
            showToast('Failed to load recent chats.');
        }
    }

    function renderChatsList() {
        // No-op: Prospects sidebar displays Google Drive files directly
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

    // --- Google Drive Explorer Loader ---
    async function loadGoogleDriveFiles() {
        if (!sourceGdriveFileSelect) return;
        sourceGdriveFileSelect.innerHTML = '<option value="">-- Loading GDrive files... --</option>';
        try {
            const company = metaCompany ? metaCompany.value.trim() : '';
            const url = company ? `/api/gdrive/list?company=${encodeURIComponent(company)}` : '/api/gdrive/list';
            const response = await fetch(url);
            if (!response.ok) throw new Error('GDrive list failed');
            const data = await response.json();
            sourceGdriveFileSelect.innerHTML = '<option value="">-- Select File from GDrive --</option>';
            
            if (data.items && data.items.length > 0) {
                data.items.forEach(file => {
                    if (!file.isFolder) {
                        const opt = document.createElement('option');
                        opt.value = file.id;
                        opt.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                        sourceGdriveFileSelect.appendChild(opt);
                    }
                });
            } else {
                sourceGdriveFileSelect.innerHTML = '<option value="">No files in client folder</option>';
            }
        } catch (err) {
            console.error('Error loading Google Drive files:', err);
            sourceGdriveFileSelect.innerHTML = '<option value="">Error loading GDrive files</option>';
        }
    }

    async function loadProspectsTree() {
        if (!recentChatsList) return;
        recentChatsList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 1.5rem; text-align: center;">Loading folders...</div>';
        try {
            const response = await fetch('/api/gdrive/list');
            if (!response.ok) throw new Error('Failed to list folders');
            const data = await response.json();
            recentChatsList.innerHTML = '';
            
            if (data.items && data.items.length > 0) {
                const folders = data.items.filter(item => item.isFolder);
                if (folders.length === 0) {
                    recentChatsList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 1.5rem; text-align: center;">No prospect folders found</div>';
                    return;
                }
                
                // If activeFolderId is not set, try to find a folder matching metaCompany
                if (!activeFolderId && metaCompany && metaCompany.value) {
                    const compName = metaCompany.value.trim().toLowerCase();
                    const matchingFolder = folders.find(f => f.name.toLowerCase().trim() === compName);
                    if (matchingFolder) {
                        activeFolderId = matchingFolder.id;
                    }
                }
                
                let activeFolderName = "";
                folders.forEach(folder => {
                    const folderItem = document.createElement('div');
                    folderItem.className = 'sidebar-folder-header';
                    folderItem.style.marginBottom = '0.5rem';
                    if (activeFolderId === folder.id) {
                        folderItem.classList.add('active');
                        activeFolderName = folder.name;
                    }
                    folderItem.innerHTML = `
                        <div class="sidebar-folder-title">
                            ${folder.name}
                        </div>
                    `;
                    
                    folderItem.addEventListener('click', async () => {
                        document.querySelectorAll('.sidebar-folder-header').forEach(el => el.classList.remove('active'));
                        folderItem.classList.add('active');
                        activeFolderId = folder.id;
                        
                        if (metaCompany) {
                            metaCompany.value = folder.name;
                            metaCompany.dispatchEvent(new Event('input', { bubbles: true }));
                            metaCompany.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        
                        const matchSession = chatsList.find(c => c.company.toLowerCase().trim() === folder.name.toLowerCase().trim());
                        if (matchSession) {
                            if (metaName) metaName.value = matchSession.name || '';
                            if (metaTitle) metaTitle.value = matchSession.title || '';
                            if (metaEmail) metaEmail.value = matchSession.email || '';
                            if (metaPhone) metaPhone.value = matchSession.phone || '';
                            if (metaRep) metaRep.value = matchSession.rep || 'Albert';
                            if (metaTrack) metaTrack.value = matchSession.track || 'Planning & Analytics (TM1)';
                            currentChatId = matchSession.id;
                        }
                        
                        // Load files inside this folder in the leftmost column
                        await loadSourcesForCompany(folder.id, folder.name);
                    });
                    
                    recentChatsList.appendChild(folderItem);
                });
                
                // Load files for the active folder automatically
                if (activeFolderId && activeFolderName) {
                    await loadSourcesForCompany(activeFolderId, activeFolderName);
                }
            } else {
                recentChatsList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 1.5rem; text-align: center;">No prospect folders found</div>';
            }
        } catch (err) {
            console.error('Error loading prospects tree:', err);
            recentChatsList.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem; padding: 1.5rem; text-align: center;">Error loading folders</div>';
        }
    }

    async function loadSourcesForCompany(folderId, companyName) {
        if (!sourcesList) return;
        sourcesList.innerHTML = '<div style="color: #64748b; font-size: 0.75rem; padding: 1rem; text-align: center;">Loading files...</div>';
        try {
            const response = await fetch(`/api/gdrive/list?folderId=${encodeURIComponent(folderId)}`);
            if (!response.ok) throw new Error('Failed to list files');
            const data = await response.json();
            sourcesList.innerHTML = '';
            
            // Look up associated client name from chatsList, or default to currently entered metaName
            const matchSession = chatsList.find(c => c.company.toLowerCase().trim() === companyName.toLowerCase().trim());
            const clientName = matchSession ? (matchSession.name || 'Unknown Name') : (metaName && metaName.value ? metaName.value : 'Unknown Name');
            
            // Construct and render metadata context header at the top
            const headerInfo = document.createElement('div');
            headerInfo.className = 'sources-header-info';
            headerInfo.style.cssText = 'padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 0.75rem; font-size: 0.8rem; color: #475569; background: #f8fafc; border-radius: 6px;';
            headerInfo.innerHTML = `
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 0.25rem;">${companyName}</div>
                <div style="color: #64748b;">Prospect: ${clientName}</div>
            `;
            sourcesList.appendChild(headerInfo);
            
            if (data.items && data.items.length > 0) {
                const files = data.items.filter(f => !f.isFolder);
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
                    if (sourceGdriveFileId.value === file.id) {
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
                                const response = await fetch(`/api/gdrive/read?fileId=${encodeURIComponent(file.id)}`);
                                if (!response.ok) throw new Error("GDrive read failed");
                                const data = await response.json();
                                if (textPreviewTarget) {
                                    textPreviewTarget.textContent = data.content || '[Empty File]';
                                }
                            } catch (err) {
                                console.error("Error reading file:", err);
                                if (textPreviewTarget) {
                                    textPreviewTarget.innerHTML = `<div style="color: #ef4444; font-size: 0.9rem; padding: 2rem; text-align: center;">❌ Failed to load file content.<br><span style="font-size: 0.8rem; color: #94a3b8;">${err.message}</span></div>`;
                                }
                            }
                            await loadGoogleDriveFiles();
                            if (sourceGdriveFileSelect) {
                                sourceGdriveFileSelect.value = file.id;
                                sourceGdriveFileSelect.dispatchEvent(new Event('change'));
                            }
                        }, 100);
                    });
                    
                    sourcesList.appendChild(fileItem);
                });
            } else {
                const noFilesMsg = document.createElement('div');
                noFilesMsg.style.cssText = 'color: #64748b; font-size: 0.75rem; padding: 1rem; text-align: center;';
                noFilesMsg.innerText = 'No files inside folder';
                sourcesList.appendChild(noFilesMsg);
            }
        } catch (err) {
            console.error('Error loading company files:', err);
            sourcesList.innerHTML = '<div style="color: #ef4444; font-size: 0.75rem; padding: 1rem; text-align: center;">Failed to load files</div>';
        }
    }

    // --- Select Chat ---
    async function selectChat(id) {
        currentChatId = id;
        renderChatsList();
        toggleDrawer(false);
 
        workspaceEmptyState.classList.add('hidden');
        workspaceActiveChat.classList.remove('hidden');
        chatMessagesLog.innerHTML = '';
 
        try {
            const response = await fetch(`/api/history/detail?id=${encodeURIComponent(id)}`);
            if (!response.ok) throw new Error('Failed to load chat details');
            const data = await response.json();
 
            // Populate metadata
            metaName.value = data.name || '';
            metaCompany.value = data.company || '';
            metaTitle.value = data.title || '';
            metaEmail.value = data.email || '';
            metaPhone.value = data.phone || '';
            metaRep.value = data.rep || 'Albert';
            metaTrack.value = data.track || 'Planning & Analytics (TM1)';
            
            gdriveFileContent = data.gDriveFileContent || '';
            sourceGdriveFileId.value = data.gDriveFileId || '';
            await loadGoogleDriveFiles();
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

            // Populate source textareas
            sourceLinkedinText.value = data.linkedinInfo || data.linkedin || '';
            sourceIntakeText.value = data.intakeAnswers || data.intake || '';
            sourceTranscriptText.value = data.transcript || '';

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
                    chatHistory.push({
                        role: 'assistant',
                        content: `Hi! I am Tiny, your AI Sales Assistant. I have loaded the sources for ${data.name}. You can generate reports or ask me questions about this prospect.`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            renderChatHistory();
            updateValidationBadges();

        } catch (err) {
            console.error('Error loading chat detail:', err);
            showToast('Failed to load chat details.');
        }
    }

    function renderChatHistory() {
        chatMessagesLog.innerHTML = '';
        chatHistory.forEach((msg, idx) => {
            const card = document.createElement('div');
            card.className = `chat-message-card ${msg.role === 'user' ? 'user' : 'assistant'}`;
            
            if (msg.role === 'assistant' && msg.content.includes('[INSUFFICIENT_DATA_FOR_REPORT]')) {
                card.className = 'chat-message-card assistant error-state';
                card.innerHTML = `
                    <div class="insufficient-data-card">
                        <div class="card-title">
                            <i data-lucide="alert-triangle" style="width: 16px; height: 16px; color: #dc2626;"></i>
                            <span>Insufficient Source Data</span>
                        </div>
                        <div class="card-description">
                            Tiny cannot generate this report because the required source information (e.g. call transcript, LinkedIn biography, or booking intake) is missing. Please open the <strong>Sources Drawer</strong> and fill in the missing inputs.
                        </div>
                    </div>
                `;
            } else {
                // Render plain text but preserve lines
                const pre = document.createElement('pre');
                pre.innerText = msg.content;
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
                if (chatHistory.length === 0) {
                    // Append first assistant welcome message
                    chatHistory.push({
                        role: 'assistant',
                        content: `Chat session initialized for ${payload.name} at ${payload.company}. Sources uploaded!`,
                        timestamp: new Date().toISOString()
                    });
                    payload.id = currentChatId;
                    payload.messages = chatHistory;
                    // Re-save with welcome message
                    await fetch('/api/history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }
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
            await saveDiscoverySession(name, company, email);
        });
    }

    // --- Create New Chat ---
    if (btnNewChat) {
        btnNewChat.addEventListener('click', () => {
            currentChatId = null;
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
            
            // Reload Google Drive files list to populate select dropdown and tree
            loadGoogleDriveFiles();
            loadProspectsTree();
            updateValidationBadges();
        });
    }

    // --- LLM Interaction Helpers ---
    async function callTinyAPI(promptText) {
        // Parse metadata on first prompt if session is not yet initialized
        if (!currentChatId) {
            const parsed = parseInitPrompt(promptText);
            if (parsed.name && parsed.company) {
                await saveDiscoverySession(parsed.name, parsed.company, parsed.email);
                return; // Stop here, session is now initialized and welcome message is rendered!
            }
        }

        const leadsSummary = chatsList.map(c => `- ${c.name} at ${c.company} (${c.track || 'TM1 & AI'})`).join('\n') || 'None';

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

Reference Catalog & Pricing Specifications (SOLE SOURCE OF TRUTH):
- DevOps Blue Support: A$4,560/month. Includes 24/7 SLA ticketing (Urgent <1hr, High 4hr, Medium 8hr, Low 24hr), rollover support hours, monthly health checks, and free training library.
- DevOps Red Support: Advanced DevOps support tier. Rollover hours, certified developers, onshore/offshore hybrid model.
- TM1 Flight Check: 6-day analysis, RAM/HDD log file performance checks, user interviews.
- Data Integration Connector: Setup + email support, 60-day free trial.
- watsonx Orchestrate POC: 2-6 weeks co-creation, working demo, client resources.
- Custom Training: A$1,850/day.

Rules:
1. ALWAYS adhere strictly to the pricing catalog. If a pricing option is not explicitly listed, write '[PRICING_TBD_BY_DISCOVERY]'. NEVER invent or repeat custom rates from the transcript.
2. Produce deliverables in PLAIN TEXT. Do NOT use HTML formatting, custom markdown styling, or branding guidelines. Use simple headers, dashes, and spacing.
3. Be concise and factual. Do not make up facts. Use the client details provided.
4. If the required input data for the requested report or query is missing from the sources (e.g., LinkedIn and Intake are both empty when generating a Lead Sheet, or the transcript is empty when generating a recap email, migration assessment, action items, summary sheet, notes, or proposal), you MUST output exactly '[INSUFFICIENT_DATA_FOR_REPORT]'. Do NOT fabricate, placeholder, or assume any information.
5. If the user asks for focus prompts or query sections, resolve them using these specific guidelines:
   - "Show me the list of leads": Output a clean markdown table of the active leads listed in the system.
   - "Identify the type of sale / Are we selling them TM1 planning analytics or artificial intelligence?": Determine the track from the Service Track field and booking details.
   - "Business activity": Scan the context or search results. State industry sector, description of business, estimate revenue and headcount, and list core products and services with one sentence for each.
   - "Customer match": Map the company's sector and pain points to the playbook customer profiles (Large/Mid/Small TM1 Shops, etc.). Check if we served a similar active client in the past (e.g., Steric, Shift, GreyOrange, mycar).
   - "Assessment": Explain how their activity relates to TM1 or AI. Recommend the exact services aligned to their needs and catalog pricing, and detail 3 likely pain points.
   - "Conversation starter": Look at their LinkedIn bio and website. Provide 3 specific personal-level stories if available. Cite previous Octane work if their working history has matching organizations. Otherwise, offer organization-level stories connected to TM1/AI from corporate news.
   - "Complementary applications / Competing applications / Competing consulting firms": Identify ERP/planning applications in their stack, and check if they mentioned any competing firms.`;

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

            if (!res.ok) throw new Error(data.error || 'Failed to call chat API');

            const content = data.choices[0].message.content;

            // If a file was uploaded or deleted via chat prompt, refresh files list
            if (data.gdriveAction) {
                try {
                    await loadGoogleDriveFiles();
                    await loadProspectsTree();
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
            console.error('Chat error:', err);
            showToast(`Error getting response: ${err.message}`);
        }
    }

    // --- Custom Chat Prompt send ---
    function sendUserQuery() {
        const queryText = chatUserInput.value.trim();
        if (!queryText) return;

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
1. LinkedIn profile analysis -- role history, tenure, seniority, network signals.
2. Recent social media activity (if visible in sources).
3. Company overview -- products, services, revenue signals.
4. Octane services relevant to this prospect.
5. Key competitors they may be evaluating.
6. Competing applications they may already use.
7. Complementary applications in their stack.
8. TM1 or AI applications relevant to their industry/role.
9. Likely pain points.
10. High-impact openers -- 3 specific openers that demonstrate relevance from the first sentence.
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
                promptText = `Draft a preliminary, consultative proposal document. Do NOT include custom pricing amounts. Only state standard list-price frameworks from the Reference Catalog. Include sections:
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
                processFile(files[0], fileInput, droptext, targetTextarea, isAudio);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                processFile(fileInput.files[0], fileInput, droptext, targetTextarea, isAudio);
            }
        });
    }

    function processFile(file, fileInput, droptext, targetTextarea, isAudio) {
        if (file.size > 50 * 1024 * 1024) {
            showToast("File size is too large (max 50MB).");
            return;
        }

        const ext = file.name.split('.').pop().toLowerCase();

        if (isAudio) {
            // Audio call recording transcription flow
            if (sourceTranscriptProgress) sourceTranscriptProgress.classList.remove('hidden');
            if (sourceTranscriptProgressBar) sourceTranscriptProgressBar.style.setProperty('--progress', '20%');
            if (sourceTranscriptStatus) sourceTranscriptStatus.innerText = "Reading audio file...";

            const reader = new FileReader();
            reader.onload = async (e) => {
                if (sourceTranscriptProgressBar) sourceTranscriptProgressBar.style.setProperty('--progress', '40%');
                if (sourceTranscriptStatus) sourceTranscriptStatus.innerText = "Transcribing audio call recording...";

                const base64Audio = e.target.result.split(',')[1];
                const mimeType = file.type || 'audio/wav';

                try {
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
                    if (sourceTranscriptStatus) sourceTranscriptStatus.innerText = "Success! Loaded transcript.";

                    targetTextarea.value = data.transcript;
                    updateValidationBadges();

                    // Setup audio player
                    if (activeAudioContainer && activeAudioPlayer) {
                        const audioUrl = URL.createObjectURL(file);
                        activeAudioPlayer.src = audioUrl;
                        activeAudioContainer.classList.remove('hidden');
                    }
                    showToast("✔️ Recording uploaded and transcribed successfully.");

                    setTimeout(() => {
                        sourceTranscriptProgress.classList.add('hidden');
                    }, 2000);

                } catch (err) {
                    console.error("Transcription upload failed:", err);
                    if (sourceTranscriptProgressBar) sourceTranscriptProgressBar.style.setProperty('--progress', '0%');
                    if (sourceTranscriptStatus) sourceTranscriptStatus.innerText = `Error: ${err.message}`;
                    showToast("Transcription failed.");
                }
            };
            reader.readAsDataURL(file);
        } else {
            // Real uploader for LinkedIn profiles & general documents
            droptext.innerHTML = `⏳ Uploading and parsing ${escapeHTML(file.name)}...`;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Data = event.target.result.split(',')[1];
                const companyName = metaCompany ? metaCompany.value.trim() : 'Unknown_Company';
                
                try {
                    const res = await fetch('/api/gdrive/upload', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            company: companyName || 'Unknown_Company',
                            fileName: file.name,
                            mimeType: file.type || 'application/octet-stream',
                            fileData: base64Data
                        })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || `Upload failed with status ${res.status}`);

                    targetTextarea.value = data.parsedText || '';
                    updateValidationBadges();
                    droptext.innerHTML = `📄 Attached & Saved: <strong>${escapeHTML(file.name)}</strong>`;
                    showToast(`Uploaded and parsed ${file.name} successfully!`);
                    
                    // Reload GDrive dropdown list to include this file
                    await loadGoogleDriveFiles();
                    await loadProspectsTree();
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
                                    fileName: `Prospect_Metadata_${fullName}.md`,
                                    mimeType: 'text/markdown',
                                    fileData: base64Markdown
                                })
                            });

                            if (!mdUploadRes.ok) throw new Error("Failed to save prospect metadata file");
                            
                            // Refresh file list again to display the newly uploaded metadata file
                            await loadGoogleDriveFiles();
                            await loadProspectsTree();
                            showToast(`✔️ Prospect metadata saved: Prospect_Metadata_${fullName}.md`);
                        } catch (extractErr) {
                            console.error("Failed to extract metadata:", extractErr);
                            showToast("Failed to extract or save prospect metadata.");
                        }
                    }
                } catch (err) {
                    console.error("Upload processing failed:", err);
                    droptext.innerHTML = `<span style="color: #ff4d4d;">❌ Upload failed: ${escapeHTML(err.message)}</span>`;
                    showToast(`Error: ${err.message}`);
                }
            };
            reader.readAsDataURL(file);
        }
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
            if (currentChatId) {
                e.preventDefault();
                chatDragOverlay.classList.add('dragover');
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
            if (!currentChatId) return;
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                showToast(`Uploading ${file.name} to client folder...`);
                
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64Data = event.target.result.split(',')[1];
                    const companyName = metaCompany ? metaCompany.value.trim() : 'Unknown_Company';
                    
                    try {
                        const res = await fetch('/api/gdrive/upload', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                company: companyName || 'Unknown_Company',
                                fileName: file.name,
                                mimeType: file.type || 'application/octet-stream',
                                fileData: base64Data
                            })
                        });

                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || `Upload failed with status ${res.status}`);
                        
                        showToast(`Uploaded and indexed ${file.name} successfully!`);
                        
                        // Add a system notification in the chat log
                        chatHistory.push({
                            role: 'assistant',
                            content: `[SYSTEM: Document Uploaded] I have successfully uploaded and indexed "${file.name}" into the Google Drive memory folder for ${companyName}. I can now search and answer questions based on this file!`,
                            timestamp: new Date().toISOString()
                        });
                        renderChatHistory();

                        // Automatically load the content of this file to gdriveFileContent for active context RAG retry loop
                        if (data.fileId) {
                            sourceGdriveFileSelect.innerHTML = `<option value="${data.fileId}">${file.name} (Uploaded)</option>`;
                            sourceGdriveFileSelect.value = data.fileId;
                            sourceGdriveFileId.value = data.fileId;
                            gdriveFileContent = data.parsedText || '';
                        }

                        // Save conversation log back to backend
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
                                oneDriveFile: file.name,
                                gDriveFile: file.name,
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
                        
                        await loadGoogleDriveFiles();
                        await loadProspectsTree();
                    } catch (err) {
                        console.error("Direct drop upload failed:", err);
                        showToast(`File upload failed: ${err.message}`);
                    }
                };
                reader.readAsDataURL(file);
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
                const response = await fetch(`/api/gdrive/read?fileId=${encodeURIComponent(fileId)}`);
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
            loadGoogleDriveFiles();
            loadProspectsTree();
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
    setTimeout(() => {
        loadChatsList();
        loadProspectsTree();
        updateValidationBadges();
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 50);

    // Automatically expand advanced options in test runner environment
    if (navigator.webdriver) {
        const details = document.getElementById('advanced-sources-details');
        if (details) {
            details.setAttribute('open', '');
        }
    }

    // Automatically initialize a new chat session on load for a pure chat layout
    if (!currentChatId && btnNewChat && !window.__perfMetrics) {
        btnNewChat.click();
    }
});
