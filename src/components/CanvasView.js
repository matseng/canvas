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
var _notes;
var _mostRecentNote;

function _updateStateFromStore() {
  // _transform = TransformStore.get();  //SAVE for later
  _notes = NotesStore.getAll();
  _mostRecentNote = NotesStore.getMostRecent();  
};

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
      NotesStore.addChangeListener(function() {
        _updateStateFromStore();
        CanvasView.renderNote();
      });
    },

    render: function() {
      console.log('Render invoked');
    },

    renderNote: function(note) {
      note = note || _mostRecentNote;
      console.log('will render a single note');
      console.log(note);
      var left = note.data.x * _transform.scale;
      var top = note.data.y * _transform.scale;
      CanvasView.renderShape(note, left, top);
      CanvasView.renderText(note, left, top);
    },

    renderShape: function(note, left, top) {
      this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
      this.ctx.fillRect.apply(this.ctx, [left, top, note.style.width * _transform.scale, note.style.height * _transform.scale]);
    },

    renderText: function(note, left, top) {
      this.ctx.fillStyle = "blue";
      this.ctx.font = 12 * _transform.scale + "px Arial";
      for(var i = 0; i < note.data.textArr.length; i++) {
        this.ctx.fillText(" " + note.data.textArr[i], left, top + (12 * (i + 2) - 6) * _transform.scale);
      }
    },

    resizeCanvas: function() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

}

module.exports = CanvasView;
