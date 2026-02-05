// Initialize Mermaid with dark theme (mermaid loaded from CDN)
window.mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#60a5fa',
        lineColor: '#64748b',
        secondaryColor: '#8b5cf6',
        tertiaryColor: '#10b981',
        background: '#0f172a',
        mainBkg: '#1e293b',
        secondBkg: '#334155',
        textColor: '#e2e8f0',
        border1: '#475569',
        border2: '#64748b'
    }
});

const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const fileStatus = document.getElementById('file-status');
const appTitle = document.getElementById('app-title');
const closeModalBtn = document.getElementById('close-modal');
const statusBar = document.getElementById('status-bar');

if (!window.electronAPI) {
    const err = "Critical Error: Electron API not initialized. Preload script likely failed.";
    console.error(err);
    if (statusBar) statusBar.textContent = err;
    if (fileStatus) fileStatus.textContent = "App Initialization Failed";
    alert(err);
    throw new Error(err);
}

let isFileLoaded = false;

window.electronAPI.getModelName().then((modelName) => {
    if (modelName) {
        appTitle.textContent = `Investor Support AI - ${modelName}`;
    }
}).catch(() => {
    // No-op if model name can't be fetched
});

// Update Status Bar
window.electronAPI.onAppStatus((event, message) => {
    statusBar.textContent = message;
    console.log("Status update:", message);
});

// Enable inputs when file is loaded
window.electronAPI.onFileLoaded((event, fileName) => {
    isFileLoaded = true;
    fileStatus.textContent = `Current File: ${fileName}`;
    fileStatus.style.color = '#059669'; // Green
    userInput.disabled = false;
    sendBtn.disabled = false;
    appendMessage('ai', `I've read ${fileName}. Select a task from the right panel or ask away!`);
});

// Removed: Modal Logic

// Handle Task Cards
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', async () => {
        if (!isFileLoaded) {
            alert("Please open a PDF file first.");
            return;
        }

        const taskType = card.getAttribute('data-task');
        
        let taskName = "";
        if (taskType === 'summarize') taskName = "Summarizing document";
        if (taskType === 'tech-questions') taskName = "Generating tech questions";
        if (taskType === 'create-diagrams') taskName = "Creating diagrams from document data";

        await appendMessage('user', `[Running Task: ${taskName}...]`);
        await appendMessage('ai', 'Thinking...');
        
        // Remove the "Thinking..." message implicitly by appending, or track it? 
        // For simplicity, we'll just append the result.
        
        try {
            const response = await window.electronAPI.runTask(taskType);
            // Ideally remove the last 'Thinking...' message, but for MVP just append.
            await appendMessage('ai', response);
        } catch (error) {
            await appendMessage('ai', `Error: ${error}`);
        }
    });
});

// Chat Logic
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = '';
    await appendMessage('user', text);
    
    // Disable during generation
    userInput.disabled = true;
    sendBtn.disabled = true;
    const loadingMsg = await appendMessage('ai', 'Thinking...');

    try {
        const response = await window.electronAPI.askAI(text);
        console.log("[sendMessage] AI Response received");
        const rendered = await window.electronAPI.renderMarkdown(response);
        console.log("[sendMessage] Markdown rendered");
        const contentEl = loadingMsg.querySelector('.message-content');
        if (contentEl) {
            contentEl.innerHTML = rendered;
        } else {
            loadingMsg.innerHTML = rendered;
        }
        loadingMsg.dataset.markdown = response;
        
        // Render any Mermaid diagrams
        await renderMermaidDiagrams(loadingMsg);
        
        const copyBtn = loadingMsg.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.disabled = false;
        }
    } catch (error) {
        const contentEl = loadingMsg.querySelector('.message-content');
        if (contentEl) {
            contentEl.textContent = "Error communicating with AI.";
        } else {
            loadingMsg.textContent = "Error communicating with AI.";
        }
        const copyBtn = loadingMsg.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.disabled = true;
        }
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

