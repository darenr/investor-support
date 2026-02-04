const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let mainWindow;
let pdfContent = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Open PDF',
        click: async () => {
          const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'PDFs', extensions: ['pdf'] }],
          });
          if (!canceled && filePaths.length > 0) {
            loadFile(filePaths[0]);
          }
        },
      },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  {
    label: 'Analyze',
    submenu: [
      {
        label: 'Open Analyze Menu',
        click: () => {
          mainWindow.webContents.send('menu:analyze');
        },
      },
    ],
  },
  {
      label: 'Edit',
      submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
      ]
  },
  {
    label: "View",
    submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
    ]
}
];

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

async function loadFile(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    pdfContent = data.text;
    mainWindow.webContents.send('file:loaded', path.basename(filePath));
  } catch (error) {
    console.error('Error reading PDF:', error);
    dialog.showErrorBox('Error', 'Failed to read the PDF file.');
  }
}

async function callAI(prompt, systemInstruction = null) {
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let contextPrompt = `Thinking context (Document content): \n${pdfContent.substring(0, 100000)}\n\nUser Question: ${prompt}`; // Truncate to avoid context limits blindly, though 100k chars is a lot.
  
  if (systemInstruction) {
      contextPrompt = `${systemInstruction}\n\n${contextPrompt}`;
  }

  if (openAiKey) {
    const openai = new OpenAI({ apiKey: openAiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: contextPrompt }],
    });
    return response.choices[0].message.content;
  } else if (geminiKey) {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const result = await model.generateContent(contextPrompt);
    const response = await result.response;
    return response.text();
  } else {
    throw new Error('No API Key found (OPENAI_API_KEY or GEMINI_API_KEY)');
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('ai:ask', async (event, question) => {
    if (!pdfContent) {
      return "Please open a PDF file first.";
    }
    try {
      return await callAI(question, "You are a helpful assistant analyzing an investor document.");
    } catch (e) {
      return `Error: ${e.message}`;
    }
  });

  ipcMain.handle('ai:task', async (event, taskType) => {
    if (!pdfContent) {
      return "Please open a PDF file first.";
    }
    
    let prompt = "";
    if (taskType === 'summarize') {
      prompt = "Please provide a comprehensive summary of this document, highlighting key value propositions, financials, and team details.";
    } else if (taskType === 'tech-questions') {
      prompt = "Based on the technical details in this document, please prepare a list of 5-10 technical due diligence questions to ask the team.";
    } else {
        return "Unknown task";
    }

    try {
      return await callAI(prompt);
    } catch (e) {
      return `Error: ${e.message}`;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
