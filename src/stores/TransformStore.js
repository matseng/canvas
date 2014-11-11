"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var EventEmitter = require('events').EventEmitter;
var _assign = require('object-assign');

var CHANGE_EVENT = 'change';

var _transform = {
  translateX: 0,
  translateY: 0,
  scale: 1
};

var Transform = _assign({}, EventEmitter.prototype, {
  get: function() {
    return _transform;
  },

  getScale: function() {
    return _transform.scale;
  }
});

module.exports = Transform;