// Facebook Content Script - Monitors Facebook posts and comments

// Constants (inline since content scripts can't use ES6 imports)
const BATCH_SIZE = 10;

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
  
  const currentLang = detectPageLanguage();
  const t = translations[currentLang] || translations.en;

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
      this.currentLang = detectPageLanguage();
      this.t = translations[this.currentLang] || translations.en;
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
          contentItems,
          language: this.currentLang // Pass detected language
        });

        if (response && response.success && response.results) {
          console.log(`[SafeSpace] Received ${response.results.length} analysis results`);
          // Apply results to elements
          for (let i = 0; i < batch.length && i < response.results.length; i++) {
            const item = batch[i];
            const result = response.results[i];
            
            if (result.analysis && result.analysis.riskLevel !== 'safe') {
              console.log(`[SafeSpace] Risk detected: ${result.analysis.riskLevel} - ${result.analysis.explanation}`);
              
              // Show immediate on-screen alert FIRST for high and medium risk
              if (result.analysis.riskLevel === 'high' || result.analysis.riskLevel === 'medium') {
                console.log(`[SafeSpace] Showing immediate alert for ${result.analysis.riskLevel} risk`);
                this.showImmediateAlert(item.element, result.analysis, item.context);
              }
              
              // Then apply visual indicators
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

    // Helper function to format explanation as bullet points for better UX
    formatExplanationAsBullets(explanation) {
      if (!explanation) return '<div style="font-size: 13px; line-height: 1.6;">Harmful content detected</div>';
      
      // Split by numbered points (1), 2), etc.) or by sentences if no numbers
      const points = explanation.split(/(?=\d+\))/).filter(p => p.trim());
      
      if (points.length > 1) {
        // Format as bullet points
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
        // Single paragraph - try to split by sentences
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
      
      // Fallback to regular text
      return `<div style="font-size: 13px; line-height: 1.6; opacity: 0.95;">${explanation}</div>`;
    }

    // Helper function to read text aloud - returns a promise that resolves when speech completes
    speakAlert(text, riskLevel) {
      return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
          resolve(); // Resolve immediately if speech synthesis not available
          return;
        }
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = riskLevel === 'high' ? 1.1 : 1.0; // Slightly higher pitch for high risk
        utterance.volume = 0.8;
        
        // Try to use a voice matching the detected language
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
        
        // Resolve promise when speech completes
        utterance.onend = () => {
          resolve();
        };
        
        utterance.onerror = (error) => {
          console.error('[SafeSpace] Speech synthesis error:', error);
          resolve(); // Resolve even on error so countdown can proceed
        };
        
        window.speechSynthesis.speak(utterance);
      });
    }

    showImmediateAlert(element, analysis, context) {
      // Create immediate popup alert with professional design
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
      
      // Add animation
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
      
      // Prepare text for speech
      const speechText = `${riskTitle}. ${analysis.explanation || 'Harmful content detected'}. ${context.username ? `From ${context.username}.` : ''} ${isHighRisk ? 'This is a high risk alert. Consider closing this tab immediately.' : ''}`;
      
      // Read alert aloud
      if (window.speechSynthesis) {
        // Wait for voices to load
        const speak = () => {
          this.speakAlert(speechText, analysis.riskLevel);
        };
        
        if (window.speechSynthesis.getVoices().length > 0) {
          speak();
        } else {
          window.speechSynthesis.onvoiceschanged = speak;
        }
      }
      
      // Auto-close is handled in the promise chain above
      
      // View alerts button - opens extension popup
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

      // Block button
      alert.querySelector('.safespace-block-now-alert')?.addEventListener('click', async () => {
        markUserAction();
        window.speechSynthesis?.cancel();
        if (context.username) {
          await chrome.runtime.sendMessage({
            action: 'blockAccount',
            username: context.username,
            platform: context.platform || 'facebook'
          });
          alert.innerHTML = '<div style="text-align: center; padding: 10px; font-weight: 600;">Account Blocked Successfully</div>';
          setTimeout(() => {
            alert.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => alert.remove(), 300);
          }, 1500);
        }
      });
      
      // Dismiss button
      alert.querySelector('.safespace-dismiss-alert')?.addEventListener('click', () => {
        markUserAction();
        window.speechSynthesis?.cancel();
        alert.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => alert.remove(), 300);
      });
      
      // Prevent multiple alerts from stacking - remove any existing alerts first
      const existingAlerts = document.querySelectorAll('.safespace-immediate-alert');
      existingAlerts.forEach(existing => {
        existing.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => existing.remove(), 300);
      });
      
      // Small delay before showing new alert to avoid flicker
      setTimeout(() => {
        document.body.appendChild(alert);
      }, existingAlerts.length > 0 ? 350 : 0);
      
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
          <div style="font-size: 16px; opacity: 0.9; font-weight: 500;">Protecting you on Facebook</div>
        </div>
        <div style="font-size: 14px; opacity: 0.8; margin-top: 8px; font-weight: 400;">Click to dismiss</div>
      </div>
    `;
    
    // Add enhanced animations
    if (!document.getElementById('safespace-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'safespace-notification-styles';
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
    }
    
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

