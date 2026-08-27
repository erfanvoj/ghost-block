/**
 * GhostBlock — Heuristic Anti-Adblock Modal Defuser, Clickjacker Stripper & Popunder Neutralizer
 *
 * Runs in the content script environment.
 * - Detects and neutralizes anti-adblock overlay modals and backdrops.
 * - Unfreezes page scrollbars without layout disruption.
 * - Intercepts window.open abuse to block unauthorized adult popunders and hidden new tabs.
 * - Removes full-screen clickjackers and transparent overlays over video players.
 */

import { GHOST_EVENTS, ESTIMATED_BYTES } from '../utils/constants';

// Anti-adblock copy detection patterns (multilingual, English & Persian)
export const ANTI_ADBLOCK_REGEX =
  /(?:adblock|ad-block|disable\s+(?:your\s+)?ad\s*blocker|whitelist\s+us|turn\s+off\s+(?:your\s+)?ad\s*blocker|ad\s*blocker\s+detected|please\s+(?:disable|allow|turn\s+off)\s+ads|ad-blocking|disable\s+adblocking|غیرفعال\s*(?:کنید|نمایید|کردن)|مسدود\s*کننده(?:\s*تبلیغات)?|مسدودکننده(?:\s*تبلیغات)?|تبلیغات\s*را\s*(?:غیرفعال|فعال)|ادبلاک|اد\s*بلاک|آنتی\s*ادبلاک)/i;

// Known popunder & adult ad network domain keywords
export const POPUNDER_PATTERNS = [
  /trafficjunky/i,
  /exoclick/i,
  /juicyads/i,
  /tsyndicate/i,
  /popads/i,
  /popcash/i,
  /twinred/i,
  /adx1/i,
  /et-code/i,
  /adxpansion/i,
  /clickadu/i,
  /propellerads/i,
  /hilltopads/i,
  /adsterra/i,
  /monetag/i,
  /onclick/i,
  /popunder/i,
  /adserver/i,
  /delivery/i,
  /cpm/i,
  /bet365/i,
  /1xbet/i,
];

// Common modal lock classes added to <body> or <html> when overlays open
export const MODAL_LOCK_CLASSES = [
  'modal-open',
  'noscroll',
  'no-scroll',
  'overflow-hidden',
  'has-modal',
  'stop-scrolling',
  'disable-scroll',
  'lock-scroll',
  'overflow-y-hidden',
  'modal-shown',
  'is-locked',
];

/**
 * Intercept window.open popunder abuse
 */
export function interceptWindowOpen(
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): void {
  if (!targetWindow || typeof targetWindow !== 'object') return;

  const win = targetWindow as any;
  if (win.__ghostblock_window_open_intercepted__) return;

  try {
    const originalOpen = win.open;
    if (typeof originalOpen !== 'function') return;

    win.open = function (url?: string | URL, target?: string, features?: string): Window | null {
      const urlStr = url ? String(url).trim() : '';

      // Check if URL matches known popunder / adult ad networks
      let isAdPopunder = false;
      if (urlStr) {
        for (const pattern of POPUNDER_PATTERNS) {
          if (pattern.test(urlStr)) {
            isAdPopunder = true;
            break;
          }
        }
      }

      // Block empty or about:blank popunders intended for dynamic payload insertion
      if (!urlStr || urlStr === 'about:blank' || urlStr === 'about:blank#' || isAdPopunder) {
        console.warn('[GhostBlock Defuser] Blocked popunder window.open call:', urlStr || 'about:blank');
        try {
          if (typeof win.dispatchEvent === 'function') {
            const event = new CustomEvent(GHOST_EVENTS.MODAL_DEFUSED, {
              detail: {
                modalsDefused: 1,
                adsNeutralized: 1,
                bytesSaved: ESTIMATED_BYTES.GPT_SCRIPT,
                timestamp: Date.now(),
              },
            });
            win.dispatchEvent(event);
          }
        } catch (_e) {
          // Fail-safe
        }
        return null;
      }

      return originalOpen.call(this, url, target, features);
    };

    win.__ghostblock_window_open_intercepted__ = true;
  } catch (_err) {
    // Fail-safe
  }
}

/**
 * Whitelist video player containers so legitimate UI elements (.mgp_touchLayer, .mgp_playBtn, .player-ui)
 * are never defused or removed.
 */
