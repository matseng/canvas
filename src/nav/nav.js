var Hammer = require('hammerjs');
var render = require('../render/render.js');  //lowercase render because it's a singleton
// var Rect = require('../model/model.js')
var collection = require('../collection/collection.js')

module.exports = (function() {

  var CanvasDemo = function() {
    this.canvas = document.getElementById('canvas');
    this.ctx;
    this.shapes = [];
    this.transform = {
      translateX: 0,
      translateY: 0,
      scale: 1
    };
    this.hammer;
    this.run();
  };

  CanvasDemo.prototype.run = function() {
    // this.shapes.push( new Rect(25,25,100,100) );
    // this.shapes.push( new Rect(125,125,200,200) );
    //Model.getShapes();
    this.shapes = collection.get();
    render.init(this.canvas, this.shapes, this.transform);
    this.resizeCanvas();
    window.onresize = this.resizeCanvas.bind(this);
    this.addEventListeners();
    render.draw();
  };


  var mousePointInitial = {};
  var shapePointInitial = {};
  var translateInitial = {};
  var dragBound;
  var mouseupBound;
  var _resetBound;

  CanvasDemo.prototype.addEventListeners = function() {
    this.canvas.addEventListener('mousewheel', this.setScale.bind(this));
    this.addHammerEventListeners();
  };

  CanvasDemo.prototype.addHammerEventListeners = function() {
    this.hammer = new Hammer.Manager(this.canvas);
    this.hammer.add(new Hammer.Pan({threshold:0}));
    this.hammer.add(new Hammer.Press({time:0}));
    this.hammer.add(new Hammer.Pinch());

    this.hammer.on('pinch', this.setScale.bind(this));
    this.hammer.on('press', this.mousedown.bind(this));
    // hammer.on('pan', function(event) {
      // this.ctx.fillStyle = "blue";
      // this.ctx.font = "bold 16px Arial";
      // this.ctx.fillText("changed hammer", 100, 100);
    // }.bind(this));
  };

  CanvasDemo.prototype.setScale = function(eventHammer) {
    var mouse = this.canvas.relMouseCoords(eventHammer);
    var scalePrev = this.transform.scale;

    if(eventHammer.type === 'mousewheel') {
      if (eventHammer.wheelDeltaY < 0) {
        this.transform.scale = this.transform.scale * 1.05;
      } else {
        this.transform.scale = this.transform.scale * 0.95;
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

    render.draw();
  };

  CanvasDemo.prototype.mousedown = function(eventHammer) {
    event = eventHammer.srcEvent;
    var mouse = this.canvas.relMouseCoords(event);
    mousePointInitial = mouse;
    console.log(mouse);
    var point = {};
    point.x = mouse.x / this.transform.scale - this.transform.translateX;
    point.y = mouse.y / this.transform.scale - this.transform.translateY;
    var shape = this.getShapeinBounds(point);
    
    mouseupBound = this.mouseup.bind(this);
    
    console.log(shape);
    if ( shape ) {
      shapePointInitial = {x: shape.x, y: shape.y};
      dragBound = this.drag.bind(this, shape);
      _resetBound = _reset.bind(this, dragBound, mouseupBound);
      // this.canvas.addEventListener('mousemove', dragBound);
      this.hammer.on('panmove', dragBound);

    } else {
      translateInitial = {x: this.transform.translateX, y: this.transform.translateY};
      translateBound = this.setTranslate.bind(this);
      _resetBound = _reset.bind(this, translateBound, mouseupBound);
      // this.canvas.addEventListener('mousemove', translateBound);  //TODO change to hammer
      this.hammer.on('panmove', translateBound);

    }
    // this.canvas.addEventListener('mouseup', mouseupBound);
    this.hammer.on('panend', mouseupBound);
  };

  CanvasDemo.prototype.drag = function(shape, event) {
    event = event.srcEvent;
    // if (event.which === 1 && mousePointInitial) {
    if (mousePointInitial) {
      var mousePoint = this.canvas.relMouseCoords(event);
      var deltaX = (mousePoint.x - mousePointInitial.x) / this.transform.scale;
      var deltaY = (mousePoint.y - mousePointInitial.y) / this.transform.scale;
      shape.x = shapePointInitial.x + deltaX;
      shape.y = shapePointInitial.y + deltaY;
      render.draw();
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
      render.draw();
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
    shapePointInitial = null;
    translateInitial = null;
    // this.canvas.removeEventListener('mousemove', dragBound);
    // this.canvas.removeEventListener('mouseup', mouseupBound);
    this.hammer.off('panmove', dragBound);
    this.hammer.off('panend', mouseupBound);
  };

  CanvasDemo.prototype.getShapeinBounds = function(point) {
    // var pointX = point.x - this.transform.translateX;
    var pointX = point.x;
    // var pointY = point.y - this.transform.translateY;
    var pointY = point.y;
    var shape = this.rect;
    for(var i = 0; i < this.shapes.length; i++) {
      shape = this.shapes[i];
      if ( (shape.x <= pointX) && (pointX <= shape.x + shape.width) && (shape.y <= pointY) && (pointY <= shape.y + shape.height) ){
        return shape;
      }
    }
    return null;
  };

  CanvasDemo.prototype.resizeCanvas = function() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
      render.draw();
  };

  return CanvasDemo;

})();
