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
        loadingMsg.innerHTML = rendered;
    } catch (error) {
        loadingMsg.textContent = "Error communicating with AI.";
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

async function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', role);
    if (role === 'ai') {
        const rendered = await window.electronAPI.renderMarkdown(text);
        console.log("[appendMessage] AI message rendered");
        msgDiv.innerHTML = rendered;
    } else {
         msgDiv.textContent = text;
    }
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msgDiv;
}
