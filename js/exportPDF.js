
import { win1252Chars, winEncodingLookup } from "../fonts/encoding.js";

import { getFontSize, calcCharSpacing, calcWordMetrics } from "./textUtils.js";

import { replaceLigatures } from "./miscUtils.js";
import { loadFontBrowser } from "./fontUtils.js";

// Function for converting from bufferArray to hex (string)
// Taken from https://stackoverflow.com/questions/40031688/javascript-arraybuffer-to-hex
const byteToHex = [];

for (let n = 0; n <= 0xff; ++n)
{
    const hexOctet = n.toString(16).padStart(2, "0");
    byteToHex.push(hexOctet);
}

function hex(arrayBuffer)
{
    const buff = new Uint8Array(arrayBuffer);
    const hexOctets = []; // new Array(buff.length) is even faster (preallocates necessary array size), then use hexOctets[i] instead of .push()

    for (let i = 0; i < buff.length; ++i)
        hexOctets.push(byteToHex[buff[i]]);

    return hexOctets.join("");
}

// Creates 3 PDF objects necessary to embed font.
// These are (1) the font dictionary, (2) the font descriptor, and (3) the font file,
// which will be located at objects firstObjIndex, firstObjIndex + 1, and firstObjIndex + 2 (respectively). 
function createFontObj(font, firstObjIndex){

  // Start 1st object: Font Dictionary
  let objOut = String(firstObjIndex) + " 0 obj\n<</Type/Font/Subtype/Type1";

  // Add font name
  objOut += "\n/BaseFont/" + font.tables.name.postScriptName.en;

  objOut += "/Encoding/WinAnsiEncoding";

  const cmapIndices = Object.keys(font.tables.cmap.glyphIndexMap).map((x) => parseInt(x));

  objOut += "/Widths[";
  for(let i=0;i<win1252Chars.length;i++) {
    const advanceNorm = Math.round(font.charToGlyph(win1252Chars[i]).advanceWidth * (1000 / font.unitsPerEm));
    objOut += String(advanceNorm) + " ";
  }
  objOut += "]/FirstChar 32/LastChar 255";

  objOut += "/FontDescriptor " + String(firstObjIndex + 1) + " 0 R>>\nendobj\n\n";

  // Start 2nd object: Font Descriptor
  objOut += String(firstObjIndex + 1) + " 0 obj\n<</Type/FontDescriptor";

  objOut += "/FontName/" + font.tables.name.postScriptName.en;

  objOut += "/FontBBox[" + [font.tables.head.xMin, font.tables.head.yMin, font.tables.head.xMax, font.tables.head.yMax].join(" ") + "]";

  objOut += "/ItalicAngle " + String(font.tables.post.italicAngle);

  objOut += "/Ascent " + String(font.ascender);

  objOut += "/Descent " + String(font.descender);

  // StemV is a required field, however it is not already in the opentype font, and does not appear to matter.
  // Therefore, we set to 0.08 * em to mimic the behavior of other programs.
  // https://www.verypdf.com/document/pdf-format-reference/pg_0457.htm
  // https://stackoverflow.com/questions/35485179/stemv-value-of-the-truetype-font
  objOut += "/StemV " + String(Math.round(0.08 * font.unitsPerEm));

  objOut += "/Flags " + String(font.tables.head.flags);

  objOut += "/FontFile3 " + String(firstObjIndex + 2) + " 0 R>>\nendobj\n\n";

  // Start 3rd object: Font File
  const fontBuffer = font.toArrayBuffer();
  const fontHexStr = hex(fontBuffer);

  objOut += String(firstObjIndex + 2) + " 0 obj\n<</Length1 " + String(fontBuffer.byteLength) + "/Subtype/OpenType/Length " + String(fontHexStr.length) + "/Filter/ASCIIHexDecode>>\nstream\n"

  objOut += fontHexStr + "\nendstream\nendobj\n\n"

  return objOut;

}

