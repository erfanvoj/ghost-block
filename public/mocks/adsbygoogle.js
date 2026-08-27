/**
 * GhostBlock — Google AdSense (adsbygoogle) High-Fidelity Mock Stub
 * Absorbs ad pushes silently, sets container status attributes, and prevents anti-adblock honeypot triggers.
 */
(function() {
  'use strict';

  var root = typeof window !== 'undefined' ? window : globalThis;
  var existingQueue = root.adsbygoogle || [];

  function processAdSlot(param) {
    try {
      if (typeof document !== 'undefined') {
        // Tag unhandled AdSense ins elements to simulate successful ad placement
        var insElements = document.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])');
        for (var i = 0; i < insElements.length; i++) {
          var el = insElements[i];
          el.setAttribute('data-adsbygoogle-status', 'done');
          el.setAttribute('data-ad-status', 'filled');
        }
      }
    } catch (_e) {
      // Intentionally silent
    }
  }

  // Create an array that inherits native array methods but intercepts push
  var adsbygoogleProxy = [];

  adsbygoogleProxy.push = function() {
    for (var i = 0; i < arguments.length; i++) {
      processAdSlot(arguments[i]);
      Array.prototype.push.call(this, arguments[i]);
    }
    return this.length;
  };

  adsbygoogleProxy.loaded = true;
  adsbygoogleProxy._version = 'mock-ghostblock-1.0';

  // Process any pushes that were queued prior to mock script evaluation
  if (Array.isArray(existingQueue)) {
    for (var j = 0; j < existingQueue.length; j++) {
      adsbygoogleProxy.push(existingQueue[j]);
    }
  }

  root.adsbygoogle = adsbygoogleProxy;
})();
