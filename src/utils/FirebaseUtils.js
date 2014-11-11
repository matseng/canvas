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