// Content Analyzer - Analyzes text content for GBV indicators

import apiService from './api-service.js';
import { RISK_LEVELS, ALERT_TYPES, RISK_TAXONOMY } from '../utils/constants.js';

class ContentAnalyzer {
  constructor() {
    this.systemPrompt = `You are an expert safety AI assistant specialized in detecting gender-based violence (GBV), cyberbullying, harassment, stalking, privacy/doxxing threats, and online safety threats. You must be HIGHLY SENSITIVE to any form of harmful content and use the provided taxonomy to broaden context detection.

Analyze the provided text and identify ANY of the following:

1. **Cyberbullying & Harassment:**
   - Insults, name-calling, or derogatory language
   - Threats of sharing photos or personal information
   - Body shaming or appearance-based attacks
   - Public humiliation attempts
   - Repeated negative comments

2. **Gender-Based Violence Indicators:**
   - Sexist or misogynistic statements
   - Gender-based discrimination
   - Threats related to gender
   - Controlling or possessive language
   - Statements about "sharing photos" or "exposing" someone

3. **Threatening Language:**
   - Direct or indirect threats
   - Intimidation attempts
   - Coercive statements
   - Blackmail indicators

4. **Privacy & Doxxing Risks:**
   - Threats to share personal information
   - Location sharing risks
   - Personal data exposure
   - Non-consensual content sharing threats

5. **Manipulative Content:**
   - Gaslighting attempts
   - Emotional manipulation
   - Coercive control language

6. **Stalking Indicators:**
   - Unwanted attention
   - Obsessive behavior patterns
   - Boundary violations

7. **Doxxing/Exposure & Privacy Abuse:**
   - Leaking personal info (address, phone, workplace, school)
   - Threats to share photos, chats, or private data
   - Blackmail/“leak” language even if implied

**Risk Taxonomy (JSON for reference, use to classify and expand patterns):**
${JSON.stringify(RISK_TAXONOMY, null, 2)}

**IMPORTANT:** Be especially alert for:
- Comments containing "I will share your photos" OR any variation of leaking/exposing media
- Threats to expose or embarrass someone
- Body shaming or appearance insults
- Gender-based put-downs or coercive control language
- Stalking language (finding, tracking, following)
- Any language that could cause emotional harm or fear

Respond ONLY with a JSON object in this exact format:
{
  "riskLevel": "high" | "medium" | "low" | "safe",
  "riskType": "harassment" | "cyberbullying" | "privacy" | "account_risk" | "threat" | "doxxing" | "manipulation" | "gbv" | null,
  "confidence": 0.0-1.0,
  "indicators": ["specific", "indicators", "found"],
  "explanation": "Detailed explanation of why this is harmful",
  "recommendation": "Specific actionable recommendation (e.g., 'Block this account immediately' if it's a comment)",
  "isComment": true/false,
  "suggestBlock": true/false
}`;
  }

  async analyzeContent(text, context = {}) {
    if (!text || text.trim().length === 0) {
      return {
        riskLevel: RISK_LEVELS.SAFE,
        riskType: null,
        confidence: 0,
        indicators: [],
        explanation: 'No content to analyze',
        recommendation: null
      };
    }

    const isComment = context.type === 'comment' || context.isComment === true;
    const contentType = isComment ? 'COMMENT' : 'POST';
    
    const prompt = `Analyze this ${contentType} for cyberbullying, harassment, GBV, stalking, privacy/doxxing, and safety risks. Use the taxonomy above to spot broader variations (synonyms, implied threats, coercion, stalking language).

**Content Text:** "${text}"

**Context:**
${context.username ? `- Author/Username: ${context.username}` : ''}
${context.platform ? `- Platform: ${context.platform}` : ''}
${isComment ? `- Type: COMMENT (This is a comment, not a main post)` : '- Type: POST'}
${context.parentText ? `- Parent Post Context: "${context.parentText.substring(0, 200)}"` : ''}
${context.replyTo ? `- Replying to: ${context.replyTo}` : ''}

**Analysis Requirements - Be COMPREHENSIVE and detect ANY form of harm:**
1. **Cyberbullying & Harassment:**
   - ANY insults, name-calling, derogatory language
   - Body shaming, appearance-based attacks
   - Threats (explicit or implied)
   - Intimidation or coercion
   - Public humiliation attempts

2. **Photo/Privacy Threats:**
   - Threats to share photos (any variation: "share your photos", "post your pics", "expose you", "leak your", etc.)
   - Threats to reveal personal information
   - Doxxing threats
   - Blackmail attempts

3. **Gender-Based Violence:**
   - Sexist or misogynistic statements
   - Gender-based discrimination or put-downs
   - Controlling language
   - Statements about "obeying" or "submitting"

4. **Stalking & Obsessive Behavior:**
   - Unwanted attention
   - Boundary violations
   - Obsessive or possessive language

5. **Emotional Harm:**
   - Gaslighting
   - Emotional manipulation
   - Coercive control
   - Any language designed to cause emotional distress

**IMPORTANT:** 
- Look for ANY variation of harmful language, not just exact phrases
- Be sensitive to context - even "jokes" can be harmful
- Consider cultural and linguistic variations
- Flag ANYTHING that could cause harm, distress, or safety concerns
- If this is a COMMENT with harmful content, strongly suggest blocking

Examples of harmful content (but detect ANY similar patterns; expand using the taxonomy):
- "I will share your photos ugly boy" → HIGH RISK
- "You'll regret it" → HIGH RISK (threatening)
- "Send me details or else" → HIGH RISK (coercive)
- Any body shaming or appearance insults → HIGH RISK
- Gender-based put-downs → MEDIUM-HIGH RISK

Provide your analysis in the specified JSON format.`;

    try {
      const response = await apiService.makeRequest(prompt, this.systemPrompt);
      
      // Try to extract JSON from response
      let analysis;
      try {
        // Look for JSON in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: try to infer from text response
        console.warn('[ContentAnalyzer] Failed to parse JSON, using fallback');
        analysis = this.fallbackAnalysis(response, text);
      }

      // Validate and normalize response
      return {
        riskLevel: analysis.riskLevel || RISK_LEVELS.SAFE,
        riskType: analysis.riskType || null,
        confidence: analysis.confidence || 0.5,
        indicators: analysis.indicators || [],
        explanation: analysis.explanation || 'Analysis completed',
        recommendation: analysis.recommendation || null,
        isComment: analysis.isComment !== undefined ? analysis.isComment : isComment,
        suggestBlock: analysis.suggestBlock || false
      };
    } catch (error) {
      console.error('[ContentAnalyzer] Error analyzing content:', error);
      
      // Fallback to basic keyword detection
      return this.fallbackAnalysis(null, text);
    }
  }

