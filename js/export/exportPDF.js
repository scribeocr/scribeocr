import { winEncodingLookup } from '../../fonts/encoding.js';

import { fontAll } from '../containers/fontContainer.js';
import {
  calcWordMetrics, subsetFont,
} from '../utils/fontUtils.js';

import { createEmbeddedFontType0, createEmbeddedFontType1 } from './exportPDFFonts.js';

import { opt } from '../containers/app.js';
import { pageMetricsArr } from '../containers/dataContainer.js';
import ocr from '../objects/ocrObjects.js';

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
 * @param {number} confThreshHigh -
 * @param {number} confThreshMed -
 * @param {number} [proofOpacity=0.8] -
 *
 * A valid PDF will be created if an empty array is provided for `hocrArr`, as long as `maxpage` is set manually.
 */
export async function hocrToPDF(hocrArr, minpage = 0, maxpage = -1, textMode = 'ebook', rotateText = false, rotateBackground = false,
  dimsLimit = { width: -1, height: -1 }, confThreshHigh = 85, confThreshMed = 75, proofOpacity = 0.8) {
  // TODO: Currently, all fonts are added to the PDF, and mupdf removes the unused fonts.
  // It would likely be more performant to only add the fonts that are actually used up front.
  const exportFontObj = fontAll.getContainer('active');

  if (maxpage === -1) {
    maxpage = hocrArr.length - 1;
  }

  // This can happen if (1) `hocrArr` is length 0 and (2) `maxpage` is left as the default (-1).
  if (maxpage < 0) throw new Error('PDF with negative page count requested.');

  // Add fonts
  // All fonts are added at this step.
  // The fonts that are not used will be removed by muPDF later.
  let fontI = 0;
  let objectI = 3;
  const pdfFonts = {};
  /** @type {Array<string>} */
  const pdfFontObjStrArr = [];
  let pdfFontsStr = '';
  for (const [familyKey, familyObj] of Object.entries(exportFontObj)) {
    pdfFonts[familyKey] = {};
    for (const [key, value] of Object.entries(familyObj)) {
      const font = await value.opentype;

      const objectThis = objectI;

      // This should include both (1) if this is a standard 14 font and (2) if characters outside of the Windows-1252 range are used.
      // If the latter is true, then a composite font is needed, even if the font is a standard 14 font.
      const isStandardFont = false;
      if (isStandardFont) {
        const fontObjArrI = createEmbeddedFontType1(font, objectThis);
        for (let j = 0; j < fontObjArrI.length; j++) {
          pdfFontObjStrArr.push(fontObjArrI[j]);
        }
        objectI += fontObjArrI.length;
        pdfFonts[familyKey][key] = { type: 1, name: `/F${String(fontI)}` };
      } else {
        const fontObjArrI = createEmbeddedFontType0(font, objectThis);
        for (let j = 0; j < fontObjArrI.length; j++) {
          pdfFontObjStrArr.push(fontObjArrI[j]);
        }
        objectI += fontObjArrI.length;
        pdfFonts[familyKey][key] = { type: 0, name: `/F${String(fontI)}` };
      }

      pdfFontsStr += `/F${String(fontI)} ${String(objectThis)} 0 R\n`;
      fontI++;
    }
  }

  /** @type {?import('opentype.js').Font} */
  let fontChiSimExport = null;
  if (fontAll.supp.chi_sim) {
    pdfFonts.NotoSansSC = {};
    const font = fontAll.supp.chi_sim.opentype;

    const objectThis = objectI;

    const charArr = ocr.getDistinctChars(hocrArr);
    fontChiSimExport = await subsetFont(font, charArr);

    const fontObjArr = createEmbeddedFontType0(fontChiSimExport, objectThis);
    for (let j = 0; j < fontObjArr.length; j++) {
      pdfFontObjStrArr.push(fontObjArr[j]);
    }
    objectI += fontObjArr.length;

    pdfFonts.NotoSansSC.normal = { type: 0, name: `/F${String(fontI)}` };

    pdfFontsStr += `/F${String(fontI)} ${String(objectThis)} 0 R\n`;
    fontI++;
  }

  // Add resource dictionary
  // For simplicity, all pages currently get the same resource dictionary.
  // It contains references to every font, as well as a graphics state with 0 opacity (used for invisible text in OCR mode).
  let resourceDictObjStr = `${String(objectI)} 0 obj\n<<`;

  resourceDictObjStr += `/Font<<${pdfFontsStr}>>`;

  resourceDictObjStr += '/ExtGState<<';
  resourceDictObjStr += '/GS0 <</ca 0.0>>';
  resourceDictObjStr += `/GS1 <</ca ${proofOpacity}>>`;
  resourceDictObjStr += '>>';

  resourceDictObjStr += '>>\nendobj\n\n';

  /** @type {Array<string>} */
  const pdfPageObjStrArr = [];

  pdfPageObjStrArr.push(resourceDictObjStr);

  const pageResourceStr = `/Resources ${String(objectI)} 0 R`;

  objectI++;

  // Add pages
  const pageIndexArr = [];
  for (let i = minpage; i <= maxpage; i++) {
    const angle = pageMetricsArr[i].angle || 0;
    const { dims } = pageMetricsArr[i];

    // eslint-disable-next-line no-await-in-loop
    const objArr = (await ocrPageToPDF(hocrArr[i], dims, dimsLimit, objectI, 2, pageResourceStr, pdfFonts,
      textMode, angle, rotateText, rotateBackground, confThreshHigh, confThreshMed, fontChiSimExport));

    for (let j = 0; j < objArr.length; j++) {
      pdfPageObjStrArr.push(objArr[j]);
    }

    objectI += objArr.length;

    // This assumes the "page" is always the last object returned by `ocrPageToPDF`.
    pageIndexArr.push(objectI - 1);

    if (opt.progress) opt.progress.increment();
  }

  /** @type {Array<string>} */
  const pdfObjStrArr = [];

  let pdfOut = '%PDF-1.7\n%µ¶n\n';

  pdfObjStrArr.push('1 0 obj\n<</Type /Catalog\n/Pages 2 0 R>>\nendobj\n\n');

  let pagesObjStr = '2 0 obj\n<</Type /Pages\n/Kids [';
  for (let i = 0; i < (maxpage - minpage + 1); i++) {
    pagesObjStr += `${String(pageIndexArr[i])} 0 R\n`;
  }
  pagesObjStr += `]\n/Count ${String(maxpage - minpage + 1)}>>\nendobj\n\n`;

  pdfObjStrArr.push(pagesObjStr);

  const offsetArr = [];
  for (let i = 0; i < pdfObjStrArr.length; i++) {
    offsetArr.push(pdfOut.length + 2);
    pdfOut += pdfObjStrArr[i];
  }

  for (let i = 0; i < pdfFontObjStrArr.length; i++) {
    offsetArr.push(pdfOut.length + 2);
    pdfOut += pdfFontObjStrArr[i];
  }

  for (let i = 0; i < pdfPageObjStrArr.length; i++) {
    offsetArr.push(pdfOut.length + 2);
    pdfOut += pdfPageObjStrArr[i];
  }

  // The 0th object always exists, and contains no meaningful data.
  const objCount = pdfObjStrArr.length + pdfFontObjStrArr.length + pdfPageObjStrArr.length + 1;

  const xrefOffset = pdfOut.length + 2;

  let xrefStr = `xref\n0 ${objCount}\n`;

  xrefStr += '0000000000 65535 f\n';

  for (let i = 0; i < offsetArr.length; i++) {
    xrefStr += `${offsetArr[i].toString().padStart(10, '0')} 00000 n\n`;
  }

  xrefStr += `trailer
  <<  /Root 1 0 R
      /Size ${objCount}
  >>
startxref
${xrefOffset}
%%EOF`;

  pdfOut += xrefStr;

  return pdfOut;
}

