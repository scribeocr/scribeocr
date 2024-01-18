import { win1252Chars, winEncodingLookup } from '../fonts/encoding.js';

import { calcWordFontSize, calcCharSpacing, calcWordMetrics } from './fontUtils.js';

import ocr from './objects/ocrObjects.js';

// Function for converting from bufferArray to hex (string)
// Taken from https://stackoverflow.com/questions/40031688/javascript-arraybuffer-to-hex

/** @type {Array<string>} */
const byteToHex = [];

for (let n = 0; n <= 0xff; ++n) {
  const hexOctet = n.toString(16).padStart(2, '0');
  byteToHex.push(hexOctet);
}

/**
 * Converts an ArrayBuffer to a hexadecimal string.
 *
 * @param {ArrayBuffer} arrayBuffer - The ArrayBuffer to be converted.
 * @returns {string} The hexadecimal representation of the ArrayBuffer.
 */
function hex(arrayBuffer) {
  const buff = new Uint8Array(arrayBuffer);
  /** @type {Array<string>} */
  const hexOctets = []; // new Array(buff.length) is even faster (preallocates necessary array size), then use hexOctets[i] instead of .push()

  for (let i = 0; i < buff.length; ++i) hexOctets.push(byteToHex[buff[i]]);

  return hexOctets.join('');
}

// Creates 3 PDF objects necessary to embed font.
// These are (1) the font dictionary, (2) the font descriptor, and (3) the font file,
// which will be located at objects firstObjIndex, firstObjIndex + 1, and firstObjIndex + 2 (respectively).

/**
 * Converts a Opentype.js font object into a string for adding to a PDF.
 *
 * @param {opentype.Font} font - Opentype.js font object
 * @param {number} firstObjIndex - Index for the first PDF object
 */
function createFontObj(font, firstObjIndex) {
  // Start 1st object: Font Dictionary
  let objOut = `${String(firstObjIndex)} 0 obj\n<</Type/Font/Subtype/Type1`;

  // Add font name
  objOut += `\n/BaseFont/${font.tables.name.postScriptName.en}`;

  objOut += '/Encoding/WinAnsiEncoding';

  const cmapIndices = Object.keys(font.tables.cmap.glyphIndexMap).map((x) => parseInt(x));

  objOut += '/Widths[';
  for (let i = 0; i < win1252Chars.length; i++) {
    const advanceNorm = Math.round(font.charToGlyph(win1252Chars[i]).advanceWidth * (1000 / font.unitsPerEm));
    objOut += `${String(advanceNorm)} `;
  }
  objOut += ']/FirstChar 32/LastChar 255';

  objOut += `/FontDescriptor ${String(firstObjIndex + 1)} 0 R>>\nendobj\n\n`;

  // Start 2nd object: Font Descriptor
  objOut += `${String(firstObjIndex + 1)} 0 obj\n<</Type/FontDescriptor`;

  objOut += `/FontName/${font.tables.name.postScriptName.en}`;

  objOut += `/FontBBox[${[font.tables.head.xMin, font.tables.head.yMin, font.tables.head.xMax, font.tables.head.yMax].join(' ')}]`;

  objOut += `/ItalicAngle ${String(font.tables.post.italicAngle)}`;

  objOut += `/Ascent ${String(font.ascender)}`;

  objOut += `/Descent ${String(font.descender)}`;

  // StemV is a required field, however it is not already in the opentype font, and does not appear to matter.
  // Therefore, we set to 0.08 * em to mimic the behavior of other programs.
  // https://www.verypdf.com/document/pdf-format-reference/pg_0457.htm
  // https://stackoverflow.com/questions/35485179/stemv-value-of-the-truetype-font
  objOut += `/StemV ${String(Math.round(0.08 * font.unitsPerEm))}`;

  objOut += `/Flags ${String(font.tables.head.flags)}`;

  objOut += `/FontFile3 ${String(firstObjIndex + 2)} 0 R>>\nendobj\n\n`;

  // Start 3rd object: Font File
  const fontBuffer = font.toArrayBuffer();
  const fontHexStr = hex(fontBuffer);

  objOut += `${String(firstObjIndex + 2)} 0 obj\n<</Length1 ${String(fontBuffer.byteLength)}/Subtype/OpenType/Length ${String(fontHexStr.length)}/Filter/ASCIIHexDecode>>\nstream\n`;

  objOut += `${fontHexStr}\nendstream\nendobj\n\n`;

  return objOut;
}

