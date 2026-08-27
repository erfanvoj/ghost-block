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
  const VIDEO_AD_CONTAINER_SELECTORS = [
    ".ad-showing",
    ".ad-interrupting",
    ".video-ads",
    ".ytp-ad-player-overlay",
    "#movie_player.ad-showing",
    "#movie_player.ad-interrupting",
    "ytd-ad-slot-renderer",
    "ytd-banner-promo-renderer",
    "ytd-in-feed-ad-layout-renderer",
    ".mgp_adActive",
    ".mgp_preroll",
    '[class*="preroll"]',
    ".vast-block",
    ".vast-ad",
    '[class*="video-ad-overlay"]',
    ".ad-container",
    ".ytp-ad-module",
    ".ytp-ad-text",
    ".vjs-ad-playing",
    ".vjs-ad-loading",
    ".ima-ad-container",
    ".jw-flag-ads",
    '[class*="ad-showing"]',
    '[class*="ad-display"]',
    '[class*="ad-interrupt"]',
    '[class*="ad-playing"]'
  ];
  const SKIP_BUTTON_SELECTORS = [
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    ".ytp-ad-overlay-close-button",
    ".ytp-ad-skip-button-slot",
    '[class*="skip-button"]',
    '[id*="skip-ad"]',
    ".mgp_adSkipButton",
    ".ad-skip-btn",
    ".ytp-ad-text",
    ".videoAdUiSkipButton",
    ".videoAdUiAction",
    'button[class*="skip-button"]',
    'button[id*="skip-button"]',
    '[aria-label*="Skip Ad"]',
    '[aria-label*="skip ad" i]',
    "button.ytp-ad-skip-button-icon"
  ];
  const AD_OVERLAY_SELECTORS = [
    ".ytp-ad-overlay-container",
    "#player-ads",
    "ytd-ad-slot-renderer",
    "ytd-banner-promo-renderer",
    "ytd-in-feed-ad-layout-renderer",
    ".ytp-ad-player-overlay",
    ".ytp-ad-image-overlay",
    ".ytp-ad-overlay-image",
    ".mgp_preroll",
    ".mgp_adActive",
    ".vast-ad",
    ".vast-block",
    '[class*="video-ad-overlay"]'
  ];
  const AD_URL_PATTERNS = [
    /doubleclick\.net/i,
    /googlesyndication\.com/i,
    /googleads/i,
    /trafficjunky\.(?:com|net)/i,
    /exoclick\.com/i,
    /juicyads\.com/i,
    /tsyndicate\.com/i,
    /popads\.net/i,
    /popcash\.net/i,
    /adx1\.com/i,
    /ad_creative/i,
    /[?&]ad_type=/i,
    /[?&]adunit=/i
  ];
  const PROTECTED_MAIN_VIDEO_SELECTORS = [
    "#player video",
    ".mgp_videoContainer video",
    "#main-video",
    "video#main-video"
  ];
  function isProtectedMainVideo(video) {
    if (!video || video.nodeType !== 1) return false;
    try {
      if (typeof video.closest === "function") {
        if (video.closest("#ad-container") || video.closest(".ad-video-wrapper") || video.closest(".mgp_adActive") || video.closest(".vast-ad") || video.closest(".vast-block") || video.closest(".video-ads") || video.closest(".ima-ad-container")) {
          return false;
        }
      }
      const id = (typeof video.id === "string" ? video.id : "").toLowerCase();
      const className = typeof video.className === "string" ? video.className : "";
      if (id === "main-video" || className.includes("main-video")) {
        if (className.includes("html5-main-video")) {
          return false;
        }
        return true;
      }
      if (typeof video.closest === "function") {
        if (video.closest("#player") || video.closest(".mgp_videoContainer") || video.closest("#main-video")) {
          return true;
        }
      }
      if (typeof video.matches === "function") {
        for (const selector of PROTECTED_MAIN_VIDEO_SELECTORS) {
          try {
            if (video.matches(selector)) {
              return true;
            }
          } catch (_e) {
          }
        }
      }
    } catch (_err) {
    }
    return false;
  }
  const INJECTION_KEY = "__GHOSTBLOCK_VIDEO_AD_ENGINE_INSTALLED__";
  const processedAdSources = /* @__PURE__ */ new Set();
  const acceleratedVideos = /* @__PURE__ */ new WeakSet();
  const originalVideoStates = /* @__PURE__ */ new WeakMap();
  const youTubeState = {
    isAdPlaying: false,
    userPlaybackRate: 1,
    userMuted: false
  };
  function isYouTubeAdShowing(moviePlayer, rootDoc = typeof document !== "undefined" ? document : {}) {
    const player = moviePlayer || (rootDoc && typeof rootDoc.querySelector === "function" ? rootDoc.querySelector("#movie_player") : null);
    if (!player) return false;
    if (player.classList && typeof player.classList.contains === "function") {
      return player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting");
    }
    const className = player.className || "";
    if (typeof className === "string") {
      return className.includes("ad-showing") || className.includes("ad-interrupting");
    }
    return false;
  }
  function handleYouTubeAdTransition(moviePlayer, video, rootDoc = typeof document !== "undefined" ? document : {}, targetWindow = typeof window !== "undefined" ? window : {}) {
    if (!video) return;
    const player = rootDoc && typeof rootDoc.querySelector === "function" ? rootDoc.querySelector("#movie_player") : null;
    const videoEl = video || (player && typeof player.querySelector === "function" ? player.querySelector("video") : null) || (rootDoc && typeof rootDoc.querySelector === "function" ? rootDoc.querySelector("#movie_player video, video.html5-main-video") : null);
    const adShowing = isYouTubeAdShowing(player, rootDoc);
    if (adShowing) {
      if (!youTubeState.isAdPlaying && videoEl) {
        youTubeState.isAdPlaying = true;
        if (videoEl.playbackRate > 0 && videoEl.playbackRate !== 16) {
          youTubeState.userPlaybackRate = videoEl.playbackRate;
        }
        youTubeState.userMuted = videoEl.muted;
      }
      if (videoEl) {
        if (!videoEl.muted) {
          videoEl.muted = true;
        }
        if (videoEl.playbackRate !== 16) {
          try {
            videoEl.playbackRate = 16;
          } catch (_e) {
          }
        }
        if (isFinite(videoEl.duration) && videoEl.duration > 0 && videoEl.duration <= 180) {
          const targetTime = Math.max(0, videoEl.duration - 0.1);
          if (videoEl.currentTime < targetTime) {
            try {
              videoEl.currentTime = targetTime;
            } catch (_e) {
            }
          }
        }
        acceleratedVideos.add(videoEl);
        notifyVideoAdSkipped(videoEl, targetWindow);
      }
      triggerSkipButtons(rootDoc);
      suppressAdOverlays(rootDoc);
    } else {
      if (youTubeState.isAdPlaying) {
        youTubeState.isAdPlaying = false;
        if (videoEl) {
          videoEl.playbackRate = youTubeState.userPlaybackRate || 1;
          if (!youTubeState.userMuted) {
            videoEl.muted = false;
          }
          acceleratedVideos.delete(videoEl);
        }
      }
    }
  }
  function initYouTubeObserver(rootDoc = typeof document !== "undefined" ? document : {}, targetWindow = typeof window !== "undefined" ? window : {}) {
    if (!rootDoc) return null;
    const MutationObserverClass = targetWindow && targetWindow.MutationObserver || (typeof MutationObserver !== "undefined" ? MutationObserver : null);
    if (!MutationObserverClass) return null;
    const handleRateChange = (e) => {
      const video = e.target;
      if (video && !youTubeState.isAdPlaying) {
        if (video.playbackRate > 0 && video.playbackRate !== 16) {
          youTubeState.userPlaybackRate = video.playbackRate;
        }
      }
    };
    const handleVolumeChange = (e) => {
      const video = e.target;
      if (video && !youTubeState.isAdPlaying) {
        youTubeState.userMuted = video.muted;
      }
    };
    try {
      rootDoc.addEventListener("ratechange", handleRateChange, true);
      rootDoc.addEventListener("volumechange", handleVolumeChange, true);
    } catch (_e) {
    }
    let observer = null;
    try {
      observer = new MutationObserver((mutations) => {
        let checkNeeded = false;
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (m.type === "attributes") {
            const target = m.target;
            if (target && (target.id === "movie_player" || target.classList?.contains("html5-video-player") || target.classList?.contains("ad-showing") || target.classList?.contains("ad-interrupting"))) {
              checkNeeded = true;
              break;
            }
          } else if (m.type === "childList") {
            checkNeeded = true;
            break;
          }
        }
        if (checkNeeded) {
          handleYouTubeAdTransition(null, null, rootDoc, targetWindow);
        }
      });
      const targetNode = rootDoc.documentElement || rootDoc.body || rootDoc;
      observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "id", "src"]
      });
      handleYouTubeAdTransition(null, null, rootDoc, targetWindow);
    } catch (_err) {
    }
    return () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      try {
        rootDoc.removeEventListener("ratechange", handleRateChange, true);
        rootDoc.removeEventListener("volumechange", handleVolumeChange, true);
      } catch (_e) {
      }
    };
  }
  function isVideoAd(video, rootDoc = typeof document !== "undefined" ? document : {}) {
    if (!video || video.nodeType !== 1) {
      return false;
    }
    if (isProtectedMainVideo(video)) {
      return false;
    }
    try {
      if (typeof video.closest === "function") {
        for (const selector of VIDEO_AD_CONTAINER_SELECTORS) {
          if (video.closest(selector)) {
            return true;
          }
        }
      }
      const src = (video.currentSrc || video.src || video.getAttribute && video.getAttribute("src") || "").toLowerCase();
      if (src) {
        for (const pattern of AD_URL_PATTERNS) {
          if (pattern.test(src)) {
            return true;
          }
        }
      }
      if (rootDoc && typeof rootDoc.querySelector === "function") {
        if (rootDoc.querySelector("#movie_player.ad-showing") || rootDoc.querySelector("#movie_player.ad-interrupting") || rootDoc.querySelector(".ytp-ad-player-overlay") || rootDoc.querySelector(".ytp-ad-showing")) {
          return true;
        }
      }
    } catch (_err) {
    }
    return false;
  }
  function triggerSkipButtons(rootDoc = typeof document !== "undefined" ? document : {}) {
    if (!rootDoc || typeof rootDoc.querySelectorAll !== "function") return false;
    let clicked = false;
    try {
      const win = rootDoc.defaultView || (typeof window !== "undefined" ? window : globalThis);
      for (const selector of SKIP_BUTTON_SELECTORS) {
        const buttons = rootDoc.querySelectorAll(selector);
        buttons.forEach((btn) => {
          if (typeof btn.click === "function") {
            btn.click();
            clicked = true;
          }
          try {
            if (typeof MouseEvent !== "undefined") {
              btn.dispatchEvent(
                new MouseEvent("click", {
                  bubbles: true,
                  cancelable: true,
                  view: win
                })
              );
              clicked = true;
            }
          } catch (_err) {
          }
        });
      }
    } catch (_err) {
    }
    return clicked;
  }
  function suppressAdOverlays(rootDoc = typeof document !== "undefined" ? document : {}) {
    if (!rootDoc || typeof rootDoc.querySelectorAll !== "function") return false;
    let suppressed = false;
    try {
      for (const selector of AD_OVERLAY_SELECTORS) {
        const overlays = rootDoc.querySelectorAll(selector);
        overlays.forEach((el) => {
          if (el && el.style) {
            el.style.setProperty("opacity", "0", "important");
            el.style.setProperty("pointer-events", "none", "important");
            el.style.setProperty("height", "0", "important");
            el.style.setProperty("overflow", "hidden", "important");
            suppressed = true;
          }
        });
      }
    } catch (_err) {
    }
    return suppressed;
  }
  function notifyVideoAdSkipped(video, targetWindow = typeof window !== "undefined" ? window : {}) {
    const currentSrc = video.currentSrc || video.src || "html5-video-ad-stream";
    const duration = isFinite(video.duration) ? video.duration : 0;
    const sessionKey = `${currentSrc}_${Math.round(duration)}`;
    if (processedAdSources.has(sessionKey)) {
      return;
    }
    processedAdSources.add(sessionKey);
    if (processedAdSources.size > 200) {
      const iter = processedAdSources.values();
      for (let i = 0; i < 50; i++) {
        processedAdSources.delete(iter.next().value);
      }
    }
    try {
      if (targetWindow && typeof targetWindow.dispatchEvent === "function") {
        const event = new CustomEvent(GHOST_EVENTS.VIDEO_AD_DETECTED, {
          detail: {
            videoAdsSkipped: 1,
            bytesSaved: ESTIMATED_BYTES.AD_VIDEO_STREAM,
            type: "video_ad_accelerated",
            src: currentSrc,
            duration,
            timestamp: Date.now()
          }
        });
        targetWindow.dispatchEvent(event);
      }
    } catch (_err) {
    }
  }
  function accelerateVideoAd(video, rootDoc = typeof document !== "undefined" ? document : {}, targetWindow = typeof window !== "undefined" ? window : {}) {
    if (!video) return false;
    if (isProtectedMainVideo(video)) {
      return false;
    }
    try {
      if (!originalVideoStates.has(video)) {
        originalVideoStates.set(video, {
          originalMuted: video.muted,
          originalRate: video.playbackRate === 16 ? 1 : video.playbackRate || 1
        });
      }
      if (!video.muted) {
        video.muted = true;
      }
      if (video.playbackRate !== 16) {
        try {
          video.playbackRate = 16;
        } catch (_e) {
        }
      }
      if (isFinite(video.duration) && video.duration > 0 && video.duration <= 180) {
        const targetTime = Math.max(0, video.duration - 0.1);
        if (video.currentTime < targetTime) {
          try {
            video.currentTime = targetTime;
          } catch (_e) {
          }
        }
      }
      triggerSkipButtons(rootDoc);
      suppressAdOverlays(rootDoc);
      acceleratedVideos.add(video);
      notifyVideoAdSkipped(video, targetWindow);
      return true;
    } catch (_err) {
      return false;
    }
  }
  function restoreNormalVideo(video) {
    if (!video || !acceleratedVideos.has(video)) return;
    try {
      const saved = originalVideoStates.get(video);
      if (video.playbackRate === 16) {
        video.playbackRate = saved ? saved.originalRate : 1;
      }
      if (saved && !saved.originalMuted && video.muted) {
        video.muted = false;
      }
      acceleratedVideos.delete(video);
      originalVideoStates.delete(video);
    } catch (_err) {
    }
  }
  function checkAndAccelerateAds(rootDoc = typeof document !== "undefined" ? document : {}, targetWindow = typeof window !== "undefined" ? window : {}) {
    if (!rootDoc) return;
    try {
      if (rootDoc.querySelector && rootDoc.querySelector("#movie_player")) {
        handleYouTubeAdTransition(null, null, rootDoc, targetWindow);
        return;
      }
      let adDetected = false;
      if (typeof rootDoc.querySelector === "function") {
        if (rootDoc.querySelector("#movie_player.ad-showing") || rootDoc.querySelector("#movie_player.ad-interrupting") || rootDoc.querySelector(".ytp-ad-player-overlay") || rootDoc.querySelector(".ad-showing") || rootDoc.querySelector(".ad-interrupting")) {
          adDetected = true;
        }
      }
      if (typeof rootDoc.querySelectorAll === "function") {
        const videos = rootDoc.querySelectorAll("video");
        videos.forEach((video) => {
          if (adDetected || isVideoAd(video, rootDoc)) {
            accelerateVideoAd(video, rootDoc, targetWindow);
          } else if (acceleratedVideos.has(video)) {
            restoreNormalVideo(video);
          }
        });
      }
      triggerSkipButtons(rootDoc);
      suppressAdOverlays(rootDoc);
    } catch (_err) {
    }
  }
  function isVideoElement(target) {
    if (!target || typeof target !== "object") return false;
    if (typeof HTMLVideoElement !== "undefined" && target instanceof HTMLVideoElement) return true;
    const el = target;
    return el.nodeType === 1 && typeof el.tagName === "string" && el.tagName.toUpperCase() === "VIDEO";
  }
  function handleVideoEvent(event, rootDoc = typeof document !== "undefined" ? document : {}, targetWindow = typeof window !== "undefined" ? window : {}) {
    const target = event.target;
    if (!isVideoElement(target)) {
      return;
    }
    const video = target;
    if (rootDoc.querySelector && rootDoc.querySelector("#movie_player")) {
      handleYouTubeAdTransition(null, video, rootDoc, targetWindow);
      return;
    }
    if (isVideoAd(video, rootDoc)) {
      accelerateVideoAd(video, rootDoc, targetWindow);
    } else if (acceleratedVideos.has(video)) {
      restoreNormalVideo(video);
    }
  }
  function installVideoAdEngine(targetGlobal = globalThis) {
    if (!targetGlobal || !targetGlobal.document) {
      return false;
    }
    if (targetGlobal[INJECTION_KEY]) {
      return true;
    }
    const doc = targetGlobal.document;
    const win = targetGlobal.window || targetGlobal;
    const eventTypes = [
      "play",
      "playing",
      "loadedmetadata",
      "loadeddata",
      "timeupdate",
      "durationchange"
    ];
    const listener = (event) => {
      handleVideoEvent(event, doc, win);
    };
    for (const type of eventTypes) {
      try {
        doc.addEventListener(type, listener, true);
      } catch (_err) {
      }
    }
    initYouTubeObserver(doc, win);
    if (typeof targetGlobal.MutationObserver !== "undefined" && doc.documentElement) {
      try {
        const observer = new targetGlobal.MutationObserver(() => {
          checkAndAccelerateAds(doc, win);
        });
        observer.observe(doc.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "id", "src"]
        });
      } catch (_err) {
      }
    }
    try {
      const existingVideos = doc.querySelectorAll("video");
      existingVideos.forEach((v) => {
        if (isVideoAd(v, doc)) {
          accelerateVideoAd(v, doc, win);
        }
      });
    } catch (_err) {
    }
    try {
      Object.defineProperty(targetGlobal, INJECTION_KEY, {
        value: true,
        writable: false,
        configurable: false,
        enumerable: false
      });
    } catch (_e) {
      targetGlobal[INJECTION_KEY] = true;
    }
    return true;
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      installVideoAdEngine(window);
      console.log("[GhostBlock] Event-Driven Video Ad Accelerator active in MAIN world");
    } catch (err) {
      console.warn("[GhostBlock] Failed to initialize video ad engine:", err);
    }
  }
})();
