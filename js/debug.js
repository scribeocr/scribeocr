import { evalWords } from "./compareHOCR.js";
import ocr from "./ocrObjects.js";

export function printSelectedWords() {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;
  for(let i=0; i<selectedObjects.length; i++){
    console.log(ocr.getPageWord(globalThis.hocrCurrent[currentPage.n], selectedObjects[i].wordID));
  }
}

export function evalSelectedLine() {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;

  const word0 = ocr.getPageWord(globalThis.hocrCurrent[currentPage.n], selectedObjects[0].wordID);

  // Make debugging canvases visible
  document.getElementById('e')?.setAttribute("style", "");
  document.getElementById('f')?.setAttribute("style", "");
  document.getElementById('h')?.setAttribute("style", "");

  evalWords(word0.line.words, [],  true).then((x) => console.log(x));
  
}


export function downloadImage(img, filename) {
  const imgStr = typeof(img) == "string" ? img : img.src;
  const imgData = new Uint8Array(atob(imgStr.split(',')[1])
        .split('')
        .map(c => c.charCodeAt(0)));

  const imgBlob = new Blob([imgData], { type: 'application/octet-stream' });

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
