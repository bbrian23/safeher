// Filter Manager - Handles content filtering based on risk levels

// Risk levels
const RISK_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  SAFE: 'safe'
};

class FilterManager {
  constructor() {
    this.settings = null;
    this.init();
  }

  async init() {
    this.settings = await this.getSettings();
  }

  async getSettings() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['settings'], (result) => {
          const settings = result.settings || {
            autoHideHighRisk: false,
            autoHideMediumRisk: false
          };
          resolve(settings);
        });
      } else {
        resolve({
          autoHideHighRisk: false,
          autoHideMediumRisk: false
        });
      }
    });
  }

  async shouldHide(riskLevel) {
    await this.init(); // Refresh settings
    
    if (riskLevel === RISK_LEVELS.HIGH && this.settings.autoHideHighRisk) {
      return true;
    }
    
    if (riskLevel === RISK_LEVELS.MEDIUM && this.settings.autoHideMediumRisk) {
      return true;
    }
    
    return false;
  }

  hideElement(element) {
    if (element) {
      element.style.display = 'none';
      element.setAttribute('data-safespace-hidden', 'true');
    }
  }

  showElement(element) {
    if (element && element.getAttribute('data-safespace-hidden') === 'true') {
      element.style.display = '';
      element.removeAttribute('data-safespace-hidden');
    }
  }

  createShowButton(element, riskLevel) {
    const button = document.createElement('button');
    button.textContent = 'Show anyway';
    button.style.cssText = `
      margin: 10px;
      padding: 8px 16px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    `;
    
    button.addEventListener('click', () => {
      this.showElement(element);
      button.remove();
    });
    
    return button;
  }
}

export default new FilterManager();

