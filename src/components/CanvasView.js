"use strict";

//require NotesStore, NaviationStore, CanvasAppDispatcher
var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var NotesStore = require('../stores/NotesStore');
var Hammer = require('hammerjs');

// function getStateFromStore() {
//   return {
//     transform: null,
//     notes: NotesStore.getAll(),
//     mostRecentNote: NotesStore.getMostRecent(),
//   };
// };

var CanvasView = {
    
    canvas: document.getElementById('canvas'),

    load: function() {
      this.resizeCanvas();
      this.addTouchEventListeners();
      this.addChangeListeners();
      this.render();
    },

    addTouchEventListeners: function() {
        //listen for hammer events and then dispatch an action for this touch event
      this.hammer = new Hammer.Manager(this.canvas);
      this.hammer.add(new Hammer.Tap());
      this.hammer.add(new Hammer.Pan({threshold:0}));
      this.hammer.add(new Hammer.Press({pointers: 1, time:0}));
      this.hammer.add(new Hammer.Pinch());

      this.hammer.on('tap press pinch', function(hammerEvent) {
        console.log('Touch event detected');
        CanvasAppDispatcher.dispatch({
          actionType: hammerEvent.type,
          hammerEvent: hammerEvent
        });
      });
    },

    addChangeListeners: function() {
      NotesStore.addChangeListener(this.renderNote);
    },

    render: function() {
      console.log('Render invoked');
    },

    renderNote: function() {
      console.log('will render a single note');
    },

    resizeCanvas: function() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

}

module.exports = CanvasView;
