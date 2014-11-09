To run local tests for each module:
  $ watchify src/nav/tests/spec/moduleSpec.js -o src/nav/tests/dist/testsBundle.js
  $ open src/nav/tests/specRunner.html

--
TODO:
 - makes notes editable
   - use 2-click to edit
 - persist to firebase
 - improve pinch zoom
   - use global coordinates for pinches
   - add momentum to pinches
- use performance.now() to test rendering times
