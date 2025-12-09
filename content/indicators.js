// Visual Indicators - Injects risk indicators on content

(function() {
  'use strict';

  const INDICATOR_STYLES = `
    .safespace-indicator {
      position: relative;
      display: inline-block;
    }
    .safespace-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      position: absolute;
      top: -5px;
      right: -5px;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 0 8px currentColor;
      transition: all 0.2s ease;
    }
    .safespace-dot:hover {
      width: 12px;
      height: 12px;
      top: -6px;
      right: -6px;
    }
    .safespace-dot.high-risk {
      background: #ef4444;
      color: #ef4444;
    }
    .safespace-dot.medium-risk {
      background: #eab308;
      color: #eab308;
    }
    .safespace-dot.low-risk {
      background: #0ea5e9;
      color: #0ea5e9;
    }
    .safespace-tooltip {
      position: fixed;
      background: white;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 12px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
      z-index: 10001;
      max-width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      animation: tooltipFadeIn 0.2s ease;
    }
    @keyframes tooltipFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .safespace-border {
      border: 2px solid;
      border-radius: 8px;
      transition: all 0.2s ease;
    }
    .safespace-border.high-risk {
      border-color: #ef4444;
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.3);
    }
    .safespace-border.medium-risk {
      border-color: #eab308;
      box-shadow: 0 0 12px rgba(234, 179, 8, 0.3);
    }
    .safespace-border.low-risk {
      border-color: #0ea5e9;
      box-shadow: 0 0 12px rgba(14, 165, 233, 0.3);
    }
  `;

  // Inject styles
  if (!document.getElementById('safespace-styles')) {
    const style = document.createElement('style');
    style.id = 'safespace-styles';
    style.textContent = INDICATOR_STYLES;
    document.head.appendChild(style);
  }

  // Inject risk indicator on an element
  function injectIndicator(element, riskLevel, analysis) {
    if (!element || element.querySelector('.safespace-dot')) {
      return; // Already has indicator or invalid element
    }

    // Make element relatively positioned
    const originalPosition = window.getComputedStyle(element).position;
    if (originalPosition === 'static') {
      element.style.position = 'relative';
    }

    // Create indicator dot
    const dot = document.createElement('div');
    dot.className = `safespace-dot ${riskLevel}-risk`;
    dot.setAttribute('title', `Risk Level: ${riskLevel.toUpperCase()}`);
    
    // Add click handler for tooltip
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      showTooltip(dot, riskLevel, analysis);
    });

    element.appendChild(dot);

    // Optionally add border for high risk
    if (riskLevel === 'high') {
      element.classList.add('safespace-border', 'high-risk');
    } else if (riskLevel === 'medium') {
      element.classList.add('safespace-border', 'medium-risk');
    }
  }

  // Show tooltip with risk information
  function showTooltip(trigger, riskLevel, analysis) {
    // Remove existing tooltip
    const existing = document.querySelector('.safespace-tooltip');
    if (existing) {
      existing.remove();
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'safespace-tooltip';
    
    const riskMessages = {
      high: '⚠️ HIGH RISK',
      medium: '🔍 MEDIUM RISK',
      low: 'ℹ️ LOW RISK'
    };

    tooltip.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 6px; color: #1f2937;">
        ${riskMessages[riskLevel] || 'RISK DETECTED'}
      </div>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; line-height: 1.4;">
        ${analysis.explanation || 'Safety concern detected in this content'}
      </div>
      ${analysis.recommendation ? `
        <div style="font-size: 11px; color: #374151; margin-bottom: 8px; font-style: italic;">
          💡 ${analysis.recommendation}
        </div>
      ` : ''}
      <div style="display: flex; gap: 6px; margin-top: 8px;">
        <button class="safespace-hide-btn" style="flex: 1; padding: 6px 10px; border: 1px solid #d1d5db; background: white; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">
          Hide
        </button>
        <button class="safespace-block-btn" style="flex: 1; padding: 6px 10px; border: 1px solid #d1d5db; background: white; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">
          Block
        </button>
      </div>
    `;

    // Position tooltip
    const rect = trigger.getBoundingClientRect();
    tooltip.style.left = `${rect.left + 20}px`;
    tooltip.style.top = `${rect.top - 150}px`;

    // Adjust if off-screen
    if (rect.top < 150) {
      tooltip.style.top = `${rect.bottom + 10}px`;
    }
    if (rect.left + 300 > window.innerWidth) {
      tooltip.style.left = `${rect.left - 280}px`;
    }

    document.body.appendChild(tooltip);

    // Handle button clicks
    const hideBtn = tooltip.querySelector('.safespace-hide-btn');
    const blockBtn = tooltip.querySelector('.safespace-block-btn');

    hideBtn.addEventListener('click', () => {
      const postElement = trigger.closest('[role="article"]') || trigger.parentElement;
      if (postElement) {
        postElement.style.display = 'none';
      }
      tooltip.remove();
    });

    blockBtn.addEventListener('click', () => {
      // Get username from context if available
      const usernameElement = document.querySelector('strong[dir="auto"] a, a[href*="/user/"]');
      if (usernameElement) {
        const username = usernameElement.textContent.trim();
        chrome.runtime.sendMessage({
          action: 'blockAccount',
          username,
          platform: 'facebook'
        });
      }
      
      const postElement = trigger.closest('[role="article"]') || trigger.parentElement;
      if (postElement) {
        postElement.style.display = 'none';
      }
      tooltip.remove();
    });

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', () => {
        if (tooltip.parentElement) {
          tooltip.remove();
        }
      }, { once: true });
    }, 100);
  }

  // Export functions for use by content scripts
  window.SafeSpaceIndicators = {
    injectIndicator,
    showTooltip
  };
})();

