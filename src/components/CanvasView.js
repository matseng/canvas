"use strict";

//require NotesStore, NaviationStore, CanvasAppDispatcher
var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var NotesStore = require('../stores/NotesStore');
var Hammer = require('hammerjs');

var _transform = {
  translateX: 0,
  translateY: 0,
  scale: 1
};
var _notes = NotesStore.getAll();
var _mostRecentNote = NotesStore.getMostRecent();

var CanvasView = {
    
    canvas: document.getElementById('canvas'),

    ctx: document.getElementById('canvas').getContext('2d'),
    
    load: function() {
      this.resizeCanvas();
      this.addTouchEventListeners();
      this.addChangeListeners();
      this.render();
    },

    addTouchEventListeners: function() {
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
      NotesStore.addChangeListener(this.renderNote.bind(this));
    },

    render: function() {
      console.log('Render invoked');
    },

    renderNote: function(note) {
      note = note || _mostRecentNote;
      console.log('will render a single note');
      console.log(note);
      var xWindow = note.data.x * _transform.scale;
      var yWindow = note.data.y * _transform.scale;
      this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
      this.ctx.fillRect.apply(this.ctx, [xWindow, yWindow, note.style.width * _transform.scale, note.style.height * _transform.scale]);
  //   this.drawText(note, xWindow, yWindow)  //SAVE for later

    },

    resizeCanvas: function() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

}

module.exports = CanvasView;
