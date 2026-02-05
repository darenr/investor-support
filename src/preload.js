const { contextBridge, ipcRenderer } = require('electron');

// Safe dependency loading
let marked;
let DOMPurify;

try {
  // Try loading marked
  const markedModule = require('marked');
  // In v11 CJS, 'marked' property is the main function, or 'parse' function exists on root
  marked = markedModule.marked || markedModule.parse || markedModule;
} catch (e) {
  console.error("Preload Warning: Failed to load 'marked'. Markdown will be disabled.", e);
}

try {
  // Try loading dompurify
  const createDOMPurify = require('dompurify');
  DOMPurify = createDOMPurify(window);
} catch (e) {
  console.error("Preload Warning: Failed to load 'dompurify'. Markdown will be disabled.", e);
  // Fallback: simple text escaper if purify is missing? No, just disable md.
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
             // marked v11 usage: marked.parse(text) or marked(text)
             // We determined 'marked' variable holds the function or object having parse
             let html = "";
             if (typeof marked === 'function') {
                 html = marked(text);
             } else if (typeof marked.parse === 'function') {
                 html = marked.parse(text);
             } else {
                 console.warn("Marked misconfigured", marked);
                 return text;
             }
             
             // Sanitize
             return DOMPurify.sanitize(html);
          } catch (error) {
              console.error("Markdown rendering error:", error);
          }
      }
      console.warn("Markdown rendering disabled (dependencies missing).");
      return text;
  }
});
