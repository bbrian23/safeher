// Facebook Content Script - Monitors Facebook posts and comments

// Constants (inline since content scripts can't use ES6 imports)
const BATCH_SIZE = 10;

(function() {
  'use strict';

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

  class FacebookMonitor {
    constructor() {
      this.processedPosts = new Set();
      this.pendingAnalysis = [];
      this.analysisTimer = null;
      this.observer = null;
      this.init();
    }

    init() {
      console.log('[SafeSpace] Facebook monitor initializing...');
      // Wait for indicators to load
      setTimeout(() => {
        this.startMonitoring();
        console.log('[SafeSpace] Facebook monitor started');
      }, 1000);
    }

    startMonitoring() {
      console.log('[SafeSpace] Starting Facebook monitoring...');
      // Initial scan
      this.scanPage();

      // Set up MutationObserver for dynamic content
      this.observer = new MutationObserver(() => {
        this.scanPage();
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Also scan on scroll (debounced)
      let scrollTimeout;
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.scanPage();
        }, 500);
      });

      // Trigger privacy policy check for Facebook
      setTimeout(() => {
        this.checkPrivacyPolicy();
      }, 2000);
    }

    checkPrivacyPolicy() {
      // Send message to background to check privacy policy
      chrome.runtime.sendMessage({
        action: 'checkPrivacyPolicy',
        domain: window.location.hostname,
        url: window.location.href
      }).catch(err => {
        console.log('[SafeSpace] Privacy check message sent');
      });
    }

    scanPage() {
      const posts = this.findPosts();
      console.log(`[SafeSpace] Found ${posts.length} posts/comments to analyze`);
      
      for (const post of posts) {
        if (this.processedPosts.has(post.id)) {
          continue;
        }

        this.processedPosts.add(post.id);
        this.analyzePost(post);
      }
    }

    findPosts() {
      const posts = [];
      
      // Try multiple selectors for Facebook posts (updated for current Facebook structure)
      const selectors = [
        '[role="article"]',
        '[data-pagelet*="FeedUnit"]',
        'div[data-ad-preview="message"]',
        'div[data-pagelet*="FeedStory"]',
        'div[data-pagelet*="Timeline"]',
        'div[role="feed"] > div > div',
        'div[data-testid="fbfeed_story"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          // Skip if already processed
          if (element.dataset.safespaceProcessed) {
            continue;
          }
          
          const text = this.extractPostText(element);
          if (text && text.trim().length > 10) {
            const username = this.extractUsername(element);
            const postId = this.generatePostId(element);
            
            // Mark as processed
            element.dataset.safespaceProcessed = 'true';
            
            posts.push({
              id: postId,
              element,
              text,
              username,
              type: 'post'
            });
          }
        }
      }

      // Also find comments
      const comments = this.findComments();
      posts.push(...comments);

      return posts;
    }

    extractPostText(element) {
      // Try to find the main text content
      const textSelectors = [
        '[data-ad-preview="message"]',
        'div[dir="auto"]',
        'span[dir="auto"]',
        'div[data-testid="post_message"]'
      ];

      for (const selector of textSelectors) {
        const textEl = element.querySelector(selector);
        if (textEl) {
          let text = textEl.textContent || textEl.innerText || '';
          text = text.trim();
          if (text.length > 10) {
            return text;
          }
        }
      }

      // Fallback: get all text from element
      let text = element.textContent || element.innerText || '';
      // Remove common UI elements
      text = text.replace(/Like|Comment|Share|React|Reply/gi, '');
      text = text.trim();
      
      return text.length > 10 ? text : null;
    }

    extractUsername(element) {
      const usernameSelectors = [
        'strong[dir="auto"] a',
        'a[role="link"][href*="/user/"]',
        'a[href*="/profile.php"]',
        'h3 a[role="link"]'
      ];

      for (const selector of usernameSelectors) {
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

    findComments() {
      const comments = [];
      // Enhanced comment selectors for better detection
      const commentSelectors = [
        '[data-testid="comment"]',
        'div[aria-label*="comment"]',
        'ul[role="list"] > li[role="article"]',
        'div[data-testid="UFI2Comment/root"]',
        'div[data-testid="UFI2Comment/root"] > div',
        'div[role="article"] > div[role="article"]', // Nested comments/replies
        'div[data-ad-comet-preview="message"]',
        'div[data-testid="comment"] span[dir="auto"]',
        'div[data-testid="UFI2Comment/root"] span[dir="auto"]',
        'div[data-testid="UFI2Comment/root"] div[dir="auto"]',
        // More specific comment text selectors
        'div[data-testid="UFI2Comment/root"] div[data-testid="UFI2Comment/body"]',
        'div[data-testid="comment"] div[dir="auto"]',
        // Reply comments
        'div[data-testid="UFI2Comment/root"] div[data-testid="UFI2Comment/reply"]',
        'div[role="article"] div[role="article"] div[dir="auto"]'
      ];

      for (const selector of commentSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          // Skip if already processed
          if (element.dataset.safespaceProcessed) {
            continue;
          }
          
          const text = this.extractCommentText(element);
          if (text && text.trim().length > 5) { // Lower threshold for comments
            const username = this.extractCommentUsername(element);
            const commentId = this.generatePostId(element);
            
            if (!this.processedPosts.has(commentId)) {
              element.dataset.safespaceProcessed = 'true';
              
              // Try to find parent post context
              const parentPost = element.closest('[role="article"]');
              let parentText = null;
              if (parentPost) {
                const parentPostElement = parentPost.querySelector('[data-testid="post_message"]') || 
                                         parentPost.querySelector('div[dir="auto"]');
                if (parentPostElement) {
                  parentText = parentPostElement.textContent || '';
                }
              }
              
              comments.push({
                id: commentId,
                element,
                text,
                username,
                type: 'comment',
                parentText: parentText ? parentText.substring(0, 200) : null
              });
            }
          }
        }
      }

      return comments;
    }

    extractCommentText(element) {
      // Try comment-specific text selectors first
      const commentTextSelectors = [
        'div[data-testid="UFI2Comment/body"] span[dir="auto"]',
        'div[data-testid="comment"] span[dir="auto"]',
        'div[data-testid="UFI2Comment/root"] span[dir="auto"]',
        'div[data-testid="UFI2Comment/root"] div[dir="auto"]',
        'span[dir="auto"]',
        'div[dir="auto"]'
      ];

      for (const selector of commentTextSelectors) {
        const textEl = element.querySelector(selector);
        if (textEl) {
          let text = textEl.textContent || textEl.innerText || '';
          // Remove common UI text
          text = text.replace(/Reply|Like|Comment|Share|React/gi, '');
          text = text.trim();
          if (text.length > 5) {
            return text;
          }
        }
      }

      // Fallback: get text from element but filter out UI elements
      let text = element.textContent || element.innerText || '';
      text = text.replace(/Reply|Like|Comment|Share|React|Author|ago|min|hr|day/gi, '');
      text = text.trim();
      
      return text.length > 5 ? text : null;
    }

    extractCommentUsername(element) {
      // Enhanced username selectors for comments
      const usernameSelectors = [
        'div[data-testid="comment"] strong[dir="auto"] a',
        'div[data-testid="UFI2Comment/root"] strong[dir="auto"] a',
        'div[data-testid="UFI2Comment/root"] a[role="link"]',
        'strong[dir="auto"] a',
        'h3 a[role="link"]',
        'a[role="link"][href*="/user/"]',
        'a[href*="/profile.php"]'
      ];

      for (const selector of usernameSelectors) {
        const link = element.querySelector(selector);
        if (link) {
          const text = link.textContent || link.innerText || '';
          const trimmed = text.trim();
          if (trimmed && trimmed.length > 0) {
            return trimmed;
          }
        }
      }

      return null;
    }

    generatePostId(element) {
      // Generate a unique ID for the post
      const text = element.textContent || '';
      const hash = text.substring(0, 50).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return `fb_${Math.abs(hash)}`;
    }

    analyzePost(post) {
      // Add to pending analysis
      this.pendingAnalysis.push({
        text: post.text,
        context: {
          username: post.username,
          platform: 'facebook',
          url: window.location.href,
          domain: window.location.hostname,
          type: post.type,
          isComment: post.type === 'comment',
          parentText: post.parentText || null
        },
        element: post.element,
        postId: post.id
      });

      // Batch process
      this.scheduleAnalysis();
    }

    scheduleAnalysis() {
      if (this.analysisTimer) {
        clearTimeout(this.analysisTimer);
      }

      // Process immediately for real-time detection (reduced delay)
      this.analysisTimer = setTimeout(() => {
        this.processPendingAnalysis();
      }, 500); // Reduced from 2000ms to 500ms for faster detection
    }

    async processPendingAnalysis() {
      if (this.pendingAnalysis.length === 0) {
        return;
      }

      console.log(`[SafeSpace] Processing ${this.pendingAnalysis.length} items for analysis`);
      
      // Take a batch
      const batch = this.pendingAnalysis.splice(0, BATCH_SIZE);
      const contentItems = batch.map(item => ({
        text: item.text,
        context: item.context
      }));

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'analyzeContent',
          contentItems
        });

        if (response && response.success && response.results) {
          console.log(`[SafeSpace] Received ${response.results.length} analysis results`);
          // Apply results to elements
          for (let i = 0; i < batch.length && i < response.results.length; i++) {
            const item = batch[i];
            const result = response.results[i];
            
            if (result.analysis && result.analysis.riskLevel !== 'safe') {
              console.log(`[SafeSpace] Risk detected: ${result.analysis.riskLevel} - ${result.analysis.explanation}`);
              this.applyAnalysis(item.element, result.analysis, item.context);
              
              // If it's a comment and suggests blocking, show special alert
              if (item.context.isComment && result.analysis.suggestBlock) {
                this.showBlockSuggestion(item.element, item.context.username, result.analysis);
              }
            }
          }
        } else if (response && !response.success) {
          console.error('[SafeSpace] Analysis failed:', response.error);
        }
      } catch (error) {
        console.error('[FacebookMonitor] Error analyzing content:', error);
      }
    }

    applyAnalysis(element, analysis, context) {
      if (!element || !window.SafeSpaceIndicators) {
        return;
      }

      // Inject indicator
      window.SafeSpaceIndicators.injectIndicator(
        element,
        analysis.riskLevel,
        analysis
      );
    }

    showImmediateAlert(element, analysis, context) {
      // Create immediate popup alert
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
        cursor: pointer;
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
            ${context.username ? `
              <div style="font-size: 12px; opacity: 0.85; margin-bottom: 12px;">
                From: <strong>${context.username}</strong> ${context.isComment ? '(Comment)' : '(Post)'}
              </div>
            ` : ''}
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button class="safespace-view-alerts" style="flex: 1; padding: 10px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">
                View Details
              </button>
              ${context.username && analysis.suggestBlock ? `
                <button class="safespace-block-now-alert" style="flex: 1; padding: 10px; background: rgba(255, 255, 255, 0.9); color: #ef4444; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px;">
                  Block User
                </button>
              ` : ''}
              <button class="safespace-dismiss-alert" style="padding: 10px 16px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">
                ×
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Add animation
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
      
      // View alerts button - opens extension popup
      alert.querySelector('.safespace-view-alerts')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openAlertsTab' }).catch(() => {});
        alert.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => alert.remove(), 300);
      });
      
      // Block button
      alert.querySelector('.safespace-block-now-alert')?.addEventListener('click', async () => {
        if (context.username) {
          await chrome.runtime.sendMessage({
            action: 'blockAccount',
            username: context.username,
            platform: context.platform || 'facebook'
          });
          alert.innerHTML = '<div style="text-align: center; padding: 10px;">✅ Account Blocked</div>';
          setTimeout(() => {
            alert.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => alert.remove(), 300);
          }, 1500);
        }
      });
      
      // Dismiss button
      alert.querySelector('.safespace-dismiss-alert')?.addEventListener('click', () => {
        alert.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => alert.remove(), 300);
      });
      
      // Auto-dismiss after 15 seconds
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
            platform: 'facebook'
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

  // Show notification on page load
  function showPageLoadNotification() {
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
          <div style="font-size: 12px; opacity: 0.9;">Monitoring Facebook</div>
        </div>
        <div style="font-size: 18px; opacity: 0.7;">×</div>
      </div>
    `;
    
    // Add animation
    if (!document.getElementById('safespace-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'safespace-notification-styles';
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
    }
    
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

  // Initialize when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[SafeSpace] DOM loaded, initializing Facebook monitor');
      setTimeout(showPageLoadNotification, 1000);
      new FacebookMonitor();
    });
  } else {
    console.log('[SafeSpace] DOM ready, initializing Facebook monitor');
    setTimeout(showPageLoadNotification, 1000);
    new FacebookMonitor();
  }

  // Log that script loaded
  console.log('[SafeSpace] Facebook content script loaded');
})();

