// OpenRouter API Service - Handles AI model communication

import { OPENROUTER_API_URL, AI_MODELS } from '../utils/constants.js';
import storageManager from './storage-manager.js';
import { getApiKey as getConfigApiKey } from '../config.js';

class ApiService {
  constructor() {
    this.currentModelIndex = 0;
    this.requestQueue = [];
    this.processing = false;
  }

  // Get current API key - checks config.js first, then storage
  async getApiKey() {
    // First check config.js
    const configKey = getConfigApiKey();
    if (configKey && configKey.trim() !== '') {
      return configKey;
    }
    // Fallback to storage (for backward compatibility)
    return await storageManager.getApiKey();
  }

  // Make API request with automatic model fallback
  async makeRequest(prompt, systemPrompt = null, modelIndex = 0) {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Please set it in settings.');
    }

    const model = AI_MODELS[modelIndex] || AI_MODELS[0];
    
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    };

    try {
      // Get extension URL safely
      let refererUrl = '';
      try {
        refererUrl = chrome.runtime.getURL('');
      } catch (e) {
        refererUrl = 'https://safespace-extension';
      }

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': refererUrl,
          'X-Title': 'SafeSpace Extension'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // If rate limited or model unavailable, try next model
        if (response.status === 429 || response.status === 503) {
          if (modelIndex < AI_MODELS.length - 1) {
            console.log(`[ApiService] Model ${model} failed, trying next model...`);
            return await this.makeRequest(prompt, systemPrompt, modelIndex + 1);
          }
        }
        
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Reset to first model on success
      this.currentModelIndex = 0;
      
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error(`[ApiService] Error with model ${model}:`, error);
      
      // Try next model if available
      if (modelIndex < AI_MODELS.length - 1) {
        console.log(`[ApiService] Trying fallback model...`);
        return await this.makeRequest(prompt, systemPrompt, modelIndex + 1);
      }
      
      throw error;
    }
  }

  // Queue a request for batch processing
  async queueRequest(prompt, systemPrompt = null) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ prompt, systemPrompt, resolve, reject });
      this.processQueue();
    });
  }

  // Process queued requests
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const batch = this.requestQueue.splice(0, 1); // Process one at a time to respect rate limits
      
      for (const request of batch) {
        try {
          const result = await this.makeRequest(request.prompt, request.systemPrompt);
          request.resolve(result);
        } catch (error) {
          request.reject(error);
        }
        
        // Small delay between requests
        if (this.requestQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    this.processing = false;
  }
}

export default new ApiService();

