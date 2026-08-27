/**
 * GhostBlock — Event-Driven HTML5 & YouTube Video Ad Accelerator
 *
 * Injected in the MAIN world to directly access and accelerate HTML5 <video>
 * streams and player engines (YouTube, Vimeo, generic HTML5 VAST/VPAID players).
 *
 * Performance Characteristics:
 * - 0ms polling loops: entirely event-driven via capturing listeners
 *   ('play', 'loadedmetadata', 'timeupdate', 'playing', 'ratechange').
 * - Dedicated YouTube observer with strict #movie_player ad validation.
 * - Tracks user-selected playback rate and cleanly restores it upon ad completion.
 * - Accelerates ad streams to 16.0x playback rate.
 * - Mutes audio during ad playback to prevent audio burst artifacts.
 * - Immediately jumps video.currentTime to video.duration when finite and <= 180s.
 * - Auto-triggers skip buttons (.ytp-ad-skip-button, .ytp-ad-skip-button-modern, etc.).
 * - Transmits telemetry events across realms to the content script coordinator.
 */

import { GHOST_EVENTS, ESTIMATED_BYTES } from '../utils/constants';

// Known video ad container class and ID selectors
export const VIDEO_AD_CONTAINER_SELECTORS = [
  '.ad-showing',
  '.ad-interrupting',
  '.video-ads',
  '.ytp-ad-player-overlay',
  '#movie_player.ad-showing',
  '#movie_player.ad-interrupting',
  'ytd-ad-slot-renderer',
  'ytd-banner-promo-renderer',
  'ytd-in-feed-ad-layout-renderer',
  '.mgp_adActive',
  '.mgp_preroll',
  '[class*="preroll"]',
  '.vast-block',
  '.vast-ad',
  '[class*="video-ad-overlay"]',
  '.ad-container',
  '.ytp-ad-module',
  '.ytp-ad-text',
  '.vjs-ad-playing',
  '.vjs-ad-loading',
  '.ima-ad-container',
  '.jw-flag-ads',
  '[class*="ad-showing"]',
  '[class*="ad-display"]',
  '[class*="ad-interrupt"]',
  '[class*="ad-playing"]',
];

// Known ad skip button selectors
export const SKIP_BUTTON_SELECTORS = [
  '.ytp-ad-skip-button',
  '.ytp-ad-skip-button-modern',
  '.ytp-skip-ad-button',
  '.ytp-ad-overlay-close-button',
  '.ytp-ad-skip-button-slot',
  '[class*="skip-button"]',
  '[id*="skip-ad"]',
  '.mgp_adSkipButton',
  '.ad-skip-btn',
  '.ytp-ad-text',
  '.videoAdUiSkipButton',
  '.videoAdUiAction',
  'button[class*="skip-button"]',
  'button[id*="skip-button"]',
  '[aria-label*="Skip Ad"]',
  '[aria-label*="skip ad" i]',
  'button.ytp-ad-skip-button-icon',
];

// Visual ad overlay selectors
export const AD_OVERLAY_SELECTORS = [
  '.ytp-ad-overlay-container',
  '#player-ads',
  'ytd-ad-slot-renderer',
  'ytd-banner-promo-renderer',
  'ytd-in-feed-ad-layout-renderer',
  '.ytp-ad-player-overlay',
  '.ytp-ad-image-overlay',
  '.ytp-ad-overlay-image',
  '.mgp_preroll',
  '.mgp_adActive',
  '.vast-ad',
  '.vast-block',
  '[class*="video-ad-overlay"]',
];

// Ad URL / source heuristics targeting verified ad providers
export const AD_URL_PATTERNS = [
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
  /[?&]adunit=/i,
];

// Protected main video selectors (never accelerate or jump currentTime)
export const PROTECTED_MAIN_VIDEO_SELECTORS = [
  '#player video',
  '.mgp_videoContainer video',
  '#main-video',
  'video#main-video',
];

/**
 * Determine whether a video element is a protected main player video that should never be fast-forwarded
 */
