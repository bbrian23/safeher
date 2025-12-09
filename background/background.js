// Background Service Worker - Main orchestration

import storageManager from './storage-manager.js';
import apiService from './api-service.js';
import contentAnalyzer from './content-analyzer.js';
import privacyAnalyzer from './privacy-analyzer.js';
import alertManager from './alert-manager.js';
import blockManager from './block-manager.js';
import { PLATFORMS, BATCH_SIZE, ANALYSIS_DELAY } from '../utils/constants.js';

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[SafeSpace] Extension installed');
  storageManager.cleanup();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[SafeSpace] Extension started');
  storageManager.cleanup();
});

// Track active tabs for monitoring
const activeTabs = new Map();

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Skip chrome:// and chrome-extension:// URLs
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }

    try {
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      console.log(`[Background] Tab updated: ${domain}`);
      
      // ALL websites are monitored (not just social media)
      activeTabs.set(tabId, {
        domain,
        url: tab.url,
        platform: getPlatform(domain)
      });
      
      // Trigger privacy policy scraping for ALL websites
      setTimeout(() => {
        checkPrivacyPolicyForDomain(domain, tab.url);
      }, 3000); // Wait 3 seconds for page to load
    } catch (error) {
      // Invalid URL, skip
      console.log(`[Background] Invalid URL: ${tab.url}`);
    }
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url) {
      // Skip chrome:// and chrome-extension:// URLs
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return;
      }

      try {
        const url = new URL(tab.url);
        const domain = url.hostname;
        
        if (isMonitoredPlatform(domain)) {
          activeTabs.set(activeInfo.tabId, {
            domain,
            url: tab.url,
            platform: getPlatform(domain)
          });
        }
      } catch (error) {
        // Invalid URL, skip
      }
    }
  });
});

// Message passing from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case 'analyzeContent':
        await handleAnalyzeContent(request, sender, sendResponse);
        break;
      
      case 'getAlerts':
        const alerts = await alertManager.getRecentAlerts(50);
        sendResponse({ success: true, alerts });
        break;
      
      case 'getStats':
        const stats = await alertManager.getStats();
        sendResponse({ success: true, stats });
        break;
      
      case 'removeAlert':
        await storageManager.removeAlert(request.alertId);
        sendResponse({ success: true });
        break;
      
      case 'blockAccount':
        await blockManager.blockAccount(request.username, request.platform);
        sendResponse({ success: true });
        break;
      
      case 'getSettings':
        const settings = await storageManager.getSettings();
        sendResponse({ success: true, settings });
        break;
      
      case 'updateSettings':
        const updated = await storageManager.updateSettings(request.settings);
        sendResponse({ success: true, settings: updated });
        break;
      
      case 'getPrivacyAnalysis':
        const analysis = await getPrivacyAnalysis(request.domain);
        sendResponse({ success: true, analysis });
        break;
      
      case 'getBlockedAccounts':
        const blocked = await blockManager.getBlockedAccounts();
        sendResponse({ success: true, blocked });
        break;
      
      case 'privacyPolicyFound':
        await handlePrivacyPolicyFound(request, sender);
        sendResponse({ success: true });
        break;
      
      case 'checkPrivacyPolicy':
        await checkPrivacyPolicyForDomain(request.domain, request.url);
        sendResponse({ success: true });
        break;
      
      case 'pageLoaded':
        // Page loaded - generate a basic alert for all websites
        await handlePageLoaded(request.domain, request.url);
        sendResponse({ success: true });
        break;
      
      case 'openAlertsTab':
        // Open extension popup to alerts tab
        try {
          chrome.action.openPopup();
          // Also try to switch to alerts tab via message
          chrome.runtime.sendMessage({ action: 'switchToAlertsTab' }).catch(() => {});
        } catch (e) {
          // Popup might not be openable programmatically, that's okay
        }
        sendResponse({ success: true });
        break;
      
      case 'switchToAlertsTab':
        // This will be handled by popup script
        sendResponse({ success: true });
        break;
      
      case 'ping':
        sendResponse({ success: true, message: 'Background service is running' });
        break;
      
      case 'testAlert':
        // Generate a test alert to verify the system is working
        await alertManager.generateAlert({
          riskLevel: 'low',
          riskType: 'privacy',
          explanation: 'This is a test alert to verify the extension is working correctly.',
          indicators: ['Test indicator'],
          recommendation: 'If you see this, the extension is functioning properly!'
        }, 'Test Alert', {
          platform: 'test',
          url: 'test',
          domain: 'test'
        });
        sendResponse({ success: true, message: 'Test alert generated' });
        break;
      
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('[Background] Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle content analysis requests
async function handleAnalyzeContent(request, sender, sendResponse) {
  const { contentItems } = request;
  
  console.log(`[Background] Received ${contentItems?.length || 0} items for analysis`);
  
  if (!contentItems || contentItems.length === 0) {
    sendResponse({ success: true, results: [] });
    return;
  }

  // Check if monitoring is enabled
  const settings = await storageManager.getSettings();
  if (settings.monitoringEnabled === false) {
    console.log('[Background] Monitoring is disabled');
    sendResponse({ success: true, results: [] });
    return;
  }

  // Check API key (use AI when available; otherwise fall back to keyword-only analysis)
  const apiKey = await storageManager.getApiKey();
  const useAi = Boolean(apiKey);
  if (!useAi) {
    console.warn('[Background] API key not configured. Falling back to keyword-only analysis.');
  }

  // Filter out blocked accounts
  const filtered = await blockManager.filterBlocked(contentItems);
  console.log(`[Background] After filtering blocked accounts: ${filtered.length} items`);
  
  if (filtered.length === 0) {
    sendResponse({ success: true, results: [] });
    return;
  }

  // Process in batches
  const results = [];
  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);
    console.log(`[Background] Processing batch ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} items)`);
    
    try {
      const batchResults = useAi
        ? await contentAnalyzer.analyzeBatch(batch)
        : await Promise.all(batch.map(async (item) => ({
            ...item,
            analysis: contentAnalyzer.fallbackAnalysis(null, item.text)
          })));
      
      // Generate alerts for risky content
      for (const result of batchResults) {
        if (result.analysis && result.analysis.riskLevel !== 'safe') {
          console.log(`[Background] Generating alert for ${result.analysis.riskLevel} risk content`);
          const alert = await alertManager.generateAlert(
            result.analysis,
            result.text,
            result.context
          );
          
          // Notify popup if open
          if (alert) {
            try {
              chrome.runtime.sendMessage({ action: "newAlert", alert }).catch(() => {});
            } catch (e) {}
          }
        }
        
        results.push(result);
      }
      
      // Delay between batches
      if (i + BATCH_SIZE < filtered.length && useAi) {
        await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY));
      }
    } catch (error) {
      console.error('[Background] Error analyzing batch:', error);
      // Continue with fallback analysis
      for (const item of batch) {
        results.push({
          ...item,
          analysis: contentAnalyzer.fallbackAnalysis(null, item.text)
        });
      }
    }
  }
  
  console.log(`[Background] Analysis complete. Generated ${results.length} results`);
  sendResponse({ success: true, results });
}

