import ocr from '../objects/ocrObjects.js';

import {
  calcBboxUnion,
  calcLang,
  mean50,
  round6,
  unescapeXml,
} from '../utils/miscUtils.js';

import { LayoutDataTablePage } from '../objects/layoutObjects.js';

/**
 * @param {Object} params
 * @param {string} params.ocrStr
 * @param {number} params.n
 */
export async function convertPageStext({ ocrStr, n }) {
  const pageDimsMatch = ocrStr.match(/<page .+?width=['"]([\d.-]+)['"] height=['"]([\d.-]+)['"]/);

  if (!pageDimsMatch || !pageDimsMatch[1] || !pageDimsMatch[2]) throw new Error('Page dimensions not found in stext.');

  const pageDims = { height: parseInt(pageDimsMatch[2]), width: parseInt(pageDimsMatch[1]) };

  const pageObj = new ocr.OcrPage(n, pageDims);

  /** @type {Array<number>} */
  const angleRisePage = [];

  /** @type {Set<string>} */
  const langSet = new Set();

  function convertParStext(xmlPar, n = 1) {
    /** @type {Array<OcrLine>} */
    const parLineArr = [];

    /**
     * @param {string} xmlLine
     * @param {number} n
     */
    // eslint-disable-next-line no-shadow
    function convertLineStext(xmlLine, n = 1) {
    // Remove the <block> tag to avoid the regex matching it instead of the <line> tag.
    // We currently have no "block" level object, however this may be useful in the future.
      xmlLine = xmlLine.replace(/<block[^>]*?>/i, '');

      const xmlLinePreChar = xmlLine.match(/^[\s\S]*?(?=<char)/)?.[0];
      if (!xmlLinePreChar) return;

      const xmlLineFormatting = xmlLinePreChar?.match(/<font[^>]+/)?.[0];
      const fontName = xmlLineFormatting?.match(/name=['"]([^'"]*)/)?.[1];
      const fontSizeStr = xmlLineFormatting?.match(/size=['"]([^'"]*)/)?.[1];

      console.assert(fontSizeStr, 'Font size not found in stext.');

      const fontSizeLine = fontSizeStr ? parseFloat(fontSizeStr) : 10;

      const fontFamilyLine = fontName?.replace(/-.+/g, '') || 'Default';

      const lineBoxArr = [...xmlLinePreChar.matchAll(/bbox(?:es)?=['"](\s*[\d.-]+)(\s*[\d.-]+)?(\s*[\d.-]+)?(\s*[\d.-]+)?/g)][0].slice(1, 5).map((x) => Math.max(parseFloat(x), 0));

      // Unlike Tesseract, stext does not have a native "word" unit (it provides only lines and letters).
      // Therefore, lines are split into words on either (1) a space character or (2) a change in formatting.
      const wordStrArr = xmlLine.split(/(?:<char[^>]*?c=['"]\s+['"]\/>)/ig);
      // If the last element is a closing font tag, remove it.
      if (wordStrArr[wordStrArr.length - 1] && wordStrArr[wordStrArr.length - 1].trim() === '</font>') wordStrArr.pop();

      if (wordStrArr.length === 0) return;

      /** @type {Array<Array<{left: number, top: number, right: number, bottom: number}>>} */
      const bboxes = [];

      let baselineFirst = 0;
      let baselineLast = 0;
      let baselineCurrent = 0;

      /** @type {Array<Array<string>>} */
      const text = [];
      let currentStyle = 'normal';
      let currentSize = 0;
      /** @type {Array<string>} */
      const styleArr = [];
      /** @type {Array<boolean>} */
      const smallCapsArr = [];
      /** @type {Array<boolean>} */
      const smallCapsAltArr = [];
      /** @type {Array<boolean>} */
      const smallCapsAltTitleCaseArr = [];
      /** @type {Array<string>} */
      const fontFamilyArr = [];
      /** @type {Array<number>} */
      const fontSizeArr = [];
      /** @type {Array<boolean>} */
      const superArr = [];

      for (let i = 0; i < wordStrArr.length; i++) {
        const wordStr = wordStrArr[i];

        let textWordArr = [];
        let bboxesWordArr = [];
        let fontFamily = fontFamilyArr[fontFamilyArr.length - 1] || fontFamilyLine || 'Default';
        let fontSize = fontSizeArr[fontSizeArr.length - 1] || fontSizeLine || 10;
        let smallCaps;
        let smallCapsAlt;
        let smallCapsAltTitleCase;
        let superWord = false;
        let styleWord = 'normal';

        // Fonts can be changed at any point in the word string.
        // Sometimes the font is changed before a space character, and othertimes it is changed after the space character.
        // This regex splits the string into elements that contain either (1) a font change or (2) a character.
        // The "quad" attribute includes 8 numbers (x and y coordinates for all 4 corners) however we only use capturing groups for 4
        const stextCharRegex = /(<font[^>]+>\s*)|<char quad=['"](\s*[\d.-]+)(\s*[\d.-]+)(?:\s*[\d.-]+)(?:\s*[\d.-]+)(?:\s*[\d.-]+)(?:\s*[\d.-]+)(\s*[\d.-]+)(\s*[\d.-]+)[^>]*?y=['"]([\d.-]+)['"][^>]*?c=['"]([^'"]+)['"]\s*\/>/ig;

        const letterOrFontArr = [...wordStr.matchAll(stextCharRegex)];

        if (letterOrFontArr.length === 0) continue;

        let wordInit = false;

        for (let j = 0; j < letterOrFontArr.length; j++) {
          const fontStr = letterOrFontArr[j][1];
          if (fontStr) {
            const fontNameStrI = fontStr?.match(/name=['"]([^'"]*)/)?.[1];
            const fontSizeStrI = fontStr?.match(/size=['"]([^'"]*)/)?.[1];

            // While small caps can be printed using special "small caps" fonts, they can also be printed using a regular font with a size change.
            // This block of code detects small caps printed in title case by checking for a decrease in font size after the first letter.
            // TODO: This logic currently fails when:
            // (1) Runs of small caps include punctuation, which is printed at the full size (and therefore is counted as a size increase ending small caps).
            // (2) Runs of small caps that start with lower-case letters, which do not conform to the expectation that runs of small caps start with a capital letter.
            if (fontSizeStrI) {
              const newSize = parseFloat(fontSizeStrI);
              const secondLetter = wordInit && bboxesWordArr.length === 1;
              const baselineNextLetter = parseFloat(letterOrFontArr[j + 1]?.[6]);
              const fontSizeMin = Math.min(newSize, currentSize);
              const baselineDelta = (baselineNextLetter - baselineCurrent) / fontSizeMin;
              const sizeDelta = (newSize - currentSize) / fontSizeMin;
              if (secondLetter && newSize < currentSize && currentSize > 0 && baselineNextLetter && Math.abs(baselineDelta) < 0.1) {
                smallCapsAlt = true;
                smallCapsAltTitleCase = true;
              } else if (Number.isFinite(baselineDelta) && Number.isFinite(sizeDelta)
              && ((baselineDelta < -0.2 && sizeDelta < -0.2) || (i === 0 && baselineDelta > 0.2 && sizeDelta > 0.2))) {
                if (textWordArr.length > 0) {
                  text.push(textWordArr);
                  bboxes.push(bboxesWordArr);
                  styleArr.push(styleWord);
                  fontFamilyArr.push(fontFamily);
                  fontSizeArr.push(fontSize);
                  smallCapsAltArr.push(smallCapsAlt);
                  smallCapsArr.push(smallCaps);
                  smallCapsAltTitleCaseArr.push(smallCapsAltTitleCase);
                  superArr.push(sizeDelta > 0);

                  textWordArr = [];
                  bboxesWordArr = [];
                  fontFamily = fontFamilyArr[fontFamilyArr.length - 1] || fontFamilyLine || 'Default';
                  fontSize = fontSizeArr[fontSizeArr.length - 1] || fontSizeLine || 10;
                  styleWord = 'normal';
                }

                if (sizeDelta > 0) currentSize = newSize || currentSize;
                superWord = sizeDelta < 0;
              } else {
                // An increase in font size ends any small caps sequence.
                // A threshold is necessary because stext data has been observed to have small variations without a clear reason.
                // eslint-disable-next-line no-lonely-if
                if (Math.abs(sizeDelta) > 0.05) {
                  currentSize = newSize || currentSize;
                  smallCapsAlt = false;
                  superWord = false;
                }
              }
            }

            fontFamily = fontNameStrI || (fontFamilyArr[fontFamilyArr.length - 1] || fontFamilyLine || 'Default');
            fontSize = currentSize || (fontSizeArr[fontSizeArr.length - 1] || fontSizeLine || 10);

            // Label as `smallCapsAlt` rather than `smallCaps`, as we confirm the word is all caps before marking as `smallCaps`.
            smallCapsAlt = smallCapsAlt ?? smallCapsAltArr[smallCapsAltArr.length - 1];
            smallCaps = /small\W?cap/i.test(fontStr);

            if (/italic/i.test(fontStr)) {
              // The word is already initialized, so we need to change the last element of the style array.
              // Label as `smallCapsAlt` rather than `smallCaps`, as we confirm the word is all caps before marking as `smallCaps`.
              currentStyle = 'italic';
            } else if (/bold/i.test(fontStr)) {
              currentStyle = 'bold';
            } else {
              currentStyle = 'normal';
            }

            continue;
          } else {
            baselineCurrent = parseFloat(letterOrFontArr[j][6]);
          }

          if (!wordInit) {
            styleWord = currentStyle;
            wordInit = true;
          }

          // The first or last characters may be above the normal baseline, to the max of the first/last 3 characters is used to calculate slope.
          if (baselineFirst === 0) {
            baselineFirst = parseFloat(letterOrFontArr[j][6]);
          } else if (j <= 3) {
            baselineFirst = Math.max(baselineFirst, parseFloat(letterOrFontArr[j][6]));
          }

          // Is there ever a case where the last "word" does not have a character?
          // If so, a fallback should be added.
          if (i === wordStrArr.length - 1) {
            if (baselineLast === 0) {
              baselineLast = parseFloat(letterOrFontArr[j][6]);
            } else {
              baselineLast = Math.max(baselineFirst, parseFloat(letterOrFontArr[j][6]));
            }
          }

          // Small caps created by reducing font size can carry forward across multiple words.
          smallCapsAlt = smallCapsAlt ?? smallCapsAltArr[smallCapsAltArr.length - 1];

          textWordArr.push(letterOrFontArr[j][7]);

          bboxesWordArr.push({
            left: Math.round(parseFloat(letterOrFontArr[j][2])),
            top: Math.round(parseFloat(letterOrFontArr[j][3])),
            right: Math.round(parseFloat(letterOrFontArr[j][4])),
            bottom: Math.round(parseFloat(letterOrFontArr[j][5])),
          });
        }

        if (textWordArr.length === 0) continue;

        text.push(textWordArr);
        bboxes.push(bboxesWordArr);
        styleArr.push(styleWord);
        fontFamilyArr.push(fontFamily);
        fontSizeArr.push(fontSize);
        smallCapsAltArr.push(smallCapsAlt);
        smallCapsArr.push(smallCaps);
        smallCapsAltTitleCaseArr.push(smallCapsAltTitleCase);
        superArr.push(superWord);
      }

      // Return if there are no letters in the line.
      // This commonly happens for "lines" that contain only space characters.
      if (bboxes.length === 0) return;

      const rise = baselineLast - baselineFirst;
      const run = bboxes[bboxes.length - 1][bboxes[bboxes.length - 1].length - 1].right - bboxes[0][0].left;

      const baselineSlope = !run ? 0 : rise / run;

      const lineBbox = {
        left: lineBoxArr[0], top: lineBoxArr[1], right: lineBoxArr[2], bottom: lineBoxArr[3],
      };

      // baselinePoint should be the offset between the bottom of the line bounding box, and the baseline at the leftmost point
      let baselinePoint = baselineFirst - lineBbox.bottom;
      baselinePoint = baselinePoint || 0;

      const baselineOut = [round6(baselineSlope), Math.round(baselinePoint)];

      // This is only a rough estimate, however since `size` is set on individual words, this value should not matter.
      const letterHeightOut = fontSizeLine * 0.6;

      const lineObj = new ocr.OcrLine(pageObj, lineBbox, baselineOut, letterHeightOut, null);

      let lettersKept = 0;
      for (let i = 0; i < text.length; i++) {
        const wordText = unescapeXml(text[i].join(''));

        if (wordText.trim() === '') continue;

        const wordLang = calcLang(wordText);
        langSet.add(wordLang);

        const wordID = `word_${n + 1}_${pageObj.lines.length + 1}_${i + 1}`;
        const bboxesI = bboxes[i];

        /** @type {Array<OcrChar>} */
        const charObjArr = [];

        for (let j = 0; j < text[i].length; j++) {
          const letter = unescapeXml(text[i][j]);

          const bbox = bboxesI[j];

          // For Chinese, every "character" in the .hocr should be its own word.
          // Tesseract LSTM already does this, however Tesseract Legacy combines entire lines into the same "word",
          // which makes good alignment impossible.
          if (wordLang === 'chi_sim') {
            const wordObj = new ocr.OcrWord(lineObj, letter, bbox, `${wordID}_${j}`);
            wordObj.conf = 100;
            wordObj.lang = wordLang;
            wordObj.visualCoords = false;

            lineObj.words.push(wordObj);
            lettersKept++;
          } else {
            const charObj = new ocr.OcrChar(letter, bbox);
            charObjArr.push(charObj);
          }
        }

        if (wordLang === 'chi_sim') continue;

        const bboxesILeft = Math.min(...bboxesI.map((x) => x.left));
        const bboxesIRight = Math.max(...bboxesI.map((x) => x.right));
        const bboxesITop = Math.min(...bboxesI.map((x) => x.top));
        const bboxesIBottom = Math.max(...bboxesI.map((x) => x.bottom));

        const bbox = {
          left: bboxesILeft, top: bboxesITop, right: bboxesIRight, bottom: bboxesIBottom,
        };

        const wordObj = new ocr.OcrWord(lineObj, wordText, bbox, wordID);
        wordObj.size = fontSizeArr[i];

        wordObj.lang = wordLang;

        wordObj.chars = charObjArr;

        // In stext, the coordinates are based on font bounding boxes, not where pixels start/end.
        wordObj.visualCoords = false;

        // There is no confidence information in stext.
        // Confidence is set to 100 simply for ease of reading (to avoid all red text if the default was 0 confidence).
        wordObj.conf = 100;

        if (smallCapsAltArr[i] && !/[a-z]/.test(wordObj.text) && /[A-Z].?[A-Z]/.test(wordObj.text)) {
          wordObj.smallCaps = true;
          if (smallCapsAltTitleCaseArr[i]) {
            wordObj.chars.slice(1).forEach((x) => {
              x.text = x.text.toLowerCase();
            });
          } else {
            wordObj.chars.forEach((x) => {
              x.text = x.text.toLowerCase();
            });
          }
          wordObj.text = wordObj.chars.map((x) => x.text).join('');
        } else if (smallCapsArr[i]) {
          wordObj.smallCaps = true;
        }

        if (styleArr[i] === 'italic') {
          wordObj.style = 'italic';
        } if (styleArr[i] === 'bold') {
          wordObj.style = 'bold';
        }

        wordObj.raw = wordStrArr[i];

        wordObj.font = fontFamilyArr[i];

        wordObj.sup = superArr[i];

        if (styleArr[i] === 'sup') {
          wordObj.sup = true;
        } else if (styleArr[i] === 'dropcap') {
          wordObj.dropcap = true;
        }

        lineObj.words.push(wordObj);

        lettersKept++;
      }

      // If there are no letters in the line, drop the entire line element
      if (lettersKept === 0) return;

      pageObj.lines.push(lineObj);
      parLineArr.push(lineObj);
      // eslint-disable-next-line consistent-return
      return baselineSlope;
    }

    const lineStrArr = xmlPar.split(/<\/line>/);

    for (let i = 0; i < lineStrArr.length; i++) {
      const angle = convertLineStext(lineStrArr[i], n);
      if (typeof angle === 'number' && !Number.isNaN(angle)) angleRisePage.push(angle);
    }

    if (parLineArr.length === 0) return;

    const parbox = calcBboxUnion(parLineArr.map((x) => x.bbox));

    const parObj = new ocr.OcrPar(pageObj, parbox);

    parLineArr.forEach((x) => {
      x.par = parObj;
    });

    parObj.lines = parLineArr;
    pageObj.pars.push(parObj);
  }

  const parStrArr = ocrStr.split(/<\/block>/);

  for (let i = 0; i < parStrArr.length; i++) {
    convertParStext(parStrArr[i], n);
  }

  const angleRiseMedian = mean50(angleRisePage) || 0;

  const angleOut = Math.asin(angleRiseMedian) * (180 / Math.PI);

  pageObj.angle = angleOut;

  return { pageObj, dataTables: new LayoutDataTablePage(), langSet };
}
