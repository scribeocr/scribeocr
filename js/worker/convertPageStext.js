import ocr from '../objects/ocrObjects.js';

import {
  mean50, unescapeXml, round6,
} from '../miscUtils.js';

import { pass3 } from './convertPageShared.js';
import { LayoutDataTablePage } from '../objects/layoutObjects.js';

const stextSplitRegex = /(?:<char[^>]*?c=['"]\s+['"]\/>)|(?:<\/font>\s*(?=<font))/ig;
// The "quad" attribute includes 8 numbers (x and y coordinates for all 4 corners) however we only use capturing groups for 4
const stextCharRegex = /(<font[^>]+>\s*)?<char quad=['"](\s*[\d.-]+)(\s*[\d.-]+)(?:\s*[\d.-]+)(?:\s*[\d.-]+)(?:\s*[\d.-]+)(?:\s*[\d.-]+)(\s*[\d.-]+)(\s*[\d.-]+)[^>]*?y=['"]([\d.-]+)['"][^>]*?c=['"]([^'"]+)['"]\s*\/>/ig;

// Conversion function for "stext" (or "structured text" output from mupdf)
// This format is more similar to Abbyy XML and is based on that parsing code.
// The following features were removed (compared with Abbyy XML):
// - Drop cap detection
// - Superscript detection

/**
 * @param {Object} params
 * @param {string} params.ocrStr
 * @param {number} params.n
 */
export async function convertPageStext({ ocrStr, n }) {
  const pageDimsMatch = ocrStr.match(/<page .+?width=['"]([\d.-]+)['"] height=['"]([\d.-]+)['"]/);
  const pageDims = { height: parseInt(pageDimsMatch[2]), width: parseInt(pageDimsMatch[1]) };

  const pageObj = new ocr.OcrPage(n, pageDims);

  /**
     * @param {string} xmlLine
     * @param {number} lineNum
     * @param {number} n
     */
  function convertLineStext(xmlLine, lineNum, n = 1) {
    const stylesLine = {};

    // Remove the <block> tag to avoid the regex matching it instead of the <line> tag.
    // We currently have no "block" level object, however this may be useful in the future.
    xmlLine = xmlLine.replace(/<block[^>]*?>/i, '');

    const xmlLinePreChar = xmlLine.match(/^[\s\S]*?(?=<char)/)?.[0];
    if (!xmlLinePreChar) { return (''); }

    const xmlLineFormatting = xmlLinePreChar?.match(/<font[^>]+/)?.[0];
    const fontName = xmlLineFormatting?.match(/name=['"]([^'"]*)/)?.[1];
    const fontSize = parseFloat(xmlLineFormatting?.match(/size\=['"]([^'"]*)/)?.[1]);

    const fontFamily = fontName?.replace(/-.+/g, '') || 'Default';

    // Currently no method of detecting drop caps for stext
    const dropCap = false;

    const lineBoxArr = [...xmlLinePreChar.matchAll(/bbox(?:es)?=['"](\s*[\d.-]+)(\s*[\d.-]+)?(\s*[\d.-]+)?(\s*[\d.-]+)?/g)][0].slice(1, 5).map((x) => Math.max(parseFloat(x), 0));

    // These regex remove blank characters that occur next to changes in formatting to avoid making too many words.
    // stext is confirmed to (at least sometimes) change formatting before a space character rather than after
    xmlLine = xmlLine.replaceAll(/(<\/font>\s*<font[^>]*>\s*)<char[^>]*?c=['"]\s+['"]\/>/ig, '$1');
    xmlLine = xmlLine.replaceAll(/<char[^>]*?c=['"]\s+['"]\/>(\s*<\/font>\s*<font[^>]*>\s*)/ig, '$1');

    // Remove spaces that are the first characters of words
    xmlLine = xmlLine.replaceAll(/(<font[^>]*>\s*)<char[^>]*?c=['"]\s+['"]\/>/ig, '$1');

    // Unlike Tesseract, stext does not have a native "word" unit (it provides only lines and letters).
    // Therefore, lines are split into words on either (1) a space character or (2) a change in formatting.
    const wordStrArr = xmlLine.split(stextSplitRegex);

    if (wordStrArr.length === 0) return (['', 0]);

    /** @type {Array<Array<{left: number, top: number, right: number, bottom: number, baseline: number}>>} */
    const bboxes = [];
    /** @type {Array<string>} */
    const text = [];
    let styleArr = [];
    styleArr = styleArr.fill('normal');

    for (let i = 0; i < wordStrArr.length; i++) {
      const wordStr = wordStrArr[i];
      const letterArr = [...wordStr.matchAll(stextCharRegex)];
      if (letterArr.length === 0) continue;
      if (typeof (letterArr[0][1]) !== 'undefined') {
        if (dropCap && i === 0) {
          styleArr.push('dropcap');
          // } else if (/superscript\=[\'\"](1|true)/i.test(letterArr[0][1])) {
          //   styleArr[i] = "sup";
        } else if (/italic/i.test(letterArr[0][1])) {
          styleArr.push('italic');
          stylesLine.italic = true;
        } else if (/small\W?cap/i.test(letterArr[0][1])) {
          styleArr.push('smallCaps');
          stylesLine.smallCaps = true;
        } else {
          styleArr.push('normal');
          stylesLine.normal = true;
        }
      } else if (styleArr.length > 0) {
        if (styleArr[styleArr.length - 1] === 'dropcap') {
          styleArr.push('normal');
        } else {
          styleArr.push(styleArr[styleArr.length - 1]);
        }
      }

      bboxes.push([]);
      text.push('');

      for (let j = 0; j < letterArr.length; j++) {
        bboxes[bboxes.length - 1].push({
          left: Math.round(parseFloat(letterArr[j][2])),
          top: Math.round(parseFloat(letterArr[j][3])),
          right: Math.round(parseFloat(letterArr[j][4])),
          bottom: Math.round(parseFloat(letterArr[j][5])),
          baseline: Math.round(parseFloat(letterArr[j][6])),
        });

        const contentStrLetter = letterArr[j][7];
        text[text.length - 1] += contentStrLetter;
      }
    }

    // Return if there are no letters in the line.
    // This commonly happens for "lines" that contain only space characters.
    if (bboxes.length === 0) return (['', 0]);

    // To calculate the slope of the baseline (and therefore image angle) the position of each glyph that starts (approximately) on the
    // baseline is compared to the first such glyph.  This is less precise than a true "best fit" approach, but hopefully with enough data
    // points it will all average out.
    const baselineFirst = [bboxes[0][0].left, bboxes[0][0].baseline];

    const baselineLast = [bboxes[bboxes.length - 1][bboxes[bboxes.length - 1].length - 1].left, bboxes[bboxes.length - 1][bboxes[bboxes.length - 1].length - 1].baseline];

    const rise = baselineLast[1] - baselineFirst[1];
    const run = baselineLast[0] - baselineFirst[0];

    const baselineSlope = !run ? 0 : rise / run;

    // NOTE: This section can probably be deleted for stext as it seems specific to Abbyy
    // While Abbyy XML already provides line bounding boxes, these have been observed to be (at times)
    // completely different than a bounding box calculated from a union of all letters in the line.
    // Therefore, the line bounding boxes are recaclculated here.
    // reduce((acc, val) => acc.concat(val), []) is used as a drop-in replacement for flat() with significantly better performance
    // const lineLeft = Math.min(...bboxes.reduce((acc, val) => acc.concat(val), []).map((x) => x[0]).filter((x) => x > 0));
    // const lineTop = Math.min(...bboxes.reduce((acc, val) => acc.concat(val), []).map((x) => x[1]).filter((x) => x > 0));
    // const lineRight = Math.max(...bboxes.reduce((acc, val) => acc.concat(val), []).map((x) => x[2]).filter((x) => x > 0));
    // const lineBottom = Math.max(...bboxes.reduce((acc, val) => acc.concat(val), []).map((x) => x[3]).filter((x) => x > 0));

    const lineBbox = {
      left: lineBoxArr[0], top: lineBoxArr[1], right: lineBoxArr[2], bottom: lineBoxArr[3],
    };

    // baselinePoint should be the offset between the bottom of the line bounding box, and the baseline at the leftmost point
    let baselinePoint = baselineFirst[1] - lineBbox.bottom;
    if (baselineSlope < 0) {
      baselinePoint -= baselineSlope * (baselineFirst[0] - lineBbox.left);
    }
    baselinePoint = baselinePoint || 0;

    const baselineOut = [round6(baselineSlope), Math.round(baselinePoint)];

    // This is only a rough estimate, however since `size` is set on individual words, this value should not matter.
    const letterHeightOut = fontSize * 0.6;

    const lineObj = new ocr.OcrLine(pageObj, lineBbox, baselineOut, letterHeightOut, null);

    let lettersKept = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i].trim() == '') { continue; }
      const bboxesI = bboxes[i];

      const bboxesILeft = Math.min(...bboxesI.map((x) => x.left));
      const bboxesIRight = Math.max(...bboxesI.map((x) => x.right));
      const bboxesITop = Math.min(...bboxesI.map((x) => x.top));
      const bboxesIBottom = Math.max(...bboxesI.map((x) => x.bottom));

      const id = `word_${n + 1}_${lineNum + 1}_${i + 1}`;

      const wordText = unescapeXml(text[i]);

      const bbox = {
        left: bboxesILeft, top: bboxesITop, right: bboxesIRight, bottom: bboxesIBottom,
      };

      const wordObj = new ocr.OcrWord(lineObj, wordText, bbox, id);
      wordObj.size = fontSize;

      // In stext, the coordinates are based on font bounding boxes, not where pixels start/end.
      wordObj.visualCoords = false;

      // There is no confidence information in stext.
      // Confidence is set to 100 simply for ease of reading (to avoid all red text if the default was 0 confidence).
      wordObj.conf = 100;

      if (styleArr[i] === 'italic') {
        wordObj.style = 'italic';
      } else if (styleArr[i] === 'smallCaps') {
        wordObj.style = 'smallCaps';
      }

      if (fontFamily !== 'Default') {
        wordObj.font = fontFamily;
      }

      if (styleArr[i] === 'sup') {
        wordObj.sup = true;
      } else if (styleArr[i] === 'dropcap') {
        wordObj.dropcap = true;
      }

      lineObj.words.push(wordObj);

      lettersKept++;
    }

    // If there are no letters in the line, drop the entire line element
    if (lettersKept === 0) return (['', 0]);

    pageObj.lines.push(lineObj);
    return (['non-empty value', baselineSlope]);
  }

  const lineStrArr = ocrStr.split(/<\/line>/);

  const angleRisePage = [];
  for (let i = 0; i < lineStrArr.length; i++) {
    const lineInt = convertLineStext(lineStrArr[i], i, n);
    if (lineInt[0] == '') continue;
    angleRisePage.push(lineInt[1]);
  }

  const angleRiseMedian = mean50(angleRisePage) || 0;

  const angleOut = Math.asin(angleRiseMedian) * (180 / Math.PI);

  pageObj.angle = angleOut;

  const langSet = pass3(pageObj);

  return { pageObj, dataTables: new LayoutDataTablePage(), langSet };
}
