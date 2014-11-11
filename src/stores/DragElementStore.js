"use strict";

var assign = require('object-assign');
var EventEmitter = require('events').EventEmitter;
var NotesStore = require('./NotesStore');
var Transform = require('./TransformStore');
var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');

var _dragStart;

var _getRelativeLeftTop = function() {};

function _setDragStart(hammerEvent) {
  console.log('_setDragStart');
  _dragStart = {};
  // var leftTop = _getRelativeLeftTop(hammerEvent);
  var leftTop = {left: hammerEvent.pointers[0].pageX, top: hammerEvent.pointers[0].pageY};
  var XY;
  var note = NotesStore.getNoteFromXY(leftTop.left, leftTop.top);
  if (note) {
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
  
    case 'press':
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
