import { TinyAI } from './ai-assistant.js';

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // Helper to escape HTML to prevent XSS
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Fallback sanitizer if DOMPurify fails to load
    function fallbackSanitize(html) {
        if (!html) return '';
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=\s*(['"][^'"]*['"]|[^>\s]+)/gi, '');
    }

    // Global state for synthesized documents
    let currentDocs = null;
    let activeDocTab = 'summary';
    let currentQuestions = [];
    
    // Directory variables and event handlers
    let directoryItems = [];
    
    const tabActivePipeline = document.getElementById('tab-active-pipeline');
    const tabCallDirectory = document.getElementById('tab-call-directory');
    const activePipelineView = document.getElementById('active-pipeline-view');
    const callDirectoryView = document.getElementById('call-directory-view');
    const leftPanelTitle = document.getElementById('left-panel-title');

    function switchLeftTab(tab) {
        if (tab === 'pipeline') {
            if (tabActivePipeline) tabActivePipeline.classList.add('active');
            if (tabCallDirectory) tabCallDirectory.classList.remove('active');
            if (activePipelineView) activePipelineView.style.display = 'flex';
            if (callDirectoryView) callDirectoryView.style.display = 'none';
            if (leftPanelTitle) leftPanelTitle.innerText = "Tiny Sales Assistant Pipeline";
        } else {
            if (tabCallDirectory) tabCallDirectory.classList.add('active');
            if (tabActivePipeline) tabActivePipeline.classList.remove('active');
            if (activePipelineView) activePipelineView.style.display = 'none';
            if (callDirectoryView) callDirectoryView.style.display = 'flex';
            if (leftPanelTitle) leftPanelTitle.innerText = "04 — CENTRAL CALL RECORDING DIRECTORY";
            loadDirectoryList();
        }
    }

    if (tabActivePipeline && tabCallDirectory) {
        tabActivePipeline.addEventListener('click', () => switchLeftTab('pipeline'));
        tabCallDirectory.addEventListener('click', () => switchLeftTab('directory'));
    }

    async function loadDirectoryList() {
        const listContainer = document.getElementById('directory-list-container');
        if (!listContainer) return;
        listContainer.innerHTML = '<div style="font-size: 0.85rem; color: rgba(0,0,0,0.4); text-align: center; margin-top: 3rem;">Loading call directory...</div>';
        try {
            const response = await fetch('/api/history');
            if (!response.ok) {
                throw new Error('Failed to fetch history list');
            }
            directoryItems = await response.json();
            renderDirectoryList();
        } catch (error) {
            console.error('Error loading history list:', error);
            listContainer.innerHTML = `<div style="font-size: 0.85rem; color: #ff4d4d; text-align: center; margin-top: 3rem;">Failed to load call directory: ${error.message}</div>`;
        }
    }

    function renderDirectoryList() {
        const listContainer = document.getElementById('directory-list-container');
        if (!listContainer) return;

        const searchTerm = (document.getElementById('directory-search')?.value || '').toLowerCase().trim();
        const scoreFilter = document.getElementById('directory-filter-score')?.value || 'ALL';
        const repFilter = document.getElementById('directory-filter-rep')?.value || 'ALL';

        const filtered = directoryItems.filter(item => {
            const matchSearch = !searchTerm || 
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.company && item.company.toLowerCase().includes(searchTerm)) ||
                (item.track && item.track.toLowerCase().includes(searchTerm)) ||
                (item.title && item.title.toLowerCase().includes(searchTerm)) ||
                (item.type && item.type.toLowerCase().includes(searchTerm));

            let matchScore = true;
            if (scoreFilter !== 'ALL') {
                if (scoreFilter === 'NONE') {
                    matchScore = !item.score;
                } else {
                    matchScore = item.score && item.score.toUpperCase() === scoreFilter;
                }
            }

            let matchRep = true;
            if (repFilter !== 'ALL') {
                matchRep = item.rep && item.rep.toUpperCase() === repFilter.toUpperCase();
            }

            return matchSearch && matchScore && matchRep;
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="font-size: 0.85rem; color: rgba(0,0,0,0.4); text-align: center; margin-top: 3rem;">No call records found.</div>';
            return;
        }

        listContainer.innerHTML = '';
        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = 'directory-card';
            
            const dateStr = new Date(item.date).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const badgeTypeClass = item.type === 'synthesis' ? 'synthesis' : 'dossier';
            const badgeTypeLabel = item.type === 'synthesis' ? 'Synthesis' : 'Dossier';
            
            const repBadge = item.rep ? `<span class="directory-badge-rep" style="background: rgba(0, 120, 215, 0.08); color: #0078d4; font-size: 0.65rem; font-weight: bold; padding: 1px 6px; border-radius: 4px; text-transform: uppercase;">SDR: ${escapeHTML(item.rep)}</span>` : '';

            let scoreBadge = '';
            if (item.score) {
                const scoreLower = item.score.toLowerCase();
                scoreBadge = `<span class="badge-score ${scoreLower}">${item.score}</span>`;
            }

            const fileAttachedSegment = item.oneDriveFile ? `<div style="font-size: 0.7rem; color: rgba(0, 120, 215, 0.85); display: flex; align-items: center; gap: 4px; margin-top: 0.25rem; margin-bottom: 0.25rem;">📁 OneDrive SOW: <strong>${escapeHTML(item.oneDriveFile)}</strong></div>` : '';

            let audioPlayerHtml = '';
            if (item.type === 'synthesis') {
                audioPlayerHtml = `
                    <div class="directory-audio-player" data-id="${item.id}" style="margin: 0.5rem 0;">
                        <button type="button" class="audio-play-btn" title="Play call recording" style="background: var(--primary); color: #000; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 0.7rem; font-weight: bold; display: inline-flex; align-items: center; justify-content: center;">▶</button>
                        <div class="audio-track" style="flex: 1; height: 4px; background: rgba(0,0,0,0.1); border-radius: 2px; position: relative;">
                            <div class="audio-progress" style="height: 100%; background: var(--primary); width: 0%; border-radius: 2px;"></div>
                        </div>
                        <span class="audio-time" style="font-size: 0.65rem; color: rgba(0,0,0,0.55); font-family: monospace;">0:00 / 2:30</span>
                        <span class="audio-volume-icon" style="font-size: 0.75rem; color: rgba(0,0,0,0.4); cursor: pointer; margin-left: 0.25rem;">🔊</span>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="directory-card-header">
                    <div>
                        <div class="directory-card-title">${escapeHTML(item.company)}</div>
                        <div class="directory-card-subtitle">${escapeHTML(item.name)} ${item.title ? `— ${escapeHTML(item.title)}` : ''}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        <span class="directory-badge-type ${badgeTypeClass}">${badgeTypeLabel}</span>
                        ${repBadge}
                    </div>
                </div>
                ${fileAttachedSegment}
                <div class="directory-card-meta">
                    <span>📅 ${dateStr}</span>
                    ${item.track ? `<span>🏷️ ${escapeHTML(item.track)}</span>` : ''}
                    ${item.variant ? `<span>📋 ${escapeHTML(item.variant)}</span>` : ''}
                    ${scoreBadge}
                </div>
                ${audioPlayerHtml}
                <div class="directory-card-actions">
                    <button class="directory-btn directory-btn-delete" data-id="${item.id}">🗑️ Delete</button>
                    <button class="directory-btn directory-btn-load" data-id="${item.id}">👁️ Load Console</button>
                </div>
            `;

            card.querySelector('.directory-btn-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete this call record for ${item.company}?`)) {
                    await deleteHistoryItem(item.id);
                }
            });

            card.querySelector('.directory-btn-load').addEventListener('click', async (e) => {
                e.stopPropagation();
                await loadHistoryItemDetail(item.id);
            });

            listContainer.appendChild(card);
        });

        // Bind mock audio players
        filtered.forEach(item => {
            if (item.type === 'synthesis') {
                const cardEl = listContainer.querySelector(`.directory-audio-player[data-id="${item.id}"]`);
                if (cardEl) {
                    const playBtn = cardEl.querySelector('.audio-play-btn');
                    const progress = cardEl.querySelector('.audio-progress');
                    const timeLabel = cardEl.querySelector('.audio-time');
                    const volBtn = cardEl.querySelector('.audio-volume-icon');
                    
                    let isPlaying = false;
                    let duration = 150; // 2m 30s
                    let currentTime = 0;
                    let intervalId = null;
                    
                    const formatTime = (secs) => {
                        const m = Math.floor(secs / 60);
                        const s = Math.floor(secs % 60);
                        return `${m}:${s < 10 ? '0' : ''}${s}`;
                    };
                    
                    playBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (isPlaying) {
                            clearInterval(intervalId);
                            playBtn.innerText = '▶';
                            isPlaying = false;
                        } else {
                            // Find and stop any other active playing players
                            listContainer.querySelectorAll('.audio-play-btn').forEach(btn => {
                                if (btn !== playBtn && btn.innerText === '⏸') {
                                    btn.click();
                                }
                            });
                            playBtn.innerText = '⏸';
                            isPlaying = true;
                            intervalId = setInterval(() => {
                                currentTime += 1;
                                if (currentTime >= duration) {
                                    clearInterval(intervalId);
                                    playBtn.innerText = '▶';
                                    currentTime = 0;
                                    progress.style.width = '0%';
                                    timeLabel.innerText = `0:00 / ${formatTime(duration)}`;
                                    isPlaying = false;
                                } else {
                                    const percent = (currentTime / duration) * 100;
                                    progress.style.width = `${percent}%`;
                                    timeLabel.innerText = `${formatTime(currentTime)} / ${formatTime(duration)}`;
                                }
                            }, 1000);
                        }
                    });
                    
                    volBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (volBtn.innerText === '🔊') {
                            volBtn.innerText = '🔇';
                        } else {
                            volBtn.innerText = '🔊';
                        }
                    });
                }
            }
        });
    }

    async function deleteHistoryItem(id) {
        try {
            const response = await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error('Failed to delete call record');
            }
            showToast("Call record deleted successfully.");
            await loadDirectoryList();
        } catch (error) {
            console.error('Error deleting call record:', error);
            alert(`Failed to delete record: ${error.message}`);
        }
    }

    async function loadHistoryItemDetail(id) {
        showLoading("Loading historical session...");
        try {
            const response = await fetch(`/api/history/detail?id=${encodeURIComponent(id)}`);
            if (!response.ok) {
                throw new Error('Failed to load call record details');
            }
            const item = await response.json();
            
            if (item.type === 'dossier') {
                prepNameInput.value = item.name || '';
                prepTitleInput.value = item.title || '';
                prepCompanyInput.value = item.company || '';
                prepUrlInput.value = item.url || '';
                prepEmailInput.value = item.email || '';
                if (document.getElementById('prep-phone')) {
                    document.getElementById('prep-phone').value = item.phone || '';
                }
                if (document.getElementById('prep-rep')) {
                    document.getElementById('prep-rep').value = item.rep || 'Albert';
                }
                attachedOneDriveFile = item.oneDriveFile || null;
                const badge = document.getElementById('onedrive-attached-badge');
                const badgeName = document.getElementById('onedrive-attached-name');
                if (badge && badgeName) {
                    if (item.oneDriveFile) {
                        badgeName.innerText = item.oneDriveFile;
                        badge.style.display = 'flex';
                    } else {
                        badge.style.display = 'none';
                    }
                }
                prepTrackSelect.value = item.track || 'TM1 Support & Managed Support';
                prepIntakeText.value = item.intakeAnswers || '';
                prepLinkedinText.value = item.linkedinInfo || '';
                
                const formattedHtml = formatMarkdown(item.content);
                currentDocs = null;
                showResults(formattedHtml, false);
                
                goToStep(1);
                step1NextBtn.style.display = 'inline-flex';
                switchLeftTab('pipeline');
                showToast(`Restored Call Prep Briefing for ${item.company}`);
            } else if (item.type === 'synthesis') {
                synthVariantSelect.value = item.variant || 'Variant A';
                synthScreencast.value = item.screencast || '';
                synthTranscriptText.value = item.transcript || '';
                if (document.getElementById('prep-rep')) {
                    document.getElementById('prep-rep').value = item.rep || 'Albert';
                }
                
                if (item.variant === 'Variant B') {
                    prepTrackSelect.value = "TM1 Support & Managed Support";
                } else if (item.variant === 'Variant C') {
                    prepTrackSelect.value = "Agentic AI Operations & Watsonx";
                } else {
                    prepTrackSelect.value = "DataFusion & Analytics Stack";
                }
                
                if (item.customQuestions) {
                    currentQuestions = item.customQuestions;
                } else {
                    await loadCustomQuestions(item.variant || 'Variant A');
                }
                
                let docs = item.content;
                if (docs) {
                    const docsCopy = { ...docs };
                    for (const key in docsCopy) {
                        docsCopy[key] = formatMarkdown(docsCopy[key]);
                    }
                    if (item.transcript) {
                        docsCopy.transcript = `<pre style="white-space: pre-wrap; font-family: inherit; line-height: 1.5; color: #000000; font-size: 0.85rem; background: rgba(0,0,0,0.02); padding: 1rem; border: 1px solid rgba(0,0,0,0.06); border-radius: 6px;">${escapeHTML(item.transcript)}</pre>`;
                    }
                    currentDocs = docsCopy;
                    activeDocTab = 'summary';
                    showResults(null, true);
                }
                
                // Automatically switch to Review Mode when loading historical synthesis
                setQuestionnaireMode('review');
                renderBattlecards();
                
                goToStep(3);
                switchLeftTab('pipeline');
                showToast(`Restored Call Report Synthesis for ${item.company}`);
            }
        } catch (error) {
            console.error('Error loading history item detail:', error);
            resetOutput();
            showToast(`Failed to restore session: ${error.message}`);
        }
    }

    function extractScoreFromHTML(html) {
        if (!html) return null;
        const match = html.match(/QUALIFICATION\s*SCORE:\s*(HOT|WARM|COLD)/i);
        return match ? match[1].toUpperCase() : null;
    }

    function formatMarkdown(text) {
        if (!text) return "";
        // Strip markdown fences
        let formatted = text.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        
        // Convert **bold** to <strong>bold</strong>
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert specific headers in strong tags to h4 tags for block rendering and spacing
        formatted = formatted.replace(/<strong>(QUALIFICATION SCORE:.*?|SCORING RATIONALE:?|RECOMMENDED NEXT STEP:?|RED FLAGS:?)<\/strong>/gi, '<h4>$1</h4>');
        formatted = formatted.replace(/<strong>(Call Context:?|Systems Discussed:?|Pain Points:?|Goals:?|Timeline & Budget:?|Next Steps:?|Direct Quotes:?)<\/strong>/gi, '<h4>$1</h4>');
        formatted = formatted.replace(/<strong>(UNDERSTANDING OF REQUIREMENTS|PROPOSED SOLUTION|APPROACH & METHODOLOGY|TEAM & RESOURCES|NEXT STEPS & DISCOVERY OPEN ITEMS):?<\/strong>/gi, '<h4>$1</h4>');
        formatted = formatted.replace(/<strong>(Prospect:?|Octane \(SDR\):?|Octane \(TM1 Team\):?)<\/strong>/gi, '<h4>$1</h4>');

        const lines = formatted.split(/\r?\n/);
        let htmlContent = "";
        let inList = false;
        let listType = null; // 'ol' or 'ul'

        function closeList() {
            if (inList) {
                htmlContent += `</${listType}>`;
                inList = false;
                listType = null;
            }
        }

        for (let line of lines) {
            line = line.trim();
            if (!line) {
                closeList();
                continue;
            }

            // Check if the line is already a block element or contains block tags
            const hasBlockTags = /<p>|<ol>|<ul>|<li>|<h3>|<h4>|<div>|<pre>|<blockquote>|<table>/i.test(line);

            if (hasBlockTags) {
                closeList();
                htmlContent += line;
            } else {
                // Parse markdown elements
                const olMatch = line.match(/^(\d+\.)\s+(.*)/);
                const ulMatch = line.match(/^([-•\*])\s+(.*)/);
                const hMatch = line.match(/^(#{1,6})\s+(.*)/);
                const bqMatch = line.match(/^(&gt;|>)\s+(.*)/);

                if (olMatch) {
                    if (inList && listType !== 'ol') closeList();
                    if (!inList) {
                        htmlContent += '<ol>';
                        inList = true;
                        listType = 'ol';
                    }
                    htmlContent += `<li>${olMatch[2]}</li>`;
                } else if (ulMatch) {
                    if (inList && listType !== 'ul') closeList();
                    if (!inList) {
                        htmlContent += '<ul>';
                        inList = true;
                        listType = 'ul';
                    }
                    htmlContent += `<li>${ulMatch[2]}</li>`;
                } else if (hMatch) {
                    closeList();
                    const level = Math.min(hMatch[1].length, 6);
                    htmlContent += `<h${level}>${hMatch[2]}</h${level}>`;
                } else if (bqMatch) {
                    closeList();
                    htmlContent += `<blockquote>${bqMatch[2]}</blockquote>`;
                } else {
                    closeList();
                    if (line.startsWith('[') && line.endsWith(']')) {
                        htmlContent += `<h3>${line}</h3>`;
                    } else {
                        htmlContent += `<p>${line}</p>`;
                    }
                }
            }
        }
        closeList();
        
        return htmlContent;
    }

    // DOM Elements - Settings Configurations & Prompts
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsApiProvider = document.getElementById('settings-api-provider');
    const settingsApiUrl = document.getElementById('settings-api-url');
    const settingsApiModel = document.getElementById('settings-api-model');
    const settingsTonePreset = document.getElementById('settings-tone-preset');
    const settingsPrepPrompt = document.getElementById('settings-prep-prompt');
    const settingsSynthPrompt = document.getElementById('settings-synth-prompt');
    const settingsSaveBtn = document.getElementById('settings-save-btn');
    const settingsCancelBtn = document.getElementById('settings-cancel-btn');
    const settingsStatusMsg = document.getElementById('settings-status-msg');

    // Knowledge Base Elements
    const knowledgeDropZone = document.getElementById('knowledge-drop-zone');
    const knowledgeDropText = document.getElementById('knowledge-drop-text');
    const knowledgeUploadStatus = document.getElementById('knowledge-upload-status');
    const settingsKnowledgeFile = document.getElementById('settings-knowledge-file');
    const knowledgeFileList = document.getElementById('knowledge-file-list');
    const restoreDefaultsBtn = document.getElementById('restore-defaults-btn');

    // Configure PDF.js Worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }

    if (restoreDefaultsBtn) {
        restoreDefaultsBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to restore all default system playbooks? This will overwrite any existing files with the same names.")) {
                try {
                    restoreDefaultsBtn.disabled = true;
                    restoreDefaultsBtn.innerText = "⏳ Restoring...";
                    
                    const response = await fetch('/api/knowledge/restore', {
                        method: 'POST'
                    });
                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || 'Failed to restore default playbooks');
                    }
                    showToast("Default playbooks restored successfully.");
                    await loadKnowledgeFilesList();
                } catch (error) {
                    console.error('Error restoring default playbooks:', error);
                    alert(`Error: ${error.message}`);
                } finally {
                    restoreDefaultsBtn.disabled = false;
                    restoreDefaultsBtn.innerText = "🔄 Restore Defaults";
                }
            }
        });
    }

    const TONE_PRESETS = {
        professional: {
            prep: "You are a professional, clinical B2B sales research assistant. You write detailed, factual briefs without fluff or conversational filler.",
            synth: "You are a professional B2B sales operations assistant. You analyze call transcripts and produce clean, formatted HTML documents separated by delimiters."
        },
        empathetic: {
            prep: "You are a warm, supportive B2B advisor. You highlight relationship-building opportunities, focus on the client's human objectives, and write in an encouraging, collaborative tone.",
            synth: "You are an empathetic B2B sales enablement partner. You analyze call transcripts to highlight how we can best support the client, build trust, and write in a warm, helpful tone."
        },
        skeptical: {
            prep: "You are a critical, highly skeptical B2B sales auditor. You scrutinize claims, highlight qualifications risks, identify discrepancies in requirements, and focus heavily on hidden red flags.",
            synth: "You are a critical B2B risk assessment auditor. You scrutinize call transcripts to expose contradictions, qualification gaps, budget weaknesses, and highlight potential project failures."
        },
        detailed: {
            prep: "You are a meticulous, high-detail enterprise consultant. You write extensive, deeply granular briefings covering every operational angle with thorough context.",
            synth: "You are a senior high-detail enterprise consultant. You produce highly comprehensive, granular documentation of call details, technical systems, and explicit next steps."
        },
        concise: {
            prep: "You are a concise, direct B2B analyst. You focus on extreme brevity, bottom-line-upfront (BLUF), high information density, and bullet points. Zero conversational preamble.",
            synth: "You are a highly concise B2B operations analyst. You extract call data with maximum brevity, using bulleted summaries and BLUF formats. Zero boilerplate."
        }
    };

    function loadSettingsToUI() {
        if (settingsApiProvider) {
            settingsApiProvider.value = localStorage.getItem('tiny_api_provider') || TinyAI.DEFAULT_CONFIG.provider || 'mistral';
        }
        settingsApiUrl.value = localStorage.getItem('tiny_api_url') || TinyAI.DEFAULT_CONFIG.apiUrl;
        settingsApiModel.value = localStorage.getItem('tiny_api_model') || TinyAI.DEFAULT_CONFIG.model;
        
        const savedTone = localStorage.getItem('tiny_tone') || 'professional';
        settingsTonePreset.value = savedTone;
        
        settingsPrepPrompt.value = localStorage.getItem('tiny_prep_system_prompt') || TONE_PRESETS.professional.prep;
        settingsSynthPrompt.value = localStorage.getItem('tiny_synth_system_prompt') || TONE_PRESETS.professional.synth;
    }

    // Initialize UI settings values
    loadSettingsToUI();
    loadKnowledgeFilesList();

    // Toggle Settings panel
    settingsToggleBtn.addEventListener('click', () => {
        const isActive = settingsPanel.classList.toggle('active');
        if (isActive) {
            loadSettingsToUI();
            settingsStatusMsg.innerText = '';
            loadKnowledgeFilesList();
        }
    });

    settingsCancelBtn.addEventListener('click', () => {
        settingsPanel.classList.remove('active');
    });

    // Preset selection change handler
    settingsTonePreset.addEventListener('change', () => {
        const val = settingsTonePreset.value;
        if (val !== 'custom' && TONE_PRESETS[val]) {
            settingsPrepPrompt.value = TONE_PRESETS[val].prep;
            settingsSynthPrompt.value = TONE_PRESETS[val].synth;
        }
    });

    // If manual edits are done on prompts, change preset dropdown to 'custom'
    function checkCustomPromptOverride() {
        const currentPrep = settingsPrepPrompt.value.trim();
        const currentSynth = settingsSynthPrompt.value.trim();
        
        let foundMatch = false;
        for (const [key, preset] of Object.entries(TONE_PRESETS)) {
            if (preset.prep.trim() === currentPrep && preset.synth.trim() === currentSynth) {
                settingsTonePreset.value = key;
                foundMatch = true;
                break;
            }
        }
        if (!foundMatch) {
            settingsTonePreset.value = 'custom';
        }
    }

    settingsPrepPrompt.addEventListener('input', checkCustomPromptOverride);
    settingsSynthPrompt.addEventListener('input', checkCustomPromptOverride);

    // Save configurations
    settingsSaveBtn.addEventListener('click', () => {
        if (settingsApiProvider) {
            localStorage.setItem('tiny_api_provider', settingsApiProvider.value);
        }
        localStorage.setItem('tiny_api_url', settingsApiUrl.value.trim());
        localStorage.setItem('tiny_api_model', settingsApiModel.value.trim());
        localStorage.setItem('tiny_tone', settingsTonePreset.value);
        localStorage.setItem('tiny_prep_system_prompt', settingsPrepPrompt.value.trim());
        localStorage.setItem('tiny_synth_system_prompt', settingsSynthPrompt.value.trim());
        
        settingsStatusMsg.style.color = 'var(--primary)';
        settingsStatusMsg.innerText = '✓ Settings Saved Successfully!';
        
        showToast("Configurations saved locally.");
        
        setTimeout(() => {
            settingsPanel.classList.remove('active');
            settingsStatusMsg.innerText = '';
        }, 1500);
    });

    // --- Knowledge Base Handlers & Document Parsers ---
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async function loadKnowledgeFilesList() {
        if (!knowledgeFileList) return;
        knowledgeFileList.innerHTML = '<div style="font-size: 0.8rem; color: rgba(255,255,255,0.4); text-align: center; margin-top: 2rem;">Loading files...</div>';
        try {
            const response = await fetch('/api/knowledge');
            if (!response.ok) {
                throw new Error('Failed to fetch knowledge list');
            }
            const files = await response.json();
            knowledgeFileList.innerHTML = '';
            
            if (files.length === 0) {
                knowledgeFileList.innerHTML = '<div style="font-size: 0.8rem; color: rgba(255,255,255,0.4); text-align: center; margin-top: 2rem;">No documents loaded.</div>';
                return;
            }

            files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'knowledge-file-item';
                
                const fileIcon = file.name.endsWith('.pdf') ? '📄' : 
                                 file.name.endsWith('.docx') ? '📝' : '📁';
                
                const badgeClass = file.isSystem ? 'system' : 'user';
                const badgeLabel = file.isSystem ? 'System' : 'User';
                
                item.innerHTML = `
                    <div class="knowledge-file-info">
                        <span>${fileIcon}</span>
                        <span class="knowledge-file-name" title="${escapeHTML(file.name)}">${escapeHTML(file.name)}</span>
                        <span class="knowledge-file-size">(${formatBytes(file.sizeBytes)})</span>
                    </div>
                    <div class="knowledge-file-actions">
                        <span class="knowledge-file-badge ${badgeClass}">${badgeLabel}</span>
                        <button type="button" class="knowledge-delete-btn" data-filename="${escapeHTML(file.name)}" title="Delete file">
                            🗑️
                        </button>
                    </div>
                `;
                
                const deleteBtn = item.querySelector('.knowledge-delete-btn');
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const confirmMsg = file.isSystem ? 
                        `Warning: You are about to delete a core system playbook "${file.name}". Are you sure you want to proceed?` :
                        `Are you sure you want to delete "${file.name}"?`;
                    if (confirm(confirmMsg)) {
                        await deleteKnowledgeFile(file.name);
                    }
                });
                
                knowledgeFileList.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading knowledge files:', error);
            knowledgeFileList.innerHTML = `<div style="font-size: 0.8rem; color: rgba(255,99,71,0.8); text-align: center; margin-top: 2rem;">Failed to load files list.</div>`;
        }
    }

    async function deleteKnowledgeFile(fileName) {
        try {
            const response = await fetch(`/api/knowledge?fileName=${encodeURIComponent(fileName)}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete file');
            }
            showToast("Document deleted successfully.");
            await loadKnowledgeFilesList();
        } catch (error) {
            console.error('Error deleting file:', error);
            alert(`Error: ${error.message}`);
        }
    }

    async function handleSelectedFile(file) {
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            setUploadStatus('❌ Error: File size exceeds 2MB limit.', 'error');
            return;
        }

        const name = file.name.toLowerCase();
        const extension = name.substring(name.lastIndexOf('.'));
        const allowedExtensions = ['.pdf', '.docx', '.txt', '.md'];
        
        if (!allowedExtensions.includes(extension)) {
            setUploadStatus('❌ Error: Unsupported file type.', 'error');
            return;
        }

        setUploadStatus('⏳ Reading and parsing file...', 'progress');

        try {
            let extractedText = '';
            
            if (extension === '.txt' || extension === '.md') {
                extractedText = await readTextFile(file);
            } else if (extension === '.pdf') {
                if (typeof pdfjsLib === 'undefined') {
                    throw new Error('PDF parsing library (PDF.js) failed to load.');
                }
                const arrayBuffer = await readFileAsArrayBuffer(file);
                extractedText = await extractTextFromPDF(arrayBuffer);
            } else if (extension === '.docx') {
                if (typeof mammoth === 'undefined') {
                    throw new Error('DOCX parsing library (Mammoth.js) failed to load.');
                }
                const arrayBuffer = await readFileAsArrayBuffer(file);
                extractedText = await extractTextFromDOCX(arrayBuffer);
            }
            
            const trimmedText = extractedText.trim();
            
            // Validation for scanned PDF/empty file
            if (!trimmedText || trimmedText.length < 20) {
                setUploadStatus('⚠️ Warning: No readable text found. Scanned PDFs are not supported.', 'error');
                return;
            }

            // Client-side character limit validation to avoid out-of-memory / token overflow (approx 100,000 chars)
            if (trimmedText.length > 100000) {
                setUploadStatus('⚠️ Warning: File is too large (exceeds 100,000 characters limit).', 'error');
                return;
            }

            let fileBase64 = null;
            if (extension === '.pdf' || extension === '.docx') {
                fileBase64 = await readFileAsBase64(file);
            }

            setUploadStatus('⏳ Uploading to server...', 'progress');
            await uploadKnowledgeFile(file.name, trimmedText, fileBase64);
            
        } catch (error) {
            console.error('Error parsing file:', error);
            setUploadStatus(`❌ Error parsing file: ${error.message}`, 'error');
        }
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    function readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }

    async function extractTextFromPDF(arrayBuffer) {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    }

    async function extractTextFromDOCX(arrayBuffer) {
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value;
    }

    function setUploadStatus(message, type) {
        if (!knowledgeUploadStatus) return;
        knowledgeUploadStatus.innerText = message;
        if (type === 'error') {
            knowledgeUploadStatus.style.color = '#ff6347';
        } else if (type === 'progress') {
            knowledgeUploadStatus.style.color = 'var(--primary)';
        } else {
            knowledgeUploadStatus.style.color = '#2ed573';
        }
    }

    async function uploadKnowledgeFile(fileName, fileText, fileBase64 = null) {
        try {
            const payload = { fileName, fileText };
            if (fileBase64) {
                payload.fileBase64 = fileBase64;
            }
            const response = await fetch('/api/knowledge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }
            setUploadStatus('✓ Uploaded successfully!', 'success');
            showToast("Document added to knowledge base.");
            await loadKnowledgeFilesList();
            setTimeout(() => {
                if (knowledgeUploadStatus.innerText === '✓ Uploaded successfully!') {
                    knowledgeUploadStatus.innerText = '';
                }
            }, 3000);
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadStatus(`❌ Upload failed: ${error.message}`, 'error');
        }
    }

    // Drag & Drop event handlers
    if (knowledgeDropZone) {
        knowledgeDropZone.addEventListener('click', () => {
            settingsKnowledgeFile.click();
        });
        
        knowledgeDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            knowledgeDropZone.classList.add('dragover');
        });
        
        knowledgeDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            knowledgeDropZone.classList.remove('dragover');
        });
        
        knowledgeDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            knowledgeDropZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                handleSelectedFile(files[0]);
            }
        });
    }

    if (settingsKnowledgeFile) {
        settingsKnowledgeFile.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                handleSelectedFile(files[0]);
                settingsKnowledgeFile.value = '';
            }
        });
    }

    // Stepper elements
    const stepIndicators = [
        document.getElementById('step-1-indicator'),
        document.getElementById('step-2-indicator'),
        document.getElementById('step-3-indicator')
    ];
    const stepContents = [
        document.getElementById('step-1-content'),
        document.getElementById('step-2-content'),
        document.getElementById('step-3-content')
    ];
    const step1NextBtn = document.getElementById('step-1-next-btn');
    const step2BackBtn = document.getElementById('step-2-back-btn');
    const step2NextBtn = document.getElementById('step-2-next-btn');
    const step3BackBtn = document.getElementById('step-3-back-btn');
    const step2SaveBtn = document.getElementById('step-2-save-btn');
    
    // Questionnaire Mode toggle buttons
    const modeLiveBtn = document.getElementById('mode-live-btn');
    const modeReviewBtn = document.getElementById('mode-review-btn');
    const battlecardContainer = document.getElementById('battlecard-container');

    // Dossier Tab Form
    const prepLoadSampleBtn = document.getElementById('prep-load-sample-btn');
    const prepForm = document.getElementById('prep-form');
    const prepNameInput = document.getElementById('prep-name');
    const prepTitleInput = document.getElementById('prep-title');
    const prepCompanyInput = document.getElementById('prep-company');
    const prepUrlInput = document.getElementById('prep-url');
    const prepEmailInput = document.getElementById('prep-email');
    const prepTrackSelect = document.getElementById('prep-track');
    const prepIntakeText = document.getElementById('prep-intake');
    const prepLinkedinText = document.getElementById('prep-linkedin');
    const prepSubmitBtn = document.getElementById('prep-submit-btn');
    const linkedinDropZone = document.getElementById('linkedin-drop-zone');
    const linkedinDropText = document.getElementById('linkedin-drop-text');
    const linkedinFileInput = document.getElementById('prep-linkedin-file');

    // Synthesize Tab Form
    const synthLoadSampleBtn = document.getElementById('synth-load-sample-btn');
    const synthForm = document.getElementById('synth-form');
    const synthVariantSelect = document.getElementById('synth-variant');
    const synthScreencast = document.getElementById('synth-screencast');
    const synthTranscriptText = document.getElementById('synth-transcript');
    const synthSubmitBtn = document.getElementById('synth-submit-btn');

    // Battlecard Reference
    const battlecardSelector = document.getElementById('battlecard-selector');
    const battlecardBody = document.getElementById('battlecard-body');

    // Output Side
    const outputConsole = document.getElementById('output-console');
    const outputEmptyState = document.getElementById('output-empty-state');
    const outputLoading = document.getElementById('output-loading');
    const outputResults = document.getElementById('output-results');
    const outputDocNav = document.getElementById('output-doc-nav');
    const outputDocContent = document.getElementById('output-doc-content');
    
    // Copy/Download/Sync Buttons
    const copyContentBtn = document.getElementById('copy-content-btn');
    const downloadContentBtn = document.getElementById('download-content-btn');
    const toast = document.getElementById('toast');

    // --- Local Storage API Settings Load ---
    function getApiConfig() {
        return {
            provider: localStorage.getItem('tiny_api_provider') || TinyAI.DEFAULT_CONFIG.provider || 'mistral',
            apiKey: "",
            apiUrl: localStorage.getItem('tiny_api_url') || TinyAI.DEFAULT_CONFIG.apiUrl,
            model: localStorage.getItem('tiny_api_model') || TinyAI.DEFAULT_CONFIG.model,
            prepSystemPrompt: localStorage.getItem('tiny_prep_system_prompt') || TONE_PRESETS.professional.prep,
            synthSystemPrompt: localStorage.getItem('tiny_synth_system_prompt') || TONE_PRESETS.professional.synth
        };
    }

    // --- Stepper Navigation ---
    let currentStep = 1;

    function goToStep(stepNum) {
        if (stepNum < 1 || stepNum > 3) return;
        currentStep = stepNum;

        // Update step contents visibility
        stepContents.forEach((content, index) => {
            if (index + 1 === stepNum) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Update stepper indicators visual states
        stepIndicators.forEach((indicator, index) => {
            const stepIndex = index + 1;
            if (stepIndex === stepNum) {
                indicator.classList.add('active');
                indicator.classList.remove('completed');
            } else if (stepIndex < stepNum) {
                indicator.classList.remove('active');
                indicator.classList.add('completed');
            } else {
                indicator.classList.remove('active');
                indicator.classList.remove('completed');
            }
        });

        // Render battlecards if in step 2
        if (stepNum === 2) {
            renderBattlecards();
        }
    }

    // Step Navigation Event Listeners
    step1NextBtn.addEventListener('click', () => {
        goToStep(2);
        setQuestionnaireMode('live');
    });
    step2BackBtn.addEventListener('click', () => goToStep(1));
    step2NextBtn.addEventListener('click', () => goToStep(3));
    step3BackBtn.addEventListener('click', () => {
        goToStep(2);
        setQuestionnaireMode('review');
    });
    
    // Questionnaire Mode helper and toggle listeners
    function setQuestionnaireMode(mode) {
        if (!modeLiveBtn || !modeReviewBtn || !battlecardContainer) return;
        
        if (mode === 'live') {
            modeLiveBtn.classList.add('active');
            modeLiveBtn.style.background = 'var(--primary)';
            modeLiveBtn.style.color = 'white';
            modeLiveBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            
            modeReviewBtn.classList.remove('active');
            modeReviewBtn.style.background = 'transparent';
            modeReviewBtn.style.color = 'rgba(0,0,0,0.6)';
            modeReviewBtn.style.boxShadow = 'none';
            
            battlecardContainer.classList.remove('mode-review');
            battlecardContainer.classList.add('mode-live');
        } else {
            modeReviewBtn.classList.add('active');
            modeReviewBtn.style.background = 'var(--primary)';
            modeReviewBtn.style.color = 'white';
            modeReviewBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            
            modeLiveBtn.classList.remove('active');
            modeLiveBtn.style.background = 'transparent';
            modeLiveBtn.style.color = 'rgba(0,0,0,0.6)';
            modeLiveBtn.style.boxShadow = 'none';
            
            battlecardContainer.classList.remove('mode-live');
            battlecardContainer.classList.add('mode-review');
        }
    }

    if (modeLiveBtn && modeReviewBtn) {
        modeLiveBtn.addEventListener('click', () => {
            setQuestionnaireMode('live');
            showToast("🎙️ Live Call Mode active: notes textareas hidden.");
        });
        modeReviewBtn.addEventListener('click', () => {
            setQuestionnaireMode('review');
            showToast("📝 Review Mode active: edit answers directly.");
        });
    }


    step2SaveBtn.addEventListener('click', async () => {
        const variant = battlecardSelector.value;
        const questions = currentQuestions.map(q => ({ q: q.q, a: q.a || "" }));
        
        step2SaveBtn.disabled = true;
        const originalText = step2SaveBtn.innerText;
        step2SaveBtn.innerText = "💾 Saving...";

        try {
            const res = await fetch('/api/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ variant, questions })
            });

            if (!res.ok) {
                throw new Error(`HTTP error ${res.status}`);
            }

            const data = await res.json();
            
            // Persist to local storage as fallback backup
            localStorage.setItem('custom_questions_' + variant, JSON.stringify(questions));
            
            showToast("Questions registered on server successfully!");
        } catch (err) {
            console.error("Failed to register custom questions on server:", err);
            // Save to LocalStorage anyway so it's not lost
            localStorage.setItem('custom_questions_' + variant, JSON.stringify(questions));
            showToast("Saved locally (Server registration failed).");
        } finally {
            step2SaveBtn.disabled = false;
            step2SaveBtn.innerText = originalText;
        }
    });

    // --- Load Custom Questions from Server / LocalStorage ---
    async function loadCustomQuestions(variant) {
        try {
            const res = await fetch(`/api/questions?variant=${variant}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    currentQuestions = data.map((item, index) => {
                        const q = typeof item === 'object' && item !== null ? item.q : item;
                        const a = typeof item === 'object' && item !== null ? (item.a || '') : '';
                        const defaultTip = BATTLECARDS[variant] && BATTLECARDS[variant][index] ? BATTLECARDS[variant][index].tip : "Custom question";
                        return { q, a, tip: defaultTip };
                    });
                    console.log(`Loaded custom questions for Variant ${variant} from server.`);
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to load custom questions from server, falling back to local storage:", e);
        }

        try {
            const localData = localStorage.getItem('custom_questions_' + variant);
            if (localData) {
                const parsed = JSON.parse(localData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    currentQuestions = parsed.map((item, index) => {
                        const q = typeof item === 'object' && item !== null ? item.q : item;
                        const a = typeof item === 'object' && item !== null ? (item.a || '') : '';
                        const defaultTip = BATTLECARDS[variant] && BATTLECARDS[variant][index] ? BATTLECARDS[variant][index].tip : "Custom question";
                        return { q, a, tip: defaultTip };
                    });
                    console.log(`Loaded custom questions for Variant ${variant} from LocalStorage.`);
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to parse local storage questions:", e);
        }

        currentQuestions = JSON.parse(JSON.stringify(BATTLECARDS[variant] || []));
        console.log(`Loaded default questions for Variant ${variant}.`);
    }

    // --- Dynamic Track-to-Variant Sync ---
    async function syncServiceTrackToVariant() {
        const track = prepTrackSelect.value;
        let variant = "A";
        if (track === "TM1 Support & Managed Support") {
            battlecardSelector.value = "B";
            synthVariantSelect.value = "Variant B";
            variant = "B";
        } else if (track === "Agentic AI Operations & Watsonx") {
            battlecardSelector.value = "C";
            synthVariantSelect.value = "Variant C";
            variant = "C";
        } else {
            battlecardSelector.value = "A";
            synthVariantSelect.value = "Variant A";
            variant = "A";
        }
        await loadCustomQuestions(variant);
    }

    prepTrackSelect.addEventListener('change', async () => {
        await syncServiceTrackToVariant();
        if (currentStep === 2) {
            renderBattlecards();
        }
    });

    // --- Output Visual States Helper ---
    function resetOutput() {
        outputConsole.classList.remove('has-content');
        outputEmptyState.style.display = 'flex';
        outputLoading.style.display = 'none';
        outputResults.style.display = 'none';
        currentDocs = null;
    }

    function showLoading(text) {
        outputConsole.classList.remove('has-content');
        outputEmptyState.style.display = 'none';
        outputResults.style.display = 'none';
        outputLoading.style.display = 'flex';
        document.getElementById('loading-text-label').innerText = text;
    }

    function showResults(htmlContent, isCollection = false) {
        outputLoading.style.display = 'none';
        outputEmptyState.style.display = 'none';
        outputConsole.classList.add('has-content');
        outputResults.style.display = 'flex';

        if (isCollection) {
            outputDocNav.style.display = 'flex';
            renderActiveDocument();
        } else {
            outputDocNav.style.display = 'none';
            outputDocContent.innerHTML = window.DOMPurify ? DOMPurify.sanitize(htmlContent) : fallbackSanitize(htmlContent);
        }
    }

    // --- Toast Notification ---
    function showToast(message) {
        toast.innerText = message;
        toast.classList.add('active');
        setTimeout(() => {
            toast.classList.remove('active');
        }, 2500);
    }

    // --- Microsoft OneDrive Integration Simulation ---
    const ONEDRIVE_DATA = {
        'Active Clients': [
            { name: 'Meridian Logistics', isFolder: true },
            { name: 'Atlas Financials', isFolder: true },
            { name: 'Apex Retail', isFolder: true },
            { name: 'Meridian_Logistics_SOW_2025.pdf', isFolder: false, size: 1258291 },
            { name: 'Atlas_Financials_TM1_Migration_Scope_2025.pdf', isFolder: false, size: 2202009 }
        ],
        'Meridian Logistics': [
            { name: 'Meridian_Logistics_SOW_2025.pdf', isFolder: false, size: 1258291 },
            { name: 'Meridian_PA_Support_Requirement_Brief_2024.docx', isFolder: false, size: 460800 },
            { name: 'Meridian_DataFusion_Schema_Specs.txt', isFolder: false, size: 24576 }
        ],
        'Atlas Financials': [
            { name: 'Atlas_Financials_TM1_Migration_Scope_2025.pdf', isFolder: false, size: 2202009 },
            { name: 'Atlas_Support_SLA_2024.docx', isFolder: false, size: 184320 }
        ],
        'Apex Retail': [
            { name: 'Apex_Retail_Inventory_Planning_Model.xlsx', isFolder: false, size: 1887436 },
            { name: 'Apex_Retail_AI_Integration_Brief_2025.pdf', isFolder: false, size: 1153433 }
        ]
    };
    let onedriveCurrentFolder = 'Active Clients';
    let attachedOneDriveFile = null;

    const onedriveBrowseBtn = document.getElementById('prep-onedrive-browse-btn');
    const onedriveBrowserPanel = document.getElementById('onedrive-browser');
    const onedriveBackBtn = document.getElementById('onedrive-back-btn');
    const onedriveSearchInput = document.getElementById('prep-onedrive-search');
    const onedriveRemoveBtn = document.getElementById('onedrive-attached-remove');
    const onedriveBadge = document.getElementById('onedrive-attached-badge');

    function renderOneDriveList() {
        const listEl = document.getElementById('onedrive-items-list');
        const folderTitle = document.getElementById('onedrive-current-folder');
        
        if (!listEl) return;
        
        if (folderTitle) folderTitle.innerText = onedriveCurrentFolder;
        
        if (onedriveBackBtn) {
            if (onedriveCurrentFolder !== 'Active Clients') {
                onedriveBackBtn.style.display = 'inline-block';
            } else {
                onedriveBackBtn.style.display = 'none';
            }
        }
        
        let items = ONEDRIVE_DATA[onedriveCurrentFolder] || [];
        const query = (onedriveSearchInput?.value || '').toLowerCase().trim();
        
        if (query) {
            items = [];
            for (const folder in ONEDRIVE_DATA) {
                ONEDRIVE_DATA[folder].forEach(item => {
                    if (!item.isFolder && item.name.toLowerCase().includes(query)) {
                        if (!items.find(existing => existing.name === item.name)) {
                            items.push(item);
                        }
                    }
                });
            }
        }
        
        if (items.length === 0) {
            listEl.innerHTML = '<div style="font-size: 0.7rem; color: rgba(0,0,0,0.4); text-align: center; padding: 1rem 0;">No items found</div>';
            return;
        }
        
        listEl.innerHTML = '';
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'onedrive-item';
            
            const icon = item.isFolder ? '📁' : '📄';
            const sizeText = item.isFolder ? '' : ` (${formatBytes(item.size)})`;
            
            itemDiv.innerHTML = `
                <div class="onedrive-item-info">
                    <span>${icon}</span>
                    <span class="onedrive-item-name" style="cursor: ${item.isFolder ? 'pointer' : 'default'}; font-weight: ${item.isFolder ? 'bold' : 'normal'}; color: ${item.isFolder ? '#0078d4' : 'inherit'};">${escapeHTML(item.name)}</span>
                    <span class="onedrive-item-size">${sizeText}</span>
                </div>
                ${item.isFolder ? '' : `<button type="button" class="onedrive-btn-attach">Attach</button>`}
            `;
            
            if (item.isFolder) {
                itemDiv.querySelector('.onedrive-item-name').addEventListener('click', () => {
                    onedriveCurrentFolder = item.name;
                    renderOneDriveList();
                });
            } else {
                itemDiv.querySelector('.onedrive-btn-attach').addEventListener('click', () => {
                    attachedOneDriveFile = item.name;
                    const badgeName = document.getElementById('onedrive-attached-name');
                    if (onedriveBadge && badgeName) {
                        badgeName.innerText = item.name;
                        onedriveBadge.style.display = 'flex';
                    }
                    showToast(`Attached ${item.name} from OneDrive!`);
                });
            }
            
            listEl.appendChild(itemDiv);
        });
    }

    if (onedriveBrowseBtn) {
        onedriveBrowseBtn.addEventListener('click', () => {
            if (onedriveBrowserPanel) {
                const isHidden = onedriveBrowserPanel.style.display === 'none';
                onedriveBrowserPanel.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    renderOneDriveList();
                }
            }
        });
    }

    if (onedriveBackBtn) {
        onedriveBackBtn.addEventListener('click', () => {
            onedriveCurrentFolder = 'Active Clients';
            renderOneDriveList();
        });
    }

    if (onedriveSearchInput) {
        onedriveSearchInput.addEventListener('input', () => {
            if (onedriveBrowserPanel) {
                onedriveBrowserPanel.style.display = 'block';
            }
            renderOneDriveList();
        });
    }

    if (onedriveRemoveBtn) {
        onedriveRemoveBtn.addEventListener('click', () => {
            attachedOneDriveFile = null;
            if (onedriveBadge) {
                onedriveBadge.style.display = 'none';
            }
            showToast("OneDrive SOW attachment removed.");
        });
    }

    // --- Templates Loader ---
    prepLoadSampleBtn.addEventListener('click', () => {
        prepNameInput.value = "Sarah Chen";
        prepTitleInput.value = "Head of FP&A";
        prepCompanyInput.value = "Meridian Logistics";
        prepUrlInput.value = "meridianlogistics.com.au";
        prepEmailInput.value = "sarah.chen@meridianlogistics.com.au";
        if (document.getElementById('prep-phone')) {
            document.getElementById('prep-phone').value = "+61 2 9876 5432";
        }
        if (document.getElementById('prep-rep')) {
            document.getElementById('prep-rep').value = "Albert";
        }
        
        // Auto-attach sample OneDrive SOW
        attachedOneDriveFile = "Meridian_Logistics_SOW_2025.pdf";
        const badgeName = document.getElementById('onedrive-attached-name');
        if (onedriveBadge && badgeName) {
            badgeName.innerText = attachedOneDriveFile;
            onedriveBadge.style.display = 'flex';
        }

        prepTrackSelect.value = "TM1 Support & Managed Support";
        prepIntakeText.value = "Service track interest: IBM Planning Analytics / TM1 support\nExcel spreadsheets consolidated: 35 sheets currently consolidated manually\nWorkflow description: Monthly actuals vs budget consolidation and reporting\nGL/ERP system: NetSuite ERP\nReporting tools: Power BI, Excel (PAX)\nDiscuss details: We have a major bottleneck during monthly forecasting. Consolidating the NetSuite actuals with our Excel model templates takes us 45 minutes per worksheet. We want to automate this data transfer and move to a unified database.";
        prepLinkedinText.value = "Experience:\n- Head of FP&A at Meridian Logistics (3 years - Present)\n  * Leading financial planning, forecasting, and consolidation processes\n  * Managing a team of 4 financial analysts\n- Senior Financial Analyst at Linfox Logistics (4 years)\nEducation:\n- Master of Applied Finance, University of Melbourne";
        if (linkedinDropText) {
            linkedinDropText.innerHTML = '📁 Drop LinkedIn PDF/TXT here, or click to upload';
        }
        syncServiceTrackToVariant();
        step1NextBtn.style.display = 'inline-flex';
        showToast("Prefilled Sarah Chen Dossier template!");
    });

    synthLoadSampleBtn.addEventListener('click', () => {
        synthVariantSelect.value = "Variant A";
        synthTranscriptText.value = `Albert (SDR): Hi Sarah, thank you for booking some time with us. I saw on the discovery form that you're currently leading the FP&A team at Meridian Logistics.
Sarah Chen: Yes, that's correct. We've been experiencing quite a bit of scale lately, and it's putting a lot of pressure on our finance team, especially during our monthly forecast close.
Albert (SDR): I saw you mentioned a bottleneck regarding NetSuite data consolidation in Excel. Can you elaborate on that?
Sarah Chen: Sure. Our actuals reside in NetSuite, but all our planning models are housed in Excel. We have about 35 separate spreadsheets that get sent out to different department heads. When they come back, we have to manually extract the data and update our consolidation worksheets. It takes about 45 minutes per sheet, and with 35 sheets, it's easily several days of mind-numbing copy-pasting. It's incredibly prone to formula errors.
Albert (SDR): That's a classic bottleneck. It sounds like you're spending 80% of your time just moving data instead of analyzing it.
Sarah Chen: Exactly. We are using Power BI and PAX for some basic reporting, but they're fed from these manual Excel files.
Albert (SDR): If we could integrate your NetSuite actuals directly with a central IBM Planning Analytics database, and push that clean data straight to your Power BI reports in real time, what would that mean for your team?
Sarah Chen: It would save us at least 3 days every month. My analysts could actually focus on tracking logistics variance instead of doing data entry.
Albert (SDR): Wonderful. Now, in terms of timeline, when are you hoping to have a solution in place?
Sarah Chen: We want this resolved before the Q3 planning cycle, which starts in about two months.
Albert (SDR): And is there a budget allocated specifically for this integration project?
Sarah Chen: We have a sign-off threshold of up to $40,000 for this financial year if we can show a clear return on investment.
Albert (SDR): Excellent. I want to book a deep dive meeting for you with Amendra Pratap, our TM1 Practice Lead. He can walk you through the architecture of our DataFusion connector to NetSuite. Let me pull up his calendar. How does next Tuesday at 10:00 AM AEST look for you?
Sarah Chen: That works perfectly for me. Let's schedule it.
Albert (SDR): Fantastic, I've booked that meeting and sent the invitation. I look forward to working with you, Sarah.`;
        showToast("Prefilled Call Transcript template!");
    });

    // --- Form Submit handlers ---
    prepForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const params = {
            name: prepNameInput.value.trim(),
            title: prepTitleInput.value.trim(),
            company: prepCompanyInput.value.trim(),
            url: prepUrlInput.value.trim(),
            email: prepEmailInput.value.trim(),
            phone: document.getElementById('prep-phone')?.value.trim() || '',
            rep: document.getElementById('prep-rep')?.value || 'Albert',
            oneDriveFile: attachedOneDriveFile,
            track: prepTrackSelect.value,
            intakeAnswers: prepIntakeText.value.trim(),
            linkedinInfo: prepLinkedinText.value.trim()
        };

        if (!params.name || !params.company) {
            showToast("Please enter at least Name and Company Name.");
            return;
        }

        prepSubmitBtn.disabled = true;
        showLoading("Generating prospect preparation dossier...");

        try {
            const apiConfig = getApiConfig();
            const resultHtml = await TinyAI.generateProspectDossier(params, apiConfig);
            const formattedHtml = formatMarkdown(resultHtml);
            showResults(formattedHtml, false);
            step1NextBtn.style.display = 'inline-flex';
            
            // Auto-save dossier to history
            const payload = {
                type: 'dossier',
                name: params.name,
                title: params.title,
                company: params.company,
                email: params.email,
                phone: params.phone,
                rep: params.rep,
                oneDriveFile: params.oneDriveFile,
                track: params.track,
                url: params.url,
                intakeAnswers: params.intakeAnswers,
                linkedinInfo: params.linkedinInfo,
                content: resultHtml
            };
            fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => res.json())
              .then(data => console.log("Saved dossier to server history:", data.id))
              .catch(err => console.warn("Failed to auto-save dossier to history:", err));

            goToStep(2);
        } catch (err) {
            resetOutput();
            showToast(`Error: ${err.message}`);
            console.error("Dossier generation failed:", err);
        } finally {
            prepSubmitBtn.disabled = false;
        }
    });

    function extractAnswersFromQuestionnaireHTML(htmlString) {
        const temp = document.createElement('div');
        temp.innerHTML = htmlString;
        const paragraphs = temp.querySelectorAll('p');
        const extractedAnswers = [];
        
        paragraphs.forEach((p, idx) => {
            let plainText = p.innerText.trim();
            // Remove question number prefix if any (e.g., "1. ", "10. ")
            let cleanText = plainText.replace(/^\d+[\.\s\-]+/, '').trim();
            
            // Find corresponding question in currentQuestions
            const qText = currentQuestions[idx] ? currentQuestions[idx].q : "";
            if (qText) {
                let cleanQText = qText.replace(/^\d+[\.\s\-]+/, '').trim();
                
                // Check if paragraph starts with the question text
                if (cleanText.toLowerCase().startsWith(cleanQText.toLowerCase())) {
                    let ans = cleanText.substring(cleanQText.length).trim();
                    // Strip leading colon/spaces/dashes
                    ans = ans.replace(/^[:\-\s\u2014]+/, '').trim();
                    extractedAnswers.push(ans);
                    return;
                }
            }
            
            // Fallback 1: split by the first colon
            const colonIdx = cleanText.indexOf(':');
            if (colonIdx !== -1) {
                let ans = cleanText.substring(colonIdx + 1).trim();
                extractedAnswers.push(ans);
                return;
            }
            
            // Fallback 2: split by question mark if there is one
            const qMarkIdx = cleanText.indexOf('?');
            if (qMarkIdx !== -1) {
                let ans = cleanText.substring(qMarkIdx + 1).trim();
                ans = ans.replace(/^[:\-\s\u2014]+/, '').trim();
                extractedAnswers.push(ans);
                return;
            }
            
            // Fallback 3: keep the text as is
            extractedAnswers.push(cleanText);
        });
        
        return extractedAnswers;
    }

    synthForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const variant = synthVariantSelect.value;
        const transcript = synthTranscriptText.value.trim();
        const screencastUrl = synthScreencast.value.trim();

        if (!transcript) {
            showToast("Please enter or load a call transcript.");
            return;
        }

        synthSubmitBtn.disabled = true;
        showLoading("Synthesizing call and compiling 6 deliverables...");

        try {
            const apiConfig = getApiConfig();
            const customQuestions = currentQuestions.map(q => ({ q: q.q, a: q.a || "" }));
            const docs = await TinyAI.synthesizeCallTranscript(variant, transcript, screencastUrl, apiConfig, customQuestions);
            
            // Validate output
            if (!docs.summary && !docs.proposal) {
                throw new Error("API returned empty reports. Ensure your key is valid and prompt is running correctly.");
            }
            
            // Extract answers and update currentQuestions before history save so payload has them
            if (docs && docs.questionnaire) {
                const extractedAnswers = extractAnswersFromQuestionnaireHTML(docs.questionnaire);
                currentQuestions.forEach((q, idx) => {
                    if (extractedAnswers[idx] !== undefined) {
                        q.a = extractedAnswers[idx];
                    }
                });
                renderBattlecards();
                // Automatically switch to Review & Edit Mode since call is completed
                setQuestionnaireMode('review');
            }

            const updatedCustomQuestions = currentQuestions.map(q => ({ q: q.q, a: q.a || "" }));
            const scoreVal = extractScoreFromHTML(docs.summary);
            const payload = {
                type: 'synthesis',
                name: prepNameInput.value.trim() || 'Unknown Name',
                company: prepCompanyInput.value.trim() || 'Unknown Company',
                variant: variant,
                screencast: screencastUrl,
                transcript: transcript,
                customQuestions: updatedCustomQuestions,
                score: scoreVal,
                rep: document.getElementById('prep-rep')?.value || 'Albert',
                content: docs // object containing 7 documents
            };
            fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => res.json())
              .then(data => console.log("Saved synthesis to server history:", data.id))
              .catch(err => console.warn("Failed to auto-save synthesis to history:", err));

            // Format markdown bold in all parsed documents
            for (const key in docs) {
                docs[key] = formatMarkdown(docs[key]);
            }
            
            // Inject Call Transcript
            docs.transcript = `<pre style="white-space: pre-wrap; font-family: inherit; line-height: 1.5; color: #000000; font-size: 0.85rem; background: rgba(0,0,0,0.02); padding: 1rem; border: 1px solid rgba(0,0,0,0.06); border-radius: 6px;">${escapeHTML(transcript)}</pre>`;

            currentDocs = docs;
            activeDocTab = 'summary'; // default tab to show
            showResults(null, true);
            
            // Navigate back to Step 2 so SDR can review and refine mapped answers
            goToStep(2);
        } catch (err) {
            resetOutput();
            showToast(`Error: ${err.message}`);
            console.error("Transcript synthesis failed:", err);
        } finally {
            synthSubmitBtn.disabled = false;
        }
    });

    // --- Document Tab Navigation ---
    window.setDocTab = (tabName) => {
        if (!currentDocs) return;
        activeDocTab = tabName;
        
        // Update tab styling
        const buttons = outputDocNav.querySelectorAll('.doc-tab-btn');
        buttons.forEach(btn => {
            if (btn.getAttribute('data-doc') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        renderActiveDocument();
    };

    function renderActiveDocument() {
        if (!currentDocs) return;
        let content = currentDocs[activeDocTab] || "<p>This section was not generated or contains empty results.</p>";
        
        // Formatting specific modifications for better look
        if (activeDocTab === 'summary') {
            // Apply custom badges for HOT/WARM/COLD qualification
            content = content.replace(/(QUALIFICATION SCORE:\s*)(HOT)/i, '$1<span class="badge-score hot">$2</span>');
            content = content.replace(/(QUALIFICATION SCORE:\s*)(WARM)/i, '$1<span class="badge-score warm">$2</span>');
            content = content.replace(/(QUALIFICATION SCORE:\s*)(COLD)/i, '$1<span class="badge-score cold">$2</span>');
        }

        let titleText = "";
        switch(activeDocTab) {
            case 'questionnaire': titleText = "1. Mapped Questionnaire"; break;
            case 'summary': titleText = "2. Qualification & Next Steps"; break;
            case 'recapEmail': titleText = "3. Client Recap Email"; break;
            case 'summarySheet': titleText = "4. Summary Sheet"; break;
            case 'detailedNotes': titleText = "5. Detailed Meeting Notes"; break;
            case 'proposal': titleText = "6. Consultative Proposal"; break;
            case 'actionItems': titleText = "7. Action Items"; break;
            case 'transcript': titleText = "8. Raw Call Transcript"; break;
        }

        const sanitizedContent = window.DOMPurify ? DOMPurify.sanitize(content) : fallbackSanitize(content);

        outputDocContent.innerHTML = `
            <div class="output-document">
                <h3>${titleText}</h3>
                <div class="doc-body-pane">${sanitizedContent}</div>
            </div>
        `;
    }

    // --- Action Button Handlers ---
    copyContentBtn.addEventListener('click', () => {
        let textToCopy = "";
        if (currentDocs) {
            // If in Tab 2, copy active document text (strip HTML tags for clipboard)
            const activeHtml = currentDocs[activeDocTab];
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = activeHtml;
            textToCopy = tempDiv.innerText || tempDiv.textContent;
        } else {
            // Copy dossier HTML text parsed as text
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = outputDocContent.innerHTML;
            textToCopy = tempDiv.innerText || tempDiv.textContent;
        }

        if (!textToCopy || textToCopy.trim() === "Loading description...") {
            showToast("No content to copy.");
            return;
        }

        navigator.clipboard.writeText(textToCopy.trim())
            .then(() => showToast("Copied to clipboard!"))
            .catch(err => {
                console.error("Failed to copy:", err);
                showToast("Failed to copy. Please manually select and copy.");
            });
    });

    downloadContentBtn.addEventListener('click', () => {
        let content = "";
        let filename = "tiny-ai-report.html";

        if (currentDocs) {
            filename = `tiny-handoff-report-${prepCompanyInput.value || "prospect"}.html`;
            content = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Tiny Sales Handover Report - ${prepCompanyInput.value || "Prospect"}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap">
    <style>
        body { font-family: 'Roboto', sans-serif; padding: 40px; background: #000000; color: #ffffff; max-width: 800px; margin: 0 auto; line-height: 1.75; font-size: 0.95rem; }
        h1 { border-bottom: 2px solid #4daeeb; padding-bottom: 10px; font-size: 28px; color: #4daeeb; margin-bottom: 30px; }
        h2 { border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 5px; color: #4daeeb; margin-top: 40px; margin-bottom: 20px; }
        h3 { color: #4daeeb; font-size: 1.25rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 0.5rem; }
        h4 { color: #4daeeb; font-size: 1.05rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
        pre { background: rgba(255, 255, 255, 0.03); padding: 15px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); overflow-x: auto; white-space: pre-wrap; font-family: 'Roboto', sans-serif; color: #ffffff; line-height: 1.6; margin: 15px 0; }
        blockquote { border-left: 3px solid #4daeeb; padding-left: 15px; margin-left: 10px; margin-bottom: 20px; font-style: italic; color: rgba(255, 255, 255, 0.9); }
        ul, ol { margin-left: 25px; margin-bottom: 20px; }
        li { margin-bottom: 10px; }
        p { margin-bottom: 15px; }
        strong { color: #ffffff; font-weight: 700; }
        .badge-score { padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
        .badge-score.hot { background: #4daeeb; border: 1px solid #4daeeb; color: #000000; }
        .badge-score.warm { background: transparent; border: 1px solid #ffffff; color: #ffffff; }
        .badge-score.cold { background: transparent; border: 1px solid rgba(255, 255, 255, 0.35); color: rgba(255, 255, 255, 0.35); }
    </style>
</head>
<body>
    <h1>Tiny AI Sales Handover compilation</h1>
    <h2>1. Mapped Questionnaire</h2>
    <div>${currentDocs.questionnaire}</div>
    <h2>2. Qualification & Next Steps</h2>
    <div>${currentDocs.summary}</div>
    <h2>3. Client Recap Email</h2>
    <div>${currentDocs.recapEmail}</div>
    <h2>4. Summary Sheet</h2>
    <div>${currentDocs.summarySheet}</div>
    <h2>5. Detailed Meeting Notes</h2>
    <div>${currentDocs.detailedNotes}</div>
    <h2>6. Consultative Proposal</h2>
    <div>${currentDocs.proposal}</div>
    <h2>7. Action Items</h2>
    <div>${currentDocs.actionItems}</div>
</body>
</html>`;
        } else {
            filename = `tiny-briefing-dossier-${prepCompanyInput.value || "prospect"}.html`;
            content = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Tiny Prospect Briefing Dossier</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap">
    <style>
        body { font-family: 'Roboto', sans-serif; padding: 40px; background: #000000; color: #ffffff; max-width: 800px; margin: 0 auto; line-height: 1.75; font-size: 0.95rem; }
        h3 { border-bottom: 2px solid #4daeeb; padding-bottom: 10px; font-size: 24px; color: #4daeeb; margin-bottom: 25px; }
        h4 { color: #4daeeb; font-size: 1.05rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
        ol, ul { margin-left: 25px; margin-bottom: 20px; }
        li { margin-bottom: 15px; }
        p { margin-bottom: 15px; }
        strong { color: #ffffff; font-weight: 700; }
        blockquote { border-left: 3px solid #4daeeb; padding-left: 15px; margin-left: 10px; margin-bottom: 20px; font-style: italic; color: rgba(255, 255, 255, 0.9); }
    </style>
</head>
<body>
    ${outputDocContent.innerHTML}
</body>
</html>`;
        }

        const blob = new Blob([content], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Downloaded report!");
    });

    // --- SDR Battlecards Reference Datasets ---
    const BATTLECARDS = {
        A: [
            {
                q: "What general ledger/ERP system (e.g., SAP, MS Business Central, Sun Systems, NetSuite) are you using, and does it currently integrate with your planning tool?",
                tip: "Identify the GL source system to understand connection options."
            },
            {
                q: "How many separate Excel spreadsheets are you manually consolidating for your budgeting and forecasting, and are there issues with version control?",
                tip: "Highlight version control errors and manual consolidation labor."
            },
            {
                q: "What specific planning workflows (e.g., actuals, payroll allocations, cost analysis, budgeting, forecasting) are you executing, and are allocations (like payroll across business units) inconsistent or time-consuming?",
                tip: "Inconsistent payroll/BU allocations are prime candidates for database logic."
            },
            {
                q: "What reporting tools (e.g., Power BI, Qlik, Tableau, Excel PAX/PAW) do you use for management reporting, and do you manually export CSV files to reconcile data?",
                tip: "Reconciling CSV manual exports indicates a need for DataFusion."
            },
            {
                q: "Do users need to drill down from high-level reports to transaction-level GL data, and do you perform multi-currency transactions at the transaction level?",
                tip: "Multi-currency transactions at transaction level require cube rules."
            },
            {
                q: "Do you have internal developers/admins to manage these systems, or is there a key-person risk if someone leaves?",
                tip: "Position Octane's managed DevOps support as key-person risk insurance."
            },
            {
                q: "How many planning contributors, read-only users, and administrators are involved, and would they need formal end-user or developer training?",
                tip: "Factor in training licensing and developer/end-user seat requirements."
            },
            {
                q: "What repetitive financial tasks (e.g., monthly slides or reports) feel most manual, and would conversational AI access to financial queries benefit your executives?",
                tip: "Introduce AskFinance for conversational executive queries."
            },
            {
                q: "What is your target timeline for going live, and do you need a parallel run (e.g., completing by a specific month like June)?",
                tip: "Check if they require parallel runs to complete by June end."
            },
            {
                q: "Is there a budget allocated for licensing and delivery, and what is your internal approval/purchase order process?",
                tip: "Qualify sign-off thresholds and PO approval processes."
            },
            {
                q: "Have you evaluated other tools (e.g. Workday, Anaplan, TM1), and who else is involved in the final decision?",
                tip: "Probe if they are evaluating Anaplan, Workday, or competing partners."
            },
            {
                q: "What does success look like, and would a 60-day trial of connectors (like DataFusion) or a free Proof of Concept (POC) help validate the solution?",
                tip: "Pitch a 60-day trial of DataFusion connectors or free POC."
            }
        ],
        B: [
            {
                q: "What version of TM1/Planning Analytics are you running, and is it deployed on-premise or in the IBM Cloud?",
                tip: "Old versions indicate an upgrade project opportunity."
            },
            {
                q: "How many TM1 instances do you run (e.g., production-only, or separate dev and test environments)?",
                tip: "Dev/Test/Prod environment isolation shows organizational maturity."
            },
            {
                q: "How many models, cubes, dimensions, and user groups are you currently running?",
                tip: "Cube count and dimensions determine model complexity."
            },
            {
                q: "Have you checked your system's performance, RAM usage, hard disk space, or feeder memory usage? Are they approaching high limits?",
                tip: "Feeder memory leaks cause crashes; prompt for Flight Check."
            },
            {
                q: "Are log files being automatically cleared, and what is the typical size of your TM1 log files (e.g., is it under or over the 50MB standard)?",
                tip: "Log files over 50MB indicate poor configuration or runaway processes."
            },
            {
                q: "What are the typical report load times for your end-users, and are they above the 5-second threshold (e.g. 15-25 seconds)?",
                tip: "Load times >5 seconds point to bad rules, feeders, or MDX views."
            },
            {
                q: "Do you have dedicated in-house TM1 administrators/developers, or are you dependent on key individuals?",
                tip: "Managed support helps bridge internal admin staffing resource gaps."
            },
            {
                q: "Are you currently working with another TM1 vendor? Are you locked into a rigid contract with separate rates for support and development?",
                tip: "Octane does not distinguish support vs dev rates; explain rollover hours."
            },
            {
                q: "What is your current backlog of enhancements, bugs, or data reconciliation tasks, and how is it prioritized?",
                tip: "A large backlog warrants a block of DevOps hours to clear."
            },
            {
                q: "Have your TM1 developers and power users had formal training, and would they benefit from free access to professional training courses?",
                tip: "Pitch free library access as a sweetener for support contracts."
            },
            {
                q: "Are you using Power BI, Tableau, or Qlik, and do you have a direct database connection or are you manually handling CSVs?",
                tip: "Offer direct REST API connectors to replace CSV dumps."
            },
            {
                q: "Who has final authority to approve support changes, and what is the timeline to transition support (e.g. target date like October 31)?",
                tip: "Standardize on an October 31 support transition date."
            }
        ],
        C: [
            {
                q: "How many slides are in your monthly executive financial reports, and how much time does the finance team spend manually extracting, cleansing, and formatting data for them?",
                tip: "Quantify hours spent on monthly PowerPoint slide decks."
            },
            {
                q: "What enterprise systems and data sources (e.g., TM1, Adobe Analytics, Google Ad Manager, Adobe AdSlot, BigQuery, SQL) need to connect for automated reporting?",
                tip: "Probe for Adobe AdSlot, Google Ad Manager, BigQuery integrations."
            },
            {
                q: "Would executives and managers benefit from asking natural language questions (e.g. \"AskFinance\") to query financial data in real time?",
                tip: "Pitch real-time NLP querying to replace static dashboard sheets."
            },
            {
                q: "What other areas in the business (e.g. Sales, Editorial, HR, Customer Support, IT, Procurement, Legal) have repetitive workflows ripe for automation?",
                tip: "Look for cross-departmental opportunities (Legal, Editorial, HR)."
            },
            {
                q: "Have you experimented with or deployed any generative AI or automation tools internally?",
                tip: "Understand current internal AI experiments or policies."
            },
            {
                q: "What is your primary cloud environment (e.g. GCP, AWS, Azure, on-premise) and how do you manage data security?",
                tip: "Align with their primary cloud preference (GCP, AWS, Azure)."
            },
            {
                q: "Do you require specific role-based access controls and security protocols for financial data queried by AI?",
                tip: "Highlight watsonx role-based access control (RBAC) security."
            },
            {
                q: "Would you be open to a 2-to-6 week co-creation Proof of Concept (POC) to demonstrate value before full production rollout?",
                tip: "Co-creation POC generates a custom demo with client data in weeks."
            },
            {
                q: "Can you commit a primary business contact and technical resource to collaborate during a 2-to-6 week POC?",
                tip: "Validate that both business and IT sponsors are available to support."
            },
            {
                q: "Are you willing to commit to a Decision Workshop within 10 days of POC completion to confirm next steps?",
                tip: "Lock in the Decision Workshop within 10 days post-POC."
            },
            {
                q: "Are you aware of the indicative costs for enterprise generative AI licensing ($160k+/yr) and implementation services ($125k+)?",
                tip: "Pre-qualify budget: $160k+/yr licensing, $125k+ delivery services."
            },
            {
                q: "What is your timeline for starting an AI pilot, and who are the key executive stakeholders involved?",
                tip: "Verify timeline and locate the ultimate executive sponsor."
            }
        ]
    };

    // Render Battlecard Body
    function renderBattlecards() {
        const variant = battlecardSelector.value;
        
        battlecardBody.innerHTML = "";
        
        currentQuestions.forEach((item, index) => {
            const num = index + 1;
            const section = document.createElement('div');
            section.className = "battlecard-section";
            section.style.marginBottom = "0.85rem";
            
            // Determine if reset button should be displayed
            const defaultText = BATTLECARDS[variant][index] ? BATTLECARDS[variant][index].q : null;
            const hasChanged = defaultText !== null && item.q !== defaultText;
            const resetDisplay = hasChanged ? 'inline-flex' : 'none';

            section.innerHTML = `
                <div class="battlecard-section-title">Question ${num}</div>
                <div class="battlecard-item">
                    <div class="battlecard-q" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                        <div contenteditable="false" class="battlecard-q-text" data-index="${index}" style="color: #000000 !important; font-size: 0.85rem !important; line-height: 1.4 !important; font-weight: 500; outline: none; border-bottom: 1px dashed transparent; width: 100%; padding-bottom: 2px; flex: 1;">${escapeHTML(item.q)}</div>
                        <div style="display: flex; gap: 0.5rem; flex-shrink: 0; align-items: center;">
                            <button class="battlecard-edit-btn" data-index="${index}" style="font-size: 0.75rem; text-decoration: underline; color: var(--primary); background: transparent; border: none; cursor: pointer; padding: 0;">✏️ Edit</button>
                            <button class="battlecard-copy-btn" style="font-size: 0.75rem; text-decoration: underline; color: var(--primary); background: transparent; border: none; cursor: pointer; padding: 0;">📋 Copy</button>
                            <button class="battlecard-reset-btn" data-index="${index}" style="font-size: 0.75rem; text-decoration: underline; color: rgba(0,0,0,0.4); background: transparent; border: none; cursor: pointer; padding: 0; display: ${resetDisplay};">⟲ Reset</button>
                            <button class="battlecard-remove-btn" data-index="${index}" style="font-size: 0.75rem; text-decoration: underline; color: #ff4d4d; background: transparent; border: none; cursor: pointer; padding: 0;">❌ Remove</button>
                        </div>
                    </div>
                    <div class="battlecard-answer-wrapper" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                        <label style="font-size: 0.7rem; font-weight: 600; color: rgba(0,0,0,0.4); text-transform: uppercase;">Answer / Notes</label>
                        <textarea class="form-input textarea-input battlecard-a-text" data-index="${index}" placeholder="Type prospect answer or notes here..." style="min-height: 60px; font-size: 0.8rem; padding: 0.35rem 0.5rem; border: 1px solid rgba(0,0,0,0.15); border-radius: 4px; background: #ffffff; color: #000000; width: 100%; resize: vertical; box-sizing: border-box;"></textarea>
                    </div>
                </div>
            `;
            
            battlecardBody.appendChild(section);
        });

        // Add copy button listeners
        const copyBtns = battlecardBody.querySelectorAll('.battlecard-copy-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const qTextEl = btn.closest('.battlecard-item').querySelector('.battlecard-q-text');
                const text = qTextEl ? qTextEl.innerText.trim() : "";
                
                navigator.clipboard.writeText(text)
                    .then(() => {
                        const originalText = btn.innerText;
                        btn.innerText = "✓ Copied";
                        btn.style.color = "#4daeeb";
                        showToast("Question copied to clipboard!");
                        setTimeout(() => {
                            btn.innerText = originalText;
                            btn.style.color = "";
                        }, 2000);
                    })
                    .catch(err => {
                        console.error("Failed to copy battlecard question:", err);
                        showToast("Failed to copy question.");
                    });
            });
        });

        // Helper to save question text
        function saveQuestionText(qText, btn, idx) {
            qText.setAttribute('contenteditable', 'false');
            qText.style.borderBottomColor = 'transparent';
            btn.innerText = "✏️ Edit";
            
            const newText = qText.innerText.trim();
            currentQuestions[idx].q = newText;
            
            // Show/hide reset button
            const resetBtn = qText.closest('.battlecard-item').querySelector('.battlecard-reset-btn');
            const defaultText = BATTLECARDS[variant][idx] ? BATTLECARDS[variant][idx].q : null;
            if (defaultText !== null && newText !== defaultText) {
                resetBtn.style.display = 'inline-flex';
            } else {
                resetBtn.style.display = 'none';
            }
        }

        // Add edit button listeners
        const editBtns = battlecardBody.querySelectorAll('.battlecard-edit-btn');
        editBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'));
                const qText = btn.closest('.battlecard-item').querySelector('.battlecard-q-text');
                if (qText) {
                    const isEditing = qText.getAttribute('contenteditable') === 'true';
                    if (isEditing) {
                        saveQuestionText(qText, btn, idx);
                        showToast("Question saved.");
                    } else {
                        qText.setAttribute('contenteditable', 'true');
                        qText.style.borderBottomColor = 'var(--primary)';
                        qText.focus();
                        btn.innerText = "💾 Save";
                        showToast("Editing question...");
                    }
                }
            });
        });

        // Add inline change event listeners to save editable text on blur
        const qTextElements = battlecardBody.querySelectorAll('.battlecard-q-text');
        qTextElements.forEach(qText => {
            const idx = parseInt(qText.getAttribute('data-index'));
            
            qText.addEventListener('blur', () => {
                const btn = qText.closest('.battlecard-item').querySelector('.battlecard-edit-btn');
                saveQuestionText(qText, btn, idx);
            });
            
            qText.style.transition = "border-bottom-color 0.2s ease";
            qText.addEventListener('focus', () => {
                qText.style.borderBottomColor = 'var(--primary)';
            });
        });

        // Add answer change listeners
        const aTextElements = battlecardBody.querySelectorAll('.battlecard-a-text');
        aTextElements.forEach(aText => {
            const idx = parseInt(aText.getAttribute('data-index'));
            aText.value = currentQuestions[idx].a || "";
            
            aText.addEventListener('input', () => {
                currentQuestions[idx].a = aText.value;
            });
        });

        // Add reset button listeners
        const resetBtns = battlecardBody.querySelectorAll('.battlecard-reset-btn');
        resetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                const defaultText = BATTLECARDS[variant][idx] ? BATTLECARDS[variant][idx].q : null;
                if (defaultText !== null) {
                    currentQuestions[idx].q = defaultText;
                    
                    const qText = btn.closest('.battlecard-item').querySelector('.battlecard-q-text');
                    if (qText) {
                        qText.innerText = defaultText;
                    }
                    btn.style.display = 'none';
                    showToast(`Question ${idx + 1} reset to default.`);
                }
            });
        });

        // Add remove button listeners
        const removeBtns = battlecardBody.querySelectorAll('.battlecard-remove-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                currentQuestions.splice(idx, 1);
                renderBattlecards();
                showToast("Question removed.");
            });
        });
    }

    // Bind battlecard selector change event
    battlecardSelector.addEventListener('change', async () => {
        const variant = battlecardSelector.value;
        await loadCustomQuestions(variant);
        renderBattlecards();
    });

    // Initialize battlecards by default
    renderBattlecards();

    // Bind add question button
    const battlecardAddBtn = document.getElementById('battlecard-add-btn');
    if (battlecardAddBtn) {
        battlecardAddBtn.addEventListener('click', () => {
            currentQuestions.push({
                q: "New custom question...",
                tip: "Custom question added by representative."
            });
            renderBattlecards();
            showToast("New question added. Click to edit.");
            
            // Scroll to bottom
            setTimeout(() => {
                battlecardBody.scrollTop = battlecardBody.scrollHeight;
            }, 50);
        });
    }

    // --- LinkedIn Drag and Drop Listeners ---
    linkedinDropZone.addEventListener('click', (e) => {
        if (e.target !== linkedinFileInput) {
            linkedinFileInput.click();
        }
    });

    linkedinFileInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    linkedinFileInput.addEventListener('change', () => {
        if (linkedinFileInput.files.length > 0) {
            handleLinkedinFile(linkedinFileInput.files[0]);
        }
    });

    linkedinDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        linkedinDropZone.classList.add('dragover');
    });

    linkedinDropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        linkedinDropZone.classList.add('dragover');
    });

    linkedinDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        linkedinDropZone.classList.remove('dragover');
    });

    linkedinDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        linkedinDropZone.classList.remove('dragover');
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleLinkedinFile(e.dataTransfer.files[0]);
        }
    });

    function handleLinkedinFile(file) {
        // File size limit (2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast("File size exceeds 2MB limit.");
            return;
        }

        const ext = file.name.split('.').pop().toLowerCase();
        
        if (ext === 'txt') {
            const reader = new FileReader();
            reader.onload = (event) => {
                prepLinkedinText.value = event.target.result;
                if (linkedinDropText) {
                    linkedinDropText.innerHTML = `📄 Attached: <strong>${escapeHTML(file.name)}</strong> (Click to change)`;
                }
                showToast(`Loaded ${file.name} successfully!`);
            };
            reader.onerror = () => {
                showToast("Error reading file.");
            };
            reader.readAsText(file);
        } else if (ext === 'pdf' || ext === 'docx') {
            // Simulate extraction progress
            if (linkedinDropText) {
                linkedinDropText.innerHTML = `⏳ Extracting text from ${escapeHTML(file.name)}...`;
            }
            linkedinDropZone.style.pointerEvents = 'none';
            
            setTimeout(() => {
                prepLinkedinText.value = `Experience:\n- Head of FP&A at Meridian Logistics (3 years - Present)\n` +
                    `  * Leading financial planning, forecasting, and consolidation processes\n` +
                    `  * Managing a team of 4 financial analysts\n` +
                    `- Senior Financial Analyst at Linfox Logistics (4 years)\n` +
                    `Education:\n` +
                    `- Master of Applied Finance, University of Melbourne`;
                
                if (linkedinDropText) {
                    linkedinDropText.innerHTML = `📄 Attached: <strong>${escapeHTML(file.name)}</strong> (Click to change)`;
                }
                linkedinDropZone.style.pointerEvents = '';
                showToast(`Successfully extracted profile details from ${file.name}!`);
            }, 1000);
        } else {
            showToast("Unsupported file type. Please upload a .txt, .pdf, or .docx file.");
        }
    }

    // Call Directory event listeners
    const directorySearch = document.getElementById('directory-search');
    const directoryFilterRep = document.getElementById('directory-filter-rep');
    const directoryFilterScore = document.getElementById('directory-filter-score');
    const directoryRefreshBtn = document.getElementById('directory-refresh-btn');

    if (directorySearch) {
        directorySearch.addEventListener('input', renderDirectoryList);
    }
    if (directoryFilterRep) {
        directoryFilterRep.addEventListener('change', renderDirectoryList);
    }
    if (directoryFilterScore) {
        directoryFilterScore.addEventListener('change', renderDirectoryList);
    }
    if (directoryRefreshBtn) {
        directoryRefreshBtn.addEventListener('click', loadDirectoryList);
    }

    // Run sync initially after all functions and datasets are defined
    syncServiceTrackToVariant();

});
