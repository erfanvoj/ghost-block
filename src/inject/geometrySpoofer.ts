/**
 * GhostBlock — MAIN World Native Prototype Geometry Spoofing Engine & Anti-Adblock Defuser
 *
 * Injected at document_start into the MAIN execution realm.
 * Transparently hooks HTMLElement.prototype and Element.prototype geometry getters
 * and methods (offsetHeight, clientHeight, offsetWidth, clientWidth, getBoundingClientRect)
 * to return realistic dimensions for ad honeypots and bait elements while leaving
 * normal page layout calculations untouched.
 *
 * Intercepts window.getComputedStyle to return a Proxy that overrides display -> 'block'
 * and visibility -> 'visible' for bait elements.
 *
 * Defuses global variable checks and installs full no-op stubs for anti-adblock engines
 * including FuckAdBlock, BlockAdBlock, Sniffer, Yektanet, and MediaAd.
 *
 * Implements strict anti-fingerprinting safeguards by spoofing Function.prototype.toString
 * and preserving property descriptor flags and function names.
 */

// Known Honeypot Selectors & Bait Classes
export const HONEYPOT_CLASSES = new Set([
  'pub_300x250',
  'pub_300x250m',
  'pub_728x90',
  'pub_300x600',
  'pub_160x600',
  'pub_970x250',
  'pub_320x50',
  'text-ad',
  'textAd',
  'text_ad',
  'ad-banner',
  'ad_banner',
  'ad-slot',
  'ad_slot',
  'ad-header',
  'google_ads_iframe',
  'adsbox',
  'ad-placement',
  'ad-wrapper',
  'ad-zone',
]);

export const HONEYPOT_IDS = new Set([
  'ad-unit',
  'ad-container',
  'ad-leaderboard',
  'ad_top',
  'ad_bottom',
  'google_ads_div',
  'div-gpt-ad',
]);

// Common bait patterns for fast regex detection
export const COMMON_BAIT_PATTERN =
  /adsbox|ad-zone|ad_zone|ad-banner|ad_banner|pub_300|banner-ad|banner_ad|ad-slot|ad_slot|ad-placement|ad-wrapper|ad-header|ad-unit|ad-container/i;

// Known Bait Dimension Mappings
export const DEFAULT_BAIT_DIMENSIONS = {
  width: 300,
  height: 250,
} as const;

export const KNOWN_BAIT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'pub_300x250': { width: 300, height: 250 },
  'pub_300x250m': { width: 300, height: 250 },
  'pub_728x90': { width: 728, height: 90 },
  'pub_300x600': { width: 300, height: 600 },
  'pub_160x600': { width: 160, height: 600 },
  'pub_970x250': { width: 970, height: 250 },
  'pub_320x50': { width: 320, height: 50 },
  'ad-leaderboard': { width: 728, height: 90 },
  'ad_leaderboard': { width: 728, height: 90 },
  'ad-header': { width: 728, height: 90 },
  'ad_top': { width: 728, height: 90 },
};

// Regex to extract dimension patterns like 300x250, 728x90, 300_250 from bait classnames / IDs
export const BAIT_DIMENSION_REGEX = /(?:pub_|^|[\s_-])(\d{2,4})[xX_×](\d{2,4})(?:m|$|[\s_-])/;

// Honeypot DOM attributes
export const HONEYPOT_ATTRIBUTES = [
  'data-ad',
  'data-ad-slot',
  'data-ad-client',
  'data-ad-format',
  'data-ad-unit',
  'data-ad-layout',
] as const;

// Custom Window Events for cross-world and content-bridge messaging
export const GHOST_EVENTS = {
  TELEMETRY_INCREMENT: 'ghostblock:telemetry_increment',
  VIDEO_AD_DETECTED: 'ghostblock:video_ad_detected',
  MODAL_DEFUSED: 'ghostblock:modal_defused',
} as const;

// WeakMap tracking native toString representations of hooked functions
const nativeFunctionStrings = new WeakMap<Function, string>();

// WeakSet tracking elements that have already triggered telemetry notifications
const reportedBaitElements = new WeakSet<object>();

// Global flag symbol to prevent multiple injections
const INJECTION_KEY = '__GHOSTBLOCK_GEOMETRY_SPOOFER_INSTALLED__';

/**
 * Register a function and its expected native toString representation
 */
export function registerNativeString(fn: Function, nativeString: string): void {
  nativeFunctionStrings.set(fn, nativeString);
}

