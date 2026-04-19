document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const codeInput = document.getElementById('codeInput');
    const outputSection = document.getElementById('outputSection');
    const outputContent = document.getElementById('outputContent');
    const spinner = document.getElementById('spinner');

    const outputLanguageSelect = document.getElementById('outputLanguageSelect');
    const analysisMode = document.getElementById('analysisMode');
    const fileUpload = document.getElementById('fileUpload');
    const chooseFileBtn = document.getElementById('chooseFileBtn');
    const dropZone = document.getElementById('dropZone');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    // Summary and stats elements
    const statTotalLines = document.getElementById('statTotalLines');
    const statFunctions = document.getElementById('statFunctions');
    const statClasses = document.getElementById('statClasses');
    const statComments = document.getElementById('statComments'); // Mapped to Code Lines
    const statTime = document.getElementById('statTime');
    const statSpace = document.getElementById('statSpace');

    const summaryFile = document.getElementById('summaryFile');
    const summaryLanguage = document.getElementById('summaryLanguage');

    // New feature elements
    const downloadBtn = document.getElementById('downloadBtn');
    const historySelect = document.getElementById('historySelect');
    const viewDiffBtn = document.getElementById('viewDiffBtn');
    const diffContent = document.getElementById('diffContent');

    let currentFileName = "None (Pasted Code)";

    // --- History Feature ---
    const loadHistory = () => {
        const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        if (history.length > 0) {
            historySelect.classList.remove('hidden');
            historySelect.innerHTML = '<option value=""> History </option>';
            history.forEach((h, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                // Only take the first 15 chars of filename to keep it tidy
                let name = h.filename.length > 15 ? h.filename.substring(0, 15) + '...' : h.filename;
                opt.textContent = `${name} (${new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
                historySelect.appendChild(opt);
            });
            historySelect.value = "";
        }
    };
    loadHistory();

    historySelect.addEventListener('change', () => {
        const idx = historySelect.value;
        if (idx === "") return;
        const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        const data = history[idx];
        if (data) {
            codeInput.value = data.code;
            currentFileName = data.filename;

            // Restore Output
            outputContent.innerHTML = marked.parse(data.explanation);
            outputSection.classList.remove('hidden');

            // Restore Stats
            if (data.stats) {
                statTotalLines.textContent = data.stats.total_lines || '-';
                statFunctions.textContent = data.stats.functions > 0 ? data.stats.functions : '0';
                statClasses.textContent = data.stats.classes > 0 ? data.stats.classes : '0';
                statComments.textContent = data.stats.code_lines || '-';
            }
            statTime.textContent = data.time_complexity || 'O(?)';
            statSpace.textContent = data.space_complexity || 'O(?)';

            summaryFile.textContent = data.filename;
            summaryLanguage.textContent = data.language;
            if (data.analysis_mode) analysisMode.value = data.analysis_mode;

            // Handle Diff Viewer Restore
            if (data.refactored_code && data.refactored_code !== "Could not extract refactoring." && data.refactored_code !== "None") {
                viewDiffBtn.classList.remove('hidden');
                window.lastOriginalCode = data.code;
                window.lastRefactoredCode = data.refactored_code;
            } else {
                viewDiffBtn.classList.add('hidden');
            }

            // Ensure we show markdown cleanly on load
            diffContent.classList.add('hidden');
            viewDiffBtn.innerHTML = " View Diff";

        }
        // Reset dropdown to default visually
        historySelect.value = "";
    });

    // --- File Uploader ---
    chooseFileBtn.addEventListener('click', () => fileUpload.click());
    dropZone.addEventListener('click', (e) => {
        if (e.target !== chooseFileBtn && e.target !== fileNameDisplay) {
            fileUpload.click();
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary-color)';
        dropZone.style.backgroundColor = '#f1f5f9';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.backgroundColor = '#f8fafc';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.backgroundColor = '#f8fafc';

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileUpload.files = e.dataTransfer.files;
            handleFileSelect(fileUpload.files[0]);
        }
    });

    fileUpload.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            handleFileSelect(event.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (!file) return;

        currentFileName = file.name;
        fileNameDisplay.textContent = `Selected: ${file.name}`;
        fileNameDisplay.classList.remove('hidden');

        const reader = new FileReader();
        reader.onload = (e) => {
            codeInput.value = e.target.result;
        };
        reader.readAsText(file);
    }

    codeInput.addEventListener('input', () => {
        // If users manually paste overriding the file, update filename
        if (fileUpload.files.length === 0 || codeInput.value.length < 5) {
            currentFileName = "Pasted Code";
        }
    });

    outputLanguageSelect.addEventListener('change', () => {
        // Auto-reanalyze if we already have results visible
        if (codeInput.value.trim().length > 0 && !outputSection.classList.contains('hidden')) {
            analyzeBtn.click();
        }
    });

    // --- Main Analyze Action ---
    analyzeBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();

        if (!code) {
            alert("Please enter some code to analyze.");
            return;
        }

        // Set Loading State
        analyzeBtn.disabled = true;
        spinner.classList.remove('hidden');
        outputSection.classList.add('hidden');
        outputContent.innerHTML = '';

        // Reset stats to loading visual
        ['TotalLines', 'Functions', 'Classes', 'Comments'].forEach(id => {
            document.getElementById(`stat${id}`).innerHTML = '<span class="spinner" style="border-top-color: var(--primary-color); width: 15px; height: 15px;"></span>';
        });
        statTime.innerHTML = '<span class="spinner" style="border-top-color: var(--primary-color); width: 15px; height: 15px;"></span>';
        statSpace.innerHTML = '<span class="spinner" style="border-top-color: var(--primary-color); width: 15px; height: 15px;"></span>';

        // Update summary with known local details
        summaryFile.textContent = currentFileName;
        summaryLanguage.textContent = 'Detecting...';

        try {
            // Send request to updated API
            const response = await fetch('http://localhost:8000/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: code,
                    language: 'Auto-detect',
                    output_language: outputLanguageSelect.value,
                    analysis_mode: analysisMode.value
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `Server error: ${response.status}`);
            }

            const result = await response.json();

            // Render Markdown from the AI
            outputContent.innerHTML = marked.parse(result.analysis);
            outputSection.classList.remove('hidden');

            // Update stats grid
            if (result.statistics) {
                statTotalLines.textContent = result.statistics.total_lines;
                statFunctions.textContent = result.statistics.functions > 0 ? result.statistics.functions : '0';
                statClasses.textContent = result.statistics.classes > 0 ? result.statistics.classes : '0';
                statComments.textContent = result.statistics.code_lines; // Mapped Code Lines
            }

            if (result.time_complexity) statTime.textContent = result.time_complexity;
            if (result.space_complexity) statSpace.textContent = result.space_complexity;

            // Check if we have refactored code
            if (result.refactored_code && result.refactored_code !== "Could not extract refactoring.") {
                viewDiffBtn.classList.remove('hidden');
                window.lastOriginalCode = code;
                window.lastRefactoredCode = result.refactored_code;
            } else {
                viewDiffBtn.classList.add('hidden');
            }
            // Reset Diff View State
            diffContent.classList.add('hidden');
            if (viewDiffBtn) viewDiffBtn.innerHTML = " View Diff";

            // Update language correctly (so as not to be 'unknown')
            if (result.language) {
                summaryLanguage.textContent = result.language;
            }

            // Scroll to results on mobile/small screens if needed
            if (window.innerWidth < 800) {
                document.querySelector('.results-section').scrollIntoView({ behavior: 'smooth' });
            }

            // Save to LocalStorage History
            const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
            history.unshift({
                filename: currentFileName,
                language: result.language,
                code: code,
                explanation: result.analysis,
                stats: result.statistics || {},
                time_complexity: result.time_complexity || 'O(?)',
                space_complexity: result.space_complexity || 'O(?)',
                analysis_mode: analysisMode.value,
                refactored_code: result.refactored_code || "None",
                timestamp: new Date().toISOString()
            });
            // Keep only last 5 items
            if (history.length > 5) history.pop();
            localStorage.setItem('analysisHistory', JSON.stringify(history));
            loadHistory();

        } catch (error) {
            console.error("Analysis failed:", error);
            outputContent.innerHTML = `<p style="color: #dc2626;"><strong>Error:</strong> ${error.message}</p>`;
            outputSection.classList.remove('hidden');

            // Reset stats on error
            ['TotalLines', 'Functions', 'Classes', 'Comments'].forEach(id => {
                document.getElementById(`stat${id}`).textContent = '-';
            });
            statTime.textContent = "O(?)";
            statSpace.textContent = "O(?)";
            summaryLanguage.textContent = 'Error';
        } finally {
            // Reset Button State
            analyzeBtn.disabled = false;
            spinner.classList.add('hidden');
        }
    });

    // Handle Ctrl+Enter submission
    codeInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            analyzeBtn.click();
        }
    });

    // Handle Copy Button
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const content = outputContent.innerText;
            if (!content) return;
            try {
                await navigator.clipboard.writeText(content);
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = ' Copied!';
                setTimeout(() => copyBtn.innerHTML = originalText, 2000);
            } catch (err) {
                console.error("Failed to copy", err);
            }
        });
    }

    // Handle Download MD Button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            // Extract the raw text from history OR fallback to outputContent.innerText
            // For a faithful markdown, we can get it from history or rely on innerText.
            // A better way is pulling the exact markdown from the latest history item if available,
            // but grabbing outputContent.innerText is sufficient and handles dynamic translations.
            const content = outputContent.innerText;
            if (!content) return;

            const preamble = `# Code Commenter Agent Report\n**File:** ${currentFileName}\n**Language:** ${summaryLanguage.textContent}\n**Time Complexity:** ${statTime.textContent}\n**Space Complexity:** ${statSpace.textContent}\n\n## Detailed Explanation\n`;
            const fullContent = preamble + content;

            const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Analysis_${currentFileName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'code'}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // --- TTS Controls ---
    const ttsSpeakBtn = document.getElementById('ttsSpeakBtn');
    const ttsSpeedSelect = document.getElementById('ttsSpeedSelect');
    const ttsPauseBtn = document.getElementById('ttsPauseBtn');
    const ttsResumeBtn = document.getElementById('ttsResumeBtn');
    const ttsStopBtn = document.getElementById('ttsStopBtn');

    function ttsReset() {
        ttsSpeakBtn.classList.remove('hidden');
        ttsPauseBtn.classList.add('hidden');
        ttsResumeBtn.classList.add('hidden');
        ttsStopBtn.classList.add('hidden');
    }

    if (ttsSpeakBtn) {
        ttsSpeakBtn.addEventListener('click', () => {
            const text = outputContent.innerText;
            if (!text) return;
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = parseFloat(ttsSpeedSelect ? ttsSpeedSelect.value : '1');
            utterance.onend = ttsReset;
            utterance.onerror = ttsReset;
            window.speechSynthesis.speak(utterance);
            ttsSpeakBtn.classList.add('hidden');
            ttsPauseBtn.classList.remove('hidden');
            ttsStopBtn.classList.remove('hidden');
        });
    }

    if (ttsPauseBtn) {
        ttsPauseBtn.addEventListener('click', () => {
            window.speechSynthesis.pause();
            ttsPauseBtn.classList.add('hidden');
            ttsResumeBtn.classList.remove('hidden');
        });
    }

    if (ttsResumeBtn) {
        ttsResumeBtn.addEventListener('click', () => {
            window.speechSynthesis.resume();
            ttsResumeBtn.classList.add('hidden');
            ttsPauseBtn.classList.remove('hidden');
        });
    }

    if (ttsStopBtn) {
        ttsStopBtn.addEventListener('click', () => {
            window.speechSynthesis.cancel();
            ttsReset();
        });
    }

    // Handle Diff Toggle logic
    if (viewDiffBtn) {
        viewDiffBtn.addEventListener('click', () => {
            try {
                if (diffContent.classList.contains('hidden')) {
                    // Determine source for original vs refactored bounds
                    const originalCode = window.lastOriginalCode || codeInput.value || "";
                    const refCode = window.lastRefactoredCode || "";

                    // Library fallbacks
                    const DiffLib = window.Diff || window.JsDiff || window.diff;
                    if (!DiffLib) throw new Error("The text-difference library failed to load.");
                    if (!window.Diff2Html) throw new Error("The diff2html renderer failed to load.");

                    // Construct git-style patch String
                    const patch = DiffLib.createTwoFilesPatch("Original Input", " AI Optimized Code", originalCode, refCode, "", "", { context: 3 });

                    // Render with diff2html elegantly
                    const diffHtml = Diff2Html.html(patch, {
                        drawFileList: false,
                        matching: 'lines',
                        outputFormat: 'side-by-side',
                    });

                    diffContent.innerHTML = diffHtml;
                    diffContent.classList.remove('hidden');
                    outputContent.classList.add('hidden');
                    viewDiffBtn.innerHTML = " Back to Explanation";
                } else {
                    // Switching back to Markdown Explanation View
                    diffContent.classList.add('hidden');
                    outputContent.classList.remove('hidden');
                    viewDiffBtn.innerHTML = " View Diff";
                }
            } catch (err) {
                alert("Visual Diff Error: " + err.message);
                console.error(err);
            }
        });
    }

});