  // Fallback analysis using keyword detection
  fallbackAnalysis(aiResponse, text) {
    const lowerText = text.toLowerCase();
    
    // High-risk keywords (cyberbullying, harassment, threats) - BROAD PATTERNS
    const highRiskKeywords = [
      // Photo sharing threats (many variations)
      'share your photo', 'share your photos', 'share your pic', 'share your pics',
      'post your photo', 'post your photos', 'post your pic', 'post your pics',
      'expose you', 'expose your', 'leak your', 'leak your photo',
      'publish your', 'reveal your', 'show everyone', 'show your',
      'going to share', 'will share', 'gonna share', 'i will share',
      'i\'ll share', 'i\'m going to share', 'i will post', 'i\'ll post',
      
      // Threats and intimidation
      'you\'ll regret', 'you will regret', 'you\'ll see', 'you will see',
      'what will happen', 'what happens next', 'or else', 'or you\'ll',
      'if you don\'t', 'unless you', 'you better', 'you\'d better',
      'kill', 'die', 'hurt', 'harm', 'threat', 'threaten',
      
      // Stalking and finding
      'find you', 'find your', 'look for you', 'come for you', 'track you', 'track your',
      'address', 'location', 'where you live', 'home address',
      'where are you', 'where you at', 'where you work', 'where you study',
      'stalk', 'stalking', 'following you'
    ];
    
    // Cyberbullying keywords - COMPREHENSIVE
    const cyberbullyingKeywords = [
      // Appearance insults
      'ugly', 'fat', 'skinny', 'disgusting', 'gross', 'hideous',
      'stupid', 'idiot', 'moron', 'dumb', 'fool', 'loser',
      'pathetic', 'worthless', 'useless', 'trash', 'garbage',
      'nobody likes you', 'everyone hates you', 'no one wants you',
      'you deserve', 'should die', 'you should', 'you need to',
      
      // Gender-based insults
      'bitch', 'slut', 'whore', 'hoe', 'thot',
      'weak', 'pathetic man', 'real man', 'be a man',
      'women should', 'men should', 'because you\'re a',
      
      // Emotional harm
      'nobody cares', 'no one cares', 'who cares', 'who asked',
      'shut up', 'go away', 'leave', 'get lost', 'fuck off'
    ];
    
    // Medium-risk keywords
    const mediumRiskKeywords = [
      'harass', 'abuse', 'violence', 'attack', 'expose', 'leak',
      'personal info', 'private message', 'dox', 'embarrass you',
      'make fun of', 'laugh at you'
    ];
    
    // Privacy risk keywords
    const privacyKeywords = [
      'location', 'gps', 'tracking', 'where are you', 'your address',
      'phone number', 'email', 'real name', 'where you work', 'where you study'
    ];
    
    // Gender-based violence keywords - COMPREHENSIVE
    const gbvKeywords = [
      // Control and submission
      'women should', 'men should', 'because you\'re a woman', 'because you\'re a man',
      'obey', 'submit', 'control', 'belongs to', 'property', 'my woman', 'my man',
      'you belong to', 'you\'re mine', 'you\'re my', 'do as i say',
      'listen to me', 'do what i tell you', 'follow my orders',
      
      // Gender stereotypes
      'act like a man', 'be a man', 'man up', 'real men',
      'women belong', 'women are meant to', 'girls should', 'boys should',
      'that\'s a woman\'s job', 'that\'s a man\'s job',
      
      // Discriminatory language
      'inferior', 'superior', 'weak', 'strong', 'emotional', 'logical'
    ];

    let riskLevel = RISK_LEVELS.SAFE;
    let riskType = null;
    const indicators = [];
    let suggestBlock = false;

    // Check for high-risk patterns (threats, photo sharing threats)
    // Use word boundaries to avoid false positives, but be comprehensive
    for (const keyword of highRiskKeywords) {
      // Check if keyword appears in text (case-insensitive, partial match)
      const keywordLower = keyword.toLowerCase();
      if (lowerText.includes(keywordLower)) {
        riskLevel = RISK_LEVELS.HIGH;
        riskType = ALERT_TYPES.THREAT;
        indicators.push(`Contains threatening language: "${keyword}"`);
        suggestBlock = true;
        // Don't break - check for multiple indicators
      }
    }

    // Check for cyberbullying (can combine with threats)
    for (const keyword of cyberbullyingKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        if (riskLevel === RISK_LEVELS.SAFE) {
          riskLevel = RISK_LEVELS.HIGH;
          riskType = ALERT_TYPES.HARASSMENT;
        }
        indicators.push(`Cyberbullying detected: "${keyword}"`);
        suggestBlock = true;
        // Don't break - collect all indicators
      }
    }