// This is different than wordRegex in the convertPage.js file, as here we assume that the xml is already at the word-level (no character-level elements).
const wordRegex = new RegExp(/<span class\=[\"\']ocrx_word[\s\S]+?(?:\<\/span\>\s*)/, "ig");

export async function hocrToPDF(hocrArr, minpage = 0, maxpage = -1, textMode = "ebook", rotateText = false, rotateBackground = false, dimsLimit = [-1,-1], progress = null, confThreshHigh = 85, confThreshMed = 75) {

  // Get count of various objects inserted into pdf
  let fontCount = 0;
  for (const [familyKey, familyObj] of Object.entries(globalThis.fontObj)) {
    for (const [key, value] of Object.entries(familyObj)) {
      fontCount += 1;
    }
  }
  const fontObjCount = fontCount * 3;

  if (maxpage == -1) {
    maxpage = hocrArr.length - 1;
  }

  let pdfOut = "%PDF-1.7\n%¥±ë\n\n"
  
  pdfOut += "1 0 obj\n<< /Type /Catalog\n/Pages 2 0 R>>\nendobj\n\n";

  pdfOut += "2 0 obj\n<< /Type /Pages\n/Kids [";
  for(let i=0;i<(maxpage - minpage + 1);i++) {
    pdfOut += String(3 + fontObjCount + 2 + i * 2) + " 0 R\n";
  }
  pdfOut += "]\n/Count " + String(maxpage - minpage + 1) + ">>\nendobj\n\n";

  // Add fonts
  // All fonts are added at this step. 
  // The fonts that are not used will be removed by muPDF later.
  let fontI = 0;
  let pdfFonts = {};
  let pdfFontsStr = "";
  for (const [familyKey, familyObj] of Object.entries(globalThis.fontObj)) {
    pdfFonts[familyKey] = {};
    for (const [key, value] of Object.entries(familyObj)) {
      const font = await value;
      pdfOut += createFontObj(font, 3 + fontI * 3);

      pdfFonts[familyKey][key] = "/F" + String(fontI);
      pdfFontsStr += "/F" + String(fontI) + " " + String(3 + fontI * 3) + " 0 R\n";
      fontI++;
      
    }
  }

  // Add resource dictionary
  // For simplicity, all pages currently get the same resource dictionary.
  // It contains references to every font, as well as a graphics state with 0 opacity (used for invisible text in OCR mode).
  pdfOut += String(3 + fontObjCount) + " 0 obj\n<<";
  
  pdfOut += "/Font<<" + pdfFontsStr + ">>";

  pdfOut += "/ExtGState<</GS0 <</ca 0.0>>>>";
  
  pdfOut += ">>\nendobj\n\n";

  const pageResourceStr = "/Resources " + String(3 + fontObjCount) + " 0 R";

  // Add pages
  for(let i=minpage;i<=maxpage;i++) {
    const angle = globalThis.pageMetricsObj["angleAll"][i] || 0;
    let dims = globalThis.pageMetricsObj.dimsAll[i];

    pdfOut += (await hocrPageToPDF( hocrArr[i], dims, dimsLimit, 3 + fontObjCount + 1 + (i - minpage) * 2, 2, pageResourceStr, pdfFonts, textMode, angle, rotateText, rotateBackground, confThreshHigh, confThreshMed));
    if (progress) progress.increment();
  }

  // This part is completely wrong (copy/pasted from an example document), however it does not seem to impact the ability to view the document,
  // and muPDF fixes for the documents where we use it. 
  pdfOut += String.raw`xref
  0 5
  0000000000 65535 f 
  0000000018 00000 n 
  0000000077 00000 n 
  0000000178 00000 n 
  0000000457 00000 n 
  trailer
    <<  /Root 1 0 R
        /Size 5
    >>
  startxref
  565
  %%EOF
  `

  return pdfOut;

}

async function hocrPageToPDF(hocrStr, inputDims, outputDims, firstObjIndex, parentIndex, pageResourceStr, pdfFonts, textMode, angle, rotateText = false, rotateBackground = false, confThreshHigh = 85, confThreshMed = 75) {

  if (outputDims[0] < 1) {
    outputDims = inputDims;
  }

  // Note: Text may contain nested elements (e.g. `<span class="ocr_dropcap">`) so it cannot be assumed that `</span></span>` indicates the end of the line
  const lines = hocrStr?.split(/(?=<span class\=[\"\']ocr_line)/g)?.slice(1);

  // Start 2nd object: Page
  let secondObj = String(firstObjIndex + 1) + " 0 obj\n<</Type/Page/MediaBox[0 0 " + String(outputDims[1]) + " " + String(outputDims[0]) + "]";

  if (lines) secondObj += "/Contents " + String(firstObjIndex) + " 0 R";

  secondObj += pageResourceStr + "/Parent " + parentIndex + " 0 R>>\nendobj\n\n";  

  // If there is no text content, return the empty page with no contents
  if(!lines) return secondObj;

  const sinAngle = Math.sin(angle * (Math.PI / 180));
  const cosAngle = Math.cos(angle * (Math.PI / 180));

  const shiftX = sinAngle * (inputDims[0] * 0.5) * -1 || 0;
  const shiftY = sinAngle * ((inputDims[1] - shiftX) * 0.5) || 0;

  // Start 1st object: Text Content
  let textStream = "";

  if (textMode == "invis") {
    textStream += "/GS0 gs\n";
  }

  textStream += "BT\n";

  let lineFontSize = 10;

  // textStream += "1 0 0 rg\n";


  // Locations are often specified using an offset against the leftmost point of the current line.
  let lineOrigin = [0,0];

  // Move cursor to top of the page
  textStream += "1 0 0 1 0 " + String(outputDims[0]) + " Tm\n";

  let pdfFontCurrent = "";

  for(let i=0;i<lines.length;i++) {

    const line = lines[i];

    const titleStrLine = line.match(/title\=[\'\"]([^\'\"]+)/)?.[1];

    let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
    if (baseline != null) {
      baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });
    } else {
      baseline = [0, 0];
    }

    const linebox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x) });

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
      lineFontSize = await getFontSize(globalThis.globalSettings.defaultFont, "normal", xHeight, "o");
    } else if (letterHeight != null) {
      letterHeight = parseFloat(letterHeight[1]);
      descHeight = descHeight != null ? parseFloat(descHeight[1]) : 0;
      lineFontSize = await getFontSize(globalThis.globalSettings.defaultFont, "normal", letterHeight - descHeight, "A");
    }

    const words = line.match(wordRegex);
    const word = words[0];
    const wordSup = /\<sup\>/i.test(word);
    const wordDropCap = /\<span class\=[\'\"]ocr_dropcap[\'\"]\>/i.test(word);
    let wordText;
    if(wordSup) {
      wordText = word.replace(/\s*\<sup\>/i, "").replace(/\<\/sup\>\s*/i, "").match(/>([^>]*)</)?.[1]?.replace(/&quot;/, "\"")?.replace(/&apos;/, "'")?.replace(/&lt;/, "<")?.replace(/&gt;/, ">")?.replace(/&amp;/, "&");
    } else if(wordDropCap) {
      wordText = word.replace(/\s*<span class\=[\'\"]ocr_dropcap[\'\"]\>/i, "").match(/>([^>]*)</)?.[1]?.replace(/&quot;/, "\"")?.replace(/&apos;/, "'")?.replace(/&lt;/, "<")?.replace(/&gt;/, ">")?.replace(/&amp;/, "&");
    } else {
      wordText = word.match(/>([^>]*)</)?.[1]?.replace(/&quot;/, "\"")?.replace(/&apos;/, "'")?.replace(/&lt;/, "<")?.replace(/&gt;/, ">")?.replace(/&amp;/, "&");
    }      

    const titleStrWord = word.match(/title\=[\'\"]([^\'\"]+)/)?.[1];
    const wordBox = [...titleStrWord.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x) });

    const styleStr = word.match(/style\=[\'\"]([^\'\"]+)/)?.[1];
    let wordFontFamily = styleStr?.match(/font\-family\s{0,3}\:\s{0,3}[\'\"]?([^\'\";]+)/)?.[1] || globalThis.globalSettings.defaultFont;

    let fontStyle;
    if (/italic/i.test(styleStr)) {
      fontStyle = "italic";
    } else if (/small\-caps/i.test(styleStr)) {
      fontStyle = "small-caps";
    } else {
      fontStyle = "normal";
    }

    let fillColor = "0 0 0 rg";
    if (textMode == "proof") {
      let confMatch = titleStrWord.match(/(?:;|\s)x_wconf\s+(\d+)/);
      let wordConf = 0;
      if (confMatch != null) {
        wordConf = parseInt(confMatch[1]);
      }
      if (wordConf > confThreshHigh) {
        fillColor = "0 1 0.5 rg";
      } else if (wordConf > confThreshMed) {
        fillColor = "1 0.8 0 rg";
      } else {
        fillColor = "1 0 0 rg";
      }
  
    }

    let angleAdjXLine = 0;
    let angleAdjYLine = 0;
    if (rotateBackground && Math.abs(angle ?? 0) > 0.05) {

      const x = linebox[0];
      const y = linebox[3] + baseline[1];

      const xRot = x * cosAngle - sinAngle * y;
      const yRot = x * sinAngle + cosAngle * y;

      const angleAdjXInt = x - xRot;

      const angleAdjYInt = sinAngle * (linebox[0] + angleAdjXInt / 2) * -1;

      angleAdjXLine = angleAdjXInt + shiftX;
      angleAdjYLine = angleAdjYInt + shiftY;

    }

    
    let fillColorCurrent = fillColor;

    textStream += fillColor + "\n";

    const fontObjI = await globalThis.fontObj[wordFontFamily][fontStyle];

    // Set font and font size
    textStream += pdfFonts[wordFontFamily][fontStyle] + " " + String(lineFontSize) + " Tf\n";
    pdfFontCurrent = pdfFonts[wordFontFamily][fontStyle];

    // Reset baseline to line baseline
    textStream += "0 Ts\n";

    let wordFontSize;
    let fontSizeStr = styleStr?.match(/font\-size\:\s*(\d+)/i);
    if (fontSizeStr != null) {
      wordFontSize = parseFloat(fontSizeStr[1]);
    } else if (wordSup) {
      // All superscripts are assumed to be numbers for now
      wordFontSize = await getFontSize(wordFontFamily, "normal", wordBox[3] - wordBox[1], "1");
    } else if (wordDropCap) {
      wordFontSize = await getFontSize(wordFontFamily, "normal", wordBox[3] - wordBox[1], wordText.slice(0, 1));
    } else {
      wordFontSize = lineFontSize;
    }

    let tz = 100;
    if (wordDropCap) {
      const wordWidthActual = wordBox[2] - wordBox[0];
      const wordWidthFont = (await calcWordMetrics(wordText.slice(0, 1), wordFontFamily, wordFontSize, fontStyle)).visualWidth;
      tz = (wordWidthActual / wordWidthFont) * 100;
    }

    const wordFirstGlyphMetrics = fontObjI.charToGlyph(wordText.substr(0, 1)).getMetrics();
    
    const wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / fontObjI.unitsPerEm);

    // Move to next line
    const lineLeftAdj = wordBox[0] - wordLeftBearing * (tz / 100) + angleAdjXLine;
    const lineTopAdj = linebox[3] + baseline[1] + angleAdjYLine;

    if (rotateText) {
      textStream += String(cosAngle) + " " + String(-sinAngle) + " " + String(sinAngle) + " " + String(cosAngle) + " " + String(lineLeftAdj) + " " + String(outputDims[0] - lineTopAdj) + " Tm\n";
    } else {
      textStream += String(1) + " " + String(0) + " " + String(0) + " " + String(1) + " " + String(lineLeftAdj) + " " + String(outputDims[0] - lineTopAdj) + " Tm\n";
    }

    lineOrigin[0] = lineLeftAdj;
    lineOrigin[1] = lineTopAdj;

    textStream += "[ ";

    let wordBoxLast = [0,0,0,0];
    let wordRightBearingLast = 0;
    let charSpacing = 0;
    let spacingAdj = 0;
    let wordFontFamilyLast = wordFontFamily;
    let fontStyleLast = fontStyle;
    let fontSizeLast = lineFontSize;
    let tsCurrent = 0;
    let tzCurrent = 100;

    for(let j=0;j<words.length;j++){
      const word = words[j];

      const wordSup = /\<sup\>/i.test(word);
      const wordDropCap = /\<span class\=[\'\"]ocr_dropcap[\'\"]\>/i.test(word);
      let wordText;
      if(wordSup) {
        wordText = word.replace(/\s*\<sup\>/i, "").replace(/\<\/sup\>\s*/i, "").match(/>([^>]*)</)?.[1]?.replace(/&quot;/, "\"")?.replace(/&apos;/, "'")?.replace(/&lt;/, "<")?.replace(/&gt;/, ">")?.replace(/&amp;/, "&");
      } else if(wordDropCap) {
        wordText = word.replace(/\s*<span class\=[\'\"]ocr_dropcap[\'\"]\>/i, "").match(/>([^>]*)</)?.[1]?.replace(/&quot;/, "\"")?.replace(/&apos;/, "'")?.replace(/&lt;/, "<")?.replace(/&gt;/, ">")?.replace(/&amp;/, "&");
      } else {
        wordText = word.match(/>([^>]*)</)?.[1]?.replace(/&quot;/, "\"")?.replace(/&apos;/, "'")?.replace(/&lt;/, "<")?.replace(/&gt;/, ">")?.replace(/&amp;/, "&");
      }      

      // Ligatures are not in the encoding dictionary so would not be displayed correctly
      wordText = replaceLigatures(wordText);

      const titleStrWord = word.match(/title\=[\'\"]([^\'\"]+)/)?.[1];
      const wordBox = [...titleStrWord.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x) });

      const styleStr = word.match(/style\=[\'\"]([^\'\"]+)/)?.[1];
      let wordFontFamily = styleStr?.match(/font\-family\s{0,3}\:\s{0,3}[\'\"]?([^\'\";]+)/)?.[1] || globalThis.globalSettings.defaultFont;

      let wordFontSize;
      let fontSizeStr = styleStr?.match(/font\-size\:\s*(\d+)/i);
      if (fontSizeStr != null) {
        wordFontSize = parseFloat(fontSizeStr[1]);
      } else if (wordSup) {
        // All superscripts are assumed to be numbers for now
        wordFontSize = await getFontSize(wordFontFamily, "normal", wordBox[3] - wordBox[1], "1");
      } else if (wordDropCap) {
        wordFontSize = await getFontSize(wordFontFamily, "normal", wordBox[3] - wordBox[1], wordText.slice(0, 1));
      } else {
        wordFontSize = lineFontSize;
      }

      let fontStyle;
      if (/italic/i.test(styleStr)) {
        fontStyle = "italic";
      } else if (/small\-caps/i.test(styleStr)) {
        fontStyle = "small-caps";
      } else {
        fontStyle = "normal";
      }

      let fillColor = "0 0 0 rg";
      if (textMode == "proof") {
        
        let confMatch = titleStrWord.match(/(?:;|\s)x_wconf\s+(\d+)/);
        let wordConf = 0;
        if (confMatch != null) {
          wordConf = parseInt(confMatch[1]);
        }
  
        if (wordConf > confThreshHigh) {
          fillColor = "0 1 0.5 rg";
        } else if (wordConf > confThreshMed) {
          fillColor = "1 0.8 0 rg";
        } else {
          fillColor = "1 0 0 rg";
        }  
      } else if (textMode == "eval") {
        const compStatus = word.match(/compStatus\=[\'\"]([^\'\"]+)/)?.[1] ?? "";
        const matchTruth = compStatus == "1";
        fillColor = matchTruth ? "0 1 0.5 rg" : "1 0 0 rg";
      }

      const sinAngle = 0;
      const angleAdjYLine = 0;
      let angleAdjYSup = rotateText ? sinAngle * (wordBox[0] - linebox[0]) * -1 : 0;
  
      let ts = 0;
      if (wordSup) {
        ts = (angleAdjYLine + (wordBox[3] - (linebox[3] + baseline[1])) + angleAdjYSup) * -1;
      } else if(wordDropCap) {
        ts = (linebox[3] + baseline[1]) - wordBox[3] + angleAdjYLine + angleAdjYSup;
      } else {
        ts = 0;
      }

      let tz = 100;
      if (wordDropCap) {
        const wordWidthActual = wordBox[2] - wordBox[0];
        const wordWidthFont = (await calcWordMetrics(wordText.slice(0, 1), wordFontFamilyLast, wordFontSize, fontStyle)).visualWidth;
        tz = (wordWidthActual / wordWidthFont) * 100;
      }

      const font = await globalThis.fontObj[wordFontFamily][fontStyle];
      const pdfFont = pdfFonts[wordFontFamily][fontStyle];

      let wordFirstGlyphMetrics = font.charToGlyph(wordText.substr(0, 1)).getMetrics();
      let wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / font.unitsPerEm);

      // Add space character between words
      if(j > 0) {
        // Actual space (# of pixels in image) between end of last word's bounding box and start of this word's bounding box
        const wordSpaceActual = wordBox[0] - wordBoxLast[2];

        // When the angle is significant, words need to be spaced differently due to rotation.
        let angleAdj = 0;
        if(rotateText && Math.abs(angle) >= 1) {
          angleAdj = ((wordBox[0] - wordBoxLast[0]) / cosAngle - (wordBox[0] - wordBoxLast[0]));
        }
        
        const wordSpaceActualAdj = wordSpaceActual + angleAdj;

        // The space between words determined by:
        // (1) The right bearing of the last word, (2) the left bearing of the current word, (3) the width of the space character between words,
        // (4) the current character spacing value (applied twice--both before and after the space character).
        const spaceWidth = (await calcWordMetrics(" ", wordFontFamilyLast, fontSizeLast, fontStyleLast)).visualWidth;
        const wordSpaceExpected = (spaceWidth + charSpacing * 2 + wordRightBearingLast) * (tzCurrent / 100) + wordLeftBearing;
      
        // Ad-hoc adjustment needed to replicate wordSpace
        // const wordSpaceExtra = (wordSpace + angleSpaceAdjXWord - spaceWidth - charSpacing * 2 - wordLeftBearing - wordRightBearingLast + spacingAdj);
        const wordSpaceExtra = (wordSpaceActualAdj - wordSpaceExpected + spacingAdj) * (100 / tzCurrent);
  
        textStream += "( ) " + String(Math.round(wordSpaceExtra * (-1000 / fontSizeLast) * 1e6) / 1e6);

      }
      wordBoxLast = wordBox;
      wordFontFamilyLast = wordFontFamily;
      fontStyleLast = fontStyle;

      let wordLastGlyphMetrics = font.charToGlyph(wordText.substr(-1)).getMetrics();
      wordRightBearingLast = wordLastGlyphMetrics.rightSideBearing * (wordFontSize / font.unitsPerEm);

      // In general, we assume that (given our adjustments to character spacing) the rendered word has the same width as the image of that word.
      // However, this assumption does not hold for single-character words, as there is no space between character to adjust. 
      // Therefore, we calculate the difference between the rendered and actual word and apply an adjustment to the width of the next space. 
      // (This does not apply to drop caps as those have horizontal scaling applied to exactly match the image.)
      if(wordText.length == 1 && !wordDropCap) {
        spacingAdj = (wordBox[2] - wordBox[0]) - ((wordLastGlyphMetrics.xMax - wordLastGlyphMetrics.xMin) * (wordFontSize / font.unitsPerEm));
      } else {
        spacingAdj = 0;
      }

      textStream += " ] TJ\n";

      charSpacing = await calcCharSpacing(wordText, wordFontFamily, fontStyle, wordFontSize, wordBox[2] - wordBox[0]) || 0;

      if (pdfFont != pdfFontCurrent || wordFontSize != fontSizeLast) {
        textStream += pdfFont + " " + String(wordFontSize) + " Tf\n";
        pdfFontCurrent = pdfFont;    
        fontSizeLast = wordFontSize;
      }
      if (fillColor != fillColorCurrent) {
        textStream += fillColor + "\n";
        fillColorCurrent = fillColor;    
      }
      if (ts != tsCurrent) {
        textStream += String(ts) + " Ts\n";
        tsCurrent = ts;
      }
      if (tz != tzCurrent) {
        textStream += String(tz) + " Tz\n";
        tzCurrent = tz;
      }

      textStream += String(Math.round(charSpacing*1e3)/1e3) + " Tc\n";

      textStream += "[ ";

      // Non-ASCII and special characters are encoded/escaped using winEncodingLookup
      const wordTextArr = wordText.split("");
      const wordTextCodeArr = wordTextArr.map((x) => String(font.charToGlyph(x).index));
      for(let i=0; i<wordTextArr.length; i++) {
        const letter = winEncodingLookup[wordTextArr[i]];
        if (letter) {
          const kern = i + 1 < wordTextArr.length ? font.kerningPairs[wordTextCodeArr[i] + "," + wordTextCodeArr[i+1]] * (-1000 / font.unitsPerEm) || 0 : 0;
          textStream += "(" + letter + ") " + String(Math.round(kern * 1e6) / 1e6) + " ";
        } else {
          // When the character is not in winEncodingLookup a space is inserted, with extra space to match the width of the missing character
          const kern = (font.charToGlyph(wordTextArr[i]).advanceWidth - font.charToGlyph(" ").advanceWidth) * (-1000 / font.unitsPerEm) || 0;
          textStream += "(" + " " + ") " + String(Math.round(kern * 1e6) / 1e6) + " ";
        }
      }
  
    }

    textStream += " ] TJ\n";
  
  }

  textStream += "ET";

  let pdfOut = String(firstObjIndex) + " 0 obj\n<</Length " + String(textStream.length) + " >>\nstream\n" + textStream + "\nendstream\nendobj\n\n" + secondObj;
  
  return pdfOut;

}