const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const { OpenAI } = require('openai');
const { GoogleGenAI } = require('@google/genai');
const { marked } = require('marked');

let mainWindow;
let pdfContent = '';
const modelName = process.env.MODEL_NAME || 'gpt-5-nano';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: `Investor Support - ${modelName}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Open the DevTools for debugging
  mainWindow.webContents.openDevTools();
}

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Open PDF',
        click: async () => {
           mainWindow.webContents.send('app:status', 'Opening file dialog...');
          const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'PDFs', extensions: ['pdf'] }],
          });
          if (!canceled && filePaths.length > 0) {
            loadFile(filePaths[0]);
          } else {
             mainWindow.webContents.send('app:status', 'Open cancelled.');
          }
        },
      },
      { type: 'separator' },
      { role: 'quit' },
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
    mainWindow.webContents.send('app:status', `Reading file: ${path.basename(filePath)}...`);
    // Small delay to allow UI to update if operation is blocking (readFileSync is blocking)
    // using readFile async would be better, but staying consistent for now.
    // However, since we send an IPC message, it's async nature helps.
    
    // Better: Read async to not freeze main process
    const dataBuffer = await fs.promises.readFile(filePath);
    
    mainWindow.webContents.send('app:status', 'Parsing PDF...');
    const data = await pdf(dataBuffer);
    
    pdfContent = data.text;
    mainWindow.webContents.send('file:loaded', path.basename(filePath));
    mainWindow.webContents.send('app:status', 'File loaded successfully.');
  } catch (error) {
    console.error('Error reading PDF:', error);
    mainWindow.webContents.send('app:status', `Error: ${error.message}`);
    dialog.showErrorBox('Error', `Failed to read the PDF file.\n\nDetails: ${error.message}`);
  }
}

async function callAI(prompt, systemInstruction = null) {
  const modelName = process.env.MODEL_NAME || 'gpt-5-nano';
  const isOpenAI = modelName.toLowerCase().startsWith('gpt');

  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let contextPrompt = `Thinking context (Document content): \n${pdfContent.substring(0, 100000)}\n\nUser Question: ${prompt}`; // Truncate to avoid context limits blindly, though 100k chars is a lot.

  if (systemInstruction) {
      contextPrompt = `${systemInstruction}\n\n${contextPrompt}`;
  }

  if (isOpenAI) {
    if (!openAiKey) {
      throw new Error('OPENAI_API_KEY is required for GPT models');
    }
    mainWindow.webContents.send('app:status', `Calling OpenAI model: ${modelName}...`);
    const openai = new OpenAI({ apiKey: openAiKey });
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: contextPrompt }],
    });
    mainWindow.webContents.send('app:status', 'OpenAI response received.');
    return response.choices[0].message.content;
  }

  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is required for Gemini models');
  }
  mainWindow.webContents.send('app:status', `Calling Gemini model: ${modelName}...`);
  const client = new GoogleGenAI({ apiKey: geminiKey });
  const response = await client.models.generateContent({
    model: modelName,
    contents: contextPrompt,
  });
  mainWindow.webContents.send('app:status', 'Gemini response received.');
  return response.text;
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('model:get', () => {
    return modelName;
  });

  // Markdown rendering handler
  ipcMain.handle('markdown:render', async (event, text) => {
    try {
      return marked(text);
    } catch (e) {
      console.error("Markdown rendering error:", e);
      return text; // Fallback to plain text
    }
  });

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