/**
 * Generates PDF objects for a single page of OCR data.
 * Generally returns an array of 2 strings, the first being the text content object, and the second being the page object.
 * If there is no text content, only the page object is returned.
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
 * @returns {Promise<string[]>}
 */
async function ocrPageToPDF(pageObj, inputDims, outputDims, firstObjIndex, parentIndex, pageResourceStr, pdfFonts, textMode, angle,
  rotateText = false, rotateBackground = false, confThreshHigh = 85, confThreshMed = 75, fontChiSim = null) {
  if (outputDims.width < 1) {
    outputDims = inputDims;
  }

  const noContent = !pageObj || pageObj.lines.length === 0;

  // Start 2nd object: Page
  const pageIndex = noContent ? firstObjIndex : firstObjIndex + 1;
  let pageObjStr = `${String(pageIndex)} 0 obj\n<</Type/Page/MediaBox[0 0 ${String(outputDims.width)} ${String(outputDims.height)}]`;

  if (!noContent) pageObjStr += `/Contents ${String(firstObjIndex)} 0 R`;

  pageObjStr += `${pageResourceStr}/Parent ${parentIndex} 0 R>>\nendobj\n\n`;

  // If there is no text content, return the empty page with no contents
  if (noContent) return [pageObjStr];

  let textContentObjStr = await ocrPageToPDFStream(pageObj, outputDims, pdfFonts, textMode, angle,
    rotateText, rotateBackground, confThreshHigh, confThreshMed, fontChiSim);

  textContentObjStr = `${String(firstObjIndex)} 0 obj\n<</Length ${String(textContentObjStr.length)} >>\nstream\n${textContentObjStr}\nendstream\nendobj\n\n`;

  return [textContentObjStr, pageObjStr];
}

