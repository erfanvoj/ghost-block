(function() {
  "use strict";
  const HONEYPOT_CLASSES = /* @__PURE__ */ new Set([
    "pub_300x250",
    "pub_300x250m",
    "pub_728x90",
    "pub_300x600",
    "pub_160x600",
    "pub_970x250",
    "pub_320x50",
    "text-ad",
    "textAd",
    "text_ad",
    "ad-banner",
    "ad_banner",
    "ad-slot",
    "ad_slot",
    "ad-header",
    "google_ads_iframe",
    "adsbox",
    "ad-placement",
    "ad-wrapper",
    "ad-zone"
  ]);
  const HONEYPOT_IDS = /* @__PURE__ */ new Set([
    "ad-unit",
    "ad-container",
    "ad-leaderboard",
    "ad_top",
    "ad_bottom",
    "google_ads_div",
    "div-gpt-ad"
  ]);
  const COMMON_BAIT_PATTERN = /adsbox|ad-zone|ad_zone|ad-banner|ad_banner|pub_300|banner-ad|banner_ad|ad-slot|ad_slot|ad-placement|ad-wrapper|ad-header|ad-unit|ad-container/i;
  const DEFAULT_BAIT_DIMENSIONS = {
    width: 300,
    height: 250
  };
  const KNOWN_BAIT_DIMENSIONS = {
    "pub_300x250": { width: 300, height: 250 },
    "pub_300x250m": { width: 300, height: 250 },
    "pub_728x90": { width: 728, height: 90 },
    "pub_300x600": { width: 300, height: 600 },
    "pub_160x600": { width: 160, height: 600 },
    "pub_970x250": { width: 970, height: 250 },
    "pub_320x50": { width: 320, height: 50 },
    "ad-leaderboard": { width: 728, height: 90 },
    "ad_leaderboard": { width: 728, height: 90 },
    "ad-header": { width: 728, height: 90 },
    "ad_top": { width: 728, height: 90 }
  };
  const BAIT_DIMENSION_REGEX = /(?:pub_|^|[\s_-])(\d{2,4})[xX_×](\d{2,4})(?:m|$|[\s_-])/;
  const HONEYPOT_ATTRIBUTES = [
    "data-ad",
    "data-ad-slot",
    "data-ad-client",
    "data-ad-format",
    "data-ad-unit",
    "data-ad-layout"
  ];
  const GHOST_EVENTS = {
    TELEMETRY_INCREMENT: "ghostblock:telemetry_increment",
    VIDEO_AD_DETECTED: "ghostblock:video_ad_detected",
    MODAL_DEFUSED: "ghostblock:modal_defused"
  };
  const nativeFunctionStrings = /* @__PURE__ */ new WeakMap();
  const reportedBaitElements = /* @__PURE__ */ new WeakSet();
  const INJECTION_KEY = "__GHOSTBLOCK_GEOMETRY_SPOOFER_INSTALLED__";
  function registerNativeString(fn, nativeString) {
    nativeFunctionStrings.set(fn, nativeString);
  }
  function installAntiFingerprintToString(targetGlobal = globalThis) {
    if (!targetGlobal || !targetGlobal.Function || !targetGlobal.Function.prototype) {
      return false;
    }
    const originalToString = targetGlobal.Function.prototype.toString;
    if (nativeFunctionStrings.has(originalToString)) {
      return true;
    }
    const patchedToString = function toString() {
      if (typeof this === "function" && nativeFunctionStrings.has(this)) {
        return nativeFunctionStrings.get(this);
      }
      return Reflect.apply(originalToString, this, arguments);
    };
    Object.defineProperty(patchedToString, "name", {
      value: "toString",
      configurable: true
    });
    Object.defineProperty(patchedToString, "length", {
      value: 0,
      configurable: true
    });
    registerNativeString(patchedToString, "function toString() { [native code] }");
    try {
      Object.defineProperty(targetGlobal.Function.prototype, "toString", {
        value: patchedToString,
        writable: true,
        configurable: true,
        enumerable: false
      });
      return true;
    } catch (err) {
      console.warn("[GhostBlock] Failed to patch Function.prototype.toString:", err);
      return false;
    }
  }
  function getBaitDimensions(element) {
    if (!element || typeof element !== "object") {
      return null;
    }
    const el = element;
    if (el.nodeType !== 1) {
      return null;
    }
    try {
      const id = (typeof el.id === "string" ? el.id : el.getAttribute && el.getAttribute("id") || "").trim();
      const rawClassName = typeof el.className === "string" ? el.className : el.getAttribute && el.getAttribute("class") || "";
      let hasHoneypotAttr = false;
      let dataAdValue = "";
      if (typeof el.getAttribute === "function") {
        for (const attr of HONEYPOT_ATTRIBUTES) {
          const val = el.getAttribute(attr);
          if (val !== null && val !== "") {
            hasHoneypotAttr = true;
            dataAdValue = val;
            break;
          }
        }
      }
      const tagName = (el.tagName || "").toLowerCase();
      const isGoogleIns = tagName === "ins" && (rawClassName.includes("adsbygoogle") || id.includes("aswift"));
      const isAdIframe = tagName === "iframe" && (id.includes("google_ads_iframe") || el.getAttribute && (el.getAttribute("name") || "").includes("google_ads_iframe"));
      let isBait = isGoogleIns || isAdIframe || hasHoneypotAttr;
      if (!isBait && (COMMON_BAIT_PATTERN.test(rawClassName) || COMMON_BAIT_PATTERN.test(id))) {
        isBait = true;
      }
      if (!isBait && id) {
        if (HONEYPOT_IDS.has(id)) {
          isBait = true;
        } else {
          const lowerId = id.toLowerCase();
          for (const honeypotId of HONEYPOT_IDS) {
            if (lowerId.includes(honeypotId.toLowerCase())) {
              isBait = true;
              break;
            }
          }
        }
      }
      const classTokens = rawClassName.split(/\s+/).filter(Boolean);
      if (!isBait && classTokens.length > 0) {
        for (const token of classTokens) {
          if (HONEYPOT_CLASSES.has(token)) {
            isBait = true;
            break;
          }
        }
        if (!isBait) {
          const lowerClass = rawClassName.toLowerCase();
          for (const honeypotClass of HONEYPOT_CLASSES) {
            if (lowerClass.includes(honeypotClass.toLowerCase())) {
              isBait = true;
              break;
            }
          }
        }
      }
      if (!isBait) {
        return null;
      }
      for (const token of classTokens) {
        if (KNOWN_BAIT_DIMENSIONS[token]) {
          return { ...KNOWN_BAIT_DIMENSIONS[token] };
        }
      }
      if (id && KNOWN_BAIT_DIMENSIONS[id]) {
        return { ...KNOWN_BAIT_DIMENSIONS[id] };
      }
      const combinedSignatures = `${rawClassName} ${id} ${dataAdValue}`;
      const regexMatch = combinedSignatures.match(BAIT_DIMENSION_REGEX);
      if (regexMatch && regexMatch[1] && regexMatch[2]) {
        const width = parseInt(regexMatch[1], 10);
        const height = parseInt(regexMatch[2], 10);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
      if (typeof el.getAttribute === "function") {
        const attrWidth = parseInt(
          el.getAttribute("width") || el.getAttribute("data-ad-width") || "0",
          10
        );
        const attrHeight = parseInt(
          el.getAttribute("height") || el.getAttribute("data-ad-height") || "0",
          10
        );
        if (attrWidth > 0 && attrHeight > 0) {
          return { width: attrWidth, height: attrHeight };
        }
      }
      const lowerComb = combinedSignatures.toLowerCase();
      if (lowerComb.includes("leaderboard") || lowerComb.includes("ad-header") || lowerComb.includes("728x90")) {
        return { width: 728, height: 90 };
      }
      if (lowerComb.includes("skyscraper") || lowerComb.includes("160x600")) {
        return { width: 160, height: 600 };
      }
      if (lowerComb.includes("halfpage") || lowerComb.includes("300x600")) {
        return { width: 300, height: 600 };
      }
      if (lowerComb.includes("billboard") || lowerComb.includes("970x250")) {
        return { width: 970, height: 250 };
      }
      if (lowerComb.includes("mobile-banner") || lowerComb.includes("320x50")) {
        return { width: 320, height: 50 };
      }
      return { ...DEFAULT_BAIT_DIMENSIONS };
    } catch (_err) {
      return null;
    }
  }
  function isBaitElement(element) {
    return getBaitDimensions(element) !== null;
  }
  function notifyBaitProbed(target, dims) {
    if (reportedBaitElements.has(target)) return;
    reportedBaitElements.add(target);
    try {
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        const event = new CustomEvent(GHOST_EVENTS.TELEMETRY_INCREMENT, {
          detail: {
            adsNeutralized: 1,
            type: "geometry_spoof",
            dimensions: dims,
            tag: target.tagName,
            id: target.id
          }
        });
        window.dispatchEvent(event);
      }
    } catch (_err) {
    }
  }
  function createSpoofedDOMRect(width, height, globalScope = globalThis) {
    if (typeof globalScope.DOMRect === "function") {
      try {
        return new globalScope.DOMRect(0, 0, width, height);
      } catch (_err) {
      }
    }
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON() {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: width,
          bottom: height,
          width,
          height
        };
      }
    };
  }
  function patchGetter(targetProto, propName, spoofValueFn) {
    if (!targetProto) return;
    const originalDescriptor = Object.getOwnPropertyDescriptor(targetProto, propName);
    if (!originalDescriptor || typeof originalDescriptor.get !== "function") {
      return;
    }
    const originalGet = originalDescriptor.get;
    const getterName = `get ${propName}`;
    if (nativeFunctionStrings.has(originalGet)) {
      return;
    }
    const wrappedGetter = function() {
      if (this && typeof this === "object") {
        const dims = getBaitDimensions(this);
        if (dims) {
          notifyBaitProbed(this, dims);
          return spoofValueFn(this, dims);
        }
      }
      return Reflect.apply(originalGet, this, arguments);
    };
    Object.defineProperty(wrappedGetter, "name", {
      value: getterName,
      configurable: true
    });
    Object.defineProperty(wrappedGetter, "length", {
      value: 0,
      configurable: true
    });
    registerNativeString(wrappedGetter, `function get ${propName}() { [native code] }`);
    Object.defineProperty(targetProto, propName, {
      get: wrappedGetter,
      set: originalDescriptor.set,
      enumerable: originalDescriptor.enumerable ?? true,
      configurable: originalDescriptor.configurable ?? true
    });
  }
  function patchMethod(targetProto, methodName, spoofMethodFn) {
    if (!targetProto) return;
    const originalDescriptor = Object.getOwnPropertyDescriptor(targetProto, methodName);
    if (!originalDescriptor || typeof originalDescriptor.value !== "function") {
      return;
    }
    const originalMethod = originalDescriptor.value;
    if (nativeFunctionStrings.has(originalMethod)) {
      return;
    }
    const wrappedMethod = function() {
      if (this && typeof this === "object") {
        const dims = getBaitDimensions(this);
        if (dims) {
          notifyBaitProbed(this, dims);
          return spoofMethodFn(this, dims, arguments);
        }
      }
      return Reflect.apply(originalMethod, this, arguments);
    };
    Object.defineProperty(wrappedMethod, "name", {
      value: methodName,
      configurable: true
    });
    Object.defineProperty(wrappedMethod, "length", {
      value: 0,
      configurable: true
    });
    registerNativeString(wrappedMethod, `function ${methodName}() { [native code] }`);
    Object.defineProperty(targetProto, methodName, {
      value: wrappedMethod,
      writable: originalDescriptor.writable ?? true,
      enumerable: originalDescriptor.enumerable ?? false,
      configurable: originalDescriptor.configurable ?? true
    });
  }
  function patchGetComputedStyle(targetGlobal = globalThis) {
    if (!targetGlobal || typeof targetGlobal.getComputedStyle !== "function") {
      return false;
    }
    installAntiFingerprintToString(targetGlobal);
    const originalGetComputedStyle = targetGlobal.getComputedStyle;
    if (nativeFunctionStrings.has(originalGetComputedStyle)) {
      return true;
    }
    const patchedGetComputedStyle = function getComputedStyle(elt, _pseudoElt) {
      const realStyle = Reflect.apply(originalGetComputedStyle, targetGlobal, arguments);
      if (!elt || elt.nodeType !== 1) {
        return realStyle;
      }
      if (isBaitElement(elt)) {
        notifyBaitProbed(elt, getBaitDimensions(elt) || { width: 300, height: 250 });
        return new Proxy(realStyle || {}, {
          get(target, prop, receiver) {
            if (prop === "display") return "block";
            if (prop === "visibility") return "visible";
            if (prop === "opacity") return "1";
            if (prop === "getPropertyValue") {
              return function(propName) {
                if (propName === "display") return "block";
                if (propName === "visibility") return "visible";
                if (propName === "opacity") return "1";
                return typeof target.getPropertyValue === "function" ? target.getPropertyValue(propName) : "";
              };
            }
            const val = Reflect.get(target, prop, receiver);
            if (typeof val === "function") {
              return val.bind(target);
            }
            return val;
          }
        });
      }
      return realStyle;
    };
    Object.defineProperty(patchedGetComputedStyle, "name", {
      value: "getComputedStyle",
      configurable: true
    });
    Object.defineProperty(patchedGetComputedStyle, "length", {
      value: 1,
      configurable: true
    });
    registerNativeString(
      patchedGetComputedStyle,
      "function getComputedStyle() { [native code] }"
    );
    try {
      targetGlobal.getComputedStyle = patchedGetComputedStyle;
      return true;
    } catch (err) {
      console.warn("[GhostBlock] Failed to patch getComputedStyle:", err);
      return false;
    }
  }
  function defineStealthGlobalProperty(target, prop, value) {
    if (!target) return;
    try {
      Object.defineProperty(target, prop, {
        get() {
          return value;
        },
        set(_val) {
        },
        configurable: true,
        enumerable: true
      });
    } catch (_e) {
      try {
        target[prop] = value;
      } catch (_err) {
      }
    }
  }
  function installGlobalFlagDefusal(targetGlobal = globalThis) {
    if (!targetGlobal) return;
    defineStealthGlobalProperty(targetGlobal, "canRunAds", true);
    defineStealthGlobalProperty(targetGlobal, "isAdBlockActive", false);
    defineStealthGlobalProperty(targetGlobal, "adblock", false);
    defineStealthGlobalProperty(targetGlobal, "adBlocker", false);
    defineStealthGlobalProperty(targetGlobal, "advertisementLoaded", true);
    defineStealthGlobalProperty(targetGlobal, "ynLoaded", true);
    defineStealthGlobalProperty(targetGlobal, "google_ad_status", 1);
  }
  function installAntiAdblockStubs(targetGlobal = globalThis) {
    if (!targetGlobal) return;
    function createFuckAdBlockStub() {
      function FuckAdBlockStub(options) {
        if (!(this instanceof FuckAdBlockStub)) {
          return new FuckAdBlockStub(options);
        }
        this._options = options || {};
        this._notDetectedCallbacks = [];
        this._detectedCallbacks = [];
        return this;
      }
      FuckAdBlockStub.prototype.setOption = function(options) {
        if (options && typeof options === "object") {
          this._options = Object.assign(this._options || {}, options);
        }
        return this;
      };
      FuckAdBlockStub.prototype.check = function() {
        return true;
      };
      FuckAdBlockStub.prototype.clearEvent = function() {
        this._notDetectedCallbacks = [];
        this._detectedCallbacks = [];
        return this;
      };
      FuckAdBlockStub.prototype.emitEvent = function(detected) {
        if (!detected && this._notDetectedCallbacks) {
          for (const fn of this._notDetectedCallbacks) {
            try {
              fn();
            } catch (_e) {
            }
          }
        }
        return this;
      };
      FuckAdBlockStub.prototype.on = function(detected, fn) {
        if (!detected && typeof fn === "function") {
          if (!this._notDetectedCallbacks) this._notDetectedCallbacks = [];
          this._notDetectedCallbacks.push(fn);
          try {
            fn();
          } catch (_e) {
          }
        } else if (detected && typeof fn === "function") {
          if (!this._detectedCallbacks) this._detectedCallbacks = [];
          this._detectedCallbacks.push(fn);
        }
        return this;
      };
      FuckAdBlockStub.prototype.onDetected = function(fn) {
        if (typeof fn === "function") {
          if (!this._detectedCallbacks) this._detectedCallbacks = [];
          this._detectedCallbacks.push(fn);
        }
        return this;
      };
      FuckAdBlockStub.prototype.onNotDetected = function(fn) {
        if (typeof fn === "function") {
          if (!this._notDetectedCallbacks) this._notDetectedCallbacks = [];
          this._notDetectedCallbacks.push(fn);
          try {
            fn();
          } catch (_e) {
          }
        }
        return this;
      };
      return FuckAdBlockStub;
    }
    const FAB = createFuckAdBlockStub();
    if (!targetGlobal.FuckAdBlock) {
      targetGlobal.FuckAdBlock = FAB;
    }
    if (!targetGlobal.fuckAdBlock) {
      targetGlobal.fuckAdBlock = new FAB();
    }
    if (!targetGlobal.BlockAdBlock) {
      targetGlobal.BlockAdBlock = FAB;
    }
    if (!targetGlobal.blockAdBlock) {
      targetGlobal.blockAdBlock = new FAB();
    }
    function createSnifferStub() {
      function SnifferStub() {
        if (!(this instanceof SnifferStub)) {
          return new SnifferStub();
        }
        return this;
      }
      SnifferStub.prototype.isAdBlock = function() {
        return false;
      };
      SnifferStub.prototype.isAdblock = function() {
        return false;
      };
      SnifferStub.prototype.check = function() {
        return false;
      };
      SnifferStub.prototype.run = function() {
      };
      SnifferStub.prototype.finish = function() {
      };
      SnifferStub.isAdBlock = function() {
        return false;
      };
      SnifferStub.isAdblock = function() {
        return false;
      };
      SnifferStub.check = function() {
        return false;
      };
      SnifferStub.run = function() {
      };
      SnifferStub.finish = function() {
      };
      return SnifferStub;
    }
    if (!targetGlobal.Sniffer) {
      targetGlobal.Sniffer = createSnifferStub();
    }
    function createYektanetStub() {
      const queue = [];
      queue.push = function() {
        for (let i = 0; i < arguments.length; i++) {
          Array.prototype.push.call(this, arguments[i]);
        }
        return this.length;
      };
      queue.loaded = true;
      queue.init = function() {
      };
      return queue;
    }
    if (!targetGlobal.yektanet) {
      targetGlobal.yektanet = createYektanetStub();
    }
    if (!targetGlobal._yektanet) {
      targetGlobal._yektanet = targetGlobal.yektanet;
    }
    targetGlobal.ynLoaded = true;
    function createMediaAdStub() {
      const stub = function() {
      };
      stub.push = function() {
        return 1;
      };
      stub.init = function() {
      };
      stub.render = function() {
      };
      stub.loaded = true;
      return stub;
    }
    if (!targetGlobal.MediaAd) {
      targetGlobal.MediaAd = createMediaAdStub();
    }
    if (!targetGlobal.mediaad) {
      targetGlobal.mediaad = targetGlobal.MediaAd;
    }
    if (!targetGlobal._mediaad) {
      targetGlobal._mediaad = targetGlobal.MediaAd;
    }
  }
  function installGeometrySpoofer(targetGlobal = globalThis) {
    if (!targetGlobal) return false;
    if (targetGlobal[INJECTION_KEY]) {
      return true;
    }
    installAntiFingerprintToString(targetGlobal);
    const HTMLElementProto = targetGlobal.HTMLElement?.prototype;
    const ElementProto = targetGlobal.Element?.prototype;
    if (!HTMLElementProto && !ElementProto) {
      return false;
    }
    if (HTMLElementProto) {
      patchGetter(HTMLElementProto, "offsetHeight", (_el, dims) => dims.height);
      patchGetter(HTMLElementProto, "offsetWidth", (_el, dims) => dims.width);
    }
    if (ElementProto) {
      patchGetter(ElementProto, "clientHeight", (_el, dims) => dims.height);
      patchGetter(ElementProto, "clientWidth", (_el, dims) => dims.width);
      patchMethod(
        ElementProto,
        "getBoundingClientRect",
        (_el, dims) => createSpoofedDOMRect(dims.width, dims.height, targetGlobal)
      );
    }
    if (HTMLElementProto) {
      if (Object.getOwnPropertyDescriptor(HTMLElementProto, "clientHeight")) {
        patchGetter(HTMLElementProto, "clientHeight", (_el, dims) => dims.height);
      }
      if (Object.getOwnPropertyDescriptor(HTMLElementProto, "clientWidth")) {
        patchGetter(HTMLElementProto, "clientWidth", (_el, dims) => dims.width);
      }
      if (Object.getOwnPropertyDescriptor(HTMLElementProto, "getBoundingClientRect")) {
        patchMethod(
          HTMLElementProto,
          "getBoundingClientRect",
          (_el, dims) => createSpoofedDOMRect(dims.width, dims.height, targetGlobal)
        );
      }
    }
    patchGetComputedStyle(targetGlobal);
    installGlobalFlagDefusal(targetGlobal);
    installAntiAdblockStubs(targetGlobal);
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
  if (typeof window !== "undefined" && (typeof HTMLElement !== "undefined" || typeof Element !== "undefined")) {
    try {
      installGeometrySpoofer(window);
      console.log("[GhostBlock] Stealth Prototype Geometry Spoofer & Anti-Adblock Defuser active in MAIN world");
    } catch (err) {
      console.warn("[GhostBlock] Failed to initialize geometry spoofer:", err);
    }
  }
})();
