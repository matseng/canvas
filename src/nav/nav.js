var Hammer = require('hammerjs');
var render = require('../render/render.js');  //lowercase render because it's a singleton
// var Rect = require('../model/model.js')
var collection = require('../collection/collection.js');
var Dispatcher = require('flux').Dispatcher;

module.exports = (function() {

  var CanvasDemo = function() {
    this.canvas = document.getElementById('canvas');
    this.textarea = document.getElementById('textarea');
    this.ctx;
    this.notes;
    this.transform = {
      translateX: 0,
      translateY: 0,
      scale: 1
    };
    this.hammer;
    this.hammerFluxDispatcher;
    this.run();
  };

  CanvasDemo.prototype.run = function() {
    this.HammerDispatcher();
    this.notes = collection.notes;
    render.init(this.canvas, this.notes, this.transform);
    this.resizeCanvas();
    window.onresize = this.resizeCanvas.bind(this);
    this.addEventListeners();
    render.drawNotes();
  };

  CanvasDemo.prototype.HammerDispatcher = function() {
    this.hammerFluxDispatcher = new Dispatcher();
    var canvasDemo = this;
    var TouchStore = {
      hammerEventStart: null,
      pressHandler: function(payload) {
        if ('press' === payload.actionType) {
          this.hammerEvent = payload.hammerEvent;
          console.log('Flux Dispatch: Detected hammer press event: ', payload.hammerEvent);
        }
      },
      doubleTapHandler: function(payload) {
        if( 2 === payload.hammerEvent.tapCount ) {
          console.log('If a note was double tapped then edit it');
          var windowPoint = canvasDemo.canvas.relMouseCoords(payload.hammerEvent);
          var globalPoint = canvasDemo.windowToGlobalPoint(windowPoint);
          console.log(globalPoint);
          var note = collection.getNoteInBounds(globalPoint);
          console.log(note);
          if (note) {
            var textareaRectGlobal = {
              x: note.data.x,
              y: note.data.y,
              width: note.style.width,
              height: note.style.height
            };
            var textareaRectWindow = canvasDemo.globalToWindowTransform(textareaRectGlobal);
            var deltaToOriginX = - note.style.width * (1 - canvasDemo.transform.scale) / 2 - 3;
            var deltaToOriginY = - note.style.height * (1 - canvasDemo.transform.scale) / 2 - 3;
            var translateX = deltaToOriginX + textareaRectWindow.x;
            var translateY = deltaToOriginY + textareaRectWindow.y;

            canvasDemo.textarea.value = note.data.text;
            canvasDemo.textarea.style.width = note.style.width + "px";
            canvasDemo.textarea.style.height = note.style.height + "px";
            canvasDemo.textarea.style.webkitTransform = "matrix(" + canvasDemo.transform.scale + ", 0, 0, " + canvasDemo.transform.scale + ", " + translateX + ',' + translateY +')';
            canvasDemo.textarea.style.display = 'block';
          }
        }
      }
    };

    this.hammerFluxDispatcher.register(TouchStore.pressHandler.bind(TouchStore));
    this.hammerFluxDispatcher.register(TouchStore.doubleTapHandler.bind(TouchStore));
  };

  var mousePointInitial = {};
  var notePointInitial = {};
  var translateInitial = {};
  var dragBound;
  var mouseupBound;
  var _resetBound = function(){};

  CanvasDemo.prototype.addEventListeners = function() {
    this.canvas.addEventListener('mousewheel', this.setScale.bind(this));
    this.addHammerEventListeners();
  };

  CanvasDemo.prototype.addHammerEventListeners = function() {
    this.hammer = new Hammer.Manager(this.canvas);
    this.hammer.add(new Hammer.Tap());
    this.hammer.add(new Hammer.Pan({threshold:0}));
    this.hammer.add(new Hammer.Press({pointers: 1, time:0}));
    this.hammer.add(new Hammer.Pinch());

    this.hammer.on('pinch', this.setScale.bind(this));
    this.hammer.on('pinchend', _resetBound);  //not sure if this will help bug
    this.hammer.on('press', this.mousedown.bind(this));
    this.hammer.on('tap', this.tap.bind(this));
    this.hammer.on('pressend', _reset);

    // this.hammer.on('press', function(hammerEvent) {
    //   this.hammerFluxDispatcher.dispatch({
    //     actionType: 'press',
    //     hammerEvent: hammerEvent
    //   });
    // }.bind(this));

    this.hammer.on('tap press pinch', function(hammerEvent) {
    // this.hammer.on('OFF', function(hammerEvent) {
      console.log(hammerEvent.type);
      this.hammerFluxDispatcher.dispatch({
        actionType: 'tap',
        hammerEvent: hammerEvent
      });
    }.bind(this));

  };
  
  CanvasDemo.prototype.tap = function(eventHammer) {
    console.log(eventHammer.tapCount);

  };

  CanvasDemo.prototype.setScale = function(eventHammer) {
    var mouse = this.canvas.relMouseCoords(eventHammer);
    var scalePrev = this.transform.scale;

    if(eventHammer.type === 'mousewheel') {
      if (eventHammer.wheelDeltaY < 0) {
        this.transform.scale = this.transform.scale * 1.1;
      } else {
        this.transform.scale = this.transform.scale * 0.90;
      }
    } else if (eventHammer.type === 'pinch') {
      if (eventHammer.scale > 1) {
        this.transform.scale = this.transform.scale * 1.025;
      } else {
        this.transform.scale = this.transform.scale * 0.975;
      }
    }

    this.transform.translateX = this.transform.translateX - _getTranslateDelta(mouse.x, scalePrev, this.transform.scale);
    this.transform.translateY = this.transform.translateY - _getTranslateDelta(mouse.y, scalePrev, this.transform.scale);

    function _getTranslateDelta(x, scalePrev, scaleNew) {
      var translateDelta = (x / scalePrev * scaleNew - x) / scaleNew;
      return translateDelta;
    }

    render.drawNotes();
  };

  CanvasDemo.prototype.windowToGlobalPoint = function(windowPoint) {
    return {
      x: windowPoint.x / this.transform.scale - this.transform.translateX,
      y: windowPoint.y / this.transform.scale - this.transform.translateY
    };
  };

  CanvasDemo.prototype.globalToWindowTransform = function(globalObj) {
    var windowObj = {};
    windowObj.x = (globalObj.x + this.transform.translateX) * this.transform.scale;
    windowObj.y = (globalObj.y + this.transform.translateY) * this.transform.scale;
    if ( globalObj.width && globalObj.height) {
      windowObj.width = globalObj.width * this.transform.scale;
      windowObj.height = globalObj.height * this.transform.scale;
      return windowObj;
    }
    return windowObj;
  }

  CanvasDemo.prototype.mousedown = function(eventHammer) {
    if (_resetBound) _resetBound();  //trying to remove extra listeners
    event = eventHammer.srcEvent;
    var mouse = this.canvas.relMouseCoords(event);
    mousePointInitial = mouse;
    console.log(mouse);
    var point = {};
    point.x = mouse.x / this.transform.scale - this.transform.translateX;
    point.y = mouse.y / this.transform.scale - this.transform.translateY;
    var note = collection.getNoteInBounds(point);
    // mouseupBound = this.mouseup.bind(this);
    
    console.log(note);
    if ( note ) {
      notePointInitial = {x: note.data.x, y: note.data.y};
      dragBound = this.drag.bind(this, note);
      // _resetBound = _reset.bind(this, dragBound, mouseupBound);
      _resetBound = _reset.bind(this, dragBound);
      this.hammer.on('panmove', dragBound);

    } else {
      translateInitial = {x: this.transform.translateX, y: this.transform.translateY};
      translateBound = this.setTranslate.bind(this);
      // _resetBound = _reset.bind(this, translateBound, mouseupBound);
      _resetBound = _reset.bind(this, translateBound);
      this.hammer.on('panmove', translateBound);

    }
    // this.hammer.on('panend', mouseupBound);
  };

  CanvasDemo.prototype.drag = function(note, event) {
    event = event.srcEvent;
    // if (event.which === 1 && mousePointInitial) {
    if (mousePointInitial) {
      var mousePoint = this.canvas.relMouseCoords(event);
      var deltaX = (mousePoint.x - mousePointInitial.x) / this.transform.scale;
      var deltaY = (mousePoint.y - mousePointInitial.y) / this.transform.scale;
      note.data.x = notePointInitial.x + deltaX;
      note.data.y = notePointInitial.y + deltaY;
      render.drawNotes();
    } else {
      if (_resetBound) {
        _resetBound();
      }
    }
  }

  CanvasDemo.prototype.setTranslate = function(event) {
    event = event.srcEvent;
    // if (event.which === 1 && mousePointInitial) {
    if (mousePointInitial) {
      var mousePoint = this.canvas.relMouseCoords(event);
      this.transform.translateX = translateInitial.x + (mousePoint.x - mousePointInitial.x) / this.transform.scale;
      this.transform.translateY = translateInitial.y + (mousePoint.y - mousePointInitial.y) / this.transform.scale;
      render.drawNotes();
    } else {
      if (_resetBound) {
        _resetBound();
      }
    }
  };

  CanvasDemo.prototype.mouseup = function() {
    _resetBound();
  }

  function _reset(dragBound, mouseupBound) {
    mousePointInitial = null;
    notePointInitial = null;
    translateInitial = null;
    // this.canvas.removeEventListener('mousemove', dragBound);
    // this.canvas.removeEventListener('mouseup', mouseupBound);
    this.hammer.off('panmove', dragBound);
    this.hammer.off('panend', mouseupBound);
    console.log('_reset or _resetBound called');
  };

  CanvasDemo.prototype.resizeCanvas = function() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
      render.drawNotes();
  };

  return CanvasDemo;

})();
