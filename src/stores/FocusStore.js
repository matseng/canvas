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