// Modify this line at the top of main.js

const { app, BrowserWindow, BrowserView, ipcMain, screen, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const mime = require('mime-types');

console.log(`✅ The Electron version actually running is: ${process.versions.electron}`);
let win;
let views = [];
let browserView = null;
let currentViewIndex = 0;
let enabledModels = [true, true, true, true, true, true]; // All enabled by default
let isBrowserMode = false;
let notesOpen = false;


app.whenReady().then(() => {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile("index.html");
  const urls = [
    "https://chatgpt.com/",
    "https://claude.ai/",
    "https://gemini.google.com/",
    "https://grok.com/",  // Grok
    "https://chat.deepseek.com/",  // DeepSeek
    "https://www.perplexity.ai/"   // Perplexity
  ];

  const modelNames = ['ChatGPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Perplexity'];

  function resizeViews() {
    const { width: winWidth, height: winHeight } = win.getContentBounds();
    
    // Use percentage-based calculations for all measurements
    const topBarHeight = Math.floor(winHeight * 0.06);
    const toggleBarHeight = isBrowserMode ? 0 : Math.floor(winHeight * 0.03);
    const topOffset = topBarHeight + toggleBarHeight;
    const viewHeight = winHeight - topOffset;
    
    // MODIFIED: Calculate notesWidth regardless of the current mode.
    const notesWidth = notesOpen ? Math.floor(winWidth * 0.286) : 0;
    const availableWidth = winWidth - notesWidth;
    
    if (isBrowserMode && browserView) {
      // In browser mode, show only the browser view, occupying the available width.
      browserView.setBounds({
        x: 0,
        y: topOffset,
        width: availableWidth, // Use the correctly calculated availableWidth.
        height: viewHeight
      });
      
      // Hide all AI model views.
      views.forEach(view => {
        view.setBounds({
          x: -winWidth,
          y: topOffset,
          width: 0,
          height: viewHeight
        });
      });
      return;
    }
    
    // Normal AI model view logic using the calculated availableWidth
    const enabledIndices = [];
    enabledModels.forEach((enabled, index) => {
      if (enabled) {
        enabledIndices.push(index);
      }
    });
    
    const enabledCount = enabledIndices.length;
    const visibleEnabledCount = Math.min(3, enabledCount);
    
    const enabledViewWidth = visibleEnabledCount > 0 ? Math.floor(availableWidth / visibleEnabledCount) : 0;

    views.forEach((view, modelIndex) => {
      if (enabledModels[modelIndex]) {
        const enabledPosition = enabledIndices.indexOf(modelIndex);
        const viewPosition = enabledPosition - currentViewIndex;
        
        if (viewPosition >= 0 && viewPosition < visibleEnabledCount) {
          const x = viewPosition * enabledViewWidth;
          view.setBounds({ x, y: topOffset, width: enabledViewWidth, height: viewHeight });
        } else {
          view.setBounds({ x: -winWidth, y: topOffset, width: enabledViewWidth, height: viewHeight });
        }
      } else {
        view.setBounds({ x: -winWidth, y: topOffset, width: 0, height: viewHeight });
      }
    });

    if (browserView && !isBrowserMode) {
      browserView.setBounds({ x: -winWidth, y: topOffset, width: 0, height: viewHeight });
    }
  }

  // Create BrowserViews for AI models
  urls.forEach((url, index) => {
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    win.addBrowserView(view);
    views.push(view);
    view.webContents.loadURL(url);
  });

  // Create browser view for general browsing
  function createBrowserView() {
    if (!browserView) {
      browserView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true
        }
      });
      win.addBrowserView(browserView);
      browserView.webContents.loadURL("https://www.google.com");
      
      browserView.webContents.on('did-navigate', (event, url) => {
        win.webContents.send('browserNavigated', url);
        updateBrowserControls();
      });
      
      browserView.webContents.on('did-navigate-in-page', (event, url) => {
        win.webContents.send('browserNavigated', url);
        updateBrowserControls();
      });

      browserView.webContents.on('did-finish-load', () => {
        updateBrowserControls();
      });
    }
  }

  function updateBrowserControls() {
    if (browserView) {
      const canGoBack = browserView.webContents.canGoBack();
      const canGoForward = browserView.webContents.canGoForward();
      
      win.webContents.send('updateBrowserControls', { canGoBack, canGoForward });
    }
  }

  resizeViews();
  win.on("resize", resizeViews);

  ipcMain.on("enterBrowserMode", (event) => {
    isBrowserMode = true;
    createBrowserView();
    resizeViews();
  });

  ipcMain.on("exitBrowserMode", (event) => {
    isBrowserMode = false;
    resizeViews();
  });

  ipcMain.on("toggleNotes", (event, isOpen) => {
    notesOpen = isOpen;
    resizeViews();
  });

  ipcMain.on("navigateBrowser", (event, url) => {
    if (browserView) {
      try {
        browserView.webContents.loadURL(url);
      } catch (error) {
        console.error("Error navigating to URL:", error);
        if (!url.startsWith('https://')) {
          browserView.webContents.loadURL('https://' + url.replace(/^https?:\/\//, ''));
        }
      }
    }
  });

  ipcMain.on("browserBack", (event) => {
    if (browserView && browserView.webContents.canGoBack()) {
      browserView.webContents.goBack();
    }
  });

  ipcMain.on("browserForward", (event) => {
    if (browserView && browserView.webContents.canGoForward()) {
      browserView.webContents.goForward();
    }
  });

  ipcMain.on("browserReload", (event) => {
    if (browserView) {
      browserView.webContents.reload();
    }
  });

  ipcMain.on("updateModelStates", (event, newStates) => {
    enabledModels = newStates;
    
    const enabledCount = enabledModels.filter(enabled => enabled).length;
    const maxIndex = Math.max(0, enabledCount - 3);
    if (currentViewIndex > maxIndex) {
      currentViewIndex = maxIndex;
      event.reply("viewIndexUpdated", currentViewIndex);
    }
    
    resizeViews();
  });

  ipcMain.on("scroll", (event, direction) => {
    if (isBrowserMode) return;
    
    const enabledCount = enabledModels.filter(enabled => enabled).length;
    const maxIndex = Math.max(0, enabledCount - 3);
    
    if (direction === "left" && currentViewIndex > 0) {
      currentViewIndex--;
    } else if (direction === "right" && currentViewIndex < maxIndex) {
      currentViewIndex++;
    }
    
    resizeViews();
    event.reply("viewIndexUpdated", currentViewIndex);
  });

  function getMimeType(extension) {
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.rtf': 'application/rtf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.csv': 'text/csv',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  ipcMain.on("selectFiles", async (event) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] },
        { name: 'Data', extensions: ['csv', 'xls', 'xlsx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled) {
      const fileData = [];
      
      for (const filePath of result.filePaths) {
        try {
          const data = fs.readFileSync(filePath);
          const base64Data = data.toString('base64');
          const stats = fs.statSync(filePath);
          const extension = path.extname(filePath);
          
          fileData.push({
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
            type: extension.substring(1),
            mimeType: getMimeType(extension),
            data: `data:${getMimeType(extension)};base64,${base64Data}`
          });
        } catch (error)
        {
          console.error(`Error reading file ${filePath}:`, error);
        }
      }
      
      event.reply("filesSelected", fileData);
    }
  });

  ipcMain.on("sendPrompt", (event, prompt, modelStates) => {
    if (isBrowserMode) return;
    
    views.forEach(async (view, index) => {
      if (!modelStates[index]) {
        console.log(`Skipping disabled model: ${modelNames[index]}`);
        return;
      }

      try {
        const jsCode = `
          (function(){
            const url = window.location.hostname;
            console.log('Processing for:', url, 'Full URL:', window.location.href);
            
            function waitForElement(selector, timeout = 10000) {
              return new Promise((resolve) => {
                const existingElement = document.querySelector(selector);
                if (existingElement && (existingElement.offsetParent !== null || existingElement.tagName === 'TEXTAREA')) {
                  resolve(existingElement);
                  return;
                }
                
                const observer = new MutationObserver(() => {
                  const element = document.querySelector(selector);
                  if (element && (element.offsetParent !== null || element.tagName === 'TEXTAREA')) {
                    observer.disconnect();
                    resolve(element);
                  }
                });
                
                observer.observe(document.body, {
                  childList: true,
                  subtree: true,
                  attributes: true
                });
                
                setTimeout(() => {
                  observer.disconnect();
                  resolve(null);
                }, timeout);
              });
            }
            
            function fastReactInput(element, text) {
              console.log('Using fast React input for:', element);
              element.focus();
              element.click();
              if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
                element.value = '';
                element.setSelectionRange(0, 0);
              } else if (element.contentEditable === 'true') {
                element.textContent = '';
                element.innerHTML = '';
                while (element.firstChild) {
                  element.removeChild(element.firstChild);
                }
              }
              
              element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
              element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true }));
              
              const prototype = element.tagName === 'TEXTAREA' ? 
                HTMLTextAreaElement.prototype : 
                (element.tagName === 'INPUT' ? HTMLInputElement.prototype : null);
              
              const valueSetter = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;
              
              if (valueSetter && valueSetter.set) {
                valueSetter.set.call(element, text);
              } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
                element.value = text;
              } else if (element.contentEditable === 'true') {
                element.textContent = text;
                element.innerHTML = text;
              }
              
              const events = [
                new Event('focus', { bubbles: true }),
                new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }),
                new Event('change', { bubbles: true, cancelable: true }),
                new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }),
                new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true })
              ];
              
              events.forEach(event => element.dispatchEvent(event));
              
              const reactFiberKey = Object.keys(element).find(key => 
                key.startsWith('__reactInternalInstance') || 
                key.startsWith('__reactFiber') ||
                key.startsWith('__reactProps')
              );
              
              if (reactFiberKey && element[reactFiberKey]) {
                const fiberNode = element[reactFiberKey];
                if (fiberNode.memoizedProps) fiberNode.memoizedProps.value = text;
                if (fiberNode.stateNode) fiberNode.stateNode.value = text;
              }
              
              console.log('Fast React input complete');
              return Promise.resolve();
            }
            
            function genericSend(text) {
              const input = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
              if(input){
                input.focus();
                if(input.tagName === 'TEXTAREA' || input.tagName === 'INPUT'){
                  input.value = text;
                } else {
                  input.innerText = text;
                }
                input.dispatchEvent(new Event('input', { bubbles:true }));

                setTimeout(() => {
                  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles:true, key:'Enter', code:'Enter' }));
                }, 100);
              }
            }
            
            async function sendToOpenAI() {
              console.log('Attempting to send to ChatGPT...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const inputSelectors = ['#prompt-textarea', 'textarea[data-id="root"]', 'textarea[placeholder*="Message"]', 'textarea[placeholder*="Send a message"]', 'div[contenteditable="true"]', '[data-testid="textbox"]', 'textarea', '.text-base'];
              let input = null;
              for (const selector of inputSelectors) {
                input = await waitForElement(selector, 3000);
                if (input) break;
              }
              
              if (!input) { genericSend(${JSON.stringify(prompt)}); return; }
              
              await fastReactInput(input, ${JSON.stringify(prompt)});
              await new Promise(resolve => setTimeout(resolve, 300));
              
              const sendSelectors = ['button[data-testid="send-button"]', 'button[aria-label*="Send"]', '[data-testid="send-button"]', 'button:has(svg)', 'button[type="submit"]'];
              for (const selector of sendSelectors) {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) { if (button && !button.disabled && button.offsetParent !== null) { button.click(); return; } }
              }
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            }
            
            async function sendToClaude() {
              console.log('Attempting to send to Claude...');
              const inputSelectors = ['div[contenteditable="true"]', '.ProseMirror', 'textarea[placeholder*="Talk to Claude"]', 'textarea[placeholder*="message"]', 'div.ProseMirror'];
              let input = null;
              for (const selector of inputSelectors) {
                input = await waitForElement(selector, 3000);
                if (input) break;
              }
              
              if (!input) { genericSend(${JSON.stringify(prompt)}); return; }
              
              await fastReactInput(input, ${JSON.stringify(prompt)});
              await new Promise(resolve => setTimeout(resolve, 300));
              
              const sendSelectors = ['button[aria-label*="Send"]', 'button:has([data-icon="send"])', 'button[type="submit"]'];
              for (const selector of sendSelectors) {
                const button = document.querySelector(selector);
                if (button && !button.disabled) { button.click(); return; }
              }
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            }
            
            async function sendToGemini() {
              console.log('Attempting to send to Gemini...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              const genericInput = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
              if (genericInput && genericInput.offsetParent !== null) {
                genericInput.focus();
                if(genericInput.tagName === 'TEXTAREA' || genericInput.tagName === 'INPUT') { genericInput.value = ${JSON.stringify(prompt)}; }
                else { genericInput.innerText = ${JSON.stringify(prompt)}; }
                genericInput.dispatchEvent(new Event('input', { bubbles:true }));
                setTimeout(() => { genericInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles:true, key:'Enter', code:'Enter' })); }, 200);
                return;
              }
              
              console.log('Generic method failed, trying specific Gemini selectors');
              const inputSelectors = ['textarea[aria-label*="Enter a prompt"]', 'textarea[placeholder*="Enter a prompt"]', 'div[contenteditable="true"]', 'textarea[aria-label*="Message"]', 'rich-textarea textarea', '.ql-editor'];
              let input = null;
              for (const selector of inputSelectors) {
                input = document.querySelector(selector);
                if (input && input.offsetParent !== null) break;
              }
              if (input) {
                input.focus();
                if (input.tagName === 'TEXTAREA') { input.value = ${JSON.stringify(prompt)}; }
                else { input.textContent = ${JSON.stringify(prompt)}; }
                input.dispatchEvent(new Event('input', { bubbles: true }));
                setTimeout(() => {
                  const sendButton = document.querySelector('button[aria-label*="Send"], button[type="submit"]');
                  if (sendButton && !sendButton.disabled) { sendButton.click(); }
                  else { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));}
                }, 500);
              }
            }
            
            async function sendToGrok() {
              console.log('Attempting to send to Grok...');
              await new Promise(resolve => setTimeout(resolve, 3000));
              const inputSelectors = ['textarea[data-testid="composer-text-input"]', 'textarea[placeholder*="Ask Grok"]', 'textarea[placeholder*="What would you like to know"]', 'textarea[aria-label*="Message"]', 'div[data-testid="composer-text-input"]', 'div[contenteditable="true"][data-testid*="composer"]', 'textarea[data-testid*="composer"]', 'div[contenteditable="true"]', 'textarea'];
              let input = null;
              for (let i = 0; i < inputSelectors.length; i++) {
                const selector = inputSelectors[i];
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0 && !el.disabled && !el.readOnly) {
                    const isMainInput = !el.closest('[role="listbox"]') && !el.closest('.suggestion') && !el.textContent.includes('Refer to the following content');
                    if (isMainInput) { input = el; break; }
                  }
                }
                if (input) break;
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
              if (input) {
                await fastReactInput(input, ${JSON.stringify(prompt)});
                await new Promise(resolve => setTimeout(resolve, 1000));
                const sendSelectors = ['button[data-testid="send-button"]', 'button[aria-label*="Send message"]', 'button[aria-label*="Send"]', 'button[title*="Send"]', 'button:has(svg[data-testid*="send"])', 'form button[type="submit"]', 'button:not([disabled]):has(svg)', '[role="button"][data-testid*="send"]'];
                let sent = false;
                for (const selector of sendSelectors) {
                  const buttons = document.querySelectorAll(selector);
                  for (const button of buttons) { if (button && !button.disabled && button.offsetParent !== null) { button.click(); sent = true; break; } }
                  if (sent) break;
                }
                if (!sent) { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })); }
              } else { genericSend(${JSON.stringify(prompt)}); }
            }
            
            async function sendToDeepSeek() {
              console.log('Attempting to send to DeepSeek...');
              await new Promise(resolve => setTimeout(resolve, 3000));
              const inputSelectors = ['textarea[placeholder*="Message DeepSeek"]', 'textarea[placeholder*="DeepSeek-V3"]', 'textarea[placeholder*="Send a message"]', 'textarea[placeholder*="Message"]', 'textarea[data-testid*="composer"]', 'textarea[aria-label*="Message"]', 'div[contenteditable="true"][role="textbox"]', '.composer textarea', '.chat-input textarea', 'div[contenteditable="true"]', 'textarea'];
              let input = null;
              for (const selector of inputSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0 && !el.disabled && !el.readOnly) { input = el; break; }
                }
                if (input) break;
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
              if (input) {
                await fastReactInput(input, ${JSON.stringify(prompt)});
                await new Promise(resolve => setTimeout(resolve, 800));
                const sendSelectors = ['button[aria-label*="Send message"]', 'button[title*="Send message"]', 'button[data-testid*="send"]', 'button:has(svg[data-testid*="send"])', 'button[aria-label*="Send"]', 'button[title*="Send"]', 'button[type="submit"]', 'button:has(svg)', 'button:not([disabled])'];
                let sent = false;
                for (const selector of sendSelectors) {
                  const buttons = document.querySelectorAll(selector);
                  for (const button of buttons) {
                    const rect = button.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && !button.disabled) { try { button.click(); sent = true; break; } catch (error) { continue; } }
                  }
                  if (sent) break;
                }
                if (!sent) { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })); }
              } else { genericSend(${JSON.stringify(prompt)}); }
            }
            
            async function sendToPerplexity() {
              console.log('Attempting to send to Perplexity...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              const inputSelectors = ['textarea[placeholder*="Ask anything"]', 'textarea[placeholder*="Ask"]', 'textarea[placeholder*="Question"]', 'div[contenteditable="true"]', 'textarea', 'input[type="text"]'];
              let input = null;
              for (const selector of inputSelectors) {
                input = await waitForElement(selector, 3000);
                if (input) break;
              }
              
              if (!input) { genericSend(${JSON.stringify(prompt)}); return; }
              
              await fastReactInput(input, ${JSON.stringify(prompt)});
              await new Promise(resolve => setTimeout(resolve, 300));
              const sendSelectors = ['button[aria-label*="Submit"]', 'button[type="submit"]', 'button:has(svg)', '.submit-button'];
              for (const selector of sendSelectors) {
                const button = document.querySelector(selector);
                if (button && !button.disabled) { button.click(); return; }
              }
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            }
            
            if (url.includes("openai.com") || url.includes("chatgpt.com")) sendToOpenAI();
            else if (url.includes("claude.ai")) sendToClaude();
            else if (url.includes("gemini.google.com")) sendToGemini();
            else if (url.includes("grok.com")) sendToGrok();
            else if (url.includes("deepseek.com")) sendToDeepSeek();
            else if (url.includes("perplexity.ai")) sendToPerplexity();
            else { console.log('Unknown platform:', url); genericSend(${JSON.stringify(prompt)}); }
          })();
        `;
        
        await view.webContents.executeJavaScript(jsCode);
        console.log(`Sent prompt to enabled model ${index}: ${modelNames[index]}`);
      } catch (error) {
        console.error(`Error sending to view ${index}:`, error);
      }
    });
  });

// Replace the existing sendFiles handler in main.js with this enhanced version

// Replace the Gemini section in your sendFiles handler with this approach

// Replace the Gemini section in your sendFiles handler with this corrected version

ipcMain.on("sendFiles", async (event, { prompt, files }, modelStates) => {
  if (isBrowserMode || files.length === 0) return;

  const filePaths = files.map(f => f.path);

  for (let index = 0; index < views.length; index++) {
    if (!modelStates[index]) {
      continue;
    }

    const modelName = modelNames[index];
    const view = views[index];
    const wc = view.webContents;

    if (modelName === 'Gemini') {
      try {
        console.log(`[GEMINI] Providing manual upload assistance for ${files.length} file(s)...`);
        
        // Create file list for display
        const fileListHtml = files.map(f => `<div style="padding: 4px 0; font-size: 12px;">File: ${f.name}</div>`).join('');
        
        // Show visual indicator on the Gemini page
        await wc.executeJavaScript(`
          (function() {
            // Remove any existing upload indicators
            const existingIndicator = document.querySelector('#gemini-upload-indicator');
            if (existingIndicator) {
              existingIndicator.remove();
            }
            
            // Create upload assistance overlay
            const indicator = document.createElement('div');
            indicator.id = 'gemini-upload-indicator';
            indicator.style.cssText = 'position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #4285f4, #34a853); color: white; padding: 16px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; font-family: system-ui, sans-serif; font-size: 14px; max-width: 320px;';
            
            indicator.innerHTML = 
              '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">' +
              '<div style="width: 24px; height: 24px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">📎</div>' +
              '<strong>Manual File Upload Required</strong>' +
              '</div>' +
              '<div style="margin-bottom: 8px; font-size: 13px; opacity: 0.9;">Please upload these files to Gemini:</div>' +
              '<div style="margin-bottom: 12px;">' + '${fileListHtml}' + '</div>' +
              '<div style="font-size: 12px; opacity: 0.8;">Use the attachment button and select the files listed above.</div>' +
              '<button onclick="this.parentElement.remove()" style="position: absolute; top: 8px; right: 8px; background: none; border: none; color: white; cursor: pointer; font-size: 18px; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>';
            
            document.body.appendChild(indicator);
            
            // Auto-remove after 15 seconds
            setTimeout(() => {
              const currentIndicator = document.querySelector('#gemini-upload-indicator');
              if (currentIndicator) {
                currentIndicator.remove();
              }
            }, 15000);
            
            // Try to highlight the attachment button
            const attachBtn = document.querySelector('[aria-label*="Attach"], [title*="attach"], button[aria-label*="Add"]');
            if (attachBtn) {
              attachBtn.style.outline = '3px solid #4285f4';
              attachBtn.style.outlineOffset = '2px';
              setTimeout(() => {
                if (attachBtn.style.outline) {
                  attachBtn.style.outline = '';
                  attachBtn.style.outlineOffset = '';
                }
              }, 10000);
            }
          })();
        `);
        
        // Show system notification
        const fileNames = files.map(f => f.name).join('\n• ');
        const result = await dialog.showMessageBox(win, {
          type: 'info',
          title: 'Gemini File Upload',
          message: 'Manual upload required for Gemini',
          detail: `Gemini requires manual file uploads due to security restrictions.\n\nPlease upload these files:\n• ${fileNames}\n\nUse the attachment button in Gemini to select and upload these files.`,
          buttons: ['OK', 'Open File Location', 'Copy File Paths'],
          defaultId: 0
        });

        // Handle user response
        if (result.response === 1) {
          // Open file location in system file manager
          const { shell } = require('electron');
          shell.showItemInFolder(files[0].path);
        } else if (result.response === 2) {
          // Copy file paths to clipboard
          const { clipboard } = require('electron');
          const pathsList = files.map(f => f.path).join('\n');
          clipboard.writeText(pathsList);
        }

        console.log(`[GEMINI] Manual upload assistance provided for ${files.length} file(s)`);
        
      } catch (err) {
        console.error(`[GEMINI] Error providing upload assistance:`, err.message);
      }
      continue; // Skip to next model
    }

    // Keep existing debugger method for other models
    const isAttached = wc.debugger.isAttached();
    try {
      if (!isAttached) await wc.debugger.attach('1.3');
      await wc.executeJavaScript(`(function() { const btn = document.querySelector('button[data-testid="paperclip-button"], button[aria-label*="Attach"], button[aria-label*="Upload"]'); if (btn) btn.click(); })();`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { root: { nodeId: documentNodeId } } = await wc.debugger.sendCommand('DOM.getDocument');
      const { nodeId: inputNodeId } = await wc.debugger.sendCommand('DOM.querySelector', { nodeId: documentNodeId, selector: 'input[type="file"]' });
      if (inputNodeId === 0) throw new Error('File input node was not found in the DOM.');
      await wc.debugger.sendCommand('DOM.setFileInputFiles', { nodeId: inputNodeId, files: filePaths });
      console.log(`[DEBUGGER] Successfully set ${filePaths.length} files for ${modelName}`);
    } catch (err) {
      console.error(`[DEBUGGER] Error during file upload for ${modelName}:`, err.message);
    } finally {
      if (wc.debugger.isAttached()) await wc.debugger.detach();
    }
  }
});
});