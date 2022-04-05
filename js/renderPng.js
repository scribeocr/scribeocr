
importScripts('../lib/UPNG.js', '../lib/pako.js');

onmessage = function(e) {

  const imageBuffer = e.data[0];
  const imageWidth = e.data[1];
  const imageHeight = e.data[2];
  const n = e.data[3];


  let time1 = Date.now();
  let png = UPNG.encode([imageBuffer],imageWidth,imageHeight,0);
  delete imageBuffer;
  let time2 = Date.now();
  console.log("UPNG.encode runtime: " + (time2 - time1) / 1e3 + "s");

  postMessage([png,n]);
}