// This is different than wordRegex in the convertPage.js file, as here we assume that the xml is already at the word-level (no character-level elements).
const wordRegex = new RegExp(/<span class\=[\"\']ocrx_word[\s\S]+?(?:\<\/span\>\s*)/, 'ig');

/**
 * Create a PDF from an array of ocrPage objects.
 *
 * @param {Array<ocrPage>} hocrArr -
 * @param {Object<string, ?fontContainerAll>} fontAll
 * @param {number} minpage -
 * @param {number} maxpage -
 * @param {("ebook"|"eval"|"proof"|"invis")} textMode -
 * @param {boolean} rotateText -
 * @param {boolean} rotateBackground -
 * @param {dims} dimsLimit -
 * @param {?any} progress -
 * @param {number} confThreshHigh -
 * @param {number} confThreshMed -
 *
 * A valid PDF will be created if an empty array is provided for `hocrArr`, as long as `maxpage` is set manually.
 */
export async function hocrToPDF(hocrArr, fontAll, minpage = 0, maxpage = -1, textMode = 'ebook', rotateText = false, rotateBackground = false, dimsLimit = { width: -1, height: -1 }, progress = null, confThreshHigh = 85, confThreshMed = 75) {
  // TODO: Currently, all fonts are added to the PDF, and mupdf removes the unused fonts.
  // It would likely be more performant to only add the fonts that are actually used up front.
  const exportFontObj = fontAll.active;

  // Get count of various objects inserted into pdf
  let fontCount = 0;
  for (const [familyKey, familyObj] of Object.entries(exportFontObj)) {
    for (const [key, value] of Object.entries(familyObj)) {
      fontCount += 1;
    }
  }
  const fontObjCount = fontCount * 3;

  if (maxpage == -1) {
    maxpage = hocrArr.length - 1;
  }

  // This can happen if (1) `hocrArr` is length 0 and (2) `maxpage` is left as the default (-1).
  if (maxpage < 0) throw new Error('PDF with negative page count requested.');

  let pdfOut = '%PDF-1.7\n%¥±ë\n\n';

  pdfOut += '1 0 obj\n<< /Type /Catalog\n/Pages 2 0 R>>\nendobj\n\n';

  pdfOut += '2 0 obj\n<< /Type /Pages\n/Kids [';
  for (let i = 0; i < (maxpage - minpage + 1); i++) {
    pdfOut += `${String(3 + fontObjCount + 2 + i * 2)} 0 R\n`;
  }
  pdfOut += `]\n/Count ${String(maxpage - minpage + 1)}>>\nendobj\n\n`;

  // Add fonts
  // All fonts are added at this step.
  // The fonts that are not used will be removed by muPDF later.
  let fontI = 0;
  const pdfFonts = {};
  let pdfFontsStr = '';
  for (const [familyKey, familyObj] of Object.entries(exportFontObj)) {
    pdfFonts[familyKey] = {};
    for (const [key, value] of Object.entries(familyObj)) {
      const font = await value.opentype;
      pdfOut += createFontObj(font, 3 + fontI * 3);

      pdfFonts[familyKey][key] = `/F${String(fontI)}`;
      pdfFontsStr += `/F${String(fontI)} ${String(3 + fontI * 3)} 0 R\n`;
      fontI++;
    }
  }

  // Add resource dictionary
  // For simplicity, all pages currently get the same resource dictionary.
  // It contains references to every font, as well as a graphics state with 0 opacity (used for invisible text in OCR mode).
  pdfOut += `${String(3 + fontObjCount)} 0 obj\n<<`;

  pdfOut += `/Font<<${pdfFontsStr}>>`;

  pdfOut += '/ExtGState<</GS0 <</ca 0.0>>>>';

  pdfOut += '>>\nendobj\n\n';

  const pageResourceStr = `/Resources ${String(3 + fontObjCount)} 0 R`;

  // Add pages
  for (let i = minpage; i <= maxpage; i++) {
    const angle = globalThis.pageMetricsArr[i].angle || 0;
    const { dims } = globalThis.pageMetricsArr[i];

    pdfOut += (await ocrPageToPDF(hocrArr[i], fontAll, dims, dimsLimit, 3 + fontObjCount + 1 + (i - minpage) * 2, 2, pageResourceStr, pdfFonts, textMode, angle, rotateText, rotateBackground, confThreshHigh, confThreshMed));
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
  `;

  return pdfOut;
}

/**
 *
 * @param {ocrPage} pageObj
 * @param {dims} inputDims
 * @param {dims} outputDims
 * @param {number} firstObjIndex
 * @param {number} parentIndex
 * @param {string} pageResourceStr
 * @param {*} pdfFonts
 * @param {("ebook"|"eval"|"proof"|"invis")} textMode -
 * @param {number} angle
 * @param {boolean} rotateText
 * @param {boolean} rotateBackground
 * @param {number} confThreshHigh
 * @param {number} confThreshMed
 * @returns
 */
async function ocrPageToPDF(pageObj, fontAll, inputDims, outputDims, firstObjIndex, parentIndex, pageResourceStr, pdfFonts, textMode, angle, rotateText = false, rotateBackground = false, confThreshHigh = 85, confThreshMed = 75) {
  if (outputDims.width < 1) {
    outputDims = inputDims;
  }

  const noContent = !pageObj || pageObj.lines.length == 0;

  // Start 2nd object: Page
  let secondObj = `${String(firstObjIndex + 1)} 0 obj\n<</Type/Page/MediaBox[0 0 ${String(outputDims.width)} ${String(outputDims.height)}]`;

  if (!noContent) secondObj += `/Contents ${String(firstObjIndex)} 0 R`;

  secondObj += `${pageResourceStr}/Parent ${parentIndex} 0 R>>\nendobj\n\n`;

  // If there is no text content, return the empty page with no contents
  if (noContent) return secondObj;

  const { lines } = pageObj;

  const sinAngle = Math.sin(angle * (Math.PI / 180));
  const cosAngle = Math.cos(angle * (Math.PI / 180));

  // Start 1st object: Text Content
  let textStream = '';

  if (textMode == 'invis') {
    textStream += '/GS0 gs\n';
  }

  textStream += 'BT\n';

  // Locations are often specified using an offset against the leftmost point of the current line.
  const lineOrigin = [0, 0];

  // Move cursor to top of the page
  textStream += `1 0 0 1 0 ${String(outputDims.height)} Tm\n`;

  let pdfFontCurrent = '';

  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const { words } = lineObj;

    if (words.length == 0) continue;

    const { baseline } = lineObj;
    const linebox = lineObj.bbox;

    const word = words[0];
    const wordText = word.text?.replace(/&quot;/, '"')?.replace(/&apos;/, "'")?.replace(/&lt;/, '<')?.replace(/&gt;/, '>')
      ?.replace(/&amp;/, '&');

    const wordBox = word.bbox;

    const wordFontFamily = word.font || globalThis.globalSettings.defaultFont;

    let fillColor = '0 0 0 rg';
    if (textMode == 'proof') {
      if (word.conf > confThreshHigh) {
        fillColor = '0 1 0.5 rg';
      } else if (word.conf > confThreshMed) {
        fillColor = '1 0.8 0 rg';
      } else {
        fillColor = '1 0 0 rg';
      }
    }

    const angleAdjLine = (rotateBackground && Math.abs(angle ?? 0) > 0.05) ? ocr.calcLineAngleAdj(lineObj) : { x: 0, y: 0 };

    let fillColorCurrent = fillColor;

    textStream += `${fillColor}\n`;

    const wordFont = /** @type {fontContainerFont} */ (fontAll.active[wordFontFamily][word.style]);
    const wordFontOpentype = await wordFont.opentype;

    const wordFontSize = await calcWordFontSize(word, fontAll.active);

    // Set font and font size
    textStream += `${pdfFonts[wordFontFamily][word.style]} ${String(wordFontSize)} Tf\n`;
    pdfFontCurrent = pdfFonts[wordFontFamily][word.style];

    // Reset baseline to line baseline
    textStream += '0 Ts\n';

    let tz = 100;
    if (word.dropcap) {
      const wordWidthActual = wordBox[2] - wordBox[0];
      const wordWidthFont = (await calcWordMetrics(wordText.slice(0, 1), wordFont, wordFontSize)).visualWidth;
      tz = (wordWidthActual / wordWidthFont) * 100;
    }

    const wordFirstGlyphMetrics = wordFontOpentype.charToGlyph(wordText.substr(0, 1)).getMetrics();

    const wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / wordFontOpentype.unitsPerEm);

    // Move to next line
    const lineLeftAdj = wordBox[0] - wordLeftBearing * (tz / 100) + angleAdjLine.x;
    const lineTopAdj = linebox[3] + baseline[1] + angleAdjLine.y;

    if (rotateText) {
      textStream += `${String(cosAngle)} ${String(-sinAngle)} ${String(sinAngle)} ${String(cosAngle)} ${String(lineLeftAdj)} ${String(outputDims.height - lineTopAdj + 1)} Tm\n`;
    } else {
      textStream += `${String(1)} ${String(0)} ${String(0)} ${String(1)} ${String(lineLeftAdj)} ${String(outputDims.height - lineTopAdj + 1)} Tm\n`;
    }

    lineOrigin[0] = lineLeftAdj;
    lineOrigin[1] = lineTopAdj;

    textStream += '[ ';

    let wordBoxLast = [0, 0, 0, 0];
    let wordRightBearingLast = 0;
    let charSpacing = 0;
    let spacingAdj = 0;
    let wordFontOpentypeLast = wordFontOpentype;
    let wordFontFamilyLast = wordFontFamily;
    let wordStyleLast = word.style;
    let fontSizeLast = wordFontSize;
    let tsCurrent = 0;
    let tzCurrent = 100;

    for (let j = 0; j < words.length; j++) {
      const word = words[j];

      let wordText;
      if (word.sup) {
        wordText = word.text?.replace(/&quot;/, '"')?.replace(/&apos;/, "'")?.replace(/&lt;/, '<')?.replace(/&gt;/, '>')
          ?.replace(/&amp;/, '&');
      } else if (word.dropcap) {
        wordText = word.text?.replace(/&quot;/, '"')?.replace(/&apos;/, "'")?.replace(/&lt;/, '<')?.replace(/&gt;/, '>')
          ?.replace(/&amp;/, '&');
      } else {
        wordText = word.text?.replace(/&quot;/, '"')?.replace(/&apos;/, "'")?.replace(/&lt;/, '<')?.replace(/&gt;/, '>')
          ?.replace(/&amp;/, '&');
      }

      // Ligatures are not in the encoding dictionary so would not be displayed correctly
      wordText = ocr.replaceLigatures(wordText);

      const wordBox = word.bbox;

      const wordFontFamily = word.font || globalThis.globalSettings.defaultFont;
      const wordFont = /** @type {fontContainerFont} */ (fontAll.active[wordFontFamily][word.style]);
      const wordFontOpentype = await wordFont.opentype;

      const wordFontSize = await calcWordFontSize(word, fontAll.active);

      let fillColor = '0 0 0 rg';
      if (textMode == 'proof') {
        const wordConf = word.conf;

        if (wordConf > confThreshHigh) {
          fillColor = '0 1 0.5 rg';
        } else if (wordConf > confThreshMed) {
          fillColor = '1 0.8 0 rg';
        } else {
          fillColor = '1 0 0 rg';
        }
      } else if (textMode == 'eval') {
        fillColor = word.matchTruth ? '0 1 0.5 rg' : '1 0 0 rg';
      }

      const angleAdjWord = word.sup ? ocr.calcWordAngleAdj(word) : { x: 0, y: 0 };
      const angleAdjWordX = (rotateBackground && Math.abs(angle ?? 0) > 0.05) ? angleAdjWord.x : 0;

      // TODO: Test whether the math here is correct for drop caps.
      let ts = 0;
      if (word.sup) {
        ts = (linebox[3] + baseline[1] + angleAdjLine.y) - (wordBox[3] + angleAdjLine.y + angleAdjWord.y);
      } else if (word.dropcap) {
        ts = (linebox[3] + baseline[1]) - wordBox[3] + angleAdjLine.y + angleAdjWord.y;
      } else {
        ts = 0;
      }

      let tz = 100;
      if (word.dropcap) {
        const wordWidthActual = wordBox[2] - wordBox[0];
        const wordWidthFont = (await calcWordMetrics(wordText.slice(0, 1), fontAll.active[wordFontFamilyLast][word.style], wordFontSize)).visualWidth;
        tz = (wordWidthActual / wordWidthFont) * 100;
      }

      const pdfFont = pdfFonts[wordFontFamily][word.style];

      const wordFirstGlyphMetrics = wordFontOpentype.charToGlyph(wordText.substr(0, 1)).getMetrics();
      const wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / wordFontOpentype.unitsPerEm);

      const wordWidthAdj = (wordBox[2] - wordBox[0]) / cosAngle;
      const wordSpaceAdj = (wordBox[0] - wordBoxLast[2]) / cosAngle;

      // Add space character between words
      if (j > 0) {
        // The space between words determined by:
        // (1) The right bearing of the last word, (2) the left bearing of the current word, (3) the width of the space character between words,
        // (4) the current character spacing value (applied twice--both before and after the space character).
        // const spaceWidth = (await calcWordMetrics(" ", wordFontFamilyLast, fontSizeLast, wordStyleLast)).visualWidth;
        const spaceWidthGlyph = wordFontOpentypeLast.charToGlyph(' ').advanceWidth * (fontSizeLast / wordFontOpentypeLast.unitsPerEm);

        const wordSpaceExpected = (spaceWidthGlyph + charSpacing * 2 + wordRightBearingLast) * (tzCurrent / 100) + wordLeftBearing;

        // Ad-hoc adjustment needed to replicate wordSpace
        // const wordSpaceExtra = (wordSpace + angleSpaceAdjXWord - spaceWidth - charSpacing * 2 - wordLeftBearing - wordRightBearingLast + spacingAdj);
        const wordSpaceExtra = (wordSpaceAdj - wordSpaceExpected + spacingAdj + angleAdjWordX) * (100 / tzCurrent);

        textStream += `( ) ${String(Math.round(wordSpaceExtra * (-1000 / fontSizeLast) * 1e6) / 1e6)}`;
      }
      wordBoxLast = wordBox;
      wordFontFamilyLast = wordFontFamily;
      wordStyleLast = word.style;

      const wordLastGlyphMetrics = wordFontOpentype.charToGlyph(wordText.substr(-1)).getMetrics();
      wordRightBearingLast = wordLastGlyphMetrics.rightSideBearing * (wordFontSize / wordFontOpentype.unitsPerEm);

      // In general, we assume that (given our adjustments to character spacing) the rendered word has the same width as the image of that word.
      // However, this assumption does not hold for single-character words, as there is no space between character to adjust.
      // Therefore, we calculate the difference between the rendered and actual word and apply an adjustment to the width of the next space.
      // (This does not apply to drop caps as those have horizontal scaling applied to exactly match the image.)
      if (wordText.length == 1 && !word.dropcap) {
        spacingAdj = wordWidthAdj - ((wordLastGlyphMetrics.xMax - wordLastGlyphMetrics.xMin) * (wordFontSize / wordFontOpentype.unitsPerEm)) - angleAdjWordX;
      } else {
        spacingAdj = 0 - angleAdjWordX;
      }

      textStream += ' ] TJ\n';

      charSpacing = await calcCharSpacing(wordText, wordFont, wordFontSize, wordWidthAdj) || 0;

      if (pdfFont != pdfFontCurrent || wordFontSize != fontSizeLast) {
        textStream += `${pdfFont} ${String(wordFontSize)} Tf\n`;
        pdfFontCurrent = pdfFont;
        fontSizeLast = wordFontSize;
      }
      if (fillColor != fillColorCurrent) {
        textStream += `${fillColor}\n`;
        fillColorCurrent = fillColor;
      }
      if (ts != tsCurrent) {
        textStream += `${String(ts)} Ts\n`;
        tsCurrent = ts;
      }
      if (tz != tzCurrent) {
        textStream += `${String(tz)} Tz\n`;
        tzCurrent = tz;
      }

      textStream += `${String(Math.round(charSpacing * 1e6) / 1e6)} Tc\n`;

      textStream += '[ ';

      // Non-ASCII and special characters are encoded/escaped using winEncodingLookup
      const wordTextArr = wordText.split('');
      for (let i = 0; i < wordTextArr.length; i++) {
        const letter = winEncodingLookup[wordTextArr[i]];
        if (letter) {
          const kern = i + 1 < wordTextArr.length ? wordFontOpentype.getKerningValue(wordFontOpentype.charToGlyph(wordTextArr[i]), wordFontOpentype.charToGlyph(wordTextArr[i + 1])) * (-1000 / wordFontOpentype.unitsPerEm) || 0 : 0;

          textStream += `(${letter}) ${String(Math.round(kern * 1e6) / 1e6)} `;
        } else {
          // When the character is not in winEncodingLookup a space is inserted, with extra space to match the width of the missing character
          const kern = (wordFontOpentype.charToGlyph(wordTextArr[i]).advanceWidth - wordFontOpentype.charToGlyph(' ').advanceWidth) * (-1000 / wordFontOpentype.unitsPerEm) || 0;
          textStream += '(' + ' ' + `) ${String(Math.round(kern * 1e6) / 1e6)} `;
        }
      }

      wordFontOpentypeLast = wordFontOpentype;
    }

    textStream += ' ] TJ\n';
  }

  textStream += 'ET';

  const pdfOut = `${String(firstObjIndex)} 0 obj\n<</Length ${String(textStream.length)} >>\nstream\n${textStream}\nendstream\nendobj\n\n${secondObj}`;

  return pdfOut;
}