export function isProtectedMainVideo(video: HTMLVideoElement): boolean {
  if (!video || video.nodeType !== 1) return false;

  try {
    // If video is inside an explicit ad container, it's an ad, not a protected main video
    if (typeof video.closest === 'function') {
      if (
        video.closest('#ad-container') ||
        video.closest('.ad-video-wrapper') ||
        video.closest('.mgp_adActive') ||
        video.closest('.vast-ad') ||
        video.closest('.vast-block') ||
        video.closest('.video-ads') ||
        video.closest('.ima-ad-container')
      ) {
        return false;
      }
    }

    const id = (typeof video.id === 'string' ? video.id : '').toLowerCase();
    const className = typeof video.className === 'string' ? video.className : '';

    if (id === 'main-video' || className.includes('main-video')) {
      // If it's YouTube main video, handled via YouTube observer
      if (className.includes('html5-main-video')) {
        return false;
      }
      return true;
    }

    if (typeof video.closest === 'function') {
      if (
        video.closest('#player') ||
        video.closest('.mgp_videoContainer') ||
        video.closest('#main-video')
      ) {
        return true;
      }
    }

    if (typeof video.matches === 'function') {
      for (const selector of PROTECTED_MAIN_VIDEO_SELECTORS) {
        try {
          if (video.matches(selector)) {
            return true;
          }
        } catch (_e) {}
      }
    }
  } catch (_err) {
    // Fail-safe
  }

  return false;
}

// Global injection flag
const INJECTION_KEY = '__GHOSTBLOCK_VIDEO_AD_ENGINE_INSTALLED__';

// Track accelerated video sessions to prevent duplicate telemetry emissions
const processedAdSources = new Set<string>();
const acceleratedVideos = new WeakSet<HTMLVideoElement>();
const originalVideoStates = new WeakMap<
  HTMLVideoElement,
  { originalMuted: boolean; originalRate: number }
>();

// ==========================================
// Dedicated YouTube Observer State & Logic
// ==========================================

export interface YouTubeEngineState {
  isAdPlaying: boolean;
  userPlaybackRate: number;
  userMuted: boolean;
}

const youTubeState: YouTubeEngineState = {
  isAdPlaying: false,
  userPlaybackRate: 1.0,
  userMuted: false,
};

/**
 * Get the current internal YouTube observer state (useful for testing)
 */
export function getYouTubeState(): Readonly<YouTubeEngineState> {
  return youTubeState;
}

/**
 * Reset YouTube observer state (useful for testing)
 */
export function resetYouTubeState(): void {
  youTubeState.isAdPlaying = false;
  youTubeState.userPlaybackRate = 1.0;
  youTubeState.userMuted = false;
}

/**
 * Check if the movie_player container currently has active ad classes
 */
export function isYouTubeAdShowing(
  moviePlayer: Element | null,
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any)
): boolean {
  const player = moviePlayer || (rootDoc && typeof rootDoc.querySelector === 'function' ? rootDoc.querySelector('#movie_player') : null);
  if (!player) return false;

  if (player.classList && typeof player.classList.contains === 'function') {
    return player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
  }

  const className = (player as any).className || '';
  if (typeof className === 'string') {
    return className.includes('ad-showing') || className.includes('ad-interrupting');
  }

  return false;
}

/**
 * YouTube-specific ad acceleration cycle
 */
