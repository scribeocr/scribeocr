
import { getFontSize, calcWordMetrics, calcCharSpacing } from "./textUtils.js"
import { updateHOCRBoundingBoxWord, updateHOCRWord, updateWordCanvas } from "./interfaceEdit.js";
import { renderLayoutBoxes } from "./interfaceLayout.js";
import { round3 } from "./miscUtils.js"

const fontSizeElem = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));
const wordFontElem = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));
const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
const rangeBaselineElem = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));
const showBoundingBoxesElem = /** @type {HTMLInputElement} */(document.getElementById('showBoundingBoxes'));
const styleItalicElem = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));
const styleSmallCapsElem = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));
const styleSuperElem = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));
const styleItalicButton = new bootstrap.Button(styleItalicElem);
const styleSmallCapsButton = new bootstrap.Button(styleSmallCapsElem);
const styleSuperButton = new bootstrap.Button(styleSuperElem);
const enableLayoutElem = /** @type {HTMLInputElement} */(document.getElementById('enableLayout'));

export async function renderPage(canvas, doc, xmlDoc, mode = "screen", defaultFont, lineMode = false, imgDims, canvasDims, angle, pdfMode, fontObj, leftAdjX) {

  let ctx = canvas.getContext('2d');

  const layoutMode = globalThis.layoutMode || false;

  // objectCaching slows down page render speeds, and is generally not needed.
  // The exception is when working in layoutMode, where users draw semi-transparent rectangles
  // that overlap with many of the other elements, which requires objectCaching to run smoothly. 
  if (layoutMode) {
    fabric.Object.prototype.objectCaching = true;
  } else {
    fabric.Object.prototype.objectCaching = false;
  }

  const sinAngle = Math.sin(angle * (Math.PI / 180));
  const cosAngle = Math.cos(angle * (Math.PI / 180));

  const shiftX = sinAngle * (imgDims[0] * 0.5) * -1 || 0;
  const shiftY = sinAngle * ((imgDims[1] - shiftX) * 0.5) || 0;


  let lines = xmlDoc.getElementsByClassName("ocr_line");

  let lineFontSize;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    let titleStrLine = line.getAttribute('title');

    let linebox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
    let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
    if (baseline != null) {
      baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });
    } else {
      baseline = [0, 0];
    }
    let words = line.getElementsByClassName("ocrx_word");      

    // If possible (native Tesseract HOCR) get font size using x-height.
    // If not possible (Abbyy XML) get font size using ascender height.
    let letterHeight = titleStrLine.match(/x_size\s+([\d\.\-]+)/);
    let ascHeight = titleStrLine.match(/x_ascenders\s+([\d\.\-]+)/);
    let descHeight = titleStrLine.match(/x_descenders\s+([\d\.\-]+)/);
    if (letterHeight != null && ascHeight != null && descHeight != null) {
      letterHeight = parseFloat(letterHeight[1]);
      ascHeight = parseFloat(ascHeight[1]);
      descHeight = parseFloat(descHeight[1]);
      let xHeight = letterHeight - ascHeight - descHeight;
      lineFontSize = await getFontSize(defaultFont, "normal", xHeight, "o");
    } else if (letterHeight != null) {
      letterHeight = parseFloat(letterHeight[1]);
      descHeight = descHeight != null ? parseFloat(descHeight[1]) : 0;
      lineFontSize = await getFontSize(defaultFont, "normal", letterHeight - descHeight, "A");
    }

    // If none of the above conditions are met (not enough info to calculate font size), the font size from the previous line is reused.
    ctx.font = 1000 + 'px ' + defaultFont;
    //const AMetrics = ctx.measureText("A");
    const oMetrics = ctx.measureText("o");
    //const jMetrics = ctx.measureText("gjpqy");
    ctx.font = lineFontSize + 'px ' + defaultFont;

    const colorModeElem = /** @type {HTMLInputElement} */(document.getElementById('colorMode'));
    let angleAdjXLine = 0;
    let angleAdjYLine = 0;
    if ((autoRotateCheckboxElem.checked) && Math.abs(angle ?? 0) > 0.05) {

      const x = linebox[0];
      const y = linebox[3] + baseline[1];

      const xRot = x * cosAngle - sinAngle * y;
      const yRot = x * sinAngle + cosAngle * y;

      const angleAdjXInt = x - xRot;
      // const angleAdjYInt = y - yRot;

      // const angleAdjXInt = sinAngle * (linebox[3] + baseline[1]);
      const angleAdjYInt = sinAngle * (linebox[0] + angleAdjXInt / 2) * -1;

      angleAdjXLine = angleAdjXInt + shiftX;
      angleAdjYLine = angleAdjYInt + shiftY;

    }

    for (let j = 0; j < words.length; j++) {
      let word = words[j];

      let titleStr = word.getAttribute('title') ?? "";
      let styleStr = word.getAttribute('style') ?? "";

      const compCount = word.getAttribute('compCount') ?? "";
      const compStatus = word.getAttribute('compStatus') ?? "";
      //const matchTruth = compCount == "1" && compStatus == "1";
      const matchTruth = compStatus == "1";
      const fillColorHexMatch = matchTruth ? "#00ff7b" : "#ff0000";

      if (!word.childNodes[0]?.textContent.trim()) continue;

      let box = [...titleStr.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); })
      let box_width = box[2] - box[0];
      let box_height = box[3] - box[1];

      let angleAdjXWord = angleAdjXLine;
      if((autoRotateCheckboxElem.checked) && Math.abs(angle) >= 1) {

        angleAdjXWord = angleAdjXWord + ((box[0] - linebox[0]) / cosAngle - (box[0] - linebox[0]));

      }


      let wordText, wordSup, wordDropCap;
      if (/\<sup\>/i.test(word.innerHTML)) {
        wordText = word.innerHTML.replace(/^\s*\<sup\>/i, "");
        wordText = wordText.replace(/\<\/sup\>\s*$/i, "");
        wordSup = true;
        wordDropCap = false;
      } else if (/\<span class\=[\'\"]ocr_dropcap[\'\"]\>/i.test(word.innerHTML)) {
        wordText = word.innerHTML.replace(/^\s*<span class\=[\'\"]ocr_dropcap[\'\"]\>/i, "");
        wordText = wordText.replace(/\<\/span\>\s*$/i, "");
        wordSup = false;
        wordDropCap = true;
      } else {
        wordText = word.childNodes[0].nodeValue;
        wordSup = false;
        wordDropCap = false;
      }

      let fontStyle;
      if (/italic/i.test(styleStr)) {
        fontStyle = "italic";
      } else if (/small\-caps/i.test(styleStr)) {
        fontStyle = "small-caps";
      } else {
        fontStyle = "normal";
      }


      let wordFontFamily = styleStr.match(/font\-family\s{0,3}\:\s{0,3}[\'\"]?([^\'\";]+)/)?.[1];
      let defaultFontFamily;
      if (wordFontFamily == null) {
        wordFontFamily = defaultFont;
        defaultFontFamily = true;
      } else {
        wordFontFamily = wordFontFamily.trim();
        defaultFontFamily = false;
      }

      let wordFontSize;
      let scaleX = 1;
      let fontSizeStr = styleStr.match(/font\-size\:\s*(\d+)/i);
      if (fontSizeStr != null) {
        wordFontSize = parseFloat(fontSizeStr[1]);
      } else if (wordSup) {
        // All superscripts are assumed to be numbers for now
        wordFontSize = await getFontSize(defaultFont, "normal", box_height, "1");
      } else if (wordDropCap) {
        wordFontSize = await getFontSize(defaultFont, "normal", box_height, wordText.slice(0, 1));
        const wordWidthFont = (await calcWordMetrics(wordText.slice(0, 1), wordFontFamily, wordFontSize, fontStyle)).visualWidth;
        scaleX = (box_width / wordWidthFont);
  
      } else {
        wordFontSize = lineFontSize;
      }


      let confMatch = titleStr.match(/(?:;|\s)x_wconf\s+(\d+)/);
      let wordConf = 0;
      if (confMatch != null) {
        wordConf = parseInt(confMatch[1]);
      }

      let word_id = word.getAttribute('id');

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

      const charSpacing = await calcCharSpacing(wordText, wordFontFamily, fontStyle, wordFontSize, box_width);

      const fontObjI = await fontObj[wordFontFamily][fontStyle];
      let wordFirstGlyphMetrics = fontObjI.charToGlyph(wordText.substr(0, 1)).getMetrics();

      let wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / fontObjI.unitsPerEm);

        // The function fontBoundingBoxDescent currently is not enabled by default in Firefox.
        // Can return to this simpler code if that changes.
        // https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics/fontBoundingBoxDescent
        //let fontDesc = (jMetrics.fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (fontSize / 1000);

        let fontBoundingBoxDescent = Math.round(Math.abs(fontObjI.descender) * (1000 / fontObjI.unitsPerEm));

        let fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (wordFontSize / 1000);

        let baselineWord;
        let visualBaseline;
        if (wordSup || wordDropCap) {

          baselineWord = box[3];

          let angleAdjYWord = angleAdjYLine;

          // Recalculate the angle adjustments (given different x and y coordinates)
          if ((autoRotateCheckboxElem.checked) && Math.abs(angle ?? 0) > 0.05) {

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
          visualBaseline = linebox[3] + baseline[1] + angleAdjYLine;
        }

        const top = visualBaseline + fontDesc;

        const visualLeft = box[0] + angleAdjXWord + leftAdjX;
        const left = visualLeft - wordLeftBearing;

        let wordFontFamilyCanvas = fontStyle == "small-caps" ? wordFontFamily + " Small Caps" : wordFontFamily;
        let fontStyleCanvas = fontStyle == "small-caps" ? "normal" : fontStyle;

        const textBackgroundColor = globalThis.find.search && wordText.toLowerCase().includes(globalThis.find.search?.toLowerCase()) ? '#4278f550' : '';

        let textbox = new fabric.IText(wordText, {
          left: left,
          //top: y,
          top: top,
          leftOrig: left,
          topOrig: top,
          baselineAdj: 0,
          wordSup: wordSup,
          originY: "bottom",
          fill: fill_arg,
          fill_proof: fillColorHex,
          fill_ebook: 'black',
          fill_eval: fillColorHexMatch,
          fontFamily: wordFontFamilyCanvas,
          fontStyle: fontStyleCanvas,

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
          showTextBoxBorder: showBoundingBoxesElem.checked
        });

        textbox.hasControls = true;
        textbox.setControlsVisibility({bl:false,br:false,mb:false,ml:true,mr:true,mt:false,tl:false,tr:false,mtr:false});

        let renderWordBoxes = false;
        if (renderWordBoxes) {
          let rect = new fabric.Rect({
            left: left,
            top: top,
            originY: "bottom",
            width: box_width,
            height: box_height,
            stroke: '#287bb5',
            fill: false,
            opacity: 0.7
          });
          rect.hasControls = false;
          rect.hoverCursor = false;
          canvas.add(rect);
        }


        textbox.on('editing:exited', async function () {
          console.log("Event: editing:exited");
          if (this.hasStateChanged) {
            if (document.getElementById("smartQuotes").checked && /[\'\"]/.test(this.text)) {
              let textInt = this.text;
              textInt = textInt.replace(/(^|[-–—])\'/, "$1‘");
              textInt = textInt.replace(/(^|[-–—])\"/, "$1“");
              textInt = textInt.replace(/\'(?=$|[-–—])/, "’");
              textInt = textInt.replace(/\"(?=$|[-–—])/, "”");
              textInt = textInt.replace(/([a-z])\'(?=[a-z]$)/i, "$1’");
              this.text = textInt;
            }

            await updateWordCanvas(this);
            updateHOCRWord(this.wordID, this.text)
          }
        });
        textbox.on('selected', function () {
          // If multiple words are selected in a group, all the words in the group need to be considered when setting the UI
          if (this.group) {
            if (!this.group.style) {
              let fontFamilyGroup = null;
              let fontSizeGroup = null;
              let supGroup = null;
              let italicGroup = null;
              let smallCapsGroup = null;
              let singleFontFamily = true;
              let singleFontSize = true;
              for (let i=0; i<this.group._objects.length; i++) {
                const wordI = this.group._objects[i];
                // If there is no wordID then this object must be something other than a word
                if (!wordI.wordID) continue;
    
                // Font style and font size consider all words in the group
                if (fontFamilyGroup == null) {
                  fontFamilyGroup = wordI.fontFamily.replace(/ Small Caps/, "");
                } else {
                  if (wordI.fontFamily.replace(/ Small Caps/, "") != fontFamilyGroup) {
                    singleFontFamily = false;
                  }
                }
    
                if (fontSizeGroup == null) {
                  fontSizeGroup = wordI.fontSize;
                } else {
                  if (wordI.fontSize != fontSizeGroup) {
                    singleFontSize = false;
                  }
                }
    
                // Style toggles only consider the first word in the group
                if (supGroup == null) supGroup = wordI.wordSup;
                if (italicGroup == null) italicGroup = wordI.fontStyle == "italic";
                if (smallCapsGroup == null) smallCapsGroup = /Small Caps/i.test(wordI.fontFamily);
              }
    
              this.group.style = {
                fontFamily: singleFontFamily ? fontFamilyGroup : "",
                fontSize: singleFontSize ? fontSizeGroup : "",
                sup: supGroup,
                italic: italicGroup ,
                smallCaps: smallCapsGroup
              }
    
              wordFontElem.value = this.group.style.fontFamily;
              fontSizeElem.value = this.group.style.fontSize;
    
              if(this.group.style.sup != styleSuperElem.classList.contains("active")) {
                styleSuperButton.toggle();
              }
              if(this.group.style.italic != styleItalicElem.classList.contains("active")) {
                styleItalicButton.toggle();
              }
              if(this.group.style.smallCaps != styleSmallCapsElem.classList.contains("active")) {
                styleSmallCapsButton.toggle();
              }  
            }
    
          // If only one word is selected, we can just use the values for that one word
          } else {
            const fontFamily = this.fontFamily.replace(/ Small Caps/, "");
            if (!this.defaultFontFamily && Object.keys(globalThis.fontObj).includes(fontFamily)) {
              wordFontElem.value = fontFamily;
            }
            fontSizeElem.value = this.fontSize;
            if(this.wordSup != styleSuperElem.classList.contains("active")) {
              styleSuperButton.toggle();
            }
            const italic = this.fontStyle == "italic";
            if(italic != styleItalicElem.classList.contains("active")) {
              styleItalicButton.toggle();
            }
            const smallCaps = /Small Caps/i.test(this.fontFamily);
            if(smallCaps != styleSmallCapsElem.classList.contains("active")) {
              styleSmallCapsButton.toggle();
            }  
          }
        });
            textbox.on('deselected', function () {
          console.log("Event: deselected");
          wordFontElem.value = "Default";
          //document.getElementById("collapseRange").setAttribute("class", "collapse");
          bsCollapse.hide();
          rangeBaselineElem.value = "100";
        });
        textbox.on('modified', async (opt) => {
          // inspect action and check if the value is what you are looking for
          console.log("Event: " + opt.action);
          if (opt.action == "scaleX") {
            const textboxWidth = opt.target.calcTextWidth();

            const wordMetrics = await calcWordMetrics(opt.target.text, opt.target.fontFamily, opt.target.fontSize, opt.target.fontStyle);
            const visualWidthNew = (textboxWidth - wordMetrics["leftSideBearing"] - wordMetrics["rightSideBearing"]) * opt.target.scaleX;

            let visualRightNew = opt.target.left + visualWidthNew;
            let visualRightOrig = opt.target.leftOrig + opt.target.visualWidth;

            updateHOCRBoundingBoxWord(opt.target.wordID, Math.round(opt.target.left - opt.target.leftOrig), Math.round(visualRightNew - visualRightOrig));
            if (opt.target.text.length > 1) {


              const widthDelta = visualWidthNew - opt.target.visualWidth;
              if (widthDelta != 0) {
                const charSpacingDelta = (widthDelta / (opt.target.text.length - 1)) * 1000 / opt.target.fontSize;
                opt.target.charSpacing = (opt.target.charSpacing ?? 0) + charSpacingDelta;
                opt.target.scaleX = 1;

              }

            }
            opt.target.leftOrig = opt.target.left;
            opt.target.visualWidth = visualWidthNew;
          }
        });


        // TODO: A prototype for the texboxes should be created instead of adding to each one

        canvas.add(textbox);

    }
  }

  if (layoutMode) {

    renderLayoutBoxes(Object.keys(globalThis.layout[currentPage.n]["boxes"]));

  }

}