
importScripts('../lib/UPNG.min.js', '../lib/pako.min.js');

onmessage = function(e) {

  const imageBuffer = e.data[0];
  const imageWidth = e.data[1];
  const imageHeight = e.data[2];
  const n = e.data[3];
  const binarizeMode = e.data[4];

  let time1 = Date.now();
  if(binarizeMode){
    png = UPNG.encode([imageBuffer],imageWidth,imageHeight,2);
  } else {
    png = UPNG.encode([imageBuffer],imageWidth,imageHeight,0);
  }

  delete imageBuffer;
  let time2 = Date.now();
  console.log("UPNG.encode runtime: " + (time2 - time1) / 1e3 + "s");

  postMessage([png,n]);
}
