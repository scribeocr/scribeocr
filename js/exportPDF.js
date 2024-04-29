import { winEncodingLookup } from '../fonts/encoding.js';

import {
  calcWordFontSize, calcWordMetrics, subsetFont,
} from './fontUtils.js';
import { fontAll } from './containers/fontContainer.js';

import { createEmbeddedFontType1, createEmbeddedFontType0 } from './exportPDFFonts.js';

import ocr from './objects/ocrObjects.js';

// Creates 3 PDF objects necessary to embed font.
// These are (1) the font dictionary, (2) the font descriptor, and (3) the font file,
// which will be located at objects firstObjIndex, firstObjIndex + 1, and firstObjIndex + 2 (respectively).

/**
 * Create a PDF from an array of ocrPage objects.
 *
 * @param {Array<OcrPage>} hocrArr -
 * @param {number} minpage -
 * @param {number} maxpage -
 * @param {("ebook"|"eval"|"proof"|"invis")} textMode -
 * @param {boolean} rotateText -
 * @param {boolean} rotateBackground -
 * @param {dims} dimsLimit -
 * @param {?any} progress -
 * @param {number} confThreshHigh -
 * @param {number} confThreshMed -
 * @param {number} [proofOpacity=0.8] -
 *
 * A valid PDF will be created if an empty array is provided for `hocrArr`, as long as `maxpage` is set manually.
 */
