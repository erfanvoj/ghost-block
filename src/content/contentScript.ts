/**
 * GhostBlock — Content Script Coordinator & Telemetry Bridge
 *
 * Runs in the ISOLATED world content script context.
 * Serves as the high-throughput bridge connecting MAIN world injected modules
 * (geometrySpoofer, videoAdEngine, overlayDefuser) with the background service
 * worker and popup telemetry storage.
 */

import { GHOST_EVENTS, ESTIMATED_BYTES } from '../utils/constants';
import { initOverlayDefuser } from './overlayDefuser';

export interface PageTelemetry {
  url: string;
  domain: string;
  adsNeutralized: number;
  videoAdsSkipped: number;
  modalsDefused: number;
  bytesSaved: number;
  startTime: number;
}

// Current page in-memory metrics
const pageState: PageTelemetry = {
  url: typeof window !== 'undefined' ? window.location?.href || '' : '',
  domain: typeof window !== 'undefined' ? window.location?.hostname || '' : '',
  adsNeutralized: 0,
  videoAdsSkipped: 0,
  modalsDefused: 0,
  bytesSaved: 0,
  startTime: Date.now(),
};

/**
 * Get current page-level telemetry counters
 */
export function getPageTelemetry(
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): PageTelemetry {
  return {
    ...pageState,
    url: pageState.url || (targetWindow.location ? targetWindow.location.href : ''),
    domain: pageState.domain || (targetWindow.location ? targetWindow.location.hostname : ''),
  };
}

/**
 * Reset current page telemetry counters (used in testing and navigation)
 */
export function resetPageTelemetry(targetWindow?: Window): void {
  pageState.adsNeutralized = 0;
  pageState.videoAdsSkipped = 0;
  pageState.modalsDefused = 0;
  pageState.bytesSaved = 0;
  pageState.startTime = Date.now();
  const win = targetWindow || (typeof window !== 'undefined' ? window : undefined);
  if (win && win.location) {
    pageState.url = win.location.href || '';
    pageState.domain = win.location.hostname || '';
  } else {
    pageState.url = '';
    pageState.domain = '';
  }
}

/**
 * Safely transmit telemetry payload to background service worker
 */
export async function sendTelemetryToBackground(payload: {
  adsNeutralized?: number;
  videoAdsSkipped?: number;
  modalsDefused?: number;
  bytesSaved?: number;
}): Promise<boolean> {
  if (
    typeof chrome === 'undefined' ||
    !chrome.runtime ||
    !chrome.runtime.id ||
    typeof chrome.runtime.sendMessage !== 'function'
  ) {
    return false;
  }
  return new Promise<boolean>((resolve) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'GHOST_INCREMENT_TELEMETRY',
          payload,
        },
        (response) => {
          if (chrome.runtime?.lastError) {
            // Service worker might be inactive or reloading
            resolve(false);
          } else {
            resolve(response?.success ?? true);
          }
        }
      );
    } catch (_err) {
      // Context invalidated or background asleep; silently discard
      resolve(false);
    }
  });
}

/**
 * Handle custom telemetry event dispatched from MAIN world scripts
 */
export function handleWindowTelemetryEvent(event: CustomEvent): void {
  if (!event || !event.detail) return;

  const detail = event.detail;
  const incrementPayload: {
    adsNeutralized?: number;
    videoAdsSkipped?: number;
    modalsDefused?: number;
    bytesSaved?: number;
  } = {};

  if (typeof detail.adsNeutralized === 'number' && detail.adsNeutralized > 0) {
    pageState.adsNeutralized += detail.adsNeutralized;
    incrementPayload.adsNeutralized = detail.adsNeutralized;
  }

  if (typeof detail.videoAdsSkipped === 'number' && detail.videoAdsSkipped > 0) {
    pageState.videoAdsSkipped += detail.videoAdsSkipped;
    incrementPayload.videoAdsSkipped = detail.videoAdsSkipped;
    // Default video bandwidth saved if not specified
    const videoBytes = detail.bytesSaved || ESTIMATED_BYTES.AD_VIDEO_STREAM;
    pageState.bytesSaved += videoBytes;
    incrementPayload.bytesSaved = (incrementPayload.bytesSaved || 0) + videoBytes;
  }

  if (typeof detail.modalsDefused === 'number' && detail.modalsDefused > 0) {
    pageState.modalsDefused += detail.modalsDefused;
    incrementPayload.modalsDefused = detail.modalsDefused;
  }

  if (typeof detail.bytesSaved === 'number' && detail.bytesSaved > 0 && !detail.videoAdsSkipped) {
    pageState.bytesSaved += detail.bytesSaved;
    incrementPayload.bytesSaved = (incrementPayload.bytesSaved || 0) + detail.bytesSaved;
  }

  if (Object.keys(incrementPayload).length > 0) {
    sendTelemetryToBackground(incrementPayload);
  }
}

