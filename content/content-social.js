// Universal Social Media Content Script - Works for Twitter, Instagram, LinkedIn, TikTok, YouTube

(function() {
  'use strict';

  const BATCH_SIZE = 10;
  const PLATFORMS = {
    TWITTER: ['twitter.com', 'x.com'],
    INSTAGRAM: ['instagram.com'],
    LINKEDIN: ['linkedin.com'],
    TIKTOK: ['tiktok.com'],
    YOUTUBE: ['youtube.com']
  };

  // Detect current platform
  function detectPlatform() {
    const hostname = window.location.hostname;
    for (const [platform, domains] of Object.entries(PLATFORMS)) {
      if (domains.some(d => hostname.includes(d))) {
        return platform.toLowerCase();
      }
    }
    return 'unknown';
  }

  // Load indicators script
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/indicators.js');
    script.onload = function() {
      this.remove();
    };
    script.onerror = function() {
      console.error('[SafeSpace] Failed to load indicators.js');
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('[SafeSpace] Error loading indicators script:', error);
  }

  class SocialMediaMonitor {
    constructor() {
      this.platform = detectPlatform();
      this.processedItems = new Set();
      this.pendingAnalysis = [];
      this.analysisTimer = null;
      this.observer = null;
      this.init();
    }

    init() {
      console.log(`[SafeSpace] ${this.platform} monitor initializing...`);
      setTimeout(() => {
        this.startMonitoring();
        this.showPageLoadNotification();
      }, 1000);
    }

    showPageLoadNotification() {
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
            <div style="font-size: 12px; opacity: 0.9;">Monitoring ${this.platform}</div>
          </div>
          <div style="font-size: 18px; opacity: 0.7;">×</div>
        </div>
      `;
      
      if (!document.getElementById('safespace-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'safespace-notification-styles';
        style.textContent = `
          @keyframes slideInRight {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
      
      document.body.appendChild(notification);
      
      notification.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      });
      
      setTimeout(() => {
        if (notification.parentElement) {
          notification.style.animation = 'slideOutRight 0.3s ease';
          setTimeout(() => notification.remove(), 300);
        }
      }, 5000);
    }

    startMonitoring() {
      this.scanPage();

      this.observer = new MutationObserver(() => {
        this.scanPage();
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      let scrollTimeout;
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.scanPage();
        }, 500);
      });
    }

    scanPage() {
      const items = this.findContentItems();
      console.log(`[SafeSpace] Found ${items.length} items to analyze on ${this.platform}`);
      
      for (const item of items) {
        if (this.processedItems.has(item.id)) {
          continue;
        }

        this.processedItems.add(item.id);
        this.analyzeItem(item);
      }
    }

    findContentItems() {
      const items = [];
      const selectors = this.getSelectors();

      // Find posts
      for (const selector of selectors.postSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element.dataset.safespaceProcessed) continue;
          
          const text = this.extractText(element);
          if (text && text.trim().length > 5) {
            element.dataset.safespaceProcessed = 'true';
            items.push({
              id: this.generateId(element),
              element,
              text,
              username: this.extractUsername(element),
              type: 'post'
            });
          }
        }
      }

      // Find comments
      for (const selector of selectors.commentSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element.dataset.safespaceProcessed) continue;
          
          const text = this.extractText(element);
          if (text && text.trim().length > 5) {
            element.dataset.safespaceProcessed = 'true';
            items.push({
              id: this.generateId(element),
              element,
              text,
              username: this.extractUsername(element),
              type: 'comment'
            });
          }
        }
      }

      return items;
    }

    getSelectors() {
      // Platform-specific selectors
      const selectors = {
        TWITTER: {
          postSelectors: [
            'article[data-testid="tweet"]',
            'div[data-testid="tweet"]',
            'div[role="article"]'
          ],
          commentSelectors: [
            'article[data-testid="tweet"] div[data-testid="tweetText"]',
            'div[data-testid="reply"]',
            'div[role="article"] div[lang]'
          ],
          usernameSelectors: [
            'div[data-testid="User-Name"] a',
            'a[href*="/status/"] span'
          ]
        },
        INSTAGRAM: {
          postSelectors: ['article', 'div[role="dialog"]'],
          commentSelectors: ['ul[role="list"] li', 'span[dir="auto"]'],
          usernameSelectors: ['a[href*="/"]', 'h2 a']
        },
        LINKEDIN: {
          postSelectors: ['div[data-urn]', 'article'],
          commentSelectors: ['div.comments-comment-item', 'div.comments-comment-text'],
          usernameSelectors: ['a[data-control-name]']
        },
        TIKTOK: {
          postSelectors: ['div[data-e2e="recommend-list-item"]'],
          commentSelectors: ['div[data-e2e="comment-item"]'],
          usernameSelectors: ['a[data-e2e="comment-username"]']
        },
        YOUTUBE: {
          postSelectors: ['ytd-watch-flexy'],
          commentSelectors: ['ytd-comment-thread-renderer', 'div#content-text'],
          usernameSelectors: ['a#author-text']
        }
      };

      return selectors[this.platform.toUpperCase()] || {
        postSelectors: ['article', 'div[role="article"]'],
        commentSelectors: ['div[role="article"]'],
        usernameSelectors: ['a']
      };
    }

    extractText(element) {
      // Try to find text content
      const textEl = element.querySelector('span[dir="auto"], div[dir="auto"], p, div[data-testid="tweetText"]');
      if (textEl) {
        let text = textEl.textContent || textEl.innerText || '';
        text = text.trim();
        if (text.length > 5) {
          return text;
        }
      }

      // Fallback
      let text = element.textContent || element.innerText || '';
      text = text.replace(/Like|Comment|Share|React|Reply|Follow/gi, '');
      text = text.trim();
      return text.length > 5 ? text : null;
    }

    extractUsername(element) {
      const selectors = this.getSelectors();
      for (const selector of selectors.usernameSelectors) {
        const link = element.querySelector(selector);
        if (link) {
          const text = link.textContent || link.innerText || '';
          const trimmed = text.trim();
          if (trimmed) {
            return trimmed;
          }
        }
      }
      return null;
    }

    generateId(element) {
      const text = element.textContent || '';
      const hash = text.substring(0, 50).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return `${this.platform}_${Math.abs(hash)}`;
    }

    analyzeItem(item) {
      this.pendingAnalysis.push({
        text: item.text,
        context: {
          username: item.username,
          platform: this.platform,
          url: window.location.href,
          domain: window.location.hostname,
          type: item.type,
          isComment: item.type === 'comment'
        },
        element: item.element,
        itemId: item.id
      });

      this.scheduleAnalysis();
    }

    scheduleAnalysis() {
      if (this.analysisTimer) {
        clearTimeout(this.analysisTimer);
      }

      // Process immediately for real-time detection
      this.analysisTimer = setTimeout(() => {
        this.processPendingAnalysis();
      }, 500); // Reduced delay for faster detection
    }

    async processPendingAnalysis() {
      if (this.pendingAnalysis.length === 0) {
        return;
      }

      console.log(`[SafeSpace] Processing ${this.pendingAnalysis.length} items for analysis`);
      
      // Process items one by one for immediate alerts (no batching delay for high-priority)
      for (const item of this.pendingAnalysis.splice(0, this.pendingAnalysis.length)) {
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'analyzeContent',
            contentItems: [{
              text: item.text,
              context: item.context
            }]
          });

          if (response && response.success && response.results && response.results.length > 0) {
            const result = response.results[0];
            
            if (result.analysis && result.analysis.riskLevel !== 'safe') {
              console.log(`[SafeSpace] ⚠️ RISK DETECTED: ${result.analysis.riskLevel} - ${result.analysis.explanation}`);
              
              // Immediately show popup alert
              this.showImmediateAlert(item.element, result.analysis, item.context);
              
              // Apply visual indicators
              this.applyAnalysis(item.element, result.analysis, item.context);
              
              // If it's a comment and suggests blocking, show special alert
              if (item.context.isComment && result.analysis.suggestBlock) {
                this.showBlockSuggestion(item.element, item.context.username, result.analysis);
              }
            }
          }
        } catch (error) {
          console.error('[SocialMediaMonitor] Error analyzing content:', error);
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    applyAnalysis(element, analysis, context) {
      if (!element || !window.SafeSpaceIndicators) {
        return;
      }

      window.SafeSpaceIndicators.injectIndicator(
        element,
        analysis.riskLevel,
        analysis
      );

      // If it's a comment and suggests blocking, show special alert
      if (context.isComment && analysis.suggestBlock) {
        this.showBlockSuggestion(element, context.username, analysis);
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
      
      const riskTitle = analysis.riskLevel === 'high' ? 'HIGH RISK DETECTED' : 'WARNING';
      
      alert.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 16px;">
          <div style="width: 4px; height: 100%; background: ${analysis.riskLevel === 'high' ? '#ef4444' : '#f59e0b'}; border-radius: 2px; flex-shrink: 0;"></div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div style="font-weight: 700; font-size: 15px; letter-spacing: 0.3px; text-transform: uppercase;">
                ${riskTitle}
              </div>
              <button class="safespace-dismiss-alert" style="background: transparent; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; opacity: 0.8; transition: opacity 0.2s;">
                ×
              </button>
            </div>
            <div style="font-size: 13px; margin-bottom: 10px; line-height: 1.5; opacity: 0.95;">
              ${analysis.explanation || 'Harmful content detected'}
            </div>
            ${context.username ? `
              <div style="font-size: 11px; opacity: 0.85; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                Source: <strong>${context.username}</strong> • ${context.isComment ? 'Comment' : 'Post'}
              </div>
            ` : ''}
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button class="safespace-view-alerts" style="flex: 1; padding: 10px 14px; background: rgba(255, 255, 255, 0.25); color: white; border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.2s;">
                View Details
              </button>
              ${context.username && analysis.suggestBlock ? `
                <button class="safespace-block-now-alert" style="flex: 1; padding: 10px 14px; background: rgba(255, 255, 255, 0.95); color: #ef4444; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.2s;">
                  Block User
                </button>
              ` : ''}
            </div>
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
      
      alert.querySelector('.safespace-block-now-alert')?.addEventListener('click', async () => {
        if (context.username) {
          await chrome.runtime.sendMessage({
            action: 'blockAccount',
            username: context.username,
            platform: context.platform || this.platform
          });
          alert.innerHTML = '<div style="text-align: center; padding: 10px;">✅ Account Blocked</div>';
          setTimeout(() => {
            alert.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => alert.remove(), 300);
          }, 1500);
        }
      });
      
      alert.querySelector('.safespace-dismiss-alert')?.addEventListener('click', () => {
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

    showBlockSuggestion(element, username, analysis) {
      const suggestion = document.createElement('div');
      suggestion.className = 'safespace-block-suggestion';
      suggestion.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #ef4444;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        z-index: 1000000;
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;
      
      suggestion.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 12px;">⚠️</div>
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 8px; color: #ef4444;">
          Harmful Comment Detected
        </div>
        <div style="font-size: 14px; color: #374151; margin-bottom: 12px;">
          ${analysis.explanation}
        </div>
        <div style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">
          Comment by: <strong>${username || 'Unknown user'}</strong>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="safespace-block-now" style="flex: 1; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Block Account
          </button>
          <button class="safespace-dismiss" style="flex: 1; padding: 10px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Dismiss
          </button>
        </div>
      `;
      
      document.body.appendChild(suggestion);
      
      suggestion.querySelector('.safespace-block-now').addEventListener('click', async () => {
        if (username) {
          await chrome.runtime.sendMessage({
            action: 'blockAccount',
            username,
            platform: this.platform
          });
        }
        suggestion.remove();
      });
      
      suggestion.querySelector('.safespace-dismiss').addEventListener('click', () => {
        suggestion.remove();
      });
      
      setTimeout(() => {
        if (suggestion.parentElement) {
          suggestion.remove();
        }
      }, 10000);
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new SocialMediaMonitor();
    });
  } else {
    new SocialMediaMonitor();
  }

  console.log(`[SafeSpace] ${detectPlatform()} content script loaded`);
})();

