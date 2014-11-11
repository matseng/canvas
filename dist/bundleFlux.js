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
},{"./components/CanvasView.js":8,"./utils/FirebaseUtils":13}],8:[function(require,module,exports){
"use strict";

//require NotesStore, NaviationStore, CanvasAppDispatcher
var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var NotesStore = require('../stores/NotesStore');
var DragElementStore = require('../stores/DragElementStore');
var Hammer = require('hammerjs');
var TransformStore = require('../stores/TransformStore');
var _getRelativeLeftTop = require('../utils/GetRelativeLeftTop.js');

var _transform;
var _notes;
var _note;  // most recently added or updated note

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
      this.addChangeListeners();
      // _getRelativeLeftTop.set(CanvasView.canvas);
      this.render();
    },

    addTouchEventListeners: function() {
      this.hammer = new Hammer.Manager(this.canvas);
      this.hammer.add(new Hammer.Tap());
      this.hammer.add(new Hammer.Pan({threshold:0}));
      this.hammer.add(new Hammer.Press({event: 'pressOneFinger', pointers: 1, time:0}));
      this.hammer.add(new Hammer.Press({event: 'pressTwoFingers', pointers: 2, time:0}));
      this.hammer.add(new Hammer.Pinch());
      this.hammer.on('tap pressOneFinger pressTwoFingers pinch pan', function(hammerEvent) {
        CanvasAppDispatcher.dispatch({
          actionType: hammerEvent.type,
          hammerEvent: hammerEvent,
          // utils: {_getRelativeLeftTop: _getRelativeLeftTop.bind(CanvasView.canvas)}
        });
      });

      this.canvas.addEventListener('mousewheel', function(event) {
        CanvasAppDispatcher.dispatch({
          actionType: 'mousewheel',
          event: event
        });
      });
    },

    addChangeListeners: function() {
      
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
      _updateStateFromStores();
      this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
      this.ctx.translate(_transform.translateX * _transform.scale, _transform.translateY * _transform.scale);
      for(var key in _notes) {
        CanvasView.renderNote(_notes[key]);
      }
      this.ctx.translate(-_transform.translateX * _transform.scale, -_transform.translateY * _transform.scale);
    },

    renderNote: function(note) {
      note = note || _note;
      var left = note.data.x * _transform.scale;
      var top = note.data.y * _transform.scale;
      CanvasView.renderShape(note, left, top);
      // CanvasView.renderText(note, left, top);
    },

    renderShape: function(note, left, top) {
      this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
      this.ctx.fillRect.apply(this.ctx, [left, top, note.style.width * _transform.scale, note.style.height * _transform.scale]);
    },

    renderText: function(note, left, top) {
      this.ctx.fillStyle = "blue";
      this.ctx.font = 12 * _transform.scale + "px Arial";
      for(var i = 0; i < note.data.textArr.length; i++) {
        this.ctx.fillText(" " + note.data.textArr[i], left, top + (12 * (i + 2) - 6) * _transform.scale);
      }
    },

    resizeCanvas: function() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

}

module.exports = CanvasView;

},{"../dispatcher/CanvasAppDispatcher":9,"../stores/DragElementStore":10,"../stores/NotesStore":11,"../stores/TransformStore":12,"../utils/GetRelativeLeftTop.js":14,"hammerjs":5}],9:[function(require,module,exports){
"use strict";

var Dispatcher = require('flux').Dispatcher;
var assign = require('object-assign');

var CanvasDispatcher = assign(new Dispatcher(), {
  //Add custom dispatcher methods here
});

module.exports = CanvasDispatcher;
},{"flux":2,"object-assign":6}],10:[function(require,module,exports){
"use strict";

var assign = require('object-assign');
var EventEmitter = require('events').EventEmitter;
var NotesStore = require('./NotesStore');
var Transform = require('./TransformStore');
var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');

var _dragStart;

var _getRelativeLeftTop = function() {};

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
    _dragStart = null;
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
    
    default: // intentionally left blank
  }
});

