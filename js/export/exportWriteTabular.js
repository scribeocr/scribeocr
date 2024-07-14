import { calcOverlap } from '../modifyOCR.js';

import ocr from '../objects/ocrObjects.js';

import { saveAs } from '../utils/miscUtils.js';

import { inputData } from '../containers/app.js';
import { LayoutDataTables } from '../containers/dataContainer.js';
import { elem } from '../gui/elems.js';

/**
 * @param {ReturnType<extractTableContent>} tableWordObj
 * @param {Array<string>} extraCols
 * @param {number} startRow
 * @param {boolean} xlsxMode
 * @param {boolean} htmlMode
 */
export function createCells(tableWordObj, extraCols = [], startRow = 0, xlsxMode = true, htmlMode = false) {
  let textStr = '';
  let rowIndex = startRow;
  let rowCount = 0;

  for (const [key, value] of Object.entries(tableWordObj)) {
    const cellsSingle = createCellsSingle(value.rowWordArr, extraCols, rowIndex, xlsxMode, htmlMode);
    textStr += cellsSingle.content;
    rowIndex += cellsSingle.rows;
    rowCount += cellsSingle.rows;
  }

  return { content: textStr, rows: rowCount };
}

/**
 *
 * @param {OcrPage} pageObj
 * @param {import('../objects/layoutObjects.js').LayoutDataTablePage} layoutObj
 * @returns
 */
export function extractTableContent(pageObj, layoutObj) {
  /** @type {Object<string, ReturnType<extractSingleTableContent>>} */
  const tableWordObj = {};

  if (!layoutObj?.tables || Object.keys(layoutObj.tables).length === 0) return tableWordObj;

  for (const [key, value] of Object.entries(layoutObj.tables)) {
    tableWordObj[key] = extractSingleTableContent(pageObj, Object.values(value.boxes));
  }

  return tableWordObj;
}

// TODO: This currently creates junk rows with only punctuation, as those bounding boxes are so small they often do not overlap with other lines.
/**
 * Extracts words from a page that are within the bounding boxes of the table, organized into arrays of rows and columns.
 * The output is in the form of a 3D array, where the first dimension is the row, the second dimension is the column, and the third dimension is the word.
 * @param {OcrPage} pageObj
 * @param {Array<import('../objects/layoutObjects.js').LayoutBoxBase>} boxes
 */
