/**
 * GhostBlock — Google Publisher Tag (googletag) High-Fidelity Mock Stub
 * Provides full API compatibility and async execution without loading remote ad scripts.
 */
(function() {
  'use strict';

  var root = typeof window !== 'undefined' ? window : globalThis;
  root.googletag = root.googletag || {};
  var googletag = root.googletag;

  // Slot Representation
  function Slot(adUnitPath, size, opt_div) {
    this._adUnitPath = adUnitPath || '';
    this._size = size || [];
    this._elementId = opt_div || (typeof size === 'string' ? size : '');
    this._targeting = {};
    this._services = [];
    this._attributes = {};
    this._categoryExclusions = [];
    this._clickUrl = '';
    this._collapseEmptyDiv = null;
  }

  Slot.prototype.addService = function(service) {
    if (service && this._services.indexOf(service) === -1) {
      this._services.push(service);
    }
    return this;
  };

  Slot.prototype.setTargeting = function(key, value) {
    if (key) {
      this._targeting[key] = Array.isArray(value) ? value.slice() : [value];
    }
    return this;
  };

  Slot.prototype.clearTargeting = function(opt_key) {
    if (opt_key) {
      delete this._targeting[opt_key];
    } else {
      this._targeting = {};
    }
    return this;
  };

  Slot.prototype.getTargeting = function(key) {
    return this._targeting[key] ? this._targeting[key].slice() : [];
  };

  Slot.prototype.getTargetingKeys = function() {
    return Object.keys(this._targeting);
  };

  Slot.prototype.setCollapseEmptyDiv = function(collapse, opt_collapseBeforeFetch) {
    this._collapseEmptyDiv = {
      collapse: !!collapse,
      collapseBeforeFetch: !!opt_collapseBeforeFetch,
    };
    return this;
  };

  Slot.prototype.getCollapseEmptyDiv = function() {
    return this._collapseEmptyDiv;
  };

  Slot.prototype.setCategoryExclusion = function(category) {
    if (category && this._categoryExclusions.indexOf(category) === -1) {
      this._categoryExclusions.push(category);
    }
    return this;
  };

  Slot.prototype.clearCategoryExclusions = function() {
    this._categoryExclusions = [];
    return this;
  };

  Slot.prototype.getCategoryExclusions = function() {
    return this._categoryExclusions.slice();
  };

  Slot.prototype.getAdUnitPath = function() {
    return this._adUnitPath;
  };

  Slot.prototype.getSlotElementId = function() {
    return this._elementId;
  };

  Slot.prototype.getServices = function() {
    return this._services.slice();
  };

  Slot.prototype.setClickUrl = function(url) {
    this._clickUrl = url || '';
    return this;
  };

  Slot.prototype.getClickUrl = function() {
    return this._clickUrl;
  };

  Slot.prototype.setForceSafeFrame = function(_force) {
    return this;
  };

  Slot.prototype.setSafeFrameConfig = function(_config) {
    return this;
  };

  Slot.prototype.updateTargetingFromMap = function(map) {
    if (map && typeof map === 'object') {
      for (var k in map) {
        if (Object.prototype.hasOwnProperty.call(map, k)) {
          this.setTargeting(k, map[k]);
        }
      }
    }
    return this;
  };

  Slot.prototype.defineSizeMapping = function(_mapping) {
    return this;
  };

  Slot.prototype.set = function(name, value) {
    this._attributes[name] = value;
    return this;
  };

  Slot.prototype.get = function(name) {
    return this._attributes[name];
  };

  Slot.prototype.getAttributeKeys = function() {
    return Object.keys(this._attributes);
  };

  // PubAdsService Representation
  function PubAdsService() {
    this._slots = [];
    this._listeners = {};
    this._targeting = {};
    this._categoryExclusions = [];
    this._privacySettings = {};
    this._enabled = false;
  }

  PubAdsService.prototype.enableSingleRequest = function() { return true; };
  PubAdsService.prototype.enableAsyncRendering = function() { return true; };
  PubAdsService.prototype.enableSyncRendering = function() { return true; };
  PubAdsService.prototype.disableInitialLoad = function() { return true; };
  PubAdsService.prototype.collapseEmptyDivs = function(_opt_collapseBeforeFetch) { return true; };

  PubAdsService.prototype.setTargeting = function(key, value) {
    if (key) {
      this._targeting[key] = Array.isArray(value) ? value.slice() : [value];
    }
    return this;
  };

  PubAdsService.prototype.clearTargeting = function(opt_key) {
    if (opt_key) {
      delete this._targeting[opt_key];
    } else {
      this._targeting = {};
    }
    return this;
  };

  PubAdsService.prototype.getTargeting = function(key) {
    return this._targeting[key] ? this._targeting[key].slice() : [];
  };

  PubAdsService.prototype.getTargetingKeys = function() {
    return Object.keys(this._targeting);
  };

  PubAdsService.prototype.setCategoryExclusion = function(category) {
    if (category && this._categoryExclusions.indexOf(category) === -1) {
      this._categoryExclusions.push(category);
    }
    return this;
  };

  PubAdsService.prototype.clearCategoryExclusions = function() {
    this._categoryExclusions = [];
    return this;
  };

  PubAdsService.prototype.getCategoryExclusions = function() {
    return this._categoryExclusions.slice();
  };

  PubAdsService.prototype.setCentering = function(_center) { return this; };
  PubAdsService.prototype.setPublisherProvidedId = function(_ppid) { return this; };
  PubAdsService.prototype.setLocation = function(_loc) { return this; };
  PubAdsService.prototype.setSafeFrameConfig = function(_cfg) { return this; };

  PubAdsService.prototype.setPrivacySettings = function(settings) {
    if (settings && typeof settings === 'object') {
      Object.assign(this._privacySettings, settings);
    }
    return this;
  };

  PubAdsService.prototype.setTagForChildDirectedTreatment = function(_val) { return this; };
  PubAdsService.prototype.setTagForUnderAgeOfConsent = function(_val) { return this; };

  PubAdsService.prototype.addEventListener = function(eventType, listener) {
    if (typeof listener === 'function') {
      if (!this._listeners[eventType]) {
        this._listeners[eventType] = [];
      }
      this._listeners[eventType].push(listener);
    }
    return this;
  };

  PubAdsService.prototype.removeEventListener = function(eventType, listener) {
    if (this._listeners[eventType]) {
      this._listeners[eventType] = this._listeners[eventType].filter(function(l) {
        return l !== listener;
      });
    }
    return this;
  };

  PubAdsService.prototype._fireEvent = function(eventType, eventData) {
    var list = (this._listeners[eventType] || []).slice();
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](eventData);
      } catch (err) {
        console.error('[GhostBlock GPT Mock] Event listener error:', err);
      }
    }
  };

  PubAdsService.prototype.getSlots = function() {
    return this._slots.slice();
  };

  PubAdsService.prototype.clear = function(_opt_slots) { return true; };

  PubAdsService.prototype.refresh = function(opt_slots, _opt_options) {
    var targetSlots = opt_slots || this._slots;
    for (var i = 0; i < targetSlots.length; i++) {
      var slot = targetSlots[i];
      this._fireEvent('slotRenderEnded', {
        slot: slot,
        isEmpty: false,
        size: [300, 250],
        advertiserId: 0,
        campaignId: 0,
        creativeId: 0,
        lineItemId: 0,
        serviceName: 'publisher_ads',
      });
      this._fireEvent('impressionViewable', {
        slot: slot,
        serviceName: 'publisher_ads',
      });
      this._fireEvent('slotOnload', {
        slot: slot,
        serviceName: 'publisher_ads',
      });
    }
    return true;
  };

  PubAdsService.prototype.display = function() { return true; };
  PubAdsService.prototype.getName = function() { return 'publisher_ads'; };
  PubAdsService.prototype.getVersion = function() { return 'mock-ghostblock-1.0'; };

  // CompanionAdsService Representation
  var companionAdsInstance = {
    addEventListener: function() { return this; },
    enableSyncLoading: function() { return this; },
    setRefreshUnfilledSlots: function() { return this; },
  };

  // SizeMappingBuilder Representation
  function createSizeMappingBuilder() {
    var mappings = [];
    return {
      addSize: function(viewportSize, slotSize) {
        mappings.push({ viewportSize: viewportSize, slotSize: slotSize });
        return this;
      },
      build: function() {
        return mappings.slice();
      },
    };
  }

  var pubadsInstance = new PubAdsService();

  // Root googletag Properties and Functions
  googletag.apiReady = true;
  googletag._version_ = 'mock-ghostblock-1.0';
  googletag.getVersion = function() { return 'mock-ghostblock-1.0'; };
  googletag.pubads = function() { return pubadsInstance; };
  googletag.companionAds = function() { return companionAdsInstance; };
  googletag.sizeMapping = function() { return createSizeMappingBuilder(); };

  googletag.defineSlot = function(adUnitPath, size, opt_div) {
    var slot = new Slot(adUnitPath, size, opt_div);
    slot.addService(pubadsInstance);
    pubadsInstance._slots.push(slot);
    return slot;
  };

  googletag.defineOutOfPageSlot = function(adUnitPath, opt_div) {
    var slot = new Slot(adUnitPath, [1, 1], opt_div);
    slot.addService(pubadsInstance);
    pubadsInstance._slots.push(slot);
    return slot;
  };

  googletag.defineUnit = function(adUnitPath, size, opt_div) {
    return googletag.defineSlot(adUnitPath, size, opt_div);
  };

  googletag.destroySlots = function(opt_slots) {
    if (opt_slots && Array.isArray(opt_slots)) {
      pubadsInstance._slots = pubadsInstance._slots.filter(function(s) {
        return opt_slots.indexOf(s) === -1;
      });
    } else {
      pubadsInstance._slots = [];
    }
    return true;
  };

  googletag.enableServices = function() {
    pubadsInstance._enabled = true;
    return true;
  };

  googletag.display = function(divOrSlot) {
    var slot = null;
    if (typeof divOrSlot === 'string') {
      for (var i = 0; i < pubadsInstance._slots.length; i++) {
        if (pubadsInstance._slots[i].getSlotElementId() === divOrSlot) {
          slot = pubadsInstance._slots[i];
          break;
        }
      }
    } else if (divOrSlot && typeof divOrSlot.getSlotElementId === 'function') {
      slot = divOrSlot;
    }

    if (slot) {
      pubadsInstance._fireEvent('slotRenderEnded', {
        slot: slot,
        isEmpty: false,
        size: [300, 250],
        advertiserId: 0,
        campaignId: 0,
        creativeId: 0,
        lineItemId: 0,
        serviceName: 'publisher_ads',
      });
      pubadsInstance._fireEvent('impressionViewable', {
        slot: slot,
        serviceName: 'publisher_ads',
      });
    }
    return true;
  };

  googletag.openConsole = function() {};

  // Async Command Queue Processor via queueMicrotask
  function executeCommand(fn) {
    if (typeof fn !== 'function') return;
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(function() {
        try {
          fn();
        } catch (err) {
          console.error('[GhostBlock GPT Mock] Error in cmd callback:', err);
        }
      });
    } else {
      setTimeout(function() {
        try {
          fn();
        } catch (err) {
          console.error('[GhostBlock GPT Mock] Error in cmd callback:', err);
        }
      }, 0);
    }
  }

  // Preserve pre-existing commands in cmd array
  var preExistingCmds = googletag.cmd || [];

  // Override cmd with Array-compatible object that intercepts push
  var cmdQueue = [];
  cmdQueue.push = function() {
    for (var i = 0; i < arguments.length; i++) {
      executeCommand(arguments[i]);
    }
    return arguments.length;
  };

  googletag.cmd = cmdQueue;

  // Drain any callbacks queued before this mock script loaded
  if (Array.isArray(preExistingCmds)) {
    for (var j = 0; j < preExistingCmds.length; j++) {
      executeCommand(preExistingCmds[j]);
    }
  }
})();
