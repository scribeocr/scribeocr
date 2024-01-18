import ocr from './objects/ocrObjects.js';
import { getRandomAlphanum } from './miscUtils.js';

// Returns the proportion of boxA's area contained in boxB
export function calcOverlap(boxA, boxB) {
  const left = Math.max(boxA[0], boxB[0]);
  const top = Math.max(boxA[1], boxB[1]);
  const right = Math.min(boxA[2], boxB[2]);
  const bottom = Math.min(boxA[3], boxB[3]);

  const width = right - left;
  const height = bottom - top;

  if (width < 0 || height < 0) return 0;

  const areaA = (boxA[3] - boxA[1]) * (boxA[2] - boxA[0]);
  // const areaB = (boxB[3] - boxB[1]) * (boxB[2] - boxB[0]);
  const area = width * height;

  return area / areaA;
}

/**
 * Adds lines from a new page to an existing page.
 * Based on overlap between bounding boxes, lines may be added or combined with existing lines.
 * @param {ocrPage} pageA - New page
 * @param {ocrPage} pageB - Existing page
 * @param {pageMetrics} pageMetricsObj - Page metrics
 * @param {boolean} replaceFontSize - Whether font size stats in the new line(s) should be replaced by font size in previous line.
 *  This option is used when the user manually adds a word, as the manually-drawn box will only roughly correspond to font size.
 * @param {boolean} editWordIds - Edit word IDs in `pageB` by appending random characters to the end.
 *  As word ID values must be unique, this is useful when `pageB` may contain duplicative values.
 */