export function extractSingleTableContent(pageObj, boxes) {
  /** @type {Array<OcrWord>} */
  const wordArr = [];
  /** @type {Array<bbox>} */
  const boxArr = [];
  /** @type {Array<number>} */
  const wordPriorityArr = [];

  // Sort boxes by left bound.
  const boxesArr = Object.values(boxes).sort((a, b) => a.coords.left - b.coords.left);

  const tableBox = {
    left: boxesArr[0].coords.left,
    top: boxesArr[0].coords.top,
    right: boxesArr[boxesArr.length - 1].coords.right,
    bottom: boxesArr[boxesArr.length - 1].coords.bottom,
  };

  // Unlike when exporting to text, anything not in a rectangle is excluded by default
  // priorityArr.fill(boxesArr.length+1);

  for (let i = 0; i < pageObj.lines.length; i++) {
    const lineObj = ocr.cloneLine(pageObj.lines[i]);
    ocr.rotateLine(lineObj, pageObj.angle * -1, pageObj.dims);

    // Skip lines that are entirely outside the table
    if (lineObj.bbox.left > tableBox.right || lineObj.bbox.right < tableBox.left || lineObj.bbox.top > tableBox.bottom || lineObj.bbox.bottom < tableBox.top) continue;

    // First, check for overlap with line-level boxes.
    const lineBoxALeft = {
      left: lineObj.bbox.left, top: lineObj.bbox.top, right: lineObj.bbox.left + 1, bottom: lineObj.bbox.bottom,
    };

    let boxFoundLine = false;
    // It is possible for a single line to match the inclusion criteria for multiple boxes.
    // Only the first (leftmost) match is used.
    for (let j = 0; j < boxesArr.length; j++) {
      const obj = boxesArr[j];

      if (obj.inclusionLevel !== 'line') continue;

      const overlap = obj.inclusionRule === 'left' ? calcOverlap(lineBoxALeft, obj.coords) : calcOverlap(lineObj.bbox, obj.coords);
      if (overlap > 0.5) {
        for (let k = 0; k < lineObj.words.length; k++) {
          const wordObj = lineObj.words[k];
          wordArr.push(wordObj);
          boxArr.push(lineObj.bbox);
          wordPriorityArr.push(j);
        }
        boxFoundLine = true;
        break;
      }
    }

    if (boxFoundLine) continue;

    // Second, check for overlap on the word-level boxes.
    for (const wordObj of lineObj.words) {
      let boxFoundWord = false;
      for (let j = 0; j < boxesArr.length; j++) {
        const obj = boxesArr[j];

        if (obj.inclusionLevel !== 'word') continue;

        const wordBoxALeft = {
          left: wordObj.bbox.left, top: wordObj.bbox.top, right: wordObj.bbox.left + 1, bottom: wordObj.bbox.bottom,
        };

        const overlap = obj.inclusionRule === 'left' ? calcOverlap(wordBoxALeft, obj.coords) : calcOverlap(wordObj.bbox, obj.coords);

        if (overlap > 0.5) {
          wordArr.push(wordObj);
          boxArr.push(wordObj.bbox);
          wordPriorityArr.push(j);
          boxFoundWord = true;
          break;
        }
      }

      if (boxFoundWord) continue;

      // It is possible for a word that is 100% within the table to not be included in any columns if the user sets particular inclusion rules.
      // To prevent this, any word that is unassigned with the user-specified inclusion rules is assigned using the word-level+majority rule.
      for (let j = 0; j < boxesArr.length; j++) {
        const obj = boxesArr[j];

        const overlap = calcOverlap(wordObj.bbox, obj.coords);

        if (overlap > 0.5) {
          wordArr.push(wordObj);
          boxArr.push(wordObj.bbox);
          wordPriorityArr.push(j);
          break;
        }
      }
    }
  }

  // Split lines into separate arrays for each column
  // let lastCol = -1;
  /** @type {Array<Array<{word: OcrWord, box: bbox}>>} */
  const colArr = [];
  for (let i = 0; i < boxesArr.length; i++) {
    colArr.push([]);
    for (let j = 0; j < wordPriorityArr.length; j++) {
      if (wordPriorityArr[j] === i) {
        colArr[colArr.length - 1].push({ word: wordArr[j], box: boxArr[j] });
      }
    }
  }

  // For each array, sort all words by lower bound.
  // The following steps assume that the words are ordered.
  colArr.forEach((x) => x.sort((a, b) => a.box.bottom - b.box.bottom));

  // Create rows
  // let lastBottom = 0;
  const indexArr = Array(colArr.length);
  indexArr.fill(0);
  const lengthArr = colArr.map((x) => x.length);

  /** @type {Array<Array<Array<OcrWord>>>} */
  const rowWordArr = [];

  /** @type {Array<number>} */
  const rowBottomArr = [];

  // To split lines into cells, the highest line on the page (that has not already been assigned to a cell) is idenified,
  // and establishes a the vertical bounds of a new row.
  // Next, the first unassigned line in each column is checked for whether it belongs in the new row.
  // If this is true, additional lines from each column can also be inserted into the same row.
  // This is necessary as a "line" in HOCR does not necessarily correspond to a visual line--
  // multiple HOCR "lines" may have the same visual baseline so belong in the same cell.
  while (!indexArr.every((x, index) => x === lengthArr[index])) {
    // Identify highest unassigned word
    const compArrBox = indexArr.map((x, index) => colArr[index][x]);
    compArrBox.sort((a, b) => a.box.bottom - b.box.bottom);
    const rowBox = {
      left: 0, top: 0, right: 5000, bottom: compArrBox[0].box.bottom,
    };

    /** @type {Array<Array<OcrWord>>} */
    const colWordArr = [];
    for (let i = 0; i < colArr.length; i++) {
      colWordArr[i] = [];
    }
    let rowBottom;

    for (let i = 0; i < indexArr.length; i++) {
      for (let j = indexArr[i]; j < colArr[i].length; j++) {
        const overlap = calcOverlap(colArr[i][j].box, rowBox);
        if (overlap > 0.5) {
          colWordArr[i].push(colArr[i][j].word);
          if (!rowBottom || colArr[i][j].box.bottom > rowBottom) rowBottom = colArr[i][j].box.bottom;
          indexArr[i]++;
        } else {
          break;
        }
      }
    }
    rowWordArr.push(colWordArr);
    rowBottomArr.push(rowBottom);
  }

  return { rowWordArr, rowBottomArr };
}

/**
 * Convert a single table into HTML or Excel XML rows
 * @param {ReturnType<extractSingleTableContent>['rowWordArr']} ocrTableWords
 * @param {Array<string>} extraCols
 * @param {number} startRow
 * @param {boolean} xlsxMode
 * @param {boolean} htmlMode
 * @param {boolean} previewMode
 */
