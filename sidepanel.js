// Sidepanel JavaScript for Real-Time Audio Transcript Extension

class SidepanelManager {
  constructor() {
    this.isRecording = false;
    this.autoScroll = true;
    this.timerInterval = null;
    this.currentTranscript = [];
    
    // Local recording state
    this.localStream = null;
    this.localMediaRecorder = null;
    this.localSessionStartTime = null;
    this.localAudioChunks = [];
    

    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadConfiguration();
    await this.updateStatus();
    await this.loadTranscript();
    this.startStatusPolling();
  }

  setupEventListeners() {
    // Recording controls
    document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
    document.getElementById('clearBtn').addEventListener('click', () => this.clearTranscript());
    document.getElementById('testApisBtn').addEventListener('click', () => this.testApis());
    document.getElementById('requestPermissionsBtn').addEventListener('click', () => this.requestPermissions());
    

    
    // Add diagnostic button (if it exists)
    const diagBtn = document.getElementById('diagnosticBtn');
    if (diagBtn) {
      diagBtn.addEventListener('click', () => this.runDiagnostics());
    }
    
    // Instructions toggle
    const instructionsToggle = document.getElementById('instructionsToggle');
    const instructionsContent = document.getElementById('instructionsContent');
    if (instructionsToggle && instructionsContent) {
      instructionsToggle.addEventListener('click', () => {
        instructionsContent.classList.toggle('collapsed');
        const icon = instructionsToggle.querySelector('i');
        if (instructionsContent.classList.contains('collapsed')) {
          icon.className = 'fas fa-chevron-right';
        } else {
          icon.className = 'fas fa-chevron-down';
        }
      });
    }

    // Configuration
    document.getElementById('configToggle').addEventListener('click', () => this.toggleConfig());
    document.getElementById('saveConfig').addEventListener('click', () => this.saveConfiguration());

    // Export functionality
    document.getElementById('exportBtn').addEventListener('click', () => this.showExportModal());
    document.getElementById('autoScrollToggle').addEventListener('click', () => this.toggleAutoScroll());

    // Modal controls
    document.getElementById('closeModal').addEventListener('click', () => this.hideExportModal());
    document.querySelectorAll('.btn-export').forEach(btn => {
      btn.addEventListener('click', (e) => this.exportTranscript(e.target.closest('.btn-export').dataset.format));
    });
    document.getElementById('copyBtn').addEventListener('click', () => this.copyToClipboard());

    // Toast controls
    document.getElementById('closeToast').addEventListener('click', () => this.hideToast('error'));
    document.getElementById('closeSuccessToast').addEventListener('click', () => this.hideToast('success'));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

    // Click outside modal to close
    document.getElementById('exportModal').addEventListener('click', (e) => {
      if (e.target.id === 'exportModal') {
        this.hideExportModal();
      }
    });
  }

  async toggleRecording() {
    try {
      const recordBtn = document.getElementById('recordBtn');
      const isCurrentlyRecording = this.isRecording;

      if (isCurrentlyRecording) {
        // Stop recording
        await this.stopLocalRecording();
        this.stopTimer();
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.showToast('Recording stopped', 'success');
      } else {
        // Check if API key is configured before starting
        const configResponse = await this.sendMessage({ action: 'getApiConfig' });
        if (!configResponse.config || !configResponse.config.apiKey) {
          this.showToast('Please configure an API key in settings (⚙️) before recording.', 'error');
          return;
        }
        
        // Start recording - try local capture first, fallback to background
        const success = await this.startLocalRecording();
        if (success) {
          this.startTimer();
          this.isRecording = true;
          this.updateRecordingUI(true);
          this.showToast('Recording started! Note: Tab audio may be muted during recording (this is normal).', 'success');
        } else {
          // Fallback to background recording
          await this.sendMessage({ action: 'startRecording' });
          this.startTimer();
          this.isRecording = true;
          this.updateRecordingUI(true);
          this.showToast('Recording started (background capture)', 'success');
        }
      }
    } catch (error) {
      console.error('Recording toggle error:', error);
      this.showToast(error.message || 'Failed to toggle recording', 'error');
    }
  }

  async clearTranscript() {
    try {
      await this.sendMessage({ action: 'clearTranscript' });
      this.currentTranscript = [];
      this.updateTranscriptDisplay();
      this.updateClearButton();
      this.showToast('Transcript cleared', 'success');
    } catch (error) {
      console.error('Clear transcript error:', error);
      this.showToast('Failed to clear transcript', 'error');
    }
  }

