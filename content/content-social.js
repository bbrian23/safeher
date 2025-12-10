// Universal Social Media Content Script - Works for Twitter, Instagram, LinkedIn, TikTok, YouTube

// Language detection
function detectPageLanguage() {
  const htmlLang = document.documentElement.lang || document.documentElement.getAttribute('lang');
  if (htmlLang) {
    if (htmlLang.startsWith('fr')) return 'fr';
    if (htmlLang.startsWith('en')) return 'en';
  }
  const metaLang = document.querySelector('meta[http-equiv="content-language"]');
  if (metaLang) {
    const lang = metaLang.getAttribute('content');
    if (lang && lang.startsWith('fr')) return 'fr';
    if (lang && lang.startsWith('en')) return 'en';
  }
  const bodyText = document.body ? document.body.innerText.substring(0, 1000) : '';
  const frenchIndicators = ['le ', 'la ', 'les ', 'de ', 'et ', 'est ', 'dans ', 'pour ', 'avec ', 'sur ', 'par ', 'une ', 'des ', 'que ', 'qui '];
  const frenchCount = frenchIndicators.filter(word => bodyText.toLowerCase().includes(word)).length;
  if (frenchCount > 5) return 'fr';
  return 'en';
}

// Translations
const translations = {
  en: {
    highRiskDetected: 'HIGH RISK DETECTED',
    warning: 'WARNING',
    autoClosingTab: 'Auto-closing tab in',
    viewDetails: 'View Details',
    closeTabNow: 'Close Tab Now',
    blockUser: 'Block User',
    comment: 'Comment',
    post: 'Post',
    source: 'Source'
  },
  fr: {
    highRiskDetected: 'RISQUE ÉLEVÉ DÉTECTÉ',
    warning: 'AVERTISSEMENT',
    autoClosingTab: 'Fermeture automatique de l\'onglet dans',
    viewDetails: 'Voir les détails',
    closeTabNow: 'Fermer l\'onglet maintenant',
    blockUser: 'Bloquer l\'utilisateur',
    comment: 'Commentaire',
    post: 'Publication',
    source: 'Source'
  }
};

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
      this.currentLang = detectPageLanguage();
      this.t = translations[this.currentLang] || translations.en;
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
            }],
            language: this.currentLang
            }]
          });

          if (response && response.success && response.results && response.results.length > 0) {
            const result = response.results[0];
            
            if (result.analysis && result.analysis.riskLevel !== 'safe') {
              console.log(`[SafeSpace] RISK DETECTED: ${result.analysis.riskLevel} - ${result.analysis.explanation}`);
              
              // Show immediate on-screen alert FIRST for high and medium risk
              if (result.analysis.riskLevel === 'high' || result.analysis.riskLevel === 'medium') {
                console.log(`[SafeSpace] Showing immediate alert for ${result.analysis.riskLevel} risk`);
                this.showImmediateAlert(item.element, result.analysis, item.context);
              }
              
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

    // Helper function to format explanation as bullet points
    formatExplanationAsBullets(explanation) {
      if (!explanation) return '<div style="font-size: 13px; line-height: 1.6;">Harmful content detected</div>';
      const points = explanation.split(/(?=\d+\))/).filter(p => p.trim());
      if (points.length > 1) {
        return `
          <div style="font-size: 13px; line-height: 1.7; opacity: 0.95;">
            ${points.map(point => {
              const cleanPoint = point.trim().replace(/^\d+\)\s*/, '').trim();
              return `<div style="margin-bottom: 8px; padding-left: 16px; position: relative;">
                <span style="position: absolute; left: 0; top: 0;">•</span>
                <span>${cleanPoint}</span>
              </div>`;
            }).join('')}
          </div>
        `;
      } else {
        const sentences = explanation.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length > 1) {
          return `
            <div style="font-size: 13px; line-height: 1.7; opacity: 0.95;">
              ${sentences.map(sentence => {
                const cleanSentence = sentence.trim();
                if (!cleanSentence) return '';
                return `<div style="margin-bottom: 8px; padding-left: 16px; position: relative;">
                  <span style="position: absolute; left: 0; top: 0;">•</span>
                  <span>${cleanSentence}.</span>
                </div>`;
              }).join('')}
            </div>
          `;
        }
      }
      return `<div style="font-size: 13px; line-height: 1.6; opacity: 0.95;">${explanation}</div>`;
    }

    // Helper function to read text aloud - returns a promise that resolves when speech completes
    speakAlert(text, riskLevel) {
      return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
          resolve();
          return;
        }
        
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = riskLevel === 'high' ? 1.1 : 1.0;
        utterance.volume = 0.8;
        
        const voices = window.speechSynthesis.getVoices();
        let preferredVoice = null;
        
        if (this.currentLang === 'fr') {
          preferredVoice = voices.find(v => v.lang.includes('fr') && (v.name.includes('Female') || v.name.includes('Virginie') || v.name.includes('Amélie'))) 
            || voices.find(v => v.lang.includes('fr'))
            || voices.find(v => v.lang.includes('fr-'));
        } else {
          preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Samantha'))) 
            || voices.find(v => v.lang.includes('en'))
            || voices[0];
        }
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          utterance.lang = preferredVoice.lang;
        } else {
          utterance.lang = this.currentLang === 'fr' ? 'fr-FR' : 'en-US';
        }
        
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }

    showImmediateAlert(element, analysis, context) {
      const alert = document.createElement('div');
      alert.className = 'safespace-immediate-alert';
      const isHighRisk = analysis.riskLevel === 'high';
      
      // Professional color scheme - Green/Yellow/Red
      let bgColor, accentColor, borderColor;
      if (analysis.riskLevel === 'high') {
        bgColor = '#1a1a1a';
        accentColor = '#ef4444'; // Red
        borderColor = '#ef4444';
      } else if (analysis.riskLevel === 'medium') {
        bgColor = '#1f1a0a';
        accentColor = '#eab308'; // Yellow
        borderColor = '#eab308';
      } else {
        bgColor = '#0a1a0f';
        accentColor = '#22c55e'; // Green
        borderColor = '#22c55e';
      }
      
      alert.style.cssText = `
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: #ffffff;
        padding: 0;
        border-radius: 16px;
        border: 2px solid ${borderColor};
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
        z-index: 2147483647;
        max-width: 560px;
        width: calc(100% - 32px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        animation: slideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
        overflow: hidden;
      `;
      
      // Determine risk level and title
      let riskTitle;
      if (analysis.riskLevel === 'high') {
        riskTitle = this.t.highRiskDetected;
      } else if (analysis.riskLevel === 'medium') {
        riskTitle = this.t.warning;
      } else {
        riskTitle = this.currentLang === 'fr' ? 'Alerte de sécurité' : 'Safety Alert';
      }
      const formattedExplanation = this.formatExplanationAsBullets(analysis.explanation);
      
      // Prepare full alert text for speech
      const alertText = `${riskTitle}. ${analysis.explanation || 'Harmful content detected'}`;
      
      // Auto-close logic: Wait for audio completion, then 5 seconds, then close (only if no user action)
      let userActionTaken = false;
      let autoCloseTimeout = null;
      
      // Track user interactions
      const markUserAction = () => {
        userActionTaken = true;
        if (autoCloseTimeout) {
          clearTimeout(autoCloseTimeout);
          autoCloseTimeout = null;
        }
      };
      
      // Start speech and wait for completion, THEN wait 5 seconds before closing
      this.speakAlert(alertText, analysis.riskLevel).then(() => {
        // Audio completed - wait 5 seconds, then close if no user action (only for high risk)
        if (analysis.riskLevel === 'high' && !userActionTaken) {
          autoCloseTimeout = setTimeout(() => {
            if (!userActionTaken) {
              chrome.runtime.sendMessage({ action: 'closeCurrentTab' }).catch(() => {});
            }
          }, 5000); // 5 seconds after audio completes
        }
      });
      
      alert.innerHTML = `
        <!-- Header with accent bar -->
        <div style="height: 4px; background: linear-gradient(90deg, ${accentColor}, ${isHighRisk ? '#ff6b6b' : '#fbbf24'});"></div>
        
        <!-- Main content -->
        <div style="padding: 24px;">
          <!-- Header row -->
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 40px; height: 40px; border-radius: 10px; background: ${accentColor}20; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 18px; letter-spacing: -0.3px; color: #ffffff; margin-bottom: 4px;">
                  ${riskTitle}
                </div>
                <div style="font-size: 13px; color: rgba(255, 255, 255, 0.6); font-weight: 500;">
                  ${isHighRisk ? (this.currentLang === 'fr' ? 'Action requise immédiatement' : 'Immediate action required') : (this.currentLang === 'fr' ? 'Attention recommandée' : 'Attention recommended')}
                </div>
              </div>
            </div>
            <button class="safespace-dismiss-alert" style="background: rgba(255, 255, 255, 0.1); border: none; color: rgba(255, 255, 255, 0.8); font-size: 24px; cursor: pointer; padding: 4px 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: all 0.2s; flex-shrink: 0; line-height: 1;">
              ×
            </button>
          </div>
          
          <!-- Explanation content -->
          <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
            ${formattedExplanation}
          </div>
          
          <!-- Status indicator (only for high risk) -->
          ${analysis.riskLevel === 'high' ? `
            <div style="background: ${accentColor}15; border: 1px solid ${accentColor}40; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; text-align: center;">
              <div style="font-size: 13px; color: rgba(255, 255, 255, 0.7); font-weight: 500;">
                ${this.currentLang === 'fr' ? 'Lecture audio en cours. L\'onglet se fermera automatiquement 5 secondes après la fin de la lecture si aucune action n\'est prise.' : 'Reading audio. Tab will close automatically 5 seconds after audio completes if no action is taken.'}
              </div>
            </div>
          ` : ''}
          
          ${context.username ? `
            <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 10px; margin-bottom: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.5)" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <div style="font-size: 13px; color: rgba(255, 255, 255, 0.8);">
                <span style="color: rgba(255, 255, 255, 0.5);">${this.t.source}:</span> <strong style="color: #ffffff;">${context.username}</strong> • <span style="color: rgba(255, 255, 255, 0.5);">${context.isComment ? this.t.comment : this.t.post}</span>
              </div>
            </div>
          ` : ''}
          
          <!-- Action buttons -->
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="safespace-view-alerts" style="flex: 1; min-width: 140px; padding: 12px 20px; background: rgba(255, 255, 255, 0.1); color: white; border: 1.5px solid rgba(255, 255, 255, 0.2); border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              ${this.t.viewDetails}
            </button>
            ${analysis.riskLevel === 'high' ? `
              <button class="safespace-close-tab" style="flex: 1; min-width: 140px; padding: 12px 20px; background: ${accentColor}; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.2s; box-shadow: 0 4px 12px ${accentColor}40; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                ${this.t.closeTabNow}
              </button>
            ` : ''}
            ${context.username && analysis.suggestBlock ? `
              <button class="safespace-block-now-alert" style="flex: 1; min-width: 140px; padding: 12px 20px; background: rgba(255, 255, 255, 0.95); color: #1a1a1a; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
                ${this.t.blockUser}
              </button>
            ` : ''}
          </div>
        </div>
      `;
      
      if (!document.getElementById('safespace-alert-animations')) {
        const style = document.createElement('style');
        style.id = 'safespace-alert-animations';
        style.textContent = `
          @keyframes slideDown {
            from {
              transform: translateX(-50%) translateY(-120px);
              opacity: 0;
              scale: 0.95;
            }
            to {
              transform: translateX(-50%) translateY(0);
              opacity: 1;
              scale: 1;
            }
          }
          
          .safespace-dismiss-alert:hover {
            background: rgba(255, 255, 255, 0.2) !important;
            color: #ffffff !important;
          }
          
          .safespace-view-alerts:hover {
            background: rgba(255, 255, 255, 0.2) !important;
            border-color: rgba(255, 255, 255, 0.4) !important;
            transform: translateY(-1px);
          }
          
          .safespace-close-tab:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6) !important;
          }
          
          .safespace-block-now-alert:hover {
            background: #ffffff !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
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
      
      // Speech is already handled in the promise chain above
      
      // Prevent multiple alerts from stacking
      const existingAlerts = document.querySelectorAll('.safespace-immediate-alert');
      existingAlerts.forEach(existing => {
        existing.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => existing.remove(), 300);
      });
      
      setTimeout(() => {
        document.body.appendChild(alert);
      }, existingAlerts.length > 0 ? 350 : 0);
      
      // View alerts button
      alert.querySelector('.safespace-view-alerts')?.addEventListener('click', () => {
        markUserAction();
        window.speechSynthesis?.cancel();
        chrome.runtime.sendMessage({ action: 'openAlertsTab' }).catch(() => {});
        alert.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => alert.remove(), 300);
      });
      
      // Close tab button (high-risk only)
      alert.querySelector('.safespace-close-tab')?.addEventListener('click', () => {
        markUserAction();
        window.speechSynthesis?.cancel();
        // Send message to background script to close the tab
        chrome.runtime.sendMessage({ action: 'closeCurrentTab' }).catch(() => {});
      });
      
      alert.querySelector('.safespace-block-now-alert')?.addEventListener('click', async () => {
        markUserAction();
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
        markUserAction();
        window.speechSynthesis?.cancel();
        alert.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => alert.remove(), 300);
      });
      
      // Auto-dismiss after 20 seconds (increased from 15)
      setTimeout(() => {
        if (alert.parentElement) {
          alert.style.animation = 'slideUp 0.3s ease';
          setTimeout(() => alert.remove(), 300);
        }
      }, 20000);
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

