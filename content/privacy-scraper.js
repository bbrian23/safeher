// Privacy Policy Scraper - Detects and extracts privacy policy content

(function() {
  'use strict';

  // Prevent double-injection which can redeclare identifiers
  if (window.__safespacePrivacyScraperLoaded) {
    return;
  }
  window.__safespacePrivacyScraperLoaded = true;

  // Privacy policy detection patterns
  const PRIVACY_POLICY_PATTERNS = [
    /privacy[\s-]?policy/i,
    /privacy[\s-]?notice/i,
    /data[\s-]?protection/i,
    /terms[\s-]?of[\s-]?service/i,
    /terms[\s-]?and[\s-]?conditions/i,
    /user[\s-]?agreement/i
  ];

  // Find privacy policy links
  function findPrivacyPolicyLinks() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const policyLinks = [];
    
    for (const link of links) {
      const href = link.getAttribute('href');
      const text = (link.textContent || '').trim().toLowerCase();
      const hrefLower = href.toLowerCase();
      
      // Check if link text or href matches privacy policy patterns
      for (const pattern of PRIVACY_POLICY_PATTERNS) {
        if (pattern.test(text) || pattern.test(hrefLower)) {
          // Resolve relative URLs
          const fullUrl = new URL(href, window.location.href).href;
          policyLinks.push({
            url: fullUrl,
            text: link.textContent.trim(),
            element: link
          });
          break;
        }
      }
    }
    
    return policyLinks;
  }

  // Extract text content from a URL
  async function extractPolicyContent(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Try to find main content area
      const mainContent = doc.querySelector('main') || 
                         doc.querySelector('article') ||
                         doc.querySelector('[role="main"]') ||
                         doc.querySelector('.content') ||
                         doc.body;
      
      // Remove script and style elements
      const scripts = mainContent.querySelectorAll('script, style, nav, header, footer');
      scripts.forEach(el => el.remove());
      
      // Extract text
      let text = mainContent.textContent || mainContent.innerText || '';
      
      // Clean up text
      text = text.replace(/\s+/g, ' ').trim();
      
      // Limit to reasonable size (first 20000 chars)
      if (text.length > 20000) {
        text = text.substring(0, 20000) + '...[truncated]';
      }
      
      return text;
    } catch (error) {
      console.error('[PrivacyScraper] Error fetching policy:', error);
      return null;
    }
  }

  // Main scraping function
  async function scrapePrivacyPolicy() {
    const domain = window.location.hostname;
    
    // Check if we're already on a privacy policy page
    const currentUrl = window.location.href.toLowerCase();
    let isPolicyPage = false;
    for (const pattern of PRIVACY_POLICY_PATTERNS) {
      if (pattern.test(currentUrl) || pattern.test(document.title)) {
        isPolicyPage = true;
        break;
      }
    }
    
    if (isPolicyPage) {
      // Extract content from current page
      const mainContent = document.querySelector('main') || 
                         document.querySelector('article') ||
                         document.querySelector('[role="main"]') ||
                         document.body;
      
      const scripts = mainContent.querySelectorAll('script, style, nav, header, footer');
      scripts.forEach(el => el.remove());
      
      let text = mainContent.textContent || mainContent.innerText || '';
      text = text.replace(/\s+/g, ' ').trim();
      
      if (text.length > 20000) {
        text = text.substring(0, 20000) + '...[truncated]';
      }
      
      if (text.length > 100) {
        chrome.runtime.sendMessage({
          action: 'privacyPolicyFound',
          domain,
          policyText: text,
          policyUrl: window.location.href
        });
        return;
      }
    }
    
    // Otherwise, find and follow privacy policy links
    const policyLinks = findPrivacyPolicyLinks();
    
    if (policyLinks.length === 0) {
      return; // No privacy policy found
    }
    
    // Try the first policy link
    const policyLink = policyLinks[0];
    const policyText = await extractPolicyContent(policyLink.url);
    
    if (policyText && policyText.length > 100) {
      chrome.runtime.sendMessage({
        action: 'privacyPolicyFound',
        domain,
        policyText,
        policyUrl: policyLink.url
      });
    }
  }

  // Run scraper when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(scrapePrivacyPolicy, 2000); // Wait a bit for dynamic content
    });
  } else {
    setTimeout(scrapePrivacyPolicy, 2000);
  }
})();