/**
 * Count how many ad elements have been isolated on the page
 */
export function countQuarantinedElements(rootDoc: Document = document): number {
  if (!rootDoc || typeof rootDoc.querySelectorAll !== 'function') return 0;

  const selectors = [
    'ins.adsbygoogle',
    'iframe[id^="google_ads_iframe"]',
    'div[id^="google_ads_"]',
    'div[id^="div-gpt-ad"]',
    'div[class*="ad-placement"]',
    'div[class*="ad-wrapper"]',
    'div[class*="ad-container"]',
    'div[class*="ad-banner"]',
    'div[class*="ad-slot"]',
    '.pub_300x250',
    '.pub_728x90',
    '.pub_300x600',
    '.pub_160x600',
    '.ad-banner',
    '.ad-slot',
  ];

  try {
    const elements = rootDoc.querySelectorAll(selectors.join(', '));
    return elements.length;
  } catch (_err) {
    return 0;
  }
}

/**
 * Initialize content script listeners and runtime message responders
 */
export function initContentCoordinator(
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any),
  targetChrome: typeof chrome = typeof chrome !== 'undefined' ? chrome : ({} as any)
): void {
  if (!targetWindow || typeof targetWindow.addEventListener !== 'function') {
    return;
  }

  if (targetWindow.location) {
    if (!pageState.url) pageState.url = targetWindow.location.href || '';
    if (!pageState.domain) pageState.domain = targetWindow.location.hostname || '';
  }

  // 1. Listen for cross-world custom events dispatched from MAIN world
  const eventNames = [
    GHOST_EVENTS.TELEMETRY_INCREMENT,
    GHOST_EVENTS.VIDEO_AD_DETECTED,
    GHOST_EVENTS.MODAL_DEFUSED,
  ];

  eventNames.forEach((eventName) => {
    targetWindow.addEventListener(eventName, ((e: CustomEvent) => {
      handleWindowTelemetryEvent(e);
    }) as EventListener);
  });

  // 2. Respond to extension internal messages (e.g. from popup dashboard)
  if (targetChrome && targetChrome.runtime && targetChrome.runtime.onMessage) {
    targetChrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message.type !== 'string') return false;

      if (message.type === 'GHOST_GET_TAB_STATS') {
        const quarantined = countQuarantinedElements(targetWindow.document);
        const currentDomain = pageState.domain || targetWindow.location?.hostname || '';
        const currentUrl = pageState.url || targetWindow.location?.href || '';
        sendResponse({
          success: true,
          data: {
            ...pageState,
            domain: currentDomain,
            url: currentUrl,
            quarantinedElementsOnDOM: quarantined,
            totalNeutralizedOnPage: pageState.adsNeutralized + quarantined + pageState.videoAdsSkipped,
          },
        });
        return true;
      }
      return false;
    });
  }
}

// Auto-initialize when running as content script
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    initContentCoordinator(window, typeof chrome !== 'undefined' ? chrome : undefined);
    initOverlayDefuser({ document, window });
    console.log('[GhostBlock] Content Script Coordinator & Overlay Defuser active in ISOLATED world');
  } catch (err) {
    console.warn('[GhostBlock] Failed to initialize content coordinator:', err);
  }
}
