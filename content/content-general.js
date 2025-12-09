// General Content Script - For non-social media websites

(function() {
  'use strict';

  console.log('[SafeSpace] General content script loaded for:', window.location.hostname);

  // Show notification on page load
  function showPageLoadNotification() {
    const domain = window.location.hostname;
    
    // Create notification overlay
    const notification = document.createElement('div');
    notification.id = 'safespace-page-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #2563eb, #0369a1);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      max-width: 320px;
      animation: slideInRight 0.3s ease;
      cursor: pointer;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">🛡️</div>
        <div style="flex: 1;">
          <div style="font-weight: 700; margin-bottom: 4px;">SafeSpace Active</div>
          <div style="font-size: 12px; opacity: 0.9;">Monitoring ${domain}</div>
        </div>
        <div style="font-size: 18px; opacity: 0.7;">×</div>
      </div>
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Close on click
    notification.addEventListener('click', () => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 300);
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  // Monitor for any user-generated content that might need analysis
  class GeneralContentMonitor {
    constructor() {
      this.processedItems = new Set();
      this.pendingAnalysis = [];
      this.observer = null;
      this.init();
    }

    init() {
      // Show notification on page load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(showPageLoadNotification, 1000);
          this.startContentMonitoring();
        });
      } else {
        setTimeout(showPageLoadNotification, 1000);
        this.startContentMonitoring();
      }

      // Listen for messages from background
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'hideBlockedAccount') {
          this.hideBlockedContent(request.username);
        }
      });

      // Notify background that page loaded
      chrome.runtime.sendMessage({
        action: 'pageLoaded',
        domain: window.location.hostname,
        url: window.location.href
      }).catch(() => {
        // Background might not be ready, that's okay
      });
    }

    startContentMonitoring() {
      // Monitor for comments, posts, and user-generated content
      this.scanForContent();

      // Set up MutationObserver for dynamic content
      this.observer = new MutationObserver(() => {
        this.scanForContent();
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Also scan on scroll
      let scrollTimeout;
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.scanForContent();
        }, 1000);
      });
    }

    scanForContent() {
      // Look for common comment/post patterns across websites
      const selectors = [
        'article',
        '[role="article"]',
        '.comment',
        '.post',
        '[class*="comment"]',
        '[class*="post"]',
        '[class*="message"]',
        '[class*="reply"]',
        'div[data-testid*="comment"]',
        'div[data-testid*="post"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element.dataset.safespaceProcessed) continue;
          
          const text = element.textContent || element.innerText || '';
          // Filter out very short or UI-only text
          const cleanText = text.replace(/Like|Comment|Share|Reply|Follow|Subscribe/gi, '').trim();
          
          if (cleanText.length > 20) {
            element.dataset.safespaceProcessed = 'true';
            const itemId = `gen_${element.textContent.substring(0, 30).replace(/\s/g, '_')}`;
            
            if (!this.processedItems.has(itemId)) {
              this.processedItems.add(itemId);
              this.analyzeContent(element, cleanText);
            }
          }
        }
      }
    }

    async analyzeContent(element, text) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'analyzeContent',
          contentItems: [{
            text: text,
            context: {
              platform: 'website',
              url: window.location.href,
              domain: window.location.hostname,
              type: 'content'
            }
          }]
        });

        if (response && response.success && response.results && response.results.length > 0) {
          const result = response.results[0];
          
          if (result.analysis && result.analysis.riskLevel !== 'safe') {
            console.log(`[SafeSpace] Risk detected on ${window.location.hostname}: ${result.analysis.riskLevel}`);
            this.showImmediateAlert(element, result.analysis, {
              platform: 'website',
              domain: window.location.hostname
            });
          }
        }
      } catch (error) {
        console.error('[GeneralContentMonitor] Error analyzing:', error);
      }
    }

    showImmediateAlert(element, analysis, context) {
      const alert = document.createElement('div');
      alert.className = 'safespace-immediate-alert';
      alert.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${analysis.riskLevel === 'high' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #f59e0b, #d97706)'};
        color: white;
        padding: 20px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 1000001;
        max-width: 500px;
        width: 90%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: slideDown 0.4s ease;
      `;
      
      const riskIcon = analysis.riskLevel === 'high' ? '🚨' : '⚠️';
      const riskTitle = analysis.riskLevel === 'high' ? 'HIGH RISK DETECTED' : 'WARNING';
      
      alert.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="font-size: 32px; flex-shrink: 0;">${riskIcon}</div>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 16px; margin-bottom: 6px;">
              ${riskTitle}
            </div>
            <div style="font-size: 14px; margin-bottom: 8px; line-height: 1.4; opacity: 0.95;">
              ${analysis.explanation || 'Harmful content detected'}
            </div>
            <div style="font-size: 12px; opacity: 0.85; margin-bottom: 12px;">
              Website: <strong>${context.domain}</strong>
            </div>
            <button class="safespace-view-alerts" style="width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; margin-top: 8px;">
              View Details in Extension
            </button>
          </div>
        </div>
      `;
      
      if (!document.getElementById('safespace-alert-animations')) {
        const style = document.createElement('style');
        style.id = 'safespace-alert-animations';
        style.textContent = `
          @keyframes slideDown {
            from {
              transform: translateX(-50%) translateY(-100px);
              opacity: 0;
            }
            to {
              transform: translateX(-50%) translateY(0);
              opacity: 1;
            }
          }
          @keyframes slideUp {
            from {
              transform: translateX(-50%) translateY(0);
              opacity: 1;
            }
            to {
              transform: translateX(-50%) translateY(-100px);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }
      
      document.body.appendChild(alert);
      
      alert.querySelector('.safespace-view-alerts')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openAlertsTab' }).catch(() => {});
        alert.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => alert.remove(), 300);
      });
      
      setTimeout(() => {
        if (alert.parentElement) {
          alert.style.animation = 'slideUp 0.3s ease';
          setTimeout(() => alert.remove(), 300);
        }
      }, 15000);
    }

    hideBlockedContent(username) {
      // Try to find and hide content from this username
      const elements = document.querySelectorAll('*');
      
      for (const element of elements) {
        const text = element.textContent || '';
        if (text.includes(username)) {
          // Check if this element contains the username as an author/commenter
          const parent = element.closest('article, .comment, .post, [role="article"]');
          if (parent) {
            parent.style.display = 'none';
          }
        }
      }
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new GeneralContentMonitor();
    });
  } else {
    new GeneralContentMonitor();
  }
})();

