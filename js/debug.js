import { calcOverlap } from "./modifyOCR.js";
import ocr from "./objects/ocrObjects.js";
import { saveAs, imageStrToBlob } from "./miscUtils.js";

/**
 * @global
 * @type {CanvasRenderingContext2D}
 * @description - Used under the hood for generating overlap visualizations to display to user. 
 */
globalThis.ctxComp0 = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('h')).getContext('2d'));

/**
 * @global
 * @type {CanvasRenderingContext2D}
 * @description - Used under the hood for generating overlap visualizations to display to user. 
 */
globalThis.ctxComp1 = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('e')).getContext('2d'));

/**
 * @global
 * @type {CanvasRenderingContext2D}
 * @description - Used under the hood for generating overlap visualizations to display to user. 
 */
globalThis.ctxComp2 = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('f')).getContext('2d'));


export function printSelectedWords(printOCR = true) {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;
  for(let i=0; i<selectedObjects.length; i++){
    if (printOCR) {
      console.log(ocr.getPageWord(globalThis.ocrAll.active[currentPage.n], selectedObjects[i].wordID));
    } else {
      console.log(selectedObjects[i]);
    }
  }
}

export async function evalSelectedLine() {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;

  const word0 = ocr.getPageWord(globalThis.ocrAll.active[currentPage.n], selectedObjects[0].wordID);

  const viewCanvas0 = /** @type {HTMLCanvasElement} */ (document.getElementById('e'));
  const viewCanvas1 = /** @type {HTMLCanvasElement} */ (document.getElementById('f'));
  const viewCanvas2 = /** @type {HTMLCanvasElement} */ (document.getElementById('h'));

  // Make debugging canvases visible
  viewCanvas0.setAttribute("style", "");
  viewCanvas1.setAttribute("style", "");
  viewCanvas2.setAttribute("style", "");

  const imgElem = await imageAll.binary[currentPage.n];

  const res = await generalScheduler.addJob("evalWords", {wordsA: word0.line.words, wordsB: [], binaryImage: imgElem.src, pageMetricsObj: pageMetricsArr[currentPage.n], options: {view: true}});

  console.log([res.data.metricA, res.data.metricB]);

  const imgBit0 = await createImageBitmap(res.data.debug.imageRaw);
  viewCanvas0.width = imgBit0.width;
  viewCanvas0.height = imgBit0.height;
  ctxComp0.drawImage(imgBit0, 0, 0);

  const imgBit1 = await createImageBitmap(res.data.debug.imageA);
  viewCanvas1.width = imgBit1.width;
  viewCanvas1.height = imgBit1.height;
  ctxComp1.drawImage(imgBit1, 0, 0);

  const imgBit2 = await createImageBitmap(res.data.debug.imageB);
  viewCanvas2.width = imgBit2.width;
  viewCanvas2.height = imgBit2.height;
  ctxComp2.drawImage(imgBit2, 0, 0);

}


export function downloadImage(img, filename) {
  const imgStr = typeof(img) == "string" ? img : img.src;
  const imgBlob = imageStrToBlob(imgStr);
  saveAs(imgBlob , filename);
}

const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));

export function downloadCanvas() {
  const canvasDataStr = canvas.toDataURL();
  const fileName = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + "_canvas_" + String(currentPage.n) + ".png";
  downloadImage(canvasDataStr, fileName);
}

// Utility function for downloading all images
export async function downloadImageAll(filename_base, type = "binary") {
  for (let i=0; i < globalThis.imageAll[type].length; i++) {
    const img = await globalThis.imageAll[type][i];
    const fileType = img.src.match(/^data\:image\/([a-z]+)/)?.[1];
    if (!["png", "jpeg"].includes(fileType)) {
      console.log("Filetype " + fileType + " is not jpeg/png; skipping.")
      continue;
    }
    const fileName = filename_base + "_" + String(i).padStart(3, "0") + "." + fileType;
    console.log("Downloading file " + String(i) + " as " + fileName);
    downloadImage(img, fileName);
    // Not all files will be downloaded without a delay between downloads
    await new Promise((r) => setTimeout(r, 200));
  }
}

export async function downloadImageDebug(filename_base, type = "Combined") {
  for (let i=0; i < globalThis.debugImg[type].length; i++) {
    for (let j=0; j < globalThis.debugImg[type][i].length; j++) {
      const wordFileName = globalThis.debugImg[type][i][j]["textA"].replace(/[^a-z0-9]/ig, "") + "_" + globalThis.debugImg[type][i][j]["textB"].replace(/[^a-z0-9]/ig, "");
      for (let k=0; k < 2; k++) {
        const name = ["imageRaw", "imageA", "imageB"][k];
        const img = await globalThis.debugImg[type][i][j][name];
        const fileType = img.match(/^data\:image\/([a-z]+)/)?.[1];
        if (!["png", "jpeg"].includes(fileType)) {
          console.log("Filetype " + fileType + " is not jpeg/png; skipping.")
          continue;
        }
        const fileName = filename_base + "_" + String(i) + "_" + String(j) + "_" + String(k) + "_" + wordFileName + "." + fileType;
        console.log("Downloading file " + String(i) + " as " + fileName);
        downloadImage(img, fileName);
        // Not all files will be downloaded without a delay between downloads
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
}


export function getExcludedText() {

  for (let i=0; i<=globalThis.ocrAll.active.length; i++){
    const textArr = getExcludedTextPage(globalThis.ocrAll.active[i], globalThis.layout[i]);

    if (textArr.length > 0) {
      textArr.map((x) => console.log(x + " [Page " + String(i) + "]"));
    }
  }

}

// Get array of text that will be excluded from exports due to "exclude" layout boxes. 
// This was largely copy/pasted from `reorderHOCR` for convenience, so should be rewritten at some point. 

/**
 * @param {ocrPage} pageA
 */
export function getExcludedTextPage(pageA, layoutObj, applyExclude = true) {

  const excludedArr = [];

  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length == 0) return excludedArr;

  const priorityArr = Array(pageA.lines.length);

  // 10 assumed to be lowest priority for text included in the output and is assigned to any word that does not overlap with a "order" layout box
  priorityArr.fill(10);

  for (let i = 0; i < pageA.lines.length; i++) {
    const lineA = pageA.lines[i];

    for (const [id, obj] of Object.entries(layoutObj.boxes)) {
      const overlap = calcOverlap(lineA.bbox, obj["coords"]);
      if (overlap > 0.5) {
        if (obj["type"] == "order") {
          priorityArr[i] = obj["priority"];
        } else if (obj["type"] == "exclude" && applyExclude) {
          const words = lineA.words;
          let text = "";
          for (let i=0; i<words.length; i++) {
            text += words[i].text + " ";
          }
          excludedArr.push(text)
        }
      } 
    }
  }

  return excludedArr;

}

// function subsetFont (font) {

//     const glyphs = font.glyphs.glyphs;
//     const glyphArr = [];

//     for (let key in glyphs) {
//       const glyph = glyphs[key];
//       if (glyph.unicode > 32 && glyph.unicode < 100) {
//         glyphArr.push(glyph);
//       }
//     }

//     const fontOut = new opentype.Font({
//       familyName: font.names.fontFamily["en"],
//       styleName: font.names.fontSubfamily["en"],
//       unitsPerEm: font.unitsPerEm,
//       ascender: font.ascender,
//       descender: font.descender,
//       glyphs: glyphArr
//     })

//     return fontOut;
// }


function lookupKerning(letterA, letterB) {
  return fontMetricsObj.SerifDefault.normal.kerning[letterA.charCodeAt(0) + "," + letterB.charCodeAt(0)]
}