# **SimsultAI 🚀**
**Browse the internet and chat with six leading AI models, all side-by-side in a single, powerful application.**
## **About The Project**
In a world with rapidly evolving AI, switching between different models to find the best response is a daily challenge. SimsultAI is a desktop application built with Electron that solves this problem by providing a seamless, multi-view interface to interact with multiple AI platforms simultaneously. Send one prompt and get six different perspectives in an instant.

On top of its powerful AI integration, SimsultAI includes a fully functional web browser and a quick-notes panel, making it the ultimate tool for research, brainstorming, and content creation.
### **Key Features**
- **Multi-Model Interaction**: Chat with ChatGPT, Claude, Gemini, Grok, DeepSeek, and Perplexity all at once.
- **Single Prompt Submission**: Type your query once and send it to all enabled AI models simultaneously.
- **Integrated Web Browser**: Open a browser tab to search the web without ever leaving the application.
- **File Uploads**: Easily upload files to supported AI models.
- **Quick Notes Panel**: Jot down ideas, save important responses, and export your notes with a built-in rich text editor.
- **Cross-Platform**: Packaged installers are available for macOS, and soon for Windows, and Linux.
- **Auto-Update**: The application automatically checks for new versions and notifies you when an update is available.
## **Installation**
1. Go to the [**Latest Release**](https://github.com/parthagrawal312/SimsultAI/releases) page on GitHub.
1. Download the appropriate installer for your operating system (.dmg for macOS, .exe for Windows, .AppImage for Linux).
### **macOS Installation Note**
Due to Apple's Gatekeeper security, you may see a message saying the "app is damaged and can't be opened." To fix this, open the **Terminal** app and run the following command after installing:

xattr -cr /Applications/SimsultAI.app

The application will now open and run correctly.
## **Development Setup**
Interested in contributing or running the app from the source? Follow these steps.
### **Prerequisites**
- Node.js (which includes npm)
- Git
### **Getting Started**
1. **Clone the repository:**\
   git clone [https://github.com/parthagrawal312/SimsultAI.git](https://github.com/parthagrawal312/SimsultAI.git)
1. **Navigate to the project directory:**\
   cd SimsultAI
1. **Install the dependencies:**\
   npm install
1. **Run the app in development mode:**\
   npx electron .
## **Building for Production**
To create the packaged installers for all platforms, run the following command. The output files will be located in the dist directory.

npm run dist
## **Acknowledgements**
- [Electron](https://www.electronjs.org/)
- [electron-builder](https://www.electron.build/)
- [electron-updater](https://www.electron.build/auto-update)
- And all the amazing AI platforms integrated into this app.