/**
 * Install the anti-fingerprinting Function.prototype.toString wrapper
 */
export function installAntiFingerprintToString(targetGlobal: any = globalThis): boolean {
  if (!targetGlobal || !targetGlobal.Function || !targetGlobal.Function.prototype) {
    return false;
  }

  const originalToString = targetGlobal.Function.prototype.toString;

  // If already hooked, don't re-hook
  if (nativeFunctionStrings.has(originalToString)) {
    return true;
  }

  const patchedToString = function toString(this: Function) {
    if (typeof this === 'function' && nativeFunctionStrings.has(this)) {
      return nativeFunctionStrings.get(this)!;
    }
    return Reflect.apply(originalToString, this, arguments);
  };

  // Set function identity metadata
  Object.defineProperty(patchedToString, 'name', {
    value: 'toString',
    configurable: true,
  });
  Object.defineProperty(patchedToString, 'length', {
    value: 0,
    configurable: true,
  });

  // Register patchedToString itself
  registerNativeString(patchedToString, 'function toString() { [native code] }');

  // Replace Function.prototype.toString
  try {
    Object.defineProperty(targetGlobal.Function.prototype, 'toString', {
      value: patchedToString,
      writable: true,
      configurable: true,
      enumerable: false,
    });
    return true;
  } catch (err) {
    console.warn('[GhostBlock] Failed to patch Function.prototype.toString:', err);
    return false;
  }
}

/**
 * Inspect an element and determine if it is an ad honeypot / bait element.
 * If true, returns realistic dimensions { width, height }.
 * If false, returns null.
 */
export function getBaitDimensions(
  element: unknown
): { width: number; height: number } | null {
  if (!element || typeof element !== 'object') {
    return null;
  }

  // Must be an Element (nodeType === 1)
  const el = element as Element;
  if (el.nodeType !== 1) {
    return null;
  }

  try {
    // 1. Extract element ID safely
    const id = (typeof el.id === 'string' ? el.id : (el.getAttribute && el.getAttribute('id')) || '').trim();

    // 2. Extract class name safely (handling SVGAnimatedString or strings)
    const rawClassName =
      typeof el.className === 'string'
        ? el.className
        : (el.getAttribute && el.getAttribute('class')) || '';

    // 3. Extract honeypot attributes
    let hasHoneypotAttr = false;
    let dataAdValue = '';
    if (typeof el.getAttribute === 'function') {
      for (const attr of HONEYPOT_ATTRIBUTES) {
        const val = el.getAttribute(attr);
        if (val !== null && val !== '') {
          hasHoneypotAttr = true;
          dataAdValue = val;
          break;
        }
      }
    }

    // 4. Tag name check
    const tagName = (el.tagName || '').toLowerCase();
    const isGoogleIns = tagName === 'ins' && (rawClassName.includes('adsbygoogle') || id.includes('aswift'));
    const isAdIframe =
      tagName === 'iframe' &&
      (id.includes('google_ads_iframe') ||
        (el.getAttribute && (el.getAttribute('name') || '').includes('google_ads_iframe')));

    // 5. Match checks
    let isBait = isGoogleIns || isAdIframe || hasHoneypotAttr;

    // Check Common Bait Pattern regex
    if (!isBait && (COMMON_BAIT_PATTERN.test(rawClassName) || COMMON_BAIT_PATTERN.test(id))) {
      isBait = true;
    }

    // Check ID match
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

    // Check Class tokens match
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

    // --- Dimension Resolution ---
    // A. Check direct class token in known dimensions map
    for (const token of classTokens) {
      if (KNOWN_BAIT_DIMENSIONS[token]) {
        return { ...KNOWN_BAIT_DIMENSIONS[token] };
      }
    }

    // B. Check ID in known dimensions map
    if (id && KNOWN_BAIT_DIMENSIONS[id]) {
      return { ...KNOWN_BAIT_DIMENSIONS[id] };
    }

    // C. Regex match for WxH patterns (e.g. pub_300x250, 728x90, 300_250)
    const combinedSignatures = `${rawClassName} ${id} ${dataAdValue}`;
    const regexMatch = combinedSignatures.match(BAIT_DIMENSION_REGEX);
    if (regexMatch && regexMatch[1] && regexMatch[2]) {
      const width = parseInt(regexMatch[1], 10);
      const height = parseInt(regexMatch[2], 10);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    // D. Check explicit width / height DOM attributes
    if (typeof el.getAttribute === 'function') {
      const attrWidth = parseInt(
        el.getAttribute('width') || el.getAttribute('data-ad-width') || '0',
        10
      );
      const attrHeight = parseInt(
        el.getAttribute('height') || el.getAttribute('data-ad-height') || '0',
        10
      );
      if (attrWidth > 0 && attrHeight > 0) {
        return { width: attrWidth, height: attrHeight };
      }
    }

    // E. Specific keyword dimension defaults
    const lowerComb = combinedSignatures.toLowerCase();
    if (
      lowerComb.includes('leaderboard') ||
      lowerComb.includes('ad-header') ||
      lowerComb.includes('728x90')
    ) {
      return { width: 728, height: 90 };
    }
    if (lowerComb.includes('skyscraper') || lowerComb.includes('160x600')) {
      return { width: 160, height: 600 };
    }
    if (lowerComb.includes('halfpage') || lowerComb.includes('300x600')) {
      return { width: 300, height: 600 };
    }
    if (lowerComb.includes('billboard') || lowerComb.includes('970x250')) {
      return { width: 970, height: 250 };
    }
    if (lowerComb.includes('mobile-banner') || lowerComb.includes('320x50')) {
      return { width: 320, height: 50 };
    }

    // F. Fallback default realistic dimensions (300x250)
    return { ...DEFAULT_BAIT_DIMENSIONS };
  } catch (_err) {
    // Fail-safe: never crash page scripts
    return null;
  }
}

/**
 * Check if an element is a recognized bait element
 */
export function isBaitElement(element: unknown): boolean {
  return getBaitDimensions(element) !== null;
}

/**
 * Dispatch cross-world telemetry event when a bait element is probed
 */
function notifyBaitProbed(target: Element, dims: { width: number; height: number }): void {
  if (reportedBaitElements.has(target)) return;
  reportedBaitElements.add(target);

  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      const event = new CustomEvent(GHOST_EVENTS.TELEMETRY_INCREMENT, {
        detail: {
          adsNeutralized: 1,
          type: 'geometry_spoof',
          dimensions: dims,
          tag: target.tagName,
          id: target.id,
        },
      });
      window.dispatchEvent(event);
    }
  } catch (_err) {
    // Silent fail
  }
}