export function handleYouTubeAdTransition(
  moviePlayer: Element | null,
  video: HTMLVideoElement | null,
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any),
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): void {
  if (!moviePlayer && !video) return;

  const player = moviePlayer || (rootDoc && typeof rootDoc.querySelector === 'function' ? rootDoc.querySelector('#movie_player') : null);
  const videoEl = video || (player && typeof player.querySelector === 'function' ? player.querySelector('video') : null) || (rootDoc && typeof rootDoc.querySelector === 'function' ? rootDoc.querySelector('#movie_player video, video.html5-main-video') : null);

  const adShowing = isYouTubeAdShowing(player, rootDoc);

  if (adShowing) {
    // 1. Enter Ad State
    if (!youTubeState.isAdPlaying && videoEl) {
      youTubeState.isAdPlaying = true;
      // Record user's playback rate before accelerating
      if (videoEl.playbackRate > 0 && videoEl.playbackRate !== 16.0) {
        youTubeState.userPlaybackRate = videoEl.playbackRate;
      }
      youTubeState.userMuted = videoEl.muted;
    }

    if (videoEl) {
      // Mute ad
      if (!videoEl.muted) {
        videoEl.muted = true;
      }
      // Accelerate to 16x
      if (videoEl.playbackRate !== 16.0) {
        try {
          videoEl.playbackRate = 16.0;
        } catch (_e) {
          // Browser clamp fallback
        }
      }
      // Fast-forward duration guard <= 180s
      if (isFinite(videoEl.duration) && videoEl.duration > 0 && videoEl.duration <= 180) {
        const targetTime = Math.max(0, videoEl.duration - 0.1);
        if (videoEl.currentTime < targetTime) {
          try {
            videoEl.currentTime = targetTime;
          } catch (_e) {
            // Seek blocked fallback
          }
        }
      }
      acceleratedVideos.add(videoEl);
      notifyVideoAdSkipped(videoEl, targetWindow);
    }

    // Auto-click skip buttons
    triggerSkipButtons(rootDoc);
    // Suppress ad overlays
    suppressAdOverlays(rootDoc);
  } else {
    // 2. Exit Ad State & Restore User Settings
    if (youTubeState.isAdPlaying) {
      youTubeState.isAdPlaying = false;
      if (videoEl) {
        // Immediately restore user playback rate
        videoEl.playbackRate = youTubeState.userPlaybackRate || 1.0;
        // Unmute if user was not muted before the ad
        if (!youTubeState.userMuted) {
          videoEl.muted = false;
        }
        acceleratedVideos.delete(videoEl);
      }
    }
  }
}

/**
 * Dedicated observer for YouTube isolated from generic HTML5 handling
 */
export function initYouTubeObserver(
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any),
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): (() => void) | null {
  if (!rootDoc) return null;

  const MutationObserverClass =
    (targetWindow && (targetWindow as any).MutationObserver) ||
    (typeof MutationObserver !== 'undefined' ? MutationObserver : null);

  if (!MutationObserverClass) return null;

  // Track rate change on YouTube video element when ads are not playing
  const handleRateChange = (e: Event) => {
    const video = e.target as HTMLVideoElement;
    if (video && !youTubeState.isAdPlaying) {
      if (video.playbackRate > 0 && video.playbackRate !== 16.0) {
        youTubeState.userPlaybackRate = video.playbackRate;
      }
    }
  };

  const handleVolumeChange = (e: Event) => {
    const video = e.target as HTMLVideoElement;
    if (video && !youTubeState.isAdPlaying) {
      youTubeState.userMuted = video.muted;
    }
  };

  try {
    rootDoc.addEventListener('ratechange', handleRateChange, true);
    rootDoc.addEventListener('volumechange', handleVolumeChange, true);
  } catch (_e) {
    // Fail-safe
  }

  let observer: MutationObserver | null = null;

  try {
    observer = new MutationObserver((mutations) => {
      let checkNeeded = false;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'attributes') {
          const target = m.target as HTMLElement;
          if (
            target &&
            (target.id === 'movie_player' ||
              target.classList?.contains('html5-video-player') ||
              target.classList?.contains('ad-showing') ||
              target.classList?.contains('ad-interrupting'))
          ) {
            checkNeeded = true;
            break;
          }
        } else if (m.type === 'childList') {
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
      attributeFilter: ['class', 'id', 'src'],
    });

    // Immediate check on initialization
    handleYouTubeAdTransition(null, null, rootDoc, targetWindow);
  } catch (_err) {
    // Fail-safe
  }

  return () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    try {
      rootDoc.removeEventListener('ratechange', handleRateChange, true);
      rootDoc.removeEventListener('volumechange', handleVolumeChange, true);
    } catch (_e) {
      // Fail-safe
    }
  };
}

// ==========================================
// Generic HTML5 Video Ad Acceleration
// ==========================================

/**
 * Determine whether a given HTMLVideoElement is currently playing a verified ad
 */
