

export function searchHOCR(regexStr, regexFlags){
    const re = new RegExp(regexStr, regexFlags);
    const words = currentPage.xmlDoc.documentElement.getElementsByClassName("ocrx_word");
    const res = [];
    for(let i=0;i<words.length;i++){
      if(re.test(words[i].textContent)){
        res.push(words[i]);
      }
    }
    return(res)
  }



export function downloadImage(img, filename) {
  const imgStr = typeof(img) == "string" ? img : img.src;
  const imgData = new Uint8Array(atob(imgStr.split(',')[1])
        .split('')
        .map(c => c.charCodeAt(0)));

  const imgBlob = new Blob([imgData], { type: 'application/octet-stream' });

  saveAs(imgBlob , filename);
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


// Note: Small caps are treated differently from Bold and Italic styles.
// Browsers will "fake" small caps using smaller versions of large caps.
// Unfortunately, it looks like small caps cannot be loaded as a FontFace referring
// to the same font family.  Therefore, they are instead loaded to a different font family.
// https://stackoverflow.com/questions/14527408/defining-small-caps-font-variant-with-font-face
async function createSmallCapsFont(fontData, heightSmallCaps) {

  let workingFont;
  if (typeof (fontData) == "string") {
    workingFont = await opentype.load(fontData);
  } else {
    workingFont = opentype.parse(fontData, { lowMemory: false });
  }

  let oGlyph = workingFont.charToGlyph("o");
  let oGlyphMetrics = oGlyph.getMetrics();
  let xHeight = oGlyphMetrics.yMax - oGlyphMetrics.yMin;
  let fontAscHeight = workingFont.charToGlyph("A").getMetrics().yMax;
  const smallCapsMult = xHeight * (heightSmallCaps ?? 1) / fontAscHeight;
  const lower = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
  const singleStemClassA = ["i", "l", "t", "I"];
  const singleStemClassB = ["f", "i", "j", "l", "t", "I", "J", "T"];

  for (let i = 0; i < lower.length; i++) {
    const charLit = lower[i];
    const glyphIUpper = workingFont.charToGlyph(charLit.toUpperCase());
    const glyphI = workingFont.charToGlyph(charLit);

    glyphI.path.commands = JSON.parse(JSON.stringify(glyphIUpper.path.commands));

    for (let j = 0; j < glyphI.path.commands.length; j++) {
      let pointJ = glyphI.path.commands[j];
      if (pointJ.x != null) {
        pointJ.x = Math.round(pointJ.x * (smallCapsMult));
      }
      if (pointJ.x1 != null) {
        pointJ.x1 = Math.round(pointJ.x1 * (smallCapsMult));
      }
      if (pointJ.x2 != null) {
        pointJ.x2 = Math.round(pointJ.x2 * (smallCapsMult));
      }

      if (pointJ.y != null) {
        pointJ.y = Math.round(pointJ.y * (smallCapsMult));
      }
      if (pointJ.y1 != null) {
        pointJ.y1 = Math.round(pointJ.y1 * (smallCapsMult));
      }
      if (pointJ.y2 != null) {
        pointJ.y2 = Math.round(pointJ.y2 * (smallCapsMult));
      }

    }

    glyphI.advanceWidth = Math.round(glyphIUpper.advanceWidth * smallCapsMult);

  }

  // Remove ligatures, as these are especially problematic for small caps fonts (as small caps may be replaced by lower case ligatures)
  workingFont.tables.gsub = null;

  return workingFont;

}