// Scrape privacy policy for a domain
async function scrapePrivacyPolicy(tabId, domain, url) {
  // Check if we already have a cached policy
  const cached = await storageManager.getPrivacyPolicy(domain);
  if (cached) {
    console.log(`[Background] Privacy policy already cached for ${domain}`);
    return;
  }

  console.log(`[Background] Scraping privacy policy for ${domain}`);
  
  // Inject content script to scrape
  try {
    // First check if we can access this tab
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      console.log(`[Background] Cannot inject into ${tab?.url || 'unknown'}`);
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/privacy-scraper.js']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Error injecting privacy scraper:', chrome.runtime.lastError.message);
      } else {
        console.log(`[Background] Privacy scraper injected for ${domain}`);
      }
    });
  } catch (error) {
    console.error('[Background] Error injecting privacy scraper:', error);
  }
}

// Check privacy policy for a domain (called from content script)
async function checkPrivacyPolicyForDomain(domain, url) {
  console.log(`[Background] Checking privacy policy for ${domain}`);
  
  // Check cache first
  const cached = await storageManager.getPrivacyPolicy(domain);
  if (cached && cached.analysis) {
    console.log(`[Background] Using cached privacy analysis for ${domain}`);
    // Generate alert if high risk, but avoid spamming the same domain
    if (cached.analysis.safetyScore < 50 && await shouldSendPrivacyAlert(domain)) {
      const alert = await alertManager.generateAlert({
        riskLevel: 'medium',
        riskType: 'privacy',
        explanation: `Privacy policy analysis shows safety score of ${cached.analysis.safetyScore}/100`,
        indicators: cached.analysis.riskFactors.map(f => f.description),
        recommendation: 'Review privacy settings and be cautious about sharing personal information'
      }, `Privacy policy for ${domain}`, {
        platform: 'website',
        url: url,
        domain: domain
      });
      
      // Notify popup if open
      try {
        chrome.runtime.sendMessage({ action: "newAlert", alert }).catch(() => {});
      } catch (e) {}
    }
    return;
  }

  // For Facebook, create a privacy alert AND try to scrape actual policy
  if (domain.includes('facebook.com')) {
    console.log('[Background] Generating Facebook privacy alert and attempting to scrape policy');
    
    // Generate immediate alert (only if not recently sent for this domain)
    if (await shouldSendPrivacyAlert(domain)) {
      const alert = await alertManager.generateAlert({
        riskLevel: 'medium',
        riskType: 'privacy',
        explanation: 'Facebook collects extensive user data including location, contacts, and activity patterns. Review your privacy settings.',
        indicators: ['Data sharing with third parties', 'Location tracking', 'Extensive data collection'],
        recommendation: 'Review Facebook privacy settings and limit data sharing'
      }, 'Facebook Privacy Notice', {
        platform: 'facebook',
        url: url,
        domain: domain
      });
      
      if (alert) {
        try {
          chrome.runtime.sendMessage({ action: "newAlert", alert }).catch(() => {});
        } catch (e) {}
      }
    }
    
    // Also try to scrape actual Facebook privacy policy
    // Don't return early - continue to scrape
  }

  // Try to scrape if not cached and not Facebook
  try {
    const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      // Make sure it's not a chrome:// URL
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        await scrapePrivacyPolicy(tab.id, domain, url);
      }
    }
  } catch (error) {
    console.log(`[Background] Could not query tabs for ${domain}:`, error.message);
  }
}

