// SafeSpace Translation System
// Supports English (en) and French (fr)

export const translations = {
  en: {
    // UI Labels
    dashboard: 'Dashboard',
    alerts: 'Alerts',
    websiteHealth: 'Website Health',
    settings: 'Settings',
    
    // Stats
    totalAlerts: 'Total Alerts',
    highRisk: 'High Risk',
    mediumRisk: 'Medium Risk',
    lowRisk: 'Low Risk',
    blockedAccounts: 'Blocked Accounts',
    
    // Alerts
    highRiskDetected: 'HIGH RISK DETECTED',
    warning: 'WARNING',
    autoClosingTab: 'Auto-closing tab in',
    viewDetails: 'View Details',
    closeTabNow: 'Close Tab Now',
    blockUser: 'Block User',
    hide: 'Hide',
    block: 'Block',
    report: 'Report',
    comment: 'Comment',
    post: 'Post',
    source: 'Source',
    
    // Website Health
    analyzing: 'Analyzing...',
    safetyScore: 'Safety Score',
    privacyScore: 'Privacy Score',
    overallScore: 'Overall Score',
    excellent: 'Excellent',
    good: 'Good',
    moderate: 'Moderate',
    poor: 'Poor',
    veryPoor: 'Very Poor',
    
    // Settings
    apiKey: 'OpenRouter API Key',
    saveSettings: 'Save Settings',
    clearCache: 'Clear Cache',
    clearAllAlerts: 'Clear All Alerts',
    
    // Risk Types
    riskTypes: {
      threats: {
        description: 'Direct or implied threats to harm, kill, or intimidate',
        examples: [
          'I will find you and hurt you',
          'come for you and kill you',
          'you will regret this',
          'or else you will see'
        ]
      },
      privacy: {
        description: 'Doxxing, exposure of photos, blackmail, leaking info',
        examples: [
          'I will share your photos',
          'leak your address',
          'post your pics everywhere',
          'expose you to everyone'
        ]
      },
      cyberbullying: {
        description: 'Insults, humiliation, body/appearance shaming',
        examples: [
          'ugly boy',
          'you are worthless',
          'everyone hates you',
          'disgusting face'
        ]
      },
      gbv: {
        description: 'Gender-based violence, misogyny, coercive control',
        examples: [
          'because you are a woman',
          'you belong to me',
          'obey or else',
          'women should be quiet'
        ]
      },
      stalking: {
        description: 'Following, tracking, unwanted pursuit or surveillance',
        examples: [
          'I know where you live',
          'I am outside your house',
          'I will follow you',
          'tracking your location'
        ]
      },
      manipulation: {
        description: 'Coercion, blackmail without explicit threat, emotional control',
        examples: [
          'send me pics or else',
          'do this and I won't leak it',
          'gaslighting about events'
        ]
      }
    }
  },
  
  fr: {
    // UI Labels
    dashboard: 'Tableau de bord',
    alerts: 'Alertes',
    websiteHealth: 'Santé du site',
    settings: 'Paramètres',
    
    // Stats
    totalAlerts: 'Alertes totales',
    highRisk: 'Risque élevé',
    mediumRisk: 'Risque moyen',
    lowRisk: 'Risque faible',
    blockedAccounts: 'Comptes bloqués',
    
    // Alerts
    highRiskDetected: 'RISQUE ÉLEVÉ DÉTECTÉ',
    warning: 'AVERTISSEMENT',
    autoClosingTab: 'Fermeture automatique de l\'onglet dans',
    viewDetails: 'Voir les détails',
    closeTabNow: 'Fermer l\'onglet maintenant',
    blockUser: 'Bloquer l\'utilisateur',
    hide: 'Masquer',
    block: 'Bloquer',
    report: 'Signaler',
    comment: 'Commentaire',
    post: 'Publication',
    source: 'Source',
    
    // Website Health
    analyzing: 'Analyse en cours...',
    safetyScore: 'Score de sécurité',
    privacyScore: 'Score de confidentialité',
    overallScore: 'Score global',
    excellent: 'Excellent',
    good: 'Bon',
    moderate: 'Modéré',
    poor: 'Faible',
    veryPoor: 'Très faible',
    
    // Settings
    apiKey: 'Clé API OpenRouter',
    saveSettings: 'Enregistrer les paramètres',
    clearCache: 'Vider le cache',
    clearAllAlerts: 'Effacer toutes les alertes',
    
    // Risk Types
    riskTypes: {
      threats: {
        description: 'Menaces directes ou implicites de nuire, tuer ou intimider',
        examples: [
          'Je vais te trouver et te faire du mal',
          'venir te chercher et te tuer',
          'tu vas le regretter',
          'sinon tu vas voir'
        ]
      },
      privacy: {
        description: 'Doxxing, exposition de photos, chantage, fuite d\'informations',
        examples: [
          'Je vais partager tes photos',
          'révéler ton adresse',
          'publier tes photos partout',
          't\'exposer à tout le monde'
        ]
      },
      cyberbullying: {
        description: 'Insultes, humiliation, humiliation du corps/apparence',
        examples: [
          'garçon laid',
          'tu ne vaux rien',
          'tout le monde te déteste',
          'visage dégoûtant'
        ]
      },
      gbv: {
        description: 'Violence basée sur le genre, misogynie, contrôle coercitif',
        examples: [
          'parce que tu es une femme',
          'tu m\'appartiens',
          'obéis sinon',
          'les femmes devraient se taire'
        ]
      },
      stalking: {
        description: 'Suivi, traçage, poursuite ou surveillance non désirée',
        examples: [
          'Je sais où tu habites',
          'Je suis devant ta maison',
          'Je vais te suivre',
          'suivre ta localisation'
        ]
      },
      manipulation: {
        description: 'Coercition, chantage sans menace explicite, contrôle émotionnel',
        examples: [
          'envoie-moi des photos sinon',
          'fais ça et je ne le divulguerai pas',
          'manipulation sur les événements'
        ]
      }
    }
  }
};

