// Privacy Analyzer - Analyzes privacy policies for GBV-related risks

import apiService from './api-service.js';

class PrivacyAnalyzer {
  constructor() {
    this.systemPrompt = `You are a privacy and safety expert analyzing privacy policies for risks related to gender-based violence (GBV) and online safety. 

Analyze the privacy policy and provide a comprehensive, user-friendly summary. Identify:

1. **Data Collection & Sharing:**
   - What personal data is collected (location, contacts, messages, photos)
   - Who has access to this data (third parties, advertisers, other users)
   - Data sharing practices that could expose user information

2. **Location & Tracking:**
   - Location tracking capabilities
   - GPS and geolocation data usage
   - How location data is shared

3. **User Control & Privacy Settings:**
   - User's ability to control data visibility
   - Privacy settings available
   - Data deletion options

4. **Safety Risks:**
   - Policies that could enable stalking or harassment
   - Data retention that could be used against users
   - Sharing of personal information with other users

5. **Positive Protections:**
   - Good privacy practices
   - User-friendly controls
   - Data protection measures

**IMPORTANT:** Provide a clear, easy-to-understand summary that a non-technical user can understand. Use simple language.

Respond with a JSON object in this format:
{
  "safetyScore": 0-100,
  "riskFactors": [
    {
      "type": "location_tracking" | "data_sharing" | "third_party" | "retention" | "user_control" | "other",
      "severity": "high" | "medium" | "low",
      "description": "Simple, clear description of the risk",
      "impact": "How this could affect user safety in plain language"
    }
  ],
  "positiveFactors": [
    "List of positive privacy protections found"
  ],
  "summary": "A brief, easy-to-understand summary (2-3 sentences) of the privacy policy",
  "keyPoints": [
    "3-5 key points users should know about this website's privacy"
  ],
  "recommendations": [
    "Actionable recommendations in simple language"
  ]
}`;
  }

  async analyzePrivacyPolicy(policyText, domain) {
    if (!policyText || policyText.trim().length === 0) {
      return {
        safetyScore: 50,
        riskFactors: [{
          type: 'other',
          severity: 'medium',
          description: 'Privacy policy not found or could not be extracted',
          impact: 'Unable to assess privacy risks'
        }],
        positiveFactors: [],
        summary: 'Privacy policy analysis unavailable',
        recommendations: ['Be cautious about sharing personal information on this site']
      };
    }

    const prompt = `Analyze this privacy policy for safety risks related to gender-based violence (GBV) and online safety:

**Website Domain:** ${domain}

**Privacy Policy Text:**
${policyText.substring(0, 15000)} ${policyText.length > 15000 ? '...[truncated]' : ''}

**Focus Areas:**
1. What personal data is collected (location, photos, messages, contacts)?
2. Who can access this data (third parties, other users, advertisers)?
3. Can location be tracked or shared?
4. Are there privacy controls users can use?
5. Could this data be used for stalking or harassment?
6. What are the data retention policies?

Provide a clear, user-friendly analysis in the specified JSON format. Use simple language that non-technical users can understand.`;

    try {
      const response = await apiService.makeRequest(prompt, this.systemPrompt);
      
      // Extract JSON from response
      let analysis;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.warn('[PrivacyAnalyzer] Failed to parse JSON, using fallback');
        analysis = this.fallbackAnalysis(policyText);
      }

      // Validate and normalize
      return {
        safetyScore: Math.max(0, Math.min(100, analysis.safetyScore || 50)),
        riskFactors: analysis.riskFactors || [],
        positiveFactors: analysis.positiveFactors || [],
        summary: analysis.summary || 'Privacy policy analyzed',
        keyPoints: analysis.keyPoints || [],
        recommendations: analysis.recommendations || []
      };
    } catch (error) {
      console.error('[PrivacyAnalyzer] Error analyzing privacy policy:', error);
      return this.fallbackAnalysis(policyText);
    }
  }

  // Fallback analysis using keyword detection
  fallbackAnalysis(policyText) {
    const lowerText = policyText.toLowerCase();
    const riskFactors = [];
    const positiveFactors = [];

    // Check for location tracking
    if (lowerText.includes('location') || lowerText.includes('gps') || lowerText.includes('geolocation')) {
      riskFactors.push({
        type: 'location_tracking',
        severity: 'high',
        description: 'Policy mentions location tracking capabilities',
        impact: 'Your location could be tracked and potentially shared, increasing stalking risk'
      });
    }

    // Check for third-party sharing
    if (lowerText.includes('third party') || lowerText.includes('share with partners')) {
      riskFactors.push({
        type: 'data_sharing',
        severity: 'medium',
        description: 'Policy allows sharing data with third parties',
        impact: 'Your data may be shared with unknown entities'
      });
    }

    // Check for user control
    if (lowerText.includes('you can control') || lowerText.includes('privacy settings')) {
      positiveFactors.push('Users have control over privacy settings');
    }

    // Calculate safety score
    let safetyScore = 70; // Base score
    if (riskFactors.length > 0) {
      safetyScore -= riskFactors.length * 10;
    }
    if (positiveFactors.length > 0) {
      safetyScore += positiveFactors.length * 5;
    }
    safetyScore = Math.max(0, Math.min(100, safetyScore));

    return {
      safetyScore,
      riskFactors,
      positiveFactors,
      summary: riskFactors.length > 0 
        ? 'Some privacy concerns detected. Review the risk factors below.'
        : 'Privacy policy appears relatively safe, but review details carefully.',
      recommendations: [
        'Review your privacy settings on this platform',
        'Be cautious about sharing location or personal information',
        'Consider using a VPN or privacy tools'
      ]
    };
  }
}

export default new PrivacyAnalyzer();

