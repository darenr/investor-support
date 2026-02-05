const { contextBridge, ipcRenderer } = require('electron');

// Safe dependency loading
let marked;
let DOMPurify;

try {
  // Try loading marked
  const markedModule = require('marked');
  marked = markedModule.marked || markedModule;
} catch (e) {
  console.error("Preload Warning: Failed to load 'marked'. Markdown will be disabled.", e);
}

try {
  // Try loading dompurify
  const createDOMPurify = require('dompurify');
  DOMPurify = createDOMPurify(window);
} catch (e) {
  console.error("Preload Warning: Failed to load 'dompurify'. Markdown will be disabled.", e);
}

contextBridge.exposeInMainWorld('electronAPI', {
  onFileLoaded: (callback) => ipcRenderer.on('file:loaded', callback),
  onAppStatus: (callback) => ipcRenderer.on('app:status', callback),
  onMenuAnalyze: (callback) => ipcRenderer.on('menu:analyze', callback),
  askAI: (question) => ipcRenderer.invoke('ai:ask', question),
  runTask: (taskType) => ipcRenderer.invoke('ai:task', taskType),
  renderMarkdown: (text) => {
      // Defensive rendering
      if (DOMPurify && marked) {
          try {
             // Handle both marked.parse(text) and marked(text)
             const parser = (typeof marked.parse === 'function') ? marked.parse : marked;
             if (typeof parser === 'function') {
                 return DOMPurify.sanitize(parser(text));
             }
          } catch (error) {
              console.error("Markdown rendering error:", error);
          }
      }
      // Fallback to plain text if anything failed
      return text;
  }
});
