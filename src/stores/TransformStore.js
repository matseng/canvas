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
  console.log('_translateStart');
  _translateStartData = {};
  var leftTop = {left: hammerEvent.pointers[0].pageX, top: hammerEvent.pointers[0].pageY};
  var note = NotesStore.getNoteFromXY(leftTop.left, leftTop.top);
  if ( !note) {
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
  _pinchStart = {};
  _pinchStart.dist = _distHammerPinchEvent(hammerEvent);
  _pinchStart.center = hammerEvent.center;
  _pinchStart.scale = _transform.scale;
  console.log(_pinchStart);
};

function _zoom(hammerEvent) {

  var center = _pinchStart.center;
  var newDist = _distHammerPinchEvent(hammerEvent);
  var newScale = newDist / _pinchStart.dist;

  _transform.scale = newScale;

  console.log(_transform.scale); 

  _transform.translateX = _transform.translateX - _getTranslateDelta(center.x, _pinchStart.scale, _transform.scale);
  _transform.translateY = _transform.translateY - _getTranslateDelta(center.y, _pinchStart.scale, _transform.scale);
};

function _getTranslateDelta(x, scalePrev, scaleNew) {
  var translateDelta = (x / scalePrev * scaleNew - x) / scaleNew;
  return translateDelta;
}


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

});

Transform.dispatchToken = CanvasAppDispatcher.register(function(payload) {
  switch(payload.actionType) {
    
    case 'press':
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
    
    default:
  }
});


module.exports = Transform;