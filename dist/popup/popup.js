(function() {
  "use strict";
  const EXTENSION_VERSION = "1.0.0";
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
  const GITHUB_REPO_URL = "https://github.com/erfanvoj/ghost-block";
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }
  function formatNumber(num) {
    if (typeof num !== "number" || isNaN(num)) return "0";
    return num.toLocaleString();
  }
  function extractDomain(urlStr) {
    if (!urlStr) return "Active Tab";
    try {
      const url = new URL(urlStr);
      if (url.protocol.startsWith("http")) {
        return url.hostname;
      }
      if (url.protocol.startsWith("chrome")) {
        return "Chrome System Page";
      }
      return url.hostname || url.protocol.replace(":", "");
    } catch (_e) {
      return "Active Tab";
    }
  }
  class PopupDashboard {
    activeDomain = "";
    activeTabId = null;
    isWhitelisted = false;
    currentTheme = "dark";
    // DOM Elements
    themeSwitchCapsule = null;
    domTextEl = null;
    whitelistDomainNameEl = null;
    stealthBadgeEl = null;
    totalNeutralizedEl = null;
    tabNeutralizedBadgeEl = null;
    tabNeutralizedCountEl = null;
    bandwidthSavedEl = null;
    overheadValEl = null;
    videoSkippedEl = null;
    modalsDefusedEl = null;
    whitelistBtn = null;
    whitelistBtnText = null;
    githubLink = null;
    footerVersionEl = null;
    // Toggle Switches
    toggleScriptMocking = null;
    toggleGeometrySpoofing = null;
    toggleVideoAcceleration = null;
    toggleOverlayDefuser = null;
    /**
     * Initialize popup dashboard, bind elements, and load live state
     */
    async init() {
      this.cacheDOMElements();
      await this.loadTheme();
      await this.resolveActiveTab();
      await this.loadTelemetry();
      await this.loadSettings();
      await this.checkWhitelistStatus();
      this.initVersion();
      this.bindEvents();
    }
    cacheDOMElements() {
      this.themeSwitchCapsule = document.getElementById("theme-switch-capsule");
      this.domTextEl = document.getElementById("domain-text");
      this.whitelistDomainNameEl = document.getElementById("whitelist-domain-name");
      this.stealthBadgeEl = document.getElementById("stealth-badge");
      this.totalNeutralizedEl = document.getElementById("total-neutralized-val");
      this.tabNeutralizedBadgeEl = document.getElementById("tab-neutralized-badge");
      this.tabNeutralizedCountEl = document.getElementById("tab-neutralized-count");
      this.bandwidthSavedEl = document.getElementById("bandwidth-saved-val");
      this.overheadValEl = document.getElementById("overhead-val");
      this.videoSkippedEl = document.getElementById("video-skipped-val");
      this.modalsDefusedEl = document.getElementById("modals-defused-val");
      this.whitelistBtn = document.getElementById("whitelist-btn");
      this.whitelistBtnText = document.getElementById("whitelist-btn-text");
      this.githubLink = document.getElementById("github-link");
      this.footerVersionEl = document.getElementById("footer-version");
      this.toggleScriptMocking = document.getElementById("toggle-script-mocking");
      this.toggleGeometrySpoofing = document.getElementById("toggle-geometry-spoofing");
      this.toggleVideoAcceleration = document.getElementById("toggle-video-acceleration");
      this.toggleOverlayDefuser = document.getElementById("toggle-overlay-defuser");
    }
    /**
     * Load and apply stored theme mode
     */
    async loadTheme() {
      let storedTheme = "dark";
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          const result = await chrome.storage.local.get(["theme", "ghostblock_theme"]);
          if (result.theme === "light" || result.ghostblock_theme === "light") {
            storedTheme = "light";
          } else if (result.theme === "dark" || result.ghostblock_theme === "dark") {
            storedTheme = "dark";
          }
        } catch (err) {
          console.warn("[GhostBlock Popup] Failed to load theme from storage:", err);
        }
      }
      this.setTheme(storedTheme);
      return storedTheme;
    }
    /**
     * Set theme and update document root
     */
    setTheme(theme) {
      this.currentTheme = theme;
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.setAttribute("data-theme", theme);
      }
      if (this.themeSwitchCapsule) {
        this.themeSwitchCapsule.setAttribute("aria-checked", theme === "dark" ? "true" : "false");
      }
    }
    /**
     * Toggle between dark and light themes and persist state
     */
    async toggleTheme() {
      const nextTheme = this.currentTheme === "dark" ? "light" : "dark";
      this.setTheme(nextTheme);
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          await chrome.storage.local.set({
            theme: nextTheme,
            ghostblock_theme: nextTheme
          });
        } catch (err) {
          console.warn("[GhostBlock Popup] Failed to persist theme:", err);
        }
      }
      return nextTheme;
    }
    /**
     * Resolve active browser tab domain and ID
     */
    async resolveActiveTab() {
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs.length > 0 && tabs[0].url) {
            this.activeTabId = tabs[0].id ?? null;
            this.activeDomain = extractDomain(tabs[0].url);
          }
        } catch (err) {
          console.warn("[GhostBlock Popup] Failed to query active tab:", err);
        }
      }
      if (!this.activeDomain) {
        this.activeDomain = "gemini.google.com";
      }
      if (this.domTextEl) {
        this.domTextEl.textContent = this.activeDomain;
      }
      if (this.whitelistDomainNameEl) {
        this.whitelistDomainNameEl.textContent = this.activeDomain;
      }
    }
    /**
     * Load telemetry data from local storage and query active tab stats
     */
    async loadTelemetry() {
      const data = await storage.getTelemetry();
      let tabCount = 0;
      if (this.activeTabId && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.sendMessage) {
        try {
          const response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(this.activeTabId, { type: "GHOST_GET_TAB_STATS" }, (res) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(res);
              }
            });
          });
          if (response && response.success && response.data) {
            tabCount = response.data.totalNeutralizedOnPage || response.data.adsNeutralized || 0;
          }
        } catch (_err) {
        }
      }
      this.renderTelemetry(data, tabCount);
      return data;
    }
    /**
     * Update telemetry values in the UI
     */
    renderTelemetry(data, tabCount = 0) {
      if (this.totalNeutralizedEl) {
        this.totalNeutralizedEl.textContent = formatNumber(data.adsNeutralized);
      }
      if (this.tabNeutralizedCountEl) {
        this.tabNeutralizedCountEl.textContent = formatNumber(tabCount);
      }
      if (this.tabNeutralizedBadgeEl && !this.tabNeutralizedCountEl) {
        this.tabNeutralizedBadgeEl.textContent = `${tabCount} this tab`;
      }
      if (this.bandwidthSavedEl) {
        this.bandwidthSavedEl.textContent = formatBytes(data.bytesSaved);
      }
      if (this.videoSkippedEl) {
        this.videoSkippedEl.textContent = formatNumber(data.videoAdsSkipped);
      }
      if (this.modalsDefusedEl) {
        this.modalsDefusedEl.textContent = formatNumber(data.modalsDefused);
      }
      if (this.overheadValEl) {
        this.overheadValEl.textContent = "< 0.5 ms";
      }
    }
    /**
     * Load module toggle settings from storage
     */
    async loadSettings() {
      const settings = await storage.getSettings();
      if (this.toggleScriptMocking) {
        this.toggleScriptMocking.checked = settings.scriptMockingEnabled;
      }
      if (this.toggleGeometrySpoofing) {
        this.toggleGeometrySpoofing.checked = settings.geometrySpoofingEnabled;
      }
      if (this.toggleVideoAcceleration) {
        this.toggleVideoAcceleration.checked = settings.videoAdAccelerationEnabled;
      }
      if (this.toggleOverlayDefuser) {
        this.toggleOverlayDefuser.checked = settings.overlayDefuserEnabled;
      }
      return settings;
    }
    /**
     * Check if the active domain is in the user whitelist
     */
    async checkWhitelistStatus() {
      if (!this.activeDomain || this.activeDomain === "Local Environment" || this.activeDomain === "Chrome System Page") {
        this.isWhitelisted = false;
        this.renderWhitelistUI();
        return false;
      }
      this.isWhitelisted = await storage.isDomainWhitelisted(this.activeDomain);
      this.renderWhitelistUI();
      return this.isWhitelisted;
    }
    /**
     * Update Whitelist UI badge and button appearance
     */
    renderWhitelistUI() {
      if (this.stealthBadgeEl) {
        if (this.isWhitelisted) {
          this.stealthBadgeEl.textContent = "WHITELISTED";
          this.stealthBadgeEl.classList.add("whitelisted");
        } else {
          this.stealthBadgeEl.textContent = "STEALTH ACTIVE";
          this.stealthBadgeEl.classList.remove("whitelisted");
        }
      }
      if (this.whitelistBtn && this.whitelistBtnText) {
        if (this.isWhitelisted) {
          this.whitelistBtnText.textContent = "Whitelisted";
          this.whitelistBtn.classList.add("is-whitelisted");
        } else {
          this.whitelistBtnText.textContent = "Whitelist";
          this.whitelistBtn.classList.remove("is-whitelisted");
        }
      }
      if (this.whitelistDomainNameEl && this.activeDomain) {
        this.whitelistDomainNameEl.textContent = this.activeDomain;
      }
    }
    /**
     * Toggle domain whitelisting
     */
    async handleToggleWhitelist() {
      if (!this.activeDomain || this.activeDomain === "Local Environment") return false;
      this.isWhitelisted = await storage.toggleWhitelist(this.activeDomain);
      this.renderWhitelistUI();
      return this.isWhitelisted;
    }
    /**
     * Update a specific module setting
     */
    async handleSettingChange(key, enabled) {
      await storage.setSettings({ [key]: enabled });
    }
    /**
     * Populate dynamic version into footer
     */
    initVersion() {
      if (this.footerVersionEl) {
        let version = EXTENSION_VERSION;
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest) {
          try {
            const manifest = chrome.runtime.getManifest();
            if (manifest && manifest.version) {
              version = manifest.version;
            }
          } catch (_err) {
          }
        }
        this.footerVersionEl.textContent = `GhostBlock v${version}`;
      }
    }
    /**
     * Handle navigation / redirect to GitHub repository
     */
    openGitHub() {
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: GITHUB_REPO_URL });
      } else if (typeof window !== "undefined") {
        window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer");
      }
    }
    /**
     * Bind event listeners for UI interactions
     */
    bindEvents() {
      this.themeSwitchCapsule?.addEventListener("click", () => {
        this.toggleTheme();
      });
      this.themeSwitchCapsule?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.toggleTheme();
        }
      });
      this.toggleScriptMocking?.addEventListener("change", (e) => {
        this.handleSettingChange("scriptMockingEnabled", e.target.checked);
      });
      this.toggleGeometrySpoofing?.addEventListener("change", (e) => {
        this.handleSettingChange("geometrySpoofingEnabled", e.target.checked);
      });
      this.toggleVideoAcceleration?.addEventListener("change", (e) => {
        this.handleSettingChange("videoAdAccelerationEnabled", e.target.checked);
      });
      this.toggleOverlayDefuser?.addEventListener("change", (e) => {
        this.handleSettingChange("overlayDefuserEnabled", e.target.checked);
      });
      this.whitelistBtn?.addEventListener("click", () => {
        this.handleToggleWhitelist();
      });
      this.githubLink?.addEventListener("click", (e) => {
        e.preventDefault();
        this.openGitHub();
      });
    }
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      const dashboard = new PopupDashboard();
      dashboard.init().catch((err) => {
        console.warn("[GhostBlock Popup] Failed to initialize popup dashboard:", err);
      });
    });
  }
})();
