// SafeSpace Extension Script
// Main popup interaction logic

class SafeSpaceManager {
  constructor() {
    this.currentTab = "dashboard"
    this.settings = null
    this.init()
  }

  init() {
    this.setupTabNavigation()
    this.setupEventListeners()
    this.setupHoverActions()
    this.loadData()
    this.setupStorageListener()
  }

  // Tab Navigation
  setupTabNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab")
    const tabContents = document.querySelectorAll(".tab-content")

    navTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.tab

        // Update active tab button
        navTabs.forEach((t) => t.classList.remove("active"))
        tab.classList.add("active")

        // Update active tab content
        tabContents.forEach((content) => content.classList.remove("active"))
        document.getElementById(tabName).classList.add("active")

        this.currentTab = tabName
      })
    })
  }

  // Event Listeners for Buttons
  setupEventListeners() {
    // Settings button
    const settingsBtn = document.querySelector(".settings-btn")
    settingsBtn.addEventListener("click", () => {
      this.showSettings()
    })

    // Hide/Report buttons in alerts (will be set up dynamically)
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("hide-btn") || e.target.closest(".hide-btn")) {
        const btn = e.target.classList.contains("hide-btn") ? e.target : e.target.closest(".hide-btn")
        const alertItem = btn.closest(".alert-item")
        if (alertItem) {
        this.hideAlert(alertItem)
        }
      }
      
      if (e.target.classList.contains("report-btn") || e.target.closest(".report-btn")) {
        const btn = e.target.classList.contains("report-btn") ? e.target : e.target.closest(".report-btn")
        const alertItem = btn.closest(".alert-item")
        if (alertItem) {
          this.reportAlert(alertItem)
        }
      }

      if (e.target.classList.contains("block-account-btn")) {
        const alertItem = e.target.closest(".alert-item")
        if (alertItem) {
          this.blockAccount(alertItem)
        }
      }
    })

    // View Details button
    const viewDetailsBtn = document.getElementById("view-full-analysis-btn") || document.querySelector(".view-details-btn")
    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener("click", () => {
        this.showFullAnalysis()
      })
    }

    // Settings form submission
    const settingsForm = document.getElementById("settings-form")
    if (settingsForm) {
      settingsForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        await this.saveSettings()
      })
    }

    // Clear cache button
    const clearCacheBtn = document.getElementById("clear-cache-btn")
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener("click", () => {
        this.clearCache()
      })
    }

    // Clear alerts button
    const clearAlertsBtn = document.getElementById("clear-alerts-btn")
    if (clearAlertsBtn) {
      clearAlertsBtn.addEventListener("click", () => {
        this.clearAlerts()
      })
    }

    // Test alert button
    const testAlertBtn = document.getElementById("test-alert-btn")
    if (testAlertBtn) {
      testAlertBtn.addEventListener("click", async () => {
        await this.generateTestAlert()
      })
    }
  }

  // Hover Actions on Alert Items
  setupHoverActions() {
    const alertItems = document.querySelectorAll(".alert-item")

    alertItems.forEach((item) => {
      item.addEventListener("mouseenter", () => {
        item.style.backgroundColor = "#f9fafb"
      })

      item.addEventListener("mouseleave", () => {
        item.style.backgroundColor = ""
      })
    })
  }

  // Hide Alert
  async hideAlert(alertElement) {
    const alertId = alertElement.dataset.alertId
    if (alertId) {
      try {
        await chrome.runtime.sendMessage({
          action: "removeAlert",
          alertId
        })
      } catch (error) {
        console.error("Error removing alert:", error)
      }
    }

    alertElement.style.opacity = "0.5"
    alertElement.style.textDecoration = "line-through"
    this.showNotification("Hidden", "Alert hidden from view")

    setTimeout(() => {
      alertElement.style.transition = "all 0.3s ease"
      alertElement.style.maxHeight = "0"
      alertElement.style.overflow = "hidden"
      alertElement.style.marginBottom = "0"
      setTimeout(() => alertElement.remove(), 300)
    }, 1500)
  }

  // Report Alert
  reportAlert(alertElement) {
    const title = alertElement.querySelector(".alert-title").textContent
    this.showNotification("Reported", `"${title}" has been reported to SafeSpace team`)
    console.log("Report sent:", title)
  }

  // Block Account
  async blockAccount(alertElement) {
    const username = alertElement.dataset.username
    const platform = alertElement.dataset.platform || "facebook"
    
    if (username) {
      try {
        await chrome.runtime.sendMessage({
          action: "blockAccount",
          username,
          platform
        })
        this.showNotification("Blocked", `@${username} has been blocked`)
        alertElement.remove()
      } catch (error) {
        console.error("Error blocking account:", error)
        this.showNotification("Error", "Failed to block account")
      }
    }
  }

  // Show Notification (Toast-like)
  showNotification(title, message) {
    const notification = document.createElement("div")
    notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #2563eb, #0369a1);
            color: white;
            padding: 14px 16px;
            border-radius: 8px;
            box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3);
            font-size: 13px;
            z-index: 10002;
            animation: slideIn 0.3s ease;
            max-width: 280px;
        `

    notification.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 12px; opacity: 0.9;">${message}</div>
        `

    document.body.appendChild(notification)

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease"
      setTimeout(() => notification.remove(), 300)
    }, 3000)
  }

  // Load Data from background
  async loadData() {
    console.log("[SafeSpace] Loading extension data...")
    this.updateStatus("Checking connection...", "loading")
    
    try {
      // Check if background is accessible
      let backgroundReady = false
      try {
        const testResponse = await chrome.runtime.sendMessage({ action: "ping" })
        backgroundReady = true
      } catch (error) {
        this.updateStatus("Extension not connected. Please reload the extension.", "error")
        return
      }

      // Load settings first to check API key
      const settingsResponse = await chrome.runtime.sendMessage({ action: "getSettings" })
      if (settingsResponse && settingsResponse.success) {
        this.settings = settingsResponse.settings
        
        // Check API key
        if (!this.settings.apiKey) {
          this.updateStatus("⚠️ API key not configured. Go to Settings to add your OpenRouter API key.", "warning")
        } else if (this.settings.monitoringEnabled === false) {
          this.updateStatus("Monitoring is disabled. Enable it in Settings.", "warning")
        } else {
          this.updateStatus("✓ Extension is active and monitoring", "success")
        }
        
        this.updateSettingsUI()
      }

      // Load stats
      const statsResponse = await chrome.runtime.sendMessage({ action: "getStats" })
      if (statsResponse && statsResponse.success) {
        this.updateStats(statsResponse.stats)
      }

      // Load alerts
      const alertsResponse = await chrome.runtime.sendMessage({ action: "getAlerts" })
      if (alertsResponse && alertsResponse.success) {
        this.updateAlerts(alertsResponse.alerts)
        
        // If no alerts, show helpful message
        if (alertsResponse.alerts.length === 0) {
          this.showNoAlertsMessage()
        }
      }

      // Load current website analysis
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          const url = new URL(tab.url)
          const domain = url.hostname
          
          // Get privacy analysis
          const analysisResponse = await chrome.runtime.sendMessage({
            action: "getPrivacyAnalysis",
            domain: domain
          })
          
          if (analysisResponse && analysisResponse.success && analysisResponse.analysis) {
            console.log(`[SafeSpace] Privacy analysis found for ${domain}, score: ${analysisResponse.analysis.safetyScore}`)
            this.updateWebsiteAnalysis(analysisResponse.analysis, domain)
          } else {
            // Show loading state and trigger analysis if not already done
            this.updateWebsiteAnalysis(null, domain)
            
            // Trigger privacy policy check
            chrome.runtime.sendMessage({
              action: "checkPrivacyPolicy",
              domain: domain,
              url: tab.url
            }).catch(() => {})
            
            // Retry multiple times with increasing delays
            const retryDelays = [3000, 5000, 8000, 12000]
            retryDelays.forEach((delay, index) => {
              setTimeout(async () => {
                const retryResponse = await chrome.runtime.sendMessage({
                  action: "getPrivacyAnalysis",
                  domain: domain
                })
                if (retryResponse && retryResponse.success && retryResponse.analysis) {
                  console.log(`[SafeSpace] Privacy analysis completed for ${domain}, score: ${retryResponse.analysis.safetyScore}`)
                  this.updateWebsiteAnalysis(retryResponse.analysis, domain)
                } else if (index === retryDelays.length - 1) {
                  // Last retry failed - show error state
                  this.updateWebsiteAnalysisError(domain)
                }
              }, delay)
            })
          }
        } else {
          // Show default state for chrome:// pages
          this.updateWebsiteAnalysis(null, null)
        }
      } catch (error) {
        // Ignore errors for chrome:// pages
        console.log('[SafeSpace] Cannot analyze chrome:// pages');
        this.updateWebsiteAnalysis(null, null)
      }

    } catch (error) {
      console.error("[SafeSpace] Error loading data:", error)
      this.updateStatus("Error loading data. Check console for details.", "error")
    }
  }

  // Update status indicator
  updateStatus(message, type = "loading") {
    const statusEl = document.getElementById("status-indicator")
    if (!statusEl) return

    statusEl.className = `status-indicator status-${type}`
    statusEl.innerHTML = `<div class="status-message">${message}</div>`
    
    // Auto-hide success messages after 5 seconds
    if (type === "success") {
      setTimeout(() => {
        if (statusEl.className.includes("status-success")) {
          statusEl.style.display = "none"
        }
      }, 5000)
    } else {
      statusEl.style.display = "block"
    }
  }

  // Show message when no alerts
  showNoAlertsMessage() {
    // This will be handled by updateAlerts, but we can add a dashboard message
    const dashboard = document.getElementById("dashboard")
    if (dashboard) {
      let noAlertsMsg = dashboard.querySelector(".no-alerts-message")
      if (!noAlertsMsg) {
        noAlertsMsg = document.createElement("div")
        noAlertsMsg.className = "no-alerts-message"
        noAlertsMsg.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
            <div style="font-weight: 600; margin-bottom: 4px;">No alerts yet</div>
            <div>Visit Facebook or other websites to see safety analysis</div>
          </div>
        `
        const activitySection = dashboard.querySelector(".activity-section")
        if (activitySection) {
          activitySection.parentNode.insertBefore(noAlertsMsg, activitySection.nextSibling)
        }
      }
    }
  }

  // Update stats in dashboard
  updateStats(stats) {
    const highRiskEl = document.getElementById("stat-high-risk")
    const warningsEl = document.getElementById("stat-warnings")
    const flaggedEl = document.getElementById("stat-flagged")
    
    if (highRiskEl) {
      highRiskEl.textContent = stats.highRiskPosts || 0
    }
    if (warningsEl) {
      warningsEl.textContent = stats.warnings || 0
    }
    if (flaggedEl) {
      flaggedEl.textContent = stats.flaggedAccounts || 0
    }

    // Update recent activity
    this.updateRecentActivity(stats)
  }

  // Update recent activity
  async updateRecentActivity(stats) {
    const activityList = document.getElementById("activity-list")
    if (!activityList) return

    try {
      // Get recent alerts to show activity
      const alertsResponse = await chrome.runtime.sendMessage({ action: "getAlerts" })
      if (alertsResponse && alertsResponse.success && alertsResponse.alerts.length > 0) {
        const recentAlerts = alertsResponse.alerts.slice(0, 5)
        activityList.innerHTML = ""
        
        recentAlerts.forEach(alert => {
          const activityItem = document.createElement("div")
          activityItem.className = "activity-item"
          
          const timeAgo = this.formatTimeAgo(alert.timestamp)
          const platform = alert.source === 'facebook' ? 'Facebook' : alert.domain || alert.source || 'Website'
          
          activityItem.innerHTML = `
            <div class="activity-timestamp">${timeAgo}</div>
            <p class="activity-text">${this.escapeHtml(alert.title)} on ${platform}</p>
          `
          activityList.appendChild(activityItem)
        })
      } else {
        activityList.innerHTML = `
          <div class="activity-item" style="text-align: center; padding: 20px; color: #6b7280;">
            <p class="activity-text">No recent activity</p>
          </div>
        `
      }
    } catch (error) {
      console.error("Error updating activity:", error)
    }
  }

  // Update alerts list
  updateAlerts(alerts) {
    const alertsContainer = document.querySelector(".alerts-container")
    if (!alertsContainer) return

    // Clear existing alerts (except template ones if any)
    alertsContainer.innerHTML = ""

    if (alerts.length === 0) {
      alertsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
          <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
          <div style="font-weight: 600; margin-bottom: 4px;">No alerts</div>
          <div style="font-size: 12px;">You're all safe! No safety concerns detected recently.</div>
        </div>
      `
      return
    }

    // Sort alerts by severity (high first, then medium, then low)
    const severityOrder = { 'high': 0, 'medium': 1, 'low': 2, 'safe': 3 }
    const sortedAlerts = alerts.sort((a, b) => {
      const aSeverity = a.severity || 'low'
      const bSeverity = b.severity || 'low'
      const aOrder = severityOrder[aSeverity] !== undefined ? severityOrder[aSeverity] : 99
      const bOrder = severityOrder[bSeverity] !== undefined ? severityOrder[bSeverity] : 99
      
      // If same severity, sort by timestamp (newest first)
      if (aOrder === bOrder) {
        return (b.timestamp || 0) - (a.timestamp || 0)
      }
      return aOrder - bOrder
    })

    sortedAlerts.forEach(alert => {
      const alertEl = this.createAlertElement(alert)
      alertsContainer.appendChild(alertEl)
    })
  }

  // Create alert element
  createAlertElement(alert) {
    const div = document.createElement("div")
    // Ensure severity is valid (default to 'low' if invalid)
    const severity = alert.severity && ['high', 'medium', 'low'].includes(alert.severity) 
      ? alert.severity 
      : 'low'
    
    div.className = `alert-item alert-${severity}`
    div.dataset.alertId = alert.id
    div.dataset.username = alert.username || ""
    div.dataset.platform = alert.source || "unknown"

    const timeAgo = this.formatTimeAgo(alert.timestamp)

    div.innerHTML = `
      <div class="alert-indicator ${severity}"></div>
      <div class="alert-content">
        <div class="alert-title">${this.escapeHtml(alert.title)}</div>
        <p class="alert-description">${this.escapeHtml(alert.description)}</p>
        <div class="alert-meta">${alert.username ? `@${this.escapeHtml(alert.username)} • ` : ""}${timeAgo}</div>
      </div>
      <div class="alert-actions">
        <button class="action-btn hide-btn" title="Hide">Hide</button>
        ${alert.username ? `<button class="action-btn block-account-btn" title="Block">Block</button>` : ""}
        <button class="action-btn report-btn" title="Report">Report</button>
      </div>
    `

    return div
  }

  // Update website analysis
  updateWebsiteAnalysis(analysis, domain = null) {
    const scoreNumber = document.getElementById("score-number")
    const scoreFill = document.getElementById("score-fill")
    const scoreDescription = document.getElementById("score-description")
    const riskList = document.getElementById("risk-list")

    if (!analysis) {
      // Show loading/default state
      if (scoreNumber) scoreNumber.textContent = "--"
      if (scoreFill) {
        scoreFill.style.width = "0%"
        scoreFill.className = "score-fill"
        scoreFill.style.background = "linear-gradient(90deg, #e5e7eb, #d1d5db)"
      }
      if (scoreDescription) {
        scoreDescription.textContent = domain 
          ? `Analyzing ${domain}...` 
          : "No website selected"
        scoreDescription.style.color = "#6b7280"
      }
      if (riskList) {
        riskList.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            ${domain ? "Analysis in progress. This may take a few moments..." : "No analysis available"}
          </div>
        `
      }
      return
    }

    const score = Math.round(analysis.safetyScore || 50)

    if (scoreNumber) {
      scoreNumber.textContent = score
      // Update color based on score
      if (score >= 70) {
        scoreNumber.style.color = "#22c55e"
      } else if (score >= 40) {
        scoreNumber.style.color = "#eab308"
      } else {
        scoreNumber.style.color = "#ef4444"
      }
    }

    if (scoreFill) {
      scoreFill.style.width = `${score}%`
      scoreFill.className = `score-fill ${score >= 70 ? "good" : score >= 40 ? "warning" : "danger"}`
    }

    if (scoreDescription) {
      let desc = "Unknown"
      let color = "#6b7280"
      if (score >= 70) {
        desc = "Good - Minor privacy concerns detected"
        color = "#22c55e"
      } else if (score >= 40) {
        desc = "Warning - Some privacy concerns detected"
        color = "#eab308"
      } else {
        desc = "Poor - Significant privacy risks detected"
        color = "#ef4444"
      }
      scoreDescription.textContent = desc
      scoreDescription.style.color = color
    }

    if (riskList) {
      riskList.innerHTML = ""
      
      // Add risk factors
      if (analysis.riskFactors && analysis.riskFactors.length > 0) {
        analysis.riskFactors.forEach(factor => {
          const item = document.createElement("div")
          item.className = "risk-item"
          item.innerHTML = `
            <span class="risk-icon">${this.getRiskIcon(factor.type)}</span>
            <span class="risk-text">${this.escapeHtml(factor.description)}</span>
          `
          riskList.appendChild(item)
        })
      }

      // Add positive factors
      if (analysis.positiveFactors && analysis.positiveFactors.length > 0) {
        analysis.positiveFactors.forEach(factor => {
          const item = document.createElement("div")
          item.className = "risk-item good"
          item.innerHTML = `
            <span class="risk-icon">✓</span>
            <span class="risk-text">${this.escapeHtml(factor)}</span>
          `
          riskList.appendChild(item)
        })
      }

      if (riskList.children.length === 0) {
        riskList.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            No risk factors found
          </div>
        `
      }

      // Add key points if available
      if (analysis.keyPoints && analysis.keyPoints.length > 0) {
        const keyPointsSection = document.querySelector('.key-points-section');
        if (!keyPointsSection) {
          const keyPointsDiv = document.createElement('div');
          keyPointsDiv.className = 'key-points-section';
          keyPointsDiv.style.cssText = 'margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;';
          keyPointsDiv.innerHTML = `
            <h4 class="subsection-title">Key Points to Know</h4>
            <div class="key-points-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
            </div>
          `;
          riskList.parentElement.appendChild(keyPointsDiv);
        }
        
        const keyPointsList = document.querySelector('.key-points-list');
        if (keyPointsList) {
          keyPointsList.innerHTML = '';
          analysis.keyPoints.forEach(point => {
            const item = document.createElement('div');
            item.style.cssText = 'padding: 10px; background: #f0f4ff; border-left: 3px solid #2563eb; border-radius: 6px; font-size: 12px; color: #374151; line-height: 1.5;';
            item.textContent = `• ${point}`;
            keyPointsList.appendChild(item);
          });
        }
      }

      // Update terms summary section
      const termsSummaryContent = document.getElementById('terms-summary-content');
      if (termsSummaryContent) {
        if (analysis.summary) {
          termsSummaryContent.innerHTML = `
            <p style="font-size: 13px; color: #374151; line-height: 1.6; margin-bottom: 12px;">
              ${this.escapeHtml(analysis.summary)}
            </p>
            ${analysis.recommendations && analysis.recommendations.length > 0 ? `
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                <div style="font-weight: 600; font-size: 12px; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Recommendations
                </div>
                <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #374151; line-height: 1.8;">
                  ${analysis.recommendations.map(rec => `<li>${this.escapeHtml(rec)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          `;
        } else {
          termsSummaryContent.innerHTML = `
            <p style="color: #6b7280;">Privacy policy analysis in progress. Please wait...</p>
          `;
        }
      }
      
      // Add summary section if available (for backwards compatibility)
      if (analysis.summary) {
        let summarySection = document.querySelector('.privacy-summary-section');
        if (!summarySection) {
          summarySection = document.createElement('div');
          summarySection.className = 'privacy-summary-section';
          summarySection.style.cssText = 'margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;';
          const scoreSection = document.querySelector('.safety-score-section');
          if (scoreSection) {
            scoreSection.parentElement.insertBefore(summarySection, scoreSection.nextSibling);
          }
        }
        
        summarySection.innerHTML = `
          <h4 class="subsection-title" style="margin-bottom: 12px;">Privacy Policy Summary</h4>
          <p style="font-size: 13px; color: #374151; line-height: 1.6; margin-bottom: 12px;">
            ${this.escapeHtml(analysis.summary)}
          </p>
          ${analysis.recommendations && analysis.recommendations.length > 0 ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
              <div style="font-weight: 600; font-size: 12px; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                Recommendations
              </div>
              <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #374151; line-height: 1.8;">
                ${analysis.recommendations.map(rec => `<li>${this.escapeHtml(rec)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        `;
      }
    }
  }

  // Update website analysis error state
  updateWebsiteAnalysisError(domain) {
    const scoreNumber = document.getElementById("score-number")
    const scoreFill = document.getElementById("score-fill")
    const scoreDescription = document.getElementById("score-description")
    const riskList = document.getElementById("risk-list")

    if (scoreNumber) scoreNumber.textContent = "N/A"
    if (scoreFill) {
      scoreFill.style.width = "0%"
      scoreFill.className = "score-fill"
    }
    if (scoreDescription) {
      scoreDescription.textContent = `Unable to analyze ${domain || 'website'}. Privacy policy may not be available.`
      scoreDescription.style.color = "#6b7280"
    }
    if (riskList) {
      riskList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
          Analysis unavailable. The website may not have a publicly accessible privacy policy.
        </div>
      `
    }
  }

  getRiskIcon(type) {
    const icons = {
      location_tracking: "●",
      data_sharing: "●",
      third_party: "●",
      retention: "●",
      user_control: "●",
      other: "●"
    }
    return icons[type] || "●"
  }

  formatTimeAgo(timestamp) {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  // Show settings
  showSettings() {
    const settingsTab = document.querySelector('[data-tab="settings"]')
    if (settingsTab) {
      settingsTab.click()
    } else {
      // If settings tab doesn't exist, show modal
      this.showSettingsModal()
    }
  }

  showSettingsModal() {
    // Create modal overlay
    const modal = document.createElement("div")
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 400px; width: 90%; max-height: 80vh; overflow-y: auto;">
        <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700;">Settings</h2>
        <form id="settings-form-modal">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #374151;">
              OpenRouter API Key
            </label>
            <input type="password" id="api-key-input" placeholder="sk-or-v1-..." 
              style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px;">
            <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
              Get your API key from <a href="https://openrouter.ai" target="_blank" style="color: #2563eb;">openrouter.ai</a>
            </div>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151;">
              <input type="checkbox" id="monitoring-enabled" style="width: 16px; height: 16px;">
              <span>Enable monitoring</span>
            </label>
          </div>
          <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151;">
              <input type="checkbox" id="auto-hide-high" style="width: 16px; height: 16px;">
              <span>Auto-hide high-risk content</span>
            </label>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="submit" style="flex: 1; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Save
            </button>
            <button type="button" id="close-settings" style="padding: 10px 16px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Cancel
            </button>
          </div>
        </form>
            </div>
        `

    document.body.appendChild(modal)

    // Populate form
    if (this.settings) {
      const apiKeyInput = modal.querySelector("#api-key-input")
      const monitoringCheck = modal.querySelector("#monitoring-enabled")
      const autoHideCheck = modal.querySelector("#auto-hide-high")

      if (apiKeyInput) apiKeyInput.value = this.settings.apiKey || ""
      if (monitoringCheck) monitoringCheck.checked = this.settings.monitoringEnabled !== false
      if (autoHideCheck) autoHideCheck.checked = this.settings.autoHideHighRisk || false
    }

    // Handle form submission
    const form = modal.querySelector("#settings-form-modal")
    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      await this.saveSettingsFromModal(modal)
      modal.remove()
    })

    // Handle close
    modal.querySelector("#close-settings").addEventListener("click", () => {
      modal.remove()
    })

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove()
      }
    })
  }

  async saveSettingsFromModal(modal) {
    const apiKey = modal.querySelector("#api-key-input").value.trim()
    const monitoringEnabled = modal.querySelector("#monitoring-enabled").checked
    const autoHideHighRisk = modal.querySelector("#auto-hide-high").checked

    try {
      const response = await chrome.runtime.sendMessage({
        action: "updateSettings",
        settings: {
          apiKey,
          monitoringEnabled,
          autoHideHighRisk
        }
      })

      if (response && response.success) {
        this.settings = response.settings
        this.showNotification("Settings Saved", "Your preferences have been updated")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      this.showNotification("Error", "Failed to save settings")
    }
  }

  async saveSettings() {
    const apiKeyInput = document.getElementById("api-key-input")
    const monitoringCheck = document.getElementById("monitoring-enabled")
    const autoHideHigh = document.getElementById("auto-hide-high")
    const autoHideMedium = document.getElementById("auto-hide-medium")

    if (!apiKeyInput) return

    const apiKey = apiKeyInput.value.trim()
    const monitoringEnabled = monitoringCheck ? monitoringCheck.checked : true
    const autoHideHighRisk = autoHideHigh ? autoHideHigh.checked : false
    const autoHideMediumRisk = autoHideMedium ? autoHideMedium.checked : false

    try {
      const response = await chrome.runtime.sendMessage({
        action: "updateSettings",
        settings: {
          apiKey,
          monitoringEnabled,
          autoHideHighRisk,
          autoHideMediumRisk
        }
      })

      if (response && response.success) {
        this.settings = response.settings
        this.showNotification("Settings Saved", "Your preferences have been updated")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      this.showNotification("Error", "Failed to save settings")
    }
  }

  async clearCache() {
    if (confirm("Are you sure you want to clear all cached privacy policies? This will require re-analyzing websites.")) {
      try {
        await chrome.storage.local.set({ privacy_policies: {} })
        this.showNotification("Cache Cleared", "Privacy policy cache has been cleared")
      } catch (error) {
        console.error("Error clearing cache:", error)
        this.showNotification("Error", "Failed to clear cache")
      }
    }
  }

  async clearAlerts() {
    if (confirm("Are you sure you want to clear all alerts? This action cannot be undone.")) {
      try {
        await chrome.storage.local.set({ alerts: [] })
        this.showNotification("Alerts Cleared", "All alerts have been removed")
        this.loadData() // Reload to update UI
      } catch (error) {
        console.error("Error clearing alerts:", error)
        this.showNotification("Error", "Failed to clear alerts")
      }
    }
  }

  async generateTestAlert() {
    try {
      const response = await chrome.runtime.sendMessage({ action: "testAlert" })
      if (response && response.success) {
        this.showNotification("Test Alert Generated", "Check the Alerts tab to see it")
        // Reload alerts
        setTimeout(() => {
          this.loadData()
        }, 500)
      }
    } catch (error) {
      console.error("Error generating test alert:", error)
      this.showNotification("Error", "Failed to generate test alert")
    }
  }

  updateSettingsUI() {
    // Update settings form with current values
    if (this.settings) {
      const apiKeyInput = document.getElementById("api-key-input")
      const monitoringCheck = document.getElementById("monitoring-enabled")
      const autoHideHigh = document.getElementById("auto-hide-high")
      const autoHideMedium = document.getElementById("auto-hide-medium")

      if (apiKeyInput) apiKeyInput.value = this.settings.apiKey || ""
      if (monitoringCheck) monitoringCheck.checked = this.settings.monitoringEnabled !== false
      if (autoHideHigh) autoHideHigh.checked = this.settings.autoHideHighRisk || false
      if (autoHideMedium) autoHideMedium.checked = this.settings.autoHideMediumRisk || false
    }
  }

  async showFullAnalysis() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        const url = new URL(tab.url)
        const domain = url.hostname
        
        // Get privacy analysis
        const analysisResponse = await chrome.runtime.sendMessage({
          action: "getPrivacyAnalysis",
          domain: domain
        })
        
        if (analysisResponse && analysisResponse.success && analysisResponse.analysis) {
          // Switch to website tab and show analysis
          const websiteTab = document.querySelector('[data-tab="website"]')
          if (websiteTab) {
            websiteTab.click()
          }
          
          // Update the analysis display
          this.updateWebsiteAnalysis(analysisResponse.analysis, domain)
          
          this.showNotification("Privacy Analysis", "Full analysis displayed in Website tab")
        } else {
          // Try to trigger analysis
          await chrome.runtime.sendMessage({
            action: "checkPrivacyPolicy",
            domain: domain,
            url: tab.url
          })
          
          this.showNotification("Analysis", "Privacy policy analysis in progress. Please wait a moment and click again.")
        }
      } else {
        this.showNotification("Analysis", "Please visit a website to see privacy analysis")
      }
    } catch (error) {
      console.error("Error showing full analysis:", error)
      this.showNotification("Error", "Could not load privacy analysis")
    }
  }

  // Listen for storage changes to update UI
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        // Reload data when storage changes
        if (changes.alerts) {
          console.log("[SafeSpace] Alerts changed, reloading...")
          this.loadData()
        }
        if (changes.settings) {
          this.loadData()
        }
      }
    })

    // Also listen for messages from background about new alerts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "newAlert") {
        console.log("[SafeSpace] New alert received, reloading...")
        this.loadData()
      }
      
      if (request.action === "switchToAlertsTab") {
        // Only switch if explicitly requested (e.g., from "View Details" button)
        const alertsTab = document.querySelector('[data-tab="alerts"]')
        if (alertsTab) {
          alertsTab.click()
        }
      }
      
      if (request.action === "privacyAnalysisUpdated") {
        console.log("[SafeSpace] Privacy analysis updated, refreshing...")
        // Refresh website analysis immediately so it stops showing "Analyzing..."
        if (request.analysis) {
          this.updateWebsiteAnalysis(request.analysis, request.domain || null)
        }
        // Keep data in sync with storage
        this.loadData()
      }
    })
  }
}


// Initialize based on context
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new SafeSpaceManager()
  })
} else {
  new SafeSpaceManager()
}

// Add CSS animations to document if not already present
const style = document.createElement("style")
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`
document.head.appendChild(style)
