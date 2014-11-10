"use strict";

var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');

module.exports = {
  init: function() {
    this.loadExample();
  },

  loadExample: function() {
    var testNote = {
      "data" : {
        "text" : "#myHashtag3",
        "y" : 250,
        "x" : 250,
        "hashtags" : [ "#myHashtag3" ]
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
  },

  get: function() {
    var ref = new Firebase('https://brainspace-biz.firebaseio.com/');
    var notesRef = ref.child('notes2');
    notesRef.on("child_added", function(snapshot) {
      var note = snapshot.val();
      note.data.textArr = note.data.text.split('\n');
      this.notes.push(note);
      this.add( new Rect(note.data.x, note.data.y, note.style.width, note.style.height));
    }.bind(this));

  },
}