(function() {
  "use strict";
  const DNR_RULE_IDS = {
    GPT: 1,
    ADSENSE: 2,
    PREBID: 3
  };
  const STORAGE_KEYS = {
    TELEMETRY: "ghostblock_telemetry",
    SETTINGS: "ghostblock_settings",
    WHITELIST: "ghostblock_whitelist"
  };
  const DEFAULT_TELEMETRY = {
    adsNeutralized: 0,
    bytesSaved: 0,
    requestsAbsorbed: 0,
    videoAdsSkipped: 0,
    modalsDefused: 0,
    lastUpdated: Date.now()
  };
  const DEFAULT_SETTINGS = {
    scriptMockingEnabled: true,
    geometrySpoofingEnabled: true,
    videoAdAccelerationEnabled: true,
    overlayDefuserEnabled: true
  };
  const ESTIMATED_BYTES = {
    GPT_SCRIPT: 150 * 1024,
    // ~150 KB
    ADSENSE_SCRIPT: 120 * 1024,
    // ~120 KB
    PREBID_SCRIPT: 200 * 1024
  };
  const storage = {
    async getTelemetry() {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          const result = await chrome.storage.local.get(STORAGE_KEYS.TELEMETRY);
          return result[STORAGE_KEYS.TELEMETRY] || { ...DEFAULT_TELEMETRY };
        } catch (err) {
          console.warn("[GhostBlock Storage] Error getting telemetry:", err);
        }
      }
      return { ...DEFAULT_TELEMETRY };
    },
    async setTelemetry(data) {
      const current = await this.getTelemetry();
      const updated = {
        ...current,
        ...data,
        lastUpdated: Date.now()
      };
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          await chrome.storage.local.set({ [STORAGE_KEYS.TELEMETRY]: updated });
        } catch (err) {
          console.warn("[GhostBlock Storage] Error setting telemetry:", err);
        }
      }
      return updated;
    },
    async incrementTelemetry(fields) {
      const current = await this.getTelemetry();
      const updated = {
        ...current,
        adsNeutralized: current.adsNeutralized + (fields.adsNeutralized || 0),
        bytesSaved: current.bytesSaved + (fields.bytesSaved || 0),
        requestsAbsorbed: current.requestsAbsorbed + (fields.requestsAbsorbed || 0),
        videoAdsSkipped: current.videoAdsSkipped + (fields.videoAdsSkipped || 0),
        modalsDefused: current.modalsDefused + (fields.modalsDefused || 0),
        lastUpdated: Date.now()
      };
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          await chrome.storage.local.set({ [STORAGE_KEYS.TELEMETRY]: updated });
        } catch (err) {
          console.warn("[GhostBlock Storage] Error incrementing telemetry:", err);
        }
      }
      return updated;
    },
    async getSettings() {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
          return result[STORAGE_KEYS.SETTINGS] || { ...DEFAULT_SETTINGS };
        } catch (err) {
          console.warn("[GhostBlock Storage] Error getting settings:", err);
        }
      }
      return { ...DEFAULT_SETTINGS };
    },
    async setSettings(settings) {
      const current = await this.getSettings();
      const updated = {
        ...current,
        ...settings
      };
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
        } catch (err) {
          console.warn("[GhostBlock Storage] Error setting settings:", err);
        }
      }
      return updated;
    },
    async getWhitelist() {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          const result = await chrome.storage.local.get(STORAGE_KEYS.WHITELIST);
          return result[STORAGE_KEYS.WHITELIST] || [];
        } catch (err) {
          console.warn("[GhostBlock Storage] Error getting whitelist:", err);
        }
      }
      return [];
    },
    async isDomainWhitelisted(domain) {
      const list = await this.getWhitelist();
      return list.includes(domain.toLowerCase());
    },
    async toggleWhitelist(domain) {
      const list = await this.getWhitelist();
      const normalized = domain.toLowerCase();
      const index = list.indexOf(normalized);
      let isWhitelisted;
      if (index >= 0) {
        list.splice(index, 1);
        isWhitelisted = false;
      } else {
        list.push(normalized);
        isWhitelisted = true;
      }
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          await chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });
        } catch (err) {
          console.warn("[GhostBlock Storage] Error updating whitelist:", err);
        }
      }
      return isWhitelisted;
    }
  };
  console.log("[GhostBlock] Stealth Background Service Worker initializing...");
  chrome.runtime.onInstalled.addListener(async (details) => {
    console.log(`[GhostBlock] onInstalled event: reason=${details.reason}`);
    const existingTelemetry = await storage.getTelemetry();
    if (!existingTelemetry || typeof existingTelemetry.adsNeutralized !== "number") {
      await storage.setTelemetry(DEFAULT_TELEMETRY);
      console.log("[GhostBlock] Initialized default telemetry state");
    }
    const existingSettings = await storage.getSettings();
    if (!existingSettings || typeof existingSettings.scriptMockingEnabled !== "boolean") {
      await storage.setSettings(DEFAULT_SETTINGS);
      console.log("[GhostBlock] Initialized default extension settings");
    }
  });
  chrome.runtime.onStartup.addListener(() => {
    console.log("[GhostBlock] onStartup event triggered");
  });
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
      storage.incrementTelemetry({
        adsNeutralized: 1,
        requestsAbsorbed: 1,
        bytesSaved: estimatedBytes
      }).then((updated) => {
        console.log("[GhostBlock DNR] Telemetry updated:", updated);
      }).catch((err) => {
        console.warn("[GhostBlock DNR] Failed to update telemetry:", err);
      });
    });
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;
    switch (message.type) {
      case "GHOST_GET_TELEMETRY":
        storage.getTelemetry().then((data) => sendResponse({ success: true, data }));
        return true;
      case "GHOST_INCREMENT_TELEMETRY":
        storage.incrementTelemetry(message.payload || {}).then((data) => sendResponse({ success: true, data }));
        return true;
      case "GHOST_GET_SETTINGS":
        storage.getSettings().then((data) => sendResponse({ success: true, data }));
        return true;
      case "GHOST_SET_SETTINGS":
        storage.setSettings(message.payload || {}).then((data) => sendResponse({ success: true, data }));
        return true;
      case "GHOST_IS_WHITELISTED":
        if (typeof message.payload?.domain === "string") {
          storage.isDomainWhitelisted(message.payload.domain).then((whitelisted) => sendResponse({ success: true, whitelisted }));
          return true;
        }
        sendResponse({ success: false, error: "Domain not provided" });
        return false;
      case "GHOST_TOGGLE_WHITELIST":
        if (typeof message.payload?.domain === "string") {
          storage.toggleWhitelist(message.payload.domain).then((whitelisted) => sendResponse({ success: true, whitelisted }));
          return true;
        }
        sendResponse({ success: false, error: "Domain not provided" });
        return false;
      default:
        sendResponse({ success: false, error: `Unhandled message type: ${message.type}` });
        return false;
    }
  });
})();
