// Alert Manager - Generates and manages alerts

import storageManager from './storage-manager.js';
import { ALERT_TYPES, RISK_LEVELS } from '../utils/constants.js';

class AlertManager {
  // Generate alert from content analysis
  async generateAlert(analysis, content, context = {}) {
    if (analysis.riskLevel === RISK_LEVELS.SAFE) {
      return null;
    }

    const alert = {
      type: analysis.riskType || ALERT_TYPES.HARASSMENT,
      severity: analysis.riskLevel,
      title: this.getAlertTitle(analysis.riskType, analysis.riskLevel),
      description: analysis.explanation || 'Safety concern detected',
      content: content ? content.substring(0, 200) : '', // Truncate for storage
      source: context.platform || 'unknown',
      username: context.username || null,
      url: context.url || null,
      domain: context.domain || null,
      indicators: analysis.indicators || [],
      recommendation: analysis.recommendation || null,
      timestamp: Date.now()
    };

    // Save alert
    const savedAlert = await storageManager.addAlert(alert);
    
    // If high risk, also flag the account
    if (analysis.riskLevel === RISK_LEVELS.HIGH && context.username) {
      await storageManager.flagAccount(
        context.username,
        context.platform || 'unknown',
        analysis.riskType
      );
    }

    return savedAlert;
  }

  getAlertTitle(riskType, severity) {
    const titles = {
      [ALERT_TYPES.HARASSMENT]: severity === RISK_LEVELS.HIGH 
        ? '⚠️ Harassment Detected'
        : 'Harassment Warning',
      'cyberbullying': severity === RISK_LEVELS.HIGH
        ? '🚨 Cyberbullying Detected'
        : 'Cyberbullying Warning',
      [ALERT_TYPES.PRIVACY]: 'Privacy Risk Detected',
      [ALERT_TYPES.ACCOUNT_RISK]: 'Suspicious Account Detected',
      [ALERT_TYPES.THREAT]: '⚠️ Threatening Content Detected',
      [ALERT_TYPES.DOXXING]: 'Doxxing Risk Detected',
      [ALERT_TYPES.MANIPULATION]: 'Manipulative Content Detected',
      'gbv': 'Gender-Based Violence Risk Detected'
    };

    return titles[riskType] || 'Safety Concern Detected';
  }

  // Get alerts by severity
  async getAlertsBySeverity(severity) {
    const alerts = await storageManager.getAlerts();
    return alerts.filter(a => a.severity === severity);
  }

  // Get recent alerts
  async getRecentAlerts(limit = 20) {
    const alerts = await storageManager.getAlerts();
    return alerts.slice(0, limit);
  }

  // Get stats for dashboard
  async getStats() {
    const alerts = await storageManager.getAlerts();
    const flagged = await storageManager.getFlaggedAccounts();
    
    // Count warnings from all websites (medium and low risk alerts)
    const warnings = alerts.filter(a => 
      a.severity === RISK_LEVELS.MEDIUM || a.severity === RISK_LEVELS.LOW
    ).length;
    
    return {
      highRiskPosts: alerts.filter(a => a.severity === RISK_LEVELS.HIGH).length,
      warnings: warnings,
      flaggedAccounts: flagged.length,
      totalAlerts: alerts.length
    };
  }
}

export default new AlertManager();

