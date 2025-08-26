# Gemini API Troubleshooting Guide

## Current Issue: API_KEY_SERVICE_BLOCKED Error

The error you're experiencing indicates that your Gemini API key doesn't have the necessary permissions to use the File Service API.

### Error Analysis
```
"reason": "API_KEY_SERVICE_BLOCKED"
"message": "Requests to this API generativelanguage.googleapis.com method google.ai.generativelanguage.v1beta.FileService.CreateFile are blocked."
```

## Solutions

### Option 1: Fix Gemini API Setup (Recommended)

#### Step 1: Enable Gemini API in Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (ID: 198684475670)
3. Navigate to **APIs & Services** > **Library**
4. Search for "Generative Language API"
5. Click on it and press **Enable**

#### Step 2: Create a New API Key with Proper Permissions
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Click on the newly created API key to edit it
4. Under **API restrictions**, select **Restrict key**
5. Choose **Generative Language API** from the dropdown
6. Save the changes

#### Step 3: Enable File Service (if available)
1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Gemini File Service" or "Generative Language File API"
3. If found, enable it
4. If not found, the service might be in limited access

### Option 2: Use Alternative Transcription Methods

The extension now includes a fallback mechanism that tries direct transcription first:

#### Method A: Direct Transcription (No File Upload)
- Uses `inlineData` instead of file upload
- Works with basic Gemini API access
- No additional permissions required

#### Method B: Switch to Other Providers
The extension supports multiple transcription providers:

1. **OpenAI Whisper** (Most Reliable)
   - Requires OpenAI API key
   - Excellent accuracy
   - No file upload issues

2. **Google Speech-to-Text**
   - Requires Google Cloud Speech API
   - Good accuracy
   - Real-time processing

3. **Deepgram**
   - Requires Deepgram API key
   - Fast processing
   - Good for real-time

4. **Fireworks AI**
   - Requires Fireworks API key
   - Good performance
   - Competitive pricing

### Option 3: Use LangChain Integration

The new LangChain integration provides enhanced functionality:

#### Benefits:
- Better error handling
- Multiple model fallbacks
- Conversation context
- Enhanced prompts
- Structured output

#### Setup:
1. Install dependencies: `npm install`
2. Configure multiple API keys
3. Use enhanced transcription modes

## Immediate Fix

### Quick Workaround:
1. **Switch to OpenAI** in the extension settings
2. **Get an OpenAI API key** from [OpenAI Platform](https://platform.openai.com/)
3. **Configure the extension** with your OpenAI key
4. **Test recording** - this should work immediately

### Alternative Quick Fix:
1. **Use Google Speech-to-Text** instead of Gemini
2. **Enable Google Cloud Speech API** in your project
3. **Create a Speech API key**
4. **Configure the extension** with Speech API

## Testing Your Setup

### Test API Keys:
1. Open the extension sidepanel
2. Click **"Test APIs"** button
3. Check which providers work
4. Use the working provider

### Check Permissions:
1. Go to Google Cloud Console
2. Navigate to **IAM & Admin** > **IAM**
3. Check if your API key has the necessary roles:
   - `roles/aiplatform.user`
   - `roles/generativelanguage.user`

## Common Issues and Solutions

### Issue: "API not enabled"
**Solution**: Enable the Generative Language API in Google Cloud Console

### Issue: "Quota exceeded"
**Solution**: 
- Check your quota limits in Google Cloud Console
- Consider upgrading your plan
- Use a different provider temporarily

### Issue: "Invalid API key"
**Solution**:
- Regenerate your API key
- Ensure the key is copied correctly
- Check for extra spaces or characters

### Issue: "File service not available"
**Solution**:
- The file upload feature might be in limited access
- Use the direct transcription method instead
- Switch to a different provider

## Recommended Configuration

For the best experience, configure multiple providers:

```json
{
  "apiConfig": {
    "provider": "openai",
    "fallbackProviders": ["google", "deepgram"],
    "openai": {
      "apiKey": "your-openai-key"
    },
    "google": {
      "apiKey": "your-google-key"
    },
    "deepgram": {
      "apiKey": "your-deepgram-key"
    }
  }
}
```

## Support

If you continue to have issues:

1. **Check the console logs** for detailed error messages
2. **Test with different providers** to isolate the issue
3. **Verify your API keys** are valid and have proper permissions
4. **Check your Google Cloud project** settings and quotas

## Next Steps

1. **Immediate**: Switch to OpenAI or Google Speech API
2. **Short-term**: Fix Gemini API permissions
3. **Long-term**: Consider implementing LangChain for enhanced functionality
