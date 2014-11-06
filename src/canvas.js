window.onload = run;

function run() {
 var cd = new CanvasDemo();
};

var Rect = function(x, y, width, height) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}

Rect.prototype.getDims = function() {
  return [this.x, this.y, this.width, this.height];
};

var CanvasDemo = function() {
  this.canvas = document.getElementById('canvas');
  this.shapes = [];

  if ( this.canvas.getContext ) {
    this.shapes.push( new Rect(25,25,100,100) );
    this.shapes.push( new Rect(125,125,200,200) );
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();
    window.onresize = this.resizeCanvas.bind(this);
    this.addEventListeners();
    this.draw();
  }
}

var mousePointInitial = {};
var shapePointInitial = {};
var mousemoveBound;
var mouseupBound;
var _resetBound;

CanvasDemo.prototype.addEventListeners = function() {
  this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
};

CanvasDemo.prototype.mousedown = function(event) {
  var point = this.canvas.relMouseCoords(event);
  var shape = this.getShapeinBounds(point);
  if ( shape ) {
    mousePointInitial = point;
    shapePointInitial = {x: shape.x, y: shape.y};
    mousemoveBound = this.mousemove.bind(this, shape);
    mouseupBound = this.mouseup.bind(this);
    _resetBound = _reset.bind(this, mousemoveBound, mouseupBound);
    this.canvas.addEventListener('mousemove', mousemoveBound);
    this.canvas.addEventListener('mouseup', mouseupBound);
  } else {
    _resetBound.call(this);
  }
};

CanvasDemo.prototype.mousemove = function(shape, event) {
  if (event.which === 1 && mousePointInitial) {
    this.ctx.clearRect.apply(this.ctx, shape.getDims());
    var mousePoint = this.canvas.relMouseCoords(event);
    var deltaX = mousePoint.x - mousePointInitial.x;
    var deltaY = mousePoint.y - mousePointInitial.y;
    shape.x = shapePointInitial.x + deltaX;
    shape.y = shapePointInitial.y + deltaY;
    this.ctx.fillRect.apply(this.ctx, shape.getDims());
  } else {
    if (_resetBound) {
      debugger     
      _resetBound();
    }
  }
}

CanvasDemo.prototype.mouseup = function(event) {
  _resetBound();
}

function _reset(mousemoveBound, mouseupBound) {
  mousePointInitial = null;
  shapePointInitial = null;
  this.canvas.removeEventListener('mousemove', mousemoveBound);
  this.canvas.removeEventListener('mouseup', mouseupBound);
};


CanvasDemo.prototype.draw = function() {
  for(var i = 0; i < this.shapes.length; i++) {
    var shape = this.shapes[i];
    this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
    this.ctx.fillRect.apply(this.ctx, shape.getDims());
    this.ctx.clearRect(50,50,50,50);
    this.ctx.strokeRect(45,45,60,60);
  }
};

CanvasDemo.prototype.getShapeinBounds = function(point) {
  var shape = this.rect;
  for(var i = 0; i < this.shapes.length; i++) {
    shape = this.shapes[i];
    if ( (shape.x <= point.x) && (point.x <= shape.x + shape.width) && (shape.y <= point.y) && (point.y <= shape.y + shape.height) ){
      return shape;
    }
  }
  return null;
};

CanvasDemo.prototype.resizeCanvas = function() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.draw();
};

HTMLCanvasElement.prototype.relMouseCoords = function (event) {
  var totalOffsetX = 0;
  var totalOffsetY = 0;
  var canvasX = 0;
  var canvasY = 0;
  var currentElement = this;

  do {
      totalOffsetX += currentElement.offsetLeft;
      totalOffsetY += currentElement.offsetTop;
  }
  while (currentElement = currentElement.offsetParent)

  canvasX = event.pageX - totalOffsetX;
  canvasY = event.pageY - totalOffsetY;

  // Fix for variable canvas width
  canvasX = Math.round( canvasX * (this.width / this.offsetWidth) );
  canvasY = Math.round( canvasY * (this.height / this.offsetHeight) );

  return {x:canvasX, y:canvasY}
}