export function isVideoAd(
  video: HTMLVideoElement,
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any)
): boolean {
  if (!video || video.nodeType !== 1) {
    return false;
  }

  // Strict Protection: Never treat main video elements as ads
  if (isProtectedMainVideo(video)) {
    return false;
  }

  try {
    // 1. Check if video element is explicitly contained within a known ad slot
    if (typeof video.closest === 'function') {
      for (const selector of VIDEO_AD_CONTAINER_SELECTORS) {
        if (video.closest(selector)) {
          return true;
        }
      }
    }

    // 2. Check video src & currentSrc heuristics for verified ad providers
    const src = (video.currentSrc || video.src || (video.getAttribute && video.getAttribute('src')) || '').toLowerCase();
    if (src) {
      for (const pattern of AD_URL_PATTERNS) {
        if (pattern.test(src)) {
          return true;
        }
      }
    }

    // 3. Check document-level active YouTube / VAST ad overlay markers in the player realm
    if (rootDoc && typeof rootDoc.querySelector === 'function') {
      if (
        rootDoc.querySelector('#movie_player.ad-showing') ||
        rootDoc.querySelector('#movie_player.ad-interrupting') ||
        rootDoc.querySelector('.ytp-ad-player-overlay') ||
        rootDoc.querySelector('.ytp-ad-showing')
      ) {
        return true;
      }
    }
  } catch (_err) {
    // Defensive fail-safe
  }

  return false;
}

/**
 * Click any visible ad skip buttons with multi-event dispatch
 */
export function triggerSkipButtons(
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any)
): boolean {
  if (!rootDoc || typeof rootDoc.querySelectorAll !== 'function') return false;

  let clicked = false;
  try {
    const win = rootDoc.defaultView || (typeof window !== 'undefined' ? window : globalThis);
    for (const selector of SKIP_BUTTON_SELECTORS) {
      const buttons = rootDoc.querySelectorAll<HTMLElement>(selector);
      buttons.forEach((btn) => {
        if (typeof btn.click === 'function') {
          btn.click();
          clicked = true;
        }
        try {
          if (typeof MouseEvent !== 'undefined') {
            btn.dispatchEvent(
              new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: win as unknown as Window,
              })
            );
            clicked = true;
          }
        } catch (_err) {
          // Ignore event dispatch errors
        }
      });
    }
  } catch (_err) {
    // Fail-safe
  }
  return clicked;
}

/**
 * Suppress visual ad overlays
 */
export function suppressAdOverlays(
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any)
): boolean {
  if (!rootDoc || typeof rootDoc.querySelectorAll !== 'function') return false;

  let suppressed = false;
  try {
    for (const selector of AD_OVERLAY_SELECTORS) {
      const overlays = rootDoc.querySelectorAll<HTMLElement>(selector);
      overlays.forEach((el) => {
        if (el && el.style) {
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.style.setProperty('height', '0', 'important');
          el.style.setProperty('overflow', 'hidden', 'important');
          suppressed = true;
        }
      });
    }
  } catch (_err) {
    // Fail-safe
  }
  return suppressed;
}

/**
 * Dispatch cross-realm custom event to notify content script of accelerated video ad
 */
export function notifyVideoAdSkipped(
  video: HTMLVideoElement,
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): void {
  const currentSrc = video.currentSrc || video.src || 'html5-video-ad-stream';
  const duration = isFinite(video.duration) ? video.duration : 0;
  const sessionKey = `${currentSrc}_${Math.round(duration)}`;

  if (processedAdSources.has(sessionKey)) {
    return;
  }
  processedAdSources.add(sessionKey);

  // Clean old entries if set grows too large
  if (processedAdSources.size > 200) {
    const iter = processedAdSources.values();
    for (let i = 0; i < 50; i++) {
      processedAdSources.delete(iter.next().value!);
    }
  }

  try {
    if (targetWindow && typeof targetWindow.dispatchEvent === 'function') {
      const event = new CustomEvent(GHOST_EVENTS.VIDEO_AD_DETECTED, {
        detail: {
          videoAdsSkipped: 1,
          bytesSaved: ESTIMATED_BYTES.AD_VIDEO_STREAM,
          type: 'video_ad_accelerated',
          src: currentSrc,
          duration: duration,
          timestamp: Date.now(),
        },
      });
      targetWindow.dispatchEvent(event);
    }
  } catch (_err) {
    // Fail-safe
  }
}

