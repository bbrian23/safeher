// Content Analyzer - Analyzes text content for GBV indicators

import apiService from './api-service.js';
import { RISK_LEVELS, ALERT_TYPES, RISK_TAXONOMY } from '../utils/constants.js';

class ContentAnalyzer {
  constructor() {
    this.systemPrompt = `You are an expert safety AI assistant specialized in detecting gender-based violence (GBV), cyberbullying, harassment, stalking, privacy/doxxing threats, and online safety threats. You must be HIGHLY SENSITIVE to any form of harmful content, obfuscations (leet, spacing, homoglyphs), and the expanded threat bank below. Use the taxonomy to broaden detection and flag severity appropriately.

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

Examples of harmful content (but detect ANY similar patterns; expand using the taxonomy and the high-risk lists: killing/harm, weapons, rape/assault, doxxing/leak, stalking/monitoring, tech-tampering, deepfakes, sextortion, NCII, LGBTQIA+ outing, elder/child threats, symbolic threats like weapon emoji):
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
    const compactText = lowerText.replace(/\s+/g, '');
    const strippedText = lowerText.replace(/[^a-z0-9]/g, '');
    const deobfuscate = (s) => s
      .replace(/@/g, 'a')
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      .replace(/\$/g, 's')
      .replace(/8/g, 'b')
      .replace(/!/g, 'i');
    const leetText = deobfuscate(strippedText);

    const immediateThreats = [
      'kill you', 'end you', 'finish you', 'ruin you', 'destroy you', 'bury you',
      'put you in the ground', 'no one will find you', "you won't survive", "you're done",
      "i'll break you", "i'm coming for you", 'final warning', 'last day', "won't wake up",
      'rape', 'assault you', 'beat you down', 'choke you', 'strangle', 'slap you', 'drag you',
      'hurt you badly', 'force myself on you', 'violate you', 'punish you physically',
      'k!ll', 'keal', 'kil u', 'u ded', 'u finna die', 'disappear you', 'disapear u', 'u dead'
    ];

    const weaponsAndViolence = [
      'gun', 'knife', 'blade', 'razor', 'acid', 'poison', 'rope', 'wire', 'belt', 'hammer',
      'bat', 'lighter', 'fire', 'burn you', 'bleach', 'injection', 'acid attack', 'shoot you',
      'stab you'
    ];

    const indirectThreats = [
      'accidents happen', "you'll see", 'you know what i can do', "you won't like what happens next",
      'mark my words', 'swear to god', 'last time', 'final warning'
    ];

    const stalkingAndMonitoring = [
      'tracking you', 'i see you', 'i watched you', 'i saw your route', 'your commute', 'your building',
      'cctv', 'hidden mic', 'secret camera', 'gps on you', 'geotag', 'live location', 'loc8tion',
      'stalk', 'stalking', 'following you', 'outside your house', 'wait outside'
    ];

    const techAbuse = [
      'remote access', 'screen mirroring', 'cloned your phone', 'cloned sim', 'spyware', 'rat tool',
      'keylogger', 'hacked your cloud', 'logged into your google id', 'apple id', 'session hijack',
      'send me your passwords', 'share your passcode', 'send your otp', 'two-factor code'
    ];

    const deepfakeAbuse = [
      'deepfake your face', 'ai porn of you', 'fake your voice', 'clone your voice', 'voiceprint',
      'morph your photos', 'fake call from your number'
    ];

    const doxxingAndLeak = [
      'dox you', 'expose you', 'leak your info', 'drop your address', 'release your number',
      'post your details', 'publicize your secrets', 'mass share your past', 'leak your location',
      'leak your chats', 'post your screenshots', 'd0x', 'le@k', 'leke'
    ];

    const sextortion = [
      'pay me or else', 'send money or i leak it', 'bitcoin or i post this', 'transfer now',
      'buy me credits', "i'll ruin your career", 'your nudes', 'your private photos',
      'intimate videos', "i'll post your clips", 'explicit images', 'sex tape', 'publish your pictures',
      'nudez', 'nudz', 'pr0n', 'p*rn', 'onlyfans will be public'
    ];

    const sexualHarassment = [
      'show me your body', 'bend over', 'sexual demands', 'talk dirty', 'send sexy pics',
      'your body is for me', 'objectify', 'explicit request'
    ];

    const misogynySlurs = [
      'whore', 'slut', 'bitch', 'cunt', 'thot', 'skank', 'tramp', 'homewrecker', 'easy', 'loose',
      'unpure', 'used goods', 'characterless', 'besharam', 'awra', 'dayouth', 'spoilt woman'
    ];

    const harassmentPower = [
      'who do you think will believe you', 'women like you deserve it', "you're asking for it"
    ];

    const controlAndIsolation = [
      "don't talk to anyone", 'block your friends', 'cut off your family', 'delete your accounts',
      "you can't go out", 'need my permission', 'you report to me', 'stay home', 'you belong to me'
    ];

    const gaslighting = [
      "you're imagining", "you're dramatic", 'you misunderstood', 'nobody else wants you',
      "you're lucky i stay with you", 'no one will believe you'
    ];

    const financialControl = [
      'give me your salary', "you can't buy anything", "i'll hold your documents",
      'your money is mine', 'hand over passport', 'give me your id'
    ];

    const abandonmentThreats = [
      "i'll leave you with nothing", "i'll take the kids", "you'll be alone forever"
    ];

    const lgbtqAbuse = [
      "i'll out you", "everyone will know you're gay", "i'll tell your family", "you're not a real man",
      "you're unnatural", 'conversion', 'destroy your hormones', 'deadname', "i'll expose your medical status",
      'hiv status', 'you will die alone diseased'
    ];

    const elderAbuse = [
      "i'll put you in a home", "i'll stop feeding you", "i'll take your medication",
      'i control your pension', 'sign this paper now', "i'll cut your allowance", 'give me your insurance card'
    ];

    const childRelatedThreats = [
      "i'll take the kids", "you'll never see your child", "i'll hurt your child",
      "i'll tell them lies about you", 'unfit parent', 'bad mother'
    ];

    const symbolThreats = ['🔪', '🪓', '🔫', '⚰️', '😈', '👁️', '🩸', 'rope', 'noose'];

    const cyberbullyingKeywords = [
      'ugly', 'fat', 'skinny', 'disgusting', 'gross', 'hideous',
      'stupid', 'idiot', 'moron', 'dumb', 'fool', 'loser',
      'pathetic', 'worthless', 'useless', 'trash', 'garbage',
      'nobody likes you', 'everyone hates you', 'no one wants you',
      'you deserve', 'should die', 'you should', 'you need to',
      'bitch', 'slut', 'whore', 'hoe', 'thot',
      'weak', 'pathetic man', 'real man', 'be a man',
      'women should', 'men should', 'because you\'re a',
      'nobody cares', 'no one cares', 'who cares', 'who asked',
      'shut up', 'go away', 'leave', 'get lost', 'fuck off'
    ];

    const mediumRiskKeywords = [
      'harass', 'abuse', 'violence', 'attack', 'expose', 'leak',
      'personal info', 'private message', 'dox', 'embarrass you',
      'make fun of', 'laugh at you', 'watch your house'
    ];

    const privacyKeywords = [
      'location', 'gps', 'tracking', 'where are you', 'your address',
      'phone number', 'email', 'real name', 'where you work', 'where you study'
    ];

    const gbvKeywords = [
      'women should', 'men should', 'because you\'re a woman', 'because you\'re a man',
      'obey', 'submit', 'control', 'belongs to', 'property', 'my woman', 'my man',
      'you belong to', 'you\'re mine', 'you\'re my', 'do as i say',
      'listen to me', 'do what i tell you', 'follow my orders',
      'act like a man', 'be a man', 'man up', 'real men',
      'women belong', 'women are meant to', 'girls should', 'boys should',
      'that\'s a woman\'s job', 'that\'s a man\'s job',
      'inferior', 'superior', 'weak', 'strong', 'emotional', 'logical'
    ];

    let riskLevel = RISK_LEVELS.SAFE;
    let riskType = null;
    const indicators = [];
    let suggestBlock = false;

    const containsAny = (phrase) => {
      const p = phrase.toLowerCase();
      const compact = p.replace(/\s+/g, '');
      return lowerText.includes(p) || compactText.includes(compact) || leetText.includes(compact);
    };

    // Threats / violence
    for (const keyword of [...immediateThreats, ...weaponsAndViolence, ...indirectThreats]) {
      if (containsAny(keyword)) {
        riskLevel = RISK_LEVELS.HIGH;
        riskType = ALERT_TYPES.THREAT;
        indicators.push(`Contains threat/violence: "${keyword}"`);
        suggestBlock = true;
      }
    }

    // Cyberbullying
    for (const keyword of cyberbullyingKeywords) {
      if (containsAny(keyword)) {
        if (riskLevel === RISK_LEVELS.SAFE) {
          riskLevel = RISK_LEVELS.HIGH;
          riskType = ALERT_TYPES.HARASSMENT;
        }
        indicators.push(`Cyberbullying detected: "${keyword}"`);
        suggestBlock = true;
      }
    }

    // GBV / misogyny
    for (const keyword of [...gbvKeywords, ...misogynySlurs, ...harassmentPower]) {
      if (containsAny(keyword)) {
        if (riskLevel === RISK_LEVELS.SAFE) {
          riskLevel = RISK_LEVELS.MEDIUM;
          riskType = ALERT_TYPES.HARASSMENT;
        } else if (riskLevel === RISK_LEVELS.MEDIUM) {
          riskLevel = RISK_LEVELS.HIGH;
        }
        indicators.push(`Gender-based or power harassment: "${keyword}"`);
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

    // Stalking/monitoring
    for (const keyword of stalkingAndMonitoring) {
      if (containsAny(keyword)) {
        riskLevel = RISK_LEVELS.HIGH;
        riskType = ALERT_TYPES.THREAT;
        indicators.push(`Stalking/monitoring: "${keyword}"`);
        suggestBlock = true;
      }
    }

    // Tech abuse & deepfake
    for (const keyword of [...techAbuse, ...deepfakeAbuse]) {
      if (containsAny(keyword)) {
        if (riskLevel === RISK_LEVELS.SAFE) {
          riskLevel = RISK_LEVELS.MEDIUM;
          riskType = ALERT_TYPES.ACCOUNT_RISK;
        }
        indicators.push(`Tech-based abuse: "${keyword}"`);
      }
    }

    // Doxxing / leak / sextortion
    for (const keyword of [...doxxingAndLeak, ...sextortion]) {
      if (containsAny(keyword)) {
        if (riskLevel === RISK_LEVELS.SAFE) {
          riskLevel = RISK_LEVELS.HIGH;
          riskType = ALERT_TYPES.PRIVACY;
        }
        indicators.push(`Dox/leak/extortion: "${keyword}"`);
        suggestBlock = true;
      }
    }

    // Sexual harassment
    for (const keyword of sexualHarassment) {
      if (containsAny(keyword)) {
        if (riskLevel === RISK_LEVELS.SAFE) {
          riskLevel = RISK_LEVELS.MEDIUM;
          riskType = ALERT_TYPES.HARASSMENT;
        }
        indicators.push(`Sexual harassment: "${keyword}"`);
      }
    }

    // Control, gaslighting, financial control, abandonment
    for (const keyword of [...controlAndIsolation, ...gaslighting, ...financialControl, ...abandonmentThreats]) {
      if (containsAny(keyword)) {
        if (riskLevel === RISK_LEVELS.SAFE) {
          riskLevel = RISK_LEVELS.MEDIUM;
          riskType = ALERT_TYPES.MANIPULATION;
        }
        indicators.push(`Control/manipulation: "${keyword}"`);
      }
    }

    // LGBTQIA+ specific abuse
    for (const keyword of lgbtqAbuse) {
      if (containsAny(keyword)) {
        riskLevel = RISK_LEVELS.HIGH;
        riskType = ALERT_TYPES.GBV;
        indicators.push(`LGBTQIA+ abuse: "${keyword}"`);
        suggestBlock = true;
      }
    }

    // Elder abuse
    for (const keyword of elderAbuse) {
      if (containsAny(keyword)) {
        riskLevel = RISK_LEVELS.MEDIUM;
        riskType = ALERT_TYPES.THREAT;
        indicators.push(`Elder abuse: "${keyword}"`);
        suggestBlock = true;
      }
    }

    // Child-related threats
    for (const keyword of childRelatedThreats) {
      if (containsAny(keyword)) {
        riskLevel = RISK_LEVELS.HIGH;
        riskType = ALERT_TYPES.THREAT;
        indicators.push(`Child-related threat: "${keyword}"`);
        suggestBlock = true;
      }
    }

    // Symbolic threats
    for (const keyword of symbolThreats) {
      if (lowerText.includes(keyword) || compactText.includes(keyword)) {
        riskLevel = RISK_LEVELS.HIGH;
        riskType = ALERT_TYPES.THREAT;
        indicators.push(`Symbolic threat: "${keyword}"`);
        suggestBlock = true;
      }
    }

    // Privacy risks
    if (riskLevel === RISK_LEVELS.SAFE) {
      for (const keyword of privacyKeywords) {
        if (containsAny(keyword)) {
          riskLevel = RISK_LEVELS.MEDIUM;
          riskType = ALERT_TYPES.PRIVACY;
          indicators.push(`Privacy concern: "${keyword}"`);
          break;
        }
      }
    }

    // Medium-risk patterns
    if (riskLevel === RISK_LEVELS.SAFE) {
      for (const keyword of mediumRiskKeywords) {
        if (containsAny(keyword)) {
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

