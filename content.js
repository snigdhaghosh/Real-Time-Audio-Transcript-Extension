// Content script for Real-Time Audio Transcript Extension
// This script runs in the context of web pages and can be used for future enhancements

console.log('Real-Time Audio Transcript Extension: Content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  // Handle any page-specific functionality here
  switch (message.action) {
    case 'getPageInfo':
      sendResponse({
        url: window.location.href,
        title: document.title,
        hasAudio: document.querySelector('audio, video') !== null
      });
      break;
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true; // Keep message channel open for async response
});

// Inject any necessary page modifications here
// For example, adding audio detection or custom controls

// Detect if the page has audio/video elements
function detectAudioElements() {
  const audioElements = document.querySelectorAll('audio, video');
  if (audioElements.length > 0) {
    console.log(`Found ${audioElements.length} audio/video elements on page`);
    return true;
  }
  return false;
}

// Initialize content script
document.addEventListener('DOMContentLoaded', () => {
  detectAudioElements();
});

// Listen for dynamic content changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
            console.log('New audio/video element detected');
          }
        }
      });
    }
  });
});

// Start observing when the page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  observer.observe(document.body, { childList: true, subtree: true });
}
