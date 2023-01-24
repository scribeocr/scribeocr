
import { getFontSize, calcWordMetrics, calcCharSpacing } from "./textUtils.js"
import { updateHOCRBoundingBoxWord, updateHOCRWord } from "./interfaceEdit.js";
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


export async function renderPage(canvas, doc, xmlDoc, mode = "screen", defaultFont, lineMode = false, imgDims, canvasDims, angle, pdfMode, fontObj, leftAdjX) {

  let ctx = canvas.getContext('2d');

  const layoutMode = true;

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


      const confThreshHigh = document.getElementById("confThreshHigh").value != "" ? parseInt(document.getElementById("confThreshHigh").value) : 85;
      const confThreshMed = document.getElementById("confThreshMed").value != "" ? parseInt(document.getElementById("confThreshMed").value) : 75;

      let fillColorHex;
      if (wordConf > confThreshHigh) {
        // fillColorRGB = "rgb(0,255,125)"
        fillColorHex = "#00ff7b";
      } else if (wordConf > confThreshMed) {
        // fillColorRGB = "rgb(255,200,0)"
        fillColorHex = "#ffc800";
      } else {
        // fillColorRGB = "rgb(255,0,0)"
        fillColorHex = "#ff0000";
      }

      const displayMode = document.getElementById('displayMode').value;

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
        let top;
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

          top = box[3] + fontDesc + angleAdjYWord;
      
        } else {
          top = linebox[3] + baseline[1] + fontDesc + angleAdjYLine;
        }

        const left = box[0] - wordLeftBearing + angleAdjXWord + leftAdjX;

        let wordFontFamilyCanvas = fontStyle == "small-caps" ? wordFontFamily + " Small Caps" : wordFontFamily;
        let fontStyleCanvas = fontStyle == "small-caps" ? "normal" : fontStyle;
        // let wordFontFamilyCanvas = wordFontFamily;
        // let fontStyleCanvas = fontStyle;

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
          wordID: word_id,
          line: i,
          visualWidth: box_width,
          scaleX: scaleX,
          defaultFontFamily: defaultFontFamily,
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

            const visualWidthNew = (await calcWordMetrics(this.text, this.fontFamily, this.fontSize, this.fontStyle)).visualWidth;
            if (this.text.length > 1) {
              const charSpacing = (this.visualWidth - visualWidthNew) / (this.text.length - 1);
              this.charSpacing = charSpacing * 1000 / this.fontSize;
            }
            updateHOCRWord(this.wordID, this.text)
          }
        });
        textbox.on('selected', function () {
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
    for (const [id, obj] of Object.entries(globalThis.layout[currentPage.n]["boxes"])) {

      const origX = obj["coords"][0];
      const origY = obj["coords"][1];
      const width = obj["coords"][2] - obj["coords"][0];
      const height = obj["coords"][3] - obj["coords"][1];

      const rect = new fabric.Rect({
        left: origX,
        top: origY,
        width: width,
        height: height,
        originX: 'left',
        originY: 'top',
        angle: 0,
        fill: 'rgba(255,0,0,0.5)',
        transparentCorners: false,
        lockMovementX: false,
        lockMovementY: false,
        id: id,
        scribeType: "layoutRect"
        // preserveObjectStacking: true
      });
      rect.hasControls = true;
      rect.setControlsVisibility({bl:true,br:true,mb:true,ml:true,mr:true,mt:true,tl:true,tr:true,mtr:false});
  
      const textbox = new fabric.IText(String(obj["priority"]), {
        left: Math.round(origX + width * 0.5),
        top: Math.round(origY + height * 0.5),
        originX: "center",
        originY: "center",
        textBackgroundColor: 'rgb(255,255,255)',
        fontSize: 150,
        id: id,
        scribeType: "layoutTextbox"
  
      });      
  
      textbox.hasControls = true;
      textbox.setControlsVisibility({bl:false,br:false,mb:false,ml:true,mr:true,mt:false,tl:false,tr:false,mtr:false});
  
  
      rect.on({'moving': onChange})
      rect.on({'scaling': onChange})
  
      function onChange(obj) {
        const target = obj.transform.target;
  
        // Adjust location of textbox
        textbox.left = (target.aCoords.tl.x + target.aCoords.br.x) * 0.5;
        textbox.top = (target.aCoords.tl.y + target.aCoords.br.y) * 0.5;        
        textbox.setCoords();
      }
  
      rect.on({"mouseup": updateLayoutBoxes})
  
      function updateLayoutBoxes(obj) {
        const target = obj.target;
        const id = target.id;
  
        globalThis.layout[currentPage.n]["boxes"][id]["coords"] = [target.aCoords.tl.x, target.aCoords.tl.y, target.aCoords.br.x, target.aCoords.br.y];
      }
  
      textbox.on('editing:exited', async function (obj) {
        if (this.hasStateChanged) {
          const id = this.id;
          globalThis.layout[currentPage.n]["boxes"][id]["priority"] = parseInt(this.text);
        }
      });
      
      canvas.add(rect);
      canvas.add(textbox);
  

    }
  }

}