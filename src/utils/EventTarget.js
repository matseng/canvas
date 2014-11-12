// EventTarget.js
var NotesStore = require('../stores/NotesStore');
var TransformStore = require('../stores/TransformStore');

function getTarget (hammerEvent) {
  var leftTop = {left: hammerEvent.pointers[0].pageX, top: hammerEvent.pointers[0].pageY};
  var globalPoint = TransformStore.windowToGlobalPoint(leftTop);
  var note = NotesStore.getNoteFromXY(globalPoint.x, globalPoint.y);
  return note;  // null if a note wasn't clicked
};

module.exports = getTarget;