/**
 * Create a DOMRect compliant object or instance for getBoundingClientRect
 */
export function createSpoofedDOMRect(
  width: number,
  height: number,
  globalScope: any = globalThis
): DOMRect {
  if (typeof globalScope.DOMRect === 'function') {
    try {
      return new globalScope.DOMRect(0, 0, width, height);
    } catch (_err) {
      // In case DOMRect constructor behaves differently in environment
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
        height,
      };
    },
  } as unknown as DOMRect;
}

/**
 * Patch a getter property descriptor on a prototype object
 */
function patchGetter(
  targetProto: any,
  propName: string,
  spoofValueFn: (target: Element, dims: { width: number; height: number }) => number
): void {
  if (!targetProto) return;

  const originalDescriptor = Object.getOwnPropertyDescriptor(targetProto, propName);
  if (!originalDescriptor || typeof originalDescriptor.get !== 'function') {
    return;
  }

  const originalGet = originalDescriptor.get;
  const getterName = `get ${propName}`;

  // If already hooked, don't re-hook
  if (nativeFunctionStrings.has(originalGet)) {
    return;
  }

  const wrappedGetter = function (this: unknown) {
    if (this && typeof this === 'object') {
      const dims = getBaitDimensions(this);
      if (dims) {
        notifyBaitProbed(this as Element, dims);
        return spoofValueFn(this as Element, dims);
      }
    }
    return Reflect.apply(originalGet, this, arguments);
  };

  // Configure function metadata
  Object.defineProperty(wrappedGetter, 'name', {
    value: getterName,
    configurable: true,
  });
  Object.defineProperty(wrappedGetter, 'length', {
    value: 0,
    configurable: true,
  });

  // Register native toString representation
  registerNativeString(wrappedGetter, `function get ${propName}() { [native code] }`);

  // Re-define property on targetProto preserving original descriptor flags
  Object.defineProperty(targetProto, propName, {
    get: wrappedGetter,
    set: originalDescriptor.set,
    enumerable: originalDescriptor.enumerable ?? true,
    configurable: originalDescriptor.configurable ?? true,
  });
}

/**
 * Patch a method descriptor on a prototype object
 */
