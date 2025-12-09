// Storage Manager - Handles all Chrome storage operations

import { STORAGE_KEYS, CACHE_DURATION } from '../utils/constants.js';

class StorageManager {
  constructor() {
    this.storage = chrome.storage.local;
  }

  // Generic get method
  async get(key) {
    return new Promise((resolve) => {
      this.storage.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  }

  // Generic set method
  async set(key, value) {
    return new Promise((resolve) => {
      this.storage.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  // Get privacy policy for a domain
  async getPrivacyPolicy(domain) {
    const policies = await this.get(STORAGE_KEYS.PRIVACY_POLICIES) || {};
    const policy = policies[domain];
    
    if (!policy) return null;
    
    // Check if cache is expired
    const now = Date.now();
    if (policy.timestamp && (now - policy.timestamp) > CACHE_DURATION) {
      // Cache expired, remove it
      delete policies[domain];
      await this.set(STORAGE_KEYS.PRIVACY_POLICIES, policies);
      return null;
    }
    
    return policy;
  }

  // Save privacy policy for a domain
  async savePrivacyPolicy(domain, policyData) {
    const policies = await this.get(STORAGE_KEYS.PRIVACY_POLICIES) || {};
    policies[domain] = {
      ...policyData,
      timestamp: Date.now()
    };
    await this.set(STORAGE_KEYS.PRIVACY_POLICIES, policies);
  }

  // Get all alerts
  async getAlerts() {
    return await this.get(STORAGE_KEYS.ALERTS) || [];
  }

  // Add a new alert
  async addAlert(alert) {
    const alerts = await this.getAlerts();
    const newAlert = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...alert,
      timestamp: Date.now()
    };
    alerts.unshift(newAlert); // Add to beginning
    
    // Keep only last 100 alerts
    if (alerts.length > 100) {
      alerts.splice(100);
    }
    
    await this.set(STORAGE_KEYS.ALERTS, alerts);
    return newAlert;
  }

  // Remove an alert
  async removeAlert(alertId) {
    const alerts = await this.getAlerts();
    const filtered = alerts.filter(a => a.id !== alertId);
    await this.set(STORAGE_KEYS.ALERTS, filtered);
  }

  // Get blocked accounts
  async getBlockedAccounts() {
    return await this.get(STORAGE_KEYS.BLOCKED_ACCOUNTS) || [];
  }

  // Block an account
  async blockAccount(username, platform) {
    const blocked = await this.getBlockedAccounts();
    const accountId = `${platform}:${username}`;
    
    if (!blocked.includes(accountId)) {
      blocked.push(accountId);
      await this.set(STORAGE_KEYS.BLOCKED_ACCOUNTS, blocked);
    }
  }

  // Unblock an account
  async unblockAccount(username, platform) {
    const blocked = await this.getBlockedAccounts();
    const accountId = `${platform}:${username}`;
    const filtered = blocked.filter(id => id !== accountId);
    await this.set(STORAGE_KEYS.BLOCKED_ACCOUNTS, filtered);
  }

  // Check if account is blocked
  async isAccountBlocked(username, platform) {
    const blocked = await this.getBlockedAccounts();
    const accountId = `${platform}:${username}`;
    return blocked.includes(accountId);
  }

  // Get flagged accounts
  async getFlaggedAccounts() {
    return await this.get(STORAGE_KEYS.FLAGGED_ACCOUNTS) || [];
  }

  // Flag an account
  async flagAccount(username, platform, reason) {
    const flagged = await this.getFlaggedAccounts();
    const accountId = `${platform}:${username}`;
    
    const existing = flagged.find(f => f.id === accountId);
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.lastSeen = Date.now();
      if (reason) existing.reasons = [...(existing.reasons || []), reason];
    } else {
      flagged.push({
        id: accountId,
        username,
        platform,
        count: 1,
        reasons: reason ? [reason] : [],
        firstSeen: Date.now(),
        lastSeen: Date.now()
      });
    }
    
    await this.set(STORAGE_KEYS.FLAGGED_ACCOUNTS, flagged);
  }

  // Get settings
  async getSettings() {
    return await this.get(STORAGE_KEYS.SETTINGS) || {
      monitoringEnabled: true,
      autoHideHighRisk: false,
      apiKey: null
    };
  }

  // Update settings
  async updateSettings(updates) {
    const settings = await this.getSettings();
    const updated = { ...settings, ...updates };
    await this.set(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  }

  // Get API key
  async getApiKey() {
    const settings = await this.getSettings();
    return settings.apiKey;
  }

  // Set API key
  async setApiKey(apiKey) {
    await this.updateSettings({ apiKey });
  }

  // Cleanup old data
  async cleanup() {
    const alerts = await this.getAlerts();
    const now = Date.now();
    const sevenDaysAgo = now - CACHE_DURATION;
    
    // Remove alerts older than 7 days
    const recentAlerts = alerts.filter(a => a.timestamp > sevenDaysAgo);
    if (recentAlerts.length !== alerts.length) {
      await this.set(STORAGE_KEYS.ALERTS, recentAlerts);
    }
    
    // Privacy policies are already cleaned up on access
  }
}

export default new StorageManager();

