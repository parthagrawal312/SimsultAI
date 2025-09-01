const { ipcRenderer } = require("electron");

let currentViewIndex = 0;
const totalViews = 6;
const visibleViews = 3;

// Track which models are enabled (all enabled by default)
let enabledModels = [true, true, true, true, true, true];
const modelNames = ['ChatGPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Perplexity'];

// File upload state
let selectedFiles = [];

// Notes state
let notesOpen = false;
let currentNote = {
  title: '',
  tag: '',
  content: '',
  timestamp: null
};

/**
 * NEW FUNCTION
 * Manages the tooltip for the main send/upload button.
 * The tooltip warns the user about manual uploads for Gemini.
 */
function updateSendButtonTooltip() {
  const sendBtn = document.getElementById('sendBtn');
  if (!sendBtn) return; // Guard clause in case the button isn't ready

  const geminiModelIndex = 2; // 'Gemini' is at index 2
  const isGeminiEnabled = enabledModels[geminiModelIndex];
  const tooltipMessage = "Upload to all isn’t available for Gemini. Please upload manually to Gemini.";

  // Show the tooltip only if files are selected AND Gemini is enabled.
  if (selectedFiles.length > 0 && isGeminiEnabled) {
    sendBtn.title = tooltipMessage;
  } else {
    // Clear the tooltip in all other cases (no files, or Gemini disabled).
    sendBtn.title = '';
  }
}

/**
 * MODIFIED FUNCTION
 * Handles sending text prompts or initiating file uploads.
 */
function send() {
  const prompt = document.getElementById("prompt").value.trim();

  // Check if we have either a prompt or files
  if (!prompt && selectedFiles.length === 0) {
    alert("Please enter a prompt or select files to send");
    return;
  }

  // Check if at least one model is enabled
  const hasEnabledModels = enabledModels.some(enabled => enabled);
  if (!hasEnabledModels) {
    alert("Please enable at least one AI model");
    return;
  }

  // Handle file uploads
  if (selectedFiles.length > 0) {
    // Send files to the main process for upload.
    // The prompt is explicitly empty because the input is disabled.
    ipcRenderer.send("sendFiles", {
      prompt: '',
      files: selectedFiles
    }, enabledModels);

    // Provide immediate visual feedback on the button
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.textContent = '✓ Uploaded!';
    sendBtn.disabled = true;

    // After a 2-second delay for feedback, clear the files and reset the UI
    setTimeout(() => {
      sendBtn.disabled = false; // Re-enable button before clearing
      clearFiles();
    }, 2000);

  } else {
    // Handle text prompt sending
    ipcRenderer.send("sendPrompt", prompt, enabledModels);
    // Clear the input after sending
    document.getElementById("prompt").value = "";
  }
}

function selectFiles() {
  ipcRenderer.send("selectFiles");
}

function clearFiles() {
  selectedFiles = [];
  updateFileDisplay();
}

/**
 * MODIFIED FUNCTION
 * Controls the UI state based on whether files are selected.
 */
function updateFileDisplay() {
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const promptInput = document.getElementById('prompt');
  const sendBtn = document.getElementById('sendBtn');

  if (selectedFiles.length > 0) {
    // Show file info display
    fileInfo.style.display = 'flex';

    if (selectedFiles.length === 1) {
      fileName.textContent = selectedFiles[0].name;
    } else {
      fileName.textContent = `${selectedFiles.length} files selected`;
    }

    // --- UI Change Logic ---
    // 1. Disable the prompt input
    promptInput.disabled = true;
    promptInput.value = ''; // Clear any existing text
    promptInput.placeholder = 'Prompt is disabled when files are attached.';
    // 2. Rename the send button
    sendBtn.textContent = 'Upload to All';

  } else {
    // --- UI Reset Logic ---
    // 1. Hide the file info display
    fileInfo.style.display = 'none';
    // 2. Re-enable the prompt input
    promptInput.disabled = false;
    // 3. Revert the send button text
    sendBtn.textContent = 'Send to All';
    // 4. Restore the dynamic placeholder text
    updatePromptPlaceholder();
  }
  // Update the tooltip state regardless of the path taken
  updateSendButtonTooltip();
}

