module.exports = (function() {
  
  var Render = function() {
    this.canvas;
    this.ctx;
    this.shapes;
    this.transform;
    this.notes;
  };

  Render.prototype.init = function(canvas, notes, transform) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.notes = notes;
    this.transform = transform;
  };

  Render.prototype.draw = function() {
    this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    this.ctx.translate(this.transform.translateX * this.transform.scale, this.transform.translateY * this.transform.scale);
    for(var i = 0; i < this.shapes.length; i++) {
      var shape = this.shapes[i];
      this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
      this.ctx.fillRect.apply(this.ctx, shape.getDimensions(this.transform.scale));
      // this.ctx.strokeRect(45,45,60,60);
    }
    this.ctx.translate(-this.transform.translateX * this.transform.scale, -this.transform.translateY * this.transform.scale);
  };

  Render.prototype.drawNotes = function() {
    this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    this.ctx.translate(this.transform.translateX * this.transform.scale, this.transform.translateY * this.transform.scale);
    for(var i = 0; i < this.notes.length; i++) {
      this.drawNote(this.notes[i]);
    }
    this.ctx.translate(-this.transform.translateX * this.transform.scale, -this.transform.translateY * this.transform.scale);
  };

  Render.prototype.drawNote = function(note) {
    var xWindow = note.data.x * this.transform.scale;
    var yWindow = note.data.y * this.transform.scale;
    this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
    this.ctx.fillRect.apply(this.ctx, [xWindow, yWindow, note.style.width * this.transform.scale, note.style.height * this.transform.scale]);
    this.drawText(note, xWindow, yWindow)  //SAVE
  };

  Render.prototype.drawText = function(note, xWindow, yWindow) {
      this.ctx.fillStyle = "blue";
      this.ctx.font = 12 * this.transform.scale + "px Arial";
      // var xWindow = note.data.x * this.transform.scale;
    for(var i = 0; i < note.data.textArr.length; i++) {
      // this.ctx.fillText(" " + note.data.textArr[i], xWindow, (note.data.y + 12 * (i + 2) - 6) * this.transform.scale);
      this.ctx.fillText(" " + note.data.textArr[i], xWindow, yWindow + (12 * (i + 2) - 6) * this.transform.scale);
    }
  }


  return new Render();

})();
