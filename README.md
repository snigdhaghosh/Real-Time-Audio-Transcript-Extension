# Real-Time Audio Transcript Extension

A Chrome extension that captures audio from browser tabs and provides real-time transcription with a user-friendly sidepanel interface.

## 🎯 Features

### Core Features
- **Real-time Audio Capture**: Capture audio from active browser tabs
- **Live Transcription**: Real-time text updates with auto-scroll
- **Multiple API Support**: Google Speech-to-Text, OpenAI Whisper, Deepgram, Fireworks
- **Professional UI**: Clean, modern sidepanel interface
- **Export Options**: Copy to clipboard or download as TXT, JSON, or SRT
- **Session Timer**: Display current recording duration
- **Auto-scroll**: Automatic scrolling to latest transcript entries

### Advanced Features
- **Multi-provider Fallback**: Automatic fallback between transcription services
- **Offline Buffering**: Local audio buffering during connection loss
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Keyboard Shortcuts**: Ctrl/Cmd + Enter to toggle recording
- **Configuration Management**: Easy API key and provider configuration

## 🚀 Installation

### Development Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Real-Time-Audio-Transcript-Extension.git
   cd Real-Time-Audio-Transcript-Extension
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the extension directory

3. **Configure API Keys**
   - Click the extension icon to open the sidepanel
   - Click the settings icon (⚙️) to configure your API provider
   - Enter your API key and select your preferred provider

### Production Installation