module.exports = DragElementStore;

},{"../dispatcher/CanvasAppDispatcher":9,"./NotesStore":11,"./TransformStore":12,"events":1,"object-assign":6}],11:[function(require,module,exports){
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
},{"../dispatcher/CanvasAppDispatcher":9,"events":1,"object-assign":6}],12:[function(require,module,exports){
"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var EventEmitter = require('events').EventEmitter;
var _assign = require('object-assign');
var _getRelativeLeftTop = require('../utils/GetRelativeLeftTop.js');
var NotesStore = require('./NotesStore');

var CHANGE_EVENT = 'change';

var _translateStartData;

var _pinchStart = {};

var _transform = {
  translateX: 0,
  translateY: 0,
  scale: 1
};

function _translateStart(hammerEvent) {
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

function _zoomStart(hammerEvent) {
  _translateStartData = {}
  _pinchStart = {};
  _pinchStart.dist = _distHammerPinchEvent(hammerEvent);
  _pinchStart.center = hammerEvent.center;
  _pinchStart.translateX = _transform.translateX;
  _pinchStart.translateY = _transform.translateY;
  _pinchStart.scale = _transform.scale;
  console.log(_pinchStart);
};

function _mousewheelStart(event) {
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
  _transform.translateX = _pinchStart.translateX - _getTranslateDelta(_pinchStart.center.x, _pinchStart.scale, _transform.scale);
  _transform.translateY = _pinchStart.translateY - _getTranslateDelta(_pinchStart.center.y, _pinchStart.scale, _transform.scale);
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
},{"../dispatcher/CanvasAppDispatcher":9,"../utils/GetRelativeLeftTop.js":14,"./NotesStore":11,"events":1,"object-assign":6}],13:[function(require,module,exports){
"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');

module.exports = {
  init: function() {
    this.loadExample();
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
    notesRef.on("child_added", function(snapshot) {
      var note = snapshot.val();
      note.data.textArr = note.data.text.split('\n');
      // this.notes.push(note);
      // this.add( new Rect(note.data.x, note.data.y, note.style.width, note.style.height));
    }.bind(this));

  },
}
},{"../dispatcher/CanvasAppDispatcher":9}],14:[function(require,module,exports){

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9mbHV4L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ZsdXgvbGliL0Rpc3BhdGNoZXIuanMiLCJub2RlX21vZHVsZXMvZmx1eC9saWIvaW52YXJpYW50LmpzIiwibm9kZV9tb2R1bGVzL2hhbW1lcmpzL2hhbW1lci5qcyIsIm5vZGVfbW9kdWxlcy9vYmplY3QtYXNzaWduL2luZGV4LmpzIiwic3JjL2FwcC5qcyIsInNyYy9jb21wb25lbnRzL0NhbnZhc1ZpZXcuanMiLCJzcmMvZGlzcGF0Y2hlci9DYW52YXNBcHBEaXNwYXRjaGVyLmpzIiwic3JjL3N0b3Jlcy9EcmFnRWxlbWVudFN0b3JlLmpzIiwic3JjL3N0b3Jlcy9Ob3Rlc1N0b3JlLmpzIiwic3JjL3N0b3Jlcy9UcmFuc2Zvcm1TdG9yZS5qcyIsInNyYy91dGlscy9GaXJlYmFzZVV0aWxzLmpzIiwic3JjL3V0aWxzL0dldFJlbGF0aXZlTGVmdFRvcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cy5EaXNwYXRjaGVyID0gcmVxdWlyZSgnLi9saWIvRGlzcGF0Y2hlcicpXG4iLCIvKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogQHByb3ZpZGVzTW9kdWxlIERpc3BhdGNoZXJcbiAqIEB0eXBlY2hlY2tzXG4gKi9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCcuL2ludmFyaWFudCcpO1xuXG52YXIgX2xhc3RJRCA9IDE7XG52YXIgX3ByZWZpeCA9ICdJRF8nO1xuXG4vKipcbiAqIERpc3BhdGNoZXIgaXMgdXNlZCB0byBicm9hZGNhc3QgcGF5bG9hZHMgdG8gcmVnaXN0ZXJlZCBjYWxsYmFja3MuIFRoaXMgaXNcbiAqIGRpZmZlcmVudCBmcm9tIGdlbmVyaWMgcHViLXN1YiBzeXN0ZW1zIGluIHR3byB3YXlzOlxuICpcbiAqICAgMSkgQ2FsbGJhY2tzIGFyZSBub3Qgc3Vic2NyaWJlZCB0byBwYXJ0aWN1bGFyIGV2ZW50cy4gRXZlcnkgcGF5bG9hZCBpc1xuICogICAgICBkaXNwYXRjaGVkIHRvIGV2ZXJ5IHJlZ2lzdGVyZWQgY2FsbGJhY2suXG4gKiAgIDIpIENhbGxiYWNrcyBjYW4gYmUgZGVmZXJyZWQgaW4gd2hvbGUgb3IgcGFydCB1bnRpbCBvdGhlciBjYWxsYmFja3MgaGF2ZVxuICogICAgICBiZWVuIGV4ZWN1dGVkLlxuICpcbiAqIEZvciBleGFtcGxlLCBjb25zaWRlciB0aGlzIGh5cG90aGV0aWNhbCBmbGlnaHQgZGVzdGluYXRpb24gZm9ybSwgd2hpY2hcbiAqIHNlbGVjdHMgYSBkZWZhdWx0IGNpdHkgd2hlbiBhIGNvdW50cnkgaXMgc2VsZWN0ZWQ6XG4gKlxuICogICB2YXIgZmxpZ2h0RGlzcGF0Y2hlciA9IG5ldyBEaXNwYXRjaGVyKCk7XG4gKlxuICogICAvLyBLZWVwcyB0cmFjayBvZiB3aGljaCBjb3VudHJ5IGlzIHNlbGVjdGVkXG4gKiAgIHZhciBDb3VudHJ5U3RvcmUgPSB7Y291bnRyeTogbnVsbH07XG4gKlxuICogICAvLyBLZWVwcyB0cmFjayBvZiB3aGljaCBjaXR5IGlzIHNlbGVjdGVkXG4gKiAgIHZhciBDaXR5U3RvcmUgPSB7Y2l0eTogbnVsbH07XG4gKlxuICogICAvLyBLZWVwcyB0cmFjayBvZiB0aGUgYmFzZSBmbGlnaHQgcHJpY2Ugb2YgdGhlIHNlbGVjdGVkIGNpdHlcbiAqICAgdmFyIEZsaWdodFByaWNlU3RvcmUgPSB7cHJpY2U6IG51bGx9XG4gKlxuICogV2hlbiBhIHVzZXIgY2hhbmdlcyB0aGUgc2VsZWN0ZWQgY2l0eSwgd2UgZGlzcGF0Y2ggdGhlIHBheWxvYWQ6XG4gKlxuICogICBmbGlnaHREaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAqICAgICBhY3Rpb25UeXBlOiAnY2l0eS11cGRhdGUnLFxuICogICAgIHNlbGVjdGVkQ2l0eTogJ3BhcmlzJ1xuICogICB9KTtcbiAqXG4gKiBUaGlzIHBheWxvYWQgaXMgZGlnZXN0ZWQgYnkgYENpdHlTdG9yZWA6XG4gKlxuICogICBmbGlnaHREaXNwYXRjaGVyLnJlZ2lzdGVyKGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAqICAgICBpZiAocGF5bG9hZC5hY3Rpb25UeXBlID09PSAnY2l0eS11cGRhdGUnKSB7XG4gKiAgICAgICBDaXR5U3RvcmUuY2l0eSA9IHBheWxvYWQuc2VsZWN0ZWRDaXR5O1xuICogICAgIH1cbiAqICAgfSk7XG4gKlxuICogV2hlbiB0aGUgdXNlciBzZWxlY3RzIGEgY291bnRyeSwgd2UgZGlzcGF0Y2ggdGhlIHBheWxvYWQ6XG4gKlxuICogICBmbGlnaHREaXNwYXRjaGVyLmRpc3BhdGNoKHtcbiAqICAgICBhY3Rpb25UeXBlOiAnY291bnRyeS11cGRhdGUnLFxuICogICAgIHNlbGVjdGVkQ291bnRyeTogJ2F1c3RyYWxpYSdcbiAqICAgfSk7XG4gKlxuICogVGhpcyBwYXlsb2FkIGlzIGRpZ2VzdGVkIGJ5IGJvdGggc3RvcmVzOlxuICpcbiAqICAgIENvdW50cnlTdG9yZS5kaXNwYXRjaFRva2VuID0gZmxpZ2h0RGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gKiAgICAgaWYgKHBheWxvYWQuYWN0aW9uVHlwZSA9PT0gJ2NvdW50cnktdXBkYXRlJykge1xuICogICAgICAgQ291bnRyeVN0b3JlLmNvdW50cnkgPSBwYXlsb2FkLnNlbGVjdGVkQ291bnRyeTtcbiAqICAgICB9XG4gKiAgIH0pO1xuICpcbiAqIFdoZW4gdGhlIGNhbGxiYWNrIHRvIHVwZGF0ZSBgQ291bnRyeVN0b3JlYCBpcyByZWdpc3RlcmVkLCB3ZSBzYXZlIGEgcmVmZXJlbmNlXG4gKiB0byB0aGUgcmV0dXJuZWQgdG9rZW4uIFVzaW5nIHRoaXMgdG9rZW4gd2l0aCBgd2FpdEZvcigpYCwgd2UgY2FuIGd1YXJhbnRlZVxuICogdGhhdCBgQ291bnRyeVN0b3JlYCBpcyB1cGRhdGVkIGJlZm9yZSB0aGUgY2FsbGJhY2sgdGhhdCB1cGRhdGVzIGBDaXR5U3RvcmVgXG4gKiBuZWVkcyB0byBxdWVyeSBpdHMgZGF0YS5cbiAqXG4gKiAgIENpdHlTdG9yZS5kaXNwYXRjaFRva2VuID0gZmxpZ2h0RGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gKiAgICAgaWYgKHBheWxvYWQuYWN0aW9uVHlwZSA9PT0gJ2NvdW50cnktdXBkYXRlJykge1xuICogICAgICAgLy8gYENvdW50cnlTdG9yZS5jb3VudHJ5YCBtYXkgbm90IGJlIHVwZGF0ZWQuXG4gKiAgICAgICBmbGlnaHREaXNwYXRjaGVyLndhaXRGb3IoW0NvdW50cnlTdG9yZS5kaXNwYXRjaFRva2VuXSk7XG4gKiAgICAgICAvLyBgQ291bnRyeVN0b3JlLmNvdW50cnlgIGlzIG5vdyBndWFyYW50ZWVkIHRvIGJlIHVwZGF0ZWQuXG4gKlxuICogICAgICAgLy8gU2VsZWN0IHRoZSBkZWZhdWx0IGNpdHkgZm9yIHRoZSBuZXcgY291bnRyeVxuICogICAgICAgQ2l0eVN0b3JlLmNpdHkgPSBnZXREZWZhdWx0Q2l0eUZvckNvdW50cnkoQ291bnRyeVN0b3JlLmNvdW50cnkpO1xuICogICAgIH1cbiAqICAgfSk7XG4gKlxuICogVGhlIHVzYWdlIG9mIGB3YWl0Rm9yKClgIGNhbiBiZSBjaGFpbmVkLCBmb3IgZXhhbXBsZTpcbiAqXG4gKiAgIEZsaWdodFByaWNlU3RvcmUuZGlzcGF0Y2hUb2tlbiA9XG4gKiAgICAgZmxpZ2h0RGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gKiAgICAgICBzd2l0Y2ggKHBheWxvYWQuYWN0aW9uVHlwZSkge1xuICogICAgICAgICBjYXNlICdjb3VudHJ5LXVwZGF0ZSc6XG4gKiAgICAgICAgICAgZmxpZ2h0RGlzcGF0Y2hlci53YWl0Rm9yKFtDaXR5U3RvcmUuZGlzcGF0Y2hUb2tlbl0pO1xuICogICAgICAgICAgIEZsaWdodFByaWNlU3RvcmUucHJpY2UgPVxuICogICAgICAgICAgICAgZ2V0RmxpZ2h0UHJpY2VTdG9yZShDb3VudHJ5U3RvcmUuY291bnRyeSwgQ2l0eVN0b3JlLmNpdHkpO1xuICogICAgICAgICAgIGJyZWFrO1xuICpcbiAqICAgICAgICAgY2FzZSAnY2l0eS11cGRhdGUnOlxuICogICAgICAgICAgIEZsaWdodFByaWNlU3RvcmUucHJpY2UgPVxuICogICAgICAgICAgICAgRmxpZ2h0UHJpY2VTdG9yZShDb3VudHJ5U3RvcmUuY291bnRyeSwgQ2l0eVN0b3JlLmNpdHkpO1xuICogICAgICAgICAgIGJyZWFrO1xuICogICAgIH1cbiAqICAgfSk7XG4gKlxuICogVGhlIGBjb3VudHJ5LXVwZGF0ZWAgcGF5bG9hZCB3aWxsIGJlIGd1YXJhbnRlZWQgdG8gaW52b2tlIHRoZSBzdG9yZXMnXG4gKiByZWdpc3RlcmVkIGNhbGxiYWNrcyBpbiBvcmRlcjogYENvdW50cnlTdG9yZWAsIGBDaXR5U3RvcmVgLCB0aGVuXG4gKiBgRmxpZ2h0UHJpY2VTdG9yZWAuXG4gKi9cblxuICBmdW5jdGlvbiBEaXNwYXRjaGVyKCkge1xuICAgIHRoaXMuJERpc3BhdGNoZXJfY2FsbGJhY2tzID0ge307XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9pc1BlbmRpbmcgPSB7fTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2lzSGFuZGxlZCA9IHt9O1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNEaXNwYXRjaGluZyA9IGZhbHNlO1xuICAgIHRoaXMuJERpc3BhdGNoZXJfcGVuZGluZ1BheWxvYWQgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIGNhbGxiYWNrIHRvIGJlIGludm9rZWQgd2l0aCBldmVyeSBkaXNwYXRjaGVkIHBheWxvYWQuIFJldHVybnNcbiAgICogYSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHdpdGggYHdhaXRGb3IoKWAuXG4gICAqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICovXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLnJlZ2lzdGVyPWZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIGlkID0gX3ByZWZpeCArIF9sYXN0SUQrKztcbiAgICB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrc1tpZF0gPSBjYWxsYmFjaztcbiAgICByZXR1cm4gaWQ7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYSBjYWxsYmFjayBiYXNlZCBvbiBpdHMgdG9rZW4uXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBpZFxuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUudW5yZWdpc3Rlcj1mdW5jdGlvbihpZCkge1xuICAgIGludmFyaWFudChcbiAgICAgIHRoaXMuJERpc3BhdGNoZXJfY2FsbGJhY2tzW2lkXSxcbiAgICAgICdEaXNwYXRjaGVyLnVucmVnaXN0ZXIoLi4uKTogYCVzYCBkb2VzIG5vdCBtYXAgdG8gYSByZWdpc3RlcmVkIGNhbGxiYWNrLicsXG4gICAgICBpZFxuICAgICk7XG4gICAgZGVsZXRlIHRoaXMuJERpc3BhdGNoZXJfY2FsbGJhY2tzW2lkXTtcbiAgfTtcblxuICAvKipcbiAgICogV2FpdHMgZm9yIHRoZSBjYWxsYmFja3Mgc3BlY2lmaWVkIHRvIGJlIGludm9rZWQgYmVmb3JlIGNvbnRpbnVpbmcgZXhlY3V0aW9uXG4gICAqIG9mIHRoZSBjdXJyZW50IGNhbGxiYWNrLiBUaGlzIG1ldGhvZCBzaG91bGQgb25seSBiZSB1c2VkIGJ5IGEgY2FsbGJhY2sgaW5cbiAgICogcmVzcG9uc2UgdG8gYSBkaXNwYXRjaGVkIHBheWxvYWQuXG4gICAqXG4gICAqIEBwYXJhbSB7YXJyYXk8c3RyaW5nPn0gaWRzXG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS53YWl0Rm9yPWZ1bmN0aW9uKGlkcykge1xuICAgIGludmFyaWFudChcbiAgICAgIHRoaXMuJERpc3BhdGNoZXJfaXNEaXNwYXRjaGluZyxcbiAgICAgICdEaXNwYXRjaGVyLndhaXRGb3IoLi4uKTogTXVzdCBiZSBpbnZva2VkIHdoaWxlIGRpc3BhdGNoaW5nLidcbiAgICApO1xuICAgIGZvciAodmFyIGlpID0gMDsgaWkgPCBpZHMubGVuZ3RoOyBpaSsrKSB7XG4gICAgICB2YXIgaWQgPSBpZHNbaWldO1xuICAgICAgaWYgKHRoaXMuJERpc3BhdGNoZXJfaXNQZW5kaW5nW2lkXSkge1xuICAgICAgICBpbnZhcmlhbnQoXG4gICAgICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0hhbmRsZWRbaWRdLFxuICAgICAgICAgICdEaXNwYXRjaGVyLndhaXRGb3IoLi4uKTogQ2lyY3VsYXIgZGVwZW5kZW5jeSBkZXRlY3RlZCB3aGlsZSAnICtcbiAgICAgICAgICAnd2FpdGluZyBmb3IgYCVzYC4nLFxuICAgICAgICAgIGlkXG4gICAgICAgICk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaW52YXJpYW50KFxuICAgICAgICB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrc1tpZF0sXG4gICAgICAgICdEaXNwYXRjaGVyLndhaXRGb3IoLi4uKTogYCVzYCBkb2VzIG5vdCBtYXAgdG8gYSByZWdpc3RlcmVkIGNhbGxiYWNrLicsXG4gICAgICAgIGlkXG4gICAgICApO1xuICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9pbnZva2VDYWxsYmFjayhpZCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBEaXNwYXRjaGVzIGEgcGF5bG9hZCB0byBhbGwgcmVnaXN0ZXJlZCBjYWxsYmFja3MuXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBwYXlsb2FkXG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS5kaXNwYXRjaD1mdW5jdGlvbihwYXlsb2FkKSB7XG4gICAgaW52YXJpYW50KFxuICAgICAgIXRoaXMuJERpc3BhdGNoZXJfaXNEaXNwYXRjaGluZyxcbiAgICAgICdEaXNwYXRjaC5kaXNwYXRjaCguLi4pOiBDYW5ub3QgZGlzcGF0Y2ggaW4gdGhlIG1pZGRsZSBvZiBhIGRpc3BhdGNoLidcbiAgICApO1xuICAgIHRoaXMuJERpc3BhdGNoZXJfc3RhcnREaXNwYXRjaGluZyhwYXlsb2FkKTtcbiAgICB0cnkge1xuICAgICAgZm9yICh2YXIgaWQgaW4gdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3MpIHtcbiAgICAgICAgaWYgKHRoaXMuJERpc3BhdGNoZXJfaXNQZW5kaW5nW2lkXSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuJERpc3BhdGNoZXJfaW52b2tlQ2FsbGJhY2soaWQpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLiREaXNwYXRjaGVyX3N0b3BEaXNwYXRjaGluZygpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogSXMgdGhpcyBEaXNwYXRjaGVyIGN1cnJlbnRseSBkaXNwYXRjaGluZy5cbiAgICpcbiAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICovXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLmlzRGlzcGF0Y2hpbmc9ZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuJERpc3BhdGNoZXJfaXNEaXNwYXRjaGluZztcbiAgfTtcblxuICAvKipcbiAgICogQ2FsbCB0aGUgY2FsbGJhY2sgc3RvcmVkIHdpdGggdGhlIGdpdmVuIGlkLiBBbHNvIGRvIHNvbWUgaW50ZXJuYWxcbiAgICogYm9va2tlZXBpbmcuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBpZFxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLiREaXNwYXRjaGVyX2ludm9rZUNhbGxiYWNrPWZ1bmN0aW9uKGlkKSB7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9pc1BlbmRpbmdbaWRdID0gdHJ1ZTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrc1tpZF0odGhpcy4kRGlzcGF0Y2hlcl9wZW5kaW5nUGF5bG9hZCk7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0hhbmRsZWRbaWRdID0gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IHVwIGJvb2trZWVwaW5nIG5lZWRlZCB3aGVuIGRpc3BhdGNoaW5nLlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gcGF5bG9hZFxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLiREaXNwYXRjaGVyX3N0YXJ0RGlzcGF0Y2hpbmc9ZnVuY3Rpb24ocGF5bG9hZCkge1xuICAgIGZvciAodmFyIGlkIGluIHRoaXMuJERpc3BhdGNoZXJfY2FsbGJhY2tzKSB7XG4gICAgICB0aGlzLiREaXNwYXRjaGVyX2lzUGVuZGluZ1tpZF0gPSBmYWxzZTtcbiAgICAgIHRoaXMuJERpc3BhdGNoZXJfaXNIYW5kbGVkW2lkXSA9IGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLiREaXNwYXRjaGVyX3BlbmRpbmdQYXlsb2FkID0gcGF5bG9hZDtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmcgPSB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDbGVhciBib29ra2VlcGluZyB1c2VkIGZvciBkaXNwYXRjaGluZy5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS4kRGlzcGF0Y2hlcl9zdG9wRGlzcGF0Y2hpbmc9ZnVuY3Rpb24oKSB7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9wZW5kaW5nUGF5bG9hZCA9IG51bGw7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0Rpc3BhdGNoaW5nID0gZmFsc2U7XG4gIH07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBEaXNwYXRjaGVyO1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBAcHJvdmlkZXNNb2R1bGUgaW52YXJpYW50XG4gKi9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKlxuICogVXNlIGludmFyaWFudCgpIHRvIGFzc2VydCBzdGF0ZSB3aGljaCB5b3VyIHByb2dyYW0gYXNzdW1lcyB0byBiZSB0cnVlLlxuICpcbiAqIFByb3ZpZGUgc3ByaW50Zi1zdHlsZSBmb3JtYXQgKG9ubHkgJXMgaXMgc3VwcG9ydGVkKSBhbmQgYXJndW1lbnRzXG4gKiB0byBwcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IHdoYXQgYnJva2UgYW5kIHdoYXQgeW91IHdlcmVcbiAqIGV4cGVjdGluZy5cbiAqXG4gKiBUaGUgaW52YXJpYW50IG1lc3NhZ2Ugd2lsbCBiZSBzdHJpcHBlZCBpbiBwcm9kdWN0aW9uLCBidXQgdGhlIGludmFyaWFudFxuICogd2lsbCByZW1haW4gdG8gZW5zdXJlIGxvZ2ljIGRvZXMgbm90IGRpZmZlciBpbiBwcm9kdWN0aW9uLlxuICovXG5cbnZhciBpbnZhcmlhbnQgPSBmdW5jdGlvbihjb25kaXRpb24sIGZvcm1hdCwgYSwgYiwgYywgZCwgZSwgZikge1xuICBpZiAoZmFsc2UpIHtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YXJpYW50IHJlcXVpcmVzIGFuIGVycm9yIG1lc3NhZ2UgYXJndW1lbnQnKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWNvbmRpdGlvbikge1xuICAgIHZhciBlcnJvcjtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICAnTWluaWZpZWQgZXhjZXB0aW9uIG9jY3VycmVkOyB1c2UgdGhlIG5vbi1taW5pZmllZCBkZXYgZW52aXJvbm1lbnQgJyArXG4gICAgICAgICdmb3IgdGhlIGZ1bGwgZXJyb3IgbWVzc2FnZSBhbmQgYWRkaXRpb25hbCBoZWxwZnVsIHdhcm5pbmdzLidcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBhcmdzID0gW2EsIGIsIGMsIGQsIGUsIGZdO1xuICAgICAgdmFyIGFyZ0luZGV4ID0gMDtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICAnSW52YXJpYW50IFZpb2xhdGlvbjogJyArXG4gICAgICAgIGZvcm1hdC5yZXBsYWNlKC8lcy9nLCBmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3NbYXJnSW5kZXgrK107IH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIGVycm9yLmZyYW1lc1RvUG9wID0gMTsgLy8gd2UgZG9uJ3QgY2FyZSBhYm91dCBpbnZhcmlhbnQncyBvd24gZnJhbWVcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbnZhcmlhbnQ7XG4iLCIvKiEgSGFtbWVyLkpTIC0gdjIuMC40IC0gMjAxNC0wOS0yOFxyXG4gKiBodHRwOi8vaGFtbWVyanMuZ2l0aHViLmlvL1xyXG4gKlxyXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgSm9yaWsgVGFuZ2VsZGVyO1xyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UgKi9cclxuKGZ1bmN0aW9uKHdpbmRvdywgZG9jdW1lbnQsIGV4cG9ydE5hbWUsIHVuZGVmaW5lZCkge1xyXG4gICd1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBWRU5ET1JfUFJFRklYRVMgPSBbJycsICd3ZWJraXQnLCAnbW96JywgJ01TJywgJ21zJywgJ28nXTtcclxudmFyIFRFU1RfRUxFTUVOVCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cclxudmFyIFRZUEVfRlVOQ1RJT04gPSAnZnVuY3Rpb24nO1xyXG5cclxudmFyIHJvdW5kID0gTWF0aC5yb3VuZDtcclxudmFyIGFicyA9IE1hdGguYWJzO1xyXG52YXIgbm93ID0gRGF0ZS5ub3c7XHJcblxyXG4vKipcclxuICogc2V0IGEgdGltZW91dCB3aXRoIGEgZ2l2ZW4gc2NvcGVcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVvdXRcclxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHRcclxuICogQHJldHVybnMge251bWJlcn1cclxuICovXHJcbmZ1bmN0aW9uIHNldFRpbWVvdXRDb250ZXh0KGZuLCB0aW1lb3V0LCBjb250ZXh0KSB7XHJcbiAgICByZXR1cm4gc2V0VGltZW91dChiaW5kRm4oZm4sIGNvbnRleHQpLCB0aW1lb3V0KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGlmIHRoZSBhcmd1bWVudCBpcyBhbiBhcnJheSwgd2Ugd2FudCB0byBleGVjdXRlIHRoZSBmbiBvbiBlYWNoIGVudHJ5XHJcbiAqIGlmIGl0IGFpbnQgYW4gYXJyYXkgd2UgZG9uJ3Qgd2FudCB0byBkbyBhIHRoaW5nLlxyXG4gKiB0aGlzIGlzIHVzZWQgYnkgYWxsIHRoZSBtZXRob2RzIHRoYXQgYWNjZXB0IGEgc2luZ2xlIGFuZCBhcnJheSBhcmd1bWVudC5cclxuICogQHBhcmFtIHsqfEFycmF5fSBhcmdcclxuICogQHBhcmFtIHtTdHJpbmd9IGZuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbY29udGV4dF1cclxuICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiBpbnZva2VBcnJheUFyZyhhcmcsIGZuLCBjb250ZXh0KSB7XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XHJcbiAgICAgICAgZWFjaChhcmcsIGNvbnRleHRbZm5dLCBjb250ZXh0KTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHdhbGsgb2JqZWN0cyBhbmQgYXJyYXlzXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gaXRlcmF0b3JcclxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHRcclxuICovXHJcbmZ1bmN0aW9uIGVhY2gob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xyXG4gICAgdmFyIGk7XHJcblxyXG4gICAgaWYgKCFvYmopIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG9iai5mb3JFYWNoKSB7XHJcbiAgICAgICAgb2JqLmZvckVhY2goaXRlcmF0b3IsIGNvbnRleHQpO1xyXG4gICAgfSBlbHNlIGlmIChvYmoubGVuZ3RoICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICBpID0gMDtcclxuICAgICAgICB3aGlsZSAoaSA8IG9iai5sZW5ndGgpIHtcclxuICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaik7XHJcbiAgICAgICAgICAgIGkrKztcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGZvciAoaSBpbiBvYmopIHtcclxuICAgICAgICAgICAgb2JqLmhhc093blByb3BlcnR5KGkpICYmIGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2ldLCBpLCBvYmopO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIGV4dGVuZCBvYmplY3QuXHJcbiAqIG1lYW5zIHRoYXQgcHJvcGVydGllcyBpbiBkZXN0IHdpbGwgYmUgb3ZlcndyaXR0ZW4gYnkgdGhlIG9uZXMgaW4gc3JjLlxyXG4gKiBAcGFyYW0ge09iamVjdH0gZGVzdFxyXG4gKiBAcGFyYW0ge09iamVjdH0gc3JjXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW21lcmdlXVxyXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBkZXN0XHJcbiAqL1xyXG5mdW5jdGlvbiBleHRlbmQoZGVzdCwgc3JjLCBtZXJnZSkge1xyXG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhzcmMpO1xyXG4gICAgdmFyIGkgPSAwO1xyXG4gICAgd2hpbGUgKGkgPCBrZXlzLmxlbmd0aCkge1xyXG4gICAgICAgIGlmICghbWVyZ2UgfHwgKG1lcmdlICYmIGRlc3Rba2V5c1tpXV0gPT09IHVuZGVmaW5lZCkpIHtcclxuICAgICAgICAgICAgZGVzdFtrZXlzW2ldXSA9IHNyY1trZXlzW2ldXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaSsrO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGRlc3Q7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBtZXJnZSB0aGUgdmFsdWVzIGZyb20gc3JjIGluIHRoZSBkZXN0LlxyXG4gKiBtZWFucyB0aGF0IHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBkZXN0IHdpbGwgbm90IGJlIG92ZXJ3cml0dGVuIGJ5IHNyY1xyXG4gKiBAcGFyYW0ge09iamVjdH0gZGVzdFxyXG4gKiBAcGFyYW0ge09iamVjdH0gc3JjXHJcbiAqIEByZXR1cm5zIHtPYmplY3R9IGRlc3RcclxuICovXHJcbmZ1bmN0aW9uIG1lcmdlKGRlc3QsIHNyYykge1xyXG4gICAgcmV0dXJuIGV4dGVuZChkZXN0LCBzcmMsIHRydWUpO1xyXG59XHJcblxyXG4vKipcclxuICogc2ltcGxlIGNsYXNzIGluaGVyaXRhbmNlXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNoaWxkXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGJhc2VcclxuICogQHBhcmFtIHtPYmplY3R9IFtwcm9wZXJ0aWVzXVxyXG4gKi9cclxuZnVuY3Rpb24gaW5oZXJpdChjaGlsZCwgYmFzZSwgcHJvcGVydGllcykge1xyXG4gICAgdmFyIGJhc2VQID0gYmFzZS5wcm90b3R5cGUsXHJcbiAgICAgICAgY2hpbGRQO1xyXG5cclxuICAgIGNoaWxkUCA9IGNoaWxkLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoYmFzZVApO1xyXG4gICAgY2hpbGRQLmNvbnN0cnVjdG9yID0gY2hpbGQ7XHJcbiAgICBjaGlsZFAuX3N1cGVyID0gYmFzZVA7XHJcblxyXG4gICAgaWYgKHByb3BlcnRpZXMpIHtcclxuICAgICAgICBleHRlbmQoY2hpbGRQLCBwcm9wZXJ0aWVzKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIHNpbXBsZSBmdW5jdGlvbiBiaW5kXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0XHJcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cclxuICovXHJcbmZ1bmN0aW9uIGJpbmRGbihmbiwgY29udGV4dCkge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGJvdW5kRm4oKSB7XHJcbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7XHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogbGV0IGEgYm9vbGVhbiB2YWx1ZSBhbHNvIGJlIGEgZnVuY3Rpb24gdGhhdCBtdXN0IHJldHVybiBhIGJvb2xlYW5cclxuICogdGhpcyBmaXJzdCBpdGVtIGluIGFyZ3Mgd2lsbCBiZSB1c2VkIGFzIHRoZSBjb250ZXh0XHJcbiAqIEBwYXJhbSB7Qm9vbGVhbnxGdW5jdGlvbn0gdmFsXHJcbiAqIEBwYXJhbSB7QXJyYXl9IFthcmdzXVxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIGJvb2xPckZuKHZhbCwgYXJncykge1xyXG4gICAgaWYgKHR5cGVvZiB2YWwgPT0gVFlQRV9GVU5DVElPTikge1xyXG4gICAgICAgIHJldHVybiB2YWwuYXBwbHkoYXJncyA/IGFyZ3NbMF0gfHwgdW5kZWZpbmVkIDogdW5kZWZpbmVkLCBhcmdzKTtcclxuICAgIH1cclxuICAgIHJldHVybiB2YWw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiB1c2UgdGhlIHZhbDIgd2hlbiB2YWwxIGlzIHVuZGVmaW5lZFxyXG4gKiBAcGFyYW0geyp9IHZhbDFcclxuICogQHBhcmFtIHsqfSB2YWwyXHJcbiAqIEByZXR1cm5zIHsqfVxyXG4gKi9cclxuZnVuY3Rpb24gaWZVbmRlZmluZWQodmFsMSwgdmFsMikge1xyXG4gICAgcmV0dXJuICh2YWwxID09PSB1bmRlZmluZWQpID8gdmFsMiA6IHZhbDE7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBhZGRFdmVudExpc3RlbmVyIHdpdGggbXVsdGlwbGUgZXZlbnRzIGF0IG9uY2VcclxuICogQHBhcmFtIHtFdmVudFRhcmdldH0gdGFyZ2V0XHJcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlc1xyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXHJcbiAqL1xyXG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVycyh0YXJnZXQsIHR5cGVzLCBoYW5kbGVyKSB7XHJcbiAgICBlYWNoKHNwbGl0U3RyKHR5cGVzKSwgZnVuY3Rpb24odHlwZSkge1xyXG4gICAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGhhbmRsZXIsIGZhbHNlKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG4vKipcclxuICogcmVtb3ZlRXZlbnRMaXN0ZW5lciB3aXRoIG11bHRpcGxlIGV2ZW50cyBhdCBvbmNlXHJcbiAqIEBwYXJhbSB7RXZlbnRUYXJnZXR9IHRhcmdldFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZXNcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlclxyXG4gKi9cclxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRMaXN0ZW5lcnModGFyZ2V0LCB0eXBlcywgaGFuZGxlcikge1xyXG4gICAgZWFjaChzcGxpdFN0cih0eXBlcyksIGZ1bmN0aW9uKHR5cGUpIHtcclxuICAgICAgICB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBoYW5kbGVyLCBmYWxzZSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGZpbmQgaWYgYSBub2RlIGlzIGluIHRoZSBnaXZlbiBwYXJlbnRcclxuICogQG1ldGhvZCBoYXNQYXJlbnRcclxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxyXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYXJlbnRcclxuICogQHJldHVybiB7Qm9vbGVhbn0gZm91bmRcclxuICovXHJcbmZ1bmN0aW9uIGhhc1BhcmVudChub2RlLCBwYXJlbnQpIHtcclxuICAgIHdoaWxlIChub2RlKSB7XHJcbiAgICAgICAgaWYgKG5vZGUgPT0gcGFyZW50KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBub2RlID0gbm9kZS5wYXJlbnROb2RlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG4vKipcclxuICogc21hbGwgaW5kZXhPZiB3cmFwcGVyXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcclxuICogQHBhcmFtIHtTdHJpbmd9IGZpbmRcclxuICogQHJldHVybnMge0Jvb2xlYW59IGZvdW5kXHJcbiAqL1xyXG5mdW5jdGlvbiBpblN0cihzdHIsIGZpbmQpIHtcclxuICAgIHJldHVybiBzdHIuaW5kZXhPZihmaW5kKSA+IC0xO1xyXG59XHJcblxyXG4vKipcclxuICogc3BsaXQgc3RyaW5nIG9uIHdoaXRlc3BhY2VcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxyXG4gKiBAcmV0dXJucyB7QXJyYXl9IHdvcmRzXHJcbiAqL1xyXG5mdW5jdGlvbiBzcGxpdFN0cihzdHIpIHtcclxuICAgIHJldHVybiBzdHIudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xyXG59XHJcblxyXG4vKipcclxuICogZmluZCBpZiBhIGFycmF5IGNvbnRhaW5zIHRoZSBvYmplY3QgdXNpbmcgaW5kZXhPZiBvciBhIHNpbXBsZSBwb2x5RmlsbFxyXG4gKiBAcGFyYW0ge0FycmF5fSBzcmNcclxuICogQHBhcmFtIHtTdHJpbmd9IGZpbmRcclxuICogQHBhcmFtIHtTdHJpbmd9IFtmaW5kQnlLZXldXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW58TnVtYmVyfSBmYWxzZSB3aGVuIG5vdCBmb3VuZCwgb3IgdGhlIGluZGV4XHJcbiAqL1xyXG5mdW5jdGlvbiBpbkFycmF5KHNyYywgZmluZCwgZmluZEJ5S2V5KSB7XHJcbiAgICBpZiAoc3JjLmluZGV4T2YgJiYgIWZpbmRCeUtleSkge1xyXG4gICAgICAgIHJldHVybiBzcmMuaW5kZXhPZihmaW5kKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFyIGkgPSAwO1xyXG4gICAgICAgIHdoaWxlIChpIDwgc3JjLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBpZiAoKGZpbmRCeUtleSAmJiBzcmNbaV1bZmluZEJ5S2V5XSA9PSBmaW5kKSB8fCAoIWZpbmRCeUtleSAmJiBzcmNbaV0gPT09IGZpbmQpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpKys7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAtMTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIGNvbnZlcnQgYXJyYXktbGlrZSBvYmplY3RzIHRvIHJlYWwgYXJyYXlzXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcclxuICogQHJldHVybnMge0FycmF5fVxyXG4gKi9cclxuZnVuY3Rpb24gdG9BcnJheShvYmopIHtcclxuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChvYmosIDApO1xyXG59XHJcblxyXG4vKipcclxuICogdW5pcXVlIGFycmF5IHdpdGggb2JqZWN0cyBiYXNlZCBvbiBhIGtleSAobGlrZSAnaWQnKSBvciBqdXN0IGJ5IHRoZSBhcnJheSdzIHZhbHVlXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHNyYyBbe2lkOjF9LHtpZDoyfSx7aWQ6MX1dXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBba2V5XVxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtzb3J0PUZhbHNlXVxyXG4gKiBAcmV0dXJucyB7QXJyYXl9IFt7aWQ6MX0se2lkOjJ9XVxyXG4gKi9cclxuZnVuY3Rpb24gdW5pcXVlQXJyYXkoc3JjLCBrZXksIHNvcnQpIHtcclxuICAgIHZhciByZXN1bHRzID0gW107XHJcbiAgICB2YXIgdmFsdWVzID0gW107XHJcbiAgICB2YXIgaSA9IDA7XHJcblxyXG4gICAgd2hpbGUgKGkgPCBzcmMubGVuZ3RoKSB7XHJcbiAgICAgICAgdmFyIHZhbCA9IGtleSA/IHNyY1tpXVtrZXldIDogc3JjW2ldO1xyXG4gICAgICAgIGlmIChpbkFycmF5KHZhbHVlcywgdmFsKSA8IDApIHtcclxuICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHNyY1tpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhbHVlc1tpXSA9IHZhbDtcclxuICAgICAgICBpKys7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNvcnQpIHtcclxuICAgICAgICBpZiAoIWtleSkge1xyXG4gICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5zb3J0KCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuc29ydChmdW5jdGlvbiBzb3J0VW5pcXVlQXJyYXkoYSwgYikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFba2V5XSA+IGJba2V5XTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHRzO1xyXG59XHJcblxyXG4vKipcclxuICogZ2V0IHRoZSBwcmVmaXhlZCBwcm9wZXJ0eVxyXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxyXG4gKiBAcmV0dXJucyB7U3RyaW5nfFVuZGVmaW5lZH0gcHJlZml4ZWRcclxuICovXHJcbmZ1bmN0aW9uIHByZWZpeGVkKG9iaiwgcHJvcGVydHkpIHtcclxuICAgIHZhciBwcmVmaXgsIHByb3A7XHJcbiAgICB2YXIgY2FtZWxQcm9wID0gcHJvcGVydHlbMF0udG9VcHBlckNhc2UoKSArIHByb3BlcnR5LnNsaWNlKDEpO1xyXG5cclxuICAgIHZhciBpID0gMDtcclxuICAgIHdoaWxlIChpIDwgVkVORE9SX1BSRUZJWEVTLmxlbmd0aCkge1xyXG4gICAgICAgIHByZWZpeCA9IFZFTkRPUl9QUkVGSVhFU1tpXTtcclxuICAgICAgICBwcm9wID0gKHByZWZpeCkgPyBwcmVmaXggKyBjYW1lbFByb3AgOiBwcm9wZXJ0eTtcclxuXHJcbiAgICAgICAgaWYgKHByb3AgaW4gb2JqKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwcm9wO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpKys7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG59XHJcblxyXG4vKipcclxuICogZ2V0IGEgdW5pcXVlIGlkXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9IHVuaXF1ZUlkXHJcbiAqL1xyXG52YXIgX3VuaXF1ZUlkID0gMTtcclxuZnVuY3Rpb24gdW5pcXVlSWQoKSB7XHJcbiAgICByZXR1cm4gX3VuaXF1ZUlkKys7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBnZXQgdGhlIHdpbmRvdyBvYmplY3Qgb2YgYW4gZWxlbWVudFxyXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtZW50XHJcbiAqIEByZXR1cm5zIHtEb2N1bWVudFZpZXd8V2luZG93fVxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0V2luZG93Rm9yRWxlbWVudChlbGVtZW50KSB7XHJcbiAgICB2YXIgZG9jID0gZWxlbWVudC5vd25lckRvY3VtZW50O1xyXG4gICAgcmV0dXJuIChkb2MuZGVmYXVsdFZpZXcgfHwgZG9jLnBhcmVudFdpbmRvdyk7XHJcbn1cclxuXHJcbnZhciBNT0JJTEVfUkVHRVggPSAvbW9iaWxlfHRhYmxldHxpcChhZHxob25lfG9kKXxhbmRyb2lkL2k7XHJcblxyXG52YXIgU1VQUE9SVF9UT1VDSCA9ICgnb250b3VjaHN0YXJ0JyBpbiB3aW5kb3cpO1xyXG52YXIgU1VQUE9SVF9QT0lOVEVSX0VWRU5UUyA9IHByZWZpeGVkKHdpbmRvdywgJ1BvaW50ZXJFdmVudCcpICE9PSB1bmRlZmluZWQ7XHJcbnZhciBTVVBQT1JUX09OTFlfVE9VQ0ggPSBTVVBQT1JUX1RPVUNIICYmIE1PQklMRV9SRUdFWC50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xyXG5cclxudmFyIElOUFVUX1RZUEVfVE9VQ0ggPSAndG91Y2gnO1xyXG52YXIgSU5QVVRfVFlQRV9QRU4gPSAncGVuJztcclxudmFyIElOUFVUX1RZUEVfTU9VU0UgPSAnbW91c2UnO1xyXG52YXIgSU5QVVRfVFlQRV9LSU5FQ1QgPSAna2luZWN0JztcclxuXHJcbnZhciBDT01QVVRFX0lOVEVSVkFMID0gMjU7XHJcblxyXG52YXIgSU5QVVRfU1RBUlQgPSAxO1xyXG52YXIgSU5QVVRfTU9WRSA9IDI7XHJcbnZhciBJTlBVVF9FTkQgPSA0O1xyXG52YXIgSU5QVVRfQ0FOQ0VMID0gODtcclxuXHJcbnZhciBESVJFQ1RJT05fTk9ORSA9IDE7XHJcbnZhciBESVJFQ1RJT05fTEVGVCA9IDI7XHJcbnZhciBESVJFQ1RJT05fUklHSFQgPSA0O1xyXG52YXIgRElSRUNUSU9OX1VQID0gODtcclxudmFyIERJUkVDVElPTl9ET1dOID0gMTY7XHJcblxyXG52YXIgRElSRUNUSU9OX0hPUklaT05UQUwgPSBESVJFQ1RJT05fTEVGVCB8IERJUkVDVElPTl9SSUdIVDtcclxudmFyIERJUkVDVElPTl9WRVJUSUNBTCA9IERJUkVDVElPTl9VUCB8IERJUkVDVElPTl9ET1dOO1xyXG52YXIgRElSRUNUSU9OX0FMTCA9IERJUkVDVElPTl9IT1JJWk9OVEFMIHwgRElSRUNUSU9OX1ZFUlRJQ0FMO1xyXG5cclxudmFyIFBST1BTX1hZID0gWyd4JywgJ3knXTtcclxudmFyIFBST1BTX0NMSUVOVF9YWSA9IFsnY2xpZW50WCcsICdjbGllbnRZJ107XHJcblxyXG4vKipcclxuICogY3JlYXRlIG5ldyBpbnB1dCB0eXBlIG1hbmFnZXJcclxuICogQHBhcmFtIHtNYW5hZ2VyfSBtYW5hZ2VyXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXHJcbiAqIEByZXR1cm5zIHtJbnB1dH1cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBJbnB1dChtYW5hZ2VyLCBjYWxsYmFjaykge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgdGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcclxuICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcclxuICAgIHRoaXMuZWxlbWVudCA9IG1hbmFnZXIuZWxlbWVudDtcclxuICAgIHRoaXMudGFyZ2V0ID0gbWFuYWdlci5vcHRpb25zLmlucHV0VGFyZ2V0O1xyXG5cclxuICAgIC8vIHNtYWxsZXIgd3JhcHBlciBhcm91bmQgdGhlIGhhbmRsZXIsIGZvciB0aGUgc2NvcGUgYW5kIHRoZSBlbmFibGVkIHN0YXRlIG9mIHRoZSBtYW5hZ2VyLFxyXG4gICAgLy8gc28gd2hlbiBkaXNhYmxlZCB0aGUgaW5wdXQgZXZlbnRzIGFyZSBjb21wbGV0ZWx5IGJ5cGFzc2VkLlxyXG4gICAgdGhpcy5kb21IYW5kbGVyID0gZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICBpZiAoYm9vbE9yRm4obWFuYWdlci5vcHRpb25zLmVuYWJsZSwgW21hbmFnZXJdKSkge1xyXG4gICAgICAgICAgICBzZWxmLmhhbmRsZXIoZXYpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5pbml0KCk7XHJcblxyXG59XHJcblxyXG5JbnB1dC5wcm90b3R5cGUgPSB7XHJcbiAgICAvKipcclxuICAgICAqIHNob3VsZCBoYW5kbGUgdGhlIGlucHV0RXZlbnQgZGF0YSBhbmQgdHJpZ2dlciB0aGUgY2FsbGJhY2tcclxuICAgICAqIEB2aXJ0dWFsXHJcbiAgICAgKi9cclxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uKCkgeyB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogYmluZCB0aGUgZXZlbnRzXHJcbiAgICAgKi9cclxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuZXZFbCAmJiBhZGRFdmVudExpc3RlbmVycyh0aGlzLmVsZW1lbnQsIHRoaXMuZXZFbCwgdGhpcy5kb21IYW5kbGVyKTtcclxuICAgICAgICB0aGlzLmV2VGFyZ2V0ICYmIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMudGFyZ2V0LCB0aGlzLmV2VGFyZ2V0LCB0aGlzLmRvbUhhbmRsZXIpO1xyXG4gICAgICAgIHRoaXMuZXZXaW4gJiYgYWRkRXZlbnRMaXN0ZW5lcnMoZ2V0V2luZG93Rm9yRWxlbWVudCh0aGlzLmVsZW1lbnQpLCB0aGlzLmV2V2luLCB0aGlzLmRvbUhhbmRsZXIpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHVuYmluZCB0aGUgZXZlbnRzXHJcbiAgICAgKi9cclxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuZXZFbCAmJiByZW1vdmVFdmVudExpc3RlbmVycyh0aGlzLmVsZW1lbnQsIHRoaXMuZXZFbCwgdGhpcy5kb21IYW5kbGVyKTtcclxuICAgICAgICB0aGlzLmV2VGFyZ2V0ICYmIHJlbW92ZUV2ZW50TGlzdGVuZXJzKHRoaXMudGFyZ2V0LCB0aGlzLmV2VGFyZ2V0LCB0aGlzLmRvbUhhbmRsZXIpO1xyXG4gICAgICAgIHRoaXMuZXZXaW4gJiYgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMoZ2V0V2luZG93Rm9yRWxlbWVudCh0aGlzLmVsZW1lbnQpLCB0aGlzLmV2V2luLCB0aGlzLmRvbUhhbmRsZXIpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIGNyZWF0ZSBuZXcgaW5wdXQgdHlwZSBtYW5hZ2VyXHJcbiAqIGNhbGxlZCBieSB0aGUgTWFuYWdlciBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge0hhbW1lcn0gbWFuYWdlclxyXG4gKiBAcmV0dXJucyB7SW5wdXR9XHJcbiAqL1xyXG5mdW5jdGlvbiBjcmVhdGVJbnB1dEluc3RhbmNlKG1hbmFnZXIpIHtcclxuICAgIHZhciBUeXBlO1xyXG4gICAgdmFyIGlucHV0Q2xhc3MgPSBtYW5hZ2VyLm9wdGlvbnMuaW5wdXRDbGFzcztcclxuXHJcbiAgICBpZiAoaW5wdXRDbGFzcykge1xyXG4gICAgICAgIFR5cGUgPSBpbnB1dENsYXNzO1xyXG4gICAgfSBlbHNlIGlmIChTVVBQT1JUX1BPSU5URVJfRVZFTlRTKSB7XHJcbiAgICAgICAgVHlwZSA9IFBvaW50ZXJFdmVudElucHV0O1xyXG4gICAgfSBlbHNlIGlmIChTVVBQT1JUX09OTFlfVE9VQ0gpIHtcclxuICAgICAgICBUeXBlID0gVG91Y2hJbnB1dDtcclxuICAgIH0gZWxzZSBpZiAoIVNVUFBPUlRfVE9VQ0gpIHtcclxuICAgICAgICBUeXBlID0gTW91c2VJbnB1dDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgVHlwZSA9IFRvdWNoTW91c2VJbnB1dDtcclxuICAgIH1cclxuICAgIHJldHVybiBuZXcgKFR5cGUpKG1hbmFnZXIsIGlucHV0SGFuZGxlcik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBoYW5kbGUgaW5wdXQgZXZlbnRzXHJcbiAqIEBwYXJhbSB7TWFuYWdlcn0gbWFuYWdlclxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRUeXBlXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dFxyXG4gKi9cclxuZnVuY3Rpb24gaW5wdXRIYW5kbGVyKG1hbmFnZXIsIGV2ZW50VHlwZSwgaW5wdXQpIHtcclxuICAgIHZhciBwb2ludGVyc0xlbiA9IGlucHV0LnBvaW50ZXJzLmxlbmd0aDtcclxuICAgIHZhciBjaGFuZ2VkUG9pbnRlcnNMZW4gPSBpbnB1dC5jaGFuZ2VkUG9pbnRlcnMubGVuZ3RoO1xyXG4gICAgdmFyIGlzRmlyc3QgPSAoZXZlbnRUeXBlICYgSU5QVVRfU1RBUlQgJiYgKHBvaW50ZXJzTGVuIC0gY2hhbmdlZFBvaW50ZXJzTGVuID09PSAwKSk7XHJcbiAgICB2YXIgaXNGaW5hbCA9IChldmVudFR5cGUgJiAoSU5QVVRfRU5EIHwgSU5QVVRfQ0FOQ0VMKSAmJiAocG9pbnRlcnNMZW4gLSBjaGFuZ2VkUG9pbnRlcnNMZW4gPT09IDApKTtcclxuXHJcbiAgICBpbnB1dC5pc0ZpcnN0ID0gISFpc0ZpcnN0O1xyXG4gICAgaW5wdXQuaXNGaW5hbCA9ICEhaXNGaW5hbDtcclxuXHJcbiAgICBpZiAoaXNGaXJzdCkge1xyXG4gICAgICAgIG1hbmFnZXIuc2Vzc2lvbiA9IHt9O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHNvdXJjZSBldmVudCBpcyB0aGUgbm9ybWFsaXplZCB2YWx1ZSBvZiB0aGUgZG9tRXZlbnRzXHJcbiAgICAvLyBsaWtlICd0b3VjaHN0YXJ0LCBtb3VzZXVwLCBwb2ludGVyZG93bidcclxuICAgIGlucHV0LmV2ZW50VHlwZSA9IGV2ZW50VHlwZTtcclxuXHJcbiAgICAvLyBjb21wdXRlIHNjYWxlLCByb3RhdGlvbiBldGNcclxuICAgIGNvbXB1dGVJbnB1dERhdGEobWFuYWdlciwgaW5wdXQpO1xyXG5cclxuICAgIC8vIGVtaXQgc2VjcmV0IGV2ZW50XHJcbiAgICBtYW5hZ2VyLmVtaXQoJ2hhbW1lci5pbnB1dCcsIGlucHV0KTtcclxuXHJcbiAgICBtYW5hZ2VyLnJlY29nbml6ZShpbnB1dCk7XHJcbiAgICBtYW5hZ2VyLnNlc3Npb24ucHJldklucHV0ID0gaW5wdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBleHRlbmQgdGhlIGRhdGEgd2l0aCBzb21lIHVzYWJsZSBwcm9wZXJ0aWVzIGxpa2Ugc2NhbGUsIHJvdGF0ZSwgdmVsb2NpdHkgZXRjXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBtYW5hZ2VyXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dFxyXG4gKi9cclxuZnVuY3Rpb24gY29tcHV0ZUlucHV0RGF0YShtYW5hZ2VyLCBpbnB1dCkge1xyXG4gICAgdmFyIHNlc3Npb24gPSBtYW5hZ2VyLnNlc3Npb247XHJcbiAgICB2YXIgcG9pbnRlcnMgPSBpbnB1dC5wb2ludGVycztcclxuICAgIHZhciBwb2ludGVyc0xlbmd0aCA9IHBvaW50ZXJzLmxlbmd0aDtcclxuXHJcbiAgICAvLyBzdG9yZSB0aGUgZmlyc3QgaW5wdXQgdG8gY2FsY3VsYXRlIHRoZSBkaXN0YW5jZSBhbmQgZGlyZWN0aW9uXHJcbiAgICBpZiAoIXNlc3Npb24uZmlyc3RJbnB1dCkge1xyXG4gICAgICAgIHNlc3Npb24uZmlyc3RJbnB1dCA9IHNpbXBsZUNsb25lSW5wdXREYXRhKGlucHV0KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyB0byBjb21wdXRlIHNjYWxlIGFuZCByb3RhdGlvbiB3ZSBuZWVkIHRvIHN0b3JlIHRoZSBtdWx0aXBsZSB0b3VjaGVzXHJcbiAgICBpZiAocG9pbnRlcnNMZW5ndGggPiAxICYmICFzZXNzaW9uLmZpcnN0TXVsdGlwbGUpIHtcclxuICAgICAgICBzZXNzaW9uLmZpcnN0TXVsdGlwbGUgPSBzaW1wbGVDbG9uZUlucHV0RGF0YShpbnB1dCk7XHJcbiAgICB9IGVsc2UgaWYgKHBvaW50ZXJzTGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgc2Vzc2lvbi5maXJzdE11bHRpcGxlID0gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGZpcnN0SW5wdXQgPSBzZXNzaW9uLmZpcnN0SW5wdXQ7XHJcbiAgICB2YXIgZmlyc3RNdWx0aXBsZSA9IHNlc3Npb24uZmlyc3RNdWx0aXBsZTtcclxuICAgIHZhciBvZmZzZXRDZW50ZXIgPSBmaXJzdE11bHRpcGxlID8gZmlyc3RNdWx0aXBsZS5jZW50ZXIgOiBmaXJzdElucHV0LmNlbnRlcjtcclxuXHJcbiAgICB2YXIgY2VudGVyID0gaW5wdXQuY2VudGVyID0gZ2V0Q2VudGVyKHBvaW50ZXJzKTtcclxuICAgIGlucHV0LnRpbWVTdGFtcCA9IG5vdygpO1xyXG4gICAgaW5wdXQuZGVsdGFUaW1lID0gaW5wdXQudGltZVN0YW1wIC0gZmlyc3RJbnB1dC50aW1lU3RhbXA7XHJcblxyXG4gICAgaW5wdXQuYW5nbGUgPSBnZXRBbmdsZShvZmZzZXRDZW50ZXIsIGNlbnRlcik7XHJcbiAgICBpbnB1dC5kaXN0YW5jZSA9IGdldERpc3RhbmNlKG9mZnNldENlbnRlciwgY2VudGVyKTtcclxuXHJcbiAgICBjb21wdXRlRGVsdGFYWShzZXNzaW9uLCBpbnB1dCk7XHJcbiAgICBpbnB1dC5vZmZzZXREaXJlY3Rpb24gPSBnZXREaXJlY3Rpb24oaW5wdXQuZGVsdGFYLCBpbnB1dC5kZWx0YVkpO1xyXG5cclxuICAgIGlucHV0LnNjYWxlID0gZmlyc3RNdWx0aXBsZSA/IGdldFNjYWxlKGZpcnN0TXVsdGlwbGUucG9pbnRlcnMsIHBvaW50ZXJzKSA6IDE7XHJcbiAgICBpbnB1dC5yb3RhdGlvbiA9IGZpcnN0TXVsdGlwbGUgPyBnZXRSb3RhdGlvbihmaXJzdE11bHRpcGxlLnBvaW50ZXJzLCBwb2ludGVycykgOiAwO1xyXG5cclxuICAgIGNvbXB1dGVJbnRlcnZhbElucHV0RGF0YShzZXNzaW9uLCBpbnB1dCk7XHJcblxyXG4gICAgLy8gZmluZCB0aGUgY29ycmVjdCB0YXJnZXRcclxuICAgIHZhciB0YXJnZXQgPSBtYW5hZ2VyLmVsZW1lbnQ7XHJcbiAgICBpZiAoaGFzUGFyZW50KGlucHV0LnNyY0V2ZW50LnRhcmdldCwgdGFyZ2V0KSkge1xyXG4gICAgICAgIHRhcmdldCA9IGlucHV0LnNyY0V2ZW50LnRhcmdldDtcclxuICAgIH1cclxuICAgIGlucHV0LnRhcmdldCA9IHRhcmdldDtcclxufVxyXG5cclxuZnVuY3Rpb24gY29tcHV0ZURlbHRhWFkoc2Vzc2lvbiwgaW5wdXQpIHtcclxuICAgIHZhciBjZW50ZXIgPSBpbnB1dC5jZW50ZXI7XHJcbiAgICB2YXIgb2Zmc2V0ID0gc2Vzc2lvbi5vZmZzZXREZWx0YSB8fCB7fTtcclxuICAgIHZhciBwcmV2RGVsdGEgPSBzZXNzaW9uLnByZXZEZWx0YSB8fCB7fTtcclxuICAgIHZhciBwcmV2SW5wdXQgPSBzZXNzaW9uLnByZXZJbnB1dCB8fCB7fTtcclxuXHJcbiAgICBpZiAoaW5wdXQuZXZlbnRUeXBlID09PSBJTlBVVF9TVEFSVCB8fCBwcmV2SW5wdXQuZXZlbnRUeXBlID09PSBJTlBVVF9FTkQpIHtcclxuICAgICAgICBwcmV2RGVsdGEgPSBzZXNzaW9uLnByZXZEZWx0YSA9IHtcclxuICAgICAgICAgICAgeDogcHJldklucHV0LmRlbHRhWCB8fCAwLFxyXG4gICAgICAgICAgICB5OiBwcmV2SW5wdXQuZGVsdGFZIHx8IDBcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBvZmZzZXQgPSBzZXNzaW9uLm9mZnNldERlbHRhID0ge1xyXG4gICAgICAgICAgICB4OiBjZW50ZXIueCxcclxuICAgICAgICAgICAgeTogY2VudGVyLnlcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGlucHV0LmRlbHRhWCA9IHByZXZEZWx0YS54ICsgKGNlbnRlci54IC0gb2Zmc2V0LngpO1xyXG4gICAgaW5wdXQuZGVsdGFZID0gcHJldkRlbHRhLnkgKyAoY2VudGVyLnkgLSBvZmZzZXQueSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiB2ZWxvY2l0eSBpcyBjYWxjdWxhdGVkIGV2ZXJ5IHggbXNcclxuICogQHBhcmFtIHtPYmplY3R9IHNlc3Npb25cclxuICogQHBhcmFtIHtPYmplY3R9IGlucHV0XHJcbiAqL1xyXG5mdW5jdGlvbiBjb21wdXRlSW50ZXJ2YWxJbnB1dERhdGEoc2Vzc2lvbiwgaW5wdXQpIHtcclxuICAgIHZhciBsYXN0ID0gc2Vzc2lvbi5sYXN0SW50ZXJ2YWwgfHwgaW5wdXQsXHJcbiAgICAgICAgZGVsdGFUaW1lID0gaW5wdXQudGltZVN0YW1wIC0gbGFzdC50aW1lU3RhbXAsXHJcbiAgICAgICAgdmVsb2NpdHksIHZlbG9jaXR5WCwgdmVsb2NpdHlZLCBkaXJlY3Rpb247XHJcblxyXG4gICAgaWYgKGlucHV0LmV2ZW50VHlwZSAhPSBJTlBVVF9DQU5DRUwgJiYgKGRlbHRhVGltZSA+IENPTVBVVEVfSU5URVJWQUwgfHwgbGFzdC52ZWxvY2l0eSA9PT0gdW5kZWZpbmVkKSkge1xyXG4gICAgICAgIHZhciBkZWx0YVggPSBsYXN0LmRlbHRhWCAtIGlucHV0LmRlbHRhWDtcclxuICAgICAgICB2YXIgZGVsdGFZID0gbGFzdC5kZWx0YVkgLSBpbnB1dC5kZWx0YVk7XHJcblxyXG4gICAgICAgIHZhciB2ID0gZ2V0VmVsb2NpdHkoZGVsdGFUaW1lLCBkZWx0YVgsIGRlbHRhWSk7XHJcbiAgICAgICAgdmVsb2NpdHlYID0gdi54O1xyXG4gICAgICAgIHZlbG9jaXR5WSA9IHYueTtcclxuICAgICAgICB2ZWxvY2l0eSA9IChhYnModi54KSA+IGFicyh2LnkpKSA/IHYueCA6IHYueTtcclxuICAgICAgICBkaXJlY3Rpb24gPSBnZXREaXJlY3Rpb24oZGVsdGFYLCBkZWx0YVkpO1xyXG5cclxuICAgICAgICBzZXNzaW9uLmxhc3RJbnRlcnZhbCA9IGlucHV0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAvLyB1c2UgbGF0ZXN0IHZlbG9jaXR5IGluZm8gaWYgaXQgZG9lc24ndCBvdmVydGFrZSBhIG1pbmltdW0gcGVyaW9kXHJcbiAgICAgICAgdmVsb2NpdHkgPSBsYXN0LnZlbG9jaXR5O1xyXG4gICAgICAgIHZlbG9jaXR5WCA9IGxhc3QudmVsb2NpdHlYO1xyXG4gICAgICAgIHZlbG9jaXR5WSA9IGxhc3QudmVsb2NpdHlZO1xyXG4gICAgICAgIGRpcmVjdGlvbiA9IGxhc3QuZGlyZWN0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIGlucHV0LnZlbG9jaXR5ID0gdmVsb2NpdHk7XHJcbiAgICBpbnB1dC52ZWxvY2l0eVggPSB2ZWxvY2l0eVg7XHJcbiAgICBpbnB1dC52ZWxvY2l0eVkgPSB2ZWxvY2l0eVk7XHJcbiAgICBpbnB1dC5kaXJlY3Rpb24gPSBkaXJlY3Rpb247XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBjcmVhdGUgYSBzaW1wbGUgY2xvbmUgZnJvbSB0aGUgaW5wdXQgdXNlZCBmb3Igc3RvcmFnZSBvZiBmaXJzdElucHV0IGFuZCBmaXJzdE11bHRpcGxlXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dFxyXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBjbG9uZWRJbnB1dERhdGFcclxuICovXHJcbmZ1bmN0aW9uIHNpbXBsZUNsb25lSW5wdXREYXRhKGlucHV0KSB7XHJcbiAgICAvLyBtYWtlIGEgc2ltcGxlIGNvcHkgb2YgdGhlIHBvaW50ZXJzIGJlY2F1c2Ugd2Ugd2lsbCBnZXQgYSByZWZlcmVuY2UgaWYgd2UgZG9uJ3RcclxuICAgIC8vIHdlIG9ubHkgbmVlZCBjbGllbnRYWSBmb3IgdGhlIGNhbGN1bGF0aW9uc1xyXG4gICAgdmFyIHBvaW50ZXJzID0gW107XHJcbiAgICB2YXIgaSA9IDA7XHJcbiAgICB3aGlsZSAoaSA8IGlucHV0LnBvaW50ZXJzLmxlbmd0aCkge1xyXG4gICAgICAgIHBvaW50ZXJzW2ldID0ge1xyXG4gICAgICAgICAgICBjbGllbnRYOiByb3VuZChpbnB1dC5wb2ludGVyc1tpXS5jbGllbnRYKSxcclxuICAgICAgICAgICAgY2xpZW50WTogcm91bmQoaW5wdXQucG9pbnRlcnNbaV0uY2xpZW50WSlcclxuICAgICAgICB9O1xyXG4gICAgICAgIGkrKztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHRpbWVTdGFtcDogbm93KCksXHJcbiAgICAgICAgcG9pbnRlcnM6IHBvaW50ZXJzLFxyXG4gICAgICAgIGNlbnRlcjogZ2V0Q2VudGVyKHBvaW50ZXJzKSxcclxuICAgICAgICBkZWx0YVg6IGlucHV0LmRlbHRhWCxcclxuICAgICAgICBkZWx0YVk6IGlucHV0LmRlbHRhWVxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGdldCB0aGUgY2VudGVyIG9mIGFsbCB0aGUgcG9pbnRlcnNcclxuICogQHBhcmFtIHtBcnJheX0gcG9pbnRlcnNcclxuICogQHJldHVybiB7T2JqZWN0fSBjZW50ZXIgY29udGFpbnMgYHhgIGFuZCBgeWAgcHJvcGVydGllc1xyXG4gKi9cclxuZnVuY3Rpb24gZ2V0Q2VudGVyKHBvaW50ZXJzKSB7XHJcbiAgICB2YXIgcG9pbnRlcnNMZW5ndGggPSBwb2ludGVycy5sZW5ndGg7XHJcblxyXG4gICAgLy8gbm8gbmVlZCB0byBsb29wIHdoZW4gb25seSBvbmUgdG91Y2hcclxuICAgIGlmIChwb2ludGVyc0xlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHg6IHJvdW5kKHBvaW50ZXJzWzBdLmNsaWVudFgpLFxyXG4gICAgICAgICAgICB5OiByb3VuZChwb2ludGVyc1swXS5jbGllbnRZKVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHggPSAwLCB5ID0gMCwgaSA9IDA7XHJcbiAgICB3aGlsZSAoaSA8IHBvaW50ZXJzTGVuZ3RoKSB7XHJcbiAgICAgICAgeCArPSBwb2ludGVyc1tpXS5jbGllbnRYO1xyXG4gICAgICAgIHkgKz0gcG9pbnRlcnNbaV0uY2xpZW50WTtcclxuICAgICAgICBpKys7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB4OiByb3VuZCh4IC8gcG9pbnRlcnNMZW5ndGgpLFxyXG4gICAgICAgIHk6IHJvdW5kKHkgLyBwb2ludGVyc0xlbmd0aClcclxuICAgIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBjYWxjdWxhdGUgdGhlIHZlbG9jaXR5IGJldHdlZW4gdHdvIHBvaW50cy4gdW5pdCBpcyBpbiBweCBwZXIgbXMuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBkZWx0YVRpbWVcclxuICogQHBhcmFtIHtOdW1iZXJ9IHhcclxuICogQHBhcmFtIHtOdW1iZXJ9IHlcclxuICogQHJldHVybiB7T2JqZWN0fSB2ZWxvY2l0eSBgeGAgYW5kIGB5YFxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0VmVsb2NpdHkoZGVsdGFUaW1lLCB4LCB5KSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHg6IHggLyBkZWx0YVRpbWUgfHwgMCxcclxuICAgICAgICB5OiB5IC8gZGVsdGFUaW1lIHx8IDBcclxuICAgIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBnZXQgdGhlIGRpcmVjdGlvbiBiZXR3ZWVuIHR3byBwb2ludHNcclxuICogQHBhcmFtIHtOdW1iZXJ9IHhcclxuICogQHBhcmFtIHtOdW1iZXJ9IHlcclxuICogQHJldHVybiB7TnVtYmVyfSBkaXJlY3Rpb25cclxuICovXHJcbmZ1bmN0aW9uIGdldERpcmVjdGlvbih4LCB5KSB7XHJcbiAgICBpZiAoeCA9PT0geSkge1xyXG4gICAgICAgIHJldHVybiBESVJFQ1RJT05fTk9ORTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYWJzKHgpID49IGFicyh5KSkge1xyXG4gICAgICAgIHJldHVybiB4ID4gMCA/IERJUkVDVElPTl9MRUZUIDogRElSRUNUSU9OX1JJR0hUO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHkgPiAwID8gRElSRUNUSU9OX1VQIDogRElSRUNUSU9OX0RPV047XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBjYWxjdWxhdGUgdGhlIGFic29sdXRlIGRpc3RhbmNlIGJldHdlZW4gdHdvIHBvaW50c1xyXG4gKiBAcGFyYW0ge09iamVjdH0gcDEge3gsIHl9XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBwMiB7eCwgeX1cclxuICogQHBhcmFtIHtBcnJheX0gW3Byb3BzXSBjb250YWluaW5nIHggYW5kIHkga2V5c1xyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IGRpc3RhbmNlXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXREaXN0YW5jZShwMSwgcDIsIHByb3BzKSB7XHJcbiAgICBpZiAoIXByb3BzKSB7XHJcbiAgICAgICAgcHJvcHMgPSBQUk9QU19YWTtcclxuICAgIH1cclxuICAgIHZhciB4ID0gcDJbcHJvcHNbMF1dIC0gcDFbcHJvcHNbMF1dLFxyXG4gICAgICAgIHkgPSBwMltwcm9wc1sxXV0gLSBwMVtwcm9wc1sxXV07XHJcblxyXG4gICAgcmV0dXJuIE1hdGguc3FydCgoeCAqIHgpICsgKHkgKiB5KSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBjYWxjdWxhdGUgdGhlIGFuZ2xlIGJldHdlZW4gdHdvIGNvb3JkaW5hdGVzXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBwMVxyXG4gKiBAcGFyYW0ge09iamVjdH0gcDJcclxuICogQHBhcmFtIHtBcnJheX0gW3Byb3BzXSBjb250YWluaW5nIHggYW5kIHkga2V5c1xyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IGFuZ2xlXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRBbmdsZShwMSwgcDIsIHByb3BzKSB7XHJcbiAgICBpZiAoIXByb3BzKSB7XHJcbiAgICAgICAgcHJvcHMgPSBQUk9QU19YWTtcclxuICAgIH1cclxuICAgIHZhciB4ID0gcDJbcHJvcHNbMF1dIC0gcDFbcHJvcHNbMF1dLFxyXG4gICAgICAgIHkgPSBwMltwcm9wc1sxXV0gLSBwMVtwcm9wc1sxXV07XHJcbiAgICByZXR1cm4gTWF0aC5hdGFuMih5LCB4KSAqIDE4MCAvIE1hdGguUEk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBjYWxjdWxhdGUgdGhlIHJvdGF0aW9uIGRlZ3JlZXMgYmV0d2VlbiB0d28gcG9pbnRlcnNldHNcclxuICogQHBhcmFtIHtBcnJheX0gc3RhcnQgYXJyYXkgb2YgcG9pbnRlcnNcclxuICogQHBhcmFtIHtBcnJheX0gZW5kIGFycmF5IG9mIHBvaW50ZXJzXHJcbiAqIEByZXR1cm4ge051bWJlcn0gcm90YXRpb25cclxuICovXHJcbmZ1bmN0aW9uIGdldFJvdGF0aW9uKHN0YXJ0LCBlbmQpIHtcclxuICAgIHJldHVybiBnZXRBbmdsZShlbmRbMV0sIGVuZFswXSwgUFJPUFNfQ0xJRU5UX1hZKSAtIGdldEFuZ2xlKHN0YXJ0WzFdLCBzdGFydFswXSwgUFJPUFNfQ0xJRU5UX1hZKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGNhbGN1bGF0ZSB0aGUgc2NhbGUgZmFjdG9yIGJldHdlZW4gdHdvIHBvaW50ZXJzZXRzXHJcbiAqIG5vIHNjYWxlIGlzIDEsIGFuZCBnb2VzIGRvd24gdG8gMCB3aGVuIHBpbmNoZWQgdG9nZXRoZXIsIGFuZCBiaWdnZXIgd2hlbiBwaW5jaGVkIG91dFxyXG4gKiBAcGFyYW0ge0FycmF5fSBzdGFydCBhcnJheSBvZiBwb2ludGVyc1xyXG4gKiBAcGFyYW0ge0FycmF5fSBlbmQgYXJyYXkgb2YgcG9pbnRlcnNcclxuICogQHJldHVybiB7TnVtYmVyfSBzY2FsZVxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0U2NhbGUoc3RhcnQsIGVuZCkge1xyXG4gICAgcmV0dXJuIGdldERpc3RhbmNlKGVuZFswXSwgZW5kWzFdLCBQUk9QU19DTElFTlRfWFkpIC8gZ2V0RGlzdGFuY2Uoc3RhcnRbMF0sIHN0YXJ0WzFdLCBQUk9QU19DTElFTlRfWFkpO1xyXG59XHJcblxyXG52YXIgTU9VU0VfSU5QVVRfTUFQID0ge1xyXG4gICAgbW91c2Vkb3duOiBJTlBVVF9TVEFSVCxcclxuICAgIG1vdXNlbW92ZTogSU5QVVRfTU9WRSxcclxuICAgIG1vdXNldXA6IElOUFVUX0VORFxyXG59O1xyXG5cclxudmFyIE1PVVNFX0VMRU1FTlRfRVZFTlRTID0gJ21vdXNlZG93bic7XHJcbnZhciBNT1VTRV9XSU5ET1dfRVZFTlRTID0gJ21vdXNlbW92ZSBtb3VzZXVwJztcclxuXHJcbi8qKlxyXG4gKiBNb3VzZSBldmVudHMgaW5wdXRcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIElucHV0XHJcbiAqL1xyXG5mdW5jdGlvbiBNb3VzZUlucHV0KCkge1xyXG4gICAgdGhpcy5ldkVsID0gTU9VU0VfRUxFTUVOVF9FVkVOVFM7XHJcbiAgICB0aGlzLmV2V2luID0gTU9VU0VfV0lORE9XX0VWRU5UUztcclxuXHJcbiAgICB0aGlzLmFsbG93ID0gdHJ1ZTsgLy8gdXNlZCBieSBJbnB1dC5Ub3VjaE1vdXNlIHRvIGRpc2FibGUgbW91c2UgZXZlbnRzXHJcbiAgICB0aGlzLnByZXNzZWQgPSBmYWxzZTsgLy8gbW91c2Vkb3duIHN0YXRlXHJcblxyXG4gICAgSW5wdXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuaW5oZXJpdChNb3VzZUlucHV0LCBJbnB1dCwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBoYW5kbGUgbW91c2UgZXZlbnRzXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZXZcclxuICAgICAqL1xyXG4gICAgaGFuZGxlcjogZnVuY3Rpb24gTUVoYW5kbGVyKGV2KSB7XHJcbiAgICAgICAgdmFyIGV2ZW50VHlwZSA9IE1PVVNFX0lOUFVUX01BUFtldi50eXBlXTtcclxuXHJcbiAgICAgICAgLy8gb24gc3RhcnQgd2Ugd2FudCB0byBoYXZlIHRoZSBsZWZ0IG1vdXNlIGJ1dHRvbiBkb3duXHJcbiAgICAgICAgaWYgKGV2ZW50VHlwZSAmIElOUFVUX1NUQVJUICYmIGV2LmJ1dHRvbiA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLnByZXNzZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGV2ZW50VHlwZSAmIElOUFVUX01PVkUgJiYgZXYud2hpY2ggIT09IDEpIHtcclxuICAgICAgICAgICAgZXZlbnRUeXBlID0gSU5QVVRfRU5EO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gbW91c2UgbXVzdCBiZSBkb3duLCBhbmQgbW91c2UgZXZlbnRzIGFyZSBhbGxvd2VkIChzZWUgdGhlIFRvdWNoTW91c2UgaW5wdXQpXHJcbiAgICAgICAgaWYgKCF0aGlzLnByZXNzZWQgfHwgIXRoaXMuYWxsb3cpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGV2ZW50VHlwZSAmIElOUFVUX0VORCkge1xyXG4gICAgICAgICAgICB0aGlzLnByZXNzZWQgPSBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY2FsbGJhY2sodGhpcy5tYW5hZ2VyLCBldmVudFR5cGUsIHtcclxuICAgICAgICAgICAgcG9pbnRlcnM6IFtldl0sXHJcbiAgICAgICAgICAgIGNoYW5nZWRQb2ludGVyczogW2V2XSxcclxuICAgICAgICAgICAgcG9pbnRlclR5cGU6IElOUFVUX1RZUEVfTU9VU0UsXHJcbiAgICAgICAgICAgIHNyY0V2ZW50OiBldlxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBQT0lOVEVSX0lOUFVUX01BUCA9IHtcclxuICAgIHBvaW50ZXJkb3duOiBJTlBVVF9TVEFSVCxcclxuICAgIHBvaW50ZXJtb3ZlOiBJTlBVVF9NT1ZFLFxyXG4gICAgcG9pbnRlcnVwOiBJTlBVVF9FTkQsXHJcbiAgICBwb2ludGVyY2FuY2VsOiBJTlBVVF9DQU5DRUwsXHJcbiAgICBwb2ludGVyb3V0OiBJTlBVVF9DQU5DRUxcclxufTtcclxuXHJcbi8vIGluIElFMTAgdGhlIHBvaW50ZXIgdHlwZXMgaXMgZGVmaW5lZCBhcyBhbiBlbnVtXHJcbnZhciBJRTEwX1BPSU5URVJfVFlQRV9FTlVNID0ge1xyXG4gICAgMjogSU5QVVRfVFlQRV9UT1VDSCxcclxuICAgIDM6IElOUFVUX1RZUEVfUEVOLFxyXG4gICAgNDogSU5QVVRfVFlQRV9NT1VTRSxcclxuICAgIDU6IElOUFVUX1RZUEVfS0lORUNUIC8vIHNlZSBodHRwczovL3R3aXR0ZXIuY29tL2phY29icm9zc2kvc3RhdHVzLzQ4MDU5NjQzODQ4OTg5MDgxNlxyXG59O1xyXG5cclxudmFyIFBPSU5URVJfRUxFTUVOVF9FVkVOVFMgPSAncG9pbnRlcmRvd24nO1xyXG52YXIgUE9JTlRFUl9XSU5ET1dfRVZFTlRTID0gJ3BvaW50ZXJtb3ZlIHBvaW50ZXJ1cCBwb2ludGVyY2FuY2VsJztcclxuXHJcbi8vIElFMTAgaGFzIHByZWZpeGVkIHN1cHBvcnQsIGFuZCBjYXNlLXNlbnNpdGl2ZVxyXG5pZiAod2luZG93Lk1TUG9pbnRlckV2ZW50KSB7XHJcbiAgICBQT0lOVEVSX0VMRU1FTlRfRVZFTlRTID0gJ01TUG9pbnRlckRvd24nO1xyXG4gICAgUE9JTlRFUl9XSU5ET1dfRVZFTlRTID0gJ01TUG9pbnRlck1vdmUgTVNQb2ludGVyVXAgTVNQb2ludGVyQ2FuY2VsJztcclxufVxyXG5cclxuLyoqXHJcbiAqIFBvaW50ZXIgZXZlbnRzIGlucHV0XHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBJbnB1dFxyXG4gKi9cclxuZnVuY3Rpb24gUG9pbnRlckV2ZW50SW5wdXQoKSB7XHJcbiAgICB0aGlzLmV2RWwgPSBQT0lOVEVSX0VMRU1FTlRfRVZFTlRTO1xyXG4gICAgdGhpcy5ldldpbiA9IFBPSU5URVJfV0lORE9XX0VWRU5UUztcclxuXHJcbiAgICBJbnB1dC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cclxuICAgIHRoaXMuc3RvcmUgPSAodGhpcy5tYW5hZ2VyLnNlc3Npb24ucG9pbnRlckV2ZW50cyA9IFtdKTtcclxufVxyXG5cclxuaW5oZXJpdChQb2ludGVyRXZlbnRJbnB1dCwgSW5wdXQsIHtcclxuICAgIC8qKlxyXG4gICAgICogaGFuZGxlIG1vdXNlIGV2ZW50c1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGV2XHJcbiAgICAgKi9cclxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uIFBFaGFuZGxlcihldikge1xyXG4gICAgICAgIHZhciBzdG9yZSA9IHRoaXMuc3RvcmU7XHJcbiAgICAgICAgdmFyIHJlbW92ZVBvaW50ZXIgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgdmFyIGV2ZW50VHlwZU5vcm1hbGl6ZWQgPSBldi50eXBlLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgnbXMnLCAnJyk7XHJcbiAgICAgICAgdmFyIGV2ZW50VHlwZSA9IFBPSU5URVJfSU5QVVRfTUFQW2V2ZW50VHlwZU5vcm1hbGl6ZWRdO1xyXG4gICAgICAgIHZhciBwb2ludGVyVHlwZSA9IElFMTBfUE9JTlRFUl9UWVBFX0VOVU1bZXYucG9pbnRlclR5cGVdIHx8IGV2LnBvaW50ZXJUeXBlO1xyXG5cclxuICAgICAgICB2YXIgaXNUb3VjaCA9IChwb2ludGVyVHlwZSA9PSBJTlBVVF9UWVBFX1RPVUNIKTtcclxuXHJcbiAgICAgICAgLy8gZ2V0IGluZGV4IG9mIHRoZSBldmVudCBpbiB0aGUgc3RvcmVcclxuICAgICAgICB2YXIgc3RvcmVJbmRleCA9IGluQXJyYXkoc3RvcmUsIGV2LnBvaW50ZXJJZCwgJ3BvaW50ZXJJZCcpO1xyXG5cclxuICAgICAgICAvLyBzdGFydCBhbmQgbW91c2UgbXVzdCBiZSBkb3duXHJcbiAgICAgICAgaWYgKGV2ZW50VHlwZSAmIElOUFVUX1NUQVJUICYmIChldi5idXR0b24gPT09IDAgfHwgaXNUb3VjaCkpIHtcclxuICAgICAgICAgICAgaWYgKHN0b3JlSW5kZXggPCAwKSB7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5wdXNoKGV2KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlSW5kZXggPSBzdG9yZS5sZW5ndGggLSAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmIChldmVudFR5cGUgJiAoSU5QVVRfRU5EIHwgSU5QVVRfQ0FOQ0VMKSkge1xyXG4gICAgICAgICAgICByZW1vdmVQb2ludGVyID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGl0IG5vdCBmb3VuZCwgc28gdGhlIHBvaW50ZXIgaGFzbid0IGJlZW4gZG93biAoc28gaXQncyBwcm9iYWJseSBhIGhvdmVyKVxyXG4gICAgICAgIGlmIChzdG9yZUluZGV4IDwgMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyB1cGRhdGUgdGhlIGV2ZW50IGluIHRoZSBzdG9yZVxyXG4gICAgICAgIHN0b3JlW3N0b3JlSW5kZXhdID0gZXY7XHJcblxyXG4gICAgICAgIHRoaXMuY2FsbGJhY2sodGhpcy5tYW5hZ2VyLCBldmVudFR5cGUsIHtcclxuICAgICAgICAgICAgcG9pbnRlcnM6IHN0b3JlLFxyXG4gICAgICAgICAgICBjaGFuZ2VkUG9pbnRlcnM6IFtldl0sXHJcbiAgICAgICAgICAgIHBvaW50ZXJUeXBlOiBwb2ludGVyVHlwZSxcclxuICAgICAgICAgICAgc3JjRXZlbnQ6IGV2XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmIChyZW1vdmVQb2ludGVyKSB7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBmcm9tIHRoZSBzdG9yZVxyXG4gICAgICAgICAgICBzdG9yZS5zcGxpY2Uoc3RvcmVJbmRleCwgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBTSU5HTEVfVE9VQ0hfSU5QVVRfTUFQID0ge1xyXG4gICAgdG91Y2hzdGFydDogSU5QVVRfU1RBUlQsXHJcbiAgICB0b3VjaG1vdmU6IElOUFVUX01PVkUsXHJcbiAgICB0b3VjaGVuZDogSU5QVVRfRU5ELFxyXG4gICAgdG91Y2hjYW5jZWw6IElOUFVUX0NBTkNFTFxyXG59O1xyXG5cclxudmFyIFNJTkdMRV9UT1VDSF9UQVJHRVRfRVZFTlRTID0gJ3RvdWNoc3RhcnQnO1xyXG52YXIgU0lOR0xFX1RPVUNIX1dJTkRPV19FVkVOVFMgPSAndG91Y2hzdGFydCB0b3VjaG1vdmUgdG91Y2hlbmQgdG91Y2hjYW5jZWwnO1xyXG5cclxuLyoqXHJcbiAqIFRvdWNoIGV2ZW50cyBpbnB1dFxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgSW5wdXRcclxuICovXHJcbmZ1bmN0aW9uIFNpbmdsZVRvdWNoSW5wdXQoKSB7XHJcbiAgICB0aGlzLmV2VGFyZ2V0ID0gU0lOR0xFX1RPVUNIX1RBUkdFVF9FVkVOVFM7XHJcbiAgICB0aGlzLmV2V2luID0gU0lOR0xFX1RPVUNIX1dJTkRPV19FVkVOVFM7XHJcbiAgICB0aGlzLnN0YXJ0ZWQgPSBmYWxzZTtcclxuXHJcbiAgICBJbnB1dC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5pbmhlcml0KFNpbmdsZVRvdWNoSW5wdXQsIElucHV0LCB7XHJcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiBURWhhbmRsZXIoZXYpIHtcclxuICAgICAgICB2YXIgdHlwZSA9IFNJTkdMRV9UT1VDSF9JTlBVVF9NQVBbZXYudHlwZV07XHJcblxyXG4gICAgICAgIC8vIHNob3VsZCB3ZSBoYW5kbGUgdGhlIHRvdWNoIGV2ZW50cz9cclxuICAgICAgICBpZiAodHlwZSA9PT0gSU5QVVRfU1RBUlQpIHtcclxuICAgICAgICAgICAgdGhpcy5zdGFydGVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5zdGFydGVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciB0b3VjaGVzID0gbm9ybWFsaXplU2luZ2xlVG91Y2hlcy5jYWxsKHRoaXMsIGV2LCB0eXBlKTtcclxuXHJcbiAgICAgICAgLy8gd2hlbiBkb25lLCByZXNldCB0aGUgc3RhcnRlZCBzdGF0ZVxyXG4gICAgICAgIGlmICh0eXBlICYgKElOUFVUX0VORCB8IElOUFVUX0NBTkNFTCkgJiYgdG91Y2hlc1swXS5sZW5ndGggLSB0b3VjaGVzWzFdLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLnN0YXJ0ZWQgPSBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY2FsbGJhY2sodGhpcy5tYW5hZ2VyLCB0eXBlLCB7XHJcbiAgICAgICAgICAgIHBvaW50ZXJzOiB0b3VjaGVzWzBdLFxyXG4gICAgICAgICAgICBjaGFuZ2VkUG9pbnRlcnM6IHRvdWNoZXNbMV0sXHJcbiAgICAgICAgICAgIHBvaW50ZXJUeXBlOiBJTlBVVF9UWVBFX1RPVUNILFxyXG4gICAgICAgICAgICBzcmNFdmVudDogZXZcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogQHRoaXMge1RvdWNoSW5wdXR9XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBldlxyXG4gKiBAcGFyYW0ge051bWJlcn0gdHlwZSBmbGFnXHJcbiAqIEByZXR1cm5zIHt1bmRlZmluZWR8QXJyYXl9IFthbGwsIGNoYW5nZWRdXHJcbiAqL1xyXG5mdW5jdGlvbiBub3JtYWxpemVTaW5nbGVUb3VjaGVzKGV2LCB0eXBlKSB7XHJcbiAgICB2YXIgYWxsID0gdG9BcnJheShldi50b3VjaGVzKTtcclxuICAgIHZhciBjaGFuZ2VkID0gdG9BcnJheShldi5jaGFuZ2VkVG91Y2hlcyk7XHJcblxyXG4gICAgaWYgKHR5cGUgJiAoSU5QVVRfRU5EIHwgSU5QVVRfQ0FOQ0VMKSkge1xyXG4gICAgICAgIGFsbCA9IHVuaXF1ZUFycmF5KGFsbC5jb25jYXQoY2hhbmdlZCksICdpZGVudGlmaWVyJywgdHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIFthbGwsIGNoYW5nZWRdO1xyXG59XHJcblxyXG52YXIgVE9VQ0hfSU5QVVRfTUFQID0ge1xyXG4gICAgdG91Y2hzdGFydDogSU5QVVRfU1RBUlQsXHJcbiAgICB0b3VjaG1vdmU6IElOUFVUX01PVkUsXHJcbiAgICB0b3VjaGVuZDogSU5QVVRfRU5ELFxyXG4gICAgdG91Y2hjYW5jZWw6IElOUFVUX0NBTkNFTFxyXG59O1xyXG5cclxudmFyIFRPVUNIX1RBUkdFVF9FVkVOVFMgPSAndG91Y2hzdGFydCB0b3VjaG1vdmUgdG91Y2hlbmQgdG91Y2hjYW5jZWwnO1xyXG5cclxuLyoqXHJcbiAqIE11bHRpLXVzZXIgdG91Y2ggZXZlbnRzIGlucHV0XHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBJbnB1dFxyXG4gKi9cclxuZnVuY3Rpb24gVG91Y2hJbnB1dCgpIHtcclxuICAgIHRoaXMuZXZUYXJnZXQgPSBUT1VDSF9UQVJHRVRfRVZFTlRTO1xyXG4gICAgdGhpcy50YXJnZXRJZHMgPSB7fTtcclxuXHJcbiAgICBJbnB1dC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5pbmhlcml0KFRvdWNoSW5wdXQsIElucHV0LCB7XHJcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiBNVEVoYW5kbGVyKGV2KSB7XHJcbiAgICAgICAgdmFyIHR5cGUgPSBUT1VDSF9JTlBVVF9NQVBbZXYudHlwZV07XHJcbiAgICAgICAgdmFyIHRvdWNoZXMgPSBnZXRUb3VjaGVzLmNhbGwodGhpcywgZXYsIHR5cGUpO1xyXG4gICAgICAgIGlmICghdG91Y2hlcykge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmNhbGxiYWNrKHRoaXMubWFuYWdlciwgdHlwZSwge1xyXG4gICAgICAgICAgICBwb2ludGVyczogdG91Y2hlc1swXSxcclxuICAgICAgICAgICAgY2hhbmdlZFBvaW50ZXJzOiB0b3VjaGVzWzFdLFxyXG4gICAgICAgICAgICBwb2ludGVyVHlwZTogSU5QVVRfVFlQRV9UT1VDSCxcclxuICAgICAgICAgICAgc3JjRXZlbnQ6IGV2XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIEB0aGlzIHtUb3VjaElucHV0fVxyXG4gKiBAcGFyYW0ge09iamVjdH0gZXZcclxuICogQHBhcmFtIHtOdW1iZXJ9IHR5cGUgZmxhZ1xyXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfEFycmF5fSBbYWxsLCBjaGFuZ2VkXVxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0VG91Y2hlcyhldiwgdHlwZSkge1xyXG4gICAgdmFyIGFsbFRvdWNoZXMgPSB0b0FycmF5KGV2LnRvdWNoZXMpO1xyXG4gICAgdmFyIHRhcmdldElkcyA9IHRoaXMudGFyZ2V0SWRzO1xyXG5cclxuICAgIC8vIHdoZW4gdGhlcmUgaXMgb25seSBvbmUgdG91Y2gsIHRoZSBwcm9jZXNzIGNhbiBiZSBzaW1wbGlmaWVkXHJcbiAgICBpZiAodHlwZSAmIChJTlBVVF9TVEFSVCB8IElOUFVUX01PVkUpICYmIGFsbFRvdWNoZXMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgdGFyZ2V0SWRzW2FsbFRvdWNoZXNbMF0uaWRlbnRpZmllcl0gPSB0cnVlO1xyXG4gICAgICAgIHJldHVybiBbYWxsVG91Y2hlcywgYWxsVG91Y2hlc107XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGksXHJcbiAgICAgICAgdGFyZ2V0VG91Y2hlcyxcclxuICAgICAgICBjaGFuZ2VkVG91Y2hlcyA9IHRvQXJyYXkoZXYuY2hhbmdlZFRvdWNoZXMpLFxyXG4gICAgICAgIGNoYW5nZWRUYXJnZXRUb3VjaGVzID0gW10sXHJcbiAgICAgICAgdGFyZ2V0ID0gdGhpcy50YXJnZXQ7XHJcblxyXG4gICAgLy8gZ2V0IHRhcmdldCB0b3VjaGVzIGZyb20gdG91Y2hlc1xyXG4gICAgdGFyZ2V0VG91Y2hlcyA9IGFsbFRvdWNoZXMuZmlsdGVyKGZ1bmN0aW9uKHRvdWNoKSB7XHJcbiAgICAgICAgcmV0dXJuIGhhc1BhcmVudCh0b3VjaC50YXJnZXQsIHRhcmdldCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBjb2xsZWN0IHRvdWNoZXNcclxuICAgIGlmICh0eXBlID09PSBJTlBVVF9TVEFSVCkge1xyXG4gICAgICAgIGkgPSAwO1xyXG4gICAgICAgIHdoaWxlIChpIDwgdGFyZ2V0VG91Y2hlcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgdGFyZ2V0SWRzW3RhcmdldFRvdWNoZXNbaV0uaWRlbnRpZmllcl0gPSB0cnVlO1xyXG4gICAgICAgICAgICBpKys7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIGZpbHRlciBjaGFuZ2VkIHRvdWNoZXMgdG8gb25seSBjb250YWluIHRvdWNoZXMgdGhhdCBleGlzdCBpbiB0aGUgY29sbGVjdGVkIHRhcmdldCBpZHNcclxuICAgIGkgPSAwO1xyXG4gICAgd2hpbGUgKGkgPCBjaGFuZ2VkVG91Y2hlcy5sZW5ndGgpIHtcclxuICAgICAgICBpZiAodGFyZ2V0SWRzW2NoYW5nZWRUb3VjaGVzW2ldLmlkZW50aWZpZXJdKSB7XHJcbiAgICAgICAgICAgIGNoYW5nZWRUYXJnZXRUb3VjaGVzLnB1c2goY2hhbmdlZFRvdWNoZXNbaV0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gY2xlYW51cCByZW1vdmVkIHRvdWNoZXNcclxuICAgICAgICBpZiAodHlwZSAmIChJTlBVVF9FTkQgfCBJTlBVVF9DQU5DRUwpKSB7XHJcbiAgICAgICAgICAgIGRlbGV0ZSB0YXJnZXRJZHNbY2hhbmdlZFRvdWNoZXNbaV0uaWRlbnRpZmllcl07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGkrKztcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWNoYW5nZWRUYXJnZXRUb3VjaGVzLmxlbmd0aCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gW1xyXG4gICAgICAgIC8vIG1lcmdlIHRhcmdldFRvdWNoZXMgd2l0aCBjaGFuZ2VkVGFyZ2V0VG91Y2hlcyBzbyBpdCBjb250YWlucyBBTEwgdG91Y2hlcywgaW5jbHVkaW5nICdlbmQnIGFuZCAnY2FuY2VsJ1xyXG4gICAgICAgIHVuaXF1ZUFycmF5KHRhcmdldFRvdWNoZXMuY29uY2F0KGNoYW5nZWRUYXJnZXRUb3VjaGVzKSwgJ2lkZW50aWZpZXInLCB0cnVlKSxcclxuICAgICAgICBjaGFuZ2VkVGFyZ2V0VG91Y2hlc1xyXG4gICAgXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbWJpbmVkIHRvdWNoIGFuZCBtb3VzZSBpbnB1dFxyXG4gKlxyXG4gKiBUb3VjaCBoYXMgYSBoaWdoZXIgcHJpb3JpdHkgdGhlbiBtb3VzZSwgYW5kIHdoaWxlIHRvdWNoaW5nIG5vIG1vdXNlIGV2ZW50cyBhcmUgYWxsb3dlZC5cclxuICogVGhpcyBiZWNhdXNlIHRvdWNoIGRldmljZXMgYWxzbyBlbWl0IG1vdXNlIGV2ZW50cyB3aGlsZSBkb2luZyBhIHRvdWNoLlxyXG4gKlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgSW5wdXRcclxuICovXHJcbmZ1bmN0aW9uIFRvdWNoTW91c2VJbnB1dCgpIHtcclxuICAgIElucHV0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblxyXG4gICAgdmFyIGhhbmRsZXIgPSBiaW5kRm4odGhpcy5oYW5kbGVyLCB0aGlzKTtcclxuICAgIHRoaXMudG91Y2ggPSBuZXcgVG91Y2hJbnB1dCh0aGlzLm1hbmFnZXIsIGhhbmRsZXIpO1xyXG4gICAgdGhpcy5tb3VzZSA9IG5ldyBNb3VzZUlucHV0KHRoaXMubWFuYWdlciwgaGFuZGxlcik7XHJcbn1cclxuXHJcbmluaGVyaXQoVG91Y2hNb3VzZUlucHV0LCBJbnB1dCwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBoYW5kbGUgbW91c2UgYW5kIHRvdWNoIGV2ZW50c1xyXG4gICAgICogQHBhcmFtIHtIYW1tZXJ9IG1hbmFnZXJcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dEV2ZW50XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaW5wdXREYXRhXHJcbiAgICAgKi9cclxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uIFRNRWhhbmRsZXIobWFuYWdlciwgaW5wdXRFdmVudCwgaW5wdXREYXRhKSB7XHJcbiAgICAgICAgdmFyIGlzVG91Y2ggPSAoaW5wdXREYXRhLnBvaW50ZXJUeXBlID09IElOUFVUX1RZUEVfVE9VQ0gpLFxyXG4gICAgICAgICAgICBpc01vdXNlID0gKGlucHV0RGF0YS5wb2ludGVyVHlwZSA9PSBJTlBVVF9UWVBFX01PVVNFKTtcclxuXHJcbiAgICAgICAgLy8gd2hlbiB3ZSdyZSBpbiBhIHRvdWNoIGV2ZW50LCBzbyAgYmxvY2sgYWxsIHVwY29taW5nIG1vdXNlIGV2ZW50c1xyXG4gICAgICAgIC8vIG1vc3QgbW9iaWxlIGJyb3dzZXIgYWxzbyBlbWl0IG1vdXNlZXZlbnRzLCByaWdodCBhZnRlciB0b3VjaHN0YXJ0XHJcbiAgICAgICAgaWYgKGlzVG91Y2gpIHtcclxuICAgICAgICAgICAgdGhpcy5tb3VzZS5hbGxvdyA9IGZhbHNlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoaXNNb3VzZSAmJiAhdGhpcy5tb3VzZS5hbGxvdykge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyByZXNldCB0aGUgYWxsb3dNb3VzZSB3aGVuIHdlJ3JlIGRvbmVcclxuICAgICAgICBpZiAoaW5wdXRFdmVudCAmIChJTlBVVF9FTkQgfCBJTlBVVF9DQU5DRUwpKSB7XHJcbiAgICAgICAgICAgIHRoaXMubW91c2UuYWxsb3cgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jYWxsYmFjayhtYW5hZ2VyLCBpbnB1dEV2ZW50LCBpbnB1dERhdGEpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHJlbW92ZSB0aGUgZXZlbnQgbGlzdGVuZXJzXHJcbiAgICAgKi9cclxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XHJcbiAgICAgICAgdGhpcy50b3VjaC5kZXN0cm95KCk7XHJcbiAgICAgICAgdGhpcy5tb3VzZS5kZXN0cm95KCk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIFBSRUZJWEVEX1RPVUNIX0FDVElPTiA9IHByZWZpeGVkKFRFU1RfRUxFTUVOVC5zdHlsZSwgJ3RvdWNoQWN0aW9uJyk7XHJcbnZhciBOQVRJVkVfVE9VQ0hfQUNUSU9OID0gUFJFRklYRURfVE9VQ0hfQUNUSU9OICE9PSB1bmRlZmluZWQ7XHJcblxyXG4vLyBtYWdpY2FsIHRvdWNoQWN0aW9uIHZhbHVlXHJcbnZhciBUT1VDSF9BQ1RJT05fQ09NUFVURSA9ICdjb21wdXRlJztcclxudmFyIFRPVUNIX0FDVElPTl9BVVRPID0gJ2F1dG8nO1xyXG52YXIgVE9VQ0hfQUNUSU9OX01BTklQVUxBVElPTiA9ICdtYW5pcHVsYXRpb24nOyAvLyBub3QgaW1wbGVtZW50ZWRcclxudmFyIFRPVUNIX0FDVElPTl9OT05FID0gJ25vbmUnO1xyXG52YXIgVE9VQ0hfQUNUSU9OX1BBTl9YID0gJ3Bhbi14JztcclxudmFyIFRPVUNIX0FDVElPTl9QQU5fWSA9ICdwYW4teSc7XHJcblxyXG4vKipcclxuICogVG91Y2ggQWN0aW9uXHJcbiAqIHNldHMgdGhlIHRvdWNoQWN0aW9uIHByb3BlcnR5IG9yIHVzZXMgdGhlIGpzIGFsdGVybmF0aXZlXHJcbiAqIEBwYXJhbSB7TWFuYWdlcn0gbWFuYWdlclxyXG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWVcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBUb3VjaEFjdGlvbihtYW5hZ2VyLCB2YWx1ZSkge1xyXG4gICAgdGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcclxuICAgIHRoaXMuc2V0KHZhbHVlKTtcclxufVxyXG5cclxuVG91Y2hBY3Rpb24ucHJvdG90eXBlID0ge1xyXG4gICAgLyoqXHJcbiAgICAgKiBzZXQgdGhlIHRvdWNoQWN0aW9uIHZhbHVlIG9uIHRoZSBlbGVtZW50IG9yIGVuYWJsZSB0aGUgcG9seWZpbGxcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZVxyXG4gICAgICovXHJcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICAgICAgLy8gZmluZCBvdXQgdGhlIHRvdWNoLWFjdGlvbiBieSB0aGUgZXZlbnQgaGFuZGxlcnNcclxuICAgICAgICBpZiAodmFsdWUgPT0gVE9VQ0hfQUNUSU9OX0NPTVBVVEUpIHtcclxuICAgICAgICAgICAgdmFsdWUgPSB0aGlzLmNvbXB1dGUoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChOQVRJVkVfVE9VQ0hfQUNUSU9OKSB7XHJcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5lbGVtZW50LnN0eWxlW1BSRUZJWEVEX1RPVUNIX0FDVElPTl0gPSB2YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5hY3Rpb25zID0gdmFsdWUudG9Mb3dlckNhc2UoKS50cmltKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICoganVzdCByZS1zZXQgdGhlIHRvdWNoQWN0aW9uIHZhbHVlXHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5zZXQodGhpcy5tYW5hZ2VyLm9wdGlvbnMudG91Y2hBY3Rpb24pO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGNvbXB1dGUgdGhlIHZhbHVlIGZvciB0aGUgdG91Y2hBY3Rpb24gcHJvcGVydHkgYmFzZWQgb24gdGhlIHJlY29nbml6ZXIncyBzZXR0aW5nc1xyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gdmFsdWVcclxuICAgICAqL1xyXG4gICAgY29tcHV0ZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGFjdGlvbnMgPSBbXTtcclxuICAgICAgICBlYWNoKHRoaXMubWFuYWdlci5yZWNvZ25pemVycywgZnVuY3Rpb24ocmVjb2duaXplcikge1xyXG4gICAgICAgICAgICBpZiAoYm9vbE9yRm4ocmVjb2duaXplci5vcHRpb25zLmVuYWJsZSwgW3JlY29nbml6ZXJdKSkge1xyXG4gICAgICAgICAgICAgICAgYWN0aW9ucyA9IGFjdGlvbnMuY29uY2F0KHJlY29nbml6ZXIuZ2V0VG91Y2hBY3Rpb24oKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gY2xlYW5Ub3VjaEFjdGlvbnMoYWN0aW9ucy5qb2luKCcgJykpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHRoaXMgbWV0aG9kIGlzIGNhbGxlZCBvbiBlYWNoIGlucHV0IGN5Y2xlIGFuZCBwcm92aWRlcyB0aGUgcHJldmVudGluZyBvZiB0aGUgYnJvd3NlciBiZWhhdmlvclxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0XHJcbiAgICAgKi9cclxuICAgIHByZXZlbnREZWZhdWx0czogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICAvLyBub3QgbmVlZGVkIHdpdGggbmF0aXZlIHN1cHBvcnQgZm9yIHRoZSB0b3VjaEFjdGlvbiBwcm9wZXJ0eVxyXG4gICAgICAgIGlmIChOQVRJVkVfVE9VQ0hfQUNUSU9OKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBzcmNFdmVudCA9IGlucHV0LnNyY0V2ZW50O1xyXG4gICAgICAgIHZhciBkaXJlY3Rpb24gPSBpbnB1dC5vZmZzZXREaXJlY3Rpb247XHJcblxyXG4gICAgICAgIC8vIGlmIHRoZSB0b3VjaCBhY3Rpb24gZGlkIHByZXZlbnRlZCBvbmNlIHRoaXMgc2Vzc2lvblxyXG4gICAgICAgIGlmICh0aGlzLm1hbmFnZXIuc2Vzc2lvbi5wcmV2ZW50ZWQpIHtcclxuICAgICAgICAgICAgc3JjRXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGFjdGlvbnMgPSB0aGlzLmFjdGlvbnM7XHJcbiAgICAgICAgdmFyIGhhc05vbmUgPSBpblN0cihhY3Rpb25zLCBUT1VDSF9BQ1RJT05fTk9ORSk7XHJcbiAgICAgICAgdmFyIGhhc1BhblkgPSBpblN0cihhY3Rpb25zLCBUT1VDSF9BQ1RJT05fUEFOX1kpO1xyXG4gICAgICAgIHZhciBoYXNQYW5YID0gaW5TdHIoYWN0aW9ucywgVE9VQ0hfQUNUSU9OX1BBTl9YKTtcclxuXHJcbiAgICAgICAgaWYgKGhhc05vbmUgfHxcclxuICAgICAgICAgICAgKGhhc1BhblkgJiYgZGlyZWN0aW9uICYgRElSRUNUSU9OX0hPUklaT05UQUwpIHx8XHJcbiAgICAgICAgICAgIChoYXNQYW5YICYmIGRpcmVjdGlvbiAmIERJUkVDVElPTl9WRVJUSUNBTCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucHJldmVudFNyYyhzcmNFdmVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGNhbGwgcHJldmVudERlZmF1bHQgdG8gcHJldmVudCB0aGUgYnJvd3NlcidzIGRlZmF1bHQgYmVoYXZpb3IgKHNjcm9sbGluZyBpbiBtb3N0IGNhc2VzKVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNyY0V2ZW50XHJcbiAgICAgKi9cclxuICAgIHByZXZlbnRTcmM6IGZ1bmN0aW9uKHNyY0V2ZW50KSB7XHJcbiAgICAgICAgdGhpcy5tYW5hZ2VyLnNlc3Npb24ucHJldmVudGVkID0gdHJ1ZTtcclxuICAgICAgICBzcmNFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIHdoZW4gdGhlIHRvdWNoQWN0aW9ucyBhcmUgY29sbGVjdGVkIHRoZXkgYXJlIG5vdCBhIHZhbGlkIHZhbHVlLCBzbyB3ZSBuZWVkIHRvIGNsZWFuIHRoaW5ncyB1cC4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gYWN0aW9uc1xyXG4gKiBAcmV0dXJucyB7Kn1cclxuICovXHJcbmZ1bmN0aW9uIGNsZWFuVG91Y2hBY3Rpb25zKGFjdGlvbnMpIHtcclxuICAgIC8vIG5vbmVcclxuICAgIGlmIChpblN0cihhY3Rpb25zLCBUT1VDSF9BQ1RJT05fTk9ORSkpIHtcclxuICAgICAgICByZXR1cm4gVE9VQ0hfQUNUSU9OX05PTkU7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGhhc1BhblggPSBpblN0cihhY3Rpb25zLCBUT1VDSF9BQ1RJT05fUEFOX1gpO1xyXG4gICAgdmFyIGhhc1BhblkgPSBpblN0cihhY3Rpb25zLCBUT1VDSF9BQ1RJT05fUEFOX1kpO1xyXG5cclxuICAgIC8vIHBhbi14IGFuZCBwYW4teSBjYW4gYmUgY29tYmluZWRcclxuICAgIGlmIChoYXNQYW5YICYmIGhhc1BhblkpIHtcclxuICAgICAgICByZXR1cm4gVE9VQ0hfQUNUSU9OX1BBTl9YICsgJyAnICsgVE9VQ0hfQUNUSU9OX1BBTl9ZO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHBhbi14IE9SIHBhbi15XHJcbiAgICBpZiAoaGFzUGFuWCB8fCBoYXNQYW5ZKSB7XHJcbiAgICAgICAgcmV0dXJuIGhhc1BhblggPyBUT1VDSF9BQ1RJT05fUEFOX1ggOiBUT1VDSF9BQ1RJT05fUEFOX1k7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gbWFuaXB1bGF0aW9uXHJcbiAgICBpZiAoaW5TdHIoYWN0aW9ucywgVE9VQ0hfQUNUSU9OX01BTklQVUxBVElPTikpIHtcclxuICAgICAgICByZXR1cm4gVE9VQ0hfQUNUSU9OX01BTklQVUxBVElPTjtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gVE9VQ0hfQUNUSU9OX0FVVE87XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWNvZ25pemVyIGZsb3cgZXhwbGFpbmVkOyAqXHJcbiAqIEFsbCByZWNvZ25pemVycyBoYXZlIHRoZSBpbml0aWFsIHN0YXRlIG9mIFBPU1NJQkxFIHdoZW4gYSBpbnB1dCBzZXNzaW9uIHN0YXJ0cy5cclxuICogVGhlIGRlZmluaXRpb24gb2YgYSBpbnB1dCBzZXNzaW9uIGlzIGZyb20gdGhlIGZpcnN0IGlucHV0IHVudGlsIHRoZSBsYXN0IGlucHV0LCB3aXRoIGFsbCBpdCdzIG1vdmVtZW50IGluIGl0LiAqXHJcbiAqIEV4YW1wbGUgc2Vzc2lvbiBmb3IgbW91c2UtaW5wdXQ6IG1vdXNlZG93biAtPiBtb3VzZW1vdmUgLT4gbW91c2V1cFxyXG4gKlxyXG4gKiBPbiBlYWNoIHJlY29nbml6aW5nIGN5Y2xlIChzZWUgTWFuYWdlci5yZWNvZ25pemUpIHRoZSAucmVjb2duaXplKCkgbWV0aG9kIGlzIGV4ZWN1dGVkXHJcbiAqIHdoaWNoIGRldGVybWluZXMgd2l0aCBzdGF0ZSBpdCBzaG91bGQgYmUuXHJcbiAqXHJcbiAqIElmIHRoZSByZWNvZ25pemVyIGhhcyB0aGUgc3RhdGUgRkFJTEVELCBDQU5DRUxMRUQgb3IgUkVDT0dOSVpFRCAoZXF1YWxzIEVOREVEKSwgaXQgaXMgcmVzZXQgdG9cclxuICogUE9TU0lCTEUgdG8gZ2l2ZSBpdCBhbm90aGVyIGNoYW5nZSBvbiB0aGUgbmV4dCBjeWNsZS5cclxuICpcclxuICogICAgICAgICAgICAgICBQb3NzaWJsZVxyXG4gKiAgICAgICAgICAgICAgICAgIHxcclxuICogICAgICAgICAgICArLS0tLS0rLS0tLS0tLS0tLS0tLS0tK1xyXG4gKiAgICAgICAgICAgIHwgICAgICAgICAgICAgICAgICAgICB8XHJcbiAqICAgICAgKy0tLS0tKy0tLS0tKyAgICAgICAgICAgICAgIHxcclxuICogICAgICB8ICAgICAgICAgICB8ICAgICAgICAgICAgICAgfFxyXG4gKiAgIEZhaWxlZCAgICAgIENhbmNlbGxlZCAgICAgICAgICB8XHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICArLS0tLS0tLSstLS0tLS0rXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICB8ICAgICAgICAgICAgICB8XHJcbiAqICAgICAgICAgICAgICAgICAgICAgIFJlY29nbml6ZWQgICAgICAgQmVnYW5cclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENoYW5nZWRcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRW5kZWQvUmVjb2duaXplZFxyXG4gKi9cclxudmFyIFNUQVRFX1BPU1NJQkxFID0gMTtcclxudmFyIFNUQVRFX0JFR0FOID0gMjtcclxudmFyIFNUQVRFX0NIQU5HRUQgPSA0O1xyXG52YXIgU1RBVEVfRU5ERUQgPSA4O1xyXG52YXIgU1RBVEVfUkVDT0dOSVpFRCA9IFNUQVRFX0VOREVEO1xyXG52YXIgU1RBVEVfQ0FOQ0VMTEVEID0gMTY7XHJcbnZhciBTVEFURV9GQUlMRUQgPSAzMjtcclxuXHJcbi8qKlxyXG4gKiBSZWNvZ25pemVyXHJcbiAqIEV2ZXJ5IHJlY29nbml6ZXIgbmVlZHMgdG8gZXh0ZW5kIGZyb20gdGhpcyBjbGFzcy5cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXHJcbiAqL1xyXG5mdW5jdGlvbiBSZWNvZ25pemVyKG9wdGlvbnMpIHtcclxuICAgIHRoaXMuaWQgPSB1bmlxdWVJZCgpO1xyXG5cclxuICAgIHRoaXMubWFuYWdlciA9IG51bGw7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBtZXJnZShvcHRpb25zIHx8IHt9LCB0aGlzLmRlZmF1bHRzKTtcclxuXHJcbiAgICAvLyBkZWZhdWx0IGlzIGVuYWJsZSB0cnVlXHJcbiAgICB0aGlzLm9wdGlvbnMuZW5hYmxlID0gaWZVbmRlZmluZWQodGhpcy5vcHRpb25zLmVuYWJsZSwgdHJ1ZSk7XHJcblxyXG4gICAgdGhpcy5zdGF0ZSA9IFNUQVRFX1BPU1NJQkxFO1xyXG5cclxuICAgIHRoaXMuc2ltdWx0YW5lb3VzID0ge307XHJcbiAgICB0aGlzLnJlcXVpcmVGYWlsID0gW107XHJcbn1cclxuXHJcblJlY29nbml6ZXIucHJvdG90eXBlID0ge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAdmlydHVhbFxyXG4gICAgICogQHR5cGUge09iamVjdH1cclxuICAgICAqL1xyXG4gICAgZGVmYXVsdHM6IHt9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogc2V0IG9wdGlvbnNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXHJcbiAgICAgKiBAcmV0dXJuIHtSZWNvZ25pemVyfVxyXG4gICAgICovXHJcbiAgICBzZXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcclxuICAgICAgICBleHRlbmQodGhpcy5vcHRpb25zLCBvcHRpb25zKTtcclxuXHJcbiAgICAgICAgLy8gYWxzbyB1cGRhdGUgdGhlIHRvdWNoQWN0aW9uLCBpbiBjYXNlIHNvbWV0aGluZyBjaGFuZ2VkIGFib3V0IHRoZSBkaXJlY3Rpb25zL2VuYWJsZWQgc3RhdGVcclxuICAgICAgICB0aGlzLm1hbmFnZXIgJiYgdGhpcy5tYW5hZ2VyLnRvdWNoQWN0aW9uLnVwZGF0ZSgpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHJlY29nbml6ZSBzaW11bHRhbmVvdXMgd2l0aCBhbiBvdGhlciByZWNvZ25pemVyLlxyXG4gICAgICogQHBhcmFtIHtSZWNvZ25pemVyfSBvdGhlclJlY29nbml6ZXJcclxuICAgICAqIEByZXR1cm5zIHtSZWNvZ25pemVyfSB0aGlzXHJcbiAgICAgKi9cclxuICAgIHJlY29nbml6ZVdpdGg6IGZ1bmN0aW9uKG90aGVyUmVjb2duaXplcikge1xyXG4gICAgICAgIGlmIChpbnZva2VBcnJheUFyZyhvdGhlclJlY29nbml6ZXIsICdyZWNvZ25pemVXaXRoJywgdGhpcykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgc2ltdWx0YW5lb3VzID0gdGhpcy5zaW11bHRhbmVvdXM7XHJcbiAgICAgICAgb3RoZXJSZWNvZ25pemVyID0gZ2V0UmVjb2duaXplckJ5TmFtZUlmTWFuYWdlcihvdGhlclJlY29nbml6ZXIsIHRoaXMpO1xyXG4gICAgICAgIGlmICghc2ltdWx0YW5lb3VzW290aGVyUmVjb2duaXplci5pZF0pIHtcclxuICAgICAgICAgICAgc2ltdWx0YW5lb3VzW290aGVyUmVjb2duaXplci5pZF0gPSBvdGhlclJlY29nbml6ZXI7XHJcbiAgICAgICAgICAgIG90aGVyUmVjb2duaXplci5yZWNvZ25pemVXaXRoKHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBkcm9wIHRoZSBzaW11bHRhbmVvdXMgbGluay4gaXQgZG9lc250IHJlbW92ZSB0aGUgbGluayBvbiB0aGUgb3RoZXIgcmVjb2duaXplci5cclxuICAgICAqIEBwYXJhbSB7UmVjb2duaXplcn0gb3RoZXJSZWNvZ25pemVyXHJcbiAgICAgKiBAcmV0dXJucyB7UmVjb2duaXplcn0gdGhpc1xyXG4gICAgICovXHJcbiAgICBkcm9wUmVjb2duaXplV2l0aDogZnVuY3Rpb24ob3RoZXJSZWNvZ25pemVyKSB7XHJcbiAgICAgICAgaWYgKGludm9rZUFycmF5QXJnKG90aGVyUmVjb2duaXplciwgJ2Ryb3BSZWNvZ25pemVXaXRoJywgdGhpcykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBvdGhlclJlY29nbml6ZXIgPSBnZXRSZWNvZ25pemVyQnlOYW1lSWZNYW5hZ2VyKG90aGVyUmVjb2duaXplciwgdGhpcyk7XHJcbiAgICAgICAgZGVsZXRlIHRoaXMuc2ltdWx0YW5lb3VzW290aGVyUmVjb2duaXplci5pZF07XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmVjb2duaXplciBjYW4gb25seSBydW4gd2hlbiBhbiBvdGhlciBpcyBmYWlsaW5nXHJcbiAgICAgKiBAcGFyYW0ge1JlY29nbml6ZXJ9IG90aGVyUmVjb2duaXplclxyXG4gICAgICogQHJldHVybnMge1JlY29nbml6ZXJ9IHRoaXNcclxuICAgICAqL1xyXG4gICAgcmVxdWlyZUZhaWx1cmU6IGZ1bmN0aW9uKG90aGVyUmVjb2duaXplcikge1xyXG4gICAgICAgIGlmIChpbnZva2VBcnJheUFyZyhvdGhlclJlY29nbml6ZXIsICdyZXF1aXJlRmFpbHVyZScsIHRoaXMpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHJlcXVpcmVGYWlsID0gdGhpcy5yZXF1aXJlRmFpbDtcclxuICAgICAgICBvdGhlclJlY29nbml6ZXIgPSBnZXRSZWNvZ25pemVyQnlOYW1lSWZNYW5hZ2VyKG90aGVyUmVjb2duaXplciwgdGhpcyk7XHJcbiAgICAgICAgaWYgKGluQXJyYXkocmVxdWlyZUZhaWwsIG90aGVyUmVjb2duaXplcikgPT09IC0xKSB7XHJcbiAgICAgICAgICAgIHJlcXVpcmVGYWlsLnB1c2gob3RoZXJSZWNvZ25pemVyKTtcclxuICAgICAgICAgICAgb3RoZXJSZWNvZ25pemVyLnJlcXVpcmVGYWlsdXJlKHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBkcm9wIHRoZSByZXF1aXJlRmFpbHVyZSBsaW5rLiBpdCBkb2VzIG5vdCByZW1vdmUgdGhlIGxpbmsgb24gdGhlIG90aGVyIHJlY29nbml6ZXIuXHJcbiAgICAgKiBAcGFyYW0ge1JlY29nbml6ZXJ9IG90aGVyUmVjb2duaXplclxyXG4gICAgICogQHJldHVybnMge1JlY29nbml6ZXJ9IHRoaXNcclxuICAgICAqL1xyXG4gICAgZHJvcFJlcXVpcmVGYWlsdXJlOiBmdW5jdGlvbihvdGhlclJlY29nbml6ZXIpIHtcclxuICAgICAgICBpZiAoaW52b2tlQXJyYXlBcmcob3RoZXJSZWNvZ25pemVyLCAnZHJvcFJlcXVpcmVGYWlsdXJlJywgdGhpcykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBvdGhlclJlY29nbml6ZXIgPSBnZXRSZWNvZ25pemVyQnlOYW1lSWZNYW5hZ2VyKG90aGVyUmVjb2duaXplciwgdGhpcyk7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gaW5BcnJheSh0aGlzLnJlcXVpcmVGYWlsLCBvdGhlclJlY29nbml6ZXIpO1xyXG4gICAgICAgIGlmIChpbmRleCA+IC0xKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVxdWlyZUZhaWwuc3BsaWNlKGluZGV4LCAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogaGFzIHJlcXVpcmUgZmFpbHVyZXMgYm9vbGVhblxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAgICAgKi9cclxuICAgIGhhc1JlcXVpcmVGYWlsdXJlczogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWlyZUZhaWwubGVuZ3RoID4gMDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBpZiB0aGUgcmVjb2duaXplciBjYW4gcmVjb2duaXplIHNpbXVsdGFuZW91cyB3aXRoIGFuIG90aGVyIHJlY29nbml6ZXJcclxuICAgICAqIEBwYXJhbSB7UmVjb2duaXplcn0gb3RoZXJSZWNvZ25pemVyXHJcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgY2FuUmVjb2duaXplV2l0aDogZnVuY3Rpb24ob3RoZXJSZWNvZ25pemVyKSB7XHJcbiAgICAgICAgcmV0dXJuICEhdGhpcy5zaW11bHRhbmVvdXNbb3RoZXJSZWNvZ25pemVyLmlkXTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBZb3Ugc2hvdWxkIHVzZSBgdHJ5RW1pdGAgaW5zdGVhZCBvZiBgZW1pdGAgZGlyZWN0bHkgdG8gY2hlY2tcclxuICAgICAqIHRoYXQgYWxsIHRoZSBuZWVkZWQgcmVjb2duaXplcnMgaGFzIGZhaWxlZCBiZWZvcmUgZW1pdHRpbmcuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaW5wdXRcclxuICAgICAqL1xyXG4gICAgZW1pdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICAgICAgdmFyIHN0YXRlID0gdGhpcy5zdGF0ZTtcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gZW1pdCh3aXRoU3RhdGUpIHtcclxuICAgICAgICAgICAgc2VsZi5tYW5hZ2VyLmVtaXQoc2VsZi5vcHRpb25zLmV2ZW50ICsgKHdpdGhTdGF0ZSA/IHN0YXRlU3RyKHN0YXRlKSA6ICcnKSwgaW5wdXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gJ3BhbnN0YXJ0JyBhbmQgJ3Bhbm1vdmUnXHJcbiAgICAgICAgaWYgKHN0YXRlIDwgU1RBVEVfRU5ERUQpIHtcclxuICAgICAgICAgICAgZW1pdCh0cnVlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGVtaXQoKTsgLy8gc2ltcGxlICdldmVudE5hbWUnIGV2ZW50c1xyXG5cclxuICAgICAgICAvLyBwYW5lbmQgYW5kIHBhbmNhbmNlbFxyXG4gICAgICAgIGlmIChzdGF0ZSA+PSBTVEFURV9FTkRFRCkge1xyXG4gICAgICAgICAgICBlbWl0KHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVjayB0aGF0IGFsbCB0aGUgcmVxdWlyZSBmYWlsdXJlIHJlY29nbml6ZXJzIGhhcyBmYWlsZWQsXHJcbiAgICAgKiBpZiB0cnVlLCBpdCBlbWl0cyBhIGdlc3R1cmUgZXZlbnQsXHJcbiAgICAgKiBvdGhlcndpc2UsIHNldHVwIHRoZSBzdGF0ZSB0byBGQUlMRUQuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaW5wdXRcclxuICAgICAqL1xyXG4gICAgdHJ5RW1pdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICBpZiAodGhpcy5jYW5FbWl0KCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZW1pdChpbnB1dCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGl0J3MgZmFpbGluZyBhbnl3YXlcclxuICAgICAgICB0aGlzLnN0YXRlID0gU1RBVEVfRkFJTEVEO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGNhbiB3ZSBlbWl0P1xyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAgICAgKi9cclxuICAgIGNhbkVtaXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBpID0gMDtcclxuICAgICAgICB3aGlsZSAoaSA8IHRoaXMucmVxdWlyZUZhaWwubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGlmICghKHRoaXMucmVxdWlyZUZhaWxbaV0uc3RhdGUgJiAoU1RBVEVfRkFJTEVEIHwgU1RBVEVfUE9TU0lCTEUpKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGkrKztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogdXBkYXRlIHRoZSByZWNvZ25pemVyXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaW5wdXREYXRhXHJcbiAgICAgKi9cclxuICAgIHJlY29nbml6ZTogZnVuY3Rpb24oaW5wdXREYXRhKSB7XHJcbiAgICAgICAgLy8gbWFrZSBhIG5ldyBjb3B5IG9mIHRoZSBpbnB1dERhdGFcclxuICAgICAgICAvLyBzbyB3ZSBjYW4gY2hhbmdlIHRoZSBpbnB1dERhdGEgd2l0aG91dCBtZXNzaW5nIHVwIHRoZSBvdGhlciByZWNvZ25pemVyc1xyXG4gICAgICAgIHZhciBpbnB1dERhdGFDbG9uZSA9IGV4dGVuZCh7fSwgaW5wdXREYXRhKTtcclxuXHJcbiAgICAgICAgLy8gaXMgaXMgZW5hYmxlZCBhbmQgYWxsb3cgcmVjb2duaXppbmc/XHJcbiAgICAgICAgaWYgKCFib29sT3JGbih0aGlzLm9wdGlvbnMuZW5hYmxlLCBbdGhpcywgaW5wdXREYXRhQ2xvbmVdKSkge1xyXG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTVEFURV9GQUlMRUQ7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJlc2V0IHdoZW4gd2UndmUgcmVhY2hlZCB0aGUgZW5kXHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgJiAoU1RBVEVfUkVDT0dOSVpFRCB8IFNUQVRFX0NBTkNFTExFRCB8IFNUQVRFX0ZBSUxFRCkpIHtcclxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFNUQVRFX1BPU1NJQkxFO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMucHJvY2VzcyhpbnB1dERhdGFDbG9uZSk7XHJcblxyXG4gICAgICAgIC8vIHRoZSByZWNvZ25pemVyIGhhcyByZWNvZ25pemVkIGEgZ2VzdHVyZVxyXG4gICAgICAgIC8vIHNvIHRyaWdnZXIgYW4gZXZlbnRcclxuICAgICAgICBpZiAodGhpcy5zdGF0ZSAmIChTVEFURV9CRUdBTiB8IFNUQVRFX0NIQU5HRUQgfCBTVEFURV9FTkRFRCB8IFNUQVRFX0NBTkNFTExFRCkpIHtcclxuICAgICAgICAgICAgdGhpcy50cnlFbWl0KGlucHV0RGF0YUNsb25lKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmV0dXJuIHRoZSBzdGF0ZSBvZiB0aGUgcmVjb2duaXplclxyXG4gICAgICogdGhlIGFjdHVhbCByZWNvZ25pemluZyBoYXBwZW5zIGluIHRoaXMgbWV0aG9kXHJcbiAgICAgKiBAdmlydHVhbFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0RGF0YVxyXG4gICAgICogQHJldHVybnMge0NvbnN0fSBTVEFURVxyXG4gICAgICovXHJcbiAgICBwcm9jZXNzOiBmdW5jdGlvbihpbnB1dERhdGEpIHsgfSwgLy8ganNoaW50IGlnbm9yZTpsaW5lXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiByZXR1cm4gdGhlIHByZWZlcnJlZCB0b3VjaC1hY3Rpb25cclxuICAgICAqIEB2aXJ0dWFsXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgKi9cclxuICAgIGdldFRvdWNoQWN0aW9uOiBmdW5jdGlvbigpIHsgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGNhbGxlZCB3aGVuIHRoZSBnZXN0dXJlIGlzbid0IGFsbG93ZWQgdG8gcmVjb2duaXplXHJcbiAgICAgKiBsaWtlIHdoZW4gYW5vdGhlciBpcyBiZWluZyByZWNvZ25pemVkIG9yIGl0IGlzIGRpc2FibGVkXHJcbiAgICAgKiBAdmlydHVhbFxyXG4gICAgICovXHJcbiAgICByZXNldDogZnVuY3Rpb24oKSB7IH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBnZXQgYSB1c2FibGUgc3RyaW5nLCB1c2VkIGFzIGV2ZW50IHBvc3RmaXhcclxuICogQHBhcmFtIHtDb25zdH0gc3RhdGVcclxuICogQHJldHVybnMge1N0cmluZ30gc3RhdGVcclxuICovXHJcbmZ1bmN0aW9uIHN0YXRlU3RyKHN0YXRlKSB7XHJcbiAgICBpZiAoc3RhdGUgJiBTVEFURV9DQU5DRUxMRUQpIHtcclxuICAgICAgICByZXR1cm4gJ2NhbmNlbCc7XHJcbiAgICB9IGVsc2UgaWYgKHN0YXRlICYgU1RBVEVfRU5ERUQpIHtcclxuICAgICAgICByZXR1cm4gJ2VuZCc7XHJcbiAgICB9IGVsc2UgaWYgKHN0YXRlICYgU1RBVEVfQ0hBTkdFRCkge1xyXG4gICAgICAgIHJldHVybiAnbW92ZSc7XHJcbiAgICB9IGVsc2UgaWYgKHN0YXRlICYgU1RBVEVfQkVHQU4pIHtcclxuICAgICAgICByZXR1cm4gJ3N0YXJ0JztcclxuICAgIH1cclxuICAgIHJldHVybiAnJztcclxufVxyXG5cclxuLyoqXHJcbiAqIGRpcmVjdGlvbiBjb25zIHRvIHN0cmluZ1xyXG4gKiBAcGFyYW0ge0NvbnN0fSBkaXJlY3Rpb25cclxuICogQHJldHVybnMge1N0cmluZ31cclxuICovXHJcbmZ1bmN0aW9uIGRpcmVjdGlvblN0cihkaXJlY3Rpb24pIHtcclxuICAgIGlmIChkaXJlY3Rpb24gPT0gRElSRUNUSU9OX0RPV04pIHtcclxuICAgICAgICByZXR1cm4gJ2Rvd24nO1xyXG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT0gRElSRUNUSU9OX1VQKSB7XHJcbiAgICAgICAgcmV0dXJuICd1cCc7XHJcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PSBESVJFQ1RJT05fTEVGVCkge1xyXG4gICAgICAgIHJldHVybiAnbGVmdCc7XHJcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PSBESVJFQ1RJT05fUklHSFQpIHtcclxuICAgICAgICByZXR1cm4gJ3JpZ2h0JztcclxuICAgIH1cclxuICAgIHJldHVybiAnJztcclxufVxyXG5cclxuLyoqXHJcbiAqIGdldCBhIHJlY29nbml6ZXIgYnkgbmFtZSBpZiBpdCBpcyBib3VuZCB0byBhIG1hbmFnZXJcclxuICogQHBhcmFtIHtSZWNvZ25pemVyfFN0cmluZ30gb3RoZXJSZWNvZ25pemVyXHJcbiAqIEBwYXJhbSB7UmVjb2duaXplcn0gcmVjb2duaXplclxyXG4gKiBAcmV0dXJucyB7UmVjb2duaXplcn1cclxuICovXHJcbmZ1bmN0aW9uIGdldFJlY29nbml6ZXJCeU5hbWVJZk1hbmFnZXIob3RoZXJSZWNvZ25pemVyLCByZWNvZ25pemVyKSB7XHJcbiAgICB2YXIgbWFuYWdlciA9IHJlY29nbml6ZXIubWFuYWdlcjtcclxuICAgIGlmIChtYW5hZ2VyKSB7XHJcbiAgICAgICAgcmV0dXJuIG1hbmFnZXIuZ2V0KG90aGVyUmVjb2duaXplcik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gb3RoZXJSZWNvZ25pemVyO1xyXG59XHJcblxyXG4vKipcclxuICogVGhpcyByZWNvZ25pemVyIGlzIGp1c3QgdXNlZCBhcyBhIGJhc2UgZm9yIHRoZSBzaW1wbGUgYXR0cmlidXRlIHJlY29nbml6ZXJzLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgUmVjb2duaXplclxyXG4gKi9cclxuZnVuY3Rpb24gQXR0clJlY29nbml6ZXIoKSB7XHJcbiAgICBSZWNvZ25pemVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmluaGVyaXQoQXR0clJlY29nbml6ZXIsIFJlY29nbml6ZXIsIHtcclxuICAgIC8qKlxyXG4gICAgICogQG5hbWVzcGFjZVxyXG4gICAgICogQG1lbWJlcm9mIEF0dHJSZWNvZ25pemVyXHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRzOiB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cclxuICAgICAgICAgKiBAZGVmYXVsdCAxXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcG9pbnRlcnM6IDFcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2VkIHRvIGNoZWNrIGlmIGl0IHRoZSByZWNvZ25pemVyIHJlY2VpdmVzIHZhbGlkIGlucHV0LCBsaWtlIGlucHV0LmRpc3RhbmNlID4gMTAuXHJcbiAgICAgKiBAbWVtYmVyb2YgQXR0clJlY29nbml6ZXJcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dFxyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IHJlY29nbml6ZWRcclxuICAgICAqL1xyXG4gICAgYXR0clRlc3Q6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdmFyIG9wdGlvblBvaW50ZXJzID0gdGhpcy5vcHRpb25zLnBvaW50ZXJzO1xyXG4gICAgICAgIHJldHVybiBvcHRpb25Qb2ludGVycyA9PT0gMCB8fCBpbnB1dC5wb2ludGVycy5sZW5ndGggPT09IG9wdGlvblBvaW50ZXJzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFByb2Nlc3MgdGhlIGlucHV0IGFuZCByZXR1cm4gdGhlIHN0YXRlIGZvciB0aGUgcmVjb2duaXplclxyXG4gICAgICogQG1lbWJlcm9mIEF0dHJSZWNvZ25pemVyXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaW5wdXRcclxuICAgICAqIEByZXR1cm5zIHsqfSBTdGF0ZVxyXG4gICAgICovXHJcbiAgICBwcm9jZXNzOiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHZhciBzdGF0ZSA9IHRoaXMuc3RhdGU7XHJcbiAgICAgICAgdmFyIGV2ZW50VHlwZSA9IGlucHV0LmV2ZW50VHlwZTtcclxuXHJcbiAgICAgICAgdmFyIGlzUmVjb2duaXplZCA9IHN0YXRlICYgKFNUQVRFX0JFR0FOIHwgU1RBVEVfQ0hBTkdFRCk7XHJcbiAgICAgICAgdmFyIGlzVmFsaWQgPSB0aGlzLmF0dHJUZXN0KGlucHV0KTtcclxuXHJcbiAgICAgICAgLy8gb24gY2FuY2VsIGlucHV0IGFuZCB3ZSd2ZSByZWNvZ25pemVkIGJlZm9yZSwgcmV0dXJuIFNUQVRFX0NBTkNFTExFRFxyXG4gICAgICAgIGlmIChpc1JlY29nbml6ZWQgJiYgKGV2ZW50VHlwZSAmIElOUFVUX0NBTkNFTCB8fCAhaXNWYWxpZCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlIHwgU1RBVEVfQ0FOQ0VMTEVEO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoaXNSZWNvZ25pemVkIHx8IGlzVmFsaWQpIHtcclxuICAgICAgICAgICAgaWYgKGV2ZW50VHlwZSAmIElOUFVUX0VORCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRlIHwgU1RBVEVfRU5ERUQ7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIShzdGF0ZSAmIFNUQVRFX0JFR0FOKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFNUQVRFX0JFR0FOO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZSB8IFNUQVRFX0NIQU5HRUQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBTVEFURV9GQUlMRUQ7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIFBhblxyXG4gKiBSZWNvZ25pemVkIHdoZW4gdGhlIHBvaW50ZXIgaXMgZG93biBhbmQgbW92ZWQgaW4gdGhlIGFsbG93ZWQgZGlyZWN0aW9uLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgQXR0clJlY29nbml6ZXJcclxuICovXHJcbmZ1bmN0aW9uIFBhblJlY29nbml6ZXIoKSB7XHJcbiAgICBBdHRyUmVjb2duaXplci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cclxuICAgIHRoaXMucFggPSBudWxsO1xyXG4gICAgdGhpcy5wWSA9IG51bGw7XHJcbn1cclxuXHJcbmluaGVyaXQoUGFuUmVjb2duaXplciwgQXR0clJlY29nbml6ZXIsIHtcclxuICAgIC8qKlxyXG4gICAgICogQG5hbWVzcGFjZVxyXG4gICAgICogQG1lbWJlcm9mIFBhblJlY29nbml6ZXJcclxuICAgICAqL1xyXG4gICAgZGVmYXVsdHM6IHtcclxuICAgICAgICBldmVudDogJ3BhbicsXHJcbiAgICAgICAgdGhyZXNob2xkOiAxMCxcclxuICAgICAgICBwb2ludGVyczogMSxcclxuICAgICAgICBkaXJlY3Rpb246IERJUkVDVElPTl9BTExcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0VG91Y2hBY3Rpb246IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBkaXJlY3Rpb24gPSB0aGlzLm9wdGlvbnMuZGlyZWN0aW9uO1xyXG4gICAgICAgIHZhciBhY3Rpb25zID0gW107XHJcbiAgICAgICAgaWYgKGRpcmVjdGlvbiAmIERJUkVDVElPTl9IT1JJWk9OVEFMKSB7XHJcbiAgICAgICAgICAgIGFjdGlvbnMucHVzaChUT1VDSF9BQ1RJT05fUEFOX1kpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGlyZWN0aW9uICYgRElSRUNUSU9OX1ZFUlRJQ0FMKSB7XHJcbiAgICAgICAgICAgIGFjdGlvbnMucHVzaChUT1VDSF9BQ1RJT05fUEFOX1gpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gYWN0aW9ucztcclxuICAgIH0sXHJcblxyXG4gICAgZGlyZWN0aW9uVGVzdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICB2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcclxuICAgICAgICB2YXIgaGFzTW92ZWQgPSB0cnVlO1xyXG4gICAgICAgIHZhciBkaXN0YW5jZSA9IGlucHV0LmRpc3RhbmNlO1xyXG4gICAgICAgIHZhciBkaXJlY3Rpb24gPSBpbnB1dC5kaXJlY3Rpb247XHJcbiAgICAgICAgdmFyIHggPSBpbnB1dC5kZWx0YVg7XHJcbiAgICAgICAgdmFyIHkgPSBpbnB1dC5kZWx0YVk7XHJcblxyXG4gICAgICAgIC8vIGxvY2sgdG8gYXhpcz9cclxuICAgICAgICBpZiAoIShkaXJlY3Rpb24gJiBvcHRpb25zLmRpcmVjdGlvbikpIHtcclxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuZGlyZWN0aW9uICYgRElSRUNUSU9OX0hPUklaT05UQUwpIHtcclxuICAgICAgICAgICAgICAgIGRpcmVjdGlvbiA9ICh4ID09PSAwKSA/IERJUkVDVElPTl9OT05FIDogKHggPCAwKSA/IERJUkVDVElPTl9MRUZUIDogRElSRUNUSU9OX1JJR0hUO1xyXG4gICAgICAgICAgICAgICAgaGFzTW92ZWQgPSB4ICE9IHRoaXMucFg7XHJcbiAgICAgICAgICAgICAgICBkaXN0YW5jZSA9IE1hdGguYWJzKGlucHV0LmRlbHRhWCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBkaXJlY3Rpb24gPSAoeSA9PT0gMCkgPyBESVJFQ1RJT05fTk9ORSA6ICh5IDwgMCkgPyBESVJFQ1RJT05fVVAgOiBESVJFQ1RJT05fRE9XTjtcclxuICAgICAgICAgICAgICAgIGhhc01vdmVkID0geSAhPSB0aGlzLnBZO1xyXG4gICAgICAgICAgICAgICAgZGlzdGFuY2UgPSBNYXRoLmFicyhpbnB1dC5kZWx0YVkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlucHV0LmRpcmVjdGlvbiA9IGRpcmVjdGlvbjtcclxuICAgICAgICByZXR1cm4gaGFzTW92ZWQgJiYgZGlzdGFuY2UgPiBvcHRpb25zLnRocmVzaG9sZCAmJiBkaXJlY3Rpb24gJiBvcHRpb25zLmRpcmVjdGlvbjtcclxuICAgIH0sXHJcblxyXG4gICAgYXR0clRlc3Q6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgcmV0dXJuIEF0dHJSZWNvZ25pemVyLnByb3RvdHlwZS5hdHRyVGVzdC5jYWxsKHRoaXMsIGlucHV0KSAmJlxyXG4gICAgICAgICAgICAodGhpcy5zdGF0ZSAmIFNUQVRFX0JFR0FOIHx8ICghKHRoaXMuc3RhdGUgJiBTVEFURV9CRUdBTikgJiYgdGhpcy5kaXJlY3Rpb25UZXN0KGlucHV0KSkpO1xyXG4gICAgfSxcclxuXHJcbiAgICBlbWl0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHRoaXMucFggPSBpbnB1dC5kZWx0YVg7XHJcbiAgICAgICAgdGhpcy5wWSA9IGlucHV0LmRlbHRhWTtcclxuXHJcbiAgICAgICAgdmFyIGRpcmVjdGlvbiA9IGRpcmVjdGlvblN0cihpbnB1dC5kaXJlY3Rpb24pO1xyXG4gICAgICAgIGlmIChkaXJlY3Rpb24pIHtcclxuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQodGhpcy5vcHRpb25zLmV2ZW50ICsgZGlyZWN0aW9uLCBpbnB1dCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9zdXBlci5lbWl0LmNhbGwodGhpcywgaW5wdXQpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBQaW5jaFxyXG4gKiBSZWNvZ25pemVkIHdoZW4gdHdvIG9yIG1vcmUgcG9pbnRlcnMgYXJlIG1vdmluZyB0b3dhcmQgKHpvb20taW4pIG9yIGF3YXkgZnJvbSBlYWNoIG90aGVyICh6b29tLW91dCkuXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBBdHRyUmVjb2duaXplclxyXG4gKi9cclxuZnVuY3Rpb24gUGluY2hSZWNvZ25pemVyKCkge1xyXG4gICAgQXR0clJlY29nbml6ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuaW5oZXJpdChQaW5jaFJlY29nbml6ZXIsIEF0dHJSZWNvZ25pemVyLCB7XHJcbiAgICAvKipcclxuICAgICAqIEBuYW1lc3BhY2VcclxuICAgICAqIEBtZW1iZXJvZiBQaW5jaFJlY29nbml6ZXJcclxuICAgICAqL1xyXG4gICAgZGVmYXVsdHM6IHtcclxuICAgICAgICBldmVudDogJ3BpbmNoJyxcclxuICAgICAgICB0aHJlc2hvbGQ6IDAsXHJcbiAgICAgICAgcG9pbnRlcnM6IDJcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0VG91Y2hBY3Rpb246IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBbVE9VQ0hfQUNUSU9OX05PTkVdO1xyXG4gICAgfSxcclxuXHJcbiAgICBhdHRyVGVzdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fc3VwZXIuYXR0clRlc3QuY2FsbCh0aGlzLCBpbnB1dCkgJiZcclxuICAgICAgICAgICAgKE1hdGguYWJzKGlucHV0LnNjYWxlIC0gMSkgPiB0aGlzLm9wdGlvbnMudGhyZXNob2xkIHx8IHRoaXMuc3RhdGUgJiBTVEFURV9CRUdBTik7XHJcbiAgICB9LFxyXG5cclxuICAgIGVtaXQ6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdGhpcy5fc3VwZXIuZW1pdC5jYWxsKHRoaXMsIGlucHV0KTtcclxuICAgICAgICBpZiAoaW5wdXQuc2NhbGUgIT09IDEpIHtcclxuICAgICAgICAgICAgdmFyIGluT3V0ID0gaW5wdXQuc2NhbGUgPCAxID8gJ2luJyA6ICdvdXQnO1xyXG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuZW1pdCh0aGlzLm9wdGlvbnMuZXZlbnQgKyBpbk91dCwgaW5wdXQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogUHJlc3NcclxuICogUmVjb2duaXplZCB3aGVuIHRoZSBwb2ludGVyIGlzIGRvd24gZm9yIHggbXMgd2l0aG91dCBhbnkgbW92ZW1lbnQuXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAZXh0ZW5kcyBSZWNvZ25pemVyXHJcbiAqL1xyXG5mdW5jdGlvbiBQcmVzc1JlY29nbml6ZXIoKSB7XHJcbiAgICBSZWNvZ25pemVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblxyXG4gICAgdGhpcy5fdGltZXIgPSBudWxsO1xyXG4gICAgdGhpcy5faW5wdXQgPSBudWxsO1xyXG59XHJcblxyXG5pbmhlcml0KFByZXNzUmVjb2duaXplciwgUmVjb2duaXplciwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAbmFtZXNwYWNlXHJcbiAgICAgKiBAbWVtYmVyb2YgUHJlc3NSZWNvZ25pemVyXHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRzOiB7XHJcbiAgICAgICAgZXZlbnQ6ICdwcmVzcycsXHJcbiAgICAgICAgcG9pbnRlcnM6IDEsXHJcbiAgICAgICAgdGltZTogNTAwLCAvLyBtaW5pbWFsIHRpbWUgb2YgdGhlIHBvaW50ZXIgdG8gYmUgcHJlc3NlZFxyXG4gICAgICAgIHRocmVzaG9sZDogNSAvLyBhIG1pbmltYWwgbW92ZW1lbnQgaXMgb2ssIGJ1dCBrZWVwIGl0IGxvd1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRUb3VjaEFjdGlvbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIFtUT1VDSF9BQ1RJT05fQVVUT107XHJcbiAgICB9LFxyXG5cclxuICAgIHByb2Nlc3M6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XHJcbiAgICAgICAgdmFyIHZhbGlkUG9pbnRlcnMgPSBpbnB1dC5wb2ludGVycy5sZW5ndGggPT09IG9wdGlvbnMucG9pbnRlcnM7XHJcbiAgICAgICAgdmFyIHZhbGlkTW92ZW1lbnQgPSBpbnB1dC5kaXN0YW5jZSA8IG9wdGlvbnMudGhyZXNob2xkO1xyXG4gICAgICAgIHZhciB2YWxpZFRpbWUgPSBpbnB1dC5kZWx0YVRpbWUgPiBvcHRpb25zLnRpbWU7XHJcblxyXG4gICAgICAgIHRoaXMuX2lucHV0ID0gaW5wdXQ7XHJcblxyXG4gICAgICAgIC8vIHdlIG9ubHkgYWxsb3cgbGl0dGxlIG1vdmVtZW50XHJcbiAgICAgICAgLy8gYW5kIHdlJ3ZlIHJlYWNoZWQgYW4gZW5kIGV2ZW50LCBzbyBhIHRhcCBpcyBwb3NzaWJsZVxyXG4gICAgICAgIGlmICghdmFsaWRNb3ZlbWVudCB8fCAhdmFsaWRQb2ludGVycyB8fCAoaW5wdXQuZXZlbnRUeXBlICYgKElOUFVUX0VORCB8IElOUFVUX0NBTkNFTCkgJiYgIXZhbGlkVGltZSkpIHtcclxuICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXQuZXZlbnRUeXBlICYgSU5QVVRfU1RBUlQpIHtcclxuICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xyXG4gICAgICAgICAgICB0aGlzLl90aW1lciA9IHNldFRpbWVvdXRDb250ZXh0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFNUQVRFX1JFQ09HTklaRUQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRyeUVtaXQoKTtcclxuICAgICAgICAgICAgfSwgb3B0aW9ucy50aW1lLCB0aGlzKTtcclxuICAgICAgICB9IGVsc2UgaWYgKGlucHV0LmV2ZW50VHlwZSAmIElOUFVUX0VORCkge1xyXG4gICAgICAgICAgICByZXR1cm4gU1RBVEVfUkVDT0dOSVpFRDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFNUQVRFX0ZBSUxFRDtcclxuICAgIH0sXHJcblxyXG4gICAgcmVzZXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl90aW1lcik7XHJcbiAgICB9LFxyXG5cclxuICAgIGVtaXQ6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT09IFNUQVRFX1JFQ09HTklaRUQpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGlucHV0ICYmIChpbnB1dC5ldmVudFR5cGUgJiBJTlBVVF9FTkQpKSB7XHJcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5lbWl0KHRoaXMub3B0aW9ucy5ldmVudCArICd1cCcsIGlucHV0KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9pbnB1dC50aW1lU3RhbXAgPSBub3coKTtcclxuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQodGhpcy5vcHRpb25zLmV2ZW50LCB0aGlzLl9pbnB1dCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBSb3RhdGVcclxuICogUmVjb2duaXplZCB3aGVuIHR3byBvciBtb3JlIHBvaW50ZXIgYXJlIG1vdmluZyBpbiBhIGNpcmN1bGFyIG1vdGlvbi5cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIEF0dHJSZWNvZ25pemVyXHJcbiAqL1xyXG5mdW5jdGlvbiBSb3RhdGVSZWNvZ25pemVyKCkge1xyXG4gICAgQXR0clJlY29nbml6ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuaW5oZXJpdChSb3RhdGVSZWNvZ25pemVyLCBBdHRyUmVjb2duaXplciwge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAbmFtZXNwYWNlXHJcbiAgICAgKiBAbWVtYmVyb2YgUm90YXRlUmVjb2duaXplclxyXG4gICAgICovXHJcbiAgICBkZWZhdWx0czoge1xyXG4gICAgICAgIGV2ZW50OiAncm90YXRlJyxcclxuICAgICAgICB0aHJlc2hvbGQ6IDAsXHJcbiAgICAgICAgcG9pbnRlcnM6IDJcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0VG91Y2hBY3Rpb246IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBbVE9VQ0hfQUNUSU9OX05PTkVdO1xyXG4gICAgfSxcclxuXHJcbiAgICBhdHRyVGVzdDogZnVuY3Rpb24oaW5wdXQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fc3VwZXIuYXR0clRlc3QuY2FsbCh0aGlzLCBpbnB1dCkgJiZcclxuICAgICAgICAgICAgKE1hdGguYWJzKGlucHV0LnJvdGF0aW9uKSA+IHRoaXMub3B0aW9ucy50aHJlc2hvbGQgfHwgdGhpcy5zdGF0ZSAmIFNUQVRFX0JFR0FOKTtcclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogU3dpcGVcclxuICogUmVjb2duaXplZCB3aGVuIHRoZSBwb2ludGVyIGlzIG1vdmluZyBmYXN0ICh2ZWxvY2l0eSksIHdpdGggZW5vdWdoIGRpc3RhbmNlIGluIHRoZSBhbGxvd2VkIGRpcmVjdGlvbi5cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBleHRlbmRzIEF0dHJSZWNvZ25pemVyXHJcbiAqL1xyXG5mdW5jdGlvbiBTd2lwZVJlY29nbml6ZXIoKSB7XHJcbiAgICBBdHRyUmVjb2duaXplci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5pbmhlcml0KFN3aXBlUmVjb2duaXplciwgQXR0clJlY29nbml6ZXIsIHtcclxuICAgIC8qKlxyXG4gICAgICogQG5hbWVzcGFjZVxyXG4gICAgICogQG1lbWJlcm9mIFN3aXBlUmVjb2duaXplclxyXG4gICAgICovXHJcbiAgICBkZWZhdWx0czoge1xyXG4gICAgICAgIGV2ZW50OiAnc3dpcGUnLFxyXG4gICAgICAgIHRocmVzaG9sZDogMTAsXHJcbiAgICAgICAgdmVsb2NpdHk6IDAuNjUsXHJcbiAgICAgICAgZGlyZWN0aW9uOiBESVJFQ1RJT05fSE9SSVpPTlRBTCB8IERJUkVDVElPTl9WRVJUSUNBTCxcclxuICAgICAgICBwb2ludGVyczogMVxyXG4gICAgfSxcclxuXHJcbiAgICBnZXRUb3VjaEFjdGlvbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIFBhblJlY29nbml6ZXIucHJvdG90eXBlLmdldFRvdWNoQWN0aW9uLmNhbGwodGhpcyk7XHJcbiAgICB9LFxyXG5cclxuICAgIGF0dHJUZXN0OiBmdW5jdGlvbihpbnB1dCkge1xyXG4gICAgICAgIHZhciBkaXJlY3Rpb24gPSB0aGlzLm9wdGlvbnMuZGlyZWN0aW9uO1xyXG4gICAgICAgIHZhciB2ZWxvY2l0eTtcclxuXHJcbiAgICAgICAgaWYgKGRpcmVjdGlvbiAmIChESVJFQ1RJT05fSE9SSVpPTlRBTCB8IERJUkVDVElPTl9WRVJUSUNBTCkpIHtcclxuICAgICAgICAgICAgdmVsb2NpdHkgPSBpbnB1dC52ZWxvY2l0eTtcclxuICAgICAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiAmIERJUkVDVElPTl9IT1JJWk9OVEFMKSB7XHJcbiAgICAgICAgICAgIHZlbG9jaXR5ID0gaW5wdXQudmVsb2NpdHlYO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uICYgRElSRUNUSU9OX1ZFUlRJQ0FMKSB7XHJcbiAgICAgICAgICAgIHZlbG9jaXR5ID0gaW5wdXQudmVsb2NpdHlZO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cGVyLmF0dHJUZXN0LmNhbGwodGhpcywgaW5wdXQpICYmXHJcbiAgICAgICAgICAgIGRpcmVjdGlvbiAmIGlucHV0LmRpcmVjdGlvbiAmJlxyXG4gICAgICAgICAgICBpbnB1dC5kaXN0YW5jZSA+IHRoaXMub3B0aW9ucy50aHJlc2hvbGQgJiZcclxuICAgICAgICAgICAgYWJzKHZlbG9jaXR5KSA+IHRoaXMub3B0aW9ucy52ZWxvY2l0eSAmJiBpbnB1dC5ldmVudFR5cGUgJiBJTlBVVF9FTkQ7XHJcbiAgICB9LFxyXG5cclxuICAgIGVtaXQ6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdmFyIGRpcmVjdGlvbiA9IGRpcmVjdGlvblN0cihpbnB1dC5kaXJlY3Rpb24pO1xyXG4gICAgICAgIGlmIChkaXJlY3Rpb24pIHtcclxuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQodGhpcy5vcHRpb25zLmV2ZW50ICsgZGlyZWN0aW9uLCBpbnB1dCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1hbmFnZXIuZW1pdCh0aGlzLm9wdGlvbnMuZXZlbnQsIGlucHV0KTtcclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogQSB0YXAgaXMgZWNvZ25pemVkIHdoZW4gdGhlIHBvaW50ZXIgaXMgZG9pbmcgYSBzbWFsbCB0YXAvY2xpY2suIE11bHRpcGxlIHRhcHMgYXJlIHJlY29nbml6ZWQgaWYgdGhleSBvY2N1clxyXG4gKiBiZXR3ZWVuIHRoZSBnaXZlbiBpbnRlcnZhbCBhbmQgcG9zaXRpb24uIFRoZSBkZWxheSBvcHRpb24gY2FuIGJlIHVzZWQgdG8gcmVjb2duaXplIG11bHRpLXRhcHMgd2l0aG91dCBmaXJpbmdcclxuICogYSBzaW5nbGUgdGFwLlxyXG4gKlxyXG4gKiBUaGUgZXZlbnREYXRhIGZyb20gdGhlIGVtaXR0ZWQgZXZlbnQgY29udGFpbnMgdGhlIHByb3BlcnR5IGB0YXBDb3VudGAsIHdoaWNoIGNvbnRhaW5zIHRoZSBhbW91bnQgb2ZcclxuICogbXVsdGktdGFwcyBiZWluZyByZWNvZ25pemVkLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4dGVuZHMgUmVjb2duaXplclxyXG4gKi9cclxuZnVuY3Rpb24gVGFwUmVjb2duaXplcigpIHtcclxuICAgIFJlY29nbml6ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHJcbiAgICAvLyBwcmV2aW91cyB0aW1lIGFuZCBjZW50ZXIsXHJcbiAgICAvLyB1c2VkIGZvciB0YXAgY291bnRpbmdcclxuICAgIHRoaXMucFRpbWUgPSBmYWxzZTtcclxuICAgIHRoaXMucENlbnRlciA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMuX3RpbWVyID0gbnVsbDtcclxuICAgIHRoaXMuX2lucHV0ID0gbnVsbDtcclxuICAgIHRoaXMuY291bnQgPSAwO1xyXG59XHJcblxyXG5pbmhlcml0KFRhcFJlY29nbml6ZXIsIFJlY29nbml6ZXIsIHtcclxuICAgIC8qKlxyXG4gICAgICogQG5hbWVzcGFjZVxyXG4gICAgICogQG1lbWJlcm9mIFBpbmNoUmVjb2duaXplclxyXG4gICAgICovXHJcbiAgICBkZWZhdWx0czoge1xyXG4gICAgICAgIGV2ZW50OiAndGFwJyxcclxuICAgICAgICBwb2ludGVyczogMSxcclxuICAgICAgICB0YXBzOiAxLFxyXG4gICAgICAgIGludGVydmFsOiAzMDAsIC8vIG1heCB0aW1lIGJldHdlZW4gdGhlIG11bHRpLXRhcCB0YXBzXHJcbiAgICAgICAgdGltZTogMjUwLCAvLyBtYXggdGltZSBvZiB0aGUgcG9pbnRlciB0byBiZSBkb3duIChsaWtlIGZpbmdlciBvbiB0aGUgc2NyZWVuKVxyXG4gICAgICAgIHRocmVzaG9sZDogMiwgLy8gYSBtaW5pbWFsIG1vdmVtZW50IGlzIG9rLCBidXQga2VlcCBpdCBsb3dcclxuICAgICAgICBwb3NUaHJlc2hvbGQ6IDEwIC8vIGEgbXVsdGktdGFwIGNhbiBiZSBhIGJpdCBvZmYgdGhlIGluaXRpYWwgcG9zaXRpb25cclxuICAgIH0sXHJcblxyXG4gICAgZ2V0VG91Y2hBY3Rpb246IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBbVE9VQ0hfQUNUSU9OX01BTklQVUxBVElPTl07XHJcbiAgICB9LFxyXG5cclxuICAgIHByb2Nlc3M6IGZ1bmN0aW9uKGlucHV0KSB7XHJcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XHJcblxyXG4gICAgICAgIHZhciB2YWxpZFBvaW50ZXJzID0gaW5wdXQucG9pbnRlcnMubGVuZ3RoID09PSBvcHRpb25zLnBvaW50ZXJzO1xyXG4gICAgICAgIHZhciB2YWxpZE1vdmVtZW50ID0gaW5wdXQuZGlzdGFuY2UgPCBvcHRpb25zLnRocmVzaG9sZDtcclxuICAgICAgICB2YXIgdmFsaWRUb3VjaFRpbWUgPSBpbnB1dC5kZWx0YVRpbWUgPCBvcHRpb25zLnRpbWU7XHJcblxyXG4gICAgICAgIHRoaXMucmVzZXQoKTtcclxuXHJcbiAgICAgICAgaWYgKChpbnB1dC5ldmVudFR5cGUgJiBJTlBVVF9TVEFSVCkgJiYgKHRoaXMuY291bnQgPT09IDApKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZhaWxUaW1lb3V0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyB3ZSBvbmx5IGFsbG93IGxpdHRsZSBtb3ZlbWVudFxyXG4gICAgICAgIC8vIGFuZCB3ZSd2ZSByZWFjaGVkIGFuIGVuZCBldmVudCwgc28gYSB0YXAgaXMgcG9zc2libGVcclxuICAgICAgICBpZiAodmFsaWRNb3ZlbWVudCAmJiB2YWxpZFRvdWNoVGltZSAmJiB2YWxpZFBvaW50ZXJzKSB7XHJcbiAgICAgICAgICAgIGlmIChpbnB1dC5ldmVudFR5cGUgIT0gSU5QVVRfRU5EKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5mYWlsVGltZW91dCgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgdmFsaWRJbnRlcnZhbCA9IHRoaXMucFRpbWUgPyAoaW5wdXQudGltZVN0YW1wIC0gdGhpcy5wVGltZSA8IG9wdGlvbnMuaW50ZXJ2YWwpIDogdHJ1ZTtcclxuICAgICAgICAgICAgdmFyIHZhbGlkTXVsdGlUYXAgPSAhdGhpcy5wQ2VudGVyIHx8IGdldERpc3RhbmNlKHRoaXMucENlbnRlciwgaW5wdXQuY2VudGVyKSA8IG9wdGlvbnMucG9zVGhyZXNob2xkO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5wVGltZSA9IGlucHV0LnRpbWVTdGFtcDtcclxuICAgICAgICAgICAgdGhpcy5wQ2VudGVyID0gaW5wdXQuY2VudGVyO1xyXG5cclxuICAgICAgICAgICAgaWYgKCF2YWxpZE11bHRpVGFwIHx8ICF2YWxpZEludGVydmFsKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvdW50ID0gMTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY291bnQgKz0gMTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5faW5wdXQgPSBpbnB1dDtcclxuXHJcbiAgICAgICAgICAgIC8vIGlmIHRhcCBjb3VudCBtYXRjaGVzIHdlIGhhdmUgcmVjb2duaXplZCBpdCxcclxuICAgICAgICAgICAgLy8gZWxzZSBpdCBoYXMgYmVnYW4gcmVjb2duaXppbmcuLi5cclxuICAgICAgICAgICAgdmFyIHRhcENvdW50ID0gdGhpcy5jb3VudCAlIG9wdGlvbnMudGFwcztcclxuICAgICAgICAgICAgaWYgKHRhcENvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBubyBmYWlsaW5nIHJlcXVpcmVtZW50cywgaW1tZWRpYXRlbHkgdHJpZ2dlciB0aGUgdGFwIGV2ZW50XHJcbiAgICAgICAgICAgICAgICAvLyBvciB3YWl0IGFzIGxvbmcgYXMgdGhlIG11bHRpdGFwIGludGVydmFsIHRvIHRyaWdnZXJcclxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNSZXF1aXJlRmFpbHVyZXMoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTVEFURV9SRUNPR05JWkVEO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90aW1lciA9IHNldFRpbWVvdXRDb250ZXh0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU1RBVEVfUkVDT0dOSVpFRDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50cnlFbWl0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSwgb3B0aW9ucy5pbnRlcnZhbCwgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFNUQVRFX0JFR0FOO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBTVEFURV9GQUlMRUQ7XHJcbiAgICB9LFxyXG5cclxuICAgIGZhaWxUaW1lb3V0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLl90aW1lciA9IHNldFRpbWVvdXRDb250ZXh0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU1RBVEVfRkFJTEVEO1xyXG4gICAgICAgIH0sIHRoaXMub3B0aW9ucy5pbnRlcnZhbCwgdGhpcyk7XHJcbiAgICAgICAgcmV0dXJuIFNUQVRFX0ZBSUxFRDtcclxuICAgIH0sXHJcblxyXG4gICAgcmVzZXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl90aW1lcik7XHJcbiAgICB9LFxyXG5cclxuICAgIGVtaXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlID09IFNUQVRFX1JFQ09HTklaRUQgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2lucHV0LnRhcENvdW50ID0gdGhpcy5jb3VudDtcclxuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQodGhpcy5vcHRpb25zLmV2ZW50LCB0aGlzLl9pbnB1dCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBTaW1wbGUgd2F5IHRvIGNyZWF0ZSBhbiBtYW5hZ2VyIHdpdGggYSBkZWZhdWx0IHNldCBvZiByZWNvZ25pemVycy5cclxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudFxyXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gSGFtbWVyKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG4gICAgb3B0aW9ucy5yZWNvZ25pemVycyA9IGlmVW5kZWZpbmVkKG9wdGlvbnMucmVjb2duaXplcnMsIEhhbW1lci5kZWZhdWx0cy5wcmVzZXQpO1xyXG4gICAgcmV0dXJuIG5ldyBNYW5hZ2VyKGVsZW1lbnQsIG9wdGlvbnMpO1xyXG59XHJcblxyXG4vKipcclxuICogQGNvbnN0IHtzdHJpbmd9XHJcbiAqL1xyXG5IYW1tZXIuVkVSU0lPTiA9ICcyLjAuNCc7XHJcblxyXG4vKipcclxuICogZGVmYXVsdCBzZXR0aW5nc1xyXG4gKiBAbmFtZXNwYWNlXHJcbiAqL1xyXG5IYW1tZXIuZGVmYXVsdHMgPSB7XHJcbiAgICAvKipcclxuICAgICAqIHNldCBpZiBET00gZXZlbnRzIGFyZSBiZWluZyB0cmlnZ2VyZWQuXHJcbiAgICAgKiBCdXQgdGhpcyBpcyBzbG93ZXIgYW5kIHVudXNlZCBieSBzaW1wbGUgaW1wbGVtZW50YXRpb25zLCBzbyBkaXNhYmxlZCBieSBkZWZhdWx0LlxyXG4gICAgICogQHR5cGUge0Jvb2xlYW59XHJcbiAgICAgKiBAZGVmYXVsdCBmYWxzZVxyXG4gICAgICovXHJcbiAgICBkb21FdmVudHM6IGZhbHNlLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIHZhbHVlIGZvciB0aGUgdG91Y2hBY3Rpb24gcHJvcGVydHkvZmFsbGJhY2suXHJcbiAgICAgKiBXaGVuIHNldCB0byBgY29tcHV0ZWAgaXQgd2lsbCBtYWdpY2FsbHkgc2V0IHRoZSBjb3JyZWN0IHZhbHVlIGJhc2VkIG9uIHRoZSBhZGRlZCByZWNvZ25pemVycy5cclxuICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgKiBAZGVmYXVsdCBjb21wdXRlXHJcbiAgICAgKi9cclxuICAgIHRvdWNoQWN0aW9uOiBUT1VDSF9BQ1RJT05fQ09NUFVURSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEB0eXBlIHtCb29sZWFufVxyXG4gICAgICogQGRlZmF1bHQgdHJ1ZVxyXG4gICAgICovXHJcbiAgICBlbmFibGU6IHRydWUsXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFWFBFUklNRU5UQUwgRkVBVFVSRSAtLSBjYW4gYmUgcmVtb3ZlZC9jaGFuZ2VkXHJcbiAgICAgKiBDaGFuZ2UgdGhlIHBhcmVudCBpbnB1dCB0YXJnZXQgZWxlbWVudC5cclxuICAgICAqIElmIE51bGwsIHRoZW4gaXQgaXMgYmVpbmcgc2V0IHRoZSB0byBtYWluIGVsZW1lbnQuXHJcbiAgICAgKiBAdHlwZSB7TnVsbHxFdmVudFRhcmdldH1cclxuICAgICAqIEBkZWZhdWx0IG51bGxcclxuICAgICAqL1xyXG4gICAgaW5wdXRUYXJnZXQ6IG51bGwsXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBmb3JjZSBhbiBpbnB1dCBjbGFzc1xyXG4gICAgICogQHR5cGUge051bGx8RnVuY3Rpb259XHJcbiAgICAgKiBAZGVmYXVsdCBudWxsXHJcbiAgICAgKi9cclxuICAgIGlucHV0Q2xhc3M6IG51bGwsXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEZWZhdWx0IHJlY29nbml6ZXIgc2V0dXAgd2hlbiBjYWxsaW5nIGBIYW1tZXIoKWBcclxuICAgICAqIFdoZW4gY3JlYXRpbmcgYSBuZXcgTWFuYWdlciB0aGVzZSB3aWxsIGJlIHNraXBwZWQuXHJcbiAgICAgKiBAdHlwZSB7QXJyYXl9XHJcbiAgICAgKi9cclxuICAgIHByZXNldDogW1xyXG4gICAgICAgIC8vIFJlY29nbml6ZXJDbGFzcywgb3B0aW9ucywgW3JlY29nbml6ZVdpdGgsIC4uLl0sIFtyZXF1aXJlRmFpbHVyZSwgLi4uXVxyXG4gICAgICAgIFtSb3RhdGVSZWNvZ25pemVyLCB7IGVuYWJsZTogZmFsc2UgfV0sXHJcbiAgICAgICAgW1BpbmNoUmVjb2duaXplciwgeyBlbmFibGU6IGZhbHNlIH0sIFsncm90YXRlJ11dLFxyXG4gICAgICAgIFtTd2lwZVJlY29nbml6ZXIseyBkaXJlY3Rpb246IERJUkVDVElPTl9IT1JJWk9OVEFMIH1dLFxyXG4gICAgICAgIFtQYW5SZWNvZ25pemVyLCB7IGRpcmVjdGlvbjogRElSRUNUSU9OX0hPUklaT05UQUwgfSwgWydzd2lwZSddXSxcclxuICAgICAgICBbVGFwUmVjb2duaXplcl0sXHJcbiAgICAgICAgW1RhcFJlY29nbml6ZXIsIHsgZXZlbnQ6ICdkb3VibGV0YXAnLCB0YXBzOiAyIH0sIFsndGFwJ11dLFxyXG4gICAgICAgIFtQcmVzc1JlY29nbml6ZXJdXHJcbiAgICBdLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU29tZSBDU1MgcHJvcGVydGllcyBjYW4gYmUgdXNlZCB0byBpbXByb3ZlIHRoZSB3b3JraW5nIG9mIEhhbW1lci5cclxuICAgICAqIEFkZCB0aGVtIHRvIHRoaXMgbWV0aG9kIGFuZCB0aGV5IHdpbGwgYmUgc2V0IHdoZW4gY3JlYXRpbmcgYSBuZXcgTWFuYWdlci5cclxuICAgICAqIEBuYW1lc3BhY2VcclxuICAgICAqL1xyXG4gICAgY3NzUHJvcHM6IHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBEaXNhYmxlcyB0ZXh0IHNlbGVjdGlvbiB0byBpbXByb3ZlIHRoZSBkcmFnZ2luZyBnZXN0dXJlLiBNYWlubHkgZm9yIGRlc2t0b3AgYnJvd3NlcnMuXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKiBAZGVmYXVsdCAnbm9uZSdcclxuICAgICAgICAgKi9cclxuICAgICAgICB1c2VyU2VsZWN0OiAnbm9uZScsXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIERpc2FibGUgdGhlIFdpbmRvd3MgUGhvbmUgZ3JpcHBlcnMgd2hlbiBwcmVzc2luZyBhbiBlbGVtZW50LlxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICogQGRlZmF1bHQgJ25vbmUnXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdG91Y2hTZWxlY3Q6ICdub25lJyxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRGlzYWJsZXMgdGhlIGRlZmF1bHQgY2FsbG91dCBzaG93biB3aGVuIHlvdSB0b3VjaCBhbmQgaG9sZCBhIHRvdWNoIHRhcmdldC5cclxuICAgICAgICAgKiBPbiBpT1MsIHdoZW4geW91IHRvdWNoIGFuZCBob2xkIGEgdG91Y2ggdGFyZ2V0IHN1Y2ggYXMgYSBsaW5rLCBTYWZhcmkgZGlzcGxheXNcclxuICAgICAgICAgKiBhIGNhbGxvdXQgY29udGFpbmluZyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbGluay4gVGhpcyBwcm9wZXJ0eSBhbGxvd3MgeW91IHRvIGRpc2FibGUgdGhhdCBjYWxsb3V0LlxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICogQGRlZmF1bHQgJ25vbmUnXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdG91Y2hDYWxsb3V0OiAnbm9uZScsXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFNwZWNpZmllcyB3aGV0aGVyIHpvb21pbmcgaXMgZW5hYmxlZC4gVXNlZCBieSBJRTEwPlxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICogQGRlZmF1bHQgJ25vbmUnXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgY29udGVudFpvb21pbmc6ICdub25lJyxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU3BlY2lmaWVzIHRoYXQgYW4gZW50aXJlIGVsZW1lbnQgc2hvdWxkIGJlIGRyYWdnYWJsZSBpbnN0ZWFkIG9mIGl0cyBjb250ZW50cy4gTWFpbmx5IGZvciBkZXNrdG9wIGJyb3dzZXJzLlxyXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAgICogQGRlZmF1bHQgJ25vbmUnXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdXNlckRyYWc6ICdub25lJyxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogT3ZlcnJpZGVzIHRoZSBoaWdobGlnaHQgY29sb3Igc2hvd24gd2hlbiB0aGUgdXNlciB0YXBzIGEgbGluayBvciBhIEphdmFTY3JpcHRcclxuICAgICAgICAgKiBjbGlja2FibGUgZWxlbWVudCBpbiBpT1MuIFRoaXMgcHJvcGVydHkgb2JleXMgdGhlIGFscGhhIHZhbHVlLCBpZiBzcGVjaWZpZWQuXHJcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAgICAgKiBAZGVmYXVsdCAncmdiYSgwLDAsMCwwKSdcclxuICAgICAgICAgKi9cclxuICAgICAgICB0YXBIaWdobGlnaHRDb2xvcjogJ3JnYmEoMCwwLDAsMCknXHJcbiAgICB9XHJcbn07XHJcblxyXG52YXIgU1RPUCA9IDE7XHJcbnZhciBGT1JDRURfU1RPUCA9IDI7XHJcblxyXG4vKipcclxuICogTWFuYWdlclxyXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtZW50XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBNYW5hZ2VyKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cclxuICAgIHRoaXMub3B0aW9ucyA9IG1lcmdlKG9wdGlvbnMsIEhhbW1lci5kZWZhdWx0cyk7XHJcbiAgICB0aGlzLm9wdGlvbnMuaW5wdXRUYXJnZXQgPSB0aGlzLm9wdGlvbnMuaW5wdXRUYXJnZXQgfHwgZWxlbWVudDtcclxuXHJcbiAgICB0aGlzLmhhbmRsZXJzID0ge307XHJcbiAgICB0aGlzLnNlc3Npb24gPSB7fTtcclxuICAgIHRoaXMucmVjb2duaXplcnMgPSBbXTtcclxuXHJcbiAgICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5pbnB1dCA9IGNyZWF0ZUlucHV0SW5zdGFuY2UodGhpcyk7XHJcbiAgICB0aGlzLnRvdWNoQWN0aW9uID0gbmV3IFRvdWNoQWN0aW9uKHRoaXMsIHRoaXMub3B0aW9ucy50b3VjaEFjdGlvbik7XHJcblxyXG4gICAgdG9nZ2xlQ3NzUHJvcHModGhpcywgdHJ1ZSk7XHJcblxyXG4gICAgZWFjaChvcHRpb25zLnJlY29nbml6ZXJzLCBmdW5jdGlvbihpdGVtKSB7XHJcbiAgICAgICAgdmFyIHJlY29nbml6ZXIgPSB0aGlzLmFkZChuZXcgKGl0ZW1bMF0pKGl0ZW1bMV0pKTtcclxuICAgICAgICBpdGVtWzJdICYmIHJlY29nbml6ZXIucmVjb2duaXplV2l0aChpdGVtWzJdKTtcclxuICAgICAgICBpdGVtWzNdICYmIHJlY29nbml6ZXIucmVxdWlyZUZhaWx1cmUoaXRlbVszXSk7XHJcbiAgICB9LCB0aGlzKTtcclxufVxyXG5cclxuTWFuYWdlci5wcm90b3R5cGUgPSB7XHJcbiAgICAvKipcclxuICAgICAqIHNldCBvcHRpb25zXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xyXG4gICAgICogQHJldHVybnMge01hbmFnZXJ9XHJcbiAgICAgKi9cclxuICAgIHNldDogZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gICAgICAgIGV4dGVuZCh0aGlzLm9wdGlvbnMsIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICAvLyBPcHRpb25zIHRoYXQgbmVlZCBhIGxpdHRsZSBtb3JlIHNldHVwXHJcbiAgICAgICAgaWYgKG9wdGlvbnMudG91Y2hBY3Rpb24pIHtcclxuICAgICAgICAgICAgdGhpcy50b3VjaEFjdGlvbi51cGRhdGUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuaW5wdXRUYXJnZXQpIHtcclxuICAgICAgICAgICAgLy8gQ2xlYW4gdXAgZXhpc3RpbmcgZXZlbnQgbGlzdGVuZXJzIGFuZCByZWluaXRpYWxpemVcclxuICAgICAgICAgICAgdGhpcy5pbnB1dC5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgIHRoaXMuaW5wdXQudGFyZ2V0ID0gb3B0aW9ucy5pbnB1dFRhcmdldDtcclxuICAgICAgICAgICAgdGhpcy5pbnB1dC5pbml0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHN0b3AgcmVjb2duaXppbmcgZm9yIHRoaXMgc2Vzc2lvbi5cclxuICAgICAqIFRoaXMgc2Vzc2lvbiB3aWxsIGJlIGRpc2NhcmRlZCwgd2hlbiBhIG5ldyBbaW5wdXRdc3RhcnQgZXZlbnQgaXMgZmlyZWQuXHJcbiAgICAgKiBXaGVuIGZvcmNlZCwgdGhlIHJlY29nbml6ZXIgY3ljbGUgaXMgc3RvcHBlZCBpbW1lZGlhdGVseS5cclxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gW2ZvcmNlXVxyXG4gICAgICovXHJcbiAgICBzdG9wOiBmdW5jdGlvbihmb3JjZSkge1xyXG4gICAgICAgIHRoaXMuc2Vzc2lvbi5zdG9wcGVkID0gZm9yY2UgPyBGT1JDRURfU1RPUCA6IFNUT1A7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcnVuIHRoZSByZWNvZ25pemVycyFcclxuICAgICAqIGNhbGxlZCBieSB0aGUgaW5wdXRIYW5kbGVyIGZ1bmN0aW9uIG9uIGV2ZXJ5IG1vdmVtZW50IG9mIHRoZSBwb2ludGVycyAodG91Y2hlcylcclxuICAgICAqIGl0IHdhbGtzIHRocm91Z2ggYWxsIHRoZSByZWNvZ25pemVycyBhbmQgdHJpZXMgdG8gZGV0ZWN0IHRoZSBnZXN0dXJlIHRoYXQgaXMgYmVpbmcgbWFkZVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0RGF0YVxyXG4gICAgICovXHJcbiAgICByZWNvZ25pemU6IGZ1bmN0aW9uKGlucHV0RGF0YSkge1xyXG4gICAgICAgIHZhciBzZXNzaW9uID0gdGhpcy5zZXNzaW9uO1xyXG4gICAgICAgIGlmIChzZXNzaW9uLnN0b3BwZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gcnVuIHRoZSB0b3VjaC1hY3Rpb24gcG9seWZpbGxcclxuICAgICAgICB0aGlzLnRvdWNoQWN0aW9uLnByZXZlbnREZWZhdWx0cyhpbnB1dERhdGEpO1xyXG5cclxuICAgICAgICB2YXIgcmVjb2duaXplcjtcclxuICAgICAgICB2YXIgcmVjb2duaXplcnMgPSB0aGlzLnJlY29nbml6ZXJzO1xyXG5cclxuICAgICAgICAvLyB0aGlzIGhvbGRzIHRoZSByZWNvZ25pemVyIHRoYXQgaXMgYmVpbmcgcmVjb2duaXplZC5cclxuICAgICAgICAvLyBzbyB0aGUgcmVjb2duaXplcidzIHN0YXRlIG5lZWRzIHRvIGJlIEJFR0FOLCBDSEFOR0VELCBFTkRFRCBvciBSRUNPR05JWkVEXHJcbiAgICAgICAgLy8gaWYgbm8gcmVjb2duaXplciBpcyBkZXRlY3RpbmcgYSB0aGluZywgaXQgaXMgc2V0IHRvIGBudWxsYFxyXG4gICAgICAgIHZhciBjdXJSZWNvZ25pemVyID0gc2Vzc2lvbi5jdXJSZWNvZ25pemVyO1xyXG5cclxuICAgICAgICAvLyByZXNldCB3aGVuIHRoZSBsYXN0IHJlY29nbml6ZXIgaXMgcmVjb2duaXplZFxyXG4gICAgICAgIC8vIG9yIHdoZW4gd2UncmUgaW4gYSBuZXcgc2Vzc2lvblxyXG4gICAgICAgIGlmICghY3VyUmVjb2duaXplciB8fCAoY3VyUmVjb2duaXplciAmJiBjdXJSZWNvZ25pemVyLnN0YXRlICYgU1RBVEVfUkVDT0dOSVpFRCkpIHtcclxuICAgICAgICAgICAgY3VyUmVjb2duaXplciA9IHNlc3Npb24uY3VyUmVjb2duaXplciA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgaSA9IDA7XHJcbiAgICAgICAgd2hpbGUgKGkgPCByZWNvZ25pemVycy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgcmVjb2duaXplciA9IHJlY29nbml6ZXJzW2ldO1xyXG5cclxuICAgICAgICAgICAgLy8gZmluZCBvdXQgaWYgd2UgYXJlIGFsbG93ZWQgdHJ5IHRvIHJlY29nbml6ZSB0aGUgaW5wdXQgZm9yIHRoaXMgb25lLlxyXG4gICAgICAgICAgICAvLyAxLiAgIGFsbG93IGlmIHRoZSBzZXNzaW9uIGlzIE5PVCBmb3JjZWQgc3RvcHBlZCAoc2VlIHRoZSAuc3RvcCgpIG1ldGhvZClcclxuICAgICAgICAgICAgLy8gMi4gICBhbGxvdyBpZiB3ZSBzdGlsbCBoYXZlbid0IHJlY29nbml6ZWQgYSBnZXN0dXJlIGluIHRoaXMgc2Vzc2lvbiwgb3IgdGhlIHRoaXMgcmVjb2duaXplciBpcyB0aGUgb25lXHJcbiAgICAgICAgICAgIC8vICAgICAgdGhhdCBpcyBiZWluZyByZWNvZ25pemVkLlxyXG4gICAgICAgICAgICAvLyAzLiAgIGFsbG93IGlmIHRoZSByZWNvZ25pemVyIGlzIGFsbG93ZWQgdG8gcnVuIHNpbXVsdGFuZW91cyB3aXRoIHRoZSBjdXJyZW50IHJlY29nbml6ZWQgcmVjb2duaXplci5cclxuICAgICAgICAgICAgLy8gICAgICB0aGlzIGNhbiBiZSBzZXR1cCB3aXRoIHRoZSBgcmVjb2duaXplV2l0aCgpYCBtZXRob2Qgb24gdGhlIHJlY29nbml6ZXIuXHJcbiAgICAgICAgICAgIGlmIChzZXNzaW9uLnN0b3BwZWQgIT09IEZPUkNFRF9TVE9QICYmICggLy8gMVxyXG4gICAgICAgICAgICAgICAgICAgICFjdXJSZWNvZ25pemVyIHx8IHJlY29nbml6ZXIgPT0gY3VyUmVjb2duaXplciB8fCAvLyAyXHJcbiAgICAgICAgICAgICAgICAgICAgcmVjb2duaXplci5jYW5SZWNvZ25pemVXaXRoKGN1clJlY29nbml6ZXIpKSkgeyAvLyAzXHJcbiAgICAgICAgICAgICAgICByZWNvZ25pemVyLnJlY29nbml6ZShpbnB1dERhdGEpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmVjb2duaXplci5yZXNldCgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBpZiB0aGUgcmVjb2duaXplciBoYXMgYmVlbiByZWNvZ25pemluZyB0aGUgaW5wdXQgYXMgYSB2YWxpZCBnZXN0dXJlLCB3ZSB3YW50IHRvIHN0b3JlIHRoaXMgb25lIGFzIHRoZVxyXG4gICAgICAgICAgICAvLyBjdXJyZW50IGFjdGl2ZSByZWNvZ25pemVyLiBidXQgb25seSBpZiB3ZSBkb24ndCBhbHJlYWR5IGhhdmUgYW4gYWN0aXZlIHJlY29nbml6ZXJcclxuICAgICAgICAgICAgaWYgKCFjdXJSZWNvZ25pemVyICYmIHJlY29nbml6ZXIuc3RhdGUgJiAoU1RBVEVfQkVHQU4gfCBTVEFURV9DSEFOR0VEIHwgU1RBVEVfRU5ERUQpKSB7XHJcbiAgICAgICAgICAgICAgICBjdXJSZWNvZ25pemVyID0gc2Vzc2lvbi5jdXJSZWNvZ25pemVyID0gcmVjb2duaXplcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpKys7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGdldCBhIHJlY29nbml6ZXIgYnkgaXRzIGV2ZW50IG5hbWUuXHJcbiAgICAgKiBAcGFyYW0ge1JlY29nbml6ZXJ8U3RyaW5nfSByZWNvZ25pemVyXHJcbiAgICAgKiBAcmV0dXJucyB7UmVjb2duaXplcnxOdWxsfVxyXG4gICAgICovXHJcbiAgICBnZXQ6IGZ1bmN0aW9uKHJlY29nbml6ZXIpIHtcclxuICAgICAgICBpZiAocmVjb2duaXplciBpbnN0YW5jZW9mIFJlY29nbml6ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlY29nbml6ZXI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmVjb2duaXplcnMgPSB0aGlzLnJlY29nbml6ZXJzO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVjb2duaXplcnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHJlY29nbml6ZXJzW2ldLm9wdGlvbnMuZXZlbnQgPT0gcmVjb2duaXplcikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlY29nbml6ZXJzW2ldO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGFkZCBhIHJlY29nbml6ZXIgdG8gdGhlIG1hbmFnZXJcclxuICAgICAqIGV4aXN0aW5nIHJlY29nbml6ZXJzIHdpdGggdGhlIHNhbWUgZXZlbnQgbmFtZSB3aWxsIGJlIHJlbW92ZWRcclxuICAgICAqIEBwYXJhbSB7UmVjb2duaXplcn0gcmVjb2duaXplclxyXG4gICAgICogQHJldHVybnMge1JlY29nbml6ZXJ8TWFuYWdlcn1cclxuICAgICAqL1xyXG4gICAgYWRkOiBmdW5jdGlvbihyZWNvZ25pemVyKSB7XHJcbiAgICAgICAgaWYgKGludm9rZUFycmF5QXJnKHJlY29nbml6ZXIsICdhZGQnLCB0aGlzKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJlbW92ZSBleGlzdGluZ1xyXG4gICAgICAgIHZhciBleGlzdGluZyA9IHRoaXMuZ2V0KHJlY29nbml6ZXIub3B0aW9ucy5ldmVudCk7XHJcbiAgICAgICAgaWYgKGV4aXN0aW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGV4aXN0aW5nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMucmVjb2duaXplcnMucHVzaChyZWNvZ25pemVyKTtcclxuICAgICAgICByZWNvZ25pemVyLm1hbmFnZXIgPSB0aGlzO1xyXG5cclxuICAgICAgICB0aGlzLnRvdWNoQWN0aW9uLnVwZGF0ZSgpO1xyXG4gICAgICAgIHJldHVybiByZWNvZ25pemVyO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHJlbW92ZSBhIHJlY29nbml6ZXIgYnkgbmFtZSBvciBpbnN0YW5jZVxyXG4gICAgICogQHBhcmFtIHtSZWNvZ25pemVyfFN0cmluZ30gcmVjb2duaXplclxyXG4gICAgICogQHJldHVybnMge01hbmFnZXJ9XHJcbiAgICAgKi9cclxuICAgIHJlbW92ZTogZnVuY3Rpb24ocmVjb2duaXplcikge1xyXG4gICAgICAgIGlmIChpbnZva2VBcnJheUFyZyhyZWNvZ25pemVyLCAncmVtb3ZlJywgdGhpcykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmVjb2duaXplcnMgPSB0aGlzLnJlY29nbml6ZXJzO1xyXG4gICAgICAgIHJlY29nbml6ZXIgPSB0aGlzLmdldChyZWNvZ25pemVyKTtcclxuICAgICAgICByZWNvZ25pemVycy5zcGxpY2UoaW5BcnJheShyZWNvZ25pemVycywgcmVjb2duaXplciksIDEpO1xyXG5cclxuICAgICAgICB0aGlzLnRvdWNoQWN0aW9uLnVwZGF0ZSgpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGJpbmQgZXZlbnRcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudHNcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXJcclxuICAgICAqIEByZXR1cm5zIHtFdmVudEVtaXR0ZXJ9IHRoaXNcclxuICAgICAqL1xyXG4gICAgb246IGZ1bmN0aW9uKGV2ZW50cywgaGFuZGxlcikge1xyXG4gICAgICAgIHZhciBoYW5kbGVycyA9IHRoaXMuaGFuZGxlcnM7XHJcbiAgICAgICAgZWFjaChzcGxpdFN0cihldmVudHMpLCBmdW5jdGlvbihldmVudCkge1xyXG4gICAgICAgICAgICBoYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyc1tldmVudF0gfHwgW107XHJcbiAgICAgICAgICAgIGhhbmRsZXJzW2V2ZW50XS5wdXNoKGhhbmRsZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHVuYmluZCBldmVudCwgbGVhdmUgZW1pdCBibGFuayB0byByZW1vdmUgYWxsIGhhbmRsZXJzXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRzXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbaGFuZGxlcl1cclxuICAgICAqIEByZXR1cm5zIHtFdmVudEVtaXR0ZXJ9IHRoaXNcclxuICAgICAqL1xyXG4gICAgb2ZmOiBmdW5jdGlvbihldmVudHMsIGhhbmRsZXIpIHtcclxuICAgICAgICB2YXIgaGFuZGxlcnMgPSB0aGlzLmhhbmRsZXJzO1xyXG4gICAgICAgIGVhY2goc3BsaXRTdHIoZXZlbnRzKSwgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICAgICAgaWYgKCFoYW5kbGVyKSB7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgaGFuZGxlcnNbZXZlbnRdO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlcnNbZXZlbnRdLnNwbGljZShpbkFycmF5KGhhbmRsZXJzW2V2ZW50XSwgaGFuZGxlciksIDEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogZW1pdCBldmVudCB0byB0aGUgbGlzdGVuZXJzXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXHJcbiAgICAgKi9cclxuICAgIGVtaXQ6IGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XHJcbiAgICAgICAgLy8gd2UgYWxzbyB3YW50IHRvIHRyaWdnZXIgZG9tIGV2ZW50c1xyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZG9tRXZlbnRzKSB7XHJcbiAgICAgICAgICAgIHRyaWdnZXJEb21FdmVudChldmVudCwgZGF0YSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBubyBoYW5kbGVycywgc28gc2tpcCBpdCBhbGxcclxuICAgICAgICB2YXIgaGFuZGxlcnMgPSB0aGlzLmhhbmRsZXJzW2V2ZW50XSAmJiB0aGlzLmhhbmRsZXJzW2V2ZW50XS5zbGljZSgpO1xyXG4gICAgICAgIGlmICghaGFuZGxlcnMgfHwgIWhhbmRsZXJzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBkYXRhLnR5cGUgPSBldmVudDtcclxuICAgICAgICBkYXRhLnByZXZlbnREZWZhdWx0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGRhdGEuc3JjRXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB2YXIgaSA9IDA7XHJcbiAgICAgICAgd2hpbGUgKGkgPCBoYW5kbGVycy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgaGFuZGxlcnNbaV0oZGF0YSk7XHJcbiAgICAgICAgICAgIGkrKztcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogZGVzdHJveSB0aGUgbWFuYWdlciBhbmQgdW5iaW5kcyBhbGwgZXZlbnRzXHJcbiAgICAgKiBpdCBkb2Vzbid0IHVuYmluZCBkb20gZXZlbnRzLCB0aGF0IGlzIHRoZSB1c2VyIG93biByZXNwb25zaWJpbGl0eVxyXG4gICAgICovXHJcbiAgICBkZXN0cm95OiBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgJiYgdG9nZ2xlQ3NzUHJvcHModGhpcywgZmFsc2UpO1xyXG5cclxuICAgICAgICB0aGlzLmhhbmRsZXJzID0ge307XHJcbiAgICAgICAgdGhpcy5zZXNzaW9uID0ge307XHJcbiAgICAgICAgdGhpcy5pbnB1dC5kZXN0cm95KCk7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gbnVsbDtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBhZGQvcmVtb3ZlIHRoZSBjc3MgcHJvcGVydGllcyBhcyBkZWZpbmVkIGluIG1hbmFnZXIub3B0aW9ucy5jc3NQcm9wc1xyXG4gKiBAcGFyYW0ge01hbmFnZXJ9IG1hbmFnZXJcclxuICogQHBhcmFtIHtCb29sZWFufSBhZGRcclxuICovXHJcbmZ1bmN0aW9uIHRvZ2dsZUNzc1Byb3BzKG1hbmFnZXIsIGFkZCkge1xyXG4gICAgdmFyIGVsZW1lbnQgPSBtYW5hZ2VyLmVsZW1lbnQ7XHJcbiAgICBlYWNoKG1hbmFnZXIub3B0aW9ucy5jc3NQcm9wcywgZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcclxuICAgICAgICBlbGVtZW50LnN0eWxlW3ByZWZpeGVkKGVsZW1lbnQuc3R5bGUsIG5hbWUpXSA9IGFkZCA/IHZhbHVlIDogJyc7XHJcbiAgICB9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHRyaWdnZXIgZG9tIGV2ZW50XHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcGFyYW0ge09iamVjdH0gZGF0YVxyXG4gKi9cclxuZnVuY3Rpb24gdHJpZ2dlckRvbUV2ZW50KGV2ZW50LCBkYXRhKSB7XHJcbiAgICB2YXIgZ2VzdHVyZUV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0V2ZW50Jyk7XHJcbiAgICBnZXN0dXJlRXZlbnQuaW5pdEV2ZW50KGV2ZW50LCB0cnVlLCB0cnVlKTtcclxuICAgIGdlc3R1cmVFdmVudC5nZXN0dXJlID0gZGF0YTtcclxuICAgIGRhdGEudGFyZ2V0LmRpc3BhdGNoRXZlbnQoZ2VzdHVyZUV2ZW50KTtcclxufVxyXG5cclxuZXh0ZW5kKEhhbW1lciwge1xyXG4gICAgSU5QVVRfU1RBUlQ6IElOUFVUX1NUQVJULFxyXG4gICAgSU5QVVRfTU9WRTogSU5QVVRfTU9WRSxcclxuICAgIElOUFVUX0VORDogSU5QVVRfRU5ELFxyXG4gICAgSU5QVVRfQ0FOQ0VMOiBJTlBVVF9DQU5DRUwsXHJcblxyXG4gICAgU1RBVEVfUE9TU0lCTEU6IFNUQVRFX1BPU1NJQkxFLFxyXG4gICAgU1RBVEVfQkVHQU46IFNUQVRFX0JFR0FOLFxyXG4gICAgU1RBVEVfQ0hBTkdFRDogU1RBVEVfQ0hBTkdFRCxcclxuICAgIFNUQVRFX0VOREVEOiBTVEFURV9FTkRFRCxcclxuICAgIFNUQVRFX1JFQ09HTklaRUQ6IFNUQVRFX1JFQ09HTklaRUQsXHJcbiAgICBTVEFURV9DQU5DRUxMRUQ6IFNUQVRFX0NBTkNFTExFRCxcclxuICAgIFNUQVRFX0ZBSUxFRDogU1RBVEVfRkFJTEVELFxyXG5cclxuICAgIERJUkVDVElPTl9OT05FOiBESVJFQ1RJT05fTk9ORSxcclxuICAgIERJUkVDVElPTl9MRUZUOiBESVJFQ1RJT05fTEVGVCxcclxuICAgIERJUkVDVElPTl9SSUdIVDogRElSRUNUSU9OX1JJR0hULFxyXG4gICAgRElSRUNUSU9OX1VQOiBESVJFQ1RJT05fVVAsXHJcbiAgICBESVJFQ1RJT05fRE9XTjogRElSRUNUSU9OX0RPV04sXHJcbiAgICBESVJFQ1RJT05fSE9SSVpPTlRBTDogRElSRUNUSU9OX0hPUklaT05UQUwsXHJcbiAgICBESVJFQ1RJT05fVkVSVElDQUw6IERJUkVDVElPTl9WRVJUSUNBTCxcclxuICAgIERJUkVDVElPTl9BTEw6IERJUkVDVElPTl9BTEwsXHJcblxyXG4gICAgTWFuYWdlcjogTWFuYWdlcixcclxuICAgIElucHV0OiBJbnB1dCxcclxuICAgIFRvdWNoQWN0aW9uOiBUb3VjaEFjdGlvbixcclxuXHJcbiAgICBUb3VjaElucHV0OiBUb3VjaElucHV0LFxyXG4gICAgTW91c2VJbnB1dDogTW91c2VJbnB1dCxcclxuICAgIFBvaW50ZXJFdmVudElucHV0OiBQb2ludGVyRXZlbnRJbnB1dCxcclxuICAgIFRvdWNoTW91c2VJbnB1dDogVG91Y2hNb3VzZUlucHV0LFxyXG4gICAgU2luZ2xlVG91Y2hJbnB1dDogU2luZ2xlVG91Y2hJbnB1dCxcclxuXHJcbiAgICBSZWNvZ25pemVyOiBSZWNvZ25pemVyLFxyXG4gICAgQXR0clJlY29nbml6ZXI6IEF0dHJSZWNvZ25pemVyLFxyXG4gICAgVGFwOiBUYXBSZWNvZ25pemVyLFxyXG4gICAgUGFuOiBQYW5SZWNvZ25pemVyLFxyXG4gICAgU3dpcGU6IFN3aXBlUmVjb2duaXplcixcclxuICAgIFBpbmNoOiBQaW5jaFJlY29nbml6ZXIsXHJcbiAgICBSb3RhdGU6IFJvdGF0ZVJlY29nbml6ZXIsXHJcbiAgICBQcmVzczogUHJlc3NSZWNvZ25pemVyLFxyXG5cclxuICAgIG9uOiBhZGRFdmVudExpc3RlbmVycyxcclxuICAgIG9mZjogcmVtb3ZlRXZlbnRMaXN0ZW5lcnMsXHJcbiAgICBlYWNoOiBlYWNoLFxyXG4gICAgbWVyZ2U6IG1lcmdlLFxyXG4gICAgZXh0ZW5kOiBleHRlbmQsXHJcbiAgICBpbmhlcml0OiBpbmhlcml0LFxyXG4gICAgYmluZEZuOiBiaW5kRm4sXHJcbiAgICBwcmVmaXhlZDogcHJlZml4ZWRcclxufSk7XHJcblxyXG5pZiAodHlwZW9mIGRlZmluZSA9PSBUWVBFX0ZVTkNUSU9OICYmIGRlZmluZS5hbWQpIHtcclxuICAgIGRlZmluZShmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gSGFtbWVyO1xyXG4gICAgfSk7XHJcbn0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBIYW1tZXI7XHJcbn0gZWxzZSB7XHJcbiAgICB3aW5kb3dbZXhwb3J0TmFtZV0gPSBIYW1tZXI7XHJcbn1cclxuXHJcbn0pKHdpbmRvdywgZG9jdW1lbnQsICdIYW1tZXInKTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBUb09iamVjdCh2YWwpIHtcblx0aWYgKHZhbCA9PSBudWxsKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignT2JqZWN0LmFzc2lnbiBjYW5ub3QgYmUgY2FsbGVkIHdpdGggbnVsbCBvciB1bmRlZmluZWQnKTtcblx0fVxuXG5cdHJldHVybiBPYmplY3QodmFsKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uICh0YXJnZXQsIHNvdXJjZSkge1xuXHR2YXIgcGVuZGluZ0V4Y2VwdGlvbjtcblx0dmFyIGZyb207XG5cdHZhciBrZXlzO1xuXHR2YXIgdG8gPSBUb09iamVjdCh0YXJnZXQpO1xuXG5cdGZvciAodmFyIHMgPSAxOyBzIDwgYXJndW1lbnRzLmxlbmd0aDsgcysrKSB7XG5cdFx0ZnJvbSA9IGFyZ3VtZW50c1tzXTtcblx0XHRrZXlzID0gT2JqZWN0LmtleXMoT2JqZWN0KGZyb20pKTtcblxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dG9ba2V5c1tpXV0gPSBmcm9tW2tleXNbaV1dO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGlmIChwZW5kaW5nRXhjZXB0aW9uID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRwZW5kaW5nRXhjZXB0aW9uID0gZXJyO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKHBlbmRpbmdFeGNlcHRpb24pIHtcblx0XHR0aHJvdyBwZW5kaW5nRXhjZXB0aW9uO1xuXHR9XG5cblx0cmV0dXJuIHRvO1xufTtcbiIsInZhciBDYW52YXNWaWV3ID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL0NhbnZhc1ZpZXcuanMnKTtcbnZhciBGaXJlYmFzZVV0aWxzID0gcmVxdWlyZSgnLi91dGlscy9GaXJlYmFzZVV0aWxzJyk7XG5cbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgQ2FudmFzVmlldy5sb2FkKCk7XG4gIEZpcmViYXNlVXRpbHMuaW5pdCgpO1xufSIsIlwidXNlIHN0cmljdFwiO1xuXG4vL3JlcXVpcmUgTm90ZXNTdG9yZSwgTmF2aWF0aW9uU3RvcmUsIENhbnZhc0FwcERpc3BhdGNoZXJcbnZhciBDYW52YXNBcHBEaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vZGlzcGF0Y2hlci9DYW52YXNBcHBEaXNwYXRjaGVyJyk7XG52YXIgTm90ZXNTdG9yZSA9IHJlcXVpcmUoJy4uL3N0b3Jlcy9Ob3Rlc1N0b3JlJyk7XG52YXIgRHJhZ0VsZW1lbnRTdG9yZSA9IHJlcXVpcmUoJy4uL3N0b3Jlcy9EcmFnRWxlbWVudFN0b3JlJyk7XG52YXIgSGFtbWVyID0gcmVxdWlyZSgnaGFtbWVyanMnKTtcbnZhciBUcmFuc2Zvcm1TdG9yZSA9IHJlcXVpcmUoJy4uL3N0b3Jlcy9UcmFuc2Zvcm1TdG9yZScpO1xudmFyIF9nZXRSZWxhdGl2ZUxlZnRUb3AgPSByZXF1aXJlKCcuLi91dGlscy9HZXRSZWxhdGl2ZUxlZnRUb3AuanMnKTtcblxudmFyIF90cmFuc2Zvcm07XG52YXIgX25vdGVzO1xudmFyIF9ub3RlOyAgLy8gbW9zdCByZWNlbnRseSBhZGRlZCBvciB1cGRhdGVkIG5vdGVcblxuZnVuY3Rpb24gX3VwZGF0ZVN0YXRlRnJvbVN0b3JlcygpIHtcbiAgX3RyYW5zZm9ybSA9IFRyYW5zZm9ybVN0b3JlLmdldCgpO1xuICBfbm90ZXMgPSBOb3Rlc1N0b3JlLmdldEFsbCgpO1xufTtcblxudmFyIENhbnZhc1ZpZXcgPSB7XG4gICAgXG4gICAgY2FudmFzOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJyksXG5cbiAgICBjdHg6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW52YXMnKS5nZXRDb250ZXh0KCcyZCcpLFxuICAgIFxuICAgIGxvYWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5yZXNpemVDYW52YXMoKTtcbiAgICAgIHRoaXMuYWRkVG91Y2hFdmVudExpc3RlbmVycygpO1xuICAgICAgdGhpcy5hZGRDaGFuZ2VMaXN0ZW5lcnMoKTtcbiAgICAgIC8vIF9nZXRSZWxhdGl2ZUxlZnRUb3Auc2V0KENhbnZhc1ZpZXcuY2FudmFzKTtcbiAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgfSxcblxuICAgIGFkZFRvdWNoRXZlbnRMaXN0ZW5lcnM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5oYW1tZXIgPSBuZXcgSGFtbWVyLk1hbmFnZXIodGhpcy5jYW52YXMpO1xuICAgICAgdGhpcy5oYW1tZXIuYWRkKG5ldyBIYW1tZXIuVGFwKCkpO1xuICAgICAgdGhpcy5oYW1tZXIuYWRkKG5ldyBIYW1tZXIuUGFuKHt0aHJlc2hvbGQ6MH0pKTtcbiAgICAgIHRoaXMuaGFtbWVyLmFkZChuZXcgSGFtbWVyLlByZXNzKHtldmVudDogJ3ByZXNzT25lRmluZ2VyJywgcG9pbnRlcnM6IDEsIHRpbWU6MH0pKTtcbiAgICAgIHRoaXMuaGFtbWVyLmFkZChuZXcgSGFtbWVyLlByZXNzKHtldmVudDogJ3ByZXNzVHdvRmluZ2VycycsIHBvaW50ZXJzOiAyLCB0aW1lOjB9KSk7XG4gICAgICB0aGlzLmhhbW1lci5hZGQobmV3IEhhbW1lci5QaW5jaCgpKTtcbiAgICAgIHRoaXMuaGFtbWVyLm9uKCd0YXAgcHJlc3NPbmVGaW5nZXIgcHJlc3NUd29GaW5nZXJzIHBpbmNoIHBhbicsIGZ1bmN0aW9uKGhhbW1lckV2ZW50KSB7XG4gICAgICAgIENhbnZhc0FwcERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICAgICAgICAgIGFjdGlvblR5cGU6IGhhbW1lckV2ZW50LnR5cGUsXG4gICAgICAgICAgaGFtbWVyRXZlbnQ6IGhhbW1lckV2ZW50LFxuICAgICAgICAgIC8vIHV0aWxzOiB7X2dldFJlbGF0aXZlTGVmdFRvcDogX2dldFJlbGF0aXZlTGVmdFRvcC5iaW5kKENhbnZhc1ZpZXcuY2FudmFzKX1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V3aGVlbCcsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIENhbnZhc0FwcERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICAgICAgICAgIGFjdGlvblR5cGU6ICdtb3VzZXdoZWVsJyxcbiAgICAgICAgICBldmVudDogZXZlbnRcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgYWRkQ2hhbmdlTGlzdGVuZXJzOiBmdW5jdGlvbigpIHtcbiAgICAgIFxuICAgICAgTm90ZXNTdG9yZS5hZGRDaGFuZ2VMaXN0ZW5lcignYWRkZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgX3VwZGF0ZVN0YXRlRnJvbVN0b3JlcygpO1xuICAgICAgICBfbm90ZSA9IE5vdGVzU3RvcmUuZ2V0TW9zdFJlY2VudCgpOyAgXG4gICAgICAgIENhbnZhc1ZpZXcucmVuZGVyTm90ZSgpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIERyYWdFbGVtZW50U3RvcmUuYWRkQ2hhbmdlTGlzdGVuZXIoJ2RyYWdnZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgX25vdGUgPSBEcmFnRWxlbWVudFN0b3JlLmdldCgpOyAgXG4gICAgICAgIENhbnZhc1ZpZXcucmVuZGVyKCk7XG4gICAgICB9KTtcblxuICAgICAgVHJhbnNmb3JtU3RvcmUuYWRkQ2hhbmdlTGlzdGVuZXIoJ2NoYW5nZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgQ2FudmFzVmlldy5yZW5kZXIoKTtcbiAgICAgIH0pXG4gICAgfSxcblxuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICBfdXBkYXRlU3RhdGVGcm9tU3RvcmVzKCk7XG4gICAgICB0aGlzLmN0eC5jbGVhclJlY3QoMCwwLHRoaXMuY2FudmFzLndpZHRoLCB0aGlzLmNhbnZhcy5oZWlnaHQpO1xuICAgICAgdGhpcy5jdHgudHJhbnNsYXRlKF90cmFuc2Zvcm0udHJhbnNsYXRlWCAqIF90cmFuc2Zvcm0uc2NhbGUsIF90cmFuc2Zvcm0udHJhbnNsYXRlWSAqIF90cmFuc2Zvcm0uc2NhbGUpO1xuICAgICAgZm9yKHZhciBrZXkgaW4gX25vdGVzKSB7XG4gICAgICAgIENhbnZhc1ZpZXcucmVuZGVyTm90ZShfbm90ZXNba2V5XSk7XG4gICAgICB9XG4gICAgICB0aGlzLmN0eC50cmFuc2xhdGUoLV90cmFuc2Zvcm0udHJhbnNsYXRlWCAqIF90cmFuc2Zvcm0uc2NhbGUsIC1fdHJhbnNmb3JtLnRyYW5zbGF0ZVkgKiBfdHJhbnNmb3JtLnNjYWxlKTtcbiAgICB9LFxuXG4gICAgcmVuZGVyTm90ZTogZnVuY3Rpb24obm90ZSkge1xuICAgICAgbm90ZSA9IG5vdGUgfHwgX25vdGU7XG4gICAgICB2YXIgbGVmdCA9IG5vdGUuZGF0YS54ICogX3RyYW5zZm9ybS5zY2FsZTtcbiAgICAgIHZhciB0b3AgPSBub3RlLmRhdGEueSAqIF90cmFuc2Zvcm0uc2NhbGU7XG4gICAgICBDYW52YXNWaWV3LnJlbmRlclNoYXBlKG5vdGUsIGxlZnQsIHRvcCk7XG4gICAgICAvLyBDYW52YXNWaWV3LnJlbmRlclRleHQobm90ZSwgbGVmdCwgdG9wKTtcbiAgICB9LFxuXG4gICAgcmVuZGVyU2hhcGU6IGZ1bmN0aW9uKG5vdGUsIGxlZnQsIHRvcCkge1xuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3JnYmEoMjAwLDAsMCwwLjUpJztcbiAgICAgIHRoaXMuY3R4LmZpbGxSZWN0LmFwcGx5KHRoaXMuY3R4LCBbbGVmdCwgdG9wLCBub3RlLnN0eWxlLndpZHRoICogX3RyYW5zZm9ybS5zY2FsZSwgbm90ZS5zdHlsZS5oZWlnaHQgKiBfdHJhbnNmb3JtLnNjYWxlXSk7XG4gICAgfSxcblxuICAgIHJlbmRlclRleHQ6IGZ1bmN0aW9uKG5vdGUsIGxlZnQsIHRvcCkge1xuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gXCJibHVlXCI7XG4gICAgICB0aGlzLmN0eC5mb250ID0gMTIgKiBfdHJhbnNmb3JtLnNjYWxlICsgXCJweCBBcmlhbFwiO1xuICAgICAgZm9yKHZhciBpID0gMDsgaSA8IG5vdGUuZGF0YS50ZXh0QXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KFwiIFwiICsgbm90ZS5kYXRhLnRleHRBcnJbaV0sIGxlZnQsIHRvcCArICgxMiAqIChpICsgMikgLSA2KSAqIF90cmFuc2Zvcm0uc2NhbGUpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICByZXNpemVDYW52YXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jYW52YXMud2lkdGggID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG4gICAgfSxcblxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENhbnZhc1ZpZXc7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIERpc3BhdGNoZXIgPSByZXF1aXJlKCdmbHV4JykuRGlzcGF0Y2hlcjtcbnZhciBhc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbnZhciBDYW52YXNEaXNwYXRjaGVyID0gYXNzaWduKG5ldyBEaXNwYXRjaGVyKCksIHtcbiAgLy9BZGQgY3VzdG9tIGRpc3BhdGNoZXIgbWV0aG9kcyBoZXJlXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW52YXNEaXNwYXRjaGVyOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBOb3Rlc1N0b3JlID0gcmVxdWlyZSgnLi9Ob3Rlc1N0b3JlJyk7XG52YXIgVHJhbnNmb3JtID0gcmVxdWlyZSgnLi9UcmFuc2Zvcm1TdG9yZScpO1xudmFyIENhbnZhc0FwcERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi9kaXNwYXRjaGVyL0NhbnZhc0FwcERpc3BhdGNoZXInKTtcblxudmFyIF9kcmFnU3RhcnQ7XG5cbnZhciBfZ2V0UmVsYXRpdmVMZWZ0VG9wID0gZnVuY3Rpb24oKSB7fTtcblxuZnVuY3Rpb24gX3NldERyYWdTdGFydChoYW1tZXJFdmVudCkge1xuICBfZHJhZ1N0YXJ0ID0ge307XG4gIHZhciBsZWZ0VG9wID0ge2xlZnQ6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VYLCB0b3A6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfTtcbiAgdmFyIGdsb2JhbFBvaW50ID0gVHJhbnNmb3JtLndpbmRvd1RvR2xvYmFsUG9pbnQobGVmdFRvcCk7XG4gIHZhciBub3RlID0gTm90ZXNTdG9yZS5nZXROb3RlRnJvbVhZKGdsb2JhbFBvaW50LngsIGdsb2JhbFBvaW50LnkpO1xuICBpZiAobm90ZSkge1xuICAgIGNvbnNvbGUubG9nKCdfc2V0RHJhZ1N0YXJ0Jyk7XG4gICAgX2RyYWdTdGFydC5ub3RlID0gbm90ZTtcbiAgICBfZHJhZ1N0YXJ0LnRvdWNoTGVmdCA9IGxlZnRUb3AubGVmdDtcbiAgICBfZHJhZ1N0YXJ0LnRvdWNoVG9wID0gbGVmdFRvcC50b3A7XG4gICAgX2RyYWdTdGFydC5lbGVtZW50WCA9IG5vdGUuZGF0YS54O1xuICAgIF9kcmFnU3RhcnQuZWxlbWVudFkgPSBub3RlLmRhdGEueTtcbiAgfSBlbHNlIHtcbiAgICBfZHJhZ1N0YXJ0ID0gbnVsbDtcbiAgfVxufTtcblxuZnVuY3Rpb24gX2RyYWcoaGFtbWVyRXZlbnQpIHtcbiAgaWYgKCBfZHJhZ1N0YXJ0ICkge1xuICAgIHZhciBub3RlID0gX2RyYWdTdGFydC5ub3RlO1xuICAgIC8vIHZhciBsZWZ0VG9wID0gX2dldFJlbGF0aXZlTGVmdFRvcChoYW1tZXJFdmVudCk7XG4gICAgdmFyIGxlZnRUb3AgPSB7bGVmdDogaGFtbWVyRXZlbnQucG9pbnRlcnNbMF0ucGFnZVgsIHRvcDogaGFtbWVyRXZlbnQucG9pbnRlcnNbMF0ucGFnZVl9O1xuICAgIHZhciBkZWx0YVggPSAobGVmdFRvcC5sZWZ0IC0gX2RyYWdTdGFydC50b3VjaExlZnQpIC8gVHJhbnNmb3JtLmdldFNjYWxlKCk7XG4gICAgdmFyIGRlbHRhWSA9IChsZWZ0VG9wLnRvcCAtIF9kcmFnU3RhcnQudG91Y2hUb3ApIC8gVHJhbnNmb3JtLmdldFNjYWxlKCk7XG4gICAgbm90ZS5kYXRhLnggPSBfZHJhZ1N0YXJ0LmVsZW1lbnRYICsgZGVsdGFYO1xuICAgIG5vdGUuZGF0YS55ID0gX2RyYWdTdGFydC5lbGVtZW50WSArIGRlbHRhWTtcbiAgICBEcmFnRWxlbWVudFN0b3JlLmVtaXRDaGFuZ2UoJ2RyYWdnZWQnKTtcbiAgfVxufTtcblxudmFyIERyYWdFbGVtZW50U3RvcmUgPSBhc3NpZ24oe30sIEV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgXG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9kcmFnU3RhcnQubm90ZTtcbiAgfSxcblxuICBlbWl0Q2hhbmdlOiBmdW5jdGlvbihjaGFuZ2VFdmVudCkge1xuICAgIHRoaXMuZW1pdChjaGFuZ2VFdmVudCk7XG4gIH0sXG5cbiAgYWRkQ2hhbmdlTGlzdGVuZXI6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50LCBjYWxsYmFjaykge1xuICAgIHRoaXMub24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKTtcbiAgfSxcblxufSk7XG5cbkRyYWdFbGVtZW50U3RvcmUuZGlzcGF0Y2hUb2tlbiA9IENhbnZhc0FwcERpc3BhdGNoZXIucmVnaXN0ZXIoZnVuY3Rpb24ocGF5bG9hZCkgeyAgXG4gIHN3aXRjaCAocGF5bG9hZC5hY3Rpb25UeXBlKSB7XG4gIFxuICAgIGNhc2UgJ3ByZXNzT25lRmluZ2VyJzpcbiAgICAgIC8vIF9nZXRSZWxhdGl2ZUxlZnRUb3AgPSBwYXlsb2FkLnV0aWxzLl9nZXRSZWxhdGl2ZUxlZnRUb3A7XG4gICAgICBfc2V0RHJhZ1N0YXJ0KHBheWxvYWQuaGFtbWVyRXZlbnQpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdwYW4nOlxuICAgICAgX2RyYWcocGF5bG9hZC5oYW1tZXJFdmVudCk7XG4gICAgICBicmVhaztcbiAgICBcbiAgICBkZWZhdWx0OiAvLyBpbnRlbnRpb25hbGx5IGxlZnQgYmxhbmtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRHJhZ0VsZW1lbnRTdG9yZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgQ2FudmFzQXBwRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL2Rpc3BhdGNoZXIvQ2FudmFzQXBwRGlzcGF0Y2hlcicpO1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBhc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG4vLyB2YXIgVHJhbnNmb3JtID0gcmVxdWlyZSgnLi9UcmFuc2Zvcm1TdG9yZScpO1xuXG4vLyB2YXIgX2dldFJlbGF0aXZlTGVmdFRvcDtcbi8vIHZhciBDSEFOR0VfRVZFTlRTID0gWydhZGRlZCcsICdkcmFnZ2VkJ107XG5cbnZhciBfbm90ZXMgPSB7fTtcbnZhciBfbm90ZSA9IHt9OyAgLy8gbW9zdCByZWNlbnQgbm90ZSBhZGRlZCBvciB1cGRhdGVkXG4vLyB2YXIgX2RyYWdTdGFydDtcblxuZnVuY3Rpb24gX2FkZE5vdGUobm90ZSkge1xuICB2YXIga2V5ID0gT2JqZWN0LmtleXMobm90ZSlbMF07XG4gIF9ub3Rlc1trZXldID0gbm90ZVtrZXldO1xuICBfc2V0TW9zdFJlY2VudE5vdGUobm90ZSwga2V5KTtcbiAgTm90ZXNTdG9yZS5lbWl0Q2hhbmdlKCdhZGRlZCcpO1xuXG59XG5cbmZ1bmN0aW9uIF9zZXRNb3N0UmVjZW50Tm90ZShub3RlLCBrZXkpIHtcbiAgdmFyIGtleU9sZCA9IE9iamVjdC5rZXlzKF9ub3RlKVswXTtcbiAgZGVsZXRlIF9ub3RlW2tleU9sZF07XG4gIGFzc2lnbihfbm90ZSwgbm90ZVtrZXldKTtcbn07XG5cbi8vIGZ1bmN0aW9uIF9zZXREcmFnU3RhcnQoaGFtbWVyRXZlbnQpIHtcbi8vICAgY29uc29sZS5sb2coJ19zZXREcmFnU3RhcnQnKTtcbi8vICAgX2RyYWdTdGFydCA9IHt9O1xuLy8gICB2YXIgbGVmdFRvcCA9IF9nZXRSZWxhdGl2ZUxlZnRUb3AoaGFtbWVyRXZlbnQpO1xuLy8gICB2YXIgWFk7XG4vLyAgIHZhciBub3RlID0gX2dldE5vdGVGcm9tWFkobGVmdFRvcC5sZWZ0LCBsZWZ0VG9wLnRvcCk7XG4vLyAgIGlmIChub3RlKSB7XG4vLyAgICAgX2RyYWdTdGFydC5ub3RlID0gbm90ZTtcbi8vICAgICBfZHJhZ1N0YXJ0LnRvdWNoTGVmdCA9IGxlZnRUb3AubGVmdDtcbi8vICAgICBfZHJhZ1N0YXJ0LnRvdWNoVG9wID0gbGVmdFRvcC50b3A7XG4vLyAgICAgX2RyYWdTdGFydC5lbGVtZW50WCA9IG5vdGUuZGF0YS54O1xuLy8gICAgIF9kcmFnU3RhcnQuZWxlbWVudFkgPSBub3RlLmRhdGEueTtcbi8vICAgfSBlbHNlIHtcbi8vICAgICBfZHJhZ1N0YXJ0ID0gbnVsbDtcbi8vICAgfVxuLy8gfTtcblxuLy8gZnVuY3Rpb24gX2RyYWcoaGFtbWVyRXZlbnQpIHtcbi8vICAgaWYgKCBfZHJhZ1N0YXJ0ICkge1xuLy8gICAgIHZhciBub3RlID0gX2RyYWdTdGFydC5ub3RlO1xuLy8gICAgIHZhciBsZWZ0VG9wID0gX2dldFJlbGF0aXZlTGVmdFRvcChoYW1tZXJFdmVudCk7XG4vLyAgICAgdmFyIGRlbHRhWCA9IChsZWZ0VG9wLmxlZnQgLSBfZHJhZ1N0YXJ0LnRvdWNoTGVmdCkgLyBUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbi8vICAgICB2YXIgZGVsdGFZID0gKGxlZnRUb3AudG9wIC0gX2RyYWdTdGFydC50b3VjaFRvcCkgLyBUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbi8vICAgICBub3RlLmRhdGEueCA9IF9kcmFnU3RhcnQuZWxlbWVudFggKyBkZWx0YVg7XG4vLyAgICAgbm90ZS5kYXRhLnkgPSBfZHJhZ1N0YXJ0LmVsZW1lbnRZICsgZGVsdGFZO1xuLy8gICAgIE5vdGVzU3RvcmUuZW1pdENoYW5nZSgnZHJhZ2dlZCcpO1xuLy8gICB9XG4vLyB9XG5cbiAgLy8gQ2FudmFzRGVtby5wcm90b3R5cGUud2luZG93VG9HbG9iYWxQb2ludCA9IGZ1bmN0aW9uKHdpbmRvd1BvaW50KSB7XG4gIC8vICAgcmV0dXJuIHtcbiAgLy8gICAgIHg6IHdpbmRvd3ggLyB0aGlzLnRyYW5zZm9ybS5zY2FsZSAtIHRoaXMudHJhbnNmb3JtLnRyYW5zbGF0ZVgsXG4gIC8vICAgICB5OiB3aW5kb3dQb2ludC55IC8gdGhpcy50cmFuc2Zvcm0uc2NhbGUgLSB0aGlzLnRyYW5zZm9ybS50cmFuc2xhdGVZXG4gIC8vICAgfTtcbiAgLy8gfTtcblxuLy8gZnVuY3Rpb24gX2dldE5vdGVGcm9tWFkoeCwgeSkge1xuLy8gICB2YXIgbm90ZTtcbi8vICAgZm9yKHZhciBrZXkgaW4gX25vdGVzKSB7XG4vLyAgICAgbm90ZSA9IF9ub3Rlc1trZXldO1xuLy8gICAgIGlmICggXG4vLyAgICAgICBub3RlLmRhdGEueCA8PSB4ICYmIFxuLy8gICAgICAgeCA8PSBub3RlLmRhdGEueCArIG5vdGUuc3R5bGUud2lkdGggJiYgXG4vLyAgICAgICBub3RlLmRhdGEueSA8PSB5ICYmIFxuLy8gICAgICAgeSA8PSBub3RlLmRhdGEueSArIG5vdGUuc3R5bGUuaGVpZ2h0IFxuLy8gICAgICkge1xuLy8gICAgICAgcmV0dXJuIG5vdGU7XG4vLyAgICAgfVxuLy8gICB9XG4vLyAgIHJldHVybiBudWxsO1xuLy8gfTtcblxudmFyIE5vdGVzU3RvcmUgPSBhc3NpZ24oe30sIEV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgXG4gIGVtaXRDaGFuZ2U6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50KSB7XG4gICAgdGhpcy5lbWl0KGNoYW5nZUV2ZW50KTtcbiAgfSxcblxuICBhZGRDaGFuZ2VMaXN0ZW5lcjogZnVuY3Rpb24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbihjaGFuZ2VFdmVudCwgY2FsbGJhY2spO1xuICB9LFxuXG4gIGdldEFsbDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF9ub3RlcztcbiAgfSxcblxuICBnZXRNb3N0UmVjZW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gX25vdGU7XG4gIH0sXG5cbiAgZ2V0Tm90ZUZyb21YWTogZnVuY3Rpb24oeCwgeSkge1xuICAgIHZhciBub3RlO1xuICAgIGZvcih2YXIga2V5IGluIF9ub3Rlcykge1xuICAgICAgbm90ZSA9IF9ub3Rlc1trZXldO1xuICAgICAgaWYgKCBcbiAgICAgICAgbm90ZS5kYXRhLnggPD0geCAmJiBcbiAgICAgICAgeCA8PSBub3RlLmRhdGEueCArIG5vdGUuc3R5bGUud2lkdGggJiYgXG4gICAgICAgIG5vdGUuZGF0YS55IDw9IHkgJiYgXG4gICAgICAgIHkgPD0gbm90ZS5kYXRhLnkgKyBub3RlLnN0eWxlLmhlaWdodCBcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gbm90ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbn0pO1xuXG5Ob3Rlc1N0b3JlLmRpc3BhdGNoVG9rZW4gPSBDYW52YXNBcHBEaXNwYXRjaGVyLnJlZ2lzdGVyKGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgXG4gIHN3aXRjaCAocGF5bG9hZC5hY3Rpb25UeXBlKSB7XG4gICAgXG4gICAgY2FzZSBcIm5vdGVfYWRkZWRcIjpcbiAgICAgIF9hZGROb3RlKHBheWxvYWQubm90ZSk7XG4gICAgICBicmVhaztcblxuICAgIC8vIGNhc2UgJ3ByZXNzJzpcbiAgICAvLyAgIF9nZXRSZWxhdGl2ZUxlZnRUb3AgPSBwYXlsb2FkLnV0aWxzLl9nZXRSZWxhdGl2ZUxlZnRUb3A7XG4gICAgLy8gICBfc2V0RHJhZ1N0YXJ0KHBheWxvYWQuaGFtbWVyRXZlbnQpO1xuXG4gICAgLy8gY2FzZSAncGFuJzpcbiAgICAvLyAgIF9kcmFnKHBheWxvYWQuaGFtbWVyRXZlbnQpO1xuXG4gICAgZGVmYXVsdDogIC8vIGRvIG5vdGhpbmdcbiAgfVxuXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBOb3Rlc1N0b3JlOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgQ2FudmFzQXBwRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL2Rpc3BhdGNoZXIvQ2FudmFzQXBwRGlzcGF0Y2hlcicpO1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBfYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xudmFyIF9nZXRSZWxhdGl2ZUxlZnRUb3AgPSByZXF1aXJlKCcuLi91dGlscy9HZXRSZWxhdGl2ZUxlZnRUb3AuanMnKTtcbnZhciBOb3Rlc1N0b3JlID0gcmVxdWlyZSgnLi9Ob3Rlc1N0b3JlJyk7XG5cbnZhciBDSEFOR0VfRVZFTlQgPSAnY2hhbmdlJztcblxudmFyIF90cmFuc2xhdGVTdGFydERhdGE7XG5cbnZhciBfcGluY2hTdGFydCA9IHt9O1xuXG52YXIgX3RyYW5zZm9ybSA9IHtcbiAgdHJhbnNsYXRlWDogMCxcbiAgdHJhbnNsYXRlWTogMCxcbiAgc2NhbGU6IDFcbn07XG5cbmZ1bmN0aW9uIF90cmFuc2xhdGVTdGFydChoYW1tZXJFdmVudCkge1xuICBfdHJhbnNsYXRlU3RhcnREYXRhID0ge307XG4gIHZhciBsZWZ0VG9wID0ge2xlZnQ6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VYLCB0b3A6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfTtcbiAgdmFyIGdsb2JhbFBvaW50ID0gVHJhbnNmb3JtLndpbmRvd1RvR2xvYmFsUG9pbnQobGVmdFRvcCk7XG4gIHZhciBub3RlID0gTm90ZXNTdG9yZS5nZXROb3RlRnJvbVhZKGdsb2JhbFBvaW50LngsIGdsb2JhbFBvaW50LnkpO1xuICBpZiAoICFub3RlKSB7XG4gICAgY29uc29sZS5sb2coJ190cmFuc2xhdGVTdGFydCcpO1xuICAgIF90cmFuc2xhdGVTdGFydERhdGEubGVmdCA9IGxlZnRUb3AubGVmdDtcbiAgICBfdHJhbnNsYXRlU3RhcnREYXRhLnRvcCA9IGxlZnRUb3AudG9wO1xuICAgIF90cmFuc2xhdGVTdGFydERhdGEudHJhbnNsYXRlWCA9IF90cmFuc2Zvcm0udHJhbnNsYXRlWDtcbiAgICBfdHJhbnNsYXRlU3RhcnREYXRhLnRyYW5zbGF0ZVkgPSBfdHJhbnNmb3JtLnRyYW5zbGF0ZVk7XG4gIH0gZWxzZSB7XG4gICAgX3RyYW5zbGF0ZVN0YXJ0RGF0YSA9IG51bGw7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIF90cmFuc2xhdGUoaGFtbWVyRXZlbnQpIHtcbiAgaWYgKCBfdHJhbnNsYXRlU3RhcnREYXRhICkge1xuICAgIHZhciBsZWZ0VG9wID0ge2xlZnQ6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VYLCB0b3A6IGhhbW1lckV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfTtcbiAgICBfdHJhbnNmb3JtLnRyYW5zbGF0ZVggPSBfdHJhbnNsYXRlU3RhcnREYXRhLnRyYW5zbGF0ZVggKyAobGVmdFRvcC5sZWZ0IC0gX3RyYW5zbGF0ZVN0YXJ0RGF0YS5sZWZ0KSAvIF90cmFuc2Zvcm0uc2NhbGU7XG4gICAgX3RyYW5zZm9ybS50cmFuc2xhdGVZID0gX3RyYW5zbGF0ZVN0YXJ0RGF0YS50cmFuc2xhdGVZICsgKGxlZnRUb3AudG9wIC0gX3RyYW5zbGF0ZVN0YXJ0RGF0YS50b3ApIC8gX3RyYW5zZm9ybS5zY2FsZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gX3pvb21TdGFydChoYW1tZXJFdmVudCkge1xuICBfdHJhbnNsYXRlU3RhcnREYXRhID0ge31cbiAgX3BpbmNoU3RhcnQgPSB7fTtcbiAgX3BpbmNoU3RhcnQuZGlzdCA9IF9kaXN0SGFtbWVyUGluY2hFdmVudChoYW1tZXJFdmVudCk7XG4gIF9waW5jaFN0YXJ0LmNlbnRlciA9IGhhbW1lckV2ZW50LmNlbnRlcjtcbiAgX3BpbmNoU3RhcnQudHJhbnNsYXRlWCA9IF90cmFuc2Zvcm0udHJhbnNsYXRlWDtcbiAgX3BpbmNoU3RhcnQudHJhbnNsYXRlWSA9IF90cmFuc2Zvcm0udHJhbnNsYXRlWTtcbiAgX3BpbmNoU3RhcnQuc2NhbGUgPSBfdHJhbnNmb3JtLnNjYWxlO1xuICBjb25zb2xlLmxvZyhfcGluY2hTdGFydCk7XG59O1xuXG5mdW5jdGlvbiBfbW91c2V3aGVlbFN0YXJ0KGV2ZW50KSB7XG4gIF9waW5jaFN0YXJ0LnRyYW5zbGF0ZVggPSBfdHJhbnNmb3JtLnRyYW5zbGF0ZVg7XG4gIF9waW5jaFN0YXJ0LnRyYW5zbGF0ZVkgPSBfdHJhbnNmb3JtLnRyYW5zbGF0ZVk7XG4gIF9waW5jaFN0YXJ0LnNjYWxlID0gX3RyYW5zZm9ybS5zY2FsZTtcbiAgX3BpbmNoU3RhcnQuY2VudGVyID0ge3g6IGV2ZW50LnBhZ2VYLCB5OiBldmVudC5wYWdlWX07XG59XG5cbmZ1bmN0aW9uIF96b29tKGhhbW1lckV2ZW50LCBldmVudE5hbWUpIHtcbiAgaWYoaGFtbWVyRXZlbnQudHlwZSA9PT0gJ21vdXNld2hlZWwnKSB7XG4gICAgX21vdXNld2hlZWxTdGFydChoYW1tZXJFdmVudCk7XG4gICAgX3RyYW5zZm9ybS5zY2FsZSA9IChoYW1tZXJFdmVudC53aGVlbERlbHRhWSA8IDApID8gX3RyYW5zZm9ybS5zY2FsZSAqIDEuMSA6IF90cmFuc2Zvcm0uc2NhbGUgKiAwLjkwO1xuICB9IGVsc2Uge1xuICAgIHZhciBuZXdQaW5jaERpc3QgPSBfZGlzdEhhbW1lclBpbmNoRXZlbnQoaGFtbWVyRXZlbnQpO1xuICAgIHZhciBuZXdTY2FsZSA9IF9waW5jaFN0YXJ0LnNjYWxlICogbmV3UGluY2hEaXN0IC8gX3BpbmNoU3RhcnQuZGlzdDtcbiAgICBfdHJhbnNmb3JtLnNjYWxlID0gbmV3U2NhbGU7XG4gIH1cbiAgX3RyYW5zZm9ybS50cmFuc2xhdGVYID0gX3BpbmNoU3RhcnQudHJhbnNsYXRlWCAtIF9nZXRUcmFuc2xhdGVEZWx0YShfcGluY2hTdGFydC5jZW50ZXIueCwgX3BpbmNoU3RhcnQuc2NhbGUsIF90cmFuc2Zvcm0uc2NhbGUpO1xuICBfdHJhbnNmb3JtLnRyYW5zbGF0ZVkgPSBfcGluY2hTdGFydC50cmFuc2xhdGVZIC0gX2dldFRyYW5zbGF0ZURlbHRhKF9waW5jaFN0YXJ0LmNlbnRlci55LCBfcGluY2hTdGFydC5zY2FsZSwgX3RyYW5zZm9ybS5zY2FsZSk7XG59O1xuXG5mdW5jdGlvbiBfZ2V0VHJhbnNsYXRlRGVsdGEoeCwgc2NhbGVQcmV2LCBzY2FsZU5ldykge1xuICB2YXIgdHJhbnNsYXRlRGVsdGEgPSAoeCAvIHNjYWxlUHJldiAqIHNjYWxlTmV3IC0geCkgLyBzY2FsZU5ldztcbiAgcmV0dXJuIHRyYW5zbGF0ZURlbHRhO1xufTtcblxuZnVuY3Rpb24gX2Rpc3RIYW1tZXJQaW5jaEV2ZW50IChoYW1tZXJQaW5jaEV2ZW50KSB7XG4gIHJldHVybiBfZGlzdChcbiAgICB7eDogaGFtbWVyUGluY2hFdmVudC5wb2ludGVyc1swXS5wYWdlWCwgeTpoYW1tZXJQaW5jaEV2ZW50LnBvaW50ZXJzWzBdLnBhZ2VZfSxcbiAgICB7eDogaGFtbWVyUGluY2hFdmVudC5wb2ludGVyc1sxXS5wYWdlWCwgeTpoYW1tZXJQaW5jaEV2ZW50LnBvaW50ZXJzWzFdLnBhZ2VZfVxuICApO1xufTtcblxuZnVuY3Rpb24gX2Rpc3QoYSwgYikge1xuICByZXR1cm4gTWF0aC5zcXJ0KCBNYXRoLnBvdyhhLnggLSBiLngsIDIpICsgTWF0aC5wb3coYS55IC0gYi55LCAyKSApO1xufTtcblxudmFyIFRyYW5zZm9ybSA9IF9hc3NpZ24oe30sIEV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgXG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF90cmFuc2Zvcm07XG4gIH0sXG5cbiAgZ2V0U2NhbGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfdHJhbnNmb3JtLnNjYWxlO1xuICB9LFxuXG4gIGVtaXRDaGFuZ2U6IGZ1bmN0aW9uKGNoYW5nZUV2ZW50TmFtZSkge1xuICAgIHRoaXMuZW1pdChjaGFuZ2VFdmVudE5hbWUgfHwgJ2NoYW5nZWQnKTtcbiAgfSxcblxuICBhZGRDaGFuZ2VMaXN0ZW5lcjogZnVuY3Rpb24oY2hhbmdlRXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5vbihjaGFuZ2VFdmVudCwgY2FsbGJhY2spO1xuICB9LFxuXG4gIHdpbmRvd1RvR2xvYmFsUG9pbnQ6IGZ1bmN0aW9uKHdpbmRvd1BvaW50KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHdpbmRvd1BvaW50LmxlZnQgLyBfdHJhbnNmb3JtLnNjYWxlIC0gX3RyYW5zZm9ybS50cmFuc2xhdGVYLFxuICAgICAgeTogd2luZG93UG9pbnQudG9wIC8gX3RyYW5zZm9ybS5zY2FsZSAtIF90cmFuc2Zvcm0udHJhbnNsYXRlWVxuICAgIH07XG4gIH0sXG5cbn0pO1xuXG5UcmFuc2Zvcm0uZGlzcGF0Y2hUb2tlbiA9IENhbnZhc0FwcERpc3BhdGNoZXIucmVnaXN0ZXIoZnVuY3Rpb24ocGF5bG9hZCkge1xuICBzd2l0Y2gocGF5bG9hZC5hY3Rpb25UeXBlKSB7XG4gICAgXG4gICAgY2FzZSAncHJlc3NPbmVGaW5nZXInOlxuICAgICAgLy8gX2dldFJlbGF0aXZlTGVmdFRvcCA9IHBheWxvYWQudXRpbHMuX2dldFJlbGF0aXZlTGVmdFRvcDtcbiAgICAgIF90cmFuc2xhdGVTdGFydChwYXlsb2FkLmhhbW1lckV2ZW50KTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAncGFuJzpcbiAgICAgIF90cmFuc2xhdGUocGF5bG9hZC5oYW1tZXJFdmVudCk7XG4gICAgICBUcmFuc2Zvcm0uZW1pdENoYW5nZSgnY2hhbmdlZCcpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdwcmVzc1R3b0ZpbmdlcnMnOlxuICAgICAgX3pvb21TdGFydChwYXlsb2FkLmhhbW1lckV2ZW50KTtcbiAgICAgIGJyZWFrO1xuICAgIFxuICAgIGNhc2UgJ3BpbmNoJzpcbiAgICAgIF96b29tKHBheWxvYWQuaGFtbWVyRXZlbnQpXG4gICAgICBUcmFuc2Zvcm0uZW1pdENoYW5nZSgnY2hhbmdlZCcpXG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ21vdXNld2hlZWwnOlxuICAgICAgX3pvb20ocGF5bG9hZC5ldmVudCwgJ21vdXNld2hlZWwnKTtcbiAgICAgIFRyYW5zZm9ybS5lbWl0Q2hhbmdlKCdjaGFuZ2VkJylcbiAgICBkZWZhdWx0OlxuICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFRyYW5zZm9ybTsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIENhbnZhc0FwcERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi9kaXNwYXRjaGVyL0NhbnZhc0FwcERpc3BhdGNoZXInKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubG9hZEV4YW1wbGUoKTtcbiAgfSxcblxuICBsb2FkRXhhbXBsZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRlc3ROb3RlID0ge1xuICAgICAgXCJkYXRhXCIgOiB7XG4gICAgICAgIFwidGV4dFwiIDogXCIjbXlIYXNodGFnMFwiLFxuICAgICAgICBcInlcIiA6IDEwLFxuICAgICAgICBcInhcIiA6IDEwLFxuICAgICAgICBcImhhc2h0YWdzXCIgOiBbIFwiI215SGFzaHRhZzBcIiBdXG4gICAgICB9LFxuICAgICAgXCJzdHlsZVwiIDoge1xuICAgICAgICBcInRvcFwiIDogMjI5Ljg2MzY4MzY4OTMzMDk3LFxuICAgICAgICBcImhlaWdodFwiIDogNTAsXG4gICAgICAgIFwibGVmdFwiIDogMTAxLjc1MTc4OTg0MzcwMzI5LFxuICAgICAgICBcIndpZHRoXCIgOiAxOTIsXG4gICAgICAgIFwiZm9udC1zaXplXCIgOiBcIjEwcHRcIlxuICAgICAgfVxuICAgIH07XG4gICAgdGVzdE5vdGUuZGF0YS50ZXh0QXJyID0gdGVzdE5vdGUuZGF0YS50ZXh0LnNwbGl0KFwiXFxuXCIpO1xuICAgIENhbnZhc0FwcERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICAgICAgYWN0aW9uVHlwZTogJ25vdGVfYWRkZWQnLFxuICAgICAgbm90ZToge3Rlc3ROb3RlS2V5OiB0ZXN0Tm90ZX1cbiAgICB9KTtcblxuICAgIHZhciB0ZXN0Tm90ZTIgPSB7XG4gICAgICBcImRhdGFcIiA6IHtcbiAgICAgICAgXCJ0ZXh0XCIgOiBcIiNteUhhc2h0YWcxXCIsXG4gICAgICAgIFwieVwiIDogMjUwLFxuICAgICAgICBcInhcIiA6IDI1MCxcbiAgICAgICAgXCJoYXNodGFnc1wiIDogWyBcIiNteUhhc2h0YWcxXCIgXVxuICAgICAgfSxcbiAgICAgIFwic3R5bGVcIiA6IHtcbiAgICAgICAgXCJ0b3BcIiA6IDIyOS44NjM2ODM2ODkzMzA5NyxcbiAgICAgICAgXCJoZWlnaHRcIiA6IDUwLFxuICAgICAgICBcImxlZnRcIiA6IDEwMS43NTE3ODk4NDM3MDMyOSxcbiAgICAgICAgXCJ3aWR0aFwiIDogMTkyLFxuICAgICAgICBcImZvbnQtc2l6ZVwiIDogXCIxMHB0XCJcbiAgICAgIH1cbiAgICB9O1xuICAgIHRlc3ROb3RlMi5kYXRhLnRleHRBcnIgPSB0ZXN0Tm90ZTIuZGF0YS50ZXh0LnNwbGl0KFwiXFxuXCIpO1xuICAgIENhbnZhc0FwcERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICAgICAgYWN0aW9uVHlwZTogJ25vdGVfYWRkZWQnLFxuICAgICAgbm90ZToge3Rlc3ROb3RlS2V5MTogdGVzdE5vdGUyfVxuICAgIH0pO1xuICB9LFxuXG4gIGdldDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlZiA9IG5ldyBGaXJlYmFzZSgnaHR0cHM6Ly9icmFpbnNwYWNlLWJpei5maXJlYmFzZWlvLmNvbS8nKTtcbiAgICB2YXIgbm90ZXNSZWYgPSByZWYuY2hpbGQoJ25vdGVzMicpO1xuICAgIG5vdGVzUmVmLm9uKFwiY2hpbGRfYWRkZWRcIiwgZnVuY3Rpb24oc25hcHNob3QpIHtcbiAgICAgIHZhciBub3RlID0gc25hcHNob3QudmFsKCk7XG4gICAgICBub3RlLmRhdGEudGV4dEFyciA9IG5vdGUuZGF0YS50ZXh0LnNwbGl0KCdcXG4nKTtcbiAgICAgIC8vIHRoaXMubm90ZXMucHVzaChub3RlKTtcbiAgICAgIC8vIHRoaXMuYWRkKCBuZXcgUmVjdChub3RlLmRhdGEueCwgbm90ZS5kYXRhLnksIG5vdGUuc3R5bGUud2lkdGgsIG5vdGUuc3R5bGUuaGVpZ2h0KSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICB9LFxufSIsIlxudmFyIF9jYW52YXNFbGVtZW50O1xuXG52YXIgZ2V0UmVsYXRpdmVMZWZ0VG9wID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gIHZhciB0b3RhbE9mZnNldFggPSAwO1xuICB2YXIgdG90YWxPZmZzZXRZID0gMDtcbiAgdmFyIGNhbnZhc1ggPSAwO1xuICB2YXIgY2FudmFzWSA9IDA7XG4gIHZhciBjdXJyZW50RWxlbWVudCA9IF9jYW52YXNFbGVtZW50O1xuXG4gIGRvIHtcbiAgICAgIHRvdGFsT2Zmc2V0WCArPSBfY2FudmFzRWxlbWVudC5vZmZzZXRMZWZ0O1xuICAgICAgdG90YWxPZmZzZXRZICs9IF9jYW52YXNFbGVtZW50Lm9mZnNldFRvcDtcbiAgfVxuICB3aGlsZSAoY3VycmVudEVsZW1lbnQgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRQYXJlbnQpXG5cbiAgdmFyIHBhZ2VYID0gZXZlbnQucGFnZVggPyBldmVudC5wYWdlWCA6IGV2ZW50LmNoYW5nZWRUb3VjaGVzID8gZXZlbnQuY2hhbmdlZFRvdWNoZXNbMF0ucGFnZVggOiBldmVudC5jZW50ZXIueDtcbiAgdmFyIHBhZ2VZID0gZXZlbnQucGFnZVkgPyBldmVudC5wYWdlWSA6IGV2ZW50LmNoYW5nZWRUb3VjaGVzID8gZXZlbnQuY2hhbmdlZFRvdWNoZXNbMF0ucGFnZVkgOiBldmVudC5jZW50ZXIueTtcblxuICBjYW52YXNYID0gcGFnZVggLSB0b3RhbE9mZnNldFg7XG4gIGNhbnZhc1kgPSBwYWdlWSAtIHRvdGFsT2Zmc2V0WTtcblxuICAvLyBGaXggZm9yIHZhcmlhYmxlIGNhbnZhcyB3aWR0aFxuICBjYW52YXNYID0gTWF0aC5yb3VuZCggY2FudmFzWCAqIChfY2FudmFzRWxlbWVudC53aWR0aCAvIF9jYW52YXNFbGVtZW50Lm9mZnNldFdpZHRoKSApO1xuICBjYW52YXNZID0gTWF0aC5yb3VuZCggY2FudmFzWSAqIChfY2FudmFzRWxlbWVudC5oZWlnaHQgLyBfY2FudmFzRWxlbWVudC5vZmZzZXRIZWlnaHQpICk7XG5cbiAgcmV0dXJuIHtsZWZ0OmNhbnZhc1gsIHRvcDpjYW52YXNZfTtcbn07XG5cbmdldFJlbGF0aXZlTGVmdFRvcC5zZXQgPSBmdW5jdGlvbihjYW52YXNFbGVtZW50KSB7XG4gIF9jYW52YXNFbGVtZW50ID0gY2FudmFzRWxlbWVudDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRSZWxhdGl2ZUxlZnRUb3A7XG4iXX0=
