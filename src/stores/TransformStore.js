"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var EventEmitter = require('events').EventEmitter;
var _assign = require('object-assign');
var _getRelativeLeftTop = require('../utils/GetRelativeLeftTop.js');

var CHANGE_EVENT = 'change';

var _pinchPrevious;

var _transform = {
  translateX: 0,
  translateY: 0,
  scale: 1
};

function _zoomStart(hammerEvent) {
  _pinchPrevious = {};
  _pinchPrevious.dist = _distHammerPinchEvent(hammerEvent);
  _pinchPrevious.center = hammerEvent.center;
  console.log(_pinchPrevious);
};

function _zoom(hammerEvent) {
  var newDist = _distHammerPinchEvent(hammerEvent);
  var newScale = newDist / _pinchPrevious.dist;
  _transform.scale = newScale;
  console.log(_transform.scale); 
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
});

Transform.dispatchToken = CanvasAppDispatcher.register(function(payload) {
  switch(payload.actionType) {
    
    case 'pressTwoFingers':
      _zoomStart(payload.hammerEvent);
      break;
    
    case 'pinch':
      _zoom(payload.hammerEvent)
      break;
    
    default:
  }
});


module.exports = Transform;