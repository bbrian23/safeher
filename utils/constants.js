// SafeSpace Extension Constants

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// AI Models (ordered by preference, with fallback)
export const AI_MODELS = [
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4-turbo',
  'google/gemini-pro',
  'anthropic/claude-3-opus',
  'openai/gpt-4'
];

// Social Media Platform Patterns
export const PLATFORMS = {
  FACEBOOK: {
    domains: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
    postSelectors: [
      '[role="article"]',
      '[data-pagelet*="FeedUnit"]',
      'div[data-ad-preview="message"]',
      'div[data-pagelet*="FeedStory"]',
      'div[data-pagelet*="Timeline"]',
      'div[role="feed"] > div > div'
    ],
    commentSelectors: [
      '[data-testid="comment"]',
      'div[aria-label*="comment"]',
      'ul[role="list"] > li[role="article"]',
      'div[data-testid="UFI2Comment/root"]',
      'div[data-testid="UFI2Comment/root"] > div',
      'div[role="article"] > div[role="article"]', // Nested comments
      'div[data-ad-comet-preview="message"]',
      'div[data-testid="comment"] span[dir="auto"]',
      'div[data-testid="UFI2Comment/root"] span[dir="auto"]'
    ],
    usernameSelectors: [
      'strong[dir="auto"] a',
      'a[role="link"][href*="/user/"]',
      'a[href*="/profile.php"]',
      'h3 a[role="link"]',
      'div[data-testid="comment"] strong a',
      'div[data-testid="UFI2Comment/root"] strong a'
    ]
  },
  TWITTER: {
    domains: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
    postSelectors: [
      'article[data-testid="tweet"]',
      'div[data-testid="tweet"]',
      'div[role="article"]'
    ],
    commentSelectors: [
      'article[data-testid="tweet"] div[data-testid="tweetText"]',
      'div[data-testid="reply"]',
      'div[role="article"] div[lang]'
    ],
    usernameSelectors: [
      'div[data-testid="User-Name"] a',
      'a[href*="/status/"] span',
      'div[data-testid="User-Names"] a'
    ]
  },
  INSTAGRAM: {
    domains: ['instagram.com', 'www.instagram.com'],
    postSelectors: [
      'article',
      'div[role="dialog"]',
      'div[data-testid="post"]'
    ],
    commentSelectors: [
      'ul[role="list"] li',
      'div[data-testid="comment"]',
      'span[dir="auto"]'
    ],
    usernameSelectors: [
      'a[href*="/"]',
      'h2 a',
      'span[dir="auto"] a'
    ]
  },
  LINKEDIN: {
    domains: ['linkedin.com', 'www.linkedin.com'],
    postSelectors: [
      'div[data-urn]',
      'article',
      'div.feed-shared-update-v2'
    ],
    commentSelectors: [
      'div.comments-comment-item',
      'div.comments-comment-text',
      'div[data-testid="comment"]'
    ],
    usernameSelectors: [
      'a[data-control-name]',
      'span.visually-hidden + a'
    ]
  },
  TIKTOK: {
    domains: ['tiktok.com', 'www.tiktok.com'],
    postSelectors: [
      'div[data-e2e="recommend-list-item"]',
      'div[data-e2e="user-post-item"]'
    ],
    commentSelectors: [
      'div[data-e2e="comment-item"]',
      'div[data-e2e="comment-level-1"]'
    ],
    usernameSelectors: [
      'a[data-e2e="comment-username"]',
      'span[data-e2e="comment-username"]'
    ]
  },
  YOUTUBE: {
    domains: ['youtube.com', 'www.youtube.com'],
    postSelectors: [
      'ytd-watch-flexy',
      'div#primary'
    ],
    commentSelectors: [
      'ytd-comment-thread-renderer',
      'ytd-comment-renderer',
      'div#content-text'
    ],
    usernameSelectors: [
      'a#author-text',
      'ytd-channel-name a'
    ]
  }
};

// Privacy Policy Detection Patterns
export const PRIVACY_POLICY_PATTERNS = [
  /privacy[\s-]?policy/i,
  /privacy[\s-]?notice/i,
  /data[\s-]?protection/i,
  /terms[\s-]?of[\s-]?service/i,
  /terms[\s-]?and[\s-]?conditions/i,
  /user[\s-]?agreement/i
];

// Storage Keys
export const STORAGE_KEYS = {
  API_KEY: 'openrouter_api_key',
  PRIVACY_POLICIES: 'privacy_policies',
  ALERTS: 'alerts',
  BLOCKED_ACCOUNTS: 'blocked_accounts',
  SETTINGS: 'settings',
  FLAGGED_ACCOUNTS: 'flagged_accounts'
};

// Cache Duration (7 days in milliseconds)
export const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

// Batch Processing
export const BATCH_SIZE = 10;
export const ANALYSIS_DELAY = 1000; // 1 second between batches

// Risk Levels
export const RISK_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  SAFE: 'safe'
};

// Alert Types
export const ALERT_TYPES = {
  HARASSMENT: 'harassment',
  CYBERBULLYING: 'cyberbullying',
  PRIVACY: 'privacy',
  ACCOUNT_RISK: 'account_risk',
  THREAT: 'threat',
  DOXXING: 'doxxing',
  MANIPULATION: 'manipulation',
  GBV: 'gbv'
};

// Structured taxonomy to give the analyzer richer context (referenced in prompts)
export const RISK_TAXONOMY = {
  threats: {
    description: 'Direct or implied threats to harm, kill, or intimidate',
    examples: [
      'I will find you and hurt you',
      'come for you and kill you',
      'you will regret this',
      'or else you will see'
    ],
    indicators: ['violence verbs', 'conditional threats', 'future intent', 'fear language'],
    severity: 'high'
  },
  privacy: {
    description: 'Doxxing, exposure of photos, blackmail, leaking info',
    examples: [
      'I will share your photos',
      'leak your address',
      'post your pics everywhere',
      'expose you to everyone'
    ],
    indicators: ['leak/share/post your', 'address/phone/location', 'blackmail intent'],
    severity: 'high'
  },
  cyberbullying: {
    description: 'Insults, humiliation, body/appearance shaming',
    examples: [
      'ugly boy',
      'you are worthless',
      'everyone hates you',
      'disgusting face'
    ],
    indicators: ['appearance insults', 'worthlessness statements', 'pile-on language'],
    severity: 'high'
  },
  gbv: {
    description: 'Gender-based violence, misogyny, coercive control',
    examples: [
      'because you are a woman',
      'you belong to me',
      'obey or else',
      'women should be quiet'
    ],
    indicators: ['gendered slurs', 'control/ownership', 'submission demands'],
    severity: 'high'
  },
  stalking: {
    description: 'Following, tracking, unwanted pursuit or surveillance',
    examples: [
      'I know where you live',
      'I am outside your house',
      'I will follow you',
      'tracking your location'
    ],
    indicators: ['location tracking', 'following behavior', 'persistent pursuit'],
    severity: 'high'
  },
  manipulation: {
    description: 'Coercion, blackmail without explicit threat, emotional control',
    examples: [
      'send me pics or else',
      'do this and I won’t leak it',
      'gaslighting about events'
    ],
    indicators: ['conditional demands', 'emotional coercion', 'distortion of reality'],
    severity: 'medium-high'
  }
};