/**
 * MODIFIED FUNCTION
 * Toggles a model's enabled state and updates the UI.
 */
function toggleModel(modelIndex) {
  // Toggle the model state
  enabledModels[modelIndex] = !enabledModels[modelIndex];

  // Update the toggle switch UI
  const toggle = document.querySelector(`.model-toggle[data-model="${modelIndex}"] .toggle-switch`);
  const modelToggle = document.querySelector(`.model-toggle[data-model="${modelIndex}"]`);

  if (enabledModels[modelIndex]) {
    toggle.classList.add('active');
    modelToggle.classList.remove('disabled');
  } else {
    toggle.classList.remove('active');
    modelToggle.classList.add('disabled');
  }

  // Send the updated model states to main process
  ipcRenderer.send("updateModelStates", enabledModels);

  // Update navigation and status
  updateNavigationButtons();
  updatePromptPlaceholder();

  // Update the tooltip in case Gemini was toggled
  updateSendButtonTooltip();
}

function scrollViews(direction) {
  // Only scroll if there are enabled models to show and not in browser mode
  const enabledCount = enabledModels.filter(enabled => enabled).length;
  if (enabledCount === 0 || document.body.classList.contains('browser-mode')) return;

  ipcRenderer.send("scroll", direction);

  // Calculate the effective view limit based on enabled models
  const maxViewIndex = Math.max(0, enabledCount - Math.min(visibleViews, enabledCount));

  // Update local tracking
  if (direction === "left" && currentViewIndex > 0) {
    currentViewIndex--;
  } else if (direction === "right" && currentViewIndex < maxViewIndex) {
    currentViewIndex++;
  }

  updateNavigationButtons();
}

function updateNavigationButtons() {
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");

  const enabledCount = enabledModels.filter(enabled => enabled).length;
  const maxViewIndex = Math.max(0, enabledCount - Math.min(visibleViews, enabledCount));

  // Disable left button if at the beginning
  leftBtn.disabled = currentViewIndex === 0 || enabledCount === 0;

  // Disable right button if at the end or no models
  rightBtn.disabled = currentViewIndex >= maxViewIndex || enabledCount === 0;

  // Update status indicator
  const statusIndicator = document.querySelector(".status-indicator");
  if (enabledCount === 0) {
    statusIndicator.textContent = "No models enabled";
  } else {
    const visibleCount = Math.min(visibleViews, enabledCount);
    const startModel = currentViewIndex + 1;
    const endModel = Math.min(currentViewIndex + visibleCount, enabledCount);
    statusIndicator.textContent = `Showing ${startModel}-${endModel} of ${enabledCount} enabled models`;
  }
}

function updatePromptPlaceholder() {
  const promptInput = document.getElementById("prompt");
  // Do not change placeholder if files are selected (handled by updateFileDisplay)
  if (promptInput.disabled) return;

  const enabledCount = enabledModels.filter(enabled => enabled).length;
  const enabledModelNames = modelNames.filter((_, index) => enabledModels[index]);

  if (enabledCount === 0) {
    promptInput.placeholder = "Enable at least one AI model to continue...";
    promptInput.disabled = true;
  } else if (enabledCount === 1) {
    promptInput.placeholder = `Type prompt for ${enabledModelNames[0]}...`;
    promptInput.disabled = false;
  } else if (enabledCount <= 3) {
    promptInput.placeholder = `Type prompt for ${enabledModelNames.join(', ')}...`;
    promptInput.disabled = false;
  } else {
    promptInput.placeholder = `Type prompt for ${enabledCount} enabled AI models...`;
    promptInput.disabled = false;
  }
}

