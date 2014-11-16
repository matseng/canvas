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
      if (window.performance) _timer.start = window.performance.now();
      _updateStateFromStores();
      this.setCanvasTranslation();
      for(var key in _notes) {
        CanvasView.renderNote(_notes[key]);
      }
      if (window.performance) _timer.average = (_timer.average * _timer.count + window.performance.now() - _timer.start) / (++_timer.count);
      console.log("average render duration: ", _timer.average);
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
        // this.ctx.fillText(" " + note.data.textArr[i], left, top + (12 * (i + 2) - 6) );
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9mbHV4L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ZsdXgvbGliL0Rpc3BhdGNoZXIuanMiLCJub2RlX21vZHVsZXMvZmx1eC9saWIvaW52YXJpYW50LmpzIiwibm9kZV9tb2R1bGVzL2hhbW1lcmpzL2hhbW1lci5qcyIsIm5vZGVfbW9kdWxlcy9vYmplY3QtYXNzaWduL2luZGV4LmpzIiwic3JjL2FwcC5qcyIsInNyYy9jb21wb25lbnRzL0NhbnZhc1ZpZXcuanMiLCJzcmMvY29tcG9uZW50cy9Gb2N1c1ZpZXcuanMiLCJzcmMvZGlzcGF0Y2hlci9DYW52YXNBcHBEaXNwYXRjaGVyLmpzIiwic3JjL3N0b3Jlcy9EcmFnRWxlbWVudFN0b3JlLmpzIiwic3JjL3N0b3Jlcy9Gb2N1c1N0b3JlLmpzIiwic3JjL3N0b3Jlcy9Ob3Rlc1N0b3JlLmpzIiwic3JjL3N0b3Jlcy9UcmFuc2Zvcm1TdG9yZS5qcyIsInNyYy91dGlscy9FdmVudFRhcmdldC5qcyIsInNyYy91dGlscy9GaXJlYmFzZVV0aWxzLmpzIiwic3JjL3V0aWxzL0dldFJlbGF0aXZlTGVmdFRvcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbm1vZHVsZS5leHBvcnRzLkRpc3BhdGNoZXIgPSByZXF1aXJlKCcuL2xpYi9EaXNwYXRjaGVyJylcbiIsIi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBAcHJvdmlkZXNNb2R1bGUgRGlzcGF0Y2hlclxuICogQHR5cGVjaGVja3NcbiAqL1xuXG5cInVzZSBzdHJpY3RcIjtcblxudmFyIGludmFyaWFudCA9IHJlcXVpcmUoJy4vaW52YXJpYW50Jyk7XG5cbnZhciBfbGFzdElEID0gMTtcbnZhciBfcHJlZml4ID0gJ0lEXyc7XG5cbi8qKlxuICogRGlzcGF0Y2hlciBpcyB1c2VkIHRvIGJyb2FkY2FzdCBwYXlsb2FkcyB0byByZWdpc3RlcmVkIGNhbGxiYWNrcy4gVGhpcyBpc1xuICogZGlmZmVyZW50IGZyb20gZ2VuZXJpYyBwdWItc3ViIHN5c3RlbXMgaW4gdHdvIHdheXM6XG4gKlxuICogICAxKSBDYWxsYmFja3MgYXJlIG5vdCBzdWJzY3JpYmVkIHRvIHBhcnRpY3VsYXIgZXZlbnRzLiBFdmVyeSBwYXlsb2FkIGlzXG4gKiAgICAgIGRpc3BhdGNoZWQgdG8gZXZlcnkgcmVnaXN0ZXJlZCBjYWxsYmFjay5cbiAqICAgMikgQ2FsbGJhY2tzIGNhbiBiZSBkZWZlcnJlZCBpbiB3aG9sZSBvciBwYXJ0IHVudGlsIG90aGVyIGNhbGxiYWNrcyBoYXZlXG4gKiAgICAgIGJlZW4gZXhlY3V0ZWQuXG4gKlxuICogRm9yIGV4YW1wbGUsIGNvbnNpZGVyIHRoaXMgaHlwb3RoZXRpY2FsIGZsaWdodCBkZXN0aW5hdGlvbiBmb3JtLCB3aGljaFxuICogc2VsZWN0cyBhIGRlZmF1bHQgY2l0eSB3aGVuIGEgY291bnRyeSBpcyBzZWxlY3RlZDpcbiAqXG4gKiAgIHZhciBmbGlnaHREaXNwYXRjaGVyID0gbmV3IERpc3BhdGNoZXIoKTtcbiAqXG4gKiAgIC8vIEtlZXBzIHRyYWNrIG9mIHdoaWNoIGNvdW50cnkgaXMgc2VsZWN0ZWRcbiAqICAgdmFyIENvdW50cnlTdG9yZSA9IHtjb3VudHJ5OiBudWxsfTtcbiAqXG4gKiAgIC8vIEtlZXBzIHRyYWNrIG9mIHdoaWNoIGNpdHkgaXMgc2VsZWN0ZWRcbiAqICAgdmFyIENpdHlTdG9yZSA9IHtjaXR5OiBudWxsfTtcbiAqXG4gKiAgIC8vIEtlZXBzIHRyYWNrIG9mIHRoZSBiYXNlIGZsaWdodCBwcmljZSBvZiB0aGUgc2VsZWN0ZWQgY2l0eVxuICogICB2YXIgRmxpZ2h0UHJpY2VTdG9yZSA9IHtwcmljZTogbnVsbH1cbiAqXG4gKiBXaGVuIGEgdXNlciBjaGFuZ2VzIHRoZSBzZWxlY3RlZCBjaXR5LCB3ZSBkaXNwYXRjaCB0aGUgcGF5bG9hZDpcbiAqXG4gKiAgIGZsaWdodERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICogICAgIGFjdGlvblR5cGU6ICdjaXR5LXVwZGF0ZScsXG4gKiAgICAgc2VsZWN0ZWRDaXR5OiAncGFyaXMnXG4gKiAgIH0pO1xuICpcbiAqIFRoaXMgcGF5bG9hZCBpcyBkaWdlc3RlZCBieSBgQ2l0eVN0b3JlYDpcbiAqXG4gKiAgIGZsaWdodERpc3BhdGNoZXIucmVnaXN0ZXIoZnVuY3Rpb24ocGF5bG9hZCkge1xuICogICAgIGlmIChwYXlsb2FkLmFjdGlvblR5cGUgPT09ICdjaXR5LXVwZGF0ZScpIHtcbiAqICAgICAgIENpdHlTdG9yZS5jaXR5ID0gcGF5bG9hZC5zZWxlY3RlZENpdHk7XG4gKiAgICAgfVxuICogICB9KTtcbiAqXG4gKiBXaGVuIHRoZSB1c2VyIHNlbGVjdHMgYSBjb3VudHJ5LCB3ZSBkaXNwYXRjaCB0aGUgcGF5bG9hZDpcbiAqXG4gKiAgIGZsaWdodERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICogICAgIGFjdGlvblR5cGU6ICdjb3VudHJ5LXVwZGF0ZScsXG4gKiAgICAgc2VsZWN0ZWRDb3VudHJ5OiAnYXVzdHJhbGlhJ1xuICogICB9KTtcbiAqXG4gKiBUaGlzIHBheWxvYWQgaXMgZGlnZXN0ZWQgYnkgYm90aCBzdG9yZXM6XG4gKlxuICogICAgQ291bnRyeVN0b3JlLmRpc3BhdGNoVG9rZW4gPSBmbGlnaHREaXNwYXRjaGVyLnJlZ2lzdGVyKGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAqICAgICBpZiAocGF5bG9hZC5hY3Rpb25UeXBlID09PSAnY291bnRyeS11cGRhdGUnKSB7XG4gKiAgICAgICBDb3VudHJ5U3RvcmUuY291bnRyeSA9IHBheWxvYWQuc2VsZWN0ZWRDb3VudHJ5O1xuICogICAgIH1cbiAqICAgfSk7XG4gKlxuICogV2hlbiB0aGUgY2FsbGJhY2sgdG8gdXBkYXRlIGBDb3VudHJ5U3RvcmVgIGlzIHJlZ2lzdGVyZWQsIHdlIHNhdmUgYSByZWZlcmVuY2VcbiAqIHRvIHRoZSByZXR1cm5lZCB0b2tlbi4gVXNpbmcgdGhpcyB0b2tlbiB3aXRoIGB3YWl0Rm9yKClgLCB3ZSBjYW4gZ3VhcmFudGVlXG4gKiB0aGF0IGBDb3VudHJ5U3RvcmVgIGlzIHVwZGF0ZWQgYmVmb3JlIHRoZSBjYWxsYmFjayB0aGF0IHVwZGF0ZXMgYENpdHlTdG9yZWBcbiAqIG5lZWRzIHRvIHF1ZXJ5IGl0cyBkYXRhLlxuICpcbiAqICAgQ2l0eVN0b3JlLmRpc3BhdGNoVG9rZW4gPSBmbGlnaHREaXNwYXRjaGVyLnJlZ2lzdGVyKGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAqICAgICBpZiAocGF5bG9hZC5hY3Rpb25UeXBlID09PSAnY291bnRyeS11cGRhdGUnKSB7XG4gKiAgICAgICAvLyBgQ291bnRyeVN0b3JlLmNvdW50cnlgIG1heSBub3QgYmUgdXBkYXRlZC5cbiAqICAgICAgIGZsaWdodERpc3BhdGNoZXIud2FpdEZvcihbQ291bnRyeVN0b3JlLmRpc3BhdGNoVG9rZW5dKTtcbiAqICAgICAgIC8vIGBDb3VudHJ5U3RvcmUuY291bnRyeWAgaXMgbm93IGd1YXJhbnRlZWQgdG8gYmUgdXBkYXRlZC5cbiAqXG4gKiAgICAgICAvLyBTZWxlY3QgdGhlIGRlZmF1bHQgY2l0eSBmb3IgdGhlIG5ldyBjb3VudHJ5XG4gKiAgICAgICBDaXR5U3RvcmUuY2l0eSA9IGdldERlZmF1bHRDaXR5Rm9yQ291bnRyeShDb3VudHJ5U3RvcmUuY291bnRyeSk7XG4gKiAgICAgfVxuICogICB9KTtcbiAqXG4gKiBUaGUgdXNhZ2Ugb2YgYHdhaXRGb3IoKWAgY2FuIGJlIGNoYWluZWQsIGZvciBleGFtcGxlOlxuICpcbiAqICAgRmxpZ2h0UHJpY2VTdG9yZS5kaXNwYXRjaFRva2VuID1cbiAqICAgICBmbGlnaHREaXNwYXRjaGVyLnJlZ2lzdGVyKGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAqICAgICAgIHN3aXRjaCAocGF5bG9hZC5hY3Rpb25UeXBlKSB7XG4gKiAgICAgICAgIGNhc2UgJ2NvdW50cnktdXBkYXRlJzpcbiAqICAgICAgICAgICBmbGlnaHREaXNwYXRjaGVyLndhaXRGb3IoW0NpdHlTdG9yZS5kaXNwYXRjaFRva2VuXSk7XG4gKiAgICAgICAgICAgRmxpZ2h0UHJpY2VTdG9yZS5wcmljZSA9XG4gKiAgICAgICAgICAgICBnZXRGbGlnaHRQcmljZVN0b3JlKENvdW50cnlTdG9yZS5jb3VudHJ5LCBDaXR5U3RvcmUuY2l0eSk7XG4gKiAgICAgICAgICAgYnJlYWs7XG4gKlxuICogICAgICAgICBjYXNlICdjaXR5LXVwZGF0ZSc6XG4gKiAgICAgICAgICAgRmxpZ2h0UHJpY2VTdG9yZS5wcmljZSA9XG4gKiAgICAgICAgICAgICBGbGlnaHRQcmljZVN0b3JlKENvdW50cnlTdG9yZS5jb3VudHJ5LCBDaXR5U3RvcmUuY2l0eSk7XG4gKiAgICAgICAgICAgYnJlYWs7XG4gKiAgICAgfVxuICogICB9KTtcbiAqXG4gKiBUaGUgYGNvdW50cnktdXBkYXRlYCBwYXlsb2FkIHdpbGwgYmUgZ3VhcmFudGVlZCB0byBpbnZva2UgdGhlIHN0b3JlcydcbiAqIHJlZ2lzdGVyZWQgY2FsbGJhY2tzIGluIG9yZGVyOiBgQ291bnRyeVN0b3JlYCwgYENpdHlTdG9yZWAsIHRoZW5cbiAqIGBGbGlnaHRQcmljZVN0b3JlYC5cbiAqL1xuXG4gIGZ1bmN0aW9uIERpc3BhdGNoZXIoKSB7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3MgPSB7fTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2lzUGVuZGluZyA9IHt9O1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNIYW5kbGVkID0ge307XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0Rpc3BhdGNoaW5nID0gZmFsc2U7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9wZW5kaW5nUGF5bG9hZCA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgY2FsbGJhY2sgdG8gYmUgaW52b2tlZCB3aXRoIGV2ZXJ5IGRpc3BhdGNoZWQgcGF5bG9hZC4gUmV0dXJuc1xuICAgKiBhIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgd2l0aCBgd2FpdEZvcigpYC5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHJldHVybiB7c3RyaW5nfVxuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUucmVnaXN0ZXI9ZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgaWQgPSBfcHJlZml4ICsgX2xhc3RJRCsrO1xuICAgIHRoaXMuJERpc3BhdGNoZXJfY2FsbGJhY2tzW2lkXSA9IGNhbGxiYWNrO1xuICAgIHJldHVybiBpZDtcbiAgfTtcblxuICAvKipcbiAgICogUmVtb3ZlcyBhIGNhbGxiYWNrIGJhc2VkIG9uIGl0cyB0b2tlbi5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGlkXG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS51bnJlZ2lzdGVyPWZ1bmN0aW9uKGlkKSB7XG4gICAgaW52YXJpYW50KFxuICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3NbaWRdLFxuICAgICAgJ0Rpc3BhdGNoZXIudW5yZWdpc3RlciguLi4pOiBgJXNgIGRvZXMgbm90IG1hcCB0byBhIHJlZ2lzdGVyZWQgY2FsbGJhY2suJyxcbiAgICAgIGlkXG4gICAgKTtcbiAgICBkZWxldGUgdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3NbaWRdO1xuICB9O1xuXG4gIC8qKlxuICAgKiBXYWl0cyBmb3IgdGhlIGNhbGxiYWNrcyBzcGVjaWZpZWQgdG8gYmUgaW52b2tlZCBiZWZvcmUgY29udGludWluZyBleGVjdXRpb25cbiAgICogb2YgdGhlIGN1cnJlbnQgY2FsbGJhY2suIFRoaXMgbWV0aG9kIHNob3VsZCBvbmx5IGJlIHVzZWQgYnkgYSBjYWxsYmFjayBpblxuICAgKiByZXNwb25zZSB0byBhIGRpc3BhdGNoZWQgcGF5bG9hZC5cbiAgICpcbiAgICogQHBhcmFtIHthcnJheTxzdHJpbmc+fSBpZHNcbiAgICovXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLndhaXRGb3I9ZnVuY3Rpb24oaWRzKSB7XG4gICAgaW52YXJpYW50KFxuICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0Rpc3BhdGNoaW5nLFxuICAgICAgJ0Rpc3BhdGNoZXIud2FpdEZvciguLi4pOiBNdXN0IGJlIGludm9rZWQgd2hpbGUgZGlzcGF0Y2hpbmcuJ1xuICAgICk7XG4gICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IGlkcy5sZW5ndGg7IGlpKyspIHtcbiAgICAgIHZhciBpZCA9IGlkc1tpaV07XG4gICAgICBpZiAodGhpcy4kRGlzcGF0Y2hlcl9pc1BlbmRpbmdbaWRdKSB7XG4gICAgICAgIGludmFyaWFudChcbiAgICAgICAgICB0aGlzLiREaXNwYXRjaGVyX2lzSGFuZGxlZFtpZF0sXG4gICAgICAgICAgJ0Rpc3BhdGNoZXIud2FpdEZvciguLi4pOiBDaXJjdWxhciBkZXBlbmRlbmN5IGRldGVjdGVkIHdoaWxlICcgK1xuICAgICAgICAgICd3YWl0aW5nIGZvciBgJXNgLicsXG4gICAgICAgICAgaWRcbiAgICAgICAgKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpbnZhcmlhbnQoXG4gICAgICAgIHRoaXMuJERpc3BhdGNoZXJfY2FsbGJhY2tzW2lkXSxcbiAgICAgICAgJ0Rpc3BhdGNoZXIud2FpdEZvciguLi4pOiBgJXNgIGRvZXMgbm90IG1hcCB0byBhIHJlZ2lzdGVyZWQgY2FsbGJhY2suJyxcbiAgICAgICAgaWRcbiAgICAgICk7XG4gICAgICB0aGlzLiREaXNwYXRjaGVyX2ludm9rZUNhbGxiYWNrKGlkKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIERpc3BhdGNoZXMgYSBwYXlsb2FkIHRvIGFsbCByZWdpc3RlcmVkIGNhbGxiYWNrcy5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IHBheWxvYWRcbiAgICovXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLmRpc3BhdGNoPWZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgICBpbnZhcmlhbnQoXG4gICAgICAhdGhpcy4kRGlzcGF0Y2hlcl9pc0Rpc3BhdGNoaW5nLFxuICAgICAgJ0Rpc3BhdGNoLmRpc3BhdGNoKC4uLik6IENhbm5vdCBkaXNwYXRjaCBpbiB0aGUgbWlkZGxlIG9mIGEgZGlzcGF0Y2guJ1xuICAgICk7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9zdGFydERpc3BhdGNoaW5nKHBheWxvYWQpO1xuICAgIHRyeSB7XG4gICAgICBmb3IgKHZhciBpZCBpbiB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrcykge1xuICAgICAgICBpZiAodGhpcy4kRGlzcGF0Y2hlcl9pc1BlbmRpbmdbaWRdKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9pbnZva2VDYWxsYmFjayhpZCk7XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuJERpc3BhdGNoZXJfc3RvcERpc3BhdGNoaW5nKCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBJcyB0aGlzIERpc3BhdGNoZXIgY3VycmVudGx5IGRpc3BhdGNoaW5nLlxuICAgKlxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUuaXNEaXNwYXRjaGluZz1mdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy4kRGlzcGF0Y2hlcl9pc0Rpc3BhdGNoaW5nO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDYWxsIHRoZSBjYWxsYmFjayBzdG9yZWQgd2l0aCB0aGUgZ2l2ZW4gaWQuIEFsc28gZG8gc29tZSBpbnRlcm5hbFxuICAgKiBib29ra2VlcGluZy5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGlkXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUuJERpc3BhdGNoZXJfaW52b2tlQ2FsbGJhY2s9ZnVuY3Rpb24oaWQpIHtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2lzUGVuZGluZ1tpZF0gPSB0cnVlO1xuICAgIHRoaXMuJERpc3BhdGNoZXJfY2FsbGJhY2tzW2lkXSh0aGlzLiREaXNwYXRjaGVyX3BlbmRpbmdQYXlsb2FkKTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2lzSGFuZGxlZFtpZF0gPSB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgdXAgYm9va2tlZXBpbmcgbmVlZGVkIHdoZW4gZGlzcGF0Y2hpbmcuXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBwYXlsb2FkXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUuJERpc3BhdGNoZXJfc3RhcnREaXNwYXRjaGluZz1mdW5jdGlvbihwYXlsb2FkKSB7XG4gICAgZm9yICh2YXIgaWQgaW4gdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3MpIHtcbiAgICAgIHRoaXMuJERpc3BhdGNoZXJfaXNQZW5kaW5nW2lkXSA9IGZhbHNlO1xuICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0hhbmRsZWRbaWRdID0gZmFsc2U7XG4gICAgfVxuICAgIHRoaXMuJERpc3BhdGNoZXJfcGVuZGluZ1BheWxvYWQgPSBwYXlsb2FkO1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNEaXNwYXRjaGluZyA9IHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIENsZWFyIGJvb2trZWVwaW5nIHVzZWQgZm9yIGRpc3BhdGNoaW5nLlxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLiREaXNwYXRjaGVyX3N0b3BEaXNwYXRjaGluZz1mdW5jdGlvbigpIHtcbiAgICB0aGlzLiREaXNwYXRjaGVyX3BlbmRpbmdQYXlsb2FkID0gbnVsbDtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmcgPSBmYWxzZTtcbiAgfTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IERpc3BhdGNoZXI7XG4iLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIEBwcm92aWRlc01vZHVsZSBpbnZhcmlhbnRcbiAqL1xuXG5cInVzZSBzdHJpY3RcIjtcblxuLyoqXG4gKiBVc2UgaW52YXJpYW50KCkgdG8gYXNzZXJ0IHN0YXRlIHdoaWNoIHlvdXIgcHJvZ3JhbSBhc3N1bWVzIHRvIGJlIHRydWUuXG4gKlxuICogUHJvdmlkZSBzcHJpbnRmLXN0eWxlIGZvcm1hdCAob25seSAlcyBpcyBzdXBwb3J0ZWQpIGFuZCBhcmd1bWVudHNcbiAqIHRvIHByb3ZpZGUgaW5mb3JtYXRpb24gYWJvdXQgd2hhdCBicm9rZSBhbmQgd2hhdCB5b3Ugd2VyZVxuICogZXhwZWN0aW5nLlxuICpcbiAqIFRoZSBpbnZhcmlhbnQgbWVzc2FnZSB3aWxsIGJlIHN0cmlwcGVkIGluIHByb2R1Y3Rpb24sIGJ1dCB0aGUgaW52YXJpYW50XG4gKiB3aWxsIHJlbWFpbiB0byBlbnN1cmUgbG9naWMgZG9lcyBub3QgZGlmZmVyIGluIHByb2R1Y3Rpb24uXG4gKi9cblxudmFyIGludmFyaWFudCA9IGZ1bmN0aW9uKGNvbmRpdGlvbiwgZm9ybWF0LCBhLCBiLCBjLCBkLCBlLCBmKSB7XG4gIGlmIChmYWxzZSkge1xuICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhcmlhbnQgcmVxdWlyZXMgYW4gZXJyb3IgbWVzc2FnZSBhcmd1bWVudCcpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghY29uZGl0aW9uKSB7XG4gICAgdmFyIGVycm9yO1xuICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoXG4gICAgICAgICdNaW5pZmllZCBleGNlcHRpb24gb2NjdXJyZWQ7IHVzZSB0aGUgbm9uLW1pbmlmaWVkIGRldiBlbnZpcm9ubWVudCAnICtcbiAgICAgICAgJ2ZvciB0aGUgZnVsbCBlcnJvciBtZXNzYWdlIGFuZCBhZGRpdGlvbmFsIGhlbHBmdWwgd2FybmluZ3MuJ1xuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGFyZ3MgPSBbYSwgYiwgYywgZCwgZSwgZl07XG4gICAgICB2YXIgYXJnSW5kZXggPSAwO1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoXG4gICAgICAgICdJbnZhcmlhbnQgVmlvbGF0aW9uOiAnICtcbiAgICAgICAgZm9ybWF0LnJlcGxhY2UoLyVzL2csIGZ1bmN0aW9uKCkgeyByZXR1cm4gYXJnc1thcmdJbmRleCsrXTsgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZXJyb3IuZnJhbWVzVG9Qb3AgPSAxOyAvLyB3ZSBkb24ndCBjYXJlIGFib3V0IGludmFyaWFudCdzIG93biBmcmFtZVxuICAgIHRocm93IGVycm9yO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGludmFyaWFudDtcbiIsIi8qISBIYW1tZXIuSlMgLSB2Mi4wLjQgLSAyMDE0LTA5LTI4XHJcbiAqIGh0dHA6Ly9oYW1tZXJqcy5naXRodWIuaW8vXHJcbiAqXHJcbiAqIENvcHlyaWdodCAoYykgMjAxNCBKb3JpayBUYW5nZWxkZXI7XHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSAqL1xyXG4oZnVuY3Rpb24od2luZG93LCBkb2N1bWVudCwgZXhwb3J0TmFtZSwgdW5kZWZpbmVkKSB7XHJcbiAgJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIFZFTkRPUl9QUkVGSVhFUyA9IFsnJywgJ3dlYmtpdCcsICdtb3onLCAnTVMnLCAnbXMnLCAnbyddO1xyXG52YXIgVEVTVF9FTEVNRU5UID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcblxyXG52YXIgVFlQRV9GVU5DVElPTiA9ICdmdW5jdGlvbic7XHJcblxyXG52YXIgcm91bmQgPSBNYXRoLnJvdW5kO1xyXG52YXIgYWJzID0gTWF0aC5hYnM7XHJcbnZhciBub3cgPSBEYXRlLm5vdztcclxuXHJcbi8qKlxyXG4gKiBzZXQgYSB0aW1lb3V0IHdpdGggYSBnaXZlbiBzY29wZVxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG4gKiBAcGFyYW0ge051bWJlcn0gdGltZW91dFxyXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dFxyXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxyXG4gKi9cclxuZnVuY3Rpb24gc2V0VGltZW91dENvbnRleHQoZm4sIHRpbWVvdXQsIGNvbnRleHQpIHtcclxuICAgIHJldHVybiBzZXRUaW1lb3V0KGJpbmRGbihmbiwgY29udGV4dCksIHRpbWVvdXQpO1xyXG59XHJcblxyXG4vKipcclxuICogaWYgdGhlIGFyZ3VtZW50IGlzIGFuIGFycmF5LCB3ZSB3YW50IHRvIGV4ZWN1dGUgdGhlIGZuIG9uIGVhY2ggZW50cnlcclxuICogaWYgaXQgYWludCBhbiBhcnJheSB3ZSBkb24ndCB3YW50IHRvIGRvIGEgdGhpbmcuXHJcbiAqIHRoaXMgaXMgdXNlZCBieSBhbGwgdGhlIG1ldGhvZHMgdGhhdCBhY2NlcHQgYSBzaW5nbGUgYW5kIGFycmF5IGFyZ3VtZW50LlxyXG4gKiBAcGFyYW0geyp8QXJyYXl9IGFyZ1xyXG4gKiBAcGFyYW0ge1N0cmluZ30gZm5cclxuICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XVxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIGludm9rZUFycmF5QXJnKGFyZywgZm4sIGNvbnRleHQpIHtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcclxuICAgICAgICBlYWNoKGFyZywgY29udGV4dFtmbl0sIGNvbnRleHQpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG4vKipcclxuICogd2FsayBvYmplY3RzIGFuZCBhcnJheXNcclxuICogQHBhcmFtIHtPYmplY3R9IG9ialxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBpdGVyYXRvclxyXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dFxyXG4gKi9cclxuZnVuY3Rpb24gZWFjaChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XHJcbiAgICB2YXIgaTtcclxuXHJcbiAgICBpZiAoIW9iaikge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAob2JqLmZvckVhY2gpIHtcclxuICAgICAgICBvYmouZm9yRWFjaChpdGVyYXRvciwgY29udGV4dCk7XHJcbiAgICB9IGVsc2UgaWYgKG9iai5sZW5ndGggIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIGkgPSAwO1xyXG4gICAgICAgIHdoaWxlIChpIDwgb2JqLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtpXSwgaSwgb2JqKTtcclxuICAgICAgICAgICAgaSsrO1xyXG4gICAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZm9yIChpIGluIG9iaikge1xyXG4gICAgICAgICAgICBvYmouaGFzT3duUHJvcGVydHkoaSkgJiYgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogZXh0ZW5kIG9iamVjdC5cclxuICogbWVhbnMgdGhhdCBwcm9wZXJ0aWVzIGluIGRlc3Qgd2lsbCBiZSBvdmVyd3JpdHRlbiBieSB0aGUgb25lcyBpbiBzcmMuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZXN0XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBzcmNcclxuICogQHBhcmFtIHtCb29sZWFufSBbbWVyZ2VdXHJcbiAqIEByZXR1cm5zIHtPYmplY3R9IGRlc3RcclxuICovXHJcbmZ1bmN0aW9uIGV4dGVuZChkZXN0LCBzcmMsIG1lcmdlKSB7XHJcbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHNyYyk7XHJcbiAgICB2YXIgaSA9IDA7XHJcbiAgICB3aGlsZSAoaSA8IGtleXMubGVuZ3RoKSB7XHJcbiAgICAgICAgaWYgKCFtZXJnZSB8fCAobWVyZ2UgJiYgZGVzdFtrZXlzW2ldXSA9PT0gdW5kZWZpbmVkKSkge1xyXG4gICAgICAgICAgICBkZXN0W2tleXNbaV1dID0gc3JjW2tleXNbaV1dO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpKys7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZGVzdDtcclxufVxyXG5cclxuLyoqXHJcbiAqIG1lcmdlIHRoZSB2YWx1ZXMgZnJvbSBzcmMgaW4gdGhlIGRlc3QuXHJcbiAqIG1lYW5zIHRoYXQgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGRlc3Qgd2lsbCBub3QgYmUgb3ZlcndyaXR0ZW4gYnkgc3JjXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZXN0XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBzcmNcclxuICogQHJldHVybnMge09iamVjdH0gZGVzdFxyXG4gKi9cclxuZnVuY3Rpb24gbWVyZ2UoZGVzdCwgc3JjKSB7XHJcbiAgICByZXR1cm4gZXh0ZW5kKGRlc3QsIHNyYywgdHJ1ZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBzaW1wbGUgY2xhc3MgaW5oZXJpdGFuY2VcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2hpbGRcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gYmFzZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnRpZXNdXHJcbiAqL1xyXG5mdW5jdGlvbiBpbmhlcml0KGNoaWxkLCBiYXNlLCBwcm9wZXJ0aWVzKSB7XHJcbiAgICB2YXIgYmFzZVAgPSBiYXNlLnByb3RvdHlwZSxcclxuICAgICAgICBjaGlsZFA7XHJcblxyXG4gICAgY2hpbGRQID0gY2hpbGQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShiYXNlUCk7XHJcbiAgICBjaGlsZFAuY29uc3RydWN0b3IgPSBjaGlsZDtcclxuICAgIGNoaWxkUC5fc3VwZXIgPSBiYXNlUDtcclxuXHJcbiAgICBpZiAocHJvcGVydGllcykge1xyXG4gICAgICAgIGV4dGVuZChjaGlsZFAsIHByb3BlcnRpZXMpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogc2ltcGxlIGZ1bmN0aW9uIGJpbmRcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHRcclxuICogQHJldHVybnMge0Z1bmN0aW9ufVxyXG4gKi9cclxuZnVuY3Rpb24gYmluZEZuKGZuLCBjb250ZXh0KSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gYm91bmRGbigpIHtcclxuICAgICAgICByZXR1cm4gZm4uYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcclxuICAgIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBsZXQgYSBib29sZWFuIHZhbHVlIGFsc28gYmUgYSBmdW5jdGlvbiB0aGF0IG11c3QgcmV0dXJuIGEgYm9vbGVhblxyXG4gKiB0aGlzIGZpcnN0IGl0ZW0gaW4gYXJncyB3aWxsIGJlIHVzZWQgYXMgdGhlIGNvbnRleHRcclxuICogQHBhcmFtIHtCb29sZWFufEZ1bmN0aW9ufSB2YWxcclxuICogQHBhcmFtIHtBcnJheX0gW2FyZ3NdXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gYm9vbE9yRm4odmFsLCBhcmdzKSB7XHJcbiAgICBpZiAodHlwZW9mIHZhbCA9PSBUWVBFX0ZVTkNUSU9OKSB7XHJcbiAgICAgICAgcmV0dXJuIHZhbC5hcHBseShhcmdzID8gYXJnc1swXSB8fCB1bmRlZmluZWQgOiB1bmRlZmluZWQsIGFyZ3MpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbDtcclxufVxyXG5cclxuLyoqXHJcbiAqIHVzZSB0aGUgdmFsMiB3aGVuIHZhbDEgaXMgdW5kZWZpbmVkXHJcbiAqIEBwYXJhbSB7Kn0gdmFsMVxyXG4gKiBAcGFyYW0geyp9IHZhbDJcclxuICogQHJldHVybnMgeyp9XHJcbiAqL1xyXG5mdW5jdGlvbiBpZlVuZGVmaW5lZCh2YWwxLCB2YWwyKSB7XHJcbiAgICByZXR1cm4gKHZhbDEgPT09IHVuZGVmaW5lZCkgPyB2YWwyIDogdmFsMTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGFkZEV2ZW50TGlzdGVuZXIgd2l0aCBtdWx0aXBsZSBldmVudHMgYXQgb25jZVxyXG4gKiBAcGFyYW0ge0V2ZW50VGFyZ2V0fSB0YXJnZXRcclxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVzXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXJcclxuICovXHJcbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXJzKHRhcmdldCwgdHlwZXMsIGhhbmRsZXIpIHtcclxuICAgIGVhY2goc3BsaXRTdHIodHlwZXMpLCBmdW5jdGlvbih0eXBlKSB7XHJcbiAgICAgICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgaGFuZGxlciwgZmFsc2UpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiByZW1vdmVFdmVudExpc3RlbmVyIHdpdGggbXVsdGlwbGUgZXZlbnRzIGF0IG9uY2VcclxuICogQHBhcmFtIHtFdmVudFRhcmdldH0gdGFyZ2V0XHJcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlc1xyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXHJcbiAqL1xyXG5mdW5jdGlvbiByZW1vdmVFdmVudExpc3RlbmVycyh0YXJnZXQsIHR5cGVzLCBoYW5kbGVyKSB7XHJcbiAgICBlYWNoKHNwbGl0U3RyKHR5cGVzKSwgZnVuY3Rpb24odHlwZSkge1xyXG4gICAgICAgIHRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGhhbmRsZXIsIGZhbHNlKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG4vKipcclxuICogZmluZCBpZiBhIG5vZGUgaXMgaW4gdGhlIGdpdmVuIHBhcmVudFxyXG4gKiBAbWV0aG9kIGhhc1BhcmVudFxyXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXHJcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhcmVudFxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSBmb3VuZFxyXG4gKi9cclxuZnVuY3Rpb24gaGFzUGFyZW50KG5vZGUsIHBhcmVudCkge1xyXG4gICAgd2hpbGUgKG5vZGUpIHtcclxuICAgICAgICBpZiAobm9kZSA9PSBwYXJlbnQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5vZGUgPSBub2RlLnBhcmVudE5vZGU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBzbWFsbCBpbmRleE9mIHdyYXBwZXJcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZmluZFxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gZm91bmRcclxuICovXHJcbmZ1bmN0aW9uIGluU3RyKHN0ciwgZmluZCkge1xyXG4gICAgcmV0dXJuIHN0ci5pbmRleE9mKGZpbmQpID4gLTE7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBzcGxpdCBzdHJpbmcgb24gd2hpdGVzcGFjZVxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXHJcbiAqIEByZXR1cm5zIHtBcnJheX0gd29yZHNcclxuICovXHJcbmZ1bmN0aW9uIHNwbGl0U3RyKHN0cikge1xyXG4gICAgcmV0dXJuIHN0ci50cmltKCkuc3BsaXQoL1xccysvZyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBmaW5kIGlmIGEgYXJyYXkgY29udGFpbnMgdGhlIG9iamVjdCB1c2luZyBpbmRleE9mIG9yIGEgc2ltcGxlIHBvbHlGaWxsXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHNyY1xyXG4gKiBAcGFyYW0ge1N0cmluZ30gZmluZFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2ZpbmRCeUtleV1cclxuICogQHJldHVybiB7Qm9vbGVhbnxOdW1iZXJ9IGZhbHNlIHdoZW4gbm90IGZvdW5kLCBvciB0aGUgaW5kZXhcclxuICovXHJcbmZ1bmN0aW9uIGluQXJyYXkoc3JjLCBmaW5kLCBmaW5kQnlLZXkpIHtcclxuICAgIGlmIChzcmMuaW5kZXhPZiAmJiAhZmluZEJ5S2V5KSB7XHJcbiAgICAgICAgcmV0dXJuIHNyYy5pbmRleE9mKGZpbmQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB2YXIgaSA9IDA7XHJcbiAgICAgICAgd2hpbGUgKGkgPCBzcmMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGlmICgoZmluZEJ5S2V5ICYmIHNyY1tpXVtmaW5kQnlLZXldID09IGZpbmQpIHx8ICghZmluZEJ5S2V5ICYmIHNyY1tpXSA9PT0gZmluZCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGkrKztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogY29udmVydCBhcnJheS1saWtlIG9iamVjdHMgdG8gcmVhbCBhcnJheXNcclxuICogQHBhcmFtIHtPYmplY3R9IG9ialxyXG4gKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAqL1xyXG5mdW5jdGlvbiB0b0FycmF5KG9iaikge1xyXG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKG9iaiwgMCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiB1bmlxdWUgYXJyYXkgd2l0aCBvYmplY3RzIGJhc2VkIG9uIGEga2V5IChsaWtlICdpZCcpIG9yIGp1c3QgYnkgdGhlIGFycmF5J3MgdmFsdWVcclxuICogQHBhcmFtIHtBcnJheX0gc3JjIFt7aWQ6MX0se2lkOjJ9LHtpZDoxfV1cclxuICogQHBhcmFtIHtTdHJpbmd9IFtrZXldXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW3NvcnQ9RmFsc2VdXHJcbiAqIEByZXR1cm5zIHtBcnJheX0gW3tpZDoxfSx7aWQ6Mn1dXHJcbiAqL1xyXG5mdW5jdGlvbiB1bmlxdWVBcnJheShzcmMsIGtleSwgc29ydCkge1xyXG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcclxuICAgIHZhciB2YWx1ZXMgPSBbXTtcclxuICAgIHZhciBpID0gMDtcclxuXHJcbiAgICB3aGlsZSAoaSA8IHNyYy5sZW5ndGgpIHtcclxuICAgICAgICB2YXIgdmFsID0ga2V5ID8gc3JjW2ldW2tleV0gOiBzcmNbaV07XHJcbiAgICAgICAgaWYgKGluQXJyYXkodmFsdWVzLCB2YWwpIDwgMCkge1xyXG4gICAgICAgICAgICByZXN1bHRzLnB1c2goc3JjW2ldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFsdWVzW2ldID0gdmFsO1xyXG4gICAgICAgIGkrKztcclxuICAgIH1cclxuXHJcbiAgICBpZiAoc29ydCkge1xyXG4gICAgICAgIGlmICgha2V5KSB7XHJcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnNvcnQoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5zb3J0KGZ1bmN0aW9uIHNvcnRVbmlxdWVBcnJheShhLCBiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYVtrZXldID4gYltrZXldO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdHM7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBnZXQgdGhlIHByZWZpeGVkIHByb3BlcnR5XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcclxuICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XHJcbiAqIEByZXR1cm5zIHtTdHJpbmd8VW5kZWZpbmVkfSBwcmVmaXhlZFxyXG4gKi9cclxuZnVuY3Rpb24gcHJlZml4ZWQob2JqLCBwcm9wZXJ0eSkge1xyXG4gICAgdmFyIHByZWZpeCwgcHJvcDtcclxuICAgIHZhciBjYW1lbFByb3AgPSBwcm9wZXJ0eVswXS50b1VwcGVyQ2FzZSgpICsgcHJvcGVydHkuc2xpY2UoMSk7XHJcblxyXG4gICAgdmFyIGkgPSAwO1xyXG4gICAgd2hpbGUgKGkgPCBWRU5ET1JfUFJFRklYRVMubGVuZ3RoKSB7XHJcbiAgICAgICAgcHJlZml4ID0gVkVORE9SX1BSRUZJWEVTW2ldO1xyXG4gICAgICAgIHByb3AgPSAocHJlZml4KSA/IHByZWZpeCArIGNhbWVsUHJvcCA6IHByb3BlcnR5O1xyXG5cclxuICAgICAgICBpZiAocHJvcCBpbiBvYmopIHtcclxuICAgICAgICAgICAgcmV0dXJuIHByb3A7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGkrKztcclxuICAgIH1cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBnZXQgYSB1bmlxdWUgaWRcclxuICogQHJldHVybnMge251bWJlcn0gdW5pcXVlSWRcclxuICovXHJcbnZhciBfdW5pcXVlSWQgPSAxO1xyXG5mdW5jdGlvbiB1bmlxdWVJZCgpIHtcclxuICAgIHJldHVybiBfdW5pcXVlSWQrKztcclxufVxyXG5cclxuLyoqXHJcbiAqIGdldCB0aGUgd2luZG93IG9iamVjdCBvZiBhbiBlbGVtZW50XHJcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnRcclxuICogQHJldHVybnMge0RvY3VtZW50Vmlld3xXaW5kb3d9XHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRXaW5kb3dGb3JFbGVtZW50KGVsZW1lbnQpIHtcclxuICAgIHZhciBkb2MgPSBlbGVtZW50Lm93bmVyRG9jdW1lbnQ7XHJcbiAgICByZXR1cm4gKGRvYy5kZWZhdWx0VmlldyB8fCBkb2MucGFyZW50V2luZG93KTtcclxufVxyXG5cclxudmFyIE1PQklMRV9SRUdFWCA9IC9tb2JpbGV8dGFibGV0fGlwKGFkfGhvbmV8b2QpfGFuZHJvaWQvaTtcclxuXHJcbnZhciBTVVBQT1JUX1RPVUNIID0gKCdvbnRvdWNoc3RhcnQnIGluIHdpbmRvdyk7XHJcbnZhciBTVVBQT1JUX1BPSU5URVJfRVZFTlRTID0gcHJlZml4ZWQod2luZG93LCAnUG9pbnRlckV2ZW50JykgIT09IHVuZGVmaW5lZDtcclxudmFyIFNVUFBPUlRfT05MWV9UT1VDSCA9IFNVUFBPUlRfVE9VQ0ggJiYgTU9CSUxFX1JFR0VYLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XHJcblxyXG52YXIgSU5QVVRfVFlQRV9UT1VDSCA9ICd0b3VjaCc7XHJcbnZhciBJTlBVVF9UWVBFX1BFTiA9ICdwZW4nO1xyXG52YXIgSU5QVVRfVFlQRV9NT1VTRSA9ICdtb3VzZSc7XHJcbnZhciBJTlBVVF9UWVBFX0tJTkVDVCA9ICdraW5lY3QnO1xyXG5cclxudmFyIENPTVBVVEVfSU5URVJWQUwgPSAyNTtcclxuXHJcbnZhciBJTlBVVF9TVEFSVCA9IDE7XHJcbnZhciBJTlBVVF9NT1ZFID0gMjtcclxudmFyIElOUFVUX0VORCA9IDQ7XHJcbnZhciBJTlBVVF9DQU5DRUwgPSA4O1xyXG5cclxudmFyIERJUkVDVElPTl9OT05FID0gMTtcclxudmFyIERJUkVDVElPTl9MRUZUID0gMjtcclxudmFyIERJUkVDVElPTl9SSUdIVCA9IDQ7XHJcbnZhciBESVJFQ1RJT05fVVAgPSA4O1xyXG52YXIgRElSRUNUSU9OX0RPV04gPSAxNjtcclxuXHJcbnZhciBESVJFQ1RJT05fSE9SSVpPTlRBTCA9IERJUkVDVElPTl9MRUZUIHwgRElSRUNUSU9OX1JJR0hUO1xyXG52YXIgRElSRUNUSU9OX1ZFUlRJQ0FMID0gRElSRUNUSU9OX1VQIHwgRElSRUNUSU9OX0RPV047XHJcbnZhciBESVJFQ1RJT05fQUxMID0gRElSRUNUSU9OX0hPUklaT05UQUwgfCBESVJFQ1RJT05fVkVSVElDQUw7XHJcblxyXG52YXIgUFJPUFNfWFkgPSBbJ3gnLCAneSddO1xyXG52YXIgUFJPUFNfQ0xJRU5UX1hZID0gWydjbGllbnRYJywgJ2NsaWVudFknXTtcclxuXHJcbi8qKlxyXG4gKiBjcmVhdGUgbmV3IGlucHV0IHR5cGUgbWFuYWdlclxyXG4gKiBAcGFyYW0ge01hbmFnZXJ9IG1hbmFnZXJcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcclxuICogQHJldHVybnMge0lucHV0fVxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIElucHV0KG1hbmFnZXIsIGNhbGxiYWNrKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG4gICAgdGhpcy5lbGVtZW50ID0gbWFuYWdlci5lbGVtZW50O1xyXG4gICAgdGhpcy50YXJnZXQgPSBtYW5hZ2VyLm9wdGlvbnMuaW5wdXRUYXJnZXQ7XHJcblxyXG4gICAgLy8gc21hbGxlciB3cmFwcGVyIGFyb3VuZCB0aGUgaGFuZGxlciwgZm9yIHRoZSBzY29wZSBhbmQgdGhlIGVuYWJsZWQgc3RhdGUgb2YgdGhlIG1hbmFnZXIsXHJcbiAgICAvLyBzbyB3aGVuIGRpc2FibGVkIHRoZSBpbnB1dCBldmVudHMgYXJlIGNvbXBsZXRlbHkgYnlwYXNzZWQuXHJcbiAgICB0aGlzLmRvbUhhbmRsZXIgPSBmdW5jdGlvbihldikge1xyXG4gICAgICAgIGlmIChib29sT3JGbihtYW5hZ2VyLm9wdGlvbnMuZW5hYmxlLCBbbWFuYWdlcl0pKSB7XHJcbiAgICAgICAgICAgIHNlbGYuaGFuZGxlcihldik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLmluaXQoKTtcclxuXHJcbn1cclxuXHJcbklucHV0LnByb3RvdHlwZSA9IHtcclxuICAgIC8qKlxyXG4gICAgICogc2hvdWxkIGhhbmRsZSB0aGUgaW5wdXRFdmVudCBkYXRhIGFuZCB0cmlnZ2VyIHRoZSBjYWxsYmFja1xyXG4gICAgICogQHZpcnR1YWxcclxuICAgICAqL1xyXG4gICAgaGFuZGxlcjogZnVuY3Rpb24oKSB7IH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBiaW5kIHRoZSBldmVudHNcclxuICAgICAqL1xyXG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5ldkVsICYmIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMuZWxlbWVudCwgdGhpcy5ldkVsLCB0aGlzLmRvbUhhbmRsZXIpO1xyXG4gICAgICAgIHRoaXMuZXZUYXJnZXQgJiYgYWRkRXZlbnRMaXN0ZW5lcnModGhpcy50YXJnZXQsIHRoaXMuZXZUYXJnZXQsIHRoaXMuZG9tSGFuZGxlcik7XHJcbiAgICAgICAgdGhpcy5ldldpbiAmJiBhZGRFdmVudExpc3RlbmVycyhnZXRXaW5kb3dGb3JFbGVtZW50KHRoaXMuZWxlbWVudCksIHRoaXMuZXZXaW4sIHRoaXMuZG9tSGFuZGxlcik7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogdW5iaW5kIHRoZSBldmVudHNcclxuICAgICAqL1xyXG4gICAgZGVzdHJveTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5ldkVsICYmIHJlbW92ZUV2ZW50TGlzdGVuZXJzKHRoaXMuZWxlbWVudCwgdGhpcy5ldkVsLCB0aGlzLmRvbUhhbmRsZXIpO1xyXG4gICAgICAgIHRoaXMuZXZUYXJnZXQgJiYgcmVtb3ZlRXZlbnRMaXN0ZW5lcnModGhpcy50YXJnZXQsIHRoaXMuZXZUYXJnZXQsIHRoaXMuZG9tSGFuZGxlcik7XHJcbiAgICAgICAgdGhpcy5ldldpbiAmJiByZW1vdmVFdmVudExpc3RlbmVycyhnZXRXaW5kb3dGb3JFbGVtZW50KHRoaXMuZWxlbWVudCksIHRoaXMuZXZXaW4sIHRoaXMuZG9tSGFuZGxlcik7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogY3JlYXRlIG5ldyBpbnB1dCB0eXBlIG1hbmFnZXJcclxuICogY2FsbGVkIGJ5IHRoZSBNYW5hZ2VyIGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7SGFtbWVyfSBtYW5hZ2VyXHJcbiAqIEByZXR1cm5zIHtJbnB1dH1cclxuICovXHJcbmZ1bmN0aW9uIGNyZWF0ZUlucHV0SW5zdGFuY2UobWFuYWdlcikge1xyXG4gICAgdmFyIFR5cGU7XHJcbiAgICB2YXIgaW5wdXRDbGFzcyA9IG1hbmFnZXIub3B0aW9ucy5pbnB1dENsYXNzO1xyXG5cclxuICAgIGlmIChpbnB1dENsYXNzKSB7XHJcbiAgICAgICAgVHlwZSA9IGlucHV0Q2xhc3M7XHJcbiAgICB9IGVsc2UgaWYgKFNVUFBPUlRfUE9JTlRFUl9FVkVOVFMpIHtcclxuICAgICAgICBUeXBlID0gUG9pbnRlckV2ZW50SW5wdXQ7XHJcbiAgICB9IGVsc2UgaWYgKFNVUFBPUlRfT05MWV9UT1VDSCkge1xyXG4gICAgICAgIFR5cGUgPSBUb3VjaElucHV0O1xyXG4gICAgfSBlbHNlIGlmICghU1VQUE9SVF9UT1VDSCkge1xyXG4gICAgICAgIFR5cGUgPSBNb3VzZUlucHV0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBUeXBlID0gVG91Y2hNb3VzZUlucHV0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5ldyAoVHlwZSkobWFuYWdlciwgaW5wdXRIYW5kbGVyKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGhhbmRsZSBpbnB1dCBldmVudHNcclxuICogQHBhcmFtIHtNYW5hZ2VyfSBtYW5hZ2VyXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFR5cGVcclxuICogQHBhcmFtIHtPYmplY3R9IGlucHV0XHJcbiAqL1xyXG5mdW5jdGlvbiBpbnB1dEhhbmRsZXIobWFuYWdlciwgZXZlbnRUeXBlLCBpbnB1dCkge1xyXG4gICAgdmFyIHBvaW50ZXJzTGVuID0gaW5wdXQucG9pbnRlcnMubGVuZ3RoO1xyXG4gICAgdmFyIGNoYW5nZWRQb2ludGVyc0xlbiA9IGlucHV0LmNoYW5nZWRQb2ludGVycy5sZW5ndGg7XHJcbiAgICB2YXIgaXNGaXJzdCA9IChldmVudFR5cGUgJiBJTlBVVF9TVEFSVCAmJiAocG9pbnRlcnNMZW4gLSBjaGFuZ2VkUG9pbnRlcnNMZW4gPT09IDApKTtcclxuICAgIHZhciBpc0ZpbmFsID0gKGV2ZW50VHlwZSAmIChJTlBVVF9FTkQgfCBJTlBVVF9DQU5DRUwpICYmIChwb2ludGVyc0xlbiAtIGNoYW5nZWRQb2ludGVyc0xlbiA9PT0gMCkpO1xyXG5cclxuICAgIGlucHV0LmlzRmlyc3QgPSAhIWlzRmlyc3Q7XHJcbiAgICBpbnB1dC5pc0ZpbmFsID0gISFpc0ZpbmFsO1xyXG5cclxuICAgIGlmIChpc0ZpcnN0KSB7XHJcbiAgICAgICAgbWFuYWdlci5zZXNzaW9uID0ge307XHJcbiAgICB9XHJcblxyXG4gICAgLy8gc291cmNlIGV2ZW50IGlzIHRoZSBub3JtYWxpemVkIHZhbHVlIG9mIHRoZSBkb21FdmVudHNcclxuICAgIC8vIGxpa2UgJ3RvdWNoc3RhcnQsIG1vdXNldXAsIHBvaW50ZXJkb3duJ1xyXG4gICAgaW5wdXQuZXZlbnRUeXBlID0gZXZlbnRUeXBlO1xyXG5cclxuICAgIC8vIGNvbXB1dGUgc2NhbGUsIHJvdGF0aW9uIGV0Y1xyXG4gICAgY29tcHV0ZUlucHV0RGF0YShtYW5hZ2VyLCBpbnB1dCk7XHJcblxyXG4gICAgLy8gZW1pdCBzZWNyZXQgZXZlbnRcclxuICAgIG1hbmFnZXIuZW1pdCgnaGFtbWVyLmlucHV0JywgaW5wdXQpO1xyXG5cclxuICAgIG1hbmFnZXIucmVjb2duaXplKGlucHV0KTtcclxuICAgIG1hbmFnZXIuc2Vzc2lvbi5wcmV2SW5wdXQgPSBpbnB1dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIGV4dGVuZCB0aGUgZGF0YSB3aXRoIHNvbWUgdXNhYmxlIHByb3BlcnRpZXMgbGlrZSBzY2FsZSwgcm90YXRlLCB2ZWxvY2l0eSBldGNcclxuICogQHBhcmFtIHtPYmplY3R9IG1hbmFnZXJcclxuICogQHBhcmFtIHtPYmplY3R9IGlucHV0XHJcbiAqL1xyXG5mdW5jdGlvbiBjb21wdXRlSW5wdXREYXRhKG1hbmFnZXIsIGlucHV0KSB7XHJcbiAgICB2YXIgc2Vzc2lvbiA9IG1hbmFnZXIuc2Vzc2lvbjtcclxuICAgIHZhciBwb2ludGVycyA9IGlucHV0LnBvaW50ZXJzO1xyXG4gICAgdmFyIHBvaW50ZXJzTGVuZ3RoID0gcG9pbnRlcnMubGVuZ3RoO1xyXG5cclxuICAgIC8vIHN0b3JlIHRoZSBmaXJzdCBpbnB1dCB0byBjYWxjdWxhdGUgdGhlIGRpc3RhbmNlIGFuZCBkaXJlY3Rpb25cclxuICAgIGlmICghc2Vzc2lvbi5maXJzdElucHV0KSB7XHJcbiAgICAgICAgc2Vzc2lvbi5maXJzdElucHV0ID0gc2ltcGxlQ2xvbmVJbnB1dERhdGEoaW5wdXQpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHRvIGNvbXB1dGUgc2NhbGUgYW5kIHJvdGF0aW9uIHdlIG5lZWQgdG8gc3RvcmUgdGhlIG11bHRpcGxlIHRvdWNoZXNcclxuICAgIGlmIChwb2ludGVyc0xlbmd0aCA+IDEgJiYgIXNlc3Npb24uZmlyc3RNdWx0aXBsZSkge1xyXG4gICAgICAgIHNlc3Npb24uZmlyc3RNdWx0aXBsZSA9IHNpbXBsZUNsb25lSW5wdXREYXRhKGlucHV0KTtcclxuICAgIH0gZWxzZSBpZiAocG9pbnRlcnNMZW5ndGggPT09IDEpIHtcclxuICAgICAgICBzZXNzaW9uLmZpcnN0TXVsdGlwbGUgPSBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgZmlyc3RJbnB1dCA9IHNlc3Npb24uZmlyc3RJbnB1dDtcclxuICAgIHZhciBmaXJzdE11bHRpcGxlID0gc2Vzc2lvbi5maXJzdE11bHRpcGxlO1xyXG4gICAgdmFyIG9mZnNldENlbnRlciA9IGZpcnN0TXVsdGlwbGUgPyBmaXJzdE11bHRpcGxlLmNlbnRlciA6IGZpcnN0SW5wdXQuY2VudGVyO1xyXG5cclxuICAgIHZhciBjZW50ZXIgPSBpbnB1dC5jZW50ZXIgPSBnZXRDZW50ZXIocG9pbnRlcnMpO1xyXG4gICAgaW5wdXQudGltZVN0YW1wID0gbm93KCk7XHJcbiAgICBpbnB1dC5kZWx0YVRpbWUgPSBpbnB1dC50aW1lU3RhbXAgLSBmaXJzdElucHV0LnRpbWVTdGFtcDtcclxuXHJcbiAgICBpbnB1dC5hbmdsZSA9IGdldEFuZ2xlKG9mZnNldENlbnRlciwgY2VudGVyKTtcclxuICAgIGlucHV0LmRpc3RhbmNlID0gZ2V0RGlzdGFuY2Uob2Zmc2V0Q2VudGVyLCBjZW50ZXIpO1xyXG5cclxuICAgIGNvbXB1dGVEZWx0YVhZKHNlc3Npb24sIGlucHV0KTtcclxuICAgIGlucHV0Lm9mZnNldERpcmVjdGlvbiA9IGdldERpcmVjdGlvbihpbnB1dC5kZWx0YVgsIGlucHV0LmRlbHRhWSk7XHJcblxyXG4gICAgaW5wdXQuc2NhbGUgPSBmaXJzdE11bHRpcGxlID8gZ2V0U2NhbGUoZmlyc3RNdWx0aXBsZS5wb2ludGVycywgcG9pbnRlcnMpIDogMTtcclxuICAgIGlucHV0LnJvdGF0aW9uID0gZmlyc3RNdWx0aXBsZSA/IGdldFJvdGF0aW9uKGZpcnN0TXVsdGlwbGUucG9pbnRlcnMsIHBvaW50ZXJzKSA6IDA7XHJcblxyXG4gICAgY29tcHV0ZUludGVydmFsSW5wdXREYXRhKHNlc3Npb24sIGlucHV0KTtcclxuXHJcbiAgICAvLyBmaW5kIHRoZSBjb3JyZWN0IHRhcmdldFxyXG4gICAgdmFyIHRhcmdldCA9IG1hbmFnZXIuZWxlbWVudDtcclxuICAgIGlmIChoYXNQYXJlbnQoaW5wdXQuc3JjRXZlbnQudGFyZ2V0LCB0YXJnZXQpKSB7XHJcbiAgICAgICAgdGFyZ2V0ID0gaW5wdXQuc3JjRXZlbnQudGFyZ2V0O1xyXG4gICAgfVxyXG4gICAgaW5wdXQudGFyZ2V0ID0gdGFyZ2V0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBjb21wdXRlRGVsdGFYWShzZXNzaW9uLCBpbnB1dCkge1xyXG4gICAgdmFyIGNlbnRlciA9IGlucHV0LmNlbnRlcjtcclxuICAgIHZhciBvZmZzZXQgPSBzZXNzaW9uLm9mZnNldERlbHRhIHx8IHt9O1xyXG4gICAgdmFyIHByZXZEZWx0YSA9IHNlc3Npb24ucHJldkRlbHRhIHx8IHt9O1xyXG4gICAgdmFyIHByZXZJbnB1dCA9IHNlc3Npb24ucHJldklucHV0IHx8IHt9O1xyXG5cclxuICAgIGlmIChpbnB1dC5ldmVudFR5cGUgPT09IElOUFVUX1NUQVJUIHx8IHByZXZJbnB1dC5ldmVudFR5cGUgPT09IElOUFVUX0VORCkge1xyXG4gICAgICAgIHByZXZEZWx0YSA9IHNlc3Npb24ucHJldkRlbHRhID0ge1xyXG4gICAgICAgICAgICB4OiBwcmV2SW5wdXQuZGVsdGFYIHx8IDAsXHJcbiAgICAgICAgICAgIHk6IHByZXZJbnB1dC5kZWx0YVkgfHwgMFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIG9mZnNldCA9IHNlc3Npb24ub2Zmc2V0RGVsdGEgPSB7XHJcbiAgICAgICAgICAgIHg6IGNlbnRlci54LFxyXG4gICAgICAgICAgICB5OiBjZW50ZXIueVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgaW5wdXQuZGVsdGFYID0gcHJldkRlbHRhLnggKyAoY2VudGVyLnggLSBvZmZzZXQueCk7XHJcbiAgICBpbnB1dC5kZWx0YVkgPSBwcmV2RGVsdGEueSArIChjZW50ZXIueSAtIG9mZnNldC55KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHZlbG9jaXR5IGlzIGNhbGN1bGF0ZWQgZXZlcnkgeCBtc1xyXG4gKiBAcGFyYW0ge09iamVjdH0gc2Vzc2lvblxyXG4gKiBAcGFyYW0ge09iamVjdH0gaW5wdXRcclxuICovXHJcbmZ1bmN0aW9uIGNvbXB1dGVJbnRlcnZhbElucHV0RGF0YShzZXNzaW9uLCBpbnB1dCkge1xyXG4gICAgdmFyIGxhc3QgPSBzZXNzaW9uLmxhc3RJbnRlcnZhbCB8fCBpbnB1dCxcclxuICAgICAgICBkZWx0YVRpbWUgPSBpbnB1dC50aW1lU3RhbXAgLSBsYXN0LnRpbWVTdGFtcCxcclxuICAgICAgICB2ZWxvY2l0eSwgdmVsb2NpdHlYLCB2ZWxvY2l0eVksIGRpcmVjdGlvbjtcclxuXHJcbiAgICBpZiAoaW5wdXQuZXZlbnRUeXBlICE9IElOUFVUX0NBTkNFTCAmJiAoZGVsdGFUaW1lID4gQ09NUFVURV9JTlRFUlZBTCB8fCBsYXN0LnZlbG9jaXR5ID09PSB1bmRlZmluZWQpKSB7XHJcbiAgICAgICAgdmFyIGRlbHRhWCA9IGxhc3QuZGVsdGFYIC0gaW5wdXQuZGVsdGFYO1xyXG4gICAgICAgIHZhciBkZWx0YVkgPSBsYXN0LmRlbHRhWSAtIGlucHV0LmRlbHRhWTtcclxuXHJcbiAgICAgICAgdmFyIHYgPSBnZXRWZWxvY2l0eShkZWx0YVRpbWUsIGRlbHRhWCwgZGVsdGFZKTtcclxuICAgICAgICB2ZWxvY2l0eVggPSB2Lng7XHJcbiAgICAgICAgdmVsb2NpdHlZID0gdi55O1xyXG4gICAgICAgIHZlbG9jaXR5ID0gKGFicyh2LngpID4gYWJzKHYueSkpID8gdi54IDogdi55O1xyXG4gICAgICAgIGRpcmVjdGlvbiA9IGdldERpcmVjdGlvbihkZWx0YVgsIGRlbHRhWSk7XHJcblxyXG4gICAgICAgIHNlc3Npb24ubGFzdEludGVydmFsID0gaW5wdXQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIHVzZSBsYXRlc3QgdmVsb2NpdHkgaW5mbyBpZiBpdCBkb2Vzbid0IG92ZXJ0YWtlIGEgbWluaW11bSBwZXJpb2RcclxuICAgICAgICB2ZWxvY2l0eSA9IGxhc3QudmVsb2NpdHk7XHJcbiAgICAgICAgdmVsb2NpdHlYID0gbGFzdC52ZWxvY2l0eVg7XHJcbiAgICAgICAgdmVsb2NpdHlZID0gbGFzdC52ZWxvY2l0eVk7XHJcbiAgICAgICAgZGlyZWN0aW9uID0gbGFzdC5kaXJlY3Rpb247XHJcbiAgICB9XHJcblxyXG4gICAgaW5wdXQudmVsb2NpdHkgPSB2ZWxvY2l0eTtcclxuICAgIGlucHV0LnZlbG9jaXR5WCA9IHZlbG9jaXR5WDtcclxuICAgIGlucHV0LnZlbG9jaXR5WSA9IHZlbG9jaXR5WTtcclxuICAgIGlucHV0LmRpcmVjdGlvbiA9IGRpcmVjdGlvbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIGNyZWF0ZSBhIHNpbXBsZSBjbG9uZSBmcm9tIHRoZSBpbnB1dCB1c2VkIGZvciBzdG9yYWdlIG9mIGZpcnN0SW5wdXQgYW5kIGZpcnN0TXVsdGlwbGVcclxuICogQHBhcmFtIHtPYmplY3R9IGlucHV0XHJcbiAqIEByZXR1cm5zIHtPYmplY3R9IGNsb25lZElucHV0RGF0YVxyXG4gKi9cclxuZnVuY3Rpb24gc2ltcGxlQ2xvbmVJbnB1dERhdGEoaW5wdXQpIHtcclxuICAgIC8vIG1ha2UgYSBzaW1wbGUgY29weSBvZiB0aGUgcG9pbnRlcnMgYmVjYXVzZSB3ZSB3aWxsIGdldCBhIHJlZmVyZW5jZSBpZiB3ZSBkb24ndFxyXG4gICAgLy8gd2Ugb25seSBuZWVkIGNsaWVudFhZIGZvciB0aGUgY2FsY3VsYXRpb25zXHJcbiAgICB2YXIgcG9pbnRlcnMgPSBbXTtcclxuICAgIHZhciBpID0gMDtcclxuICAgIHdoaWxlIChpIDwgaW5wdXQucG9pbnRlcnMubGVuZ3RoKSB7XHJcbiAgICAgICAgcG9pbnRlcnNbaV0gPSB7XHJcbiAgICAgICAgICAgIGNsaWVudFg6IHJvdW5kKGlucHV0LnBvaW50ZXJzW2ldLmNsaWVudFgpLFxyXG4gICAgICAgICAgICBjbGllbnRZOiByb3VuZChpbnB1dC5wb2ludGVyc1tpXS5jbGllbnRZKVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgaSsrO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGltZVN0YW1wOiBub3coKSxcclxuICAgICAgICBwb2ludGVyczogcG9pbnRlcnMsXHJcbiAgICAgICAgY2VudGVyOiBnZXRDZW50ZXIocG9pbnRlcnMpLFxyXG4gICAgICAgIGRlbHRhWDogaW5wdXQuZGVsdGFYLFxyXG4gICAgICAgIGRlbHRhWTogaW5wdXQuZGVsdGFZXHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogZ2V0IHRoZSBjZW50ZXIgb2YgYWxsIHRoZSBwb2ludGVyc1xyXG4gKiBAcGFyYW0ge0FycmF5fSBwb2ludGVyc1xyXG4gKiBAcmV0dXJuIHtPYmplY3R9IGNlbnRlciBjb250YWlucyBgeGAgYW5kIGB5YCBwcm9wZXJ0aWVzXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRDZW50ZXIocG9pbnRlcnMpIHtcclxuICAgIHZhciBwb2ludGVyc0xlbmd0aCA9IHBvaW50ZXJzLmxlbmd0aDtcclxuXHJcbiAgICAvLyBubyBuZWVkIHRvIGxvb3Agd2hlbiBvbmx5IG9uZSB0b3VjaFxyXG4gICAgaWYgKHBvaW50ZXJzTGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgeDogcm91bmQocG9pbnRlcnNbMF0uY2xpZW50WCksXHJcbiAgICAgICAgICAgIHk6IHJvdW5kKHBvaW50ZXJzWzBdLmNsaWVudFkpXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgeCA9IDAsIHkgPSAwLCBpID0gMDtcclxuICAgIHdoaWxlIChpIDwgcG9pbnRlcnNMZW5ndGgpIHtcclxuICAgICAgICB4ICs9IHBvaW50ZXJzW2ldLmNsaWVudFg7XHJcbiAgICAgICAgeSArPSBwb2ludGVyc1tpXS5jbGllbnRZO1xyXG4gICAgICAgIGkrKztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHg6IHJvdW5kKHggLyBwb2ludGVyc0xlbmd0aCksXHJcbiAgICAgICAgeTogcm91bmQoeSAvIHBvaW50ZXJzTGVuZ3RoKVxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGNhbGN1bGF0ZSB0aGUgdmVsb2NpdHkgYmV0d2VlbiB0d28gcG9pbnRzLiB1bml0IGlzIGluIHB4IHBlciBtcy5cclxuICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhVGltZVxyXG4gKiBAcGFyYW0ge051bWJlcn0geFxyXG4gKiBAcGFyYW0ge051bWJlcn0geVxyXG4gKiBAcmV0dXJuIHtPYmplY3R9IHZlbG9jaXR5IGB4YCBhbmQgYHlgXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRWZWxvY2l0eShkZWx0YVRpbWUsIHgsIHkpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgeDogeCAvIGRlbHRhVGltZSB8fCAwLFxyXG4gICAgICAgIHk6IHkgLyBkZWx0YVRpbWUgfHwgMFxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGdldCB0aGUgZGlyZWN0aW9uIGJldHdlZW4gdHdvIHBvaW50c1xyXG4gKiBAcGFyYW0ge051bWJlcn0geFxyXG4gKiBAcGFyYW0ge051bWJlcn0geVxyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IGRpcmVjdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0RGlyZWN0aW9uKHgsIHkpIHtcclxuICAgIGlmICh4ID09PSB5KSB7XHJcbiAgICAgICAgcmV0dXJuIERJUkVDVElPTl9OT05FO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChhYnMoeCkgPj0gYWJzKHkpKSB7XHJcbiAgICAgICAgcmV0dXJuIHggPiAwID8gRElSRUNUSU9OX0xFRlQgOiBESVJFQ1RJT05fUklHSFQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4geSA+IDAgPyBESVJFQ1RJT05fVVAgOiBESVJFQ1RJT05fRE9XTjtcclxufVxyXG5cclxuLyoqXHJcbiAqIGNhbGN1bGF0ZSB0aGUgYWJzb2x1dGUgZGlzdGFuY2UgYmV0d2VlbiB0d28gcG9pbnRzXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBwMSB7eCwgeX1cclxuICogQHBhcmFtIHtPYmplY3R9IHAyIHt4LCB5fVxyXG4gKiBAcGFyYW0ge0FycmF5fSBbcHJvcHNdIGNvbnRhaW5pbmcgeCBhbmQgeSBrZXlzXHJcbiAqIEByZXR1cm4ge051bWJlcn0gZGlzdGFuY2VcclxuICovXHJcbmZ1bmN0aW9uIGdldERpc3RhbmNlKHAxLCBwMiwgcHJvcHMpIHtcclxuICAgIGlmICghcHJvcHMpIHtcclxuICAgICAgICBwcm9wcyA9IFBST1BTX1hZO1xyXG4gICAgfVxyXG4gICAgdmFyIHggPSBwMltwcm9wc1swXV0gLSBwMVtwcm9wc1swXV0sXHJcbiAgICAgICAgeSA9IHAyW3Byb3BzWzFdXSAtIHAxW3Byb3BzWzFdXTtcclxuXHJcbiAgICByZXR1cm4gTWF0aC5zcXJ0KCh4ICogeCkgKyAoeSAqIHkpKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGNhbGN1bGF0ZSB0aGUgYW5nbGUgYmV0d2VlbiB0d28gY29vcmRpbmF0ZXNcclxuICogQHBhcmFtIHtPYmplY3R9IHAxXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBwMlxyXG4gKiBAcGFyYW0ge0FycmF5fSBbcHJvcHNdIGNvbnRhaW5pbmcgeCBhbmQgeSBrZXlzXHJcbiAqIEByZXR1cm4ge051bWJlcn0gYW5nbGVcclxuICovXHJcbmZ1bmN0aW9uIGdldEFuZ2xlKHAxLCBwMiwgcHJvcHMpIHtcclxuICAgIGlmICghcHJvcHMpIHtcclxuICAgICAgICBwcm9wcyA9IFBST1BTX1hZO1xyXG4gICAgfVxyXG4gICAgdmFyIHggPSBwMltwcm9wc1swXV0gLSBwMVtwcm9wc1swXV0sXHJcbiAgICAgICAgeSA9IHAyW3Byb3BzWzFdXSAtIHAxW3Byb3BzWzFdXTtcclxuICAgIHJldHVybiBNYXRoLmF0YW4yKHksIHgpICogMTgwIC8gTWF0aC5QSTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGNhbGN1bGF0ZSB0aGUgcm90YXRpb24gZGVncmVlcyBiZXR3ZWVuIHR3byBwb2ludGVyc2V0c1xyXG4gKiBAcGFyYW0ge0FycmF5fSBzdGFydCBhcnJheSBvZiBwb2ludGVyc1xyXG4gKiBAcGFyYW0ge0FycmF5fSBlbmQgYXJyYXkgb2YgcG9pbnRlcnNcclxuICogQHJldHVybiB7TnVtYmVyfSByb3RhdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0Um90YXRpb24oc3RhcnQsIGVuZCkge1xyXG4gICAgcmV0dXJuIGdldEFuZ2xlKGVuZFsxXSwgZW5kWzBdLCBQUk9QU19DTElFTlRfWFkpIC0gZ2V0QW5nbGUoc3RhcnRbMV0sIHN0YXJ0WzBdLCBQUk9QU19DTElFTlRfWFkpO1xyXG59XHJcblxyXG4vKipcclxuICogY2FsY3VsYXRlIHRoZSBzY2FsZSBmYWN0b3IgYmV0d2VlbiB0d28gcG9pbnRlcnNldHNcclxuICogbm8gc2NhbGUgaXMgMSwgYW5kIGdvZXMgZG93biB0byAwIHdoZW4gcGluY2hlZCB0b2dldGhlciwgYW5kIGJpZ2dlciB3aGVuIHBpbmNoZWQgb3V0XHJcbiAqIEBwYXJhbSB7QXJyYXl9IHN0YXJ0IGFycmF5IG9mIHBvaW50ZXJzXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGVuZCBhcnJheSBvZiBwb2ludGVyc1xyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IHNjYWxlXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRTY2FsZShzdGFydCwgZW5kKSB7XHJcbiAgICByZXR1cm4gZ2V0RGlzdGFuY2UoZW5kWzBdLCBlbmRbMV0sIFBST1BTX0NMSUVOVF9YWSkgLyBnZXREaXN0YW5jZShzdGFydFswXSwgc3RhcnRbMV0sIFBST1BTX0NMSUVOVF9YWSk7XHJcbn1cclxuXHJcbnZhciBNT1VTRV9JTlBVVF9NQVAgPSB7XHJcbiAgICBtb3VzZWRvd246IElOUFVUX1NUQVJULFxyXG4gICAgbW91c2Vtb3ZlOiBJTlBVVF9NT1ZFLFxyXG4gICAgbW91c2V1cDogSU5QVVRfRU5EXHJcbn07XHJcblxyXG52YXIgTU9VU0VfRUxFTUVOVF9FVkVOVFMgPSAnbW91c2Vkb3duJztcclxudmFyIE1PVVNFX1dJTkRPV19FVkVOVFMgPSAnbW91c2Vtb3ZlIG1vdXNldXAnO1xyXG5cclxuLyoqXHJcbiAqIE1vdXNlIGV2ZW50cyBpbnB1dFxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgSW5wdXRcclxuICovXHJcbmZ1bmN0aW9uIE1vdXNlSW5wdXQoKSB7XHJcbiAgICB0aGlzLmV2RWwgPSBNT1VTRV9FTEVNRU5UX0VWRU5UUztcclxuICAgIHRoaXMuZXZXaW4gPSBNT1VTRV9XSU5ET1dfRVZFTlRTO1xyXG5cclxuICAgIHRoaXMuYWxsb3cgPSB0cnVlOyAvLyB1c2VkIGJ5IElucHV0LlRvdWNoTW91c2UgdG8gZGlzYWJsZSBtb3VzZSBldmVudHNcclxuICAgIHRoaXMucHJlc3NlZCA9IGZhbHNlOyAvLyBtb3VzZWRvd24gc3RhdGVcclxuXHJcbiAgICBJbnB1dC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5pbmhlcml0KE1vdXNlSW5wdXQsIElucHV0LCB7XHJcbiAgICAvKipcclxuICAgICAqIGhhbmRsZSBtb3VzZSBldmVudHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBldlxyXG4gICAgICovXHJcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiBNRWhhbmRsZXIoZXYpIHtcclxuICAgICAgICB2YXIgZXZlbnRUeXBlID0gTU9VU0VfSU5QVVRfTUFQW2V2LnR5cGVdO1xyXG5cclxuICAgICAgICAvLyBvbiBzdGFydCB3ZSB3YW50IHRvIGhhdmUgdGhlIGxlZnQgbW91c2UgYnV0dG9uIGRvd25cclxuICAgICAgICBpZiAoZXZlbnRUeXBlICYgSU5QVVRfU1RBUlQgJiYgZXYuYnV0dG9uID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHJlc3NlZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZXZlbnRUeXBlICYgSU5QVVRfTU9WRSAmJiBldi53aGljaCAhPT0gMSkge1xyXG4gICAgICAgICAgICBldmVudFR5cGUgPSBJTlBVVF9FTkQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBtb3VzZSBtdXN0IGJlIGRvd24sIGFuZCBtb3VzZSBldmVudHMgYXJlIGFsbG93ZWQgKHNlZSB0aGUgVG91Y2hNb3VzZSBpbnB1dClcclxuICAgICAgICBpZiAoIXRoaXMucHJlc3NlZCB8fCAhdGhpcy5hbGxvdykge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZXZlbnRUeXBlICYgSU5QVVRfRU5EKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHJlc3NlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jYWxsYmFjayh0aGlzLm1hbmFnZXIsIGV2ZW50VHlwZSwge1xyXG4gICAgICAgICAgICBwb2ludGVyczogW2V2XSxcclxuICAgICAgICAgICAgY2hhbmdlZFBvaW50ZXJzOiBbZXZdLFxyXG4gICAgICAgICAgICBwb2ludGVyVHlwZTogSU5QVVRfVFlQRV9NT1VTRSxcclxuICAgICAgICAgICAgc3JjRXZlbnQ6IGV2XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIFBPSU5URVJfSU5QVVRfTUFQID0ge1xyXG4gICAgcG9pbnRlcmRvd246IElOUFVUX1NUQVJULFxyXG4gICAgcG9pbnRlcm1vdmU6IElOUFVUX01PVkUsXHJcbiAgICBwb2ludGVydXA6IElOUFVUX0VORCxcclxuICAgIHBvaW50ZXJjYW5jZWw6IElOUFVUX0NBTkNFTCxcclxuICAgIHBvaW50ZXJvdXQ6IElOUFVUX0NBTkNFTFxyXG59O1xyXG5cclxuLy8gaW4gSUUxMCB0aGUgcG9pbnRlciB0eXBlcyBpcyBkZWZpbmVkIGFzIGFuIGVudW1cclxudmFyIElFMTBfUE9JTlRFUl9UWVBFX0VOVU0gPSB7XHJcbiAgICAyOiBJTlBVVF9UWVBFX1RPVUNILFxyXG4gICAgMzogSU5QVVRfVFlQRV9QRU4sXHJcbiAgICA0OiBJTlBVVF9UWVBFX01PVVNFLFxyXG4gICAgNTogSU5QVVRfVFlQRV9LSU5FQ1QgLy8gc2VlIGh0dHBzOi8vdHdpdHRlci5jb20vamFjb2Jyb3NzaS9zdGF0dXMvNDgwNTk2NDM4NDg5ODkwODE2XHJcbn07XHJcblxyXG52YXIgUE9JTlRFUl9FTEVNRU5UX0VWRU5UUyA9ICdwb2ludGVyZG93bic7XHJcbnZhciBQT0lOVEVSX1dJTkRPV19FVkVOVFMgPSAncG9pbnRlcm1vdmUgcG9pbnRlcnVwIHBvaW50ZXJjYW5jZWwnO1xyXG5cclxuLy8gSUUxMCBoYXMgcHJlZml4ZWQgc3VwcG9ydCwgYW5kIGNhc2Utc2Vuc2l0aXZlXHJcbmlmICh3aW5kb3cuTVNQb2ludGVyRXZlbnQpIHtcclxuICAgIFBPSU5URVJfRUxFTUVOVF9FVkVOVFMgPSAnTVNQb2ludGVyRG93bic7XHJcbiAgICBQT0lOVEVSX1dJTkRPV19FVkVOVFMgPSAnTVNQb2ludGVyTW92ZSBNU1BvaW50ZXJVcCBNU1BvaW50ZXJDYW5jZWwnO1xyXG59XHJcblxyXG4vKipcclxuICogUG9pbnRlciBldmVudHMgaW5wdXRcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIElucHV0XHJcbiAqL1xyXG5mdW5jdGlvbiBQb2ludGVyRXZlbnRJbnB1dCgpIHtcclxuICAgIHRoaXMuZXZFbCA9IFBPSU5URVJfRUxFTUVOVF9FVkVOVFM7XHJcbiAgICB0aGlzLmV2V2luID0gUE9JTlRFUl9XSU5ET1dfRVZFTlRTO1xyXG5cclxuICAgIElucHV0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblxyXG4gICAgdGhpcy5zdG9yZSA9ICh0aGlzLm1hbmFnZXIuc2Vzc2lvbi5wb2ludGVyRXZlbnRzID0gW10pO1xyXG59XHJcblxyXG5pbmhlcml0KFBvaW50ZXJFdmVudElucHV0LCBJbnB1dCwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBoYW5kbGUgbW91c2UgZXZlbnRzXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZXZcclxuICAgICAqL1xyXG4gICAgaGFuZGxlcjogZnVuY3Rpb24gUEVoYW5kbGVyKGV2KSB7XHJcbiAgICAgICAgdmFyIHN0b3JlID0gdGhpcy5zdG9yZTtcclxuICAgICAgICB2YXIgcmVtb3ZlUG9pbnRlciA9IGZhbHNlO1xyXG5cclxuICAgICAgICB2YXIgZXZlbnRUeXBlTm9ybWFsaXplZCA9IGV2LnR5cGUudG9Mb3dlckNhc2UoKS5yZXBsYWNlKCdtcycsICcnKTtcclxuICAgICAgICB2YXIgZXZlbnRUeXBlID0gUE9JTlRFUl9JTlBVVF9NQVBbZXZlbnRUeXBlTm9ybWFsaXplZF07XHJcbiAgICAgICAgdmFyIHBvaW50ZXJUeXBlID0gSUUxMF9QT0lOVEVSX1RZUEVfRU5VTVtldi5wb2ludGVyVHlwZV0gfHwgZXYucG9pbnRlclR5cGU7XHJcblxyXG4gICAgICAgIHZhciBpc1RvdWNoID0gKHBvaW50ZXJUeXBlID09IElOUFVUX1RZUEVfVE9VQ0gpO1xyXG5cclxuICAgICAgICAvLyBnZXQgaW5kZXggb2YgdGhlIGV2ZW50IGluIHRoZSBzdG9yZVxyXG4gICAgICAgIHZhciBzdG9yZUluZGV4ID0gaW5BcnJheShzdG9yZSwgZXYucG9pbnRlcklkLCAncG9pbnRlcklkJyk7XHJcblxyXG4gICAgICAgIC8vIHN0YXJ0IGFuZCBtb3VzZSBtdXN0IGJlIGRvd25cclxuICAgICAgICBpZiAoZXZlbnRUeXBlICYgSU5QVVRfU1RBUlQgJiYgKGV2LmJ1dHRvbiA9PT0gMCB8fCBpc1RvdWNoKSkge1xyXG4gICAgICAgICAgICBpZiAoc3RvcmVJbmRleCA8IDApIHtcclxuICAgICAgICAgICAgICAgIHN0b3JlLnB1c2goZXYpO1xyXG4gICAgICAgICAgICAgICAgc3RvcmVJbmRleCA9IHN0b3JlLmxlbmd0aCAtIDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgaWYgKGV2ZW50VHlwZSAmIChJTlBVVF9FTkQgfCBJTlBVVF9DQU5DRUwpKSB7XHJcbiAgICAgICAgICAgIHJlbW92ZVBvaW50ZXIgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gaXQgbm90IGZvdW5kLCBzbyB0aGUgcG9pbnRlciBoYXNuJ3QgYmVlbiBkb3duIChzbyBpdCdzIHByb2JhYmx5IGEgaG92ZXIpXHJcbiAgICAgICAgaWYgKHN0b3JlSW5kZXggPCAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgZXZlbnQgaW4gdGhlIHN0b3JlXHJcbiAgICAgICAgc3RvcmVbc3RvcmVJbmRleF0gPSBldjtcclxuXHJcbiAgICAgICAgdGhpcy5jYWxsYmFjayh0aGlzLm1hbmFnZXIsIGV2ZW50VHlwZSwge1xyXG4gICAgICAgICAgICBwb2ludGVyczogc3RvcmUsXHJcbiAgICAgICAgICAgIGNoYW5nZWRQb2ludGVyczogW2V2XSxcclxuICAgICAgICAgICAgcG9pbnRlclR5cGU6IHBvaW50ZXJUeXBlLFxyXG4gICAgICAgICAgICBzcmNFdmVudDogZXZcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKHJlbW92ZVBvaW50ZXIpIHtcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gdGhlIHN0b3JlXHJcbiAgICAgICAgICAgIHN0b3JlLnNwbGljZShzdG9yZUluZGV4LCAxKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIFNJTkdMRV9UT1VDSF9JTlBVVF9NQVAgPSB7XHJcbiAgICB0b3VjaHN0YXJ0OiBJTlBVVF9TVEFSVCxcclxuICAgIHRvdWNobW92ZTogSU5QVVRfTU9WRSxcclxuICAgIHRvdWNoZW5kOiBJTlBVVF9FTkQsXHJcbiAgICB0b3VjaGNhbmNlbDogSU5QVVRfQ0FOQ0VMXHJcbn07XHJcblxyXG52YXIgU0lOR0xFX1RPVUNIX1RBUkdFVF9FVkVOVFMgPSAndG91Y2hzdGFydCc7XHJcbnZhciBTSU5HTEVfVE9VQ0hfV0lORE9XX0VWRU5UUyA9ICd0b3VjaHN0YXJ0IHRvdWNobW92ZSB0b3VjaGVuZCB0b3VjaGNhbmNlbCc7XHJcblxyXG4vKipcclxuICogVG91Y2ggZXZlbnRzIGlucHV0XHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBJbnB1dFxyXG4gKi9cclxuZnVuY3Rpb24gU2luZ2xlVG91Y2hJbnB1dCgpIHtcclxuICAgIHRoaXMuZXZUYXJnZXQgPSBTSU5HTEVfVE9VQ0hfVEFSR0VUX0VWRU5UUztcclxuICAgIHRoaXMuZXZXaW4gPSBTSU5HTEVfVE9VQ0hfV0lORE9XX0VWRU5UUztcclxuICAgIHRoaXMuc3RhcnRlZCA9IGZhbHNlO1xyXG5cclxuICAgIElucHV0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmluaGVyaXQoU2luZ2xlVG91Y2hJbnB1dCwgSW5wdXQsIHtcclxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uIFRFaGFuZGxlcihldikge1xyXG4gICAgICAgIHZhciB0eXBlID0gU0lOR0xFX1RPVUNIX0lOUFVUX01BUFtldi50eXBlXTtcclxuXHJcbiAgICAgICAgLy8gc2hvdWxkIHdlIGhhbmRsZSB0aGUgdG91Y2ggZXZlbnRzP1xyXG4gICAgICAgIGlmICh0eXBlID09PSBJTlBVVF9TVEFSVCkge1xyXG4gICAgICAgICAgICB0aGlzLnN0YXJ0ZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLnN0YXJ0ZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHRvdWNoZXMgPSBub3JtYWxpemVTaW5nbGVUb3VjaGVzLmNhbGwodGhpcywgZXYsIHR5cGUpO1xyXG5cclxuICAgICAgICAvLyB3aGVuIGRvbmUsIHJlc2V0IHRoZSBzdGFydGVkIHN0YXRlXHJcbiAgICAgICAgaWYgKHR5cGUgJiAoSU5QVVRfRU5EIHwgSU5QVVRfQ0FOQ0VMKSAmJiB0b3VjaGVzWzBdLmxlbmd0aCAtIHRvdWNoZXNbMV0ubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhcnRlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jYWxsYmFjayh0aGlzLm1hbmFnZXIsIHR5cGUsIHtcclxuICAgICAgICAgICAgcG9pbnRlcnM6IHRvdWNoZXNbMF0sXHJcbiAgICAgICAgICAgIGNoYW5nZWRQb2ludGVyczogdG91Y2hlc1sxXSxcclxuICAgICAgICAgICAgcG9pbnRlclR5cGU6IElOUFVUX1RZUEVfVE9VQ0gsXHJcbiAgICAgICAgICAgIHNyY0V2ZW50OiBldlxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBAdGhpcyB7VG91Y2hJbnB1dH1cclxuICogQHBhcmFtIHtPYmplY3R9IGV2XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB0eXBlIGZsYWdcclxuICogQHJldHVybnMge3VuZGVmaW5lZHxBcnJheX0gW2FsbCwgY2hhbmdlZF1cclxuICovXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZVNpbmdsZVRvdWNoZXMoZXYsIHR5cGUpIHtcclxuICAgIHZhciBhbGwgPSB0b0FycmF5KGV2LnRvdWNoZXMpO1xyXG4gICAgdmFyIGNoYW5nZWQgPSB0b0FycmF5KGV2LmNoYW5nZWRUb3VjaGVzKTtcclxuXHJcbiAgICBpZiAodHlwZSAmIChJTlBVVF9FTkQgfCBJTlBVVF9DQU5DRUwpKSB7XHJcbiAgICAgICAgYWxsID0gdW5pcXVlQXJyYXkoYWxsLmNvbmNhdChjaGFuZ2VkKSwgJ2lkZW50aWZpZXInLCB0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gW2FsbCwgY2hhbmdlZF07XHJcbn1cclxuXHJcbnZhciBUT1VDSF9JTlBVVF9NQVAgPSB7XHJcbiAgICB0b3VjaHN0YXJ0OiBJTlBVVF9TVEFSVCxcclxuICAgIHRvdWNobW92ZTogSU5QVVRfTU9WRSxcclxuICAgIHRvdWNoZW5kOiBJTlBVVF9FTkQsXHJcbiAgICB0b3VjaGNhbmNlbDogSU5QVVRfQ0FOQ0VMXHJcbn07XHJcblxyXG52YXIgVE9VQ0hfVEFSR0VUX0VWRU5UUyA9ICd0b3VjaHN0YXJ0IHRvdWNobW92ZSB0b3VjaGVuZCB0b3VjaGNhbmNlbCc7XHJcblxyXG4vKipcclxuICogTXVsdGktdXNlciB0b3VjaCBldmVudHMgaW5wdXRcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIElucHV0XHJcbiAqL1xyXG5mdW5jdGlvbiBUb3VjaElucHV0KCkge1xyXG4gICAgdGhpcy5ldlRhcmdldCA9IFRPVUNIX1RBUkdFVF9FVkVOVFM7XHJcbiAgICB0aGlzLnRhcmdldElkcyA9IHt9O1xyXG5cclxuICAgIElucHV0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmluaGVyaXQoVG91Y2hJbnB1dCwgSW5wdXQsIHtcclxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uIE1URWhhbmRsZXIoZXYpIHtcclxuICAgICAgICB2YXIgdHlwZSA9IFRPVUNIX0lOUFVUX01BUFtldi50eXBlXTtcclxuICAgICAgICB2YXIgdG91Y2hlcyA9IGdldFRvdWNoZXMuY2FsbCh0aGlzLCBldiwgdHlwZSk7XHJcbiAgICAgICAgaWYgKCF0b3VjaGVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY2FsbGJhY2sodGhpcy5tYW5hZ2VyLCB0eXBlLCB7XHJcbiAgICAgICAgICAgIHBvaW50ZXJzOiB0b3VjaGVzWzBdLFxyXG4gICAgICAgICAgICBjaGFuZ2VkUG9pbnRlcnM6IHRvdWNoZXNbMV0sXHJcbiAgICAgICAgICAgIHBvaW50ZXJUeXBlOiBJTlBVVF9UWVBFX1RPVUNILFxyXG4gICAgICAgICAgICBzcmNFdmVudDogZXZcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogQHRoaXMge1RvdWNoSW5wdXR9XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBldlxyXG4gKiBAcGFyYW0ge051bWJlcn0gdHlwZSBmbGFnXHJcbiAqIEByZXR1cm5zIHt1bmRlZmluZWR8QXJyYXl9IFthbGwsIGNoYW5nZWRdXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRUb3VjaGVzKGV2LCB0eXBlKSB7XHJcbiAgICB2YXIgYWxsVG91Y2hlcyA9IHRvQXJyYXkoZXYudG91Y2hlcyk7XHJcbiAgICB2YXIgdGFyZ2V0SWRzID0gdGhpcy50YXJnZXRJZHM7XHJcblxyXG4gICAgLy8gd2hlbiB0aGVyZSBpcyBvbmx5IG9uZSB0b3VjaCwgdGhlIHByb2Nlc3MgY2FuIGJlIHNpbXBsaWZpZWRcclxuICAgIGlmICh0eXBlICYgKElOUFVUX1NUQVJUIHwgSU5QVVRfTU9WRSkgJiYgYWxsVG91Y2hlcy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICB0YXJnZXRJZHNbYWxsVG91Y2hlc1swXS5pZGVudGlmaWVyXSA9IHRydWU7XHJcbiAgICAgICAgcmV0dXJuIFthbGxUb3VjaGVzLCBhbGxUb3VjaGVzXTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgaSxcclxuICAgICAgICB0YXJnZXRUb3VjaGVzLFxyXG4gICAgICAgIGNoYW5nZWRUb3VjaGVzID0gdG9BcnJheShldi5jaGFuZ2VkVG91Y2hlcyksXHJcbiAgICAgICAgY2hhbmdlZFRhcmdldFRvdWNoZXMgPSBbXSxcclxuICAgICAgICB0YXJnZXQgPSB0aGlzLnRhcmdldDtcclxuXHJcbiAgICAvLyBnZXQgdGFyZ2V0IHRvdWNoZXMgZnJvbSB0b3VjaGVzXHJcbiAgICB0YXJnZXRUb3VjaGVzID0gYWxsVG91Y2hlcy5maWx0ZXIoZnVuY3Rpb24odG91Y2gpIHtcclxuICAgICAgICByZXR1cm4gaGFzUGFyZW50KHRvdWNoLnRhcmdldCwgdGFyZ2V0KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGNvbGxlY3QgdG91Y2hlc1xyXG4gICAgaWYgKHR5cGUgPT09IElOUFVUX1NUQVJUKSB7XHJcbiAgICAgICAgaSA9IDA7XHJcbiAgICAgICAgd2hpbGUgKGkgPCB0YXJnZXRUb3VjaGVzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICB0YXJnZXRJZHNbdGFyZ2V0VG91Y2hlc1tpXS5pZGVudGlmaWVyXSA9IHRydWU7XHJcbiAgICAgICAgICAgIGkrKztcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZmlsdGVyIGNoYW5nZWQgdG91Y2hlcyB0byBvbmx5IGNvbnRhaW4gdG91Y2hlcyB0aGF0IGV4aXN0IGluIHRoZSBjb2xsZWN0ZWQgdGFyZ2V0IGlkc1xyXG4gICAgaSA9IDA7XHJcbiAgICB3aGlsZSAoaSA8IGNoYW5nZWRUb3VjaGVzLmxlbmd0aCkge1xyXG4gICAgICAgIGlmICh0YXJnZXRJZHNbY2hhbmdlZFRvdWNoZXNbaV0uaWRlbnRpZmllcl0pIHtcclxuICAgICAgICAgICAgY2hhbmdlZFRhcmdldFRvdWNoZXMucHVzaChjaGFuZ2VkVG91Y2hlc1tpXSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBjbGVhbnVwIHJlbW92ZWQgdG91Y2hlc1xyXG4gICAgICAgIGlmICh0eXBlICYgKElOUFVUX0VORCB8IElOUFVUX0NBTkNFTCkpIHtcclxuICAgICAgICAgICAgZGVsZXRlIHRhcmdldElkc1tjaGFuZ2VkVG91Y2hlc1tpXS5pZGVudGlmaWVyXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaSsrO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghY2hhbmdlZFRhcmdldFRvdWNoZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBbXHJcbiAgICAgICAgLy8gbWVyZ2UgdGFyZ2V0VG91Y2hlcyB3aXRoIGNoYW5nZWRUYXJnZXRUb3VjaGVzIHNvIGl0IGNvbnRhaW5zIEFMTCB0b3VjaGVzLCBpbmNsdWRpbmcgJ2VuZCcgYW5kICdjYW5jZWwnXHJcbiAgICAgICAgdW5pcXVlQXJyYXkodGFyZ2V0VG91Y2hlcy5jb25jYXQoY2hhbmdlZFRhcmdldFRvdWNoZXMpLCAnaWRlbnRpZmllcicsIHRydWUpLFxyXG4gICAgICAgIGNoYW5nZWRUYXJnZXRUb3VjaGVzXHJcbiAgICBdO1xyXG59XHJcblxyXG4vKipcclxuICogQ29tYmluZWQgdG91Y2ggYW5kIG1vdXNlIGlucHV0XHJcbiAqXHJcbiAqIFRvdWNoIGhhcyBhIGhpZ2hlciBwcmlvcml0eSB0aGVuIG1vdXNlLCBhbmQgd2hpbGUgdG91Y2hpbmcgbm8gbW91c2UgZXZlbnRzIGFyZSBhbGxvd2VkLlxyXG4gKiBUaGlzIGJlY2F1c2UgdG91Y2ggZGV2aWNlcyBhbHNvIGVtaXQgbW91c2UgZXZlbnRzIHdoaWxlIGRvaW5nIGEgdG91Y2guXHJcbiAqXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBJbnB1dFxyXG4gKi9cclxuZnVuY3Rpb24gVG91Y2hNb3VzZUlucHV0KCkge1xyXG4gICAgSW5wdXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHJcbiAgICB2YXIgaGFuZGxlciA9IGJpbmRGbih0aGlzLmhhbmRsZXIsIHRoaXMpO1xyXG4gICAgdGhpcy50b3VjaCA9IG5ldyBUb3VjaElucHV0KHRoaXMubWFuYWdlciwgaGFuZGxlcik7XHJcbiAgICB0aGlzLm1vdXNlID0gbmV3IE1vdXNlSW5wdXQodGhpcy5tYW5hZ2VyLCBoYW5kbGVyKTtcclxufVxyXG5cclxuaW5oZXJpdChUb3VjaE1vdXNlSW5wdXQsIElucHV0LCB7XHJcbiAgICAvKipcclxuICAgICAqIGhhbmRsZSBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzXHJcbiAgICAgKiBAcGFyYW0ge0hhbW1lcn0gbWFuYWdlclxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGlucHV0RXZlbnRcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dERhdGFcclxuICAgICAqL1xyXG4gICAgaGFuZGxlcjogZnVuY3Rpb24gVE1FaGFuZGxlcihtYW5hZ2VyLCBpbnB1dEV2ZW50LCBpbnB1dERhdGEpIHtcclxuICAgICAgICB2YXIgaXNUb3VjaCA9IChpbnB1dERhdGEucG9pbnRlclR5cGUgPT0gSU5QVVRfVFlQRV9UT1VDSCksXHJcbiAgICAgICAgICAgIGlzTW91c2UgPSAoaW5wdXREYXRhLnBvaW50ZXJUeXBlID09IElOUFVUX1RZUEVfTU9VU0UpO1xyXG5cclxuICAgICAgICAvLyB3aGVuIHdlJ3JlIGluIGEgdG91Y2ggZXZlbnQsIHNvICBibG9jayBhbGwgdXBjb21pbmcgbW91c2UgZXZlbnRzXHJcbiAgICAgICAgLy8gbW9zdCBtb2JpbGUgYnJvd3NlciBhbHNvIGVtaXQgbW91c2VldmVudHMsIHJpZ2h0IGFmdGVyIHRvdWNoc3RhcnRcclxuICAgICAgICBpZiAoaXNUb3VjaCkge1xyXG4gICAgICAgICAgICB0aGlzLm1vdXNlLmFsbG93ID0gZmFsc2U7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpc01vdXNlICYmICF0aGlzLm1vdXNlLmFsbG93KSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJlc2V0IHRoZSBhbGxvd01vdXNlIHdoZW4gd2UncmUgZG9uZVxyXG4gICAgICAgIGlmIChpbnB1dEV2ZW50ICYgKElOUFVUX0VORCB8IElOUFVUX0NBTkNFTCkpIHtcclxuICAgICAgICAgICAgdGhpcy5tb3VzZS5hbGxvdyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmNhbGxiYWNrKG1hbmFnZXIsIGlucHV0RXZlbnQsIGlucHV0RGF0YSk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmVtb3ZlIHRoZSBldmVudCBsaXN0ZW5lcnNcclxuICAgICAqL1xyXG4gICAgZGVzdHJveTogZnVuY3Rpb24gZGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLnRvdWNoLmRlc3Ryb3koKTtcclxuICAgICAgICB0aGlzLm1vdXNlLmRlc3Ryb3koKTtcclxuICAgIH1cclxufSk7XHJcblxyXG52YXIgUFJFRklYRURfVE9VQ0hfQUNUSU9OID0gcHJlZml4ZWQoVEVTVF9FTEVNRU5ULnN0eWxlLCAndG91Y2hBY3Rpb24nKTtcclxudmFyIE5BVElWRV9UT1VDSF9BQ1RJT04gPSBQUkVGSVhFRF9UT1VDSF9BQ1RJT04gIT09IHVuZGVmaW5lZDtcclxuXHJcbi8vIG1hZ2ljYWwgdG91Y2hBY3Rpb24gdmFsdWVcclxudmFyIFRPVUNIX0FDVElPTl9DT01QVVRFID0gJ2NvbXB1dGUnO1xyXG52YXIgVE9VQ0hfQUNUSU9OX0FVVE8gPSAnYXV0byc7XHJcbnZhciBUT1VDSF9BQ1RJT05fTUFOSVBVTEFUSU9OID0gJ21hbmlwdWxhdGlvbic7IC8vIG5vdCBpbXBsZW1lbnRlZFxyXG52YXIgVE9VQ0hfQUNUSU9OX05PTkUgPSAnbm9uZSc7XHJcbnZhciBUT1VDSF9BQ1RJT05fUEFOX1ggPSAncGFuLXgnO1xyXG52YXIgVE9VQ0hfQUNUSU9OX1BBTl9ZID0gJ3Bhbi15JztcclxuXHJcbi8qKlxyXG4gKiBUb3VjaCBBY3Rpb25cclxuICogc2V0cyB0aGUgdG91Y2hBY3Rpb24gcHJvcGVydHkgb3IgdXNlcyB0aGUganMgYWx0ZXJuYXRpdmVcclxuICogQHBhcmFtIHtNYW5hZ2VyfSBtYW5hZ2VyXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZVxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIFRvdWNoQWN0aW9uKG1hbmFnZXIsIHZhbHVlKSB7XHJcbiAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xyXG4gICAgdGhpcy5zZXQodmFsdWUpO1xyXG59XHJcblxyXG5Ub3VjaEFjdGlvbi5wcm90b3R5cGUgPSB7XHJcbiAgICAvKipcclxuICAgICAqIHNldCB0aGUgdG91Y2hBY3Rpb24gdmFsdWUgb24gdGhlIGVsZW1lbnQgb3IgZW5hYmxlIHRoZSBwb2x5ZmlsbFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlXHJcbiAgICAgKi9cclxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcclxuICAgICAgICAvLyBmaW5kIG91dCB0aGUgdG91Y2gtYWN0aW9uIGJ5IHRoZSBldmVudCBoYW5kbGVyc1xyXG4gICAgICAgIGlmICh2YWx1ZSA9PSBUT1VDSF9BQ1RJT05fQ09NUFVURSkge1xyXG4gICAgICAgICAgICB2YWx1ZSA9IHRoaXMuY29tcHV0ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKE5BVElWRV9UT1VDSF9BQ1RJT04pIHtcclxuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLmVsZW1lbnQuc3R5bGVbUFJFRklYRURfVE9VQ0hfQUNUSU9OXSA9IHZhbHVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmFjdGlvbnMgPSB2YWx1ZS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBqdXN0IHJlLXNldCB0aGUgdG91Y2hBY3Rpb24gdmFsdWVcclxuICAgICAqL1xyXG4gICAgdXBkYXRlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLnNldCh0aGlzLm1hbmFnZXIub3B0aW9ucy50b3VjaEFjdGlvbik7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogY29tcHV0ZSB0aGUgdmFsdWUgZm9yIHRoZSB0b3VjaEFjdGlvbiBwcm9wZXJ0eSBiYXNlZCBvbiB0aGUgcmVjb2duaXplcidzIHNldHRpbmdzXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSB2YWx1ZVxyXG4gICAgICovXHJcbiAgICBjb21wdXRlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgYWN0aW9ucyA9IFtdO1xyXG4gICAgICAgIGVhY2godGhpcy5tYW5hZ2VyLnJlY29nbml6ZXJzLCBmdW5jdGlvbihyZWNvZ25pemVyKSB7XHJcbiAgICAgICAgICAgIGlmIChib29sT3JGbihyZWNvZ25pemVyLm9wdGlvbnMuZW5hYmxlLCBbcmVjb2duaXplcl0pKSB7XHJcbiAgICAgICAgICAgICAgICBhY3Rpb25zID0gYWN0aW9ucy5jb25jYXQocmVjb2duaXplci5nZXRUb3VjaEFjdGlvbigpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBjbGVhblRvdWNoQWN0aW9ucyhhY3Rpb25zLmpvaW4oJyAnKSk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogdGhpcyBtZXRob2QgaXMgY2FsbGVkIG9uIGVhY2ggaW5wdXQgY3ljbGUgYW5kIHByb3ZpZGVzIHRoZSBwcmV2ZW50aW5nIG9mIHRoZSBicm93c2VyIGJlaGF2aW9yXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaW5wdXRcclxuICAgICAqL1xyXG4gICAgcHJldmVudERlZmF1bHRzOiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIC8vIG5vdCBuZWVkZWQgd2l0aCBuYXRpdmUgc3VwcG9ydCBmb3IgdGhlIHRvdWNoQWN0aW9uIHByb3BlcnR5XHJcbiAgICAgICAgaWYgKE5BVElWRV9UT1VDSF9BQ1RJT04pIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHNyY0V2ZW50ID0gaW5wdXQuc3JjRXZlbnQ7XHJcbiAgICAgICAgdmFyIGRpcmVjdGlvbiA9IGlucHV0Lm9mZnNldERpcmVjdGlvbjtcclxuXHJcbiAgICAgICAgLy8gaWYgdGhlIHRvdWNoIGFjdGlvbiBkaWQgcHJldmVudGVkIG9uY2UgdGhpcyBzZXNzaW9uXHJcbiAgICAgICAgaWYgKHRoaXMubWFuYWdlci5zZXNzaW9uLnByZXZlbnRlZCkge1xyXG4gICAgICAgICAgICBzcmNFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgYWN0aW9ucyA9IHRoaXMuYWN0aW9ucztcclxuICAgICAgICB2YXIgaGFzTm9uZSA9IGluU3RyKGFjdGlvbnMsIFRPVUNIX0FDVElPTl9OT05FKTtcclxuICAgICAgICB2YXIgaGFzUGFuWSA9IGluU3RyKGFjdGlvbnMsIFRPVUNIX0FDVElPTl9QQU5fWSk7XHJcbiAgICAgICAgdmFyIGhhc1BhblggPSBpblN0cihhY3Rpb25zLCBUT1VDSF9BQ1RJT05fUEFOX1gpO1xyXG5cclxuICAgICAgICBpZiAoaGFzTm9uZSB8fFxyXG4gICAgICAgICAgICAoaGFzUGFuWSAmJiBkaXJlY3Rpb24gJiBESVJFQ1RJT05fSE9SSVpPTlRBTCkgfHxcclxuICAgICAgICAgICAgKGhhc1BhblggJiYgZGlyZWN0aW9uICYgRElSRUNUSU9OX1ZFUlRJQ0FMKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcmV2ZW50U3JjKHNyY0V2ZW50KTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogY2FsbCBwcmV2ZW50RGVmYXVsdCB0byBwcmV2ZW50IHRoZSBicm93c2VyJ3MgZGVmYXVsdCBiZWhhdmlvciAoc2Nyb2xsaW5nIGluIG1vc3QgY2FzZXMpXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3JjRXZlbnRcclxuICAgICAqL1xyXG4gICAgcHJldmVudFNyYzogZnVuY3Rpb24oc3JjRXZlbnQpIHtcclxuICAgICAgICB0aGlzLm1hbmFnZXIuc2Vzc2lvbi5wcmV2ZW50ZWQgPSB0cnVlO1xyXG4gICAgICAgIHNyY0V2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogd2hlbiB0aGUgdG91Y2hBY3Rpb25zIGFyZSBjb2xsZWN0ZWQgdGhleSBhcmUgbm90IGEgdmFsaWQgdmFsdWUsIHNvIHdlIG5lZWQgdG8gY2xlYW4gdGhpbmdzIHVwLiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBhY3Rpb25zXHJcbiAqIEByZXR1cm5zIHsqfVxyXG4gKi9cclxuZnVuY3Rpb24gY2xlYW5Ub3VjaEFjdGlvbnMoYWN0aW9ucykge1xyXG4gICAgLy8gbm9uZVxyXG4gICAgaWYgKGluU3RyKGFjdGlvbnMsIFRPVUNIX0FDVElPTl9OT05FKSkge1xyXG4gICAgICAgIHJldHVybiBUT1VDSF9BQ1RJT05fTk9ORTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgaGFzUGFuWCA9IGluU3RyKGFjdGlvbnMsIFRPVUNIX0FDVElPTl9QQU5fWCk7XHJcbiAgICB2YXIgaGFzUGFuWSA9IGluU3RyKGFjdGlvbnMsIFRPVUNIX0FDVElPTl9QQU5fWSk7XHJcblxyXG4gICAgLy8gcGFuLXggYW5kIHBhbi15IGNhbiBiZSBjb21iaW5lZFxyXG4gICAgaWYgKGhhc1BhblggJiYgaGFzUGFuWSkge1xyXG4gICAgICAgIHJldHVybiBUT1VDSF9BQ1RJT05fUEFOX1ggKyAnICcgKyBUT1VDSF9BQ1RJT05fUEFOX1k7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gcGFuLXggT1IgcGFuLXlcclxuICAgIGlmIChoYXNQYW5YIHx8IGhhc1BhblkpIHtcclxuICAgICAgICByZXR1cm4gaGFzUGFuWCA/IFRPVUNIX0FDVElPTl9QQU5fWCA6IFRPVUNIX0FDVElPTl9QQU5fWTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBtYW5pcHVsYXRpb25cclxuICAgIGlmIChpblN0cihhY3Rpb25zLCBUT1VDSF9BQ1RJT05fTUFOSVBVTEFUSU9OKSkge1xyXG4gICAgICAgIHJldHVybiBUT1VDSF9BQ1RJT05fTUFOSVBVTEFUSU9OO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBUT1VDSF9BQ1RJT05fQVVUTztcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlY29nbml6ZXIgZmxvdyBleHBsYWluZWQ7ICpcclxuICogQWxsIHJlY29nbml6ZXJzIGhhdmUgdGhlIGluaXRpYWwgc3RhdGUgb2YgUE9TU0lCTEUgd2hlbiBhIGlucHV0IHNlc3Npb24gc3RhcnRzLlxyXG4gKiBUaGUgZGVmaW5pdGlvbiBvZiBhIGlucHV0IHNlc3Npb24gaXMgZnJvbSB0aGUgZmlyc3QgaW5wdXQgdW50aWwgdGhlIGxhc3QgaW5wdXQsIHdpdGggYWxsIGl0J3MgbW92ZW1lbnQgaW4gaXQuICpcclxuICogRXhhbXBsZSBzZXNzaW9uIGZvciBtb3VzZS1pbnB1dDogbW91c2Vkb3duIC0+IG1vdXNlbW92ZSAtPiBtb3VzZXVwXHJcbiAqXHJcbiAqIE9uIGVhY2ggcmVjb2duaXppbmcgY3ljbGUgKHNlZSBNYW5hZ2VyLnJlY29nbml6ZSkgdGhlIC5yZWNvZ25pemUoKSBtZXRob2QgaXMgZXhlY3V0ZWRcclxuICogd2hpY2ggZGV0ZXJtaW5lcyB3aXRoIHN0YXRlIGl0IHNob3VsZCBiZS5cclxuICpcclxuICogSWYgdGhlIHJlY29nbml6ZXIgaGFzIHRoZSBzdGF0ZSBGQUlMRUQsIENBTkNFTExFRCBvciBSRUNPR05JWkVEIChlcXVhbHMgRU5ERUQpLCBpdCBpcyByZXNldCB0b1xyXG4gKiBQT1NTSUJMRSB0byBnaXZlIGl0IGFub3RoZXIgY2hhbmdlIG9uIHRoZSBuZXh0IGN5Y2xlLlxyXG4gKlxyXG4gKiAgICAgICAgICAgICAgIFBvc3NpYmxlXHJcbiAqICAgICAgICAgICAgICAgICAgfFxyXG4gKiAgICAgICAgICAgICstLS0tLSstLS0tLS0tLS0tLS0tLS0rXHJcbiAqICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgICAgIHxcclxuICogICAgICArLS0tLS0rLS0tLS0rICAgICAgICAgICAgICAgfFxyXG4gKiAgICAgIHwgICAgICAgICAgIHwgICAgICAgICAgICAgICB8XHJcbiAqICAgRmFpbGVkICAgICAgQ2FuY2VsbGVkICAgICAgICAgIHxcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICstLS0tLS0tKy0tLS0tLStcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgIHwgICAgICAgICAgICAgIHxcclxuICogICAgICAgICAgICAgICAgICAgICAgUmVjb2duaXplZCAgICAgICBCZWdhblxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2hhbmdlZFxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBFbmRlZC9SZWNvZ25pemVkXHJcbiAqL1xyXG52YXIgU1RBVEVfUE9TU0lCTEUgPSAxO1xyXG52YXIgU1RBVEVfQkVHQU4gPSAyO1xyXG52YXIgU1RBVEVfQ0hBTkdFRCA9IDQ7XHJcbnZhciBTVEFURV9FTkRFRCA9IDg7XHJcbnZhciBTVEFURV9SRUNPR05JWkVEID0gU1RBVEVfRU5ERUQ7XHJcbnZhciBTVEFURV9DQU5DRUxMRUQgPSAxNjtcclxudmFyIFNUQVRFX0ZBSUxFRCA9IDMyO1xyXG5cclxuLyoqXHJcbiAqIFJlY29nbml6ZXJcclxuICogRXZlcnkgcmVjb2duaXplciBuZWVkcyB0byBleHRlbmQgZnJvbSB0aGlzIGNsYXNzLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcclxuICovXHJcbmZ1bmN0aW9uIFJlY29nbml6ZXIob3B0aW9ucykge1xyXG4gICAgdGhpcy5pZCA9IHVuaXF1ZUlkKCk7XHJcblxyXG4gICAgdGhpcy5tYW5hZ2VyID0gbnVsbDtcclxuICAgIHRoaXMub3B0aW9ucyA9IG1lcmdlKG9wdGlvbnMgfHwge30sIHRoaXMuZGVmYXVsdHMpO1xyXG5cclxuICAgIC8vIGRlZmF1bHQgaXMgZW5hYmxlIHRydWVcclxuICAgIHRoaXMub3B0aW9ucy5lbmFibGUgPSBpZlVuZGVmaW5lZCh0aGlzLm9wdGlvbnMuZW5hYmxlLCB0cnVlKTtcclxuXHJcbiAgICB0aGlzLnN0YXRlID0gU1RBVEVfUE9TU0lCTEU7XHJcblxyXG4gICAgdGhpcy5zaW11bHRhbmVvdXMgPSB7fTtcclxuICAgIHRoaXMucmVxdWlyZUZhaWwgPSBbXTtcclxufVxyXG5cclxuUmVjb2duaXplci5wcm90b3R5cGUgPSB7XHJcbiAgICAvKipcclxuICAgICAqIEB2aXJ0dWFsXHJcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxyXG4gICAgICovXHJcbiAgICBkZWZhdWx0czoge30sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBzZXQgb3B0aW9uc1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcclxuICAgICAqIEByZXR1cm4ge1JlY29nbml6ZXJ9XHJcbiAgICAgKi9cclxuICAgIHNldDogZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gICAgICAgIGV4dGVuZCh0aGlzLm9wdGlvbnMsIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICAvLyBhbHNvIHVwZGF0ZSB0aGUgdG91Y2hBY3Rpb24sIGluIGNhc2Ugc29tZXRoaW5nIGNoYW5nZWQgYWJvdXQgdGhlIGRpcmVjdGlvbnMvZW5hYmxlZCBzdGF0ZVxyXG4gICAgICAgIHRoaXMubWFuYWdlciAmJiB0aGlzLm1hbmFnZXIudG91Y2hBY3Rpb24udXBkYXRlKCk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmVjb2duaXplIHNpbXVsdGFuZW91cyB3aXRoIGFuIG90aGVyIHJlY29nbml6ZXIuXHJcbiAgICAgKiBAcGFyYW0ge1JlY29nbml6ZXJ9IG90aGVyUmVjb2duaXplclxyXG4gICAgICogQHJldHVybnMge1JlY29nbml6ZXJ9IHRoaXNcclxuICAgICAqL1xyXG4gICAgcmVjb2duaXplV2l0aDogZnVuY3Rpb24ob3RoZXJSZWNvZ25pemVyKSB7XHJcbiAgICAgICAgaWYgKGludm9rZUFycmF5QXJnKG90aGVyUmVjb2duaXplciwgJ3JlY29nbml6ZVdpdGgnLCB0aGlzKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBzaW11bHRhbmVvdXMgPSB0aGlzLnNpbXVsdGFuZW91cztcclxuICAgICAgICBvdGhlclJlY29nbml6ZXIgPSBnZXRSZWNvZ25pemVyQnlOYW1lSWZNYW5hZ2VyKG90aGVyUmVjb2duaXplciwgdGhpcyk7XHJcbiAgICAgICAgaWYgKCFzaW11bHRhbmVvdXNbb3RoZXJSZWNvZ25pemVyLmlkXSkge1xyXG4gICAgICAgICAgICBzaW11bHRhbmVvdXNbb3RoZXJSZWNvZ25pemVyLmlkXSA9IG90aGVyUmVjb2duaXplcjtcclxuICAgICAgICAgICAgb3RoZXJSZWNvZ25pemVyLnJlY29nbml6ZVdpdGgodGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGRyb3AgdGhlIHNpbXVsdGFuZW91cyBsaW5rLiBpdCBkb2VzbnQgcmVtb3ZlIHRoZSBsaW5rIG9uIHRoZSBvdGhlciByZWNvZ25pemVyLlxyXG4gICAgICogQHBhcmFtIHtSZWNvZ25pemVyfSBvdGhlclJlY29nbml6ZXJcclxuICAgICAqIEByZXR1cm5zIHtSZWNvZ25pemVyfSB0aGlzXHJcbiAgICAgKi9cclxuICAgIGRyb3BSZWNvZ25pemVXaXRoOiBmdW5jdGlvbihvdGhlclJlY29nbml6ZXIpIHtcclxuICAgICAgICBpZiAoaW52b2tlQXJyYXlBcmcob3RoZXJSZWNvZ25pemVyLCAnZHJvcFJlY29nbml6ZVdpdGgnLCB0aGlzKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG90aGVyUmVjb2duaXplciA9IGdldFJlY29nbml6ZXJCeU5hbWVJZk1hbmFnZXIob3RoZXJSZWNvZ25pemVyLCB0aGlzKTtcclxuICAgICAgICBkZWxldGUgdGhpcy5zaW11bHRhbmVvdXNbb3RoZXJSZWNvZ25pemVyLmlkXTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiByZWNvZ25pemVyIGNhbiBvbmx5IHJ1biB3aGVuIGFuIG90aGVyIGlzIGZhaWxpbmdcclxuICAgICAqIEBwYXJhbSB7UmVjb2duaXplcn0gb3RoZXJSZWNvZ25pemVyXHJcbiAgICAgKiBAcmV0dXJucyB7UmVjb2duaXplcn0gdGhpc1xyXG4gICAgICovXHJcbiAgICByZXF1aXJlRmFpbHVyZTogZnVuY3Rpb24ob3RoZXJSZWNvZ25pemVyKSB7XHJcbiAgICAgICAgaWYgKGludm9rZUFycmF5QXJnKG90aGVyUmVjb2duaXplciwgJ3JlcXVpcmVGYWlsdXJlJywgdGhpcykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmVxdWlyZUZhaWwgPSB0aGlzLnJlcXVpcmVGYWlsO1xyXG4gICAgICAgIG90aGVyUmVjb2duaXplciA9IGdldFJlY29nbml6ZXJCeU5hbWVJZk1hbmFnZXIob3RoZXJSZWNvZ25pemVyLCB0aGlzKTtcclxuICAgICAgICBpZiAoaW5BcnJheShyZXF1aXJlRmFpbCwgb3RoZXJSZWNvZ25pemVyKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgcmVxdWlyZUZhaWwucHVzaChvdGhlclJlY29nbml6ZXIpO1xyXG4gICAgICAgICAgICBvdGhlclJlY29nbml6ZXIucmVxdWlyZUZhaWx1cmUodGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGRyb3AgdGhlIHJlcXVpcmVGYWlsdXJlIGxpbmsuIGl0IGRvZXMgbm90IHJlbW92ZSB0aGUgbGluayBvbiB0aGUgb3RoZXIgcmVjb2duaXplci5cclxuICAgICAqIEBwYXJhbSB7UmVjb2duaXplcn0gb3RoZXJSZWNvZ25pemVyXHJcbiAgICAgKiBAcmV0dXJucyB7UmVjb2duaXplcn0gdGhpc1xyXG4gICAgICovXHJcbiAgICBkcm9wUmVxdWlyZUZhaWx1cmU6IGZ1bmN0aW9uKG90aGVyUmVjb2duaXplcikge1xyXG4gICAgICAgIGlmIChpbnZva2VBcnJheUFyZyhvdGhlclJlY29nbml6ZXIsICdkcm9wUmVxdWlyZUZhaWx1cmUnLCB0aGlzKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG90aGVyUmVjb2duaXplciA9IGdldFJlY29nbml6ZXJCeU5hbWVJZk1hbmFnZXIob3RoZXJSZWNvZ25pemVyLCB0aGlzKTtcclxuICAgICAgICB2YXIgaW5kZXggPSBpbkFycmF5KHRoaXMucmVxdWlyZUZhaWwsIG90aGVyUmVjb2duaXplcik7XHJcbiAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcclxuICAgICAgICAgICAgdGhpcy5yZXF1aXJlRmFpbC5zcGxpY2UoaW5kZXgsIDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBoYXMgcmVxdWlyZSBmYWlsdXJlcyBib29sZWFuXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgaGFzUmVxdWlyZUZhaWx1cmVzOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5yZXF1aXJlRmFpbC5sZW5ndGggPiAwO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGlmIHRoZSByZWNvZ25pemVyIGNhbiByZWNvZ25pemUgc2ltdWx0YW5lb3VzIHdpdGggYW4gb3RoZXIgcmVjb2duaXplclxyXG4gICAgICogQHBhcmFtIHtSZWNvZ25pemVyfSBvdGhlclJlY29nbml6ZXJcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICovXHJcbiAgICBjYW5SZWNvZ25pemVXaXRoOiBmdW5jdGlvbihvdGhlclJlY29nbml6ZXIpIHtcclxuICAgICAgICByZXR1cm4gISF0aGlzLnNpbXVsdGFuZW91c1tvdGhlclJlY29nbml6ZXIuaWRdO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFlvdSBzaG91bGQgdXNlIGB0cnlFbWl0YCBpbnN0ZWFkIG9mIGBlbWl0YCBkaXJlY3RseSB0byBjaGVja1xyXG4gICAgICogdGhhdCBhbGwgdGhlIG5lZWRlZCByZWNvZ25pemVycyBoYXMgZmFpbGVkIGJlZm9yZSBlbWl0dGluZy5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dFxyXG4gICAgICovXHJcbiAgICBlbWl0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgICAgICB2YXIgc3RhdGUgPSB0aGlzLnN0YXRlO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiBlbWl0KHdpdGhTdGF0ZSkge1xyXG4gICAgICAgICAgICBzZWxmLm1hbmFnZXIuZW1pdChzZWxmLm9wdGlvbnMuZXZlbnQgKyAod2l0aFN0YXRlID8gc3RhdGVTdHIoc3RhdGUpIDogJycpLCBpbnB1dCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyAncGFuc3RhcnQnIGFuZCAncGFubW92ZSdcclxuICAgICAgICBpZiAoc3RhdGUgPCBTVEFURV9FTkRFRCkge1xyXG4gICAgICAgICAgICBlbWl0KHRydWUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZW1pdCgpOyAvLyBzaW1wbGUgJ2V2ZW50TmFtZScgZXZlbnRzXHJcblxyXG4gICAgICAgIC8vIHBhbmVuZCBhbmQgcGFuY2FuY2VsXHJcbiAgICAgICAgaWYgKHN0YXRlID49IFNUQVRFX0VOREVEKSB7XHJcbiAgICAgICAgICAgIGVtaXQodHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrIHRoYXQgYWxsIHRoZSByZXF1aXJlIGZhaWx1cmUgcmVjb2duaXplcnMgaGFzIGZhaWxlZCxcclxuICAgICAqIGlmIHRydWUsIGl0IGVtaXRzIGEgZ2VzdHVyZSBldmVudCxcclxuICAgICAqIG90aGVyd2lzZSwgc2V0dXAgdGhlIHN0YXRlIHRvIEZBSUxFRC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dFxyXG4gICAgICovXHJcbiAgICB0cnlFbWl0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIGlmICh0aGlzLmNhbkVtaXQoKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5lbWl0KGlucHV0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gaXQncyBmYWlsaW5nIGFueXdheVxyXG4gICAgICAgIHRoaXMuc3RhdGUgPSBTVEFURV9GQUlMRUQ7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogY2FuIHdlIGVtaXQ/XHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgY2FuRW1pdDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGkgPSAwO1xyXG4gICAgICAgIHdoaWxlIChpIDwgdGhpcy5yZXF1aXJlRmFpbC5sZW5ndGgpIHtcclxuICAgICAgICAgICAgaWYgKCEodGhpcy5yZXF1aXJlRmFpbFtpXS5zdGF0ZSAmIChTVEFURV9GQUlMRUQgfCBTVEFURV9QT1NTSUJMRSkpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaSsrO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiB1cGRhdGUgdGhlIHJlY29nbml6ZXJcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dERhdGFcclxuICAgICAqL1xyXG4gICAgcmVjb2duaXplOiBmdW5jdGlvbihpbnB1dERhdGEpIHtcclxuICAgICAgICAvLyBtYWtlIGEgbmV3IGNvcHkgb2YgdGhlIGlucHV0RGF0YVxyXG4gICAgICAgIC8vIHNvIHdlIGNhbiBjaGFuZ2UgdGhlIGlucHV0RGF0YSB3aXRob3V0IG1lc3NpbmcgdXAgdGhlIG90aGVyIHJlY29nbml6ZXJzXHJcbiAgICAgICAgdmFyIGlucHV0RGF0YUNsb25lID0gZXh0ZW5kKHt9LCBpbnB1dERhdGEpO1xyXG5cclxuICAgICAgICAvLyBpcyBpcyBlbmFibGVkIGFuZCBhbGxvdyByZWNvZ25pemluZz9cclxuICAgICAgICBpZiAoIWJvb2xPckZuKHRoaXMub3B0aW9ucy5lbmFibGUsIFt0aGlzLCBpbnB1dERhdGFDbG9uZV0pKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKTtcclxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFNUQVRFX0ZBSUxFRDtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gcmVzZXQgd2hlbiB3ZSd2ZSByZWFjaGVkIHRoZSBlbmRcclxuICAgICAgICBpZiAodGhpcy5zdGF0ZSAmIChTVEFURV9SRUNPR05JWkVEIHwgU1RBVEVfQ0FOQ0VMTEVEIHwgU1RBVEVfRkFJTEVEKSkge1xyXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU1RBVEVfUE9TU0lCTEU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5wcm9jZXNzKGlucHV0RGF0YUNsb25lKTtcclxuXHJcbiAgICAgICAgLy8gdGhlIHJlY29nbml6ZXIgaGFzIHJlY29nbml6ZWQgYSBnZXN0dXJlXHJcbiAgICAgICAgLy8gc28gdHJpZ2dlciBhbiBldmVudFxyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlICYgKFNUQVRFX0JFR0FOIHwgU1RBVEVfQ0hBTkdFRCB8IFNUQVRFX0VOREVEIHwgU1RBVEVfQ0FOQ0VMTEVEKSkge1xyXG4gICAgICAgICAgICB0aGlzLnRyeUVtaXQoaW5wdXREYXRhQ2xvbmUpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiByZXR1cm4gdGhlIHN0YXRlIG9mIHRoZSByZWNvZ25pemVyXHJcbiAgICAgKiB0aGUgYWN0dWFsIHJlY29nbml6aW5nIGhhcHBlbnMgaW4gdGhpcyBtZXRob2RcclxuICAgICAqIEB2aXJ0dWFsXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaW5wdXREYXRhXHJcbiAgICAgKiBAcmV0dXJucyB7Q29uc3R9IFNUQVRFXHJcbiAgICAgKi9cclxuICAgIHByb2Nlc3M6IGZ1bmN0aW9uKGlucHV0RGF0YSkgeyB9LCAvLyBqc2hpbnQgaWdub3JlOmxpbmVcclxuXHJcbiAgICAvKipcclxuICAgICAqIHJldHVybiB0aGUgcHJlZmVycmVkIHRvdWNoLWFjdGlvblxyXG4gICAgICogQHZpcnR1YWxcclxuICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAqL1xyXG4gICAgZ2V0VG91Y2hBY3Rpb246IGZ1bmN0aW9uKCkgeyB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogY2FsbGVkIHdoZW4gdGhlIGdlc3R1cmUgaXNuJ3QgYWxsb3dlZCB0byByZWNvZ25pemVcclxuICAgICAqIGxpa2Ugd2hlbiBhbm90aGVyIGlzIGJlaW5nIHJlY29nbml6ZWQgb3IgaXQgaXMgZGlzYWJsZWRcclxuICAgICAqIEB2aXJ0dWFsXHJcbiAgICAgKi9cclxuICAgIHJlc2V0OiBmdW5jdGlvbigpIHsgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIGdldCBhIHVzYWJsZSBzdHJpbmcsIHVzZWQgYXMgZXZlbnQgcG9zdGZpeFxyXG4gKiBAcGFyYW0ge0NvbnN0fSBzdGF0ZVxyXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBzdGF0ZVxyXG4gKi9cclxuZnVuY3Rpb24gc3RhdGVTdHIoc3RhdGUpIHtcclxuICAgIGlmIChzdGF0ZSAmIFNUQVRFX0NBTkNFTExFRCkge1xyXG4gICAgICAgIHJldHVybiAnY2FuY2VsJztcclxuICAgIH0gZWxzZSBpZiAoc3RhdGUgJiBTVEFURV9FTkRFRCkge1xyXG4gICAgICAgIHJldHVybiAnZW5kJztcclxuICAgIH0gZWxzZSBpZiAoc3RhdGUgJiBTVEFURV9DSEFOR0VEKSB7XHJcbiAgICAgICAgcmV0dXJuICdtb3ZlJztcclxuICAgIH0gZWxzZSBpZiAoc3RhdGUgJiBTVEFURV9CRUdBTikge1xyXG4gICAgICAgIHJldHVybiAnc3RhcnQnO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuICcnO1xyXG59XHJcblxyXG4vKipcclxuICogZGlyZWN0aW9uIGNvbnMgdG8gc3RyaW5nXHJcbiAqIEBwYXJhbSB7Q29uc3R9IGRpcmVjdGlvblxyXG4gKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gKi9cclxuZnVuY3Rpb24gZGlyZWN0aW9uU3RyKGRpcmVjdGlvbikge1xyXG4gICAgaWYgKGRpcmVjdGlvbiA9PSBESVJFQ1RJT05fRE9XTikge1xyXG4gICAgICAgIHJldHVybiAnZG93bic7XHJcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PSBESVJFQ1RJT05fVVApIHtcclxuICAgICAgICByZXR1cm4gJ3VwJztcclxuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09IERJUkVDVElPTl9MRUZUKSB7XHJcbiAgICAgICAgcmV0dXJuICdsZWZ0JztcclxuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09IERJUkVDVElPTl9SSUdIVCkge1xyXG4gICAgICAgIHJldHVybiAncmlnaHQnO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuICcnO1xyXG59XHJcblxyXG4vKipcclxuICogZ2V0IGEgcmVjb2duaXplciBieSBuYW1lIGlmIGl0IGlzIGJvdW5kIHRvIGEgbWFuYWdlclxyXG4gKiBAcGFyYW0ge1JlY29nbml6ZXJ8U3RyaW5nfSBvdGhlclJlY29nbml6ZXJcclxuICogQHBhcmFtIHtSZWNvZ25pemVyfSByZWNvZ25pemVyXHJcbiAqIEByZXR1cm5zIHtSZWNvZ25pemVyfVxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0UmVjb2duaXplckJ5TmFtZUlmTWFuYWdlcihvdGhlclJlY29nbml6ZXIsIHJlY29nbml6ZXIpIHtcclxuICAgIHZhciBtYW5hZ2VyID0gcmVjb2duaXplci5tYW5hZ2VyO1xyXG4gICAgaWYgKG1hbmFnZXIpIHtcclxuICAgICAgICByZXR1cm4gbWFuYWdlci5nZXQob3RoZXJSZWNvZ25pemVyKTtcclxuICAgIH1cclxuICAgIHJldHVybiBvdGhlclJlY29nbml6ZXI7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUaGlzIHJlY29nbml6ZXIgaXMganVzdCB1c2VkIGFzIGEgYmFzZSBmb3IgdGhlIHNpbXBsZSBhdHRyaWJ1dGUgcmVjb2duaXplcnMuXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBSZWNvZ25pemVyXHJcbiAqL1xyXG5mdW5jdGlvbiBBdHRyUmVjb2duaXplcigpIHtcclxuICAgIFJlY29nbml6ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuaW5oZXJpdChBdHRyUmVjb2duaXplciwgUmVjb2duaXplciwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAbmFtZXNwYWNlXHJcbiAgICAgKiBAbWVtYmVyb2YgQXR0clJlY29nbml6ZXJcclxuICAgICAqL1xyXG4gICAgZGVmYXVsdHM6IHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxyXG4gICAgICAgICAqIEBkZWZhdWx0IDFcclxuICAgICAgICAgKi9cclxuICAgICAgICBwb2ludGVyczogMVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFVzZWQgdG8gY2hlY2sgaWYgaXQgdGhlIHJlY29nbml6ZXIgcmVjZWl2ZXMgdmFsaWQgaW5wdXQsIGxpa2UgaW5wdXQuZGlzdGFuY2UgPiAxMC5cclxuICAgICAqIEBtZW1iZXJvZiBBdHRyUmVjb2duaXplclxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0XHJcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gcmVjb2duaXplZFxyXG4gICAgICovXHJcbiAgICBhdHRyVGVzdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB2YXIgb3B0aW9uUG9pbnRlcnMgPSB0aGlzLm9wdGlvbnMucG9pbnRlcnM7XHJcbiAgICAgICAgcmV0dXJuIG9wdGlvblBvaW50ZXJzID09PSAwIHx8IGlucHV0LnBvaW50ZXJzLmxlbmd0aCA9PT0gb3B0aW9uUG9pbnRlcnM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUHJvY2VzcyB0aGUgaW5wdXQgYW5kIHJldHVybiB0aGUgc3RhdGUgZm9yIHRoZSByZWNvZ25pemVyXHJcbiAgICAgKiBAbWVtYmVyb2YgQXR0clJlY29nbml6ZXJcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dFxyXG4gICAgICogQHJldHVybnMgeyp9IFN0YXRlXHJcbiAgICAgKi9cclxuICAgIHByb2Nlc3M6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdmFyIHN0YXRlID0gdGhpcy5zdGF0ZTtcclxuICAgICAgICB2YXIgZXZlbnRUeXBlID0gaW5wdXQuZXZlbnRUeXBlO1xyXG5cclxuICAgICAgICB2YXIgaXNSZWNvZ25pemVkID0gc3RhdGUgJiAoU1RBVEVfQkVHQU4gfCBTVEFURV9DSEFOR0VEKTtcclxuICAgICAgICB2YXIgaXNWYWxpZCA9IHRoaXMuYXR0clRlc3QoaW5wdXQpO1xyXG5cclxuICAgICAgICAvLyBvbiBjYW5jZWwgaW5wdXQgYW5kIHdlJ3ZlIHJlY29nbml6ZWQgYmVmb3JlLCByZXR1cm4gU1RBVEVfQ0FOQ0VMTEVEXHJcbiAgICAgICAgaWYgKGlzUmVjb2duaXplZCAmJiAoZXZlbnRUeXBlICYgSU5QVVRfQ0FOQ0VMIHx8ICFpc1ZhbGlkKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gc3RhdGUgfCBTVEFURV9DQU5DRUxMRUQ7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpc1JlY29nbml6ZWQgfHwgaXNWYWxpZCkge1xyXG4gICAgICAgICAgICBpZiAoZXZlbnRUeXBlICYgSU5QVVRfRU5EKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdGUgfCBTVEFURV9FTkRFRDtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICghKHN0YXRlICYgU1RBVEVfQkVHQU4pKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gU1RBVEVfQkVHQU47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlIHwgU1RBVEVfQ0hBTkdFRDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFNUQVRFX0ZBSUxFRDtcclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogUGFuXHJcbiAqIFJlY29nbml6ZWQgd2hlbiB0aGUgcG9pbnRlciBpcyBkb3duIGFuZCBtb3ZlZCBpbiB0aGUgYWxsb3dlZCBkaXJlY3Rpb24uXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBBdHRyUmVjb2duaXplclxyXG4gKi9cclxuZnVuY3Rpb24gUGFuUmVjb2duaXplcigpIHtcclxuICAgIEF0dHJSZWNvZ25pemVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblxyXG4gICAgdGhpcy5wWCA9IG51bGw7XHJcbiAgICB0aGlzLnBZID0gbnVsbDtcclxufVxyXG5cclxuaW5oZXJpdChQYW5SZWNvZ25pemVyLCBBdHRyUmVjb2duaXplciwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAbmFtZXNwYWNlXHJcbiAgICAgKiBAbWVtYmVyb2YgUGFuUmVjb2duaXplclxyXG4gICAgICovXHJcbiAgICBkZWZhdWx0czoge1xyXG4gICAgICAgIGV2ZW50OiAncGFuJyxcclxuICAgICAgICB0aHJlc2hvbGQ6IDEwLFxyXG4gICAgICAgIHBvaW50ZXJzOiAxLFxyXG4gICAgICAgIGRpcmVjdGlvbjogRElSRUNUSU9OX0FMTFxyXG4gICAgfSxcclxuXHJcbiAgICBnZXRUb3VjaEFjdGlvbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGRpcmVjdGlvbiA9IHRoaXMub3B0aW9ucy5kaXJlY3Rpb247XHJcbiAgICAgICAgdmFyIGFjdGlvbnMgPSBbXTtcclxuICAgICAgICBpZiAoZGlyZWN0aW9uICYgRElSRUNUSU9OX0hPUklaT05UQUwpIHtcclxuICAgICAgICAgICAgYWN0aW9ucy5wdXNoKFRPVUNIX0FDVElPTl9QQU5fWSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkaXJlY3Rpb24gJiBESVJFQ1RJT05fVkVSVElDQUwpIHtcclxuICAgICAgICAgICAgYWN0aW9ucy5wdXNoKFRPVUNIX0FDVElPTl9QQU5fWCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBhY3Rpb25zO1xyXG4gICAgfSxcclxuXHJcbiAgICBkaXJlY3Rpb25UZXN0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHZhciBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xyXG4gICAgICAgIHZhciBoYXNNb3ZlZCA9IHRydWU7XHJcbiAgICAgICAgdmFyIGRpc3RhbmNlID0gaW5wdXQuZGlzdGFuY2U7XHJcbiAgICAgICAgdmFyIGRpcmVjdGlvbiA9IGlucHV0LmRpcmVjdGlvbjtcclxuICAgICAgICB2YXIgeCA9IGlucHV0LmRlbHRhWDtcclxuICAgICAgICB2YXIgeSA9IGlucHV0LmRlbHRhWTtcclxuXHJcbiAgICAgICAgLy8gbG9jayB0byBheGlzP1xyXG4gICAgICAgIGlmICghKGRpcmVjdGlvbiAmIG9wdGlvbnMuZGlyZWN0aW9uKSkge1xyXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5kaXJlY3Rpb24gJiBESVJFQ1RJT05fSE9SSVpPTlRBTCkge1xyXG4gICAgICAgICAgICAgICAgZGlyZWN0aW9uID0gKHggPT09IDApID8gRElSRUNUSU9OX05PTkUgOiAoeCA8IDApID8gRElSRUNUSU9OX0xFRlQgOiBESVJFQ1RJT05fUklHSFQ7XHJcbiAgICAgICAgICAgICAgICBoYXNNb3ZlZCA9IHggIT0gdGhpcy5wWDtcclxuICAgICAgICAgICAgICAgIGRpc3RhbmNlID0gTWF0aC5hYnMoaW5wdXQuZGVsdGFYKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGRpcmVjdGlvbiA9ICh5ID09PSAwKSA/IERJUkVDVElPTl9OT05FIDogKHkgPCAwKSA/IERJUkVDVElPTl9VUCA6IERJUkVDVElPTl9ET1dOO1xyXG4gICAgICAgICAgICAgICAgaGFzTW92ZWQgPSB5ICE9IHRoaXMucFk7XHJcbiAgICAgICAgICAgICAgICBkaXN0YW5jZSA9IE1hdGguYWJzKGlucHV0LmRlbHRhWSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaW5wdXQuZGlyZWN0aW9uID0gZGlyZWN0aW9uO1xyXG4gICAgICAgIHJldHVybiBoYXNNb3ZlZCAmJiBkaXN0YW5jZSA+IG9wdGlvbnMudGhyZXNob2xkICYmIGRpcmVjdGlvbiAmIG9wdGlvbnMuZGlyZWN0aW9uO1xyXG4gICAgfSxcclxuXHJcbiAgICBhdHRyVGVzdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICByZXR1cm4gQXR0clJlY29nbml6ZXIucHJvdG90eXBlLmF0dHJUZXN0LmNhbGwodGhpcywgaW5wdXQpICYmXHJcbiAgICAgICAgICAgICh0aGlzLnN0YXRlICYgU1RBVEVfQkVHQU4gfHwgKCEodGhpcy5zdGF0ZSAmIFNUQVRFX0JFR0FOKSAmJiB0aGlzLmRpcmVjdGlvblRlc3QoaW5wdXQpKSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGVtaXQ6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdGhpcy5wWCA9IGlucHV0LmRlbHRhWDtcclxuICAgICAgICB0aGlzLnBZID0gaW5wdXQuZGVsdGFZO1xyXG5cclxuICAgICAgICB2YXIgZGlyZWN0aW9uID0gZGlyZWN0aW9uU3RyKGlucHV0LmRpcmVjdGlvbik7XHJcbiAgICAgICAgaWYgKGRpcmVjdGlvbikge1xyXG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuZW1pdCh0aGlzLm9wdGlvbnMuZXZlbnQgKyBkaXJlY3Rpb24sIGlucHV0KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX3N1cGVyLmVtaXQuY2FsbCh0aGlzLCBpbnB1dCk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIFBpbmNoXHJcbiAqIFJlY29nbml6ZWQgd2hlbiB0d28gb3IgbW9yZSBwb2ludGVycyBhcmUgbW92aW5nIHRvd2FyZCAoem9vbS1pbikgb3IgYXdheSBmcm9tIGVhY2ggb3RoZXIgKHpvb20tb3V0KS5cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIEF0dHJSZWNvZ25pemVyXHJcbiAqL1xyXG5mdW5jdGlvbiBQaW5jaFJlY29nbml6ZXIoKSB7XHJcbiAgICBBdHRyUmVjb2duaXplci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5pbmhlcml0KFBpbmNoUmVjb2duaXplciwgQXR0clJlY29nbml6ZXIsIHtcclxuICAgIC8qKlxyXG4gICAgICogQG5hbWVzcGFjZVxyXG4gICAgICogQG1lbWJlcm9mIFBpbmNoUmVjb2duaXplclxyXG4gICAgICovXHJcbiAgICBkZWZhdWx0czoge1xyXG4gICAgICAgIGV2ZW50OiAncGluY2gnLFxyXG4gICAgICAgIHRocmVzaG9sZDogMCxcclxuICAgICAgICBwb2ludGVyczogMlxyXG4gICAgfSxcclxuXHJcbiAgICBnZXRUb3VjaEFjdGlvbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIFtUT1VDSF9BQ1RJT05fTk9ORV07XHJcbiAgICB9LFxyXG5cclxuICAgIGF0dHJUZXN0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9zdXBlci5hdHRyVGVzdC5jYWxsKHRoaXMsIGlucHV0KSAmJlxyXG4gICAgICAgICAgICAoTWF0aC5hYnMoaW5wdXQuc2NhbGUgLSAxKSA+IHRoaXMub3B0aW9ucy50aHJlc2hvbGQgfHwgdGhpcy5zdGF0ZSAmIFNUQVRFX0JFR0FOKTtcclxuICAgIH0sXHJcblxyXG4gICAgZW1pdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB0aGlzLl9zdXBlci5lbWl0LmNhbGwodGhpcywgaW5wdXQpO1xyXG4gICAgICAgIGlmIChpbnB1dC5zY2FsZSAhPT0gMSkge1xyXG4gICAgICAgICAgICB2YXIgaW5PdXQgPSBpbnB1dC5zY2FsZSA8IDEgPyAnaW4nIDogJ291dCc7XHJcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5lbWl0KHRoaXMub3B0aW9ucy5ldmVudCArIGluT3V0LCBpbnB1dCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBQcmVzc1xyXG4gKiBSZWNvZ25pemVkIHdoZW4gdGhlIHBvaW50ZXIgaXMgZG93biBmb3IgeCBtcyB3aXRob3V0IGFueSBtb3ZlbWVudC5cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIFJlY29nbml6ZXJcclxuICovXHJcbmZ1bmN0aW9uIFByZXNzUmVjb2duaXplcigpIHtcclxuICAgIFJlY29nbml6ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHJcbiAgICB0aGlzLl90aW1lciA9IG51bGw7XHJcbiAgICB0aGlzLl9pbnB1dCA9IG51bGw7XHJcbn1cclxuXHJcbmluaGVyaXQoUHJlc3NSZWNvZ25pemVyLCBSZWNvZ25pemVyLCB7XHJcbiAgICAvKipcclxuICAgICAqIEBuYW1lc3BhY2VcclxuICAgICAqIEBtZW1iZXJvZiBQcmVzc1JlY29nbml6ZXJcclxuICAgICAqL1xyXG4gICAgZGVmYXVsdHM6IHtcclxuICAgICAgICBldmVudDogJ3ByZXNzJyxcclxuICAgICAgICBwb2ludGVyczogMSxcclxuICAgICAgICB0aW1lOiA1MDAsIC8vIG1pbmltYWwgdGltZSBvZiB0aGUgcG9pbnRlciB0byBiZSBwcmVzc2VkXHJcbiAgICAgICAgdGhyZXNob2xkOiA1IC8vIGEgbWluaW1hbCBtb3ZlbWVudCBpcyBvaywgYnV0IGtlZXAgaXQgbG93XHJcbiAgICB9LFxyXG5cclxuICAgIGdldFRvdWNoQWN0aW9uOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gW1RPVUNIX0FDVElPTl9BVVRPXTtcclxuICAgIH0sXHJcblxyXG4gICAgcHJvY2VzczogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcclxuICAgICAgICB2YXIgdmFsaWRQb2ludGVycyA9IGlucHV0LnBvaW50ZXJzLmxlbmd0aCA9PT0gb3B0aW9ucy5wb2ludGVycztcclxuICAgICAgICB2YXIgdmFsaWRNb3ZlbWVudCA9IGlucHV0LmRpc3RhbmNlIDwgb3B0aW9ucy50aHJlc2hvbGQ7XHJcbiAgICAgICAgdmFyIHZhbGlkVGltZSA9IGlucHV0LmRlbHRhVGltZSA+IG9wdGlvbnMudGltZTtcclxuXHJcbiAgICAgICAgdGhpcy5faW5wdXQgPSBpbnB1dDtcclxuXHJcbiAgICAgICAgLy8gd2Ugb25seSBhbGxvdyBsaXR0bGUgbW92ZW1lbnRcclxuICAgICAgICAvLyBhbmQgd2UndmUgcmVhY2hlZCBhbiBlbmQgZXZlbnQsIHNvIGEgdGFwIGlzIHBvc3NpYmxlXHJcbiAgICAgICAgaWYgKCF2YWxpZE1vdmVtZW50IHx8ICF2YWxpZFBvaW50ZXJzIHx8IChpbnB1dC5ldmVudFR5cGUgJiAoSU5QVVRfRU5EIHwgSU5QVVRfQ0FOQ0VMKSAmJiAhdmFsaWRUaW1lKSkge1xyXG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dC5ldmVudFR5cGUgJiBJTlBVVF9TVEFSVCkge1xyXG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XHJcbiAgICAgICAgICAgIHRoaXMuX3RpbWVyID0gc2V0VGltZW91dENvbnRleHQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU1RBVEVfUkVDT0dOSVpFRDtcclxuICAgICAgICAgICAgICAgIHRoaXMudHJ5RW1pdCgpO1xyXG4gICAgICAgICAgICB9LCBvcHRpb25zLnRpbWUsIHRoaXMpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXQuZXZlbnRUeXBlICYgSU5QVVRfRU5EKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBTVEFURV9SRUNPR05JWkVEO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gU1RBVEVfRkFJTEVEO1xyXG4gICAgfSxcclxuXHJcbiAgICByZXNldDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVyKTtcclxuICAgIH0sXHJcblxyXG4gICAgZW1pdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICBpZiAodGhpcy5zdGF0ZSAhPT0gU1RBVEVfUkVDT0dOSVpFRCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoaW5wdXQgJiYgKGlucHV0LmV2ZW50VHlwZSAmIElOUFVUX0VORCkpIHtcclxuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQodGhpcy5vcHRpb25zLmV2ZW50ICsgJ3VwJywgaW5wdXQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2lucHV0LnRpbWVTdGFtcCA9IG5vdygpO1xyXG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuZW1pdCh0aGlzLm9wdGlvbnMuZXZlbnQsIHRoaXMuX2lucHV0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIFJvdGF0ZVxyXG4gKiBSZWNvZ25pemVkIHdoZW4gdHdvIG9yIG1vcmUgcG9pbnRlciBhcmUgbW92aW5nIGluIGEgY2lyY3VsYXIgbW90aW9uLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgQXR0clJlY29nbml6ZXJcclxuICovXHJcbmZ1bmN0aW9uIFJvdGF0ZVJlY29nbml6ZXIoKSB7XHJcbiAgICBBdHRyUmVjb2duaXplci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5pbmhlcml0KFJvdGF0ZVJlY29nbml6ZXIsIEF0dHJSZWNvZ25pemVyLCB7XHJcbiAgICAvKipcclxuICAgICAqIEBuYW1lc3BhY2VcclxuICAgICAqIEBtZW1iZXJvZiBSb3RhdGVSZWNvZ25pemVyXHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRzOiB7XHJcbiAgICAgICAgZXZlbnQ6ICdyb3RhdGUnLFxyXG4gICAgICAgIHRocmVzaG9sZDogMCxcclxuICAgICAgICBwb2ludGVyczogMlxyXG4gICAgfSxcclxuXHJcbiAgICBnZXRUb3VjaEFjdGlvbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIFtUT1VDSF9BQ1RJT05fTk9ORV07XHJcbiAgICB9LFxyXG5cclxuICAgIGF0dHJUZXN0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9zdXBlci5hdHRyVGVzdC5jYWxsKHRoaXMsIGlucHV0KSAmJlxyXG4gICAgICAgICAgICAoTWF0aC5hYnMoaW5wdXQucm90YXRpb24pID4gdGhpcy5vcHRpb25zLnRocmVzaG9sZCB8fCB0aGlzLnN0YXRlICYgU1RBVEVfQkVHQU4pO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBTd2lwZVxyXG4gKiBSZWNvZ25pemVkIHdoZW4gdGhlIHBvaW50ZXIgaXMgbW92aW5nIGZhc3QgKHZlbG9jaXR5KSwgd2l0aCBlbm91Z2ggZGlzdGFuY2UgaW4gdGhlIGFsbG93ZWQgZGlyZWN0aW9uLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgQXR0clJlY29nbml6ZXJcclxuICovXHJcbmZ1bmN0aW9uIFN3aXBlUmVjb2duaXplcigpIHtcclxuICAgIEF0dHJSZWNvZ25pemVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmluaGVyaXQoU3dpcGVSZWNvZ25pemVyLCBBdHRyUmVjb2duaXplciwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAbmFtZXNwYWNlXHJcbiAgICAgKiBAbWVtYmVyb2YgU3dpcGVSZWNvZ25pemVyXHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRzOiB7XHJcbiAgICAgICAgZXZlbnQ6ICdzd2lwZScsXHJcbiAgICAgICAgdGhyZXNob2xkOiAxMCxcclxuICAgICAgICB2ZWxvY2l0eTogMC42NSxcclxuICAgICAgICBkaXJlY3Rpb246IERJUkVDVElPTl9IT1JJWk9OVEFMIHwgRElSRUNUSU9OX1ZFUlRJQ0FMLFxyXG4gICAgICAgIHBvaW50ZXJzOiAxXHJcbiAgICB9LFxyXG5cclxuICAgIGdldFRvdWNoQWN0aW9uOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gUGFuUmVjb2duaXplci5wcm90b3R5cGUuZ2V0VG91Y2hBY3Rpb24uY2FsbCh0aGlzKTtcclxuICAgIH0sXHJcblxyXG4gICAgYXR0clRlc3Q6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdmFyIGRpcmVjdGlvbiA9IHRoaXMub3B0aW9ucy5kaXJlY3Rpb247XHJcbiAgICAgICAgdmFyIHZlbG9jaXR5O1xyXG5cclxuICAgICAgICBpZiAoZGlyZWN0aW9uICYgKERJUkVDVElPTl9IT1JJWk9OVEFMIHwgRElSRUNUSU9OX1ZFUlRJQ0FMKSkge1xyXG4gICAgICAgICAgICB2ZWxvY2l0eSA9IGlucHV0LnZlbG9jaXR5O1xyXG4gICAgICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uICYgRElSRUNUSU9OX0hPUklaT05UQUwpIHtcclxuICAgICAgICAgICAgdmVsb2NpdHkgPSBpbnB1dC52ZWxvY2l0eVg7XHJcbiAgICAgICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gJiBESVJFQ1RJT05fVkVSVElDQUwpIHtcclxuICAgICAgICAgICAgdmVsb2NpdHkgPSBpbnB1dC52ZWxvY2l0eVk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy5fc3VwZXIuYXR0clRlc3QuY2FsbCh0aGlzLCBpbnB1dCkgJiZcclxuICAgICAgICAgICAgZGlyZWN0aW9uICYgaW5wdXQuZGlyZWN0aW9uICYmXHJcbiAgICAgICAgICAgIGlucHV0LmRpc3RhbmNlID4gdGhpcy5vcHRpb25zLnRocmVzaG9sZCAmJlxyXG4gICAgICAgICAgICBhYnModmVsb2NpdHkpID4gdGhpcy5vcHRpb25zLnZlbG9jaXR5ICYmIGlucHV0LmV2ZW50VHlwZSAmIElOUFVUX0VORDtcclxuICAgIH0sXHJcblxyXG4gICAgZW1pdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB2YXIgZGlyZWN0aW9uID0gZGlyZWN0aW9uU3RyKGlucHV0LmRpcmVjdGlvbik7XHJcbiAgICAgICAgaWYgKGRpcmVjdGlvbikge1xyXG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuZW1pdCh0aGlzLm9wdGlvbnMuZXZlbnQgKyBkaXJlY3Rpb24sIGlucHV0KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMubWFuYWdlci5lbWl0KHRoaXMub3B0aW9ucy5ldmVudCwgaW5wdXQpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBBIHRhcCBpcyBlY29nbml6ZWQgd2hlbiB0aGUgcG9pbnRlciBpcyBkb2luZyBhIHNtYWxsIHRhcC9jbGljay4gTXVsdGlwbGUgdGFwcyBhcmUgcmVjb2duaXplZCBpZiB0aGV5IG9jY3VyXHJcbiAqIGJldHdlZW4gdGhlIGdpdmVuIGludGVydmFsIGFuZCBwb3NpdGlvbi4gVGhlIGRlbGF5IG9wdGlvbiBjYW4gYmUgdXNlZCB0byByZWNvZ25pemUgbXVsdGktdGFwcyB3aXRob3V0IGZpcmluZ1xyXG4gKiBhIHNpbmdsZSB0YXAuXHJcbiAqXHJcbiAqIFRoZSBldmVudERhdGEgZnJvbSB0aGUgZW1pdHRlZCBldmVudCBjb250YWlucyB0aGUgcHJvcGVydHkgYHRhcENvdW50YCwgd2hpY2ggY29udGFpbnMgdGhlIGFtb3VudCBvZlxyXG4gKiBtdWx0aS10YXBzIGJlaW5nIHJlY29nbml6ZWQuXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBSZWNvZ25pemVyXHJcbiAqL1xyXG5mdW5jdGlvbiBUYXBSZWNvZ25pemVyKCkge1xyXG4gICAgUmVjb2duaXplci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cclxuICAgIC8vIHByZXZpb3VzIHRpbWUgYW5kIGNlbnRlcixcclxuICAgIC8vIHVzZWQgZm9yIHRhcCBjb3VudGluZ1xyXG4gICAgdGhpcy5wVGltZSA9IGZhbHNlO1xyXG4gICAgdGhpcy5wQ2VudGVyID0gZmFsc2U7XHJcblxyXG4gICAgdGhpcy5fdGltZXIgPSBudWxsO1xyXG4gICAgdGhpcy5faW5wdXQgPSBudWxsO1xyXG4gICAgdGhpcy5jb3VudCA9IDA7XHJcbn1cclxuXHJcbmluaGVyaXQoVGFwUmVjb2duaXplciwgUmVjb2duaXplciwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAbmFtZXNwYWNlXHJcbiAgICAgKiBAbWVtYmVyb2YgUGluY2hSZWNvZ25pemVyXHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRzOiB7XHJcbiAgICAgICAgZXZlbnQ6ICd0YXAnLFxyXG4gICAgICAgIHBvaW50ZXJzOiAxLFxyXG4gICAgICAgIHRhcHM6IDEsXHJcbiAgICAgICAgaW50ZXJ2YWw6IDMwMCwgLy8gbWF4IHRpbWUgYmV0d2VlbiB0aGUgbXVsdGktdGFwIHRhcHNcclxuICAgICAgICB0aW1lOiAyNTAsIC8vIG1heCB0aW1lIG9mIHRoZSBwb2ludGVyIHRvIGJlIGRvd24gKGxpa2UgZmluZ2VyIG9uIHRoZSBzY3JlZW4pXHJcbiAgICAgICAgdGhyZXNob2xkOiAyLCAvLyBhIG1pbmltYWwgbW92ZW1lbnQgaXMgb2ssIGJ1dCBrZWVwIGl0IGxvd1xyXG4gICAgICAgIHBvc1RocmVzaG9sZDogMTAgLy8gYSBtdWx0aS10YXAgY2FuIGJlIGEgYml0IG9mZiB0aGUgaW5pdGlhbCBwb3NpdGlvblxyXG4gICAgfSxcclxuXHJcbiAgICBnZXRUb3VjaEFjdGlvbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIFtUT1VDSF9BQ1RJT05fTUFOSVBVTEFUSU9OXTtcclxuICAgIH0sXHJcblxyXG4gICAgcHJvY2VzczogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcclxuXHJcbiAgICAgICAgdmFyIHZhbGlkUG9pbnRlcnMgPSBpbnB1dC5wb2ludGVycy5sZW5ndGggPT09IG9wdGlvbnMucG9pbnRlcnM7XHJcbiAgICAgICAgdmFyIHZhbGlkTW92ZW1lbnQgPSBpbnB1dC5kaXN0YW5jZSA8IG9wdGlvbnMudGhyZXNob2xkO1xyXG4gICAgICAgIHZhciB2YWxpZFRvdWNoVGltZSA9IGlucHV0LmRlbHRhVGltZSA8IG9wdGlvbnMudGltZTtcclxuXHJcbiAgICAgICAgdGhpcy5yZXNldCgpO1xyXG5cclxuICAgICAgICBpZiAoKGlucHV0LmV2ZW50VHlwZSAmIElOUFVUX1NUQVJUKSAmJiAodGhpcy5jb3VudCA9PT0gMCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmFpbFRpbWVvdXQoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHdlIG9ubHkgYWxsb3cgbGl0dGxlIG1vdmVtZW50XHJcbiAgICAgICAgLy8gYW5kIHdlJ3ZlIHJlYWNoZWQgYW4gZW5kIGV2ZW50LCBzbyBhIHRhcCBpcyBwb3NzaWJsZVxyXG4gICAgICAgIGlmICh2YWxpZE1vdmVtZW50ICYmIHZhbGlkVG91Y2hUaW1lICYmIHZhbGlkUG9pbnRlcnMpIHtcclxuICAgICAgICAgICAgaWYgKGlucHV0LmV2ZW50VHlwZSAhPSBJTlBVVF9FTkQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmZhaWxUaW1lb3V0KCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciB2YWxpZEludGVydmFsID0gdGhpcy5wVGltZSA/IChpbnB1dC50aW1lU3RhbXAgLSB0aGlzLnBUaW1lIDwgb3B0aW9ucy5pbnRlcnZhbCkgOiB0cnVlO1xyXG4gICAgICAgICAgICB2YXIgdmFsaWRNdWx0aVRhcCA9ICF0aGlzLnBDZW50ZXIgfHwgZ2V0RGlzdGFuY2UodGhpcy5wQ2VudGVyLCBpbnB1dC5jZW50ZXIpIDwgb3B0aW9ucy5wb3NUaHJlc2hvbGQ7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnBUaW1lID0gaW5wdXQudGltZVN0YW1wO1xyXG4gICAgICAgICAgICB0aGlzLnBDZW50ZXIgPSBpbnB1dC5jZW50ZXI7XHJcblxyXG4gICAgICAgICAgICBpZiAoIXZhbGlkTXVsdGlUYXAgfHwgIXZhbGlkSW50ZXJ2YWwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY291bnQgPSAxO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb3VudCArPSAxO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9pbnB1dCA9IGlucHV0O1xyXG5cclxuICAgICAgICAgICAgLy8gaWYgdGFwIGNvdW50IG1hdGNoZXMgd2UgaGF2ZSByZWNvZ25pemVkIGl0LFxyXG4gICAgICAgICAgICAvLyBlbHNlIGl0IGhhcyBiZWdhbiByZWNvZ25pemluZy4uLlxyXG4gICAgICAgICAgICB2YXIgdGFwQ291bnQgPSB0aGlzLmNvdW50ICUgb3B0aW9ucy50YXBzO1xyXG4gICAgICAgICAgICBpZiAodGFwQ291bnQgPT09IDApIHtcclxuICAgICAgICAgICAgICAgIC8vIG5vIGZhaWxpbmcgcmVxdWlyZW1lbnRzLCBpbW1lZGlhdGVseSB0cmlnZ2VyIHRoZSB0YXAgZXZlbnRcclxuICAgICAgICAgICAgICAgIC8vIG9yIHdhaXQgYXMgbG9uZyBhcyB0aGUgbXVsdGl0YXAgaW50ZXJ2YWwgdG8gdHJpZ2dlclxyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhc1JlcXVpcmVGYWlsdXJlcygpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFNUQVRFX1JFQ09HTklaRUQ7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3RpbWVyID0gc2V0VGltZW91dENvbnRleHQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTVEFURV9SRUNPR05JWkVEO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRyeUVtaXQoKTtcclxuICAgICAgICAgICAgICAgICAgICB9LCBvcHRpb25zLmludGVydmFsLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU1RBVEVfQkVHQU47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFNUQVRFX0ZBSUxFRDtcclxuICAgIH0sXHJcblxyXG4gICAgZmFpbFRpbWVvdXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuX3RpbWVyID0gc2V0VGltZW91dENvbnRleHQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTVEFURV9GQUlMRUQ7XHJcbiAgICAgICAgfSwgdGhpcy5vcHRpb25zLmludGVydmFsLCB0aGlzKTtcclxuICAgICAgICByZXR1cm4gU1RBVEVfRkFJTEVEO1xyXG4gICAgfSxcclxuXHJcbiAgICByZXNldDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVyKTtcclxuICAgIH0sXHJcblxyXG4gICAgZW1pdDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT0gU1RBVEVfUkVDT0dOSVpFRCApIHtcclxuICAgICAgICAgICAgdGhpcy5faW5wdXQudGFwQ291bnQgPSB0aGlzLmNvdW50O1xyXG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuZW1pdCh0aGlzLm9wdGlvbnMuZXZlbnQsIHRoaXMuX2lucHV0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIFNpbXBsZSB3YXkgdG8gY3JlYXRlIGFuIG1hbmFnZXIgd2l0aCBhIGRlZmF1bHQgc2V0IG9mIHJlY29nbml6ZXJzLlxyXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtZW50XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBIYW1tZXIoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcbiAgICBvcHRpb25zLnJlY29nbml6ZXJzID0gaWZVbmRlZmluZWQob3B0aW9ucy5yZWNvZ25pemVycywgSGFtbWVyLmRlZmF1bHRzLnByZXNldCk7XHJcbiAgICByZXR1cm4gbmV3IE1hbmFnZXIoZWxlbWVudCwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBAY29uc3Qge3N0cmluZ31cclxuICovXHJcbkhhbW1lci5WRVJTSU9OID0gJzIuMC40JztcclxuXHJcbi8qKlxyXG4gKiBkZWZhdWx0IHNldHRpbmdzXHJcbiAqIEBuYW1lc3BhY2VcclxuICovXHJcbkhhbW1lci5kZWZhdWx0cyA9IHtcclxuICAgIC8qKlxyXG4gICAgICogc2V0IGlmIERPTSBldmVudHMgYXJlIGJlaW5nIHRyaWdnZXJlZC5cclxuICAgICAqIEJ1dCB0aGlzIGlzIHNsb3dlciBhbmQgdW51c2VkIGJ5IHNpbXBsZSBpbXBsZW1lbnRhdGlvbnMsIHNvIGRpc2FibGVkIGJ5IGRlZmF1bHQuXHJcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cclxuICAgICAqIEBkZWZhdWx0IGZhbHNlXHJcbiAgICAgKi9cclxuICAgIGRvbUV2ZW50czogZmFsc2UsXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgdmFsdWUgZm9yIHRoZSB0b3VjaEFjdGlvbiBwcm9wZXJ0eS9mYWxsYmFjay5cclxuICAgICAqIFdoZW4gc2V0IHRvIGBjb21wdXRlYCBpdCB3aWxsIG1hZ2ljYWxseSBzZXQgdGhlIGNvcnJlY3QgdmFsdWUgYmFzZWQgb24gdGhlIGFkZGVkIHJlY29nbml6ZXJzLlxyXG4gICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAqIEBkZWZhdWx0IGNvbXB1dGVcclxuICAgICAqL1xyXG4gICAgdG91Y2hBY3Rpb246IFRPVUNIX0FDVElPTl9DT01QVVRFLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHR5cGUge0Jvb2xlYW59XHJcbiAgICAgKiBAZGVmYXVsdCB0cnVlXHJcbiAgICAgKi9cclxuICAgIGVuYWJsZTogdHJ1ZSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEVYUEVSSU1FTlRBTCBGRUFUVVJFIC0tIGNhbiBiZSByZW1vdmVkL2NoYW5nZWRcclxuICAgICAqIENoYW5nZSB0aGUgcGFyZW50IGlucHV0IHRhcmdldCBlbGVtZW50LlxyXG4gICAgICogSWYgTnVsbCwgdGhlbiBpdCBpcyBiZWluZyBzZXQgdGhlIHRvIG1haW4gZWxlbWVudC5cclxuICAgICAqIEB0eXBlIHtOdWxsfEV2ZW50VGFyZ2V0fVxyXG4gICAgICogQGRlZmF1bHQgbnVsbFxyXG4gICAgICovXHJcbiAgICBpbnB1dFRhcmdldDogbnVsbCxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGZvcmNlIGFuIGlucHV0IGNsYXNzXHJcbiAgICAgKiBAdHlwZSB7TnVsbHxGdW5jdGlvbn1cclxuICAgICAqIEBkZWZhdWx0IG51bGxcclxuICAgICAqL1xyXG4gICAgaW5wdXRDbGFzczogbnVsbCxcclxuXHJcbiAgICAvKipcclxuICAgICAqIERlZmF1bHQgcmVjb2duaXplciBzZXR1cCB3aGVuIGNhbGxpbmcgYEhhbW1lcigpYFxyXG4gICAgICogV2hlbiBjcmVhdGluZyBhIG5ldyBNYW5hZ2VyIHRoZXNlIHdpbGwgYmUgc2tpcHBlZC5cclxuICAgICAqIEB0eXBlIHtBcnJheX1cclxuICAgICAqL1xyXG4gICAgcHJlc2V0OiBbXHJcbiAgICAgICAgLy8gUmVjb2duaXplckNsYXNzLCBvcHRpb25zLCBbcmVjb2duaXplV2l0aCwgLi4uXSwgW3JlcXVpcmVGYWlsdXJlLCAuLi5dXHJcbiAgICAgICAgW1JvdGF0ZVJlY29nbml6ZXIsIHsgZW5hYmxlOiBmYWxzZSB9XSxcclxuICAgICAgICBbUGluY2hSZWNvZ25pemVyLCB7IGVuYWJsZTogZmFsc2UgfSwgWydyb3RhdGUnXV0sXHJcbiAgICAgICAgW1N3aXBlUmVjb2duaXplcix7IGRpcmVjdGlvbjogRElSRUNUSU9OX0hPUklaT05UQUwgfV0sXHJcbiAgICAgICAgW1BhblJlY29nbml6ZXIsIHsgZGlyZWN0aW9uOiBESVJFQ1RJT05fSE9SSVpPTlRBTCB9LCBbJ3N3aXBlJ11dLFxyXG4gICAgICAgIFtUYXBSZWNvZ25pemVyXSxcclxuICAgICAgICBbVGFwUmVjb2duaXplciwgeyBldmVudDogJ2RvdWJsZXRhcCcsIHRhcHM6IDIgfSwgWyd0YXAnXV0sXHJcbiAgICAgICAgW1ByZXNzUmVjb2duaXplcl1cclxuICAgIF0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTb21lIENTUyBwcm9wZXJ0aWVzIGNhbiBiZSB1c2VkIHRvIGltcHJvdmUgdGhlIHdvcmtpbmcgb2YgSGFtbWVyLlxyXG4gICAgICogQWRkIHRoZW0gdG8gdGhpcyBtZXRob2QgYW5kIHRoZXkgd2lsbCBiZSBzZXQgd2hlbiBjcmVhdGluZyBhIG5ldyBNYW5hZ2VyLlxyXG4gICAgICogQG5hbWVzcGFjZVxyXG4gICAgICovXHJcbiAgICBjc3NQcm9wczoge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIERpc2FibGVzIHRleHQgc2VsZWN0aW9uIHRvIGltcHJvdmUgdGhlIGRyYWdnaW5nIGdlc3R1cmUuIE1haW5seSBmb3IgZGVza3RvcCBicm93c2Vycy5cclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqIEBkZWZhdWx0ICdub25lJ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHVzZXJTZWxlY3Q6ICdub25lJyxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRGlzYWJsZSB0aGUgV2luZG93cyBQaG9uZSBncmlwcGVycyB3aGVuIHByZXNzaW5nIGFuIGVsZW1lbnQuXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKiBAZGVmYXVsdCAnbm9uZSdcclxuICAgICAgICAgKi9cclxuICAgICAgICB0b3VjaFNlbGVjdDogJ25vbmUnLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBEaXNhYmxlcyB0aGUgZGVmYXVsdCBjYWxsb3V0IHNob3duIHdoZW4geW91IHRvdWNoIGFuZCBob2xkIGEgdG91Y2ggdGFyZ2V0LlxyXG4gICAgICAgICAqIE9uIGlPUywgd2hlbiB5b3UgdG91Y2ggYW5kIGhvbGQgYSB0b3VjaCB0YXJnZXQgc3VjaCBhcyBhIGxpbmssIFNhZmFyaSBkaXNwbGF5c1xyXG4gICAgICAgICAqIGEgY2FsbG91dCBjb250YWluaW5nIGluZm9ybWF0aW9uIGFib3V0IHRoZSBsaW5rLiBUaGlzIHByb3BlcnR5IGFsbG93cyB5b3UgdG8gZGlzYWJsZSB0aGF0IGNhbGxvdXQuXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKiBAZGVmYXVsdCAnbm9uZSdcclxuICAgICAgICAgKi9cclxuICAgICAgICB0b3VjaENhbGxvdXQ6ICdub25lJyxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU3BlY2lmaWVzIHdoZXRoZXIgem9vbWluZyBpcyBlbmFibGVkLiBVc2VkIGJ5IElFMTA+XHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKiBAZGVmYXVsdCAnbm9uZSdcclxuICAgICAgICAgKi9cclxuICAgICAgICBjb250ZW50Wm9vbWluZzogJ25vbmUnLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTcGVjaWZpZXMgdGhhdCBhbiBlbnRpcmUgZWxlbWVudCBzaG91bGQgYmUgZHJhZ2dhYmxlIGluc3RlYWQgb2YgaXRzIGNvbnRlbnRzLiBNYWlubHkgZm9yIGRlc2t0b3AgYnJvd3NlcnMuXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKiBAZGVmYXVsdCAnbm9uZSdcclxuICAgICAgICAgKi9cclxuICAgICAgICB1c2VyRHJhZzogJ25vbmUnLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBPdmVycmlkZXMgdGhlIGhpZ2hsaWdodCBjb2xvciBzaG93biB3aGVuIHRoZSB1c2VyIHRhcHMgYSBsaW5rIG9yIGEgSmF2YVNjcmlwdFxyXG4gICAgICAgICAqIGNsaWNrYWJsZSBlbGVtZW50IGluIGlPUy4gVGhpcyBwcm9wZXJ0eSBvYmV5cyB0aGUgYWxwaGEgdmFsdWUsIGlmIHNwZWNpZmllZC5cclxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICAgICAqIEBkZWZhdWx0ICdyZ2JhKDAsMCwwLDApJ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRhcEhpZ2hsaWdodENvbG9yOiAncmdiYSgwLDAsMCwwKSdcclxuICAgIH1cclxufTtcclxuXHJcbnZhciBTVE9QID0gMTtcclxudmFyIEZPUkNFRF9TVE9QID0gMjtcclxuXHJcbi8qKlxyXG4gKiBNYW5hZ2VyXHJcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnRcclxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIE1hbmFnZXIoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcblxyXG4gICAgdGhpcy5vcHRpb25zID0gbWVyZ2Uob3B0aW9ucywgSGFtbWVyLmRlZmF1bHRzKTtcclxuICAgIHRoaXMub3B0aW9ucy5pbnB1dFRhcmdldCA9IHRoaXMub3B0aW9ucy5pbnB1dFRhcmdldCB8fCBlbGVtZW50O1xyXG5cclxuICAgIHRoaXMuaGFuZGxlcnMgPSB7fTtcclxuICAgIHRoaXMuc2Vzc2lvbiA9IHt9O1xyXG4gICAgdGhpcy5yZWNvZ25pemVycyA9IFtdO1xyXG5cclxuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLmlucHV0ID0gY3JlYXRlSW5wdXRJbnN0YW5jZSh0aGlzKTtcclxuICAgIHRoaXMudG91Y2hBY3Rpb24gPSBuZXcgVG91Y2hBY3Rpb24odGhpcywgdGhpcy5vcHRpb25zLnRvdWNoQWN0aW9uKTtcclxuXHJcbiAgICB0b2dnbGVDc3NQcm9wcyh0aGlzLCB0cnVlKTtcclxuXHJcbiAgICBlYWNoKG9wdGlvbnMucmVjb2duaXplcnMsIGZ1bmN0aW9uKGl0ZW0pIHtcclxuICAgICAgICB2YXIgcmVjb2duaXplciA9IHRoaXMuYWRkKG5ldyAoaXRlbVswXSkoaXRlbVsxXSkpO1xyXG4gICAgICAgIGl0ZW1bMl0gJiYgcmVjb2duaXplci5yZWNvZ25pemVXaXRoKGl0ZW1bMl0pO1xyXG4gICAgICAgIGl0ZW1bM10gJiYgcmVjb2duaXplci5yZXF1aXJlRmFpbHVyZShpdGVtWzNdKTtcclxuICAgIH0sIHRoaXMpO1xyXG59XHJcblxyXG5NYW5hZ2VyLnByb3RvdHlwZSA9IHtcclxuICAgIC8qKlxyXG4gICAgICogc2V0IG9wdGlvbnNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXHJcbiAgICAgKiBAcmV0dXJucyB7TWFuYWdlcn1cclxuICAgICAqL1xyXG4gICAgc2V0OiBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgICAgICAgZXh0ZW5kKHRoaXMub3B0aW9ucywgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vIE9wdGlvbnMgdGhhdCBuZWVkIGEgbGl0dGxlIG1vcmUgc2V0dXBcclxuICAgICAgICBpZiAob3B0aW9ucy50b3VjaEFjdGlvbikge1xyXG4gICAgICAgICAgICB0aGlzLnRvdWNoQWN0aW9uLnVwZGF0ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAob3B0aW9ucy5pbnB1dFRhcmdldCkge1xyXG4gICAgICAgICAgICAvLyBDbGVhbiB1cCBleGlzdGluZyBldmVudCBsaXN0ZW5lcnMgYW5kIHJlaW5pdGlhbGl6ZVxyXG4gICAgICAgICAgICB0aGlzLmlucHV0LmRlc3Ryb3koKTtcclxuICAgICAgICAgICAgdGhpcy5pbnB1dC50YXJnZXQgPSBvcHRpb25zLmlucHV0VGFyZ2V0O1xyXG4gICAgICAgICAgICB0aGlzLmlucHV0LmluaXQoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogc3RvcCByZWNvZ25pemluZyBmb3IgdGhpcyBzZXNzaW9uLlxyXG4gICAgICogVGhpcyBzZXNzaW9uIHdpbGwgYmUgZGlzY2FyZGVkLCB3aGVuIGEgbmV3IFtpbnB1dF1zdGFydCBldmVudCBpcyBmaXJlZC5cclxuICAgICAqIFdoZW4gZm9yY2VkLCB0aGUgcmVjb2duaXplciBjeWNsZSBpcyBzdG9wcGVkIGltbWVkaWF0ZWx5LlxyXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbZm9yY2VdXHJcbiAgICAgKi9cclxuICAgIHN0b3A6IGZ1bmN0aW9uKGZvcmNlKSB7XHJcbiAgICAgICAgdGhpcy5zZXNzaW9uLnN0b3BwZWQgPSBmb3JjZSA/IEZPUkNFRF9TVE9QIDogU1RPUDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBydW4gdGhlIHJlY29nbml6ZXJzIVxyXG4gICAgICogY2FsbGVkIGJ5IHRoZSBpbnB1dEhhbmRsZXIgZnVuY3Rpb24gb24gZXZlcnkgbW92ZW1lbnQgb2YgdGhlIHBvaW50ZXJzICh0b3VjaGVzKVxyXG4gICAgICogaXQgd2Fsa3MgdGhyb3VnaCBhbGwgdGhlIHJlY29nbml6ZXJzIGFuZCB0cmllcyB0byBkZXRlY3QgdGhlIGdlc3R1cmUgdGhhdCBpcyBiZWluZyBtYWRlXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaW5wdXREYXRhXHJcbiAgICAgKi9cclxuICAgIHJlY29nbml6ZTogZnVuY3Rpb24oaW5wdXREYXRhKSB7XHJcbiAgICAgICAgdmFyIHNlc3Npb24gPSB0aGlzLnNlc3Npb247XHJcbiAgICAgICAgaWYgKHNlc3Npb24uc3RvcHBlZCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBydW4gdGhlIHRvdWNoLWFjdGlvbiBwb2x5ZmlsbFxyXG4gICAgICAgIHRoaXMudG91Y2hBY3Rpb24ucHJldmVudERlZmF1bHRzKGlucHV0RGF0YSk7XHJcblxyXG4gICAgICAgIHZhciByZWNvZ25pemVyO1xyXG4gICAgICAgIHZhciByZWNvZ25pemVycyA9IHRoaXMucmVjb2duaXplcnM7XHJcblxyXG4gICAgICAgIC8vIHRoaXMgaG9sZHMgdGhlIHJlY29nbml6ZXIgdGhhdCBpcyBiZWluZyByZWNvZ25pemVkLlxyXG4gICAgICAgIC8vIHNvIHRoZSByZWNvZ25pemVyJ3Mgc3RhdGUgbmVlZHMgdG8gYmUgQkVHQU4sIENIQU5HRUQsIEVOREVEIG9yIFJFQ09HTklaRURcclxuICAgICAgICAvLyBpZiBubyByZWNvZ25pemVyIGlzIGRldGVjdGluZyBhIHRoaW5nLCBpdCBpcyBzZXQgdG8gYG51bGxgXHJcbiAgICAgICAgdmFyIGN1clJlY29nbml6ZXIgPSBzZXNzaW9uLmN1clJlY29nbml6ZXI7XHJcblxyXG4gICAgICAgIC8vIHJlc2V0IHdoZW4gdGhlIGxhc3QgcmVjb2duaXplciBpcyByZWNvZ25pemVkXHJcbiAgICAgICAgLy8gb3Igd2hlbiB3ZSdyZSBpbiBhIG5ldyBzZXNzaW9uXHJcbiAgICAgICAgaWYgKCFjdXJSZWNvZ25pemVyIHx8IChjdXJSZWNvZ25pemVyICYmIGN1clJlY29nbml6ZXIuc3RhdGUgJiBTVEFURV9SRUNPR05JWkVEKSkge1xyXG4gICAgICAgICAgICBjdXJSZWNvZ25pemVyID0gc2Vzc2lvbi5jdXJSZWNvZ25pemVyID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBpID0gMDtcclxuICAgICAgICB3aGlsZSAoaSA8IHJlY29nbml6ZXJzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZWNvZ25pemVyID0gcmVjb2duaXplcnNbaV07XHJcblxyXG4gICAgICAgICAgICAvLyBmaW5kIG91dCBpZiB3ZSBhcmUgYWxsb3dlZCB0cnkgdG8gcmVjb2duaXplIHRoZSBpbnB1dCBmb3IgdGhpcyBvbmUuXHJcbiAgICAgICAgICAgIC8vIDEuICAgYWxsb3cgaWYgdGhlIHNlc3Npb24gaXMgTk9UIGZvcmNlZCBzdG9wcGVkIChzZWUgdGhlIC5zdG9wKCkgbWV0aG9kKVxyXG4gICAgICAgICAgICAvLyAyLiAgIGFsbG93IGlmIHdlIHN0aWxsIGhhdmVuJ3QgcmVjb2duaXplZCBhIGdlc3R1cmUgaW4gdGhpcyBzZXNzaW9uLCBvciB0aGUgdGhpcyByZWNvZ25pemVyIGlzIHRoZSBvbmVcclxuICAgICAgICAgICAgLy8gICAgICB0aGF0IGlzIGJlaW5nIHJlY29nbml6ZWQuXHJcbiAgICAgICAgICAgIC8vIDMuICAgYWxsb3cgaWYgdGhlIHJlY29nbml6ZXIgaXMgYWxsb3dlZCB0byBydW4gc2ltdWx0YW5lb3VzIHdpdGggdGhlIGN1cnJlbnQgcmVjb2duaXplZCByZWNvZ25pemVyLlxyXG4gICAgICAgICAgICAvLyAgICAgIHRoaXMgY2FuIGJlIHNldHVwIHdpdGggdGhlIGByZWNvZ25pemVXaXRoKClgIG1ldGhvZCBvbiB0aGUgcmVjb2duaXplci5cclxuICAgICAgICAgICAgaWYgKHNlc3Npb24uc3RvcHBlZCAhPT0gRk9SQ0VEX1NUT1AgJiYgKCAvLyAxXHJcbiAgICAgICAgICAgICAgICAgICAgIWN1clJlY29nbml6ZXIgfHwgcmVjb2duaXplciA9PSBjdXJSZWNvZ25pemVyIHx8IC8vIDJcclxuICAgICAgICAgICAgICAgICAgICByZWNvZ25pemVyLmNhblJlY29nbml6ZVdpdGgoY3VyUmVjb2duaXplcikpKSB7IC8vIDNcclxuICAgICAgICAgICAgICAgIHJlY29nbml6ZXIucmVjb2duaXplKGlucHV0RGF0YSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZWNvZ25pemVyLnJlc2V0KCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGlmIHRoZSByZWNvZ25pemVyIGhhcyBiZWVuIHJlY29nbml6aW5nIHRoZSBpbnB1dCBhcyBhIHZhbGlkIGdlc3R1cmUsIHdlIHdhbnQgdG8gc3RvcmUgdGhpcyBvbmUgYXMgdGhlXHJcbiAgICAgICAgICAgIC8vIGN1cnJlbnQgYWN0aXZlIHJlY29nbml6ZXIuIGJ1dCBvbmx5IGlmIHdlIGRvbid0IGFscmVhZHkgaGF2ZSBhbiBhY3RpdmUgcmVjb2duaXplclxyXG4gICAgICAgICAgICBpZiAoIWN1clJlY29nbml6ZXIgJiYgcmVjb2duaXplci5zdGF0ZSAmIChTVEFURV9CRUdBTiB8IFNUQVRFX0NIQU5HRUQgfCBTVEFURV9FTkRFRCkpIHtcclxuICAgICAgICAgICAgICAgIGN1clJlY29nbml6ZXIgPSBzZXNzaW9uLmN1clJlY29nbml6ZXIgPSByZWNvZ25pemVyO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGkrKztcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogZ2V0IGEgcmVjb2duaXplciBieSBpdHMgZXZlbnQgbmFtZS5cclxuICAgICAqIEBwYXJhbSB7UmVjb2duaXplcnxTdHJpbmd9IHJlY29nbml6ZXJcclxuICAgICAqIEByZXR1cm5zIHtSZWNvZ25pemVyfE51bGx9XHJcbiAgICAgKi9cclxuICAgIGdldDogZnVuY3Rpb24ocmVjb2duaXplcikge1xyXG4gICAgICAgIGlmIChyZWNvZ25pemVyIGluc3RhbmNlb2YgUmVjb2duaXplcikge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVjb2duaXplcjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciByZWNvZ25pemVycyA9IHRoaXMucmVjb2duaXplcnM7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWNvZ25pemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAocmVjb2duaXplcnNbaV0ub3B0aW9ucy5ldmVudCA9PSByZWNvZ25pemVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVjb2duaXplcnNbaV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogYWRkIGEgcmVjb2duaXplciB0byB0aGUgbWFuYWdlclxyXG4gICAgICogZXhpc3RpbmcgcmVjb2duaXplcnMgd2l0aCB0aGUgc2FtZSBldmVudCBuYW1lIHdpbGwgYmUgcmVtb3ZlZFxyXG4gICAgICogQHBhcmFtIHtSZWNvZ25pemVyfSByZWNvZ25pemVyXHJcbiAgICAgKiBAcmV0dXJucyB7UmVjb2duaXplcnxNYW5hZ2VyfVxyXG4gICAgICovXHJcbiAgICBhZGQ6IGZ1bmN0aW9uKHJlY29nbml6ZXIpIHtcclxuICAgICAgICBpZiAoaW52b2tlQXJyYXlBcmcocmVjb2duaXplciwgJ2FkZCcsIHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nXHJcbiAgICAgICAgdmFyIGV4aXN0aW5nID0gdGhpcy5nZXQocmVjb2duaXplci5vcHRpb25zLmV2ZW50KTtcclxuICAgICAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZXhpc3RpbmcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5yZWNvZ25pemVycy5wdXNoKHJlY29nbml6ZXIpO1xyXG4gICAgICAgIHJlY29nbml6ZXIubWFuYWdlciA9IHRoaXM7XHJcblxyXG4gICAgICAgIHRoaXMudG91Y2hBY3Rpb24udXBkYXRlKCk7XHJcbiAgICAgICAgcmV0dXJuIHJlY29nbml6ZXI7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmVtb3ZlIGEgcmVjb2duaXplciBieSBuYW1lIG9yIGluc3RhbmNlXHJcbiAgICAgKiBAcGFyYW0ge1JlY29nbml6ZXJ8U3RyaW5nfSByZWNvZ25pemVyXHJcbiAgICAgKiBAcmV0dXJucyB7TWFuYWdlcn1cclxuICAgICAqL1xyXG4gICAgcmVtb3ZlOiBmdW5jdGlvbihyZWNvZ25pemVyKSB7XHJcbiAgICAgICAgaWYgKGludm9rZUFycmF5QXJnKHJlY29nbml6ZXIsICdyZW1vdmUnLCB0aGlzKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciByZWNvZ25pemVycyA9IHRoaXMucmVjb2duaXplcnM7XHJcbiAgICAgICAgcmVjb2duaXplciA9IHRoaXMuZ2V0KHJlY29nbml6ZXIpO1xyXG4gICAgICAgIHJlY29nbml6ZXJzLnNwbGljZShpbkFycmF5KHJlY29nbml6ZXJzLCByZWNvZ25pemVyKSwgMSk7XHJcblxyXG4gICAgICAgIHRoaXMudG91Y2hBY3Rpb24udXBkYXRlKCk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogYmluZCBldmVudFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50c1xyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlclxyXG4gICAgICogQHJldHVybnMge0V2ZW50RW1pdHRlcn0gdGhpc1xyXG4gICAgICovXHJcbiAgICBvbjogZnVuY3Rpb24oZXZlbnRzLCBoYW5kbGVyKSB7XHJcbiAgICAgICAgdmFyIGhhbmRsZXJzID0gdGhpcy5oYW5kbGVycztcclxuICAgICAgICBlYWNoKHNwbGl0U3RyKGV2ZW50cyksIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICAgICAgICAgIGhhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXJzW2V2ZW50XSB8fCBbXTtcclxuICAgICAgICAgICAgaGFuZGxlcnNbZXZlbnRdLnB1c2goaGFuZGxlcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogdW5iaW5kIGV2ZW50LCBsZWF2ZSBlbWl0IGJsYW5rIHRvIHJlbW92ZSBhbGwgaGFuZGxlcnNcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudHNcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtoYW5kbGVyXVxyXG4gICAgICogQHJldHVybnMge0V2ZW50RW1pdHRlcn0gdGhpc1xyXG4gICAgICovXHJcbiAgICBvZmY6IGZ1bmN0aW9uKGV2ZW50cywgaGFuZGxlcikge1xyXG4gICAgICAgIHZhciBoYW5kbGVycyA9IHRoaXMuaGFuZGxlcnM7XHJcbiAgICAgICAgZWFjaChzcGxpdFN0cihldmVudHMpLCBmdW5jdGlvbihldmVudCkge1xyXG4gICAgICAgICAgICBpZiAoIWhhbmRsZXIpIHtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSBoYW5kbGVyc1tldmVudF07XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyc1tldmVudF0uc3BsaWNlKGluQXJyYXkoaGFuZGxlcnNbZXZlbnRdLCBoYW5kbGVyKSwgMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBlbWl0IGV2ZW50IHRvIHRoZSBsaXN0ZW5lcnNcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGFcclxuICAgICAqL1xyXG4gICAgZW1pdDogZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcclxuICAgICAgICAvLyB3ZSBhbHNvIHdhbnQgdG8gdHJpZ2dlciBkb20gZXZlbnRzXHJcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5kb21FdmVudHMpIHtcclxuICAgICAgICAgICAgdHJpZ2dlckRvbUV2ZW50KGV2ZW50LCBkYXRhKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIG5vIGhhbmRsZXJzLCBzbyBza2lwIGl0IGFsbFxyXG4gICAgICAgIHZhciBoYW5kbGVycyA9IHRoaXMuaGFuZGxlcnNbZXZlbnRdICYmIHRoaXMuaGFuZGxlcnNbZXZlbnRdLnNsaWNlKCk7XHJcbiAgICAgICAgaWYgKCFoYW5kbGVycyB8fCAhaGFuZGxlcnMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRhdGEudHlwZSA9IGV2ZW50O1xyXG4gICAgICAgIGRhdGEucHJldmVudERlZmF1bHQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgZGF0YS5zcmNFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHZhciBpID0gMDtcclxuICAgICAgICB3aGlsZSAoaSA8IGhhbmRsZXJzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBoYW5kbGVyc1tpXShkYXRhKTtcclxuICAgICAgICAgICAgaSsrO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBkZXN0cm95IHRoZSBtYW5hZ2VyIGFuZCB1bmJpbmRzIGFsbCBldmVudHNcclxuICAgICAqIGl0IGRvZXNuJ3QgdW5iaW5kIGRvbSBldmVudHMsIHRoYXQgaXMgdGhlIHVzZXIgb3duIHJlc3BvbnNpYmlsaXR5XHJcbiAgICAgKi9cclxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCAmJiB0b2dnbGVDc3NQcm9wcyh0aGlzLCBmYWxzZSk7XHJcblxyXG4gICAgICAgIHRoaXMuaGFuZGxlcnMgPSB7fTtcclxuICAgICAgICB0aGlzLnNlc3Npb24gPSB7fTtcclxuICAgICAgICB0aGlzLmlucHV0LmRlc3Ryb3koKTtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBudWxsO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIGFkZC9yZW1vdmUgdGhlIGNzcyBwcm9wZXJ0aWVzIGFzIGRlZmluZWQgaW4gbWFuYWdlci5vcHRpb25zLmNzc1Byb3BzXHJcbiAqIEBwYXJhbSB7TWFuYWdlcn0gbWFuYWdlclxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGFkZFxyXG4gKi9cclxuZnVuY3Rpb24gdG9nZ2xlQ3NzUHJvcHMobWFuYWdlciwgYWRkKSB7XHJcbiAgICB2YXIgZWxlbWVudCA9IG1hbmFnZXIuZWxlbWVudDtcclxuICAgIGVhY2gobWFuYWdlci5vcHRpb25zLmNzc1Byb3BzLCBmdW5jdGlvbih2YWx1ZSwgbmFtZSkge1xyXG4gICAgICAgIGVsZW1lbnQuc3R5bGVbcHJlZml4ZWQoZWxlbWVudC5zdHlsZSwgbmFtZSldID0gYWRkID8gdmFsdWUgOiAnJztcclxuICAgIH0pO1xyXG59XHJcblxyXG4vKipcclxuICogdHJpZ2dlciBkb20gZXZlbnRcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXHJcbiAqL1xyXG5mdW5jdGlvbiB0cmlnZ2VyRG9tRXZlbnQoZXZlbnQsIGRhdGEpIHtcclxuICAgIHZhciBnZXN0dXJlRXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnRXZlbnQnKTtcclxuICAgIGdlc3R1cmVFdmVudC5pbml0RXZlbnQoZXZlbnQsIHRydWUsIHRydWUpO1xyXG4gICAgZ2VzdHVyZUV2ZW50Lmdlc3R1cmUgPSBkYXRhO1xyXG4gICAgZGF0YS50YXJnZXQuZGlzcGF0Y2hFdmVudChnZXN0dXJlRXZlbnQpO1xyXG59XHJcblxyXG5leHRlbmQoSGFtbWVyLCB7XHJcbiAgICBJTlBVVF9TVEFSVDogSU5QVVRfU1RBUlQsXHJcbiAgICBJTlBVVF9NT1ZFOiBJTlBVVF9NT1ZFLFxyXG4gICAgSU5QVVRfRU5EOiBJTlBVVF9FTkQsXHJcbiAgICBJTlBVVF9DQU5DRUw6IElOUFVUX0NBTkNFTCxcclxuXHJcbiAgICBTVEFURV9QT1NTSUJMRTogU1RBVEVfUE9TU0lCTEUsXHJcbiAgICBTVEFURV9CRUdBTjogU1RBVEVfQkVHQU4sXHJcbiAgICBTVEFURV9DSEFOR0VEOiBTVEFURV9DSEFOR0VELFxyXG4gICAgU1RBVEVfRU5ERUQ6IFNUQVRFX0VOREVELFxyXG4gICAgU1RBVEVfUkVDT0dOSVpFRDogU1RBVEVfUkVDT0dOSVpFRCxcclxuICAgIFNUQVRFX0NBTkNFTExFRDogU1RBVEVfQ0FOQ0VMTEVELFxyXG4gICAgU1RBVEVfRkFJTEVEOiBTVEFURV9GQUlMRUQsXHJcblxyXG4gICAgRElSRUNUSU9OX05PTkU6IERJUkVDVElPTl9OT05FLFxyXG4gICAgRElSRUNUSU9OX0xFRlQ6IERJUkVDVElPTl9MRUZULFxyXG4gICAgRElSRUNUSU9OX1JJR0hUOiBESVJFQ1RJT05fUklHSFQsXHJcbiAgICBESVJFQ1RJT05fVVA6IERJUkVDVElPTl9VUCxcclxuICAgIERJUkVDVElPTl9ET1dOOiBESVJFQ1RJT05fRE9XTixcclxuICAgIERJUkVDVElPTl9IT1JJWk9OVEFMOiBESVJFQ1RJT05fSE9SSVpPTlRBTCxcclxuICAgIERJUkVDVElPTl9WRVJUSUNBTDogRElSRUNUSU9OX1ZFUlRJQ0FMLFxyXG4gICAgRElSRUNUSU9OX0FMTDogRElSRUNUSU9OX0FMTCxcclxuXHJcbiAgICBNYW5hZ2VyOiBNYW5hZ2VyLFxyXG4gICAgSW5wdXQ6IElucHV0LFxyXG4gICAgVG91Y2hBY3Rpb246IFRvdWNoQWN0aW9uLFxyXG5cclxuICAgIFRvdWNoSW5wdXQ6IFRvdWNoSW5wdXQsXHJcbiAgICBNb3VzZUlucHV0OiBNb3VzZUlucHV0LFxyXG4gICAgUG9pbnRlckV2ZW50SW5wdXQ6IFBvaW50ZXJFdmVudElucHV0LFxyXG4gICAgVG91Y2hNb3VzZUlucHV0OiBUb3VjaE1vdXNlSW5wdXQsXHJcbiAgICBTaW5nbGVUb3VjaElucHV0OiBTaW5nbGVUb3VjaElucHV0LFxyXG5cclxuICAgIFJlY29nbml6ZXI6IFJlY29nbml6ZXIsXHJcbiAgICBBdHRyUmVjb2duaXplcjogQXR0clJlY29nbml6ZXIsXHJcbiAgICBUYXA6IFRhcFJlY29nbml6ZXIsXHJcbiAgICBQYW46IFBhblJlY29nbml6ZXIsXHJcbiAgICBTd2lwZTogU3dpcGVSZWNvZ25pemVyLFxyXG4gICAgUGluY2g6IFBpbmNoUmVjb2duaXplcixcclxuICAgIFJvdGF0ZTogUm90YXRlUmVjb2duaXplcixcclxuICAgIFByZXNzOiBQcmVzc1JlY29nbml6ZXIsXHJcblxyXG4gICAgb246IGFkZEV2ZW50TGlzdGVuZXJzLFxyXG4gICAgb2ZmOiByZW1vdmVFdmVudExpc3RlbmVycyxcclxuICAgIGVhY2g6IGVhY2gsXHJcbiAgICBtZXJnZTogbWVyZ2UsXHJcbiAgICBleHRlbmQ6IGV4dGVuZCxcclxuICAgIGluaGVyaXQ6IGluaGVyaXQsXHJcbiAgICBiaW5kRm46IGJpbmRGbixcclxuICAgIHByZWZpeGVkOiBwcmVmaXhlZFxyXG59KTtcclxuXHJcbmlmICh0eXBlb2YgZGVmaW5lID09IFRZUEVfRlVOQ1RJT04gJiYgZGVmaW5lLmFtZCkge1xyXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBIYW1tZXI7XHJcbiAgICB9KTtcclxufSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEhhbW1lcjtcclxufSBlbHNlIHtcclxuICAgIHdpbmRvd1tleHBvcnROYW1lXSA9IEhhbW1lcjtcclxufVxyXG5cclxufSkod2luZG93LCBkb2N1bWVudCwgJ0hhbW1lcicpO1xyXG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIFRvT2JqZWN0KHZhbCkge1xuXHRpZiAodmFsID09IG51bGwpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdPYmplY3QuYXNzaWduIGNhbm5vdCBiZSBjYWxsZWQgd2l0aCBudWxsIG9yIHVuZGVmaW5lZCcpO1xuXHR9XG5cblx0cmV0dXJuIE9iamVjdCh2YWwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCwgc291cmNlKSB7XG5cdHZhciBwZW5kaW5nRXhjZXB0aW9uO1xuXHR2YXIgZnJvbTtcblx0dmFyIGtleXM7XG5cdHZhciB0byA9IFRvT2JqZWN0KHRhcmdldCk7XG5cblx0Zm9yICh2YXIgcyA9IDE7IHMgPCBhcmd1bWVudHMubGVuZ3RoOyBzKyspIHtcblx0XHRmcm9tID0gYXJndW1lbnRzW3NdO1xuXHRcdGtleXMgPSBPYmplY3Qua2V5cyhPYmplY3QoZnJvbSkpO1xuXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0b1trZXlzW2ldXSA9IGZyb21ba2V5c1tpXV07XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0aWYgKHBlbmRpbmdFeGNlcHRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHBlbmRpbmdFeGNlcHRpb24gPSBlcnI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAocGVuZGluZ0V4Y2VwdGlvbikge1xuXHRcdHRocm93IHBlbmRpbmdFeGNlcHRpb247XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuIiwidmFyIENhbnZhc1ZpZXcgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvQ2FudmFzVmlldy5qcycpO1xudmFyIEZpcmViYXNlVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzL0ZpcmViYXNlVXRpbHMnKTtcblxud2luZG93Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICBDYW52YXNWaWV3LmxvYWQoKTtcbiAgRmlyZWJhc2VVdGlscy5pbml0KCk7XG59IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cblxudmFyIENhbnZhc0FwcERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi9kaXNwYXRjaGVyL0NhbnZhc0FwcERpc3BhdGNoZXInKTtcbnZhciBOb3Rlc1N0b3JlID0gcmVxdWlyZSgnLi4vc3RvcmVzL05vdGVzU3RvcmUnKTtcbnZhciBEcmFnRWxlbWVudFN0b3JlID0gcmVxdWlyZSgnLi4vc3RvcmVzL0RyYWdFbGVtZW50U3RvcmUnKTtcbnZhciBIYW1tZXIgPSByZXF1aXJlKCdoYW1tZXJqcycpO1xudmFyIFRyYW5zZm9ybVN0b3JlID0gcmVxdWlyZSgnLi4vc3RvcmVzL1RyYW5zZm9ybVN0b3JlJyk7XG52YXIgX2dldFJlbGF0aXZlTGVmdFRvcCA9IHJlcXVpcmUoJy4uL3V0aWxzL0dldFJlbGF0aXZlTGVmdFRvcC5qcycpO1xuXG52YXIgRm9jdXNWaWV3ID0gcmVxdWlyZSgnLi9Gb2N1c1ZpZXcnKTtcblxudmFyIF90cmFuc2Zvcm07XG52YXIgX3RyYW5zZm9ybVByZXZpb3VzID0ge3RyYW5zbGF0ZVg6IDAsIHRyYW5zbGF0ZVk6MCwgc2NhbGU6IDF9O1xudmFyIF9ub3RlcztcbnZhciBfbm90ZTsgIC8vIG1vc3QgcmVjZW50bHkgYWRkZWQgb3IgdXBkYXRlZCBub3RlXG52YXIgX3RpbWVyID0ge2F2ZXJhZ2U6IDAsIGNvdW50OiAwLCBzdGFydDogMH07XG5cblxuZnVuY3Rpb24gX3VwZGF0ZVN0YXRlRnJvbVN0b3JlcygpIHtcbiAgX3RyYW5zZm9ybSA9IFRyYW5zZm9ybVN0b3JlLmdldCgpO1xuICBfbm90ZXMgPSBOb3Rlc1N0b3JlLmdldEFsbCgpO1xufTtcblxudmFyIENhbnZhc1ZpZXcgPSB7XG4gICAgXG4gICAgY2FudmFzOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJyksXG5cbiAgICBjdHg6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW52YXMnKS5nZXRDb250ZXh0KCcyZCcpLFxuICAgIFxuICAgIGxvYWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5yZXNpemVDYW52YXMoKTtcbiAgICAgIHRoaXMuYWRkVG91Y2hFdmVudExpc3RlbmVycygpO1xuICAgICAgdGhpcy5hZGRTdG9yZUxpc3RlbmVycygpO1xuICAgICAgdGhpcy5hZGRXaW5kb3dSZXNpemVMaXN0ZW5lcigpO1xuICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICAgIEZvY3VzVmlldy5pbml0KCk7XG4gICAgfSxcblxuICAgIGFkZFdpbmRvd1Jlc2l6ZUxpc3RlbmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIHdpbmRvdy5vbnJlc2l6ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnJlc2l6ZUNhbnZhcztcbiAgICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICAgIH0uYmluZCh0aGlzKTtcbiAgICB9LFxuXG4gICAgYWRkVG91Y2hFdmVudExpc3RlbmVyczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmhhbW1lciA9IG5ldyBIYW1tZXIuTWFuYWdlcih0aGlzLmNhbnZhcyk7XG4gICAgICB0aGlzLmhhbW1lci5hZGQobmV3IEhhbW1lci5UYXAoKSk7XG4gICAgICB0aGlzLmhhbW1lci5hZGQobmV3IEhhbW1lci5QYW4oe3RocmVzaG9sZDowfSkpO1xuICAgICAgdGhpcy5oYW1tZXIuYWRkKG5ldyBIYW1tZXIuUHJlc3Moe2V2ZW50OiAncHJlc3NPbmVGaW5nZXInLCBwb2ludGVyczogMSwgdGltZTowfSkpO1xuICAgICAgdGhpcy5oYW1tZXIuYWRkKG5ldyBIYW1tZXIuUHJlc3Moe2V2ZW50OiAncHJlc3NUd29GaW5nZXJzJywgcG9pbnRlcnM6IDIsIHRpbWU6MH0pKTtcbiAgICAgIHRoaXMuaGFtbWVyLmFkZChuZXcgSGFtbWVyLlBpbmNoKCkpO1xuICAgICAgdGhpcy5oYW1tZXIub24oJ3ByZXNzT25lRmluZ2VyIHByZXNzVHdvRmluZ2VycyBwaW5jaCBwYW4nLCBmdW5jdGlvbihoYW1tZXJFdmVudCkge1xuICAgICAgICBDYW52YXNBcHBEaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAgICAgICAgICBhY3Rpb25UeXBlOiBoYW1tZXJFdmVudC50eXBlLFxuICAgICAgICAgIGhhbW1lckV2ZW50OiBoYW1tZXJFdmVudCxcbiAgICAgICAgICAvLyB1dGlsczoge19nZXRSZWxhdGl2ZUxlZnRUb3A6IF9nZXRSZWxhdGl2ZUxlZnRUb3AuYmluZChDYW52YXNWaWV3LmNhbnZhcyl9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuaGFtbWVyLm9uKCd0YXAnLCBmdW5jdGlvbihoYW1tZXJFdmVudCkge1xuICAgICAgICBpZihoYW1tZXJFdmVudC50YXBDb3VudCA9PT0gMSkge1xuICAgICAgICAgIENhbnZhc0FwcERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICAgICAgICAgICAgYWN0aW9uVHlwZTogJ3RhcFNpbmdsZScsXG4gICAgICAgICAgICBoYW1tZXJFdmVudDogaGFtbWVyRXZlbnRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmKGhhbW1lckV2ZW50LnRhcENvdW50ID09PSAyKSB7XG4gICAgICAgICAgQ2FudmFzQXBwRGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gICAgICAgICAgICBhY3Rpb25UeXBlOiAndGFwRG91YmxlJyxcbiAgICAgICAgICAgIGhhbW1lckV2ZW50OiBoYW1tZXJFdmVudFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V3aGVlbCcsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIENhbnZhc0FwcERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICAgICAgICAgIGFjdGlvblR5cGU6ICdtb3VzZXdoZWVsJyxcbiAgICAgICAgICBldmVudDogZXZlbnRcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgYWRkU3RvcmVMaXN0ZW5lcnM6IGZ1bmN0aW9uKCkge1xuICAgICAgXG4gICAgICBOb3Rlc1N0b3JlLmFkZENoYW5nZUxpc3RlbmVyKCdhZGRlZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICBfdXBkYXRlU3RhdGVGcm9tU3RvcmVzKCk7XG4gICAgICAgIF9ub3RlID0gTm90ZXNTdG9yZS5nZXRNb3N0UmVjZW50KCk7ICBcbiAgICAgICAgQ2FudmFzVmlldy5yZW5kZXJOb3RlKCk7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgRHJhZ0VsZW1lbnRTdG9yZS5hZGRDaGFuZ2VMaXN0ZW5lcignZHJhZ2dlZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICBfbm90ZSA9IERyYWdFbGVtZW50U3RvcmUuZ2V0KCk7ICBcbiAgICAgICAgQ2FudmFzVmlldy5yZW5kZXIoKTtcbiAgICAgIH0pO1xuXG4gICAgICBUcmFuc2Zvcm1TdG9yZS5hZGRDaGFuZ2VMaXN0ZW5lcignY2hhbmdlZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICBDYW52YXNWaWV3LnJlbmRlcigpO1xuICAgICAgfSlcbiAgICB9LFxuXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh3aW5kb3cucGVyZm9ybWFuY2UpIF90aW1lci5zdGFydCA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIF91cGRhdGVTdGF0ZUZyb21TdG9yZXMoKTtcbiAgICAgIHRoaXMuc2V0Q2FudmFzVHJhbnNsYXRpb24oKTtcbiAgICAgIGZvcih2YXIga2V5IGluIF9ub3Rlcykge1xuICAgICAgICBDYW52YXNWaWV3LnJlbmRlck5vdGUoX25vdGVzW2tleV0pO1xuICAgICAgfVxuICAgICAgaWYgKHdpbmRvdy5wZXJmb3JtYW5jZSkgX3RpbWVyLmF2ZXJhZ2UgPSAoX3RpbWVyLmF2ZXJhZ2UgKiBfdGltZXIuY291bnQgKyB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCkgLSBfdGltZXIuc3RhcnQpIC8gKCsrX3RpbWVyLmNvdW50KTtcbiAgICAgIGNvbnNvbGUubG9nKFwiYXZlcmFnZSByZW5kZXIgZHVyYXRpb246IFwiLCBfdGltZXIuYXZlcmFnZSk7XG4gICAgfSxcblxuICAgIHNldENhbnZhc1RyYW5zbGF0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY3R4LnRyYW5zbGF0ZShNYXRoLnJvdW5kKC1fdHJhbnNmb3JtUHJldmlvdXMudHJhbnNsYXRlWCAqIF90cmFuc2Zvcm1QcmV2aW91cy5zY2FsZSksIE1hdGgucm91bmQoLV90cmFuc2Zvcm1QcmV2aW91cy50cmFuc2xhdGVZICogX3RyYW5zZm9ybVByZXZpb3VzLnNjYWxlKSk7XG4gICAgICB0aGlzLmN0eC5jbGVhclJlY3QoMCwwLHRoaXMuY2FudmFzLndpZHRoLCB0aGlzLmNhbnZhcy5oZWlnaHQpO1xuICAgICAgdGhpcy5jdHgudHJhbnNsYXRlKE1hdGgucm91bmQoX3RyYW5zZm9ybS50cmFuc2xhdGVYICogX3RyYW5zZm9ybS5zY2FsZSksIE1hdGgucm91bmQoX3RyYW5zZm9ybS50cmFuc2xhdGVZICogX3RyYW5zZm9ybS5zY2FsZSkpO1xuICAgICAgX3RyYW5zZm9ybVByZXZpb3VzID0ge3RyYW5zbGF0ZVg6IF90cmFuc2Zvcm0udHJhbnNsYXRlWCwgdHJhbnNsYXRlWTogX3RyYW5zZm9ybS50cmFuc2xhdGVZLCBzY2FsZTogX3RyYW5zZm9ybS5zY2FsZX07XG4gICAgfSxcblxuICAgIHJlbmRlck5vdGU6IGZ1bmN0aW9uKG5vdGUpIHtcbiAgICAgIG5vdGUgPSBub3RlIHx8IF9ub3RlO1xuICAgICAgdmFyIGxlZnQgPSBNYXRoLnJvdW5kKG5vdGUuZGF0YS54ICogX3RyYW5zZm9ybS5zY2FsZSk7XG4gICAgICB2YXIgdG9wID0gTWF0aC5yb3VuZChub3RlLmRhdGEueSAqIF90cmFuc2Zvcm0uc2NhbGUpO1xuICAgICAgQ2FudmFzVmlldy5yZW5kZXJTaGFwZShub3RlLCBsZWZ0LCB0b3ApO1xuICAgICAgQ2FudmFzVmlldy5yZW5kZXJUZXh0KG5vdGUsIGxlZnQsIHRvcCk7XG4gICAgfSxcblxuICAgIHJlbmRlclNoYXBlOiBmdW5jdGlvbihub3RlLCBsZWZ0LCB0b3ApIHtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICdyZ2JhKDIwMCwwLDAsMC41KSc7XG4gICAgICB0aGlzLmN0eC5maWxsUmVjdC5hcHBseSh0aGlzLmN0eCwgW2xlZnQsIHRvcCwgTWF0aC5yb3VuZChub3RlLnN0eWxlLndpZHRoICogX3RyYW5zZm9ybS5zY2FsZSksIE1hdGgucm91bmQobm90ZS5zdHlsZS5oZWlnaHQgKiBfdHJhbnNmb3JtLnNjYWxlKV0pO1xuICAgIH0sXG5cbiAgICByZW5kZXJUZXh0OiBmdW5jdGlvbihub3RlLCBsZWZ0LCB0b3ApIHtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IFwiYmx1ZVwiO1xuICAgICAgdGhpcy5jdHguZm9udCA9IE1hdGgucm91bmQoMTIgKiBfdHJhbnNmb3JtLnNjYWxlKSArIFwicHggQXJpYWxcIjtcbiAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBub3RlLmRhdGEudGV4dEFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAvLyB0aGlzLmN0eC5maWxsVGV4dChcIiBcIiArIG5vdGUuZGF0YS50ZXh0QXJyW2ldLCBsZWZ0LCB0b3AgKyAoMTIgKiAoaSArIDIpIC0gNikgKTtcbiAgICAgICAgdGhpcy5jdHguZmlsbFRleHQoXCIgXCIgKyBub3RlLmRhdGEudGV4dEFycltpXSwgbGVmdCwgTWF0aC5yb3VuZCh0b3AgKyAoMTIgKiAoaSArIDIpIC0gNikgKiBfdHJhbnNmb3JtLnNjYWxlKSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIHJlc2l6ZUNhbnZhczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNhbnZhcy53aWR0aCAgPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICB9LFxuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FudmFzVmlldztcbiIsIi8vIEZvY3VzVmlldy5qc1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBGb2N1c1N0b3JlID0gcmVxdWlyZSgnLi4vc3RvcmVzL0ZvY3VzU3RvcmUnKTtcbnZhciBUcmFuc2Zvcm1TdG9yZSA9IHJlcXVpcmUoJy4uL3N0b3Jlcy9UcmFuc2Zvcm1TdG9yZScpO1xuXG52YXIgX3RyYW5zZm9ybTtcbnZhciBfdGV4dGFyZWFFbGVtZW50O1xuXG5mdW5jdGlvbiBfdXBkYXRlU3RhdGVGcm9tU3RvcmVzKCkge1xuICBfdHJhbnNmb3JtID0gVHJhbnNmb3JtU3RvcmUuZ2V0KCk7XG59O1xuXG5mdW5jdGlvbiBfZ2xvYmFsVG9XaW5kb3dUcmFuc2Zvcm0oZ2xvYmFsT2JqKSB7XG4gIHZhciB3aW5kb3dPYmogPSB7fTtcbiAgd2luZG93T2JqLnggPSAoZ2xvYmFsT2JqLnggKyBfdHJhbnNmb3JtLnRyYW5zbGF0ZVgpICogX3RyYW5zZm9ybS5zY2FsZTtcbiAgd2luZG93T2JqLnkgPSAoZ2xvYmFsT2JqLnkgKyBfdHJhbnNmb3JtLnRyYW5zbGF0ZVkpICogX3RyYW5zZm9ybS5zY2FsZTtcbiAgaWYgKCBnbG9iYWxPYmoud2lkdGggJiYgZ2xvYmFsT2JqLmhlaWdodCkge1xuICAgIHdpbmRvd09iai53aWR0aCA9IGdsb2JhbE9iai53aWR0aCAqIF90cmFuc2Zvcm0uc2NhbGU7XG4gICAgd2luZG93T2JqLmhlaWdodCA9IGdsb2JhbE9iai5oZWlnaHQgKiBfdHJhbnNmb3JtLnNjYWxlO1xuICAgIHJldHVybiB3aW5kb3dPYmo7XG4gIH1cbiAgcmV0dXJuIHdpbmRvd09iajtcbn07XG5cbnZhciBGb2N1c1ZpZXcgPSB7XG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgX3RleHRhcmVhRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0ZXh0YXJlYScpO1xuICAgIEZvY3VzU3RvcmUuYWRkQ2hhbmdlTGlzdGVuZXIoJ2NoYW5nZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgIF91cGRhdGVTdGF0ZUZyb21TdG9yZXMoKTtcbiAgICAgIEZvY3VzVmlldy5yZW5kZXIoKTtcbiAgICB9KTtcbiAgfSxcblxuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnNvbGUubG9nKCdzd2l0Y2ggdG8gdGV4dGFyZWEnKTtcbiAgICB2YXIgbm90ZSA9IEZvY3VzU3RvcmUuZ2V0Rm9jdXNEb3VibGVUYXAoKTtcbiAgICBpZiAobm90ZSkge1xuICAgICAgdmFyIHRleHRhcmVhUmVjdEdsb2JhbCA9IHtcbiAgICAgICAgeDogbm90ZS5kYXRhLngsXG4gICAgICAgIHk6IG5vdGUuZGF0YS55LFxuICAgICAgICB3aWR0aDogbm90ZS5zdHlsZS53aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBub3RlLnN0eWxlLmhlaWdodFxuICAgICAgfTtcbiAgICAgIHZhciB0ZXh0YXJlYVJlY3RXaW5kb3cgPSBfZ2xvYmFsVG9XaW5kb3dUcmFuc2Zvcm0odGV4dGFyZWFSZWN0R2xvYmFsKTtcbiAgICAgIHZhciBkZWx0YVRvT3JpZ2luWCA9IC0gbm90ZS5zdHlsZS53aWR0aCAqICgxIC0gX3RyYW5zZm9ybS5zY2FsZSkgLyAyO1xuICAgICAgdmFyIGRlbHRhVG9PcmlnaW5ZID0gLSBub3RlLnN0eWxlLmhlaWdodCAqICgxIC0gX3RyYW5zZm9ybS5zY2FsZSkgLyAyO1xuICAgICAgdmFyIHRyYW5zbGF0ZVggPSBkZWx0YVRvT3JpZ2luWCArIHRleHRhcmVhUmVjdFdpbmRvdy54O1xuICAgICAgdmFyIHRyYW5zbGF0ZVkgPSBkZWx0YVRvT3JpZ2luWSArIHRleHRhcmVhUmVjdFdpbmRvdy55O1xuXG4gICAgICBfdGV4dGFyZWFFbGVtZW50LnZhbHVlID0gbm90ZS5kYXRhLnRleHQ7XG4gICAgICBfdGV4dGFyZWFFbGVtZW50LnN0eWxlLndpZHRoID0gbm90ZS5zdHlsZS53aWR0aCArIFwicHhcIjtcbiAgICAgIF90ZXh0YXJlYUVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gbm90ZS5zdHlsZS5oZWlnaHQgKyBcInB4XCI7XG4gICAgICBfdGV4dGFyZWFFbGVtZW50LnN0eWxlLnRyYW5zZm9ybSA9IFwibWF0cml4KFwiICsgX3RyYW5zZm9ybS5zY2FsZSArIFwiLCAwLCAwLCBcIiArIF90cmFuc2Zvcm0uc2NhbGUgKyBcIiwgXCIgKyB0cmFuc2xhdGVYICsgJywnICsgdHJhbnNsYXRlWSArJyknO1xuICAgICAgX3RleHRhcmVhRWxlbWVudC5zdHlsZS53ZWJraXRUcmFuc2Zvcm0gPSBcIm1hdHJpeChcIiArIF90cmFuc2Zvcm0uc2NhbGUgKyBcIiwgMCwgMCwgXCIgKyBfdHJhbnNmb3JtLnNjYWxlICsgXCIsIFwiICsgdHJhbnNsYXRlWCArICcsJyArIHRyYW5zbGF0ZVkgKycpJztcbiAgICAgIF90ZXh0YXJlYUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICBfdGV4dGFyZWFFbGVtZW50LmZvY3VzKCk7XG4gICAgfVxuICB9ICBcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBGb2N1c1ZpZXc7XG5cblxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBEaXNwYXRjaGVyID0gcmVxdWlyZSgnZmx1eCcpLkRpc3BhdGNoZXI7XG52YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgQ2FudmFzRGlzcGF0Y2hlciA9IGFzc2lnbihuZXcgRGlzcGF0Y2hlcigpLCB7XG4gIC8vQWRkIGN1c3RvbSBkaXNwYXRjaGVyIG1ldGhvZHMgaGVyZVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FudmFzRGlzcGF0Y2hlcjsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgTm90ZXNTdG9yZSA9IHJlcXVpcmUoJy4vTm90ZXNTdG9yZScpO1xudmFyIFRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vVHJhbnNmb3JtU3RvcmUnKTtcbnZhciBDYW52YXNBcHBEaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vZGlzcGF0Y2hlci9DYW52YXNBcHBEaXNwYXRjaGVyJyk7XG5cbnZhciBfZHJhZ1N0YXJ0O1xuXG5mdW5jdGlvbiBfc2V0RHJhZ1N0YXJ0KGhhbW1lckV2ZW50KSB7XG4gIF9kcmFnU3RhcnQgPSB7fTtcbiAgdmFyIGxlZnRUb3AgPSB7bGVmdDogaGFtbWVyRXZlbnQucG9pbnRlcnNbMF0ucGFnZVgsIHRvcDogaGFtbWVyRXZlbnQucG9pbnRlcnNbMF0ucGFnZVl9O1xuICB2YXIgZ2xvYmFsUG9pbnQgPSBUcmFuc2Zvcm0ud2luZG93VG9HbG9iYWxQb2ludChsZWZ0VG9wKTtcbiAgdmFyIG5vdGUgPSBOb3Rlc1N0b3JlLmdldE5vdGVGcm9tWFkoZ2xvYmFsUG9pbnQueCwgZ2xvYmFsUG9pbnQueSk7XG4gIGlmIChub3RlKSB7XG4gICAgY29uc29sZS5sb2coJ19zZXREcmFnU3RhcnQnKTtcbiAgICBfZHJhZ1N0YXJ0Lm5vdGUgPSBub3RlO1xuICAgIF9kcmFnU3RhcnQudG91Y2hMZWZ0ID0gbGVmdFRvcC5sZWZ0O1xuICAgIF9kcmFnU3RhcnQudG91Y2hUb3AgPSBsZWZ0VG9wLnRvcDtcbiAgICBfZHJhZ1N0YXJ0LmVsZW1lbnRYID0gbm90ZS5kYXRhLng7XG4gICAgX2RyYWdTdGFydC5lbGVtZW50WSA9IG5vdGUuZGF0YS55O1xuICB9IGVsc2Uge1xuICAgIF9yZXNldCgpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBfZHJhZyhoYW1tZXJFdmVudCkge1xuICBpZiAoIF9kcmFnU3RhcnQgKSB7XG4gICAgdmFyIG5vdGUgPSBfZHJhZ1N0YXJ0Lm5vdGU7XG4gICAgLy8gdmFyIGxlZnRUb3AgPSBfZ2V0UmVsYXRpdmVMZWZ0VG9wKGhhbW1lckV2ZW50KTtcbiAgICB2YXIgbGVmdFRvcCA9IHtsZWZ0OiBoYW1tZXJFdmVudC5wb2ludGVyc1swXS5wYWdlWCwgdG9wOiBoYW1tZXJFdmVudC5wb2ludGVyc1swXS5wYWdlWX07XG4gICAgdmFyIGRlbHRhWCA9IChsZWZ0VG9wLmxlZnQgLSBfZHJhZ1N0YXJ0LnRvdWNoTGVmdCkgLyBUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICB2YXIgZGVsdGFZID0gKGxlZnRUb3AudG9wIC0gX2RyYWdTdGFydC50b3VjaFRvcCkgLyBUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICBub3RlLmRhdGEueCA9IF9kcmFnU3RhcnQuZWxlbWVudFggKyBkZWx0YVg7XG4gICAgbm90ZS5kYXRhLnkgPSBfZHJhZ1N0YXJ0LmVsZW1lbnRZICsgZGVsdGFZO1xuICAgIERyYWdFbGVtZW50U3RvcmUuZW1pdENoYW5nZSgnZHJhZ2dlZCcpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBfcmVzZXQoKSB7XG4gIF9kcmFnU3RhcnQgPSBudWxsO1xufVxuXG52YXIgRHJhZ0VsZW1lbnRTdG9yZSA9IGFzc2lnbih7fSwgRXZlbnRFbWl0dGVyLnByb3RvdHlwZSwge1xuICBcbiAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gX2RyYWdTdGFydC5ub3RlO1xuICB9LFxuXG4gIGVtaXRDaGFuZ2U6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50KSB7XG4gICAgdGhpcy5lbWl0KGNoYW5nZUV2ZW50KTtcbiAgfSxcblxuICBhZGRDaGFuZ2VMaXN0ZW5lcjogZnVuY3Rpb24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbihjaGFuZ2VFdmVudCwgY2FsbGJhY2spO1xuICB9LFxuXG59KTtcblxuRHJhZ0VsZW1lbnRTdG9yZS5kaXNwYXRjaFRva2VuID0gQ2FudmFzQXBwRGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7ICBcbiAgc3dpdGNoIChwYXlsb2FkLmFjdGlvblR5cGUpIHtcbiAgXG4gICAgY2FzZSAncHJlc3NPbmVGaW5nZXInOlxuICAgICAgLy8gX2dldFJlbGF0aXZlTGVmdFRvcCA9IHBheWxvYWQudXRpbHMuX2dldFJlbGF0aXZlTGVmdFRvcDtcbiAgICAgIF9zZXREcmFnU3RhcnQocGF5bG9hZC5oYW1tZXJFdmVudCk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3Bhbic6XG4gICAgICBfZHJhZyhwYXlsb2FkLmhhbW1lckV2ZW50KTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAncHJlc3NUd29GaW5nZXJzJzpcbiAgICAgIF9yZXNldCgpO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OiAvLyBpbnRlbnRpb25hbGx5IGxlZnQgYmxhbmtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRHJhZ0VsZW1lbnRTdG9yZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgQ2FudmFzQXBwRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL2Rpc3BhdGNoZXIvQ2FudmFzQXBwRGlzcGF0Y2hlcicpO1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBfYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xudmFyIF9nZXRSZWxhdGl2ZUxlZnRUb3AgPSByZXF1aXJlKCcuLi91dGlscy9HZXRSZWxhdGl2ZUxlZnRUb3AuanMnKTtcbnZhciBOb3Rlc1N0b3JlID0gcmVxdWlyZSgnLi9Ob3Rlc1N0b3JlJyk7XG52YXIgVHJhbnNmb3JtU3RvcmUgPSByZXF1aXJlKCcuL1RyYW5zZm9ybVN0b3JlJyk7XG52YXIgX2dldEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vdXRpbHMvRXZlbnRUYXJnZXQnKTtcblxudmFyIF9mb2N1c1NpbmdsZVRhcDtcbnZhciBfZm9jdXNEb3VibGVUYXA7XG5cbmZ1bmN0aW9uIF90YXBTaW5nbGVIYW5kbGVyKCkge1xuXG59O1xuXG5mdW5jdGlvbiBfdGFwRG91YmxlSGFuZGxlcihoYW1tZXJFdmVudCkge1xuICAvLyBjb25zb2xlLmxvZygnc2luZ2xlJyk7XG4gIHZhciBub3RlID0gX2dldEV2ZW50VGFyZ2V0KGhhbW1lckV2ZW50KTtcbiAgaWYgKG5vdGUgJiYgbm90ZSAhPT0gX2ZvY3VzRG91YmxlVGFwKSB7XG4gICAgX2ZvY3VzRG91YmxlVGFwID0gbm90ZTtcbiAgICBGb2N1c1N0b3JlLmVtaXRDaGFuZ2UoJ2NoYW5nZWQnKTtcbiAgfVxufTtcblxudmFyIEZvY3VzU3RvcmUgPSBfYXNzaWduKHt9LCBFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gIFxuICBlbWl0Q2hhbmdlOiBmdW5jdGlvbihjaGFuZ2VFdmVudE5hbWUpIHtcbiAgICB0aGlzLmVtaXQoY2hhbmdlRXZlbnROYW1lIHx8ICdjaGFuZ2VkJyk7XG4gIH0sXG5cbiAgYWRkQ2hhbmdlTGlzdGVuZXI6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50LCBjYWxsYmFjaykge1xuICAgIHRoaXMub24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKTtcbiAgfSxcblxuICBnZXRGb2N1c1NpbmdsZVRhcDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9mb2N1c1NpbmdsZVRhcDtcbiAgfSxcblxuICBnZXRGb2N1c0RvdWJsZVRhcDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9mb2N1c0RvdWJsZVRhcDtcbiAgfSxcbn0pO1xuXG5Gb2N1c1N0b3JlLmRpc3BhdGNoVG9rZW4gPSBDYW52YXNBcHBEaXNwYXRjaGVyLnJlZ2lzdGVyKGZ1bmN0aW9uKHBheWxvYWQpIHsgIFxuICBzd2l0Y2ggKHBheWxvYWQuYWN0aW9uVHlwZSkge1xuICBcbiAgICBjYXNlICd0YXBTaW5nbGUnOlxuICAgICAgX3RhcFNpbmdsZUhhbmRsZXIoKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAndGFwRG91YmxlJzpcbiAgICAgIF90YXBEb3VibGVIYW5kbGVyKHBheWxvYWQuaGFtbWVyRXZlbnQpO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OiAvLyBpbnRlbnRpb25hbGx5IGxlZnQgYmxhbmtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRm9jdXNTdG9yZTsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIENhbnZhc0FwcERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi9kaXNwYXRjaGVyL0NhbnZhc0FwcERpc3BhdGNoZXInKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuLy8gdmFyIFRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vVHJhbnNmb3JtU3RvcmUnKTtcblxuLy8gdmFyIF9nZXRSZWxhdGl2ZUxlZnRUb3A7XG4vLyB2YXIgQ0hBTkdFX0VWRU5UUyA9IFsnYWRkZWQnLCAnZHJhZ2dlZCddO1xuXG52YXIgX25vdGVzID0ge307XG52YXIgX25vdGUgPSB7fTsgIC8vIG1vc3QgcmVjZW50IG5vdGUgYWRkZWQgb3IgdXBkYXRlZFxuLy8gdmFyIF9kcmFnU3RhcnQ7XG5cbmZ1bmN0aW9uIF9hZGROb3RlKG5vdGUpIHtcbiAgdmFyIGtleSA9IE9iamVjdC5rZXlzKG5vdGUpWzBdO1xuICBfbm90ZXNba2V5XSA9IG5vdGVba2V5XTtcbiAgX3NldE1vc3RSZWNlbnROb3RlKG5vdGUsIGtleSk7XG4gIE5vdGVzU3RvcmUuZW1pdENoYW5nZSgnYWRkZWQnKTtcblxufVxuXG5mdW5jdGlvbiBfc2V0TW9zdFJlY2VudE5vdGUobm90ZSwga2V5KSB7XG4gIHZhciBrZXlPbGQgPSBPYmplY3Qua2V5cyhfbm90ZSlbMF07XG4gIGRlbGV0ZSBfbm90ZVtrZXlPbGRdO1xuICBhc3NpZ24oX25vdGUsIG5vdGVba2V5XSk7XG59O1xuXG4vLyBmdW5jdGlvbiBfc2V0RHJhZ1N0YXJ0KGhhbW1lckV2ZW50KSB7XG4vLyAgIGNvbnNvbGUubG9nKCdfc2V0RHJhZ1N0YXJ0Jyk7XG4vLyAgIF9kcmFnU3RhcnQgPSB7fTtcbi8vICAgdmFyIGxlZnRUb3AgPSBfZ2V0UmVsYXRpdmVMZWZ0VG9wKGhhbW1lckV2ZW50KTtcbi8vICAgdmFyIFhZO1xuLy8gICB2YXIgbm90ZSA9IF9nZXROb3RlRnJvbVhZKGxlZnRUb3AubGVmdCwgbGVmdFRvcC50b3ApO1xuLy8gICBpZiAobm90ZSkge1xuLy8gICAgIF9kcmFnU3RhcnQubm90ZSA9IG5vdGU7XG4vLyAgICAgX2RyYWdTdGFydC50b3VjaExlZnQgPSBsZWZ0VG9wLmxlZnQ7XG4vLyAgICAgX2RyYWdTdGFydC50b3VjaFRvcCA9IGxlZnRUb3AudG9wO1xuLy8gICAgIF9kcmFnU3RhcnQuZWxlbWVudFggPSBub3RlLmRhdGEueDtcbi8vICAgICBfZHJhZ1N0YXJ0LmVsZW1lbnRZID0gbm90ZS5kYXRhLnk7XG4vLyAgIH0gZWxzZSB7XG4vLyAgICAgX2RyYWdTdGFydCA9IG51bGw7XG4vLyAgIH1cbi8vIH07XG5cbi8vIGZ1bmN0aW9uIF9kcmFnKGhhbW1lckV2ZW50KSB7XG4vLyAgIGlmICggX2RyYWdTdGFydCApIHtcbi8vICAgICB2YXIgbm90ZSA9IF9kcmFnU3RhcnQubm90ZTtcbi8vICAgICB2YXIgbGVmdFRvcCA9IF9nZXRSZWxhdGl2ZUxlZnRUb3AoaGFtbWVyRXZlbnQpO1xuLy8gICAgIHZhciBkZWx0YVggPSAobGVmdFRvcC5sZWZ0IC0gX2RyYWdTdGFydC50b3VjaExlZnQpIC8gVHJhbnNmb3JtLmdldFNjYWxlKCk7XG4vLyAgICAgdmFyIGRlbHRhWSA9IChsZWZ0VG9wLnRvcCAtIF9kcmFnU3RhcnQudG91Y2hUb3ApIC8gVHJhbnNmb3JtLmdldFNjYWxlKCk7XG4vLyAgICAgbm90ZS5kYXRhLnggPSBfZHJhZ1N0YXJ0LmVsZW1lbnRYICsgZGVsdGFYO1xuLy8gICAgIG5vdGUuZGF0YS55ID0gX2RyYWdTdGFydC5lbGVtZW50WSArIGRlbHRhWTtcbi8vICAgICBOb3Rlc1N0b3JlLmVtaXRDaGFuZ2UoJ2RyYWdnZWQnKTtcbi8vICAgfVxuLy8gfVxuXG4gIC8vIENhbnZhc0RlbW8ucHJvdG90eXBlLndpbmRvd1RvR2xvYmFsUG9pbnQgPSBmdW5jdGlvbih3aW5kb3dQb2ludCkge1xuICAvLyAgIHJldHVybiB7XG4gIC8vICAgICB4OiB3aW5kb3d4IC8gdGhpcy50cmFuc2Zvcm0uc2NhbGUgLSB0aGlzLnRyYW5zZm9ybS50cmFuc2xhdGVYLFxuICAvLyAgICAgeTogd2luZG93UG9pbnQueSAvIHRoaXMudHJhbnNmb3JtLnNjYWxlIC0gdGhpcy50cmFuc2Zvcm0udHJhbnNsYXRlWVxuICAvLyAgIH07XG4gIC8vIH07XG5cbi8vIGZ1bmN0aW9uIF9nZXROb3RlRnJvbVhZKHgsIHkpIHtcbi8vICAgdmFyIG5vdGU7XG4vLyAgIGZvcih2YXIga2V5IGluIF9ub3Rlcykge1xuLy8gICAgIG5vdGUgPSBfbm90ZXNba2V5XTtcbi8vICAgICBpZiAoIFxuLy8gICAgICAgbm90ZS5kYXRhLnggPD0geCAmJiBcbi8vICAgICAgIHggPD0gbm90ZS5kYXRhLnggKyBub3RlLnN0eWxlLndpZHRoICYmIFxuLy8gICAgICAgbm90ZS5kYXRhLnkgPD0geSAmJiBcbi8vICAgICAgIHkgPD0gbm90ZS5kYXRhLnkgKyBub3RlLnN0eWxlLmhlaWdodCBcbi8vICAgICApIHtcbi8vICAgICAgIHJldHVybiBub3RlO1xuLy8gICAgIH1cbi8vICAgfVxuLy8gICByZXR1cm4gbnVsbDtcbi8vIH07XG5cbnZhciBOb3Rlc1N0b3JlID0gYXNzaWduKHt9LCBFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gIFxuICBlbWl0Q2hhbmdlOiBmdW5jdGlvbihjaGFuZ2VFdmVudCkge1xuICAgIHRoaXMuZW1pdChjaGFuZ2VFdmVudCk7XG4gIH0sXG5cbiAgYWRkQ2hhbmdlTGlzdGVuZXI6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50LCBjYWxsYmFjaykge1xuICAgIHRoaXMub24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKTtcbiAgfSxcblxuICBnZXRBbGw6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfbm90ZXM7XG4gIH0sXG5cbiAgZ2V0TW9zdFJlY2VudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9ub3RlO1xuICB9LFxuXG4gIGdldE5vdGVGcm9tWFk6IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB2YXIgbm90ZTtcbiAgICBmb3IodmFyIGtleSBpbiBfbm90ZXMpIHtcbiAgICAgIG5vdGUgPSBfbm90ZXNba2V5XTtcbiAgICAgIGlmICggXG4gICAgICAgIG5vdGUuZGF0YS54IDw9IHggJiYgXG4gICAgICAgIHggPD0gbm90ZS5kYXRhLnggKyBub3RlLnN0eWxlLndpZHRoICYmIFxuICAgICAgICBub3RlLmRhdGEueSA8PSB5ICYmIFxuICAgICAgICB5IDw9IG5vdGUuZGF0YS55ICsgbm90ZS5zdHlsZS5oZWlnaHQgXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG5vdGU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG59KTtcblxuTm90ZXNTdG9yZS5kaXNwYXRjaFRva2VuID0gQ2FudmFzQXBwRGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gIFxuICBzd2l0Y2ggKHBheWxvYWQuYWN0aW9uVHlwZSkge1xuICAgIFxuICAgIGNhc2UgXCJub3RlX2FkZGVkXCI6XG4gICAgICBfYWRkTm90ZShwYXlsb2FkLm5vdGUpO1xuICAgICAgYnJlYWs7XG5cbiAgICAvLyBjYXNlICdwcmVzcyc6XG4gICAgLy8gICBfZ2V0UmVsYXRpdmVMZWZ0VG9wID0gcGF5bG9hZC51dGlscy5fZ2V0UmVsYXRpdmVMZWZ0VG9wO1xuICAgIC8vICAgX3NldERyYWdTdGFydChwYXlsb2FkLmhhbW1lckV2ZW50KTtcblxuICAgIC8vIGNhc2UgJ3Bhbic6XG4gICAgLy8gICBfZHJhZyhwYXlsb2FkLmhhbW1lckV2ZW50KTtcblxuICAgIGRlZmF1bHQ6ICAvLyBkbyBub3RoaW5nXG4gIH1cblxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTm90ZXNTdG9yZTsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIENhbnZhc0FwcERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi9kaXNwYXRjaGVyL0NhbnZhc0FwcERpc3BhdGNoZXInKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgX2Fzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcbnZhciBfZ2V0UmVsYXRpdmVMZWZ0VG9wID0gcmVxdWlyZSgnLi4vdXRpbHMvR2V0UmVsYXRpdmVMZWZ0VG9wLmpzJyk7XG52YXIgTm90ZXNTdG9yZSA9IHJlcXVpcmUoJy4vTm90ZXNTdG9yZScpO1xuXG52YXIgQ0hBTkdFX0VWRU5UID0gJ2NoYW5nZSc7XG5cbnZhciBfdHJhbnNsYXRlU3RhcnREYXRhO1xuXG52YXIgX3BpbmNoU3RhcnQ7XG5cbnZhciBfdHJhbnNmb3JtID0ge1xuICB0cmFuc2xhdGVYOiAwLFxuICB0cmFuc2xhdGVZOiAwLFxuICBzY2FsZTogMVxufTtcblxuZnVuY3Rpb24gX3RyYW5zbGF0ZVN0YXJ0KGhhbW1lckV2ZW50KSB7XG4gIF9yZXNldCgpO1xuICBfdHJhbnNsYXRlU3RhcnREYXRhID0ge307XG4gIHZhciBsZWZ0VG9wID0ge2xlZnQ6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VYLCB0b3A6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfTtcbiAgdmFyIGdsb2JhbFBvaW50ID0gVHJhbnNmb3JtLndpbmRvd1RvR2xvYmFsUG9pbnQobGVmdFRvcCk7XG4gIHZhciBub3RlID0gTm90ZXNTdG9yZS5nZXROb3RlRnJvbVhZKGdsb2JhbFBvaW50LngsIGdsb2JhbFBvaW50LnkpO1xuICBpZiAoICFub3RlKSB7XG4gICAgY29uc29sZS5sb2coJ190cmFuc2xhdGVTdGFydCcpO1xuICAgIF90cmFuc2xhdGVTdGFydERhdGEubGVmdCA9IGxlZnRUb3AubGVmdDtcbiAgICBfdHJhbnNsYXRlU3RhcnREYXRhLnRvcCA9IGxlZnRUb3AudG9wO1xuICAgIF90cmFuc2xhdGVTdGFydERhdGEudHJhbnNsYXRlWCA9IF90cmFuc2Zvcm0udHJhbnNsYXRlWDtcbiAgICBfdHJhbnNsYXRlU3RhcnREYXRhLnRyYW5zbGF0ZVkgPSBfdHJhbnNmb3JtLnRyYW5zbGF0ZVk7XG4gIH0gZWxzZSB7XG4gICAgX3RyYW5zbGF0ZVN0YXJ0RGF0YSA9IG51bGw7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIF90cmFuc2xhdGUoaGFtbWVyRXZlbnQpIHtcbiAgaWYgKCBfdHJhbnNsYXRlU3RhcnREYXRhICkge1xuICAgIHZhciBsZWZ0VG9wID0ge2xlZnQ6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VYLCB0b3A6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfTtcbiAgICBfdHJhbnNmb3JtLnRyYW5zbGF0ZVggPSBfdHJhbnNsYXRlU3RhcnREYXRhLnRyYW5zbGF0ZVggKyAobGVmdFRvcC5sZWZ0IC0gX3RyYW5zbGF0ZVN0YXJ0RGF0YS5sZWZ0KSAvIF90cmFuc2Zvcm0uc2NhbGU7XG4gICAgX3RyYW5zZm9ybS50cmFuc2xhdGVZID0gX3RyYW5zbGF0ZVN0YXJ0RGF0YS50cmFuc2xhdGVZICsgKGxlZnRUb3AudG9wIC0gX3RyYW5zbGF0ZVN0YXJ0RGF0YS50b3ApIC8gX3RyYW5zZm9ybS5zY2FsZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gX3Jlc2V0KCkge1xuICBfdHJhbnNsYXRlU3RhcnREYXRhID0gbnVsbDtcbiAgX3BpbmNoU3RhcnQgPSBudWxsO1xufVxuXG5mdW5jdGlvbiBfem9vbVN0YXJ0KGhhbW1lckV2ZW50KSB7XG4gIF9yZXNldCgpO1xuICBfcGluY2hTdGFydCA9IHt9O1xuICBfcGluY2hTdGFydC5kaXN0ID0gX2Rpc3RIYW1tZXJQaW5jaEV2ZW50KGhhbW1lckV2ZW50KTtcbiAgX3BpbmNoU3RhcnQuY2VudGVyID0ge3g6IGhhbW1lckV2ZW50LmNlbnRlci54LCB5OmhhbW1lckV2ZW50LmNlbnRlci55fTtcbiAgX3BpbmNoU3RhcnQudHJhbnNsYXRlWCA9IF90cmFuc2Zvcm0udHJhbnNsYXRlWDtcbiAgX3BpbmNoU3RhcnQudHJhbnNsYXRlWSA9IF90cmFuc2Zvcm0udHJhbnNsYXRlWTtcbiAgX3BpbmNoU3RhcnQuc2NhbGUgPSBfdHJhbnNmb3JtLnNjYWxlO1xuICBjb25zb2xlLmxvZyhfcGluY2hTdGFydCk7XG59O1xuXG5mdW5jdGlvbiBfbW91c2V3aGVlbFN0YXJ0KGV2ZW50KSB7XG4gIF9yZXNldCgpO1xuICBfcGluY2hTdGFydCA9IHt9O1xuICBfcGluY2hTdGFydC50cmFuc2xhdGVYID0gX3RyYW5zZm9ybS50cmFuc2xhdGVYO1xuICBfcGluY2hTdGFydC50cmFuc2xhdGVZID0gX3RyYW5zZm9ybS50cmFuc2xhdGVZO1xuICBfcGluY2hTdGFydC5zY2FsZSA9IF90cmFuc2Zvcm0uc2NhbGU7XG4gIF9waW5jaFN0YXJ0LmNlbnRlciA9IHt4OiBldmVudC5wYWdlWCwgeTogZXZlbnQucGFnZVl9O1xufVxuXG5mdW5jdGlvbiBfem9vbShoYW1tZXJFdmVudCwgZXZlbnROYW1lKSB7XG4gIGlmKGhhbW1lckV2ZW50LnR5cGUgPT09ICdtb3VzZXdoZWVsJykge1xuICAgIF9tb3VzZXdoZWVsU3RhcnQoaGFtbWVyRXZlbnQpO1xuICAgIF90cmFuc2Zvcm0uc2NhbGUgPSAoaGFtbWVyRXZlbnQud2hlZWxEZWx0YVkgPCAwKSA/IF90cmFuc2Zvcm0uc2NhbGUgKiAxLjEgOiBfdHJhbnNmb3JtLnNjYWxlICogMC45MDtcbiAgfSBlbHNlIHtcbiAgICB2YXIgbmV3UGluY2hEaXN0ID0gX2Rpc3RIYW1tZXJQaW5jaEV2ZW50KGhhbW1lckV2ZW50KTtcbiAgICB2YXIgbmV3U2NhbGUgPSBfcGluY2hTdGFydC5zY2FsZSAqIG5ld1BpbmNoRGlzdCAvIF9waW5jaFN0YXJ0LmRpc3Q7XG4gICAgX3RyYW5zZm9ybS5zY2FsZSA9IG5ld1NjYWxlO1xuICB9XG4gIGlmICggX3BpbmNoU3RhcnQgKSB7XG4gICAgX3RyYW5zZm9ybS50cmFuc2xhdGVYID0gX3BpbmNoU3RhcnQudHJhbnNsYXRlWCAtIF9nZXRUcmFuc2xhdGVEZWx0YShfcGluY2hTdGFydC5jZW50ZXIueCwgX3BpbmNoU3RhcnQuc2NhbGUsIF90cmFuc2Zvcm0uc2NhbGUpO1xuICAgIF90cmFuc2Zvcm0udHJhbnNsYXRlWSA9IF9waW5jaFN0YXJ0LnRyYW5zbGF0ZVkgLSBfZ2V0VHJhbnNsYXRlRGVsdGEoX3BpbmNoU3RhcnQuY2VudGVyLnksIF9waW5jaFN0YXJ0LnNjYWxlLCBfdHJhbnNmb3JtLnNjYWxlKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gX2dldFRyYW5zbGF0ZURlbHRhKHgsIHNjYWxlUHJldiwgc2NhbGVOZXcpIHtcbiAgdmFyIHRyYW5zbGF0ZURlbHRhID0gKHggLyBzY2FsZVByZXYgKiBzY2FsZU5ldyAtIHgpIC8gc2NhbGVOZXc7XG4gIHJldHVybiB0cmFuc2xhdGVEZWx0YTtcbn07XG5cbmZ1bmN0aW9uIF9kaXN0SGFtbWVyUGluY2hFdmVudCAoaGFtbWVyUGluY2hFdmVudCkge1xuICByZXR1cm4gX2Rpc3QoXG4gICAge3g6IGhhbW1lclBpbmNoRXZlbnQucG9pbnRlcnNbMF0ucGFnZVgsIHk6aGFtbWVyUGluY2hFdmVudC5wb2ludGVyc1swXS5wYWdlWX0sXG4gICAge3g6IGhhbW1lclBpbmNoRXZlbnQucG9pbnRlcnNbMV0ucGFnZVgsIHk6aGFtbWVyUGluY2hFdmVudC5wb2ludGVyc1sxXS5wYWdlWX1cbiAgKTtcbn07XG5cbmZ1bmN0aW9uIF9kaXN0KGEsIGIpIHtcbiAgcmV0dXJuIE1hdGguc3FydCggTWF0aC5wb3coYS54IC0gYi54LCAyKSArIE1hdGgucG93KGEueSAtIGIueSwgMikgKTtcbn07XG5cbnZhciBUcmFuc2Zvcm0gPSBfYXNzaWduKHt9LCBFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gIFxuICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfdHJhbnNmb3JtO1xuICB9LFxuXG4gIGdldFNjYWxlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gX3RyYW5zZm9ybS5zY2FsZTtcbiAgfSxcblxuICBlbWl0Q2hhbmdlOiBmdW5jdGlvbihjaGFuZ2VFdmVudE5hbWUpIHtcbiAgICB0aGlzLmVtaXQoY2hhbmdlRXZlbnROYW1lIHx8ICdjaGFuZ2VkJyk7XG4gIH0sXG5cbiAgYWRkQ2hhbmdlTGlzdGVuZXI6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50LCBjYWxsYmFjaykge1xuICAgIHRoaXMub24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKTtcbiAgfSxcblxuICB3aW5kb3dUb0dsb2JhbFBvaW50OiBmdW5jdGlvbih3aW5kb3dQb2ludCkge1xuICAgIHJldHVybiB7XG4gICAgICB4OiB3aW5kb3dQb2ludC5sZWZ0IC8gX3RyYW5zZm9ybS5zY2FsZSAtIF90cmFuc2Zvcm0udHJhbnNsYXRlWCxcbiAgICAgIHk6IHdpbmRvd1BvaW50LnRvcCAvIF90cmFuc2Zvcm0uc2NhbGUgLSBfdHJhbnNmb3JtLnRyYW5zbGF0ZVlcbiAgICB9O1xuICB9LFxuXG59KTtcblxuVHJhbnNmb3JtLmRpc3BhdGNoVG9rZW4gPSBDYW52YXNBcHBEaXNwYXRjaGVyLnJlZ2lzdGVyKGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgc3dpdGNoKHBheWxvYWQuYWN0aW9uVHlwZSkge1xuICAgIFxuICAgIGNhc2UgJ3ByZXNzT25lRmluZ2VyJzpcbiAgICAgIC8vIF9nZXRSZWxhdGl2ZUxlZnRUb3AgPSBwYXlsb2FkLnV0aWxzLl9nZXRSZWxhdGl2ZUxlZnRUb3A7XG4gICAgICBfdHJhbnNsYXRlU3RhcnQocGF5bG9hZC5oYW1tZXJFdmVudCk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3Bhbic6XG4gICAgICBfdHJhbnNsYXRlKHBheWxvYWQuaGFtbWVyRXZlbnQpO1xuICAgICAgVHJhbnNmb3JtLmVtaXRDaGFuZ2UoJ2NoYW5nZWQnKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAncHJlc3NUd29GaW5nZXJzJzpcbiAgICAgIF96b29tU3RhcnQocGF5bG9hZC5oYW1tZXJFdmVudCk7XG4gICAgICBicmVhaztcbiAgICBcbiAgICBjYXNlICdwaW5jaCc6XG4gICAgICBfem9vbShwYXlsb2FkLmhhbW1lckV2ZW50KVxuICAgICAgVHJhbnNmb3JtLmVtaXRDaGFuZ2UoJ2NoYW5nZWQnKVxuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdtb3VzZXdoZWVsJzpcbiAgICAgIF96b29tKHBheWxvYWQuZXZlbnQsICdtb3VzZXdoZWVsJyk7XG4gICAgICBUcmFuc2Zvcm0uZW1pdENoYW5nZSgnY2hhbmdlZCcpXG4gICAgZGVmYXVsdDpcbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBUcmFuc2Zvcm07IiwiLy8gRXZlbnRUYXJnZXQuanNcbnZhciBOb3Rlc1N0b3JlID0gcmVxdWlyZSgnLi4vc3RvcmVzL05vdGVzU3RvcmUnKTtcbnZhciBUcmFuc2Zvcm1TdG9yZSA9IHJlcXVpcmUoJy4uL3N0b3Jlcy9UcmFuc2Zvcm1TdG9yZScpO1xuXG5mdW5jdGlvbiBnZXRUYXJnZXQgKGhhbW1lckV2ZW50KSB7XG4gIHZhciBsZWZ0VG9wID0ge2xlZnQ6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VYLCB0b3A6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfTtcbiAgdmFyIGdsb2JhbFBvaW50ID0gVHJhbnNmb3JtU3RvcmUud2luZG93VG9HbG9iYWxQb2ludChsZWZ0VG9wKTtcbiAgdmFyIG5vdGUgPSBOb3Rlc1N0b3JlLmdldE5vdGVGcm9tWFkoZ2xvYmFsUG9pbnQueCwgZ2xvYmFsUG9pbnQueSk7XG4gIHJldHVybiBub3RlOyAgLy8gbnVsbCBpZiBhIG5vdGUgd2Fzbid0IGNsaWNrZWRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0VGFyZ2V0OyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgQ2FudmFzQXBwRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL2Rpc3BhdGNoZXIvQ2FudmFzQXBwRGlzcGF0Y2hlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5sb2FkRXhhbXBsZSgpO1xuICAgIHRoaXMuZ2V0KCk7XG4gIH0sXG5cbiAgbG9hZEV4YW1wbGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0ZXN0Tm90ZSA9IHtcbiAgICAgIFwiZGF0YVwiIDoge1xuICAgICAgICBcInRleHRcIiA6IFwiI215SGFzaHRhZzBcIixcbiAgICAgICAgXCJ5XCIgOiAxMCxcbiAgICAgICAgXCJ4XCIgOiAxMCxcbiAgICAgICAgXCJoYXNodGFnc1wiIDogWyBcIiNteUhhc2h0YWcwXCIgXVxuICAgICAgfSxcbiAgICAgIFwic3R5bGVcIiA6IHtcbiAgICAgICAgXCJ0b3BcIiA6IDIyOS44NjM2ODM2ODkzMzA5NyxcbiAgICAgICAgXCJoZWlnaHRcIiA6IDUwLFxuICAgICAgICBcImxlZnRcIiA6IDEwMS43NTE3ODk4NDM3MDMyOSxcbiAgICAgICAgXCJ3aWR0aFwiIDogMTkyLFxuICAgICAgICBcImZvbnQtc2l6ZVwiIDogXCIxMHB0XCJcbiAgICAgIH1cbiAgICB9O1xuICAgIHRlc3ROb3RlLmRhdGEudGV4dEFyciA9IHRlc3ROb3RlLmRhdGEudGV4dC5zcGxpdChcIlxcblwiKTtcbiAgICBDYW52YXNBcHBEaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAgICAgIGFjdGlvblR5cGU6ICdub3RlX2FkZGVkJyxcbiAgICAgIG5vdGU6IHt0ZXN0Tm90ZUtleTogdGVzdE5vdGV9XG4gICAgfSk7XG5cbiAgICB2YXIgdGVzdE5vdGUyID0ge1xuICAgICAgXCJkYXRhXCIgOiB7XG4gICAgICAgIFwidGV4dFwiIDogXCIjbXlIYXNodGFnMVwiLFxuICAgICAgICBcInlcIiA6IDI1MCxcbiAgICAgICAgXCJ4XCIgOiAyNTAsXG4gICAgICAgIFwiaGFzaHRhZ3NcIiA6IFsgXCIjbXlIYXNodGFnMVwiIF1cbiAgICAgIH0sXG4gICAgICBcInN0eWxlXCIgOiB7XG4gICAgICAgIFwidG9wXCIgOiAyMjkuODYzNjgzNjg5MzMwOTcsXG4gICAgICAgIFwiaGVpZ2h0XCIgOiA1MCxcbiAgICAgICAgXCJsZWZ0XCIgOiAxMDEuNzUxNzg5ODQzNzAzMjksXG4gICAgICAgIFwid2lkdGhcIiA6IDE5MixcbiAgICAgICAgXCJmb250LXNpemVcIiA6IFwiMTBwdFwiXG4gICAgICB9XG4gICAgfTtcbiAgICB0ZXN0Tm90ZTIuZGF0YS50ZXh0QXJyID0gdGVzdE5vdGUyLmRhdGEudGV4dC5zcGxpdChcIlxcblwiKTtcbiAgICBDYW52YXNBcHBEaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAgICAgIGFjdGlvblR5cGU6ICdub3RlX2FkZGVkJyxcbiAgICAgIG5vdGU6IHt0ZXN0Tm90ZUtleTE6IHRlc3ROb3RlMn1cbiAgICB9KTtcbiAgfSxcblxuICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZWYgPSBuZXcgRmlyZWJhc2UoJ2h0dHBzOi8vYnJhaW5zcGFjZS1iaXouZmlyZWJhc2Vpby5jb20vJyk7XG4gICAgdmFyIG5vdGVzUmVmID0gcmVmLmNoaWxkKCdub3RlczInKTtcbiAgICBub3Rlc1JlZi5vbihcImNoaWxkX2FkZGVkXCIsIGZ1bmN0aW9uKHNuYXBzaG90LCBrZXkpIHtcbiAgICAgIHZhciBub3RlXyA9IHt9O1xuICAgICAgdmFyIG5vdGUgPSBzbmFwc2hvdC52YWwoKTtcbiAgICAgIG5vdGUuZGF0YS50ZXh0QXJyID0gbm90ZS5kYXRhLnRleHQuc3BsaXQoJ1xcbicpO1xuICAgICAgbm90ZV9ba2V5XSA9IG5vdGU7XG4gICAgICBDYW52YXNBcHBEaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAgICAgICAgYWN0aW9uVHlwZTogJ25vdGVfYWRkZWQnLFxuICAgICAgICBub3RlOiBub3RlXyxcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG59IiwiXG52YXIgX2NhbnZhc0VsZW1lbnQ7XG5cbnZhciBnZXRSZWxhdGl2ZUxlZnRUb3AgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgdmFyIHRvdGFsT2Zmc2V0WCA9IDA7XG4gIHZhciB0b3RhbE9mZnNldFkgPSAwO1xuICB2YXIgY2FudmFzWCA9IDA7XG4gIHZhciBjYW52YXNZID0gMDtcbiAgdmFyIGN1cnJlbnRFbGVtZW50ID0gX2NhbnZhc0VsZW1lbnQ7XG5cbiAgZG8ge1xuICAgICAgdG90YWxPZmZzZXRYICs9IF9jYW52YXNFbGVtZW50Lm9mZnNldExlZnQ7XG4gICAgICB0b3RhbE9mZnNldFkgKz0gX2NhbnZhc0VsZW1lbnQub2Zmc2V0VG9wO1xuICB9XG4gIHdoaWxlIChjdXJyZW50RWxlbWVudCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFBhcmVudClcblxuICB2YXIgcGFnZVggPSBldmVudC5wYWdlWCA/IGV2ZW50LnBhZ2VYIDogZXZlbnQuY2hhbmdlZFRvdWNoZXMgPyBldmVudC5jaGFuZ2VkVG91Y2hlc1swXS5wYWdlWCA6IGV2ZW50LmNlbnRlci54O1xuICB2YXIgcGFnZVkgPSBldmVudC5wYWdlWSA/IGV2ZW50LnBhZ2VZIDogZXZlbnQuY2hhbmdlZFRvdWNoZXMgPyBldmVudC5jaGFuZ2VkVG91Y2hlc1swXS5wYWdlWSA6IGV2ZW50LmNlbnRlci55O1xuXG4gIGNhbnZhc1ggPSBwYWdlWCAtIHRvdGFsT2Zmc2V0WDtcbiAgY2FudmFzWSA9IHBhZ2VZIC0gdG90YWxPZmZzZXRZO1xuXG4gIC8vIEZpeCBmb3IgdmFyaWFibGUgY2FudmFzIHdpZHRoXG4gIGNhbnZhc1ggPSBNYXRoLnJvdW5kKCBjYW52YXNYICogKF9jYW52YXNFbGVtZW50LndpZHRoIC8gX2NhbnZhc0VsZW1lbnQub2Zmc2V0V2lkdGgpICk7XG4gIGNhbnZhc1kgPSBNYXRoLnJvdW5kKCBjYW52YXNZICogKF9jYW52YXNFbGVtZW50LmhlaWdodCAvIF9jYW52YXNFbGVtZW50Lm9mZnNldEhlaWdodCkgKTtcblxuICByZXR1cm4ge2xlZnQ6Y2FudmFzWCwgdG9wOmNhbnZhc1l9O1xufTtcblxuZ2V0UmVsYXRpdmVMZWZ0VG9wLnNldCA9IGZ1bmN0aW9uKGNhbnZhc0VsZW1lbnQpIHtcbiAgX2NhbnZhc0VsZW1lbnQgPSBjYW52YXNFbGVtZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFJlbGF0aXZlTGVmdFRvcDtcbiJdfQ==