export function combineData(pageA, pageB, pageMetricsObj, replaceFontSize = false, editWordIds = true) {
  const linesNew = pageA.lines;
  const { lines } = pageB;

  for (let i = 0; i < linesNew.length; i++) {
    const lineNew = linesNew[i];

    if (lineNew.words.length == 0) continue;

    const lineNewRot = ocr.cloneLine(lineNew);
    if (pageMetricsObj.angle) ocr.rotateLine(lineNewRot, pageMetricsObj.angle * -1, pageMetricsObj.dims);

    // Identify the OCR line a bounding box is in (or closest line if no match exists)
    // (1) If the new line's bounding box has significant overlap with an existing line's bounding box, add to that line.
    // (2) If the new line's bounding box has vertical overlap with 1+ existing line's bounding box, add to the closest such line.
    // (3) Otherwise, create a new line.
    let lineI = -1;

    let match;
    let matchXOverlap = 0;
    let matchXDist = 1e6;

    let closestI = 0;
    let closestMetric = 1e6;
    let afterClosest = true;
    let yDistMin = 1e6;

    for (lineI = 0; lineI < lines.length; lineI++) {
      const line = lines[lineI];

      if (line.words.length == 0) continue;

      const lineRot = ocr.cloneLine(line);
      if (pageMetricsObj.angle) ocr.rotateLine(lineRot, pageMetricsObj.angle * -1, pageMetricsObj.dims);

      const left = Math.max(lineRot.bbox[0], lineNewRot.bbox[0]);
      const top = Math.max(lineRot.bbox[1], lineNewRot.bbox[1]);
      const right = Math.min(lineRot.bbox[2], lineNewRot.bbox[2]);
      const bottom = Math.min(lineRot.bbox[3], lineNewRot.bbox[3]);

      const width = right - left;
      const height = bottom - top;

      const yOverlap = height < 0 ? 0 : height / (lineNewRot.bbox[3] - lineNewRot.bbox[1]);

      // A majority of the new line must fall within the existing line to be considered a match
      if (yOverlap >= 0.5) {
        const xOverlap = width < 0 ? 0 : width / (lineNewRot.bbox[2] - lineNewRot.bbox[0]);
        // If the lines overlap more horizontally than any previous comparison, make this line the new working hypothesis
        if (xOverlap > matchXOverlap) {
          matchXOverlap = xOverlap;
          match = line;
          // If this line has no horizontal overlap, but no other line has either, then we check the distance to the nearest line
        } else if (xOverlap == 0 && matchXOverlap == 0) {
          const xDist = Math.min(Math.abs(lineRot.bbox[2] - lineNewRot.bbox[0]), Math.abs(lineRot.bbox[0] - lineNewRot.bbox[2]));
          // If this is the closest line (so far), make this line the new working hypothesis
          if (xDist < matchXDist) {
            matchXDist = xDist;
            match = line;
          }
        }
        // If no match has been identified, the closest non-matching line needs to be identified.
        // This allows the new line to be inserted at a location that makes sense.
      } else if (!match) {
        // An ad-hoc distance metric is used, as the standard geometric distance would likely produce worse results for multi-column layouts.
        // xDist is 0 when there is overlap between x coordinates, and otherwise equal to the distance between the x coordinates.
        // yDist is calculated similarly, however is weighted 3x more.  The sum of xMetric and yMetric represents the total distance/penalty.
        const xOverlap = width < 0 ? 0 : width / (lineNewRot.bbox[2] - lineNewRot.bbox[0]);
        const xDist = xOverlap > 0 ? 0 : Math.min(Math.abs(lineRot.bbox[2] - lineNewRot.bbox[0]), Math.abs(lineRot.bbox[0] - lineNewRot.bbox[2]));
        const yDist = yOverlap > 0 ? 0 : Math.min(Math.abs(lineRot.bbox[3] - lineNewRot.bbox[1]), Math.abs(lineRot.bbox[1] - lineNewRot.bbox[3]));

        if (yDist < yDistMin) yDistMin = yDist;

        const totalMetric = xDist + yDist * 3;
        if (totalMetric < closestMetric) {
          closestMetric = totalMetric;
          closestI = lineI;
          afterClosest = lineNewRot[3] > lineRot[3];
        }
      }
    }

    // The selected match is rejected (and assumed to be in another column) if
    // (1) the horizontal gap between matched lines >5% the width of the entire page and
    // (2) the horizontal gap between matched lines is >2x the vertical gap to the nearest preceding/following line.
    // This is intended to eliminate cases when new words are inserted into the wrong column and/or floating element
    // (possibly on the other side of the page) just because vertical overlap exists.
    if (match && matchXOverlap == 0 && matchXDist > 2 * yDistMin && pageB.dims.width * 0.05 < matchXDist) match = undefined;

    const wordsNew = lineNew.words;

    if (match) {
      const { words } = match;

      for (let i = 0; i < wordsNew.length; i++) {
        const wordNew = wordsNew[i];
        wordNew.line = match;
        const wordBoxNew = wordNew.bbox;

        // Identify closest word on existing line
        let word; let wordBox; let
          wordIndex;
        let j = 0;
        do {
          wordIndex = j;
          word = words[j];
          wordBox = word.bbox;
          j += 1;
        } while (wordBox[2] < wordBoxNew[0] && j < words.length);

        // Replace id (which is likely duplicative) with unique id
        if (editWordIds) wordNew.id = word.id + getRandomAlphanum(3);

        // Add to page data
        // Note: Words will appear correctly on the canvas (and in the pdf) regardless of whether they are in the right order.
        // However, it is still important to get the order correct (this makes evaluation easier, improves copy/paste functionality in some pdf readers, etc.)
        if (wordBoxNew[0] > wordBox[0]) {
          words.splice(wordIndex + 1, 0, wordNew);
        } else {
          words.splice(wordIndex, 0, wordNew);
        }
      }

      // Short lines often contain baseline slope measurements that are inaccurate when the width of the line is extended (by adding more words).
      // Therefore, when adding words to short lines, the slope is replaced with the median slope for the entire page.
      if (match.bbox[2] - match.bbox[0] < 300) {
        const pageAngleRad = pageB.angle * (Math.PI / 180);
        const pageSlope = Math.tan(pageAngleRad);
        match.baseline[0] = pageSlope;
      }

      // Recalculate bounding box for line
      ocr.calcLineBbox(match);
    } else {
      for (let i = 0; i < wordsNew.length; i++) {
        const wordNew = wordsNew[i];

        // Replace id (which is likely duplicative) with unique id
        if (editWordIds) wordNew.id += getRandomAlphanum(3);
      }

      if (replaceFontSize) {
        // If this is the first/last line on the page, assume the textbox height is the "A" height.
        // This is done because when a first/last line is added manually, it is often page numbers,
        // and is often not the same font size as other lines.
        if (lineI == 0 || lineI + 1 == lines.length) {
          lineNew.ascHeight = lineNew.bbox[3] - lineNew.bbox[1];
          lineNew.xHeight = null;

          // If the new line is between two existing lines, use metrics from nearby line to determine text size
        } else {
          const closestLine = lines[closestI];
          lineNew.ascHeight = closestLine.ascHeight;
          lineNew.xHeight = closestLine.xHeight;

          // If the previous line's font size is clearly incorrect, we instead revert to assuming the textbox height is the "A" height.
          const lineHeight = lineNew.bbox[3] - lineNew.bbox[1];
          if (lineNew.ascHeight > lineHeight * 1.5) {
            lineNew.ascHeight = lineNew.bbox[3] - lineNew.bbox[1];
            lineNew.xHeight = null;
          }
        }
      }

      lineNew.page = pageB;

      if (afterClosest) {
        lines.splice(lineI + 1, 0, lineNew);
      } else {
        lines.splice(lineI, 0, lineNew);
      }
    }
  }
}

/**
 * @param {ocrPage} page
 * @param {boolean} applyExclude
 * @param {boolean} editInPlace
 */
export function reorderHOCR(page, layoutObj, applyExclude = true, editInPlace = false) {
  const pageInt = editInPlace ? page : structuredClone(page);

  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length == 0) return pageInt;

  const hocrALines = pageInt.lines;
  const linesNew = [];

  const priorityArr = Array(hocrALines.length);

  // 10 assumed to be lowest priority for text included in the output and is assigned to any word that does not overlap with a "order" layout box
  priorityArr.fill(10);

  for (let i = 0; i < hocrALines.length; i++) {
    const hocrALine = hocrALines[i];
    const lineBoxA = hocrALine.bbox;

    for (const [id, obj] of Object.entries(layoutObj.boxes)) {
      const overlap = calcOverlap(lineBoxA, obj.coords);
      if (overlap > 0.5) {
        if (obj.type == 'order') {
          priorityArr[i] = obj.priority;
        } else if (obj.type == 'exclude' && applyExclude) {
          // Priority "11" is used to remove lines
          priorityArr[i] = 11;
        }
      }
    }
  }

  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j < priorityArr.length; j++) {
      if (priorityArr[j] == i) {
        linesNew.push(hocrALines[j]);
      }
    }
  }

  pageInt.lines = linesNew;

  return pageInt;
}
