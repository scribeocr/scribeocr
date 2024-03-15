import ocr from '../objects/ocrObjects.js';

import {
  getRandomAlphanum, quantile, mean50, round6, unescapeXml,
} from '../miscUtils.js';

import { LayoutBox } from '../objects/layoutObjects.js';

import { pass2, ascCharArr, xCharArr } from './convertPageShared.js';

import { determineSansSerif } from '../fontStatistics.js';

const abbyyDropCapRegex = /<par dropCapCharsCount=['"](\d*)/i;
const abbyyLineBoxRegex = /<line baseline=['"](\d*)['"] l=['"](\d*)['"] t=['"](\d*)['"] r=['"](\d*)['"] b=['"](\d*)['"]>/i;
const abbyySplitRegex = /(?:<charParams[^>]*>\s*<\/charParams>)|(?:<\/formatting>\s*(?=<formatting))/ig;

const abbyyCharRegex = /(<formatting[^>]+>\s*)?<charParams l=['"](\d*)['"] t=['"](\d*)['"] r=['"](\d*)['"] b=['"](\d*)['"](?: suspicious=['"](\w*)['"])?[^>]*>([^<]*)<\/charParams>/ig;

/**
 * @param {Object} params
 * @param {string} params.ocrStr
 * @param {number} params.n
 */
export async function convertPageAbbyy({ ocrStr, n }) {
  // Return early if character-level data is not detected.
  // Unlike Tesseract HOCR (which by default returns word-level data which we can still use), Abbyy XML returns line-level data that is not usable.
  const pageDimsStr = ocrStr.match(/<page width=['"](\d+)['"] height=['"](\d+)['"]/);
  const pageDims = { height: parseInt(pageDimsStr[2]), width: parseInt(pageDimsStr[1]) };

  const pageObj = new ocr.OcrPage(n, pageDims);

  // This condition is met for actual character errors (xml data lacks character-level data), as well as for empty pages.
  // However, the error is only shown to the user if there are no pages with valid character data.
  if (!/<charParams/i.test(ocrStr)) {
    const warn = { char: 'char_error' };

    return {
      pageObj, fontMetricsObj: {}, layoutBoxes: {}, warn,
    };
  }

  const boxes = convertTableLayoutAbbyy(ocrStr);

  const lineLeft = [];
  const lineTop = [];

  function convertLineAbbyy(xmlLine, lineNum, n = 1) {
    const stylesLine = {};

    // Unlike Tesseract HOCR, Abbyy XML does not provide accurate metrics for determining font size, so they are calculated here.
    // Strangely, while Abbyy XML does provide a "baseline" attribute, it is often wildly incorrect (sometimes falling outside of the bounding box entirely).
    // One guess as to why is that coordinates calculated pre-dewarping are used along with a baseline calculated post-dewarping.
    // Regardless of the reason, baseline is recalculated here.
    const baselineSlopeArr = [];
    const baselineFirst = [];

    const xmlLinePreChar = xmlLine.match(/^[\s\S]*?(?=<charParams)/)?.[0];
    const xmlLineFormatting = xmlLinePreChar?.match(/<formatting[^>]+/)?.[0];
    const fontName = xmlLineFormatting?.match(/ff=['"]([^'"]*)/)?.[1];

    const fontFamily = determineSansSerif(fontName);

    let dropCap = false;
    const dropCapMatch = xmlLine.match(abbyyDropCapRegex);
    if (dropCapMatch != null && parseInt(dropCapMatch[1]) > 0) {
      dropCap = true;
    }

    let lineBoxArr = xmlLine.match(abbyyLineBoxRegex);
    if (lineBoxArr == null) { return (''); }
    lineBoxArr = [...lineBoxArr].map((x) => parseInt(x));
    // Only calculate baselines from lines 200px+.
    // This avoids short "lines" (e.g. page numbers) that often report wild values.
    if ((lineBoxArr[4] - lineBoxArr[2]) >= 200) {
      // angleRisePage.push(baseline[0]);
      lineLeft.push(lineBoxArr[2]);
      lineTop.push(lineBoxArr[3]);
    }

    // Unlike Tesseract, Abbyy XML does not have a native "word" unit (it provides only lines and letters).
    // Therefore, lines are split into words on either (1) a space character or (2) a change in formatting.

    // TODO: Investigate possible fix for too many words issue:
    // The reason for splitting letters at every formatting change is (1) this splits up superscripts from
    // the words they are attached to and (2) to split up normal and italic parts of text (even if not separated by a space),
    // as the canvas GUI currently only supports one font style per word.
    // Unfortunately, in some documents Abbyy has the nonsensical habbit of using formatting tags just to change font size
    // on a specific character (e.g. switching from font size 10.5 to 11 for a single period).
    // When this happens, the heuristic here results in too many words being created--not sure if there's an easy fix.

    // Replace character identified as tab with space (so it is split into separate word)
    // For whatever reason many non-tab values can be found in elements where isTab is true (e.g. "_", "....")
    xmlLine = xmlLine.replaceAll(/isTab=['"](?:1|true)['"][^>]*>[^<]+/ig, '> ');

    // These regex remove blank characters that occur next to changes in formatting to avoid making too many words.
    // Note: Abbyy is inconsistent regarding where formatting elements are placed.
    // Sometimes the <format> comes after the space between words, and sometimes it comes before the space between words.
    xmlLine = xmlLine.replaceAll(/(<\/formatting><formatting[^>]*>\s*)<charParams[^>]*>\s*<\/charParams>/ig, '$1');
    xmlLine = xmlLine.replaceAll(/<charParams[^>]*>\s*<\/charParams>(\s*<\/formatting><formatting[^>]*>\s*)/ig, '$1');

    // xmlLine = xmlLine.replaceAll(/(\<\/formatting\>\<formatting[^\>]*\>)(\s*<charParams[^\>]*\>\.\<\/charParams\>)\<\/formatting\>/ig, "$1")

    const wordStrArr1 = xmlLine.split(abbyySplitRegex);

    // Account for special cases:
    // 1. Filter off any array elements that do not have a character.
    //    (This can happen ocassionally, for example when multiple spaces are next to eachother.)
    //    TODO: This will drop formatting information in edge cases--e.g. if a formatting element is followed by multiple spaces.
    //    However, hopefully these are uncommon enough that they should not be a big issue.
    // 2. Period with its own "word" due to being wrapped in separate <formatting> tags
    //    This odd behavior appears around to superscripts, and makes sense when normal text is followed by a superscript followed by a period.
    //    However, it also happens when normal text is followed by a period followed by a superscript (the normal behavior),
    //    and it does not make sense for a period to get its own word in this case.

    const wordStrArr = [];
    for (let i = 0; i < wordStrArr1.length; i++) {
      const wordStrArrI = wordStrArr1[i];
      const wordMatch = wordStrArrI.match(/>([^<>]+?)(?=<\/charParams>)/g)?.map((x) => x.substring(1));
      if (!wordMatch) {
        continue;
      } else if (wordMatch.length === 1) {
        if (wordMatch[0] === '.') {
          if (wordStrArr.length > 0 && !/superscript=['"](1|true)/i.test(wordStrArr[wordStrArr.length - 1])) {
            wordStrArr[wordStrArr.length - 1] = wordStrArr[wordStrArr.length - 1] + wordStrArrI.replace(/(<formatting[^>]+>\s*)/i, '');
            continue;
          }
        }
      }
      wordStrArr.push(wordStrArrI);
    }

    if (wordStrArr.length === 0) return (['', 0]);

    const bboxes = Array(wordStrArr.length);
    let text = Array(wordStrArr.length);

    /** @type {Array<Array<OcrChar>>} */
    const charObjArrLine = Array(wordStrArr.length);
    text = text.fill('');
    let styleArr = Array(wordStrArr.length);
    styleArr = styleArr.fill('normal');
    const wordSusp = Array(wordStrArr.length);
    wordSusp.fill(false);

    for (let i = 0; i < wordStrArr.length; i++) {
      const wordStr = wordStrArr[i];
      const letterArr = [...wordStr.matchAll(abbyyCharRegex)];

      if (typeof (letterArr[0][1]) !== 'undefined') {
        if (dropCap && i === 0) {
          styleArr[i] = 'dropcap';
        } else if (/superscript=['"](1|true)/i.test(letterArr[0][1])) {
          styleArr[i] = 'sup';
        } else if (/italic=['"](1|true)/i.test(letterArr[0][1])) {
          styleArr[i] = 'italic';
          stylesLine.italic = true;
        } else if (/smallcaps=['"](1|true)/i.test(letterArr[0][1])) {
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

      // Abbyy will sometimes misidentify capital letters immediately following drop caps as small caps,
      // when they are only small in relation to the drop cap (rather than the main text).
      let dropCapFix = false;
      if (dropCap && i === 1 && styleArr[i] === 'small-caps') {
        styleArr[i] = 'normal';
        dropCapFix = true;
      }

      bboxes[i] = [];

      charObjArrLine[i] = [];

      for (let j = 0; j < letterArr.length; j++) {
        // Skip letters placed at coordinate 0 (not sure why this happens)
        if (letterArr[j][2] === '0') { continue; }

        bboxes[i][j] = [];
        bboxes[i][j].push(parseInt(letterArr[j][2]));
        bboxes[i][j].push(parseInt(letterArr[j][3]));
        bboxes[i][j].push(parseInt(letterArr[j][4]));
        bboxes[i][j].push(parseInt(letterArr[j][5]));

        let letterSusp = false;
        if (letterArr[j][6] === '1' || letterArr[j][6] === 'true') {
          wordSusp[i] = true;
          letterSusp = true;
        }

        if (dropCapFix) {
          letterArr[j][7] = letterArr[j][7].toUpperCase();
        }

        // Handle characters escaped in XML
        letterArr[j][7] = unescapeXml(letterArr[j][7]);

        const contentStrLetter = letterArr[j][7];

        const ascChar = ascCharArr.includes(contentStrLetter);
        const xChar = xCharArr.includes(contentStrLetter);

        if ((ascChar || xChar) && !letterSusp && !dropCapFix && !(dropCap && i === 0)) {
          // baselineHeightArr.push(bboxes[i][j][3]);
          // To calculate the slope of the baseline (and therefore image angle) the position of each glyph that starts (approximately) on the
          // baseline is compared to the first such glyph.  This is less precise than a true "best fit" approach, but hopefully with enough data
          // points it will all average out.
          if (baselineFirst.length === 0) {
            baselineFirst.push(bboxes[i][j][0], bboxes[i][j][3]);
          } else {
            baselineSlopeArr.push((bboxes[i][j][3] - baselineFirst[1]) / (bboxes[i][j][0] - baselineFirst[0]));
          }
        }

        text[i] += contentStrLetter;

        const bbox = {
          left: bboxes[i][j][0], top: bboxes[i][j][1], right: bboxes[i][j][2], bottom: bboxes[i][j][3],
        };

        const charObj = new ocr.OcrChar(contentStrLetter, bbox);

        charObjArrLine[i].push(charObj);
      }
    }

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

    // In general, the bounding box calculated here from the individual word boundign boxes is used.
    // In a small number of cases the bounding box cannot be calculated because all individual character-level bounding boxes are at 0 (and therefore skipped)
    // In this case the original line-level bounding box from Abbyy is used
    const lineBoxArrOut = Number.isFinite(lineBoxArrCalc[0]) && Number.isFinite(lineBoxArrCalc[1]) && Number.isFinite(lineBoxArrCalc[2]) && Number.isFinite(lineBoxArrCalc[3])
      ? lineBoxArrCalc : lineBoxArr.slice(2, 6);

    const baselineOut = [round6(baselineSlope), Math.round(baselinePoint)];

    const bbox = {
      left: lineBoxArrOut[0], top: lineBoxArrOut[1], right: lineBoxArrOut[2], bottom: lineBoxArrOut[3],
    };

    const lineObj = new ocr.OcrLine(pageObj, bbox, baselineOut);

    let lettersKept = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i].trim() == '') { continue; }
      const bboxesI = bboxes[i];

      // Abbyy-specific fix:
      // Only values > 0 are considered, since Abbyy has been observed to frequently return incorrect "0" coordinates.
      // This frequently (but not always) occurs with superscripts.
      // If this filter leaves no remaining left/right/top/bottom coordinates, the word is skipped entirely.
      // TODO: Figure out why this happens and whether these glyphs should be dropped completely.
      const bboxesILeft = Math.min(...bboxesI.map((x) => x[0]).filter((x) => x > 0));
      const bboxesIRight = Math.max(...bboxesI.map((x) => x[2]).filter((x) => x > 0));
      const bboxesITop = Math.min(...bboxesI.map((x) => x[1]).filter((x) => x > 0));
      const bboxesIBottom = Math.max(...bboxesI.map((x) => x[3]).filter((x) => x > 0));

      if (!Number.isFinite(bboxesITop) || !Number.isFinite(bboxesIBottom) || !Number.isFinite(bboxesILeft) || !Number.isFinite(bboxesIRight)) {
        continue;
      }

      const bbox = {
        left: bboxesILeft, top: bboxesITop, right: bboxesIRight, bottom: bboxesIBottom,
      };

      const id = `word_${n + 1}_${lineNum + 1}_${i + 1}`;

      const wordObj = new ocr.OcrWord(lineObj, text[i], bbox, id);
      wordObj.chars = charObjArrLine[i];
      wordObj.conf = wordSusp[i] ? 0 : 100;

      console.assert(wordObj.chars.length === text[i].length, `Likely parsing error for word: ${id}. Number of letters in text does not match number of \`ocrChar\` objects.`);

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
    const lineInt = convertLineAbbyy(lineStrArr[i], i, n);
    if (lineInt[0] == '') continue;
    angleRisePage.push(lineInt[1]);
  }

  const angleRiseMedian = mean50(angleRisePage) || 0;

  const angleOut = Math.asin(angleRiseMedian) * (180 / Math.PI);

  pageObj.angle = angleOut;

  const lineLeftAdj = [];
  for (let i = 0; i < lineLeft.length; i++) {
    lineLeftAdj.push(lineLeft[i] + angleRiseMedian * lineTop[i]);
  }
  let leftOut = quantile(lineLeft, 0.2);
  const leftAdjOut = quantile(lineLeftAdj, 0.2) - leftOut;
  // With <5 lines either a left margin does not exist (e.g. a photo or title page) or cannot be reliably determined
  if (lineLeft.length < 5) {
    leftOut = null;
  }

  pageObj.left = leftOut;
  pageObj.leftAdj = leftAdjOut;

  pass2(pageObj);

  return { pageObj, layoutBoxes: boxes };
}

/**
 * @param {string} ocrStr
 */
function convertTableLayoutAbbyy(ocrStr) {
  // Note: This assumes that block elements are not nested within table block elements
  // Not sure if this is true or not
  const tableRegex = /<block blockType=["']Table[\s\S]+?(?:<\/block>\s*)/ig;

  const tables = ocrStr.match(tableRegex);

  if (!tables) return {};

  const boxes = {};

  for (let i = 0; i < tables.length; i++) {
    let tableBoxes = {};

    const table = tables[i];
    const tableCoords = table.match(/<block blockType=['"]Table['"][^>]*?l=['"](\d+)['"] t=['"](\d+)['"] r=['"](\d+)['"] b=['"](\d+)['"]/i)?.slice(1, 5).map((x) => parseInt(x));

    let leftLast = tableCoords?.[0];

    const rows = table.match(/<row[\s\S]+?(?:<\/row>\s*)/g);

    // Columns widths are calculated using the cells in a single row.
    // The first row is used unless it contains cells spanning multiple columns,
    // in which case the second row is used.
    const firstRow = rows?.[1] && /colSpan/.test(rows[0]) ? rows[1] : rows?.[0];

    const firstRowCells = firstRow?.match(/<cell[\s\S]+?(?:<\/cell>\s*)/ig);

    if (leftLast === null || leftLast === undefined || !firstRowCells) {
      console.warn('Failed to parse table:');
      console.warn(table);
      continue;
    }

    for (let j = 0; j < firstRowCells.length; j++) {
      const cell = firstRowCells[j];
      const cellWidth = parseInt(cell.match(/width=['"](\d+)['"]/)?.[1]);

      const id = getRandomAlphanum(10);

      const cellLeft = leftLast;
      const cellRight = leftLast + cellWidth;

      leftLast = cellRight;

      const priority = Object.keys(boxes).length + Object.keys(tableBoxes).length + 1;

      tableBoxes[id] = new LayoutBox(priority, [cellLeft, tableCoords[1], cellRight, tableCoords[3]]);
      tableBoxes[id].type = 'dataColumn';
      tableBoxes[id].table = i;
    }

    // Abbyy sometimes provides column widths that are incorrect
    // If the column widths do not add up to the table width, the column widths are re-caculated from scratch.
    if (Math.abs(leftLast - tableCoords[2]) > 10) {
      let colLeftArr = [];
      let colRightArr = [];

      let colsWithData = 0;
      for (let j = 0; j < rows.length; j++) {
        const cells = rows[j].match(/<cell[\s\S]+?(?:<\/cell>\s*)/ig);
        for (let k = 0; k < cells.length; k++) {
          // Extract coordinates for every element in the cell with coordinates
          const coordsArrStr = cells[k].match(/l=['"](\d+)['"] t=['"](\d+)['"] r=['"](\d+)['"] b=['"](\d+)['"]/ig);
          if (!coordsArrStr) continue;
          const coordsArr = coordsArrStr.map((x) => x.match(/\d+/g).map((y) => parseInt(y)));
          const cellLeft = Math.min(...coordsArr.map((x) => x[0]));
          const cellRight = Math.max(...coordsArr.map((x) => x[2]));
          if (!colLeftArr[k]) {
            colLeftArr[k] = [];
            colRightArr[k] = [];
            colsWithData++;
          }
          colLeftArr[k].push(cellLeft);
          colRightArr[k].push(cellRight);
        }
      }

      // Columns that contain no data are removed
      colLeftArr = colLeftArr.filter((x) => x);
      colRightArr = colRightArr.filter((x) => x);

      // Calculate the minimum left bound of each column
      const colLeftMin = colLeftArr.map((x) => Math.min(...x));

      // Calculate the max right bound of each column, after removing observations past the minimum left bound of the next column.
      // This filter is intended to remove cells that span multiple rows.
      const colRightMax = [];
      for (let j = 0; j < colRightArr.length; j++) {
        const colRightArrJ = j + 1 === colRightArr.length ? colRightArr[j] : colRightArr[j].filter((x) => x < colLeftMin[j + 1]);
        colRightMax.push(Math.max(...colRightArrJ));
      }

      // Re-create boxes
      tableBoxes = {};
      for (let j = 0; j < colLeftArr.length; j++) {
        let cellLeft;
        if (j === 0) {
          cellLeft = tableCoords[0];
        } else if (!Number.isFinite(colRightMax[j - 1])) {
          cellLeft = Math.round(colLeftMin[j]);
        } else {
          cellLeft = Math.round((colLeftMin[j] + colRightMax[j - 1]) / 2);
        }

        let cellRight;
        if (j + 1 === colLeftArr.length) {
          cellRight = tableCoords[2];
        } else if (!Number.isFinite(colRightMax[j])) {
          cellRight = colLeftMin[j + 1];
        } else {
          cellRight = Math.round((colLeftMin[j + 1] + colRightMax[j]) / 2);
        }

        const id = getRandomAlphanum(10);

        const priority = Object.keys(boxes).length + Object.keys(tableBoxes).length + 1;

        tableBoxes[id] = new LayoutBox(priority, [cellLeft, tableCoords[1], cellRight, tableCoords[3]]);
        tableBoxes[id].type = 'dataColumn';
        tableBoxes[id].table = i;
      }

      console.log(`Table width does not match sum of rows (${String(tableCoords[2])} vs ${String(leftLast)}), calculated new layout boxes using column contents.`);
    }

    Object.assign(boxes, tableBoxes);
  }

  return boxes;
}
