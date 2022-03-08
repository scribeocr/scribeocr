
// File summary:
// Functions called by the buttons in the "View" and "Layout" tabs
// (used for changing how page is displayed on canvas).

import { loadFont, loadFontFamily } from "./fontUtils.js";
import { renderPageQueue, optimizeFont2 } from "../main.js"

export async function changeDisplayFont(font){
  window.hocrAll[window.currentPage] = window.xmlDoc.documentElement.outerHTML;
  const optimizeMode = document.getElementById("optimizeFont").checked;
  if(typeof(fontObj[font]) != "undefined" && typeof(fontObj[font]["normal"]) != "undefined" && fontObj[font]["normal"].optimized == optimizeMode){
    globalFont = font;
    renderPageQueue(window.currentPage, 'screen', false);
  } else {
    console.log("Loading new font");
    await loadFontFamily(font, window.fontMetricsObj);
    globalFont = font;
    if(optimizeMode){
      await optimizeFont2();
    }
    renderPageQueue(window.currentPage, 'screen', false);
  }

}


export function changeZoom(value){
  window.hocrAll[window.currentPage] = window.xmlDoc.documentElement.outerHTML;
  let currentValue = parseFloat(document.getElementById('zoomInput').value);

  if(value == "minus"){
    value = currentValue - 50;
  } else if(value == "plus"){
    value = currentValue + 50;
  }

  // Set min/max values to avoid typos causing unexpected issues
  value = Math.max(value, 300);
  value = Math.min(value, 5000);

  document.getElementById('zoomInput').value = value;
  renderPageQueue(window.currentPage, "screen", false);
}


export function adjustMarginRange(value){
   window.canvas.viewportTransform[4] =  (parseInt(value) - 200);
   window.canvas.renderAll();
}


export function adjustMarginRangeChange(value){
  window.pageMetricsObj["manAdjAll"][window.currentPage] = (parseInt(value) - 200);
}