// Note: Privacy policy handler is already in the main message listener above

async function handlePrivacyPolicyFound(request, sender) {
  const { domain, policyText, policyUrl } = request;
  
  if (!policyText || policyText.trim().length === 0) {
    console.log(`[Background] No policy text found for ${domain}`);
    return;
  }

  console.log(`[Background] Analyzing privacy policy for ${domain} (${policyText.length} chars)`);

  // Analyze the policy
  try {
    const analysis = await privacyAnalyzer.analyzePrivacyPolicy(policyText, domain);
    console.log(`[Background] Privacy analysis complete for ${domain}, score: ${analysis.safetyScore}`);
    
    // Save to storage
    await storageManager.savePrivacyPolicy(domain, {
      text: policyText,
      url: policyUrl,
      analysis,
      domain
    });
    
    // Notify popup to refresh website analysis
    try {
      chrome.runtime.sendMessage({ 
        action: "privacyAnalysisUpdated", 
        domain,
        analysis 
      }).catch(() => {});
    } catch (e) {}
    
    // Generate alert if high risk (but avoid repeating for the same domain)
    if (analysis.safetyScore < 50 && await shouldSendPrivacyAlert(domain)) {
      const alert = await alertManager.generateAlert({
        riskLevel: 'medium',
        riskType: 'privacy',
        explanation: `Privacy policy analysis shows safety score of ${analysis.safetyScore}/100`,
        indicators: analysis.riskFactors.map(f => f.description),
        recommendation: 'Review privacy settings and be cautious about sharing personal information'
      }, `Privacy policy for ${domain}`, {
        platform: 'website',
        url: policyUrl,
        domain
      });
      
      if (alert) {
        try {
          chrome.runtime.sendMessage({ action: "newAlert", alert }).catch(() => {});
        } catch (e) {}
      }
    }
  } catch (error) {
    console.error('[Background] Error analyzing privacy policy:', error);
  }
}

// Get privacy analysis for a domain
async function getPrivacyAnalysis(domain) {
  const cached = await storageManager.getPrivacyPolicy(domain);
  if (cached && cached.analysis) {
    return cached.analysis;
  }
  return null;
}

// Helper functions
function isMonitoredPlatform(domain) {
  // Monitor ALL websites
  return true;
}

function isSocialMediaPlatform(domain) {
  const allSocialDomains = [
    ...PLATFORMS.FACEBOOK.domains,
    ...PLATFORMS.TWITTER.domains,
    ...PLATFORMS.INSTAGRAM.domains,
    ...PLATFORMS.LINKEDIN.domains,
    ...PLATFORMS.TIKTOK.domains,
    ...PLATFORMS.YOUTUBE.domains
  ];
  return allSocialDomains.some(d => domain.includes(d));
}

function getPlatform(domain) {
  if (PLATFORMS.FACEBOOK.domains.some(d => domain.includes(d))) return 'facebook';
  if (PLATFORMS.TWITTER.domains.some(d => domain.includes(d))) return 'twitter';
  if (PLATFORMS.INSTAGRAM.domains.some(d => domain.includes(d))) return 'instagram';
  if (PLATFORMS.LINKEDIN.domains.some(d => domain.includes(d))) return 'linkedin';
  if (PLATFORMS.TIKTOK.domains.some(d => domain.includes(d))) return 'tiktok';
  if (PLATFORMS.YOUTUBE.domains.some(d => domain.includes(d))) return 'youtube';
  return 'website';
}

// Handle page loaded event
async function handlePageLoaded(domain, url) {
  console.log(`[Background] Page loaded: ${domain}`);
  
  // Previously we generated a generic monitoring alert here, which caused
  // noisy "privacy risk" notifications. We now only log the visit and rely
  // on real analysis results to trigger alerts.
}

// Avoid sending repeated privacy alerts for the same domain within 24 hours
async function shouldSendPrivacyAlert(domain) {
  try {
    const alerts = await storageManager.getAlerts();
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    return !alerts.some(a => 
      a.domain === domain &&
      a.type === 'privacy' &&
      (a.timestamp || 0) > cutoff
    );
  } catch (error) {
    console.error('[Background] Error checking recent alerts:', error);
    return true; // Fail open to avoid blocking legitimate alerts
  }
}

// Periodic cleanup
setInterval(() => {
  storageManager.cleanup();
}, 24 * 60 * 60 * 1000); // Once per day

console.log('[SafeSpace] Background service worker initialized');

