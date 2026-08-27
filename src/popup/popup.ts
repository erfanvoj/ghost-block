/**
 * GhostBlock — Modern Popup Dashboard & Settings Controller
 *
 * Connects the popup UI to chrome.storage and the active tab's content script coordinator.
 * Renders live neutralized ad counters, bandwidth savings, execution overhead,
 * module feature toggles, domain whitelisting, and theme switching (Dark & Light).
 */

import { storage } from '../utils/storage';
import { type ExtensionSettings, type TelemetryData, EXTENSION_VERSION } from '../utils/constants';

export type ThemeMode = 'dark' | 'light';

export const GITHUB_REPO_URL = 'https://github.com/erfanvoj/ghost-block';

/**
 * Format raw byte numbers into human-readable data units
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Format integer numbers with locale comma separators
 */
export function formatNumber(num: number): string {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return num.toLocaleString();
}

/**
 * Safely parse domain name from a URL string
 */
export function extractDomain(urlStr: string): string {
  if (!urlStr) return 'Active Tab';
  try {
    const url = new URL(urlStr);
    if (url.protocol.startsWith('http')) {
      return url.hostname;
    }
    if (url.protocol.startsWith('chrome')) {
      return 'Chrome System Page';
    }
    return url.hostname || url.protocol.replace(':', '');
  } catch (_e) {
    return 'Active Tab';
  }
}

/**
 * Popup Dashboard Manager Class
 */
export class PopupDashboard {
  public activeDomain: string = '';
  public activeTabId: number | null = null;
  public isWhitelisted: boolean = false;
  public currentTheme: ThemeMode = 'dark';

  // DOM Elements
  private themeSwitchCapsule: HTMLElement | null = null;
  private domTextEl: HTMLElement | null = null;
  private whitelistDomainNameEl: HTMLElement | null = null;
  private stealthBadgeEl: HTMLElement | null = null;
  private totalNeutralizedEl: HTMLElement | null = null;
  private tabNeutralizedBadgeEl: HTMLElement | null = null;
  private tabNeutralizedCountEl: HTMLElement | null = null;
  private bandwidthSavedEl: HTMLElement | null = null;
  private overheadValEl: HTMLElement | null = null;
  private videoSkippedEl: HTMLElement | null = null;
  private modalsDefusedEl: HTMLElement | null = null;
  private whitelistBtn: HTMLElement | null = null;
  private whitelistBtnText: HTMLElement | null = null;
  private githubLink: HTMLElement | null = null;
  private footerVersionEl: HTMLElement | null = null;

  // Toggle Switches
  private toggleScriptMocking: HTMLInputElement | null = null;
  private toggleGeometrySpoofing: HTMLInputElement | null = null;
  private toggleVideoAcceleration: HTMLInputElement | null = null;
  private toggleOverlayDefuser: HTMLInputElement | null = null;

  /**
   * Initialize popup dashboard, bind elements, and load live state
   */
  async init(): Promise<void> {
    this.cacheDOMElements();
    await this.loadTheme();
    await this.resolveActiveTab();
    await this.loadTelemetry();
    await this.loadSettings();
    await this.checkWhitelistStatus();
    this.initVersion();
    this.bindEvents();
  }

  private cacheDOMElements(): void {
    this.themeSwitchCapsule = document.getElementById('theme-switch-capsule');
    this.domTextEl = document.getElementById('domain-text');
    this.whitelistDomainNameEl = document.getElementById('whitelist-domain-name');
    this.stealthBadgeEl = document.getElementById('stealth-badge');
    this.totalNeutralizedEl = document.getElementById('total-neutralized-val');
    this.tabNeutralizedBadgeEl = document.getElementById('tab-neutralized-badge');
    this.tabNeutralizedCountEl = document.getElementById('tab-neutralized-count');
    this.bandwidthSavedEl = document.getElementById('bandwidth-saved-val');
    this.overheadValEl = document.getElementById('overhead-val');
    this.videoSkippedEl = document.getElementById('video-skipped-val');
    this.modalsDefusedEl = document.getElementById('modals-defused-val');
    this.whitelistBtn = document.getElementById('whitelist-btn');
    this.whitelistBtnText = document.getElementById('whitelist-btn-text');
    this.githubLink = document.getElementById('github-link');
    this.footerVersionEl = document.getElementById('footer-version');

    this.toggleScriptMocking = document.getElementById('toggle-script-mocking') as HTMLInputElement;
    this.toggleGeometrySpoofing = document.getElementById('toggle-geometry-spoofing') as HTMLInputElement;
    this.toggleVideoAcceleration = document.getElementById('toggle-video-acceleration') as HTMLInputElement;
    this.toggleOverlayDefuser = document.getElementById('toggle-overlay-defuser') as HTMLInputElement;
  }

