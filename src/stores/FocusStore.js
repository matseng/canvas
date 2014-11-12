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
  console.log(note.data.text);

};

var FocusStore = _assign({}, EventEmitter.prototype, {
  
  getFocusSingleTap: function() {
    return _transform;
  },

  getFocusDoubleTap: function() {
    return _transform;
  },
});

FocusStore.dispatchToken = CanvasAppDispatcher.register(function(payload) {  
  console.log(payload.actionType);
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