  updateRecordingUI(isRecording) {
    const recordBtn = document.getElementById('recordBtn');
    const timerContainer = document.getElementById('timerContainer');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');

    if (isRecording) {
      recordBtn.innerHTML = '<i class="fas fa-stop"></i><span>Stop Recording</span>';
      recordBtn.classList.add('recording');
      timerContainer.style.display = 'block';
      statusDot.classList.add('recording');
      statusText.textContent = 'Recording';
    } else {
      recordBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Recording</span>';
      recordBtn.classList.remove('recording');
      timerContainer.style.display = 'none';
      statusDot.classList.remove('recording');
      statusText.textContent = 'Ready';
    }
  }



  startTimer() {
    this.timerInterval = setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimer() {
    const timerElement = document.getElementById('timer');
    
    // Use local session duration if recording locally, otherwise get from background
    if (this.isRecording && this.localSessionStartTime) {
      const duration = this.getLocalSessionDuration();
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = duration % 60;
      
      // Add chunk progress indicator for 30-second intervals
      const chunkProgress = Math.floor(seconds / 30) * 30;
      const nextChunkIn = 30 - (seconds % 30);
      
      timerElement.innerHTML = `
        <span>${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}</span>
        <small style="color: #667eea; margin-left: 8px;">Next update in ${nextChunkIn}s</small>
      `;
    } else {
      const response = this.sendMessage({ action: 'getStatus' });
      response.then(status => {
        if (status.sessionDuration !== undefined) {
          const hours = Math.floor(status.sessionDuration / 3600);
          const minutes = Math.floor((status.sessionDuration % 3600) / 60);
          const seconds = status.sessionDuration % 60;
          timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      });
    }
  }

  toggleConfig() {
    const configContent = document.getElementById('configContent');
    const isVisible = configContent.style.display !== 'none';
    configContent.style.display = isVisible ? 'none' : 'block';
  }

  async loadConfiguration() {
    try {
      const response = await this.sendMessage({ action: 'getApiConfig' });
      if (response.config) {
        document.getElementById('apiProvider').value = response.config.provider || 'google';
        document.getElementById('apiKey').value = response.config.apiKey || '';
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  async saveConfiguration() {
    try {
      const provider = document.getElementById('apiProvider').value;
      const apiKey = document.getElementById('apiKey').value;

      await this.sendMessage({
        action: 'updateApiConfig',
        config: { provider, apiKey }
      });

      this.showToast('Configuration saved', 'success');
      document.getElementById('configContent').style.display = 'none';
    } catch (error) {
      console.error('Failed to save configuration:', error);
      this.showToast('Failed to save configuration', 'error');
    }
  }

  async updateStatus() {
    try {
      const status = await this.sendMessage({ action: 'getStatus' });
      this.isRecording = status.isRecording;
      this.updateRecordingUI(this.isRecording);
      this.updateClearButton();
      
      // Check API availability and show warnings
      if (!status.tabCaptureAvailable) {
        this.showToast('Tab capture API not available. Please reload the extension.', 'error');
      }
      
      if (!status.storageAvailable) {
        this.showToast('Storage API not available. Extension may not work properly.', 'error');
      }
      
      if (this.isRecording && !this.timerInterval) {
        this.startTimer();
      } else if (!this.isRecording && this.timerInterval) {
        this.stopTimer();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  async loadTranscript() {
    try {
      const response = await this.sendMessage({ action: 'getTranscript' });
      const newTranscript = response.transcript || [];
      
      console.log(`🔍 Checking transcript: current=${this.currentTranscript.length}, new=${newTranscript.length}`);
      
      // Always update if we have new entries
      if (newTranscript.length > this.currentTranscript.length) {
        console.log(`📥 Loaded transcript: ${this.currentTranscript.length} → ${newTranscript.length} entries`);
        this.currentTranscript = newTranscript;
        this.updateTranscriptDisplay();
        
        // Force scroll to bottom if auto-scroll is enabled
        if (this.autoScroll) {
          setTimeout(() => this.scrollToBottom(), 100);
        }
        return true; // Indicate that we updated
      } 
      // Also update if same length but different content (in case entries were modified)
      else if (newTranscript.length === this.currentTranscript.length && newTranscript.length > 0) {
        // Check if content is different
        const currentText = this.currentTranscript.map(entry => entry.text).join('');
        const newText = newTranscript.map(entry => entry.text).join('');
        
        if (currentText !== newText) {
          console.log(`📝 Transcript content changed, updating display...`);
          this.currentTranscript = newTranscript;
          this.updateTranscriptDisplay();
          return true; // Indicate that we updated
        }
      }
      
      return false; // No update needed
    } catch (error) {
      console.error('Failed to load transcript:', error);
      return false;
    }
  }

  // Handle new transcript entries from background script
  handleNewTranscriptEntry(entry) {
    console.log('📥 Received new transcript entry in sidepanel:', entry.text.substring(0, 50) + '...');
    
    // Check if this entry already exists to avoid duplicates
    const existingEntry = this.currentTranscript.find(existing => existing.id === entry.id);
    if (existingEntry) {
      console.log('⚠️ Entry already exists, skipping duplicate');
      return;
    }
    
    this.currentTranscript.push(entry);
    this.updateTranscriptDisplay();
    
    // Force immediate update to ensure real-time display
    if (this.autoScroll) {
      this.scrollToBottom();
    }
    
    console.log('✅ Transcript display updated with new entry');
  }

  updateTranscriptDisplay() {
    const transcriptContent = document.getElementById('transcriptContent');
    const exportBtn = document.getElementById('exportBtn');

    if (this.currentTranscript.length === 0) {
        const isRecording = this.isRecording;
        transcriptContent.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-microphone${isRecording ? '' : '-slash'}"></i>
            <p>${isRecording ? 
              'Recording in progress... Transcriptions update every 30 seconds with smooth streaming.' : 
              'No transcript yet. Start recording on a webpage with audio to begin transcription.'
            }</p>
            ${isRecording ? 
              '<p style="font-size: 0.9em; color: #666; margin-top: 10px;">Note: Tab audio becomes silent during recording - this is normal Chrome behavior. Transcription still works!</p>' : 
              '<p style="font-size: 0.9em; color: #666; margin-top: 10px;">Note: Cannot record from Chrome system pages (chrome://, extensions page, etc.)</p>'
            }
            ${isRecording ? 
              '<p style="font-size: 0.9em; color: #667eea; margin-top: 10px;"><strong>💡 Tip:</strong> Transcriptions appear every 30 seconds. Make sure you have configured an API key in settings (⚙️).</p>' : 
              ''
            }
          </div>
        `;
      exportBtn.disabled = true;
    } else {
      transcriptContent.innerHTML = this.currentTranscript
        .map(entry => this.createTranscriptEntry(entry))
        .join('');
      exportBtn.disabled = false;
      
      if (this.autoScroll) {
        this.scrollToBottom();
      }
    }
  }

  createTranscriptEntry(entry) {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    return `
      <div class="transcript-entry" data-id="${entry.id}">
        <div class="transcript-timestamp">${timestamp}</div>
        <div class="transcript-text">${this.escapeHtml(entry.text)}</div>
      </div>
    `;
  }



  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  scrollToBottom() {
    const transcriptContent = document.getElementById('transcriptContent');
    transcriptContent.scrollTop = transcriptContent.scrollHeight;
  }

  toggleAutoScroll() {
    this.autoScroll = !this.autoScroll;
    const autoScrollBtn = document.getElementById('autoScrollToggle');
    
    if (this.autoScroll) {
      autoScrollBtn.classList.add('auto-scroll-active');
      this.scrollToBottom();
    } else {
      autoScrollBtn.classList.remove('auto-scroll-active');
    }
  }

  updateClearButton() {
    const clearBtn = document.getElementById('clearBtn');
    clearBtn.disabled = this.currentTranscript.length === 0;
  }

  showExportModal() {
    document.getElementById('exportModal').classList.add('show');
  }

  hideExportModal() {
    document.getElementById('exportModal').classList.remove('show');
  }

  async exportTranscript(format) {
    try {
      const response = await this.sendMessage({ action: 'exportTranscript', format });
      
      if (response.success && response.data) {
        const blob = new Blob([response.data], { 
          type: this.getMimeType(format) 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript.${this.getFileExtension(format)}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.hideExportModal();
        this.showToast(`Transcript exported as ${format.toUpperCase()}`, 'success');
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showToast('Failed to export transcript', 'error');
    }
  }

  async copyToClipboard() {
    try {
      const response = await this.sendMessage({ action: 'exportTranscript', format: 'text' });
      
      if (response.success && response.data) {
        await navigator.clipboard.writeText(response.data);
        this.showToast('Transcript copied to clipboard', 'success');
      }
    } catch (error) {
      console.error('Copy error:', error);
      this.showToast('Failed to copy transcript', 'error');
    }
  }

  getMimeType(format) {
    switch (format) {
      case 'text': return 'text/plain';
      case 'json': return 'application/json';
      case 'srt': return 'text/plain';
      default: return 'text/plain';
    }
  }

  getFileExtension(format) {
    switch (format) {
      case 'text': return 'txt';
      case 'json': return 'json';
      case 'srt': return 'srt';
      default: return 'txt';
    }
  }

  showToast(message, type = 'error') {
    const toast = document.getElementById(`${type}Toast`);
    const messageElement = document.getElementById(`${type === 'error' ? 'error' : 'success'}Message`);
    
    messageElement.textContent = message;
    toast.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideToast(type);
    }, 5000);
  }

  hideToast(type) {
    const toast = document.getElementById(`${type}Toast`);
    toast.classList.remove('show');
  }

  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + Enter to toggle recording
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.toggleRecording();
    }
    
    // Escape to close modal
    if (e.key === 'Escape') {
      this.hideExportModal();
    }
  }

  startStatusPolling() {
    // Poll for status updates every 2 seconds for better performance
    setInterval(() => {
      // Only update status from background if not recording locally
      if (!this.isRecording || !this.localSessionStartTime) {
        this.updateStatus();
        // Only reload transcript from storage when not actively recording
        // to avoid overwriting real-time transcripts
        this.loadTranscript();
      }
    }, 2000); // Balanced for performance and responsiveness
  }

  async testApis() {
    try {
      console.log('🔍 Testing APIs and Configuration...');
      
      // Test API availability
      const result = await this.sendMessage({ action: 'testApis' });
      console.log('📊 API Test Results:', result);
      
      // Test configuration
      const configResponse = await this.sendMessage({ action: 'getApiConfig' });
      console.log('⚙️ Current config:', configResponse.config);
      
      let message = 'API Status:\n';
      message += `Tab Capture: ${result.tabCapture ? '✅' : '❌'}\n`;
      message += `Storage: ${result.storage ? '✅' : '❌'}\n`;
      message += `Tabs: ${result.tabs ? '✅' : '❌'}\n`;
      message += `Runtime: ${result.runtime ? '✅' : '❌'}\n`;
      message += `Permissions: ${result.permissions}\n\n`;
      message += `Configuration:\n`;
      message += `Provider: ${configResponse.config?.provider || 'Not set'}\n`;
      message += `API Key: ${configResponse.config?.apiKey ? 'Configured ✅' : 'Not configured ❌'}\n`;
      
      alert(message);
    } catch (error) {
      console.error('API test failed:', error);
      this.showToast('API test failed: ' + error.message, 'error');
    }
  }

  async requestPermissions() {
    try {
      const result = await this.sendMessage({ action: 'requestPermissions' });
      if (result.success && result.granted) {
        this.showToast('Permissions granted successfully!', 'success');
        // Reload the page to refresh API availability
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        this.showToast('Failed to get permissions: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      this.showToast('Permission request failed: ' + error.message, 'error');
    }
  }

  async runDiagnostics() {
    console.log('🔍 Running comprehensive diagnostics...');
    
    try {
      // 1. Check configuration
      const configResponse = await this.sendMessage({ action: 'getApiConfig' });
      console.log('⚙️ Configuration:', configResponse.config);
      
      if (!configResponse.config?.apiKey) {
        console.error('❌ No API key configured!');
        this.showToast('Please configure an API key first!', 'error');
        return;
      }
      
      // 2. Test tab capture capability
      console.log('🎥 Testing tab capture...');
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('📄 Current tab:', currentTab?.url);
      
      // 3. Check if recording is working
      if (this.isRecording) {
        console.log('🎵 Currently recording, checking audio chunks...');
        console.log('📊 Audio chunks collected:', this.localAudioChunks?.length || 0);
      } else {
        console.log('⏹️ Not currently recording');
      }
      
      // 4. Test API connection with a small test
      console.log('🧪 Testing API connection...');
      const testResponse = await this.sendMessage({ action: 'testApis' });
      console.log('📡 API test result:', testResponse);
      
      this.showToast('Diagnostics completed - check console for details', 'success');
      
    } catch (error) {
      console.error('💥 Diagnostic error:', error);
      this.showToast('Diagnostic failed: ' + error.message, 'error');
    }
  }

  async startLocalRecording() {
    try {
      console.log('🎯 Starting tab capture in sidepanel...');
      
      // Check current tab first
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab) {
        throw new Error('No active tab found');
      }
      
      console.log('📋 Current tab info:', {
        url: currentTab.url,
        title: currentTab.title,
        audible: currentTab.audible,
        mutedInfo: currentTab.mutedInfo
      });

      // Check if the current tab is a Chrome system page
      if (currentTab.url.startsWith('chrome://') || 
          currentTab.url.startsWith('chrome-extension://') ||
          currentTab.url.startsWith('edge://') ||
          currentTab.url.startsWith('about:')) {
        
        const message = `❌ Cannot capture audio from Chrome system pages!\n\n` +
                       `🔄 Please:\n` +
                       `1. Navigate to a regular website (YouTube, news site, etc.)\n` +
                       `2. Click the extension icon on that tab\n` +
                       `3. Then try recording\n\n` +
                       `Current URL: ${currentTab.url}`;
        
        this.showToast(message, 'error');
        throw new Error(message);
      }

      console.log('Attempting to capture tab:', currentTab.url);

      // Wrap the callback-style tabCapture API in a promise
      const stream = await new Promise((resolve, reject) => {
        chrome.tabCapture.capture({ 
          audio: true, 
          video: false
        }, (capturedStream) => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.error('Tab capture error details:', err);
            console.error('Error message:', err.message);
            console.error('Full error object:', JSON.stringify(err, null, 2));
            if (err.message.includes('activeTab permission') || err.message.includes('not been invoked')) {
              const activeTabMessage = `🔐 activeTab Permission Required!\n\n` +
                                      `🎯 To record audio from this tab:\n` +
                                      `1. Click the extension icon in the toolbar (not just open sidepanel)\n` +
                                      `2. This grants one-time permission for this tab\n` +
                                      `3. Then click "Start Recording"\n\n` +
                                      `💡 Tip: Opening the sidepanel alone is not enough!`;
              
              this.showToast(activeTabMessage, 'error');
              reject(new Error(activeTabMessage));
            } else if (err.message.includes('Chrome pages cannot be captured')) {
              const chromePageMessage = `❌ Cannot record Chrome system pages!\n\n` +
                                       `🔄 Please:\n` +
                                       `1. Navigate to YouTube, news site, etc.\n` +
                                       `2. Click extension icon on that tab\n` +
                                       `3. Then start recording`;
              
              this.showToast(chromePageMessage, 'error');
              reject(new Error(chromePageMessage));
            } else {
              reject(new Error(`Tab capture failed: ${err.message}`));
            }
          } else if (!capturedStream) {
            reject(new Error('Failed to capture tab audio. Make sure the tab is playing audio and try refreshing the page.'));
          } else {
            resolve(capturedStream);
          }
        });
      });

      console.log('Tab capture successful, setting up MediaRecorder...');

      // Save stream so we can stop it later
      this.localStream = stream;
      
      // Debug: Check stream properties
      console.log('🎧 Stream details:', {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().length
      });
      
      // Debug: Check audio tracks
      const audioTracks = stream.getAudioTracks();
      console.log('🔊 Audio tracks:', audioTracks.length);
      audioTracks.forEach((track, index) => {
        console.log(`🎤 Track ${index}:`, {
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label
        });
      });

      // Set up MediaRecorder with 1s slices
      this.localMediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm;codecs=opus' 
      });
      
      console.log('🎬 MediaRecorder state:', this.localMediaRecorder.state);
      
      this.localAudioChunks = [];
      this.localSessionStartTime = Date.now();
      this.overlapBuffer = null; // For 3-second overlap between chunks

      this.localMediaRecorder.ondataavailable = (event) => {
        console.log('🎵 Audio data available, size:', event.data.size);
        console.log('🎵 Audio data type:', event.data.type);
        console.log('🎵 Total chunks so far:', this.localAudioChunks.length);
        
        if (event.data.size > 0) {
          this.localAudioChunks.push(event.data);
          console.log('📤 Processing 30-second audio chunk for transcription...');
          
          // Handle 3-second overlap as specified in requirements
          this.processChunkWithOverlap(event.data);
        } else {
          console.log('⚠️ Audio chunk is empty, skipping');
        }
      };

      this.localMediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped');
        this.finalizeLocalRecording();
      };
      
      this.localMediaRecorder.onstart = () => {
        console.log('▶️ MediaRecorder started successfully');
      };
      
      this.localMediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
      };

      console.log('🚀 Starting MediaRecorder with 30-second intervals...');
      // Start recording with 30-second chunks as per requirements
      this.localMediaRecorder.start(30000); // 30 seconds
      console.log('🎬 MediaRecorder state after start:', this.localMediaRecorder.state);

      // Inform the background service worker to update its status
      await this.sendMessage({ action: 'startRecording' });

      console.log('Recording started successfully in sidepanel');
      return true;
    } catch (error) {
      console.error('Local recording failed:', error);
      return false;
    }
  }

  async stopLocalRecording() {
    try {
      if (this.localMediaRecorder && this.localMediaRecorder.state !== 'inactive') {
        this.localMediaRecorder.stop();
      }
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
      

      
      this.localSessionStartTime = null;
      this.overlapBuffer = null; // Clear overlap buffer
      
      // Inform the background service worker to update its status
      await this.sendMessage({ action: 'stopRecording' });
      
      console.log('Recording stopped in sidepanel');
    } catch (error) {
      console.error('Error stopping local recording:', error);
    }
  }



  // Process audio chunk with 3-second overlap for better transcription continuity
  async processChunkWithOverlap(currentChunk) {
    try {
      let chunkToProcess = currentChunk;
      
      // If we have an overlap buffer from the previous chunk, combine it
      if (this.overlapBuffer) {
        console.log('🔄 Combining with 3-second overlap from previous chunk...');
        
        // Create a combined blob with overlap + current chunk
        chunkToProcess = new Blob([this.overlapBuffer, currentChunk], { 
          type: 'audio/webm;codecs=opus' 
        });
        
        console.log('📏 Combined chunk size:', chunkToProcess.size, 'bytes');
      }
      
      // Send the current chunk (with overlap if applicable) for transcription
      await this.sendAudioChunk(chunkToProcess);
      
      // Create precise 3-second overlap buffer for next chunk
      await this.createOverlapBuffer(currentChunk);
      
    } catch (error) {
      console.error('❌ Error processing chunk with overlap:', error);
      // Fallback to processing without overlap
      await this.sendAudioChunk(currentChunk);
    }
  }

  // Create a more precise 3-second overlap buffer
  async createOverlapBuffer(audioChunk) {
    try {
      // For WebM Opus format, we'll use a time-based approach
      // Since we're recording 30-second chunks, 3 seconds = 10% of the chunk
      const OVERLAP_DURATION_RATIO = 0.1; // 3 seconds out of 30 seconds
      
      const arrayBuffer = await audioChunk.arrayBuffer();
      const overlapSize = Math.floor(arrayBuffer.byteLength * OVERLAP_DURATION_RATIO);
      
      if (overlapSize > 1000) { // Only create buffer if substantial data
        // Extract the last 10% of the audio data (approximately 3 seconds)
        const overlapStart = arrayBuffer.byteLength - overlapSize;
        const overlapData = arrayBuffer.slice(overlapStart);
        
        this.overlapBuffer = new Blob([overlapData], { 
          type: 'audio/webm;codecs=opus' 
        });
        
        console.log('💾 Created 3-second overlap buffer:', {
          originalSize: arrayBuffer.byteLength,
          overlapSize: overlapData.byteLength,
          ratio: (overlapData.byteLength / arrayBuffer.byteLength * 100).toFixed(1) + '%'
        });
      } else {
        console.log('⚠️ Audio chunk too small for overlap buffer');
        this.overlapBuffer = null;
      }
      
    } catch (error) {
      console.error('❌ Error creating overlap buffer:', error);
      this.overlapBuffer = null;
    }
  }

  async sendAudioChunk(audioBlob) {
    try {
      console.log('🎵 Processing audio chunk, size:', audioBlob.size, 'bytes');
      
      if (audioBlob.size === 0) {
        console.warn('⚠️ Audio chunk is empty, skipping...');
        return;
      }
      
      if (audioBlob.size < 1000) {
        console.warn('⚠️ Audio chunk too small, might be silence:', audioBlob.size, 'bytes');
        // Still try to process it in case it's valid audio
      }
      
      // Convert blob to base64 in chunks to avoid exceeding the call stack
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const CHUNK_SIZE = 0x8000; // 32 KB
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE);
        binary += String.fromCharCode.apply(null, chunk);
      }
      const base64Audio = btoa(binary);

      console.log('📤 Sending audio chunk to background for transcription... Size:', base64Audio.length, 'chars');

      // Send to background script for transcription
      const response = await this.sendMessage({ 
        action: 'transcribeChunk', 
        audioBase64: base64Audio
      });

      console.log('📥 Transcription response:', response);

      if (response && response.success && response.transcription && response.transcription.trim()) {
        console.log('✅ Transcription processed by background script');
        
        // Force immediate refresh to get the latest transcript
        await this.loadTranscript();
        
        // Schedule multiple refreshes to ensure we catch the update
        setTimeout(() => this.loadTranscript(), 500);
        setTimeout(() => this.loadTranscript(), 1000);
        setTimeout(() => this.loadTranscript(), 2000);
        setTimeout(() => this.loadTranscript(), 3000);
        
        console.log('🔄 Scheduled multiple refreshes to catch transcript update');
      } else if (response && response.success && !response.transcription) {
        console.log('⚪ No transcription text returned (might be silence or API returned empty)');
        // This is normal for silence or no speech, don't show error
      } else if (response && response.error) {
        // Only log errors, don't show them to user if they're expected
        if (!response.error.includes('Failed to get file URI') && 
            !response.error.includes('empty result') &&
            !response.error.includes('silence')) {
          console.log('❌ Transcription failed:', response.error);
        } else {
          console.log('⚪ Expected result (silence or no speech detected)');
        }
      } else {
        console.log('⚪ No transcription result (likely silence)');
      }
    } catch (error) {
      console.error('💥 Failed to send audio chunk:', error);
      // Don't retry to avoid stack overflow
    }
  }

  finalizeLocalRecording() {
    // Process any remaining audio chunks
    if (this.localAudioChunks.length > 0) {
      const finalBlob = new Blob(this.localAudioChunks, { type: 'audio/webm' });
      this.sendAudioChunk(finalBlob);
    }
  }

  getLocalSessionDuration() {
    if (!this.localSessionStartTime) return 0;
    return Math.floor((Date.now() - this.localSessionStartTime) / 1000);
  }

  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }
}

// Initialize the sidepanel manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const manager = new SidepanelManager();
  
  // Single message listener for all message types
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Sidepanel received message:', message.action);
    
    if (message.action === 'newTranscriptEntry') {
      console.log('📥 Received new transcript entry, updating display...');
      manager.handleNewTranscriptEntry(message.entry);
    } else if (message.action === 'transcriptUpdated') {
      console.log('🔄 Received transcript update notification, refreshing...');
      manager.loadTranscript();
    }
  });
  
  // Set up aggressive polling during recording
  let recordingRefreshInterval = null;
  
  // Monitor recording state for more frequent updates
  const checkRecordingState = () => {
    if (manager.isRecording) {
      // During recording, refresh very frequently
      if (!recordingRefreshInterval) {
        console.log('🎯 Starting aggressive refresh during recording...');
        recordingRefreshInterval = setInterval(() => {
          console.log('🔄 Aggressive refresh during recording...');
          manager.loadTranscript();
        }, 1000); // Refresh every 1 second during recording
      }
    } else {
      // Stop frequent refresh when not recording
      if (recordingRefreshInterval) {
        console.log('⏹️ Stopping aggressive refresh...');
        clearInterval(recordingRefreshInterval);
        recordingRefreshInterval = null;
      }
    }
  };
  
  // Check recording state every 500ms
  setInterval(checkRecordingState, 500);
  
  // Also set up a global refresh every 2 seconds regardless of recording state
  setInterval(() => {
    if (manager.isRecording) {
      console.log('🔄 Global refresh check during recording...');
      manager.loadTranscript();
    }
  }, 2000);
});

// Handle visibility change to update status when sidepanel becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Sidepanel became visible, refresh data
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
});