/**
 *
 * @param {OcrPage} pageObj
 * @param {dims} outputDims
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
async function ocrPageToPDFStream(pageObj, outputDims, pdfFonts, textMode, angle,
  rotateText = false, rotateBackground = false, confThreshHigh = 85, confThreshMed = 75, fontChiSim = null) {
  const { lines } = pageObj;

  const sinAngle = Math.sin(angle * (Math.PI / 180));
  const cosAngle = Math.cos(angle * (Math.PI / 180));

  // Start 1st object: Text Content
  let textContentObjStr = '';

  if (textMode === 'invis') {
    textContentObjStr += '/GS0 gs\n';
  } else if (['proof', 'eval'].includes(textMode)) {
    textContentObjStr += '/GS1 gs\n';
  }

  textContentObjStr += 'BT\n';

  // Locations are often specified using an offset against the leftmost point of the current line.
  const lineOrigin = [0, 0];

  // Move cursor to top of the page
  textContentObjStr += `1 0 0 1 0 ${String(outputDims.height)} Tm\n`;

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

    const angleAdjLine = (rotateBackground && Math.abs(angle ?? 0) > 0.05) ? ocr.calcLineStartAngleAdj(lineObj) : { x: 0, y: 0 };

    let fillColorCurrent = fillColor;

    textContentObjStr += `${fillColor}\n`;

    let wordFont = fontAll.getWordFont(word);

    // The Chinese font is subset to only relevant characters, the others currently are not.
    let wordFontOpentype = (word.lang === 'chi_sim' ? fontChiSim : wordFont.opentype);

    if (!wordFontOpentype) {
      const fontNameMessage = word.lang === 'chi_sim' ? 'chi_sim' : `${wordFont.family} (${word.style})`;
      console.log(`Skipping word due to missing font (${fontNameMessage})`);
      continue;
    }

    // let wordFontSize = calcWordFontSize(word);

    const word0Metrics = calcWordMetrics(word, angle);

    let wordFontSize = word0Metrics.fontSize;

    // Set font and font size
    ({ name: pdfFontCurrent, type: pdfFontTypeCurrent } = word.lang === 'chi_sim' ? pdfFonts.NotoSansSC.normal : pdfFonts[wordFont.family][word.style]);

    textContentObjStr += `${pdfFontCurrent} ${String(wordFontSize)} Tf\n`;

    // Reset baseline to line baseline
    textContentObjStr += '0 Ts\n';

    const word0LeftBearing = word.visualCoords ? word0Metrics.leftSideBearing : 0;

    let tz = 100;
    if (word.dropcap) {
      const wordWidthActual = wordBox.right - wordBox.left;
      tz = (wordWidthActual / word0Metrics.visualWidth) * 100;
    }

    // Move to next line
    const lineLeftAdj = wordBox.left - word0LeftBearing * (tz / 100) + angleAdjLine.x;
    const lineTopAdj = linebox.bottom + baseline[1] + angleAdjLine.y;

    if (rotateText) {
      textContentObjStr += `${String(cosAngle)} ${String(-sinAngle)} ${String(sinAngle)} ${String(cosAngle)} ${String(lineLeftAdj)} ${String(outputDims.height - lineTopAdj + 1)} Tm\n`;
    } else {
      textContentObjStr += `${String(1)} ${String(0)} ${String(0)} ${String(1)} ${String(lineLeftAdj)} ${String(outputDims.height - lineTopAdj + 1)} Tm\n`;
    }

    lineOrigin[0] = lineLeftAdj;
    lineOrigin[1] = lineTopAdj;

    textContentObjStr += '[ ';

    let wordBoxLast = {
      left: 0, top: 0, right: 0, bottom: 0,
    };
    let wordRightBearingLast = 0;
    let charSpacingLast = 0;
    let spacingAdj = 0;
    let kernSpacing = false;
    let wordLast = word;
    let wordFontOpentypeLast = wordFontOpentype;
    let fontSizeLast = wordFontSize;
    let tsCurrent = 0;
    let tzCurrent = 100;
    let charLig = false;

    for (let j = 0; j < words.length; j++) {
      word = words[j];

      const wordMetrics = calcWordMetrics(word, angle);
      wordFontSize = wordMetrics.fontSize;
      const charSpacing = wordMetrics.charSpacing;
      const charArr = wordMetrics.charArr;
      const wordLeftBearing = word.visualCoords ? wordMetrics.leftSideBearing : 0;
      const kerningArr = wordMetrics.kerningArr;

      wordBox = word.bbox;

      wordFont = fontAll.getWordFont(word);
      wordFontOpentype = word.lang === 'chi_sim' ? fontChiSim : wordFont.opentype;

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

        const wordSpaceExpectedPx = (spaceWidthGlyph + charSpacingLast * 2 + wordRightBearingLast) + wordLeftBearing;

        // Ad-hoc adjustment needed to replicate wordSpace
        // const wordSpaceExtra = (wordSpace + angleSpaceAdjXWord - spaceWidth - charSpacing * 2 - wordLeftBearing - wordRightBearingLast + spacingAdj);
        const wordSpaceExtraPx = (wordSpaceAdj - wordSpaceExpectedPx + spacingAdj + angleAdjWordX) * (100 / tzCurrent);

        if (pdfFontTypeCurrent === 0) {
          const spaceChar = wordFontOpentype.charToGlyphIndex(' ').toString(16).padStart(4, '0');
          textContentObjStr += `<${spaceChar}> ${String(Math.round(wordSpaceExtraPx * (-1000 / fontSizeLast) * 1e6) / 1e6)}`;
        } else {
          textContentObjStr += `( ) ${String(Math.round(wordSpaceExtraPx * (-1000 / fontSizeLast) * 1e6) / 1e6)}`;
        }
      }
      kernSpacing = false;

      wordBoxLast = wordBox;

      // In general, we assume that (given our adjustments to character spacing) the rendered word has the same width as the image of that word.
      // However, this assumption does not hold for single-character words, as there is no space between character to adjust.
      // Therefore, we calculate the difference between the rendered and actual word and apply an adjustment to the width of the next space.
      // (This does not apply to drop caps as those have horizontal scaling applied to exactly match the image.)
      if (charArr.length === 1 && !word.dropcap) {
        const wordLastGlyph = wordFontOpentype.charToGlyph(charArr.at(-1));
        const wordLastGlyphMetrics = wordLastGlyph.getMetrics();
        const lastCharWidth = (wordLast.visualCoords ? (wordLastGlyphMetrics.xMax - wordLastGlyphMetrics.xMin) : wordLastGlyph.advanceWidth) * (wordFontSize / wordFontOpentype.unitsPerEm);
        spacingAdj = wordWidthAdj - lastCharWidth - angleAdjWordX;
      } else {
        spacingAdj = 0 - angleAdjWordX;
      }

      textContentObjStr += ' ] TJ\n';

      const fontSize = word.smallCaps && word.text[0] && word.text[0] !== word.text[0].toUpperCase() ? wordFontSize * 0.8 : wordFontSize;
      if (pdfFont !== pdfFontCurrent || fontSize !== fontSizeLast) {
        textContentObjStr += `${pdfFont} ${String(fontSize)} Tf\n`;
        pdfFontCurrent = pdfFont;
        pdfFontTypeCurrent = pdfFontType;
        fontSizeLast = fontSize;
      }
      if (fillColor !== fillColorCurrent) {
        textContentObjStr += `${fillColor}\n`;
        fillColorCurrent = fillColor;
      }
      if (ts !== tsCurrent) {
        textContentObjStr += `${String(ts)} Ts\n`;
        tsCurrent = ts;
      }
      if (tz !== tzCurrent) {
        textContentObjStr += `${String(tz)} Tz\n`;
        tzCurrent = tz;
      }

      textContentObjStr += `${String(Math.round(charSpacing * 1e6) / 1e6)} Tc\n`;

      textContentObjStr += '[ ';

      // Non-ASCII and special characters are encoded/escaped using winEncodingLookup
      for (let k = 0; k < charArr.length; k++) {
        const letterSrc = charArr[k];
        const letter = word.smallCaps ? charArr[k].toUpperCase() : charArr[k];
        const fontSizeLetter = word.smallCaps && letterSrc !== letter ? wordFontSize * 0.8 : wordFontSize;

        const letterEnc = pdfFontTypeCurrent === 0 ? wordFontOpentype.charToGlyphIndex(letter)?.toString(16).padStart(4, '0') : winEncodingLookup[letter];
        if (letterEnc) {
          let kern = (kerningArr[k] || 0) * (-1000 / fontSizeLetter);

          if (word.lang === 'chi_sim' && j + 1 < words.length && words[j + 1].lang === 'chi_sim') {
            kernSpacing = true;
            const wordNext = words[j + 1];
            const wordSpaceNextAdj = (wordNext.bbox.left - wordBox.right) / cosAngle;
            // const wordSpaceNextAdj = wordNext.bbox.left - wordBox.right;

            const wordGlyphMetrics = wordFontOpentype.charToGlyph(charArr.at(-1)).getMetrics();
            const wordNextGlyphMetrics = wordFontOpentype.charToGlyph(wordNext.text.substr(0, 1)).getMetrics();

            const wordRightBearing = word.visualCoords ? wordGlyphMetrics.rightSideBearing * (wordFontSize / wordFontOpentype.unitsPerEm) : 0;

            const wordNextLeftBearing = wordNext.visualCoords ? wordNextGlyphMetrics.xMin * (wordFontSize / wordFontOpentype.unitsPerEm) : 0;

            const wordSpaceExpected = charSpacing + wordRightBearing + wordNextLeftBearing;

            kern = Math.round((wordSpaceNextAdj - wordSpaceExpected + spacingAdj + angleAdjWordX) * (-1000 / wordFontSize));
          }

          // PDFs render text based on a "widths" PDF object, rather than the advance width in the embedded font file.
          // The widths are in 1/1000 of a unit, and this PDF object is created by mupdf.
          // The widths output in this object are converted to integers, which creates a rounding error when the font em size is not 1000.
          // All built-in fonts are already 1000 to avoid this, however custom fonts may not be.
          // This results in a small rounding error for the advance of each character, which adds up, as PDF positioning is cumulative.
          // To correct for this, the error is calculated and added to the kerning value.
          const charAdvance = wordFontOpentype.charToGlyph(letter).advanceWidth;
          const charWidthPdfPrecise = charAdvance * (1000 / wordFontOpentype.unitsPerEm);
          const charWidthPdfRound = Math.floor(charWidthPdfPrecise);
          const charWidthError = charWidthPdfRound - charWidthPdfPrecise;

          const charAdj = kern + charWidthError;

          if (pdfFont !== pdfFontCurrent || fontSizeLetter !== fontSizeLast) {
            textContentObjStr += ' ] TJ\n';
            textContentObjStr += `${pdfFont} ${String(fontSizeLetter)} Tf\n`;
            fontSizeLast = fontSizeLetter;
            textContentObjStr += `${String(Math.round(charSpacing * 1e6) / 1e6)} Tc\n`;
            textContentObjStr += '[ ';
          }

          if (pdfFontTypeCurrent === 0) {
            textContentObjStr += `<${letterEnc}> ${String(Math.round(charAdj * 1e6) / 1e6)} `;
          } else {
            textContentObjStr += `(${letterEnc}) ${String(Math.round(kern * 1e6) / 1e6)} `;
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
            textContentObjStr += `<${spaceChar}> ${String(Math.round(kern * 1e6) / 1e6)} `;
          } else {
            textContentObjStr += `( ) ${String(Math.round(kern * 1e6) / 1e6)} `;
          }
        }
      }

      wordLast = word;
      wordRightBearingLast = wordLast.visualCoords ? wordMetrics.rightSideBearing : 0;
      wordFontOpentypeLast = wordFontOpentype;
      charSpacingLast = charSpacing;
    }

    textContentObjStr += ' ] TJ\n';
  }

  textContentObjStr += 'ET';

  return textContentObjStr;
}
