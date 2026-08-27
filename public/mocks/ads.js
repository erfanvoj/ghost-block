/**
 * GhostBlock — Generic Bait Script Mock Stub (ads.js / advertisement.js / show_ads.js / adframe.js)
 * Defuses global variable anti-adblock checks and probe flags.
 */
(function() {
  'use strict';

  var root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);

  try {
    root.canRunAds = true;
    root.isAdBlockActive = false;
    root.adblock = false;
    root.adBlocker = false;
    root.ynLoaded = true;
    root.advertisementLoaded = true;
    root.google_ad_status = 1;
  } catch (_e) {
    // Fail-safe
  }
})();
