
import { getFontSize, calcWordMetrics, calcCharSpacing, calcLineFontSize } from "./fontUtils.js"
import { renderLayoutBoxes, updateDataPreview } from "./interfaceLayout.js";
import ocr from "./objects/ocrObjects.js";
import { ITextWord } from "./objects/fabricObjects.js";

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
const showBoundingBoxesElem = /** @type {HTMLInputElement} */(document.getElementById('showBoundingBoxes'));


export async function renderPage(canvas, page, defaultFont, imgDims, angle, leftAdjX, fontAll) {

  const layoutMode = globalThis.layoutMode || false;

  // objectCaching slows down page render speeds, and is generally not needed.
  // The exception is when working in layoutMode, where users draw semi-transparent rectangles
  // that overlap with many of the other elements, which requires objectCaching to run smoothly. 
  if (layoutMode) {
    fabric.Object.prototype.objectCaching = true;
  } else {
    fabric.Object.prototype.objectCaching = false;
  }

  const enableRotation = autoRotateCheckboxElem.checked && Math.abs(angle ?? 0) > 0.05;

  const sinAngle = Math.sin(angle * (Math.PI / 180));
  const cosAngle = Math.cos(angle * (Math.PI / 180));

  const shiftX = sinAngle * (imgDims.height * 0.5) * -1 || 0;
  const shiftY = sinAngle * ((imgDims.width - shiftX) * 0.5) || 0;

  const lines = page.lines;

  let lineFontSize = 10;
  for (let i = 0; i < lines.length; i++) {
    let lineObj = lines[i]

    const linebox = lineObj.bbox;
    const baseline = lineObj.baseline;
    lineFontSize = (await calcLineFontSize(lineObj, fontAll.active)) ||  lineFontSize;

    const angleAdjLine = enableRotation ? ocr.calcLineAngleAdj(lineObj) : {x : 0, y : 0};

    const words = lineObj.words;

    for (let j = 0; j < words.length; j++) {

      const wordObj = words[j];

      const fillColorHexMatch = wordObj.matchTruth ? "#00ff7b" : "#ff0000";

      if (!wordObj.text) continue;

      const box = wordObj.bbox;

      let box_width = box[2] - box[0];
      let box_height = box[3] - box[1];

      let angleAdjXWord = angleAdjLine.x;
      if(enableRotation && Math.abs(angle) >= 1) {

        angleAdjXWord = angleAdjXWord + ((box[0] - linebox[0]) / cosAngle - (box[0] - linebox[0]));

      }

      const wordText = wordObj.text;
      const wordSup = wordObj.sup;
      const wordDropCap = wordObj.dropcap;
      const fontStyle = wordObj.style;
      let wordFontFamily = wordObj.font;

      let defaultFontFamily;
      if (wordFontFamily === null || wordFontFamily === undefined) {
        wordFontFamily = defaultFont;
        defaultFontFamily = true;
      } else {
        wordFontFamily = wordFontFamily.trim();
        defaultFontFamily = false;
      }

      const fontI = /**@type {fontContainerFont} */  (fontAll.active[wordFontFamily][fontStyle]);
      const fontOpentypeI = await fontI.opentype;

      let wordFontSize = wordObj.size;
      let scaleX = 1;
      if (!wordFontSize) {
        if (wordSup) {
          // All superscripts are assumed to be numbers for now
          wordFontSize = await getFontSize(fontI, box_height, "1");
        } else if (wordDropCap) {
          wordFontSize = await getFontSize(fontI, box_height, wordText.slice(0, 1));
          const wordWidthFont = (await calcWordMetrics(wordText.slice(0, 1), fontI, wordFontSize)).visualWidth;
          scaleX = (box_width / wordWidthFont);
    
        } else {
          wordFontSize = lineFontSize;
        }
      }

      const wordConf = wordObj.conf;


      const word_id = wordObj.id;

      const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
      const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));
      
      const confThreshHigh = confThreshHighElem.value != "" ? parseInt(confThreshHighElem.value) : 85;
      const confThreshMed = confThreshMedElem.value != "" ? parseInt(confThreshMedElem.value) : 75;

      let fillColorHex;
      if (wordConf > confThreshHigh) {
        fillColorHex = "#00ff7b";
      } else if (wordConf > confThreshMed) {
        fillColorHex = "#ffc800";
      } else {
        fillColorHex = "#ff0000";
      }

      const displayModeElem = /** @type {HTMLInputElement} */(document.getElementById('displayMode'));
      const displayMode = displayModeElem.value;

      let opacity_arg, fill_arg;
      // Set current text color and opacity based on display mode selected
      if (displayMode == "invis") {
        opacity_arg = 0
        fill_arg = "black"
      } else if (displayMode == "ebook") {
        opacity_arg = 1
        fill_arg = "black"
      } else if (displayMode == "eval") {
        opacity_arg = 1;
        fill_arg = fillColorHexMatch;
      } else {
        opacity_arg = 1
        fill_arg = fillColorHex
      }

      const showTextBoxBorderArg = showBoundingBoxesElem.checked || displayMode == "eval" && wordConf > confThreshHigh && !wordObj.matchTruth;

      const charSpacing = await calcCharSpacing(wordText, fontI, wordFontSize, box_width);

      let wordFirstGlyphMetrics = fontOpentypeI.charToGlyph(wordText.substr(0, 1)).getMetrics();

      let wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / fontOpentypeI.unitsPerEm);

        let baselineWord;
        let visualBaseline;
        if (wordSup || wordDropCap) {

          baselineWord = box[3];

          let angleAdjYWord = angleAdjLine.y;

          // Recalculate the angle adjustments (given different x and y coordinates)
          if (enableRotation) {

            const x = box[0];
            const y = box[3];
      
            const xRot = x * cosAngle - sinAngle * y;
            const yRot = x * sinAngle + cosAngle * y;
      
            const angleAdjXInt = x - xRot;
            // const angleAdjYInt = y - yRot;
      
            // const angleAdjXInt = sinAngle * (linebox[3] + baseline[1]);
            const angleAdjYInt = sinAngle * (box[0] + angleAdjXInt / 2) * -1;
      
            angleAdjXWord = angleAdjXInt + shiftX;
            angleAdjYWord = angleAdjYInt + shiftY;
      
          }

          visualBaseline = box[3] + angleAdjYWord;
      
        } else {
          visualBaseline = linebox[3] + baseline[1] + angleAdjLine.y;
        }

        const visualLeft = box[0] + angleAdjXWord + leftAdjX;
        const left = visualLeft - wordLeftBearing;

        const textBackgroundColor = globalThis.find.search && wordText.toLowerCase().includes(globalThis.find.search?.toLowerCase()) ? '#4278f550' : '';

        const textbox = new ITextWord(wordText, {
          left: left,
          top: visualBaseline,
          word: wordObj,
          selectable: !layoutMode,
          leftOrig: left,
          topOrig: visualBaseline,
          baselineAdj: 0,
          wordSup: wordSup,
          originY: "bottom",
          fill: fill_arg,
          fill_proof: fillColorHex,
          fill_ebook: 'black',
          fill_eval: fillColorHexMatch,
          fontFamily: fontI.fontFaceName,
          fontStyle: fontI.fontFaceStyle,
          fontObj: fontI,

          // fontFamilyLookup and fontStyleLookup should be used for all purposes other than Fabric.js (e.g. looking up font information)
          fontFamilyLookup: wordFontFamily,
          fontStyleLookup: fontStyle,
          wordID: word_id,
          line: i,
          visualWidth: box_width, // TODO: Is this incorrect when rotation exists? 
          visualLeft: visualLeft,
          visualBaseline: visualBaseline,
          scaleX: scaleX,
          defaultFontFamily: defaultFontFamily,
          textBackgroundColor: textBackgroundColor,
          //fontFamily: 'times',
          opacity: opacity_arg,
          charSpacing: charSpacing * 1000 / wordFontSize,
          fontSize: wordFontSize,
          showTextBoxBorder: showTextBoxBorderArg
        })

        canvas.add(textbox);

    }
  }

  if (layoutMode) {

    renderLayoutBoxes(Object.keys(globalThis.layout[currentPage.n]["boxes"]), false);

  }

  updateDataPreview();

}