// Browser mode functions (defined globally for HTML access)
window.toggleBrowserMode = function() {
  document.body.classList.add('browser-mode');

  // Hide AI-related controls
  document.getElementById('prompt').style.display = 'none';
  document.getElementById('sendBtn').style.display = 'none';
  document.getElementById('fileBtn').style.display = 'none';
  document.getElementById('leftBtn').style.display = 'none';
  document.getElementById('rightBtn').style.display = 'none';
  document.getElementById('newTabBtn').style.display = 'none';
  document.getElementById('statusIndicator').style.display = 'none';
  document.getElementById('fileInfo').style.display = 'none';

  // Show browser controls
  document.getElementById('urlInput').style.display = 'block';
  document.getElementById('goBtn').style.display = 'block';
  document.getElementById('closeTabBtn').style.display = 'block';
  document.getElementById('modeIndicator').style.display = 'block';
  document.getElementById('browserControls').style.display = 'flex';

  // Update layout for browser mode
  updateLayoutForMode();

  // Focus on URL input
  document.getElementById('urlInput').focus();

  // Notify main process
  ipcRenderer.send('enterBrowserMode');
};

window.closeBrowserMode = function() {
  document.body.classList.remove('browser-mode');

  // Show AI-related controls
  document.getElementById('prompt').style.display = 'block';
  document.getElementById('sendBtn').style.display = 'block';
  document.getElementById('fileBtn').style.display = 'block';
  document.getElementById('leftBtn').style.display = 'block';
  document.getElementById('rightBtn').style.display = 'block';
  document.getElementById('newTabBtn').style.display = 'block';
  document.getElementById('statusIndicator').style.display = 'block';
  if (selectedFiles.length > 0) {
    document.getElementById('fileInfo').style.display = 'flex';
  }

  // Hide browser controls
  document.getElementById('urlInput').style.display = 'none';
  document.getElementById('goBtn').style.display = 'none';
  document.getElementById('closeTabBtn').style.display = 'none';
  document.getElementById('modeIndicator').style.display = 'none';
  document.getElementById('browserControls').style.display = 'none';

  // Clear URL input
  document.getElementById('urlInput').value = '';

  // Update layout for AI mode
  updateLayoutForMode();

  // Focus back on prompt
  document.getElementById('prompt').focus();

  // Notify main process
  ipcRenderer.send('exitBrowserMode');
};

// Update layout based on current mode
function updateLayoutForMode() {
  const isBrowserMode = document.body.classList.contains('browser-mode');
  const contentArea = document.getElementById('contentArea');

  if (isBrowserMode) {
    // Browser mode: only top bar, no toggle bar
    contentArea.style.height = "calc(100vh - 6vh)";
  } else {
    // AI mode: top bar + toggle bar
    contentArea.style.height = "calc(100vh - 6vh - 3vh)";
  }
}

window.navigateToUrl = function() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) {
    alert('Please enter a URL');
    return;
  }

  // Add protocol if missing
  let fullUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    fullUrl = 'https://' + url;
  }

  // Clear the input after navigating
  document.getElementById('urlInput').value = '';

  // Notify main process to navigate
  ipcRenderer.send('navigateBrowser', fullUrl);
};

// Browser navigation functions
window.browserBack = function() {
  ipcRenderer.send('browserBack');
};

window.browserForward = function() {
  ipcRenderer.send('browserForward');
};

window.browserReload = function() {
  ipcRenderer.send('browserReload');
};

// Notes functionality
function toggleNotesPanel() {
  const notesPanel = document.getElementById('notesPanel');
  const notesBtn = document.getElementById('notesBtn');

  notesOpen = !notesOpen;

  if (notesOpen) {
    notesPanel.classList.add('open');
    notesBtn.classList.add('active');
    document.body.classList.add('notes-open');
    document.getElementById('noteEditor').focus();
  } else {
    notesPanel.classList.remove('open');
    notesBtn.classList.remove('active');
    document.body.classList.remove('notes-open');
  }

  // Notify main process about notes panel state
  ipcRenderer.send("toggleNotes", notesOpen);
}

function formatText(command) {
  const editor = document.getElementById('noteEditor');
  editor.focus();
  document.execCommand(command, false, null);
  updateWordCount();
}

