import { storage } from '../utils/storage';
import {
  DEFAULT_TELEMETRY,
  DEFAULT_SETTINGS,
  DNR_RULE_IDS,
  ESTIMATED_BYTES,
} from '../utils/constants';

console.log('[GhostBlock] Stealth Background Service Worker initializing...');

/**
 * Handle extension install and upgrade lifecycle
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[GhostBlock] onInstalled event: reason=${details.reason}`);

  // Initialize telemetry if not present
  const existingTelemetry = await storage.getTelemetry();
  if (!existingTelemetry || typeof existingTelemetry.adsNeutralized !== 'number') {
    await storage.setTelemetry(DEFAULT_TELEMETRY);
    console.log('[GhostBlock] Initialized default telemetry state');
  }

  // Initialize settings if not present
  const existingSettings = await storage.getSettings();
  if (!existingSettings || typeof existingSettings.scriptMockingEnabled !== 'boolean') {
    await storage.setSettings(DEFAULT_SETTINGS);
    console.log('[GhostBlock] Initialized default extension settings');
  }
});

/**
 * Handle browser startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('[GhostBlock] onStartup event triggered');
});

/**
 * Listen to Declarative Net Request debug events to track absorbed requests
 * (Active in developer/unpacked mode when declarativeNetRequestFeedback permission is granted)
 */
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const { rule, request } = info;
    console.log(`[GhostBlock DNR] Absorbed ad network request [Rule ID ${rule.ruleId}]: ${request.url}`);

    let estimatedBytes = 100 * 1024;
    if (rule.ruleId === DNR_RULE_IDS.GPT) {
      estimatedBytes = ESTIMATED_BYTES.GPT_SCRIPT;
    } else if (rule.ruleId === DNR_RULE_IDS.ADSENSE) {
      estimatedBytes = ESTIMATED_BYTES.ADSENSE_SCRIPT;
    } else if (rule.ruleId === DNR_RULE_IDS.PREBID) {
      estimatedBytes = ESTIMATED_BYTES.PREBID_SCRIPT;
    }

    storage
      .incrementTelemetry({
        adsNeutralized: 1,
        requestsAbsorbed: 1,
        bytesSaved: estimatedBytes,
      })
      .then((updated) => {
        console.log('[GhostBlock DNR] Telemetry updated:', updated);
      })
      .catch((err) => {
        console.warn('[GhostBlock DNR] Failed to update telemetry:', err);
      });
  });
}

/**
 * Runtime messaging bridge for popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false;

  switch (message.type) {
    case 'GHOST_GET_TELEMETRY':
      storage.getTelemetry().then((data) => sendResponse({ success: true, data }));
      return true;

    case 'GHOST_INCREMENT_TELEMETRY':
      storage
        .incrementTelemetry(message.payload || {})
        .then((data) => sendResponse({ success: true, data }));
      return true;

    case 'GHOST_GET_SETTINGS':
      storage.getSettings().then((data) => sendResponse({ success: true, data }));
      return true;

    case 'GHOST_SET_SETTINGS':
      storage
        .setSettings(message.payload || {})
        .then((data) => sendResponse({ success: true, data }));
      return true;

    case 'GHOST_IS_WHITELISTED':
      if (typeof message.payload?.domain === 'string') {
        storage
          .isDomainWhitelisted(message.payload.domain)
          .then((whitelisted) => sendResponse({ success: true, whitelisted }));
        return true;
      }
      sendResponse({ success: false, error: 'Domain not provided' });
      return false;

    case 'GHOST_TOGGLE_WHITELIST':
      if (typeof message.payload?.domain === 'string') {
        storage
          .toggleWhitelist(message.payload.domain)
          .then((whitelisted) => sendResponse({ success: true, whitelisted }));
        return true;
      }
      sendResponse({ success: false, error: 'Domain not provided' });
      return false;

    default:
      sendResponse({ success: false, error: `Unhandled message type: ${message.type}` });
      return false;
  }
});
