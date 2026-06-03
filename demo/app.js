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

    // State Variables
    let currentChatId = null;
    let chatsList = [];
    let chatHistory = [];
    let transitDistance = "Online/Phone call only (Distance unavailable)";
    let gdriveFileContent = "";

    // DOM Elements
    const btnNewChat = document.getElementById('btn-new-chat');
    const chatSearch = document.getElementById('chat-search');
    const recentChatsList = document.getElementById('recent-chats-list');
    const workspaceEmptyState = document.getElementById('workspace-empty-state');
    const workspaceActiveChat = document.getElementById('workspace-active-chat');

    const activeChatClientTitle = document.getElementById('active-chat-client-title');
    const activeChatClientMeta = document.getElementById('active-chat-client-meta');

    // Drawer Elements
    const btnToggleSources = document.getElementById('btn-toggle-sources');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const sourcesDrawer = document.getElementById('sources-drawer');

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

    // Chat Console Elements
    const chatMessagesLog = document.getElementById('chat-messages-log');
    const chatLoadingIndicator = document.getElementById('chat-loading-indicator');
    const chatUserInput = document.getElementById('chat-user-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const quickPromptButtons = document.querySelectorAll('.btn-quick-prompt');

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
        if (!recentChatsList) return;
        recentChatsList.innerHTML = '';

        const searchTerm = (chatSearch?.value || '').toLowerCase().trim();
        const filtered = chatsList.filter(item => {
            return !searchTerm ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.company && item.company.toLowerCase().includes(searchTerm));
        });

        if (filtered.length === 0) {
            recentChatsList.innerHTML = '<div style="font-size:0.8rem;color:#94a3b8;text-align:center;padding:1rem;">No clients found</div>';
            return;
        }

        filtered.forEach(item => {
            const dateStr = new Date(item.date).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const card = document.createElement('div');
            card.className = `chat-list-item ${item.id === currentChatId ? 'active' : ''}`;
            card.innerHTML = `
                <div class="chat-list-item-title">${escapeHTML(item.company)}</div>
                <div class="chat-list-item-subtitle">${escapeHTML(item.name)} — ${escapeHTML(item.track || 'TM1 & AI')}</div>
                <div class="chat-list-item-meta">
                    <span>${dateStr}</span>
                    <span>Rep: ${escapeHTML(item.rep || 'Albert')}</span>
                </div>
            `;

            card.addEventListener('click', () => selectChat(item.id));
            recentChatsList.appendChild(card);
        });
    }

    if (chatSearch) {
        chatSearch.addEventListener('input', renderChatsList);
    }

    // --- Google Drive Explorer Loader ---
    async function loadGoogleDriveFiles() {
        if (!sourceGdriveFileSelect) return;
        sourceGdriveFileSelect.innerHTML = '<option value="">-- Loading GDrive files... --</option>';
        try {
            const response = await fetch('/api/gdrive/list');
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
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // --- Select Chat ---
    async function selectChat(id) {
        currentChatId = id;
        renderChatsList();
 
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
            
            // Render plain text but preserve lines
            const pre = document.createElement('pre');
            pre.innerText = msg.content;
            card.appendChild(pre);

            // Add actions for assistant messages (plain text copy and email triggers)
            if (msg.role === 'assistant') {
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
    if (chatSourcesForm) {
        chatSourcesForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Perform distance calculation dynamically
            try {
                const distanceRes = await fetch('/api/calculate-distance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination: metaCompany.value })
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
                
                await loadChatsList();
                await selectChat(currentChatId);

            } catch (err) {
                console.error('Error saving sources:', err);
                showToast(`Error saving sources: ${err.message}`);
            }
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
            
            // Reload Google Drive files list to populate select dropdown
            loadGoogleDriveFiles();
        });
    }

    // --- LLM Interaction Helpers ---
    async function callTinyAPI(promptText) {
        chatLoadingIndicator.classList.remove('hidden');
        chatMessagesLog.scrollTop = chatMessagesLog.scrollHeight;

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
3. Be concise and factual. Do not make up facts. Use the client details provided.`;

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

            // Update local history
            chatHistory.push({ role: 'user', content: promptText, timestamp: new Date().toISOString() });
            chatHistory.push({ role: 'assistant', content: content, timestamp: new Date().toISOString() });

            renderChatHistory();

            // Save conversation log back to backend JSON file
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
        if (!currentChatId) {
            showToast("Please save sources first to initialize the chat.");
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

    // --- Quick Prompt Buttons ---
    quickPromptButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const promptType = btn.getAttribute('data-prompt-type');
            if (!currentChatId) {
                showToast("Please save sources first to initialize the chat.");
                return;
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
    });

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
            // Text files or Mock extractor for LinkedIn
            if (ext === 'txt') {
                const reader = new FileReader();
                reader.onload = (event) => {
                    targetTextarea.value = event.target.result;
                    droptext.innerHTML = `📄 Attached: <strong>${escapeHTML(file.name)}</strong>`;
                    showToast(`Loaded ${file.name} successfully!`);
                };
                reader.readAsText(file);
            } else if (ext === 'pdf' || ext === 'docx') {
                droptext.innerHTML = `⏳ Extracting text from ${escapeHTML(file.name)}...`;
                setTimeout(() => {
                    targetTextarea.value = `Experience:\n- 3+ years experience as Head of Finance / FP&A\n- Led consolidation projects across multi-currency ledgers\n` +
                        `Education:\n- Bachelor of Business / Commerce`;
                    droptext.innerHTML = `📄 Attached: <strong>${escapeHTML(file.name)}</strong>`;
                    showToast(`Extracted details from ${file.name}`);
                }, 1000);
            } else {
                showToast("Unsupported file type. Please upload a .txt, .pdf, or .docx file.");
            }
        }
    }

    // Initialize dropzones
    handleDropzoneUpload(sourceLinkedinDropzone, sourceLinkedinFile, document.getElementById('source-linkedin-droptext'), sourceLinkedinText, false);
    handleDropzoneUpload(sourceTranscriptDropzone, sourceTranscriptFile, document.getElementById('source-transcript-droptext'), sourceTranscriptText, true);

    // --- Collapsible Sources Drawer Toggles ---
    if (btnToggleSources && sourcesDrawer) {
        btnToggleSources.addEventListener('click', () => {
            sourcesDrawer.classList.toggle('open');
        });
    }
    if (btnCloseDrawer && sourcesDrawer) {
        btnCloseDrawer.addEventListener('click', () => {
            sourcesDrawer.classList.remove('open');
        });
    }

    // --- Google Drive File Selection Handler ---
    if (sourceGdriveFileSelect) {
        sourceGdriveFileSelect.addEventListener('change', async () => {
            const fileId = sourceGdriveFileSelect.value;
            if (!fileId) {
                sourceGdriveFileId.value = '';
                gdriveFileContent = '';
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
            elem.addEventListener('input', triggerAutoSave);
            elem.addEventListener('change', triggerAutoSave);
        }
    });

    // Initial Load
    loadChatsList();
    loadGoogleDriveFiles();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
