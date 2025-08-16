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
          const transcription = await this.transcribeAudio(message.audioBase64);
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
      // Check if tabCapture API is available
      console.log('startRecording - tabCapture check:', {
        tabCaptureExists: !!chrome.tabCapture,
        captureType: typeof chrome.tabCapture?.capture,
        captureIsFunction: typeof chrome.tabCapture?.capture === 'function'
      });
      
      // Try to access the capture method directly
      const captureMethod = chrome.tabCapture?.capture;
      console.log('Capture method details:', {
        exists: !!captureMethod,
        type: typeof captureMethod,
        isFunction: typeof captureMethod === 'function',
        isAsync: captureMethod && captureMethod.constructor.name === 'AsyncFunction'
      });
      
      // Check if we have alternative capture methods
      console.log('Alternative capture methods:', {
        desktopCapture: !!chrome.desktopCapture,
        getDisplayMedia: typeof navigator.mediaDevices?.getDisplayMedia
      });
      
      if (!chrome.tabCapture || typeof captureMethod !== 'function') {
        console.error('Tab capture API check failed:', {
          tabCapture: !!chrome.tabCapture,
          captureType: typeof chrome.tabCapture?.capture,
          availableMethods: chrome.tabCapture ? Object.keys(chrome.tabCapture) : 'none',
          captureMethodType: typeof captureMethod
        });
        throw new Error('Tab capture API is not available. Please ensure the extension has proper permissions and is reloaded.');
      }

      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found. Please ensure you have an active tab.');
      }
      
      this.currentTabId = tab.id;
      this.sessionStartTime = Date.now();

      // Request tab capture with proper error handling
      let stream;
      try {
        console.log('Attempting tab capture...');
        
        // Try different approaches for tab capture
        if (typeof captureMethod === 'function') {
          stream = await captureMethod({
            audio: true,
            video: false
          });
        } else if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          // Fallback: try getDisplayMedia
          console.log('Trying getDisplayMedia as fallback...');
          stream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: false
          });
        } else {
          // Last resort: try direct call
          stream = await chrome.tabCapture.capture({
            audio: true,
            video: false
          });
        }
        
        console.log('Tab capture result:', !!stream);
      } catch (captureError) {
        console.error('Tab capture error:', captureError);
        console.error('Error details:', {
          name: captureError.name,
          message: captureError.message,
          stack: captureError.stack
        });
        
        // Check if it's a user gesture error
        if (captureError.message.includes('user gesture') || captureError.message.includes('not allowed')) {
          throw new Error('Tab capture requires a user gesture. Please click the record button again.');
        }
        
        throw new Error(`Tab capture failed: ${captureError.message}. Please ensure the tab is playing audio and you have granted necessary permissions.`);
      }

      if (!stream) {
        throw new Error('Failed to capture tab audio. Please ensure the tab is playing audio and try refreshing the page.');
      }

      // Set up MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];
      this.isRecording = true;

      // Handle audio data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.processAudioChunk(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.finalizeRecording();
      };

      // Start recording with 1-second chunks for real-time processing
      this.mediaRecorder.start(1000);
      
      this.updateSidepanel();
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording() {
    if (!this.isRecording) return;

    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      this.isRecording = false;
      this.sessionStartTime = null;
      
      // Stop all tracks
      if (this.mediaRecorder && this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      
      this.updateSidepanel();
      console.log('Recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  async processAudioChunk(audioBlob) {
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Send to transcription API
      const transcription = await this.transcribeAudio(base64Audio);
      
      if (transcription) {
        const timestamp = new Date().toISOString();
        const entry = {
          id: Date.now(),
          timestamp,
          text: transcription,
          duration: this.getSessionDuration()
        };

        this.transcriptionBuffer.push(entry);
        
        // Save to storage
        await chrome.storage.local.set({ 
          transcriptionBuffer: this.transcriptionBuffer 
        });

        // Update sidepanel
        this.updateSidepanel();
      }
    } catch (error) {
      console.error('Audio processing error:', error);
      // Store in offline buffer for later processing
      this.offlineBuffer.push(audioBlob);
    }
  }

  async transcribeAudio(audioBase64) {
    const providers = ['google', 'openai', 'deepgram', 'fireworks'];
    
    for (const provider of providers) {
      try {
        if (provider === this.apiConfig.provider || this.apiConfig.provider === 'auto') {
          const result = await this.callTranscriptionAPI(provider, audioBase64);
          if (result) {
            this.retryCount = 0; // Reset retry count on success
            return result;
          }
        }
      } catch (error) {
        console.error(`${provider} API error:`, error);
        continue;
      }
    }
    
    // If all providers fail, increment retry count
    this.retryCount++;
    if (this.retryCount >= this.maxRetries) {
      throw new Error('All transcription services are currently unavailable');
    }
    
    return null;
  }

  async callTranscriptionAPI(provider, audioBase64) {
    const config = this.apiConfig;
    
    switch (provider) {
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

  async callGoogleSpeechAPI(audioBase64, config) {
    if (!config.apiKey) throw new Error('Google API key not configured');
    
    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          model: 'latest_long'
        },
        audio: {
          content: audioBase64
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results?.[0]?.alternatives?.[0]?.transcript || '';
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
}

// Initialize the manager when the service worker starts
const manager = new AudioTranscriptionManager();