/**
 * Accelerate a detected ad video stream:
 * 1. Record original state (rate, muted)
 * 2. Mute audio
 * 3. Set playbackRate to 16x
 * 4. Jump currentTime to duration - 0.1 ONLY if duration <= 180s (safety guard for main videos)
 * 5. Trigger skip buttons (native + synthetic MouseEvent)
 * 6. Suppress visual overlays
 * 7. Mark as accelerated and emit telemetry
 */
export function accelerateVideoAd(
  video: HTMLVideoElement,
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any),
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): boolean {
  if (!video) return false;

  // Strict Protection: Never modify currentTime or playbackRate on protected main videos!
  if (isProtectedMainVideo(video)) {
    return false;
  }

  try {
    // Record original state before accelerating if not already saved
    if (!originalVideoStates.has(video)) {
      originalVideoStates.set(video, {
        originalMuted: video.muted,
        originalRate: video.playbackRate === 16 ? 1.0 : video.playbackRate || 1.0,
      });
    }

    // 1. Mute ad audio
    if (!video.muted) {
      video.muted = true;
    }

    // 2. Maximize playback acceleration to 16.0x
    if (video.playbackRate !== 16.0) {
      try {
        video.playbackRate = 16.0;
      } catch (_e) {
        // Some browser limits cap playbackRate
      }
    }

    // 3. Safety Duration Guard:
    // Only seek to completion if duration is valid and <= 180s (ads are never > 3 minutes).
    // If duration > 180s (long video / full movie / streaming), DO NOT seek (prevents skipping main content).
    if (isFinite(video.duration) && video.duration > 0 && video.duration <= 180) {
      const targetTime = Math.max(0, video.duration - 0.1);
      if (video.currentTime < targetTime) {
        try {
          video.currentTime = targetTime;
        } catch (_e) {
          // If seeking is blocked, 16x speed will complete it quickly
        }
      }
    }

    // 4. Click any active skip buttons
    triggerSkipButtons(rootDoc);

    // 5. Suppress visual ad overlays
    suppressAdOverlays(rootDoc);

    // 6. Mark as accelerated and emit telemetry
    acceleratedVideos.add(video);
    notifyVideoAdSkipped(video, targetWindow);

    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Restore normal playback parameters when regular content resumes
 */
export function restoreNormalVideo(video: HTMLVideoElement): void {
  if (!video || !acceleratedVideos.has(video)) return;

  try {
    const saved = originalVideoStates.get(video);
    if (video.playbackRate === 16.0) {
      video.playbackRate = saved ? saved.originalRate : 1.0;
    }
    if (saved && !saved.originalMuted && video.muted) {
      video.muted = false;
    }
    acceleratedVideos.delete(video);
    originalVideoStates.delete(video);
  } catch (_err) {
    // Fail-safe
  }
}

/**
 * Check if the document currently contains an active ad player state,
 * accelerate any active video ads, and click skip buttons.
 */
export function checkAndAccelerateAds(
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any),
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): void {
  if (!rootDoc) return;

  try {
    // If running on YouTube, let dedicated observer handle YouTube player
    if (rootDoc.querySelector && rootDoc.querySelector('#movie_player')) {
      handleYouTubeAdTransition(null, null, rootDoc, targetWindow);
      return;
    }

    // 1. Check if document has active ad overlay markers
    let adDetected = false;
    if (typeof rootDoc.querySelector === 'function') {
      if (
        rootDoc.querySelector('#movie_player.ad-showing') ||
        rootDoc.querySelector('#movie_player.ad-interrupting') ||
        rootDoc.querySelector('.ytp-ad-player-overlay') ||
        rootDoc.querySelector('.ad-showing') ||
        rootDoc.querySelector('.ad-interrupting')
      ) {
        adDetected = true;
      }
    }

    // 2. Check all video elements individually
    if (typeof rootDoc.querySelectorAll === 'function') {
      const videos = rootDoc.querySelectorAll<HTMLVideoElement>('video');
      videos.forEach((video) => {
        if (adDetected || isVideoAd(video, rootDoc)) {
          accelerateVideoAd(video, rootDoc, targetWindow);
        } else if (acceleratedVideos.has(video)) {
          restoreNormalVideo(video);
        }
      });
    }

    // 3. Click skip buttons and suppress overlays if present
    triggerSkipButtons(rootDoc);
    suppressAdOverlays(rootDoc);
  } catch (_err) {
    // Defensive fail-safe
  }
}

/**
 * Robustly check if a node is an HTML5 video element across frames and node environments
 */
export function isVideoElement(target: unknown): target is HTMLVideoElement {
  if (!target || typeof target !== 'object') return false;
  if (typeof HTMLVideoElement !== 'undefined' && target instanceof HTMLVideoElement) return true;
  const el = target as { nodeType?: number; tagName?: string };
  return el.nodeType === 1 && typeof el.tagName === 'string' && el.tagName.toUpperCase() === 'VIDEO';
}

/**
 * Master handler for video element events
 */
export function handleVideoEvent(
  event: Event,
  rootDoc: Document = typeof document !== 'undefined' ? document : ({} as any),
  targetWindow: Window = typeof window !== 'undefined' ? window : ({} as any)
): void {
  const target = event.target;
  if (!isVideoElement(target)) {
    return;
  }

  const video = target as HTMLVideoElement;

  // On YouTube, let dedicated observer handle YouTube player
  if (rootDoc.querySelector && rootDoc.querySelector('#movie_player')) {
    handleYouTubeAdTransition(null, video, rootDoc, targetWindow);
    return;
  }

  if (isVideoAd(video, rootDoc)) {
    accelerateVideoAd(video, rootDoc, targetWindow);
  } else if (acceleratedVideos.has(video)) {
    // Video was accelerated during an ad, but ad indicators are now gone (main video resumed)
    restoreNormalVideo(video);
  }
}

/**
 * Install capturing event listeners, YouTube observer, and MutationObserver on the document/window
 */
export function installVideoAdEngine(
  targetGlobal: any = globalThis
): boolean {
  if (!targetGlobal || !targetGlobal.document) {
    return false;
  }

  // Prevent multiple registrations
  if (targetGlobal[INJECTION_KEY]) {
    return true;
  }

  const doc: Document = targetGlobal.document;
  const win: Window = targetGlobal.window || targetGlobal;

  const eventTypes = [
    'play',
    'playing',
    'loadedmetadata',
    'loadeddata',
    'timeupdate',
    'durationchange',
  ] as const;

  const listener = (event: Event) => {
    handleVideoEvent(event, doc, win);
  };

  // Attach capture-phase listeners to intercept before page stops propagation
  for (const type of eventTypes) {
    try {
      doc.addEventListener(type, listener, true);
    } catch (_err) {
      // Fail-safe
    }
  }

  // Initialize dedicated YouTube observer
  initYouTubeObserver(doc, win);

  // Continuous MutationObserver for generic SPA navigation and dynamic ad insertion
  if (typeof targetGlobal.MutationObserver !== 'undefined' && doc.documentElement) {
    try {
      const observer = new targetGlobal.MutationObserver(() => {
        checkAndAccelerateAds(doc, win);
      });
      observer.observe(doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'id', 'src'],
      });
    } catch (_err) {
      // Fail-safe
    }
  }

  // Check any video elements already present in DOM on load
  try {
    const existingVideos = doc.querySelectorAll<HTMLVideoElement>('video');
    existingVideos.forEach((v) => {
      if (isVideoAd(v, doc)) {
        accelerateVideoAd(v, doc, win);
      }
    });
  } catch (_err) {
    // Fail-safe
  }

  try {
    Object.defineProperty(targetGlobal, INJECTION_KEY, {
      value: true,
      writable: false,
      configurable: false,
      enumerable: false,
    });
  } catch (_e) {
    targetGlobal[INJECTION_KEY] = true;
  }

  return true;
}

// Auto-execute when injected into the browser MAIN world
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    installVideoAdEngine(window);
    console.log('[GhostBlock] Event-Driven Video Ad Accelerator active in MAIN world');
  } catch (err) {
    console.warn('[GhostBlock] Failed to initialize video ad engine:', err);
  }
}
