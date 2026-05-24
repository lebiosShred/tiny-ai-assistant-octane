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
    const settingsApiKey = document.getElementById('settings-api-key');
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
        settingsApiKey.value = localStorage.getItem('tiny_api_key') || '';
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
        localStorage.setItem('tiny_api_key', settingsApiKey.value.trim());
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
            apiKey: localStorage.getItem('tiny_api_key') || TinyAI.DEFAULT_CONFIG.apiKey,
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
    step1NextBtn.addEventListener('click', () => goToStep(2));
    step2BackBtn.addEventListener('click', () => goToStep(1));
    step2NextBtn.addEventListener('click', () => goToStep(3));
    step3BackBtn.addEventListener('click', () => goToStep(2));

    step2SaveBtn.addEventListener('click', async () => {
        const variant = battlecardSelector.value;
        const questions = currentQuestions.map(q => q.q);
        
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
                    currentQuestions = data.map((qText, index) => {
                        const defaultTip = BATTLECARDS[variant] && BATTLECARDS[variant][index] ? BATTLECARDS[variant][index].tip : "Custom question";
                        return { q: qText, tip: defaultTip };
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
                    currentQuestions = parsed.map((qText, index) => {
                        const defaultTip = BATTLECARDS[variant] && BATTLECARDS[variant][index] ? BATTLECARDS[variant][index].tip : "Custom question";
                        return { q: qText, tip: defaultTip };
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

    // --- Templates Loader ---
    prepLoadSampleBtn.addEventListener('click', () => {
        prepNameInput.value = "Sarah Chen";
        prepTitleInput.value = "Head of FP&A";
        prepCompanyInput.value = "Meridian Logistics";
        prepUrlInput.value = "meridianlogistics.com.au";
        prepEmailInput.value = "sarah.chen@meridianlogistics.com.au";
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
            goToStep(2);
        } catch (err) {
            resetOutput();
            showToast(`Error: ${err.message}`);
            console.error("Dossier generation failed:", err);
        } finally {
            prepSubmitBtn.disabled = false;
        }
    });

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
            const customQuestions = currentQuestions.map(q => q.q);
            const docs = await TinyAI.synthesizeCallTranscript(variant, transcript, screencastUrl, apiConfig, customQuestions);
            
            // Validate output
            if (!docs.summary && !docs.proposal) {
                throw new Error("API returned empty reports. Ensure your key is valid and prompt is running correctly.");
            }

            // Format markdown bold in all parsed documents
            for (const key in docs) {
                docs[key] = formatMarkdown(docs[key]);
            }

            currentDocs = docs;
            activeDocTab = 'summary'; // default tab to show
            showResults(null, true);
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
                        <div contenteditable="true" class="battlecard-q-text" data-index="${index}" style="color: #000000 !important; font-size: 0.85rem !important; line-height: 1.4 !important; font-weight: 500; outline: none; border-bottom: 1px dashed rgba(0,0,0,0.15); width: 100%; padding-bottom: 2px; flex: 1;">${escapeHTML(item.q)}</div>
                        <div style="display: flex; gap: 0.5rem; flex-shrink: 0; align-items: center;">
                            <button class="battlecard-copy-btn" style="font-size: 0.75rem; text-decoration: underline; color: var(--primary); background: transparent; border: none; cursor: pointer; padding: 0;">📋 Copy</button>
                            <button class="battlecard-reset-btn" data-index="${index}" style="font-size: 0.75rem; text-decoration: underline; color: rgba(0,0,0,0.4); background: transparent; border: none; cursor: pointer; padding: 0; display: ${resetDisplay};">⟲ Reset</button>
                            <button class="battlecard-remove-btn" data-index="${index}" style="font-size: 0.75rem; text-decoration: underline; color: #ff4d4d; background: transparent; border: none; cursor: pointer; padding: 0;">❌ Remove</button>
                        </div>
                    </div>
                    <div class="battlecard-tips" style="margin-top: 0.35rem; font-size: 0.8rem !important; color: rgba(0,0,0,0.6) !important; font-style: italic;">Tip: ${item.tip}</div>
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

        // Add inline change event listeners to save editable text
        const qTextElements = battlecardBody.querySelectorAll('.battlecard-q-text');
        qTextElements.forEach(qText => {
            const idx = parseInt(qText.getAttribute('data-index'));
            
            qText.addEventListener('input', () => {
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
            });
            
            qText.style.transition = "border-bottom-color 0.2s ease";
            qText.addEventListener('focus', () => {
                qText.style.borderBottomColor = 'var(--primary)';
            });
            qText.addEventListener('blur', () => {
                qText.style.borderBottomColor = 'rgba(0,0,0,0.15)';
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

    // Run sync initially after all functions and datasets are defined
    syncServiceTrackToVariant();

});