// Language detection utility
export function detectPageLanguage() {
  // Try to detect from HTML lang attribute
  const htmlLang = document.documentElement.lang || document.documentElement.getAttribute('lang');
  if (htmlLang) {
    if (htmlLang.startsWith('fr')) return 'fr';
    if (htmlLang.startsWith('en')) return 'en';
  }
  
  // Try to detect from meta tags
  const metaLang = document.querySelector('meta[http-equiv="content-language"]');
  if (metaLang) {
    const lang = metaLang.getAttribute('content');
    if (lang && lang.startsWith('fr')) return 'fr';
    if (lang && lang.startsWith('en')) return 'en';
  }
  
  // Try to detect from page content (sample first 1000 chars)
  const bodyText = document.body ? document.body.innerText.substring(0, 1000) : '';
  const frenchIndicators = ['le ', 'la ', 'les ', 'de ', 'et ', 'est ', 'dans ', 'pour ', 'avec ', 'sur ', 'par ', 'une ', 'des ', 'que ', 'qui ', 'être ', 'avoir ', 'faire ', 'aller ', 'venir '];
  const frenchCount = frenchIndicators.filter(word => bodyText.toLowerCase().includes(word)).length;
  
  if (frenchCount > 5) return 'fr';
  
  // Default to English
  return 'en';
}

// Get translation function
export function getTranslation(lang = 'en', key, fallback = '') {
  const keys = key.split('.');
  let value = translations[lang] || translations.en;
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      // Fallback to English
      value = translations.en;
      for (const k2 of keys) {
        value = value?.[k2];
        if (value === undefined) return fallback || key;
      }
      return value || fallback || key;
    }
  }
  
  return value || fallback || key;
}

// Get current language from storage or detect
export async function getCurrentLanguage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['language'], (result) => {
      if (result.language) {
        resolve(result.language);
      } else {
        // Detect from current page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: detectPageLanguage
            }, (results) => {
              const detectedLang = results?.[0]?.result || 'en';
              resolve(detectedLang);
            });
          } else {
            resolve('en');
          }
        });
      }
    });
  });
}