    // Check for GBV (can combine with other risks)
    for (const keyword of gbvKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        if (riskLevel === RISK_LEVELS.SAFE) {
          riskLevel = RISK_LEVELS.MEDIUM;
          riskType = ALERT_TYPES.HARASSMENT;
        } else if (riskLevel === RISK_LEVELS.MEDIUM) {
          riskLevel = RISK_LEVELS.HIGH; // Upgrade if combined with other risks
        }
        indicators.push(`Gender-based content: "${keyword}"`);
        // Don't break - collect all indicators
      }
    }
    
    // Additional pattern detection for threats
    const threatPatterns = [
      /\b(if|unless|or else|or you'll|you better|you'd better)\b.*\b(regret|happen|see|get|find|hurt|harm)\b/i,
      /\b(will|going to|gonna|'ll)\s+(share|post|expose|reveal|leak|publish|show)\s+(your|you)\b/i,
      /\b(send|give|tell)\s+me\s+(or|else|otherwise|or else)\b/i,
      /\b(look|come)\s+for\s+you\b.*\b(kill|hurt|harm)\b/i
    ];
    
    for (const pattern of threatPatterns) {
      if (pattern.test(text)) {
        if (riskLevel === RISK_LEVELS.SAFE || riskLevel === RISK_LEVELS.LOW) {
          riskLevel = RISK_LEVELS.HIGH;
          riskType = ALERT_TYPES.THREAT;
        }
        indicators.push('Threatening language pattern detected');
        suggestBlock = true;
        break;
      }
    }

    // Check for privacy risks
    if (riskLevel === RISK_LEVELS.SAFE) {
      for (const keyword of privacyKeywords) {
        if (lowerText.includes(keyword)) {
          riskLevel = RISK_LEVELS.MEDIUM;
          riskType = ALERT_TYPES.PRIVACY;
          indicators.push(`Privacy concern: "${keyword}"`);
          break;
        }
      }
    }

    // Check for medium-risk patterns
    if (riskLevel === RISK_LEVELS.SAFE) {
      for (const keyword of mediumRiskKeywords) {
        if (lowerText.includes(keyword)) {
          riskLevel = RISK_LEVELS.MEDIUM;
          riskType = ALERT_TYPES.HARASSMENT;
          indicators.push(`Concerning language: "${keyword}"`);
          break;
        }
      }
    }

    return {
      riskLevel,
      riskType,
      confidence: riskLevel !== RISK_LEVELS.SAFE ? 0.7 : 0.3,
      indicators,
      explanation: riskLevel !== RISK_LEVELS.SAFE 
        ? 'Potential safety concern detected through keyword analysis'
        : 'No obvious safety concerns detected',
      recommendation: riskLevel === RISK_LEVELS.HIGH
        ? (suggestBlock ? 'BLOCK THIS ACCOUNT IMMEDIATELY and report the content' : 'Consider blocking this account and reporting the content')
        : riskLevel === RISK_LEVELS.MEDIUM
        ? 'Be cautious and consider hiding this content'
        : null,
      isComment: false,
      suggestBlock: suggestBlock
    };
  }

  // Batch analyze multiple content items
  async analyzeBatch(contentItems) {
    const results = [];
    
    for (const item of contentItems) {
      try {
        const analysis = await this.analyzeContent(item.text, item.context);
        results.push({
          ...item,
          analysis
        });
      } catch (error) {
        console.error('[ContentAnalyzer] Error in batch analysis:', error);
        results.push({
          ...item,
          analysis: {
            riskLevel: RISK_LEVELS.SAFE,
            error: error.message
          }
        });
      }
    }
    
    return results;
  }
}

export default new ContentAnalyzer();

