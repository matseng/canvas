var Rect = require('./shapes.js');

module.exports = (function() {

  var Collection = function() {
    this.notes = [];
    this.shapes = [];
    this.run();
  }

  Collection.prototype.run = function() {
    this.add( new Rect(25,25,100,100) );
    this.add( new Rect(125,125,200,200) );
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
    this.notes.push(testNote);
    // render.drawNote(testNote);
    this.firebase();  //SAVE
  };

  Collection.prototype.firebase = function() {
    var ref = new Firebase('https://brainspace-biz.firebaseio.com/');
    var notesRef = ref.child('notes2');
    notesRef.on("child_added", function(snapshot) {
      var note = snapshot.val();
      note.data.textArr = note.data.text.split('\n');
      this.notes.push(note);
      this.add( new Rect(note.data.x, note.data.y, note.style.width, note.style.height));
      // this.add( new Rect(note.style.left, note.style.top, note.style.width, note.style.height));
    }.bind(this));

  };

  Collection.prototype.add = function(shape) {
    this.shapes.push(shape);
  };

  Collection.prototype.get = function() {
    return this.shapes;
  };

  Collection.prototype.getNoteInBounds = function(point) {
    var note;
    // var shape;  //REMOVE later 
    for(var i = 0; i < this.notes.length; i++) {
      note = this.notes[i];
      shape = this.shapes[i];
      if ( 
        note.data.x <= point.x && 
        point.x <= note.data.x + note.style.width && 
        note.data.y <= point.y && 
        point.y <= note.data.y + note.style.height 
      ) {
        return note;
        // return shape;
      }
    }
    return null;
  };
  
  return new Collection();

})();
