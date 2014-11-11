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