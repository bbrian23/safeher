// SafeSpace Extension Configuration
// Store your OpenRouter API key here
// Note: This file should be kept secure and not committed to public repositories

export const CONFIG = {
  // OpenRouter API Key
  // Get your API key from: https://openrouter.ai/keys
  // Format: sk-or-v1-...
  OPENROUTER_API_KEY: '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', // Add your API key here
  
  // Other configuration options
  DEFAULT_MODEL: 'anthropic/claude-3.5-sonnet',
  REQUEST_TIMEOUT: 30000, // 30 seconds
};

// Helper function to get API key
export function getApiKey() {
  return CONFIG.OPENROUTER_API_KEY;
}

