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
  this.rect = new Rect(25,25,100,100);

  if ( this.canvas.getContext ) {
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();
    window.onresize = this.resizeCanvas.bind(this);
    this.addEventListeners();
    this.draw();
  }
}

var mousePointInitial = {};
var shapePointInitial = {};
var _reset;
var mousemoveBound;
var mouseupBound;

CanvasDemo.prototype.addEventListeners = function() {
  this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
};

CanvasDemo.prototype.mousedown = function(event) {
  var point = this.canvas.relMouseCoords(event);
  if ( this.inBounds(point) ) {
    mousePointInitial = point;
    shapePointInitial = {x: this.rect.x, y: this.rect.y};
    var mousemoveBound = this.mousemove.bind(this);
    var mouseupBound = this.mouseup.bind(this);
    this.canvas.addEventListener('mousemove', mousemoveBound);
    this.canvas.addEventListener('mouseup', mouseupBound);
    _reset.bind(null, mousemoveBound, mouseupBound);
  }
};

CanvasDemo.prototype.mousemove = function(event) {
  if (event.which === 1 && mousePointInitial) {
    this.ctx.clearRect.apply(this.ctx, this.rect.getDims());
    var mousePoint = this.canvas.relMouseCoords(event);
    var deltaX = mousePoint.x - mousePointInitial.x;
    var deltaY = mousePoint.y - mousePointInitial.y;
    this.rect.x = shapePointInitial.x + deltaX;
    this.rect.y = shapePointInitial.y + deltaY;
    this.ctx.fillRect.apply(this.ctx, this.rect.getDims());
  } else {
    _reset();
  }
}

CanvasDemo.prototype.mouseup = function(event) {
  _reset();
}

function _reset (mousemoveBound, mouseupBound) {
  mousePointInitial = null;
  shapePointInitial = null;
  this.canvas.removeEventListener('mousemove', mousemoveBound);
  this.canvas.removeEventListener('mouseup', mouseupBound);
};


CanvasDemo.prototype.draw = function() {
  
  this.ctx.fillStyle = 'rgb(200,0,0)';
  // this.ctx.fillRect(10, 10, 100, 50);
  this.ctx.fillRect.apply(this.ctx, this.rect.getDims());
  this.ctx.clearRect(50,50,50,50);
  this.ctx.strokeRect(45,45,60,60);

  // this.ctx.fillStyle = 'rgba(0,0,200,0.5)';
  // this.ctx.fillRect(30, 30, 100, 50);


  // this.ctx.fillRect(25,25,100,100);
  // this.ctx.clearRect(45,45,60,60);
  // this.ctx.strokeRect(50,50,50,50);
};

CanvasDemo.prototype.inBounds = function(point) {
  var shape = this.rect;
  return ( (shape.x <= point.x) && (point.x <= shape.x + shape.width) && (shape.y <= point.y) && (point.y <= shape.y + shape.height) );
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