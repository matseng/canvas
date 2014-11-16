"use strict";


var CanvasAppDispatcher = require('../dispatcher/CanvasAppDispatcher');
var NotesStore = require('../stores/NotesStore');
var DragElementStore = require('../stores/DragElementStore');
var Hammer = require('hammerjs');
var TransformStore = require('../stores/TransformStore');
var _getRelativeLeftTop = require('../utils/GetRelativeLeftTop.js');

var FocusView = require('./FocusView');

var _transform;
var _transformPrevious = {translateX: 0, translateY:0, scale: 1};
var _notes;
var _note;  // most recently added or updated note
var _timer = {average: 0, count: 0, start: 0};


function _updateStateFromStores() {
  _transform = TransformStore.get();
  _notes = NotesStore.getAll();
};

var CanvasView = {
    
    canvas: document.getElementById('canvas'),

    ctx: document.getElementById('canvas').getContext('2d'),
    
    load: function() {
      this.resizeCanvas();
      this.addTouchEventListeners();
      this.addStoreListeners();
      this.addWindowResizeListener();
      this.render();
      FocusView.init();
    },

    addWindowResizeListener: function() {
      window.onresize = function() {
        this.resizeCanvas;
        this.render();
      }.bind(this);
    },

    addTouchEventListeners: function() {
      this.hammer = new Hammer.Manager(this.canvas);
      this.hammer.add(new Hammer.Tap());
      this.hammer.add(new Hammer.Pan({threshold:0}));
      this.hammer.add(new Hammer.Press({event: 'pressOneFinger', pointers: 1, time:0}));
      this.hammer.add(new Hammer.Press({event: 'pressTwoFingers', pointers: 2, time:0}));
      this.hammer.add(new Hammer.Pinch());
      this.hammer.on('pressOneFinger pressTwoFingers pinch pan', function(hammerEvent) {
        CanvasAppDispatcher.dispatch({
          actionType: hammerEvent.type,
          hammerEvent: hammerEvent,
          // utils: {_getRelativeLeftTop: _getRelativeLeftTop.bind(CanvasView.canvas)}
        });
      });

      this.hammer.on('tap', function(hammerEvent) {
        if(hammerEvent.tapCount === 1) {
          CanvasAppDispatcher.dispatch({
            actionType: 'tapSingle',
            hammerEvent: hammerEvent
          });
        } else if(hammerEvent.tapCount === 2) {
          CanvasAppDispatcher.dispatch({
            actionType: 'tapDouble',
            hammerEvent: hammerEvent
          });
        }
      });

      this.canvas.addEventListener('mousewheel', function(event) {
        CanvasAppDispatcher.dispatch({
          actionType: 'mousewheel',
          event: event
        });
      });
    },

    addStoreListeners: function() {
      
      NotesStore.addChangeListener('added', function() {
        _updateStateFromStores();
        _note = NotesStore.getMostRecent();  
        CanvasView.renderNote();
      });
      
      DragElementStore.addChangeListener('dragged', function() {
        _note = DragElementStore.get();  
        CanvasView.render();
      });

      TransformStore.addChangeListener('changed', function() {
        CanvasView.render();
      })
    },

    render: function() {
      if (window.performance) _timer.start = window.performance.now();
      _updateStateFromStores();
      this.setCanvasTranslation();
      for(var key in _notes) {
        CanvasView.renderNote(_notes[key]);
      }
      if (window.performance) _timer.average = (_timer.average * _timer.count + window.performance.now() - _timer.start) / (++_timer.count);
      console.log("average render duration: ", _timer.average);
    },

    setCanvasTranslation: function() {
      this.ctx.translate(Math.round(-_transformPrevious.translateX * _transformPrevious.scale), Math.round(-_transformPrevious.translateY * _transformPrevious.scale));
      this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
      this.ctx.translate(Math.round(_transform.translateX * _transform.scale), Math.round(_transform.translateY * _transform.scale));
      _transformPrevious = {translateX: _transform.translateX, translateY: _transform.translateY, scale: _transform.scale};
    },

    renderNote: function(note) {
      note = note || _note;
      var left = Math.round(note.data.x * _transform.scale);
      var top = Math.round(note.data.y * _transform.scale);
      CanvasView.renderShape(note, left, top);
      CanvasView.renderText(note, left, top);
    },

    renderShape: function(note, left, top) {
      this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
      this.ctx.fillRect.apply(this.ctx, [left, top, Math.round(note.style.width * _transform.scale), Math.round(note.style.height * _transform.scale)]);
    },

    renderText: function(note, left, top) {
      this.ctx.fillStyle = "blue";
      this.ctx.font = Math.round(12 * _transform.scale) + "px Arial";
      for(var i = 0; i < note.data.textArr.length; i++) {
        // this.ctx.fillText(" " + note.data.textArr[i], left, top + (12 * (i + 2) - 6) );
        this.ctx.fillText(" " + note.data.textArr[i], left, Math.round(top + (12 * (i + 2) - 6) * _transform.scale));
      }
    },

    resizeCanvas: function() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

}

module.exports = CanvasView;
