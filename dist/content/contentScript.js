(function() {
  "use strict";
  const ESTIMATED_BYTES = {
    GPT_SCRIPT: 150 * 1024,
    // ~150 KB
    ADSENSE_SCRIPT: 120 * 1024,
    // ~120 KB
    PREBID_SCRIPT: 200 * 1024,
    // ~200 KB
    AD_CREATIVE_IMAGE: 80 * 1024,
    // ~80 KB
    AD_VIDEO_STREAM: 2 * 1024 * 1024
    // ~2 MB
  };
  const GHOST_EVENTS = {
    TELEMETRY_INCREMENT: "ghostblock:telemetry_increment",
    VIDEO_AD_DETECTED: "ghostblock:video_ad_detected",
    MODAL_DEFUSED: "ghostblock:modal_defused"
  };
  const ANTI_ADBLOCK_REGEX = /(?:adblock|ad-block|disable\s+(?:your\s+)?ad\s*blocker|whitelist\s+us|turn\s+off\s+(?:your\s+)?ad\s*blocker|ad\s*blocker\s+detected|please\s+(?:disable|allow|turn\s+off)\s+ads|ad-blocking|disable\s+adblocking|غیرفعال\s*(?:کنید|نمایید|کردن)|مسدود\s*کننده(?:\s*تبلیغات)?|مسدودکننده(?:\s*تبلیغات)?|تبلیغات\s*را\s*(?:غیرفعال|فعال)|ادبلاک|اد\s*بلاک|آنتی\s*ادبلاک)/i;
  const POPUNDER_PATTERNS = [
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
    /1xbet/i
  ];
  const MODAL_LOCK_CLASSES = [
    "modal-open",
    "noscroll",
    "no-scroll",
    "overflow-hidden",
    "has-modal",
    "stop-scrolling",
    "disable-scroll",
    "lock-scroll",
    "overflow-y-hidden",
    "modal-shown",
    "is-locked"
  ];
  function interceptWindowOpen(targetWindow = typeof window !== "undefined" ? window : {}) {
    if (!targetWindow || typeof targetWindow !== "object") return;
    const win = targetWindow;
    if (win.__ghostblock_window_open_intercepted__) return;
    try {
      const originalOpen = win.open;
      if (typeof originalOpen !== "function") return;
      win.open = function(url, target, features) {
        const urlStr = url ? String(url).trim() : "";
        let isAdPopunder = false;
        if (urlStr) {
          for (const pattern of POPUNDER_PATTERNS) {
            if (pattern.test(urlStr)) {
              isAdPopunder = true;
              break;
            }
          }
        }
        if (!urlStr || urlStr === "about:blank" || urlStr === "about:blank#" || isAdPopunder) {
          console.warn("[GhostBlock Defuser] Blocked popunder window.open call:", urlStr || "about:blank");
          try {
            if (typeof win.dispatchEvent === "function") {
              const event = new CustomEvent(GHOST_EVENTS.MODAL_DEFUSED, {
                detail: {
                  modalsDefused: 1,
                  adsNeutralized: 1,
                  bytesSaved: ESTIMATED_BYTES.GPT_SCRIPT,
                  timestamp: Date.now()
                }
              });
              win.dispatchEvent(event);
            }
          } catch (_e) {
          }
          return null;
        }
        return originalOpen.call(this, url, target, features);
      };
      win.__ghostblock_window_open_intercepted__ = true;
    } catch (_err) {
    }
  }
  function isInsideProtectedPlayer(element) {
    if (!element || element.nodeType !== 1) return false;
    try {
      if (typeof element.closest === "function") {
        if (element.closest("#player") || element.closest(".mgp_videoContainer") || element.closest(".video-player") || element.closest(".player-container") || element.closest("#movie_player") || element.closest(".html5-video-player") || element.closest("#main-video") || element.closest(".mgp_container")) {
          return true;
        }
      }
      let current = element.parentElement;
      let depth = 0;
      while (current && depth < 6) {
        const parentTag = current.tagName ? current.tagName.toUpperCase() : "";
        if (parentTag === "BODY" || parentTag === "HTML") {
          break;
        }
        if (typeof current.querySelector === "function" && current.querySelector("video, audio")) {
          return true;
        }
        current = current.parentElement;
        depth++;
      }
    } catch (_err) {
    }
    return false;
  }
  function isExternalRedirectAnchor(element, targetWindow = typeof window !== "undefined" ? window : {}) {
    if (!element || element.nodeType !== 1) return false;
    const tagName = element.tagName ? element.tagName.toUpperCase() : "";
    if (tagName !== "A") return false;
    const htmlEl = element;
    const targetAttr = htmlEl.getAttribute ? htmlEl.getAttribute("target") : null;
    if (targetAttr !== "_blank") {
      return false;
    }
    const href = htmlEl.getAttribute && htmlEl.getAttribute("href") || htmlEl.href || "";
    const styleAttr = htmlEl.getAttribute ? htmlEl.getAttribute("style") || "" : "";
    let position = htmlEl.style?.position || "";
    if (!position && typeof targetWindow.getComputedStyle === "function") {
      try {
        position = targetWindow.getComputedStyle(element)?.position || "";
      } catch (_e) {
      }
    }
    const isPositioned = position === "absolute" || position === "fixed" || styleAttr.includes("position: absolute") || styleAttr.includes("position: fixed") || styleAttr.includes("position:absolute") || styleAttr.includes("position:fixed");
    if (!isPositioned) {
      return false;
    }
    if (!href || href === "#" || href.startsWith("javascript:")) {
      return false;
    }
    for (const pattern of POPUNDER_PATTERNS) {
      if (pattern.test(href)) {
        return true;
      }
    }
    const currentHostname = targetWindow.location && targetWindow.location.hostname || (typeof window !== "undefined" ? window.location?.hostname : "") || "";
    try {
      if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
        const urlObj = new URL(href, targetWindow.location?.href || "https://localhost");
        if (urlObj.hostname && currentHostname && urlObj.hostname !== currentHostname && !urlObj.hostname.endsWith("." + currentHostname)) {
          return true;
        }
        if (urlObj.hostname && !currentHostname) {
          return true;
        }
      }
    } catch (_e) {
      if (href.startsWith("http") && currentHostname && !href.includes(currentHostname)) {
        return true;
      }
    }
    return false;
  }
  function isAntiAdblockOverlay(element, targetWindow = typeof window !== "undefined" ? window : {}) {
    if (!element || element.nodeType !== 1) return false;
    if (isInsideProtectedPlayer(element)) {
      return false;
    }
    const tagName = element.tagName ? element.tagName.toUpperCase() : "";
    if (tagName === "HTML" || tagName === "BODY" || tagName === "HEAD" || tagName === "MAIN") {
      return false;
    }
    let position = "";
    let zIndexVal = 0;
    if (typeof targetWindow.getComputedStyle === "function") {
      try {
        const computed = targetWindow.getComputedStyle(element);
        position = computed?.position || "";
        const parsedZ = parseInt(computed?.zIndex || "0", 10);
        if (!isNaN(parsedZ)) zIndexVal = parsedZ;
      } catch (_err) {
      }
    }
    const htmlEl = element;
    if (!position && htmlEl.style) {
      position = htmlEl.style.position || "";
    }
    if (!zIndexVal && htmlEl.style && htmlEl.style.zIndex) {
      const inlineZ = parseInt(htmlEl.style.zIndex, 10);
      if (!isNaN(inlineZ)) zIndexVal = inlineZ;
    }
    const isDialogOrModal = tagName === "DIALOG" || typeof element.getAttribute === "function" && (element.getAttribute("role") === "dialog" || element.getAttribute("role") === "alertdialog") || typeof htmlEl.className === "string" && /(?:modal|overlay|backdrop|popup|adblock|alert|warning)/i.test(htmlEl.className) || typeof htmlEl.id === "string" && /(?:modal|overlay|backdrop|popup|adblock|alert|warning)/i.test(htmlEl.id);
    const isPositionedOverlay = (position === "fixed" || position === "absolute") && (zIndexVal >= 100 || isDialogOrModal);
    if (!isPositionedOverlay) {
      return false;
    }
    const text = element.textContent || "";
    if (text.length > 0 && text.length < 5e3 && ANTI_ADBLOCK_REGEX.test(text)) {
      return true;
    }
    const matchingChild = element.querySelector && element.querySelector("*");
    if (matchingChild && ANTI_ADBLOCK_REGEX.test(matchingChild.textContent || "")) {
      return true;
    }
    return false;
  }
  function isClickjackerOverlay(element, targetWindow = typeof window !== "undefined" ? window : {}) {
    if (!element || element.nodeType !== 1) return false;
    if (isInsideProtectedPlayer(element)) {
      return false;
    }
    const tagName = element.tagName ? element.tagName.toUpperCase() : "";
    if (tagName === "HTML" || tagName === "BODY" || tagName === "HEAD" || tagName === "MAIN") {
      return false;
    }
    const htmlEl = element;
    const styleAttr = htmlEl.getAttribute ? htmlEl.getAttribute("style") || "" : "";
    const inlineZ = htmlEl.style?.zIndex || "";
    if (inlineZ.includes("2147483647") || styleAttr.includes("2147483647") || styleAttr.includes("214748364")) {
      return true;
    }
    if (isExternalRedirectAnchor(element, targetWindow)) {
      return true;
    }
    const className = htmlEl.className || "";
    if (typeof className === "string") {
      if (className.includes("mgp_adActive") || className.includes("vast-ad") || className.includes("vast-block") || className.includes("video-ad-overlay") || className.includes("clickjack")) {
        return true;
      }
    }
    return false;
  }
  function unfreezeScroll(rootDoc = typeof document !== "undefined" ? document : {}) {
    if (!rootDoc) return;
    const html = rootDoc.documentElement;
    const body = rootDoc.body;
    if (html && html.style) {
      html.style.setProperty("overflow", "auto", "important");
      html.style.setProperty("position", "static", "important");
      MODAL_LOCK_CLASSES.forEach((cls) => html.classList?.remove(cls));
    }
    if (body && body.style) {
      body.style.setProperty("overflow", "auto", "important");
      body.style.setProperty("position", "static", "important");
      MODAL_LOCK_CLASSES.forEach((cls) => body.classList?.remove(cls));
    }
  }
  function defuseOverlay(element, rootDoc = typeof document !== "undefined" ? document : {}, targetWin = typeof window !== "undefined" ? window : {}) {
    if (!element) return false;
    try {
      if (typeof element.remove === "function") {
        element.remove();
      } else if (element.parentElement) {
        element.parentElement.removeChild(element);
      } else if (element.style) {
        element.style.setProperty("display", "none", "important");
        element.style.setProperty("visibility", "hidden", "important");
        element.style.setProperty("opacity", "0", "important");
        element.style.setProperty("pointer-events", "none", "important");
      }
      unfreezeScroll(rootDoc);
      if (targetWin && typeof targetWin.dispatchEvent === "function") {
        const CustomEventCtor = targetWin.CustomEvent || (typeof CustomEvent === "function" ? CustomEvent : null);
        if (CustomEventCtor) {
          const event = new CustomEventCtor(GHOST_EVENTS.MODAL_DEFUSED, {
            detail: {
              modalsDefused: 1,
              adsNeutralized: 1,
              bytesSaved: ESTIMATED_BYTES.GPT_SCRIPT,
              timestamp: Date.now()
            }
          });
          targetWin.dispatchEvent(event);
        }
      }
      return true;
    } catch (err) {
      console.warn("[GhostBlock Defuser] Error defusing overlay:", err);
      return false;
    }
  }
  function scanAndDefuseOverlays(rootNode = typeof document !== "undefined" ? document : {}, rootDoc = typeof document !== "undefined" ? document : {}, targetWin = typeof window !== "undefined" ? window : {}) {
    if (!rootNode || typeof rootNode.querySelectorAll !== "function") return 0;
    let defusedCount = 0;
    const defusedSet = /* @__PURE__ */ new Set();
    try {
      const candidateElements = rootNode.querySelectorAll(
        'div, section, aside, dialog, [role="dialog"], [role="alertdialog"], .modal, .overlay, .backdrop, a[target="_blank"], .mgp_adActive, .vast-ad, .vast-block, [class*="clickjack"]'
      );
      for (let i = 0; i < candidateElements.length; i++) {
        const el = candidateElements[i];
        if (!defusedSet.has(el) && !isInsideProtectedPlayer(el) && (isAntiAdblockOverlay(el, targetWin) || isClickjackerOverlay(el, targetWin))) {
          defusedSet.add(el);
          const success = defuseOverlay(el, rootDoc, targetWin);
          if (success) defusedCount++;
        }
      }
    } catch (err) {
      console.warn("[GhostBlock Defuser] Error scanning overlays:", err);
    }
    return defusedCount;
  }
  function initOverlayDefuser(options = {}) {
    const doc = options.document || (typeof document !== "undefined" ? document : void 0);
    const win = options.window || (typeof window !== "undefined" ? window : void 0);
    const debounceMs = options.debounceMs ?? 50;
    if (win) {
      interceptWindowOpen(win);
    }
    if (!doc) {
      return () => {
      };
    }
    let debounceTimer = null;
    const triggerScan = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        scanAndDefuseOverlays(doc, doc, win);
      }, debounceMs);
    };
    scanAndDefuseOverlays(doc, doc, win);
    let observer = null;
    const startObserver = () => {
      const target = doc.body || doc.documentElement;
      if (!target) return;
      const ObserverClass = win && win.MutationObserver || (typeof MutationObserver !== "undefined" ? MutationObserver : null);
      if (ObserverClass) {
        const obs = new ObserverClass((mutations) => {
          let shouldScan = false;
          for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
              for (let j = 0; j < mutation.addedNodes.length; j++) {
                const node = mutation.addedNodes[j];
                if (node.nodeType === 1) {
                  const el = node;
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
            subtree: true
          });
        } catch (err) {
          console.warn("[GhostBlock Defuser] Observer error:", err);
        }
      }
    };
    if (doc.body) {
      startObserver();
    } else if (doc.addEventListener) {
      doc.addEventListener("DOMContentLoaded", () => {
        startObserver();
        scanAndDefuseOverlays(doc, doc, win);
      });
    }
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
  const pageState = {
    url: typeof window !== "undefined" ? window.location?.href || "" : "",
    domain: typeof window !== "undefined" ? window.location?.hostname || "" : "",
    adsNeutralized: 0,
    videoAdsSkipped: 0,
    modalsDefused: 0,
    bytesSaved: 0,
    startTime: Date.now()
  };
  async function sendTelemetryToBackground(payload) {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id || typeof chrome.runtime.sendMessage !== "function") {
      return false;
    }
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "GHOST_INCREMENT_TELEMETRY",
            payload
          },
          (response) => {
            if (chrome.runtime?.lastError) {
              resolve(false);
            } else {
              resolve(response?.success ?? true);
            }
          }
        );
      } catch (_err) {
        resolve(false);
      }
    });
  }
  function handleWindowTelemetryEvent(event) {
    if (!event || !event.detail) return;
    const detail = event.detail;
    const incrementPayload = {};
    if (typeof detail.adsNeutralized === "number" && detail.adsNeutralized > 0) {
      pageState.adsNeutralized += detail.adsNeutralized;
      incrementPayload.adsNeutralized = detail.adsNeutralized;
    }
    if (typeof detail.videoAdsSkipped === "number" && detail.videoAdsSkipped > 0) {
      pageState.videoAdsSkipped += detail.videoAdsSkipped;
      incrementPayload.videoAdsSkipped = detail.videoAdsSkipped;
      const videoBytes = detail.bytesSaved || ESTIMATED_BYTES.AD_VIDEO_STREAM;
      pageState.bytesSaved += videoBytes;
      incrementPayload.bytesSaved = (incrementPayload.bytesSaved || 0) + videoBytes;
    }
    if (typeof detail.modalsDefused === "number" && detail.modalsDefused > 0) {
      pageState.modalsDefused += detail.modalsDefused;
      incrementPayload.modalsDefused = detail.modalsDefused;
    }
    if (typeof detail.bytesSaved === "number" && detail.bytesSaved > 0 && !detail.videoAdsSkipped) {
      pageState.bytesSaved += detail.bytesSaved;
      incrementPayload.bytesSaved = (incrementPayload.bytesSaved || 0) + detail.bytesSaved;
    }
    if (Object.keys(incrementPayload).length > 0) {
      sendTelemetryToBackground(incrementPayload);
    }
  }
  function countQuarantinedElements(rootDoc = document) {
    if (!rootDoc || typeof rootDoc.querySelectorAll !== "function") return 0;
    const selectors = [
      "ins.adsbygoogle",
      'iframe[id^="google_ads_iframe"]',
      'div[id^="google_ads_"]',
      'div[id^="div-gpt-ad"]',
      'div[class*="ad-placement"]',
      'div[class*="ad-wrapper"]',
      'div[class*="ad-container"]',
      'div[class*="ad-banner"]',
      'div[class*="ad-slot"]',
      ".pub_300x250",
      ".pub_728x90",
      ".pub_300x600",
      ".pub_160x600",
      ".ad-banner",
      ".ad-slot"
    ];
    try {
      const elements = rootDoc.querySelectorAll(selectors.join(", "));
      return elements.length;
    } catch (_err) {
      return 0;
    }
  }
  function initContentCoordinator(targetWindow = typeof window !== "undefined" ? window : {}, targetChrome = typeof chrome !== "undefined" ? chrome : {}) {
    if (!targetWindow || typeof targetWindow.addEventListener !== "function") {
      return;
    }
    if (targetWindow.location) {
      if (!pageState.url) pageState.url = targetWindow.location.href || "";
      if (!pageState.domain) pageState.domain = targetWindow.location.hostname || "";
    }
    const eventNames = [
      GHOST_EVENTS.TELEMETRY_INCREMENT,
      GHOST_EVENTS.VIDEO_AD_DETECTED,
      GHOST_EVENTS.MODAL_DEFUSED
    ];
    eventNames.forEach((eventName) => {
      targetWindow.addEventListener(eventName, ((e) => {
        handleWindowTelemetryEvent(e);
      }));
    });
    if (targetChrome && targetChrome.runtime && targetChrome.runtime.onMessage) {
      targetChrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || typeof message.type !== "string") return false;
        if (message.type === "GHOST_GET_TAB_STATS") {
          const quarantined = countQuarantinedElements(targetWindow.document);
          const currentDomain = pageState.domain || targetWindow.location?.hostname || "";
          const currentUrl = pageState.url || targetWindow.location?.href || "";
          sendResponse({
            success: true,
            data: {
              ...pageState,
              domain: currentDomain,
              url: currentUrl,
              quarantinedElementsOnDOM: quarantined,
              totalNeutralizedOnPage: pageState.adsNeutralized + quarantined + pageState.videoAdsSkipped
            }
          });
          return true;
        }
        return false;
      });
    }
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      initContentCoordinator(window, typeof chrome !== "undefined" ? chrome : void 0);
      initOverlayDefuser({ document, window });
      console.log("[GhostBlock] Content Script Coordinator & Overlay Defuser active in ISOLATED world");
    } catch (err) {
      console.warn("[GhostBlock] Failed to initialize content coordinator:", err);
    }
  }
})();
