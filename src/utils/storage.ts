import {
  STORAGE_KEYS,
  DEFAULT_TELEMETRY,
  DEFAULT_SETTINGS,
  type TelemetryData,
  type ExtensionSettings,
} from './constants';

/**
 * Type-safe storage wrapper around chrome.storage.local with fallback support
 * for tests and non-extension environments.
 */
export const storage = {
  async getTelemetry(): Promise<TelemetryData> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.TELEMETRY);
        return (result[STORAGE_KEYS.TELEMETRY] as TelemetryData) || { ...DEFAULT_TELEMETRY };
      } catch (err) {
        console.warn('[GhostBlock Storage] Error getting telemetry:', err);
      }
    }
    return { ...DEFAULT_TELEMETRY };
  },

  async setTelemetry(data: Partial<TelemetryData>): Promise<TelemetryData> {
    const current = await this.getTelemetry();
    const updated: TelemetryData = {
      ...current,
      ...data,
      lastUpdated: Date.now(),
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.TELEMETRY]: updated });
      } catch (err) {
        console.warn('[GhostBlock Storage] Error setting telemetry:', err);
      }
    }
    return updated;
  },

  async incrementTelemetry(fields: {
    adsNeutralized?: number;
    bytesSaved?: number;
    requestsAbsorbed?: number;
    videoAdsSkipped?: number;
    modalsDefused?: number;
  }): Promise<TelemetryData> {
    const current = await this.getTelemetry();
    const updated: TelemetryData = {
      ...current,
      adsNeutralized: current.adsNeutralized + (fields.adsNeutralized || 0),
      bytesSaved: current.bytesSaved + (fields.bytesSaved || 0),
      requestsAbsorbed: current.requestsAbsorbed + (fields.requestsAbsorbed || 0),
      videoAdsSkipped: current.videoAdsSkipped + (fields.videoAdsSkipped || 0),
      modalsDefused: current.modalsDefused + (fields.modalsDefused || 0),
      lastUpdated: Date.now(),
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.TELEMETRY]: updated });
      } catch (err) {
        console.warn('[GhostBlock Storage] Error incrementing telemetry:', err);
      }
    }
    return updated;
  },

  async getSettings(): Promise<ExtensionSettings> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        return (result[STORAGE_KEYS.SETTINGS] as ExtensionSettings) || { ...DEFAULT_SETTINGS };
      } catch (err) {
        console.warn('[GhostBlock Storage] Error getting settings:', err);
      }
    }
    return { ...DEFAULT_SETTINGS };
  },

  async setSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    const current = await this.getSettings();
    const updated: ExtensionSettings = {
      ...current,
      ...settings,
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
      } catch (err) {
        console.warn('[GhostBlock Storage] Error setting settings:', err);
      }
    }
    return updated;
  },

  async getWhitelist(): Promise<string[]> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.WHITELIST);
        return (result[STORAGE_KEYS.WHITELIST] as string[]) || [];
      } catch (err) {
        console.warn('[GhostBlock Storage] Error getting whitelist:', err);
      }
    }
    return [];
  },

  async isDomainWhitelisted(domain: string): Promise<boolean> {
    const list = await this.getWhitelist();
    return list.includes(domain.toLowerCase());
  },

  async toggleWhitelist(domain: string): Promise<boolean> {
    const list = await this.getWhitelist();
    const normalized = domain.toLowerCase();
    const index = list.indexOf(normalized);
    let isWhitelisted: boolean;
    if (index >= 0) {
      list.splice(index, 1);
      isWhitelisted = false;
    } else {
      list.push(normalized);
      isWhitelisted = true;
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });
      } catch (err) {
        console.warn('[GhostBlock Storage] Error updating whitelist:', err);
      }
    }
    return isWhitelisted;
  },
};
