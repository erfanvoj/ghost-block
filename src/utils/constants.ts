/**
 * GhostBlock — Constants, Type Definitions & Honeypot Signatures
 */

export const EXTENSION_NAME = 'GhostBlock';
export const EXTENSION_VERSION = '1.0.0';

// DNR Rules Identifiers
export const DNR_RULE_IDS = {
  GPT: 1,
  ADSENSE: 2,
  PREBID: 3,
  GOOGLE_ANALYTICS: 4,
  GTAG: 5,
  HOTJAR: 6,
  YANDEX_METRIKA: 7,
  SENTRY_BROWSER_CDN: 8,
  BUGSNAG: 9,
  IMAGE_BANNER_468X60: 10,
  AD_PROVIDER: 11,
  SENTRY_IO: 12,
  SENTRY_JS_CDN: 13,
  SENTRY_BROWSER: 14,
  BANNERS_WILDCARD: 15,
  BANNER_WILDCARD: 16,
  BANNER_468X60: 17,
  BANNER_300X250: 18,
  ADBLOCK_TESTER_BANNERS: 19,
  POPCASH: 20,
  POPADS: 21,
  TRAFFICJUNKY: 22,
  ADXPANSION: 23,
  TRAFFICJUNKY_COM: 24,
  TRAFFICJUNKY_NET: 25,
  EXOCLICK: 26,
  JUICYADS: 27,
  TSYNDICATE: 28,
  POPCASH_NET: 29,
  POPADS_NET: 30,
  ADX1: 31,
  ET_CODE: 32,
  TWINRED: 33,
  AD_BANNER_PATH: 34,
  BANNERS_PATH: 35,
  BANNER_GIF: 36,
  ADS_PATH: 37,
  BANNER_728X90: 38,
  BANNER_160X600: 39,
  BANNER_120X600: 40,
  BANNER_300X600: 41,
  BANNER_970X250: 42,
  BANNER_320X50: 43,
  MOCK_ADS_JS: 44,
  MOCK_ADVERTISEMENT_JS: 45,
  MOCK_SHOW_ADS_JS: 46,
  MOCK_ADFRAME_JS: 47,
} as const;

export const DNR_RULE_RESOURCE_ID = 'redirect_rules';

// Storage Keys
export const STORAGE_KEYS = {
  TELEMETRY: 'ghostblock_telemetry',
  SETTINGS: 'ghostblock_settings',
  WHITELIST: 'ghostblock_whitelist',
} as const;

// Telemetry Data Schema
export interface TelemetryData {
  adsNeutralized: number;
  bytesSaved: number;
  requestsAbsorbed: number;
  videoAdsSkipped: number;
  modalsDefused: number;
  lastUpdated: number;
}

export const DEFAULT_TELEMETRY: TelemetryData = {
  adsNeutralized: 0,
  bytesSaved: 0,
  requestsAbsorbed: 0,
  videoAdsSkipped: 0,
  modalsDefused: 0,
  lastUpdated: Date.now(),
};

// Extension Feature Settings
export interface ExtensionSettings {
  scriptMockingEnabled: boolean;
  geometrySpoofingEnabled: boolean;
  videoAdAccelerationEnabled: boolean;
  overlayDefuserEnabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  scriptMockingEnabled: true,
  geometrySpoofingEnabled: true,
  videoAdAccelerationEnabled: true,
  overlayDefuserEnabled: true,
};

// Estimated byte weights for bandwidth savings calculations
export const ESTIMATED_BYTES = {
  GPT_SCRIPT: 150 * 1024,        // ~150 KB
  ADSENSE_SCRIPT: 120 * 1024,    // ~120 KB
  PREBID_SCRIPT: 200 * 1024,     // ~200 KB
  AD_CREATIVE_IMAGE: 80 * 1024,  // ~80 KB
  AD_VIDEO_STREAM: 2 * 1024 * 1024, // ~2 MB
} as const;

// Known Honeypot Selectors & Bait Classes (used across Phase 1-4)
export const HONEYPOT_CLASSES = new Set([
  'pub_300x250',
  'pub_300x250m',
  'pub_728x90',
  'pub_300x600',
  'pub_160x600',
  'pub_970x250',
  'pub_320x50',
  'text-ad',
  'textAd',
  'text_ad',
  'ad-banner',
  'ad_banner',
  'ad-slot',
  'ad_slot',
  'ad-header',
  'google_ads_iframe',
  'adsbox',
  'ad-placement',
  'ad-wrapper',
  'ad-zone',
]);

export const HONEYPOT_IDS = new Set([
  'ad-unit',
  'ad-container',
  'ad-leaderboard',
  'ad_top',
  'ad_bottom',
  'google_ads_div',
  'div-gpt-ad',
]);

// Known Bait Dimension Mappings
export const DEFAULT_BAIT_DIMENSIONS = {
  width: 300,
  height: 250,
} as const;

export const KNOWN_BAIT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'pub_300x250': { width: 300, height: 250 },
  'pub_300x250m': { width: 300, height: 250 },
  'pub_728x90': { width: 728, height: 90 },
  'pub_300x600': { width: 300, height: 600 },
  'pub_160x600': { width: 160, height: 600 },
  'pub_970x250': { width: 970, height: 250 },
  'pub_320x50': { width: 320, height: 50 },
  'ad-leaderboard': { width: 728, height: 90 },
  'ad_leaderboard': { width: 728, height: 90 },
  'ad-header': { width: 728, height: 90 },
  'ad_top': { width: 728, height: 90 },
};

// Regex to extract dimension patterns like 300x250, 728x90, 300_250 from bait classnames / IDs
export const BAIT_DIMENSION_REGEX = /(?:pub_|^|[\s_-])(\d{2,4})[xX_×](\d{2,4})(?:m|$|[\s_-])/;

// Honeypot DOM attributes
export const HONEYPOT_ATTRIBUTES = [
  'data-ad',
  'data-ad-slot',
  'data-ad-client',
  'data-ad-format',
  'data-ad-unit',
  'data-ad-layout',
] as const;

// Custom Window Events for cross-world and content-bridge messaging
export const GHOST_EVENTS = {
  TELEMETRY_INCREMENT: 'ghostblock:telemetry_increment',
  VIDEO_AD_DETECTED: 'ghostblock:video_ad_detected',
  MODAL_DEFUSED: 'ghostblock:modal_defused',
} as const;