export async function hocrToPDF(hocrArr, minpage = 0, maxpage = -1, textMode = 'ebook', rotateText = false, rotateBackground = false,
  dimsLimit = { width: -1, height: -1 }, progress = null, confThreshHigh = 85, confThreshMed = 75, proofOpacity = 0.8) {
  // TODO: Currently, all fonts are added to the PDF, and mupdf removes the unused fonts.
  // It would likely be more performant to only add the fonts that are actually used up front.
  const exportFontObj = fontAll.getContainer('active');

  // Get count of various objects inserted into pdf
  let fontCount = 0;
  for (const [familyKey, familyObj] of Object.entries(exportFontObj)) {
    for (const [key, value] of Object.entries(familyObj)) {
      fontCount += 1;
    }
  }

  // This will need to be edited if Type 1 fonts are added back in.
  let fontObjCount = fontCount * 6;
  if (fontAll.supp.chi_sim) fontObjCount += 6;

  if (maxpage === -1) {
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
  let objectI = 3;
  const pdfFonts = {};
  let pdfFontsStr = '';
  console.time();
  for (const [familyKey, familyObj] of Object.entries(exportFontObj)) {
    pdfFonts[familyKey] = {};
    for (const [key, value] of Object.entries(familyObj)) {
      const font = await value.opentype;

      const objectThis = objectI;

      // This should include both (1) if this is a standard 14 font and (2) if characters outside of the Windows-1252 range are used.
      // If the latter is true, then a composite font is needed, even if the font is a standard 14 font.
      const isStandardFont = false;
      if (isStandardFont) {
        pdfOut += createEmbeddedFontType1(font, objectThis);
        objectI += 3;
        pdfFonts[familyKey][key] = { type: 1, name: `/F${String(fontI)}` };
      } else {
        pdfOut += createEmbeddedFontType0(font, objectThis);
        objectI += 6;
        pdfFonts[familyKey][key] = { type: 0, name: `/F${String(fontI)}` };
      }

      // pdfFonts[familyKey][key] = `/F${String(fontI)}`;
      pdfFontsStr += `/F${String(fontI)} ${String(objectThis)} 0 R\n`;
      fontI++;
    }
  }

  /** @type {?import('opentype.js').Font} */
  let fontChiSimExport = null;
  if (fontAll.supp.chi_sim) {
    pdfFonts.NotoSansSC = {};
    const font = await fontAll.supp.chi_sim.opentype;

    const charArr = ocr.getDistinctChars(hocrArr);
    fontChiSimExport = await subsetFont(font, charArr);

    pdfOut += createEmbeddedFontType0(fontChiSimExport, objectI);

    // pdfFonts.NotoSansSC.normal = `/F${String(fontI)}`;
    pdfFonts.NotoSansSC.normal = { type: 0, name: `/F${String(fontI)}` };

    pdfFontsStr += `/F${String(fontI)} ${String(objectI)} 0 R\n`;

    objectI += 6;
  }

  // Add resource dictionary
  // For simplicity, all pages currently get the same resource dictionary.
  // It contains references to every font, as well as a graphics state with 0 opacity (used for invisible text in OCR mode).
  pdfOut += `${String(objectI)} 0 obj\n<<`;

  pdfOut += `/Font<<${pdfFontsStr}>>`;

  pdfOut += '/ExtGState<</GS0 <</ca 0.0>>>>';
  pdfOut += `/ExtGState<</GS1 <</ca ${proofOpacity}>>>>`;

  pdfOut += '>>\nendobj\n\n';

  const pageResourceStr = `/Resources ${String(objectI)} 0 R`;

  objectI++;

  // Add pages
  for (let i = minpage; i <= maxpage; i++) {
    const angle = globalThis.pageMetricsArr[i].angle || 0;
    const { dims } = globalThis.pageMetricsArr[i];

    // eslint-disable-next-line no-await-in-loop
    pdfOut += (await ocrPageToPDF(hocrArr[i], dims, dimsLimit, objectI, 2, pageResourceStr, pdfFonts,
      textMode, angle, rotateText, rotateBackground, confThreshHigh, confThreshMed, fontChiSimExport));
    objectI += 2;
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
 * @param {OcrPage} pageObj
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
 * @param {?import('opentype.js').Font} fontChiSim
 * @returns
 */
async function ocrPageToPDF(pageObj, inputDims, outputDims, firstObjIndex, parentIndex, pageResourceStr, pdfFonts, textMode, angle,
  rotateText = false, rotateBackground = false, confThreshHigh = 85, confThreshMed = 75, fontChiSim = null) {
  if (outputDims.width < 1) {
    outputDims = inputDims;
  }

  const noContent = !pageObj || pageObj.lines.length === 0;

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

  if (textMode === 'invis') {
    textStream += '/GS0 gs\n';
  } else if (['proof', 'eval'].includes(textMode)) {
    textStream += '/GS1 gs\n';
  }

  textStream += 'BT\n';

  // Locations are often specified using an offset against the leftmost point of the current line.
  const lineOrigin = [0, 0];

  // Move cursor to top of the page
  textStream += `1 0 0 1 0 ${String(outputDims.height)} Tm\n`;

  let pdfFontCurrent = '';
  let pdfFontTypeCurrent = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const { words } = lineObj;

    if (words.length === 0) continue;

    const { baseline } = lineObj;
    const linebox = lineObj.bbox;

    let word = words[0];

    let wordBox = word.bbox;

    let fillColor = '0 0 0 rg';
    if (textMode === 'proof') {
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

    let wordFont = fontAll.getWordFont(word);

    // The Chinese font is subset to only relevant characters, the others currently are not.
    let wordFontOpentype = await (word.lang === 'chi_sim' ? fontChiSim : wordFont.opentype);

    if (!wordFontOpentype) {
      const fontNameMessage = word.lang === 'chi_sim' ? 'chi_sim' : `${wordFont.family} (${word.style})`;
      console.log(`Skipping word due to missing font (${fontNameMessage})`);
      continue;
    }

    let wordFontSize = await calcWordFontSize(word);

    // Set font and font size
    ({ name: pdfFontCurrent, type: pdfFontTypeCurrent } = word.lang === 'chi_sim' ? pdfFonts.NotoSansSC.normal : pdfFonts[wordFont.family][word.style]);

    textStream += `${pdfFontCurrent} ${String(wordFontSize)} Tf\n`;

    // Reset baseline to line baseline
    textStream += '0 Ts\n';

    const word0Metrics = await calcWordMetrics(word, angle);

    let tz = 100;
    if (word.dropcap) {
      const wordWidthActual = wordBox.right - wordBox.left;
      tz = (wordWidthActual / word0Metrics.visualWidth) * 100;
    }

    // Move to next line
    const lineLeftAdj = wordBox.left - word0Metrics.leftSideBearing * (tz / 100) + angleAdjLine.x;
    const lineTopAdj = linebox.bottom + baseline[1] + angleAdjLine.y;

    if (rotateText) {
      textStream += `${String(cosAngle)} ${String(-sinAngle)} ${String(sinAngle)} ${String(cosAngle)} ${String(lineLeftAdj)} ${String(outputDims.height - lineTopAdj + 1)} Tm\n`;
    } else {
      textStream += `${String(1)} ${String(0)} ${String(0)} ${String(1)} ${String(lineLeftAdj)} ${String(outputDims.height - lineTopAdj + 1)} Tm\n`;
    }

    lineOrigin[0] = lineLeftAdj;
    lineOrigin[1] = lineTopAdj;

    textStream += '[ ';

    let wordBoxLast = {
      left: 0, top: 0, right: 0, bottom: 0,
    };
    let wordRightBearingLast = 0;
    let charSpacingLast = 0;
    let spacingAdj = 0;
    let kernSpacing = false;
    let wordFontOpentypeLast = wordFontOpentype;
    let fontSizeLast = wordFontSize;
    let tsCurrent = 0;
    let tzCurrent = 100;
    let charLig = false;

    for (let j = 0; j < words.length; j++) {
      word = words[j];

      const wordMetrics = await calcWordMetrics(word, angle);
      wordFontSize = wordMetrics.fontSize;
      const charSpacing = wordMetrics.charSpacing;
      const charArr = wordMetrics.charArr;
      const wordLeftBearing = wordMetrics.leftSideBearing;

      wordBox = word.bbox;

      wordFont = fontAll.getWordFont(word);
      wordFontOpentype = await (word.lang === 'chi_sim' ? fontChiSim : wordFont.opentype);

      if (!wordFontOpentype) {
        const fontNameMessage = word.lang === 'chi_sim' ? 'chi_sim' : `${wordFont.family} (${word.style})`;
        console.log(`Skipping word due to missing font (${fontNameMessage})`);
        continue;
      }

      fillColor = '0 0 0 rg';
      if (textMode === 'proof') {
        const wordConf = word.conf;

        if (wordConf > confThreshHigh) {
          fillColor = '0 1 0.5 rg';
        } else if (wordConf > confThreshMed) {
          fillColor = '1 0.8 0 rg';
        } else {
          fillColor = '1 0 0 rg';
        }
      } else if (textMode === 'eval') {
        fillColor = word.matchTruth ? '0 1 0.5 rg' : '1 0 0 rg';
      }

      const angleAdjWord = word.sup ? ocr.calcWordAngleAdj(word) : { x: 0, y: 0 };
      const angleAdjWordX = (rotateBackground && Math.abs(angle ?? 0) > 0.05) ? angleAdjWord.x : 0;

      // TODO: Test whether the math here is correct for drop caps.
      let ts = 0;
      if (word.sup) {
        ts = (linebox.bottom + baseline[1] + angleAdjLine.y) - (wordBox.bottom + angleAdjLine.y + angleAdjWord.y);
      } else if (word.dropcap) {
        ts = (linebox.bottom + baseline[1]) - wordBox.bottom + angleAdjLine.y + angleAdjWord.y;
      } else {
        ts = 0;
      }

      // TODO: This probably fails for Chinese, rethink.
      tz = 100;
      if (word.dropcap) {
        const wordWidthActual = wordBox.right - wordBox.left;
        tz = (wordWidthActual / wordMetrics.visualWidth) * 100;
      }

      // const pdfFont = word.lang === 'chi_sim' ? pdfFonts.NotoSansSC.normal : pdfFonts[wordFontFamily][word.style];
      const { name: pdfFont, type: pdfFontType } = word.lang === 'chi_sim' ? pdfFonts.NotoSansSC.normal : pdfFonts[wordFont.family][word.style];

      const wordWidthAdj = (wordBox.right - wordBox.left) / cosAngle;
      const wordSpaceAdj = (wordBox.left - wordBoxLast.right) / cosAngle;

      // Add space character between words
      if (j > 0 && !kernSpacing) {
        // The space between words determined by:
        // (1) The right bearing of the last word, (2) the left bearing of the current word, (3) the width of the space character between words,
        // (4) the current character spacing value (applied twice--both before and after the space character).
        const spaceWidthGlyph = wordFontOpentypeLast.charToGlyph(' ').advanceWidth * (fontSizeLast / wordFontOpentypeLast.unitsPerEm);

        const wordSpaceExpected = (spaceWidthGlyph + charSpacingLast * 2 + wordRightBearingLast) + wordLeftBearing;

        // Ad-hoc adjustment needed to replicate wordSpace
        // const wordSpaceExtra = (wordSpace + angleSpaceAdjXWord - spaceWidth - charSpacing * 2 - wordLeftBearing - wordRightBearingLast + spacingAdj);
        const wordSpaceExtra = (wordSpaceAdj - wordSpaceExpected + spacingAdj + angleAdjWordX) * (100 / tzCurrent);

        if (pdfFontTypeCurrent === 0) {
          const spaceChar = wordFontOpentype.charToGlyphIndex(' ').toString(16).padStart(4, '0');
          textStream += `<${spaceChar}> ${String(Math.round(wordSpaceExtra * (-1000 / fontSizeLast) * 1e6) / 1e6)}`;
        } else {
          textStream += `( ) ${String(Math.round(wordSpaceExtra * (-1000 / fontSizeLast) * 1e6) / 1e6)}`;
        }
      }
      kernSpacing = false;

      wordBoxLast = wordBox;

      const wordLastGlyphMetrics = wordFontOpentype.charToGlyph(charArr.at(-1)).getMetrics();
      wordRightBearingLast = wordLastGlyphMetrics.rightSideBearing * (wordFontSize / wordFontOpentype.unitsPerEm);

      // In general, we assume that (given our adjustments to character spacing) the rendered word has the same width as the image of that word.
      // However, this assumption does not hold for single-character words, as there is no space between character to adjust.
      // Therefore, we calculate the difference between the rendered and actual word and apply an adjustment to the width of the next space.
      // (This does not apply to drop caps as those have horizontal scaling applied to exactly match the image.)
      if (charArr.length === 1 && !word.dropcap) {
        spacingAdj = wordWidthAdj - ((wordLastGlyphMetrics.xMax - wordLastGlyphMetrics.xMin) * (wordFontSize / wordFontOpentype.unitsPerEm)) - angleAdjWordX;
      } else {
        spacingAdj = 0 - angleAdjWordX;
      }

      textStream += ' ] TJ\n';

      if (pdfFont !== pdfFontCurrent || wordFontSize !== fontSizeLast) {
        textStream += `${pdfFont} ${String(wordFontSize)} Tf\n`;
        pdfFontCurrent = pdfFont;
        pdfFontTypeCurrent = pdfFontType;
        fontSizeLast = wordFontSize;
      }
      if (fillColor !== fillColorCurrent) {
        textStream += `${fillColor}\n`;
        fillColorCurrent = fillColor;
      }
      if (ts !== tsCurrent) {
        textStream += `${String(ts)} Ts\n`;
        tsCurrent = ts;
      }
      if (tz !== tzCurrent) {
        textStream += `${String(tz)} Tz\n`;
        tzCurrent = tz;
      }

      textStream += `${String(Math.round(charSpacing * 1e6) / 1e6)} Tc\n`;

      textStream += '[ ';

      // Non-ASCII and special characters are encoded/escaped using winEncodingLookup
      for (let k = 0; k < charArr.length; k++) {
        const letter = charArr[k];
        const letterNext = charArr[k + 1];

        const letterEnc = pdfFontTypeCurrent === 0 ? wordFontOpentype.charToGlyphIndex(letter).toString(16).padStart(4, '0') : winEncodingLookup[letter];
        if (letter) {
          let kern = 0;
          if (letterNext) {
            const glyph1 = wordFontOpentype.charToGlyph(letter);
            const glyph2 = wordFontOpentype.charToGlyph(letterNext);
            kern = wordFontOpentype.getKerningValue(glyph1, glyph2) * (-1000 / wordFontOpentype.unitsPerEm);

          // Between two Chinese characters, kerning values are used rather than spaces
          } else if (word.lang === 'chi_sim' && j + 1 < words.length && words[j + 1].lang === 'chi_sim') {
            kernSpacing = true;
            const wordNext = words[j + 1];
            const wordSpaceNextAdj = (wordNext.bbox.left - wordBox.right) / cosAngle;
            // const wordSpaceNextAdj = wordNext.bbox.left - wordBox.right;

            const wordGlyphMetrics = wordFontOpentype.charToGlyph(charArr.at(-1)).getMetrics();
            const wordNextGlyphMetrics = wordFontOpentype.charToGlyph(wordNext.text.substr(0, 1)).getMetrics();

            const wordRightBearing = wordGlyphMetrics.rightSideBearing * (wordFontSize / wordFontOpentype.unitsPerEm);

            const wordNextLeftBearing = wordNextGlyphMetrics.xMin * (wordFontSize / wordFontOpentype.unitsPerEm);

            const wordSpaceExpected = charSpacing + wordRightBearing + wordNextLeftBearing;

            kern = Math.round((wordSpaceNextAdj - wordSpaceExpected + spacingAdj + angleAdjWordX) * (-1000 / wordFontSize));
          }
          if (pdfFontTypeCurrent === 0) {
            textStream += `<${letterEnc}> ${String(Math.round(kern * 1e6) / 1e6)} `;
          } else {
            textStream += `(${letterEnc}) ${String(Math.round(kern * 1e6) / 1e6)} `;
          }

          if (charLig) {
            k++;
            charLig = false;
          }
        } else {
          // When the requested character could not be found, a space is inserted, with extra space to match the width of the missing character
          const kern = (wordFontOpentype.charToGlyph(letter).advanceWidth - wordFontOpentype.charToGlyph(' ').advanceWidth) * (-1000 / wordFontOpentype.unitsPerEm) || 0;

          if (pdfFontTypeCurrent === 0) {
            const spaceChar = wordFontOpentype.charToGlyphIndex(' ').toString(16).padStart(4, '0');
            textStream += `<${spaceChar}> ${String(Math.round(kern * 1e6) / 1e6)} `;
          } else {
            textStream += `( ) ${String(Math.round(kern * 1e6) / 1e6)} `;
          }
        }
      }

      wordFontOpentypeLast = wordFontOpentype;
      charSpacingLast = charSpacing;
    }

    textStream += ' ] TJ\n';
  }

  textStream += 'ET';

  const pdfOut = `${String(firstObjIndex)} 0 obj\n<</Length ${String(textStream.length)} >>\nstream\n${textStream}\nendstream\nendobj\n\n${secondObj}`;

  return pdfOut;
}
