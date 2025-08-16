# Troubleshooting Guide

## 🚨 "chrome.tabCapture.capture is not a function" Error

This error occurs when the `tabCapture` API is not properly available. Here's how to fix it:

### Step 1: Reload the Extension
1. Go to `chrome://extensions/`
2. Find "Real-Time Audio Transcript" extension
3. Click the **"Reload"** button (🔄)
4. Wait for the extension to reload

### Step 2: Check Permissions
1. In `chrome://extensions/`, click **"Details"** on the extension
2. Ensure these permissions are granted:
   - ✅ **Capture audio from tabs**
   - ✅ **Access to tabs**
   - ✅ **Storage**
   - ✅ **Background processing**

### Step 3: Restart Chrome
1. Close all Chrome windows
2. Reopen Chrome
3. Go to `chrome://extensions/`
4. Ensure the extension is enabled

### Step 4: Check Chrome Version
- Ensure Chrome version is **88 or higher**
- Go to `chrome://version/` to check your version

### Step 5: Test with Audio
1. Open a tab with audio/video content
2. **Start playing audio** (YouTube, Spotify, etc.)
3. Try recording again

## 🔧 Other Common Issues

### "Failed to capture tab audio"
**Solution:**
- Ensure the tab is **actively playing audio**
- Try refreshing the page
- Check if the tab is the **active tab**
- Some websites block audio capture

### "API key not configured"
**Solution:**
1. Open the extension sidepanel
2. Click the settings icon (⚙️)
3. Enter your API key
4. Click "Save Configuration"

### Extension not loading
**Solution:**
1. Check Chrome version (88+ required)
2. Ensure all files are present
3. Try removing and re-adding the extension
4. Check Chrome extension console for errors

### "All transcription services unavailable"
**Solution:**
- Check your internet connection
- Verify API keys are correct
- Check API service status
- Try a different provider

## 🐛 Debug Mode

### Enable Debug Logging
1. Open Chrome DevTools
2. Go to `chrome://extensions/`
3. Click **"service worker"** link for background script
4. Check console for error messages

### Check API Availability
The extension now shows API availability status:
- ✅ Tab capture API available
- ✅ Storage API available
- ❌ API not available (will show warning)

## 📋 Manual Testing Steps

1. **Load Extension**
   ```bash
   # In Chrome: chrome://extensions/
   # Enable Developer mode
   # Click "Load unpacked"
   # Select extension folder
   ```

2. **Test Basic Functionality**
   - Open extension sidepanel
   - Check if settings panel opens
   - Verify API configuration works

3. **Test Audio Capture**
   - Open YouTube or any audio site
   - Start playing audio
   - Try recording
   - Check for error messages

4. **Test API Integration**
   - Configure API key
   - Start recording
   - Check if transcription appears

## 🔄 Extension Reload Process

If you make changes to the code:

1. **Edit files** as needed
2. **Go to** `chrome://extensions/`
3. **Click "Reload"** on the extension card
4. **Wait** for reload to complete
5. **Test** the functionality

## 📞 Getting Help

If issues persist:

1. **Check the console** for detailed error messages
2. **Take a screenshot** of the error
3. **Note your Chrome version** (`chrome://version/`)
4. **Describe the steps** that led to the error
5. **Open an issue** on GitHub with this information

## 🔒 Security Notes

- API keys are stored locally in your browser
- No data is sent to external servers except transcription APIs
- Audio processing happens locally
- Check API provider's privacy policy

---

**Still having issues?** Check the main [README.md](README.md) for more detailed information.