function patchMethod(
  targetProto: any,
  methodName: string,
  spoofMethodFn: (target: Element, dims: { width: number; height: number }, args: IArguments) => unknown
): void {
  if (!targetProto) return;

  const originalDescriptor = Object.getOwnPropertyDescriptor(targetProto, methodName);
  if (!originalDescriptor || typeof originalDescriptor.value !== 'function') {
    return;
  }

  const originalMethod = originalDescriptor.value;

  // If already hooked, don't re-hook
  if (nativeFunctionStrings.has(originalMethod)) {
    return;
  }

  const wrappedMethod = function (this: unknown) {
    if (this && typeof this === 'object') {
      const dims = getBaitDimensions(this);
      if (dims) {
        notifyBaitProbed(this as Element, dims);
        return spoofMethodFn(this as Element, dims, arguments);
      }
    }
    return Reflect.apply(originalMethod, this, arguments);
  };

  // Configure function metadata
  Object.defineProperty(wrappedMethod, 'name', {
    value: methodName,
    configurable: true,
  });
  Object.defineProperty(wrappedMethod, 'length', {
    value: 0,
    configurable: true,
  });

  // Register native toString representation
  registerNativeString(wrappedMethod, `function ${methodName}() { [native code] }`);

  // Re-define method on targetProto
  Object.defineProperty(targetProto, methodName, {
    value: wrappedMethod,
    writable: originalDescriptor.writable ?? true,
    enumerable: originalDescriptor.enumerable ?? false,
    configurable: originalDescriptor.configurable ?? true,
  });
}

/**
 * Patch window.getComputedStyle to return a Proxy overriding display -> 'block' and visibility -> 'visible'
 * when querying bait/honeypot elements.
 */
export function patchGetComputedStyle(targetGlobal: any = globalThis): boolean {
  if (!targetGlobal || typeof targetGlobal.getComputedStyle !== 'function') {
    return false;
  }

  installAntiFingerprintToString(targetGlobal);

  const originalGetComputedStyle = targetGlobal.getComputedStyle;

  // If already hooked, don't re-hook
  if (nativeFunctionStrings.has(originalGetComputedStyle)) {
    return true;
  }

  const patchedGetComputedStyle = function getComputedStyle(
    elt: Element,
    _pseudoElt?: string | null
  ) {
    const realStyle = Reflect.apply(originalGetComputedStyle, targetGlobal, arguments);
    if (!elt || (elt as any).nodeType !== 1) {
      return realStyle;
    }

    if (isBaitElement(elt)) {
      notifyBaitProbed(elt, getBaitDimensions(elt) || { width: 300, height: 250 });
      return new Proxy(realStyle || {}, {
        get(target: any, prop: string | symbol, receiver: any) {
          if (prop === 'display') return 'block';
          if (prop === 'visibility') return 'visible';
          if (prop === 'opacity') return '1';
          if (prop === 'getPropertyValue') {
            return function (propName: string) {
              if (propName === 'display') return 'block';
              if (propName === 'visibility') return 'visible';
              if (propName === 'opacity') return '1';
              return typeof target.getPropertyValue === 'function'
                ? target.getPropertyValue(propName)
                : '';
            };
          }
          const val = Reflect.get(target, prop, receiver);
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        },
      });
    }

    return realStyle;
  };

  // Configure function metadata
  Object.defineProperty(patchedGetComputedStyle, 'name', {
    value: 'getComputedStyle',
    configurable: true,
  });
  Object.defineProperty(patchedGetComputedStyle, 'length', {
    value: 1,
    configurable: true,
  });

  // Register native toString representation
  registerNativeString(
    patchedGetComputedStyle,
    'function getComputedStyle() { [native code] }'
  );

  try {
    targetGlobal.getComputedStyle = patchedGetComputedStyle;
    return true;
  } catch (err) {
    console.warn('[GhostBlock] Failed to patch getComputedStyle:', err);
    return false;
  }
}

/**
 * Define a stealth global property with getter that always returns the desired value
 */
function defineStealthGlobalProperty(target: any, prop: string, value: any): void {
  if (!target) return;
  try {
    Object.defineProperty(target, prop, {
      get() {
        return value;
      },
      set(_val) {
        // Silently retain spoofed value to defuse anti-adblock flag checks
      },
      configurable: true,
      enumerable: true,
    });
  } catch (_e) {
    try {
      target[prop] = value;
    } catch (_err) {}
  }
}