function insertList(type) {
  const editor = document.getElementById('noteEditor');
  editor.focus();
  if (type === 'ul') {
    document.execCommand('insertUnorderedList', false, null);
  } else {
    document.execCommand('insertOrderedList', false, null);
  }
  updateWordCount();
}

function insertTimestamp() {
  const editor = document.getElementById('noteEditor');
  const timestamp = new Date().toLocaleString();
  editor.focus();

  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const timestampNode = document.createTextNode(`[${timestamp}] `);
  range.insertNode(timestampNode);

  // Move cursor after timestamp
  range.setStartAfter(timestampNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  updateWordCount();
}

function clearEditor() {
  if (confirm('Are you sure you want to clear all text?')) {
    document.getElementById('noteEditor').innerHTML = '';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteTag').value = '';
    updateWordCount();
  }
}

function updateWordCount() {
  const editor = document.getElementById('noteEditor');
  const text = editor.textContent || editor.innerText || '';
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const chars = text.length;

  document.getElementById('wordCount').textContent = `${words} words, ${chars} characters`;
}

function saveNote() {
  const title = document.getElementById('noteTitle').value.trim() || 'Untitled Note';
  const tag = document.getElementById('noteTag').value.trim();
  const content = document.getElementById('noteEditor').innerHTML;
  const textContent = document.getElementById('noteEditor').textContent || '';

  if (!textContent.trim()) {
    alert('Please add some content to save.');
    return;
  }

  const timestamp = new Date().toISOString();
  const noteData = {
    title,
    tag,
    content,
    textContent,
    timestamp,
    wordCount: textContent.trim().split(/\s+/).length,
    charCount: textContent.length
  };

  // Create downloadable file
  const noteText = `${title}\n${'='.repeat(title.length)}\n\n` +
                  (tag ? `Tag: ${tag}\n` : '') +
                  `Created: ${new Date(timestamp).toLocaleString()}\n` +
                  `Words: ${noteData.wordCount} | Characters: ${noteData.charCount}\n\n` +
                  textContent;

  const blob = new Blob([noteText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Show success message
  const saveBtn = document.querySelector('.notes-actions .btn-primary');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = '✓ Saved!';
  saveBtn.style.background = '#28a745';
  setTimeout(() => {
    saveBtn.textContent = originalText;
    saveBtn.style.background = '#007bff';
  }, 2000);
}

// Listen for browser navigation updates
ipcRenderer.on('browserNavigated', (event, url) => {
  // Don't update URL input as user might be typing
  console.log('Browser navigated to:', url);
});

// Listen for browser controls state updates
ipcRenderer.on('updateBrowserControls', (event, { canGoBack, canGoForward }) => {
  const backBtn = document.getElementById('backBtn');
  const forwardBtn = document.getElementById('forwardBtn');

  if (backBtn) backBtn.disabled = !canGoBack;
  if (forwardBtn) forwardBtn.disabled = !canGoForward;
});

// Listen for file selection responses
ipcRenderer.on('filesSelected', (event, files) => {
  selectedFiles = files;
  updateFileDisplay();
});

// Listen for model state updates from main process
ipcRenderer.on("modelStatesUpdated", (event, states) => {
  enabledModels = states;
  updateNavigationButtons();
  updatePromptPlaceholder();
});

// Listen for view index updates from main process
ipcRenderer.on("viewIndexUpdated", (event, newIndex) => {
  currentViewIndex = newIndex;
  updateNavigationButtons();
});

// Initialize navigation buttons and UI on load
document.addEventListener("DOMContentLoaded", function() {
  
  updateNavigationButtons();
  updatePromptPlaceholder();
  updateLayoutForMode(); // Ensure proper layout on load
  updateSendButtonTooltip(); // Set initial tooltip state

  // Set up event listeners for Enter key handling
  const promptInput = document.getElementById('prompt');
  const urlInput = document.getElementById('urlInput');

  // Handle Enter key press in prompt input field
  if (promptInput) {
    promptInput.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        send();
      }
    });
  }

  // Handle Enter key press in URL input field
  if (urlInput) {
    urlInput.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        navigateToUrl();
      }
    });
  }

  // Set up notes editor event listeners
  const noteEditor = document.getElementById('noteEditor');
  if (noteEditor) {
    noteEditor.addEventListener('input', updateWordCount);
    noteEditor.addEventListener('keyup', updateWordCount);
    noteEditor.addEventListener('paste', () => setTimeout(updateWordCount, 100));
  }

  // Add keyboard shortcuts
  document.addEventListener("keydown", function(event) {
    // Don't process shortcuts if in an input field (except for specific shortcuts)
    const activeElement = document.activeElement;
    const isInInput = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );

    // Ctrl/Cmd + S to save notes (when notes panel is open)
    if ((event.ctrlKey || event.metaKey) && event.key === 's' && notesOpen) {
      event.preventDefault();
      saveNote();
    }
    // Ctrl/Cmd + N to toggle notes panel
    else if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      event.preventDefault();
      toggleNotesPanel();
    }
    // Ctrl/Cmd + U to upload files
    else if ((event.ctrlKey || event.metaKey) && event.key === 'u') {
      event.preventDefault();
      selectFiles();
    }
    // Ctrl/Cmd + Left Arrow for browser back or view scroll
    else if ((event.ctrlKey || event.metaKey) && event.key === "ArrowLeft") {
      event.preventDefault();
      if (document.body.classList.contains('browser-mode')) {
        browserBack();
      } else {
        scrollViews("left");
      }
    }
    // Ctrl/Cmd + Right Arrow for browser forward or view scroll
    else if ((event.ctrlKey || event.metaKey) && event.key === "ArrowRight") {
      event.preventDefault();
      if (document.body.classList.contains('browser-mode')) {
        browserForward();
      } else {
        scrollViews("right");
      }
    }
    // F5 or Ctrl/Cmd + R for reload in browser mode
    else if ((event.key === "F5" || ((event.ctrlKey || event.metaKey) && event.key === "r")) && document.body.classList.contains('browser-mode')) {
      event.preventDefault();
      browserReload();
    }
    // Ctrl/Cmd + Enter to send (works in prompt input)
    else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (document.body.classList.contains('browser-mode')) {
        navigateToUrl();
      } else {
        send();
      }
    }
    // Ctrl/Cmd + T for new tab
    else if ((event.ctrlKey || event.metaKey) && event.key === "t") {
      event.preventDefault();
      if (!document.body.classList.contains('browser-mode')) {
        toggleBrowserMode();
      }
    }
    // Escape to close browser mode or notes panel
    else if (event.key === "Escape") {
      event.preventDefault();
      if (document.body.classList.contains('browser-mode')) {
        closeBrowserMode();
      } else if (notesOpen) {
        toggleNotesPanel();
      }
    }
    // Number keys 1-6 to toggle models (only when not in input and not in browser mode)
    else if (!isInInput && !document.body.classList.contains('browser-mode') && event.key >= "1" && event.key <= "6") {
      const modelIndex = parseInt(event.key) - 1;
      if ((event.ctrlKey || event.metaKey) && modelIndex < totalViews) {
        event.preventDefault();
        toggleModel(modelIndex);
      }
    }
  });

  // Add click handlers for toggle labels
  document.querySelectorAll('.model-toggle label').forEach((label, index) => {
    label.addEventListener('click', () => toggleModel(index));
  });

  // Initialize word count
  updateWordCount();
});

// Handle window resize to maintain proper layout
window.addEventListener("resize", function() {
  updateLayoutForMode();
});

// Make functions globally accessible
window.toggleModel = toggleModel;
window.send = send;
window.scrollViews = scrollViews;
window.selectFiles = selectFiles;
window.clearFiles = clearFiles;
window.toggleNotesPanel = toggleNotesPanel;
window.formatText = formatText;
window.insertList = insertList;
window.insertTimestamp = insertTimestamp;
window.clearEditor = clearEditor;
window.saveNote = saveNote;