function createCellsSingle(ocrTableWords, extraCols = [], startRow = 0, xlsxMode = true, htmlMode = false, previewMode = true) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

  let textStr = '';
  for (let i = 0; i < ocrTableWords.length; i++) {
    if (xlsxMode) {
      textStr += `<row r="${String(startRow + i + 1)}">`;
    } else if (htmlMode) {
      textStr += '<tr>';
    }

    for (let j = 0; j < extraCols.length; j++) {
      // Escape special characters for XML
      let colTxt = ocr.escapeXml(extraCols[j]);
      if (xlsxMode) {
        textStr += `<c r="${letters[j]}${String(startRow + i + 1)}" t="inlineStr"><is><r><t xml:space="preserve">${colTxt}</t></r></is></c>`;
      } else if (htmlMode) {
        // When generating an HTML preview, file names are abbreviated for readability
        if (previewMode && colTxt.length > 13) {
          colTxt = `${colTxt.slice(0, 20)}...`;
        }
        textStr += `<td>${colTxt}</td>`;
      }
    }

    for (let j = 0; j < ocrTableWords[i].length; j++) {
      const words = ocrTableWords[i][j];

      // In xlsx, empty cells are omitted entirely.  For other formats they are included.
      if (!words || words.length === 0) {
        if (htmlMode) {
          textStr += '<td/>';
        }
        continue;
      }

      // Sort left to right so words are printed in the correct order
      words.sort((a, b) => a.bbox.left - b.bbox.left);

      if (xlsxMode) {
        textStr += `<c r="${letters[j + extraCols.length]}${String(startRow + i + 1)}" t="inlineStr"><is>`;
      } else if (htmlMode) {
        textStr += '<td>';
      }

      for (let k = 0; k < words.length; k++) {
        const wordObj = words[k];

        const fontStylePrev = '';

        if (xlsxMode) {
          let fontStyle;
          if (wordObj.style === 'italic') {
            fontStyle = '<i/>';
          } else if (wordObj.smallCaps) {
            fontStyle = '<smallCaps/>';
          } else {
            fontStyle = '';
          }

          if (fontStyle !== fontStylePrev || k === 0) {
            const styleStr = fontStyle === '' ? '' : `<rPr>${fontStyle}</rPr>`;

            if (k === 0) {
              textStr = `${textStr}<r>${styleStr}<t xml:space="preserve">`;
            } else {
              textStr = `${textStr} </t></r><r>${styleStr}<t xml:space="preserve">`;
            }
          } else {
            textStr += ' ';
          }
        } else {
          textStr += ' ';
        }

        // DOCX is an XML format, so any escaped XML characters need to continue being escaped.
        if (xlsxMode) {
          // TODO: For now we just delete superscript tags.
          // Eventually this should be added to Word exports properly.
          textStr += ocr.escapeXml(wordObj.text);
        } else {
          textStr += wordObj.text;
        }
      }

      if (xlsxMode) {
        textStr += '</t></r></is></c>';
      } else if (htmlMode) {
        textStr += '</td>';
      }
    }

    if (xlsxMode) {
      textStr += '</row>';
    } else if (htmlMode) {
      textStr += '</tr>';
    }
  }

  return { content: textStr, rows: ocrTableWords.length };
}

/**
 *
 * @param {Array<OcrPage>} ocrPageArr
 * @param {number} minpage
 * @param {number} maxpage
 */
export async function writeXlsx(ocrPageArr, minpage = 0, maxpage = -1) {
  const { xlsxStrings, sheetStart, sheetEnd } = await import('./resources/xlsxFiles.js');
  const { BlobWriter, TextReader, ZipWriter } = await import('../../lib/zip.js/index.js');

  if (maxpage === -1) maxpage = ocrPageArr.length - 1;

  const addFilenameMode = elem.download.xlsxFilenameColumn.checked;
  const addPageNumberColumnMode = elem.download.xlsxPageNumberColumn.checked;

  const zipFileWriter = new BlobWriter();
  const zipWriter = new ZipWriter(zipFileWriter);

  let sheetContent = sheetStart;
  let rowCount = 0;
  for (let i = minpage; i <= maxpage; i++) {
    /** @type {Array<string>} */
    const extraCols = [];
    if (addFilenameMode) {
      if (inputData.pdfMode) {
        extraCols.push(inputData.inputFileNames[0]);
      } else {
        extraCols.push(inputData.inputFileNames[i]);
      }
    }
    if (addPageNumberColumnMode) extraCols.push(String(i + 1));

    const tableWordObj = extractTableContent(ocrPageArr[i], LayoutDataTables.pages[i]);
    const cellsObj = createCells(tableWordObj, extraCols, rowCount);
    rowCount += cellsObj.rows;
    sheetContent += cellsObj.content;
  }
  sheetContent += sheetEnd;

  const textReader = new TextReader(sheetContent);
  await zipWriter.add('xl/worksheets/sheet1.xml', textReader);

  for (let i = 0; i < xlsxStrings.length; i++) {
    const textReaderI = new TextReader(xlsxStrings[i].content);
    await zipWriter.add(xlsxStrings[i].path, textReaderI);
  }

  await zipWriter.close();

  const zipFileBlob = await zipFileWriter.getData();

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.xlsx`;

  saveAs(zipFileBlob, fileName);
}