async function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', role);
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    if (role === 'ai') {
        const rendered = await window.electronAPI.renderMarkdown(text);
        console.log("[appendMessage] AI message rendered");
        contentDiv.innerHTML = rendered;
        msgDiv.dataset.markdown = text;
        
        // Render any Mermaid diagrams
        msgDiv.appendChild(contentDiv);
        await renderMermaidDiagrams(msgDiv);
        const copyBtn = document.createElement('button');
        copyBtn.classList.add('copy-btn');
        copyBtn.textContent = 'Copy';
        copyBtn.disabled = text === 'Thinking...';
        copyBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            await copyMarkdownFromMessage(msgDiv, copyBtn);
        });
        msgDiv.appendChild(copyBtn);
    } else {
        contentDiv.textContent = text;
        msgDiv.appendChild(contentDiv);
    }
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msgDiv;
}

async function renderMermaidDiagrams(containerEl) {
    // Find all code blocks with language-mermaid class
    const mermaidBlocks = containerEl.querySelectorAll('pre code.language-mermaid');
    console.log(`[renderMermaidDiagrams] Found ${mermaidBlocks.length} mermaid blocks`);
    
    for (let i = 0; i < mermaidBlocks.length; i++) {
        const codeBlock = mermaidBlocks[i];
        const preElement = codeBlock.parentElement;
        const mermaidCode = codeBlock.textContent;
        console.log(`[renderMermaidDiagrams] Processing block ${i}:`, mermaidCode.substring(0, 100) + '...');
        
        try {
            // Create a unique ID for this diagram
            const diagramId = `mermaid-${Date.now()}-${i}`;
            
            // Create a div to hold the rendered diagram
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid-diagram';
            mermaidDiv.id = diagramId;
            mermaidDiv.textContent = mermaidCode;
            
            // Render the diagram BEFORE replacing the pre element
            // This way if it throws, we haven't touched the DOM yet
            const tempContainer = document.createElement('div');
            tempContainer.style.display = 'block'; // Make visible for debugging if needed, but we keep it out of view
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            document.body.appendChild(tempContainer);
            tempContainer.appendChild(mermaidDiv);
            
            try {
                console.log(`[renderMermaidDiagrams] Attempting to run mermaid.run for ${diagramId}`);
                await window.mermaid.run({ nodes: [mermaidDiv] });
                
                // Replace the pre/code block with our successfully rendered div
                preElement.replaceWith(mermaidDiv);
                console.log(`[renderMermaidDiagrams] Successfully rendered diagram ${diagramId}`);
            } catch (renderError) {
                console.error('[renderMermaidDiagrams] Mermaid parse/render error. Showing raw block instead.', renderError);
                
                // On error, let's add a small error banner above the pre block
                const errorBanner = document.createElement('div');
                errorBanner.style.color = '#ef4444';
                errorBanner.style.fontSize = '0.75rem';
                errorBanner.style.marginBottom = '0.5rem';
                errorBanner.style.fontStyle = 'italic';
                errorBanner.textContent = 'Failed to render diagram. Showing raw syntax:';
                preElement.prepend(errorBanner);
                
                // Ensure the pre block is visible
                preElement.style.display = 'block';
                preElement.style.opacity = '1';
            } finally {
                if (tempContainer.parentNode) {
                    document.body.removeChild(tempContainer);
                }
            }
        } catch (error) {
            console.error('[renderMermaidDiagrams] Setup error:', error);
            // Keep original preElement as is
        }
    }
}

async function copyMarkdownFromMessage(messageEl, buttonEl) {
    const text = messageEl.dataset.markdown || '';
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        const original = buttonEl.textContent;
        buttonEl.textContent = 'Copied';
        setTimeout(() => {
            buttonEl.textContent = original;
        }, 1500);
    } catch (error) {
        console.error('Copy failed:', error);
    }
}
