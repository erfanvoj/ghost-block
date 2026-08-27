/**
 * GhostBlock — Prebid.js (pbjs) High-Fidelity Mock Stub
 * Provides full API compatibility for header bidding wrappers and async command execution.
 */
(function() {
  'use strict';

  var root = typeof window !== 'undefined' ? window : globalThis;
  root.pbjs = root.pbjs || {};
  var pbjs = root.pbjs;

  var adUnits = [];
  var eventHandlers = {};
  var pbjsConfig = {};

  function executeQueued(fn) {
    if (typeof fn !== 'function') return;
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(function() {
        try {
          fn();
        } catch (err) {
          console.error('[GhostBlock Prebid Mock] Error in que callback:', err);
        }
      });
    } else {
      setTimeout(function() {
        try {
          fn();
        } catch (err) {
          console.error('[GhostBlock Prebid Mock] Error in que callback:', err);
        }
      }, 0);
    }
  }

  pbjs.libLoaded = true;
  pbjs.version = 'v8.0.0-mock';
  pbjs.adUnits = adUnits;

  pbjs.addAdUnits = function(units) {
    if (Array.isArray(units)) {
      adUnits.push.apply(adUnits, units);
    } else if (units) {
      adUnits.push(units);
    }
    return adUnits;
  };

  pbjs.removeAdUnit = function(adUnitCode) {
    for (var i = adUnits.length - 1; i >= 0; i--) {
      if (adUnits[i].code === adUnitCode) {
        adUnits.splice(i, 1);
      }
    }
    return adUnits;
  };

  pbjs.requestBids = function(requestObj) {
    requestObj = requestObj || {};
    var callback = requestObj.bidsBackHandler;
    if (typeof callback === 'function') {
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(function() {
          try {
            callback({});
          } catch (err) {
            console.error('[GhostBlock Prebid Mock] Error in bidsBackHandler:', err);
          }
        });
      } else {
        setTimeout(function() {
          try {
            callback({});
          } catch (err) {
            console.error('[GhostBlock Prebid Mock] Error in bidsBackHandler:', err);
          }
        }, 0);
      }
    }
  };

  pbjs.setTargetingForGPTAsync = function(_opt_slots) {
    return true;
  };

  pbjs.getAdserverTargeting = function(_opt_adunit) {
    return {};
  };

  pbjs.getHighestCpmBids = function(_opt_adunit) {
    return [];
  };

  pbjs.onEvent = function(event, handler) {
    if (typeof handler === 'function') {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    }
  };

  pbjs.offEvent = function(event, handler) {
    if (eventHandlers[event]) {
      eventHandlers[event] = eventHandlers[event].filter(function(h) {
        return h !== handler;
      });
    }
  };

  pbjs.emit = function(event, data) {
    var handlers = (eventHandlers[event] || []).slice();
    for (var i = 0; i < handlers.length; i++) {
      try {
        handlers[i](data);
      } catch (err) {
        console.error('[GhostBlock Prebid Mock] Event handler error:', err);
      }
    }
  };

  pbjs.setConfig = function(config) {
    if (config && typeof config === 'object') {
      Object.assign(pbjsConfig, config);
    }
    return pbjsConfig;
  };

  pbjs.getConfig = function(key) {
    return key ? pbjsConfig[key] : pbjsConfig;
  };

  pbjs.enableAnalytics = function(_config) {
    return true;
  };

  pbjs.aliasBidder = function(_bidder, _alias) {
    return true;
  };

  var preExistingQue = (pbjs.que && Array.isArray(pbjs.que)) ? pbjs.que : [];

  var queProxy = [];
  queProxy.push = function() {
    for (var i = 0; i < arguments.length; i++) {
      executeQueued(arguments[i]);
    }
    return arguments.length;
  };

  pbjs.que = queProxy;

  // Drain existing que callbacks
  for (var j = 0; j < preExistingQue.length; j++) {
    executeQueued(preExistingQue[j]);
  }
})();
