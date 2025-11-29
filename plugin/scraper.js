// StackOverflow Question & Answers Scraper
// Extracts question and answers with code blocks replaced by <code block>

(function() {
    'use strict';

    // Helper: Extract text with code placeholder
    function extractTextWithCodePlaceholder(element) {
        if (!element) return '';
        
        // Clone element để không ảnh hưởng DOM gốc
        const clone = element.cloneNode(true);
        
        // 1. Thay thế TẤT CẢ <pre> blocks
        const preBlocks = clone.querySelectorAll('pre');
        preBlocks.forEach(block => {
            block.textContent = '<code block>';
        });
        
        // 2. Thay thế TẤT CẢ <code> tags
        const codeBlocks = clone.querySelectorAll('code');
        codeBlocks.forEach(block => {
            block.textContent = '<code block>';
        });
        
        // 3. Xử lý code blocks với class đặc biệt
        const snippetBlocks = clone.querySelectorAll('.snippet-code, .snippet-code-js, .snippet-code-css, .snippet-code-html');
        snippetBlocks.forEach(block => {
            block.textContent = '<code block>';
        });
        
        // 4. Xử lý các div chứa code (highlightjs, prism, etc.)
        const langBlocks = clone.querySelectorAll('[class*="language-"], [class*="lang-"], .hljs');
        langBlocks.forEach(block => {
            block.textContent = '<code block>';
        });
        
        // Lấy text content
        let text = clone.innerText || clone.textContent;
        
        // Loại bỏ các keyword code còn sót lại
        text = text.replace(/^(bash|python|java|javascript|typescript|cpp|c|ruby|php|go|rust|sql|html|css|shell|powershell|cmd)\s*$/gmi, '<code block>');
        text = text.replace(/^(Copy|Execute|Run)\s*$/gmi, '');
        
        // Detect code patterns
        const lines = text.split('\n');
        const processedLines = [];
        let inCodeBlock = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if line looks like a command/code
            const isCode = /^(\$|>|#|git |npm |pip |python |java |gcc |make |curl |wget |ssh |docker |kubectl )/.test(line) ||
                           /^[a-zA-Z_][a-zA-Z0-9_]*\s*[=\(\{]/.test(line) ||
                           /^(if|for|while|def|class|function|const|let|var|import|from|package)\s/.test(line);
            
            if (isCode && !inCodeBlock) {
                processedLines.push('<code block>');
                inCodeBlock = true;
            } else if (!isCode && inCodeBlock && line.length > 0) {
                inCodeBlock = false;
                processedLines.push(line);
            } else if (!inCodeBlock) {
                processedLines.push(line);
            }
        }
        
        text = processedLines.join('\n');
        
        // Normalize multiple <code block> liên tiếp
        text = text.replace(/(<code block>\s*)+/g, '<code block> ');
        
        // Clean up
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/[ \t]+/g, ' ');
        text = text.trim();
        
        return text;
    }

    // Get total answer count
    function getAnswerCount() {
        try {
            const answerCountElement = document.querySelector('[data-answercount]');
            const count = answerCountElement ? answerCountElement.getAttribute('data-answercount') : '0';
            return parseInt(count) || 0;
        } catch (e) {
            return 0;
        }
    }

    // Scrape question (only title - no body needed for summarization)
    function scrapeQuestion() {
        const questionData = {
            title: ''
        };
        
        try {
            // Get question title
            const titleSelectors = [
                'h1[itemprop="name"]',
                '#question-header h1',
                'h1.fs-headline1'
            ];
            
            for (const selector of titleSelectors) {
                const titleElem = document.querySelector(selector);
                if (titleElem) {
                    questionData.title = (titleElem.innerText || titleElem.textContent).trim();
                    break;
                }
            }
        } catch (e) {
            console.error('Error scraping question:', e);
        }
        
        return questionData;
    }



    // Get max page number from pagination
    function getMaxPageNumber() {
        try {
            // Check both old and new pagination selectors
            const pager = document.querySelector('.s-pagination, .pager');
            if (!pager) {
                console.log('No pagination found');
                return 1;
            }
            
            const pageLinks = pager.querySelectorAll('a');
            const pageNumbers = [];
            
            pageLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    const match = href.match(/[?&]page=(\d+)/);
                    if (match) {
                        pageNumbers.push(parseInt(match[1]));
                    }
                }
            });
            
            console.log('Found page numbers:', pageNumbers);
            return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
        } catch (e) {
            console.error('Error getting max page:', e);
            return 1;
        }
    }

    // Fetch and parse HTML from a URL
    async function fetchPage(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            return parser.parseFromString(html, 'text/html');
        } catch (e) {
            console.error('Error fetching page:', e);
            return null;
        }
    }

    // Scrape answers from a document (current or fetched)
    function scrapeAnswersFromDocument(doc) {
        const answers = [];
        
        try {
            const answerElements = doc.querySelectorAll('.answer');
            
            answerElements.forEach((answerElem, idx) => {
                try {
                    const answerId = answerElem.getAttribute('data-answerid') || 
                                   answerElem.id || 
                                   `answer-${idx}`;
                    
                    let votes = 0;
                    const voteSelectors = [
                        '[itemprop="upvoteCount"]',
                        '.js-vote-count',
                        '[data-value]'
                    ];
                    
                    for (const selector of voteSelectors) {
                        const voteElem = answerElem.querySelector(selector);
                        if (voteElem) {
                            const voteValue = voteElem.getAttribute('data-value') || voteElem.innerText;
                            votes = parseInt(voteValue) || 0;
                            break;
                        }
                    }
                    
                    const isAccepted = answerElem.classList.contains('accepted-answer');
                    
                    let content = '';
                    const bodyElem = answerElem.querySelector('.s-prose');
                    if (bodyElem) {
                        content = extractTextWithCodePlaceholder(bodyElem);
                    } else {
                        content = 'No content';
                    }
                    
                    answers.push({
                        id: answerId,
                        votes: votes,
                        is_accepted: isAccepted,
                        content: content,
                        content_length: content.length
                    });
                } catch (e) {
                    console.error(`Error scraping answer ${idx}:`, e);
                }
            });
        } catch (e) {
            console.error('Error finding answers:', e);
        }
        
        return answers;
    }

    // Main scraping function - scrapes ALL pages
    async function scrapeCurrentPage() {
        console.log('🔍 Starting to scrape ALL pages...');
        
        const url = window.location.href;
        const baseUrl = url.split('?')[0]; // Remove query params
        const totalAnswers = getAnswerCount();
        
        console.log(`📊 Total answers on this question: ${totalAnswers}`);
        
        // Scrape question
        const questionData = scrapeQuestion();
        console.log(`✅ Question scraped: ${questionData.title.substring(0, 100)}...`);
        
        // Get current tab (default, active, oldest, votes, etc.)
        const urlParams = new URLSearchParams(window.location.search);
        const currentTab = urlParams.get('tab') || 'votes'; // Default to votes tab
        
        // Get max page number
        const maxPage = getMaxPageNumber();
        console.log(`📚 Total pages detected: ${maxPage}`);
        console.log(`📑 Current tab: ${currentTab}`);
        
        // Scrape answers from page 1 (current page)
        let allAnswers = scrapeAnswersFromDocument(document);
        console.log(`📄 Page 1: Found ${allAnswers.length} answers`);
        
        // Fetch and scrape remaining pages
        if (maxPage > 1) {
            for (let page = 2; page <= maxPage; page++) {
                console.log(`📄 Page ${page}: Fetching...`);
                
                // Include tab parameter to get correct pagination
                const pageUrl = `${baseUrl}?tab=${currentTab}&page=${page}`;
                console.log(`   URL: ${pageUrl}`);
                
                const doc = await fetchPage(pageUrl);
                
                if (doc) {
                    const pageAnswers = scrapeAnswersFromDocument(doc);
                    allAnswers = allAnswers.concat(pageAnswers);
                    console.log(`   ✅ Found ${pageAnswers.length} answers on page ${page}`);
                    
                    // Wait 800ms between requests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 800));
                } else {
                    console.log(`   ❌ Error fetching page ${page}`);
                }
            }
        }
        
        // Create result
        const result = {
            url: url,
            question: questionData,
            answers: allAnswers,
            total_answers_scraped: allAnswers.length,
            total_answers_in_page: totalAnswers,
            accepted_count: allAnswers.filter(a => a.is_accepted).length,
            total_votes: allAnswers.reduce((sum, a) => sum + a.votes, 0),
            scraped_at: new Date().toISOString()
        };
        
        console.log(`\n✅ Scraping completed!`);
        console.log(`📊 Summary:`);
        console.log(`   - Total pages: ${maxPage}`);
        console.log(`   - Expected answers: ${totalAnswers}`);
        console.log(`   - Scraped answers: ${result.total_answers_scraped}`);
        console.log(`   - Accepted answers: ${result.accepted_count}`);
        console.log(`   - Total votes: ${result.total_votes}`);
        
        return result;
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrapeCurrentPage') {
            // Async function - must handle promise
            scrapeCurrentPage()
                .then(data => {
                    sendResponse({ success: true, data: data });
                })
                .catch(error => {
                    console.error('Scraping error:', error);
                    sendResponse({ success: false, error: error.message });
                });
            
            return true; // MUST return true to keep message channel open for async
        }
        
        // Handle: Open Main Interface
        if (request.action === 'openMainInterface') {
            openMainInterface();
            sendResponse({success: true});
            return true;
        }
    });
    
    // =============================================================================
    // Main Interface Modal (injected into page)
    // =============================================================================
    
    function openMainInterface() {
        // Remove existing modal if any
        const existing = document.getElementById('absosum-main-modal');
        if (existing) {
            existing.remove();
        }
        
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'absosum-main-modal';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 16px;
            width: 90%;
            max-width: 750px;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
        `;
        
        modal.innerHTML = `
            <div style="padding: 24px 30px; border-bottom: 2px solid #e1e5e9; background: linear-gradient(135deg, #0074cc 0%, #0099ff 100%); color: white; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: bold;">📊 AbSOSUM</h1>
                    <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">StackOverflow Answer Summarization - Phase 1 & 2</p>
                </div>
                <button id="absosum-close-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 28px; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">×</button>
            </div>
            
            <div style="padding: 24px 30px; overflow-y: auto; flex: 1;">
                <div id="absosum-status" style="padding: 12px 16px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #1565c0;">
                    Ready to start
                </div>
                
                <!-- STEP 1 -->
                <div style="background: #f8f9fa; border: 2px solid #e1e5e9; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="background: #0074cc; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px;">1</span>
                        <h3 style="margin: 0; font-size: 16px; color: #232629;">Test Backend Connection</h3>
                    </div>
                    <button id="absosum-step1-btn" style="width: 100%; padding: 12px 20px; background: #0074cc; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
                        🔌 Load Model & Test Connection
                    </button>
                    <div id="absosum-step1-result" style="margin-top: 12px; font-size: 13px;"></div>
                </div>
                
                <!-- STEP 2 -->
                <div style="background: #f8f9fa; border: 2px solid #e1e5e9; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="background: #5eba7d; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px;">2</span>
                        <h3 style="margin: 0; font-size: 16px; color: #232629;">Scrape StackOverflow Data</h3>
                    </div>
                    <button id="absosum-step2-btn" style="width: 100%; padding: 12px 20px; background: #5eba7d; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;" disabled>
                        🔍 Scrape Current Page
                    </button>
                    <div id="absosum-step2-result" style="margin-top: 12px; font-size: 13px;"></div>
                </div>
                
                <!-- STEP 3 -->
                <div style="background: #f8f9fa; border: 2px solid #e1e5e9; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="background: #ff9800; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px;">3</span>
                        <h3 style="margin: 0; font-size: 16px; color: #232629;">Phase 1: Single-answer abstractive summarization</h3>
                    </div>
                    <p style="margin: 0 0 12px 0; font-size: 12px; color: #666;">Generate individual summaries and calculate importance weights based on votes</p>
                    <button id="absosum-step3-btn" style="width: 100%; padding: 12px 20px; background: #ff9800; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;" disabled>
                        ⚖️ Summarize + Calculate Weights
                    </button>
                    <div id="absosum-step3-result" style="margin-top: 12px; font-size: 13px;"></div>
                </div>
                
                <!-- STEP 4 -->
                <div style="background: #f8f9fa; border: 2px solid #e1e5e9; border-radius: 12px; padding: 20px;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="background: #9c27b0; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px;">4</span>
                        <h3 style="margin: 0; font-size: 16px; color: #232629;">Phase 2: Multi-answer abstractive summarization</h3>
                    </div>
                    <p style="margin: 0 0 12px 0; font-size: 12px; color: #666;">Generate single unified answer using weight-aware Phase 2 model</p>
                    <button id="absosum-step4-btn" style="width: 100%; padding: 12px 20px; background: #9c27b0; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;" disabled>
                        🤖 Generate Unified Summary (Phase 2)
                    </button>
                    <div id="absosum-step4-result" style="margin-top: 12px; font-size: 13px;"></div>
                </div>
            </div>
        `;
        
        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);
        
        // Initialize interface
        initMainInterface(modalOverlay);
    }
    
    function initMainInterface(modalOverlay) {
        const closeBtn = document.getElementById('absosum-close-btn');
        const step1Btn = document.getElementById('absosum-step1-btn');
        const step2Btn = document.getElementById('absosum-step2-btn');
        const step3Btn = document.getElementById('absosum-step3-btn');
        const step4Btn = document.getElementById('absosum-step4-btn');
        
        const step1Result = document.getElementById('absosum-step1-result');
        const step2Result = document.getElementById('absosum-step2-result');
        const step3Result = document.getElementById('absosum-step3-result');
        const step4Result = document.getElementById('absosum-step4-result');
        const status = document.getElementById('absosum-status');
        
        const API_BASE_URL = 'http://127.0.0.1:8000';
        let scrapedData = null;
        let summarizedData = null;
        let backendConnected = false;
        
        // Close modal
        closeBtn.addEventListener('click', () => {
            modalOverlay.remove();
        });
        
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });
        
        // Helper function
        function updateStatus(message, type) {
            const colors = {
                success: {bg: '#e8f5e9', border: '#5eba7d', text: '#2e7d32'},
                error: {bg: '#ffebee', border: '#d32f2f', text: '#c62828'},
                loading: {bg: '#e3f2fd', border: '#2196f3', text: '#1565c0'},
                warning: {bg: '#fff3e0', border: '#ff9800', text: '#e65100'}
            };
            const color = colors[type] || colors.loading;
            status.style.cssText = `padding: 12px 16px; background: ${color.bg}; border-left: 4px solid ${color.border}; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: ${color.text};`;
            status.textContent = message;
        }
        
        // STEP 1: Test Connection & Load Models
        step1Btn.addEventListener('click', function() {
            step1Result.innerHTML = '<div style="color: #0074cc;">⏳ Loading models... This may take a minute...</div>';
            step1Btn.disabled = true;
            updateStatus('⏳ Loading Phase 1 & Phase 2 models...', 'loading');
            
            fetch(`${API_BASE_URL}/step1/testConnection`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({test: "test"})
            })
            .then(response => response.json())
            .then(data => {
                console.log('📦 STEP 1 Response:', data);
                
                if (data.status === 'success') {
                    // Both models loaded successfully
                    step1Result.innerHTML = `
                        <div style="color: #5eba7d; font-weight: bold; margin-bottom: 10px;">✅ ${data.message}</div>
                        <div style="padding: 10px; background: #e8f5e9; border-radius: 6px; border-left: 3px solid #5eba7d; font-size: 11px;">
                            <div style="margin-bottom: 8px;"><strong>🖥️ Device:</strong> ${data.device.toUpperCase()}</div>
                            <div style="margin-bottom: 5px;"><strong>📦 Phase 1 (Single-answer abstractive summarization):</strong></div>
                            <div style="margin-left: 10px; margin-bottom: 8px;">
                                ${data.phase1_model.loaded ? '✅' : '❌'} ${data.phase1_model.name}<br/>
                                Device: ${data.phase1_model.device || 'N/A'}
                            </div>
                            <div style="margin-bottom: 5px;"><strong>📦 Phase 2 (Multi-answer abstractive summarization):</strong></div>
                            <div style="margin-left: 10px;">
                                ${data.phase2_model.loaded ? '✅' : '❌'} ${data.phase2_model.name}<br/>
                                Device: ${data.phase2_model.device || 'N/A'}
                            </div>
                        </div>
                    `;
                    backendConnected = true;
                    step2Btn.disabled = false;
                    updateStatus('✅ Both models loaded! Proceed to STEP 2', 'success');
                } else if (data.status === 'partial') {
                    // Some models loaded
                    const phase1Status = data.phase1_model.loaded ? '✅' : '❌';
                    const phase2Status = data.phase2_model.loaded ? '✅' : '❌';
                    
                    step1Result.innerHTML = `
                        <div style="color: #ff9800; font-weight: bold; margin-bottom: 10px;">⚠️ ${data.message}</div>
                        <div style="padding: 10px; background: #fff3e0; border-radius: 6px; border-left: 3px solid #ff9800; font-size: 11px;">
                            <div style="margin-bottom: 8px;"><strong>🖥️ Device:</strong> ${data.device.toUpperCase()}</div>
                            <div style="margin-bottom: 5px;"><strong>📦 Phase 1 (Single-answer):</strong></div>
                            <div style="margin-left: 10px; margin-bottom: 8px;">
                                ${phase1Status} ${data.phase1_model.name}<br/>
                                ${data.phase1_model.error ? `❌ Error: ${data.phase1_model.error}` : `Device: ${data.phase1_model.device}`}
                            </div>
                            <div style="margin-bottom: 5px;"><strong>📦 Phase 2 (Multi-answer):</strong></div>
                            <div style="margin-left: 10px;">
                                ${phase2Status} ${data.phase2_model.name}<br/>
                                ${data.phase2_model.error ? `❌ Error: ${data.phase2_model.error}` : `Device: ${data.phase2_model.device}`}
                            </div>
                        </div>
                    `;
                    
                    // Allow proceeding if at least Phase 1 loaded
                    if (data.phase1_model.loaded) {
                        backendConnected = true;
                        step2Btn.disabled = false;
                        updateStatus('⚠️ Phase 1 loaded, but Phase 2 failed. You can proceed to STEP 3 only.', 'warning');
                    } else {
                        updateStatus('❌ Phase 1 model failed. Cannot proceed.', 'error');
                    }
                } else {
                    throw new Error(data.message || 'Connection failed');
                }
            })
            .catch(error => {
                step1Result.innerHTML = `<div style="color: #d32f2f;">❌ Error: ${error.message}</div>`;
                updateStatus('❌ Backend connection failed', 'error');
            })
            .finally(() => {
                step1Btn.disabled = false;
            });
        });
        
        // STEP 2: Scrape Data
        step2Btn.addEventListener('click', function() {
            step2Result.innerHTML = '<div style="color: #0074cc;">⏳ Scraping StackOverflow data...</div>';
            step2Btn.disabled = true;
            updateStatus('⏳ Scraping data...', 'loading');
            
            scrapeCurrentPage().then(result => {
                console.log('📦 Scraped result:', result);
                
                // result contains: {question, answers, url, total_answers_scraped, etc.}
                scrapedData = {
                    question: result.question,
                    answers: result.answers
                };
                
                console.log('📦 Sending to backend:', scrapedData);
                
                // Validate with backend
                return fetch(`${API_BASE_URL}/step2/validateData`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(scrapedData)
                });
            })
            .then(response => {
                console.log('📡 Backend response status:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('📦 Backend validation result:', data);
                
                if (data.success) {
                    step2Result.innerHTML = `
                        <div style="color: #5eba7d; font-weight: bold;">✅ ${data.message}</div>
                        <div style="margin-top: 8px; padding: 10px; background: #e8f5e9; border-radius: 6px; border-left: 3px solid #5eba7d; font-size: 12px;">
                            <div><strong>Question:</strong> ${scrapedData.question.title}</div>
                            <div style="margin-top: 5px;"><strong>Answers:</strong> ${scrapedData.answers.length}</div>
                        </div>
                    `;
                    step3Btn.disabled = false;
                    updateStatus('✅ Data scraped! Proceed to STEP 3', 'success');
                } else {
                    // Show validation issues
                    const issuesHtml = data.issues && data.issues.length > 0 
                        ? '<ul style="margin: 5px 0; padding-left: 20px;">' + data.issues.map(i => `<li>${i}</li>`).join('') + '</ul>'
                        : '';
                    step2Result.innerHTML = `
                        <div style="color: #d32f2f; font-weight: bold;">❌ Validation Failed</div>
                        ${issuesHtml}
                    `;
                    updateStatus('❌ Data validation failed', 'error');
                }
            })
            .catch(error => {
                console.error('❌ STEP 2 Error:', error);
                step2Result.innerHTML = `<div style="color: #d32f2f;">❌ Error: ${error.message}</div>`;
                updateStatus('❌ Scraping failed', 'error');
            })
            .finally(() => {
                step2Btn.disabled = false;
            });
        });
        
        // STEP 3: Summarize
        // STEP 3: Summarize each answer + calculate weights
        step3Btn.addEventListener('click', function() {
            step3Result.innerHTML = '<div style="color: #0074cc;">⏳ Calculating weights and summarizing answers... Please wait...</div>';
            step3Btn.disabled = true;
            updateStatus('⏳ STEP 3: Summarizing each answer + calculating weights...', 'loading');
            
            fetch(`${API_BASE_URL}/step3_phase2/summarizeWithWeights`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(scrapedData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    summarizedData = data; // Store for STEP 4
                    displayStep3Result(data);
                    updateStatus('✅ STEP 3 completed! Ready for Phase 2 unified summary', 'success');
                    step4Btn.disabled = false; // Enable STEP 4
                } else {
                    throw new Error(data.message || 'Summarization failed');
                }
            })
            .catch(error => {
                step3Result.innerHTML = `<div style="color: #d32f2f;">❌ Error: ${error.message}</div>`;
                updateStatus('❌ STEP 3 failed', 'error');
            })
            .finally(() => {
                step3Btn.disabled = false;
            });
        });
        
        // STEP 4: Phase 2 unified summary
        step4Btn.addEventListener('click', function() {
            step4Result.innerHTML = '<div style="color: #0074cc;">⏳ Generating unified summary with Phase 2 model... Please wait...</div>';
            step4Btn.disabled = true;
            updateStatus('⏳ STEP 4: Running Phase 2 weight-aware model...', 'loading');
            
            // Prepare data for Phase 2 model
            const phase2Request = {
                question_title: scrapedData.question.title,  // Extract title string from question object
                answers: summarizedData.answers  // With weights + summaries
            };
            
            console.log('📦 STEP 4 Request:', phase2Request);
            console.log('📝 Question title:', phase2Request.question_title);
            console.log('📊 Number of answers:', phase2Request.answers.length);
            
            fetch(`${API_BASE_URL}/step4_phase2/generateUnifiedSummary`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(phase2Request)
            })
            .then(response => response.json())
            .then(data => {
                console.log('📦 STEP 4 Response:', data);
                
                if (data.success) {
                    displayStep4Result(data);
                    updateStatus('✅ All steps completed! Phase 2 unified summary generated', 'success');
                } else {
                    throw new Error(data.error || data.message || 'Phase 2 failed');
                }
            })
            .catch(error => {
                console.error('❌ STEP 4 Error:', error);
                step4Result.innerHTML = `<div style="color: #d32f2f;">❌ Error: ${error.message}</div>`;
                updateStatus('❌ STEP 4 failed', 'error');
            })
            .finally(() => {
                step4Btn.disabled = false;
            });
        });
        
        function displayStep3Result(data) {
            // STEP 3: Display individual summaries + weights
            // Backend returns: {success, answers, total, success_count, failed_count, processing_time, weight_stats}
            
            let statsHTML = `
                <div style="color: #5eba7d; font-weight: bold; margin-bottom: 10px;">✅ Phase 1: Single-answer abstractive summarization completed!</div>
                <div style="margin-top: 5px; padding: 8px; background: #e8f5e9; border-radius: 4px; border-left: 3px solid #5eba7d; font-size: 11px; margin-bottom: 10px;">
                    <div><strong>✨ Results:</strong></div>
                    <div>Success: ${data.success_count} / ${data.total}</div>
                    <div>Failed: ${data.failed_count}</div>
                    <div>Time: ${data.processing_time}s</div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #c8e6c9;"><strong>⚖️ Weight Distribution:</strong></div>
                    <div>Total Weight: ${data.weight_stats.total_weight}</div>
                    <div>Range: ${data.weight_stats.min_weight} - ${data.weight_stats.max_weight}</div>
                    <div>Average: ${data.weight_stats.avg_weight}</div>
                </div>`;
            
            let tableHTML = statsHTML + `
                <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e1e5e9; border-radius: 4px; margin-bottom: 10px;">
                    <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                        <thead style="background: #f8f9fa; position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e1e5e9; width: 50px;">#</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e1e5e9; width: 60px;">Votes</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e1e5e9; width: 80px;">Weight</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e1e5e9;">Individual Summary</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.answers.forEach((ans, idx) => {
                const isAccepted = ans.is_accepted ? '✅' : '';
                const rowBg = ans.is_accepted ? 'background: #e8f5e9;' : (idx % 2 === 0 ? 'background: #fff;' : 'background: #f8f9fa;');
                const summary = ans.summary || '❌ Failed to summarize';
                const summaryColor = ans.summary ? '#232629' : '#d32f2f';
                const weight = ans.weight ? ans.weight.toFixed(3) : 'N/A';
                
                tableHTML += `
                    <tr style="${rowBg}">
                        <td style="padding: 8px; border-bottom: 1px solid #e1e5e9; font-weight: bold;">${isAccepted} ${idx + 1}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e1e5e9; color: #0074cc; font-weight: bold;">${ans.votes}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e1e5e9; color: #ff9800; font-weight: bold;">${weight}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e1e5e9; color: ${summaryColor}; line-height: 1.4;">${summary}</td>
                    </tr>
                `;
            });
            
            tableHTML += `
                        </tbody>
                    </table>
                </div>
                
                <div style="padding: 10px; background: #fff3e0; border-radius: 4px; border-left: 3px solid #ff9800; font-size: 12px; margin-bottom: 10px;">
                    <strong>➡️ Next Step:</strong> Click STEP 4 below to generate unified summary using Phase 2 model
                </div>
                
                <div style="display: flex; gap: 5px;">
                    <button id="absosum-view-step3-btn" style="flex: 1; padding: 8px; background: #0074cc; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">
                        👁️ View Full Details
                    </button>
                    <button id="absosum-download-step3-btn" style="flex: 1; padding: 8px; background: #5eba7d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">
                        💾 Download JSON
                    </button>
                </div>
            `;
            
            step3Result.innerHTML = tableHTML;
            
            // View Results button - use setTimeout to ensure DOM is ready
            setTimeout(() => {
                const viewBtn = document.getElementById('absosum-view-step3-btn');
                console.log('🔍 View button found:', viewBtn);
                if (viewBtn) {
                    viewBtn.onclick = function() {
                        console.log('👁️ View Full Details clicked!');
                        showStep3Modal(data);
                    };
                    console.log('✅ Click handler attached');
                } else {
                    console.error('❌ View button not found!');
                }
            }, 100);
            
            // Download button
            setTimeout(() => {
                const downloadBtn = document.getElementById('absosum-download-step3-btn');
                if (downloadBtn) {
                    downloadBtn.onclick = function() {
                const fullData = {
                    step: 'step3_individual_summaries',
                    question: scrapedData.question,
                    answers: data.answers,
                    total: data.total,
                    success_count: data.success_count,
                    failed_count: data.failed_count,
                    processing_time: data.processing_time,
                    weight_stats: data.weight_stats
                };
                
                const dataStr = JSON.stringify(fullData, null, 2);
                const blob = new Blob([dataStr], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const filename = `absosum_${scrapedData.question.title.substring(0, 30).replace(/[^\w\s]/g, '')}_summarized.json`;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                    };
                }
            }, 0);
        }
        
        function displayStep4Result(data) {
            // STEP 4: Display Phase 2 unified summary
            let resultHTML = `
                <div style="color: #9c27b0; font-weight: bold; margin-bottom: 10px;">✅ Phase 2: Multi-answer abstractive summarization completed!</div>
                <div style="margin-top: 5px; padding: 12px; background: #f3e5f5; border-radius: 6px; border-left: 4px solid #9c27b0; margin-bottom: 12px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 8px;"><strong>⏱️ Processing Time:</strong> ${data.processing_time}s</div>
                    <div style="font-size: 11px; color: #666; margin-bottom: 12px;"><strong>🤖 Model:</strong> ${data.model_name || 'Phase 2 - Multi-answer abstractive summarization'}</div>
                    
                    <div style="font-weight: bold; font-size: 13px; color: #9c27b0; margin-bottom: 8px;">🎯 Unified Summary:</div>
                    <div style="padding: 12px; background: white; border-radius: 6px; border: 1px solid #ce93d8; line-height: 1.6; font-size: 13px; color: #232629;">
                        ${data.unified_summary || 'No summary generated'}
                    </div>
                </div>
                
                <div style="display: flex; gap: 5px;">
                    <button id="absosum-view-complete-btn" style="flex: 1; padding: 8px; background: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">
                        👁️ View Complete Results
                    </button>
                    <button id="absosum-download-complete-btn" style="flex: 1; padding: 8px; background: #5eba7d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">
                        💾 Download Complete JSON
                    </button>
                </div>
            `;
            
            step4Result.innerHTML = resultHTML;
            
            // View Complete Results button
            document.getElementById('absosum-view-complete-btn').addEventListener('click', function() {
                showCompleteResultsModal(summarizedData, data);
            });
            
            // Download Complete button
            document.getElementById('absosum-download-complete-btn').addEventListener('click', function() {
                const completeData = {
                    question: scrapedData.question,
                    step3_individual_summaries: {
                        answers: summarizedData.answers,
                        total: summarizedData.total,
                        success_count: summarizedData.success_count,
                        failed_count: summarizedData.failed_count,
                        weight_stats: summarizedData.weight_stats,
                        processing_time: summarizedData.processing_time
                    },
                    step4_phase2_unified: {
                        unified_summary: data.unified_summary,
                        model_name: data.model_name,
                        processing_time: data.processing_time
                    }
                };
                const dataStr = JSON.stringify(completeData, null, 2);
                const blob = new Blob([dataStr], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const filename = `absosum_complete_${scrapedData.question.title.substring(0, 30).replace(/[^\w\s]/g, '')}.json`;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            });
        }
        
        function showStep3Modal(data) {
            // STEP 3: Show detailed modal for individual summaries
            console.log('📊 Opening Step 3 Modal with data:', data);
            const resultsModal = document.createElement('div');
            resultsModal.id = 'absosum-step3-modal';
            resultsModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999999;
            `;
            console.log('✅ Modal created and styled');
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 900px;
                max-height: 85vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
            `;
            
            // Build weight stats card (always show for Phase 1)
            const weightStatsCard = data.weight_stats ? `
                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 5px;">⚖️ AVG WEIGHT</div>
                    <div style="font-size: 24px; font-weight: bold; color: #ff9800;">${data.weight_stats.avg_weight}</div>
                </div>
            ` : '';
            
            modal.innerHTML = `
                <div style="padding: 20px 24px; border-bottom: 2px solid #e1e5e9; background: linear-gradient(135deg, #ff9800 0%, #ffb74d 100%); color: white; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 style="margin: 0; font-size: 18px; font-weight: bold;">📊 Phase 1: Single-answer abstractive summarization</h2>
                        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">${scrapedData.question.title}</p>
                    </div>
                    <button id="close-step3-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">×</button>
                </div>
                
                <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
                        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #5eba7d;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">SUCCESS RATE</div>
                            <div style="font-size: 24px; font-weight: bold; color: #5eba7d;">${data.success_count}/${data.total}</div>
                        </div>
                        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">⚖️ AVG WEIGHT</div>
                            <div style="font-size: 24px; font-weight: bold; color: #ff9800;">${data.weight_stats.avg_weight}</div>
                        </div>
                        <div style="background: #ffebee; padding: 15px; border-radius: 8px; border-left: 4px solid #d32f2f;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">FAILED</div>
                            <div style="font-size: 24px; font-weight: bold; color: #d32f2f;">${data.failed_count}</div>
                        </div>
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">TIME</div>
                            <div style="font-size: 24px; font-weight: bold; color: #2196f3;">${data.processing_time}s</div>
                        </div>
                    </div>
                    
                    <div id="results-answers-container"></div>
                </div>
                
                <div style="padding: 16px 24px; border-top: 1px solid #e1e5e9; background: #f8f9fa; display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="copy-json-results" style="padding: 10px 20px; background: #5eba7d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;">📋 Copy JSON</button>
                    <button id="download-json-results" style="padding: 10px 20px; background: #0074cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;">💾 Download JSON</button>
                </div>
            `;
            
            resultsModal.appendChild(modal);
            document.body.appendChild(resultsModal);
            console.log('✅ Modal added to body');
            
            // Populate answers
            const container = document.getElementById('results-answers-container');
            data.answers.forEach((ans, idx) => {
                const isAccepted = ans.is_accepted;
                const bgColor = isAccepted ? '#e8f5e9' : '#f8f9fa';
                const borderColor = isAccepted ? '#5eba7d' : '#e1e5e9';
                const badge = isAccepted ? '<span style="background: #5eba7d; color: white; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; margin-left: 8px;">✓ ACCEPTED</span>' : '';
                const weightBadge = `<span style="background: #ff9800; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-left: 8px;">⚖️ ${ans.weight.toFixed(3)}</span>`;
                
                const answerCard = document.createElement('div');
                answerCard.style.cssText = `background: ${bgColor}; border: 1px solid ${borderColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 16px; margin-bottom: 12px;`;
                answerCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <div style="font-weight: bold; font-size: 14px; color: #232629;">Answer #${idx + 1} ${badge}</div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span style="background: #0074cc; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">👍 ${ans.votes} votes</span>
                            ${weightBadge}
                        </div>
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e1e5e9;">
                        <div style="font-size: 11px; color: #666; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Individual Summary:</div>
                        <div style="color: ${ans.summary ? '#232629' : '#d32f2f'}; line-height: 1.6; font-size: 13px;">${ans.summary || '❌ Failed to generate summary'}</div>
                    </div>
                    <details style="margin-top: 10px;">
                        <summary style="cursor: pointer; color: #0074cc; font-size: 12px; font-weight: bold;">📄 View Original Answer</summary>
                        <div style="margin-top: 8px; padding: 12px; background: white; border-radius: 6px; border: 1px solid #e1e5e9; font-size: 11px; line-height: 1.6; color: #555; max-height: 200px; overflow-y: auto;">
                            ${(ans.content || ans.answer_text || 'No content').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}
                        </div>
                    </details>
                `;
                container.appendChild(answerCard);
            });
            
            // Event listeners
            document.getElementById('close-step3-modal').addEventListener('click', () => {
                resultsModal.remove();
            });
            
            resultsModal.addEventListener('click', (e) => {
                if (e.target === resultsModal) resultsModal.remove();
            });
            
            document.getElementById('copy-json-results').addEventListener('click', function() {
                navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                this.textContent = '✅ Copied!';
                setTimeout(() => this.textContent = '📋 Copy JSON', 2000);
            });
            
            document.getElementById('download-json-results').addEventListener('click', () => {
                const fullData = {
                    step: 'step3_individual_summaries',
                    question: scrapedData.question,
                    answers: data.answers,
                    total: data.total,
                    success_count: data.success_count,
                    failed_count: data.failed_count,
                    weight_stats: data.weight_stats,
                    processing_time: data.processing_time
                };
                const blob = new Blob([JSON.stringify(fullData, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `absosum_step3_${scrapedData.question.title.substring(0, 30).replace(/[^\w\s]/g, '')}_${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }
        
        function showCompleteResultsModal(step3Data, step4Data) {
            // Show complete results with STEP 3 + STEP 4
            const completeModal = document.createElement('div');
            completeModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999999;
            `;
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                border-radius: 12px;
                width: 95%;
                max-width: 1000px;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
            `;
            
            modal.innerHTML = `
                <div style="padding: 20px 24px; border-bottom: 2px solid #e1e5e9; background: linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%); color: white;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">🎯 Complete Results: STEP 3 + STEP 4</h2>
                    <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">${scrapedData.question.title}</p>
                </div>
                
                <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                    <!-- STEP 4: Phase 2 Unified Summary -->
                    <div style="background: #f3e5f5; padding: 16px; border-radius: 8px; border-left: 4px solid #9c27b0; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #9c27b0;">🤖 Phase 2: Multi-answer abstractive summarization</h3>
                        <div style="background: white; padding: 14px; border-radius: 6px; line-height: 1.7; font-size: 14px; color: #232629; border: 1px solid #ce93d8;">
                            ${step4Data.unified_summary || 'No summary'}
                        </div>
                        <div style="margin-top: 10px; font-size: 12px; color: #666;">
                            <strong>Model:</strong> ${step4Data.model_name || 'Phase 2'} | 
                            <strong>Time:</strong> ${step4Data.processing_time}s
                        </div>
                    </div>
                    
                    <!-- STEP 3: Individual Summaries -->
                    <h3 style="margin: 20px 0 12px 0; font-size: 16px; color: #ff9800;">⚖️ Phase 1: Single-answer abstractive summarization</h3>
                    <div id="complete-answers-list"></div>
                </div>
                
                <div style="padding: 16px 24px; border-top: 1px solid #e1e5e9; background: #f8f9fa; display: flex; justify-content: space-between;">
                    <button id="close-complete-modal" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">Close</button>
                    <button id="download-complete-json" style="padding: 10px 20px; background: #9c27b0; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;">💾 Download Complete JSON</button>
                </div>
            `;
            
            completeModal.appendChild(modal);
            document.body.appendChild(completeModal);
            
            // Populate individual answers
            const answersList = document.getElementById('complete-answers-list');
            step3Data.answers.forEach((ans, idx) => {
                const card = document.createElement('div');
                const bgColor = ans.is_accepted ? '#e8f5e9' : '#f8f9fa';
                card.style.cssText = `background: ${bgColor}; padding: 12px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e1e5e9;`;
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>Answer #${idx + 1} ${ans.is_accepted ? '✅' : ''}</strong>
                        <div>
                            <span style="background: #0074cc; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-right: 5px;">👍 ${ans.votes}</span>
                            <span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">⚖️ ${ans.weight.toFixed(3)}</span>
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #555; line-height: 1.5;">${ans.summary || 'Failed'}</div>
                `;
                answersList.appendChild(card);
            });
            
            document.getElementById('close-complete-modal').addEventListener('click', () => {
                completeModal.remove();
            });
            
            completeModal.addEventListener('click', (e) => {
                if (e.target === completeModal) completeModal.remove();
            });
            
            document.getElementById('download-complete-json').addEventListener('click', () => {
                const completeData = {
                    question: scrapedData.question,
                    step3_individual_summaries: step3Data,
                    step4_phase2_unified: step4Data
                };
                const blob = new Blob([JSON.stringify(completeData, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `absosum_complete_${scrapedData.question.title.substring(0, 30).replace(/[^\w\s]/g, '')}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }
    }

    console.log('✅ StackOverflow Scraper loaded and ready!');
})();