/**
 * Install global variable flag defusal properties on window / globalThis
 */
export function installGlobalFlagDefusal(targetGlobal: any = globalThis): void {
  if (!targetGlobal) return;

  defineStealthGlobalProperty(targetGlobal, 'canRunAds', true);
  defineStealthGlobalProperty(targetGlobal, 'isAdBlockActive', false);
  defineStealthGlobalProperty(targetGlobal, 'adblock', false);
  defineStealthGlobalProperty(targetGlobal, 'adBlocker', false);
  defineStealthGlobalProperty(targetGlobal, 'advertisementLoaded', true);
  defineStealthGlobalProperty(targetGlobal, 'ynLoaded', true);
  defineStealthGlobalProperty(targetGlobal, 'google_ad_status', 1);
}

/**
 * Install full no-op stubs for popular anti-adblock engines
 * (FuckAdBlock, BlockAdBlock, Sniffer, Yektanet, MediaAd)
 */
export function installAntiAdblockStubs(targetGlobal: any = globalThis): void {
  if (!targetGlobal) return;

  // 1. FuckAdBlock & BlockAdBlock
  function createFuckAdBlockStub() {
    function FuckAdBlockStub(this: any, options?: any) {
      if (!(this instanceof (FuckAdBlockStub as any))) {
        return new (FuckAdBlockStub as any)(options);
      }
      (this as any)._options = options || {};
      (this as any)._notDetectedCallbacks = [];
      (this as any)._detectedCallbacks = [];
      return this;
    }

    FuckAdBlockStub.prototype.setOption = function (this: any, options?: any) {
      if (options && typeof options === 'object') {
        this._options = Object.assign(this._options || {}, options);
      }
      return this;
    };
    FuckAdBlockStub.prototype.check = function () {
      return true;
    };
    FuckAdBlockStub.prototype.clearEvent = function (this: any) {
      this._notDetectedCallbacks = [];
      this._detectedCallbacks = [];
      return this;
    };
    FuckAdBlockStub.prototype.emitEvent = function (this: any, detected: boolean) {
      if (!detected && this._notDetectedCallbacks) {
        for (const fn of this._notDetectedCallbacks) {
          try {
            fn();
          } catch (_e) {}
        }
      }
      return this;
    };
    FuckAdBlockStub.prototype.on = function (this: any, detected: boolean, fn: Function) {
      if (!detected && typeof fn === 'function') {
        if (!this._notDetectedCallbacks) this._notDetectedCallbacks = [];
        this._notDetectedCallbacks.push(fn);
        try {
          fn();
        } catch (_e) {}
      } else if (detected && typeof fn === 'function') {
        if (!this._detectedCallbacks) this._detectedCallbacks = [];
        this._detectedCallbacks.push(fn);
      }
      return this;
    };
    FuckAdBlockStub.prototype.onDetected = function (this: any, fn: Function) {
      if (typeof fn === 'function') {
        if (!this._detectedCallbacks) this._detectedCallbacks = [];
        this._detectedCallbacks.push(fn);
      }
      return this;
    };
    FuckAdBlockStub.prototype.onNotDetected = function (this: any, fn: Function) {
      if (typeof fn === 'function') {
        if (!this._notDetectedCallbacks) this._notDetectedCallbacks = [];
        this._notDetectedCallbacks.push(fn);
        try {
          fn();
        } catch (_e) {}
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
    targetGlobal.fuckAdBlock = new (FAB as any)();
  }
  if (!targetGlobal.BlockAdBlock) {
    targetGlobal.BlockAdBlock = FAB;
  }
  if (!targetGlobal.blockAdBlock) {
    targetGlobal.blockAdBlock = new (FAB as any)();
  }

  // 2. Sniffer Stub
  function createSnifferStub() {
    function SnifferStub(this: any) {
      if (!(this instanceof SnifferStub)) {
        return new (SnifferStub as any)();
      }
      return this;
    }
    SnifferStub.prototype.isAdBlock = function () {
      return false;
    };
    SnifferStub.prototype.isAdblock = function () {
      return false;
    };
    SnifferStub.prototype.check = function () {
      return false;
    };
    SnifferStub.prototype.run = function () {};
    SnifferStub.prototype.finish = function () {};
    SnifferStub.isAdBlock = function () {
      return false;
    };
    SnifferStub.isAdblock = function () {
      return false;
    };
    SnifferStub.check = function () {
      return false;
    };
    SnifferStub.run = function () {};
    SnifferStub.finish = function () {};
    return SnifferStub;
  }
  if (!targetGlobal.Sniffer) {
    targetGlobal.Sniffer = createSnifferStub();
  }

  // 3. Yektanet Stub (ynLoaded, yektanet, _yektanet)
  function createYektanetStub() {
    const queue: any = [];
    queue.push = function () {
      for (let i = 0; i < arguments.length; i++) {
        Array.prototype.push.call(this, arguments[i]);
      }
      return this.length;
    };
    queue.loaded = true;
    queue.init = function () {};
    return queue;
  }
  if (!targetGlobal.yektanet) {
    targetGlobal.yektanet = createYektanetStub();
  }
  if (!targetGlobal._yektanet) {
    targetGlobal._yektanet = targetGlobal.yektanet;
  }
  targetGlobal.ynLoaded = true;

  // 4. MediaAd Stub (MediaAd, mediaad, _mediaad)
  function createMediaAdStub() {
    const stub: any = function () {};
    stub.push = function () {
      return 1;
    };
    stub.init = function () {};
    stub.render = function () {};
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

/**
 * Install all MAIN world prototype traps, geometry spoofing, anti-fingerprinting overrides,
 * getComputedStyle proxy, and anti-adblock engine stubs.
 */
export function installGeometrySpoofer(targetGlobal: any = globalThis): boolean {
  if (!targetGlobal) return false;

  // Prevent multiple installations
  if (targetGlobal[INJECTION_KEY]) {
    return true;
  }

  // 1. Install anti-fingerprinting Function.prototype.toString override
  installAntiFingerprintToString(targetGlobal);

  const HTMLElementProto = targetGlobal.HTMLElement?.prototype;
  const ElementProto = targetGlobal.Element?.prototype;

  if (!HTMLElementProto && !ElementProto) {
    return false;
  }

  // 2. Intercept offsetHeight & offsetWidth (defined on HTMLElement.prototype)
  if (HTMLElementProto) {
    patchGetter(HTMLElementProto, 'offsetHeight', (_el, dims) => dims.height);
    patchGetter(HTMLElementProto, 'offsetWidth', (_el, dims) => dims.width);
  }

  // 3. Intercept clientHeight & clientWidth (defined on Element.prototype)
  if (ElementProto) {
    patchGetter(ElementProto, 'clientHeight', (_el, dims) => dims.height);
    patchGetter(ElementProto, 'clientWidth', (_el, dims) => dims.width);
    // Also patch getBoundingClientRect (defined on Element.prototype)
    patchMethod(ElementProto, 'getBoundingClientRect', (_el, dims) =>
      createSpoofedDOMRect(dims.width, dims.height, targetGlobal)
    );
  }

  // 4. In case a DOM environment defines clientWidth/clientHeight on HTMLElementProto
  if (HTMLElementProto) {
    if (Object.getOwnPropertyDescriptor(HTMLElementProto, 'clientHeight')) {
      patchGetter(HTMLElementProto, 'clientHeight', (_el, dims) => dims.height);
    }
    if (Object.getOwnPropertyDescriptor(HTMLElementProto, 'clientWidth')) {
      patchGetter(HTMLElementProto, 'clientWidth', (_el, dims) => dims.width);
    }
    if (Object.getOwnPropertyDescriptor(HTMLElementProto, 'getBoundingClientRect')) {
      patchMethod(HTMLElementProto, 'getBoundingClientRect', (_el, dims) =>
        createSpoofedDOMRect(dims.width, dims.height, targetGlobal)
      );
    }
  }

  // 5. Intercept window.getComputedStyle for bait element style spoofing
  patchGetComputedStyle(targetGlobal);

  // 6. Defuse standard anti-adblock global variable checks
  installGlobalFlagDefusal(targetGlobal);

  // 7. Install no-op anti-adblock engine stubs
  installAntiAdblockStubs(targetGlobal);

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

// Auto-execute when injected in browser page MAIN execution world
if (typeof window !== 'undefined' && (typeof HTMLElement !== 'undefined' || typeof Element !== 'undefined')) {
  try {
    installGeometrySpoofer(window);
    console.log('[GhostBlock] Stealth Prototype Geometry Spoofer & Anti-Adblock Defuser active in MAIN world');
  } catch (err) {
    console.warn('[GhostBlock] Failed to initialize geometry spoofer:', err);
  }
}
