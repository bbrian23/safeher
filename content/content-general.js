// General Content Script - For non-social media websites

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

  console.log('[SafeSpace] General content script loaded for:', window.location.hostname);

  // Show notification on page load
  function showPageLoadNotification() {
    const domain = window.location.hostname;
    
    // Create notification overlay - LARGE AND PROMINENT
    const notification = document.createElement('div');
    notification.id = 'safespace-page-notification';
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #1e40af, #3b82f6, #60a5fa);
      color: white;
      padding: 32px 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(37, 99, 235, 0.5), 0 0 40px rgba(59, 130, 246, 0.4);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 18px;
      min-width: 400px;
      max-width: 500px;
      animation: slideInScale 0.5s ease, pulseGlow 2s ease-in-out infinite;
      cursor: pointer;
      border: 3px solid rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(10px);
    `;
    
    notification.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center;">
        <div style="font-size: 64px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">🛡️</div>
        <div style="flex: 1;">
          <div style="font-weight: 900; font-size: 32px; margin-bottom: 8px; text-shadow: 0 2px 8px rgba(0,0,0,0.3); letter-spacing: 1px;">iWITNESS</div>
          <div style="font-weight: 700; font-size: 20px; margin-bottom: 12px; opacity: 0.95;">ACTIVE & MONITORING</div>
          <div style="font-size: 16px; opacity: 0.9; font-weight: 500;">Protecting you on ${domain}</div>
        </div>
        <div style="font-size: 14px; opacity: 0.8; margin-top: 8px; font-weight: 400;">Click to dismiss</div>
      </div>
    `;
    
    // Add enhanced animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInScale {
        0% {
          transform: translate(-50%, -50%) scale(0.5);
          opacity: 0;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.05);
        }
        100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
      }
      @keyframes pulseGlow {
        0%, 100% {
          box-shadow: 0 20px 60px rgba(37, 99, 235, 0.5), 0 0 40px rgba(59, 130, 246, 0.4);
        }
        50% {
          box-shadow: 0 20px 60px rgba(37, 99, 235, 0.7), 0 0 60px rgba(59, 130, 246, 0.6);
        }
      }
      @keyframes slideOutScale {
        from {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
        to {
          transform: translate(-50%, -50%) scale(0.5);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Close on click
    notification.addEventListener('click', () => {
      notification.style.animation = 'slideOutScale 0.4s ease';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 400);
    });
    
    // Auto-close after 8 seconds (longer for visibility)
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOutScale 0.4s ease';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 400);
      }
    }, 8000);
  }

  // Monitor for any user-generated content that might need analysis
  class GeneralContentMonitor {
    constructor() {
      this.processedItems = new Set();
      this.pendingAnalysis = [];
      this.observer = null;
      this.currentLang = detectPageLanguage();
      this.t = translations[this.currentLang] || translations.en;
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
          }],
          language: this.currentLang
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
        <div style="height: 4px; background: linear-gradient(90deg, ${accentColor}, ${analysis.riskLevel === 'high' ? '#ff6b6b' : analysis.riskLevel === 'medium' ? '#fbbf24' : '#4ade80'});"></div>
        
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
                  ${analysis.riskLevel === 'high' ? (this.currentLang === 'fr' ? 'Action requise immédiatement' : 'Immediate action required') : analysis.riskLevel === 'medium' ? (this.currentLang === 'fr' ? 'Attention recommandée' : 'Attention recommended') : (this.currentLang === 'fr' ? 'Alerte de sécurité' : 'Safety alert')}
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
          
          <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 10px; margin-bottom: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.5)" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <div style="font-size: 13px; color: rgba(255, 255, 255, 0.8);">
              <span style="color: rgba(255, 255, 255, 0.5);">Website:</span> <strong style="color: #ffffff;">${context.domain}</strong>
            </div>
          </div>
          
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
      
      // Prevent multiple alerts from stacking - remove any existing alerts first
      const existingAlerts = document.querySelectorAll('.safespace-immediate-alert');
      existingAlerts.forEach(existing => {
        existing.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => existing.remove(), 300);
      });
      
      // Speech is already handled in the promise chain above
      
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
      
      // Dismiss button
      alert.querySelector('.safespace-dismiss-alert')?.addEventListener('click', () => {
        markUserAction();
        window.speechSynthesis?.cancel();
        alert.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => alert.remove(), 300);
      });
      
      // Auto-dismiss after 20 seconds
      setTimeout(() => {
        if (alert.parentElement) {
          alert.style.animation = 'slideUp 0.3s ease';
          setTimeout(() => alert.remove(), 300);
        }
      }, 20000);
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

