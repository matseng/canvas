(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

module.exports.Dispatcher = require('./lib/Dispatcher')

},{"./lib/Dispatcher":3}],3:[function(require,module,exports){
/*
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Dispatcher
 * @typechecks
 */

"use strict";

var invariant = require('./invariant');

var _lastID = 1;
var _prefix = 'ID_';

/**
 * Dispatcher is used to broadcast payloads to registered callbacks. This is
 * different from generic pub-sub systems in two ways:
 *
 *   1) Callbacks are not subscribed to particular events. Every payload is
 *      dispatched to every registered callback.
 *   2) Callbacks can be deferred in whole or part until other callbacks have
 *      been executed.
 *
 * For example, consider this hypothetical flight destination form, which
 * selects a default city when a country is selected:
 *
 *   var flightDispatcher = new Dispatcher();
 *
 *   // Keeps track of which country is selected
 *   var CountryStore = {country: null};
 *
 *   // Keeps track of which city is selected
 *   var CityStore = {city: null};
 *
 *   // Keeps track of the base flight price of the selected city
 *   var FlightPriceStore = {price: null}
 *
 * When a user changes the selected city, we dispatch the payload:
 *
 *   flightDispatcher.dispatch({
 *     actionType: 'city-update',
 *     selectedCity: 'paris'
 *   });
 *
 * This payload is digested by `CityStore`:
 *
 *   flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'city-update') {
 *       CityStore.city = payload.selectedCity;
 *     }
 *   });
 *
 * When the user selects a country, we dispatch the payload:
 *
 *   flightDispatcher.dispatch({
 *     actionType: 'country-update',
 *     selectedCountry: 'australia'
 *   });
 *
 * This payload is digested by both stores:
 *
 *    CountryStore.dispatchToken = flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'country-update') {
 *       CountryStore.country = payload.selectedCountry;
 *     }
 *   });
 *
 * When the callback to update `CountryStore` is registered, we save a reference
 * to the returned token. Using this token with `waitFor()`, we can guarantee
 * that `CountryStore` is updated before the callback that updates `CityStore`
 * needs to query its data.
 *
 *   CityStore.dispatchToken = flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'country-update') {
 *       // `CountryStore.country` may not be updated.
 *       flightDispatcher.waitFor([CountryStore.dispatchToken]);
 *       // `CountryStore.country` is now guaranteed to be updated.
 *
 *       // Select the default city for the new country
 *       CityStore.city = getDefaultCityForCountry(CountryStore.country);
 *     }
 *   });
 *
 * The usage of `waitFor()` can be chained, for example:
 *
 *   FlightPriceStore.dispatchToken =
 *     flightDispatcher.register(function(payload) {
 *       switch (payload.actionType) {
 *         case 'country-update':
 *           flightDispatcher.waitFor([CityStore.dispatchToken]);
 *           FlightPriceStore.price =
 *             getFlightPriceStore(CountryStore.country, CityStore.city);
 *           break;
 *
 *         case 'city-update':
 *           FlightPriceStore.price =
 *             FlightPriceStore(CountryStore.country, CityStore.city);
 *           break;
 *     }
 *   });
 *
 * The `country-update` payload will be guaranteed to invoke the stores'
 * registered callbacks in order: `CountryStore`, `CityStore`, then
 * `FlightPriceStore`.
 */

  function Dispatcher() {
    this.$Dispatcher_callbacks = {};
    this.$Dispatcher_isPending = {};
    this.$Dispatcher_isHandled = {};
    this.$Dispatcher_isDispatching = false;
    this.$Dispatcher_pendingPayload = null;
  }

  /**
   * Registers a callback to be invoked with every dispatched payload. Returns
   * a token that can be used with `waitFor()`.
   *
   * @param {function} callback
   * @return {string}
   */
  Dispatcher.prototype.register=function(callback) {
    var id = _prefix + _lastID++;
    this.$Dispatcher_callbacks[id] = callback;
    return id;
  };

  /**
   * Removes a callback based on its token.
   *
   * @param {string} id
   */
  Dispatcher.prototype.unregister=function(id) {
    invariant(
      this.$Dispatcher_callbacks[id],
      'Dispatcher.unregister(...): `%s` does not map to a registered callback.',
      id
    );
    delete this.$Dispatcher_callbacks[id];
  };

  /**
   * Waits for the callbacks specified to be invoked before continuing execution
   * of the current callback. This method should only be used by a callback in
   * response to a dispatched payload.
   *
   * @param {array<string>} ids
   */
  Dispatcher.prototype.waitFor=function(ids) {
    invariant(
      this.$Dispatcher_isDispatching,
      'Dispatcher.waitFor(...): Must be invoked while dispatching.'
    );
    for (var ii = 0; ii < ids.length; ii++) {
      var id = ids[ii];
      if (this.$Dispatcher_isPending[id]) {
        invariant(
          this.$Dispatcher_isHandled[id],
          'Dispatcher.waitFor(...): Circular dependency detected while ' +
          'waiting for `%s`.',
          id
        );
        continue;
      }
      invariant(
        this.$Dispatcher_callbacks[id],
        'Dispatcher.waitFor(...): `%s` does not map to a registered callback.',
        id
      );
      this.$Dispatcher_invokeCallback(id);
    }
  };

  /**
   * Dispatches a payload to all registered callbacks.
   *
   * @param {object} payload
   */
  Dispatcher.prototype.dispatch=function(payload) {
    invariant(
      !this.$Dispatcher_isDispatching,
      'Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch.'
    );
    this.$Dispatcher_startDispatching(payload);
    try {
      for (var id in this.$Dispatcher_callbacks) {
        if (this.$Dispatcher_isPending[id]) {
          continue;
        }
        this.$Dispatcher_invokeCallback(id);
      }
    } finally {
      this.$Dispatcher_stopDispatching();
    }
  };

  /**
   * Is this Dispatcher currently dispatching.
   *
   * @return {boolean}
   */
  Dispatcher.prototype.isDispatching=function() {
    return this.$Dispatcher_isDispatching;
  };

  /**
   * Call the callback stored with the given id. Also do some internal
   * bookkeeping.
   *
   * @param {string} id
   * @internal
   */
  Dispatcher.prototype.$Dispatcher_invokeCallback=function(id) {
    this.$Dispatcher_isPending[id] = true;
    this.$Dispatcher_callbacks[id](this.$Dispatcher_pendingPayload);
    this.$Dispatcher_isHandled[id] = true;
  };

  /**
   * Set up bookkeeping needed when dispatching.
   *
   * @param {object} payload
   * @internal
   */
  Dispatcher.prototype.$Dispatcher_startDispatching=function(payload) {
    for (var id in this.$Dispatcher_callbacks) {
      this.$Dispatcher_isPending[id] = false;
      this.$Dispatcher_isHandled[id] = false;
    }
    this.$Dispatcher_pendingPayload = payload;
    this.$Dispatcher_isDispatching = true;
  };

  /**
   * Clear bookkeeping used for dispatching.
   *
   * @internal
   */
  Dispatcher.prototype.$Dispatcher_stopDispatching=function() {
    this.$Dispatcher_pendingPayload = null;
    this.$Dispatcher_isDispatching = false;
  };


module.exports = Dispatcher;

},{"./invariant":4}],4:[function(require,module,exports){
/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule invariant
 */

"use strict";

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

var invariant = function(condition, format, a, b, c, d, e, f) {
  if (false) {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  }

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error(
        'Minified exception occurred; use the non-minified dev environment ' +
        'for the full error message and additional helpful warnings.'
      );
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(
        'Invariant Violation: ' +
        format.replace(/%s/g, function() { return args[argIndex++]; })
      );
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
};

module.exports = invariant;

},{}],5:[function(require,module,exports){
/*! Hammer.JS - v2.0.4 - 2014-09-28
 * http://hammerjs.github.io/
 *
 * Copyright (c) 2014 Jorik Tangelder;
 * Licensed under the MIT license */
(function(window, document, exportName, undefined) {
  'use strict';

var VENDOR_PREFIXES = ['', 'webkit', 'moz', 'MS', 'ms', 'o'];
var TEST_ELEMENT = document.createElement('div');

var TYPE_FUNCTION = 'function';

var round = Math.round;
var abs = Math.abs;
var now = Date.now;

/**
 * set a timeout with a given scope
 * @param {Function} fn
 * @param {Number} timeout
 * @param {Object} context
 * @returns {number}
 */
function setTimeoutContext(fn, timeout, context) {
    return setTimeout(bindFn(fn, context), timeout);
}

/**
 * if the argument is an array, we want to execute the fn on each entry
 * if it aint an array we don't want to do a thing.
 * this is used by all the methods that accept a single and array argument.
 * @param {*|Array} arg
 * @param {String} fn
 * @param {Object} [context]
 * @returns {Boolean}
 */
function invokeArrayArg(arg, fn, context) {
    if (Array.isArray(arg)) {
        each(arg, context[fn], context);
        return true;
    }
    return false;
}

/**
 * walk objects and arrays
 * @param {Object} obj
 * @param {Function} iterator
 * @param {Object} context
 */
function each(obj, iterator, context) {
    var i;

    if (!obj) {
        return;
    }

    if (obj.forEach) {
        obj.forEach(iterator, context);
    } else if (obj.length !== undefined) {
        i = 0;
        while (i < obj.length) {
            iterator.call(context, obj[i], i, obj);
            i++;
        }
    } else {
        for (i in obj) {
            obj.hasOwnProperty(i) && iterator.call(context, obj[i], i, obj);
        }
    }
}

/**
 * extend object.
 * means that properties in dest will be overwritten by the ones in src.
 * @param {Object} dest
 * @param {Object} src
 * @param {Boolean} [merge]
 * @returns {Object} dest
 */
function extend(dest, src, merge) {
    var keys = Object.keys(src);
    var i = 0;
    while (i < keys.length) {
        if (!merge || (merge && dest[keys[i]] === undefined)) {
            dest[keys[i]] = src[keys[i]];
        }
        i++;
    }
    return dest;
}

/**
 * merge the values from src in the dest.
 * means that properties that exist in dest will not be overwritten by src
 * @param {Object} dest
 * @param {Object} src
 * @returns {Object} dest
 */
function merge(dest, src) {
    return extend(dest, src, true);
}

/**
 * simple class inheritance
 * @param {Function} child
 * @param {Function} base
 * @param {Object} [properties]
 */
function inherit(child, base, properties) {
    var baseP = base.prototype,
        childP;

    childP = child.prototype = Object.create(baseP);
    childP.constructor = child;
    childP._super = baseP;

    if (properties) {
        extend(childP, properties);
    }
}

/**
 * simple function bind
 * @param {Function} fn
 * @param {Object} context
 * @returns {Function}
 */
function bindFn(fn, context) {
    return function boundFn() {
        return fn.apply(context, arguments);
    };
}

/**
 * let a boolean value also be a function that must return a boolean
 * this first item in args will be used as the context
 * @param {Boolean|Function} val
 * @param {Array} [args]
 * @returns {Boolean}
 */
function boolOrFn(val, args) {
    if (typeof val == TYPE_FUNCTION) {
        return val.apply(args ? args[0] || undefined : undefined, args);
    }
    return val;
}

/**
 * use the val2 when val1 is undefined
 * @param {*} val1
 * @param {*} val2
 * @returns {*}
 */
function ifUndefined(val1, val2) {
    return (val1 === undefined) ? val2 : val1;
}

/**
 * addEventListener with multiple events at once
 * @param {EventTarget} target
 * @param {String} types
 * @param {Function} handler
 */
function addEventListeners(target, types, handler) {
    each(splitStr(types), function(type) {
        target.addEventListener(type, handler, false);
    });
}

/**
 * removeEventListener with multiple events at once
 * @param {EventTarget} target
 * @param {String} types
 * @param {Function} handler
 */
function removeEventListeners(target, types, handler) {
    each(splitStr(types), function(type) {
        target.removeEventListener(type, handler, false);
    });
}

/**
 * find if a node is in the given parent
 * @method hasParent
 * @param {HTMLElement} node
 * @param {HTMLElement} parent
 * @return {Boolean} found
 */
function hasParent(node, parent) {
    while (node) {
        if (node == parent) {
            return true;
        }
        node = node.parentNode;
    }
    return false;
}

/**
 * small indexOf wrapper
 * @param {String} str
 * @param {String} find
 * @returns {Boolean} found
 */
function inStr(str, find) {
    return str.indexOf(find) > -1;
}

/**
 * split string on whitespace
 * @param {String} str
 * @returns {Array} words
 */
function splitStr(str) {
    return str.trim().split(/\s+/g);
}

/**
 * find if a array contains the object using indexOf or a simple polyFill
 * @param {Array} src
 * @param {String} find
 * @param {String} [findByKey]
 * @return {Boolean|Number} false when not found, or the index
 */
function inArray(src, find, findByKey) {
    if (src.indexOf && !findByKey) {
        return src.indexOf(find);
    } else {
        var i = 0;
        while (i < src.length) {
            if ((findByKey && src[i][findByKey] == find) || (!findByKey && src[i] === find)) {
                return i;
            }
            i++;
        }
        return -1;
    }
}

/**
 * convert array-like objects to real arrays
 * @param {Object} obj
 * @returns {Array}
 */
function toArray(obj) {
    return Array.prototype.slice.call(obj, 0);
}

/**
 * unique array with objects based on a key (like 'id') or just by the array's value
 * @param {Array} src [{id:1},{id:2},{id:1}]
 * @param {String} [key]
 * @param {Boolean} [sort=False]
 * @returns {Array} [{id:1},{id:2}]
 */
function uniqueArray(src, key, sort) {
    var results = [];
    var values = [];
    var i = 0;

    while (i < src.length) {
        var val = key ? src[i][key] : src[i];
        if (inArray(values, val) < 0) {
            results.push(src[i]);
        }
        values[i] = val;
        i++;
    }

    if (sort) {
        if (!key) {
            results = results.sort();
        } else {
            results = results.sort(function sortUniqueArray(a, b) {
                return a[key] > b[key];
            });
        }
    }

    return results;
}

/**
 * get the prefixed property
 * @param {Object} obj
 * @param {String} property
 * @returns {String|Undefined} prefixed
 */
function prefixed(obj, property) {
    var prefix, prop;
    var camelProp = property[0].toUpperCase() + property.slice(1);

    var i = 0;
    while (i < VENDOR_PREFIXES.length) {
        prefix = VENDOR_PREFIXES[i];
        prop = (prefix) ? prefix + camelProp : property;

        if (prop in obj) {
            return prop;
        }
        i++;
    }
    return undefined;
}

/**
 * get a unique id
 * @returns {number} uniqueId
 */
var _uniqueId = 1;
function uniqueId() {
    return _uniqueId++;
}

/**
 * get the window object of an element
 * @param {HTMLElement} element
 * @returns {DocumentView|Window}
 */
function getWindowForElement(element) {
    var doc = element.ownerDocument;
    return (doc.defaultView || doc.parentWindow);
}

var MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android/i;

var SUPPORT_TOUCH = ('ontouchstart' in window);
var SUPPORT_POINTER_EVENTS = prefixed(window, 'PointerEvent') !== undefined;
var SUPPORT_ONLY_TOUCH = SUPPORT_TOUCH && MOBILE_REGEX.test(navigator.userAgent);

var INPUT_TYPE_TOUCH = 'touch';
var INPUT_TYPE_PEN = 'pen';
var INPUT_TYPE_MOUSE = 'mouse';
var INPUT_TYPE_KINECT = 'kinect';

var COMPUTE_INTERVAL = 25;

var INPUT_START = 1;
var INPUT_MOVE = 2;
var INPUT_END = 4;
var INPUT_CANCEL = 8;

var DIRECTION_NONE = 1;
var DIRECTION_LEFT = 2;
var DIRECTION_RIGHT = 4;
var DIRECTION_UP = 8;
var DIRECTION_DOWN = 16;

var DIRECTION_HORIZONTAL = DIRECTION_LEFT | DIRECTION_RIGHT;
var DIRECTION_VERTICAL = DIRECTION_UP | DIRECTION_DOWN;
var DIRECTION_ALL = DIRECTION_HORIZONTAL | DIRECTION_VERTICAL;

var PROPS_XY = ['x', 'y'];
var PROPS_CLIENT_XY = ['clientX', 'clientY'];

/**
 * create new input type manager
 * @param {Manager} manager
 * @param {Function} callback
 * @returns {Input}
 * @constructor
 */
function Input(manager, callback) {
    var self = this;
    this.manager = manager;
    this.callback = callback;
    this.element = manager.element;
    this.target = manager.options.inputTarget;

    // smaller wrapper around the handler, for the scope and the enabled state of the manager,
    // so when disabled the input events are completely bypassed.
    this.domHandler = function(ev) {
        if (boolOrFn(manager.options.enable, [manager])) {
            self.handler(ev);
        }
    };

    this.init();

}

Input.prototype = {
    /**
     * should handle the inputEvent data and trigger the callback
     * @virtual
     */
    handler: function() { },

    /**
     * bind the events
     */
    init: function() {
        this.evEl && addEventListeners(this.element, this.evEl, this.domHandler);
        this.evTarget && addEventListeners(this.target, this.evTarget, this.domHandler);
        this.evWin && addEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
    },

    /**
     * unbind the events
     */
    destroy: function() {
        this.evEl && removeEventListeners(this.element, this.evEl, this.domHandler);
        this.evTarget && removeEventListeners(this.target, this.evTarget, this.domHandler);
        this.evWin && removeEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
    }
};

/**
 * create new input type manager
 * called by the Manager constructor
 * @param {Hammer} manager
 * @returns {Input}
 */
function createInputInstance(manager) {
    var Type;
    var inputClass = manager.options.inputClass;

    if (inputClass) {
        Type = inputClass;
    } else if (SUPPORT_POINTER_EVENTS) {
        Type = PointerEventInput;
    } else if (SUPPORT_ONLY_TOUCH) {
        Type = TouchInput;
    } else if (!SUPPORT_TOUCH) {
        Type = MouseInput;
    } else {
        Type = TouchMouseInput;
    }
    return new (Type)(manager, inputHandler);
}

/**
 * handle input events
 * @param {Manager} manager
 * @param {String} eventType
 * @param {Object} input
 */
function inputHandler(manager, eventType, input) {
    var pointersLen = input.pointers.length;
    var changedPointersLen = input.changedPointers.length;
    var isFirst = (eventType & INPUT_START && (pointersLen - changedPointersLen === 0));
    var isFinal = (eventType & (INPUT_END | INPUT_CANCEL) && (pointersLen - changedPointersLen === 0));

    input.isFirst = !!isFirst;
    input.isFinal = !!isFinal;

    if (isFirst) {
        manager.session = {};
    }

    // source event is the normalized value of the domEvents
    // like 'touchstart, mouseup, pointerdown'
    input.eventType = eventType;

    // compute scale, rotation etc
    computeInputData(manager, input);

    // emit secret event
    manager.emit('hammer.input', input);

    manager.recognize(input);
    manager.session.prevInput = input;
}

/**
 * extend the data with some usable properties like scale, rotate, velocity etc
 * @param {Object} manager
 * @param {Object} input
 */
function computeInputData(manager, input) {
    var session = manager.session;
    var pointers = input.pointers;
    var pointersLength = pointers.length;

    // store the first input to calculate the distance and direction
    if (!session.firstInput) {
        session.firstInput = simpleCloneInputData(input);
    }

    // to compute scale and rotation we need to store the multiple touches
    if (pointersLength > 1 && !session.firstMultiple) {
        session.firstMultiple = simpleCloneInputData(input);
    } else if (pointersLength === 1) {
        session.firstMultiple = false;
    }

    var firstInput = session.firstInput;
    var firstMultiple = session.firstMultiple;
    var offsetCenter = firstMultiple ? firstMultiple.center : firstInput.center;

    var center = input.center = getCenter(pointers);
    input.timeStamp = now();
    input.deltaTime = input.timeStamp - firstInput.timeStamp;

    input.angle = getAngle(offsetCenter, center);
    input.distance = getDistance(offsetCenter, center);

    computeDeltaXY(session, input);
    input.offsetDirection = getDirection(input.deltaX, input.deltaY);

    input.scale = firstMultiple ? getScale(firstMultiple.pointers, pointers) : 1;
    input.rotation = firstMultiple ? getRotation(firstMultiple.pointers, pointers) : 0;

    computeIntervalInputData(session, input);

    // find the correct target
    var target = manager.element;
    if (hasParent(input.srcEvent.target, target)) {
        target = input.srcEvent.target;
    }
    input.target = target;
}

function computeDeltaXY(session, input) {
    var center = input.center;
    var offset = session.offsetDelta || {};
    var prevDelta = session.prevDelta || {};
    var prevInput = session.prevInput || {};

    if (input.eventType === INPUT_START || prevInput.eventType === INPUT_END) {
        prevDelta = session.prevDelta = {
            x: prevInput.deltaX || 0,
            y: prevInput.deltaY || 0
        };

        offset = session.offsetDelta = {
            x: center.x,
            y: center.y
        };
    }

    input.deltaX = prevDelta.x + (center.x - offset.x);
    input.deltaY = prevDelta.y + (center.y - offset.y);
}

/**
 * velocity is calculated every x ms
 * @param {Object} session
 * @param {Object} input
 */
function computeIntervalInputData(session, input) {
    var last = session.lastInterval || input,
        deltaTime = input.timeStamp - last.timeStamp,
        velocity, velocityX, velocityY, direction;

    if (input.eventType != INPUT_CANCEL && (deltaTime > COMPUTE_INTERVAL || last.velocity === undefined)) {
        var deltaX = last.deltaX - input.deltaX;
        var deltaY = last.deltaY - input.deltaY;

        var v = getVelocity(deltaTime, deltaX, deltaY);
        velocityX = v.x;
        velocityY = v.y;
        velocity = (abs(v.x) > abs(v.y)) ? v.x : v.y;
        direction = getDirection(deltaX, deltaY);

        session.lastInterval = input;
    } else {
        // use latest velocity info if it doesn't overtake a minimum period
        velocity = last.velocity;
        velocityX = last.velocityX;
        velocityY = last.velocityY;
        direction = last.direction;
    }

    input.velocity = velocity;
    input.velocityX = velocityX;
    input.velocityY = velocityY;
    input.direction = direction;
}

/**
 * create a simple clone from the input used for storage of firstInput and firstMultiple
 * @param {Object} input
 * @returns {Object} clonedInputData
 */
function simpleCloneInputData(input) {
    // make a simple copy of the pointers because we will get a reference if we don't
    // we only need clientXY for the calculations
    var pointers = [];
    var i = 0;
    while (i < input.pointers.length) {
        pointers[i] = {
            clientX: round(input.pointers[i].clientX),
            clientY: round(input.pointers[i].clientY)
        };
        i++;
    }

    return {
        timeStamp: now(),
        pointers: pointers,
        center: getCenter(pointers),
        deltaX: input.deltaX,
        deltaY: input.deltaY
    };
}

/**
 * get the center of all the pointers
 * @param {Array} pointers
 * @return {Object} center contains `x` and `y` properties
 */
function getCenter(pointers) {
    var pointersLength = pointers.length;

    // no need to loop when only one touch
    if (pointersLength === 1) {
        return {
            x: round(pointers[0].clientX),
            y: round(pointers[0].clientY)
        };
    }

    var x = 0, y = 0, i = 0;
    while (i < pointersLength) {
        x += pointers[i].clientX;
        y += pointers[i].clientY;
        i++;
    }

    return {
        x: round(x / pointersLength),
        y: round(y / pointersLength)
    };
}

/**
 * calculate the velocity between two points. unit is in px per ms.
 * @param {Number} deltaTime
 * @param {Number} x
 * @param {Number} y
 * @return {Object} velocity `x` and `y`
 */
function getVelocity(deltaTime, x, y) {
    return {
        x: x / deltaTime || 0,
        y: y / deltaTime || 0
    };
}

/**
 * get the direction between two points
 * @param {Number} x
 * @param {Number} y
 * @return {Number} direction
 */
function getDirection(x, y) {
    if (x === y) {
        return DIRECTION_NONE;
    }

    if (abs(x) >= abs(y)) {
        return x > 0 ? DIRECTION_LEFT : DIRECTION_RIGHT;
    }
    return y > 0 ? DIRECTION_UP : DIRECTION_DOWN;
}

/**
 * calculate the absolute distance between two points
 * @param {Object} p1 {x, y}
 * @param {Object} p2 {x, y}
 * @param {Array} [props] containing x and y keys
 * @return {Number} distance
 */
function getDistance(p1, p2, props) {
    if (!props) {
        props = PROPS_XY;
    }
    var x = p2[props[0]] - p1[props[0]],
        y = p2[props[1]] - p1[props[1]];

    return Math.sqrt((x * x) + (y * y));
}

/**
 * calculate the angle between two coordinates
 * @param {Object} p1
 * @param {Object} p2
 * @param {Array} [props] containing x and y keys
 * @return {Number} angle
 */
function getAngle(p1, p2, props) {
    if (!props) {
        props = PROPS_XY;
    }
    var x = p2[props[0]] - p1[props[0]],
        y = p2[props[1]] - p1[props[1]];
    return Math.atan2(y, x) * 180 / Math.PI;
}

/**
 * calculate the rotation degrees between two pointersets
 * @param {Array} start array of pointers
 * @param {Array} end array of pointers
 * @return {Number} rotation
 */
function getRotation(start, end) {
    return getAngle(end[1], end[0], PROPS_CLIENT_XY) - getAngle(start[1], start[0], PROPS_CLIENT_XY);
}

/**
 * calculate the scale factor between two pointersets
 * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
 * @param {Array} start array of pointers
 * @param {Array} end array of pointers
 * @return {Number} scale
 */
function getScale(start, end) {
    return getDistance(end[0], end[1], PROPS_CLIENT_XY) / getDistance(start[0], start[1], PROPS_CLIENT_XY);
}

var MOUSE_INPUT_MAP = {
    mousedown: INPUT_START,
    mousemove: INPUT_MOVE,
    mouseup: INPUT_END
};

var MOUSE_ELEMENT_EVENTS = 'mousedown';
var MOUSE_WINDOW_EVENTS = 'mousemove mouseup';

/**
 * Mouse events input
 * @constructor
 * @extends Input
 */
function MouseInput() {
    this.evEl = MOUSE_ELEMENT_EVENTS;
    this.evWin = MOUSE_WINDOW_EVENTS;

    this.allow = true; // used by Input.TouchMouse to disable mouse events
    this.pressed = false; // mousedown state

    Input.apply(this, arguments);
}

inherit(MouseInput, Input, {
    /**
     * handle mouse events
     * @param {Object} ev
     */
    handler: function MEhandler(ev) {
        var eventType = MOUSE_INPUT_MAP[ev.type];

        // on start we want to have the left mouse button down
        if (eventType & INPUT_START && ev.button === 0) {
            this.pressed = true;
        }

        if (eventType & INPUT_MOVE && ev.which !== 1) {
            eventType = INPUT_END;
        }

        // mouse must be down, and mouse events are allowed (see the TouchMouse input)
        if (!this.pressed || !this.allow) {
            return;
        }

        if (eventType & INPUT_END) {
            this.pressed = false;
        }

        this.callback(this.manager, eventType, {
            pointers: [ev],
            changedPointers: [ev],
            pointerType: INPUT_TYPE_MOUSE,
            srcEvent: ev
        });
    }
});

var POINTER_INPUT_MAP = {
    pointerdown: INPUT_START,
    pointermove: INPUT_MOVE,
    pointerup: INPUT_END,
    pointercancel: INPUT_CANCEL,
    pointerout: INPUT_CANCEL
};

// in IE10 the pointer types is defined as an enum
var IE10_POINTER_TYPE_ENUM = {
    2: INPUT_TYPE_TOUCH,
    3: INPUT_TYPE_PEN,
    4: INPUT_TYPE_MOUSE,
    5: INPUT_TYPE_KINECT // see https://twitter.com/jacobrossi/status/480596438489890816
};

var POINTER_ELEMENT_EVENTS = 'pointerdown';
var POINTER_WINDOW_EVENTS = 'pointermove pointerup pointercancel';

// IE10 has prefixed support, and case-sensitive
if (window.MSPointerEvent) {
    POINTER_ELEMENT_EVENTS = 'MSPointerDown';
    POINTER_WINDOW_EVENTS = 'MSPointerMove MSPointerUp MSPointerCancel';
}

/**
 * Pointer events input
 * @constructor
 * @extends Input
 */
function PointerEventInput() {
    this.evEl = POINTER_ELEMENT_EVENTS;
    this.evWin = POINTER_WINDOW_EVENTS;

    Input.apply(this, arguments);

    this.store = (this.manager.session.pointerEvents = []);
}

inherit(PointerEventInput, Input, {
    /**
     * handle mouse events
     * @param {Object} ev
     */
    handler: function PEhandler(ev) {
        var store = this.store;
        var removePointer = false;

        var eventTypeNormalized = ev.type.toLowerCase().replace('ms', '');
        var eventType = POINTER_INPUT_MAP[eventTypeNormalized];
        var pointerType = IE10_POINTER_TYPE_ENUM[ev.pointerType] || ev.pointerType;

        var isTouch = (pointerType == INPUT_TYPE_TOUCH);

        // get index of the event in the store
        var storeIndex = inArray(store, ev.pointerId, 'pointerId');

        // start and mouse must be down
        if (eventType & INPUT_START && (ev.button === 0 || isTouch)) {
            if (storeIndex < 0) {
                store.push(ev);
                storeIndex = store.length - 1;
            }
        } else if (eventType & (INPUT_END | INPUT_CANCEL)) {
            removePointer = true;
        }

        // it not found, so the pointer hasn't been down (so it's probably a hover)
        if (storeIndex < 0) {
            return;
        }

        // update the event in the store
        store[storeIndex] = ev;

        this.callback(this.manager, eventType, {
            pointers: store,
            changedPointers: [ev],
            pointerType: pointerType,
            srcEvent: ev
        });

        if (removePointer) {
            // remove from the store
            store.splice(storeIndex, 1);
        }
    }
});

var SINGLE_TOUCH_INPUT_MAP = {
    touchstart: INPUT_START,
    touchmove: INPUT_MOVE,
    touchend: INPUT_END,
    touchcancel: INPUT_CANCEL
};

var SINGLE_TOUCH_TARGET_EVENTS = 'touchstart';
var SINGLE_TOUCH_WINDOW_EVENTS = 'touchstart touchmove touchend touchcancel';

/**
 * Touch events input
 * @constructor
 * @extends Input
 */
function SingleTouchInput() {
    this.evTarget = SINGLE_TOUCH_TARGET_EVENTS;
    this.evWin = SINGLE_TOUCH_WINDOW_EVENTS;
    this.started = false;

    Input.apply(this, arguments);
}

inherit(SingleTouchInput, Input, {
    handler: function TEhandler(ev) {
        var type = SINGLE_TOUCH_INPUT_MAP[ev.type];

        // should we handle the touch events?
        if (type === INPUT_START) {
            this.started = true;
        }

        if (!this.started) {
            return;
        }

        var touches = normalizeSingleTouches.call(this, ev, type);

        // when done, reset the started state
        if (type & (INPUT_END | INPUT_CANCEL) && touches[0].length - touches[1].length === 0) {
            this.started = false;
        }

        this.callback(this.manager, type, {
            pointers: touches[0],
            changedPointers: touches[1],
            pointerType: INPUT_TYPE_TOUCH,
            srcEvent: ev
        });
    }
});

/**
 * @this {TouchInput}
 * @param {Object} ev
 * @param {Number} type flag
 * @returns {undefined|Array} [all, changed]
 */
function normalizeSingleTouches(ev, type) {
    var all = toArray(ev.touches);
    var changed = toArray(ev.changedTouches);

    if (type & (INPUT_END | INPUT_CANCEL)) {
        all = uniqueArray(all.concat(changed), 'identifier', true);
    }

    return [all, changed];
}

var TOUCH_INPUT_MAP = {
    touchstart: INPUT_START,
    touchmove: INPUT_MOVE,
    touchend: INPUT_END,
    touchcancel: INPUT_CANCEL
};

var TOUCH_TARGET_EVENTS = 'touchstart touchmove touchend touchcancel';

/**
 * Multi-user touch events input
 * @constructor
 * @extends Input
 */
function TouchInput() {
    this.evTarget = TOUCH_TARGET_EVENTS;
    this.targetIds = {};

    Input.apply(this, arguments);
}

inherit(TouchInput, Input, {
    handler: function MTEhandler(ev) {
        var type = TOUCH_INPUT_MAP[ev.type];
        var touches = getTouches.call(this, ev, type);
        if (!touches) {
            return;
        }

        this.callback(this.manager, type, {
            pointers: touches[0],
            changedPointers: touches[1],
            pointerType: INPUT_TYPE_TOUCH,
            srcEvent: ev
        });
    }
});

/**
 * @this {TouchInput}
 * @param {Object} ev
 * @param {Number} type flag
 * @returns {undefined|Array} [all, changed]
 */
function getTouches(ev, type) {
    var allTouches = toArray(ev.touches);
    var targetIds = this.targetIds;

    // when there is only one touch, the process can be simplified
    if (type & (INPUT_START | INPUT_MOVE) && allTouches.length === 1) {
        targetIds[allTouches[0].identifier] = true;
        return [allTouches, allTouches];
    }

    var i,
        targetTouches,
        changedTouches = toArray(ev.changedTouches),
        changedTargetTouches = [],
        target = this.target;

    // get target touches from touches
    targetTouches = allTouches.filter(function(touch) {
        return hasParent(touch.target, target);
    });

    // collect touches
    if (type === INPUT_START) {
        i = 0;
        while (i < targetTouches.length) {
            targetIds[targetTouches[i].identifier] = true;
            i++;
        }
    }

    // filter changed touches to only contain touches that exist in the collected target ids
    i = 0;
    while (i < changedTouches.length) {
        if (targetIds[changedTouches[i].identifier]) {
            changedTargetTouches.push(changedTouches[i]);
        }

        // cleanup removed touches
        if (type & (INPUT_END | INPUT_CANCEL)) {
            delete targetIds[changedTouches[i].identifier];
        }
        i++;
    }

    if (!changedTargetTouches.length) {
        return;
    }

    return [
        // merge targetTouches with changedTargetTouches so it contains ALL touches, including 'end' and 'cancel'
        uniqueArray(targetTouches.concat(changedTargetTouches), 'identifier', true),
        changedTargetTouches
    ];
}

/**
 * Combined touch and mouse input
 *
 * Touch has a higher priority then mouse, and while touching no mouse events are allowed.
 * This because touch devices also emit mouse events while doing a touch.
 *
 * @constructor
 * @extends Input
 */
function TouchMouseInput() {
    Input.apply(this, arguments);

    var handler = bindFn(this.handler, this);
    this.touch = new TouchInput(this.manager, handler);
    this.mouse = new MouseInput(this.manager, handler);
}

inherit(TouchMouseInput, Input, {
    /**
     * handle mouse and touch events
     * @param {Hammer} manager
     * @param {String} inputEvent
     * @param {Object} inputData
     */
    handler: function TMEhandler(manager, inputEvent, inputData) {
        var isTouch = (inputData.pointerType == INPUT_TYPE_TOUCH),
            isMouse = (inputData.pointerType == INPUT_TYPE_MOUSE);

        // when we're in a touch event, so  block all upcoming mouse events
        // most mobile browser also emit mouseevents, right after touchstart
        if (isTouch) {
            this.mouse.allow = false;
        } else if (isMouse && !this.mouse.allow) {
            return;
        }

        // reset the allowMouse when we're done
        if (inputEvent & (INPUT_END | INPUT_CANCEL)) {
            this.mouse.allow = true;
        }

        this.callback(manager, inputEvent, inputData);
    },

    /**
     * remove the event listeners
     */
    destroy: function destroy() {
        this.touch.destroy();
        this.mouse.destroy();
    }
});

var PREFIXED_TOUCH_ACTION = prefixed(TEST_ELEMENT.style, 'touchAction');
var NATIVE_TOUCH_ACTION = PREFIXED_TOUCH_ACTION !== undefined;

// magical touchAction value
var TOUCH_ACTION_COMPUTE = 'compute';
var TOUCH_ACTION_AUTO = 'auto';
var TOUCH_ACTION_MANIPULATION = 'manipulation'; // not implemented
var TOUCH_ACTION_NONE = 'none';
var TOUCH_ACTION_PAN_X = 'pan-x';
var TOUCH_ACTION_PAN_Y = 'pan-y';

/**
 * Touch Action
 * sets the touchAction property or uses the js alternative
 * @param {Manager} manager
 * @param {String} value
 * @constructor
 */
function TouchAction(manager, value) {
    this.manager = manager;
    this.set(value);
}

TouchAction.prototype = {
    /**
     * set the touchAction value on the element or enable the polyfill
     * @param {String} value
     */
    set: function(value) {
        // find out the touch-action by the event handlers
        if (value == TOUCH_ACTION_COMPUTE) {
            value = this.compute();
        }

        if (NATIVE_TOUCH_ACTION) {
            this.manager.element.style[PREFIXED_TOUCH_ACTION] = value;
        }
        this.actions = value.toLowerCase().trim();
    },

    /**
     * just re-set the touchAction value
     */
    update: function() {
        this.set(this.manager.options.touchAction);
    },

    /**
     * compute the value for the touchAction property based on the recognizer's settings
     * @returns {String} value
     */
    compute: function() {
        var actions = [];
        each(this.manager.recognizers, function(recognizer) {
            if (boolOrFn(recognizer.options.enable, [recognizer])) {
                actions = actions.concat(recognizer.getTouchAction());
            }
        });
        return cleanTouchActions(actions.join(' '));
    },

    /**
     * this method is called on each input cycle and provides the preventing of the browser behavior
     * @param {Object} input
     */
    preventDefaults: function(input) {
        // not needed with native support for the touchAction property
        if (NATIVE_TOUCH_ACTION) {
            return;
        }

        var srcEvent = input.srcEvent;
        var direction = input.offsetDirection;

        // if the touch action did prevented once this session
        if (this.manager.session.prevented) {
            srcEvent.preventDefault();
            return;
        }

        var actions = this.actions;
        var hasNone = inStr(actions, TOUCH_ACTION_NONE);
        var hasPanY = inStr(actions, TOUCH_ACTION_PAN_Y);
        var hasPanX = inStr(actions, TOUCH_ACTION_PAN_X);

        if (hasNone ||
            (hasPanY && direction & DIRECTION_HORIZONTAL) ||
            (hasPanX && direction & DIRECTION_VERTICAL)) {
            return this.preventSrc(srcEvent);
        }
    },

    /**
     * call preventDefault to prevent the browser's default behavior (scrolling in most cases)
     * @param {Object} srcEvent
     */
    preventSrc: function(srcEvent) {
        this.manager.session.prevented = true;
        srcEvent.preventDefault();
    }
};

/**
 * when the touchActions are collected they are not a valid value, so we need to clean things up. *
 * @param {String} actions
 * @returns {*}
 */
function cleanTouchActions(actions) {
    // none
    if (inStr(actions, TOUCH_ACTION_NONE)) {
        return TOUCH_ACTION_NONE;
    }

    var hasPanX = inStr(actions, TOUCH_ACTION_PAN_X);
    var hasPanY = inStr(actions, TOUCH_ACTION_PAN_Y);

    // pan-x and pan-y can be combined
    if (hasPanX && hasPanY) {
        return TOUCH_ACTION_PAN_X + ' ' + TOUCH_ACTION_PAN_Y;
    }

    // pan-x OR pan-y
    if (hasPanX || hasPanY) {
        return hasPanX ? TOUCH_ACTION_PAN_X : TOUCH_ACTION_PAN_Y;
    }

    // manipulation
    if (inStr(actions, TOUCH_ACTION_MANIPULATION)) {
        return TOUCH_ACTION_MANIPULATION;
    }

    return TOUCH_ACTION_AUTO;
}

/**
 * Recognizer flow explained; *
 * All recognizers have the initial state of POSSIBLE when a input session starts.
 * The definition of a input session is from the first input until the last input, with all it's movement in it. *
 * Example session for mouse-input: mousedown -> mousemove -> mouseup
 *
 * On each recognizing cycle (see Manager.recognize) the .recognize() method is executed
 * which determines with state it should be.
 *
 * If the recognizer has the state FAILED, CANCELLED or RECOGNIZED (equals ENDED), it is reset to
 * POSSIBLE to give it another change on the next cycle.
 *
 *               Possible
 *                  |
 *            +-----+---------------+
 *            |                     |
 *      +-----+-----+               |
 *      |           |               |
 *   Failed      Cancelled          |
 *                          +-------+------+
 *                          |              |
 *                      Recognized       Began
 *                                         |
 *                                      Changed
 *                                         |
 *                                  Ended/Recognized
 */
var STATE_POSSIBLE = 1;
var STATE_BEGAN = 2;
var STATE_CHANGED = 4;
var STATE_ENDED = 8;
var STATE_RECOGNIZED = STATE_ENDED;
var STATE_CANCELLED = 16;
var STATE_FAILED = 32;

/**
 * Recognizer
 * Every recognizer needs to extend from this class.
 * @constructor
 * @param {Object} options
 */
function Recognizer(options) {
    this.id = uniqueId();

    this.manager = null;
    this.options = merge(options || {}, this.defaults);

    // default is enable true
    this.options.enable = ifUndefined(this.options.enable, true);

    this.state = STATE_POSSIBLE;

    this.simultaneous = {};
    this.requireFail = [];
}

Recognizer.prototype = {
    /**
     * @virtual
     * @type {Object}
     */
    defaults: {},

    /**
     * set options
     * @param {Object} options
     * @return {Recognizer}
     */
    set: function(options) {
        extend(this.options, options);

        // also update the touchAction, in case something changed about the directions/enabled state
        this.manager && this.manager.touchAction.update();
        return this;
    },

    /**
     * recognize simultaneous with an other recognizer.
     * @param {Recognizer} otherRecognizer
     * @returns {Recognizer} this
     */
    recognizeWith: function(otherRecognizer) {
        if (invokeArrayArg(otherRecognizer, 'recognizeWith', this)) {
            return this;
        }

        var simultaneous = this.simultaneous;
        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        if (!simultaneous[otherRecognizer.id]) {
            simultaneous[otherRecognizer.id] = otherRecognizer;
            otherRecognizer.recognizeWith(this);
        }
        return this;
    },

    /**
     * drop the simultaneous link. it doesnt remove the link on the other recognizer.
     * @param {Recognizer} otherRecognizer
     * @returns {Recognizer} this
     */
    dropRecognizeWith: function(otherRecognizer) {
        if (invokeArrayArg(otherRecognizer, 'dropRecognizeWith', this)) {
            return this;
        }

        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        delete this.simultaneous[otherRecognizer.id];
        return this;
    },

    /**
     * recognizer can only run when an other is failing
     * @param {Recognizer} otherRecognizer
     * @returns {Recognizer} this
     */
    requireFailure: function(otherRecognizer) {
        if (invokeArrayArg(otherRecognizer, 'requireFailure', this)) {
            return this;
        }

        var requireFail = this.requireFail;
        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        if (inArray(requireFail, otherRecognizer) === -1) {
            requireFail.push(otherRecognizer);
            otherRecognizer.requireFailure(this);
        }
        return this;
    },

    /**
     * drop the requireFailure link. it does not remove the link on the other recognizer.
     * @param {Recognizer} otherRecognizer
     * @returns {Recognizer} this
     */
    dropRequireFailure: function(otherRecognizer) {
        if (invokeArrayArg(otherRecognizer, 'dropRequireFailure', this)) {
            return this;
        }

        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        var index = inArray(this.requireFail, otherRecognizer);
        if (index > -1) {
            this.requireFail.splice(index, 1);
        }
        return this;
    },

    /**
     * has require failures boolean
     * @returns {boolean}
     */
    hasRequireFailures: function() {
        return this.requireFail.length > 0;
    },

    /**
     * if the recognizer can recognize simultaneous with an other recognizer
     * @param {Recognizer} otherRecognizer
     * @returns {Boolean}
     */
    canRecognizeWith: function(otherRecognizer) {
        return !!this.simultaneous[otherRecognizer.id];
    },

    /**
     * You should use `tryEmit` instead of `emit` directly to check
     * that all the needed recognizers has failed before emitting.
     * @param {Object} input
     */
    emit: function(input) {
        var self = this;
        var state = this.state;

        function emit(withState) {
            self.manager.emit(self.options.event + (withState ? stateStr(state) : ''), input);
        }

        // 'panstart' and 'panmove'
        if (state < STATE_ENDED) {
            emit(true);
        }

        emit(); // simple 'eventName' events

        // panend and pancancel
        if (state >= STATE_ENDED) {
            emit(true);
        }
    },

    /**
     * Check that all the require failure recognizers has failed,
     * if true, it emits a gesture event,
     * otherwise, setup the state to FAILED.
     * @param {Object} input
     */
    tryEmit: function(input) {
        if (this.canEmit()) {
            return this.emit(input);
        }
        // it's failing anyway
        this.state = STATE_FAILED;
    },

    /**
     * can we emit?
     * @returns {boolean}
     */
    canEmit: function() {
        var i = 0;
        while (i < this.requireFail.length) {
            if (!(this.requireFail[i].state & (STATE_FAILED | STATE_POSSIBLE))) {
                return false;
            }
            i++;
        }
        return true;
    },

    /**
     * update the recognizer
     * @param {Object} inputData
     */
    recognize: function(inputData) {
        // make a new copy of the inputData
        // so we can change the inputData without messing up the other recognizers
        var inputDataClone = extend({}, inputData);

        // is is enabled and allow recognizing?
        if (!boolOrFn(this.options.enable, [this, inputDataClone])) {
            this.reset();
            this.state = STATE_FAILED;
            return;
        }

        // reset when we've reached the end
        if (this.state & (STATE_RECOGNIZED | STATE_CANCELLED | STATE_FAILED)) {
            this.state = STATE_POSSIBLE;
        }

        this.state = this.process(inputDataClone);

        // the recognizer has recognized a gesture
        // so trigger an event
        if (this.state & (STATE_BEGAN | STATE_CHANGED | STATE_ENDED | STATE_CANCELLED)) {
            this.tryEmit(inputDataClone);
        }
    },

    /**
     * return the state of the recognizer
     * the actual recognizing happens in this method
     * @virtual
     * @param {Object} inputData
     * @returns {Const} STATE
     */
    process: function(inputData) { }, // jshint ignore:line

    /**
     * return the preferred touch-action
     * @virtual
     * @returns {Array}
     */
    getTouchAction: function() { },

    /**
     * called when the gesture isn't allowed to recognize
     * like when another is being recognized or it is disabled
     * @virtual
     */
    reset: function() { }
};

/**
 * get a usable string, used as event postfix
 * @param {Const} state
 * @returns {String} state
 */
function stateStr(state) {
    if (state & STATE_CANCELLED) {
        return 'cancel';
    } else if (state & STATE_ENDED) {
        return 'end';
    } else if (state & STATE_CHANGED) {
        return 'move';
    } else if (state & STATE_BEGAN) {
        return 'start';
    }
    return '';
}

/**
 * direction cons to string
 * @param {Const} direction
 * @returns {String}
 */
function directionStr(direction) {
    if (direction == DIRECTION_DOWN) {
        return 'down';
    } else if (direction == DIRECTION_UP) {
        return 'up';
    } else if (direction == DIRECTION_LEFT) {
        return 'left';
    } else if (direction == DIRECTION_RIGHT) {
        return 'right';
    }
    return '';
}

/**
 * get a recognizer by name if it is bound to a manager
 * @param {Recognizer|String} otherRecognizer
 * @param {Recognizer} recognizer
 * @returns {Recognizer}
 */
function getRecognizerByNameIfManager(otherRecognizer, recognizer) {
    var manager = recognizer.manager;
    if (manager) {
        return manager.get(otherRecognizer);
    }
    return otherRecognizer;
}

/**
 * This recognizer is just used as a base for the simple attribute recognizers.
 * @constructor
 * @extends Recognizer
 */
function AttrRecognizer() {
    Recognizer.apply(this, arguments);
}

inherit(AttrRecognizer, Recognizer, {
    /**
     * @namespace
     * @memberof AttrRecognizer
     */
    defaults: {
        /**
         * @type {Number}
         * @default 1
         */
        pointers: 1
    },

    /**
     * Used to check if it the recognizer receives valid input, like input.distance > 10.
     * @memberof AttrRecognizer
     * @param {Object} input
     * @returns {Boolean} recognized
     */
    attrTest: function(input) {
        var optionPointers = this.options.pointers;
        return optionPointers === 0 || input.pointers.length === optionPointers;
    },

    /**
     * Process the input and return the state for the recognizer
     * @memberof AttrRecognizer
     * @param {Object} input
     * @returns {*} State
     */
    process: function(input) {
        var state = this.state;
        var eventType = input.eventType;

        var isRecognized = state & (STATE_BEGAN | STATE_CHANGED);
        var isValid = this.attrTest(input);

        // on cancel input and we've recognized before, return STATE_CANCELLED
        if (isRecognized && (eventType & INPUT_CANCEL || !isValid)) {
            return state | STATE_CANCELLED;
        } else if (isRecognized || isValid) {
            if (eventType & INPUT_END) {
                return state | STATE_ENDED;
            } else if (!(state & STATE_BEGAN)) {
                return STATE_BEGAN;
            }
            return state | STATE_CHANGED;
        }
        return STATE_FAILED;
    }
});

/**
 * Pan
 * Recognized when the pointer is down and moved in the allowed direction.
 * @constructor
 * @extends AttrRecognizer
 */
function PanRecognizer() {
    AttrRecognizer.apply(this, arguments);

    this.pX = null;
    this.pY = null;
}

inherit(PanRecognizer, AttrRecognizer, {
    /**
     * @namespace
     * @memberof PanRecognizer
     */
    defaults: {
        event: 'pan',
        threshold: 10,
        pointers: 1,
        direction: DIRECTION_ALL
    },

    getTouchAction: function() {
        var direction = this.options.direction;
        var actions = [];
        if (direction & DIRECTION_HORIZONTAL) {
            actions.push(TOUCH_ACTION_PAN_Y);
        }
        if (direction & DIRECTION_VERTICAL) {
            actions.push(TOUCH_ACTION_PAN_X);
        }
        return actions;
    },

    directionTest: function(input) {
        var options = this.options;
        var hasMoved = true;
        var distance = input.distance;
        var direction = input.direction;
        var x = input.deltaX;
        var y = input.deltaY;

        // lock to axis?
        if (!(direction & options.direction)) {
            if (options.direction & DIRECTION_HORIZONTAL) {
                direction = (x === 0) ? DIRECTION_NONE : (x < 0) ? DIRECTION_LEFT : DIRECTION_RIGHT;
                hasMoved = x != this.pX;
                distance = Math.abs(input.deltaX);
            } else {
                direction = (y === 0) ? DIRECTION_NONE : (y < 0) ? DIRECTION_UP : DIRECTION_DOWN;
                hasMoved = y != this.pY;
                distance = Math.abs(input.deltaY);
            }
        }
        input.direction = direction;
        return hasMoved && distance > options.threshold && direction & options.direction;
    },

    attrTest: function(input) {
        return AttrRecognizer.prototype.attrTest.call(this, input) &&
            (this.state & STATE_BEGAN || (!(this.state & STATE_BEGAN) && this.directionTest(input)));
    },

    emit: function(input) {
        this.pX = input.deltaX;
        this.pY = input.deltaY;

        var direction = directionStr(input.direction);
        if (direction) {
            this.manager.emit(this.options.event + direction, input);
        }

        this._super.emit.call(this, input);
    }
});

/**
 * Pinch
 * Recognized when two or more pointers are moving toward (zoom-in) or away from each other (zoom-out).
 * @constructor
 * @extends AttrRecognizer
 */
function PinchRecognizer() {
    AttrRecognizer.apply(this, arguments);
}

inherit(PinchRecognizer, AttrRecognizer, {
    /**
     * @namespace
     * @memberof PinchRecognizer
     */
    defaults: {
        event: 'pinch',
        threshold: 0,
        pointers: 2
    },

    getTouchAction: function() {
        return [TOUCH_ACTION_NONE];
    },

    attrTest: function(input) {
        return this._super.attrTest.call(this, input) &&
            (Math.abs(input.scale - 1) > this.options.threshold || this.state & STATE_BEGAN);
    },

    emit: function(input) {
        this._super.emit.call(this, input);
        if (input.scale !== 1) {
            var inOut = input.scale < 1 ? 'in' : 'out';
            this.manager.emit(this.options.event + inOut, input);
        }
    }
});

/**
 * Press
 * Recognized when the pointer is down for x ms without any movement.
 * @constructor
 * @extends Recognizer
 */
function PressRecognizer() {
    Recognizer.apply(this, arguments);

    this._timer = null;
    this._input = null;
}

inherit(PressRecognizer, Recognizer, {
    /**
     * @namespace
     * @memberof PressRecognizer
     */
    defaults: {
        event: 'press',
        pointers: 1,
        time: 500, // minimal time of the pointer to be pressed
        threshold: 5 // a minimal movement is ok, but keep it low
    },

    getTouchAction: function() {
        return [TOUCH_ACTION_AUTO];
    },

    process: function(input) {
        var options = this.options;
        var validPointers = input.pointers.length === options.pointers;
        var validMovement = input.distance < options.threshold;
        var validTime = input.deltaTime > options.time;

        this._input = input;

        // we only allow little movement
        // and we've reached an end event, so a tap is possible
        if (!validMovement || !validPointers || (input.eventType & (INPUT_END | INPUT_CANCEL) && !validTime)) {
            this.reset();
        } else if (input.eventType & INPUT_START) {
            this.reset();
            this._timer = setTimeoutContext(function() {
                this.state = STATE_RECOGNIZED;
                this.tryEmit();
            }, options.time, this);
        } else if (input.eventType & INPUT_END) {
            return STATE_RECOGNIZED;
        }
        return STATE_FAILED;
    },

    reset: function() {
        clearTimeout(this._timer);
    },

    emit: function(input) {
        if (this.state !== STATE_RECOGNIZED) {
            return;
        }

        if (input && (input.eventType & INPUT_END)) {
            this.manager.emit(this.options.event + 'up', input);
        } else {
            this._input.timeStamp = now();
            this.manager.emit(this.options.event, this._input);
        }
    }
});

/**
 * Rotate
 * Recognized when two or more pointer are moving in a circular motion.
 * @constructor
 * @extends AttrRecognizer
 */
function RotateRecognizer() {
    AttrRecognizer.apply(this, arguments);
}

inherit(RotateRecognizer, AttrRecognizer, {
    /**
     * @namespace
     * @memberof RotateRecognizer
     */
    defaults: {
        event: 'rotate',
        threshold: 0,
        pointers: 2
    },

    getTouchAction: function() {
        return [TOUCH_ACTION_NONE];
    },

    attrTest: function(input) {
        return this._super.attrTest.call(this, input) &&
            (Math.abs(input.rotation) > this.options.threshold || this.state & STATE_BEGAN);
    }
});

/**
 * Swipe
 * Recognized when the pointer is moving fast (velocity), with enough distance in the allowed direction.
 * @constructor
 * @extends AttrRecognizer
 */
function SwipeRecognizer() {
    AttrRecognizer.apply(this, arguments);
}

inherit(SwipeRecognizer, AttrRecognizer, {
    /**
     * @namespace
     * @memberof SwipeRecognizer
     */
    defaults: {
        event: 'swipe',
        threshold: 10,
        velocity: 0.65,
        direction: DIRECTION_HORIZONTAL | DIRECTION_VERTICAL,
        pointers: 1
    },

    getTouchAction: function() {
        return PanRecognizer.prototype.getTouchAction.call(this);
    },

    attrTest: function(input) {
        var direction = this.options.direction;
        var velocity;

        if (direction & (DIRECTION_HORIZONTAL | DIRECTION_VERTICAL)) {
            velocity = input.velocity;
        } else if (direction & DIRECTION_HORIZONTAL) {
            velocity = input.velocityX;
        } else if (direction & DIRECTION_VERTICAL) {
            velocity = input.velocityY;
        }

        return this._super.attrTest.call(this, input) &&
            direction & input.direction &&
            input.distance > this.options.threshold &&
            abs(velocity) > this.options.velocity && input.eventType & INPUT_END;
    },

    emit: function(input) {
        var direction = directionStr(input.direction);
        if (direction) {
            this.manager.emit(this.options.event + direction, input);
        }

        this.manager.emit(this.options.event, input);
    }
});

/**
 * A tap is ecognized when the pointer is doing a small tap/click. Multiple taps are recognized if they occur
 * between the given interval and position. The delay option can be used to recognize multi-taps without firing
 * a single tap.
 *
 * The eventData from the emitted event contains the property `tapCount`, which contains the amount of
 * multi-taps being recognized.
 * @constructor
 * @extends Recognizer
 */
function TapRecognizer() {
    Recognizer.apply(this, arguments);

    // previous time and center,
    // used for tap counting
    this.pTime = false;
    this.pCenter = false;

    this._timer = null;
    this._input = null;
    this.count = 0;
}

inherit(TapRecognizer, Recognizer, {
    /**
     * @namespace
     * @memberof PinchRecognizer
     */
    defaults: {
        event: 'tap',
        pointers: 1,
        taps: 1,
        interval: 300, // max time between the multi-tap taps
        time: 250, // max time of the pointer to be down (like finger on the screen)
        threshold: 2, // a minimal movement is ok, but keep it low
        posThreshold: 10 // a multi-tap can be a bit off the initial position
    },

    getTouchAction: function() {
        return [TOUCH_ACTION_MANIPULATION];
    },

    process: function(input) {
        var options = this.options;

        var validPointers = input.pointers.length === options.pointers;
        var validMovement = input.distance < options.threshold;
        var validTouchTime = input.deltaTime < options.time;

        this.reset();

        if ((input.eventType & INPUT_START) && (this.count === 0)) {
            return this.failTimeout();
        }

        // we only allow little movement
        // and we've reached an end event, so a tap is possible
        if (validMovement && validTouchTime && validPointers) {
            if (input.eventType != INPUT_END) {
                return this.failTimeout();
            }

            var validInterval = this.pTime ? (input.timeStamp - this.pTime < options.interval) : true;
            var validMultiTap = !this.pCenter || getDistance(this.pCenter, input.center) < options.posThreshold;

            this.pTime = input.timeStamp;
            this.pCenter = input.center;

            if (!validMultiTap || !validInterval) {
                this.count = 1;
            } else {
                this.count += 1;
            }

            this._input = input;

            // if tap count matches we have recognized it,
            // else it has began recognizing...
            var tapCount = this.count % options.taps;
            if (tapCount === 0) {
                // no failing requirements, immediately trigger the tap event
                // or wait as long as the multitap interval to trigger
                if (!this.hasRequireFailures()) {
                    return STATE_RECOGNIZED;
                } else {
                    this._timer = setTimeoutContext(function() {
                        this.state = STATE_RECOGNIZED;
                        this.tryEmit();
                    }, options.interval, this);
                    return STATE_BEGAN;
                }
            }
        }
        return STATE_FAILED;
    },

    failTimeout: function() {
        this._timer = setTimeoutContext(function() {
            this.state = STATE_FAILED;
        }, this.options.interval, this);
        return STATE_FAILED;
    },

    reset: function() {
        clearTimeout(this._timer);
    },

    emit: function() {
        if (this.state == STATE_RECOGNIZED ) {
            this._input.tapCount = this.count;
            this.manager.emit(this.options.event, this._input);
        }
    }
});

/**
 * Simple way to create an manager with a default set of recognizers.
 * @param {HTMLElement} element
 * @param {Object} [options]
 * @constructor
 */
function Hammer(element, options) {
    options = options || {};
    options.recognizers = ifUndefined(options.recognizers, Hammer.defaults.preset);
    return new Manager(element, options);
}

/**
 * @const {string}
 */
Hammer.VERSION = '2.0.4';

/**
 * default settings
 * @namespace
 */
Hammer.defaults = {
    /**
     * set if DOM events are being triggered.
     * But this is slower and unused by simple implementations, so disabled by default.
     * @type {Boolean}
     * @default false
     */
    domEvents: false,

    /**
     * The value for the touchAction property/fallback.
     * When set to `compute` it will magically set the correct value based on the added recognizers.
     * @type {String}
     * @default compute
     */
    touchAction: TOUCH_ACTION_COMPUTE,

    /**
     * @type {Boolean}
     * @default true
     */
    enable: true,

    /**
     * EXPERIMENTAL FEATURE -- can be removed/changed
     * Change the parent input target element.
     * If Null, then it is being set the to main element.
     * @type {Null|EventTarget}
     * @default null
     */
    inputTarget: null,

    /**
     * force an input class
     * @type {Null|Function}
     * @default null
     */
    inputClass: null,

    /**
     * Default recognizer setup when calling `Hammer()`
     * When creating a new Manager these will be skipped.
     * @type {Array}
     */
    preset: [
        // RecognizerClass, options, [recognizeWith, ...], [requireFailure, ...]
        [RotateRecognizer, { enable: false }],
        [PinchRecognizer, { enable: false }, ['rotate']],
        [SwipeRecognizer,{ direction: DIRECTION_HORIZONTAL }],
        [PanRecognizer, { direction: DIRECTION_HORIZONTAL }, ['swipe']],
        [TapRecognizer],
        [TapRecognizer, { event: 'doubletap', taps: 2 }, ['tap']],
        [PressRecognizer]
    ],

    /**
     * Some CSS properties can be used to improve the working of Hammer.
     * Add them to this method and they will be set when creating a new Manager.
     * @namespace
     */
    cssProps: {
        /**
         * Disables text selection to improve the dragging gesture. Mainly for desktop browsers.
         * @type {String}
         * @default 'none'
         */
        userSelect: 'none',

        /**
         * Disable the Windows Phone grippers when pressing an element.
         * @type {String}
         * @default 'none'
         */
        touchSelect: 'none',

        /**
         * Disables the default callout shown when you touch and hold a touch target.
         * On iOS, when you touch and hold a touch target such as a link, Safari displays
         * a callout containing information about the link. This property allows you to disable that callout.
         * @type {String}
         * @default 'none'
         */
        touchCallout: 'none',

        /**
         * Specifies whether zooming is enabled. Used by IE10>
         * @type {String}
         * @default 'none'
         */
        contentZooming: 'none',

        /**
         * Specifies that an entire element should be draggable instead of its contents. Mainly for desktop browsers.
         * @type {String}
         * @default 'none'
         */
        userDrag: 'none',

        /**
         * Overrides the highlight color shown when the user taps a link or a JavaScript
         * clickable element in iOS. This property obeys the alpha value, if specified.
         * @type {String}
         * @default 'rgba(0,0,0,0)'
         */
        tapHighlightColor: 'rgba(0,0,0,0)'
    }
};

var STOP = 1;
var FORCED_STOP = 2;

/**
 * Manager
 * @param {HTMLElement} element
 * @param {Object} [options]
 * @constructor
 */
function Manager(element, options) {
    options = options || {};

    this.options = merge(options, Hammer.defaults);
    this.options.inputTarget = this.options.inputTarget || element;

    this.handlers = {};
    this.session = {};
    this.recognizers = [];

    this.element = element;
    this.input = createInputInstance(this);
    this.touchAction = new TouchAction(this, this.options.touchAction);

    toggleCssProps(this, true);

    each(options.recognizers, function(item) {
        var recognizer = this.add(new (item[0])(item[1]));
        item[2] && recognizer.recognizeWith(item[2]);
        item[3] && recognizer.requireFailure(item[3]);
    }, this);
}

Manager.prototype = {
    /**
     * set options
     * @param {Object} options
     * @returns {Manager}
     */
    set: function(options) {
        extend(this.options, options);

        // Options that need a little more setup
        if (options.touchAction) {
            this.touchAction.update();
        }
        if (options.inputTarget) {
            // Clean up existing event listeners and reinitialize
            this.input.destroy();
            this.input.target = options.inputTarget;
            this.input.init();
        }
        return this;
    },

    /**
     * stop recognizing for this session.
     * This session will be discarded, when a new [input]start event is fired.
     * When forced, the recognizer cycle is stopped immediately.
     * @param {Boolean} [force]
     */
    stop: function(force) {
        this.session.stopped = force ? FORCED_STOP : STOP;
    },

    /**
     * run the recognizers!
     * called by the inputHandler function on every movement of the pointers (touches)
     * it walks through all the recognizers and tries to detect the gesture that is being made
     * @param {Object} inputData
     */
    recognize: function(inputData) {
        var session = this.session;
        if (session.stopped) {
            return;
        }

        // run the touch-action polyfill
        this.touchAction.preventDefaults(inputData);

        var recognizer;
        var recognizers = this.recognizers;

        // this holds the recognizer that is being recognized.
        // so the recognizer's state needs to be BEGAN, CHANGED, ENDED or RECOGNIZED
        // if no recognizer is detecting a thing, it is set to `null`
        var curRecognizer = session.curRecognizer;

        // reset when the last recognizer is recognized
        // or when we're in a new session
        if (!curRecognizer || (curRecognizer && curRecognizer.state & STATE_RECOGNIZED)) {
            curRecognizer = session.curRecognizer = null;
        }

        var i = 0;
        while (i < recognizers.length) {
            recognizer = recognizers[i];

            // find out if we are allowed try to recognize the input for this one.
            // 1.   allow if the session is NOT forced stopped (see the .stop() method)
            // 2.   allow if we still haven't recognized a gesture in this session, or the this recognizer is the one
            //      that is being recognized.
            // 3.   allow if the recognizer is allowed to run simultaneous with the current recognized recognizer.
            //      this can be setup with the `recognizeWith()` method on the recognizer.
            if (session.stopped !== FORCED_STOP && ( // 1
                    !curRecognizer || recognizer == curRecognizer || // 2
                    recognizer.canRecognizeWith(curRecognizer))) { // 3
                recognizer.recognize(inputData);
            } else {
                recognizer.reset();
            }

            // if the recognizer has been recognizing the input as a valid gesture, we want to store this one as the
            // current active recognizer. but only if we don't already have an active recognizer
            if (!curRecognizer && recognizer.state & (STATE_BEGAN | STATE_CHANGED | STATE_ENDED)) {
                curRecognizer = session.curRecognizer = recognizer;
            }
            i++;
        }
    },

    /**
     * get a recognizer by its event name.
     * @param {Recognizer|String} recognizer
     * @returns {Recognizer|Null}
     */
    get: function(recognizer) {
        if (recognizer instanceof Recognizer) {
            return recognizer;
        }

        var recognizers = this.recognizers;
        for (var i = 0; i < recognizers.length; i++) {
            if (recognizers[i].options.event == recognizer) {
                return recognizers[i];
            }
        }
        return null;
    },

    /**
     * add a recognizer to the manager
     * existing recognizers with the same event name will be removed
     * @param {Recognizer} recognizer
     * @returns {Recognizer|Manager}
     */
    add: function(recognizer) {
        if (invokeArrayArg(recognizer, 'add', this)) {
            return this;
        }

        // remove existing
        var existing = this.get(recognizer.options.event);
        if (existing) {
            this.remove(existing);
        }

        this.recognizers.push(recognizer);
        recognizer.manager = this;

        this.touchAction.update();
        return recognizer;
    },

    /**
     * remove a recognizer by name or instance
     * @param {Recognizer|String} recognizer
     * @returns {Manager}
     */
    remove: function(recognizer) {
        if (invokeArrayArg(recognizer, 'remove', this)) {
            return this;
        }

        var recognizers = this.recognizers;
        recognizer = this.get(recognizer);
        recognizers.splice(inArray(recognizers, recognizer), 1);

        this.touchAction.update();
        return this;
    },

    /**
     * bind event
     * @param {String} events
     * @param {Function} handler
     * @returns {EventEmitter} this
     */
    on: function(events, handler) {
        var handlers = this.handlers;
        each(splitStr(events), function(event) {
            handlers[event] = handlers[event] || [];
            handlers[event].push(handler);
        });
        return this;
    },

    /**
     * unbind event, leave emit blank to remove all handlers
     * @param {String} events
     * @param {Function} [handler]
     * @returns {EventEmitter} this
     */
    off: function(events, handler) {
        var handlers = this.handlers;
        each(splitStr(events), function(event) {
            if (!handler) {
                delete handlers[event];
            } else {
                handlers[event].splice(inArray(handlers[event], handler), 1);
            }
        });
        return this;
    },

    /**
     * emit event to the listeners
     * @param {String} event
     * @param {Object} data
     */
    emit: function(event, data) {
        // we also want to trigger dom events
        if (this.options.domEvents) {
            triggerDomEvent(event, data);
        }

        // no handlers, so skip it all
        var handlers = this.handlers[event] && this.handlers[event].slice();
        if (!handlers || !handlers.length) {
            return;
        }

        data.type = event;
        data.preventDefault = function() {
            data.srcEvent.preventDefault();
        };

        var i = 0;
        while (i < handlers.length) {
            handlers[i](data);
            i++;
        }
    },

    /**
     * destroy the manager and unbinds all events
     * it doesn't unbind dom events, that is the user own responsibility
     */
    destroy: function() {
        this.element && toggleCssProps(this, false);

        this.handlers = {};
        this.session = {};
        this.input.destroy();
        this.element = null;
    }
};

/**
 * add/remove the css properties as defined in manager.options.cssProps
 * @param {Manager} manager
 * @param {Boolean} add
 */
function toggleCssProps(manager, add) {
    var element = manager.element;
    each(manager.options.cssProps, function(value, name) {
        element.style[prefixed(element.style, name)] = add ? value : '';
    });
}

/**
 * trigger dom event
 * @param {String} event
 * @param {Object} data
 */
function triggerDomEvent(event, data) {
    var gestureEvent = document.createEvent('Event');
    gestureEvent.initEvent(event, true, true);
    gestureEvent.gesture = data;
    data.target.dispatchEvent(gestureEvent);
}

extend(Hammer, {
    INPUT_START: INPUT_START,
    INPUT_MOVE: INPUT_MOVE,
    INPUT_END: INPUT_END,
    INPUT_CANCEL: INPUT_CANCEL,

    STATE_POSSIBLE: STATE_POSSIBLE,
    STATE_BEGAN: STATE_BEGAN,
    STATE_CHANGED: STATE_CHANGED,
    STATE_ENDED: STATE_ENDED,
    STATE_RECOGNIZED: STATE_RECOGNIZED,
    STATE_CANCELLED: STATE_CANCELLED,
    STATE_FAILED: STATE_FAILED,

    DIRECTION_NONE: DIRECTION_NONE,
    DIRECTION_LEFT: DIRECTION_LEFT,
    DIRECTION_RIGHT: DIRECTION_RIGHT,
    DIRECTION_UP: DIRECTION_UP,
    DIRECTION_DOWN: DIRECTION_DOWN,
    DIRECTION_HORIZONTAL: DIRECTION_HORIZONTAL,
    DIRECTION_VERTICAL: DIRECTION_VERTICAL,
    DIRECTION_ALL: DIRECTION_ALL,

    Manager: Manager,
    Input: Input,
    TouchAction: TouchAction,

    TouchInput: TouchInput,
    MouseInput: MouseInput,
    PointerEventInput: PointerEventInput,
    TouchMouseInput: TouchMouseInput,
    SingleTouchInput: SingleTouchInput,

    Recognizer: Recognizer,
    AttrRecognizer: AttrRecognizer,
    Tap: TapRecognizer,
    Pan: PanRecognizer,
    Swipe: SwipeRecognizer,
    Pinch: PinchRecognizer,
    Rotate: RotateRecognizer,
    Press: PressRecognizer,

    on: addEventListeners,
    off: removeEventListeners,
    each: each,
    merge: merge,
    extend: extend,
    inherit: inherit,
    bindFn: bindFn,
    prefixed: prefixed
});

if (typeof define == TYPE_FUNCTION && define.amd) {
    define(function() {
        return Hammer;
    });
} else if (typeof module != 'undefined' && module.exports) {
    module.exports = Hammer;
} else {
    window[exportName] = Hammer;
}

})(window, document, 'Hammer');

},{}],6:[function(require,module,exports){
'use strict';

function ToObject(val) {
	if (val == null) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

module.exports = Object.assign || function (target, source) {
	var pendingException;
	var from;
	var keys;
	var to = ToObject(target);

	for (var s = 1; s < arguments.length; s++) {
		from = arguments[s];
		keys = Object.keys(Object(from));

		for (var i = 0; i < keys.length; i++) {
			try {
				to[keys[i]] = from[keys[i]];
			} catch (err) {
				if (pendingException === undefined) {
					pendingException = err;
				}
			}
		}
	}

	if (pendingException) {
		throw pendingException;
	}

	return to;
};

},{}],7:[function(require,module,exports){
var CanvasView = require('./components/CanvasView.js');
var FirebaseUtils = require('./utils/FirebaseUtils');

window.onload = function() {
  CanvasView.load();
  FirebaseUtils.init();
}
},{"./components/CanvasView.js":8,"./utils/FirebaseUtils":16}],8:[function(require,module,exports){
"use strict";


var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var NotesStore = require('../stores/NotesStore');
var DragElementStore = require('../stores/DragElementStore');
var Hammer = require('hammerjs');
var TransformStore = require('../stores/TransformStore');
var _getRelativeLeftTop = require('../utils/GetRelativeLeftTop.js');

var FocusView = require('./FocusView');

var _transform;
var _transformPrevious = {translateX: 0, translateY:0, scale: 1};
var _notes;
var _note;  // most recently added or updated note
var _timer = {average: 0, count: 0, start: 0};


function _updateStateFromStores() {
  _transform = TransformStore.get();
  _notes = NotesStore.getAll();
};

var CanvasView = {
    
    canvas: document.getElementById('canvas'),

    ctx: document.getElementById('canvas').getContext('2d'),
    
    load: function() {
      this.resizeCanvas();
      this.addTouchEventListeners();
      this.addStoreListeners();
      this.addWindowResizeListener();
      this.render();
      FocusView.init();
    },

    addWindowResizeListener: function() {
      window.onresize = function() {
        this.resizeCanvas;
        this.render();
      }.bind(this);
    },

    addTouchEventListeners: function() {
      this.hammer = new Hammer.Manager(this.canvas);
      this.hammer.add(new Hammer.Tap());
      this.hammer.add(new Hammer.Pan({threshold:0}));
      this.hammer.add(new Hammer.Press({event: 'pressOneFinger', pointers: 1, time:0}));
      this.hammer.add(new Hammer.Press({event: 'pressTwoFingers', pointers: 2, time:0}));
      this.hammer.add(new Hammer.Pinch());
      this.hammer.on('pressOneFinger pressTwoFingers pinch pan', function(hammerEvent) {
        CanvasAppDispatcher.dispatch({
          actionType: hammerEvent.type,
          hammerEvent: hammerEvent,
          // utils: {_getRelativeLeftTop: _getRelativeLeftTop.bind(CanvasView.canvas)}
        });
      });

      this.hammer.on('tap', function(hammerEvent) {
        if(hammerEvent.tapCount === 1) {
          CanvasAppDispatcher.dispatch({
            actionType: 'tapSingle',
            hammerEvent: hammerEvent
          });
        } else if(hammerEvent.tapCount === 2) {
          CanvasAppDispatcher.dispatch({
            actionType: 'tapDouble',
            hammerEvent: hammerEvent
          });
        }
      });

      this.canvas.addEventListener('mousewheel', function(event) {
        CanvasAppDispatcher.dispatch({
          actionType: 'mousewheel',
          event: event
        });
      });
    },

    addStoreListeners: function() {
      
      NotesStore.addChangeListener('added', function() {
        _updateStateFromStores();
        _note = NotesStore.getMostRecent();  
        CanvasView.renderNote();
      });
      
      DragElementStore.addChangeListener('dragged', function() {
        _note = DragElementStore.get();  
        CanvasView.render();
      });

      TransformStore.addChangeListener('changed', function() {
        CanvasView.render();
      })
    },

    render: function() {
      window.requestAnimationFrame( function() {
        if (window.performance) _timer.start = window.performance.now();
        _updateStateFromStores();
        this.setCanvasTranslation();
        for(var key in _notes) {
          CanvasView.renderNote(_notes[key]);
        }
        if (window.performance) _timer.average = (_timer.average * _timer.count + window.performance.now() - _timer.start) / (++_timer.count);
        console.log("average render duration: ", _timer.average);
      });
    },

    setCanvasTranslation: function() {
      this.ctx.translate(Math.round(-_transformPrevious.translateX * _transformPrevious.scale), Math.round(-_transformPrevious.translateY * _transformPrevious.scale));
      this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
      this.ctx.translate(Math.round(_transform.translateX * _transform.scale), Math.round(_transform.translateY * _transform.scale));
      _transformPrevious = {translateX: _transform.translateX, translateY: _transform.translateY, scale: _transform.scale};
    },

    renderNote: function(note) {
      note = note || _note;
      var left = Math.round(note.data.x * _transform.scale);
      var top = Math.round(note.data.y * _transform.scale);
      CanvasView.renderShape(note, left, top);
      CanvasView.renderText(note, left, top);
    },

    renderShape: function(note, left, top) {
      this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
      this.ctx.fillRect.apply(this.ctx, [left, top, Math.round(note.style.width * _transform.scale), Math.round(note.style.height * _transform.scale)]);
    },

    renderText: function(note, left, top) {
      this.ctx.fillStyle = "blue";
      this.ctx.font = Math.round(12 * _transform.scale) + "px Arial";
      for(var i = 0; i < note.data.textArr.length; i++) {
        this.ctx.fillText(" " + note.data.textArr[i], left, Math.round(top + (12 * (i + 2) - 6) * _transform.scale));
      }
    },

    resizeCanvas: function() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

}

module.exports = CanvasView;

},{"../dispatcher/CanvasAppDispatcher":10,"../stores/DragElementStore":11,"../stores/NotesStore":13,"../stores/TransformStore":14,"../utils/GetRelativeLeftTop.js":17,"./FocusView":9,"hammerjs":5}],9:[function(require,module,exports){
// FocusView.js
"use strict";

var FocusStore = require('../stores/FocusStore');
var TransformStore = require('../stores/TransformStore');

var _transform;
var _textareaElement;

function _updateStateFromStores() {
  _transform = TransformStore.get();
};

function _globalToWindowTransform(globalObj) {
  var windowObj = {};
  windowObj.x = (globalObj.x + _transform.translateX) * _transform.scale;
  windowObj.y = (globalObj.y + _transform.translateY) * _transform.scale;
  if ( globalObj.width && globalObj.height) {
    windowObj.width = globalObj.width * _transform.scale;
    windowObj.height = globalObj.height * _transform.scale;
    return windowObj;
  }
  return windowObj;
};

var FocusView = {

  init: function() {
    _textareaElement = document.getElementById('textarea');
    FocusStore.addChangeListener('changed', function() {
      _updateStateFromStores();
      FocusView.render();
    });
  },

  render: function() {
    console.log('switch to textarea');
    var note = FocusStore.getFocusDoubleTap();
    if (note) {
      var textareaRectGlobal = {
        x: note.data.x,
        y: note.data.y,
        width: note.style.width,
        height: note.style.height
      };
      var textareaRectWindow = _globalToWindowTransform(textareaRectGlobal);
      var deltaToOriginX = - note.style.width * (1 - _transform.scale) / 2;
      var deltaToOriginY = - note.style.height * (1 - _transform.scale) / 2;
      var translateX = deltaToOriginX + textareaRectWindow.x;
      var translateY = deltaToOriginY + textareaRectWindow.y;

      _textareaElement.value = note.data.text;
      _textareaElement.style.width = note.style.width + "px";
      _textareaElement.style.height = note.style.height + "px";
      _textareaElement.style.transform = "matrix(" + _transform.scale + ", 0, 0, " + _transform.scale + ", " + translateX + ',' + translateY +')';
      _textareaElement.style.webkitTransform = "matrix(" + _transform.scale + ", 0, 0, " + _transform.scale + ", " + translateX + ',' + translateY +')';
      _textareaElement.style.display = 'block';
      _textareaElement.focus();
    }
  }  
}

module.exports = FocusView;



},{"../stores/FocusStore":12,"../stores/TransformStore":14}],10:[function(require,module,exports){
"use strict";

var Dispatcher = require('flux').Dispatcher;
var assign = require('object-assign');

var CanvasDispatcher = assign(new Dispatcher(), {
  //Add custom dispatcher methods here
});

module.exports = CanvasDispatcher;
},{"flux":2,"object-assign":6}],11:[function(require,module,exports){
"use strict";

var assign = require('object-assign');
var EventEmitter = require('events').EventEmitter;
var NotesStore = require('./NotesStore');
var Transform = require('./TransformStore');
var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');

var _dragStart;

function _setDragStart(hammerEvent) {
  _dragStart = {};
  var leftTop = {left: hammerEvent.pointers[0].pageX, top: hammerEvent.pointers[0].pageY};
  var globalPoint = Transform.windowToGlobalPoint(leftTop);
  var note = NotesStore.getNoteFromXY(globalPoint.x, globalPoint.y);
  if (note) {
    console.log('_setDragStart');
    _dragStart.note = note;
    _dragStart.touchLeft = leftTop.left;
    _dragStart.touchTop = leftTop.top;
    _dragStart.elementX = note.data.x;
    _dragStart.elementY = note.data.y;
  } else {
    _reset();
  }
};

function _drag(hammerEvent) {
  if ( _dragStart ) {
    var note = _dragStart.note;
    // var leftTop = _getRelativeLeftTop(hammerEvent);
    var leftTop = {left: hammerEvent.pointers[0].pageX, top: hammerEvent.pointers[0].pageY};
    var deltaX = (leftTop.left - _dragStart.touchLeft) / Transform.getScale();
    var deltaY = (leftTop.top - _dragStart.touchTop) / Transform.getScale();
    note.data.x = _dragStart.elementX + deltaX;
    note.data.y = _dragStart.elementY + deltaY;
    DragElementStore.emitChange('dragged');
  }
};

function _reset() {
  _dragStart = null;
}

var DragElementStore = assign({}, EventEmitter.prototype, {
  
  get: function() {
    return _dragStart.note;
  },

  emitChange: function(changeEvent) {
    this.emit(changeEvent);
  },

  addChangeListener: function(changeEvent, callback) {
    this.on(changeEvent, callback);
  },

});

DragElementStore.dispatchToken = CanvasAppDispatcher.register(function(payload) {  
  switch (payload.actionType) {
  
    case 'pressOneFinger':
      // _getRelativeLeftTop = payload.utils._getRelativeLeftTop;
      _setDragStart(payload.hammerEvent);
      break;

    case 'pan':
      _drag(payload.hammerEvent);
      break;

    case 'pressTwoFingers':
      _reset();
      break;

    default: // intentionally left blank
  }
});

module.exports = DragElementStore;

},{"../dispatcher/CanvasAppDispatcher":10,"./NotesStore":13,"./TransformStore":14,"events":1,"object-assign":6}],12:[function(require,module,exports){
"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var EventEmitter = require('events').EventEmitter;
var _assign = require('object-assign');
var _getRelativeLeftTop = require('../utils/GetRelativeLeftTop.js');
var NotesStore = require('./NotesStore');
var TransformStore = require('./TransformStore');
var _getEventTarget = require('../utils/EventTarget');

var _focusSingleTap;
var _focusDoubleTap;

function _tapSingleHandler() {

};

function _tapDoubleHandler(hammerEvent) {
  // console.log('single');
  var note = _getEventTarget(hammerEvent);
  if (note && note !== _focusDoubleTap) {
    _focusDoubleTap = note;
    FocusStore.emitChange('changed');
  }
};

var FocusStore = _assign({}, EventEmitter.prototype, {
  
  emitChange: function(changeEventName) {
    this.emit(changeEventName || 'changed');
  },

  addChangeListener: function(changeEvent, callback) {
    this.on(changeEvent, callback);
  },

  getFocusSingleTap: function() {
    return _focusSingleTap;
  },

  getFocusDoubleTap: function() {
    return _focusDoubleTap;
  },
});

FocusStore.dispatchToken = CanvasAppDispatcher.register(function(payload) {  
  switch (payload.actionType) {
  
    case 'tapSingle':
      _tapSingleHandler();
      break;

    case 'tapDouble':
      _tapDoubleHandler(payload.hammerEvent);
      break;

    default: // intentionally left blank
  }
});

module.exports = FocusStore;
},{"../dispatcher/CanvasAppDispatcher":10,"../utils/EventTarget":15,"../utils/GetRelativeLeftTop.js":17,"./NotesStore":13,"./TransformStore":14,"events":1,"object-assign":6}],13:[function(require,module,exports){
"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');
// var Transform = require('./TransformStore');

// var _getRelativeLeftTop;
// var CHANGE_EVENTS = ['added', 'dragged'];

var _notes = {};
var _note = {};  // most recent note added or updated
// var _dragStart;

function _addNote(note) {
  var key = Object.keys(note)[0];
  _notes[key] = note[key];
  _setMostRecentNote(note, key);
  NotesStore.emitChange('added');

}

function _setMostRecentNote(note, key) {
  var keyOld = Object.keys(_note)[0];
  delete _note[keyOld];
  assign(_note, note[key]);
};

// function _setDragStart(hammerEvent) {
//   console.log('_setDragStart');
//   _dragStart = {};
//   var leftTop = _getRelativeLeftTop(hammerEvent);
//   var XY;
//   var note = _getNoteFromXY(leftTop.left, leftTop.top);
//   if (note) {
//     _dragStart.note = note;
//     _dragStart.touchLeft = leftTop.left;
//     _dragStart.touchTop = leftTop.top;
//     _dragStart.elementX = note.data.x;
//     _dragStart.elementY = note.data.y;
//   } else {
//     _dragStart = null;
//   }
// };

// function _drag(hammerEvent) {
//   if ( _dragStart ) {
//     var note = _dragStart.note;
//     var leftTop = _getRelativeLeftTop(hammerEvent);
//     var deltaX = (leftTop.left - _dragStart.touchLeft) / Transform.getScale();
//     var deltaY = (leftTop.top - _dragStart.touchTop) / Transform.getScale();
//     note.data.x = _dragStart.elementX + deltaX;
//     note.data.y = _dragStart.elementY + deltaY;
//     NotesStore.emitChange('dragged');
//   }
// }

  // CanvasDemo.prototype.windowToGlobalPoint = function(windowPoint) {
  //   return {
  //     x: windowx / this.transform.scale - this.transform.translateX,
  //     y: windowPoint.y / this.transform.scale - this.transform.translateY
  //   };
  // };

// function _getNoteFromXY(x, y) {
//   var note;
//   for(var key in _notes) {
//     note = _notes[key];
//     if ( 
//       note.data.x <= x && 
//       x <= note.data.x + note.style.width && 
//       note.data.y <= y && 
//       y <= note.data.y + note.style.height 
//     ) {
//       return note;
//     }
//   }
//   return null;
// };

var NotesStore = assign({}, EventEmitter.prototype, {
  
  emitChange: function(changeEvent) {
    this.emit(changeEvent);
  },

  addChangeListener: function(changeEvent, callback) {
    this.on(changeEvent, callback);
  },

  getAll: function() {
    return _notes;
  },

  getMostRecent: function() {
    return _note;
  },

  getNoteFromXY: function(x, y) {
    var note;
    for(var key in _notes) {
      note = _notes[key];
      if ( 
        note.data.x <= x && 
        x <= note.data.x + note.style.width && 
        note.data.y <= y && 
        y <= note.data.y + note.style.height 
      ) {
        return note;
      }
    }
    return null;
  },

});

NotesStore.dispatchToken = CanvasAppDispatcher.register(function(payload) {
  
  switch (payload.actionType) {
    
    case "note_added":
      _addNote(payload.note);
      break;

    // case 'press':
    //   _getRelativeLeftTop = payload.utils._getRelativeLeftTop;
    //   _setDragStart(payload.hammerEvent);

    // case 'pan':
    //   _drag(payload.hammerEvent);

    default:  // do nothing
  }

});

module.exports = NotesStore;
},{"../dispatcher/CanvasAppDispatcher":10,"events":1,"object-assign":6}],14:[function(require,module,exports){
"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var EventEmitter = require('events').EventEmitter;
var _assign = require('object-assign');
var _getRelativeLeftTop = require('../utils/GetRelativeLeftTop.js');
var NotesStore = require('./NotesStore');

var CHANGE_EVENT = 'change';

var _translateStartData;

var _pinchStart;

var _transform = {
  translateX: 0,
  translateY: 0,
  scale: 1
};

function _translateStart(hammerEvent) {
  _reset();
  _translateStartData = {};
  var leftTop = {left: hammerEvent.pointers[0].pageX, top: hammerEvent.pointers[0].pageY};
  var globalPoint = Transform.windowToGlobalPoint(leftTop);
  var note = NotesStore.getNoteFromXY(globalPoint.x, globalPoint.y);
  if ( !note) {
    console.log('_translateStart');
    _translateStartData.left = leftTop.left;
    _translateStartData.top = leftTop.top;
    _translateStartData.translateX = _transform.translateX;
    _translateStartData.translateY = _transform.translateY;
  } else {
    _translateStartData = null;
  }
};

function _translate(hammerEvent) {
  if ( _translateStartData ) {
    var leftTop = {left: hammerEvent.pointers[0].pageX, top: hammerEvent.pointers[0].pageY};
    _transform.translateX = _translateStartData.translateX + (leftTop.left - _translateStartData.left) / _transform.scale;
    _transform.translateY = _translateStartData.translateY + (leftTop.top - _translateStartData.top) / _transform.scale;
  }
};

function _reset() {
  _translateStartData = null;
  _pinchStart = null;
}

function _zoomStart(hammerEvent) {
  _reset();
  _pinchStart = {};
  _pinchStart.dist = _distHammerPinchEvent(hammerEvent);
  _pinchStart.center = {x: hammerEvent.center.x, y:hammerEvent.center.y};
  _pinchStart.translateX = _transform.translateX;
  _pinchStart.translateY = _transform.translateY;
  _pinchStart.scale = _transform.scale;
  console.log(_pinchStart);
};

function _mousewheelStart(event) {
  _reset();
  _pinchStart = {};
  _pinchStart.translateX = _transform.translateX;
  _pinchStart.translateY = _transform.translateY;
  _pinchStart.scale = _transform.scale;
  _pinchStart.center = {x: event.pageX, y: event.pageY};
}

function _zoom(hammerEvent, eventName) {
  if(hammerEvent.type === 'mousewheel') {
    _mousewheelStart(hammerEvent);
    _transform.scale = (hammerEvent.wheelDeltaY < 0) ? _transform.scale * 1.1 : _transform.scale * 0.90;
  } else {
    var newPinchDist = _distHammerPinchEvent(hammerEvent);
    var newScale = _pinchStart.scale * newPinchDist / _pinchStart.dist;
    _transform.scale = newScale;
  }
  if ( _pinchStart ) {
    _transform.translateX = _pinchStart.translateX - _getTranslateDelta(_pinchStart.center.x, _pinchStart.scale, _transform.scale);
    _transform.translateY = _pinchStart.translateY - _getTranslateDelta(_pinchStart.center.y, _pinchStart.scale, _transform.scale);
  }
};

function _getTranslateDelta(x, scalePrev, scaleNew) {
  var translateDelta = (x / scalePrev * scaleNew - x) / scaleNew;
  return translateDelta;
};

function _distHammerPinchEvent (hammerPinchEvent) {
  return _dist(
    {x: hammerPinchEvent.pointers[0].pageX, y:hammerPinchEvent.pointers[0].pageY},
    {x: hammerPinchEvent.pointers[1].pageX, y:hammerPinchEvent.pointers[1].pageY}
  );
};

function _dist(a, b) {
  return Math.sqrt( Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) );
};

var Transform = _assign({}, EventEmitter.prototype, {
  
  get: function() {
    return _transform;
  },

  getScale: function() {
    return _transform.scale;
  },

  emitChange: function(changeEventName) {
    this.emit(changeEventName || 'changed');
  },

  addChangeListener: function(changeEvent, callback) {
    this.on(changeEvent, callback);
  },

  windowToGlobalPoint: function(windowPoint) {
    return {
      x: windowPoint.left / _transform.scale - _transform.translateX,
      y: windowPoint.top / _transform.scale - _transform.translateY
    };
  },

});

Transform.dispatchToken = CanvasAppDispatcher.register(function(payload) {
  switch(payload.actionType) {
    
    case 'pressOneFinger':
      // _getRelativeLeftTop = payload.utils._getRelativeLeftTop;
      _translateStart(payload.hammerEvent);
      break;

    case 'pan':
      _translate(payload.hammerEvent);
      Transform.emitChange('changed');
      break;

    case 'pressTwoFingers':
      _zoomStart(payload.hammerEvent);
      break;
    
    case 'pinch':
      _zoom(payload.hammerEvent)
      Transform.emitChange('changed')
      break;

    case 'mousewheel':
      _zoom(payload.event, 'mousewheel');
      Transform.emitChange('changed')
    default:
  }
});


module.exports = Transform;
},{"../dispatcher/CanvasAppDispatcher":10,"../utils/GetRelativeLeftTop.js":17,"./NotesStore":13,"events":1,"object-assign":6}],15:[function(require,module,exports){
// EventTarget.js
var NotesStore = require('../stores/NotesStore');
var TransformStore = require('../stores/TransformStore');

function getTarget (hammerEvent) {
  var leftTop = {left: hammerEvent.pointers[0].pageX, top: hammerEvent.pointers[0].pageY};
  var globalPoint = TransformStore.windowToGlobalPoint(leftTop);
  var note = NotesStore.getNoteFromXY(globalPoint.x, globalPoint.y);
  return note;  // null if a note wasn't clicked
};

module.exports = getTarget;
},{"../stores/NotesStore":13,"../stores/TransformStore":14}],16:[function(require,module,exports){
"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');

module.exports = {
  init: function() {
    this.loadExample();
    this.get();
  },

  loadExample: function() {
    var testNote = {
      "data" : {
        "text" : "#myHashtag0",
        "y" : 10,
        "x" : 10,
        "hashtags" : [ "#myHashtag0" ]
      },
      "style" : {
        "top" : 229.86368368933097,
        "height" : 50,
        "left" : 101.75178984370329,
        "width" : 192,
        "font-size" : "10pt"
      }
    };
    testNote.data.textArr = testNote.data.text.split("\n");
    CanvasAppDispatcher.dispatch({
      actionType: 'note_added',
      note: {testNoteKey: testNote}
    });

    var testNote2 = {
      "data" : {
        "text" : "#myHashtag1",
        "y" : 250,
        "x" : 250,
        "hashtags" : [ "#myHashtag1" ]
      },
      "style" : {
        "top" : 229.86368368933097,
        "height" : 50,
        "left" : 101.75178984370329,
        "width" : 192,
        "font-size" : "10pt"
      }
    };
    testNote2.data.textArr = testNote2.data.text.split("\n");
    CanvasAppDispatcher.dispatch({
      actionType: 'note_added',
      note: {testNoteKey1: testNote2}
    });
  },

  get: function() {
    var ref = new Firebase('https://brainspace-biz.firebaseio.com/');
    var notesRef = ref.child('notes2');
    notesRef.on("child_added", function(snapshot, key) {
      var note_ = {};
      var note = snapshot.val();
      note.data.textArr = note.data.text.split('\n');
      note_[key] = note;
      CanvasAppDispatcher.dispatch({
        actionType: 'note_added',
        note: note_,
      });
    }.bind(this));
  },
}
},{"../dispatcher/CanvasAppDispatcher":10}],17:[function(require,module,exports){

var _canvasElement;

var getRelativeLeftTop = function (event) {
  var totalOffsetX = 0;
  var totalOffsetY = 0;
  var canvasX = 0;
  var canvasY = 0;
  var currentElement = _canvasElement;

  do {
      totalOffsetX += _canvasElement.offsetLeft;
      totalOffsetY += _canvasElement.offsetTop;
  }
  while (currentElement = currentElement.offsetParent)

  var pageX = event.pageX ? event.pageX : event.changedTouches ? event.changedTouches[0].pageX : event.center.x;
  var pageY = event.pageY ? event.pageY : event.changedTouches ? event.changedTouches[0].pageY : event.center.y;

  canvasX = pageX - totalOffsetX;
  canvasY = pageY - totalOffsetY;

  // Fix for variable canvas width
  canvasX = Math.round( canvasX * (_canvasElement.width / _canvasElement.offsetWidth) );
  canvasY = Math.round( canvasY * (_canvasElement.height / _canvasElement.offsetHeight) );

  return {left:canvasX, top:canvasY};
};

getRelativeLeftTop.set = function(canvasElement) {
  _canvasElement = canvasElement;
}

module.exports = getRelativeLeftTop;

},{}]},{},[7])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9mbHV4L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ZsdXgvbGliL0Rpc3BhdGNoZXIuanMiLCJub2RlX21vZHVsZXMvZmx1eC9saWIvaW52YXJpYW50LmpzIiwibm9kZV9tb2R1bGVzL2hhbW1lcmpzL2hhbW1lci5qcyIsIm5vZGVfbW9kdWxlcy9vYmplY3QtYXNzaWduL2luZGV4LmpzIiwic3JjL2FwcC5qcyIsInNyYy9jb21wb25lbnRzL0NhbnZhc1ZpZXcuanMiLCJzcmMvY29tcG9uZW50cy9Gb2N1c1ZpZXcuanMiLCJzcmMvZGlzcGF0Y2hlci9DYW52YXNBcHBEaXNwYXRjaGVyLmpzIiwic3JjL3N0b3Jlcy9EcmFnRWxlbWVudFN0b3JlLmpzIiwic3JjL3N0b3Jlcy9Gb2N1c1N0b3JlLmpzIiwic3JjL3N0b3Jlcy9Ob3Rlc1N0b3JlLmpzIiwic3JjL3N0b3Jlcy9UcmFuc2Zvcm1TdG9yZS5qcyIsInNyYy91dGlscy9FdmVudFRhcmdldC5qcyIsInNyYy91dGlscy9GaXJlYmFzZVV0aWxzLmpzIiwic3JjL3V0aWxzL0dldFJlbGF0aXZlTGVmdFRvcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMuRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4vbGliL0Rpc3BhdGNoZXInKVxuIiwiLypcbiAqIENvcHlyaWdodCAoYykgMjAxNCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIEBwcm92aWRlc01vZHVsZSBEaXNwYXRjaGVyXG4gKiBAdHlwZWNoZWNrc1xuICovXG5cblwidXNlIHN0cmljdFwiO1xuXG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnLi9pbnZhcmlhbnQnKTtcblxudmFyIF9sYXN0SUQgPSAxO1xudmFyIF9wcmVmaXggPSAnSURfJztcblxuLyoqXG4gKiBEaXNwYXRjaGVyIGlzIHVzZWQgdG8gYnJvYWRjYXN0IHBheWxvYWRzIHRvIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLiBUaGlzIGlzXG4gKiBkaWZmZXJlbnQgZnJvbSBnZW5lcmljIHB1Yi1zdWIgc3lzdGVtcyBpbiB0d28gd2F5czpcbiAqXG4gKiAgIDEpIENhbGxiYWNrcyBhcmUgbm90IHN1YnNjcmliZWQgdG8gcGFydGljdWxhciBldmVudHMuIEV2ZXJ5IHBheWxvYWQgaXNcbiAqICAgICAgZGlzcGF0Y2hlZCB0byBldmVyeSByZWdpc3RlcmVkIGNhbGxiYWNrLlxuICogICAyKSBDYWxsYmFja3MgY2FuIGJlIGRlZmVycmVkIGluIHdob2xlIG9yIHBhcnQgdW50aWwgb3RoZXIgY2FsbGJhY2tzIGhhdmVcbiAqICAgICAgYmVlbiBleGVjdXRlZC5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgY29uc2lkZXIgdGhpcyBoeXBvdGhldGljYWwgZmxpZ2h0IGRlc3RpbmF0aW9uIGZvcm0sIHdoaWNoXG4gKiBzZWxlY3RzIGEgZGVmYXVsdCBjaXR5IHdoZW4gYSBjb3VudHJ5IGlzIHNlbGVjdGVkOlxuICpcbiAqICAgdmFyIGZsaWdodERpc3BhdGNoZXIgPSBuZXcgRGlzcGF0Y2hlcigpO1xuICpcbiAqICAgLy8gS2VlcHMgdHJhY2sgb2Ygd2hpY2ggY291bnRyeSBpcyBzZWxlY3RlZFxuICogICB2YXIgQ291bnRyeVN0b3JlID0ge2NvdW50cnk6IG51bGx9O1xuICpcbiAqICAgLy8gS2VlcHMgdHJhY2sgb2Ygd2hpY2ggY2l0eSBpcyBzZWxlY3RlZFxuICogICB2YXIgQ2l0eVN0b3JlID0ge2NpdHk6IG51bGx9O1xuICpcbiAqICAgLy8gS2VlcHMgdHJhY2sgb2YgdGhlIGJhc2UgZmxpZ2h0IHByaWNlIG9mIHRoZSBzZWxlY3RlZCBjaXR5XG4gKiAgIHZhciBGbGlnaHRQcmljZVN0b3JlID0ge3ByaWNlOiBudWxsfVxuICpcbiAqIFdoZW4gYSB1c2VyIGNoYW5nZXMgdGhlIHNlbGVjdGVkIGNpdHksIHdlIGRpc3BhdGNoIHRoZSBwYXlsb2FkOlxuICpcbiAqICAgZmxpZ2h0RGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gKiAgICAgYWN0aW9uVHlwZTogJ2NpdHktdXBkYXRlJyxcbiAqICAgICBzZWxlY3RlZENpdHk6ICdwYXJpcydcbiAqICAgfSk7XG4gKlxuICogVGhpcyBwYXlsb2FkIGlzIGRpZ2VzdGVkIGJ5IGBDaXR5U3RvcmVgOlxuICpcbiAqICAgZmxpZ2h0RGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gKiAgICAgaWYgKHBheWxvYWQuYWN0aW9uVHlwZSA9PT0gJ2NpdHktdXBkYXRlJykge1xuICogICAgICAgQ2l0eVN0b3JlLmNpdHkgPSBwYXlsb2FkLnNlbGVjdGVkQ2l0eTtcbiAqICAgICB9XG4gKiAgIH0pO1xuICpcbiAqIFdoZW4gdGhlIHVzZXIgc2VsZWN0cyBhIGNvdW50cnksIHdlIGRpc3BhdGNoIHRoZSBwYXlsb2FkOlxuICpcbiAqICAgZmxpZ2h0RGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gKiAgICAgYWN0aW9uVHlwZTogJ2NvdW50cnktdXBkYXRlJyxcbiAqICAgICBzZWxlY3RlZENvdW50cnk6ICdhdXN0cmFsaWEnXG4gKiAgIH0pO1xuICpcbiAqIFRoaXMgcGF5bG9hZCBpcyBkaWdlc3RlZCBieSBib3RoIHN0b3JlczpcbiAqXG4gKiAgICBDb3VudHJ5U3RvcmUuZGlzcGF0Y2hUb2tlbiA9IGZsaWdodERpc3BhdGNoZXIucmVnaXN0ZXIoZnVuY3Rpb24ocGF5bG9hZCkge1xuICogICAgIGlmIChwYXlsb2FkLmFjdGlvblR5cGUgPT09ICdjb3VudHJ5LXVwZGF0ZScpIHtcbiAqICAgICAgIENvdW50cnlTdG9yZS5jb3VudHJ5ID0gcGF5bG9hZC5zZWxlY3RlZENvdW50cnk7XG4gKiAgICAgfVxuICogICB9KTtcbiAqXG4gKiBXaGVuIHRoZSBjYWxsYmFjayB0byB1cGRhdGUgYENvdW50cnlTdG9yZWAgaXMgcmVnaXN0ZXJlZCwgd2Ugc2F2ZSBhIHJlZmVyZW5jZVxuICogdG8gdGhlIHJldHVybmVkIHRva2VuLiBVc2luZyB0aGlzIHRva2VuIHdpdGggYHdhaXRGb3IoKWAsIHdlIGNhbiBndWFyYW50ZWVcbiAqIHRoYXQgYENvdW50cnlTdG9yZWAgaXMgdXBkYXRlZCBiZWZvcmUgdGhlIGNhbGxiYWNrIHRoYXQgdXBkYXRlcyBgQ2l0eVN0b3JlYFxuICogbmVlZHMgdG8gcXVlcnkgaXRzIGRhdGEuXG4gKlxuICogICBDaXR5U3RvcmUuZGlzcGF0Y2hUb2tlbiA9IGZsaWdodERpc3BhdGNoZXIucmVnaXN0ZXIoZnVuY3Rpb24ocGF5bG9hZCkge1xuICogICAgIGlmIChwYXlsb2FkLmFjdGlvblR5cGUgPT09ICdjb3VudHJ5LXVwZGF0ZScpIHtcbiAqICAgICAgIC8vIGBDb3VudHJ5U3RvcmUuY291bnRyeWAgbWF5IG5vdCBiZSB1cGRhdGVkLlxuICogICAgICAgZmxpZ2h0RGlzcGF0Y2hlci53YWl0Rm9yKFtDb3VudHJ5U3RvcmUuZGlzcGF0Y2hUb2tlbl0pO1xuICogICAgICAgLy8gYENvdW50cnlTdG9yZS5jb3VudHJ5YCBpcyBub3cgZ3VhcmFudGVlZCB0byBiZSB1cGRhdGVkLlxuICpcbiAqICAgICAgIC8vIFNlbGVjdCB0aGUgZGVmYXVsdCBjaXR5IGZvciB0aGUgbmV3IGNvdW50cnlcbiAqICAgICAgIENpdHlTdG9yZS5jaXR5ID0gZ2V0RGVmYXVsdENpdHlGb3JDb3VudHJ5KENvdW50cnlTdG9yZS5jb3VudHJ5KTtcbiAqICAgICB9XG4gKiAgIH0pO1xuICpcbiAqIFRoZSB1c2FnZSBvZiBgd2FpdEZvcigpYCBjYW4gYmUgY2hhaW5lZCwgZm9yIGV4YW1wbGU6XG4gKlxuICogICBGbGlnaHRQcmljZVN0b3JlLmRpc3BhdGNoVG9rZW4gPVxuICogICAgIGZsaWdodERpc3BhdGNoZXIucmVnaXN0ZXIoZnVuY3Rpb24ocGF5bG9hZCkge1xuICogICAgICAgc3dpdGNoIChwYXlsb2FkLmFjdGlvblR5cGUpIHtcbiAqICAgICAgICAgY2FzZSAnY291bnRyeS11cGRhdGUnOlxuICogICAgICAgICAgIGZsaWdodERpc3BhdGNoZXIud2FpdEZvcihbQ2l0eVN0b3JlLmRpc3BhdGNoVG9rZW5dKTtcbiAqICAgICAgICAgICBGbGlnaHRQcmljZVN0b3JlLnByaWNlID1cbiAqICAgICAgICAgICAgIGdldEZsaWdodFByaWNlU3RvcmUoQ291bnRyeVN0b3JlLmNvdW50cnksIENpdHlTdG9yZS5jaXR5KTtcbiAqICAgICAgICAgICBicmVhaztcbiAqXG4gKiAgICAgICAgIGNhc2UgJ2NpdHktdXBkYXRlJzpcbiAqICAgICAgICAgICBGbGlnaHRQcmljZVN0b3JlLnByaWNlID1cbiAqICAgICAgICAgICAgIEZsaWdodFByaWNlU3RvcmUoQ291bnRyeVN0b3JlLmNvdW50cnksIENpdHlTdG9yZS5jaXR5KTtcbiAqICAgICAgICAgICBicmVhaztcbiAqICAgICB9XG4gKiAgIH0pO1xuICpcbiAqIFRoZSBgY291bnRyeS11cGRhdGVgIHBheWxvYWQgd2lsbCBiZSBndWFyYW50ZWVkIHRvIGludm9rZSB0aGUgc3RvcmVzJ1xuICogcmVnaXN0ZXJlZCBjYWxsYmFja3MgaW4gb3JkZXI6IGBDb3VudHJ5U3RvcmVgLCBgQ2l0eVN0b3JlYCwgdGhlblxuICogYEZsaWdodFByaWNlU3RvcmVgLlxuICovXG5cbiAgZnVuY3Rpb24gRGlzcGF0Y2hlcigpIHtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrcyA9IHt9O1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNQZW5kaW5nID0ge307XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0hhbmRsZWQgPSB7fTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmcgPSBmYWxzZTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX3BlbmRpbmdQYXlsb2FkID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYSBjYWxsYmFjayB0byBiZSBpbnZva2VkIHdpdGggZXZlcnkgZGlzcGF0Y2hlZCBwYXlsb2FkLiBSZXR1cm5zXG4gICAqIGEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB3aXRoIGB3YWl0Rm9yKClgLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS5yZWdpc3Rlcj1mdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBpZCA9IF9wcmVmaXggKyBfbGFzdElEKys7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3NbaWRdID0gY2FsbGJhY2s7XG4gICAgcmV0dXJuIGlkO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgY2FsbGJhY2sgYmFzZWQgb24gaXRzIHRva2VuLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gaWRcbiAgICovXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLnVucmVnaXN0ZXI9ZnVuY3Rpb24oaWQpIHtcbiAgICBpbnZhcmlhbnQoXG4gICAgICB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrc1tpZF0sXG4gICAgICAnRGlzcGF0Y2hlci51bnJlZ2lzdGVyKC4uLik6IGAlc2AgZG9lcyBub3QgbWFwIHRvIGEgcmVnaXN0ZXJlZCBjYWxsYmFjay4nLFxuICAgICAgaWRcbiAgICApO1xuICAgIGRlbGV0ZSB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrc1tpZF07XG4gIH07XG5cbiAgLyoqXG4gICAqIFdhaXRzIGZvciB0aGUgY2FsbGJhY2tzIHNwZWNpZmllZCB0byBiZSBpbnZva2VkIGJlZm9yZSBjb250aW51aW5nIGV4ZWN1dGlvblxuICAgKiBvZiB0aGUgY3VycmVudCBjYWxsYmFjay4gVGhpcyBtZXRob2Qgc2hvdWxkIG9ubHkgYmUgdXNlZCBieSBhIGNhbGxiYWNrIGluXG4gICAqIHJlc3BvbnNlIHRvIGEgZGlzcGF0Y2hlZCBwYXlsb2FkLlxuICAgKlxuICAgKiBAcGFyYW0ge2FycmF5PHN0cmluZz59IGlkc1xuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUud2FpdEZvcj1mdW5jdGlvbihpZHMpIHtcbiAgICBpbnZhcmlhbnQoXG4gICAgICB0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmcsXG4gICAgICAnRGlzcGF0Y2hlci53YWl0Rm9yKC4uLik6IE11c3QgYmUgaW52b2tlZCB3aGlsZSBkaXNwYXRjaGluZy4nXG4gICAgKTtcbiAgICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgaWRzLmxlbmd0aDsgaWkrKykge1xuICAgICAgdmFyIGlkID0gaWRzW2lpXTtcbiAgICAgIGlmICh0aGlzLiREaXNwYXRjaGVyX2lzUGVuZGluZ1tpZF0pIHtcbiAgICAgICAgaW52YXJpYW50KFxuICAgICAgICAgIHRoaXMuJERpc3BhdGNoZXJfaXNIYW5kbGVkW2lkXSxcbiAgICAgICAgICAnRGlzcGF0Y2hlci53YWl0Rm9yKC4uLik6IENpcmN1bGFyIGRlcGVuZGVuY3kgZGV0ZWN0ZWQgd2hpbGUgJyArXG4gICAgICAgICAgJ3dhaXRpbmcgZm9yIGAlc2AuJyxcbiAgICAgICAgICBpZFxuICAgICAgICApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGludmFyaWFudChcbiAgICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3NbaWRdLFxuICAgICAgICAnRGlzcGF0Y2hlci53YWl0Rm9yKC4uLik6IGAlc2AgZG9lcyBub3QgbWFwIHRvIGEgcmVnaXN0ZXJlZCBjYWxsYmFjay4nLFxuICAgICAgICBpZFxuICAgICAgKTtcbiAgICAgIHRoaXMuJERpc3BhdGNoZXJfaW52b2tlQ2FsbGJhY2soaWQpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogRGlzcGF0Y2hlcyBhIHBheWxvYWQgdG8gYWxsIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gcGF5bG9hZFxuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUuZGlzcGF0Y2g9ZnVuY3Rpb24ocGF5bG9hZCkge1xuICAgIGludmFyaWFudChcbiAgICAgICF0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmcsXG4gICAgICAnRGlzcGF0Y2guZGlzcGF0Y2goLi4uKTogQ2Fubm90IGRpc3BhdGNoIGluIHRoZSBtaWRkbGUgb2YgYSBkaXNwYXRjaC4nXG4gICAgKTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX3N0YXJ0RGlzcGF0Y2hpbmcocGF5bG9hZCk7XG4gICAgdHJ5IHtcbiAgICAgIGZvciAodmFyIGlkIGluIHRoaXMuJERpc3BhdGNoZXJfY2FsbGJhY2tzKSB7XG4gICAgICAgIGlmICh0aGlzLiREaXNwYXRjaGVyX2lzUGVuZGluZ1tpZF0pIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLiREaXNwYXRjaGVyX2ludm9rZUNhbGxiYWNrKGlkKTtcbiAgICAgIH1cbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9zdG9wRGlzcGF0Y2hpbmcoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIElzIHRoaXMgRGlzcGF0Y2hlciBjdXJyZW50bHkgZGlzcGF0Y2hpbmcuXG4gICAqXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS5pc0Rpc3BhdGNoaW5nPWZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmc7XG4gIH07XG5cbiAgLyoqXG4gICAqIENhbGwgdGhlIGNhbGxiYWNrIHN0b3JlZCB3aXRoIHRoZSBnaXZlbiBpZC4gQWxzbyBkbyBzb21lIGludGVybmFsXG4gICAqIGJvb2trZWVwaW5nLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gaWRcbiAgICogQGludGVybmFsXG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS4kRGlzcGF0Y2hlcl9pbnZva2VDYWxsYmFjaz1mdW5jdGlvbihpZCkge1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNQZW5kaW5nW2lkXSA9IHRydWU7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3NbaWRdKHRoaXMuJERpc3BhdGNoZXJfcGVuZGluZ1BheWxvYWQpO1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNIYW5kbGVkW2lkXSA9IHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCB1cCBib29ra2VlcGluZyBuZWVkZWQgd2hlbiBkaXNwYXRjaGluZy5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IHBheWxvYWRcbiAgICogQGludGVybmFsXG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS4kRGlzcGF0Y2hlcl9zdGFydERpc3BhdGNoaW5nPWZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgICBmb3IgKHZhciBpZCBpbiB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrcykge1xuICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9pc1BlbmRpbmdbaWRdID0gZmFsc2U7XG4gICAgICB0aGlzLiREaXNwYXRjaGVyX2lzSGFuZGxlZFtpZF0gPSBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9wZW5kaW5nUGF5bG9hZCA9IHBheWxvYWQ7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0Rpc3BhdGNoaW5nID0gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQ2xlYXIgYm9va2tlZXBpbmcgdXNlZCBmb3IgZGlzcGF0Y2hpbmcuXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUuJERpc3BhdGNoZXJfc3RvcERpc3BhdGNoaW5nPWZ1bmN0aW9uKCkge1xuICAgIHRoaXMuJERpc3BhdGNoZXJfcGVuZGluZ1BheWxvYWQgPSBudWxsO1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNEaXNwYXRjaGluZyA9IGZhbHNlO1xuICB9O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRGlzcGF0Y2hlcjtcbiIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogQHByb3ZpZGVzTW9kdWxlIGludmFyaWFudFxuICovXG5cblwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIFVzZSBpbnZhcmlhbnQoKSB0byBhc3NlcnQgc3RhdGUgd2hpY2ggeW91ciBwcm9ncmFtIGFzc3VtZXMgdG8gYmUgdHJ1ZS5cbiAqXG4gKiBQcm92aWRlIHNwcmludGYtc3R5bGUgZm9ybWF0IChvbmx5ICVzIGlzIHN1cHBvcnRlZCkgYW5kIGFyZ3VtZW50c1xuICogdG8gcHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCB3aGF0IGJyb2tlIGFuZCB3aGF0IHlvdSB3ZXJlXG4gKiBleHBlY3RpbmcuXG4gKlxuICogVGhlIGludmFyaWFudCBtZXNzYWdlIHdpbGwgYmUgc3RyaXBwZWQgaW4gcHJvZHVjdGlvbiwgYnV0IHRoZSBpbnZhcmlhbnRcbiAqIHdpbGwgcmVtYWluIHRvIGVuc3VyZSBsb2dpYyBkb2VzIG5vdCBkaWZmZXIgaW4gcHJvZHVjdGlvbi5cbiAqL1xuXG52YXIgaW52YXJpYW50ID0gZnVuY3Rpb24oY29uZGl0aW9uLCBmb3JtYXQsIGEsIGIsIGMsIGQsIGUsIGYpIHtcbiAgaWYgKGZhbHNlKSB7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFyaWFudCByZXF1aXJlcyBhbiBlcnJvciBtZXNzYWdlIGFyZ3VtZW50Jyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFjb25kaXRpb24pIHtcbiAgICB2YXIgZXJyb3I7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcihcbiAgICAgICAgJ01pbmlmaWVkIGV4Y2VwdGlvbiBvY2N1cnJlZDsgdXNlIHRoZSBub24tbWluaWZpZWQgZGV2IGVudmlyb25tZW50ICcgK1xuICAgICAgICAnZm9yIHRoZSBmdWxsIGVycm9yIG1lc3NhZ2UgYW5kIGFkZGl0aW9uYWwgaGVscGZ1bCB3YXJuaW5ncy4nXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYXJncyA9IFthLCBiLCBjLCBkLCBlLCBmXTtcbiAgICAgIHZhciBhcmdJbmRleCA9IDA7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcihcbiAgICAgICAgJ0ludmFyaWFudCBWaW9sYXRpb246ICcgK1xuICAgICAgICBmb3JtYXQucmVwbGFjZSgvJXMvZywgZnVuY3Rpb24oKSB7IHJldHVybiBhcmdzW2FyZ0luZGV4KytdOyB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBlcnJvci5mcmFtZXNUb1BvcCA9IDE7IC8vIHdlIGRvbid0IGNhcmUgYWJvdXQgaW52YXJpYW50J3Mgb3duIGZyYW1lXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW52YXJpYW50O1xuIiwiLyohIEhhbW1lci5KUyAtIHYyLjAuNCAtIDIwMTQtMDktMjhcclxuICogaHR0cDovL2hhbW1lcmpzLmdpdGh1Yi5pby9cclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDE0IEpvcmlrIFRhbmdlbGRlcjtcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlICovXHJcbihmdW5jdGlvbih3aW5kb3csIGRvY3VtZW50LCBleHBvcnROYW1lLCB1bmRlZmluZWQpIHtcclxuICAndXNlIHN0cmljdCc7XHJcblxyXG52YXIgVkVORE9SX1BSRUZJWEVTID0gWycnLCAnd2Via2l0JywgJ21veicsICdNUycsICdtcycsICdvJ107XHJcbnZhciBURVNUX0VMRU1FTlQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuXHJcbnZhciBUWVBFX0ZVTkNUSU9OID0gJ2Z1bmN0aW9uJztcclxuXHJcbnZhciByb3VuZCA9IE1hdGgucm91bmQ7XHJcbnZhciBhYnMgPSBNYXRoLmFicztcclxudmFyIG5vdyA9IERhdGUubm93O1xyXG5cclxuLyoqXHJcbiAqIHNldCBhIHRpbWVvdXQgd2l0aCBhIGdpdmVuIHNjb3BlXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lb3V0XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0XHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9XHJcbiAqL1xyXG5mdW5jdGlvbiBzZXRUaW1lb3V0Q29udGV4dChmbiwgdGltZW91dCwgY29udGV4dCkge1xyXG4gICAgcmV0dXJuIHNldFRpbWVvdXQoYmluZEZuKGZuLCBjb250ZXh0KSwgdGltZW91dCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBpZiB0aGUgYXJndW1lbnQgaXMgYW4gYXJyYXksIHdlIHdhbnQgdG8gZXhlY3V0ZSB0aGUgZm4gb24gZWFjaCBlbnRyeVxyXG4gKiBpZiBpdCBhaW50IGFuIGFycmF5IHdlIGRvbid0IHdhbnQgdG8gZG8gYSB0aGluZy5cclxuICogdGhpcyBpcyB1c2VkIGJ5IGFsbCB0aGUgbWV0aG9kcyB0aGF0IGFjY2VwdCBhIHNpbmdsZSBhbmQgYXJyYXkgYXJndW1lbnQuXHJcbiAqIEBwYXJhbSB7KnxBcnJheX0gYXJnXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBmblxyXG4gKiBAcGFyYW0ge09iamVjdH0gW2NvbnRleHRdXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gaW52b2tlQXJyYXlBcmcoYXJnLCBmbiwgY29udGV4dCkge1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xyXG4gICAgICAgIGVhY2goYXJnLCBjb250ZXh0W2ZuXSwgY29udGV4dCk7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiB3YWxrIG9iamVjdHMgYW5kIGFycmF5c1xyXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGl0ZXJhdG9yXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0XHJcbiAqL1xyXG5mdW5jdGlvbiBlYWNoKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcclxuICAgIHZhciBpO1xyXG5cclxuICAgIGlmICghb2JqKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChvYmouZm9yRWFjaCkge1xyXG4gICAgICAgIG9iai5mb3JFYWNoKGl0ZXJhdG9yLCBjb250ZXh0KTtcclxuICAgIH0gZWxzZSBpZiAob2JqLmxlbmd0aCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgaSA9IDA7XHJcbiAgICAgICAgd2hpbGUgKGkgPCBvYmoubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2ldLCBpLCBvYmopO1xyXG4gICAgICAgICAgICBpKys7XHJcbiAgICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBmb3IgKGkgaW4gb2JqKSB7XHJcbiAgICAgICAgICAgIG9iai5oYXNPd25Qcm9wZXJ0eShpKSAmJiBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtpXSwgaSwgb2JqKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBleHRlbmQgb2JqZWN0LlxyXG4gKiBtZWFucyB0aGF0IHByb3BlcnRpZXMgaW4gZGVzdCB3aWxsIGJlIG92ZXJ3cml0dGVuIGJ5IHRoZSBvbmVzIGluIHNyYy5cclxuICogQHBhcmFtIHtPYmplY3R9IGRlc3RcclxuICogQHBhcmFtIHtPYmplY3R9IHNyY1xyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFttZXJnZV1cclxuICogQHJldHVybnMge09iamVjdH0gZGVzdFxyXG4gKi9cclxuZnVuY3Rpb24gZXh0ZW5kKGRlc3QsIHNyYywgbWVyZ2UpIHtcclxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoc3JjKTtcclxuICAgIHZhciBpID0gMDtcclxuICAgIHdoaWxlIChpIDwga2V5cy5sZW5ndGgpIHtcclxuICAgICAgICBpZiAoIW1lcmdlIHx8IChtZXJnZSAmJiBkZXN0W2tleXNbaV1dID09PSB1bmRlZmluZWQpKSB7XHJcbiAgICAgICAgICAgIGRlc3Rba2V5c1tpXV0gPSBzcmNba2V5c1tpXV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGkrKztcclxuICAgIH1cclxuICAgIHJldHVybiBkZXN0O1xyXG59XHJcblxyXG4vKipcclxuICogbWVyZ2UgdGhlIHZhbHVlcyBmcm9tIHNyYyBpbiB0aGUgZGVzdC5cclxuICogbWVhbnMgdGhhdCBwcm9wZXJ0aWVzIHRoYXQgZXhpc3QgaW4gZGVzdCB3aWxsIG5vdCBiZSBvdmVyd3JpdHRlbiBieSBzcmNcclxuICogQHBhcmFtIHtPYmplY3R9IGRlc3RcclxuICogQHBhcmFtIHtPYmplY3R9IHNyY1xyXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBkZXN0XHJcbiAqL1xyXG5mdW5jdGlvbiBtZXJnZShkZXN0LCBzcmMpIHtcclxuICAgIHJldHVybiBleHRlbmQoZGVzdCwgc3JjLCB0cnVlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHNpbXBsZSBjbGFzcyBpbmhlcml0YW5jZVxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjaGlsZFxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBiYXNlXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbcHJvcGVydGllc11cclxuICovXHJcbmZ1bmN0aW9uIGluaGVyaXQoY2hpbGQsIGJhc2UsIHByb3BlcnRpZXMpIHtcclxuICAgIHZhciBiYXNlUCA9IGJhc2UucHJvdG90eXBlLFxyXG4gICAgICAgIGNoaWxkUDtcclxuXHJcbiAgICBjaGlsZFAgPSBjaGlsZC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGJhc2VQKTtcclxuICAgIGNoaWxkUC5jb25zdHJ1Y3RvciA9IGNoaWxkO1xyXG4gICAgY2hpbGRQLl9zdXBlciA9IGJhc2VQO1xyXG5cclxuICAgIGlmIChwcm9wZXJ0aWVzKSB7XHJcbiAgICAgICAgZXh0ZW5kKGNoaWxkUCwgcHJvcGVydGllcyk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBzaW1wbGUgZnVuY3Rpb24gYmluZFxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dFxyXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XHJcbiAqL1xyXG5mdW5jdGlvbiBiaW5kRm4oZm4sIGNvbnRleHQpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiBib3VuZEZuKCkge1xyXG4gICAgICAgIHJldHVybiBmbi5hcHBseShjb250ZXh0LCBhcmd1bWVudHMpO1xyXG4gICAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGxldCBhIGJvb2xlYW4gdmFsdWUgYWxzbyBiZSBhIGZ1bmN0aW9uIHRoYXQgbXVzdCByZXR1cm4gYSBib29sZWFuXHJcbiAqIHRoaXMgZmlyc3QgaXRlbSBpbiBhcmdzIHdpbGwgYmUgdXNlZCBhcyB0aGUgY29udGV4dFxyXG4gKiBAcGFyYW0ge0Jvb2xlYW58RnVuY3Rpb259IHZhbFxyXG4gKiBAcGFyYW0ge0FycmF5fSBbYXJnc11cclxuICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiBib29sT3JGbih2YWwsIGFyZ3MpIHtcclxuICAgIGlmICh0eXBlb2YgdmFsID09IFRZUEVfRlVOQ1RJT04pIHtcclxuICAgICAgICByZXR1cm4gdmFsLmFwcGx5KGFyZ3MgPyBhcmdzWzBdIHx8IHVuZGVmaW5lZCA6IHVuZGVmaW5lZCwgYXJncyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsO1xyXG59XHJcblxyXG4vKipcclxuICogdXNlIHRoZSB2YWwyIHdoZW4gdmFsMSBpcyB1bmRlZmluZWRcclxuICogQHBhcmFtIHsqfSB2YWwxXHJcbiAqIEBwYXJhbSB7Kn0gdmFsMlxyXG4gKiBAcmV0dXJucyB7Kn1cclxuICovXHJcbmZ1bmN0aW9uIGlmVW5kZWZpbmVkKHZhbDEsIHZhbDIpIHtcclxuICAgIHJldHVybiAodmFsMSA9PT0gdW5kZWZpbmVkKSA/IHZhbDIgOiB2YWwxO1xyXG59XHJcblxyXG4vKipcclxuICogYWRkRXZlbnRMaXN0ZW5lciB3aXRoIG11bHRpcGxlIGV2ZW50cyBhdCBvbmNlXHJcbiAqIEBwYXJhbSB7RXZlbnRUYXJnZXR9IHRhcmdldFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZXNcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlclxyXG4gKi9cclxuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnModGFyZ2V0LCB0eXBlcywgaGFuZGxlcikge1xyXG4gICAgZWFjaChzcGxpdFN0cih0eXBlcyksIGZ1bmN0aW9uKHR5cGUpIHtcclxuICAgICAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBoYW5kbGVyLCBmYWxzZSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHJlbW92ZUV2ZW50TGlzdGVuZXIgd2l0aCBtdWx0aXBsZSBldmVudHMgYXQgb25jZVxyXG4gKiBAcGFyYW0ge0V2ZW50VGFyZ2V0fSB0YXJnZXRcclxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVzXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXJcclxuICovXHJcbmZ1bmN0aW9uIHJlbW92ZUV2ZW50TGlzdGVuZXJzKHRhcmdldCwgdHlwZXMsIGhhbmRsZXIpIHtcclxuICAgIGVhY2goc3BsaXRTdHIodHlwZXMpLCBmdW5jdGlvbih0eXBlKSB7XHJcbiAgICAgICAgdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgaGFuZGxlciwgZmFsc2UpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBmaW5kIGlmIGEgbm9kZSBpcyBpbiB0aGUgZ2l2ZW4gcGFyZW50XHJcbiAqIEBtZXRob2QgaGFzUGFyZW50XHJcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcclxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFyZW50XHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IGZvdW5kXHJcbiAqL1xyXG5mdW5jdGlvbiBoYXNQYXJlbnQobm9kZSwgcGFyZW50KSB7XHJcbiAgICB3aGlsZSAobm9kZSkge1xyXG4gICAgICAgIGlmIChub2RlID09IHBhcmVudCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbm9kZSA9IG5vZGUucGFyZW50Tm9kZTtcclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHNtYWxsIGluZGV4T2Ygd3JhcHBlclxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaW5kXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufSBmb3VuZFxyXG4gKi9cclxuZnVuY3Rpb24gaW5TdHIoc3RyLCBmaW5kKSB7XHJcbiAgICByZXR1cm4gc3RyLmluZGV4T2YoZmluZCkgPiAtMTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHNwbGl0IHN0cmluZyBvbiB3aGl0ZXNwYWNlXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcclxuICogQHJldHVybnMge0FycmF5fSB3b3Jkc1xyXG4gKi9cclxuZnVuY3Rpb24gc3BsaXRTdHIoc3RyKSB7XHJcbiAgICByZXR1cm4gc3RyLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGZpbmQgaWYgYSBhcnJheSBjb250YWlucyB0aGUgb2JqZWN0IHVzaW5nIGluZGV4T2Ygb3IgYSBzaW1wbGUgcG9seUZpbGxcclxuICogQHBhcmFtIHtBcnJheX0gc3JjXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaW5kXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZmluZEJ5S2V5XVxyXG4gKiBAcmV0dXJuIHtCb29sZWFufE51bWJlcn0gZmFsc2Ugd2hlbiBub3QgZm91bmQsIG9yIHRoZSBpbmRleFxyXG4gKi9cclxuZnVuY3Rpb24gaW5BcnJheShzcmMsIGZpbmQsIGZpbmRCeUtleSkge1xyXG4gICAgaWYgKHNyYy5pbmRleE9mICYmICFmaW5kQnlLZXkpIHtcclxuICAgICAgICByZXR1cm4gc3JjLmluZGV4T2YoZmluZCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHZhciBpID0gMDtcclxuICAgICAgICB3aGlsZSAoaSA8IHNyYy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgaWYgKChmaW5kQnlLZXkgJiYgc3JjW2ldW2ZpbmRCeUtleV0gPT0gZmluZCkgfHwgKCFmaW5kQnlLZXkgJiYgc3JjW2ldID09PSBmaW5kKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaSsrO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gLTE7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBjb252ZXJ0IGFycmF5LWxpa2Ugb2JqZWN0cyB0byByZWFsIGFycmF5c1xyXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXHJcbiAqIEByZXR1cm5zIHtBcnJheX1cclxuICovXHJcbmZ1bmN0aW9uIHRvQXJyYXkob2JqKSB7XHJcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwob2JqLCAwKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHVuaXF1ZSBhcnJheSB3aXRoIG9iamVjdHMgYmFzZWQgb24gYSBrZXkgKGxpa2UgJ2lkJykgb3IganVzdCBieSB0aGUgYXJyYXkncyB2YWx1ZVxyXG4gKiBAcGFyYW0ge0FycmF5fSBzcmMgW3tpZDoxfSx7aWQ6Mn0se2lkOjF9XVxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2tleV1cclxuICogQHBhcmFtIHtCb29sZWFufSBbc29ydD1GYWxzZV1cclxuICogQHJldHVybnMge0FycmF5fSBbe2lkOjF9LHtpZDoyfV1cclxuICovXHJcbmZ1bmN0aW9uIHVuaXF1ZUFycmF5KHNyYywga2V5LCBzb3J0KSB7XHJcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xyXG4gICAgdmFyIHZhbHVlcyA9IFtdO1xyXG4gICAgdmFyIGkgPSAwO1xyXG5cclxuICAgIHdoaWxlIChpIDwgc3JjLmxlbmd0aCkge1xyXG4gICAgICAgIHZhciB2YWwgPSBrZXkgPyBzcmNbaV1ba2V5XSA6IHNyY1tpXTtcclxuICAgICAgICBpZiAoaW5BcnJheSh2YWx1ZXMsIHZhbCkgPCAwKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChzcmNbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YWx1ZXNbaV0gPSB2YWw7XHJcbiAgICAgICAgaSsrO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChzb3J0KSB7XHJcbiAgICAgICAgaWYgKCFrZXkpIHtcclxuICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuc29ydCgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnNvcnQoZnVuY3Rpb24gc29ydFVuaXF1ZUFycmF5KGEsIGIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBhW2tleV0gPiBiW2tleV07XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzdWx0cztcclxufVxyXG5cclxuLyoqXHJcbiAqIGdldCB0aGUgcHJlZml4ZWQgcHJvcGVydHlcclxuICogQHBhcmFtIHtPYmplY3R9IG9ialxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcclxuICogQHJldHVybnMge1N0cmluZ3xVbmRlZmluZWR9IHByZWZpeGVkXHJcbiAqL1xyXG5mdW5jdGlvbiBwcmVmaXhlZChvYmosIHByb3BlcnR5KSB7XHJcbiAgICB2YXIgcHJlZml4LCBwcm9wO1xyXG4gICAgdmFyIGNhbWVsUHJvcCA9IHByb3BlcnR5WzBdLnRvVXBwZXJDYXNlKCkgKyBwcm9wZXJ0eS5zbGljZSgxKTtcclxuXHJcbiAgICB2YXIgaSA9IDA7XHJcbiAgICB3aGlsZSAoaSA8IFZFTkRPUl9QUkVGSVhFUy5sZW5ndGgpIHtcclxuICAgICAgICBwcmVmaXggPSBWRU5ET1JfUFJFRklYRVNbaV07XHJcbiAgICAgICAgcHJvcCA9IChwcmVmaXgpID8gcHJlZml4ICsgY2FtZWxQcm9wIDogcHJvcGVydHk7XHJcblxyXG4gICAgICAgIGlmIChwcm9wIGluIG9iaikge1xyXG4gICAgICAgICAgICByZXR1cm4gcHJvcDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaSsrO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxufVxyXG5cclxuLyoqXHJcbiAqIGdldCBhIHVuaXF1ZSBpZFxyXG4gKiBAcmV0dXJucyB7bnVtYmVyfSB1bmlxdWVJZFxyXG4gKi9cclxudmFyIF91bmlxdWVJZCA9IDE7XHJcbmZ1bmN0aW9uIHVuaXF1ZUlkKCkge1xyXG4gICAgcmV0dXJuIF91bmlxdWVJZCsrO1xyXG59XHJcblxyXG4vKipcclxuICogZ2V0IHRoZSB3aW5kb3cgb2JqZWN0IG9mIGFuIGVsZW1lbnRcclxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudFxyXG4gKiBAcmV0dXJucyB7RG9jdW1lbnRWaWV3fFdpbmRvd31cclxuICovXHJcbmZ1bmN0aW9uIGdldFdpbmRvd0ZvckVsZW1lbnQoZWxlbWVudCkge1xyXG4gICAgdmFyIGRvYyA9IGVsZW1lbnQub3duZXJEb2N1bWVudDtcclxuICAgIHJldHVybiAoZG9jLmRlZmF1bHRWaWV3IHx8IGRvYy5wYXJlbnRXaW5kb3cpO1xyXG59XHJcblxyXG52YXIgTU9CSUxFX1JFR0VYID0gL21vYmlsZXx0YWJsZXR8aXAoYWR8aG9uZXxvZCl8YW5kcm9pZC9pO1xyXG5cclxudmFyIFNVUFBPUlRfVE9VQ0ggPSAoJ29udG91Y2hzdGFydCcgaW4gd2luZG93KTtcclxudmFyIFNVUFBPUlRfUE9JTlRFUl9FVkVOVFMgPSBwcmVmaXhlZCh3aW5kb3csICdQb2ludGVyRXZlbnQnKSAhPT0gdW5kZWZpbmVkO1xyXG52YXIgU1VQUE9SVF9PTkxZX1RPVUNIID0gU1VQUE9SVF9UT1VDSCAmJiBNT0JJTEVfUkVHRVgudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcclxuXHJcbnZhciBJTlBVVF9UWVBFX1RPVUNIID0gJ3RvdWNoJztcclxudmFyIElOUFVUX1RZUEVfUEVOID0gJ3Blbic7XHJcbnZhciBJTlBVVF9UWVBFX01PVVNFID0gJ21vdXNlJztcclxudmFyIElOUFVUX1RZUEVfS0lORUNUID0gJ2tpbmVjdCc7XHJcblxyXG52YXIgQ09NUFVURV9JTlRFUlZBTCA9IDI1O1xyXG5cclxudmFyIElOUFVUX1NUQVJUID0gMTtcclxudmFyIElOUFVUX01PVkUgPSAyO1xyXG52YXIgSU5QVVRfRU5EID0gNDtcclxudmFyIElOUFVUX0NBTkNFTCA9IDg7XHJcblxyXG52YXIgRElSRUNUSU9OX05PTkUgPSAxO1xyXG52YXIgRElSRUNUSU9OX0xFRlQgPSAyO1xyXG52YXIgRElSRUNUSU9OX1JJR0hUID0gNDtcclxudmFyIERJUkVDVElPTl9VUCA9IDg7XHJcbnZhciBESVJFQ1RJT05fRE9XTiA9IDE2O1xyXG5cclxudmFyIERJUkVDVElPTl9IT1JJWk9OVEFMID0gRElSRUNUSU9OX0xFRlQgfCBESVJFQ1RJT05fUklHSFQ7XHJcbnZhciBESVJFQ1RJT05fVkVSVElDQUwgPSBESVJFQ1RJT05fVVAgfCBESVJFQ1RJT05fRE9XTjtcclxudmFyIERJUkVDVElPTl9BTEwgPSBESVJFQ1RJT05fSE9SSVpPTlRBTCB8IERJUkVDVElPTl9WRVJUSUNBTDtcclxuXHJcbnZhciBQUk9QU19YWSA9IFsneCcsICd5J107XHJcbnZhciBQUk9QU19DTElFTlRfWFkgPSBbJ2NsaWVudFgnLCAnY2xpZW50WSddO1xyXG5cclxuLyoqXHJcbiAqIGNyZWF0ZSBuZXcgaW5wdXQgdHlwZSBtYW5hZ2VyXHJcbiAqIEBwYXJhbSB7TWFuYWdlcn0gbWFuYWdlclxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xyXG4gKiBAcmV0dXJucyB7SW5wdXR9XHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gSW5wdXQobWFuYWdlciwgY2FsbGJhY2spIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIHRoaXMubWFuYWdlciA9IG1hbmFnZXI7XHJcbiAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XHJcbiAgICB0aGlzLmVsZW1lbnQgPSBtYW5hZ2VyLmVsZW1lbnQ7XHJcbiAgICB0aGlzLnRhcmdldCA9IG1hbmFnZXIub3B0aW9ucy5pbnB1dFRhcmdldDtcclxuXHJcbiAgICAvLyBzbWFsbGVyIHdyYXBwZXIgYXJvdW5kIHRoZSBoYW5kbGVyLCBmb3IgdGhlIHNjb3BlIGFuZCB0aGUgZW5hYmxlZCBzdGF0ZSBvZiB0aGUgbWFuYWdlcixcclxuICAgIC8vIHNvIHdoZW4gZGlzYWJsZWQgdGhlIGlucHV0IGV2ZW50cyBhcmUgY29tcGxldGVseSBieXBhc3NlZC5cclxuICAgIHRoaXMuZG9tSGFuZGxlciA9IGZ1bmN0aW9uKGV2KSB7XHJcbiAgICAgICAgaWYgKGJvb2xPckZuKG1hbmFnZXIub3B0aW9ucy5lbmFibGUsIFttYW5hZ2VyXSkpIHtcclxuICAgICAgICAgICAgc2VsZi5oYW5kbGVyKGV2KTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuaW5pdCgpO1xyXG5cclxufVxyXG5cclxuSW5wdXQucHJvdG90eXBlID0ge1xyXG4gICAgLyoqXHJcbiAgICAgKiBzaG91bGQgaGFuZGxlIHRoZSBpbnB1dEV2ZW50IGRhdGEgYW5kIHRyaWdnZXIgdGhlIGNhbGxiYWNrXHJcbiAgICAgKiBAdmlydHVhbFxyXG4gICAgICovXHJcbiAgICBoYW5kbGVyOiBmdW5jdGlvbigpIHsgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGJpbmQgdGhlIGV2ZW50c1xyXG4gICAgICovXHJcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLmV2RWwgJiYgYWRkRXZlbnRMaXN0ZW5lcnModGhpcy5lbGVtZW50LCB0aGlzLmV2RWwsIHRoaXMuZG9tSGFuZGxlcik7XHJcbiAgICAgICAgdGhpcy5ldlRhcmdldCAmJiBhZGRFdmVudExpc3RlbmVycyh0aGlzLnRhcmdldCwgdGhpcy5ldlRhcmdldCwgdGhpcy5kb21IYW5kbGVyKTtcclxuICAgICAgICB0aGlzLmV2V2luICYmIGFkZEV2ZW50TGlzdGVuZXJzKGdldFdpbmRvd0ZvckVsZW1lbnQodGhpcy5lbGVtZW50KSwgdGhpcy5ldldpbiwgdGhpcy5kb21IYW5kbGVyKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiB1bmJpbmQgdGhlIGV2ZW50c1xyXG4gICAgICovXHJcbiAgICBkZXN0cm95OiBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLmV2RWwgJiYgcmVtb3ZlRXZlbnRMaXN0ZW5lcnModGhpcy5lbGVtZW50LCB0aGlzLmV2RWwsIHRoaXMuZG9tSGFuZGxlcik7XHJcbiAgICAgICAgdGhpcy5ldlRhcmdldCAmJiByZW1vdmVFdmVudExpc3RlbmVycyh0aGlzLnRhcmdldCwgdGhpcy5ldlRhcmdldCwgdGhpcy5kb21IYW5kbGVyKTtcclxuICAgICAgICB0aGlzLmV2V2luICYmIHJlbW92ZUV2ZW50TGlzdGVuZXJzKGdldFdpbmRvd0ZvckVsZW1lbnQodGhpcy5lbGVtZW50KSwgdGhpcy5ldldpbiwgdGhpcy5kb21IYW5kbGVyKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBjcmVhdGUgbmV3IGlucHV0IHR5cGUgbWFuYWdlclxyXG4gKiBjYWxsZWQgYnkgdGhlIE1hbmFnZXIgY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtIYW1tZXJ9IG1hbmFnZXJcclxuICogQHJldHVybnMge0lucHV0fVxyXG4gKi9cclxuZnVuY3Rpb24gY3JlYXRlSW5wdXRJbnN0YW5jZShtYW5hZ2VyKSB7XHJcbiAgICB2YXIgVHlwZTtcclxuICAgIHZhciBpbnB1dENsYXNzID0gbWFuYWdlci5vcHRpb25zLmlucHV0Q2xhc3M7XHJcblxyXG4gICAgaWYgKGlucHV0Q2xhc3MpIHtcclxuICAgICAgICBUeXBlID0gaW5wdXRDbGFzcztcclxuICAgIH0gZWxzZSBpZiAoU1VQUE9SVF9QT0lOVEVSX0VWRU5UUykge1xyXG4gICAgICAgIFR5cGUgPSBQb2ludGVyRXZlbnRJbnB1dDtcclxuICAgIH0gZWxzZSBpZiAoU1VQUE9SVF9PTkxZX1RPVUNIKSB7XHJcbiAgICAgICAgVHlwZSA9IFRvdWNoSW5wdXQ7XHJcbiAgICB9IGVsc2UgaWYgKCFTVVBQT1JUX1RPVUNIKSB7XHJcbiAgICAgICAgVHlwZSA9IE1vdXNlSW5wdXQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIFR5cGUgPSBUb3VjaE1vdXNlSW5wdXQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV3IChUeXBlKShtYW5hZ2VyLCBpbnB1dEhhbmRsZXIpO1xyXG59XHJcblxyXG4vKipcclxuICogaGFuZGxlIGlucHV0IGV2ZW50c1xyXG4gKiBAcGFyYW0ge01hbmFnZXJ9IG1hbmFnZXJcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50VHlwZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gaW5wdXRcclxuICovXHJcbmZ1bmN0aW9uIGlucHV0SGFuZGxlcihtYW5hZ2VyLCBldmVudFR5cGUsIGlucHV0KSB7XHJcbiAgICB2YXIgcG9pbnRlcnNMZW4gPSBpbnB1dC5wb2ludGVycy5sZW5ndGg7XHJcbiAgICB2YXIgY2hhbmdlZFBvaW50ZXJzTGVuID0gaW5wdXQuY2hhbmdlZFBvaW50ZXJzLmxlbmd0aDtcclxuICAgIHZhciBpc0ZpcnN0ID0gKGV2ZW50VHlwZSAmIElOUFVUX1NUQVJUICYmIChwb2ludGVyc0xlbiAtIGNoYW5nZWRQb2ludGVyc0xlbiA9PT0gMCkpO1xyXG4gICAgdmFyIGlzRmluYWwgPSAoZXZlbnRUeXBlICYgKElOUFVUX0VORCB8IElOUFVUX0NBTkNFTCkgJiYgKHBvaW50ZXJzTGVuIC0gY2hhbmdlZFBvaW50ZXJzTGVuID09PSAwKSk7XHJcblxyXG4gICAgaW5wdXQuaXNGaXJzdCA9ICEhaXNGaXJzdDtcclxuICAgIGlucHV0LmlzRmluYWwgPSAhIWlzRmluYWw7XHJcblxyXG4gICAgaWYgKGlzRmlyc3QpIHtcclxuICAgICAgICBtYW5hZ2VyLnNlc3Npb24gPSB7fTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBzb3VyY2UgZXZlbnQgaXMgdGhlIG5vcm1hbGl6ZWQgdmFsdWUgb2YgdGhlIGRvbUV2ZW50c1xyXG4gICAgLy8gbGlrZSAndG91Y2hzdGFydCwgbW91c2V1cCwgcG9pbnRlcmRvd24nXHJcbiAgICBpbnB1dC5ldmVudFR5cGUgPSBldmVudFR5cGU7XHJcblxyXG4gICAgLy8gY29tcHV0ZSBzY2FsZSwgcm90YXRpb24gZXRjXHJcbiAgICBjb21wdXRlSW5wdXREYXRhKG1hbmFnZXIsIGlucHV0KTtcclxuXHJcbiAgICAvLyBlbWl0IHNlY3JldCBldmVudFxyXG4gICAgbWFuYWdlci5lbWl0KCdoYW1tZXIuaW5wdXQnLCBpbnB1dCk7XHJcblxyXG4gICAgbWFuYWdlci5yZWNvZ25pemUoaW5wdXQpO1xyXG4gICAgbWFuYWdlci5zZXNzaW9uLnByZXZJbnB1dCA9IGlucHV0O1xyXG59XHJcblxyXG4vKipcclxuICogZXh0ZW5kIHRoZSBkYXRhIHdpdGggc29tZSB1c2FibGUgcHJvcGVydGllcyBsaWtlIHNjYWxlLCByb3RhdGUsIHZlbG9jaXR5IGV0Y1xyXG4gKiBAcGFyYW0ge09iamVjdH0gbWFuYWdlclxyXG4gKiBAcGFyYW0ge09iamVjdH0gaW5wdXRcclxuICovXHJcbmZ1bmN0aW9uIGNvbXB1dGVJbnB1dERhdGEobWFuYWdlciwgaW5wdXQpIHtcclxuICAgIHZhciBzZXNzaW9uID0gbWFuYWdlci5zZXNzaW9uO1xyXG4gICAgdmFyIHBvaW50ZXJzID0gaW5wdXQucG9pbnRlcnM7XHJcbiAgICB2YXIgcG9pbnRlcnNMZW5ndGggPSBwb2ludGVycy5sZW5ndGg7XHJcblxyXG4gICAgLy8gc3RvcmUgdGhlIGZpcnN0IGlucHV0IHRvIGNhbGN1bGF0ZSB0aGUgZGlzdGFuY2UgYW5kIGRpcmVjdGlvblxyXG4gICAgaWYgKCFzZXNzaW9uLmZpcnN0SW5wdXQpIHtcclxuICAgICAgICBzZXNzaW9uLmZpcnN0SW5wdXQgPSBzaW1wbGVDbG9uZUlucHV0RGF0YShpbnB1dCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gdG8gY29tcHV0ZSBzY2FsZSBhbmQgcm90YXRpb24gd2UgbmVlZCB0byBzdG9yZSB0aGUgbXVsdGlwbGUgdG91Y2hlc1xyXG4gICAgaWYgKHBvaW50ZXJzTGVuZ3RoID4gMSAmJiAhc2Vzc2lvbi5maXJzdE11bHRpcGxlKSB7XHJcbiAgICAgICAgc2Vzc2lvbi5maXJzdE11bHRpcGxlID0gc2ltcGxlQ2xvbmVJbnB1dERhdGEoaW5wdXQpO1xyXG4gICAgfSBlbHNlIGlmIChwb2ludGVyc0xlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgIHNlc3Npb24uZmlyc3RNdWx0aXBsZSA9IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBmaXJzdElucHV0ID0gc2Vzc2lvbi5maXJzdElucHV0O1xyXG4gICAgdmFyIGZpcnN0TXVsdGlwbGUgPSBzZXNzaW9uLmZpcnN0TXVsdGlwbGU7XHJcbiAgICB2YXIgb2Zmc2V0Q2VudGVyID0gZmlyc3RNdWx0aXBsZSA/IGZpcnN0TXVsdGlwbGUuY2VudGVyIDogZmlyc3RJbnB1dC5jZW50ZXI7XHJcblxyXG4gICAgdmFyIGNlbnRlciA9IGlucHV0LmNlbnRlciA9IGdldENlbnRlcihwb2ludGVycyk7XHJcbiAgICBpbnB1dC50aW1lU3RhbXAgPSBub3coKTtcclxuICAgIGlucHV0LmRlbHRhVGltZSA9IGlucHV0LnRpbWVTdGFtcCAtIGZpcnN0SW5wdXQudGltZVN0YW1wO1xyXG5cclxuICAgIGlucHV0LmFuZ2xlID0gZ2V0QW5nbGUob2Zmc2V0Q2VudGVyLCBjZW50ZXIpO1xyXG4gICAgaW5wdXQuZGlzdGFuY2UgPSBnZXREaXN0YW5jZShvZmZzZXRDZW50ZXIsIGNlbnRlcik7XHJcblxyXG4gICAgY29tcHV0ZURlbHRhWFkoc2Vzc2lvbiwgaW5wdXQpO1xyXG4gICAgaW5wdXQub2Zmc2V0RGlyZWN0aW9uID0gZ2V0RGlyZWN0aW9uKGlucHV0LmRlbHRhWCwgaW5wdXQuZGVsdGFZKTtcclxuXHJcbiAgICBpbnB1dC5zY2FsZSA9IGZpcnN0TXVsdGlwbGUgPyBnZXRTY2FsZShmaXJzdE11bHRpcGxlLnBvaW50ZXJzLCBwb2ludGVycykgOiAxO1xyXG4gICAgaW5wdXQucm90YXRpb24gPSBmaXJzdE11bHRpcGxlID8gZ2V0Um90YXRpb24oZmlyc3RNdWx0aXBsZS5wb2ludGVycywgcG9pbnRlcnMpIDogMDtcclxuXHJcbiAgICBjb21wdXRlSW50ZXJ2YWxJbnB1dERhdGEoc2Vzc2lvbiwgaW5wdXQpO1xyXG5cclxuICAgIC8vIGZpbmQgdGhlIGNvcnJlY3QgdGFyZ2V0XHJcbiAgICB2YXIgdGFyZ2V0ID0gbWFuYWdlci5lbGVtZW50O1xyXG4gICAgaWYgKGhhc1BhcmVudChpbnB1dC5zcmNFdmVudC50YXJnZXQsIHRhcmdldCkpIHtcclxuICAgICAgICB0YXJnZXQgPSBpbnB1dC5zcmNFdmVudC50YXJnZXQ7XHJcbiAgICB9XHJcbiAgICBpbnB1dC50YXJnZXQgPSB0YXJnZXQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNvbXB1dGVEZWx0YVhZKHNlc3Npb24sIGlucHV0KSB7XHJcbiAgICB2YXIgY2VudGVyID0gaW5wdXQuY2VudGVyO1xyXG4gICAgdmFyIG9mZnNldCA9IHNlc3Npb24ub2Zmc2V0RGVsdGEgfHwge307XHJcbiAgICB2YXIgcHJldkRlbHRhID0gc2Vzc2lvbi5wcmV2RGVsdGEgfHwge307XHJcbiAgICB2YXIgcHJldklucHV0ID0gc2Vzc2lvbi5wcmV2SW5wdXQgfHwge307XHJcblxyXG4gICAgaWYgKGlucHV0LmV2ZW50VHlwZSA9PT0gSU5QVVRfU1RBUlQgfHwgcHJldklucHV0LmV2ZW50VHlwZSA9PT0gSU5QVVRfRU5EKSB7XHJcbiAgICAgICAgcHJldkRlbHRhID0gc2Vzc2lvbi5wcmV2RGVsdGEgPSB7XHJcbiAgICAgICAgICAgIHg6IHByZXZJbnB1dC5kZWx0YVggfHwgMCxcclxuICAgICAgICAgICAgeTogcHJldklucHV0LmRlbHRhWSB8fCAwXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgb2Zmc2V0ID0gc2Vzc2lvbi5vZmZzZXREZWx0YSA9IHtcclxuICAgICAgICAgICAgeDogY2VudGVyLngsXHJcbiAgICAgICAgICAgIHk6IGNlbnRlci55XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBpbnB1dC5kZWx0YVggPSBwcmV2RGVsdGEueCArIChjZW50ZXIueCAtIG9mZnNldC54KTtcclxuICAgIGlucHV0LmRlbHRhWSA9IHByZXZEZWx0YS55ICsgKGNlbnRlci55IC0gb2Zmc2V0LnkpO1xyXG59XHJcblxyXG4vKipcclxuICogdmVsb2NpdHkgaXMgY2FsY3VsYXRlZCBldmVyeSB4IG1zXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBzZXNzaW9uXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dFxyXG4gKi9cclxuZnVuY3Rpb24gY29tcHV0ZUludGVydmFsSW5wdXREYXRhKHNlc3Npb24sIGlucHV0KSB7XHJcbiAgICB2YXIgbGFzdCA9IHNlc3Npb24ubGFzdEludGVydmFsIHx8IGlucHV0LFxyXG4gICAgICAgIGRlbHRhVGltZSA9IGlucHV0LnRpbWVTdGFtcCAtIGxhc3QudGltZVN0YW1wLFxyXG4gICAgICAgIHZlbG9jaXR5LCB2ZWxvY2l0eVgsIHZlbG9jaXR5WSwgZGlyZWN0aW9uO1xyXG5cclxuICAgIGlmIChpbnB1dC5ldmVudFR5cGUgIT0gSU5QVVRfQ0FOQ0VMICYmIChkZWx0YVRpbWUgPiBDT01QVVRFX0lOVEVSVkFMIHx8IGxhc3QudmVsb2NpdHkgPT09IHVuZGVmaW5lZCkpIHtcclxuICAgICAgICB2YXIgZGVsdGFYID0gbGFzdC5kZWx0YVggLSBpbnB1dC5kZWx0YVg7XHJcbiAgICAgICAgdmFyIGRlbHRhWSA9IGxhc3QuZGVsdGFZIC0gaW5wdXQuZGVsdGFZO1xyXG5cclxuICAgICAgICB2YXIgdiA9IGdldFZlbG9jaXR5KGRlbHRhVGltZSwgZGVsdGFYLCBkZWx0YVkpO1xyXG4gICAgICAgIHZlbG9jaXR5WCA9IHYueDtcclxuICAgICAgICB2ZWxvY2l0eVkgPSB2Lnk7XHJcbiAgICAgICAgdmVsb2NpdHkgPSAoYWJzKHYueCkgPiBhYnModi55KSkgPyB2LnggOiB2Lnk7XHJcbiAgICAgICAgZGlyZWN0aW9uID0gZ2V0RGlyZWN0aW9uKGRlbHRhWCwgZGVsdGFZKTtcclxuXHJcbiAgICAgICAgc2Vzc2lvbi5sYXN0SW50ZXJ2YWwgPSBpbnB1dDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gdXNlIGxhdGVzdCB2ZWxvY2l0eSBpbmZvIGlmIGl0IGRvZXNuJ3Qgb3ZlcnRha2UgYSBtaW5pbXVtIHBlcmlvZFxyXG4gICAgICAgIHZlbG9jaXR5ID0gbGFzdC52ZWxvY2l0eTtcclxuICAgICAgICB2ZWxvY2l0eVggPSBsYXN0LnZlbG9jaXR5WDtcclxuICAgICAgICB2ZWxvY2l0eVkgPSBsYXN0LnZlbG9jaXR5WTtcclxuICAgICAgICBkaXJlY3Rpb24gPSBsYXN0LmRpcmVjdGlvbjtcclxuICAgIH1cclxuXHJcbiAgICBpbnB1dC52ZWxvY2l0eSA9IHZlbG9jaXR5O1xyXG4gICAgaW5wdXQudmVsb2NpdHlYID0gdmVsb2NpdHlYO1xyXG4gICAgaW5wdXQudmVsb2NpdHlZID0gdmVsb2NpdHlZO1xyXG4gICAgaW5wdXQuZGlyZWN0aW9uID0gZGlyZWN0aW9uO1xyXG59XHJcblxyXG4vKipcclxuICogY3JlYXRlIGEgc2ltcGxlIGNsb25lIGZyb20gdGhlIGlucHV0IHVzZWQgZm9yIHN0b3JhZ2Ugb2YgZmlyc3RJbnB1dCBhbmQgZmlyc3RNdWx0aXBsZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gaW5wdXRcclxuICogQHJldHVybnMge09iamVjdH0gY2xvbmVkSW5wdXREYXRhXHJcbiAqL1xyXG5mdW5jdGlvbiBzaW1wbGVDbG9uZUlucHV0RGF0YShpbnB1dCkge1xyXG4gICAgLy8gbWFrZSBhIHNpbXBsZSBjb3B5IG9mIHRoZSBwb2ludGVycyBiZWNhdXNlIHdlIHdpbGwgZ2V0IGEgcmVmZXJlbmNlIGlmIHdlIGRvbid0XHJcbiAgICAvLyB3ZSBvbmx5IG5lZWQgY2xpZW50WFkgZm9yIHRoZSBjYWxjdWxhdGlvbnNcclxuICAgIHZhciBwb2ludGVycyA9IFtdO1xyXG4gICAgdmFyIGkgPSAwO1xyXG4gICAgd2hpbGUgKGkgPCBpbnB1dC5wb2ludGVycy5sZW5ndGgpIHtcclxuICAgICAgICBwb2ludGVyc1tpXSA9IHtcclxuICAgICAgICAgICAgY2xpZW50WDogcm91bmQoaW5wdXQucG9pbnRlcnNbaV0uY2xpZW50WCksXHJcbiAgICAgICAgICAgIGNsaWVudFk6IHJvdW5kKGlucHV0LnBvaW50ZXJzW2ldLmNsaWVudFkpXHJcbiAgICAgICAgfTtcclxuICAgICAgICBpKys7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB0aW1lU3RhbXA6IG5vdygpLFxyXG4gICAgICAgIHBvaW50ZXJzOiBwb2ludGVycyxcclxuICAgICAgICBjZW50ZXI6IGdldENlbnRlcihwb2ludGVycyksXHJcbiAgICAgICAgZGVsdGFYOiBpbnB1dC5kZWx0YVgsXHJcbiAgICAgICAgZGVsdGFZOiBpbnB1dC5kZWx0YVlcclxuICAgIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBnZXQgdGhlIGNlbnRlciBvZiBhbGwgdGhlIHBvaW50ZXJzXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHBvaW50ZXJzXHJcbiAqIEByZXR1cm4ge09iamVjdH0gY2VudGVyIGNvbnRhaW5zIGB4YCBhbmQgYHlgIHByb3BlcnRpZXNcclxuICovXHJcbmZ1bmN0aW9uIGdldENlbnRlcihwb2ludGVycykge1xyXG4gICAgdmFyIHBvaW50ZXJzTGVuZ3RoID0gcG9pbnRlcnMubGVuZ3RoO1xyXG5cclxuICAgIC8vIG5vIG5lZWQgdG8gbG9vcCB3aGVuIG9ubHkgb25lIHRvdWNoXHJcbiAgICBpZiAocG9pbnRlcnNMZW5ndGggPT09IDEpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB4OiByb3VuZChwb2ludGVyc1swXS5jbGllbnRYKSxcclxuICAgICAgICAgICAgeTogcm91bmQocG9pbnRlcnNbMF0uY2xpZW50WSlcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB4ID0gMCwgeSA9IDAsIGkgPSAwO1xyXG4gICAgd2hpbGUgKGkgPCBwb2ludGVyc0xlbmd0aCkge1xyXG4gICAgICAgIHggKz0gcG9pbnRlcnNbaV0uY2xpZW50WDtcclxuICAgICAgICB5ICs9IHBvaW50ZXJzW2ldLmNsaWVudFk7XHJcbiAgICAgICAgaSsrO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgeDogcm91bmQoeCAvIHBvaW50ZXJzTGVuZ3RoKSxcclxuICAgICAgICB5OiByb3VuZCh5IC8gcG9pbnRlcnNMZW5ndGgpXHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogY2FsY3VsYXRlIHRoZSB2ZWxvY2l0eSBiZXR3ZWVuIHR3byBwb2ludHMuIHVuaXQgaXMgaW4gcHggcGVyIG1zLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gZGVsdGFUaW1lXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB4XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB5XHJcbiAqIEByZXR1cm4ge09iamVjdH0gdmVsb2NpdHkgYHhgIGFuZCBgeWBcclxuICovXHJcbmZ1bmN0aW9uIGdldFZlbG9jaXR5KGRlbHRhVGltZSwgeCwgeSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB4OiB4IC8gZGVsdGFUaW1lIHx8IDAsXHJcbiAgICAgICAgeTogeSAvIGRlbHRhVGltZSB8fCAwXHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogZ2V0IHRoZSBkaXJlY3Rpb24gYmV0d2VlbiB0d28gcG9pbnRzXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB4XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB5XHJcbiAqIEByZXR1cm4ge051bWJlcn0gZGlyZWN0aW9uXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXREaXJlY3Rpb24oeCwgeSkge1xyXG4gICAgaWYgKHggPT09IHkpIHtcclxuICAgICAgICByZXR1cm4gRElSRUNUSU9OX05PTkU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGFicyh4KSA+PSBhYnMoeSkpIHtcclxuICAgICAgICByZXR1cm4geCA+IDAgPyBESVJFQ1RJT05fTEVGVCA6IERJUkVDVElPTl9SSUdIVDtcclxuICAgIH1cclxuICAgIHJldHVybiB5ID4gMCA/IERJUkVDVElPTl9VUCA6IERJUkVDVElPTl9ET1dOO1xyXG59XHJcblxyXG4vKipcclxuICogY2FsY3VsYXRlIHRoZSBhYnNvbHV0ZSBkaXN0YW5jZSBiZXR3ZWVuIHR3byBwb2ludHNcclxuICogQHBhcmFtIHtPYmplY3R9IHAxIHt4LCB5fVxyXG4gKiBAcGFyYW0ge09iamVjdH0gcDIge3gsIHl9XHJcbiAqIEBwYXJhbSB7QXJyYXl9IFtwcm9wc10gY29udGFpbmluZyB4IGFuZCB5IGtleXNcclxuICogQHJldHVybiB7TnVtYmVyfSBkaXN0YW5jZVxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0RGlzdGFuY2UocDEsIHAyLCBwcm9wcykge1xyXG4gICAgaWYgKCFwcm9wcykge1xyXG4gICAgICAgIHByb3BzID0gUFJPUFNfWFk7XHJcbiAgICB9XHJcbiAgICB2YXIgeCA9IHAyW3Byb3BzWzBdXSAtIHAxW3Byb3BzWzBdXSxcclxuICAgICAgICB5ID0gcDJbcHJvcHNbMV1dIC0gcDFbcHJvcHNbMV1dO1xyXG5cclxuICAgIHJldHVybiBNYXRoLnNxcnQoKHggKiB4KSArICh5ICogeSkpO1xyXG59XHJcblxyXG4vKipcclxuICogY2FsY3VsYXRlIHRoZSBhbmdsZSBiZXR3ZWVuIHR3byBjb29yZGluYXRlc1xyXG4gKiBAcGFyYW0ge09iamVjdH0gcDFcclxuICogQHBhcmFtIHtPYmplY3R9IHAyXHJcbiAqIEBwYXJhbSB7QXJyYXl9IFtwcm9wc10gY29udGFpbmluZyB4IGFuZCB5IGtleXNcclxuICogQHJldHVybiB7TnVtYmVyfSBhbmdsZVxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0QW5nbGUocDEsIHAyLCBwcm9wcykge1xyXG4gICAgaWYgKCFwcm9wcykge1xyXG4gICAgICAgIHByb3BzID0gUFJPUFNfWFk7XHJcbiAgICB9XHJcbiAgICB2YXIgeCA9IHAyW3Byb3BzWzBdXSAtIHAxW3Byb3BzWzBdXSxcclxuICAgICAgICB5ID0gcDJbcHJvcHNbMV1dIC0gcDFbcHJvcHNbMV1dO1xyXG4gICAgcmV0dXJuIE1hdGguYXRhbjIoeSwgeCkgKiAxODAgLyBNYXRoLlBJO1xyXG59XHJcblxyXG4vKipcclxuICogY2FsY3VsYXRlIHRoZSByb3RhdGlvbiBkZWdyZWVzIGJldHdlZW4gdHdvIHBvaW50ZXJzZXRzXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHN0YXJ0IGFycmF5IG9mIHBvaW50ZXJzXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGVuZCBhcnJheSBvZiBwb2ludGVyc1xyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IHJvdGF0aW9uXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRSb3RhdGlvbihzdGFydCwgZW5kKSB7XHJcbiAgICByZXR1cm4gZ2V0QW5nbGUoZW5kWzFdLCBlbmRbMF0sIFBST1BTX0NMSUVOVF9YWSkgLSBnZXRBbmdsZShzdGFydFsxXSwgc3RhcnRbMF0sIFBST1BTX0NMSUVOVF9YWSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBjYWxjdWxhdGUgdGhlIHNjYWxlIGZhY3RvciBiZXR3ZWVuIHR3byBwb2ludGVyc2V0c1xyXG4gKiBubyBzY2FsZSBpcyAxLCBhbmQgZ29lcyBkb3duIHRvIDAgd2hlbiBwaW5jaGVkIHRvZ2V0aGVyLCBhbmQgYmlnZ2VyIHdoZW4gcGluY2hlZCBvdXRcclxuICogQHBhcmFtIHtBcnJheX0gc3RhcnQgYXJyYXkgb2YgcG9pbnRlcnNcclxuICogQHBhcmFtIHtBcnJheX0gZW5kIGFycmF5IG9mIHBvaW50ZXJzXHJcbiAqIEByZXR1cm4ge051bWJlcn0gc2NhbGVcclxuICovXHJcbmZ1bmN0aW9uIGdldFNjYWxlKHN0YXJ0LCBlbmQpIHtcclxuICAgIHJldHVybiBnZXREaXN0YW5jZShlbmRbMF0sIGVuZFsxXSwgUFJPUFNfQ0xJRU5UX1hZKSAvIGdldERpc3RhbmNlKHN0YXJ0WzBdLCBzdGFydFsxXSwgUFJPUFNfQ0xJRU5UX1hZKTtcclxufVxyXG5cclxudmFyIE1PVVNFX0lOUFVUX01BUCA9IHtcclxuICAgIG1vdXNlZG93bjogSU5QVVRfU1RBUlQsXHJcbiAgICBtb3VzZW1vdmU6IElOUFVUX01PVkUsXHJcbiAgICBtb3VzZXVwOiBJTlBVVF9FTkRcclxufTtcclxuXHJcbnZhciBNT1VTRV9FTEVNRU5UX0VWRU5UUyA9ICdtb3VzZWRvd24nO1xyXG52YXIgTU9VU0VfV0lORE9XX0VWRU5UUyA9ICdtb3VzZW1vdmUgbW91c2V1cCc7XHJcblxyXG4vKipcclxuICogTW91c2UgZXZlbnRzIGlucHV0XHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBJbnB1dFxyXG4gKi9cclxuZnVuY3Rpb24gTW91c2VJbnB1dCgpIHtcclxuICAgIHRoaXMuZXZFbCA9IE1PVVNFX0VMRU1FTlRfRVZFTlRTO1xyXG4gICAgdGhpcy5ldldpbiA9IE1PVVNFX1dJTkRPV19FVkVOVFM7XHJcblxyXG4gICAgdGhpcy5hbGxvdyA9IHRydWU7IC8vIHVzZWQgYnkgSW5wdXQuVG91Y2hNb3VzZSB0byBkaXNhYmxlIG1vdXNlIGV2ZW50c1xyXG4gICAgdGhpcy5wcmVzc2VkID0gZmFsc2U7IC8vIG1vdXNlZG93biBzdGF0ZVxyXG5cclxuICAgIElucHV0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmluaGVyaXQoTW91c2VJbnB1dCwgSW5wdXQsIHtcclxuICAgIC8qKlxyXG4gICAgICogaGFuZGxlIG1vdXNlIGV2ZW50c1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGV2XHJcbiAgICAgKi9cclxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uIE1FaGFuZGxlcihldikge1xyXG4gICAgICAgIHZhciBldmVudFR5cGUgPSBNT1VTRV9JTlBVVF9NQVBbZXYudHlwZV07XHJcblxyXG4gICAgICAgIC8vIG9uIHN0YXJ0IHdlIHdhbnQgdG8gaGF2ZSB0aGUgbGVmdCBtb3VzZSBidXR0b24gZG93blxyXG4gICAgICAgIGlmIChldmVudFR5cGUgJiBJTlBVVF9TVEFSVCAmJiBldi5idXR0b24gPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy5wcmVzc2VkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChldmVudFR5cGUgJiBJTlBVVF9NT1ZFICYmIGV2LndoaWNoICE9PSAxKSB7XHJcbiAgICAgICAgICAgIGV2ZW50VHlwZSA9IElOUFVUX0VORDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIG1vdXNlIG11c3QgYmUgZG93biwgYW5kIG1vdXNlIGV2ZW50cyBhcmUgYWxsb3dlZCAoc2VlIHRoZSBUb3VjaE1vdXNlIGlucHV0KVxyXG4gICAgICAgIGlmICghdGhpcy5wcmVzc2VkIHx8ICF0aGlzLmFsbG93KSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChldmVudFR5cGUgJiBJTlBVVF9FTkQpIHtcclxuICAgICAgICAgICAgdGhpcy5wcmVzc2VkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmNhbGxiYWNrKHRoaXMubWFuYWdlciwgZXZlbnRUeXBlLCB7XHJcbiAgICAgICAgICAgIHBvaW50ZXJzOiBbZXZdLFxyXG4gICAgICAgICAgICBjaGFuZ2VkUG9pbnRlcnM6IFtldl0sXHJcbiAgICAgICAgICAgIHBvaW50ZXJUeXBlOiBJTlBVVF9UWVBFX01PVVNFLFxyXG4gICAgICAgICAgICBzcmNFdmVudDogZXZcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7XHJcblxyXG52YXIgUE9JTlRFUl9JTlBVVF9NQVAgPSB7XHJcbiAgICBwb2ludGVyZG93bjogSU5QVVRfU1RBUlQsXHJcbiAgICBwb2ludGVybW92ZTogSU5QVVRfTU9WRSxcclxuICAgIHBvaW50ZXJ1cDogSU5QVVRfRU5ELFxyXG4gICAgcG9pbnRlcmNhbmNlbDogSU5QVVRfQ0FOQ0VMLFxyXG4gICAgcG9pbnRlcm91dDogSU5QVVRfQ0FOQ0VMXHJcbn07XHJcblxyXG4vLyBpbiBJRTEwIHRoZSBwb2ludGVyIHR5cGVzIGlzIGRlZmluZWQgYXMgYW4gZW51bVxyXG52YXIgSUUxMF9QT0lOVEVSX1RZUEVfRU5VTSA9IHtcclxuICAgIDI6IElOUFVUX1RZUEVfVE9VQ0gsXHJcbiAgICAzOiBJTlBVVF9UWVBFX1BFTixcclxuICAgIDQ6IElOUFVUX1RZUEVfTU9VU0UsXHJcbiAgICA1OiBJTlBVVF9UWVBFX0tJTkVDVCAvLyBzZWUgaHR0cHM6Ly90d2l0dGVyLmNvbS9qYWNvYnJvc3NpL3N0YXR1cy80ODA1OTY0Mzg0ODk4OTA4MTZcclxufTtcclxuXHJcbnZhciBQT0lOVEVSX0VMRU1FTlRfRVZFTlRTID0gJ3BvaW50ZXJkb3duJztcclxudmFyIFBPSU5URVJfV0lORE9XX0VWRU5UUyA9ICdwb2ludGVybW92ZSBwb2ludGVydXAgcG9pbnRlcmNhbmNlbCc7XHJcblxyXG4vLyBJRTEwIGhhcyBwcmVmaXhlZCBzdXBwb3J0LCBhbmQgY2FzZS1zZW5zaXRpdmVcclxuaWYgKHdpbmRvdy5NU1BvaW50ZXJFdmVudCkge1xyXG4gICAgUE9JTlRFUl9FTEVNRU5UX0VWRU5UUyA9ICdNU1BvaW50ZXJEb3duJztcclxuICAgIFBPSU5URVJfV0lORE9XX0VWRU5UUyA9ICdNU1BvaW50ZXJNb3ZlIE1TUG9pbnRlclVwIE1TUG9pbnRlckNhbmNlbCc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQb2ludGVyIGV2ZW50cyBpbnB1dFxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgSW5wdXRcclxuICovXHJcbmZ1bmN0aW9uIFBvaW50ZXJFdmVudElucHV0KCkge1xyXG4gICAgdGhpcy5ldkVsID0gUE9JTlRFUl9FTEVNRU5UX0VWRU5UUztcclxuICAgIHRoaXMuZXZXaW4gPSBQT0lOVEVSX1dJTkRPV19FVkVOVFM7XHJcblxyXG4gICAgSW5wdXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHJcbiAgICB0aGlzLnN0b3JlID0gKHRoaXMubWFuYWdlci5zZXNzaW9uLnBvaW50ZXJFdmVudHMgPSBbXSk7XHJcbn1cclxuXHJcbmluaGVyaXQoUG9pbnRlckV2ZW50SW5wdXQsIElucHV0LCB7XHJcbiAgICAvKipcclxuICAgICAqIGhhbmRsZSBtb3VzZSBldmVudHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBldlxyXG4gICAgICovXHJcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiBQRWhhbmRsZXIoZXYpIHtcclxuICAgICAgICB2YXIgc3RvcmUgPSB0aGlzLnN0b3JlO1xyXG4gICAgICAgIHZhciByZW1vdmVQb2ludGVyID0gZmFsc2U7XHJcblxyXG4gICAgICAgIHZhciBldmVudFR5cGVOb3JtYWxpemVkID0gZXYudHlwZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoJ21zJywgJycpO1xyXG4gICAgICAgIHZhciBldmVudFR5cGUgPSBQT0lOVEVSX0lOUFVUX01BUFtldmVudFR5cGVOb3JtYWxpemVkXTtcclxuICAgICAgICB2YXIgcG9pbnRlclR5cGUgPSBJRTEwX1BPSU5URVJfVFlQRV9FTlVNW2V2LnBvaW50ZXJUeXBlXSB8fCBldi5wb2ludGVyVHlwZTtcclxuXHJcbiAgICAgICAgdmFyIGlzVG91Y2ggPSAocG9pbnRlclR5cGUgPT0gSU5QVVRfVFlQRV9UT1VDSCk7XHJcblxyXG4gICAgICAgIC8vIGdldCBpbmRleCBvZiB0aGUgZXZlbnQgaW4gdGhlIHN0b3JlXHJcbiAgICAgICAgdmFyIHN0b3JlSW5kZXggPSBpbkFycmF5KHN0b3JlLCBldi5wb2ludGVySWQsICdwb2ludGVySWQnKTtcclxuXHJcbiAgICAgICAgLy8gc3RhcnQgYW5kIG1vdXNlIG11c3QgYmUgZG93blxyXG4gICAgICAgIGlmIChldmVudFR5cGUgJiBJTlBVVF9TVEFSVCAmJiAoZXYuYnV0dG9uID09PSAwIHx8IGlzVG91Y2gpKSB7XHJcbiAgICAgICAgICAgIGlmIChzdG9yZUluZGV4IDwgMCkge1xyXG4gICAgICAgICAgICAgICAgc3RvcmUucHVzaChldik7XHJcbiAgICAgICAgICAgICAgICBzdG9yZUluZGV4ID0gc3RvcmUubGVuZ3RoIC0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSBpZiAoZXZlbnRUeXBlICYgKElOUFVUX0VORCB8IElOUFVUX0NBTkNFTCkpIHtcclxuICAgICAgICAgICAgcmVtb3ZlUG9pbnRlciA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBpdCBub3QgZm91bmQsIHNvIHRoZSBwb2ludGVyIGhhc24ndCBiZWVuIGRvd24gKHNvIGl0J3MgcHJvYmFibHkgYSBob3ZlcilcclxuICAgICAgICBpZiAoc3RvcmVJbmRleCA8IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gdXBkYXRlIHRoZSBldmVudCBpbiB0aGUgc3RvcmVcclxuICAgICAgICBzdG9yZVtzdG9yZUluZGV4XSA9IGV2O1xyXG5cclxuICAgICAgICB0aGlzLmNhbGxiYWNrKHRoaXMubWFuYWdlciwgZXZlbnRUeXBlLCB7XHJcbiAgICAgICAgICAgIHBvaW50ZXJzOiBzdG9yZSxcclxuICAgICAgICAgICAgY2hhbmdlZFBvaW50ZXJzOiBbZXZdLFxyXG4gICAgICAgICAgICBwb2ludGVyVHlwZTogcG9pbnRlclR5cGUsXHJcbiAgICAgICAgICAgIHNyY0V2ZW50OiBldlxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAocmVtb3ZlUG9pbnRlcikge1xyXG4gICAgICAgICAgICAvLyByZW1vdmUgZnJvbSB0aGUgc3RvcmVcclxuICAgICAgICAgICAgc3RvcmUuc3BsaWNlKHN0b3JlSW5kZXgsIDEpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG52YXIgU0lOR0xFX1RPVUNIX0lOUFVUX01BUCA9IHtcclxuICAgIHRvdWNoc3RhcnQ6IElOUFVUX1NUQVJULFxyXG4gICAgdG91Y2htb3ZlOiBJTlBVVF9NT1ZFLFxyXG4gICAgdG91Y2hlbmQ6IElOUFVUX0VORCxcclxuICAgIHRvdWNoY2FuY2VsOiBJTlBVVF9DQU5DRUxcclxufTtcclxuXHJcbnZhciBTSU5HTEVfVE9VQ0hfVEFSR0VUX0VWRU5UUyA9ICd0b3VjaHN0YXJ0JztcclxudmFyIFNJTkdMRV9UT1VDSF9XSU5ET1dfRVZFTlRTID0gJ3RvdWNoc3RhcnQgdG91Y2htb3ZlIHRvdWNoZW5kIHRvdWNoY2FuY2VsJztcclxuXHJcbi8qKlxyXG4gKiBUb3VjaCBldmVudHMgaW5wdXRcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIElucHV0XHJcbiAqL1xyXG5mdW5jdGlvbiBTaW5nbGVUb3VjaElucHV0KCkge1xyXG4gICAgdGhpcy5ldlRhcmdldCA9IFNJTkdMRV9UT1VDSF9UQVJHRVRfRVZFTlRTO1xyXG4gICAgdGhpcy5ldldpbiA9IFNJTkdMRV9UT1VDSF9XSU5ET1dfRVZFTlRTO1xyXG4gICAgdGhpcy5zdGFydGVkID0gZmFsc2U7XHJcblxyXG4gICAgSW5wdXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuaW5oZXJpdChTaW5nbGVUb3VjaElucHV0LCBJbnB1dCwge1xyXG4gICAgaGFuZGxlcjogZnVuY3Rpb24gVEVoYW5kbGVyKGV2KSB7XHJcbiAgICAgICAgdmFyIHR5cGUgPSBTSU5HTEVfVE9VQ0hfSU5QVVRfTUFQW2V2LnR5cGVdO1xyXG5cclxuICAgICAgICAvLyBzaG91bGQgd2UgaGFuZGxlIHRoZSB0b3VjaCBldmVudHM/XHJcbiAgICAgICAgaWYgKHR5cGUgPT09IElOUFVUX1NUQVJUKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhcnRlZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIXRoaXMuc3RhcnRlZCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgdG91Y2hlcyA9IG5vcm1hbGl6ZVNpbmdsZVRvdWNoZXMuY2FsbCh0aGlzLCBldiwgdHlwZSk7XHJcblxyXG4gICAgICAgIC8vIHdoZW4gZG9uZSwgcmVzZXQgdGhlIHN0YXJ0ZWQgc3RhdGVcclxuICAgICAgICBpZiAodHlwZSAmIChJTlBVVF9FTkQgfCBJTlBVVF9DQU5DRUwpICYmIHRvdWNoZXNbMF0ubGVuZ3RoIC0gdG91Y2hlc1sxXS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy5zdGFydGVkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmNhbGxiYWNrKHRoaXMubWFuYWdlciwgdHlwZSwge1xyXG4gICAgICAgICAgICBwb2ludGVyczogdG91Y2hlc1swXSxcclxuICAgICAgICAgICAgY2hhbmdlZFBvaW50ZXJzOiB0b3VjaGVzWzFdLFxyXG4gICAgICAgICAgICBwb2ludGVyVHlwZTogSU5QVVRfVFlQRV9UT1VDSCxcclxuICAgICAgICAgICAgc3JjRXZlbnQ6IGV2XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIEB0aGlzIHtUb3VjaElucHV0fVxyXG4gKiBAcGFyYW0ge09iamVjdH0gZXZcclxuICogQHBhcmFtIHtOdW1iZXJ9IHR5cGUgZmxhZ1xyXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfEFycmF5fSBbYWxsLCBjaGFuZ2VkXVxyXG4gKi9cclxuZnVuY3Rpb24gbm9ybWFsaXplU2luZ2xlVG91Y2hlcyhldiwgdHlwZSkge1xyXG4gICAgdmFyIGFsbCA9IHRvQXJyYXkoZXYudG91Y2hlcyk7XHJcbiAgICB2YXIgY2hhbmdlZCA9IHRvQXJyYXkoZXYuY2hhbmdlZFRvdWNoZXMpO1xyXG5cclxuICAgIGlmICh0eXBlICYgKElOUFVUX0VORCB8IElOUFVUX0NBTkNFTCkpIHtcclxuICAgICAgICBhbGwgPSB1bmlxdWVBcnJheShhbGwuY29uY2F0KGNoYW5nZWQpLCAnaWRlbnRpZmllcicsIHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBbYWxsLCBjaGFuZ2VkXTtcclxufVxyXG5cclxudmFyIFRPVUNIX0lOUFVUX01BUCA9IHtcclxuICAgIHRvdWNoc3RhcnQ6IElOUFVUX1NUQVJULFxyXG4gICAgdG91Y2htb3ZlOiBJTlBVVF9NT1ZFLFxyXG4gICAgdG91Y2hlbmQ6IElOUFVUX0VORCxcclxuICAgIHRvdWNoY2FuY2VsOiBJTlBVVF9DQU5DRUxcclxufTtcclxuXHJcbnZhciBUT1VDSF9UQVJHRVRfRVZFTlRTID0gJ3RvdWNoc3RhcnQgdG91Y2htb3ZlIHRvdWNoZW5kIHRvdWNoY2FuY2VsJztcclxuXHJcbi8qKlxyXG4gKiBNdWx0aS11c2VyIHRvdWNoIGV2ZW50cyBpbnB1dFxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgSW5wdXRcclxuICovXHJcbmZ1bmN0aW9uIFRvdWNoSW5wdXQoKSB7XHJcbiAgICB0aGlzLmV2VGFyZ2V0ID0gVE9VQ0hfVEFSR0VUX0VWRU5UUztcclxuICAgIHRoaXMudGFyZ2V0SWRzID0ge307XHJcblxyXG4gICAgSW5wdXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuaW5oZXJpdChUb3VjaElucHV0LCBJbnB1dCwge1xyXG4gICAgaGFuZGxlcjogZnVuY3Rpb24gTVRFaGFuZGxlcihldikge1xyXG4gICAgICAgIHZhciB0eXBlID0gVE9VQ0hfSU5QVVRfTUFQW2V2LnR5cGVdO1xyXG4gICAgICAgIHZhciB0b3VjaGVzID0gZ2V0VG91Y2hlcy5jYWxsKHRoaXMsIGV2LCB0eXBlKTtcclxuICAgICAgICBpZiAoIXRvdWNoZXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jYWxsYmFjayh0aGlzLm1hbmFnZXIsIHR5cGUsIHtcclxuICAgICAgICAgICAgcG9pbnRlcnM6IHRvdWNoZXNbMF0sXHJcbiAgICAgICAgICAgIGNoYW5nZWRQb2ludGVyczogdG91Y2hlc1sxXSxcclxuICAgICAgICAgICAgcG9pbnRlclR5cGU6IElOUFVUX1RZUEVfVE9VQ0gsXHJcbiAgICAgICAgICAgIHNyY0V2ZW50OiBldlxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBAdGhpcyB7VG91Y2hJbnB1dH1cclxuICogQHBhcmFtIHtPYmplY3R9IGV2XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB0eXBlIGZsYWdcclxuICogQHJldHVybnMge3VuZGVmaW5lZHxBcnJheX0gW2FsbCwgY2hhbmdlZF1cclxuICovXHJcbmZ1bmN0aW9uIGdldFRvdWNoZXMoZXYsIHR5cGUpIHtcclxuICAgIHZhciBhbGxUb3VjaGVzID0gdG9BcnJheShldi50b3VjaGVzKTtcclxuICAgIHZhciB0YXJnZXRJZHMgPSB0aGlzLnRhcmdldElkcztcclxuXHJcbiAgICAvLyB3aGVuIHRoZXJlIGlzIG9ubHkgb25lIHRvdWNoLCB0aGUgcHJvY2VzcyBjYW4gYmUgc2ltcGxpZmllZFxyXG4gICAgaWYgKHR5cGUgJiAoSU5QVVRfU1RBUlQgfCBJTlBVVF9NT1ZFKSAmJiBhbGxUb3VjaGVzLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgIHRhcmdldElkc1thbGxUb3VjaGVzWzBdLmlkZW50aWZpZXJdID0gdHJ1ZTtcclxuICAgICAgICByZXR1cm4gW2FsbFRvdWNoZXMsIGFsbFRvdWNoZXNdO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBpLFxyXG4gICAgICAgIHRhcmdldFRvdWNoZXMsXHJcbiAgICAgICAgY2hhbmdlZFRvdWNoZXMgPSB0b0FycmF5KGV2LmNoYW5nZWRUb3VjaGVzKSxcclxuICAgICAgICBjaGFuZ2VkVGFyZ2V0VG91Y2hlcyA9IFtdLFxyXG4gICAgICAgIHRhcmdldCA9IHRoaXMudGFyZ2V0O1xyXG5cclxuICAgIC8vIGdldCB0YXJnZXQgdG91Y2hlcyBmcm9tIHRvdWNoZXNcclxuICAgIHRhcmdldFRvdWNoZXMgPSBhbGxUb3VjaGVzLmZpbHRlcihmdW5jdGlvbih0b3VjaCkge1xyXG4gICAgICAgIHJldHVybiBoYXNQYXJlbnQodG91Y2gudGFyZ2V0LCB0YXJnZXQpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gY29sbGVjdCB0b3VjaGVzXHJcbiAgICBpZiAodHlwZSA9PT0gSU5QVVRfU1RBUlQpIHtcclxuICAgICAgICBpID0gMDtcclxuICAgICAgICB3aGlsZSAoaSA8IHRhcmdldFRvdWNoZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHRhcmdldElkc1t0YXJnZXRUb3VjaGVzW2ldLmlkZW50aWZpZXJdID0gdHJ1ZTtcclxuICAgICAgICAgICAgaSsrO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBmaWx0ZXIgY2hhbmdlZCB0b3VjaGVzIHRvIG9ubHkgY29udGFpbiB0b3VjaGVzIHRoYXQgZXhpc3QgaW4gdGhlIGNvbGxlY3RlZCB0YXJnZXQgaWRzXHJcbiAgICBpID0gMDtcclxuICAgIHdoaWxlIChpIDwgY2hhbmdlZFRvdWNoZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgaWYgKHRhcmdldElkc1tjaGFuZ2VkVG91Y2hlc1tpXS5pZGVudGlmaWVyXSkge1xyXG4gICAgICAgICAgICBjaGFuZ2VkVGFyZ2V0VG91Y2hlcy5wdXNoKGNoYW5nZWRUb3VjaGVzW2ldKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGNsZWFudXAgcmVtb3ZlZCB0b3VjaGVzXHJcbiAgICAgICAgaWYgKHR5cGUgJiAoSU5QVVRfRU5EIHwgSU5QVVRfQ0FOQ0VMKSkge1xyXG4gICAgICAgICAgICBkZWxldGUgdGFyZ2V0SWRzW2NoYW5nZWRUb3VjaGVzW2ldLmlkZW50aWZpZXJdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpKys7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFjaGFuZ2VkVGFyZ2V0VG91Y2hlcy5sZW5ndGgpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIFtcclxuICAgICAgICAvLyBtZXJnZSB0YXJnZXRUb3VjaGVzIHdpdGggY2hhbmdlZFRhcmdldFRvdWNoZXMgc28gaXQgY29udGFpbnMgQUxMIHRvdWNoZXMsIGluY2x1ZGluZyAnZW5kJyBhbmQgJ2NhbmNlbCdcclxuICAgICAgICB1bmlxdWVBcnJheSh0YXJnZXRUb3VjaGVzLmNvbmNhdChjaGFuZ2VkVGFyZ2V0VG91Y2hlcyksICdpZGVudGlmaWVyJywgdHJ1ZSksXHJcbiAgICAgICAgY2hhbmdlZFRhcmdldFRvdWNoZXNcclxuICAgIF07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21iaW5lZCB0b3VjaCBhbmQgbW91c2UgaW5wdXRcclxuICpcclxuICogVG91Y2ggaGFzIGEgaGlnaGVyIHByaW9yaXR5IHRoZW4gbW91c2UsIGFuZCB3aGlsZSB0b3VjaGluZyBubyBtb3VzZSBldmVudHMgYXJlIGFsbG93ZWQuXHJcbiAqIFRoaXMgYmVjYXVzZSB0b3VjaCBkZXZpY2VzIGFsc28gZW1pdCBtb3VzZSBldmVudHMgd2hpbGUgZG9pbmcgYSB0b3VjaC5cclxuICpcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIElucHV0XHJcbiAqL1xyXG5mdW5jdGlvbiBUb3VjaE1vdXNlSW5wdXQoKSB7XHJcbiAgICBJbnB1dC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cclxuICAgIHZhciBoYW5kbGVyID0gYmluZEZuKHRoaXMuaGFuZGxlciwgdGhpcyk7XHJcbiAgICB0aGlzLnRvdWNoID0gbmV3IFRvdWNoSW5wdXQodGhpcy5tYW5hZ2VyLCBoYW5kbGVyKTtcclxuICAgIHRoaXMubW91c2UgPSBuZXcgTW91c2VJbnB1dCh0aGlzLm1hbmFnZXIsIGhhbmRsZXIpO1xyXG59XHJcblxyXG5pbmhlcml0KFRvdWNoTW91c2VJbnB1dCwgSW5wdXQsIHtcclxuICAgIC8qKlxyXG4gICAgICogaGFuZGxlIG1vdXNlIGFuZCB0b3VjaCBldmVudHNcclxuICAgICAqIEBwYXJhbSB7SGFtbWVyfSBtYW5hZ2VyXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXRFdmVudFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0RGF0YVxyXG4gICAgICovXHJcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiBUTUVoYW5kbGVyKG1hbmFnZXIsIGlucHV0RXZlbnQsIGlucHV0RGF0YSkge1xyXG4gICAgICAgIHZhciBpc1RvdWNoID0gKGlucHV0RGF0YS5wb2ludGVyVHlwZSA9PSBJTlBVVF9UWVBFX1RPVUNIKSxcclxuICAgICAgICAgICAgaXNNb3VzZSA9IChpbnB1dERhdGEucG9pbnRlclR5cGUgPT0gSU5QVVRfVFlQRV9NT1VTRSk7XHJcblxyXG4gICAgICAgIC8vIHdoZW4gd2UncmUgaW4gYSB0b3VjaCBldmVudCwgc28gIGJsb2NrIGFsbCB1cGNvbWluZyBtb3VzZSBldmVudHNcclxuICAgICAgICAvLyBtb3N0IG1vYmlsZSBicm93c2VyIGFsc28gZW1pdCBtb3VzZWV2ZW50cywgcmlnaHQgYWZ0ZXIgdG91Y2hzdGFydFxyXG4gICAgICAgIGlmIChpc1RvdWNoKSB7XHJcbiAgICAgICAgICAgIHRoaXMubW91c2UuYWxsb3cgPSBmYWxzZTtcclxuICAgICAgICB9IGVsc2UgaWYgKGlzTW91c2UgJiYgIXRoaXMubW91c2UuYWxsb3cpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gcmVzZXQgdGhlIGFsbG93TW91c2Ugd2hlbiB3ZSdyZSBkb25lXHJcbiAgICAgICAgaWYgKGlucHV0RXZlbnQgJiAoSU5QVVRfRU5EIHwgSU5QVVRfQ0FOQ0VMKSkge1xyXG4gICAgICAgICAgICB0aGlzLm1vdXNlLmFsbG93ID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY2FsbGJhY2sobWFuYWdlciwgaW5wdXRFdmVudCwgaW5wdXREYXRhKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiByZW1vdmUgdGhlIGV2ZW50IGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBkZXN0cm95OiBmdW5jdGlvbiBkZXN0cm95KCkge1xyXG4gICAgICAgIHRoaXMudG91Y2guZGVzdHJveSgpO1xyXG4gICAgICAgIHRoaXMubW91c2UuZGVzdHJveSgpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBQUkVGSVhFRF9UT1VDSF9BQ1RJT04gPSBwcmVmaXhlZChURVNUX0VMRU1FTlQuc3R5bGUsICd0b3VjaEFjdGlvbicpO1xyXG52YXIgTkFUSVZFX1RPVUNIX0FDVElPTiA9IFBSRUZJWEVEX1RPVUNIX0FDVElPTiAhPT0gdW5kZWZpbmVkO1xyXG5cclxuLy8gbWFnaWNhbCB0b3VjaEFjdGlvbiB2YWx1ZVxyXG52YXIgVE9VQ0hfQUNUSU9OX0NPTVBVVEUgPSAnY29tcHV0ZSc7XHJcbnZhciBUT1VDSF9BQ1RJT05fQVVUTyA9ICdhdXRvJztcclxudmFyIFRPVUNIX0FDVElPTl9NQU5JUFVMQVRJT04gPSAnbWFuaXB1bGF0aW9uJzsgLy8gbm90IGltcGxlbWVudGVkXHJcbnZhciBUT1VDSF9BQ1RJT05fTk9ORSA9ICdub25lJztcclxudmFyIFRPVUNIX0FDVElPTl9QQU5fWCA9ICdwYW4teCc7XHJcbnZhciBUT1VDSF9BQ1RJT05fUEFOX1kgPSAncGFuLXknO1xyXG5cclxuLyoqXHJcbiAqIFRvdWNoIEFjdGlvblxyXG4gKiBzZXRzIHRoZSB0b3VjaEFjdGlvbiBwcm9wZXJ0eSBvciB1c2VzIHRoZSBqcyBhbHRlcm5hdGl2ZVxyXG4gKiBAcGFyYW0ge01hbmFnZXJ9IG1hbmFnZXJcclxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gVG91Y2hBY3Rpb24obWFuYWdlciwgdmFsdWUpIHtcclxuICAgIHRoaXMubWFuYWdlciA9IG1hbmFnZXI7XHJcbiAgICB0aGlzLnNldCh2YWx1ZSk7XHJcbn1cclxuXHJcblRvdWNoQWN0aW9uLnByb3RvdHlwZSA9IHtcclxuICAgIC8qKlxyXG4gICAgICogc2V0IHRoZSB0b3VjaEFjdGlvbiB2YWx1ZSBvbiB0aGUgZWxlbWVudCBvciBlbmFibGUgdGhlIHBvbHlmaWxsXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWVcclxuICAgICAqL1xyXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgIC8vIGZpbmQgb3V0IHRoZSB0b3VjaC1hY3Rpb24gYnkgdGhlIGV2ZW50IGhhbmRsZXJzXHJcbiAgICAgICAgaWYgKHZhbHVlID09IFRPVUNIX0FDVElPTl9DT01QVVRFKSB7XHJcbiAgICAgICAgICAgIHZhbHVlID0gdGhpcy5jb21wdXRlKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoTkFUSVZFX1RPVUNIX0FDVElPTikge1xyXG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuZWxlbWVudC5zdHlsZVtQUkVGSVhFRF9UT1VDSF9BQ1RJT05dID0gdmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYWN0aW9ucyA9IHZhbHVlLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGp1c3QgcmUtc2V0IHRoZSB0b3VjaEFjdGlvbiB2YWx1ZVxyXG4gICAgICovXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuc2V0KHRoaXMubWFuYWdlci5vcHRpb25zLnRvdWNoQWN0aW9uKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBjb21wdXRlIHRoZSB2YWx1ZSBmb3IgdGhlIHRvdWNoQWN0aW9uIHByb3BlcnR5IGJhc2VkIG9uIHRoZSByZWNvZ25pemVyJ3Mgc2V0dGluZ3NcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IHZhbHVlXHJcbiAgICAgKi9cclxuICAgIGNvbXB1dGU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBhY3Rpb25zID0gW107XHJcbiAgICAgICAgZWFjaCh0aGlzLm1hbmFnZXIucmVjb2duaXplcnMsIGZ1bmN0aW9uKHJlY29nbml6ZXIpIHtcclxuICAgICAgICAgICAgaWYgKGJvb2xPckZuKHJlY29nbml6ZXIub3B0aW9ucy5lbmFibGUsIFtyZWNvZ25pemVyXSkpIHtcclxuICAgICAgICAgICAgICAgIGFjdGlvbnMgPSBhY3Rpb25zLmNvbmNhdChyZWNvZ25pemVyLmdldFRvdWNoQWN0aW9uKCkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIGNsZWFuVG91Y2hBY3Rpb25zKGFjdGlvbnMuam9pbignICcpKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiB0aGlzIG1ldGhvZCBpcyBjYWxsZWQgb24gZWFjaCBpbnB1dCBjeWNsZSBhbmQgcHJvdmlkZXMgdGhlIHByZXZlbnRpbmcgb2YgdGhlIGJyb3dzZXIgYmVoYXZpb3JcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dFxyXG4gICAgICovXHJcbiAgICBwcmV2ZW50RGVmYXVsdHM6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgLy8gbm90IG5lZWRlZCB3aXRoIG5hdGl2ZSBzdXBwb3J0IGZvciB0aGUgdG91Y2hBY3Rpb24gcHJvcGVydHlcclxuICAgICAgICBpZiAoTkFUSVZFX1RPVUNIX0FDVElPTikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgc3JjRXZlbnQgPSBpbnB1dC5zcmNFdmVudDtcclxuICAgICAgICB2YXIgZGlyZWN0aW9uID0gaW5wdXQub2Zmc2V0RGlyZWN0aW9uO1xyXG5cclxuICAgICAgICAvLyBpZiB0aGUgdG91Y2ggYWN0aW9uIGRpZCBwcmV2ZW50ZWQgb25jZSB0aGlzIHNlc3Npb25cclxuICAgICAgICBpZiAodGhpcy5tYW5hZ2VyLnNlc3Npb24ucHJldmVudGVkKSB7XHJcbiAgICAgICAgICAgIHNyY0V2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBhY3Rpb25zID0gdGhpcy5hY3Rpb25zO1xyXG4gICAgICAgIHZhciBoYXNOb25lID0gaW5TdHIoYWN0aW9ucywgVE9VQ0hfQUNUSU9OX05PTkUpO1xyXG4gICAgICAgIHZhciBoYXNQYW5ZID0gaW5TdHIoYWN0aW9ucywgVE9VQ0hfQUNUSU9OX1BBTl9ZKTtcclxuICAgICAgICB2YXIgaGFzUGFuWCA9IGluU3RyKGFjdGlvbnMsIFRPVUNIX0FDVElPTl9QQU5fWCk7XHJcblxyXG4gICAgICAgIGlmIChoYXNOb25lIHx8XHJcbiAgICAgICAgICAgIChoYXNQYW5ZICYmIGRpcmVjdGlvbiAmIERJUkVDVElPTl9IT1JJWk9OVEFMKSB8fFxyXG4gICAgICAgICAgICAoaGFzUGFuWCAmJiBkaXJlY3Rpb24gJiBESVJFQ1RJT05fVkVSVElDQUwpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnByZXZlbnRTcmMoc3JjRXZlbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBjYWxsIHByZXZlbnREZWZhdWx0IHRvIHByZXZlbnQgdGhlIGJyb3dzZXIncyBkZWZhdWx0IGJlaGF2aW9yIChzY3JvbGxpbmcgaW4gbW9zdCBjYXNlcylcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzcmNFdmVudFxyXG4gICAgICovXHJcbiAgICBwcmV2ZW50U3JjOiBmdW5jdGlvbihzcmNFdmVudCkge1xyXG4gICAgICAgIHRoaXMubWFuYWdlci5zZXNzaW9uLnByZXZlbnRlZCA9IHRydWU7XHJcbiAgICAgICAgc3JjRXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiB3aGVuIHRoZSB0b3VjaEFjdGlvbnMgYXJlIGNvbGxlY3RlZCB0aGV5IGFyZSBub3QgYSB2YWxpZCB2YWx1ZSwgc28gd2UgbmVlZCB0byBjbGVhbiB0aGluZ3MgdXAuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGFjdGlvbnNcclxuICogQHJldHVybnMgeyp9XHJcbiAqL1xyXG5mdW5jdGlvbiBjbGVhblRvdWNoQWN0aW9ucyhhY3Rpb25zKSB7XHJcbiAgICAvLyBub25lXHJcbiAgICBpZiAoaW5TdHIoYWN0aW9ucywgVE9VQ0hfQUNUSU9OX05PTkUpKSB7XHJcbiAgICAgICAgcmV0dXJuIFRPVUNIX0FDVElPTl9OT05FO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBoYXNQYW5YID0gaW5TdHIoYWN0aW9ucywgVE9VQ0hfQUNUSU9OX1BBTl9YKTtcclxuICAgIHZhciBoYXNQYW5ZID0gaW5TdHIoYWN0aW9ucywgVE9VQ0hfQUNUSU9OX1BBTl9ZKTtcclxuXHJcbiAgICAvLyBwYW4teCBhbmQgcGFuLXkgY2FuIGJlIGNvbWJpbmVkXHJcbiAgICBpZiAoaGFzUGFuWCAmJiBoYXNQYW5ZKSB7XHJcbiAgICAgICAgcmV0dXJuIFRPVUNIX0FDVElPTl9QQU5fWCArICcgJyArIFRPVUNIX0FDVElPTl9QQU5fWTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBwYW4teCBPUiBwYW4teVxyXG4gICAgaWYgKGhhc1BhblggfHwgaGFzUGFuWSkge1xyXG4gICAgICAgIHJldHVybiBoYXNQYW5YID8gVE9VQ0hfQUNUSU9OX1BBTl9YIDogVE9VQ0hfQUNUSU9OX1BBTl9ZO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIG1hbmlwdWxhdGlvblxyXG4gICAgaWYgKGluU3RyKGFjdGlvbnMsIFRPVUNIX0FDVElPTl9NQU5JUFVMQVRJT04pKSB7XHJcbiAgICAgICAgcmV0dXJuIFRPVUNIX0FDVElPTl9NQU5JUFVMQVRJT047XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIFRPVUNIX0FDVElPTl9BVVRPO1xyXG59XHJcblxyXG4vKipcclxuICogUmVjb2duaXplciBmbG93IGV4cGxhaW5lZDsgKlxyXG4gKiBBbGwgcmVjb2duaXplcnMgaGF2ZSB0aGUgaW5pdGlhbCBzdGF0ZSBvZiBQT1NTSUJMRSB3aGVuIGEgaW5wdXQgc2Vzc2lvbiBzdGFydHMuXHJcbiAqIFRoZSBkZWZpbml0aW9uIG9mIGEgaW5wdXQgc2Vzc2lvbiBpcyBmcm9tIHRoZSBmaXJzdCBpbnB1dCB1bnRpbCB0aGUgbGFzdCBpbnB1dCwgd2l0aCBhbGwgaXQncyBtb3ZlbWVudCBpbiBpdC4gKlxyXG4gKiBFeGFtcGxlIHNlc3Npb24gZm9yIG1vdXNlLWlucHV0OiBtb3VzZWRvd24gLT4gbW91c2Vtb3ZlIC0+IG1vdXNldXBcclxuICpcclxuICogT24gZWFjaCByZWNvZ25pemluZyBjeWNsZSAoc2VlIE1hbmFnZXIucmVjb2duaXplKSB0aGUgLnJlY29nbml6ZSgpIG1ldGhvZCBpcyBleGVjdXRlZFxyXG4gKiB3aGljaCBkZXRlcm1pbmVzIHdpdGggc3RhdGUgaXQgc2hvdWxkIGJlLlxyXG4gKlxyXG4gKiBJZiB0aGUgcmVjb2duaXplciBoYXMgdGhlIHN0YXRlIEZBSUxFRCwgQ0FOQ0VMTEVEIG9yIFJFQ09HTklaRUQgKGVxdWFscyBFTkRFRCksIGl0IGlzIHJlc2V0IHRvXHJcbiAqIFBPU1NJQkxFIHRvIGdpdmUgaXQgYW5vdGhlciBjaGFuZ2Ugb24gdGhlIG5leHQgY3ljbGUuXHJcbiAqXHJcbiAqICAgICAgICAgICAgICAgUG9zc2libGVcclxuICogICAgICAgICAgICAgICAgICB8XHJcbiAqICAgICAgICAgICAgKy0tLS0tKy0tLS0tLS0tLS0tLS0tLStcclxuICogICAgICAgICAgICB8ICAgICAgICAgICAgICAgICAgICAgfFxyXG4gKiAgICAgICstLS0tLSstLS0tLSsgICAgICAgICAgICAgICB8XHJcbiAqICAgICAgfCAgICAgICAgICAgfCAgICAgICAgICAgICAgIHxcclxuICogICBGYWlsZWQgICAgICBDYW5jZWxsZWQgICAgICAgICAgfFxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgKy0tLS0tLS0rLS0tLS0tK1xyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgfFxyXG4gKiAgICAgICAgICAgICAgICAgICAgICBSZWNvZ25pemVkICAgICAgIEJlZ2FuXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDaGFuZ2VkXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEVuZGVkL1JlY29nbml6ZWRcclxuICovXHJcbnZhciBTVEFURV9QT1NTSUJMRSA9IDE7XHJcbnZhciBTVEFURV9CRUdBTiA9IDI7XHJcbnZhciBTVEFURV9DSEFOR0VEID0gNDtcclxudmFyIFNUQVRFX0VOREVEID0gODtcclxudmFyIFNUQVRFX1JFQ09HTklaRUQgPSBTVEFURV9FTkRFRDtcclxudmFyIFNUQVRFX0NBTkNFTExFRCA9IDE2O1xyXG52YXIgU1RBVEVfRkFJTEVEID0gMzI7XHJcblxyXG4vKipcclxuICogUmVjb2duaXplclxyXG4gKiBFdmVyeSByZWNvZ25pemVyIG5lZWRzIHRvIGV4dGVuZCBmcm9tIHRoaXMgY2xhc3MuXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xyXG4gKi9cclxuZnVuY3Rpb24gUmVjb2duaXplcihvcHRpb25zKSB7XHJcbiAgICB0aGlzLmlkID0gdW5pcXVlSWQoKTtcclxuXHJcbiAgICB0aGlzLm1hbmFnZXIgPSBudWxsO1xyXG4gICAgdGhpcy5vcHRpb25zID0gbWVyZ2Uob3B0aW9ucyB8fCB7fSwgdGhpcy5kZWZhdWx0cyk7XHJcblxyXG4gICAgLy8gZGVmYXVsdCBpcyBlbmFibGUgdHJ1ZVxyXG4gICAgdGhpcy5vcHRpb25zLmVuYWJsZSA9IGlmVW5kZWZpbmVkKHRoaXMub3B0aW9ucy5lbmFibGUsIHRydWUpO1xyXG5cclxuICAgIHRoaXMuc3RhdGUgPSBTVEFURV9QT1NTSUJMRTtcclxuXHJcbiAgICB0aGlzLnNpbXVsdGFuZW91cyA9IHt9O1xyXG4gICAgdGhpcy5yZXF1aXJlRmFpbCA9IFtdO1xyXG59XHJcblxyXG5SZWNvZ25pemVyLnByb3RvdHlwZSA9IHtcclxuICAgIC8qKlxyXG4gICAgICogQHZpcnR1YWxcclxuICAgICAqIEB0eXBlIHtPYmplY3R9XHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRzOiB7fSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHNldCBvcHRpb25zXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xyXG4gICAgICogQHJldHVybiB7UmVjb2duaXplcn1cclxuICAgICAqL1xyXG4gICAgc2V0OiBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgICAgICAgZXh0ZW5kKHRoaXMub3B0aW9ucywgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vIGFsc28gdXBkYXRlIHRoZSB0b3VjaEFjdGlvbiwgaW4gY2FzZSBzb21ldGhpbmcgY2hhbmdlZCBhYm91dCB0aGUgZGlyZWN0aW9ucy9lbmFibGVkIHN0YXRlXHJcbiAgICAgICAgdGhpcy5tYW5hZ2VyICYmIHRoaXMubWFuYWdlci50b3VjaEFjdGlvbi51cGRhdGUoKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiByZWNvZ25pemUgc2ltdWx0YW5lb3VzIHdpdGggYW4gb3RoZXIgcmVjb2duaXplci5cclxuICAgICAqIEBwYXJhbSB7UmVjb2duaXplcn0gb3RoZXJSZWNvZ25pemVyXHJcbiAgICAgKiBAcmV0dXJucyB7UmVjb2duaXplcn0gdGhpc1xyXG4gICAgICovXHJcbiAgICByZWNvZ25pemVXaXRoOiBmdW5jdGlvbihvdGhlclJlY29nbml6ZXIpIHtcclxuICAgICAgICBpZiAoaW52b2tlQXJyYXlBcmcob3RoZXJSZWNvZ25pemVyLCAncmVjb2duaXplV2l0aCcsIHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHNpbXVsdGFuZW91cyA9IHRoaXMuc2ltdWx0YW5lb3VzO1xyXG4gICAgICAgIG90aGVyUmVjb2duaXplciA9IGdldFJlY29nbml6ZXJCeU5hbWVJZk1hbmFnZXIob3RoZXJSZWNvZ25pemVyLCB0aGlzKTtcclxuICAgICAgICBpZiAoIXNpbXVsdGFuZW91c1tvdGhlclJlY29nbml6ZXIuaWRdKSB7XHJcbiAgICAgICAgICAgIHNpbXVsdGFuZW91c1tvdGhlclJlY29nbml6ZXIuaWRdID0gb3RoZXJSZWNvZ25pemVyO1xyXG4gICAgICAgICAgICBvdGhlclJlY29nbml6ZXIucmVjb2duaXplV2l0aCh0aGlzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogZHJvcCB0aGUgc2ltdWx0YW5lb3VzIGxpbmsuIGl0IGRvZXNudCByZW1vdmUgdGhlIGxpbmsgb24gdGhlIG90aGVyIHJlY29nbml6ZXIuXHJcbiAgICAgKiBAcGFyYW0ge1JlY29nbml6ZXJ9IG90aGVyUmVjb2duaXplclxyXG4gICAgICogQHJldHVybnMge1JlY29nbml6ZXJ9IHRoaXNcclxuICAgICAqL1xyXG4gICAgZHJvcFJlY29nbml6ZVdpdGg6IGZ1bmN0aW9uKG90aGVyUmVjb2duaXplcikge1xyXG4gICAgICAgIGlmIChpbnZva2VBcnJheUFyZyhvdGhlclJlY29nbml6ZXIsICdkcm9wUmVjb2duaXplV2l0aCcsIHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgb3RoZXJSZWNvZ25pemVyID0gZ2V0UmVjb2duaXplckJ5TmFtZUlmTWFuYWdlcihvdGhlclJlY29nbml6ZXIsIHRoaXMpO1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLnNpbXVsdGFuZW91c1tvdGhlclJlY29nbml6ZXIuaWRdO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHJlY29nbml6ZXIgY2FuIG9ubHkgcnVuIHdoZW4gYW4gb3RoZXIgaXMgZmFpbGluZ1xyXG4gICAgICogQHBhcmFtIHtSZWNvZ25pemVyfSBvdGhlclJlY29nbml6ZXJcclxuICAgICAqIEByZXR1cm5zIHtSZWNvZ25pemVyfSB0aGlzXHJcbiAgICAgKi9cclxuICAgIHJlcXVpcmVGYWlsdXJlOiBmdW5jdGlvbihvdGhlclJlY29nbml6ZXIpIHtcclxuICAgICAgICBpZiAoaW52b2tlQXJyYXlBcmcob3RoZXJSZWNvZ25pemVyLCAncmVxdWlyZUZhaWx1cmUnLCB0aGlzKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciByZXF1aXJlRmFpbCA9IHRoaXMucmVxdWlyZUZhaWw7XHJcbiAgICAgICAgb3RoZXJSZWNvZ25pemVyID0gZ2V0UmVjb2duaXplckJ5TmFtZUlmTWFuYWdlcihvdGhlclJlY29nbml6ZXIsIHRoaXMpO1xyXG4gICAgICAgIGlmIChpbkFycmF5KHJlcXVpcmVGYWlsLCBvdGhlclJlY29nbml6ZXIpID09PSAtMSkge1xyXG4gICAgICAgICAgICByZXF1aXJlRmFpbC5wdXNoKG90aGVyUmVjb2duaXplcik7XHJcbiAgICAgICAgICAgIG90aGVyUmVjb2duaXplci5yZXF1aXJlRmFpbHVyZSh0aGlzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogZHJvcCB0aGUgcmVxdWlyZUZhaWx1cmUgbGluay4gaXQgZG9lcyBub3QgcmVtb3ZlIHRoZSBsaW5rIG9uIHRoZSBvdGhlciByZWNvZ25pemVyLlxyXG4gICAgICogQHBhcmFtIHtSZWNvZ25pemVyfSBvdGhlclJlY29nbml6ZXJcclxuICAgICAqIEByZXR1cm5zIHtSZWNvZ25pemVyfSB0aGlzXHJcbiAgICAgKi9cclxuICAgIGRyb3BSZXF1aXJlRmFpbHVyZTogZnVuY3Rpb24ob3RoZXJSZWNvZ25pemVyKSB7XHJcbiAgICAgICAgaWYgKGludm9rZUFycmF5QXJnKG90aGVyUmVjb2duaXplciwgJ2Ryb3BSZXF1aXJlRmFpbHVyZScsIHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgb3RoZXJSZWNvZ25pemVyID0gZ2V0UmVjb2duaXplckJ5TmFtZUlmTWFuYWdlcihvdGhlclJlY29nbml6ZXIsIHRoaXMpO1xyXG4gICAgICAgIHZhciBpbmRleCA9IGluQXJyYXkodGhpcy5yZXF1aXJlRmFpbCwgb3RoZXJSZWNvZ25pemVyKTtcclxuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xyXG4gICAgICAgICAgICB0aGlzLnJlcXVpcmVGYWlsLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGhhcyByZXF1aXJlIGZhaWx1cmVzIGJvb2xlYW5cclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gICAgICovXHJcbiAgICBoYXNSZXF1aXJlRmFpbHVyZXM6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVpcmVGYWlsLmxlbmd0aCA+IDA7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogaWYgdGhlIHJlY29nbml6ZXIgY2FuIHJlY29nbml6ZSBzaW11bHRhbmVvdXMgd2l0aCBhbiBvdGhlciByZWNvZ25pemVyXHJcbiAgICAgKiBAcGFyYW0ge1JlY29nbml6ZXJ9IG90aGVyUmVjb2duaXplclxyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgKi9cclxuICAgIGNhblJlY29nbml6ZVdpdGg6IGZ1bmN0aW9uKG90aGVyUmVjb2duaXplcikge1xyXG4gICAgICAgIHJldHVybiAhIXRoaXMuc2ltdWx0YW5lb3VzW290aGVyUmVjb2duaXplci5pZF07XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogWW91IHNob3VsZCB1c2UgYHRyeUVtaXRgIGluc3RlYWQgb2YgYGVtaXRgIGRpcmVjdGx5IHRvIGNoZWNrXHJcbiAgICAgKiB0aGF0IGFsbCB0aGUgbmVlZGVkIHJlY29nbml6ZXJzIGhhcyBmYWlsZWQgYmVmb3JlIGVtaXR0aW5nLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0XHJcbiAgICAgKi9cclxuICAgIGVtaXQ6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgICAgIHZhciBzdGF0ZSA9IHRoaXMuc3RhdGU7XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGVtaXQod2l0aFN0YXRlKSB7XHJcbiAgICAgICAgICAgIHNlbGYubWFuYWdlci5lbWl0KHNlbGYub3B0aW9ucy5ldmVudCArICh3aXRoU3RhdGUgPyBzdGF0ZVN0cihzdGF0ZSkgOiAnJyksIGlucHV0KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vICdwYW5zdGFydCcgYW5kICdwYW5tb3ZlJ1xyXG4gICAgICAgIGlmIChzdGF0ZSA8IFNUQVRFX0VOREVEKSB7XHJcbiAgICAgICAgICAgIGVtaXQodHJ1ZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBlbWl0KCk7IC8vIHNpbXBsZSAnZXZlbnROYW1lJyBldmVudHNcclxuXHJcbiAgICAgICAgLy8gcGFuZW5kIGFuZCBwYW5jYW5jZWxcclxuICAgICAgICBpZiAoc3RhdGUgPj0gU1RBVEVfRU5ERUQpIHtcclxuICAgICAgICAgICAgZW1pdCh0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2sgdGhhdCBhbGwgdGhlIHJlcXVpcmUgZmFpbHVyZSByZWNvZ25pemVycyBoYXMgZmFpbGVkLFxyXG4gICAgICogaWYgdHJ1ZSwgaXQgZW1pdHMgYSBnZXN0dXJlIGV2ZW50LFxyXG4gICAgICogb3RoZXJ3aXNlLCBzZXR1cCB0aGUgc3RhdGUgdG8gRkFJTEVELlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0XHJcbiAgICAgKi9cclxuICAgIHRyeUVtaXQ6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY2FuRW1pdCgpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmVtaXQoaW5wdXQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBpdCdzIGZhaWxpbmcgYW55d2F5XHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFNUQVRFX0ZBSUxFRDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBjYW4gd2UgZW1pdD9cclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gICAgICovXHJcbiAgICBjYW5FbWl0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgaSA9IDA7XHJcbiAgICAgICAgd2hpbGUgKGkgPCB0aGlzLnJlcXVpcmVGYWlsLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBpZiAoISh0aGlzLnJlcXVpcmVGYWlsW2ldLnN0YXRlICYgKFNUQVRFX0ZBSUxFRCB8IFNUQVRFX1BPU1NJQkxFKSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpKys7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHVwZGF0ZSB0aGUgcmVjb2duaXplclxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0RGF0YVxyXG4gICAgICovXHJcbiAgICByZWNvZ25pemU6IGZ1bmN0aW9uKGlucHV0RGF0YSkge1xyXG4gICAgICAgIC8vIG1ha2UgYSBuZXcgY29weSBvZiB0aGUgaW5wdXREYXRhXHJcbiAgICAgICAgLy8gc28gd2UgY2FuIGNoYW5nZSB0aGUgaW5wdXREYXRhIHdpdGhvdXQgbWVzc2luZyB1cCB0aGUgb3RoZXIgcmVjb2duaXplcnNcclxuICAgICAgICB2YXIgaW5wdXREYXRhQ2xvbmUgPSBleHRlbmQoe30sIGlucHV0RGF0YSk7XHJcblxyXG4gICAgICAgIC8vIGlzIGlzIGVuYWJsZWQgYW5kIGFsbG93IHJlY29nbml6aW5nP1xyXG4gICAgICAgIGlmICghYm9vbE9yRm4odGhpcy5vcHRpb25zLmVuYWJsZSwgW3RoaXMsIGlucHV0RGF0YUNsb25lXSkpIHtcclxuICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xyXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU1RBVEVfRkFJTEVEO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyByZXNldCB3aGVuIHdlJ3ZlIHJlYWNoZWQgdGhlIGVuZFxyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlICYgKFNUQVRFX1JFQ09HTklaRUQgfCBTVEFURV9DQU5DRUxMRUQgfCBTVEFURV9GQUlMRUQpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTVEFURV9QT1NTSUJMRTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLnByb2Nlc3MoaW5wdXREYXRhQ2xvbmUpO1xyXG5cclxuICAgICAgICAvLyB0aGUgcmVjb2duaXplciBoYXMgcmVjb2duaXplZCBhIGdlc3R1cmVcclxuICAgICAgICAvLyBzbyB0cmlnZ2VyIGFuIGV2ZW50XHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgJiAoU1RBVEVfQkVHQU4gfCBTVEFURV9DSEFOR0VEIHwgU1RBVEVfRU5ERUQgfCBTVEFURV9DQU5DRUxMRUQpKSB7XHJcbiAgICAgICAgICAgIHRoaXMudHJ5RW1pdChpbnB1dERhdGFDbG9uZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHJldHVybiB0aGUgc3RhdGUgb2YgdGhlIHJlY29nbml6ZXJcclxuICAgICAqIHRoZSBhY3R1YWwgcmVjb2duaXppbmcgaGFwcGVucyBpbiB0aGlzIG1ldGhvZFxyXG4gICAgICogQHZpcnR1YWxcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dERhdGFcclxuICAgICAqIEByZXR1cm5zIHtDb25zdH0gU1RBVEVcclxuICAgICAqL1xyXG4gICAgcHJvY2VzczogZnVuY3Rpb24oaW5wdXREYXRhKSB7IH0sIC8vIGpzaGludCBpZ25vcmU6bGluZVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmV0dXJuIHRoZSBwcmVmZXJyZWQgdG91Y2gtYWN0aW9uXHJcbiAgICAgKiBAdmlydHVhbFxyXG4gICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICovXHJcbiAgICBnZXRUb3VjaEFjdGlvbjogZnVuY3Rpb24oKSB7IH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBjYWxsZWQgd2hlbiB0aGUgZ2VzdHVyZSBpc24ndCBhbGxvd2VkIHRvIHJlY29nbml6ZVxyXG4gICAgICogbGlrZSB3aGVuIGFub3RoZXIgaXMgYmVpbmcgcmVjb2duaXplZCBvciBpdCBpcyBkaXNhYmxlZFxyXG4gICAgICogQHZpcnR1YWxcclxuICAgICAqL1xyXG4gICAgcmVzZXQ6IGZ1bmN0aW9uKCkgeyB9XHJcbn07XHJcblxyXG4vKipcclxuICogZ2V0IGEgdXNhYmxlIHN0cmluZywgdXNlZCBhcyBldmVudCBwb3N0Zml4XHJcbiAqIEBwYXJhbSB7Q29uc3R9IHN0YXRlXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IHN0YXRlXHJcbiAqL1xyXG5mdW5jdGlvbiBzdGF0ZVN0cihzdGF0ZSkge1xyXG4gICAgaWYgKHN0YXRlICYgU1RBVEVfQ0FOQ0VMTEVEKSB7XHJcbiAgICAgICAgcmV0dXJuICdjYW5jZWwnO1xyXG4gICAgfSBlbHNlIGlmIChzdGF0ZSAmIFNUQVRFX0VOREVEKSB7XHJcbiAgICAgICAgcmV0dXJuICdlbmQnO1xyXG4gICAgfSBlbHNlIGlmIChzdGF0ZSAmIFNUQVRFX0NIQU5HRUQpIHtcclxuICAgICAgICByZXR1cm4gJ21vdmUnO1xyXG4gICAgfSBlbHNlIGlmIChzdGF0ZSAmIFNUQVRFX0JFR0FOKSB7XHJcbiAgICAgICAgcmV0dXJuICdzdGFydCc7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gJyc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBkaXJlY3Rpb24gY29ucyB0byBzdHJpbmdcclxuICogQHBhcmFtIHtDb25zdH0gZGlyZWN0aW9uXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAqL1xyXG5mdW5jdGlvbiBkaXJlY3Rpb25TdHIoZGlyZWN0aW9uKSB7XHJcbiAgICBpZiAoZGlyZWN0aW9uID09IERJUkVDVElPTl9ET1dOKSB7XHJcbiAgICAgICAgcmV0dXJuICdkb3duJztcclxuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09IERJUkVDVElPTl9VUCkge1xyXG4gICAgICAgIHJldHVybiAndXAnO1xyXG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT0gRElSRUNUSU9OX0xFRlQpIHtcclxuICAgICAgICByZXR1cm4gJ2xlZnQnO1xyXG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT0gRElSRUNUSU9OX1JJR0hUKSB7XHJcbiAgICAgICAgcmV0dXJuICdyaWdodCc7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gJyc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBnZXQgYSByZWNvZ25pemVyIGJ5IG5hbWUgaWYgaXQgaXMgYm91bmQgdG8gYSBtYW5hZ2VyXHJcbiAqIEBwYXJhbSB7UmVjb2duaXplcnxTdHJpbmd9IG90aGVyUmVjb2duaXplclxyXG4gKiBAcGFyYW0ge1JlY29nbml6ZXJ9IHJlY29nbml6ZXJcclxuICogQHJldHVybnMge1JlY29nbml6ZXJ9XHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRSZWNvZ25pemVyQnlOYW1lSWZNYW5hZ2VyKG90aGVyUmVjb2duaXplciwgcmVjb2duaXplcikge1xyXG4gICAgdmFyIG1hbmFnZXIgPSByZWNvZ25pemVyLm1hbmFnZXI7XHJcbiAgICBpZiAobWFuYWdlcikge1xyXG4gICAgICAgIHJldHVybiBtYW5hZ2VyLmdldChvdGhlclJlY29nbml6ZXIpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG90aGVyUmVjb2duaXplcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFRoaXMgcmVjb2duaXplciBpcyBqdXN0IHVzZWQgYXMgYSBiYXNlIGZvciB0aGUgc2ltcGxlIGF0dHJpYnV0ZSByZWNvZ25pemVycy5cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIFJlY29nbml6ZXJcclxuICovXHJcbmZ1bmN0aW9uIEF0dHJSZWNvZ25pemVyKCkge1xyXG4gICAgUmVjb2duaXplci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5pbmhlcml0KEF0dHJSZWNvZ25pemVyLCBSZWNvZ25pemVyLCB7XHJcbiAgICAvKipcclxuICAgICAqIEBuYW1lc3BhY2VcclxuICAgICAqIEBtZW1iZXJvZiBBdHRyUmVjb2duaXplclxyXG4gICAgICovXHJcbiAgICBkZWZhdWx0czoge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XHJcbiAgICAgICAgICogQGRlZmF1bHQgMVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHBvaW50ZXJzOiAxXHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXNlZCB0byBjaGVjayBpZiBpdCB0aGUgcmVjb2duaXplciByZWNlaXZlcyB2YWxpZCBpbnB1dCwgbGlrZSBpbnB1dC5kaXN0YW5jZSA+IDEwLlxyXG4gICAgICogQG1lbWJlcm9mIEF0dHJSZWNvZ25pemVyXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaW5wdXRcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSByZWNvZ25pemVkXHJcbiAgICAgKi9cclxuICAgIGF0dHJUZXN0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHZhciBvcHRpb25Qb2ludGVycyA9IHRoaXMub3B0aW9ucy5wb2ludGVycztcclxuICAgICAgICByZXR1cm4gb3B0aW9uUG9pbnRlcnMgPT09IDAgfHwgaW5wdXQucG9pbnRlcnMubGVuZ3RoID09PSBvcHRpb25Qb2ludGVycztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQcm9jZXNzIHRoZSBpbnB1dCBhbmQgcmV0dXJuIHRoZSBzdGF0ZSBmb3IgdGhlIHJlY29nbml6ZXJcclxuICAgICAqIEBtZW1iZXJvZiBBdHRyUmVjb2duaXplclxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0XHJcbiAgICAgKiBAcmV0dXJucyB7Kn0gU3RhdGVcclxuICAgICAqL1xyXG4gICAgcHJvY2VzczogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB2YXIgc3RhdGUgPSB0aGlzLnN0YXRlO1xyXG4gICAgICAgIHZhciBldmVudFR5cGUgPSBpbnB1dC5ldmVudFR5cGU7XHJcblxyXG4gICAgICAgIHZhciBpc1JlY29nbml6ZWQgPSBzdGF0ZSAmIChTVEFURV9CRUdBTiB8IFNUQVRFX0NIQU5HRUQpO1xyXG4gICAgICAgIHZhciBpc1ZhbGlkID0gdGhpcy5hdHRyVGVzdChpbnB1dCk7XHJcblxyXG4gICAgICAgIC8vIG9uIGNhbmNlbCBpbnB1dCBhbmQgd2UndmUgcmVjb2duaXplZCBiZWZvcmUsIHJldHVybiBTVEFURV9DQU5DRUxMRURcclxuICAgICAgICBpZiAoaXNSZWNvZ25pemVkICYmIChldmVudFR5cGUgJiBJTlBVVF9DQU5DRUwgfHwgIWlzVmFsaWQpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZSB8IFNUQVRFX0NBTkNFTExFRDtcclxuICAgICAgICB9IGVsc2UgaWYgKGlzUmVjb2duaXplZCB8fCBpc1ZhbGlkKSB7XHJcbiAgICAgICAgICAgIGlmIChldmVudFR5cGUgJiBJTlBVVF9FTkQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzdGF0ZSB8IFNUQVRFX0VOREVEO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKCEoc3RhdGUgJiBTVEFURV9CRUdBTikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBTVEFURV9CRUdBTjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gc3RhdGUgfCBTVEFURV9DSEFOR0VEO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gU1RBVEVfRkFJTEVEO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBQYW5cclxuICogUmVjb2duaXplZCB3aGVuIHRoZSBwb2ludGVyIGlzIGRvd24gYW5kIG1vdmVkIGluIHRoZSBhbGxvd2VkIGRpcmVjdGlvbi5cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIEF0dHJSZWNvZ25pemVyXHJcbiAqL1xyXG5mdW5jdGlvbiBQYW5SZWNvZ25pemVyKCkge1xyXG4gICAgQXR0clJlY29nbml6ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHJcbiAgICB0aGlzLnBYID0gbnVsbDtcclxuICAgIHRoaXMucFkgPSBudWxsO1xyXG59XHJcblxyXG5pbmhlcml0KFBhblJlY29nbml6ZXIsIEF0dHJSZWNvZ25pemVyLCB7XHJcbiAgICAvKipcclxuICAgICAqIEBuYW1lc3BhY2VcclxuICAgICAqIEBtZW1iZXJvZiBQYW5SZWNvZ25pemVyXHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRzOiB7XHJcbiAgICAgICAgZXZlbnQ6ICdwYW4nLFxyXG4gICAgICAgIHRocmVzaG9sZDogMTAsXHJcbiAgICAgICAgcG9pbnRlcnM6IDEsXHJcbiAgICAgICAgZGlyZWN0aW9uOiBESVJFQ1RJT05fQUxMXHJcbiAgICB9LFxyXG5cclxuICAgIGdldFRvdWNoQWN0aW9uOiBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgZGlyZWN0aW9uID0gdGhpcy5vcHRpb25zLmRpcmVjdGlvbjtcclxuICAgICAgICB2YXIgYWN0aW9ucyA9IFtdO1xyXG4gICAgICAgIGlmIChkaXJlY3Rpb24gJiBESVJFQ1RJT05fSE9SSVpPTlRBTCkge1xyXG4gICAgICAgICAgICBhY3Rpb25zLnB1c2goVE9VQ0hfQUNUSU9OX1BBTl9ZKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRpcmVjdGlvbiAmIERJUkVDVElPTl9WRVJUSUNBTCkge1xyXG4gICAgICAgICAgICBhY3Rpb25zLnB1c2goVE9VQ0hfQUNUSU9OX1BBTl9YKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGFjdGlvbnM7XHJcbiAgICB9LFxyXG5cclxuICAgIGRpcmVjdGlvblRlc3Q6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XHJcbiAgICAgICAgdmFyIGhhc01vdmVkID0gdHJ1ZTtcclxuICAgICAgICB2YXIgZGlzdGFuY2UgPSBpbnB1dC5kaXN0YW5jZTtcclxuICAgICAgICB2YXIgZGlyZWN0aW9uID0gaW5wdXQuZGlyZWN0aW9uO1xyXG4gICAgICAgIHZhciB4ID0gaW5wdXQuZGVsdGFYO1xyXG4gICAgICAgIHZhciB5ID0gaW5wdXQuZGVsdGFZO1xyXG5cclxuICAgICAgICAvLyBsb2NrIHRvIGF4aXM/XHJcbiAgICAgICAgaWYgKCEoZGlyZWN0aW9uICYgb3B0aW9ucy5kaXJlY3Rpb24pKSB7XHJcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmRpcmVjdGlvbiAmIERJUkVDVElPTl9IT1JJWk9OVEFMKSB7XHJcbiAgICAgICAgICAgICAgICBkaXJlY3Rpb24gPSAoeCA9PT0gMCkgPyBESVJFQ1RJT05fTk9ORSA6ICh4IDwgMCkgPyBESVJFQ1RJT05fTEVGVCA6IERJUkVDVElPTl9SSUdIVDtcclxuICAgICAgICAgICAgICAgIGhhc01vdmVkID0geCAhPSB0aGlzLnBYO1xyXG4gICAgICAgICAgICAgICAgZGlzdGFuY2UgPSBNYXRoLmFicyhpbnB1dC5kZWx0YVgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZGlyZWN0aW9uID0gKHkgPT09IDApID8gRElSRUNUSU9OX05PTkUgOiAoeSA8IDApID8gRElSRUNUSU9OX1VQIDogRElSRUNUSU9OX0RPV047XHJcbiAgICAgICAgICAgICAgICBoYXNNb3ZlZCA9IHkgIT0gdGhpcy5wWTtcclxuICAgICAgICAgICAgICAgIGRpc3RhbmNlID0gTWF0aC5hYnMoaW5wdXQuZGVsdGFZKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpbnB1dC5kaXJlY3Rpb24gPSBkaXJlY3Rpb247XHJcbiAgICAgICAgcmV0dXJuIGhhc01vdmVkICYmIGRpc3RhbmNlID4gb3B0aW9ucy50aHJlc2hvbGQgJiYgZGlyZWN0aW9uICYgb3B0aW9ucy5kaXJlY3Rpb247XHJcbiAgICB9LFxyXG5cclxuICAgIGF0dHJUZXN0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHJldHVybiBBdHRyUmVjb2duaXplci5wcm90b3R5cGUuYXR0clRlc3QuY2FsbCh0aGlzLCBpbnB1dCkgJiZcclxuICAgICAgICAgICAgKHRoaXMuc3RhdGUgJiBTVEFURV9CRUdBTiB8fCAoISh0aGlzLnN0YXRlICYgU1RBVEVfQkVHQU4pICYmIHRoaXMuZGlyZWN0aW9uVGVzdChpbnB1dCkpKTtcclxuICAgIH0sXHJcblxyXG4gICAgZW1pdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB0aGlzLnBYID0gaW5wdXQuZGVsdGFYO1xyXG4gICAgICAgIHRoaXMucFkgPSBpbnB1dC5kZWx0YVk7XHJcblxyXG4gICAgICAgIHZhciBkaXJlY3Rpb24gPSBkaXJlY3Rpb25TdHIoaW5wdXQuZGlyZWN0aW9uKTtcclxuICAgICAgICBpZiAoZGlyZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5lbWl0KHRoaXMub3B0aW9ucy5ldmVudCArIGRpcmVjdGlvbiwgaW5wdXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fc3VwZXIuZW1pdC5jYWxsKHRoaXMsIGlucHV0KTtcclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogUGluY2hcclxuICogUmVjb2duaXplZCB3aGVuIHR3byBvciBtb3JlIHBvaW50ZXJzIGFyZSBtb3ZpbmcgdG93YXJkICh6b29tLWluKSBvciBhd2F5IGZyb20gZWFjaCBvdGhlciAoem9vbS1vdXQpLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgQXR0clJlY29nbml6ZXJcclxuICovXHJcbmZ1bmN0aW9uIFBpbmNoUmVjb2duaXplcigpIHtcclxuICAgIEF0dHJSZWNvZ25pemVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmluaGVyaXQoUGluY2hSZWNvZ25pemVyLCBBdHRyUmVjb2duaXplciwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAbmFtZXNwYWNlXHJcbiAgICAgKiBAbWVtYmVyb2YgUGluY2hSZWNvZ25pemVyXHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRzOiB7XHJcbiAgICAgICAgZXZlbnQ6ICdwaW5jaCcsXHJcbiAgICAgICAgdGhyZXNob2xkOiAwLFxyXG4gICAgICAgIHBvaW50ZXJzOiAyXHJcbiAgICB9LFxyXG5cclxuICAgIGdldFRvdWNoQWN0aW9uOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gW1RPVUNIX0FDVElPTl9OT05FXTtcclxuICAgIH0sXHJcblxyXG4gICAgYXR0clRlc3Q6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cGVyLmF0dHJUZXN0LmNhbGwodGhpcywgaW5wdXQpICYmXHJcbiAgICAgICAgICAgIChNYXRoLmFicyhpbnB1dC5zY2FsZSAtIDEpID4gdGhpcy5vcHRpb25zLnRocmVzaG9sZCB8fCB0aGlzLnN0YXRlICYgU1RBVEVfQkVHQU4pO1xyXG4gICAgfSxcclxuXHJcbiAgICBlbWl0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHRoaXMuX3N1cGVyLmVtaXQuY2FsbCh0aGlzLCBpbnB1dCk7XHJcbiAgICAgICAgaWYgKGlucHV0LnNjYWxlICE9PSAxKSB7XHJcbiAgICAgICAgICAgIHZhciBpbk91dCA9IGlucHV0LnNjYWxlIDwgMSA/ICdpbicgOiAnb3V0JztcclxuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQodGhpcy5vcHRpb25zLmV2ZW50ICsgaW5PdXQsIGlucHV0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIFByZXNzXHJcbiAqIFJlY29nbml6ZWQgd2hlbiB0aGUgcG9pbnRlciBpcyBkb3duIGZvciB4IG1zIHdpdGhvdXQgYW55IG1vdmVtZW50LlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgUmVjb2duaXplclxyXG4gKi9cclxuZnVuY3Rpb24gUHJlc3NSZWNvZ25pemVyKCkge1xyXG4gICAgUmVjb2duaXplci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cclxuICAgIHRoaXMuX3RpbWVyID0gbnVsbDtcclxuICAgIHRoaXMuX2lucHV0ID0gbnVsbDtcclxufVxyXG5cclxuaW5oZXJpdChQcmVzc1JlY29nbml6ZXIsIFJlY29nbml6ZXIsIHtcclxuICAgIC8qKlxyXG4gICAgICogQG5hbWVzcGFjZVxyXG4gICAgICogQG1lbWJlcm9mIFByZXNzUmVjb2duaXplclxyXG4gICAgICovXHJcbiAgICBkZWZhdWx0czoge1xyXG4gICAgICAgIGV2ZW50OiAncHJlc3MnLFxyXG4gICAgICAgIHBvaW50ZXJzOiAxLFxyXG4gICAgICAgIHRpbWU6IDUwMCwgLy8gbWluaW1hbCB0aW1lIG9mIHRoZSBwb2ludGVyIHRvIGJlIHByZXNzZWRcclxuICAgICAgICB0aHJlc2hvbGQ6IDUgLy8gYSBtaW5pbWFsIG1vdmVtZW50IGlzIG9rLCBidXQga2VlcCBpdCBsb3dcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0VG91Y2hBY3Rpb246IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBbVE9VQ0hfQUNUSU9OX0FVVE9dO1xyXG4gICAgfSxcclxuXHJcbiAgICBwcm9jZXNzOiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHZhciBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xyXG4gICAgICAgIHZhciB2YWxpZFBvaW50ZXJzID0gaW5wdXQucG9pbnRlcnMubGVuZ3RoID09PSBvcHRpb25zLnBvaW50ZXJzO1xyXG4gICAgICAgIHZhciB2YWxpZE1vdmVtZW50ID0gaW5wdXQuZGlzdGFuY2UgPCBvcHRpb25zLnRocmVzaG9sZDtcclxuICAgICAgICB2YXIgdmFsaWRUaW1lID0gaW5wdXQuZGVsdGFUaW1lID4gb3B0aW9ucy50aW1lO1xyXG5cclxuICAgICAgICB0aGlzLl9pbnB1dCA9IGlucHV0O1xyXG5cclxuICAgICAgICAvLyB3ZSBvbmx5IGFsbG93IGxpdHRsZSBtb3ZlbWVudFxyXG4gICAgICAgIC8vIGFuZCB3ZSd2ZSByZWFjaGVkIGFuIGVuZCBldmVudCwgc28gYSB0YXAgaXMgcG9zc2libGVcclxuICAgICAgICBpZiAoIXZhbGlkTW92ZW1lbnQgfHwgIXZhbGlkUG9pbnRlcnMgfHwgKGlucHV0LmV2ZW50VHlwZSAmIChJTlBVVF9FTkQgfCBJTlBVVF9DQU5DRUwpICYmICF2YWxpZFRpbWUpKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKTtcclxuICAgICAgICB9IGVsc2UgaWYgKGlucHV0LmV2ZW50VHlwZSAmIElOUFVUX1NUQVJUKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKTtcclxuICAgICAgICAgICAgdGhpcy5fdGltZXIgPSBzZXRUaW1lb3V0Q29udGV4dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTVEFURV9SRUNPR05JWkVEO1xyXG4gICAgICAgICAgICAgICAgdGhpcy50cnlFbWl0KCk7XHJcbiAgICAgICAgICAgIH0sIG9wdGlvbnMudGltZSwgdGhpcyk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dC5ldmVudFR5cGUgJiBJTlBVVF9FTkQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFNUQVRFX1JFQ09HTklaRUQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBTVEFURV9GQUlMRUQ7XHJcbiAgICB9LFxyXG5cclxuICAgIHJlc2V0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fdGltZXIpO1xyXG4gICAgfSxcclxuXHJcbiAgICBlbWl0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlICE9PSBTVEFURV9SRUNPR05JWkVEKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChpbnB1dCAmJiAoaW5wdXQuZXZlbnRUeXBlICYgSU5QVVRfRU5EKSkge1xyXG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuZW1pdCh0aGlzLm9wdGlvbnMuZXZlbnQgKyAndXAnLCBpbnB1dCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5faW5wdXQudGltZVN0YW1wID0gbm93KCk7XHJcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5lbWl0KHRoaXMub3B0aW9ucy5ldmVudCwgdGhpcy5faW5wdXQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogUm90YXRlXHJcbiAqIFJlY29nbml6ZWQgd2hlbiB0d28gb3IgbW9yZSBwb2ludGVyIGFyZSBtb3ZpbmcgaW4gYSBjaXJjdWxhciBtb3Rpb24uXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBBdHRyUmVjb2duaXplclxyXG4gKi9cclxuZnVuY3Rpb24gUm90YXRlUmVjb2duaXplcigpIHtcclxuICAgIEF0dHJSZWNvZ25pemVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmluaGVyaXQoUm90YXRlUmVjb2duaXplciwgQXR0clJlY29nbml6ZXIsIHtcclxuICAgIC8qKlxyXG4gICAgICogQG5hbWVzcGFjZVxyXG4gICAgICogQG1lbWJlcm9mIFJvdGF0ZVJlY29nbml6ZXJcclxuICAgICAqL1xyXG4gICAgZGVmYXVsdHM6IHtcclxuICAgICAgICBldmVudDogJ3JvdGF0ZScsXHJcbiAgICAgICAgdGhyZXNob2xkOiAwLFxyXG4gICAgICAgIHBvaW50ZXJzOiAyXHJcbiAgICB9LFxyXG5cclxuICAgIGdldFRvdWNoQWN0aW9uOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gW1RPVUNIX0FDVElPTl9OT05FXTtcclxuICAgIH0sXHJcblxyXG4gICAgYXR0clRlc3Q6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cGVyLmF0dHJUZXN0LmNhbGwodGhpcywgaW5wdXQpICYmXHJcbiAgICAgICAgICAgIChNYXRoLmFicyhpbnB1dC5yb3RhdGlvbikgPiB0aGlzLm9wdGlvbnMudGhyZXNob2xkIHx8IHRoaXMuc3RhdGUgJiBTVEFURV9CRUdBTik7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIFN3aXBlXHJcbiAqIFJlY29nbml6ZWQgd2hlbiB0aGUgcG9pbnRlciBpcyBtb3ZpbmcgZmFzdCAodmVsb2NpdHkpLCB3aXRoIGVub3VnaCBkaXN0YW5jZSBpbiB0aGUgYWxsb3dlZCBkaXJlY3Rpb24uXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBBdHRyUmVjb2duaXplclxyXG4gKi9cclxuZnVuY3Rpb24gU3dpcGVSZWNvZ25pemVyKCkge1xyXG4gICAgQXR0clJlY29nbml6ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuaW5oZXJpdChTd2lwZVJlY29nbml6ZXIsIEF0dHJSZWNvZ25pemVyLCB7XHJcbiAgICAvKipcclxuICAgICAqIEBuYW1lc3BhY2VcclxuICAgICAqIEBtZW1iZXJvZiBTd2lwZVJlY29nbml6ZXJcclxuICAgICAqL1xyXG4gICAgZGVmYXVsdHM6IHtcclxuICAgICAgICBldmVudDogJ3N3aXBlJyxcclxuICAgICAgICB0aHJlc2hvbGQ6IDEwLFxyXG4gICAgICAgIHZlbG9jaXR5OiAwLjY1LFxyXG4gICAgICAgIGRpcmVjdGlvbjogRElSRUNUSU9OX0hPUklaT05UQUwgfCBESVJFQ1RJT05fVkVSVElDQUwsXHJcbiAgICAgICAgcG9pbnRlcnM6IDFcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0VG91Y2hBY3Rpb246IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBQYW5SZWNvZ25pemVyLnByb3RvdHlwZS5nZXRUb3VjaEFjdGlvbi5jYWxsKHRoaXMpO1xyXG4gICAgfSxcclxuXHJcbiAgICBhdHRyVGVzdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB2YXIgZGlyZWN0aW9uID0gdGhpcy5vcHRpb25zLmRpcmVjdGlvbjtcclxuICAgICAgICB2YXIgdmVsb2NpdHk7XHJcblxyXG4gICAgICAgIGlmIChkaXJlY3Rpb24gJiAoRElSRUNUSU9OX0hPUklaT05UQUwgfCBESVJFQ1RJT05fVkVSVElDQUwpKSB7XHJcbiAgICAgICAgICAgIHZlbG9jaXR5ID0gaW5wdXQudmVsb2NpdHk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gJiBESVJFQ1RJT05fSE9SSVpPTlRBTCkge1xyXG4gICAgICAgICAgICB2ZWxvY2l0eSA9IGlucHV0LnZlbG9jaXR5WDtcclxuICAgICAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiAmIERJUkVDVElPTl9WRVJUSUNBTCkge1xyXG4gICAgICAgICAgICB2ZWxvY2l0eSA9IGlucHV0LnZlbG9jaXR5WTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLl9zdXBlci5hdHRyVGVzdC5jYWxsKHRoaXMsIGlucHV0KSAmJlxyXG4gICAgICAgICAgICBkaXJlY3Rpb24gJiBpbnB1dC5kaXJlY3Rpb24gJiZcclxuICAgICAgICAgICAgaW5wdXQuZGlzdGFuY2UgPiB0aGlzLm9wdGlvbnMudGhyZXNob2xkICYmXHJcbiAgICAgICAgICAgIGFicyh2ZWxvY2l0eSkgPiB0aGlzLm9wdGlvbnMudmVsb2NpdHkgJiYgaW5wdXQuZXZlbnRUeXBlICYgSU5QVVRfRU5EO1xyXG4gICAgfSxcclxuXHJcbiAgICBlbWl0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHZhciBkaXJlY3Rpb24gPSBkaXJlY3Rpb25TdHIoaW5wdXQuZGlyZWN0aW9uKTtcclxuICAgICAgICBpZiAoZGlyZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5lbWl0KHRoaXMub3B0aW9ucy5ldmVudCArIGRpcmVjdGlvbiwgaW5wdXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQodGhpcy5vcHRpb25zLmV2ZW50LCBpbnB1dCk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIEEgdGFwIGlzIGVjb2duaXplZCB3aGVuIHRoZSBwb2ludGVyIGlzIGRvaW5nIGEgc21hbGwgdGFwL2NsaWNrLiBNdWx0aXBsZSB0YXBzIGFyZSByZWNvZ25pemVkIGlmIHRoZXkgb2NjdXJcclxuICogYmV0d2VlbiB0aGUgZ2l2ZW4gaW50ZXJ2YWwgYW5kIHBvc2l0aW9uLiBUaGUgZGVsYXkgb3B0aW9uIGNhbiBiZSB1c2VkIHRvIHJlY29nbml6ZSBtdWx0aS10YXBzIHdpdGhvdXQgZmlyaW5nXHJcbiAqIGEgc2luZ2xlIHRhcC5cclxuICpcclxuICogVGhlIGV2ZW50RGF0YSBmcm9tIHRoZSBlbWl0dGVkIGV2ZW50IGNvbnRhaW5zIHRoZSBwcm9wZXJ0eSBgdGFwQ291bnRgLCB3aGljaCBjb250YWlucyB0aGUgYW1vdW50IG9mXHJcbiAqIG11bHRpLXRhcHMgYmVpbmcgcmVjb2duaXplZC5cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIFJlY29nbml6ZXJcclxuICovXHJcbmZ1bmN0aW9uIFRhcFJlY29nbml6ZXIoKSB7XHJcbiAgICBSZWNvZ25pemVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblxyXG4gICAgLy8gcHJldmlvdXMgdGltZSBhbmQgY2VudGVyLFxyXG4gICAgLy8gdXNlZCBmb3IgdGFwIGNvdW50aW5nXHJcbiAgICB0aGlzLnBUaW1lID0gZmFsc2U7XHJcbiAgICB0aGlzLnBDZW50ZXIgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLl90aW1lciA9IG51bGw7XHJcbiAgICB0aGlzLl9pbnB1dCA9IG51bGw7XHJcbiAgICB0aGlzLmNvdW50ID0gMDtcclxufVxyXG5cclxuaW5oZXJpdChUYXBSZWNvZ25pemVyLCBSZWNvZ25pemVyLCB7XHJcbiAgICAvKipcclxuICAgICAqIEBuYW1lc3BhY2VcclxuICAgICAqIEBtZW1iZXJvZiBQaW5jaFJlY29nbml6ZXJcclxuICAgICAqL1xyXG4gICAgZGVmYXVsdHM6IHtcclxuICAgICAgICBldmVudDogJ3RhcCcsXHJcbiAgICAgICAgcG9pbnRlcnM6IDEsXHJcbiAgICAgICAgdGFwczogMSxcclxuICAgICAgICBpbnRlcnZhbDogMzAwLCAvLyBtYXggdGltZSBiZXR3ZWVuIHRoZSBtdWx0aS10YXAgdGFwc1xyXG4gICAgICAgIHRpbWU6IDI1MCwgLy8gbWF4IHRpbWUgb2YgdGhlIHBvaW50ZXIgdG8gYmUgZG93biAobGlrZSBmaW5nZXIgb24gdGhlIHNjcmVlbilcclxuICAgICAgICB0aHJlc2hvbGQ6IDIsIC8vIGEgbWluaW1hbCBtb3ZlbWVudCBpcyBvaywgYnV0IGtlZXAgaXQgbG93XHJcbiAgICAgICAgcG9zVGhyZXNob2xkOiAxMCAvLyBhIG11bHRpLXRhcCBjYW4gYmUgYSBiaXQgb2ZmIHRoZSBpbml0aWFsIHBvc2l0aW9uXHJcbiAgICB9LFxyXG5cclxuICAgIGdldFRvdWNoQWN0aW9uOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gW1RPVUNIX0FDVElPTl9NQU5JUFVMQVRJT05dO1xyXG4gICAgfSxcclxuXHJcbiAgICBwcm9jZXNzOiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHZhciBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xyXG5cclxuICAgICAgICB2YXIgdmFsaWRQb2ludGVycyA9IGlucHV0LnBvaW50ZXJzLmxlbmd0aCA9PT0gb3B0aW9ucy5wb2ludGVycztcclxuICAgICAgICB2YXIgdmFsaWRNb3ZlbWVudCA9IGlucHV0LmRpc3RhbmNlIDwgb3B0aW9ucy50aHJlc2hvbGQ7XHJcbiAgICAgICAgdmFyIHZhbGlkVG91Y2hUaW1lID0gaW5wdXQuZGVsdGFUaW1lIDwgb3B0aW9ucy50aW1lO1xyXG5cclxuICAgICAgICB0aGlzLnJlc2V0KCk7XHJcblxyXG4gICAgICAgIGlmICgoaW5wdXQuZXZlbnRUeXBlICYgSU5QVVRfU1RBUlQpICYmICh0aGlzLmNvdW50ID09PSAwKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mYWlsVGltZW91dCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gd2Ugb25seSBhbGxvdyBsaXR0bGUgbW92ZW1lbnRcclxuICAgICAgICAvLyBhbmQgd2UndmUgcmVhY2hlZCBhbiBlbmQgZXZlbnQsIHNvIGEgdGFwIGlzIHBvc3NpYmxlXHJcbiAgICAgICAgaWYgKHZhbGlkTW92ZW1lbnQgJiYgdmFsaWRUb3VjaFRpbWUgJiYgdmFsaWRQb2ludGVycykge1xyXG4gICAgICAgICAgICBpZiAoaW5wdXQuZXZlbnRUeXBlICE9IElOUFVUX0VORCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmFpbFRpbWVvdXQoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIHZhbGlkSW50ZXJ2YWwgPSB0aGlzLnBUaW1lID8gKGlucHV0LnRpbWVTdGFtcCAtIHRoaXMucFRpbWUgPCBvcHRpb25zLmludGVydmFsKSA6IHRydWU7XHJcbiAgICAgICAgICAgIHZhciB2YWxpZE11bHRpVGFwID0gIXRoaXMucENlbnRlciB8fCBnZXREaXN0YW5jZSh0aGlzLnBDZW50ZXIsIGlucHV0LmNlbnRlcikgPCBvcHRpb25zLnBvc1RocmVzaG9sZDtcclxuXHJcbiAgICAgICAgICAgIHRoaXMucFRpbWUgPSBpbnB1dC50aW1lU3RhbXA7XHJcbiAgICAgICAgICAgIHRoaXMucENlbnRlciA9IGlucHV0LmNlbnRlcjtcclxuXHJcbiAgICAgICAgICAgIGlmICghdmFsaWRNdWx0aVRhcCB8fCAhdmFsaWRJbnRlcnZhbCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb3VudCA9IDE7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvdW50ICs9IDE7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2lucHV0ID0gaW5wdXQ7XHJcblxyXG4gICAgICAgICAgICAvLyBpZiB0YXAgY291bnQgbWF0Y2hlcyB3ZSBoYXZlIHJlY29nbml6ZWQgaXQsXHJcbiAgICAgICAgICAgIC8vIGVsc2UgaXQgaGFzIGJlZ2FuIHJlY29nbml6aW5nLi4uXHJcbiAgICAgICAgICAgIHZhciB0YXBDb3VudCA9IHRoaXMuY291bnQgJSBvcHRpb25zLnRhcHM7XHJcbiAgICAgICAgICAgIGlmICh0YXBDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgLy8gbm8gZmFpbGluZyByZXF1aXJlbWVudHMsIGltbWVkaWF0ZWx5IHRyaWdnZXIgdGhlIHRhcCBldmVudFxyXG4gICAgICAgICAgICAgICAgLy8gb3Igd2FpdCBhcyBsb25nIGFzIHRoZSBtdWx0aXRhcCBpbnRlcnZhbCB0byB0cmlnZ2VyXHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaGFzUmVxdWlyZUZhaWx1cmVzKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU1RBVEVfUkVDT0dOSVpFRDtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdGltZXIgPSBzZXRUaW1lb3V0Q29udGV4dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFNUQVRFX1JFQ09HTklaRUQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudHJ5RW1pdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sIG9wdGlvbnMuaW50ZXJ2YWwsIHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTVEFURV9CRUdBTjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gU1RBVEVfRkFJTEVEO1xyXG4gICAgfSxcclxuXHJcbiAgICBmYWlsVGltZW91dDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5fdGltZXIgPSBzZXRUaW1lb3V0Q29udGV4dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFNUQVRFX0ZBSUxFRDtcclxuICAgICAgICB9LCB0aGlzLm9wdGlvbnMuaW50ZXJ2YWwsIHRoaXMpO1xyXG4gICAgICAgIHJldHVybiBTVEFURV9GQUlMRUQ7XHJcbiAgICB9LFxyXG5cclxuICAgIHJlc2V0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fdGltZXIpO1xyXG4gICAgfSxcclxuXHJcbiAgICBlbWl0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICBpZiAodGhpcy5zdGF0ZSA9PSBTVEFURV9SRUNPR05JWkVEICkge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnB1dC50YXBDb3VudCA9IHRoaXMuY291bnQ7XHJcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5lbWl0KHRoaXMub3B0aW9ucy5ldmVudCwgdGhpcy5faW5wdXQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogU2ltcGxlIHdheSB0byBjcmVhdGUgYW4gbWFuYWdlciB3aXRoIGEgZGVmYXVsdCBzZXQgb2YgcmVjb2duaXplcnMuXHJcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnRcclxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIEhhbW1lcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICAgIG9wdGlvbnMucmVjb2duaXplcnMgPSBpZlVuZGVmaW5lZChvcHRpb25zLnJlY29nbml6ZXJzLCBIYW1tZXIuZGVmYXVsdHMucHJlc2V0KTtcclxuICAgIHJldHVybiBuZXcgTWFuYWdlcihlbGVtZW50LCBvcHRpb25zKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEBjb25zdCB7c3RyaW5nfVxyXG4gKi9cclxuSGFtbWVyLlZFUlNJT04gPSAnMi4wLjQnO1xyXG5cclxuLyoqXHJcbiAqIGRlZmF1bHQgc2V0dGluZ3NcclxuICogQG5hbWVzcGFjZVxyXG4gKi9cclxuSGFtbWVyLmRlZmF1bHRzID0ge1xyXG4gICAgLyoqXHJcbiAgICAgKiBzZXQgaWYgRE9NIGV2ZW50cyBhcmUgYmVpbmcgdHJpZ2dlcmVkLlxyXG4gICAgICogQnV0IHRoaXMgaXMgc2xvd2VyIGFuZCB1bnVzZWQgYnkgc2ltcGxlIGltcGxlbWVudGF0aW9ucywgc28gZGlzYWJsZWQgYnkgZGVmYXVsdC5cclxuICAgICAqIEB0eXBlIHtCb29sZWFufVxyXG4gICAgICogQGRlZmF1bHQgZmFsc2VcclxuICAgICAqL1xyXG4gICAgZG9tRXZlbnRzOiBmYWxzZSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSB2YWx1ZSBmb3IgdGhlIHRvdWNoQWN0aW9uIHByb3BlcnR5L2ZhbGxiYWNrLlxyXG4gICAgICogV2hlbiBzZXQgdG8gYGNvbXB1dGVgIGl0IHdpbGwgbWFnaWNhbGx5IHNldCB0aGUgY29ycmVjdCB2YWx1ZSBiYXNlZCBvbiB0aGUgYWRkZWQgcmVjb2duaXplcnMuXHJcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICogQGRlZmF1bHQgY29tcHV0ZVxyXG4gICAgICovXHJcbiAgICB0b3VjaEFjdGlvbjogVE9VQ0hfQUNUSU9OX0NPTVBVVEUsXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cclxuICAgICAqIEBkZWZhdWx0IHRydWVcclxuICAgICAqL1xyXG4gICAgZW5hYmxlOiB0cnVlLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRVhQRVJJTUVOVEFMIEZFQVRVUkUgLS0gY2FuIGJlIHJlbW92ZWQvY2hhbmdlZFxyXG4gICAgICogQ2hhbmdlIHRoZSBwYXJlbnQgaW5wdXQgdGFyZ2V0IGVsZW1lbnQuXHJcbiAgICAgKiBJZiBOdWxsLCB0aGVuIGl0IGlzIGJlaW5nIHNldCB0aGUgdG8gbWFpbiBlbGVtZW50LlxyXG4gICAgICogQHR5cGUge051bGx8RXZlbnRUYXJnZXR9XHJcbiAgICAgKiBAZGVmYXVsdCBudWxsXHJcbiAgICAgKi9cclxuICAgIGlucHV0VGFyZ2V0OiBudWxsLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogZm9yY2UgYW4gaW5wdXQgY2xhc3NcclxuICAgICAqIEB0eXBlIHtOdWxsfEZ1bmN0aW9ufVxyXG4gICAgICogQGRlZmF1bHQgbnVsbFxyXG4gICAgICovXHJcbiAgICBpbnB1dENsYXNzOiBudWxsLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRGVmYXVsdCByZWNvZ25pemVyIHNldHVwIHdoZW4gY2FsbGluZyBgSGFtbWVyKClgXHJcbiAgICAgKiBXaGVuIGNyZWF0aW5nIGEgbmV3IE1hbmFnZXIgdGhlc2Ugd2lsbCBiZSBza2lwcGVkLlxyXG4gICAgICogQHR5cGUge0FycmF5fVxyXG4gICAgICovXHJcbiAgICBwcmVzZXQ6IFtcclxuICAgICAgICAvLyBSZWNvZ25pemVyQ2xhc3MsIG9wdGlvbnMsIFtyZWNvZ25pemVXaXRoLCAuLi5dLCBbcmVxdWlyZUZhaWx1cmUsIC4uLl1cclxuICAgICAgICBbUm90YXRlUmVjb2duaXplciwgeyBlbmFibGU6IGZhbHNlIH1dLFxyXG4gICAgICAgIFtQaW5jaFJlY29nbml6ZXIsIHsgZW5hYmxlOiBmYWxzZSB9LCBbJ3JvdGF0ZSddXSxcclxuICAgICAgICBbU3dpcGVSZWNvZ25pemVyLHsgZGlyZWN0aW9uOiBESVJFQ1RJT05fSE9SSVpPTlRBTCB9XSxcclxuICAgICAgICBbUGFuUmVjb2duaXplciwgeyBkaXJlY3Rpb246IERJUkVDVElPTl9IT1JJWk9OVEFMIH0sIFsnc3dpcGUnXV0sXHJcbiAgICAgICAgW1RhcFJlY29nbml6ZXJdLFxyXG4gICAgICAgIFtUYXBSZWNvZ25pemVyLCB7IGV2ZW50OiAnZG91YmxldGFwJywgdGFwczogMiB9LCBbJ3RhcCddXSxcclxuICAgICAgICBbUHJlc3NSZWNvZ25pemVyXVxyXG4gICAgXSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNvbWUgQ1NTIHByb3BlcnRpZXMgY2FuIGJlIHVzZWQgdG8gaW1wcm92ZSB0aGUgd29ya2luZyBvZiBIYW1tZXIuXHJcbiAgICAgKiBBZGQgdGhlbSB0byB0aGlzIG1ldGhvZCBhbmQgdGhleSB3aWxsIGJlIHNldCB3aGVuIGNyZWF0aW5nIGEgbmV3IE1hbmFnZXIuXHJcbiAgICAgKiBAbmFtZXNwYWNlXHJcbiAgICAgKi9cclxuICAgIGNzc1Byb3BzOiB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRGlzYWJsZXMgdGV4dCBzZWxlY3Rpb24gdG8gaW1wcm92ZSB0aGUgZHJhZ2dpbmcgZ2VzdHVyZS4gTWFpbmx5IGZvciBkZXNrdG9wIGJyb3dzZXJzLlxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICogQGRlZmF1bHQgJ25vbmUnXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdXNlclNlbGVjdDogJ25vbmUnLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBEaXNhYmxlIHRoZSBXaW5kb3dzIFBob25lIGdyaXBwZXJzIHdoZW4gcHJlc3NpbmcgYW4gZWxlbWVudC5cclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqIEBkZWZhdWx0ICdub25lJ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRvdWNoU2VsZWN0OiAnbm9uZScsXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIERpc2FibGVzIHRoZSBkZWZhdWx0IGNhbGxvdXQgc2hvd24gd2hlbiB5b3UgdG91Y2ggYW5kIGhvbGQgYSB0b3VjaCB0YXJnZXQuXHJcbiAgICAgICAgICogT24gaU9TLCB3aGVuIHlvdSB0b3VjaCBhbmQgaG9sZCBhIHRvdWNoIHRhcmdldCBzdWNoIGFzIGEgbGluaywgU2FmYXJpIGRpc3BsYXlzXHJcbiAgICAgICAgICogYSBjYWxsb3V0IGNvbnRhaW5pbmcgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGxpbmsuIFRoaXMgcHJvcGVydHkgYWxsb3dzIHlvdSB0byBkaXNhYmxlIHRoYXQgY2FsbG91dC5cclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqIEBkZWZhdWx0ICdub25lJ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRvdWNoQ2FsbG91dDogJ25vbmUnLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTcGVjaWZpZXMgd2hldGhlciB6b29taW5nIGlzIGVuYWJsZWQuIFVzZWQgYnkgSUUxMD5cclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqIEBkZWZhdWx0ICdub25lJ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNvbnRlbnRab29taW5nOiAnbm9uZScsXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFNwZWNpZmllcyB0aGF0IGFuIGVudGlyZSBlbGVtZW50IHNob3VsZCBiZSBkcmFnZ2FibGUgaW5zdGVhZCBvZiBpdHMgY29udGVudHMuIE1haW5seSBmb3IgZGVza3RvcCBicm93c2Vycy5cclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqIEBkZWZhdWx0ICdub25lJ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHVzZXJEcmFnOiAnbm9uZScsXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIE92ZXJyaWRlcyB0aGUgaGlnaGxpZ2h0IGNvbG9yIHNob3duIHdoZW4gdGhlIHVzZXIgdGFwcyBhIGxpbmsgb3IgYSBKYXZhU2NyaXB0XHJcbiAgICAgICAgICogY2xpY2thYmxlIGVsZW1lbnQgaW4gaU9TLiBUaGlzIHByb3BlcnR5IG9iZXlzIHRoZSBhbHBoYSB2YWx1ZSwgaWYgc3BlY2lmaWVkLlxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICogQGRlZmF1bHQgJ3JnYmEoMCwwLDAsMCknXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGFwSGlnaGxpZ2h0Q29sb3I6ICdyZ2JhKDAsMCwwLDApJ1xyXG4gICAgfVxyXG59O1xyXG5cclxudmFyIFNUT1AgPSAxO1xyXG52YXIgRk9SQ0VEX1NUT1AgPSAyO1xyXG5cclxuLyoqXHJcbiAqIE1hbmFnZXJcclxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudFxyXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gTWFuYWdlcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuXHJcbiAgICB0aGlzLm9wdGlvbnMgPSBtZXJnZShvcHRpb25zLCBIYW1tZXIuZGVmYXVsdHMpO1xyXG4gICAgdGhpcy5vcHRpb25zLmlucHV0VGFyZ2V0ID0gdGhpcy5vcHRpb25zLmlucHV0VGFyZ2V0IHx8IGVsZW1lbnQ7XHJcblxyXG4gICAgdGhpcy5oYW5kbGVycyA9IHt9O1xyXG4gICAgdGhpcy5zZXNzaW9uID0ge307XHJcbiAgICB0aGlzLnJlY29nbml6ZXJzID0gW107XHJcblxyXG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMuaW5wdXQgPSBjcmVhdGVJbnB1dEluc3RhbmNlKHRoaXMpO1xyXG4gICAgdGhpcy50b3VjaEFjdGlvbiA9IG5ldyBUb3VjaEFjdGlvbih0aGlzLCB0aGlzLm9wdGlvbnMudG91Y2hBY3Rpb24pO1xyXG5cclxuICAgIHRvZ2dsZUNzc1Byb3BzKHRoaXMsIHRydWUpO1xyXG5cclxuICAgIGVhY2gob3B0aW9ucy5yZWNvZ25pemVycywgZnVuY3Rpb24oaXRlbSkge1xyXG4gICAgICAgIHZhciByZWNvZ25pemVyID0gdGhpcy5hZGQobmV3IChpdGVtWzBdKShpdGVtWzFdKSk7XHJcbiAgICAgICAgaXRlbVsyXSAmJiByZWNvZ25pemVyLnJlY29nbml6ZVdpdGgoaXRlbVsyXSk7XHJcbiAgICAgICAgaXRlbVszXSAmJiByZWNvZ25pemVyLnJlcXVpcmVGYWlsdXJlKGl0ZW1bM10pO1xyXG4gICAgfSwgdGhpcyk7XHJcbn1cclxuXHJcbk1hbmFnZXIucHJvdG90eXBlID0ge1xyXG4gICAgLyoqXHJcbiAgICAgKiBzZXQgb3B0aW9uc1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcclxuICAgICAqIEByZXR1cm5zIHtNYW5hZ2VyfVxyXG4gICAgICovXHJcbiAgICBzZXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcclxuICAgICAgICBleHRlbmQodGhpcy5vcHRpb25zLCBvcHRpb25zKTtcclxuXHJcbiAgICAgICAgLy8gT3B0aW9ucyB0aGF0IG5lZWQgYSBsaXR0bGUgbW9yZSBzZXR1cFxyXG4gICAgICAgIGlmIChvcHRpb25zLnRvdWNoQWN0aW9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMudG91Y2hBY3Rpb24udXBkYXRlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvcHRpb25zLmlucHV0VGFyZ2V0KSB7XHJcbiAgICAgICAgICAgIC8vIENsZWFuIHVwIGV4aXN0aW5nIGV2ZW50IGxpc3RlbmVycyBhbmQgcmVpbml0aWFsaXplXHJcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGVzdHJveSgpO1xyXG4gICAgICAgICAgICB0aGlzLmlucHV0LnRhcmdldCA9IG9wdGlvbnMuaW5wdXRUYXJnZXQ7XHJcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuaW5pdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBzdG9wIHJlY29nbml6aW5nIGZvciB0aGlzIHNlc3Npb24uXHJcbiAgICAgKiBUaGlzIHNlc3Npb24gd2lsbCBiZSBkaXNjYXJkZWQsIHdoZW4gYSBuZXcgW2lucHV0XXN0YXJ0IGV2ZW50IGlzIGZpcmVkLlxyXG4gICAgICogV2hlbiBmb3JjZWQsIHRoZSByZWNvZ25pemVyIGN5Y2xlIGlzIHN0b3BwZWQgaW1tZWRpYXRlbHkuXHJcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtmb3JjZV1cclxuICAgICAqL1xyXG4gICAgc3RvcDogZnVuY3Rpb24oZm9yY2UpIHtcclxuICAgICAgICB0aGlzLnNlc3Npb24uc3RvcHBlZCA9IGZvcmNlID8gRk9SQ0VEX1NUT1AgOiBTVE9QO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHJ1biB0aGUgcmVjb2duaXplcnMhXHJcbiAgICAgKiBjYWxsZWQgYnkgdGhlIGlucHV0SGFuZGxlciBmdW5jdGlvbiBvbiBldmVyeSBtb3ZlbWVudCBvZiB0aGUgcG9pbnRlcnMgKHRvdWNoZXMpXHJcbiAgICAgKiBpdCB3YWxrcyB0aHJvdWdoIGFsbCB0aGUgcmVjb2duaXplcnMgYW5kIHRyaWVzIHRvIGRldGVjdCB0aGUgZ2VzdHVyZSB0aGF0IGlzIGJlaW5nIG1hZGVcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dERhdGFcclxuICAgICAqL1xyXG4gICAgcmVjb2duaXplOiBmdW5jdGlvbihpbnB1dERhdGEpIHtcclxuICAgICAgICB2YXIgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbjtcclxuICAgICAgICBpZiAoc2Vzc2lvbi5zdG9wcGVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJ1biB0aGUgdG91Y2gtYWN0aW9uIHBvbHlmaWxsXHJcbiAgICAgICAgdGhpcy50b3VjaEFjdGlvbi5wcmV2ZW50RGVmYXVsdHMoaW5wdXREYXRhKTtcclxuXHJcbiAgICAgICAgdmFyIHJlY29nbml6ZXI7XHJcbiAgICAgICAgdmFyIHJlY29nbml6ZXJzID0gdGhpcy5yZWNvZ25pemVycztcclxuXHJcbiAgICAgICAgLy8gdGhpcyBob2xkcyB0aGUgcmVjb2duaXplciB0aGF0IGlzIGJlaW5nIHJlY29nbml6ZWQuXHJcbiAgICAgICAgLy8gc28gdGhlIHJlY29nbml6ZXIncyBzdGF0ZSBuZWVkcyB0byBiZSBCRUdBTiwgQ0hBTkdFRCwgRU5ERUQgb3IgUkVDT0dOSVpFRFxyXG4gICAgICAgIC8vIGlmIG5vIHJlY29nbml6ZXIgaXMgZGV0ZWN0aW5nIGEgdGhpbmcsIGl0IGlzIHNldCB0byBgbnVsbGBcclxuICAgICAgICB2YXIgY3VyUmVjb2duaXplciA9IHNlc3Npb24uY3VyUmVjb2duaXplcjtcclxuXHJcbiAgICAgICAgLy8gcmVzZXQgd2hlbiB0aGUgbGFzdCByZWNvZ25pemVyIGlzIHJlY29nbml6ZWRcclxuICAgICAgICAvLyBvciB3aGVuIHdlJ3JlIGluIGEgbmV3IHNlc3Npb25cclxuICAgICAgICBpZiAoIWN1clJlY29nbml6ZXIgfHwgKGN1clJlY29nbml6ZXIgJiYgY3VyUmVjb2duaXplci5zdGF0ZSAmIFNUQVRFX1JFQ09HTklaRUQpKSB7XHJcbiAgICAgICAgICAgIGN1clJlY29nbml6ZXIgPSBzZXNzaW9uLmN1clJlY29nbml6ZXIgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGkgPSAwO1xyXG4gICAgICAgIHdoaWxlIChpIDwgcmVjb2duaXplcnMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJlY29nbml6ZXIgPSByZWNvZ25pemVyc1tpXTtcclxuXHJcbiAgICAgICAgICAgIC8vIGZpbmQgb3V0IGlmIHdlIGFyZSBhbGxvd2VkIHRyeSB0byByZWNvZ25pemUgdGhlIGlucHV0IGZvciB0aGlzIG9uZS5cclxuICAgICAgICAgICAgLy8gMS4gICBhbGxvdyBpZiB0aGUgc2Vzc2lvbiBpcyBOT1QgZm9yY2VkIHN0b3BwZWQgKHNlZSB0aGUgLnN0b3AoKSBtZXRob2QpXHJcbiAgICAgICAgICAgIC8vIDIuICAgYWxsb3cgaWYgd2Ugc3RpbGwgaGF2ZW4ndCByZWNvZ25pemVkIGEgZ2VzdHVyZSBpbiB0aGlzIHNlc3Npb24sIG9yIHRoZSB0aGlzIHJlY29nbml6ZXIgaXMgdGhlIG9uZVxyXG4gICAgICAgICAgICAvLyAgICAgIHRoYXQgaXMgYmVpbmcgcmVjb2duaXplZC5cclxuICAgICAgICAgICAgLy8gMy4gICBhbGxvdyBpZiB0aGUgcmVjb2duaXplciBpcyBhbGxvd2VkIHRvIHJ1biBzaW11bHRhbmVvdXMgd2l0aCB0aGUgY3VycmVudCByZWNvZ25pemVkIHJlY29nbml6ZXIuXHJcbiAgICAgICAgICAgIC8vICAgICAgdGhpcyBjYW4gYmUgc2V0dXAgd2l0aCB0aGUgYHJlY29nbml6ZVdpdGgoKWAgbWV0aG9kIG9uIHRoZSByZWNvZ25pemVyLlxyXG4gICAgICAgICAgICBpZiAoc2Vzc2lvbi5zdG9wcGVkICE9PSBGT1JDRURfU1RPUCAmJiAoIC8vIDFcclxuICAgICAgICAgICAgICAgICAgICAhY3VyUmVjb2duaXplciB8fCByZWNvZ25pemVyID09IGN1clJlY29nbml6ZXIgfHwgLy8gMlxyXG4gICAgICAgICAgICAgICAgICAgIHJlY29nbml6ZXIuY2FuUmVjb2duaXplV2l0aChjdXJSZWNvZ25pemVyKSkpIHsgLy8gM1xyXG4gICAgICAgICAgICAgICAgcmVjb2duaXplci5yZWNvZ25pemUoaW5wdXREYXRhKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJlY29nbml6ZXIucmVzZXQoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gaWYgdGhlIHJlY29nbml6ZXIgaGFzIGJlZW4gcmVjb2duaXppbmcgdGhlIGlucHV0IGFzIGEgdmFsaWQgZ2VzdHVyZSwgd2Ugd2FudCB0byBzdG9yZSB0aGlzIG9uZSBhcyB0aGVcclxuICAgICAgICAgICAgLy8gY3VycmVudCBhY3RpdmUgcmVjb2duaXplci4gYnV0IG9ubHkgaWYgd2UgZG9uJ3QgYWxyZWFkeSBoYXZlIGFuIGFjdGl2ZSByZWNvZ25pemVyXHJcbiAgICAgICAgICAgIGlmICghY3VyUmVjb2duaXplciAmJiByZWNvZ25pemVyLnN0YXRlICYgKFNUQVRFX0JFR0FOIHwgU1RBVEVfQ0hBTkdFRCB8IFNUQVRFX0VOREVEKSkge1xyXG4gICAgICAgICAgICAgICAgY3VyUmVjb2duaXplciA9IHNlc3Npb24uY3VyUmVjb2duaXplciA9IHJlY29nbml6ZXI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaSsrO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBnZXQgYSByZWNvZ25pemVyIGJ5IGl0cyBldmVudCBuYW1lLlxyXG4gICAgICogQHBhcmFtIHtSZWNvZ25pemVyfFN0cmluZ30gcmVjb2duaXplclxyXG4gICAgICogQHJldHVybnMge1JlY29nbml6ZXJ8TnVsbH1cclxuICAgICAqL1xyXG4gICAgZ2V0OiBmdW5jdGlvbihyZWNvZ25pemVyKSB7XHJcbiAgICAgICAgaWYgKHJlY29nbml6ZXIgaW5zdGFuY2VvZiBSZWNvZ25pemVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWNvZ25pemVyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHJlY29nbml6ZXJzID0gdGhpcy5yZWNvZ25pemVycztcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlY29nbml6ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChyZWNvZ25pemVyc1tpXS5vcHRpb25zLmV2ZW50ID09IHJlY29nbml6ZXIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZWNvZ25pemVyc1tpXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBhZGQgYSByZWNvZ25pemVyIHRvIHRoZSBtYW5hZ2VyXHJcbiAgICAgKiBleGlzdGluZyByZWNvZ25pemVycyB3aXRoIHRoZSBzYW1lIGV2ZW50IG5hbWUgd2lsbCBiZSByZW1vdmVkXHJcbiAgICAgKiBAcGFyYW0ge1JlY29nbml6ZXJ9IHJlY29nbml6ZXJcclxuICAgICAqIEByZXR1cm5zIHtSZWNvZ25pemVyfE1hbmFnZXJ9XHJcbiAgICAgKi9cclxuICAgIGFkZDogZnVuY3Rpb24ocmVjb2duaXplcikge1xyXG4gICAgICAgIGlmIChpbnZva2VBcnJheUFyZyhyZWNvZ25pemVyLCAnYWRkJywgdGhpcykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyByZW1vdmUgZXhpc3RpbmdcclxuICAgICAgICB2YXIgZXhpc3RpbmcgPSB0aGlzLmdldChyZWNvZ25pemVyLm9wdGlvbnMuZXZlbnQpO1xyXG4gICAgICAgIGlmIChleGlzdGluZykge1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZShleGlzdGluZyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLnJlY29nbml6ZXJzLnB1c2gocmVjb2duaXplcik7XHJcbiAgICAgICAgcmVjb2duaXplci5tYW5hZ2VyID0gdGhpcztcclxuXHJcbiAgICAgICAgdGhpcy50b3VjaEFjdGlvbi51cGRhdGUoKTtcclxuICAgICAgICByZXR1cm4gcmVjb2duaXplcjtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiByZW1vdmUgYSByZWNvZ25pemVyIGJ5IG5hbWUgb3IgaW5zdGFuY2VcclxuICAgICAqIEBwYXJhbSB7UmVjb2duaXplcnxTdHJpbmd9IHJlY29nbml6ZXJcclxuICAgICAqIEByZXR1cm5zIHtNYW5hZ2VyfVxyXG4gICAgICovXHJcbiAgICByZW1vdmU6IGZ1bmN0aW9uKHJlY29nbml6ZXIpIHtcclxuICAgICAgICBpZiAoaW52b2tlQXJyYXlBcmcocmVjb2duaXplciwgJ3JlbW92ZScsIHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHJlY29nbml6ZXJzID0gdGhpcy5yZWNvZ25pemVycztcclxuICAgICAgICByZWNvZ25pemVyID0gdGhpcy5nZXQocmVjb2duaXplcik7XHJcbiAgICAgICAgcmVjb2duaXplcnMuc3BsaWNlKGluQXJyYXkocmVjb2duaXplcnMsIHJlY29nbml6ZXIpLCAxKTtcclxuXHJcbiAgICAgICAgdGhpcy50b3VjaEFjdGlvbi51cGRhdGUoKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBiaW5kIGV2ZW50XHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRzXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXHJcbiAgICAgKiBAcmV0dXJucyB7RXZlbnRFbWl0dGVyfSB0aGlzXHJcbiAgICAgKi9cclxuICAgIG9uOiBmdW5jdGlvbihldmVudHMsIGhhbmRsZXIpIHtcclxuICAgICAgICB2YXIgaGFuZGxlcnMgPSB0aGlzLmhhbmRsZXJzO1xyXG4gICAgICAgIGVhY2goc3BsaXRTdHIoZXZlbnRzKSwgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICAgICAgaGFuZGxlcnNbZXZlbnRdID0gaGFuZGxlcnNbZXZlbnRdIHx8IFtdO1xyXG4gICAgICAgICAgICBoYW5kbGVyc1tldmVudF0ucHVzaChoYW5kbGVyKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiB1bmJpbmQgZXZlbnQsIGxlYXZlIGVtaXQgYmxhbmsgdG8gcmVtb3ZlIGFsbCBoYW5kbGVyc1xyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50c1xyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2hhbmRsZXJdXHJcbiAgICAgKiBAcmV0dXJucyB7RXZlbnRFbWl0dGVyfSB0aGlzXHJcbiAgICAgKi9cclxuICAgIG9mZjogZnVuY3Rpb24oZXZlbnRzLCBoYW5kbGVyKSB7XHJcbiAgICAgICAgdmFyIGhhbmRsZXJzID0gdGhpcy5oYW5kbGVycztcclxuICAgICAgICBlYWNoKHNwbGl0U3RyKGV2ZW50cyksIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICAgICAgICAgIGlmICghaGFuZGxlcikge1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIGhhbmRsZXJzW2V2ZW50XTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGhhbmRsZXJzW2V2ZW50XS5zcGxpY2UoaW5BcnJheShoYW5kbGVyc1tldmVudF0sIGhhbmRsZXIpLCAxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGVtaXQgZXZlbnQgdG8gdGhlIGxpc3RlbmVyc1xyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YVxyXG4gICAgICovXHJcbiAgICBlbWl0OiBmdW5jdGlvbihldmVudCwgZGF0YSkge1xyXG4gICAgICAgIC8vIHdlIGFsc28gd2FudCB0byB0cmlnZ2VyIGRvbSBldmVudHNcclxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmRvbUV2ZW50cykge1xyXG4gICAgICAgICAgICB0cmlnZ2VyRG9tRXZlbnQoZXZlbnQsIGRhdGEpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gbm8gaGFuZGxlcnMsIHNvIHNraXAgaXQgYWxsXHJcbiAgICAgICAgdmFyIGhhbmRsZXJzID0gdGhpcy5oYW5kbGVyc1tldmVudF0gJiYgdGhpcy5oYW5kbGVyc1tldmVudF0uc2xpY2UoKTtcclxuICAgICAgICBpZiAoIWhhbmRsZXJzIHx8ICFoYW5kbGVycy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZGF0YS50eXBlID0gZXZlbnQ7XHJcbiAgICAgICAgZGF0YS5wcmV2ZW50RGVmYXVsdCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBkYXRhLnNyY0V2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdmFyIGkgPSAwO1xyXG4gICAgICAgIHdoaWxlIChpIDwgaGFuZGxlcnMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGhhbmRsZXJzW2ldKGRhdGEpO1xyXG4gICAgICAgICAgICBpKys7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGRlc3Ryb3kgdGhlIG1hbmFnZXIgYW5kIHVuYmluZHMgYWxsIGV2ZW50c1xyXG4gICAgICogaXQgZG9lc24ndCB1bmJpbmQgZG9tIGV2ZW50cywgdGhhdCBpcyB0aGUgdXNlciBvd24gcmVzcG9uc2liaWxpdHlcclxuICAgICAqL1xyXG4gICAgZGVzdHJveTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ICYmIHRvZ2dsZUNzc1Byb3BzKHRoaXMsIGZhbHNlKTtcclxuXHJcbiAgICAgICAgdGhpcy5oYW5kbGVycyA9IHt9O1xyXG4gICAgICAgIHRoaXMuc2Vzc2lvbiA9IHt9O1xyXG4gICAgICAgIHRoaXMuaW5wdXQuZGVzdHJveSgpO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IG51bGw7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogYWRkL3JlbW92ZSB0aGUgY3NzIHByb3BlcnRpZXMgYXMgZGVmaW5lZCBpbiBtYW5hZ2VyLm9wdGlvbnMuY3NzUHJvcHNcclxuICogQHBhcmFtIHtNYW5hZ2VyfSBtYW5hZ2VyXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gYWRkXHJcbiAqL1xyXG5mdW5jdGlvbiB0b2dnbGVDc3NQcm9wcyhtYW5hZ2VyLCBhZGQpIHtcclxuICAgIHZhciBlbGVtZW50ID0gbWFuYWdlci5lbGVtZW50O1xyXG4gICAgZWFjaChtYW5hZ2VyLm9wdGlvbnMuY3NzUHJvcHMsIGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7XHJcbiAgICAgICAgZWxlbWVudC5zdHlsZVtwcmVmaXhlZChlbGVtZW50LnN0eWxlLCBuYW1lKV0gPSBhZGQgPyB2YWx1ZSA6ICcnO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiB0cmlnZ2VyIGRvbSBldmVudFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHBhcmFtIHtPYmplY3R9IGRhdGFcclxuICovXHJcbmZ1bmN0aW9uIHRyaWdnZXJEb21FdmVudChldmVudCwgZGF0YSkge1xyXG4gICAgdmFyIGdlc3R1cmVFdmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdFdmVudCcpO1xyXG4gICAgZ2VzdHVyZUV2ZW50LmluaXRFdmVudChldmVudCwgdHJ1ZSwgdHJ1ZSk7XHJcbiAgICBnZXN0dXJlRXZlbnQuZ2VzdHVyZSA9IGRhdGE7XHJcbiAgICBkYXRhLnRhcmdldC5kaXNwYXRjaEV2ZW50KGdlc3R1cmVFdmVudCk7XHJcbn1cclxuXHJcbmV4dGVuZChIYW1tZXIsIHtcclxuICAgIElOUFVUX1NUQVJUOiBJTlBVVF9TVEFSVCxcclxuICAgIElOUFVUX01PVkU6IElOUFVUX01PVkUsXHJcbiAgICBJTlBVVF9FTkQ6IElOUFVUX0VORCxcclxuICAgIElOUFVUX0NBTkNFTDogSU5QVVRfQ0FOQ0VMLFxyXG5cclxuICAgIFNUQVRFX1BPU1NJQkxFOiBTVEFURV9QT1NTSUJMRSxcclxuICAgIFNUQVRFX0JFR0FOOiBTVEFURV9CRUdBTixcclxuICAgIFNUQVRFX0NIQU5HRUQ6IFNUQVRFX0NIQU5HRUQsXHJcbiAgICBTVEFURV9FTkRFRDogU1RBVEVfRU5ERUQsXHJcbiAgICBTVEFURV9SRUNPR05JWkVEOiBTVEFURV9SRUNPR05JWkVELFxyXG4gICAgU1RBVEVfQ0FOQ0VMTEVEOiBTVEFURV9DQU5DRUxMRUQsXHJcbiAgICBTVEFURV9GQUlMRUQ6IFNUQVRFX0ZBSUxFRCxcclxuXHJcbiAgICBESVJFQ1RJT05fTk9ORTogRElSRUNUSU9OX05PTkUsXHJcbiAgICBESVJFQ1RJT05fTEVGVDogRElSRUNUSU9OX0xFRlQsXHJcbiAgICBESVJFQ1RJT05fUklHSFQ6IERJUkVDVElPTl9SSUdIVCxcclxuICAgIERJUkVDVElPTl9VUDogRElSRUNUSU9OX1VQLFxyXG4gICAgRElSRUNUSU9OX0RPV046IERJUkVDVElPTl9ET1dOLFxyXG4gICAgRElSRUNUSU9OX0hPUklaT05UQUw6IERJUkVDVElPTl9IT1JJWk9OVEFMLFxyXG4gICAgRElSRUNUSU9OX1ZFUlRJQ0FMOiBESVJFQ1RJT05fVkVSVElDQUwsXHJcbiAgICBESVJFQ1RJT05fQUxMOiBESVJFQ1RJT05fQUxMLFxyXG5cclxuICAgIE1hbmFnZXI6IE1hbmFnZXIsXHJcbiAgICBJbnB1dDogSW5wdXQsXHJcbiAgICBUb3VjaEFjdGlvbjogVG91Y2hBY3Rpb24sXHJcblxyXG4gICAgVG91Y2hJbnB1dDogVG91Y2hJbnB1dCxcclxuICAgIE1vdXNlSW5wdXQ6IE1vdXNlSW5wdXQsXHJcbiAgICBQb2ludGVyRXZlbnRJbnB1dDogUG9pbnRlckV2ZW50SW5wdXQsXHJcbiAgICBUb3VjaE1vdXNlSW5wdXQ6IFRvdWNoTW91c2VJbnB1dCxcclxuICAgIFNpbmdsZVRvdWNoSW5wdXQ6IFNpbmdsZVRvdWNoSW5wdXQsXHJcblxyXG4gICAgUmVjb2duaXplcjogUmVjb2duaXplcixcclxuICAgIEF0dHJSZWNvZ25pemVyOiBBdHRyUmVjb2duaXplcixcclxuICAgIFRhcDogVGFwUmVjb2duaXplcixcclxuICAgIFBhbjogUGFuUmVjb2duaXplcixcclxuICAgIFN3aXBlOiBTd2lwZVJlY29nbml6ZXIsXHJcbiAgICBQaW5jaDogUGluY2hSZWNvZ25pemVyLFxyXG4gICAgUm90YXRlOiBSb3RhdGVSZWNvZ25pemVyLFxyXG4gICAgUHJlc3M6IFByZXNzUmVjb2duaXplcixcclxuXHJcbiAgICBvbjogYWRkRXZlbnRMaXN0ZW5lcnMsXHJcbiAgICBvZmY6IHJlbW92ZUV2ZW50TGlzdGVuZXJzLFxyXG4gICAgZWFjaDogZWFjaCxcclxuICAgIG1lcmdlOiBtZXJnZSxcclxuICAgIGV4dGVuZDogZXh0ZW5kLFxyXG4gICAgaW5oZXJpdDogaW5oZXJpdCxcclxuICAgIGJpbmRGbjogYmluZEZuLFxyXG4gICAgcHJlZml4ZWQ6IHByZWZpeGVkXHJcbn0pO1xyXG5cclxuaWYgKHR5cGVvZiBkZWZpbmUgPT0gVFlQRV9GVU5DVElPTiAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIEhhbW1lcjtcclxuICAgIH0pO1xyXG59IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcclxuICAgIG1vZHVsZS5leHBvcnRzID0gSGFtbWVyO1xyXG59IGVsc2Uge1xyXG4gICAgd2luZG93W2V4cG9ydE5hbWVdID0gSGFtbWVyO1xyXG59XHJcblxyXG59KSh3aW5kb3csIGRvY3VtZW50LCAnSGFtbWVyJyk7XHJcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gVG9PYmplY3QodmFsKSB7XG5cdGlmICh2YWwgPT0gbnVsbCkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ09iamVjdC5hc3NpZ24gY2Fubm90IGJlIGNhbGxlZCB3aXRoIG51bGwgb3IgdW5kZWZpbmVkJyk7XG5cdH1cblxuXHRyZXR1cm4gT2JqZWN0KHZhbCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0LCBzb3VyY2UpIHtcblx0dmFyIHBlbmRpbmdFeGNlcHRpb247XG5cdHZhciBmcm9tO1xuXHR2YXIga2V5cztcblx0dmFyIHRvID0gVG9PYmplY3QodGFyZ2V0KTtcblxuXHRmb3IgKHZhciBzID0gMTsgcyA8IGFyZ3VtZW50cy5sZW5ndGg7IHMrKykge1xuXHRcdGZyb20gPSBhcmd1bWVudHNbc107XG5cdFx0a2V5cyA9IE9iamVjdC5rZXlzKE9iamVjdChmcm9tKSk7XG5cblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRvW2tleXNbaV1dID0gZnJvbVtrZXlzW2ldXTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRpZiAocGVuZGluZ0V4Y2VwdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cGVuZGluZ0V4Y2VwdGlvbiA9IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChwZW5kaW5nRXhjZXB0aW9uKSB7XG5cdFx0dGhyb3cgcGVuZGluZ0V4Y2VwdGlvbjtcblx0fVxuXG5cdHJldHVybiB0bztcbn07XG4iLCJ2YXIgQ2FudmFzVmlldyA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9DYW52YXNWaWV3LmpzJyk7XG52YXIgRmlyZWJhc2VVdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMvRmlyZWJhc2VVdGlscycpO1xuXG53aW5kb3cub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gIENhbnZhc1ZpZXcubG9hZCgpO1xuICBGaXJlYmFzZVV0aWxzLmluaXQoKTtcbn0iLCJcInVzZSBzdHJpY3RcIjtcblxuXG52YXIgQ2FudmFzQXBwRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL2Rpc3BhdGNoZXIvQ2FudmFzQXBwRGlzcGF0Y2hlcicpO1xudmFyIE5vdGVzU3RvcmUgPSByZXF1aXJlKCcuLi9zdG9yZXMvTm90ZXNTdG9yZScpO1xudmFyIERyYWdFbGVtZW50U3RvcmUgPSByZXF1aXJlKCcuLi9zdG9yZXMvRHJhZ0VsZW1lbnRTdG9yZScpO1xudmFyIEhhbW1lciA9IHJlcXVpcmUoJ2hhbW1lcmpzJyk7XG52YXIgVHJhbnNmb3JtU3RvcmUgPSByZXF1aXJlKCcuLi9zdG9yZXMvVHJhbnNmb3JtU3RvcmUnKTtcbnZhciBfZ2V0UmVsYXRpdmVMZWZ0VG9wID0gcmVxdWlyZSgnLi4vdXRpbHMvR2V0UmVsYXRpdmVMZWZ0VG9wLmpzJyk7XG5cbnZhciBGb2N1c1ZpZXcgPSByZXF1aXJlKCcuL0ZvY3VzVmlldycpO1xuXG52YXIgX3RyYW5zZm9ybTtcbnZhciBfdHJhbnNmb3JtUHJldmlvdXMgPSB7dHJhbnNsYXRlWDogMCwgdHJhbnNsYXRlWTowLCBzY2FsZTogMX07XG52YXIgX25vdGVzO1xudmFyIF9ub3RlOyAgLy8gbW9zdCByZWNlbnRseSBhZGRlZCBvciB1cGRhdGVkIG5vdGVcbnZhciBfdGltZXIgPSB7YXZlcmFnZTogMCwgY291bnQ6IDAsIHN0YXJ0OiAwfTtcblxuXG5mdW5jdGlvbiBfdXBkYXRlU3RhdGVGcm9tU3RvcmVzKCkge1xuICBfdHJhbnNmb3JtID0gVHJhbnNmb3JtU3RvcmUuZ2V0KCk7XG4gIF9ub3RlcyA9IE5vdGVzU3RvcmUuZ2V0QWxsKCk7XG59O1xuXG52YXIgQ2FudmFzVmlldyA9IHtcbiAgICBcbiAgICBjYW52YXM6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW52YXMnKSxcblxuICAgIGN0eDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbnZhcycpLmdldENvbnRleHQoJzJkJyksXG4gICAgXG4gICAgbG9hZDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnJlc2l6ZUNhbnZhcygpO1xuICAgICAgdGhpcy5hZGRUb3VjaEV2ZW50TGlzdGVuZXJzKCk7XG4gICAgICB0aGlzLmFkZFN0b3JlTGlzdGVuZXJzKCk7XG4gICAgICB0aGlzLmFkZFdpbmRvd1Jlc2l6ZUxpc3RlbmVyKCk7XG4gICAgICB0aGlzLnJlbmRlcigpO1xuICAgICAgRm9jdXNWaWV3LmluaXQoKTtcbiAgICB9LFxuXG4gICAgYWRkV2luZG93UmVzaXplTGlzdGVuZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgd2luZG93Lm9ucmVzaXplID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMucmVzaXplQ2FudmFzO1xuICAgICAgICB0aGlzLnJlbmRlcigpO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgIH0sXG5cbiAgICBhZGRUb3VjaEV2ZW50TGlzdGVuZXJzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuaGFtbWVyID0gbmV3IEhhbW1lci5NYW5hZ2VyKHRoaXMuY2FudmFzKTtcbiAgICAgIHRoaXMuaGFtbWVyLmFkZChuZXcgSGFtbWVyLlRhcCgpKTtcbiAgICAgIHRoaXMuaGFtbWVyLmFkZChuZXcgSGFtbWVyLlBhbih7dGhyZXNob2xkOjB9KSk7XG4gICAgICB0aGlzLmhhbW1lci5hZGQobmV3IEhhbW1lci5QcmVzcyh7ZXZlbnQ6ICdwcmVzc09uZUZpbmdlcicsIHBvaW50ZXJzOiAxLCB0aW1lOjB9KSk7XG4gICAgICB0aGlzLmhhbW1lci5hZGQobmV3IEhhbW1lci5QcmVzcyh7ZXZlbnQ6ICdwcmVzc1R3b0ZpbmdlcnMnLCBwb2ludGVyczogMiwgdGltZTowfSkpO1xuICAgICAgdGhpcy5oYW1tZXIuYWRkKG5ldyBIYW1tZXIuUGluY2goKSk7XG4gICAgICB0aGlzLmhhbW1lci5vbigncHJlc3NPbmVGaW5nZXIgcHJlc3NUd29GaW5nZXJzIHBpbmNoIHBhbicsIGZ1bmN0aW9uKGhhbW1lckV2ZW50KSB7XG4gICAgICAgIENhbnZhc0FwcERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICAgICAgICAgIGFjdGlvblR5cGU6IGhhbW1lckV2ZW50LnR5cGUsXG4gICAgICAgICAgaGFtbWVyRXZlbnQ6IGhhbW1lckV2ZW50LFxuICAgICAgICAgIC8vIHV0aWxzOiB7X2dldFJlbGF0aXZlTGVmdFRvcDogX2dldFJlbGF0aXZlTGVmdFRvcC5iaW5kKENhbnZhc1ZpZXcuY2FudmFzKX1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5oYW1tZXIub24oJ3RhcCcsIGZ1bmN0aW9uKGhhbW1lckV2ZW50KSB7XG4gICAgICAgIGlmKGhhbW1lckV2ZW50LnRhcENvdW50ID09PSAxKSB7XG4gICAgICAgICAgQ2FudmFzQXBwRGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gICAgICAgICAgICBhY3Rpb25UeXBlOiAndGFwU2luZ2xlJyxcbiAgICAgICAgICAgIGhhbW1lckV2ZW50OiBoYW1tZXJFdmVudFxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYoaGFtbWVyRXZlbnQudGFwQ291bnQgPT09IDIpIHtcbiAgICAgICAgICBDYW52YXNBcHBEaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAgICAgICAgICAgIGFjdGlvblR5cGU6ICd0YXBEb3VibGUnLFxuICAgICAgICAgICAgaGFtbWVyRXZlbnQ6IGhhbW1lckV2ZW50XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXdoZWVsJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgQ2FudmFzQXBwRGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gICAgICAgICAgYWN0aW9uVHlwZTogJ21vdXNld2hlZWwnLFxuICAgICAgICAgIGV2ZW50OiBldmVudFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBhZGRTdG9yZUxpc3RlbmVyczogZnVuY3Rpb24oKSB7XG4gICAgICBcbiAgICAgIE5vdGVzU3RvcmUuYWRkQ2hhbmdlTGlzdGVuZXIoJ2FkZGVkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIF91cGRhdGVTdGF0ZUZyb21TdG9yZXMoKTtcbiAgICAgICAgX25vdGUgPSBOb3Rlc1N0b3JlLmdldE1vc3RSZWNlbnQoKTsgIFxuICAgICAgICBDYW52YXNWaWV3LnJlbmRlck5vdGUoKTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBEcmFnRWxlbWVudFN0b3JlLmFkZENoYW5nZUxpc3RlbmVyKCdkcmFnZ2VkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIF9ub3RlID0gRHJhZ0VsZW1lbnRTdG9yZS5nZXQoKTsgIFxuICAgICAgICBDYW52YXNWaWV3LnJlbmRlcigpO1xuICAgICAgfSk7XG5cbiAgICAgIFRyYW5zZm9ybVN0b3JlLmFkZENoYW5nZUxpc3RlbmVyKCdjaGFuZ2VkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIENhbnZhc1ZpZXcucmVuZGVyKCk7XG4gICAgICB9KVxuICAgIH0sXG5cbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh3aW5kb3cucGVyZm9ybWFuY2UpIF90aW1lci5zdGFydCA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgX3VwZGF0ZVN0YXRlRnJvbVN0b3JlcygpO1xuICAgICAgICB0aGlzLnNldENhbnZhc1RyYW5zbGF0aW9uKCk7XG4gICAgICAgIGZvcih2YXIga2V5IGluIF9ub3Rlcykge1xuICAgICAgICAgIENhbnZhc1ZpZXcucmVuZGVyTm90ZShfbm90ZXNba2V5XSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHdpbmRvdy5wZXJmb3JtYW5jZSkgX3RpbWVyLmF2ZXJhZ2UgPSAoX3RpbWVyLmF2ZXJhZ2UgKiBfdGltZXIuY291bnQgKyB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCkgLSBfdGltZXIuc3RhcnQpIC8gKCsrX3RpbWVyLmNvdW50KTtcbiAgICAgICAgY29uc29sZS5sb2coXCJhdmVyYWdlIHJlbmRlciBkdXJhdGlvbjogXCIsIF90aW1lci5hdmVyYWdlKTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBzZXRDYW52YXNUcmFuc2xhdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmN0eC50cmFuc2xhdGUoTWF0aC5yb3VuZCgtX3RyYW5zZm9ybVByZXZpb3VzLnRyYW5zbGF0ZVggKiBfdHJhbnNmb3JtUHJldmlvdXMuc2NhbGUpLCBNYXRoLnJvdW5kKC1fdHJhbnNmb3JtUHJldmlvdXMudHJhbnNsYXRlWSAqIF90cmFuc2Zvcm1QcmV2aW91cy5zY2FsZSkpO1xuICAgICAgdGhpcy5jdHguY2xlYXJSZWN0KDAsMCx0aGlzLmNhbnZhcy53aWR0aCwgdGhpcy5jYW52YXMuaGVpZ2h0KTtcbiAgICAgIHRoaXMuY3R4LnRyYW5zbGF0ZShNYXRoLnJvdW5kKF90cmFuc2Zvcm0udHJhbnNsYXRlWCAqIF90cmFuc2Zvcm0uc2NhbGUpLCBNYXRoLnJvdW5kKF90cmFuc2Zvcm0udHJhbnNsYXRlWSAqIF90cmFuc2Zvcm0uc2NhbGUpKTtcbiAgICAgIF90cmFuc2Zvcm1QcmV2aW91cyA9IHt0cmFuc2xhdGVYOiBfdHJhbnNmb3JtLnRyYW5zbGF0ZVgsIHRyYW5zbGF0ZVk6IF90cmFuc2Zvcm0udHJhbnNsYXRlWSwgc2NhbGU6IF90cmFuc2Zvcm0uc2NhbGV9O1xuICAgIH0sXG5cbiAgICByZW5kZXJOb3RlOiBmdW5jdGlvbihub3RlKSB7XG4gICAgICBub3RlID0gbm90ZSB8fCBfbm90ZTtcbiAgICAgIHZhciBsZWZ0ID0gTWF0aC5yb3VuZChub3RlLmRhdGEueCAqIF90cmFuc2Zvcm0uc2NhbGUpO1xuICAgICAgdmFyIHRvcCA9IE1hdGgucm91bmQobm90ZS5kYXRhLnkgKiBfdHJhbnNmb3JtLnNjYWxlKTtcbiAgICAgIENhbnZhc1ZpZXcucmVuZGVyU2hhcGUobm90ZSwgbGVmdCwgdG9wKTtcbiAgICAgIENhbnZhc1ZpZXcucmVuZGVyVGV4dChub3RlLCBsZWZ0LCB0b3ApO1xuICAgIH0sXG5cbiAgICByZW5kZXJTaGFwZTogZnVuY3Rpb24obm90ZSwgbGVmdCwgdG9wKSB7XG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAncmdiYSgyMDAsMCwwLDAuNSknO1xuICAgICAgdGhpcy5jdHguZmlsbFJlY3QuYXBwbHkodGhpcy5jdHgsIFtsZWZ0LCB0b3AsIE1hdGgucm91bmQobm90ZS5zdHlsZS53aWR0aCAqIF90cmFuc2Zvcm0uc2NhbGUpLCBNYXRoLnJvdW5kKG5vdGUuc3R5bGUuaGVpZ2h0ICogX3RyYW5zZm9ybS5zY2FsZSldKTtcbiAgICB9LFxuXG4gICAgcmVuZGVyVGV4dDogZnVuY3Rpb24obm90ZSwgbGVmdCwgdG9wKSB7XG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSBcImJsdWVcIjtcbiAgICAgIHRoaXMuY3R4LmZvbnQgPSBNYXRoLnJvdW5kKDEyICogX3RyYW5zZm9ybS5zY2FsZSkgKyBcInB4IEFyaWFsXCI7XG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgbm90ZS5kYXRhLnRleHRBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5jdHguZmlsbFRleHQoXCIgXCIgKyBub3RlLmRhdGEudGV4dEFycltpXSwgbGVmdCwgTWF0aC5yb3VuZCh0b3AgKyAoMTIgKiAoaSArIDIpIC0gNikgKiBfdHJhbnNmb3JtLnNjYWxlKSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIHJlc2l6ZUNhbnZhczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNhbnZhcy53aWR0aCAgPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICB9LFxuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FudmFzVmlldztcbiIsIi8vIEZvY3VzVmlldy5qc1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBGb2N1c1N0b3JlID0gcmVxdWlyZSgnLi4vc3RvcmVzL0ZvY3VzU3RvcmUnKTtcbnZhciBUcmFuc2Zvcm1TdG9yZSA9IHJlcXVpcmUoJy4uL3N0b3Jlcy9UcmFuc2Zvcm1TdG9yZScpO1xuXG52YXIgX3RyYW5zZm9ybTtcbnZhciBfdGV4dGFyZWFFbGVtZW50O1xuXG5mdW5jdGlvbiBfdXBkYXRlU3RhdGVGcm9tU3RvcmVzKCkge1xuICBfdHJhbnNmb3JtID0gVHJhbnNmb3JtU3RvcmUuZ2V0KCk7XG59O1xuXG5mdW5jdGlvbiBfZ2xvYmFsVG9XaW5kb3dUcmFuc2Zvcm0oZ2xvYmFsT2JqKSB7XG4gIHZhciB3aW5kb3dPYmogPSB7fTtcbiAgd2luZG93T2JqLnggPSAoZ2xvYmFsT2JqLnggKyBfdHJhbnNmb3JtLnRyYW5zbGF0ZVgpICogX3RyYW5zZm9ybS5zY2FsZTtcbiAgd2luZG93T2JqLnkgPSAoZ2xvYmFsT2JqLnkgKyBfdHJhbnNmb3JtLnRyYW5zbGF0ZVkpICogX3RyYW5zZm9ybS5zY2FsZTtcbiAgaWYgKCBnbG9iYWxPYmoud2lkdGggJiYgZ2xvYmFsT2JqLmhlaWdodCkge1xuICAgIHdpbmRvd09iai53aWR0aCA9IGdsb2JhbE9iai53aWR0aCAqIF90cmFuc2Zvcm0uc2NhbGU7XG4gICAgd2luZG93T2JqLmhlaWdodCA9IGdsb2JhbE9iai5oZWlnaHQgKiBfdHJhbnNmb3JtLnNjYWxlO1xuICAgIHJldHVybiB3aW5kb3dPYmo7XG4gIH1cbiAgcmV0dXJuIHdpbmRvd09iajtcbn07XG5cbnZhciBGb2N1c1ZpZXcgPSB7XG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgX3RleHRhcmVhRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0ZXh0YXJlYScpO1xuICAgIEZvY3VzU3RvcmUuYWRkQ2hhbmdlTGlzdGVuZXIoJ2NoYW5nZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgIF91cGRhdGVTdGF0ZUZyb21TdG9yZXMoKTtcbiAgICAgIEZvY3VzVmlldy5yZW5kZXIoKTtcbiAgICB9KTtcbiAgfSxcblxuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnNvbGUubG9nKCdzd2l0Y2ggdG8gdGV4dGFyZWEnKTtcbiAgICB2YXIgbm90ZSA9IEZvY3VzU3RvcmUuZ2V0Rm9jdXNEb3VibGVUYXAoKTtcbiAgICBpZiAobm90ZSkge1xuICAgICAgdmFyIHRleHRhcmVhUmVjdEdsb2JhbCA9IHtcbiAgICAgICAgeDogbm90ZS5kYXRhLngsXG4gICAgICAgIHk6IG5vdGUuZGF0YS55LFxuICAgICAgICB3aWR0aDogbm90ZS5zdHlsZS53aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBub3RlLnN0eWxlLmhlaWdodFxuICAgICAgfTtcbiAgICAgIHZhciB0ZXh0YXJlYVJlY3RXaW5kb3cgPSBfZ2xvYmFsVG9XaW5kb3dUcmFuc2Zvcm0odGV4dGFyZWFSZWN0R2xvYmFsKTtcbiAgICAgIHZhciBkZWx0YVRvT3JpZ2luWCA9IC0gbm90ZS5zdHlsZS53aWR0aCAqICgxIC0gX3RyYW5zZm9ybS5zY2FsZSkgLyAyO1xuICAgICAgdmFyIGRlbHRhVG9PcmlnaW5ZID0gLSBub3RlLnN0eWxlLmhlaWdodCAqICgxIC0gX3RyYW5zZm9ybS5zY2FsZSkgLyAyO1xuICAgICAgdmFyIHRyYW5zbGF0ZVggPSBkZWx0YVRvT3JpZ2luWCArIHRleHRhcmVhUmVjdFdpbmRvdy54O1xuICAgICAgdmFyIHRyYW5zbGF0ZVkgPSBkZWx0YVRvT3JpZ2luWSArIHRleHRhcmVhUmVjdFdpbmRvdy55O1xuXG4gICAgICBfdGV4dGFyZWFFbGVtZW50LnZhbHVlID0gbm90ZS5kYXRhLnRleHQ7XG4gICAgICBfdGV4dGFyZWFFbGVtZW50LnN0eWxlLndpZHRoID0gbm90ZS5zdHlsZS53aWR0aCArIFwicHhcIjtcbiAgICAgIF90ZXh0YXJlYUVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gbm90ZS5zdHlsZS5oZWlnaHQgKyBcInB4XCI7XG4gICAgICBfdGV4dGFyZWFFbGVtZW50LnN0eWxlLnRyYW5zZm9ybSA9IFwibWF0cml4KFwiICsgX3RyYW5zZm9ybS5zY2FsZSArIFwiLCAwLCAwLCBcIiArIF90cmFuc2Zvcm0uc2NhbGUgKyBcIiwgXCIgKyB0cmFuc2xhdGVYICsgJywnICsgdHJhbnNsYXRlWSArJyknO1xuICAgICAgX3RleHRhcmVhRWxlbWVudC5zdHlsZS53ZWJraXRUcmFuc2Zvcm0gPSBcIm1hdHJpeChcIiArIF90cmFuc2Zvcm0uc2NhbGUgKyBcIiwgMCwgMCwgXCIgKyBfdHJhbnNmb3JtLnNjYWxlICsgXCIsIFwiICsgdHJhbnNsYXRlWCArICcsJyArIHRyYW5zbGF0ZVkgKycpJztcbiAgICAgIF90ZXh0YXJlYUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICBfdGV4dGFyZWFFbGVtZW50LmZvY3VzKCk7XG4gICAgfVxuICB9ICBcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBGb2N1c1ZpZXc7XG5cblxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBEaXNwYXRjaGVyID0gcmVxdWlyZSgnZmx1eCcpLkRpc3BhdGNoZXI7XG52YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgQ2FudmFzRGlzcGF0Y2hlciA9IGFzc2lnbihuZXcgRGlzcGF0Y2hlcigpLCB7XG4gIC8vQWRkIGN1c3RvbSBkaXNwYXRjaGVyIG1ldGhvZHMgaGVyZVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FudmFzRGlzcGF0Y2hlcjsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgTm90ZXNTdG9yZSA9IHJlcXVpcmUoJy4vTm90ZXNTdG9yZScpO1xudmFyIFRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vVHJhbnNmb3JtU3RvcmUnKTtcbnZhciBDYW52YXNBcHBEaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vZGlzcGF0Y2hlci9DYW52YXNBcHBEaXNwYXRjaGVyJyk7XG5cbnZhciBfZHJhZ1N0YXJ0O1xuXG5mdW5jdGlvbiBfc2V0RHJhZ1N0YXJ0KGhhbW1lckV2ZW50KSB7XG4gIF9kcmFnU3RhcnQgPSB7fTtcbiAgdmFyIGxlZnRUb3AgPSB7bGVmdDogaGFtbWVyRXZlbnQucG9pbnRlcnNbMF0ucGFnZVgsIHRvcDogaGFtbWVyRXZlbnQucG9pbnRlcnNbMF0ucGFnZVl9O1xuICB2YXIgZ2xvYmFsUG9pbnQgPSBUcmFuc2Zvcm0ud2luZG93VG9HbG9iYWxQb2ludChsZWZ0VG9wKTtcbiAgdmFyIG5vdGUgPSBOb3Rlc1N0b3JlLmdldE5vdGVGcm9tWFkoZ2xvYmFsUG9pbnQueCwgZ2xvYmFsUG9pbnQueSk7XG4gIGlmIChub3RlKSB7XG4gICAgY29uc29sZS5sb2coJ19zZXREcmFnU3RhcnQnKTtcbiAgICBfZHJhZ1N0YXJ0Lm5vdGUgPSBub3RlO1xuICAgIF9kcmFnU3RhcnQudG91Y2hMZWZ0ID0gbGVmdFRvcC5sZWZ0O1xuICAgIF9kcmFnU3RhcnQudG91Y2hUb3AgPSBsZWZ0VG9wLnRvcDtcbiAgICBfZHJhZ1N0YXJ0LmVsZW1lbnRYID0gbm90ZS5kYXRhLng7XG4gICAgX2RyYWdTdGFydC5lbGVtZW50WSA9IG5vdGUuZGF0YS55O1xuICB9IGVsc2Uge1xuICAgIF9yZXNldCgpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBfZHJhZyhoYW1tZXJFdmVudCkge1xuICBpZiAoIF9kcmFnU3RhcnQgKSB7XG4gICAgdmFyIG5vdGUgPSBfZHJhZ1N0YXJ0Lm5vdGU7XG4gICAgLy8gdmFyIGxlZnRUb3AgPSBfZ2V0UmVsYXRpdmVMZWZ0VG9wKGhhbW1lckV2ZW50KTtcbiAgICB2YXIgbGVmdFRvcCA9IHtsZWZ0OiBoYW1tZXJFdmVudC5wb2ludGVyc1swXS5wYWdlWCwgdG9wOiBoYW1tZXJFdmVudC5wb2ludGVyc1swXS5wYWdlWX07XG4gICAgdmFyIGRlbHRhWCA9IChsZWZ0VG9wLmxlZnQgLSBfZHJhZ1N0YXJ0LnRvdWNoTGVmdCkgLyBUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICB2YXIgZGVsdGFZID0gKGxlZnRUb3AudG9wIC0gX2RyYWdTdGFydC50b3VjaFRvcCkgLyBUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICBub3RlLmRhdGEueCA9IF9kcmFnU3RhcnQuZWxlbWVudFggKyBkZWx0YVg7XG4gICAgbm90ZS5kYXRhLnkgPSBfZHJhZ1N0YXJ0LmVsZW1lbnRZICsgZGVsdGFZO1xuICAgIERyYWdFbGVtZW50U3RvcmUuZW1pdENoYW5nZSgnZHJhZ2dlZCcpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBfcmVzZXQoKSB7XG4gIF9kcmFnU3RhcnQgPSBudWxsO1xufVxuXG52YXIgRHJhZ0VsZW1lbnRTdG9yZSA9IGFzc2lnbih7fSwgRXZlbnRFbWl0dGVyLnByb3RvdHlwZSwge1xuICBcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gX2RyYWdTdGFydC5ub3RlO1xuICB9LFxuXG4gIGVtaXRDaGFuZ2U6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50KSB7XG4gICAgdGhpcy5lbWl0KGNoYW5nZUV2ZW50KTtcbiAgfSxcblxuICBhZGRDaGFuZ2VMaXN0ZW5lcjogZnVuY3Rpb24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbihjaGFuZ2VFdmVudCwgY2FsbGJhY2spO1xuICB9LFxuXG59KTtcblxuRHJhZ0VsZW1lbnRTdG9yZS5kaXNwYXRjaFRva2VuID0gQ2FudmFzQXBwRGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7ICBcbiAgc3dpdGNoIChwYXlsb2FkLmFjdGlvblR5cGUpIHtcbiAgXG4gICAgY2FzZSAncHJlc3NPbmVGaW5nZXInOlxuICAgICAgLy8gX2dldFJlbGF0aXZlTGVmdFRvcCA9IHBheWxvYWQudXRpbHMuX2dldFJlbGF0aXZlTGVmdFRvcDtcbiAgICAgIF9zZXREcmFnU3RhcnQocGF5bG9hZC5oYW1tZXJFdmVudCk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3Bhbic6XG4gICAgICBfZHJhZyhwYXlsb2FkLmhhbW1lckV2ZW50KTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAncHJlc3NUd29GaW5nZXJzJzpcbiAgICAgIF9yZXNldCgpO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OiAvLyBpbnRlbnRpb25hbGx5IGxlZnQgYmxhbmtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRHJhZ0VsZW1lbnRTdG9yZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgQ2FudmFzQXBwRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL2Rpc3BhdGNoZXIvQ2FudmFzQXBwRGlzcGF0Y2hlcicpO1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBfYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xudmFyIF9nZXRSZWxhdGl2ZUxlZnRUb3AgPSByZXF1aXJlKCcuLi91dGlscy9HZXRSZWxhdGl2ZUxlZnRUb3AuanMnKTtcbnZhciBOb3Rlc1N0b3JlID0gcmVxdWlyZSgnLi9Ob3Rlc1N0b3JlJyk7XG52YXIgVHJhbnNmb3JtU3RvcmUgPSByZXF1aXJlKCcuL1RyYW5zZm9ybVN0b3JlJyk7XG52YXIgX2dldEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vdXRpbHMvRXZlbnRUYXJnZXQnKTtcblxudmFyIF9mb2N1c1NpbmdsZVRhcDtcbnZhciBfZm9jdXNEb3VibGVUYXA7XG5cbmZ1bmN0aW9uIF90YXBTaW5nbGVIYW5kbGVyKCkge1xuXG59O1xuXG5mdW5jdGlvbiBfdGFwRG91YmxlSGFuZGxlcihoYW1tZXJFdmVudCkge1xuICAvLyBjb25zb2xlLmxvZygnc2luZ2xlJyk7XG4gIHZhciBub3RlID0gX2dldEV2ZW50VGFyZ2V0KGhhbW1lckV2ZW50KTtcbiAgaWYgKG5vdGUgJiYgbm90ZSAhPT0gX2ZvY3VzRG91YmxlVGFwKSB7XG4gICAgX2ZvY3VzRG91YmxlVGFwID0gbm90ZTtcbiAgICBGb2N1c1N0b3JlLmVtaXRDaGFuZ2UoJ2NoYW5nZWQnKTtcbiAgfVxufTtcblxudmFyIEZvY3VzU3RvcmUgPSBfYXNzaWduKHt9LCBFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gIFxuICBlbWl0Q2hhbmdlOiBmdW5jdGlvbihjaGFuZ2VFdmVudE5hbWUpIHtcbiAgICB0aGlzLmVtaXQoY2hhbmdlRXZlbnROYW1lIHx8ICdjaGFuZ2VkJyk7XG4gIH0sXG5cbiAgYWRkQ2hhbmdlTGlzdGVuZXI6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50LCBjYWxsYmFjaykge1xuICAgIHRoaXMub24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKTtcbiAgfSxcblxuICBnZXRGb2N1c1NpbmdsZVRhcDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9mb2N1c1NpbmdsZVRhcDtcbiAgfSxcblxuICBnZXRGb2N1c0RvdWJsZVRhcDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9mb2N1c0RvdWJsZVRhcDtcbiAgfSxcbn0pO1xuXG5Gb2N1c1N0b3JlLmRpc3BhdGNoVG9rZW4gPSBDYW52YXNBcHBEaXNwYXRjaGVyLnJlZ2lzdGVyKGZ1bmN0aW9uKHBheWxvYWQpIHsgIFxuICBzd2l0Y2ggKHBheWxvYWQuYWN0aW9uVHlwZSkge1xuICBcbiAgICBjYXNlICd0YXBTaW5nbGUnOlxuICAgICAgX3RhcFNpbmdsZUhhbmRsZXIoKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAndGFwRG91YmxlJzpcbiAgICAgIF90YXBEb3VibGVIYW5kbGVyKHBheWxvYWQuaGFtbWVyRXZlbnQpO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OiAvLyBpbnRlbnRpb25hbGx5IGxlZnQgYmxhbmtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRm9jdXNTdG9yZTsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIENhbnZhc0FwcERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi9kaXNwYXRjaGVyL0NhbnZhc0FwcERpc3BhdGNoZXInKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuLy8gdmFyIFRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vVHJhbnNmb3JtU3RvcmUnKTtcblxuLy8gdmFyIF9nZXRSZWxhdGl2ZUxlZnRUb3A7XG4vLyB2YXIgQ0hBTkdFX0VWRU5UUyA9IFsnYWRkZWQnLCAnZHJhZ2dlZCddO1xuXG52YXIgX25vdGVzID0ge307XG52YXIgX25vdGUgPSB7fTsgIC8vIG1vc3QgcmVjZW50IG5vdGUgYWRkZWQgb3IgdXBkYXRlZFxuLy8gdmFyIF9kcmFnU3RhcnQ7XG5cbmZ1bmN0aW9uIF9hZGROb3RlKG5vdGUpIHtcbiAgdmFyIGtleSA9IE9iamVjdC5rZXlzKG5vdGUpWzBdO1xuICBfbm90ZXNba2V5XSA9IG5vdGVba2V5XTtcbiAgX3NldE1vc3RSZWNlbnROb3RlKG5vdGUsIGtleSk7XG4gIE5vdGVzU3RvcmUuZW1pdENoYW5nZSgnYWRkZWQnKTtcblxufVxuXG5mdW5jdGlvbiBfc2V0TW9zdFJlY2VudE5vdGUobm90ZSwga2V5KSB7XG4gIHZhciBrZXlPbGQgPSBPYmplY3Qua2V5cyhfbm90ZSlbMF07XG4gIGRlbGV0ZSBfbm90ZVtrZXlPbGRdO1xuICBhc3NpZ24oX25vdGUsIG5vdGVba2V5XSk7XG59O1xuXG4vLyBmdW5jdGlvbiBfc2V0RHJhZ1N0YXJ0KGhhbW1lckV2ZW50KSB7XG4vLyAgIGNvbnNvbGUubG9nKCdfc2V0RHJhZ1N0YXJ0Jyk7XG4vLyAgIF9kcmFnU3RhcnQgPSB7fTtcbi8vICAgdmFyIGxlZnRUb3AgPSBfZ2V0UmVsYXRpdmVMZWZ0VG9wKGhhbW1lckV2ZW50KTtcbi8vICAgdmFyIFhZO1xuLy8gICB2YXIgbm90ZSA9IF9nZXROb3RlRnJvbVhZKGxlZnRUb3AubGVmdCwgbGVmdFRvcC50b3ApO1xuLy8gICBpZiAobm90ZSkge1xuLy8gICAgIF9kcmFnU3RhcnQubm90ZSA9IG5vdGU7XG4vLyAgICAgX2RyYWdTdGFydC50b3VjaExlZnQgPSBsZWZ0VG9wLmxlZnQ7XG4vLyAgICAgX2RyYWdTdGFydC50b3VjaFRvcCA9IGxlZnRUb3AudG9wO1xuLy8gICAgIF9kcmFnU3RhcnQuZWxlbWVudFggPSBub3RlLmRhdGEueDtcbi8vICAgICBfZHJhZ1N0YXJ0LmVsZW1lbnRZID0gbm90ZS5kYXRhLnk7XG4vLyAgIH0gZWxzZSB7XG4vLyAgICAgX2RyYWdTdGFydCA9IG51bGw7XG4vLyAgIH1cbi8vIH07XG5cbi8vIGZ1bmN0aW9uIF9kcmFnKGhhbW1lckV2ZW50KSB7XG4vLyAgIGlmICggX2RyYWdTdGFydCApIHtcbi8vICAgICB2YXIgbm90ZSA9IF9kcmFnU3RhcnQubm90ZTtcbi8vICAgICB2YXIgbGVmdFRvcCA9IF9nZXRSZWxhdGl2ZUxlZnRUb3AoaGFtbWVyRXZlbnQpO1xuLy8gICAgIHZhciBkZWx0YVggPSAobGVmdFRvcC5sZWZ0IC0gX2RyYWdTdGFydC50b3VjaExlZnQpIC8gVHJhbnNmb3JtLmdldFNjYWxlKCk7XG4vLyAgICAgdmFyIGRlbHRhWSA9IChsZWZ0VG9wLnRvcCAtIF9kcmFnU3RhcnQudG91Y2hUb3ApIC8gVHJhbnNmb3JtLmdldFNjYWxlKCk7XG4vLyAgICAgbm90ZS5kYXRhLnggPSBfZHJhZ1N0YXJ0LmVsZW1lbnRYICsgZGVsdGFYO1xuLy8gICAgIG5vdGUuZGF0YS55ID0gX2RyYWdTdGFydC5lbGVtZW50WSArIGRlbHRhWTtcbi8vICAgICBOb3Rlc1N0b3JlLmVtaXRDaGFuZ2UoJ2RyYWdnZWQnKTtcbi8vICAgfVxuLy8gfVxuXG4gIC8vIENhbnZhc0RlbW8ucHJvdG90eXBlLndpbmRvd1RvR2xvYmFsUG9pbnQgPSBmdW5jdGlvbih3aW5kb3dQb2ludCkge1xuICAvLyAgIHJldHVybiB7XG4gIC8vICAgICB4OiB3aW5kb3d4IC8gdGhpcy50cmFuc2Zvcm0uc2NhbGUgLSB0aGlzLnRyYW5zZm9ybS50cmFuc2xhdGVYLFxuICAvLyAgICAgeTogd2luZG93UG9pbnQueSAvIHRoaXMudHJhbnNmb3JtLnNjYWxlIC0gdGhpcy50cmFuc2Zvcm0udHJhbnNsYXRlWVxuICAvLyAgIH07XG4gIC8vIH07XG5cbi8vIGZ1bmN0aW9uIF9nZXROb3RlRnJvbVhZKHgsIHkpIHtcbi8vICAgdmFyIG5vdGU7XG4vLyAgIGZvcih2YXIga2V5IGluIF9ub3Rlcykge1xuLy8gICAgIG5vdGUgPSBfbm90ZXNba2V5XTtcbi8vICAgICBpZiAoIFxuLy8gICAgICAgbm90ZS5kYXRhLnggPD0geCAmJiBcbi8vICAgICAgIHggPD0gbm90ZS5kYXRhLnggKyBub3RlLnN0eWxlLndpZHRoICYmIFxuLy8gICAgICAgbm90ZS5kYXRhLnkgPD0geSAmJiBcbi8vICAgICAgIHkgPD0gbm90ZS5kYXRhLnkgKyBub3RlLnN0eWxlLmhlaWdodCBcbi8vICAgICApIHtcbi8vICAgICAgIHJldHVybiBub3RlO1xuLy8gICAgIH1cbi8vICAgfVxuLy8gICByZXR1cm4gbnVsbDtcbi8vIH07XG5cbnZhciBOb3Rlc1N0b3JlID0gYXNzaWduKHt9LCBFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gIFxuICBlbWl0Q2hhbmdlOiBmdW5jdGlvbihjaGFuZ2VFdmVudCkge1xuICAgIHRoaXMuZW1pdChjaGFuZ2VFdmVudCk7XG4gIH0sXG5cbiAgYWRkQ2hhbmdlTGlzdGVuZXI6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50LCBjYWxsYmFjaykge1xuICAgIHRoaXMub24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKTtcbiAgfSxcblxuICBnZXRBbGw6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfbm90ZXM7XG4gIH0sXG5cbiAgZ2V0TW9zdFJlY2VudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9ub3RlO1xuICB9LFxuXG4gIGdldE5vdGVGcm9tWFk6IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB2YXIgbm90ZTtcbiAgICBmb3IodmFyIGtleSBpbiBfbm90ZXMpIHtcbiAgICAgIG5vdGUgPSBfbm90ZXNba2V5XTtcbiAgICAgIGlmICggXG4gICAgICAgIG5vdGUuZGF0YS54IDw9IHggJiYgXG4gICAgICAgIHggPD0gbm90ZS5kYXRhLnggKyBub3RlLnN0eWxlLndpZHRoICYmIFxuICAgICAgICBub3RlLmRhdGEueSA8PSB5ICYmIFxuICAgICAgICB5IDw9IG5vdGUuZGF0YS55ICsgbm90ZS5zdHlsZS5oZWlnaHQgXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG5vdGU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG59KTtcblxuTm90ZXNTdG9yZS5kaXNwYXRjaFRva2VuID0gQ2FudmFzQXBwRGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gIFxuICBzd2l0Y2ggKHBheWxvYWQuYWN0aW9uVHlwZSkge1xuICAgIFxuICAgIGNhc2UgXCJub3RlX2FkZGVkXCI6XG4gICAgICBfYWRkTm90ZShwYXlsb2FkLm5vdGUpO1xuICAgICAgYnJlYWs7XG5cbiAgICAvLyBjYXNlICdwcmVzcyc6XG4gICAgLy8gICBfZ2V0UmVsYXRpdmVMZWZ0VG9wID0gcGF5bG9hZC51dGlscy5fZ2V0UmVsYXRpdmVMZWZ0VG9wO1xuICAgIC8vICAgX3NldERyYWdTdGFydChwYXlsb2FkLmhhbW1lckV2ZW50KTtcblxuICAgIC8vIGNhc2UgJ3Bhbic6XG4gICAgLy8gICBfZHJhZyhwYXlsb2FkLmhhbW1lckV2ZW50KTtcblxuICAgIGRlZmF1bHQ6ICAvLyBkbyBub3RoaW5nXG4gIH1cblxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTm90ZXNTdG9yZTsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIENhbnZhc0FwcERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi9kaXNwYXRjaGVyL0NhbnZhc0FwcERpc3BhdGNoZXInKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgX2Fzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcbnZhciBfZ2V0UmVsYXRpdmVMZWZ0VG9wID0gcmVxdWlyZSgnLi4vdXRpbHMvR2V0UmVsYXRpdmVMZWZ0VG9wLmpzJyk7XG52YXIgTm90ZXNTdG9yZSA9IHJlcXVpcmUoJy4vTm90ZXNTdG9yZScpO1xuXG52YXIgQ0hBTkdFX0VWRU5UID0gJ2NoYW5nZSc7XG5cbnZhciBfdHJhbnNsYXRlU3RhcnREYXRhO1xuXG52YXIgX3BpbmNoU3RhcnQ7XG5cbnZhciBfdHJhbnNmb3JtID0ge1xuICB0cmFuc2xhdGVYOiAwLFxuICB0cmFuc2xhdGVZOiAwLFxuICBzY2FsZTogMVxufTtcblxuZnVuY3Rpb24gX3RyYW5zbGF0ZVN0YXJ0KGhhbW1lckV2ZW50KSB7XG4gIF9yZXNldCgpO1xuICBfdHJhbnNsYXRlU3RhcnREYXRhID0ge307XG4gIHZhciBsZWZ0VG9wID0ge2xlZnQ6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VYLCB0b3A6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfTtcbiAgdmFyIGdsb2JhbFBvaW50ID0gVHJhbnNmb3JtLndpbmRvd1RvR2xvYmFsUG9pbnQobGVmdFRvcCk7XG4gIHZhciBub3RlID0gTm90ZXNTdG9yZS5nZXROb3RlRnJvbVhZKGdsb2JhbFBvaW50LngsIGdsb2JhbFBvaW50LnkpO1xuICBpZiAoICFub3RlKSB7XG4gICAgY29uc29sZS5sb2coJ190cmFuc2xhdGVTdGFydCcpO1xuICAgIF90cmFuc2xhdGVTdGFydERhdGEubGVmdCA9IGxlZnRUb3AubGVmdDtcbiAgICBfdHJhbnNsYXRlU3RhcnREYXRhLnRvcCA9IGxlZnRUb3AudG9wO1xuICAgIF90cmFuc2xhdGVTdGFydERhdGEudHJhbnNsYXRlWCA9IF90cmFuc2Zvcm0udHJhbnNsYXRlWDtcbiAgICBfdHJhbnNsYXRlU3RhcnREYXRhLnRyYW5zbGF0ZVkgPSBfdHJhbnNmb3JtLnRyYW5zbGF0ZVk7XG4gIH0gZWxzZSB7XG4gICAgX3RyYW5zbGF0ZVN0YXJ0RGF0YSA9IG51bGw7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIF90cmFuc2xhdGUoaGFtbWVyRXZlbnQpIHtcbiAgaWYgKCBfdHJhbnNsYXRlU3RhcnREYXRhICkge1xuICAgIHZhciBsZWZ0VG9wID0ge2xlZnQ6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VYLCB0b3A6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfTtcbiAgICBfdHJhbnNmb3JtLnRyYW5zbGF0ZVggPSBfdHJhbnNsYXRlU3RhcnREYXRhLnRyYW5zbGF0ZVggKyAobGVmdFRvcC5sZWZ0IC0gX3RyYW5zbGF0ZVN0YXJ0RGF0YS5sZWZ0KSAvIF90cmFuc2Zvcm0uc2NhbGU7XG4gICAgX3RyYW5zZm9ybS50cmFuc2xhdGVZID0gX3RyYW5zbGF0ZVN0YXJ0RGF0YS50cmFuc2xhdGVZICsgKGxlZnRUb3AudG9wIC0gX3RyYW5zbGF0ZVN0YXJ0RGF0YS50b3ApIC8gX3RyYW5zZm9ybS5zY2FsZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gX3Jlc2V0KCkge1xuICBfdHJhbnNsYXRlU3RhcnREYXRhID0gbnVsbDtcbiAgX3BpbmNoU3RhcnQgPSBudWxsO1xufVxuXG5mdW5jdGlvbiBfem9vbVN0YXJ0KGhhbW1lckV2ZW50KSB7XG4gIF9yZXNldCgpO1xuICBfcGluY2hTdGFydCA9IHt9O1xuICBfcGluY2hTdGFydC5kaXN0ID0gX2Rpc3RIYW1tZXJQaW5jaEV2ZW50KGhhbW1lckV2ZW50KTtcbiAgX3BpbmNoU3RhcnQuY2VudGVyID0ge3g6IGhhbW1lckV2ZW50LmNlbnRlci54LCB5OmhhbW1lckV2ZW50LmNlbnRlci55fTtcbiAgX3BpbmNoU3RhcnQudHJhbnNsYXRlWCA9IF90cmFuc2Zvcm0udHJhbnNsYXRlWDtcbiAgX3BpbmNoU3RhcnQudHJhbnNsYXRlWSA9IF90cmFuc2Zvcm0udHJhbnNsYXRlWTtcbiAgX3BpbmNoU3RhcnQuc2NhbGUgPSBfdHJhbnNmb3JtLnNjYWxlO1xuICBjb25zb2xlLmxvZyhfcGluY2hTdGFydCk7XG59O1xuXG5mdW5jdGlvbiBfbW91c2V3aGVlbFN0YXJ0KGV2ZW50KSB7XG4gIF9yZXNldCgpO1xuICBfcGluY2hTdGFydCA9IHt9O1xuICBfcGluY2hTdGFydC50cmFuc2xhdGVYID0gX3RyYW5zZm9ybS50cmFuc2xhdGVYO1xuICBfcGluY2hTdGFydC50cmFuc2xhdGVZID0gX3RyYW5zZm9ybS50cmFuc2xhdGVZO1xuICBfcGluY2hTdGFydC5zY2FsZSA9IF90cmFuc2Zvcm0uc2NhbGU7XG4gIF9waW5jaFN0YXJ0LmNlbnRlciA9IHt4OiBldmVudC5wYWdlWCwgeTogZXZlbnQucGFnZVl9O1xufVxuXG5mdW5jdGlvbiBfem9vbShoYW1tZXJFdmVudCwgZXZlbnROYW1lKSB7XG4gIGlmKGhhbW1lckV2ZW50LnR5cGUgPT09ICdtb3VzZXdoZWVsJykge1xuICAgIF9tb3VzZXdoZWVsU3RhcnQoaGFtbWVyRXZlbnQpO1xuICAgIF90cmFuc2Zvcm0uc2NhbGUgPSAoaGFtbWVyRXZlbnQud2hlZWxEZWx0YVkgPCAwKSA/IF90cmFuc2Zvcm0uc2NhbGUgKiAxLjEgOiBfdHJhbnNmb3JtLnNjYWxlICogMC45MDtcbiAgfSBlbHNlIHtcbiAgICB2YXIgbmV3UGluY2hEaXN0ID0gX2Rpc3RIYW1tZXJQaW5jaEV2ZW50KGhhbW1lckV2ZW50KTtcbiAgICB2YXIgbmV3U2NhbGUgPSBfcGluY2hTdGFydC5zY2FsZSAqIG5ld1BpbmNoRGlzdCAvIF9waW5jaFN0YXJ0LmRpc3Q7XG4gICAgX3RyYW5zZm9ybS5zY2FsZSA9IG5ld1NjYWxlO1xuICB9XG4gIGlmICggX3BpbmNoU3RhcnQgKSB7XG4gICAgX3RyYW5zZm9ybS50cmFuc2xhdGVYID0gX3BpbmNoU3RhcnQudHJhbnNsYXRlWCAtIF9nZXRUcmFuc2xhdGVEZWx0YShfcGluY2hTdGFydC5jZW50ZXIueCwgX3BpbmNoU3RhcnQuc2NhbGUsIF90cmFuc2Zvcm0uc2NhbGUpO1xuICAgIF90cmFuc2Zvcm0udHJhbnNsYXRlWSA9IF9waW5jaFN0YXJ0LnRyYW5zbGF0ZVkgLSBfZ2V0VHJhbnNsYXRlRGVsdGEoX3BpbmNoU3RhcnQuY2VudGVyLnksIF9waW5jaFN0YXJ0LnNjYWxlLCBfdHJhbnNmb3JtLnNjYWxlKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gX2dldFRyYW5zbGF0ZURlbHRhKHgsIHNjYWxlUHJldiwgc2NhbGVOZXcpIHtcbiAgdmFyIHRyYW5zbGF0ZURlbHRhID0gKHggLyBzY2FsZVByZXYgKiBzY2FsZU5ldyAtIHgpIC8gc2NhbGVOZXc7XG4gIHJldHVybiB0cmFuc2xhdGVEZWx0YTtcbn07XG5cbmZ1bmN0aW9uIF9kaXN0SGFtbWVyUGluY2hFdmVudCAoaGFtbWVyUGluY2hFdmVudCkge1xuICByZXR1cm4gX2Rpc3QoXG4gICAge3g6IGhhbW1lclBpbmNoRXZlbnQucG9pbnRlcnNbMF0ucGFnZVgsIHk6aGFtbWVyUGluY2hFdmVudC5wb2ludGVyc1swXS5wYWdlWX0sXG4gICAge3g6IGhhbW1lclBpbmNoRXZlbnQucG9pbnRlcnNbMV0ucGFnZVgsIHk6aGFtbWVyUGluY2hFdmVudC5wb2ludGVyc1sxXS5wYWdlWX1cbiAgKTtcbn07XG5cbmZ1bmN0aW9uIF9kaXN0KGEsIGIpIHtcbiAgcmV0dXJuIE1hdGguc3FydCggTWF0aC5wb3coYS54IC0gYi54LCAyKSArIE1hdGgucG93KGEueSAtIGIueSwgMikgKTtcbn07XG5cbnZhciBUcmFuc2Zvcm0gPSBfYXNzaWduKHt9LCBFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gIFxuICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfdHJhbnNmb3JtO1xuICB9LFxuXG4gIGdldFNjYWxlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gX3RyYW5zZm9ybS5zY2FsZTtcbiAgfSxcblxuICBlbWl0Q2hhbmdlOiBmdW5jdGlvbihjaGFuZ2VFdmVudE5hbWUpIHtcbiAgICB0aGlzLmVtaXQoY2hhbmdlRXZlbnROYW1lIHx8ICdjaGFuZ2VkJyk7XG4gIH0sXG5cbiAgYWRkQ2hhbmdlTGlzdGVuZXI6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50LCBjYWxsYmFjaykge1xuICAgIHRoaXMub24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKTtcbiAgfSxcblxuICB3aW5kb3dUb0dsb2JhbFBvaW50OiBmdW5jdGlvbih3aW5kb3dQb2ludCkge1xuICAgIHJldHVybiB7XG4gICAgICB4OiB3aW5kb3dQb2ludC5sZWZ0IC8gX3RyYW5zZm9ybS5zY2FsZSAtIF90cmFuc2Zvcm0udHJhbnNsYXRlWCxcbiAgICAgIHk6IHdpbmRvd1BvaW50LnRvcCAvIF90cmFuc2Zvcm0uc2NhbGUgLSBfdHJhbnNmb3JtLnRyYW5zbGF0ZVlcbiAgICB9O1xuICB9LFxuXG59KTtcblxuVHJhbnNmb3JtLmRpc3BhdGNoVG9rZW4gPSBDYW52YXNBcHBEaXNwYXRjaGVyLnJlZ2lzdGVyKGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgc3dpdGNoKHBheWxvYWQuYWN0aW9uVHlwZSkge1xuICAgIFxuICAgIGNhc2UgJ3ByZXNzT25lRmluZ2VyJzpcbiAgICAgIC8vIF9nZXRSZWxhdGl2ZUxlZnRUb3AgPSBwYXlsb2FkLnV0aWxzLl9nZXRSZWxhdGl2ZUxlZnRUb3A7XG4gICAgICBfdHJhbnNsYXRlU3RhcnQocGF5bG9hZC5oYW1tZXJFdmVudCk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3Bhbic6XG4gICAgICBfdHJhbnNsYXRlKHBheWxvYWQuaGFtbWVyRXZlbnQpO1xuICAgICAgVHJhbnNmb3JtLmVtaXRDaGFuZ2UoJ2NoYW5nZWQnKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAncHJlc3NUd29GaW5nZXJzJzpcbiAgICAgIF96b29tU3RhcnQocGF5bG9hZC5oYW1tZXJFdmVudCk7XG4gICAgICBicmVhaztcbiAgICBcbiAgICBjYXNlICdwaW5jaCc6XG4gICAgICBfem9vbShwYXlsb2FkLmhhbW1lckV2ZW50KVxuICAgICAgVHJhbnNmb3JtLmVtaXRDaGFuZ2UoJ2NoYW5nZWQnKVxuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdtb3VzZXdoZWVsJzpcbiAgICAgIF96b29tKHBheWxvYWQuZXZlbnQsICdtb3VzZXdoZWVsJyk7XG4gICAgICBUcmFuc2Zvcm0uZW1pdENoYW5nZSgnY2hhbmdlZCcpXG4gICAgZGVmYXVsdDpcbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBUcmFuc2Zvcm07IiwiLy8gRXZlbnRUYXJnZXQuanNcbnZhciBOb3Rlc1N0b3JlID0gcmVxdWlyZSgnLi4vc3RvcmVzL05vdGVzU3RvcmUnKTtcbnZhciBUcmFuc2Zvcm1TdG9yZSA9IHJlcXVpcmUoJy4uL3N0b3Jlcy9UcmFuc2Zvcm1TdG9yZScpO1xuXG5mdW5jdGlvbiBnZXRUYXJnZXQgKGhhbW1lckV2ZW50KSB7XG4gIHZhciBsZWZ0VG9wID0ge2xlZnQ6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VYLCB0b3A6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfTtcbiAgdmFyIGdsb2JhbFBvaW50ID0gVHJhbnNmb3JtU3RvcmUud2luZG93VG9HbG9iYWxQb2ludChsZWZ0VG9wKTtcbiAgdmFyIG5vdGUgPSBOb3Rlc1N0b3JlLmdldE5vdGVGcm9tWFkoZ2xvYmFsUG9pbnQueCwgZ2xvYmFsUG9pbnQueSk7XG4gIHJldHVybiBub3RlOyAgLy8gbnVsbCBpZiBhIG5vdGUgd2Fzbid0IGNsaWNrZWRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0VGFyZ2V0OyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgQ2FudmFzQXBwRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL2Rpc3BhdGNoZXIvQ2FudmFzQXBwRGlzcGF0Y2hlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5sb2FkRXhhbXBsZSgpO1xuICAgIHRoaXMuZ2V0KCk7XG4gIH0sXG5cbiAgbG9hZEV4YW1wbGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0ZXN0Tm90ZSA9IHtcbiAgICAgIFwiZGF0YVwiIDoge1xuICAgICAgICBcInRleHRcIiA6IFwiI215SGFzaHRhZzBcIixcbiAgICAgICAgXCJ5XCIgOiAxMCxcbiAgICAgICAgXCJ4XCIgOiAxMCxcbiAgICAgICAgXCJoYXNodGFnc1wiIDogWyBcIiNteUhhc2h0YWcwXCIgXVxuICAgICAgfSxcbiAgICAgIFwic3R5bGVcIiA6IHtcbiAgICAgICAgXCJ0b3BcIiA6IDIyOS44NjM2ODM2ODkzMzA5NyxcbiAgICAgICAgXCJoZWlnaHRcIiA6IDUwLFxuICAgICAgICBcImxlZnRcIiA6IDEwMS43NTE3ODk4NDM3MDMyOSxcbiAgICAgICAgXCJ3aWR0aFwiIDogMTkyLFxuICAgICAgICBcImZvbnQtc2l6ZVwiIDogXCIxMHB0XCJcbiAgICAgIH1cbiAgICB9O1xuICAgIHRlc3ROb3RlLmRhdGEudGV4dEFyciA9IHRlc3ROb3RlLmRhdGEudGV4dC5zcGxpdChcIlxcblwiKTtcbiAgICBDYW52YXNBcHBEaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAgICAgIGFjdGlvblR5cGU6ICdub3RlX2FkZGVkJyxcbiAgICAgIG5vdGU6IHt0ZXN0Tm90ZUtleTogdGVzdE5vdGV9XG4gICAgfSk7XG5cbiAgICB2YXIgdGVzdE5vdGUyID0ge1xuICAgICAgXCJkYXRhXCIgOiB7XG4gICAgICAgIFwidGV4dFwiIDogXCIjbXlIYXNodGFnMVwiLFxuICAgICAgICBcInlcIiA6IDI1MCxcbiAgICAgICAgXCJ4XCIgOiAyNTAsXG4gICAgICAgIFwiaGFzaHRhZ3NcIiA6IFsgXCIjbXlIYXNodGFnMVwiIF1cbiAgICAgIH0sXG4gICAgICBcInN0eWxlXCIgOiB7XG4gICAgICAgIFwidG9wXCIgOiAyMjkuODYzNjgzNjg5MzMwOTcsXG4gICAgICAgIFwiaGVpZ2h0XCIgOiA1MCxcbiAgICAgICAgXCJsZWZ0XCIgOiAxMDEuNzUxNzg5ODQzNzAzMjksXG4gICAgICAgIFwid2lkdGhcIiA6IDE5MixcbiAgICAgICAgXCJmb250LXNpemVcIiA6IFwiMTBwdFwiXG4gICAgICB9XG4gICAgfTtcbiAgICB0ZXN0Tm90ZTIuZGF0YS50ZXh0QXJyID0gdGVzdE5vdGUyLmRhdGEudGV4dC5zcGxpdChcIlxcblwiKTtcbiAgICBDYW52YXNBcHBEaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAgICAgIGFjdGlvblR5cGU6ICdub3RlX2FkZGVkJyxcbiAgICAgIG5vdGU6IHt0ZXN0Tm90ZUtleTE6IHRlc3ROb3RlMn1cbiAgICB9KTtcbiAgfSxcblxuICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZWYgPSBuZXcgRmlyZWJhc2UoJ2h0dHBzOi8vYnJhaW5zcGFjZS1iaXouZmlyZWJhc2Vpby5jb20vJyk7XG4gICAgdmFyIG5vdGVzUmVmID0gcmVmLmNoaWxkKCdub3RlczInKTtcbiAgICBub3Rlc1JlZi5vbihcImNoaWxkX2FkZGVkXCIsIGZ1bmN0aW9uKHNuYXBzaG90LCBrZXkpIHtcbiAgICAgIHZhciBub3RlXyA9IHt9O1xuICAgICAgdmFyIG5vdGUgPSBzbmFwc2hvdC52YWwoKTtcbiAgICAgIG5vdGUuZGF0YS50ZXh0QXJyID0gbm90ZS5kYXRhLnRleHQuc3BsaXQoJ1xcbicpO1xuICAgICAgbm90ZV9ba2V5XSA9IG5vdGU7XG4gICAgICBDYW52YXNBcHBEaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAgICAgICAgYWN0aW9uVHlwZTogJ25vdGVfYWRkZWQnLFxuICAgICAgICBub3RlOiBub3RlXyxcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG59IiwiXG52YXIgX2NhbnZhc0VsZW1lbnQ7XG5cbnZhciBnZXRSZWxhdGl2ZUxlZnRUb3AgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgdmFyIHRvdGFsT2Zmc2V0WCA9IDA7XG4gIHZhciB0b3RhbE9mZnNldFkgPSAwO1xuICB2YXIgY2FudmFzWCA9IDA7XG4gIHZhciBjYW52YXNZID0gMDtcbiAgdmFyIGN1cnJlbnRFbGVtZW50ID0gX2NhbnZhc0VsZW1lbnQ7XG5cbiAgZG8ge1xuICAgICAgdG90YWxPZmZzZXRYICs9IF9jYW52YXNFbGVtZW50Lm9mZnNldExlZnQ7XG4gICAgICB0b3RhbE9mZnNldFkgKz0gX2NhbnZhc0VsZW1lbnQub2Zmc2V0VG9wO1xuICB9XG4gIHdoaWxlIChjdXJyZW50RWxlbWVudCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFBhcmVudClcblxuICB2YXIgcGFnZVggPSBldmVudC5wYWdlWCA/IGV2ZW50LnBhZ2VYIDogZXZlbnQuY2hhbmdlZFRvdWNoZXMgPyBldmVudC5jaGFuZ2VkVG91Y2hlc1swXS5wYWdlWCA6IGV2ZW50LmNlbnRlci54O1xuICB2YXIgcGFnZVkgPSBldmVudC5wYWdlWSA/IGV2ZW50LnBhZ2VZIDogZXZlbnQuY2hhbmdlZFRvdWNoZXMgPyBldmVudC5jaGFuZ2VkVG91Y2hlc1swXS5wYWdlWSA6IGV2ZW50LmNlbnRlci55O1xuXG4gIGNhbnZhc1ggPSBwYWdlWCAtIHRvdGFsT2Zmc2V0WDtcbiAgY2FudmFzWSA9IHBhZ2VZIC0gdG90YWxPZmZzZXRZO1xuXG4gIC8vIEZpeCBmb3IgdmFyaWFibGUgY2FudmFzIHdpZHRoXG4gIGNhbnZhc1ggPSBNYXRoLnJvdW5kKCBjYW52YXNYICogKF9jYW52YXNFbGVtZW50LndpZHRoIC8gX2NhbnZhc0VsZW1lbnQub2Zmc2V0V2lkdGgpICk7XG4gIGNhbnZhc1kgPSBNYXRoLnJvdW5kKCBjYW52YXNZICogKF9jYW52YXNFbGVtZW50LmhlaWdodCAvIF9jYW52YXNFbGVtZW50Lm9mZnNldEhlaWdodCkgKTtcblxuICByZXR1cm4ge2xlZnQ6Y2FudmFzWCwgdG9wOmNhbnZhc1l9O1xufTtcblxuZ2V0UmVsYXRpdmVMZWZ0VG9wLnNldCA9IGZ1bmN0aW9uKGNhbnZhc0VsZW1lbnQpIHtcbiAgX2NhbnZhc0VsZW1lbnQgPSBjYW52YXNFbGVtZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFJlbGF0aXZlTGVmdFRvcDtcbiJdfQ==
