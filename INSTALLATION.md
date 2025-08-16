# Quick Installation Guide

## 🚀 Install the Extension

### Method 1: Load Unpacked (Development)

1. **Download the extension**
   - Clone this repository or download the ZIP file
   - Extract to a folder on your computer

2. **Open Chrome Extensions**
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the extension folder
   - The extension should now appear in your extensions list

### Method 2: Install from ZIP

1. **Download the packaged extension**
   - Download `extension.zip` from the releases
   - Extract the ZIP file

2. **Follow Method 1 steps 2-3**

## ⚙️ Configure API Keys

1. **Open the extension**
   - Click the extension icon in Chrome toolbar
   - The sidepanel will open

2. **Configure your API provider**
   - Click the settings icon (⚙️)
   - Select your preferred provider:
     - **Google Speech-to-Text** (Recommended - free tier available)
     - **OpenAI Whisper**
     - **Deepgram**
     - **Fireworks**
   - Enter your API key
   - Click "Save Configuration"

## 🎯 Get API Keys

### Google Speech-to-Text (Free tier available)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Speech-to-Text API
4. Create credentials (API Key)
5. Copy the API key

### OpenAI Whisper
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create account and add billing
3. Generate API key
4. Copy the API key

### Deepgram
1. Go to [Deepgram Console](https://console.deepgram.com/)
2. Create account
3. Generate API key
4. Copy the API key

### Fireworks
1. Go to [Fireworks AI](https://fireworks.ai/)
2. Create account
3. Generate API key
4. Copy the API key

## 🎬 Start Using

1. **Open a tab with audio**
   - Navigate to a website with audio/video content
   - Ensure audio is playing

2. **Start recording**
   - Click the extension icon
   - Click "Start Recording"
   - Real-time transcription will appear

3. **Export your transcript**
   - Click the download icon (📥)
   - Choose format: TXT, JSON, or SRT
   - Or copy to clipboard

## 🐛 Troubleshooting

### Extension not loading?
- Ensure Chrome version is 88 or higher
- Check that all files are present in the extension folder
- Try reloading the extension

### "Failed to capture tab audio"?
- Make sure the tab is playing audio
- Ensure the tab is active
- Try refreshing the page

### "API key not configured"?
- Open the sidepanel and configure your API key
- Ensure the API key is valid and has proper permissions

### Need help?
- Check the main [README.md](README.md) for detailed documentation
- Open an issue on GitHub for support

## 📝 Notes

- The extension requires an active internet connection
- API keys are stored locally in your browser
- Audio is processed in real-time for transcription
- Transcripts are saved locally until you clear them

---

**Happy transcribing! 🎤✨**