export function isInsideProtectedPlayer(element: Element): boolean {
  if (!element || element.nodeType !== 1) return false;

  try {
    if (typeof element.closest === 'function') {
      if (
        element.closest('#player') ||
        element.closest('.mgp_videoContainer') ||
        element.closest('.video-player') ||
        element.closest('.player-container') ||
        element.closest('#movie_player') ||
        element.closest('.html5-video-player') ||
        element.closest('#main-video') ||
        element.closest('.mgp_container')
      ) {
        return true;
      }
    }

    // Check if any ancestor contains a valid media element (<video> / <audio>)
    let current = element.parentElement;
    let depth = 0;
    while (current && depth < 6) {
      const parentTag = current.tagName ? current.tagName.toUpperCase() : '';
      if (parentTag === 'BODY' || parentTag === 'HTML') {
        break;
      }
      if (typeof current.querySelector === 'function' && current.querySelector('video, audio')) {
        return true;
      }
      current = current.parentElement;
      depth++;
    }
  } catch (_err) {
    // Fail-safe
  }

  return false;
}

/**
 * Helper to check if an element is an external redirect anchor (3rd-party target="_blank" absolute overlay)
 */
export function isExternalRedirectAnchor(
  element: Element,
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): boolean {
  if (!element || element.nodeType !== 1) return false;

  const tagName = element.tagName ? element.tagName.toUpperCase() : '';
  if (tagName !== 'A') return false;

  const htmlEl = element as HTMLElement;
  const targetAttr = htmlEl.getAttribute ? htmlEl.getAttribute('target') : null;
  if (targetAttr !== '_blank') {
    return false;
  }

  const href = (htmlEl.getAttribute && htmlEl.getAttribute('href')) || (htmlEl as any).href || '';

  // Check if position is absolute/fixed
  const styleAttr = htmlEl.getAttribute ? htmlEl.getAttribute('style') || '' : '';
  let position = htmlEl.style?.position || '';
  if (!position && typeof targetWindow.getComputedStyle === 'function') {
    try {
      position = targetWindow.getComputedStyle(element)?.position || '';
    } catch (_e) {}
  }
  const isPositioned =
    position === 'absolute' ||
    position === 'fixed' ||
    styleAttr.includes('position: absolute') ||
    styleAttr.includes('position: fixed') ||
    styleAttr.includes('position:absolute') ||
    styleAttr.includes('position:fixed');

  if (!isPositioned) {
    return false;
  }

  if (!href || href === '#' || href.startsWith('javascript:')) {
    return false;
  }

  // Match known popunder keywords
  for (const pattern of POPUNDER_PATTERNS) {
    if (pattern.test(href)) {
      return true;
    }
  }

  // Check if it links to an external origin
  const currentHostname =
    (targetWindow.location && targetWindow.location.hostname) ||
    (typeof window !== 'undefined' ? window.location?.hostname : '') ||
    '';

  try {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      const urlObj = new URL(href, targetWindow.location?.href || 'https://localhost');
      if (
        urlObj.hostname &&
        currentHostname &&
        urlObj.hostname !== currentHostname &&
        !urlObj.hostname.endsWith('.' + currentHostname)
      ) {
        return true;
      }
      // If currentHostname is empty (e.g. in test), consider valid absolute external URL
      if (urlObj.hostname && !currentHostname) {
        return true;
      }
    }
  } catch (_e) {
    if (href.startsWith('http') && currentHostname && !href.includes(currentHostname)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a DOM element is an anti-adblock modal or backdrop overlay
 */
export function isAntiAdblockOverlay(
  element: Element,
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): boolean {
  if (!element || element.nodeType !== 1) return false;

  // Never target elements inside protected video player containers
  if (isInsideProtectedPlayer(element)) {
    return false;
  }

  // Avoid targeting root layout containers
  const tagName = element.tagName ? element.tagName.toUpperCase() : '';
  if (tagName === 'HTML' || tagName === 'BODY' || tagName === 'HEAD' || tagName === 'MAIN') {
    return false;
  }

  let position = '';
  let zIndexVal = 0;

  // 1. Inspect computed styles or inline styles
  if (typeof targetWindow.getComputedStyle === 'function') {
    try {
      const computed = targetWindow.getComputedStyle(element);
      position = computed?.position || '';
      const parsedZ = parseInt(computed?.zIndex || '0', 10);
      if (!isNaN(parsedZ)) zIndexVal = parsedZ;
    } catch (_err) {
      // Fallback to inline style inspection
    }
  }

  const htmlEl = element as HTMLElement;
  if (!position && htmlEl.style) {
    position = htmlEl.style.position || '';
  }
  if (!zIndexVal && htmlEl.style && htmlEl.style.zIndex) {
    const inlineZ = parseInt(htmlEl.style.zIndex, 10);
    if (!isNaN(inlineZ)) zIndexVal = inlineZ;
  }

  const isDialogOrModal =
    tagName === 'DIALOG' ||
    (typeof element.getAttribute === 'function' &&
      (element.getAttribute('role') === 'dialog' || element.getAttribute('role') === 'alertdialog')) ||
    (typeof htmlEl.className === 'string' &&
      /(?:modal|overlay|backdrop|popup|adblock|alert|warning)/i.test(htmlEl.className)) ||
    (typeof htmlEl.id === 'string' &&
      /(?:modal|overlay|backdrop|popup|adblock|alert|warning)/i.test(htmlEl.id));

  // Element must be positioned on top of the page (fixed or absolute) with high z-index,
  // or be an overlay modal/dialog container
  const isPositionedOverlay =
    (position === 'fixed' || position === 'absolute') && (zIndexVal >= 100 || isDialogOrModal);

  if (!isPositionedOverlay) {
    return false;
  }

  // 2. Check text content for anti-adblock signatures
  const text = element.textContent || '';
  if (text.length > 0 && text.length < 5000 && ANTI_ADBLOCK_REGEX.test(text)) {
    return true;
  }

  // 3. Check for child nodes or dialogs matching anti-adblock text
  const matchingChild = element.querySelector && element.querySelector('*');
  if (matchingChild && ANTI_ADBLOCK_REGEX.test(matchingChild.textContent || '')) {
    return true;
  }

  return false;
}

/**
 * Check if a DOM element is a full-screen clickjacker or player overlay
 */
export function isClickjackerOverlay(
  element: Element,
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): boolean {
  if (!element || element.nodeType !== 1) return false;

  // Never target elements inside protected video player containers
  if (isInsideProtectedPlayer(element)) {
    return false;
  }

  const tagName = element.tagName ? element.tagName.toUpperCase() : '';
  if (tagName === 'HTML' || tagName === 'BODY' || tagName === 'HEAD' || tagName === 'MAIN') {
    return false;
  }

  const htmlEl = element as HTMLElement;
  const styleAttr = htmlEl.getAttribute ? htmlEl.getAttribute('style') || '' : '';
  const inlineZ = htmlEl.style?.zIndex || '';

  // 1. Max z-index overlay (z-index: 2147483647 or style contains 2147483647)
  if (inlineZ.includes('2147483647') || styleAttr.includes('2147483647') || styleAttr.includes('214748364')) {
    return true;
  }

  // 2. Target _blank absolute links placed over video player or viewport linking to external 3rd-party domains
  if (isExternalRedirectAnchor(element, targetWindow)) {
    return true;
  }

  // 3. Known adult/tube video ad overlay classnames
  const className = htmlEl.className || '';
  if (typeof className === 'string') {
    if (
      className.includes('mgp_adActive') ||
      className.includes('vast-ad') ||
      className.includes('vast-block') ||
      className.includes('video-ad-overlay') ||
      className.includes('clickjack')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Force page scrollbars to unfreeze and clean up locking attributes/classes
 */
export function unfreezeScroll(
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any)
): void {
  if (!rootDoc) return;

  const html = rootDoc.documentElement;
  const body = rootDoc.body;

  if (html && html.style) {
    html.style.setProperty('overflow', 'auto', 'important');
    html.style.setProperty('position', 'static', 'important');
    MODAL_LOCK_CLASSES.forEach((cls) => html.classList?.remove(cls));
  }

  if (body && body.style) {
    body.style.setProperty('overflow', 'auto', 'important');
    body.style.setProperty('position', 'static', 'important');
    MODAL_LOCK_CLASSES.forEach((cls) => body.classList?.remove(cls));
  }
}

/**
 * Defuse and remove a detected anti-adblock overlay or clickjacker, unfreeze scroll,
 * and dispatch telemetry event.
 */
export function defuseOverlay(
  element: Element,
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any),
  targetWin: Window = typeof window !== 'undefined' ? window : ({} as any)
): boolean {
  if (!element) return false;

  try {
    // 1. Remove or neutralize overlay element
    if (typeof (element as any).remove === 'function') {
      (element as any).remove();
    } else if (element.parentElement) {
      element.parentElement.removeChild(element);
    } else if ((element as HTMLElement).style) {
      (element as HTMLElement).style.setProperty('display', 'none', 'important');
      (element as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
      (element as HTMLElement).style.setProperty('opacity', '0', 'important');
      (element as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
    }

    // 2. Unfreeze scroll on document
    unfreezeScroll(rootDoc);

    // 3. Dispatch telemetry event to window
    if (targetWin && typeof targetWin.dispatchEvent === 'function') {
      const CustomEventCtor =
        (targetWin as any).CustomEvent ||
        (typeof CustomEvent === 'function' ? CustomEvent : null);
      if (CustomEventCtor) {
        const event = new CustomEventCtor(GHOST_EVENTS.MODAL_DEFUSED, {
          detail: {
            modalsDefused: 1,
            adsNeutralized: 1,
            bytesSaved: ESTIMATED_BYTES.GPT_SCRIPT,
            timestamp: Date.now(),
          },
        });
        targetWin.dispatchEvent(event);
      }
    }

    return true;
  } catch (err) {
    console.warn('[GhostBlock Defuser] Error defusing overlay:', err);
    return false;
  }
}

/**
 * Scan the document or container for anti-adblock overlays and clickjackers and defuse them
 */
export function scanAndDefuseOverlays(
  rootNode: ParentNode = typeof document !== 'undefined' ? document : ({} as any),
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any),
  targetWin: Window = typeof window !== 'undefined' ? window : ({} as any)
): number {
  if (!rootNode || typeof rootNode.querySelectorAll !== 'function') return 0;

  let defusedCount = 0;
  const defusedSet = new Set<Element>();

  try {
    // Query elements likely to be anti-adblock overlays, modals, or clickjackers
    const candidateElements = rootNode.querySelectorAll(
      'div, section, aside, dialog, [role="dialog"], [role="alertdialog"], .modal, .overlay, .backdrop, a[target="_blank"], .mgp_adActive, .vast-ad, .vast-block, [class*="clickjack"]'
    );

    for (let i = 0; i < candidateElements.length; i++) {
      const el = candidateElements[i];
      if (
        !defusedSet.has(el) &&
        !isInsideProtectedPlayer(el) &&
        (isAntiAdblockOverlay(el, targetWin) || isClickjackerOverlay(el, targetWin))
      ) {
        defusedSet.add(el);
        const success = defuseOverlay(el, rootDoc, targetWin);
        if (success) defusedCount++;
      }
    }
  } catch (err) {
    console.warn('[GhostBlock Defuser] Error scanning overlays:', err);
  }

  return defusedCount;
}

export interface OverlayDefuserOptions {
  document?: Document;
  window?: Window;
  debounceMs?: number;
}

/**
 * Initialize the MutationObserver and popunder interceptor for real-time modal/overlay defusing
 */
export function initOverlayDefuser(options: OverlayDefuserOptions = {}): () => void {
  const doc = options.document || (typeof document !== 'undefined' ? document : undefined);
  const win = options.window || (typeof window !== 'undefined' ? window : undefined);
  const debounceMs = options.debounceMs ?? 50;

  if (win) {
    interceptWindowOpen(win);
  }

  if (!doc) {
    return () => {};
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const triggerScan = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      scanAndDefuseOverlays(doc, doc, win);
    }, debounceMs);
  };

  // Perform immediate scan on initialization
  scanAndDefuseOverlays(doc, doc, win);

  // Set up MutationObserver to monitor dynamically injected overlays
  let observer: MutationObserver | null = null;

  const startObserver = () => {
    const target = doc.body || doc.documentElement;
    if (!target) return;

    const ObserverClass =
      (win && (win as any).MutationObserver) ||
      (typeof MutationObserver !== 'undefined' ? MutationObserver : null);

    if (ObserverClass) {
      const obs = new ObserverClass((mutations: MutationRecord[]) => {
        let shouldScan = false;
        for (let i = 0; i < mutations.length; i++) {
          const mutation = mutations[i];
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            for (let j = 0; j < mutation.addedNodes.length; j++) {
              const node = mutation.addedNodes[j];
              if (node.nodeType === 1) {
                const el = node as Element;
                if (isAntiAdblockOverlay(el, win) || isClickjackerOverlay(el, win)) {
                  defuseOverlay(el, doc, win);
                } else {
                  shouldScan = true;
                }
              }
            }
          }
        }
        if (shouldScan) {
          triggerScan();
        }
      });

      observer = obs;

      try {
        obs.observe(target, {
          childList: true,
          subtree: true,
        });
      } catch (err) {
        console.warn('[GhostBlock Defuser] Observer error:', err);
      }
    }
  };

  if (doc.body) {
    startObserver();
  } else if (doc.addEventListener) {
    doc.addEventListener('DOMContentLoaded', () => {
      startObserver();
      scanAndDefuseOverlays(doc, doc, win);
    });
  }

  // Return teardown / disconnect cleanup function
  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };
}