1. **Download the extension**
   - Download the latest release from the [Releases page](https://github.com/yourusername/Real-Time-Audio-Transcript-Extension/releases)
   - Extract the ZIP file

2. **Install in Chrome**
   - Follow the same steps as development installation
   - Or install from the Chrome Web Store (when available)

## 🔧 API Configuration

### Supported Providers

#### 1. Google Cloud Speech-to-Text (Recommended)
- **Advantages**: Free tier available, high accuracy, streaming support
- **Setup**: 
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Create a new project or select existing
  3. Enable Speech-to-Text API
  4. Create credentials (API Key)
  5. Copy the API key to the extension

#### 2. OpenAI Whisper API
- **Advantages**: High accuracy, good for various languages
- **Setup**:
  1. Go to [OpenAI Platform](https://platform.openai.com/)
  2. Create an account and add billing
  3. Generate an API key
  4. Copy the API key to the extension

#### 3. Deepgram API
- **Advantages**: Real-time streaming, multiple models
- **Setup**:
  1. Go to [Deepgram Console](https://console.deepgram.com/)
  2. Create an account
  3. Generate an API key
  4. Copy the API key to the extension

#### 4. Fireworks API
- **Advantages**: Fast processing, competitive pricing
- **Setup**:
  1. Go to [Fireworks AI](https://fireworks.ai/)
  2. Create an account
  3. Generate an API key
  4. Copy the API key to the extension

### Configuration Steps

1. Open the extension sidepanel
2. Click the settings icon (⚙️)
3. Select your preferred provider
4. Enter your API key
5. Click "Save Configuration"

## 📖 Usage Guide

### Basic Usage

1. **Start Recording**
   - Click the extension icon to open the sidepanel
   - Click "Start Recording" button
   - Ensure the tab you want to capture has audio playing

2. **View Transcription**
   - Real-time transcription appears in the sidepanel
   - Each entry shows timestamp and transcribed text
   - Auto-scroll keeps the latest entries visible

3. **Stop Recording**
   - Click "Stop Recording" to end the session
   - Timer stops and recording ceases

4. **Export Transcript**
   - Click the download icon (📥) to open export options
   - Choose format: TXT, JSON, or SRT
   - Or click "Copy to Clipboard" for quick sharing

### Advanced Usage

#### Keyboard Shortcuts
- **Ctrl/Cmd + Enter**: Toggle recording
- **Escape**: Close export modal

#### Auto-scroll Control
- Click the arrow icon to toggle auto-scroll
- When disabled, you can manually scroll through transcript

#### Clear Transcript
- Click "Clear" button to remove all transcript entries
- Useful for starting fresh sessions

## 🏗️ Architecture

### File Structure
```
Real-Time-Audio-Transcript-Extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for audio processing
├── sidepanel.html         # Main UI interface
├── sidepanel.js           # Sidepanel functionality
├── sidepanel.css          # Styling
├── content.js             # Content script for page interaction
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

### Technical Components

#### Background Service Worker (`background.js`)
- Handles audio capture using `chrome.tabCapture`
- Manages API communication with transcription services
- Implements retry logic and error handling
- Manages extension state and storage

#### Sidepanel Interface (`sidepanel.html/js/css`)
- Modern, responsive UI built with vanilla JavaScript
- Real-time status updates and transcript display
- Export functionality and configuration management
- Accessibility features and keyboard navigation

#### Content Script (`content.js`)
- Runs in web page context
- Detects audio/video elements
- Provides page information to background script

## 🔒 Permissions

The extension requires the following permissions:

- **`tabCapture`**: Capture audio from browser tabs
- **`activeTab`**: Access current tab information
- **`sidePanel`**: Display the sidepanel interface
- **`storage`**: Save transcripts and configuration
- **`background`**: Background processing capabilities

### Optional Permissions
- **`microphone`**: For future microphone capture features

## 🛠️ Development

### Prerequisites
- Node.js (for icon generation)
- Chrome browser (version 88+)

### Development Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/yourusername/Real-Time-Audio-Transcript-Extension.git
   cd Real-Time-Audio-Transcript-Extension
   ```

2. **Generate icons** (optional)
   ```bash
   node generate_icons.js
   ```

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the extension directory

4. **Make changes and reload**
   - Edit files as needed
   - Click "Reload" on the extension card to apply changes

### Building for Production

1. **Create production build**
   ```bash
   # Zip the extension
   zip -r extension.zip . -x "*.git*" "node_modules/*" "*.DS_Store"
   ```

2. **Upload to Chrome Web Store**
   - Follow [Chrome Web Store guidelines](https://developer.chrome.com/docs/webstore/)
   - Submit for review

## 🐛 Troubleshooting

### Common Issues

#### "Failed to capture tab audio"
- Ensure the tab is playing audio
- Check that the tab is active
- Try refreshing the page

#### "API key not configured"
- Open the sidepanel and configure your API key
- Ensure the API key is valid and has proper permissions

#### "All transcription services unavailable"
- Check your internet connection
- Verify API keys are correct
- Check API service status

#### Extension not loading
- Ensure Chrome version is 88 or higher
- Check that all files are present
- Review Chrome extension console for errors

### Debug Mode

1. Open Chrome DevTools
2. Go to the Extensions page
3. Click "service worker" link for background script debugging
4. Use `console.log` statements for debugging

## 📝 API Reference

### Background Script Messages

#### Start Recording
```javascript
chrome.runtime.sendMessage({ action: 'startRecording' });
```

#### Stop Recording
```javascript
chrome.runtime.sendMessage({ action: 'stopRecording' });
```

#### Get Status
```javascript
chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
  console.log(response.isRecording, response.sessionDuration);
});
```

#### Get Transcript
```javascript
chrome.runtime.sendMessage({ action: 'getTranscript' }, (response) => {
  console.log(response.transcript);
});
```

#### Export Transcript
```javascript
chrome.runtime.sendMessage({ 
  action: 'exportTranscript', 
  format: 'text' // 'text', 'json', or 'srt'
}, (response) => {
  console.log(response.data);
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Test thoroughly before submitting
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Chrome Extensions API documentation
- Font Awesome for icons
- Various transcription API providers

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/Real-Time-Audio-Transcript-Extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/Real-Time-Audio-Transcript-Extension/discussions)
- **Email**: your-email@example.com

---

**Note**: This extension requires an active internet connection and valid API keys for transcription services to function properly.
