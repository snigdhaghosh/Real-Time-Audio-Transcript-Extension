// Background service worker for Real-Time Audio Transcript Extension

class AudioTranscriptionManager {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.transcriptionBuffer = [];
    this.sessionStartTime = null;
    this.currentTabId = null;
    this.apiConfig = {
      provider: 'google', // google, openai, deepgram, fireworks
      apiKey: '',
      endpoint: ''
    };
    this.retryCount = 0;
    this.maxRetries = 3;
    this.offlineBuffer = [];
    
    this.init();
  }

  async init() {
    // Check if required APIs are available
    console.log('Initializing AudioTranscriptionManager...');
    console.log('Chrome version:', navigator.userAgent);
    console.log('Chrome APIs available:', {
      tabCapture: !!chrome.tabCapture,
      tabCaptureCaptureType: typeof chrome.tabCapture?.capture,
      storage: !!chrome.storage,
      tabs: !!chrome.tabs,
      runtime: !!chrome.runtime,
      permissions: !!chrome.permissions
    });
    
    // Check if we have the required permissions
    if (chrome.permissions) {
      try {
        const hasTabCapture = await chrome.permissions.contains({ permissions: ['tabCapture'] });
        const hasTabs = await chrome.permissions.contains({ permissions: ['tabs'] });
        console.log('Permission check:', { hasTabCapture, hasTabs });
        
        if (!hasTabCapture) {
          console.error('Tab capture permission not granted!');
        }
      } catch (error) {
        console.error('Permission check failed:', error);
      }
    }
    
    if (!chrome.tabCapture) {
      console.error('Tab capture API is not available. Extension may not work properly.');
      console.error('Available chrome APIs:', Object.keys(chrome));
    }
    
    if (!chrome.storage) {
      console.error('Storage API is not available. Extension may not work properly.');
    }

    // Load saved configuration
    const result = await chrome.storage.local.get(['apiConfig', 'transcriptionBuffer']);
    if (result.apiConfig) {
      this.apiConfig = { ...this.apiConfig, ...result.apiConfig };
    }
    if (result.transcriptionBuffer) {
      this.transcriptionBuffer = result.transcriptionBuffer;
    }

    // Set up message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle tab updates
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.currentTabId = activeInfo.tabId;
      this.updateSidepanel();
    });

    // Handle extension installation/update
    chrome.runtime.onInstalled.addListener(() => {
      this.setupSidepanel();
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'startRecording':
          await this.startRecording();
          sendResponse({ success: true });
          break;
        case 'stopRecording':
          await this.stopRecording();
          sendResponse({ success: true });
          break;
        case 'transcribeChunk':
          console.log('Received audio chunk for transcription');
          const transcription = await this.transcribeAudio(message.audioBase64);
          console.log('Transcription result:', transcription);
          sendResponse({ success: true, transcription });
          break;
        case 'getStatus':
          sendResponse({
            isRecording: this.isRecording,
            sessionDuration: this.getSessionDuration(),
            transcriptionCount: this.transcriptionBuffer.length,
            apiProvider: this.apiConfig.provider,
            tabCaptureAvailable: !!chrome.tabCapture,
            storageAvailable: !!chrome.storage
          });
          break;
        case 'getTranscript':
          sendResponse({ transcript: this.transcriptionBuffer });
          break;
        case 'clearTranscript':
          this.transcriptionBuffer = [];
          await chrome.storage.local.set({ transcriptionBuffer: [] });
          sendResponse({ success: true });
          break;
        case 'exportTranscript':
          const exportData = await this.exportTranscript(message.format);
          sendResponse({ success: true, data: exportData });
          break;
        case 'updateApiConfig':
          this.apiConfig = { ...this.apiConfig, ...message.config };
          await chrome.storage.local.set({ apiConfig: this.apiConfig });
          sendResponse({ success: true });
          break;
        case 'getApiConfig':
          sendResponse({ config: this.apiConfig });
          break;
        case 'testApis':
          let permissionStatus = 'not available';
          if (chrome.permissions) {
            try {
              const hasTabCapture = await chrome.permissions.contains({ permissions: ['tabCapture'] });
              const hasTabs = await chrome.permissions.contains({ permissions: ['tabs'] });
              permissionStatus = `tabCapture: ${hasTabCapture}, tabs: ${hasTabs}`;
            } catch (error) {
              permissionStatus = 'check failed: ' + error.message;
            }
          }
          
          sendResponse({
            tabCapture: !!chrome.tabCapture,
            tabCaptureCaptureType: typeof chrome.tabCapture?.capture,
            storage: !!chrome.storage,
            tabs: !!chrome.tabs,
            runtime: !!chrome.runtime,
            permissions: permissionStatus,
            chromeVersion: navigator.userAgent
          });
          break;
        case 'requestPermissions':
          try {
            const granted = await chrome.permissions.request({
              permissions: ['tabCapture', 'tabs']
            });
            sendResponse({ success: true, granted });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ error: error.message });
    }
  }

  async startRecording() {
    if (this.isRecording) return;

    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found. Please ensure you have an active tab.');
      }
      
      this.currentTabId = tab.id;
      this.sessionStartTime = Date.now();
      this.isRecording = true;
      
      this.updateSidepanel();
      console.log('Recording started - sidepanel will handle capture');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording() {
    if (!this.isRecording) return;

    try {
      this.isRecording = false;
      this.sessionStartTime = null;
      
      this.updateSidepanel();
      console.log('Recording stopped - sidepanel will handle cleanup');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  // Audio processing is now handled by the sidepanel
  // This method is kept for compatibility but not used
  async processAudioChunk(audioBlob) {
    console.log('Audio processing moved to sidepanel');
  }

  async transcribeAudio(audioBase64) {
    console.log('🎯 Starting transcription with provider:', this.apiConfig.provider);
    console.log('🔑 API key configured:', !!this.apiConfig.apiKey);
    
    if (!this.apiConfig.apiKey) {
      console.error('❌ No API key configured');
      throw new Error('No API key configured. Please configure an API key in settings.');
    }
    
    if (!audioBase64 || audioBase64.length < 100) {
      console.log('⚠️ Audio data too small, skipping transcription');
      return null;
    }
    
    try {
      console.log(`🔄 Trying ${this.apiConfig.provider} API...`);
      const result = await this.callTranscriptionAPI(this.apiConfig.provider, audioBase64);
      
      if (result && result.trim()) {
        this.retryCount = 0; // Reset retry count on success
        console.log(`✅ Transcription successful with ${this.apiConfig.provider}:`, result);
        return result.trim();
      } else {
        console.log('⚪ API returned empty result (likely silence)');
        return null;
      }
    } catch (error) {
      console.error(`❌ ${this.apiConfig.provider} API error:`, error);
      this.retryCount++;
      
      if (this.retryCount >= this.maxRetries) {
        this.retryCount = 0; // Reset for next attempt
        throw new Error(`Transcription failed: ${error.message}`);
      }
      
      throw error;
    }
  }

  async callTranscriptionAPI(provider, audioBase64) {
    const config = this.apiConfig;
    
    switch (provider) {
      case 'gemini':
        return await this.callGeminiAPI(audioBase64, config);
      case 'google':
        return await this.callGoogleSpeechAPI(audioBase64, config);
      case 'openai':
        return await this.callOpenAIWhisperAPI(audioBase64, config);
      case 'deepgram':
        return await this.callDeepgramAPI(audioBase64, config);
      case 'fireworks':
        return await this.callFireworksAPI(audioBase64, config);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async callGeminiAPI(audioBase64, config) {
    if (!config.apiKey) throw new Error('Gemini API key not configured');
    
    console.log('🔍 Calling Gemini 2.5 Flash API with audio size:', audioBase64.length);
    
    // Convert base64 to blob for Gemini multimodal API
    const audioBlob = this.base64ToBlob(audioBase64, 'audio/webm');
    
    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    
    // First, upload the audio file to Gemini
    const uploadResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/files?key=${config.apiKey}`, {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Gemini upload error:', errorText);
      throw new Error(`Gemini upload error: ${uploadResponse.status} - ${errorText}`);
    }
    
    const uploadData = await uploadResponse.json();
    const fileUri = uploadData.file?.uri;
    
    if (!fileUri) {
      throw new Error('Failed to upload audio to Gemini');
    }
    
    console.log('📁 Audio uploaded to Gemini, file URI:', fileUri);
    
    // Now generate content with transcription prompt
    const generateResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Please transcribe this audio file. Return only the spoken text without any additional formatting, comments, or metadata. If there is no speech or the audio is silent, return an empty string."
              },
              {
                file_data: {
                  mime_type: "audio/webm",
                  file_uri: fileUri
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000
        }
      })
    });
    
    console.log('📡 Gemini API response status:', generateResponse.status);
    
    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${generateResponse.status} - ${errorText}`);
    }
    
    const data = await generateResponse.json();
    console.log('📄 Gemini API response:', data);
    
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    console.log('📝 Extracted transcript:', transcript);
    
    return transcript;
  }

  async callGoogleSpeechAPI(audioBase64, config) {
    if (!config.apiKey) throw new Error('Google API key not configured');
    
    console.log('🔍 Calling Google Speech API with audio size:', audioBase64.length);
    
    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          // audioChannelCount omitted - Google will infer the channel count
          // from the WebM Opus header. Supplying a mismatched value triggers
          // the INVALID_ARGUMENT error.
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          model: 'latest_short'
        },
        audio: {
          content: audioBase64
        }
      })
    });

    console.log('📡 Google API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google API error details:', errorText);
      throw new Error(`Google API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📄 Google API response:', data);
    
    const transcript = data.results?.[0]?.alternatives?.[0]?.transcript || '';
    console.log('📝 Extracted transcript:', transcript);
    
    return transcript;
  }

  async callOpenAIWhisperAPI(audioBase64, config) {
    if (!config.apiKey) throw new Error('OpenAI API key not configured');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
      body: this.createFormData(audioBase64, 'audio.webm')
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
  }

  async callDeepgramAPI(audioBase64, config) {
    if (!config.apiKey) throw new Error('Deepgram API key not configured');
    
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${config.apiKey}`,
        'Content-Type': 'audio/webm',
      },
      body: this.base64ToBlob(audioBase64, 'audio/webm')
    });

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  }

  async callFireworksAPI(audioBase64, config) {
    if (!config.apiKey) throw new Error('Fireworks API key not configured');
    
    const response = await fetch('https://api.fireworks.ai/inference/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
      body: this.createFormData(audioBase64, 'audio.webm')
    });

    if (!response.ok) {
      throw new Error(`Fireworks API error: ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
  }

  createFormData(audioBase64, filename) {
    const formData = new FormData();
    const blob = this.base64ToBlob(audioBase64, 'audio/webm');
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-1');
    return formData;
  }

  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  finalizeRecording() {
    // Process any remaining audio chunks
    if (this.audioChunks.length > 0) {
      const finalBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.processAudioChunk(finalBlob);
    }
  }

  getSessionDuration() {
    if (!this.sessionStartTime) return 0;
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);
  }

  async exportTranscript(format = 'text') {
    switch (format) {
      case 'text':
        return this.transcriptionBuffer.map(entry => 
          `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.text}`
        ).join('\n');
      
      case 'json':
        return JSON.stringify(this.transcriptionBuffer, null, 2);
      
      case 'srt':
        return this.transcriptionBuffer.map((entry, index) => {
          const startTime = this.formatSRTTime(entry.duration);
          const endTime = this.formatSRTTime(entry.duration + 1);
          return `${index + 1}\n${startTime} --> ${endTime}\n${entry.text}\n`;
        }).join('\n');
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const ms = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  async updateSidepanel() {
    try {
      // Set sidepanel options directly without getAll
      await chrome.sidePanel.setOptions({
        path: 'sidepanel.html',
        enabled: true
      });
    } catch (error) {
      console.error('Failed to update sidepanel:', error);
    }
  }

  async setupSidepanel() {
    try {
      // Set up sidepanel behavior
      if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      }
    } catch (error) {
      console.error('Failed to setup sidepanel:', error);
    }
  }

  // Offscreen document is no longer needed - sidepanel handles tabCapture directly

  notifySidepanelOfNewTranscript(entry) {
    try {
      // Send message to sidepanel to update transcript
      chrome.runtime.sendMessage({
        action: 'newTranscriptEntry',
        entry: entry
      }).catch(error => {
        // Sidepanel might not be open, which is normal
        console.log('Sidepanel not available for transcript update:', error.message);
      });
    } catch (error) {
      console.log('Failed to notify sidepanel:', error.message);
    }
  }
}

// Initialize the manager when the service worker starts
const manager = new AudioTranscriptionManager();
