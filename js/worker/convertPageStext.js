import ocr from '../objects/ocrObjects.js';

import {
  quantile, mean50, unescapeXml, round6,
} from '../miscUtils.js';

import { pass3 } from './convertPageShared.js';

import { determineSansSerif } from '../fontStatistics.js';

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

  const lineLeft = [];
  const lineTop = [];

  const pageObj = new ocr.OcrPage(n, pageDims);

  /**
     * @param {string} xmlLine
     * @param {number} lineNum
     * @param {number} n
     */
  function convertLineStext(xmlLine, lineNum, n = 1) {
    const stylesLine = {};

    // Unlike Tesseract HOCR, Abbyy XML does not provide accurate metrics for determining font size, so they are calculated here.
    // Strangely, while Abbyy XML does provide a "baseline" attribute, it is often wildly incorrect (sometimes falling outside of the bounding box entirely).
    // One guess as to why is that coordinates calculated pre-dewarping are used along with a baseline calculated post-dewarping.
    // Regardless of the reason, baseline is recalculated here.
    const lineAllHeightArr = [];
    const baselineSlopeArr = [];
    const baselineFirst = [];

    const xmlLinePreChar = xmlLine.match(/^[\s\S]*?(?=<char)/)?.[0];
    if (!xmlLinePreChar) { return (''); }

    const xmlLineFormatting = xmlLinePreChar?.match(/<font[^>]+/)?.[0];
    const fontName = xmlLineFormatting?.match(/name=['"]([^'"]*)/)?.[1];
    const fontSize = parseFloat(xmlLineFormatting?.match(/size\=['"]([^'"]*)/)?.[1]);

    const fontFamily = determineSansSerif(fontName);

    // Currently no method of detecting drop caps for stext
    const dropCap = false;
    // let dropCapMatch = xmlLine.match(abbyyDropCapRegex);
    // if (dropCapMatch != null && parseInt(dropCapMatch[1]) > 0) {
    //   dropCap = true;
    // }

    let lineBoxArr = [...xmlLinePreChar.matchAll(/bbox(?:es)?=['"](\s*[\d.-]+)(\s*[\d.-]+)?(\s*[\d.-]+)?(\s*[\d.-]+)?/g)][0].slice(1, 5).map((x) => Math.max(parseFloat(x), 0));

    if (lineBoxArr == null) { return (''); }
    lineBoxArr = [...lineBoxArr].map((x) => parseInt(x));
    // Only calculate baselines from lines 200px+.
    // This avoids short "lines" (e.g. page numbers) that often report wild values.
    if ((lineBoxArr[4] - lineBoxArr[2]) >= 200) {
      // angleRisePage.push(baseline[0]);
      lineLeft.push(lineBoxArr[2]);
      lineTop.push(lineBoxArr[3]);
    }

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

    const bboxes = Array(wordStrArr.length);
    // let cuts = Array(wordStrArr.length);
    let text = Array(wordStrArr.length);
    text = text.fill('');
    let styleArr = Array(wordStrArr.length);
    styleArr = styleArr.fill('normal');

    for (let i = 0; i < wordStrArr.length; i++) {
      const wordStr = wordStrArr[i];
      const letterArr = [...wordStr.matchAll(stextCharRegex)];
      if (letterArr.length === 0) continue;
      if (typeof (letterArr[0][1]) !== 'undefined') {
        if (dropCap && i === 0) {
          styleArr[i] = 'dropcap';
          // } else if (/superscript\=[\'\"](1|true)/i.test(letterArr[0][1])) {
          //   styleArr[i] = "sup";
        } else if (/italic/i.test(letterArr[0][1])) {
          styleArr[i] = 'italic';
          stylesLine.italic = true;
        } else if (/small\W?cap/i.test(letterArr[0][1])) {
          styleArr[i] = 'small-caps';
          stylesLine['small-caps'] = true;
        } else {
          styleArr[i] = 'normal';
          stylesLine.normal = true;
        }
      } else if (i > 0) {
        if (styleArr[i - 1] === 'dropcap') {
          styleArr[i] = 'normal';
        } else {
          styleArr[i] = styleArr[i - 1];
        }
      }

      bboxes[i] = [];

      for (let j = 0; j < letterArr.length; j++) {
        bboxes[i][j] = [];
        bboxes[i][j].push(Math.round(parseFloat(letterArr[j][2])));
        bboxes[i][j].push(Math.round(parseFloat(letterArr[j][3])));
        bboxes[i][j].push(Math.round(parseFloat(letterArr[j][4])));
        bboxes[i][j].push(Math.round(parseFloat(letterArr[j][5])));
        // The 5th element is the y coordinate of the baseline, which is not in the Abbyy version
        bboxes[i][j].push(Math.round(parseFloat(letterArr[j][6])));

        // All text in stext is considered correct/high confidence
        const letterSusp = false;

        const contentStrLetter = letterArr[j][7];
        text[i] += contentStrLetter;

        lineAllHeightArr.push(bboxes[i][j][3] - bboxes[i][j][1]);
        if (!letterSusp && !(dropCap && i === 0)) {
          // To calculate the slope of the baseline (and therefore image angle) the position of each glyph that starts (approximately) on the
          // baseline is compared to the first such glyph.  This is less precise than a true "best fit" approach, but hopefully with enough data
          // points it will all average out.
          if (baselineFirst.length === 0) {
            baselineFirst.push(bboxes[i][j][0], bboxes[i][j][4]);
          } else {
            baselineSlopeArr.push((bboxes[i][j][4] - baselineFirst[1]) / (bboxes[i][j][0] - baselineFirst[0]));
          }
        }
      }
    }

    // NOTE: This section can probably be deleted for stext as it seems specific to Abbyy
    // While Abbyy XML already provides line bounding boxes, these have been observed to be (at times)
    // completely different than a bounding box calculated from a union of all letters in the line.
    // Therefore, the line bounding boxes are recaclculated here.
    const lineBoxArrCalc = new Array(4);
    // reduce((acc, val) => acc.concat(val), []) is used as a drop-in replacement for flat() with significantly better performance
    lineBoxArrCalc[0] = Math.min(...bboxes.reduce((acc, val) => acc.concat(val), []).map((x) => x[0]).filter((x) => x > 0));
    lineBoxArrCalc[1] = Math.min(...bboxes.reduce((acc, val) => acc.concat(val), []).map((x) => x[1]).filter((x) => x > 0));
    lineBoxArrCalc[2] = Math.max(...bboxes.reduce((acc, val) => acc.concat(val), []).map((x) => x[2]).filter((x) => x > 0));
    lineBoxArrCalc[3] = Math.max(...bboxes.reduce((acc, val) => acc.concat(val), []).map((x) => x[3]).filter((x) => x > 0));

    const baselineSlope = quantile(baselineSlopeArr, 0.5) || 0;

    // baselinePoint should be the offset between the bottom of the line bounding box, and the baseline at the leftmost point
    let baselinePoint = baselineFirst[1] - lineBoxArrCalc[3];
    if (baselineSlope < 0) {
      baselinePoint -= baselineSlope * (baselineFirst[0] - lineBoxArrCalc[0]);
    }
    baselinePoint = baselinePoint || 0;

    // In a small number of cases the bounding box cannot be calculated because all individual character-level bounding boxes are at 0 (and therefore skipped)
    // In this case the original line-level bounding box from Abbyy is used
    const lineBoxOut1 = Number.isFinite(lineBoxArrCalc[0]) && Number.isFinite(lineBoxArrCalc[1]) && Number.isFinite(lineBoxArrCalc[2])
        && Number.isFinite(lineBoxArrCalc[3]) ? lineBoxArrCalc : lineBoxArr.slice(2, 6);

    const lineBbox = {
      left: lineBoxOut1[0], top: lineBoxOut1[1], right: lineBoxOut1[2], bottom: lineBoxOut1[3],
    };

    const baselineOut = [round6(baselineSlope), Math.round(baselinePoint)];

    // TODO: This is very back-of-the-napkin, should figure out how to be more precise.
    const letterHeightOut = fontSize * 0.6;

    const lineObj = new ocr.OcrLine(pageObj, lineBbox, baselineOut, letterHeightOut, null);

    let lettersKept = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i].trim() == '') { continue; }
      const bboxesI = bboxes[i];

      const bboxesILeft = Math.min(...bboxesI.map((x) => x[0]));
      const bboxesIRight = Math.max(...bboxesI.map((x) => x[2]));
      const bboxesITop = Math.min(...bboxesI.map((x) => x[1]));
      const bboxesIBottom = Math.max(...bboxesI.map((x) => x[3]));

      const id = `word_${n + 1}_${lineNum + 1}_${i + 1}`;

      const wordText = unescapeXml(text[i]);

      const bbox = {
        left: bboxesILeft, top: bboxesITop, right: bboxesIRight, bottom: bboxesIBottom,
      };

      const wordObj = new ocr.OcrWord(lineObj, wordText, bbox, id);

      // There is no confidence information in stext.
      // Confidence is set to 100 simply for ease of reading (to avoid all red text if the default was 0 confidence).
      wordObj.conf = 100;

      if (styleArr[i] === 'italic') {
        wordObj.style = 'italic';
      } else if (styleArr[i] === 'small-caps') {
        wordObj.style = 'small-caps';
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

  pass3(pageObj);

  return { pageObj, layoutBoxes: {} };
}
