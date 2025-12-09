// Block Manager - Handles account blocking functionality

import storageManager from './storage-manager.js';

class BlockManager {
  // Block an account
  async blockAccount(username, platform) {
    await storageManager.blockAccount(username, platform);
    
    // Try to hide content from this account on the page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        // Skip chrome:// URLs
        if (tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('chrome-extension://')) {
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'hideBlockedAccount',
          username,
          platform
        }).catch(() => {
          // Content script might not be ready, that's okay
        });
      }
    });
  }

  // Unblock an account
  async unblockAccount(username, platform) {
    await storageManager.unblockAccount(username, platform);
  }

  // Check if account is blocked
  async isAccountBlocked(username, platform) {
    return await storageManager.isAccountBlocked(username, platform);
  }

  // Get all blocked accounts
  async getBlockedAccounts() {
    return await storageManager.getBlockedAccounts();
  }

  // Filter content items by blocked accounts
  async filterBlocked(contentItems) {
    const blocked = await this.getBlockedAccounts();
    const blockedSet = new Set(blocked);
    
    return contentItems.filter(item => {
      if (!item.context || !item.context.username) return true;
      const accountId = `${item.context.platform || 'unknown'}:${item.context.username}`;
      return !blockedSet.has(accountId);
    });
  }
}

export default new BlockManager();

