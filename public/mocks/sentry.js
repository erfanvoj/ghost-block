/**
 * GhostBlock — Sentry Error Monitoring High-Fidelity Mock Stub
 * Absorbs error reports and tracking calls silently to prevent adblock test leaks.
 */
(function() {
  'use strict';

  var root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  var noop = function() {};

  var scopeObj = {
    setTag: noop,
    setTags: noop,
    setExtra: noop,
    setExtras: noop,
    setUser: noop,
    setContext: noop,
    setLevel: noop,
    addBreadcrumb: noop,
    clear: noop,
  };

  root.Sentry = {
    init: noop,
    captureException: noop,
    captureMessage: noop,
    setUser: noop,
    setTag: noop,
    setTags: noop,
    setExtra: noop,
    setExtras: noop,
    setContext: noop,
    addBreadcrumb: noop,
    configureScope: function(cb) {
      if (typeof cb === 'function') {
        cb(scopeObj);
      }
    },
    withScope: function(cb) {
      if (typeof cb === 'function') {
        cb(scopeObj);
      }
    },
    onLoad: function(cb) {
      if (typeof cb === 'function') {
        cb();
      }
    },
    showReportDialog: noop,
    lastEventId: function() { return ''; },
    Hub: function() {
      return {
        bindClient: noop,
        getClient: function() { return null; },
        getScope: function() { return null; },
        captureException: noop,
        captureMessage: noop,
      };
    },
    getCurrentHub: function() {
      return {
        bindClient: noop,
        getClient: function() { return null; },
        getScope: function() { return null; },
        captureException: noop,
        captureMessage: noop,
      };
    },
    Integrations: {},
    BrowserTracing: function() { return {}; },
    Replay: function() { return {}; },
    _version: 'mock-ghostblock-1.0',
    SDK_VERSION: '7.0.0',
  };
})();