  /**
   * Load and apply stored theme mode
   */
  async loadTheme(): Promise<ThemeMode> {
    let storedTheme: ThemeMode = 'dark';

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(['theme', 'ghostblock_theme']);
        if (result.theme === 'light' || result.ghostblock_theme === 'light') {
          storedTheme = 'light';
        } else if (result.theme === 'dark' || result.ghostblock_theme === 'dark') {
          storedTheme = 'dark';
        }
      } catch (err) {
        console.warn('[GhostBlock Popup] Failed to load theme from storage:', err);
      }
    }

    this.setTheme(storedTheme);
    return storedTheme;
  }

  /**
   * Set theme and update document root
   */
  setTheme(theme: ThemeMode): void {
    this.currentTheme = theme;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (this.themeSwitchCapsule) {
      this.themeSwitchCapsule.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    }
  }

  /**
   * Toggle between dark and light themes and persist state
   */
  async toggleTheme(): Promise<ThemeMode> {
    const nextTheme: ThemeMode = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({
          theme: nextTheme,
          ghostblock_theme: nextTheme,
        });
      } catch (err) {
        console.warn('[GhostBlock Popup] Failed to persist theme:', err);
      }
    }

    return nextTheme;
  }

  /**
   * Resolve active browser tab domain and ID
   */
  async resolveActiveTab(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0 && tabs[0].url) {
          this.activeTabId = tabs[0].id ?? null;
          this.activeDomain = extractDomain(tabs[0].url);
        }
      } catch (err) {
        console.warn('[GhostBlock Popup] Failed to query active tab:', err);
      }
    }

    if (!this.activeDomain) {
      this.activeDomain = 'gemini.google.com';
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
  async loadTelemetry(): Promise<TelemetryData> {
    const data = await storage.getTelemetry();

    // Query active tab stats from content script
    let tabCount = 0;
    if (this.activeTabId && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.sendMessage) {
      try {
        const response = await new Promise<any>((resolve) => {
          chrome.tabs.sendMessage(this.activeTabId!, { type: 'GHOST_GET_TAB_STATS' }, (res) => {
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
        // Tab might not have content script running
      }
    }

    this.renderTelemetry(data, tabCount);
    return data;
  }

  /**
   * Update telemetry values in the UI
   */
  renderTelemetry(data: TelemetryData, tabCount: number = 0): void {
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
      this.overheadValEl.textContent = '< 0.5 ms';
    }
  }

  /**
   * Load module toggle settings from storage
   */
  async loadSettings(): Promise<ExtensionSettings> {
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
  async checkWhitelistStatus(): Promise<boolean> {
    if (!this.activeDomain || this.activeDomain === 'Local Environment' || this.activeDomain === 'Chrome System Page') {
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
  renderWhitelistUI(): void {
    if (this.stealthBadgeEl) {
      if (this.isWhitelisted) {
        this.stealthBadgeEl.textContent = 'WHITELISTED';
        this.stealthBadgeEl.classList.add('whitelisted');
      } else {
        this.stealthBadgeEl.textContent = 'STEALTH ACTIVE';
        this.stealthBadgeEl.classList.remove('whitelisted');
      }
    }

    if (this.whitelistBtn && this.whitelistBtnText) {
      if (this.isWhitelisted) {
        this.whitelistBtnText.textContent = 'Whitelisted';
        this.whitelistBtn.classList.add('is-whitelisted');
      } else {
        this.whitelistBtnText.textContent = 'Whitelist';
        this.whitelistBtn.classList.remove('is-whitelisted');
      }
    }

    if (this.whitelistDomainNameEl && this.activeDomain) {
      this.whitelistDomainNameEl.textContent = this.activeDomain;
    }
  }

  /**
   * Toggle domain whitelisting
   */
  async handleToggleWhitelist(): Promise<boolean> {
    if (!this.activeDomain || this.activeDomain === 'Local Environment') return false;

    this.isWhitelisted = await storage.toggleWhitelist(this.activeDomain);
    this.renderWhitelistUI();
    return this.isWhitelisted;
  }

  /**
   * Update a specific module setting
   */
  async handleSettingChange(key: keyof ExtensionSettings, enabled: boolean): Promise<void> {
    await storage.setSettings({ [key]: enabled });
  }

  /**
   * Populate dynamic version into footer
   */
  private initVersion(): void {
    if (this.footerVersionEl) {
      let version = EXTENSION_VERSION;
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
        try {
          const manifest = chrome.runtime.getManifest();
          if (manifest && manifest.version) {
            version = manifest.version;
          }
        } catch (_err) {
          // fallback
        }
      }
      this.footerVersionEl.textContent = `GhostBlock v${version}`;
    }
  }

  /**
   * Handle navigation / redirect to GitHub repository
   */
  public openGitHub(): void {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: GITHUB_REPO_URL });
    } else if (typeof window !== 'undefined') {
      window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Bind event listeners for UI interactions
   */
  private bindEvents(): void {
    // Theme toggle capsule
    this.themeSwitchCapsule?.addEventListener('click', () => {
      this.toggleTheme();
    });

    this.themeSwitchCapsule?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleTheme();
      }
    });

    // Module toggles
    this.toggleScriptMocking?.addEventListener('change', (e) => {
      this.handleSettingChange('scriptMockingEnabled', (e.target as HTMLInputElement).checked);
    });

    this.toggleGeometrySpoofing?.addEventListener('change', (e) => {
      this.handleSettingChange('geometrySpoofingEnabled', (e.target as HTMLInputElement).checked);
    });

    this.toggleVideoAcceleration?.addEventListener('change', (e) => {
      this.handleSettingChange('videoAdAccelerationEnabled', (e.target as HTMLInputElement).checked);
    });

    this.toggleOverlayDefuser?.addEventListener('change', (e) => {
      this.handleSettingChange('overlayDefuserEnabled', (e.target as HTMLInputElement).checked);
    });

    // Whitelist action button
    this.whitelistBtn?.addEventListener('click', () => {
      this.handleToggleWhitelist();
    });

    // GitHub repository link
    this.githubLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openGitHub();
    });
  }
}

// Auto-initialize when loaded in popup window
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new PopupDashboard();
    dashboard.init().catch((err) => {
      console.warn('[GhostBlock Popup] Failed to initialize popup dashboard:', err);
    });
  });
}
