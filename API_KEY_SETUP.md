# API Key Setup Instructions

Since we removed the API key field from the extension UI for security, you now need to configure it in the `config.js` file.

## How to Set Up Your OpenRouter API Key

### Step 1: Get Your API Key
1. Go to [OpenRouter.ai](https://openrouter.ai/keys)
2. Sign up or log in
3. Create a new API key
4. Copy your API key (format: `sk-or-v1-...`)

### Step 2: Add API Key to config.js
1. Open the `config.js` file in the project root
2. Find the line: `OPENROUTER_API_KEY: '',`
3. Replace the empty string with your API key:
   ```javascript
   OPENROUTER_API_KEY: 'sk-or-v1-your-actual-api-key-here',
   ```
4. Save the file

### Step 3: Reload the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Find "SafeSpace - Online Safety Assistant"
3. Click the **Reload** button (circular arrow icon)
4. The extension will now use your API key from `config.js`

## Important Notes

- **Security**: Never commit `config.js` with your API key to public repositories
- **Fallback**: If no API key is found in `config.js`, the extension will use keyword-based analysis (still functional but less accurate)
- **Storage**: The extension will check `config.js` first, then fall back to stored settings (for backward compatibility)

## Verification

After setting up your API key:
1. The extension will use AI-powered analysis when an API key is present
2. Check the browser console (F12) for messages like:
   - `[ApiService] Using API key from config.js` (if key is found)
   - `[Background] API key not configured in config.js. Falling back to keyword-only analysis.` (if key is missing)

## Troubleshooting

**No alerts showing up?**
- Check that your API key is correctly formatted in `config.js`
- Make sure you reloaded the extension after adding the key
- Check browser console for errors
- Verify the API key is valid at OpenRouter.ai

**Alerts appear but not saved?**
- This should work automatically when content is detected
- Check browser console for any error messages
- Try reloading the extension

