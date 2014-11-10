"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');

var CHANGE_EVENT = 'change';

var _notes = {};
var _mostRecentNote = {};

function _addNote(note) {
  var key = Object.keys(note)[0];
  _notes[key] = note[key];
  _setMostRecentNote(note, key);
}

function _setMostRecentNote(note, key) {
  var keyOld = Object.keys(_mostRecentNote)[0];
  delete _mostRecentNote[keyOld];
  assign(_mostRecentNote, note[key]);
};

var NotesStore = assign({}, EventEmitter.prototype, {
  
  emitChange: function() {
    this.emit(CHANGE_EVENT);
  },

  addChangeListener: function(callback) {
    this.on(CHANGE_EVENT, callback);
  },

  getAll: function() {
    return _notes;
  },

  getMostRecent: function() {
    return _mostRecentNote;
  },

});

NotesStore.dispatchToken = CanvasAppDispatcher.register(function(payload) {
  
  switch (payload.actionType) {
    
    case "note_added":
      _addNote(payload.note);
      NotesStore.emitChange();
      break;

    default:  // do nothing
  }

});

module.exports = NotesStore;