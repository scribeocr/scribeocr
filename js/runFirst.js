// This JavaScript file is loaded and run before any other JavaScript.  It should remain minimal and completely isolated.
// If this code is added to `main.js`, then there will be a noticable delay between the (visible) page load and when it takes effect. 
// Anything in this file should run virtually instantly upon page load. 

const zone = /** @type {HTMLInputElement} */ (document.getElementById("uploadDropZone"));

zone.addEventListener('touchmove', (event) => {
  event.preventDefault();
});
