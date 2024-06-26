import ocr from '../objects/ocrObjects.js';

import {
  determineSansSerif, getTextScript,
  unescapeXml,
} from '../utils/miscUtils.js';

import { LayoutDataTablePage } from '../objects/layoutObjects.js';
import { pass2, pass3 } from './convertPageShared.js';

// If enabled, raw strings are saved in OCR objects for debugging purposes.
const debugMode = true;

/**
 * @param {Object} params
 * @param {string} params.ocrStr
 * @param {number} params.n
 * @param {?dims} params.pageDims
 * @param {number} params.rotateAngle - The angle that the input image is rotated prior to recognition.
 *    This is used to transform OCR coordinates back to the original coordinate space after recognizing a rotated intermediate image.
 * @param {boolean} params.keepItalic - If true, italic tags (`<em>`) are honored.  This is false by default,
 *    as vanilla Tesseract does not recognize italic text in a way that is reliable.
 *    This is fixed for Legacy recognition in the included custom build of Tesseract.
 * @param {boolean} params.scribeMode
 */
export async function convertPageHocr({
  ocrStr, n, pageDims = null, rotateAngle = 0, keepItalic = false, scribeMode = false,
}) {
  rotateAngle = rotateAngle || 0;

  let currentLang = 'eng';

  const angleRisePage = [];
  const lineLeft = [];
  const lineTop = [];

  // If page dimensions are not provided as an argument, we assume that the entire image is being recognized
  // (so the width/height of the image bounding box is the same as the width/height of the image).
  if (!pageDims) {
    const pageElement = ocrStr.match(/<div class=["']ocr_page["'][^>]+/i);
    if (pageElement != null) {
      const pageDimsMatch = pageElement[0].match(/bbox \d+ \d+ (\d+) (\d+)/i);
      if (pageDimsMatch != null) {
        pageDims = { height: parseInt(pageDimsMatch[2]), width: parseInt(pageDimsMatch[1]) };
      }
    }
  }

  const pageObj = new ocr.OcrPage(n, pageDims);

  // Test whether character-level data (class="ocrx_cinfo" in Tesseract) is present.
  const charMode = !!/ocrx_cinfo/.test(ocrStr);

  // The JavaScript regex engine does not support matching start/end tags (some other engines do), so the end of words and lines are detected
  // through a hard-coded number of </span> end tags.  The only difference charMode should make on the expressions below is the number of
  // consecutive </span> tags required.
  let lineRegex = /<span class=["']ocr_line[\s\S]+?(?:<\/span>\s*){2}/ig;
  if (charMode) {
    lineRegex = /<span class=["']ocr_line[\s\S]+?(?:<\/span>\s*)(?:<\/em>\s*)?(?:<\/span>\s*){2}/ig;
  }

  const wordRegexCharLevel = /<span class=["']ocrx_word[\s\S]+?(?:<\/span>\s*)(?:<\/em>\s*)?(?:<\/span>\s*){1}/ig;
  const wordRegex = /<span class=["']ocrx_word[\s\S]+?(?:<\/span>\s*)/ig;

  const charRegex = /<span class=["']ocrx_cinfo["'] title='([^'"]+)["']>([^<]*)<\/span>/ig;

  // Remove all bold/italics tags.  These complicate the syntax and are unfortunately virtually always wrong anyway (coming from Tesseract).
  ocrStr = ocrStr.replaceAll(/<\/?strong>/ig, '');

  // The custom built-in Tesseract build should reliably identify italics (for Legacy only)
  if (!keepItalic) {
    ocrStr = ocrStr.replaceAll(/<\/?em>/ig, '');
  }

  // Delete namespace to simplify xpath
  ocrStr = ocrStr.replace(/<html[^>]*>/i, '<html>');

  // Replace various classes with "ocr_line" class for simplicity
  // At least in Tesseract, these elements are not identified accurately or consistently enough to warrent different treatment.
  ocrStr = ocrStr.replace(/(class=')ocr_caption/ig, '$1ocr_line');
  ocrStr = ocrStr.replace(/(class=')ocr_textfloat/ig, '$1ocr_line');
  ocrStr = ocrStr.replace(/(class=')ocr_header/ig, '$1ocr_line');

  /**
     * @param {string} match
     */
  function convertLine(match) {
    const titleStrLine = match.match(/title=['"]([^'"]+)/)?.[1];
    if (!titleStrLine) return '';

    const linebox1 = [...titleStrLine.matchAll(/bbox(?:es)?(\s+[\d.-]+)(\s+[\d.-]+)?(\s+[\d.-]+)?(\s+[\d.-]+)?/g)][0].slice(1, 5).map((x) => parseInt(x));

    const linebox = {
      left: linebox1[0], top: linebox1[1], right: linebox1[2], bottom: linebox1[3],
    };

    // The baseline can be missing in the case of vertical text (textangle present instead)
    const baselineMatch = [...titleStrLine.matchAll(/baseline(\s+[\d.-]+)(\s+[\d.-]+)/g)][0];

    if (!baselineMatch) return '';

    const baseline = baselineMatch.slice(1, 5).map((x) => parseFloat(x));

    // Only calculate baselines from lines 200px+.
    // This avoids short "lines" (e.g. page numbers) that often report wild values.
    if ((linebox.right - linebox.left) >= 200) {
      angleRisePage.push(baseline[0]);
      lineLeft.push(linebox.left);
      lineTop.push(linebox.top);
    }

    /** @type {?number} */
    let lineAscHeightFinal = null;
    /** @type {?number} */
    let lineXHeightFinal = null;

    if (scribeMode) {
      const lineAscHeightFinalStr = titleStrLine.match(/x_asc_height\s+([\d.-]+)/)?.[1];
      const lineXHeightFinalStr = titleStrLine.match(/x_x_height\s+([\d.-]+)/)?.[1];
      if (lineAscHeightFinalStr) lineAscHeightFinal = parseFloat(lineAscHeightFinalStr);
      if (lineXHeightFinalStr) lineXHeightFinal = parseFloat(lineXHeightFinalStr);
    }

    // This is not an `else` because old versions of Scribe used the same metrics as Tesseract,
    // so it is possible that `scribeMode` is `true` but this block still needs to be run.
    // This can likely be removed at some point in the future, as this change occured very early in Scribe's development.
    if (!lineAscHeightFinal && !lineXHeightFinal) {
      // Line font size metrics as reported by Tesseract.
      // As these are frequently not correct (as Tesseract calculates them before character recognition),
      // so they may be replaced later by versions we calculate.
      const lineAllHeightTessStr = parseFloat(titleStrLine.match(/x_size\s+([\d.-]+)/)?.[1] || '15');
      const lineAscHeightTessStr = parseFloat(titleStrLine.match(/x_ascenders\s+([\d.-]+)/)?.[1] || '0');
      const lineDescHeightTessStr = parseFloat(titleStrLine.match(/x_descenders\s+([\d.-]+)/)?.[1] || '0');

      lineAscHeightFinal = lineAllHeightTessStr - lineDescHeightTessStr;

      // When Scribe exports lines with `null` `xHeight` values to HOCR, `x_ascenders` is omitted.
      if (lineAscHeightTessStr > 0) {
        lineXHeightFinal = lineAllHeightTessStr - lineDescHeightTessStr - lineAscHeightTessStr;
      }
    }

    console.assert(lineAscHeightFinal || lineXHeightFinal, 'Line height metrics missing.');
    const lineObj = new ocr.OcrLine(pageObj, linebox, baseline, lineAscHeightFinal, lineXHeightFinal);

    if (debugMode) lineObj.raw = match;

    /**
     * @param {string} match
     */
    function convertWordCharLevel(match) {
      let text = '';

      const titleStrWord = match.match(/title=['"]([^'"]+)/)?.[1];
      const confMatch = titleStrWord.match(/(?:;|\s)x_wconf\s+(\d+)/);
      let wordConf = 0;
      if (confMatch != null) {
        wordConf = parseInt(confMatch[1]);
      }

      const italic = /<\/em>\s*<\/span>/.test(match);

      const wordID = match.match(/id=['"]([^'"]*)['"]/i)?.[1];

      const wordLangRaw = match.match(/lang=['"]([^'"]*)['"]/i)?.[1];

      const fontName = match.match(/^[^>]+?x_font\s*([\w-]+)/)?.[1];

      const fontFamily = determineSansSerif(fontName);

      const it = match.matchAll(charRegex);
      const letterArr = [...it];

      const bboxes = letterArr.map((x) => x[1].match(/(\d+) (\d+) (\d+) (\d+)/).slice(1, 5).map((y) => parseInt(y)));

      let wordLang = wordLangRaw || currentLang;
      if (['chi_sim', 'chi_tra'].includes(wordLang)) {
        const charArr = letterArr.map((x) => x[2]);
        const { han: hanChars, latin: latinChars } = getTextScript(charArr);

        if (hanChars === 0) {
          // Do not let languages be switched for a word that contains 0 Han characters.
          if (!['chi_sim', 'chi_tra'].includes(currentLang)) {
            wordLang = currentLang;
          // Do not let language be Chinese for any word that contains no Han characters and >0 non-Chinese characters.
          // TODO: Assign the appropriate Latin language (not necessarily English).
          } else if (latinChars > 0) {
            wordLang = 'eng';
          }
        }
      }

      /** @type {Array<OcrChar>} */
      const charObjArr = [];

      for (let j = 0; j < letterArr.length; j++) {
        let contentStrLetter = letterArr[j][2];

        // Handle characters escaped in XML
        contentStrLetter = unescapeXml(contentStrLetter);

        const bbox = {
          left: bboxes[j][0], top: bboxes[j][1], right: bboxes[j][2], bottom: bboxes[j][3],
        };

        // For Chinese, every "character" in the .hocr should be its own word.
        // Tesseract LSTM already does this, however Tesseract Legacy combines entire lines into the same "word",
        // which makes good alignment impossible.
        if (wordLang === 'chi_sim') {
          const wordObj = new ocr.OcrWord(lineObj, contentStrLetter, bbox, `${wordID}_${j}`);
          wordObj.conf = wordConf;
          wordObj.lang = wordLang;

          lineObj.words.push(wordObj);
        } else {
          const charObj = new ocr.OcrChar(contentStrLetter, bbox);
          charObjArr.push(charObj);

          text += contentStrLetter;
        }
      }

      if (wordLang === 'chi_sim') return '';

      text = text ?? '';
      text = text.trim();

      if (text === '') return ('');

      const bboxesCore = letterArr.map((x) => x[1].match(/(\d+) (\d+) (\d+) (\d+)/)?.slice(1, 5).map((y) => parseInt(y)));

      const wordBoxCore = {
        left: Math.min(...bboxesCore.map((x) => x[0])),
        top: Math.min(...bboxesCore.map((x) => x[1])),
        right: Math.max(...bboxesCore.map((x) => x[2])),
        bottom: Math.max(...bboxesCore.map((x) => x[3])),
      };

      const wordObj = new ocr.OcrWord(lineObj, text, wordBoxCore, `${wordID}a`);
      wordObj.lang = wordLang;

      wordObj.chars = charObjArr;

      if (debugMode) wordObj.raw = match;

      if (italic) wordObj.style = 'italic';
      if (fontFamily !== 'Default') wordObj.font = fontFamily;

      wordObj.conf = wordConf;

      lineObj.words.push(wordObj);

      return '';
    }

    /**
       * @param {string} match
       */
    function convertWord(match) {
      const wordID = match.match(/id=['"]([^'"]*)['"]/i)?.[1];

      const wordSup = /<sup>/i.test(match);
      const wordDropCap = /<span class=['"]ocr_dropcap['"]>/i.test(match);

      let wordText;
      if (wordSup) {
        wordText = match.replace(/\s*<sup>/i, '').replace(/<\/sup>\s*/i, '').match(/>([^>]*)</)?.[1];
      } else if (wordDropCap) {
        wordText = match.replace(/\s*<span class=['"]ocr_dropcap['"]>/i, '').match(/>([^>]*)</)?.[1];
      } else {
        wordText = match.match(/>([^>]*)</)?.[1];
      }

      wordText = unescapeXml(wordText);

      if (!wordText) {
        return '';
      }

      const titleStrWord = match.match(/title=['"]([^'"]+)/)?.[1];

      const wordLang = match.match(/lang=['"]([^'"]*)['"]/i)?.[1] || currentLang;

      if (!titleStrWord) {
        console.log(`Unable to process word, skipping: ${match}`);
        return '';
      }

      const wordBox1 = [...titleStrWord.matchAll(/bbox(?:es)?(\s+[\d-.]+)(\s+[\d-.]+)?(\s+[\d-.]+)?(\s+[\d-.]+)?/g)][0].slice(1, 5).map((x) => parseFloat(x));

      const wordBox = {
        left: wordBox1[0],
        top: wordBox1[1],
        right: wordBox1[2],
        bottom: wordBox1[3],
      };

      const fontName = match.match(/^[^>]+?x_font\s*([\w-]+)/)?.[1];

      const fontFamily = determineSansSerif(fontName);

      const styleStr = match.match(/style=['"]([^'"]+)/)?.[1];

      let fontStyle = 'normal';
      if (styleStr && /italic/i.test(styleStr)) {
        fontStyle = 'italic';
      } else if (styleStr && /small-caps/i.test(styleStr)) {
        fontStyle = 'smallCaps';
      }

      const confMatch = titleStrWord.match(/(?:;|\s)x_wconf\s+(\d+)/)?.[1] || '0';
      const wordConf = parseInt(confMatch) || 0;

      const wordObj = new ocr.OcrWord(lineObj, wordText, wordBox, `${wordID}a`);
      wordObj.lang = wordLang;

      // Font size is only respected if this is a re-import, as if an ocrWord object has `size` set, it will be used over line metrics.
      // Therefore, this should only be set if manually set by the user.
      if (scribeMode) {
        const wordFontSizeStr = titleStrWord.match(/(?:;|\s)x_fsize\s+(\d+)/)?.[1];
        if (wordFontSizeStr) {
          const wordFontSize = parseInt(wordFontSizeStr);
          if (wordFontSize) wordObj.size = wordFontSize;
        }
      }

      wordObj.style = fontStyle;
      if (fontFamily !== 'Default') {
        wordObj.font = fontFamily;
      }

      wordObj.sup = wordSup;

      wordObj.conf = wordConf;

      lineObj.words.push(wordObj);

      return '';
    }

    if (charMode) {
      match = match.replaceAll(wordRegexCharLevel, convertWordCharLevel);
    } else {
      match = match.replaceAll(wordRegex, convertWord);
    }

    pageObj.lines.push(lineObj);

    return '';
  }

  /**
     * @param {string} match
     */
  const convertPar = (match) => {
    const parLang = match.match(/^.+?lang=['"]([^'"]*)['"]/i)?.[1];
    if (parLang) currentLang = parLang;
    match.replaceAll(lineRegex, convertLine);
    return '';
  };

  ocrStr = ocrStr.replaceAll(/<p class=["']ocr_par[\s\S]+?(?:<\/p>\s*)/ig, convertPar);

  ocrStr = ocrStr.replaceAll(lineRegex, convertLine);

  pageObj.angle = rotateAngle;

  const warn = { char: charMode ? '' : 'char_warning' };

  pass2(pageObj, rotateAngle);
  const langSet = pass3(pageObj);

  return {
    pageObj, dataTables: new LayoutDataTablePage(), warn, langSet,
  };
}
