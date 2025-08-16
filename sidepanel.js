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
        // Start recording - try local capture first, fallback to background
        const success = await this.startLocalRecording();
        if (success) {
          this.startTimer();
          this.isRecording = true;
          this.updateRecordingUI(true);
          this.showToast('Recording started (local capture)', 'success');
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
      timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
      this.currentTranscript = response.transcript || [];
      this.updateTranscriptDisplay();
    } catch (error) {
      console.error('Failed to load transcript:', error);
    }
  }

  updateTranscriptDisplay() {
    const transcriptContent = document.getElementById('transcriptContent');
    const exportBtn = document.getElementById('exportBtn');

    if (this.currentTranscript.length === 0) {
      transcriptContent.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-microphone-slash"></i>
          <p>No transcript yet. Start recording to begin transcription.</p>
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
    // Poll for status updates every 2 seconds
    setInterval(() => {
      // Only update status from background if not recording locally
      if (!this.isRecording || !this.localSessionStartTime) {
        this.updateStatus();
      }
      this.loadTranscript();
    }, 2000);
  }

  async testApis() {
    try {
      const result = await this.sendMessage({ action: 'testApis' });
      console.log('API Test Results:', result);
      
      let message = 'API Status:\n';
      message += `Tab Capture: ${result.tabCapture ? '✅' : '❌'}\n`;
      message += `Storage: ${result.storage ? '✅' : '❌'}\n`;
      message += `Tabs: ${result.tabs ? '✅' : '❌'}\n`;
      message += `Runtime: ${result.runtime ? '✅' : '❌'}\n`;
      message += `Permissions: ${result.permissions}\n`;
      
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

  async startLocalRecording() {
    try {
      console.log('Attempting local tab capture...');
      
      // Try to capture tab audio using chrome.tabCapture
      if (chrome.tabCapture && chrome.tabCapture.capture) {
        this.localStream = await chrome.tabCapture.capture({
          audio: true,
          video: false
        });
      } else if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        // Fallback to getDisplayMedia
        console.log('Using getDisplayMedia as fallback...');
        this.localStream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: false
        });
      } else {
        console.log('No local capture methods available');
        return false;
      }

      if (!this.localStream) {
        console.log('Failed to get local stream');
        return false;
      }

      // Set up MediaRecorder
      this.localMediaRecorder = new MediaRecorder(this.localStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.localAudioChunks = [];
      this.localSessionStartTime = Date.now();

      // Handle audio data
      this.localMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.localAudioChunks.push(event.data);
          this.sendAudioChunk(event.data);
        }
      };

      this.localMediaRecorder.onstop = () => {
        this.finalizeLocalRecording();
      };

      // Start recording with 1-second chunks
      this.localMediaRecorder.start(1000);
      console.log('Local recording started successfully');
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
      console.log('Local recording stopped');
    } catch (error) {
      console.error('Error stopping local recording:', error);
    }
  }

  async sendAudioChunk(audioBlob) {
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Send to background for transcription
      const response = await this.sendMessage({ 
        action: 'transcribeChunk', 
        audioBase64: base64Audio 
      });

      if (response.success && response.transcription) {
        const timestamp = new Date().toISOString();
        const entry = {
          id: Date.now(),
          timestamp,
          text: response.transcription,
          duration: this.getLocalSessionDuration()
        };

        this.currentTranscript.push(entry);
        this.updateTranscriptDisplay();
      }
    } catch (error) {
      console.error('Failed to send audio chunk:', error);
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
  new SidepanelManager();
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
